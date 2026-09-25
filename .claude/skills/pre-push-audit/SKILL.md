---
name: pre-push-audit
description: Pre-push audit gate for community-event-analytics. Confirms the branch is not main and tests submitted commits and integration with upstream main in detached temporary worktrees (fork-aware), without rewriting contributor history, offers non-blocking commit-message readability suggestions, audits test coverage for changed files against the behavior-based test files, runs scope-appropriate checks with explicit documentation verification and synthetic data for code checks, checks the data/privacy boundaries from AGENTS.md (no row-level data in the public summary, escaped HTML, no VITE_ credentials, sign-in checks server-side), lists the manual browser and sign-in checks a human must confirm, and drafts the PR from the repo's template. Never pushes.
argument-hint: [optional: push remote and branch, default "origin <current-branch>"]
allowed-tools: Bash, Read, Grep, Glob, TodoWrite, AskUserQuestion
---

You are the pre-push gate for `Women-Devs-SG/community-event-analytics` — see [AGENTS.md](../../../AGENTS.md) for the code map, data paths, security boundaries, and verification commands. The developer is about to push commits. Your job is to confirm the push is safe:

- the branch isn't `main`, and its integration with current upstream main is assessed without changing contributor history;
- commit messages receive advisory readability feedback;
- tests exist and pass;
- privacy and security boundaries hold;
- anything that needs human eyes (dashboard UI, real sign-in) has been checked by a human.

**Do not push anything yourself — you are a gate, not a pusher.**

Run every step in order. Stop and report if a step blocks.

---

## Step 0 — Scope

Contributors usually push to their fork (`origin`) and open a PR against `Women-Devs-SG/community-event-analytics` (`upstream`). Maintainers may only have `origin`.

```bash
git remote -v
BASE_REMOTE=$(git remote | grep -qx upstream && echo upstream || echo origin)
git fetch "$BASE_REMOTE"
BRANCH=$(git branch --show-current)
git log --oneline "$BASE_REMOTE/main"..HEAD
git status --short
```

- **If `BRANCH` is `main`**, **BLOCK**: "Pushing to main deploys GitHub Pages. Create a branch: `git checkout -b <name>`, then re-run /pre-push-audit."
- If there are no commits ahead of `$BASE_REMOTE/main`, report "Nothing to push" and stop.
- If `git status --short` shows uncommitted changes, preserve them. Audit the committed tip in a detached temporary worktree; report that uncommitted changes are excluded.

Push target: from `$ARGUMENTS`, otherwise `origin $BRANCH`. If the target branch is `main` on the upstream repo, **BLOCK** as above.

---

## Step 1 — Isolate the submitted commits

Follow [the worktree audit procedure](../review-pr/reference/worktree-audit.md): verify the upstream remote, record the submitted and base SHAs, and create a detached worktree for the submitted tip. Run subsequent diff and verification commands there. Being behind main is informational and does not block a push.

Keep the contributor's branch and working tree unchanged. After checking the submitted commits in Step 4c, use a separate temporary worktree to test integration with the recorded base. Report conflicts without resolving them. Do not rebase, amend, reset, or recommend a force-push as a side effect of this audit.

If isolation is unavailable, report which checks could not run and continue the available read-only review; do not substitute the contributor's working tree for the integration experiment. Clean up worktrees you created on every exit, following the linked procedure.

---

## Step 2 — Commit message check

AGENTS.md and CONTRIBUTING.md do not mandate a commit-message format or prohibit merge commits. Short, plain imperative subjects are a useful preference based on history, not a release gate. Keep style feedback advisory unless the user or a documented repository policy explicitly requires otherwise; cite that requirement when applying it.

### 2a — Collect

```bash
git log --format="%h|||%s" "$BASE_REMOTE/main"..HEAD
```

### 2b — Review subjects for readability

| Preference                                                     | Action                                                                                                                       |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Clear, concise subject; roughly 72 characters or fewer         | Suggest shortening a cumbersome subject or clarifying an empty/vague one; length alone never blocks.                         |
| Imperative wording, usually without a trailing period          | Optional wording suggestion only; punctuation or tense never blocks.                                                         |
| No unexplained `fixup!`, `squash!`, `amend!`, or `WIP` markers | Note a possible unfinished cleanup step; judge readiness from the actual change and checks, not the marker alone.            |
| Merge commits                                                  | Allowed. Inspect their changes and integration normally; do not demand linear history or infer a violation from the subject. |

