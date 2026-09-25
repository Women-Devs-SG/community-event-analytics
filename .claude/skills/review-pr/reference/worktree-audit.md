# Audit submitted commits and integration in isolation

Use this procedure for `review-pr` and `pre-push-audit`. It changes no contributor branch history and requires no force-push.

## Record the revisions and create the submitted-tip worktree

1. Record the original checkout's absolute path, current branch, HEAD SHA, and `git status --short`. Preserve all local changes. Resolve the submitted branch before entering any detached worktree; do not infer its name from the detached HEAD later.
2. Verify that the chosen base remote points to `Women-Devs-SG/community-event-analytics`. Fetch the target base branch and pin its full commit SHA as `BASE_SHA`. Pin the submitted commit as `AUDIT_HEAD`. For PRs, use their declared base; otherwise use `main`. A failed fetch means current integration is not verified; do not silently use stale refs.
3. Choose a unique temporary directory outside the original checkout, with separate unused child paths for the submitted-tip and integration worktrees. Record those absolute paths. Create the first worktree with `git worktree add --detach <tip-path> <AUDIT_HEAD>`.
4. Run source inspection, issue-scope comparisons, and submitted-tip checks in that worktree. In the calling skill and its references, substitute the pinned SHAs in diff/log commands: `git diff <BASE_SHA>...<AUDIT_HEAD>` describes the submitted change. Never derive the PR diff from the experimental merged tree. Keep the recorded contributor branch name for PR lookup and push instructions.

Temporary worktrees start without dependencies. Use Node 22 and the committed lockfile. Set `VITE_DATA_SOURCE=synthetic` for every check. During `npm ci`, set `CI=true` for that command so `scripts/install-hooks.mjs` skips changes to the shared Git hook configuration; restore the prior environment value afterward if the shell requires a process-level assignment. Do not copy `.env` files, credentials, or real data into these worktrees.

## Test integration after testing the submitted tip

Check `git merge-base --is-ancestor <BASE_SHA> <AUDIT_HEAD>`:

- Exit 0: the submitted tip already contains the base. Its checks also cover this integration; no second run is needed.
- Exit 1: the branch is behind the base. This alone is informational. Create a second worktree with `git worktree add --detach <integration-path> <BASE_SHA>`.
- Other failures: report the comparison as unverified; do not label them conflicts.

In the integration worktree only, run:

```bash
git merge --no-commit --no-ff <AUDIT_HEAD>
```

This stages the combined tree without creating a commit or updating a contributor branch. It checks integration with the recorded base; it does not promise the final merge strategy or account for later changes to either branch.

- Clean merge: install the combined tree's locked dependencies as needed, then run the calling skill's scope-appropriate checks under [verification matched to the change](verification.md): documentation-only accuracy/link/command, formatting, generic, and whitespace checks, or the full code-change suite on synthetic data. Record these as integration results separately from submitted-tip results. Do not commit the merge.
- Conflicts: record `git diff --name-only --diff-filter=U`, mark integration blocked, and abort this temporary merge. Do not resolve contributor conflicts or require rebase as the only remedy; report that the contributor must resolve integration with the base.
- Other errors: preserve the error and report integration as unverified. A failed command is not automatically a merge conflict.

If a check fails, distinguish a submitted-tip failure, an integration-only failure, and a failure reproduced on the pinned base in another isolated worktree. Use the calling skill's rules for reporting pre-existing failures.

If isolation, dependencies, or other prerequisites are unavailable, continue available read-only inspection and report missing checks. Never substitute a merge or rebase in the original checkout. Use an incomplete verdict when required checks remain unverified.

## Cleanup and reporting

Clean up on success, blockers, and early exits. Save findings in the original checkout's intended review-notes location first. Stop only servers started for this audit. Abort any merge started by this audit in its integration worktree, then leave the temporary directories before removing them with `git worktree remove <path>`.

Before removal, verify each absolute path is one of this run's recorded temporary worktrees and lies inside the chosen temporary directory. If removal refuses because generated or untracked files remain, inspect them first. Forced removal is permitted only for this run's disposable worktree after confirming it contains no user work or sole copy of findings. Never use broad recursive deletion, remove pre-existing worktrees, or change the original checkout to make cleanup succeed. Report any worktree left behind and why.

Record both SHAs, submitted-tip results, integration results or why unverified, and cleanup status. Check the original branch and HEAD still match the recorded values and review its final status without reverting unrelated changes.
