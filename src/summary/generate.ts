// Build-time entry point, run by scripts/build-summary.mjs. Reads the configured
// source, validates it, and returns the privacy-safe summary for the browser.
import { communityConfig } from '../config';
import { createGoogleSheetsAdapter, parseServiceAccountKey } from '../data/adapters/google-sheets';
import { createSyntheticAdapter } from '../data/adapters/synthetic';
import { loadData } from '../data/load';
import { assertTimeZone } from '../data/normalize';
import type { DataSourceAdapter, RawDatasets } from '../data/contract';
import { assertNoRowIdentifiers, buildSummary } from './build';
import type { DashboardSummary } from './types';

export { SUMMARY_FILE } from './types';

export type BuildEnv = Record<string, string | undefined>;

const TAB_VARIABLES: Record<keyof RawDatasets, [string, string]> = {
  events: ['GOOGLE_TAB_EVENTS', 'events'],
  surveyResponses: ['GOOGLE_TAB_SURVEY_RESPONSES', 'survey_responses'],
  feedbackAnswers: ['GOOGLE_TAB_FEEDBACK_ANSWERS', 'feedback_answers'],
  registrations: ['GOOGLE_TAB_REGISTRATIONS', 'registrations'],
  participants: ['GOOGLE_TAB_PARTICIPANTS', 'participants'],
};

export function createConfiguredAdapter(env: BuildEnv, warn: (message: string) => void): DataSourceAdapter {
  if (communityConfig.data.sourceKind !== 'google-sheets') return createSyntheticAdapter();

  // Earlier versions read these as VITE_ variables. Accept them for now, but
  // they are build-only settings and should not carry the VITE_ prefix.
  const read = (name: string): string | undefined => {
    if (env[name]) return env[name];
    if (env[`VITE_${name}`]) {
      warn(`VITE_${name} is deprecated; rename it to ${name}.`);
      return env[`VITE_${name}`];
    }
    return undefined;
  };
  const tabs = Object.fromEntries(
    Object.entries(TAB_VARIABLES).map(([key, [variable, fallback]]) => [key, read(variable) || fallback]),
  ) as Record<keyof RawDatasets, string>;
  const serviceAccountJson = env.GOOGLE_SERVICE_ACCOUNT_KEY;

  return createGoogleSheetsAdapter({
    sheetId: read('GOOGLE_SHEET_ID') ?? '',
    tabs,
    sourceLabel: communityConfig.data.sourceLabel,
    reportingTimezone: communityConfig.data.reportingTimezone,
    serviceAccountKey: serviceAccountJson ? parseServiceAccountKey(serviceAccountJson) : undefined,
    onWarning: warn,
  });
}

export async function generateSummary(env: BuildEnv, warn: (message: string) => void = console.warn): Promise<DashboardSummary> {
  assertTimeZone(communityConfig.data.reportingTimezone);
  const data = await loadData(createConfiguredAdapter(env, warn));
  const summary = buildSummary(data);
  assertNoRowIdentifiers(summary, data);
  return summary;
}
