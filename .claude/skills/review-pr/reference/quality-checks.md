# Code quality and boundary checks (review-pr Step 4)

Run each check against the PR diff (`git diff "$BASE_REMOTE/main"...HEAD`). Record every finding in this format:

```
[<CATEGORY>] <short title>
  File:    <path>:<line>
  Detail:  <what is wrong, and why it matters here>
  Fix:     <specific change; link AGENTS.md or a doc section>
  Verdict: BLOCKER | WARNING
```

Categories: `PRIVACY`, `SECURITY`, `QUALITY`, `CONVENTION`, `DOCS`.

---

## 1. Public summary: no row-level data (PRIVACY)

Applies when `src/summary/**`, `src/privacy.ts`, `src/metrics.ts`, `src/data/**`, or `scripts/build-summary.mjs` changed.

- `assertNoRowIdentifiers(summary, data)` is still called in `src/summary/generate.ts`. Removed or bypassed → **BLOCKER**.
- New fields in `src/summary/types.ts` (`DashboardSummary`, `ScopeSummary`, `SummaryComment`, …) carry aggregates, event metadata, or threshold-checked comment text only. A field with participant IDs, response IDs, per-person rows, or `response_id` on comments → **BLOCKER**.
- Build it and look:
  ```bash
  VITE_DATA_SOURCE=synthetic npm run summary
  node -e "const s=require('./public/dashboard-summary.json'); console.log(Object.keys(s), Object.keys(s.scopeData[0].effectiveness), Object.keys(s.scopeData[0].community))"
  ```

## 2. Disclosure before serialization (PRIVACY)

- Thresholds come from `communityConfig.privacy.minimumSegmentSize` (via `isDisclosureSafe` / `minimumSegmentSize()`), not new numeric literals. A threshold lowered, or a test changed to expect a lower one → **BLOCKER**.
- Per-event survey suppression in `src/summary/build.ts` (`eventsMeetingThreshold` for ratings and comments) still applies to every new survey-derived figure. A new figure computed from `data.responses`/`data.feedback` instead of the rated/published sets → **BLOCKER**.
- Grouped breakdowns use `disclosureGroups` / `protectedCrossTab` with distinct-person counting (`participantIdOf`) where people, not rows, are being counted.
- Suppression added only in chart code (`src/dash-*.ts`), while the summary still carries the value → **BLOCKER**. Suppress in the summary.

## 3. HTML and tooltip escaping (SECURITY)

The dashboards build HTML strings for `innerHTML` and ECharts tooltip formatters.

```bash
git diff "$BASE_REMOTE/main"...HEAD -- src | grep -nE '^\+.*(innerHTML|insertAdjacentHTML|formatter:|dangerouslySetInnerHTML)'
```

For each hit, confirm every interpolated data or config value (event names, topics, comment text, segment labels, config strings) passes through `esc(...)` from `src/components.ts`, or uses `textContent` / React text. An unescaped value → **BLOCKER**. `dangerouslySetInnerHTML` → **BLOCKER** unless the content is fully static.

## 4. Environment settings and credentials (SECURITY / DOCS)

```bash
git diff "$BASE_REMOTE/main"...HEAD | grep -nE '^\+.*(import\.meta\.env|process\.env|env\[|VITE_[A-Z_]+|GOOGLE_[A-Z_]+)'
```

- A bare `import.meta.env` read or spread (not `import.meta.env.VITE_NAME`) → **BLOCKER**. It inlines every `VITE_` variable into the bundle.
- A new `VITE_` name carrying a secret, sheet ID, or key → **BLOCKER**. Build-only settings belong in `src/summary/generate.ts` without the `VITE_` prefix.
- New or renamed settings must appear in **all** of `.env.example` (placeholder + comment), the relevant doc (`docs/configuration.md` / `docs/google-signin.md` / README), the `env:` block of `.github/workflows/deploy.yml`, and, for `VITE_` names, `src/vite-env.d.ts` and the per-key `env` object in `src/config.ts`. Each one missing → **WARNING** (**BLOCKER** if missing from `deploy.yml`, since the deployed site would silently ignore it).
- A real-looking value anywhere (sheet ID, `script.google.com/macros/s/AKfy…`, `….apps.googleusercontent.com`, a private key) → **BLOCKER**. `npm run scan:generic` should also catch it.

## 5. Sign-in boundary (SECURITY)

Applies when `src/auth/**`, `src/summary/live.ts`, `src/data/adapters/apps-script.ts`, or `apps-script/Code.gs` changed.