Either capitalization and conventional prefixes such as `feat:` are acceptable. Avoid repetitive cosmetic feedback when the message is already understandable.

### 2c — Report

```
Suggestion: abc1234 "Added notes to footer."
  Optional: "add notes to footer" matches the common imperative style. Does not block.
```

### 2d — Continue without rewriting history

List useful suggestions and continue. Commit style alone does not block push clearance or require rewriting history. Actual defects, failed required checks, and documented requirements are assessed in their relevant steps. If the contributor requests help changing existing history, handle that separately, taking published/shared commits into account, then rerun the audit.

```
✓ Commit messages: N commit(s) reviewed — S optional suggestions
```

---

## Step 2.5 — Pull issue context

Find the linked issue from the branch name (`feat/12-…`) or commit messages (`Closes #12`, `#12`):

```bash
echo "$BRANCH" | grep -oE '(^|/)[0-9]+' | tr -d '/' | head -1
git log --format="%s %b" "$BASE_REMOTE/main"..HEAD | grep -oE '#[0-9]+' | head -1
gh issue view <N> --repo Women-Devs-SG/community-event-analytics --json number,title,body,assignees
gh pr list --repo Women-Devs-SG/community-event-analytics --head "$BRANCH" --state open --json number,body
```

From the issue or PR body, extract: "Acceptance criteria" (happy and error path separately, or a "Done when" checklist), "Out of scope", "Hard constraints", "Additional test scenarios", and "Data and privacy considerations".

If the issue is assigned to someone other than the current `gh api user --jq .login`, add a WARNING: CONTRIBUTING.md asks contributors to work only on issues assigned to them.

If nothing is found, print "Issue context: not found — skipping scope, constraint, and AC-mapping checks (4d–4f)." and continue. **Record the issue number** for the PR in Step 8.

---

## Step 3 — Identify changed files

```bash
git diff --name-only "$BASE_REMOTE/main"...HEAD
```

Sort each file into buckets (a file can be in more than one):

| Bucket                                     | Paths                                                                                                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Public summary path (privacy-critical)** | `src/summary/build.ts`, `src/summary/scope.ts`, `src/summary/types.ts`, `src/summary/generate.ts`, `src/privacy.ts`, `scripts/build-summary.mjs`                                                 |
| **Data pipeline**                          | `src/data/**` (adapters, normalize, validate, load, contract), `src/types.ts`, `src/metrics.ts`, `src/summary/sentiment-score.ts`                                                                |
| **Sign-in path (access-critical)**         | `src/auth/**`, `src/summary/live.ts`, `src/data/adapters/apps-script.ts`, `apps-script/Code.gs`                                                                                                  |
| **Presentation**                           | `src/main.tsx`, `src/dash-*.ts`, `src/components.ts`, `src/sentiment.ts`, `src/style.css`, `src/theme.ts`, `index.html`, `public/**`                                                             |
| **Configuration**                          | `src/config.ts`, `src/vite-env.d.ts`, `.env.example`                                                                                                                                             |
| **Tooling / CI**                           | `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.js`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `.gitattributes`, `.githooks/**`, `scripts/**`, `.github/**` |
| **Docs**                                   | `*.md`, `docs/**`, `LICENSE`                                                                                                                                                                     |
| **Tests**                                  | `src/**/*.test.ts`                                                                                                                                                                               |

Flag now:

- Any **public summary path** or **sign-in path** file: Step 4e must run the matching boundary checks.
- Any **presentation** file: Step 5 requires a browser check.
- `apps-script/Code.gs`: adopters must deploy a new Apps Script version; Step 5 and the PR body must say so.
- `.github/workflows/deploy.yml`: it only runs on `main`, so it can't be verified before merge; the PR body must say so.

---

## Step 4 — Test coverage audit

### 4a — Map changed source files to tests

Use this mapping (from AGENTS.md → Verification and handoff):

