# Verification matched to the change

Every acceptance criterion and additional scenario needs an appropriate verification method and recorded evidence. Classify each criterion by what changed, not by the issue label or file extension. Mixed changes retain all applicable checks.

| Category           | Required evidence                                                                                                                                                                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automated behavior | A meaningful passing test (file and test name), or the relevant tool/build check for a tooling criterion. Existing tests count when they exercise the changed behavior. Add regression coverage for uncovered application behavior, especially metrics, privacy, normalization, and access checks. |
| Manual UI/live     | The browser interaction and observed result on synthetic data, or an explicitly authorized live check. Record unperformed checks as unverified, never passed.                                                                                                                                      |
| Documentation      | Review accuracy against the relevant code, configuration, or policy; check changed links, paths, and commands; record formatting and generic-scan results. No automated test merely asserting prose exists is required.                                                                            |

For documentation, identify the file/section and the evidence used. For example: `README.md — Reset instructions match the controls in src/components.ts; local links resolve; format:check and scan:generic pass.` For skill instructions, review routing, linked references, commands, and consistency with AGENTS.md. Do not execute destructive, publishing, credential-dependent, or real-data commands merely to verify prose; inspect their syntax and prerequisites and state any execution limits. Runnable examples or instructions whose correctness depends on behavior may warrant a focused safe check using synthetic data.

Do not classify executable scripts, configuration changes, or changes to metric/privacy/access behavior as documentation merely because accompanying Markdown changed. Documentation describing existing behavior can use documentation evidence; implementation of a new behavior still requires behavior verification.

## Checks by scope

- Documentation-only: check links and commands, review technical accuracy, run `npm run format:check`, `npm run scan:generic`, and whitespace checks. Do not add Vitest tests for prose or require the application test/build suite solely for prose edits.
- Code, configuration, tooling, or mixed changes: follow AGENTS.md's relevant focused checks and full format/lint/scan/test/build suite, plus browser checks for UI changes. Verify accompanying documentation separately.
- Existing CI and pre-commit hooks remain unchanged and may run more checks. Never bypass them. If they run, report their actual results; if a check was not required or not run, say so rather than checking its PR checkbox.

## Criterion results

Record category, evidence, and result for each criterion: `PASS`, `FAIL`, or `UNVERIFIED`. A classification alone is not evidence of passing. Missing required behavior coverage or a demonstrated incorrect outcome is a blocker; unavailable verification is incomplete, with the missing check named. Retain the calling skill's explicit treatment of optional live checks, without counting those as verified.

Documentation can pass without a unit test when its documentation checks succeed. Mixed changes cannot use this exception to waive behavior tests. Report verified criterion counts separately from category counts so planned manual checks are not counted as passes.
