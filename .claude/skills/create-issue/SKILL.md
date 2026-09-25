---
name: create-issue
description: Drafts and files a new GitHub issue for the community-event-analytics repo (Women-Devs-SG), following the repo's issue forms (Bug report / Feature request / Documentation improvement), always including a data-and-privacy section, and adding the Acceptance criteria and scope sections that implement-issue later consumes. Uses only labels that already exist, previews before filing, and wires up blocked-by/blocks relationships. Use when the user wants to file, open, create, or write up a GitHub issue, bug report, feature request, docs improvement, or good first issue for this project — including turning a review finding, chat message, or spoken description into a properly formatted issue.
argument-hint: [issue description, or path to a spec/doc to base it on]
allowed-tools: Read, Grep, Glob, Bash, TodoWrite, AskUserQuestion
---

You are drafting and filing a new GitHub issue for `Women-Devs-SG/community-event-analytics` — a static React + TypeScript + Vite + ECharts dashboard for community event organizers, with a privacy-safe build-time summary and an optional Google sign-in mode. Read [AGENTS.md](../../../AGENTS.md) first for the code map, data/security boundaries, and verification commands. The issue must be immediately usable by the `implement-issue` skill and by a first-time open-source contributor, so section headings and file pointers matter as much as the content. Follow every step in order.

## Arguments

`$ARGUMENTS` contains either:

- Raw issue content (title, description, acceptance criteria — as much or as little as the user has)
- A file path to a spec, review finding, or notes to base the issue on (read it with Read)
- A one-line description of a problem or feature

If `$ARGUMENTS` is empty, ask the user what the issue is about before proceeding.

---

## Step 0 — Route security and privacy reports

Read [SECURITY.md](../../../SECURITY.md) before drafting. If the request reports a security vulnerability or possible participant-data exposure, stop the public-issue workflow. Do not draft or file a public issue, post a public comment, or add public project/dependency links for the report; removing sensitive values does not make the report suitable for public filing.

Direct the user to the repository's **Security → Report a vulnerability** flow. If private vulnerability reporting is unavailable, follow SECURITY.md's fallback: contact the maintainers through the private channel listed in the repository profile. Do not invent a contact address or fall back to a public issue. Explain that maintainers must enable private vulnerability reporting if the option is missing.

A private report should include a concise description, affected version or commit, reproduction steps, and potential impact, without real participant records. This skill does not submit the private report or contact maintainers automatically.

Ordinary security-related feature requests or documentation improvements that do not report a vulnerability or possible exposure can continue. If the distinction is unclear, clarify it with the user before preparing a public draft. Reapply this check if later investigation reveals a vulnerability or possible exposure.

---

## Step 1 — Gather repo conventions before drafting

Pull live conventions — do not rely on memorized examples, they drift.

```bash
# Title precedent and recent labels
gh issue list --repo Women-Devs-SG/community-event-analytics --state all --limit 15 --json number,title,labels

# Labels that exist (never invent one silently)
gh label list --repo Women-Devs-SG/community-event-analytics

# Project boards (needs the read:project scope; failure is fine — see Step 7)
gh project list --owner Women-Devs-SG --format json --jq '.projects[] | {number,title}'
```

Then read the issue form that matches the issue type — its field order is the section skeleton:

| Form                                                   | Title prefix  | Default label   |
| ------------------------------------------------------ | ------------- | --------------- |
| `.github/ISSUE_TEMPLATE/bug-report.yml`                | `[Bug]: `     | `bug`           |
| `.github/ISSUE_TEMPLATE/feature-request.yml`           | `[Feature]: ` | `enhancement`   |
| `.github/ISSUE_TEMPLATE/documentation-improvement.yml` | `[Docs]: `    | `documentation` |

Blank issues are disabled in `.github/ISSUE_TEMPLATE/config.yml`, which is why filing goes through `gh issue create` with a body that mirrors the form fields.

As of writing, the live labels are GitHub's defaults (`bug`, `documentation`, `enhancement`, `good first issue`, `help wanted`, `question`, …) plus Dependabot's (`dependencies`, `github_actions`, `javascript`). The issue forms and CONTRIBUTING.md mention `women-devs-only`, but that label may not exist yet — check the live list.

---

## Step 2 — Pick the issue type and derive content

| Type    | When                                                                | Form                      |
| ------- | ------------------------------------------------------------------- | ------------------------- |
| Bug     | Something is broken, wrong, or misleading in the dashboard or build | Bug report                |
| Feature | A new capability, or a change in behavior                           | Feature request           |
| Docs    | README, `docs/`, CONTRIBUTING, AGENTS.md, SECURITY, templates       | Documentation improvement |

Tooling/CI/refactor/test-only work that fits no form: use the Feature form's headings and the `[Feature]: ` prefix, and say in the first line that it is maintenance work.

If the user supplied a field explicitly, use it verbatim. If a field is missing, derive it from the repo (grep to confirm every path you cite exists).

Use the form's field labels as `###` headings — that is how GitHub renders issue-form submissions, so filed issues look the same as ones created through the UI.

### Bug report

