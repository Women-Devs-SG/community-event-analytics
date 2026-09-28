# Contributing

## Welcome to Women Devs Singapore!👋

Thank you for considering contributing to **Community Event Analytics Dashboard**! Your involvement helps us create an inclusive and impactful space for developers of all levels. This guide provides a clear pathway for you to start contributing, whether you’re new to open source or an experienced contributor.

By contributing, you agree to follow our [Code of Conduct](.github/CODE_OF_CONDUCT.md) and treat everyone with respect and kindness. If you witness or experience a violation of the Code of Conduct, please report it to [womendevssg@gmail.com](mailto:womendevssg@gmail.com).

## Table of Contents

- [What We’re Looking For](#what-were-looking-for)
- [Getting Started](#getting-started)
- [Working with Issues](#working-with-issues)
- [Setting Up Your Local Environment](#setting-up-your-local-environment)
- [Pre-commit checks](#pre-commit-checks)
- [Creating a Pull Request](#creating-a-pull-request)
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
4. **Understand the project:** Read the [README](README.md) and [agent guide](AGENTS.md) for setup, architecture, and data-safety conventions.
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

To work on an issue:

1. Fork the repository to your GitHub account.
2. Clone your fork and move into it:
   ```bash
   git clone https://github.com/your-username/community-event-analytics.git
   cd community-event-analytics
   ```
3. Add the original repository as `upstream` so you can keep your fork in sync:
   ```bash
   git remote add upstream https://github.com/Women-Devs-SG/community-event-analytics.git
   ```
4. Install dependencies and start the synthetic demo, using Node 22 (see `.nvmrc`):
   ```bash
   npm ci
   npm run dev
   ```
   Open the local URL printed by Vite. No credentials are needed. `npm ci` also installs the [pre-commit hook](#pre-commit-checks).
5. Create a branch from the latest `upstream/main`:
   ```bash
   git fetch upstream
   git checkout -b your-branch-name upstream/main
   ```
6. Make your changes.
7. Before opening a PR, run `npm run format:check`, `npm run lint`, `npm run scan:generic`, `npm test`, and `npm run build` (which includes typechecking). There is no configured end-to-end test suite. For UI changes, manually review both dashboard tabs and their filters.

AI-assisted contributions follow the same review process. Read [AGENTS.md](AGENTS.md), verify generated changes, and describe the checks you actually ran. Keep all fixtures synthetic and follow [SECURITY.md](SECURITY.md) when handling data or reporting vulnerabilities.

---

## Pre-commit checks

`npm ci` installs a pre-commit hook that runs `npm run check:commit` (whitespace, formatting, lint, generic scan, typecheck, and tests, all on synthetic data). If a check fails, run `npm run lint:fix` and `npm run format`, review the diff, and commit again.

For hook setup in existing checkouts, custom hook paths, and the lint and formatting configuration, see [development tooling](docs/development-tooling.md).

## Creating a Pull Request

Once you've completed your changes:

1. Push your branch to your forked repository:
   ```bash
   git push origin your-branch-name
   ```
2. Open a pull request (PR) from your branch to the repository's `main` branch.
3. Fill in the [pull request template](.github/PULL_REQUEST_TEMPLATE.md), which GitHub adds to the description automatically. Link the issue it resolves (for example, `Closes #123`).

### PR Checklist:

- The PR solves only the one issue you were assigned.
- The checks from step 7 of [Setting Up Your Local Environment](#setting-up-your-local-environment) pass, and you've ticked the ones you ran in the template.
- Any test data, fixtures, and screenshots are synthetic: no real participant data, credentials, or private sheet links.
- For UI changes, you've reviewed both dashboard tabs and their filters, and added a screenshot.
- Your changes follow the repository’s coding guidelines in [AGENTS.md](AGENTS.md), and your PR has a descriptive title.

---

## Awaiting Review

Once you’ve submitted your PR:

- A maintainer will review your changes. This may take some time — thank you for your patience!
- If changes are requested, you can update your PR by pushing to the same branch.

Remember, reviews are meant to ensure the quality and consistency of the project, not to criticize you personally.

---

Thank you for making WomenDevsSG a better space for everyone! 💙
