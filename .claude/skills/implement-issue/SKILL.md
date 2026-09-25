---
name: implement-issue
description: Implements a change from a GitHub issue or prompt in the community-event-analytics repo (React + TypeScript + Vite + ECharts dashboard with a privacy-safe build-time summary and an optional Google sign-in mode). Confirms the contributor is assigned, branches from the upstream main (fork-aware), derives acceptance criteria, verifies each criterion with appropriate behavior tests, browser checks, or documentation evidence, respects the repo's data/privacy boundaries from AGENTS.md, commits atomically with advisory readability preferences, runs scope-appropriate checks (documentation accuracy, links, commands, format and generic scan for prose; full checks for code), checks UI changes in the browser on synthetic data, and updates AGENTS.md/docs/.env.example when behavior or settings change.
argument-hint: [issue number, issue URL, path to an issue/doc, or a plain description]
---

You are implementing a change described in an issue or prompt for `Women-Devs-SG/community-event-analytics`. Read [AGENTS.md](../../../AGENTS.md) now if you haven't this session — it is the source of truth for the code map, the two data paths (public summary vs. google-signin), security boundaries, conventions, and verification. Follow every step in order. Do not skip steps or combine commits.

## Arguments

`$ARGUMENTS` contains either:

- An issue number or URL — fetch it: `gh issue view <N> --repo Women-Devs-SG/community-event-analytics --json number,title,body,labels,assignees`
- Raw issue text (title, description, acceptance criteria)
- A file path to an issue/doc (read it with Read)
- A plain description of the change

If no arguments are given, ask the user what to implement.

---

## Step 0 — Parse the issue

Issues here come from the repo's issue forms, so sections appear as `###` headings with the form's field labels, plus the shared sections added by `create-issue`.

| Field                         | Where to find it                                                            | Fallback                         |
| ----------------------------- | --------------------------------------------------------------------------- | -------------------------------- |
| **Issue number**              | Argument or URL                                                             | None — Step 8a then uses no link |
| **Title**                     | Issue title (strip the `[Bug]: ` / `[Feature]: ` / `[Docs]: ` prefix)       | Ask the user                     |
| **Type**                      | Title prefix or labels (`bug`, `enhancement`, `documentation`)              | Infer from the description       |
| **Description**               | "What happened?" / "Community need or problem" / "Documentation issue"      | The full prompt                  |
| **Proposed change**           | "Proposed solution" / "Proposed improvement" / "Expected"                   | Derive it                        |
| **Data and privacy**          | "Data and privacy considerations"                                           | Assess it yourself in Step 2.5   |
| **Acceptance criteria**       | "Acceptance criteria" (Happy path / Error path), or a "Done when" checklist | Derive them (Step 2)             |
| **Out of scope**              | "Out of scope"                                                              | Nothing explicitly excluded      |
| **Technical context**         | "Technical context" or "Where to make the change"                           | Identify from the code map       |
| **Additional test scenarios** | "Additional test scenarios"                                                 | None beyond the ACs              |
| **Hard constraints**          | "Hard constraints"                                                          | AGENTS.md defaults (Step 2.5)    |
| **Dependency issues**         | "Dependency issues"                                                         | None                             |

**Branch name** (in priority order):

1. A branch name stated in the issue.
2. Derived from the title: lowercase, hyphens, type prefix, slug under 40 characters, filler words dropped:
   - Feature → `feat/<slug>` · Bug → `fix/<slug>` · Docs → `docs/<slug>` · Tests only → `test/<slug>` · Refactor → `refactor/<slug>` · Tooling/CI → `chore/<slug>`
   - Prefer including the issue number: `feat/1-data-notes`.

---

## Step 1 — Assignment and branch setup

### 1a. Assignment (issue-based work only)

CONTRIBUTING.md requires contributors to be assigned by a maintainer before starting.

```bash
gh issue view <N> --repo Women-Devs-SG/community-event-analytics --json assignees,state --jq '{state, assignees: [.assignees[].login]}'
gh api user --jq .login
```