| Heading                                  | Derive from                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `### What happened?`                     | One or two sentences, including any exact error text                                                                     |
| `### What did you expect to happen?`     | Expected behavior                                                                                                        |
| `### Reproduction steps`                 | Numbered steps using synthetic data (`npm run dev`), naming the tab, filters, and chart interaction; mark inferred steps |
| `### Screenshots and additional context` | Data mode (`synthetic` / `google-sheets` / `google-signin`), browser, screenshots — never real participant data          |

### Feature request

| Heading                               | Derive from                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `### Community need or problem`       | Who is affected and why it matters; include "how to see the problem today" steps if useful |
| `### Proposed solution`               | The user-visible outcome, then where the change goes (file table) and a sketch if helpful  |
| `### Data and privacy considerations` | See Step 2.5 — required                                                                    |
| `### Additional context`              | Mockups, related docs, "Getting started" notes for good first issues                       |

### Documentation improvement

| Heading                      | Derive from                                                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `### Documentation area`     | One of the form's options (e.g. "Project overview or local setup", "Data contract, metrics, or privacy behavior") |
| `### Documentation location` | File path(s) and heading                                                                                          |
| `### Primary audience`       | One of the form's options                                                                                         |
| `### Documentation issue`    | What is missing, wrong, or confusing                                                                              |
| `### Proposed improvement`   | The concrete change                                                                                               |
| `### Additional context`     | Links, screenshots                                                                                                |

---

## Step 2.5 — Shared sections (always add, regardless of type)

`implement-issue`, `pre-push-audit`, and `review-pr` key off these exact headings — **always emit every one**, even when the answer is "None stated", so an empty section reads as intentional.

```markdown
### Data and privacy considerations

<Which data mode(s) are affected. Whether the change could publish new fields in
`public/dashboard-summary.json`, change a privacy threshold, affect sign-in/access
checks, or expose comment text. "None — display-only change" is a valid answer.>

## Acceptance criteria

### Happy path

**Given** <precondition — usually "the synthetic demo data (`npm run dev`)">
**When** <action — e.g. the viewer selects Year 2025 and clicks a topic bubble>
**Then** <observable outcome — exact text, a value in the summary, a test result>

### Error path / edge case

**Given** <precondition — e.g. `limitations` is empty, an event is below the privacy threshold, sign-in is refused>
**When** <action>
**Then** <observable outcome>

## Out of scope

- <item, or "None stated">

## Technical context

<Files and functions affected — grep to confirm paths. Name the data path touched:
public summary (build time) vs google-signin (browser). Name the test file that should
cover it (see the table in AGENTS.md → Verification and handoff).>

## Additional test scenarios

- <edge case beyond the acceptance criteria, or "None beyond the acceptance criteria above">

## Hard constraints

- <non-negotiable requirement, or "None stated beyond AGENTS.md defaults">

## Dependency issues

- None
```

Each acceptance criterion must be falsifiable. "The chart works" is not acceptable; "with the synthetic data, the Demand × Satisfaction chart plots 17 events and the note reads '7 events not plotted…'" is.

Project-specific constraints worth stating whenever they apply (all from AGENTS.md):

- Must not publish row-level data, participant IDs, or response IDs in the public summary; `assertNoRowIdentifiers` stays in the public path.
- Must apply disclosure rules before serialization, not only in chart rendering; must not lower thresholds to make a test pass.
- Strings inserted into HTML templates or chart tooltips must go through `esc` from `src/components.ts`.
- Missing values stay null/unknown, never zero.
- New environment settings must update config/types, `.env.example`, docs, and `.github/workflows/deploy.yml` together; no `VITE_` credentials.
- New filters must update reachable selections in `src/summary/scope.ts` as well as the UI.
- Summary format changes must keep `SUMMARY_VERSION`, generation, and browser loading compatible.

### Good first issues

When the user asks for a good first issue, also include under `### Additional context`:

- **Getting started:** ask to be assigned and wait for a maintainer (per CONTRIBUTING.md); fork; `npm ci`; `npm run dev` (synthetic data, no accounts needed).
- **Where to make the change:** a file table with line numbers confirmed by reading the files.
- **Done when:** a checklist that ends with `npm run check:commit` passing and a screenshot for UI changes.
- **Skills involved:** e.g. "basic React (JSX) and CSS; no charting or data knowledge needed".

Keep good first issues to one or two files and one behavior. If the work needs a maintainer decision, a privacy judgement, or a real Google account, it is not a good first issue — say so and suggest `help wanted` instead.

---

## Step 3 — Title and labels

**Title:** the form prefix plus a short, specific summary in sentence case, matching recent precedent — e.g. `[Feature]: Show "About this data" notes on the dashboard`.

**Labels:** choose only from the live list fetched in Step 1:

| Signal                                                              | Label                                                                   |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Bug report                                                          | `bug`                                                                   |
| New capability or behavior change                                   | `enhancement`                                                           |
| Docs-only change                                                    | `documentation`                                                         |
| Small, well-scoped, one or two files, no maintainer decision needed | `good first issue`                                                      |
| Wants outside help but is not beginner-sized                        | `help wanted`                                                           |
| Reserved for women contributors per the community's mission         | `women-devs-only` — only if the user says so explicitly; never infer it |

