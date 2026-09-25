# Known gap patterns

Classes of mistake seen in this repository. `review-pr` checks each finding against this list and appends new patterns. **Append only — never edit or remove an entry.**

The first entries come from the initial codebase review and the build-time summary and sign-in work. They're mistakes this codebase has actually made, or narrowly avoided.

---

### Per-event survey data leaks through event labels or comparisons

**Category:** PRIVACY
**Trigger:** A new survey-derived figure (average, verdict, distribution, comment list, tooltip) is added or changed.
**Check:** Confirm it's computed from the rated/published sets in `src/summary/build.ts` (events meeting `eventsMeetingThreshold`), not from `data.responses` / `data.feedback` directly. A threshold on the whole selection isn't enough: comments carry event names, and two selections that differ by one event can be subtracted.
**Verdict:** BLOCKER
**First seen:** initial codebase review — 2026-09-24

### Row-level field added to the public summary

**Category:** PRIVACY
**Trigger:** `src/summary/types.ts` or the object returned by `buildSummary` gains a field.
**Check:** The field holds aggregates, event metadata, or threshold-checked text only. `response_id`, `participant_id`, or per-person arrays must never be published. `assertNoRowIdentifiers` only catches exact ID strings, not other personal data.
**Verdict:** BLOCKER
**First seen:** initial codebase review — 2026-09-24

### Suppression only in chart rendering

**Category:** PRIVACY
**Trigger:** A privacy fix or new small-group rule is implemented in `src/dash-*.ts` or `src/components.ts`.
**Check:** The value must also be absent from `public/dashboard-summary.json`. Anyone can download that file directly.
**Verdict:** BLOCKER
**First seen:** initial codebase review — 2026-09-24

### Whole `import.meta.env` referenced

**Category:** SECURITY
**Trigger:** Any change touching `import.meta.env`.
**Check:** `grep -rnE "import\.meta\.env(\s*[;,)]|\s*$)" src` — only per-key reads (`import.meta.env.VITE_X`) are allowed. A bare reference inlines every `VITE_` variable, including any mistakenly set secret, into the browser bundle.
**Verdict:** BLOCKER
**First seen:** initial codebase review — 2026-09-24

### Setting added without deploy workflow mapping

**Category:** DOCS
**Trigger:** A new or renamed environment setting.
**Check:** The name appears in `.env.example`, the docs, the `env:` block of `.github/workflows/deploy.yml`, and (for `VITE_`) `src/vite-env.d.ts` plus the per-key object in `src/config.ts`. Without the workflow mapping, the deployed site silently uses the default.
**Verdict:** BLOCKER (workflow missing) / WARNING (docs missing)
**First seen:** build-time summary work — 2026-09-24

### Unescaped data in an HTML string or chart tooltip

**Category:** SECURITY
**Trigger:** New `innerHTML` template or ECharts `formatter` returning HTML.
**Check:** Every interpolated event name, topic, comment, segment label, or config string passes through `esc` from `src/components.ts`.
**Verdict:** BLOCKER
**First seen:** initial codebase review — 2026-09-24

### Dates formatted in UTC instead of the reporting timezone

**Category:** QUALITY
**Trigger:** A `Date` is turned into a displayed or keyed date string.
**Check:** `grep -n "toISOString().slice(0, 10)" src` — calendar dates must be formatted in `communityConfig.data.reportingTimezone` (see `isoDate` / `parseDate` in `src/data/normalize.ts`). Otherwise far-east timezones show the previous day.
**Verdict:** WARNING
**First seen:** initial codebase review — 2026-09-24

### Categories outside the configured order silently dropped

**Category:** QUALITY
**Trigger:** A chart or ordering uses a configured order list (e.g. `YOE_ORDER.filter(...)`).
**Check:** Values not in the list must still appear (appended, or pooled as unknown), or a validation warning must say they were dropped. Silent filtering undercounts real data.
**Verdict:** WARNING
**First seen:** initial codebase review — 2026-09-24

### Staff exclusion applied in one dashboard but not the other

**Category:** QUALITY
**Trigger:** A participant metric is added or changed in `src/summary/build.ts`.
**Check:** It follows the same `isCommunityStaff` exclusion as the community figures, or the difference is deliberate and labelled in the UI.
**Verdict:** WARNING
**First seen:** initial codebase review — 2026-09-24

### Access decided in the browser in sign-in mode

**Category:** SECURITY
**Trigger:** Changes to `src/auth/**`, `src/summary/live.ts`, or `apps-script/Code.gs`.
**Check:** The browser never gates data on the decoded ID token (`readIdToken` is display-only). `apps-script/Code.gs` keeps `checkClaims_` (audience, issuer, expiry, verified email) and `isAllowed_` (sharing list) before returning rows.
**Verdict:** BLOCKER
**First seen:** Google sign-in work — 2026-09-24

### Stale public summary shipped in sign-in mode

**Category:** PRIVACY
**Trigger:** Changes to `scripts/build-summary.mjs` or the build scripts in `package.json`.
**Check:** In `VITE_DATA_SOURCE=google-signin` mode, the build deletes `public/dashboard-summary.json` and writes no new one. Otherwise, a summary from an earlier local run could be deployed publicly.
**Verdict:** BLOCKER
**First seen:** Google sign-in work — 2026-09-24

### Deployment identifiers committed

**Category:** SECURITY
**Trigger:** Any change to `.env.example`, `apps-script/Code.gs`, docs, or tests.
**Check:** No real sheet ID, Apps Script `/macros/s/AKfy…` URL, `….apps.googleusercontent.com` client ID, or private key. `npm run scan:generic` checks for these; also look at `scripts/check-generic-repo.mjs` for weakened patterns.
**Verdict:** BLOCKER
**First seen:** Google sign-in work — 2026-09-25
