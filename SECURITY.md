# Security and privacy

## Reporting a vulnerability

Do not open a public issue for a security vulnerability or possible participant-data exposure. Report it privately through the repository's **Security** tab → **Report a vulnerability**. Maintainers must enable private vulnerability reporting under **Settings → Code security** for this path to be available; until then, contact the maintainers through the private channel listed in the repository profile.

Include a concise description, affected version or commit, reproduction steps, and the potential impact. Do not include real participant records in the report.

## Data safety

The bundled demonstration data is synthetic. A deployment connected to Google Sheets fetches data directly in the visitor's browser, so the configured sheet must be suitable for public browser access.

Never commit names, email addresses, phone numbers, raw account identifiers, private spreadsheet exports, credentials, or reversible participant identifiers. The application’s aggregation and suppression controls reduce accidental disclosure but do not replace consent, legal review, or an adopter’s privacy assessment.
