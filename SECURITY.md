# Security and privacy

## Reporting a vulnerability

Do not open a public issue for a security vulnerability or possible participant-data exposure. Report it privately through the repository's **Security** tab → **Report a vulnerability**. Maintainers must enable private vulnerability reporting under **Settings → Code security** for this path to be available; until then, contact the maintainers through the private channel listed in the repository profile.

Include a concise description, affected version or commit, reproduction steps, and the potential impact. Do not include real participant records in the report.

## Data safety

The bundled demonstration data is synthetic. A deployment connected to Google Sheets reads the sheet at build time and publishes only a privacy-safe summary (`dashboard-summary.json`); visitors never receive source rows, participant IDs, or response IDs. Keep the sheet private and read it with a service account whose key is stored as a repository secret. If the sheet is instead shared by public link, anyone who learns its ID can read every row, whatever the dashboard shows.

In `google-signin` mode, nothing is published at build time. A viewer receives the sheet's rows only after signing in with Google, and only if the sheet is shared with their account; an Apps Script attached to the sheet verifies both on every request. Those viewers can see raw responses, so share the sheet only with people entitled to them.

Never commit names, email addresses, phone numbers, raw account identifiers, private spreadsheet exports, credentials, or reversible participant identifiers. The application’s aggregation and suppression controls reduce accidental disclosure but do not replace consent, legal review, or an adopter’s privacy assessment.
