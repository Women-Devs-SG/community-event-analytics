# Development tooling

This page describes the pre-commit hook, linting, and formatting setup. For the contribution workflow, start with the [contributor guide](../CONTRIBUTING.md).

## Pre-commit checks

`npm ci` (or `npm install`) enables the shared hook through npm's `prepare` script. In an existing checkout, run `npm run hooks:install` once. Git and Node/npm must be available on your PATH, including when committing from an editor.

Before each commit, the hook runs `npm run check:commit`:

1. Check staged changes for whitespace errors with `git diff --cached --check`.
2. Check formatting with Prettier.
3. Run ESLint with zero warnings allowed.
4. Run the generic repository scan.
5. Run TypeScript typechecking.
6. Run all Vitest tests.

A failed check stops the commit. The hook sets the data source to synthetic and does not build the site or fetch a real sheet. It does not modify or stage files. Apart from the staged whitespace check, checks inspect the working tree, so unstaged changes can affect the result; review partially staged files carefully. You can run `npm run check:commit` manually too.

Hook setup skips CI and source archives without Git metadata. It preserves an existing custom `core.hooksPath`; if setup reports one, add `npm run check:commit` to your existing hook and use the synthetic source. If npm lifecycle scripts were disabled during installation, run `npm run hooks:install` explicitly.

Local hooks can be bypassed, so CI remains the shared validation gate. Both validation and deployment workflows check formatting and linting.

## Linting

Run `npm run lint` to check code without changing it. Run `npm run lint:fix` to apply available automatic fixes, then `npm run format` and review the diff. Some lint errors require a manual fix. Pre-commit and CI run the check only, with zero warnings allowed.

`eslint.config.mjs` covers TypeScript/TSX, JavaScript build/configuration scripts, and Apps Script `.gs` files. It uses ESLint and TypeScript recommended rules plus React hook ordering and dependency checks. Runtime globals are scoped to browser, Node, or Apps Script files. Generated artifacts and local data are excluded. Prettier owns formatting, while `npm run typecheck` remains the separate TypeScript compiler check. Fix the underlying issue instead of disabling a rule globally; explain any necessary narrow suppression beside the code.

## Formatting

Run `npm run format` to apply the pinned Prettier version, then review and stage the changes. Run `npm run format:check` to check without modifying files. Pre-commit and CI only check formatting; they never automatically rewrite or stage files.

The shared `.prettierrc.json` uses two-space indentation, single quotes, semicolons, a 120-column target, and LF line endings. It also formats Apps Script `.gs` files as JavaScript. Prettier checks supported source, style, markup, configuration, and documentation files; generated files, dependencies, local data, environment files, and the npm lockfile are excluded. `.gitattributes` keeps text line endings consistent on Windows and Unix. Editor integrations should use the repository's local Prettier version and configuration.