| Changed file(s)                                                                        | Expected test file                                                           |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/data/normalize.ts`, `validate.ts`, `load.ts`, `adapters/synthetic.ts`             | `src/data/data.test.ts`                                                      |
| `src/privacy.ts`                                                                       | `src/privacy.test.ts`                                                        |
| `src/summary/build.ts`, `scope.ts`, `types.ts`, `adapters/google-sheets.ts`            | `src/summary/summary.test.ts`                                                |
| `src/auth/**`, `src/summary/live.ts`, `adapters/apps-script.ts`, `apps-script/Code.gs` | `src/auth/signin.test.ts`                                                    |
| `src/components.ts` (the `esc` helper)                                                 | `src/components.test.ts`                                                     |
| `src/metrics.ts`, `src/sentiment.ts`                                                   | `src/metrics.test.ts` / `src/sentiment.test.ts` (to be created)              |
| Presentation-only (`main.tsx`, `dash-*.ts`, CSS, layout in `components.ts`)            | No automated test — manual browser check (Step 5)                            |
| Tooling, configuration, `scripts/**`                                                   | Relevant behavior/tool checks and full suite; assess regression coverage     |
| Documentation                                                                          | Accuracy, links, commands, formatting, and generic scan; no prose unit tests |

For each changed file with an expected test file, check that the diff changes that test file, or that an existing test already covers the changed behavior:

```bash
git diff --name-only "$BASE_REMOTE/main"...HEAD -- 'src/**/*.test.ts'
grep -rn "<changed function name>" src --include='*.test.ts'
```

### 4b — Gaps

Changed behavior in the data pipeline, public summary path, sign-in path, or privacy rules with no test change and no existing coverage is a gap. **BLOCK**:

```
✗ PUSH BLOCKED — test coverage gaps
┌───────────────────────────────┬──────────────────────────────┬────────────────────────────────────┐
│ File (function)               │ Behavior changed             │ Add a test in                      │
├───────────────────────────────┼──────────────────────────────┼────────────────────────────────────┤
│ src/summary/build.ts (…)      │ <what changed>               │ src/summary/summary.test.ts        │
└───────────────────────────────┴──────────────────────────────┴────────────────────────────────────┘
Add tests (see AGENTS.md → Verification and handoff), then re-run /pre-push-audit.
```

A test file that is empty, skipped (`it.skip`, `describe.skip`, `.only`), or trivially passing (`expect(true).toBe(true)`) counts as missing.

If there are no behavior-coverage gaps, report that result separately from documentation verification and manual checks; do not imply those checks have already passed.

### 4b-2 — Formatting side effects

`npm run format` can reformat files outside the change. Compare changed files against the issue's scope. For any file whose diff is only formatting:

```
[QUALITY] Out-of-scope formatting change
  File:    <path>
  Verdict: WARNING — drop it from this branch so the PR shows only the intended change.
```

### 4c — Full suite on synthetic data

Follow [verification matched to the change](../review-pr/reference/verification.md). For documentation-only work, review accuracy and changed links/commands, then run `npm run format:check`, `npm run scan:generic`, and the diff whitespace check. Use the full suite below for code/configuration/tooling or mixed changes. Existing hooks and CI remain unchanged and must not be bypassed.

```bash
export VITE_DATA_SOURCE=synthetic        # PowerShell: $env:VITE_DATA_SOURCE='synthetic'
npm run format:check
npm run lint
npm run scan:generic
npm test
npm run build                            # includes typecheck
git diff --check "$BASE_REMOTE/main"...HEAD
```

**BLOCK the push if any of these fails.** Report the command and the first errors. If a failure is pre-existing on `$BASE_REMOTE/main`, verify by checking out main in a temporary worktree. Then ask the developer whether to proceed — don't silently ignore it.

Then run the integration check in [the worktree audit procedure](../review-pr/reference/worktree-audit.md), including the same checks on the combined tree when behind main. Record submitted-tip and integration results separately. Confirmed conflicts or integration failures block audit clearance; being behind alone does not. Unavailable checks mean incomplete verification, not a conflict or a passing result. Return to the submitted-tip worktree for the remaining diff review.

### 4d — Out-of-scope adherence

If Step 2.5 found out-of-scope items, read the diff and **BLOCK** on any that were implemented:

```
✗ PUSH BLOCKED — out-of-scope change
  Item:  <out-of-scope text>
  Found: <file>:<line> — <description>
  Fix:   revert it, or move it to a separate branch and issue.
