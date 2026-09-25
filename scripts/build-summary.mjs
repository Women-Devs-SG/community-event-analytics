// Reads the configured data source, applies the privacy rules, and writes the
// summary the dashboard loads. Raw rows stay in this process; only the summary
// is written to public/ and shipped with the site.
//
// Usage: node scripts/build-summary.mjs [mode]   (mode defaults to "production")
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadEnv, runnerImport } from 'vite';

const root = process.cwd();
const mode = process.argv[2] ?? 'production';
// All variables from .env files plus the process environment, including
// build-only ones such as GOOGLE_SERVICE_ACCOUNT_KEY that have no VITE_ prefix.
const env = loadEnv(mode, root, '');

// google-signin mode reads the sheet live after a viewer signs in, so nothing
// may be published at build time. Remove any summary left from an earlier run.
if (env.VITE_DATA_SOURCE === 'google-signin') {
  await rm(join(root, 'public', 'dashboard-summary.json'), { force: true });
  const missing = ['VITE_GOOGLE_OAUTH_CLIENT_ID', 'VITE_APPS_SCRIPT_URL'].filter((name) => !env[name]);
  if (missing.length) {
    console.error(`google-signin mode needs ${missing.join(' and ')}. See docs/google-signin.md.`);
    process.exit(1);
  }
  console.log('google-signin mode: no summary is published; signed-in viewers load data from the sheet.');
  process.exit(0);
}

const warnings = [];
try {
  const { module } = await runnerImport('/src/summary/generate.ts', {
    root,
    mode,
    configFile: false,
    logLevel: 'error',
  });
  const { SUMMARY_FILE, generateSummary } = module;
  const summary = await generateSummary(env, (message) => warnings.push(message));

  const outputDir = join(root, 'public');
  await mkdir(outputDir, { recursive: true });
  const json = JSON.stringify(summary);
  await writeFile(join(outputDir, SUMMARY_FILE), json);

  for (const warning of warnings) console.warn(`warning: ${warning}`);
  console.log(
    `Dashboard summary written to public/${SUMMARY_FILE} (${(json.length / 1024).toFixed(0)} KB): ` +
      `${summary.events.length} events, ${Object.keys(summary.scopes).length} filter selections, ${summary.comments.length} published comments. ` +
      `Source: ${summary.source.label}.`,
  );
} catch (error) {
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  console.error(`Could not build the dashboard summary: ${error instanceof Error ? error.message : String(error)}`);
  const issues =
    error && typeof error === 'object' && 'issues' in error && Array.isArray(error.issues) ? error.issues : [];
  for (const issue of issues.filter((item) => item.severity === 'error').slice(0, 25)) {
    console.error(`  - ${issue.message}`);
  }
  if (issues.length > 25) console.error(`  …and ${issues.length - 25} more.`);
  process.exitCode = 1;
}
