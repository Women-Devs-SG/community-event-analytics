# Test coverage audit (review-pr Step 5)

Tests are co-located as `src/**/*.test.ts` and run with Vitest (`npm test`, or `npm test -- <file>` for one file). There is no component or end-to-end test setup, so rendering is checked manually.

## 1. File → test mapping

| Changed file(s)                                                                        | Expected coverage                                                                              |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/data/normalize.ts`, `validate.ts`, `load.ts`, `adapters/synthetic.ts`             | `src/data/data.test.ts`                                                                        |
| `src/privacy.ts`                                                                       | `src/privacy.test.ts`                                                                          |
| `src/summary/build.ts`, `scope.ts`, `types.ts`, `adapters/google-sheets.ts`            | `src/summary/summary.test.ts`                                                                  |
| `src/auth/**`, `src/summary/live.ts`, `adapters/apps-script.ts`, `apps-script/Code.gs` | `src/auth/signin.test.ts` (Apps Script helpers via `?raw`)                                     |
| `src/components.ts` `esc`                                                              | `src/components.test.ts`                                                                       |
| `src/metrics.ts`, `src/sentiment.ts`                                                   | `src/metrics.test.ts` / `src/sentiment.test.ts` (to be created)                                |
| `src/main.tsx`, `src/dash-*.ts`, CSS, layout in `src/components.ts`                    | Manual browser check; automate the data they render where possible                             |
| `scripts/**`, config                                                                   | Relevant behavior/tool checks and the full suite; assess whether regression coverage is needed |
| Documentation                                                                          | Accuracy, links, commands, formatting, and generic scan; no unit tests for prose               |

For each changed behavior in a row with expected coverage, check the diff adds or changes a test that exercises it:

```bash
git diff --name-only "$BASE_REMOTE/main"...HEAD -- 'src/**/*.test.ts'
grep -rn "<function or behavior>" src --include='*.test.ts'
```

Changed behavior in the data pipeline, public summary, privacy rules, or sign-in path with no covering test:

```
[COVERAGE] Untested behavior change
  File:    <path> (<function>)
  Detail:  <what changed>
  Fix:     add a test in <test file> that fails without the change
  Verdict: BLOCKER
```

Presentation-only changes with no test are fine, but they must appear in the manual test plan (Step 3).

## 2. Acceptance criteria → verification (hard gate)

Every acceptance criterion and additional scenario needs appropriate verification under [verification matched to the change](verification.md): automated behavior, manual UI/live, or documentation. Existing tests count when they cover the behavior. Documentation review must record accuracy, link/command checks, formatting, and generic-scan evidence. Classify each criterion independently in mixed changes; documentation never exempts accompanying code behavior.

```
AC #1 (happy) — <text>
  → src/summary/summary.test.ts › "<test name>" — PASS
AC #2 (error) — <text>
  → MANUAL (visual) — <interaction and observed result> — PASS | FAIL | UNVERIFIED
AC #3 — <text>
  → DOCUMENTATION — <file/section, accuracy and link/command evidence, format/scan results> — PASS | FAIL | UNVERIFIED
AC #4 (behavior) — <text>
  → NO REQUIRED BEHAVIOR COVERAGE — BLOCKER
```

Missing required behavior coverage or failed verification → **BLOCKER**. Unavailable required checks → incomplete verification; name what remains. Documentation criteria with successful documentation checks pass without a unit test. Manual classification alone does not count as a passing result. Do not demand tests that merely assert prose exists.

## 3. Trivially passing or weakened tests

Read each new or changed test and flag:

- `it.only` / `describe.only` → **BLOCKER** (skips the rest of the suite in CI).
- `it.skip` / `describe.skip` / `it.todo` added without a linked reason → **WARNING**.
- Assertions that can't fail: `expect(true).toBe(true)`, only `toBeDefined()` / `toBeTruthy()` on a value that's always present, or snapshot-only tests of large objects → **BLOCKER** if that's the only coverage for an AC.
- Existing assertions loosened to make the change pass (a threshold, an expected count, `toThrow` removed) → **BLOCKER** unless the issue changes that behavior on purpose. Then say so.
- Tests that depend on a real sheet, Google account, network, the current date, or `.env` values → **BLOCKER**. Mock `fetch`; use the synthetic adapter or inline fixtures.
- Synthetic data counts changed (`src/data/adapters/synthetic.ts`) without updating the tests that assert them (e.g. `persons.size`) → the suite fails; record it under Step 6.

## 4. Out-of-scope adherence

If the issue lists out-of-scope items, check the diff doesn't implement them:

```
[SCOPE] Out-of-scope change
  Item:    <text from issue>
  Found:   <file>:<line>
  Fix:     move to a separate PR and issue
  Verdict: BLOCKER
```

Unrelated formatting-only changes to other files → **WARNING** (they hide the real diff).

## 5. Hard constraints

For each hard constraint in the issue, name the check that proves it holds. Use the matching section of [quality-checks.md](quality-checks.md) where one exists (e.g. privacy → sections 1–2, env → 4, sign-in → 5). A violated constraint → **BLOCKER**. A constraint you can't verify → say so, as a WARNING, with what a maintainer should check.
