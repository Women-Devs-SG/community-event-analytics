# Prepare community data

Start with the bundled synthetic data. Keep it as the default while preparing a separate, access-controlled source for a real deployment.

## 1. Minimise the source

Export only the fields required by the canonical contract in [data-contract-v1.md](data-contract-v1.md). Do not include names, email addresses, phone numbers, free-form identifiers, raw platform IDs, or fields that can be joined back to people.

Use a stable, non-reversible participant key only where the contract requires participant-level deduplication. Keep the mapping to any real identity outside this repository and outside the source sheet.

## 2. Map and validate

The five datasets are `events`, `survey_responses`, `feedback_answers`, `registrations`, and `participants`. Their required fields, joins, allowed nulls, and grains are defined by the contract.

If an existing source uses different column names, configure aliases in `src/config.ts`. If it needs a transformation such as a join, row expansion, or calculation, create a dedicated adapter in `src/data/adapters/`; do not hide that transformation in a spreadsheet formula without documenting it.

Run `npm run summary` with the proposed source and resolve contract errors before deployment; they are listed in the terminal. The app rejects orphaned records, duplicate identifiers, inconsistent returning status, and malformed values rather than silently changing the reported population.

## 3. Review disclosure risk

Review and redact free-text answers before connecting a public source. Eligible comments are published verbatim: a respondent-count threshold does not remove names, email addresses, or identifying details from the text. The identifier assertion checks exact participant/response identifier strings; it is not a general personal-information detector.

Set `privacy.minimumSegmentSize` before publishing. The build applies it before anything is published: small segments, feedback, and comparisons that could reveal a suppressed group through subtraction are left out of the summary, and survey ratings and comments from any event with fewer respondents than the threshold are left out of every figure. This is a safeguard, not a substitute for consent, policy, or legal review.

Because filters work on precomputed selections, overlapping selections (for example a topic, and one event within it) are each checked on their own. Comparing two published registration breakdowns can still narrow down a small group in rare cases; review the community tab with small selections before publishing.

Review every available filter and drill-down using a small selection. Confirm no free-text response, tooltip, total, or derived percentage reveals a group below the threshold.

## 4. Choose a delivery path

The included Google Sheets adapter reads the sheet at build time with a service account, so the sheet can stay private. See [configuration](configuration.md#3-connect-google-sheets). Visitors receive only the generated summary.

New adapters also run at build time: add them under `src/data/adapters/` and select them in `src/summary/generate.ts`. Pass credentials through build-only environment variables without the `VITE_` prefix, and never through Vite variables, browser bundles, Git history, issue reports, or pull requests.

## 5. Release review

Before publishing, run:

```bash
npm run scan:generic
npm test
npm run typecheck
npm run build
```

Then inspect both dashboard tabs with the intended source classification and verify that the footer accurately explains the data in use.