- Issue closed → stop and tell the user.
- Assigned to someone else → stop: "Issue #N is assigned to <login>. Pick another issue or ask the maintainers."
- Unassigned, and the user isn't a maintainer → warn: "You aren't assigned to #N yet. Comment on the issue and wait for a maintainer before starting." Ask whether to continue anyway (AskUserQuestion).

### 1b. Find the upstream remote

Contributors usually work from a fork, where `origin` is the fork and `upstream` is `Women-Devs-SG/community-event-analytics`. Maintainers may only have `origin`.

```bash
git remote -v
BASE_REMOTE=$(git remote | grep -qx upstream && echo upstream || echo origin)
git fetch "$BASE_REMOTE"
git branch --show-current
```

Confirm `$BASE_REMOTE` points at `Women-Devs-SG/community-event-analytics`. If neither remote does, tell the user how to add it: `git remote add upstream https://github.com/Women-Devs-SG/community-event-analytics.git`.

### 1c. Branch

Check `git status --short` before switching branches. Preserve unrelated local work; do not switch or stash a dirty working tree.

**If on `main` with a clean working tree:** create the new branch from the fetched upstream main:

```bash
git checkout -b <branch-name> "$BASE_REMOTE/main"
```

**If on a branch matching the target name:** check whether it contains current upstream main:

```bash
git merge-base --is-ancestor "$BASE_REMOTE/main" HEAD
```

Exit 0 means current; exit 1 means behind; other failures mean the comparison could not be verified. Being behind is informational: report it and continue the requested implementation. Do not automatically merge, rebase, reset, or amend existing history. Rebase only when the user explicitly requests it; an implementation request alone does not authorize history rewriting. Use `pre-push-audit`'s isolated integration check to assess compatibility with main.

**If on an unrelated branch, or the working tree has uncommitted changes:** do not switch or stash. Report the branch and `git status --short`, and wait for the user.

```bash
git status --short && git log --oneline -5
```

### 1d. Install and hooks

If `node_modules/` is missing, run `npm ci` (this also installs the shared pre-commit hook). Keep routine work on synthetic data for this shell — never read real community data to verify a code change:

```bash
export VITE_DATA_SOURCE=synthetic          # PowerShell: $env:VITE_DATA_SOURCE='synthetic'
```

---

## Step 2 — Acceptance criteria

List explicit acceptance criteria verbatim. If missing or vague, derive a numbered checklist of binary, verifiable outcomes. Each must be falsifiable — "the dashboard shows the notes" is not; "with synthetic data, both notes from `summary.source.limitations` appear above the footer on both tabs, and no heading renders when the list is empty" is.

```
Acceptance criteria (derived):
1. <outcome>
2. <outcome>
3. Required checks for this scope pass (documentation review, format and scan for prose; full suite for code).
```

Track each criterion in TodoWrite.

---

## Step 2.5 — Scope, constraints, and data path

### Out of scope

```
Out of scope (must NOT implement):
- <item>
```

If none: "None stated — use judgement; keep the change to the issue's files."

### Hard constraints

Always include the AGENTS.md defaults that apply to the files you will touch:

- Public summary path: never publish row-level data, participant IDs, or response IDs; keep `assertNoRowIdentifiers`; apply disclosure rules before serialization; never lower thresholds to make a test pass.
- HTML templates and ECharts tooltip formatters: escape inserted data/config strings with `esc` (`src/components.ts`) or use DOM text APIs.
- Nulls and unknowns stay null/unknown — never zero; never substitute synthetic rows after a real source fails.
- Environment settings: update `src/config.ts`, `src/vite-env.d.ts`, `.env.example`, docs, and `.github/workflows/deploy.yml` together; no `VITE_` credentials; never read or spread the whole `import.meta.env`.
- Filters: update `src/summary/scope.ts` reachable selections as well as the UI.
- Summary format: keep `SUMMARY_VERSION`, `src/summary/build.ts`, and browser loading (`src/data.ts`, `src/summary/live.ts`) compatible.
- Sign-in mode: access decisions stay in `apps-script/Code.gs`; the decoded ID token in the browser is display-only; tokens and live rows never go to storage, logs, or fixtures.
- Chart lifecycle: dispose ECharts instances and listeners in controller `dispose`; resize on tab visibility.

