# Community Event Analytics

Open-source event analytics dashboards for community organizers. The project helps a community understand:

- **Programme effectiveness:** which events, topics, and formats attract demand and receive strong participant feedback.
- **Community profile:** who participates, which groups return, and how outcomes vary across supported segments.

## Start your community version

Use this project as a GitHub template or copy a reviewed clean snapshot into a new repository. Avoid forking an older development history if it previously contained private data or organization-specific artifacts; deleting a file does not remove it from earlier commits.

1. Create the new repository.
2. Run the synthetic demo locally.
3. Configure identity and colors using `.env.local`.
4. Review segment labels, source aliases, and privacy settings in `src/config.ts`.
5. Keep synthetic data as the default until the real source has been reviewed.

The full publishing checklist is in [`docs/publishing.md`](docs/publishing.md).
For an adopting community, use the [adoption workflow](docs/adopting-community.md) rather than copying historical data or branding into this repository.

## Safe demo by default

A fresh clone builds its dashboard from deterministic synthetic data generated locally. The demo contains fictional events, participants, registrations, survey ratings, and comments. It does not contact any external data source.

The sample deliberately includes repeat participants, missing demographics, unknown attendance, small segments, and events without feedback so empty and incomplete states can be tested honestly.

```text
Build time (npm run summary)                       Browser
  source adapter (synthetic or Google Sheets)
  → canonical normalization
  → contract validation
  → metrics + privacy rules
  → public/dashboard-summary.json   ──────────▶   dashboards
```

In the public modes (`synthetic` and `google-sheets`), the browser receives only the summary: aggregates that met the privacy threshold, event metadata, and comments from events with enough respondents. It never receives participant IDs, response IDs, or registration rows, and never contacts the data source. The optional `google-signin` mode described below loads source rows for authorized viewers and builds the summary in their browser.

The source architecture lives under `src/data/` and the build-time summary under `src/summary/`. `src/data.ts` is the browser-side facade that loads the summary.

## Develop

Use Node 22 (see `.nvmrc`) and npm. AI coding contributors should read [`AGENTS.md`](AGENTS.md) for the code map, data boundaries, conventions, and verification workflow.

```bash
npm ci
npm run dev        # builds the summary, then starts Vite
npm run summary    # rebuild the summary after changing data or config
npm test
npm run format:check
npm run scan:generic
npm run build
```

`npm ci` installs the shared pre-commit hook automatically. For an existing checkout, run `npm run hooks:install`. Each commit checks staged whitespace and formatting, runs the generic scan, typechecks, and runs all tests using synthetic data. Run `npm run format` to fix formatting before committing. See [the contributor guide](CONTRIBUTING.md#pre-commit-checks) for details.

Stack: React, TypeScript, Vite, Apache ECharts, PapaParse, Sentiment, and Vitest. The synthetic demo is fully static and requires no backend, database, API keys, or paid services. Public summaries are generated at build time; Google sign-in mode uses an Apps Script backend and performs summary generation, including sentiment scoring, in the browser.

## Optional Google Sheets source

Google Sheets remains available as an opt-in adapter. The sheet is read once, at build time, and only the privacy-safe summary is published. Copy `.env.example` to `.env.local`, then configure:

```dotenv
VITE_DATA_SOURCE=google-sheets
VITE_REPORTING_TIMEZONE=UTC
GOOGLE_SHEET_ID=replace_with_your_sheet_id
GOOGLE_SERVICE_ACCOUNT_KEY={"client_email":"...","private_key":"..."}
```

The configured spreadsheet uses these tabs by default:

- `events`
- `survey_responses`
- `feedback_answers`
- `registrations`
- `participants`

Each tab name can be overridden with the `GOOGLE_TAB_*` variables shown in `.env.example`. Canonical fields and accepted source-column aliases are configured in `src/config.ts`.

Keep the sheet **private**. Create a Google Cloud service account with the Google Sheets API enabled, share the sheet with the account's email as a Viewer, and supply its JSON key as `GOOGLE_SERVICE_ACCOUNT_KEY`. Without a key, the build falls back to the sheet's public link and prints a warning: the published site still contains only the summary, but anyone with the sheet ID could open the sheet itself.

Because data is read at build time, the dashboard shows data as of the last build. The deploy workflow rebuilds daily and can be run manually from the **Actions** tab.

Earlier versions used `VITE_GOOGLE_SHEET_ID` and `VITE_GOOGLE_TAB_*`. Those names still work but print a deprecation warning; rename them without the `VITE_` prefix.

## Private dashboard with Google sign-in

To show the dashboard only to your organisers, set `VITE_DATA_SOURCE=google-signin`. Viewers sign in with Google, and a small Apps Script attached to the sheet returns live data only to accounts the sheet is shared with. Sharing the sheet is the only access list, the site contains no data, and no server or service account is needed.

Viewers in this mode can read the sheet itself, so share it only with people who may see raw responses. Setup takes about 15 minutes: see [Google sign-in](docs/google-signin.md).

## Data contract

The versioned canonical schema, dataset grains, joins, metric denominators, normalization rules, privacy behavior, and feature-degradation policy are defined in [`docs/data-contract-v1.md`](docs/data-contract-v1.md).

Source-specific column names are mapped into canonical fields before metrics or charts use them. Invalid keys, duplicate identities, orphaned joins, inconsistent returning status, and malformed values produce structured contract errors instead of silently changing the population.

See [data preparation](docs/data-preparation.md) for the safe path from a community's source data to a deployment.

## Configuration

Community identity and core colors can be set with environment variables. Navigation labels, terminology, feedback-question mappings, segment labels/order, source-column aliases, exclusions, and the minimum segment size live in `src/config.ts`.

See [`docs/configuration.md`](docs/configuration.md) for the adopter checklist and mapping examples.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which runs the checks and tests, builds the summary and the site, and publishes `dist/` to GitHub Pages. It also runs daily to refresh the data. One-time repository setup: **Settings → Pages → Source: GitHub Actions**.

Environment variables used during the build determine whether the deployed site uses synthetic data or an explicitly configured Google Sheet. Synthetic remains the default when no variables are supplied.

## Contributing and license

See [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a change and [`SECURITY.md`](SECURITY.md) for private vulnerability and data-exposure reporting guidance.

The project is available under the [MIT License](LICENSE).