```

If none were specified: "Out of scope: not specified — skipping."

### 4e — Boundary and constraint checks

Run the checks that apply to the buckets from Step 3, plus any hard constraints from Step 2.5. Each violation **BLOCKS**.

| Check                                      | Applies when                                | How                                                                                                                                                                                                                                       |
| ------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No row-level data in the public summary    | Public summary path changed                 | `assertNoRowIdentifiers` is still called in `src/summary/generate.ts`; new fields in `src/summary/types.ts` hold aggregates or threshold-checked text only; run `npm run summary` and inspect new keys in `public/dashboard-summary.json` |
| Disclosure before serialization            | Public summary path or `privacy.ts` changed | Thresholds come from `communityConfig.privacy`, not new literals; no threshold lowered; per-event survey suppression still applied in `build.ts`                                                                                          |
| HTML escaping                              | Presentation changed                        | `git diff "$BASE_REMOTE/main"...HEAD -- src \| grep -nE '^\+.*(innerHTML\|formatter:\|\$\{)'`, then confirm interpolated data/config strings pass through `esc(...)` or use `textContent` / React text                                    |
| No `VITE_` credentials, no whole-env reads | Configuration or any `src/` change          | `grep -rnE "import\.meta\.env(\s*[;,)]\|\s*$)" src` returns nothing new; no new `VITE_*KEY*`/`*SECRET*`/`*SHEET_ID*` names                                                                                                                |
| Env settings documented together           | A setting added, renamed, or removed        | It appears in `.env.example`, the docs, and `.github/workflows/deploy.yml` (and in `src/vite-env.d.ts` if `VITE_`)                                                                                                                        |
| Sign-in checks stay server-side            | Sign-in path changed                        | `checkClaims_` still checks audience, issuer, expiry, and verified email; `isAllowed_` still checks the sharing list; the browser doesn't gate access on the decoded token                                                                |
| No persisted tokens or rows                | Sign-in path changed                        | `git diff … -- src \| grep -nE '^\+.*(localStorage\|sessionStorage\|indexedDB\|console\.(log\|info)\(.*(token\|credential\|rows))'` is empty                                                                                              |
| Filters stay precomputed                   | Filter UI or `scope.ts` changed             | New filter fields are handled in `reachableSelections`/`scopeKey`/`matchesSelection` and covered in `summary.test.ts`                                                                                                                     |
| Summary format compatibility               | `src/summary/types.ts` changed              | `SUMMARY_VERSION` bumped if the shape changed incompatibly; `src/data.ts` and `src/summary/live.ts` updated                                                                                                                               |
| Nulls stay nulls                           | Data pipeline or metrics changed            | No new `?? 0` / `                                                                                                                                                                                                                         |     | 0` on measurements that can be unknown |
| Generated files not committed              | Always                                      | Diff contains none of `public/dashboard-summary.json`, `dist/`, `.env`, `.env.local`                                                                                                                                                      |

```
✗ PUSH BLOCKED — boundary violated
  Rule:      <rule>
  Violation: <file>:<line> — <description>
  Fix:       <specific remediation>
```

### 4f — Acceptance criteria → verification mapping

**Every acceptance criterion and additional scenario from Step 2.5 needs appropriate verification evidence.** Use [the verification categories](../review-pr/reference/verification.md): automated behavior, manual UI/live, or documentation. Classify independently when no implementation plan exists. For automated behavior, identify meaningful existing or new coverage, for example:

```bash
grep -rn "<keyword from AC>" src --include='*.test.ts'
```

Documentation criteria need recorded accuracy, link/command checks, formatting, and generic-scan results; no Vitest test for prose is required. Mixed changes retain behavior checks for their code criteria. Missing required behavior coverage or a failed criterion is a **BLOCK**:

```
✗ PUSH BLOCKED — acceptance criterion not covered
  AC:  <criterion>
  Fix: supply the appropriate behavior test, observed manual result, or documentation verification evidence.