```
Hard constraints (must satisfy):
- <constraint from the issue>
- <applicable AGENTS.md defaults>
```

### Data path

State which path(s) the change touches — this decides tests and manual checks:

- **Public summary (build time):** `src/data/**`, `src/summary/build.ts|scope.ts|generate.ts|types.ts`, `src/privacy.ts`, `src/metrics.ts`, `scripts/build-summary.mjs`
- **google-signin (browser):** `src/auth/**`, `src/summary/live.ts`, `src/data/adapters/apps-script.ts`, `apps-script/Code.gs`
- **Presentation only:** `src/main.tsx`, `src/dash-*.ts`, `src/components.ts`, `src/style.css`, `src/theme.ts`
- **Docs/tooling only**

### Additional test scenarios

List them — assign each an appropriate verification method in Step 2.6.

---

## Step 2.6 — Test plan from acceptance criteria

**Every acceptance criterion and additional scenario needs appropriate verification and recorded evidence.** Follow [verification matched to the change](../review-pr/reference/verification.md): automated behavior checks, manual UI/live checks, or documentation review. Existing tests count when they cover the behavior. Documentation criteria need accuracy, link, and command checks, not Vitest assertions that prose exists. Classify mixed changes per criterion; documentation does not exempt accompanying code changes.

This repo co-locates tests as `src/**/*.test.ts`, organized by behavior (see AGENTS.md → Verification and handoff):

| Change                                                                                | Test type                                                      | File                                                   |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------ |
| Normalization, validation, aliases, timezones, synthetic data                         | unit                                                           | `src/data/data.test.ts`                                |
| Disclosure rules (`src/privacy.ts`)                                                   | unit                                                           | `src/privacy.test.ts`                                  |
| Summary generation, scopes, published identifiers, survey suppression, Sheets adapter | unit                                                           | `src/summary/summary.test.ts`                          |
| Sign-in: Apps Script helpers, Apps Script adapter, live loading, token display        | unit (mocked `fetch`)                                          | `src/auth/signin.test.ts`                              |
| HTML escaping                                                                         | unit                                                           | `src/components.test.ts`                               |
| `src/metrics.ts`, `src/sentiment.ts` (no test file yet)                               | unit                                                           | create `src/metrics.test.ts` / `src/sentiment.test.ts` |
| React shell, dashboard DOM/ECharts rendering, CSS                                     | **manual** (no component test setup)                           | browser check on synthetic data                        |
| Real Google sign-in or a deployed Apps Script                                         | **manual**, maintainer-authorized only                         | —                                                      |
| Docs-only                                                                             | documentation review — accuracy, links, commands, format, scan | changed documentation sections                         |

For a presentation change, still automate the data it depends on where possible — e.g. a test that `buildSummary` produces the `limitations` the UI will render.

```
Test plan (derived from ACs):

Happy path:
  AC #1 — <criterion>
    → Type: automated | manual UI/live | documentation
    → File: <path>
    → Evidence planned: <test assertion, observed interaction, or documentation checks>

Error path / edge cases:
  AC #N — ...

Additional scenarios:
  TS #1 — ...
```

Mock external services. Tests must not depend on a real sheet, account, or network. Track each verification item in TodoWrite. For uncovered application behavior, write a meaningful regression test and confirm it fails for the right reason before implementing the fix. Existing adequate coverage need not be duplicated. Documentation and manual-only criteria do not require failing unit tests before work begins.

---

## Step 3 — Commit plan

Plan atomic commits. Each changes one logical unit and leaves applicable checks passing. AGENTS.md and CONTRIBUTING.md do not mandate a commit-message format. Use these readability preferences unless the user or a documented repository policy specifies otherwise:

- Prefer a short, clear imperative subject, matching history such as `fix Apps Script spreadsheet access` or `add automated pre-commit checks`. Conventional prefixes are also acceptable.
- Aim for roughly 72 characters or fewer and usually omit a trailing period; these are suggestions, not blockers.
- Add a body when it helps explain why or a non-obvious decision; no fixed line count is required. Include `Closes #N` in the final commit or PR body when the work completes an issue.