- `checkClaims_` still verifies audience = `CLIENT_ID`, issuer, expiry, and `email_verified`; `isAllowed_` still checks the sharing list; `doPost` still calls both before returning data. Any weakened → **BLOCKER**.
- Access decided in the browser from the decoded token (`readIdToken`) → **BLOCKER**. It's display-only.
- Tokens or rows written to `localStorage`/`sessionStorage`/IndexedDB, logged, or put in a URL → **BLOCKER**.
- `Code.gs` changed with no note to adopters about deploying a new Apps Script version (PR body or `docs/google-signin.md`) → **WARNING**.
- The build no longer deletes `public/dashboard-summary.json` in google-signin mode (`scripts/build-summary.mjs`) → **BLOCKER**.

## 6. Generic-repo scan not weakened (SECURITY)

```bash
git diff "$BASE_REMOTE/main"...HEAD -- scripts/check-generic-repo.mjs
```

Removed patterns, new entries in `ignoredFiles` / `allowedBrandFiles` / `allowedSourceUrlFiles`, or loosened regexes → **BLOCKER**, unless the linked issue explicitly asks for it and explains why.

## 7. Vacuous suppressions (QUALITY)

```bash
git diff "$BASE_REMOTE/main"...HEAD | grep -nE '^\+.*(eslint-disable|@ts-ignore|@ts-expect-error|@ts-nocheck|as any|as unknown as|prettier-ignore)'
```

Each needs a specific comment explaining why. Without one → **WARNING**. `@ts-nocheck`, or a file-wide `eslint-disable` → **BLOCKER**. Changes to `eslint.config.mjs` that turn rules off globally → **BLOCKER** unless the issue asks for it.

## 8. Duplicated constants and scattered config (CONVENTION)

- Adopter-specific values (colors, labels, segment names/order, thresholds, rating bounds, tab names) hard-coded in `src/dash-*.ts`, `src/components.ts`, or `src/theme.ts` instead of `src/config.ts` → **WARNING**.
- A literal duplicating an existing constant (e.g. `10` for the privacy threshold, `'Not stated'` instead of the segment's `unknownLabel`, a second copy of `DATASET_KEYS`) → **WARNING**.

## 9. Nulls, denominators, and grains (QUALITY)

- A new `?? 0` / `|| 0` on a measurement that can be unknown (`registered`, `attended`, ratings, `demand_index`) → **WARNING**. **BLOCKER** if it changes a published figure. See the data contract's null rules.
- Joining anonymous survey responses to registrations or demographics on event alone → **BLOCKER** (AGENTS.md).
- Counting rows where the metric is defined per distinct person → **BLOCKER** for published metrics.

## 10. Filters and summary format (QUALITY)

- A new filter in `src/components.ts` without matching updates to `reachableSelections` / `scopeKey` / `matchesSelection` in `src/summary/scope.ts` → **BLOCKER**. Selections would have no precomputed summary.
- A changed `DashboardSummary` shape without updating `SUMMARY_VERSION` (if incompatible), `src/data.ts`, and `src/summary/live.ts` → **BLOCKER**.

## 11. Chart lifecycle (QUALITY)

New `echarts.init(...)` calls must be disposed in the controller's `dispose`. New `addEventListener` calls on `window`/`document` must be removed in cleanup. Missing → **WARNING**.

## 12. Orphaned and generated files (QUALITY)

- A new source file that nothing imports, or a new export with no users → **WARNING**.
- Committed generated or local files (`public/dashboard-summary.json`, `dist/`, `.env`, `.env.local`, `*.stackdump`, exports under `data-source-excel/`) → **BLOCKER**.
- New generated files not added to `.gitignore` → **WARNING**.

## 13. Dependencies and CI (SECURITY)

- `package-lock.json` changed without `package.json`, or vice versa → **WARNING**.
- A new runtime dependency imported by browser code → **WARNING**: justify its bundle cost. Server/build-only code belongs in `src/summary/generate.ts` / `scripts/`.
- Workflow changes that widen `permissions:`, add `pull_request_target`, echo secrets, or pass secrets to steps that don't need them → **BLOCKER**.
- TypeScript upgraded outside its pinned release line, or peer-dependency checks bypassed (`--force`, `--legacy-peer-deps`) → **BLOCKER** (AGENTS.md).

## 14. Docs kept in step (DOCS)

Behavior changes should update the matching doc (see `implement-issue` Step 8c): the data contract for metric/privacy changes, `docs/google-signin.md` for sign-in, `.env.example` for settings, and AGENTS.md's code map and test list for new files or test files. Missing → **WARNING**.
