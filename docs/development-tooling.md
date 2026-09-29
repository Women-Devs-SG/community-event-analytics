# Development tooling

This page describes the commit and push hooks, linting, and formatting setup. For the contribution workflow, start with the [contributor guide](../CONTRIBUTING.md).

## Commit and push hooks

The shared hooks are managed by [Husky](https://typicode.github.io/husky/) and live in `.husky/pre-commit` and `.husky/pre-push`. `npm ci` (or `npm install`) enables them through npm's `prepare` script. In an existing checkout, run `npm run hooks:install` once. Git and Node/npm must be available on your PATH, including when committing or pushing from an editor.

Before each commit, the pre-commit hook runs `npm run check:commit`:

1. Auto-fix the staged files with [lint-staged](https://github.com/lint-staged/lint-staged): ESLint applies available fixes, then Prettier formats them, and the fixed files are re-staged. Unstaged changes in the same files are kept aside and restored. If you stage only part of a file (for example with `git add -p`), formatting can shift where your unstaged lines are restored, so check `git diff` afterwards. If a commit fails, lint-staged restores your files and keeps a backup in `git stash list`. The file globs live under `lint-staged` in `package.json`.
2. Check staged changes for whitespace errors with `git diff --cached --check`.
3. Run the generic repository scan.

Before each push, the pre-push hook runs `npm run verify`, the same checks as CI: formatting, lint with zero warnings allowed, the generic scan, TypeScript typechecking, tests with coverage thresholds, and the production build. It does not modify files. It inspects the working tree, so uncommitted changes can affect the result; the hook prints a note when you have any.

A failed check stops the commit or push. Both hooks set the data source to synthetic and never fetch a real sheet. You can run `npm run check:commit` and `npm run verify` manually too.

Hook setup skips source archives without Git metadata, and CI workflows set `HUSKY=0` to skip it. Husky sets `core.hooksPath` to `.husky/_`, replacing any custom hooks path you had configured; if you rely on your own hooks, add them to `.husky/` locally or restore your setting and run `npm run check:commit` from your pre-commit hook and `npm run verify` from your pre-push hook, with the synthetic source. If npm lifecycle scripts were disabled during installation, run `npm run hooks:install` explicitly. If Git clients launched outside your shell (such as some editors) cannot find Node, see Husky's guidance on `~/.config/husky/init.sh`.

Local hooks can be bypassed, and GitHub's web editor has no hooks, so CI remains the shared validation gate. Both validation and deployment workflows check formatting and linting.

## Linting

Run `npm run lint` to check code without changing it. Run `npm run lint:fix` to apply available automatic fixes, then `npm run format` and review the diff; `npm run fix` does both. Some lint errors require a manual fix. The pre-commit hook applies available fixes to staged files; pre-push and CI run the check only, with zero warnings allowed.

`eslint.config.mjs` covers TypeScript/TSX, JavaScript build/configuration scripts, and Apps Script `.gs` files. It uses ESLint and TypeScript recommended rules plus React hook ordering and dependency checks. Runtime globals are scoped to browser, Node, or Apps Script files. Generated artifacts and local data are excluded. Prettier owns formatting, while `npm run typecheck` remains the separate TypeScript compiler check. Fix the underlying issue instead of disabling a rule globally; explain any necessary narrow suppression beside the code.

## Formatting

Run `npm run format` to apply the pinned Prettier version, then review and stage the changes. Run `npm run format:check` to check without modifying files. The pre-commit hook formats and re-stages the files you commit; pre-push and CI only check formatting and never rewrite files.

The shared `.prettierrc.json` uses two-space indentation, single quotes, semicolons, a 120-column target, and LF line endings. It also formats Apps Script `.gs` files as JavaScript. Prettier checks supported source, style, markup, configuration, and documentation files; generated files, dependencies, local data, environment files, and the npm lockfile are excluded. `.gitattributes` keeps text line endings consistent on Windows and Unix. Editor integrations should use the repository's local Prettier version and configuration.