Do not rewrite existing commits solely to enforce these preferences. Merge commits are not prohibited by the repository; assess their content and integration normally.

```
Commit plan:
1. show data notes above the dashboard footer
2. document the data notes section in AGENTS.md
```

Tests go in the same commit as the behavior they cover.

---

## Step 4 — Confirm conventions for the files you'll touch

From AGENTS.md → Implementation conventions:

- Two-space indent, single quotes, semicolons, explicit types, `import type` for type-only imports. Prettier and ESLint enforce most of this — don't hand-format against them.
- Keep the React shell plus imperative DOM/ECharts controllers; don't convert dashboards to React unless the issue asks.
- Adopter-specific values (branding, aliases, segment labels/order, exclusions, rating settings) go in `src/config.ts`, not in charts.
- Source transformations belong in adapters/normalization; dashboards read canonical summary fields.
- Don't change the TypeScript version outside its pinned release line, or bypass peer-dependency checks.

---

## Step 5 — Implement each commit

### 5a. Tests first

For this commit's automated behavior criteria that lack adequate coverage, write tests specific enough to fail if the implementation is wrong, then confirm the expected failure. For existing coverage, identify and run the relevant tests. Skip this test-writing step for documentation and manual-only criteria; follow their planned verification instead:

```bash
npm test -- src/<area>/<file>.test.ts
```

### 5b. Implementation

Before editing, check each file against the out-of-scope list and the hard constraints. Then implement following nearby code. Don't touch generated files: `public/dashboard-summary.json`, `dist/`, `node_modules/`.

### 5c. Focused tests

Run the relevant tests for behavior changes. For documentation-only work, perform the planned documentation review instead; do not invent a test file for prose.

```bash
npm test -- src/<area>/<file>.test.ts
```

Fix failures before committing.

### 5d. Format and lint

For documentation-only changes, run formatting and the generic scan; lint is part of the code-change path below. Existing commit hooks still run unchanged.

```bash
npm run format          # then review the diff it produced
npm run lint
```

Fix causes. Don't add `eslint-disable` or `@ts-ignore` to silence a rule without a specific, commented reason.

### 5e. Commit

Stage only this commit's files, and check the staged list:

```bash
git add <specific-files>          # never git add -A or git add .
git diff --cached --name-only
git commit -m "$(cat <<'EOF'
<clear subject; short imperative wording preferred>

<optional body: why this change exists or any non-obvious decisions>
EOF
)"
```

The pre-commit hook runs `npm run check:commit` (whitespace, format, lint, generic scan, typecheck, tests) with synthetic data. If it fails, fix the cause and commit again — never use `--no-verify`, and don't amend to hide a hook failure.

Repeat Step 5 for each planned commit.

---

## Step 6 — Full verification

Choose checks using [verification matched to the change](../review-pr/reference/verification.md). Documentation-only work requires technical accuracy, link/command checks, `npm run format:check`, `npm run scan:generic`, and `git diff --check`. The full suite below applies to code/configuration/tooling or mixed changes. Do not bypass existing hooks or CI.

```bash
npm run format:check
npm run lint
npm run scan:generic
npm test
npm run build            # includes typecheck and regenerates the synthetic summary
git diff --check
```

For changes to the public summary path, also inspect the output:

```bash
node -e "const s=require('./public/dashboard-summary.json'); console.log(Object.keys(s), s.source.limitations, Object.keys(s.scopes).length)"
```

Confirm no new field carries row-level values.

**UI changes:** run `npm run dev` (use the URL Vite prints) and check on synthetic data: both tabs, filters and Reset, chart clicks and drill-downs, empty states (e.g. a filter combination with no events), a narrow screen (~375px), and the browser console for errors. Record what you checked. If you can't open a browser, list these as manual checks for `pre-push-audit` — don't imply they passed.

If anything fails, fix it in a new commit and re-run until clean.

---

## Step 7 — Acceptance criteria verification

For each AC, record its verification category, concrete evidence, and PASS/FAIL/UNVERIFIED result. Name the passing test, observed manual result, or documentation checks:

