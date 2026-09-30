# Contributing

## Welcome to Women Devs Singapore!👋

Thank you for considering contributing to **Community Event Analytics Dashboard**! Your involvement helps us create an inclusive and impactful space for developers of all levels. This guide provides a clear pathway for you to start contributing, whether you’re new to open source or an experienced contributor.

By contributing, you agree to follow our [Code of Conduct](.github/CODE_OF_CONDUCT.md) and treat everyone with respect and kindness. If you witness or experience a violation of the Code of Conduct, please report it to [womendevssg@gmail.com](mailto:womendevssg@gmail.com).

## Table of Contents

- [What We’re Looking For](#what-were-looking-for)
- [Getting Started](#getting-started)
- [Working with Issues](#working-with-issues)
- [Setting Up Your Local Environment](#setting-up-your-local-environment)
- [Automatic checks on commit and push](#automatic-checks-on-commit-and-push)
- [Tests and coverage](#tests-and-coverage)
- [Creating a Pull Request](#creating-a-pull-request)
- [Automated checks on your pull request](#automated-checks-on-your-pull-request)
- [Awaiting Review](#awaiting-review)

---

## What We’re Looking For

We welcome contributions in many forms, including:

- **Documentation:** Writing guides, improving README files, and enhancing project clarity.
- **Bug Reports:** Identifying and reporting bugs or issues.
- **Code Contributions:** Fixing bugs, adding new features, or refactoring existing code.
- **Ideas and Feedback:** Sharing suggestions for improvement in our Telegram group.
- **Outreach:** Helping spread the word about our projects through blogs, social media, or talks.

Whether you're fixing a typo or tackling a major issue, all contributions are valuable!

⚠️ **Disclaimer:** While we welcome contributions from everyone around the world, preference will be given to:

- Women developers based in Singapore
- Members of the **[WDS Telegram community group](https://t.me/+hh3Fts4oDG41NzQ1)**

This ensures our Community Coding Month efforts stay aligned with our mission of building a strong local women-in-tech community.

### 💡 Tips for First-Time Contributors

- Look for issues labeled `good first issue`, `hacktoberfest`, or `no-coding-required`.
- Read this guide before submitting a PR.
- Don’t be afraid to ask questions — [maintainers](https://github.com/orgs/Women-Devs-SG/teams/wds-maintainers) are here to help.
- Start small: even fixing a typo or adding a link counts!
- Celebrate your contributions and share your PRs with the community.

We’re excited to have you here and can’t wait to see your contributions and ideas!

---

## Getting Started

Before you dive in:

1. **Read Our Code of Conduct:** This ensures a welcoming and collaborative space for everyone.
2. **Check Existing Issues:** Look for open issues in the repository to see where help is needed.
3. **Start Small:** We label beginner-friendly issues as `good first issue` to help you ease into the project.
4. **Understand the project:** Read the [README](README.md) for setup and the [architecture overview](docs/architecture.md) for how the code fits together. The [agent guide](AGENTS.md) has the detailed code map and data-safety conventions.
5. **Join our Telegram group:** To participate in Community Coding Month activities and connect with the community, please join the **[WDS Telegram group](https://t.me/+hh3Fts4oDG41NzQ1)**.

---

## Working with Issues

### Finding an Issue

- Visit the Issues tab in the repository.
- Look for issues tagged with `good first issue` or `help wanted`.
- Leave a comment on the issue you'd like to work on, and a maintainer will assign it to you.

### ❤️ Our Contribution Etiquette

To ensure that everyone has a fair and positive experience, we ask all contributors to follow these guidelines. We are a community focused on providing opportunities, and these rules help us achieve that mission.

**1. Ask Before You Work**

- Please comment on an issue and ask to be assigned **before** you start working.
- Do not work on issues that have already been assigned to someone else.

**2. Wait for Assignment**

- After commenting, please wait for a maintainer to formally assign the issue to you.
- A maintainer's assignment is the official green light to begin your work.

**3. Respect Our `women-devs-only` Issues**

- As part of our core mission to empower women in tech, some issues are labeled **`women-devs-only`**.
- **These issues are strictly reserved to give women developers an opportunity to learn and contribute in a safe, supportive space.** We kindly ask that our allies respect this policy and leave these specific issues for them.

**4. One Issue at a Time**

- To give everyone a chance, you can only be assigned **one issue at a time** across all WomenDevsSG repositories.
- Please also ensure that each Pull Request (PR) you submit solves **only one issue**. Do not bundle fixes for multiple issues into a single PR.

**We appreciate your cooperation in helping us build a fair and supportive open-source environment!**

### Creating an Issue

If you spot a bug or have an idea that isn’t already listed:

1. Open a new issue and use the appropriate template (e.g., Bug Report, Feature Request).
2. Be clear and concise in your description.
3. Wait for feedback from maintainers before proceeding.

---

## Setting Up Your Local Environment

Contributors work in their own fork. To work on an assigned issue:

1. Fork the repository to your GitHub account.
2. Clone your fork and add this repository as `upstream`, replacing `your-username` with your GitHub username:
   ```bash
   git clone https://github.com/your-username/community-event-analytics.git
   cd community-event-analytics
   git remote add upstream https://github.com/Women-Devs-SG/community-event-analytics.git
   ```
3. Use Node 22 (see `.nvmrc`) and install the locked dependencies. This also enables the [automatic checks on commit and push](#automatic-checks-on-commit-and-push):
   ```bash
   npm ci
   ```
4. Create a branch from the latest upstream `main`. Name it `<type>/<issue-number>-<short-description>`, where type is `feat`, `fix`, `docs`, `test`, or `chore`:
   ```bash
   git fetch upstream
   git switch -c fix/42-empty-filter-state upstream/main
   ```
5. Run `npm run dev` to start the synthetic demo, and use the local URL printed by Vite. No credentials are needed.
6. Make your changes. Add or update tests for changed behavior (see [Tests and coverage](#tests-and-coverage)).
7. Commit and push as usual; the [automatic checks](#automatic-checks-on-commit-and-push) run for you. There is no configured end-to-end test suite, so for UI changes, manually review both dashboard tabs and their filters.

Commit messages do not need a special format; write a short sentence describing what the commit does, such as `Show an empty state when no events match`. Your commits are combined into one when the PR is merged.

### Keeping your branch up to date

If `main` changes while you are working, bring your branch up to date before asking for review:

```bash
git fetch upstream
git merge upstream/main
git push
```

If you are comfortable with rebasing, `git rebase upstream/main` followed by `git push --force-with-lease` also works. Never force-push to someone else's branch.

AI-assisted contributions follow the same review process. Read [AGENTS.md](AGENTS.md), verify generated changes, and describe the checks you actually ran. Keep all fixtures synthetic and follow [SECURITY.md](SECURITY.md) when handling data or reporting vulnerabilities.

---

## Automatic checks on commit and push

You don't need to remember a list of commands: `npm ci` (or `npm install`) enables two Git hooks, and they run the checks for you. In an existing checkout, run `npm run hooks:install` once.

- **On every commit** (fast), the files you staged are auto-fixed: ESLint fixes what it can, Prettier formats them, and the fixed files are re-staged. Then a whitespace check and the generic scan run.
- **On every push** (thorough), `npm run verify` runs the same checks as CI: formatting, lint, the generic scan, typechecking, tests with coverage thresholds, and the production build.

A failed check stops the commit or push and prints what went wrong. Lint errors that cannot be fixed automatically, type errors, and failing tests need a manual fix. Both hooks use the synthetic data source and never fetch a real sheet.

You can also run the commands yourself at any time:

| Command          | What it does                                                    |
| ---------------- | --------------------------------------------------------------- |
| `npm run fix`    | Apply automatic lint fixes and formatting to the whole project. |
| `npm run verify` | Run everything CI runs, without changing files.                 |

Local hooks can be bypassed, and contributors editing in GitHub's web editor have no hooks, so CI remains the shared validation gate. For hook details, partially staged files, custom hook paths, and the lint and formatting configuration, see [development tooling](docs/development-tooling.md).

## Tests and coverage

Tests use [Vitest](https://vitest.dev/) and live next to the code they cover, organized by behavior (see the list in [AGENTS.md](AGENTS.md#verification-and-handoff)). Keep every fixture synthetic.

- `npm test` runs all tests once. `npm test -- src/privacy.test.ts` runs one file.
- `npm run test:coverage` also measures coverage. Open `coverage/index.html` in a browser to see which lines are untested.

Coverage has minimum thresholds, configured in `vite.config.js`. They sit just below the current level, so a change that removes tested code or adds untested code can fail the check. Add tests for the behavior you changed rather than lowering a threshold. `src/privacy.ts` must stay fully covered because it controls what the public dashboard may disclose. Maintainers raise the thresholds as coverage improves.

## Creating a Pull Request

Once you've completed your changes:

1. Push your branch to your fork:
   ```bash
   git push -u origin fix/42-empty-filter-state
   ```
2. Open a pull request (PR) from your branch to this repository's `main` branch. If your work is not finished, open it as a **draft** so maintainers can give early feedback.
3. Give it a plain, descriptive title, such as `Show an empty state when no events match`. Maintainers may adjust the title when merging.
4. Fill in the pull request template. Link the one issue it resolves with a line such as `Closes #42`; this closes the issue automatically when the PR is merged.
5. Tick only the checks you actually ran. Add screenshots for visible UI changes.

### PR Checklist

- The PR resolves exactly one assigned issue.
- Your branch is up to date with `main` and the automated checks pass.
- Changed behavior has tests, and fixtures and screenshots use synthetic data only: no real participant data, credentials, or private sheet IDs.
- For UI changes, you've reviewed both dashboard tabs and their filters.
- Your changes follow the coding guidelines in [AGENTS.md](AGENTS.md), and documentation, `.env.example`, and `AGENTS.md` are updated if behavior or settings changed.

## Automated checks on your pull request

Every pull request runs these checks. A red ❌ is normal while you are learning; open the check's **Details** to see what failed.

| Check          | What it verifies                                                                                                                         | How to fix it locally                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `Validate`     | Formatting, lint, the generic identifier scan, typechecking, tests with coverage thresholds, and the production build on synthetic data. | Run `npm run fix` for formatting and lint, or `npm run verify` to reproduce the failure, then push. |
| `Linked issue` | The PR description links an issue with `Closes #<number>`, `Fixes #<number>`, or `Resolves #<number>`.                                   | Edit the PR description; the check reruns automatically. Dependabot updates are skipped.            |

GitHub may ask a maintainer to approve workflow runs for first-time contributors. This is a security setting, not a problem with your PR.

---

## Awaiting Review

Once you’ve submitted your PR:

- A maintainer will review your changes. This may take some time — thank you for your patience! If there is no response after a week, feel free to leave a polite comment or ask in the Telegram group.
- If changes are requested, push new commits to the same branch; the PR updates automatically. Reply to or resolve each comment once it is addressed.
- Please do not close and reopen a new PR for the same change; keeping the conversation in one place helps reviewers.

Remember, reviews are meant to ensure the quality and consistency of the project, not to criticize you personally.

---

Thank you for making WomenDevsSG a better space for everyone! 💙
