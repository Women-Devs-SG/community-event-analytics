# Agent guide

This guide applies to the whole repository. Read it before changing code, then read the relevant files and tests. Keep changes focused on the requested task and preserve unrelated local work.

## Project and first steps

Community Event Analytics is a static dashboard for event organizers, built with React, strict TypeScript, Vite, and ECharts. The default source is deterministic synthetic data; ordinary development needs no credentials or external services.

- Start with [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md).
- For data, metrics, or privacy changes, read [the data contract](docs/data-contract-v1.md), including its known conformance gaps, and [SECURITY.md](SECURITY.md).
- For source or configuration changes, read [configuration](docs/configuration.md) and [data preparation](docs/data-preparation.md).
- For authentication changes, read [Google sign-in](docs/google-signin.md).
- Before release work, read [publishing](docs/publishing.md). A passing working-tree scan does not establish that Git history is safe to publish.

## Commands

Run commands from the repository root. Use npm and the committed `package-lock.json`; `.nvmrc` pins Node 22 and `package.json` requires Node >=22.

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the locked dependencies for a fresh checkout. |
| `npm run dev` | Generate the summary in development mode, then start Vite. |
| `npm run summary` | Regenerate `public/dashboard-summary.json` in production mode. |
| `npm test` | Run all Vitest tests once. |
| `npm test -- src/privacy.test.ts` | Run a focused test file; substitute the relevant path. |
| `npm run typecheck` | Check strict TypeScript without emitting files. |
| `npm run scan:generic` | Scan for selected source-project identifiers and deployment values. |
| `npm run build` | Typecheck, regenerate the summary, and build into `dist/`. |
| `npm run preview` | Serve the existing production build locally. |

There is no configured lint, formatter, or end-to-end test command. Do not invent one or add tooling just to complete an unrelated change. Use the URL printed by Vite rather than assuming a port.

Environment files can change the source. Keep routine checks on `VITE_DATA_SOURCE=synthetic`; do not read real community data merely to verify a code change. Process environment overrides can be set with `$env:VITE_DATA_SOURCE='synthetic'` in PowerShell or `export VITE_DATA_SOURCE=synthetic` in a POSIX shell. Do not print environment contents or credentials.

`dev` generates its summary once at startup. Restart it after data/configuration changes to regenerate using development-mode settings. `summary` and `build` use production-mode settings. `preview` does not regenerate data.

## Code map

| Area | Responsibility |
| --- | --- |
| `src/main.tsx` | React application shell, sign-in state, dashboard lifecycle. |
| `src/dash-effectiveness.ts`, `src/dash-community.ts` | Imperative DOM/ECharts dashboard controllers. |
| `src/components.ts` | Shared DOM components, filters, feedback board, HTML escaping. |
| `src/style.css`, `src/theme.ts` | Page styles and chart styles. |
| `src/config.ts`, `src/vite-env.d.ts`, `.env.example` | Community configuration and public environment settings. |
| `src/data.ts` | Browser summary loading, shared filters, scope lookup, error presentation. |
| `src/data/contract.ts`, `src/types.ts` | Source contract and normalized row/runtime types. |
| `src/data/adapters/` | Synthetic, build-time Google Sheets, and authenticated Apps Script sources. |
| `src/data/normalize.ts`, `src/data/validate.ts`, `src/data/load.ts` | Normalize aliases/values, validate keys/joins, assemble row-level data. |
| `src/metrics.ts`, `src/privacy.ts` | Metric calculations and disclosure controls. |
| `src/summary/build.ts`, `src/summary/scope.ts`, `src/summary/types.ts` | Summary generation, reachable filter selections, serialized summary contract. |
| `src/summary/generate.ts`, `scripts/build-summary.mjs` | Build-time source selection and summary output. |
| `src/summary/live.ts`, `src/auth/`, `apps-script/Code.gs` | Authenticated browser loading and server-side access checks. |
| `src/sentiment.ts`, `src/summary/sentiment-score.ts` | Feedback themes/actions and sentiment scoring. |
| `.github/workflows/` | Pull-request validation and GitHub Pages deployment. |

## Data and security boundaries

There are two distinct paths; preserve both:

1. **Public modes (`synthetic`, `google-sheets`):** adapter → normalization → validation → metrics/privacy → generated summary → browser. Only approved summary fields are published. Never expose row-level datasets or source credentials through the public browser path.
2. **Private mode (`google-signin`):** Google sign-in → Apps Script token verification and sheet-sharing check → source rows → browser normalization/validation/summary. Authorized viewers receive raw rows; chart suppression is not an access boundary. The build removes any previous public summary in this mode.

