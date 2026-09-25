# Findings file template (review-pr Step 7)

Save to `.claude/review-findings/YYYY-MM-DD-pr-<N>-<branch>.md`. The folder is local (`.claude/review-findings/` is gitignored); findings reach the author only through the PR comment, after the user approves posting it. Fill in every section — write "None" rather than leaving one out.

## Verdict rules

| Verdict                   | When                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| CHANGES REQUESTED         | One or more BLOCKERs                                                                         |
| APPROVED WITH SUGGESTIONS | No BLOCKERs, one or more WARNINGs                                                            |
| APPROVED                  | No BLOCKERs or WARNINGs, and every required AC has appropriate passing verification evidence |

Any PRIVACY or SECURITY BLOCKER means CHANGES REQUESTED, however small the rest of the PR is.

If required checks or integration testing are unavailable, use `REVIEW INCOMPLETE` unless confirmed blockers already warrant `CHANGES REQUESTED`. Being behind the base alone is informational.

## Template

```markdown
# Review: PR #<N> — <title>

- **Branch:** <branch> (<author>, fork: <owner>)
- **Date:** YYYY-MM-DD
- **Linked issue:** #<N> — author assigned: yes | no | no issue
- **Verdict:** CHANGES REQUESTED | APPROVED WITH SUGGESTIONS | APPROVED | REVIEW INCOMPLETE
- **Generator bias:** clean | overridden
- **Branch state:** current | behind (informational)
- **Submitted tip / base:** <head-sha> / <base-ref> @ <base-sha>
- **Integration:** already current | tested in temporary worktree | conflicts | not verified

## Checks

| Check                  | Result                                 |
| ---------------------- | -------------------------------------- |
| `npm run format:check` | pass / fail                            |
| `npm run lint`         | pass / fail                            |
| `npm run scan:generic` | pass / fail                            |
| `npm test`             | pass / fail (<failing tests>)          |
| `npm run build`        | pass / fail                            |
| Manual checks done     | <list, or "none">                      |
| For a maintainer       | <list, e.g. "live sign-in", or "none"> |

Record the check results above for the submitted tip. When integration needs a second worktree, repeat the table for that combined tree and identify both SHAs. Use `REVIEW INCOMPLETE` if required checks could not run; do not mark unverified checks as passed.

## Acceptance criteria

| AC  | Verification category | Evidence                                                            | Result                   |
| --- | --------------------- | ------------------------------------------------------------------- | ------------------------ |
| 1   | automated behavior    | `<test file> › <test name>` or relevant tool check                  | PASS / FAIL / UNVERIFIED |
| 2   | manual UI/live        | Interaction and observed result                                     | PASS / FAIL / UNVERIFIED |
| 3   | documentation         | File/section, accuracy and link/command review, format/scan results | PASS / FAIL / UNVERIFIED |

Verified: <passed>/<total>. Categories: <A> automated, <M> manual UI/live, <D> documentation. Unverified: <U>. Documentation evidence can satisfy a documentation criterion without unit tests; a category alone is not evidence of passing. Mark checks not required for this scope as N/A with the reason, never as passed.

## Blockers

### B1 — <title>

- **Category:** PRIVACY | SECURITY | QUALITY | COVERAGE | BUILD | CONVENTION | DOCS | SCOPE
- **Where:** `<path>:<line>`
- **What:** <what's wrong and why it matters here>
- **Suggested fix:** <specific change, with a link to AGENTS.md or a doc>

(or "None")

## Warnings

### W1 — <title>

(same fields, or "None")

## What's good

<1–3 specific things done well — contributors are often first-timers.>

## Patterns observed

- <known pattern name> (from reference/known-gap-patterns.md), or "None"
- New: <pattern name> (appended), or "None"

## Summary for the PR

<A short, friendly comment ready to post: thank the author; list blockers and warnings
with file:line and the fix; say what was verified and what a maintainer still needs to
check. No internal notes, no real data, no environment details.>
```