If a needed label doesn't exist (for example `women-devs-only` or `no-coding-required`), leave it off and ask the user whether to create it — never run `gh label create` without their confirmation.

---

## Step 4 — Detect dependency relationships

Scan the user's input for:

- Backward (this issue is blocked): `blocked by #N`, `depends on #N`, `requires #N`, `after #N`, `needs #N`
- Forward (this issue blocks another): `blocks #N`, `unblocks #N`, `must land before #N`

Collect them into BLOCKED_BY and BLOCKS. Sanity-check each:

```bash
gh issue view <N> --repo Women-Devs-SG/community-event-analytics --json number,title,state
```

If a referenced issue doesn't exist or is closed, flag it in the preview rather than silently dropping it. Record the relationships in the body's `## Dependency issues` section as well.

---

## Step 5 — Preview and confirm

Filing an issue is public — the repository is open source. Before previewing, check the draft contains no real participant data, community spreadsheet IDs, Apps Script URLs, OAuth client IDs, credentials, private links, or personal email addresses. Then show:

```
Title:      <title>
Labels:     <label1>, <label2> (or "none")
Blocked by: #N (or "none")
Blocks:     #N (or "none")

--- body ---
<full rendered body>
```

Ask the user with AskUserQuestion: "Create issue as drafted" / "Let me edit something first" / "Cancel". Do not run `gh issue create` until confirmed.

---

## Step 6 — Create the issue

Write the body to a scratch file — shell quoting is unreliable for Markdown with backticks. Use the session's scratchpad directory if one is provided; otherwise a temp file.

```bash
BODY_FILE="$(mktemp)"
cat > "$BODY_FILE" <<'ISSUE_BODY_EOF'
<full body from Steps 2 and 2.5>
ISSUE_BODY_EOF

gh issue create --repo Women-Devs-SG/community-event-analytics \
  --title "<title>" \
  --body-file "$BODY_FILE" \
  --label "<label1>" --label "<label2>"

rm -f "$BODY_FILE"
```

`gh issue create` prints the new issue's URL — take the trailing number as NEW_NUMBER.

---

## Step 7 — Add to a project board, if one exists

Only if Step 1's `gh project list` returned at least one project. If it returned none, or failed because the token lacks `read:project`, print "No accessible project board — skipping (run `gh auth refresh -s read:project,project` to enable)." and continue.

If projects exist, ask the user which one and which status to use (AskUserQuestion) — do not guess:

```bash
gh project item-add <PROJECT_NUMBER> --owner Women-Devs-SG --url "<issue-url>"
```

If this fails, report it and continue — the issue is already filed.

---

## Step 8 — Wire up dependency relationships

Only if BLOCKED_BY or BLOCKS is non-empty.

```bash
NEW_ID=$(gh issue view $NEW_NUMBER --repo Women-Devs-SG/community-event-analytics --json id --jq .id)
```

For each `N` in BLOCKED_BY (the new issue is blocked by `N`):

```bash
BLOCKER_ID=$(gh issue view $N --repo Women-Devs-SG/community-event-analytics --json id --jq .id)
gh api graphql -f query='
  mutation($issue:ID!,$blocker:ID!){
    addBlockedBy(input:{issueId:$issue,blockingIssueId:$blocker}){clientMutationId}
  }' -f issue="$NEW_ID" -f blocker="$BLOCKER_ID"
```

For each `N` in BLOCKS (`N` depends on the new issue — set the relationship on `N`):

```bash
DEPENDENT_ID=$(gh issue view $N --repo Women-Devs-SG/community-event-analytics --json id --jq .id)
gh api graphql -f query='
  mutation($issue:ID!,$blocker:ID!){
    addBlockedBy(input:{issueId:$issue,blockingIssueId:$blocker}){clientMutationId}
  }' -f issue="$DEPENDENT_ID" -f blocker="$NEW_ID"
```

If a mutation fails, report which links failed so the user can add them in the GitHub UI. Do not fail the run.

---

## Step 9 — Report

In under 10 lines:

1. **Issue:** number + URL
2. **Title / labels applied** (and any label skipped because it doesn't exist)
3. **Project:** added / skipped and why
4. **Dependency links:** wired / failed and why

---

## Guardrails

- **Never** publish a security vulnerability or possible participant-data exposure report as an issue or comment; follow SECURITY.md and Step 0's private-reporting route.
- **Never** run `gh issue create` before the user confirms the preview.
- **Never** put real participant data, community sheet IDs, Apps Script URLs, OAuth client IDs, credentials, or personal contact details in an issue — the repo is public.
- **Never** invent a label; ask before creating one.
- **Never** apply `women-devs-only` unless the user explicitly asked for it.
- **Never** assign the issue at creation time — CONTRIBUTING.md has contributors ask to be assigned, and a maintainer assigns when work starts.
- **Never** silently drop a referenced dependency issue that doesn't exist.
- **Never** close or edit any other issue as a side effect.
- If `gh` reports an auth error, stop and tell the user to run `gh auth login`.