```
AC #1 — PASS → src/summary/summary.test.ts › "lists withheld events in limitations"
AC #2 — PASS (manual UI) → both tabs show the notes; checked in the browser on synthetic data
AC #3 — PASS → npm run check:commit and npm run build
AC #4 — PASS (documentation) → README reset instructions match src/components.ts; links, format, and scan checked
```

**Gate:** every AC has appropriate verification evidence. Documentation review can satisfy documentation criteria without unit tests. Missing required behavior coverage needs a meaningful test; unavailable checks remain UNVERIFIED and must be reported as outstanding, not passed merely because they have a manual classification.

---

## Step 8 — Update living documentation

Commit each doc update separately if it has real content. Skip a doc when nothing changed.

### 8a — Link the issue

The final commit or the PR body includes `Closes #<N>` (or `Part of #<N>`).

### 8b — AGENTS.md

Update only affected sections: the code map (new or moved files), the test file list (a new `*.test.ts`), data/security boundaries, or conventions. Don't rewrite accurate sections.

### 8c — User and adopter docs

| Change                                         | Update                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------- |
| Visible dashboard behavior or setup            | `README.md`                                                                   |
| Configuration, aliases, segments, branding     | `docs/configuration.md`                                                       |
| Metrics, denominators, privacy rules, contract | `docs/data-contract-v1.md` (including its conformance gaps), `SECURITY.md`    |
| Source preparation or Google Sheets            | `docs/data-preparation.md`                                                    |
| Sign-in or `apps-script/Code.gs`               | `docs/google-signin.md` — remind adopters to deploy a new Apps Script version |
| Deployment or release                          | `docs/publishing.md`                                                          |
| Contributor workflow                           | `CONTRIBUTING.md`                                                             |

### 8d — Environment settings

If a setting was added, renamed, or removed, update together: `src/config.ts` (or `src/summary/generate.ts` for build-only settings), `src/vite-env.d.ts` (public `VITE_` settings only), `.env.example` with a placeholder and one-line comment, docs, and the `env:` mapping in `.github/workflows/deploy.yml`. Never write a real value. Then run `npm run scan:generic`.

---

## Step 9 — Report

In under 20 lines:

1. **Issue / branch:** `#N` and branch name (and whether you're assigned)
2. **Commits:** `git log --oneline "$BASE_REMOTE/main"..HEAD`
3. **Tests added:** count and files
4. **Data path touched:** public summary / google-signin / presentation / docs
5. **Acceptance criteria:** all passed, or what's outstanding
6. **Checks:** format, lint, scan, tests, build — and the browser checks done (or listed as manual)
7. **Docs updated:** which files, and which were skipped and why
8. **Next step:** usually "run /pre-push-audit, then push to your fork and open a PR"

Don't repeat code that's visible in the diff.

---

## Guardrails

- **Never** commit to `main`. Pushing to `main` on the upstream repo deploys GitHub Pages.
- **Never** use `git add -A` / `git add .`; name files.
- **Never** use `--no-verify` or disable the pre-commit hook.
- **Never** mark work done while required checks fail or required verification remains unavailable. Use the documentation-only check set where applicable; never bypass existing hooks or CI, or ignore failures from checks that ran.
- **Never** read real community data, print environment contents, or commit local/configured `.env*` files, real sheet IDs, Apps Script URLs, OAuth client IDs, or credentials. The tracked `.env.example` is the sole environment-file exception: update it when settings change, using only documented demo defaults or placeholders, never real deployment identifiers or secrets.
- **Never** weaken `scan:generic`, `assertNoRowIdentifiers`, privacy thresholds, or Apps Script access checks to get a change through.
- Keep commits focused on one logical change. Prefer subjects that communicate intent; wording and punctuation preferences are advisory, not reasons to reject work or rewrite history.
- If the change creates new generated files or local artifacts, add them to `.gitignore` in the same commit.
- If `package-lock.json` changes because of a new dependency, justify the dependency in the commit body and run `npm audit` for it. Keep new dependencies out of the public browser bundle unless needed there.