- Keep `GOOGLE_SERVICE_ACCOUNT_KEY`, sheet IDs, and tab settings build-only. Do not introduce `VITE_` credentials or read/spread the entire `import.meta.env` object. Public OAuth client IDs and the Apps Script URL are intentionally public configuration, not authorization.
- The browser's decoded ID token is for display only. Apps Script must verify audience, issuer, expiry, verified email, and sharing access before returning data. Do not replace these checks with a client-side gate.
- Keep tokens and live rows out of persistent browser storage, logs, fixtures, and error reports.
- Never commit real participant data, source exports, configured deployment identifiers, or credentials. Use synthetic fixtures in tests and examples.
- Do not commit or hand-edit `public/dashboard-summary.json`, `dist/`, or `node_modules/`; they are generated and ignored.
- Preserve `assertNoRowIdentifiers` in the public generation path. It checks exact identifier strings, not arbitrary personal information embedded in prose. Published comments still require source review/redaction.
- Apply disclosure rules before serialization, not only in chart rendering. Count distinct people/respondents where required, preserve per-event survey suppression, and do not lower thresholds to make a test pass.
- Registration breakdowns across overlapping selections have a documented differencing limitation. Do not describe the current implementation as guaranteeing anonymity.
- `scan:generic` is a targeted text scan, not a comprehensive secret, personal-data, or Git-history audit. Do not weaken its checks to accommodate private material.

## Implementation conventions

- Follow nearby code: two-space indentation, single quotes, semicolons, explicit interfaces/types, and `import type` for type-only imports. Avoid broad reformatting or unrelated dependency upgrades.
- Preserve the existing React shell plus DOM/ECharts controllers unless a task calls for architectural change. Clean up listeners and chart instances through controller disposal; resize charts when tabs become visible.
- Escape data/configuration strings inserted into HTML templates using `esc` from `src/components.ts`, or use safe DOM text APIs. Review chart tooltip HTML as well as page markup.
- Put branding, aliases, segment labels/order, exclusions, and rating settings in `src/config.ts`; do not scatter adopter-specific values through charts.
- Put source transformations in adapters/normalization. Dashboard code consumes canonical summary fields, not spreadsheet column names.
- Preserve null/unknown measurements and explicit unavailable/error states. Missing values are not zero; never substitute synthetic rows after a real source fails.
- Preserve dataset grains and metric denominators. Never infer respondent demographics by joining anonymous surveys to registrations on event alone.
- Changes to canonical meaning, keys, or denominators require contract version/migration consideration. Summary format changes must keep `SUMMARY_VERSION`, generation, and browser loading compatible.
- Adding filters requires updating reachable selections and scope generation as well as the UI; public summaries precompute selections and do not support arbitrary date ranges.
- When adding environment settings, update the relevant config/types, `.env.example`, documentation, and deployment workflow mapping together.

## Verification and handoff

For code changes, run the relevant focused tests while working, then `npm run scan:generic`, `npm test`, and `npm run build` before handoff. The build includes typechecking. For documentation-only edits, check links/commands and run the generic scan; do not add tests for prose.

Existing test coverage is organized by behavior:

- `src/data/data.test.ts`: normalization, validation, timezone handling, synthetic data.
- `src/privacy.test.ts`: suppression and protected groupings.
- `src/summary/summary.test.ts`: published identifiers, survey suppression, filter coverage, Sheets adapter.
- `src/auth/signin.test.ts`: Apps Script access checks, live loading, token display.
- `src/components.test.ts`: HTML escaping.

Add regression coverage for changed behavior, especially privacy boundaries, joins, denominators, nulls, and access checks. Mock external services; automated tests must not depend on a real sheet or account. Apps Script tests exercise helpers locally, not a deployed Google integration.

For UI changes, inspect both dashboard tabs, filters/reset, chart interactions, empty states, narrow screens, and browser errors using synthetic data. For authentication changes, distinguish mocked checks from any authorized live verification. Report checks not performed rather than implying they passed.

Before finishing, inspect `git diff --check`, the diff, and `git status --short`. Summarize the changes, validation, and unresolved risks. Do not deploy, publish, rewrite history, or change repository settings unless requested; pushes to `main` trigger Pages deployment.