```

```
AC verification: N/N passed; categories: A automated, M manual UI/live, D documentation
```

Classification alone is not a pass. List required checks that could not run as UNVERIFIED and mark the audit incomplete. Retain the explicit optional live-check treatment in Step 5 without counting it as passed.

If none were found: "Acceptance criteria: not specified — skipping."

---

## Step 5 — Human testing gate

There is no end-to-end or component test setup, so dashboard rendering and real Google sign-in need a person.

### 5a — Classify

| Bucket changed                      | Manual check                                                                                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Presentation                        | `npm run dev` on synthetic data: both tabs; Year/Format/Topic/Event filters and Reset; a combination with no events; bubble and bar clicks; feedback search; ~375px width; browser console has no errors  |
| Public summary path / data pipeline | Open `/dashboard-summary.json` from the dev server and confirm new or changed fields hold aggregates only; spot-check that a withheld event shows no rating or comments                                   |
| Sign-in path (browser)              | Only a maintainer with an authorized test setup: sign in as a shared account (sees data), a non-shared account (sees "doesn't have access"), then sign out. Otherwise, record "live sign-in not verified" |
| `apps-script/Code.gs`               | Maintainer: paste into the test sheet's Apps Script, deploy a new version, repeat the sign-in checks                                                                                                      |
| `.github/workflows/deploy.yml`      | Can't run before merge — maintainer watches the first Pages deploy after merge                                                                                                                            |
| Documentation                       | Documentation evidence collected in Step 4; no additional human-confirmation gate solely for prose                                                                                                        |
| Tooling, pure tests                 | No additional browser/live checks unless the changed behavior requires them                                                                                                                               |

### 5b — Checklist

```
Manual testing required before push:

□ [UI] npm run dev → Event effectiveness and Community profile tabs; filters + Reset; empty
  combination; ~375px width; console clean.
  Affected: src/main.tsx, src/style.css

□ [SIGN-IN] (maintainer) shared account sees data; non-shared account sees the access
  message; sign-out clears the dashboard. Or: "live sign-in not verified".
  Affected: src/auth/google-identity.ts
```

Before adding an item, check whether it can be automated (data shape, text in the summary, an access-check helper). If coverage is missing, report the gap and the appropriate test file as a blocker. Do not implement tests or create commits during this audit. The contributor can run:

```bash
npm test -- src/<area>/<file>.test.ts
```

If nothing needs manual testing, print "No manual testing required." and skip to Step 6.

### 5c — Block for confirmation

**Stop.** Use AskUserQuestion with the checklist: "Have you completed all of the above checks? YES to continue, NO to abort." Items marked "not verified" are acceptable when stated honestly, and they carry into the PR body.

Anything other than YES:

```
✗ PUSH BLOCKED — manual testing not confirmed.
Complete the checks above, then re-run /pre-push-audit.
```

---

## Step 6 — Final scan

```bash
# Debug leftovers in added lines
git diff "$BASE_REMOTE/main"...HEAD -- src apps-script | grep '^+' | grep -nE 'console\.log\(|debugger;|\.only\(|TODO|FIXME' && echo "FOUND" || echo "CLEAN"

# Large files (> 1 MB)
git diff --name-only "$BASE_REMOTE/main"...HEAD | while read f; do
  [ -f "$f" ] || continue
  size=$(stat -c%s "$f" 2>/dev/null || stat -f%z "$f")
  [ "$size" -gt 1048576 ] && echo "LARGE: $f ($size bytes)"
