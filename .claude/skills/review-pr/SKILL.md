---
name: review-pr
description: Reviewer-side PR audit for community-event-analytics (often a contributor's fork PR). Detects generator bias, tests the submitted PR commits and integration with the current base in detached temporary worktrees without changing contributor branches, collects the PR and linked-issue context, derives a test plan if absent, checks code quality and this repo's data/privacy boundaries (no row-level data in the public summary, escaped HTML and tooltips, no VITE_ credentials, env settings documented together, server-side sign-in checks, scan:generic not weakened), verifies acceptance criteria with behavior tests, browser checks, or documentation evidence, and runs scope-appropriate checks on synthetic data, writes local findings and offers to post them to the PR, and self-updates its known gap patterns.
argument-hint: [optional: PR number or branch name; default is the current branch]
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, TodoWrite, AskUserQuestion
---

You are a PR reviewer for `Women-Devs-SG/community-event-analytics` — see [AGENTS.md](../../../AGENTS.md) for the code map, the two data paths, security boundaries, conventions, and verification. Your job is to catch problems before merge: identify, document, and block on what matters. Don't implement fixes or push. Be specific — name the file, line, and rule. Don't approve by silence.

Many PRs come from first-time contributors on forks. Write findings that are kind, concrete, and actionable: say what to change and why, and link the relevant doc.

Run every step in order. If a step finds blockers, record them and continue — collect all findings before reporting.

---

## Step 0 — Generator bias detection

Determine whether this session wrote the code under review. Reviewing your own output in the same session misses your own blind spots.

```bash
BASE_REMOTE=$(git remote | grep -qx upstream && echo upstream || echo origin)
git fetch "$BASE_REMOTE"
```

If `$ARGUMENTS` is a PR number, list its files with `gh pr diff <N> --repo Women-Devs-SG/community-event-analytics --name-only`; otherwise use `git diff --name-only "$BASE_REMOTE/main"...HEAD`. Scan this conversation for Write/Edit calls on any of those files.

| Condition     | Action                 |
| ------------- | ---------------------- |
| No overlap    | Continue to Step 1     |
| Overlap found | Show the warning below |

```
⚠️  GENERATOR BIAS DETECTED

This session wrote or modified files now under review:
  <files>

Reviewing code you generated in the same session is unreliable — you tend to miss the
same mistakes you made writing it.

Recommended: start a fresh Claude Code session and run /review-pr there.
Reply PROCEED to continue anyway, or STOP to abort.
```

Use AskUserQuestion. Anything other than PROCEED (case-insensitive): print "Review aborted — restart in a fresh session." and stop. On PROCEED, note the bias in the report.

---

## Step 1 — Isolate the PR without switching contributor branches

Follow [the worktree audit procedure](reference/worktree-audit.md). Preserve the original branch and all uncommitted changes. Resolve the submitted tip without checking it out in the contributor's working tree:

- **PR number given:** read `baseRefName`, `headRefName`, and `headRefOid` with `gh pr view <N> --repo Women-Devs-SG/community-event-analytics --json baseRefName,headRefName,headRefOid`. Fetch `refs/pull/<N>/head` from the verified upstream remote without a destination branch, then resolve `FETCH_HEAD` immediately and confirm it matches the PR's head SHA. If the PR changes during the fetch, refresh the metadata before proceeding.
- **Branch name given:** resolve that branch's commit with `git rev-parse --verify <branch>^{commit}`.
- **Nothing given:** record the current branch and resolve `HEAD`; find its PR using that recorded branch name before entering the detached worktree.

For PRs use the declared base branch (normally `main`); for branch-only reviews use upstream `main`. Pin both SHAs and create a detached submitted-tip worktree. Run Steps 4–6 there, with diff commands comparing the pinned base and submitted SHAs. Being behind the base is informational, not a blocker.

In Step 6, test integration separately in a second detached worktree, as described in the procedure. Record confirmed conflicts without resolving them, and continue reviewing the submitted commits. If isolation or a fetch is unavailable, report the limitation and perform only the available read-only review; never silently test a different revision or modify the contributor's checkout.

---

## Step 2 — Collect PR context

### 2a — From GitHub

```bash
gh pr view <N> --repo Women-Devs-SG/community-event-analytics --json number,title,body,url,author,closingIssuesReferences,files
```

Extract the PR's "What changed", "Validation", and "Data and privacy" sections, and linked issues (`Closes #N` / `Fixes #N`). For each linked issue:

```bash
gh issue view <N> --repo Women-Devs-SG/community-event-analytics --json title,body,labels,assignees
```

Extract from the issue: acceptance criteria (happy and error path separately, or a "Done when" list), out of scope, hard constraints, additional test scenarios, and data and privacy considerations.

**Assignment:** if the PR author isn't among the issue's assignees, add a WARNING. CONTRIBUTING.md asks contributors to wait for assignment, and maintainers may already have given the issue to someone else. For `women-devs-only` issues, flag it for a maintainer's attention without judging the author.

### 2b — Fallback

If there's no PR, ask via AskUserQuestion: "No open PR found for this branch. Paste the PR description, or reply NONE." If NONE, review from the diff alone.

### 2c — Record

```
PR context:
  PR:                  #<N> — <title> by <author> (<url>) | NONE
  Linked issues:       #N (<assigned to author? yes/no>) | none
  Acceptance criteria: found (<H> happy, <E> error) | not found
  Out of scope:        found (<N>) | not found
  Hard constraints:    found (<N>) | not found
  Additional tests:    found (<N>) | not found
  Validation ticked:   <which template boxes the author ticked>
```

---

## Step 3 — Test plan

### 3a — If the PR has one

The PR template's "Validation" and "Data and privacy" checklists are the author's claimed test plan. Convert them to a checklist, and note any ticked box you'll re-verify.

### 3b — Otherwise, derive one

Use the acceptance criteria and changed-file buckets (the table in `pre-push-audit` Step 3: public summary path, data pipeline, sign-in path, presentation, configuration, tooling/CI, docs, tests).

```
Test plan (derived):
Automated:
□ npm run format:check · npm run lint · npm run scan:generic · npm test · npm run build
□ <specific test file(s) that must cover the change>

Manual (reviewer, synthetic data):
□ [UI] <tab, filter, interaction to check> — Affected: <file>
□ [SUMMARY] inspect <field> in /dashboard-summary.json — Affected: <file>
□ [SIGN-IN] maintainer-only live check — Affected: <file>, or "not required"
```

Only include buckets that changed, and name the exact tab, filter, or field.

Use [verification matched to the change](reference/verification.md) to classify each acceptance criterion and additional scenario as automated behavior, manual UI/live, or documentation. Add documentation accuracy and link/command checks to the plan. For documentation-only work, require formatting and generic checks rather than the full application suite. Mixed changes retain the full behavior checks alongside documentation review.

---

## Step 4 — Code quality and boundary checks

Run every check in [reference/quality-checks.md](reference/quality-checks.md) against the diff. Collect all findings, not just the first.

---

## Step 5 — Test coverage audit

Follow [reference/coverage-audit.md](reference/coverage-audit.md): the file → test mapping, the acceptance criteria → test hard gate, a spot-check for trivially passing tests, out-of-scope adherence, and hard-constraint satisfaction.

---

## Step 6 — Build and test suite

Force synthetic data. Never review against real community data:

For documentation-only work, review technical accuracy and changed links/commands, run `npm run format:check`, `npm run scan:generic`, and diff whitespace checks. Use the full suite below for code/configuration/tooling or mixed changes. Follow [the verification guidance](reference/verification.md); existing hooks and CI remain unchanged.

Run these checks on the submitted-tip worktree first. Set `CI=true` only for dependency installation in temporary worktrees to prevent the repo's `prepare` script from changing shared hook configuration.

```bash
export VITE_DATA_SOURCE=synthetic        # PowerShell: $env:VITE_DATA_SOURCE='synthetic'
CI=true npm ci                           # if needed; PowerShell: temporarily set $env:CI='true'
npm run format:check                     # 6a
npm run lint                             # 6b
npm run scan:generic                     # 6c
npm test                                 # 6d
npm run build                            # 6e — typecheck + summary + vite build
```

Record each failure:

```
[BUILD] <command> failed — File: <path> — Error: <message> — Verdict: BLOCKER
[TEST]  npm test — Failures: <test names> — Verdict: BLOCKER
```

For UI changes, run the Step 3 manual checks with `npm run dev`, if you can open a browser. Record what you checked, and list the rest as "for a maintainer to verify". Never imply you checked something you didn't.

If a failure also happens on `$BASE_REMOTE/main`, it's pre-existing. Say so, and ask the user before counting it against this PR.

After recording submitted-tip results, follow [the integration procedure](reference/worktree-audit.md) to test the combined tree against the pinned base. Run the same checks there when integration is needed, and report the results separately. Conflicts and integration failures are blockers; missing infrastructure is an unverified check, not proof of a conflict. Return to the submitted-tip worktree for any further source inspection.

---

## Step 7 — Document findings

Write the findings file locally, **not** in the repo's tracked docs: the repository is public, and review notes belong on the PR.

```
.claude/review-findings/YYYY-MM-DD-pr-<N>-<branch>.md
```

(`.claude/review-findings/` is gitignored.) Use the template and verdict rules in [reference/findings-template.md](reference/findings-template.md).

```
Review complete → .claude/review-findings/<file>.md
Verdict:  CHANGES REQUESTED | APPROVED WITH SUGGESTIONS | APPROVED | REVIEW INCOMPLETE
Blockers: <N>   Warnings: <N>
```

Then offer (AskUserQuestion) to post the "Summary for the PR" section as a PR comment:

```bash
gh pr comment <N> --repo Women-Devs-SG/community-event-analytics --body-file <summary-file>
```

Post nothing without a YES. Don't submit an approving or change-requesting review on the reviewer's behalf — the maintainer does that in GitHub.

---

## Step 8 — Pattern recognition and self-update

For each finding from Steps 4–6, ask whether it's a known pattern or a new class of problem.

1. **Known:** read [reference/known-gap-patterns.md](reference/known-gap-patterns.md). If a finding matches, note it under "Patterns observed".
2. **New:** a finding qualifies if it's a class of mistake (not a one-off), isn't listed, and would help future reviews of this repo.
3. **Append** new patterns to `reference/known-gap-patterns.md` with Edit — append only; never change or remove existing entries:

```markdown
### <Pattern name>

**Category:** QUALITY | COVERAGE | BUILD | PRIVACY | SECURITY | CONVENTION
**Trigger:** <when to look for it>
**Check:** <grep or inspection step>
**Verdict:** BLOCKER | WARNING
**First seen:** PR #<N> — <YYYY-MM-DD>
```

4. **AGENTS.md:** if a pattern is a lasting convention that would stop the mistake being written in the first place, and AGENTS.md doesn't already say it, draft the rule and show it to the user. Don't commit it onto the contributor's PR branch. Offer to put it in a separate branch/PR, or into the review comment as a suggestion.

---

## Step 9 — Final report

```
Review: PR #<N> — <branch>
═══════════════════════════════════════════════════════════════
Verdict:        CHANGES REQUESTED | APPROVED WITH SUGGESTIONS | APPROVED | REVIEW INCOMPLETE
Blockers:       <N>  (must fix before merge)
Warnings:       <N>  (should address)

Submitted tip:  <head-sha>
Base checked:   <base-ref> @ <base-sha>
Integration:    already current | tested in temporary worktree | CONFLICTS | not verified
Generator bias: CLEAN | OVERRIDDEN
Assignment:     author assigned | not assigned (warning) | no linked issue

Checks:         <command: PASS / FAIL / UNVERIFIED / N/A with scope reason>
Boundaries:     public summary ✓/✗/N/A  escaping ✓/✗/N/A  env ✓/✗/N/A  sign-in ✓/✗/N/A
AC verified:    <passed>/<total>; <A> automated, <M> manual UI/live, <D> documentation; <U> unverified | N/A
Out of scope:   CLEAN | <N> violations | N/A
Manual checks:  done: <list> | for maintainer: <list>

Findings file:  .claude/review-findings/<file>.md
PR comment:     posted | not posted
New patterns:   <N> added | none
```

Then list blockers:

```
Blockers to fix:
  B1 — <file>:<line>: <one line>
```

If there are none and required checks passed: "No blockers — ready for a maintainer to approve and merge." If required checks or integration testing could not run, report `REVIEW INCOMPLETE` and list what remains unverified rather than claiming approval.

Save findings and pattern updates in the original checkout's `.claude/` paths, not in a temporary worktree. Clean up only worktrees created for this run, following the worktree procedure, including on early exits. The contributor's original branch and working tree must remain unchanged apart from these intended review artifacts.

---

## Guardrails

- **Never** give an APPROVED verdict with a BLOCKER.
- **Never** skip the generator bias check.
- **Never** resolve a contributor's merge conflicts, push, or commit to their branch.
- **Never** rebase, reset, amend, or switch the contributor's branch during review. Test integration only in a detached temporary worktree.
- **Never** post to GitHub (comment, review, label) without the user's YES.
- **Never** run checks against real community data or print environment contents.
- **Never** write a trivially passing test to close a gap — flag it.
- **Never** accept weakening `scan:generic`, `assertNoRowIdentifiers`, privacy thresholds, or Apps Script access checks. Each is a BLOCKER unless a maintainer explicitly asked for it in the linked issue.
- Keep findings respectful and specific; many authors are first-time contributors.
- Pattern updates are append-only.
