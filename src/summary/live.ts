// google-signin mode: builds the dashboard summary in the browser after the
// viewer signs in. Loaded on demand so the public build does not ship the
// normalization, validation, and sentiment code it does not need.
import { communityConfig } from '../config';
import { createAppsScriptAdapter } from '../data/adapters/apps-script';
import { loadData } from '../data/load';
import { assertTimeZone } from '../data/normalize';
import { buildSummary } from './build';
import type { DashboardSummary } from './types';

export async function loadLiveSummary(idToken: string): Promise<DashboardSummary> {
  const { reportingTimezone, sourceLabel, googleSignIn } = communityConfig.data;
  assertTimeZone(reportingTimezone);
  const data = await loadData(
    createAppsScriptAdapter({ url: googleSignIn.appsScriptUrl, idToken, sourceLabel, reportingTimezone }),
  );
  // The same privacy rules as the public build: viewers can read the sheet
  // itself, so here they keep charts readable rather than protect data.
  return buildSummary(data);
}