done
```

`console.error` / `console.warn` for real diagnostics is an existing pattern (e.g. the load-error handlers in `src/main.tsx`, the build script's output). A leftover `console.log`, `debugger`, or `.only(` is not. Use judgement, but **BLOCK** on `.only(` (it silently skips the rest of the suite) and on any large or binary data file.

---

## Step 7 — Clearance report

```
✓ PRE-PUSH AUDIT PASSED

Branch:        <branch> (not main)
Submitted tip: <head-sha>
Base checked:  <BASE_REMOTE>/main @ <base-sha>
Integration:   already current | tested in temporary worktree | conflicts | not verified
Commits:       <N> reviewed — <S> optional style suggestions
Checks:        <command: PASS / FAIL / UNVERIFIED / N/A with scope reason>
Verification:  <behavior coverage, observed browser results, and documentation evidence>
Boundaries:    <checks run> — all satisfied | N/A
AC verified:   <passed>/<total>; <A> automated, <M> manual UI/live, <D> documentation; <U> unverified | N/A
Manual QA:     confirmed by developer | not required | partially "not verified" (stated)
```

Then print the exact push command. Do not run it:

```
Cleared to push: git push -u origin <branch>
```

If required automated checks or integration testing were unavailable, use `AUDIT INCOMPLETE` instead of `PASSED` and list the missing checks; do not claim full clearance. Clean up the audit worktrees before returning, including on blocked or incomplete runs.

---

## Step 8 — Pull request

```bash
gh pr list --repo Women-Devs-SG/community-event-analytics --head "$BRANCH" --state open --json number,url
```

**If an open PR exists:** print its URL. If new commits change what the PR does, suggest updating its description. Then stop.

**If none:** fill in `.github/PULL_REQUEST_TEMPLATE.md` from the actual diff — no placeholder text.

### 8a — What changed

- First line: `Closes #<N>` (from Step 2.5). If no issue was found, warn the developer.
- The user-facing outcome, then the implementation in 2–5 bullets.
- The data path touched (public summary / google-signin / presentation / docs).
- If `apps-script/Code.gs` changed: "Adopters must deploy a new Apps Script version (docs/google-signin.md)."
- If `deploy.yml` changed: "Deploy workflow runs only on main; verify the first deploy after merge."

### 8b — Validation

Tick only what this audit ran or the developer confirmed:

```
- [x] `npm run format:check`
- [x] `npm run lint`
- [x] `npm test`
- [x] `npm run scan:generic`
- [x] `npm run typecheck`            (via npm run build)
- [x] `npm run build`
- [ ] Both dashboard tabs reviewed when UI changed        ← tick only if Step 5 confirmed
- [ ] Filters reviewed when data or metrics changed        ← tick only if Step 5 confirmed
```

Add a line for anything recorded as "not verified", e.g. live sign-in.

### 8c — Data and privacy

Tick honestly from Steps 3–4e:

```
- [x] No real participant data, direct identifiers, credentials, or private sheet IDs were added
- [x] Synthetic data remains the default
- [ ] Contract/configuration documentation was updated if behavior changed
```

### 8d — Offer to open

Print the full PR body and the title (the most significant commit subject, or the issue title without its `[Feature]: ` prefix). Ask with AskUserQuestion whether to open it now. The branch must be pushed first. Check with `git ls-remote --heads origin "$BRANCH"`; if it isn't pushed, tell the developer to run the Step 7 command first.

**If YES**, write the body to a temp file and run:

```bash
FORK_OWNER=$(gh repo view "$(git remote get-url origin)" --json owner --jq .owner.login)
gh pr create --repo Women-Devs-SG/community-event-analytics --base main \
  --head "$FORK_OWNER:$BRANCH" --title "<title>" --body-file "$BODY_FILE"
```

Print the PR URL. **If NO:** "PR description ready — open it on GitHub when you're ready."

---

## Guardrails

- **Never** run `git push` yourself; print the command.
- **Never** rebase, reset, amend, or switch the contributor's branch during the audit. Temporary integration work must stay in detached worktrees created for this run.
- **Never** clear a push to `main`. Pushes to upstream `main` deploy GitHub Pages.
- **Never** use or suggest `--no-verify`; the pre-commit hook complements this audit.
- **Never** mark the audit passed without the developer's YES when manual items exist, and never tick a PR checkbox for a check that didn't run.
- **Never** run checks against real community data or print environment contents. Force `VITE_DATA_SOURCE=synthetic`.
- **Never** write a trivially passing test to close a gap.
- **Never** open a PR without asking first.
- If a failure is pre-existing on `main`, say so clearly and ask the developer before unblocking.
- Make the PR body specific to the diff — a reviewer should never have to fill in boilerplate.
