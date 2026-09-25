// Browser-side source for the `google-signin` mode. Sends the viewer's Google
// ID token to the Apps Script web app (apps-script/Code.gs), which checks it
// against the sheet's sharing list and returns the rows.
import type { DataSourceAdapter, RawDataBundle, RawDatasets } from '../contract';
import type { RawRow } from '../../types';

const DATASET_KEYS = ['events', 'surveyResponses', 'feedbackAnswers', 'registrations', 'participants'] as const;
const REQUEST_TIMEOUT_MS = 60_000;

export type SignInErrorCode =
  'invalid_token' | 'not_authorized' | 'missing_tab' | 'server_error' | 'network_error' | 'bad_response';

export class SignInDataError extends Error {
  readonly code: SignInErrorCode;

  constructor(code: SignInErrorCode, message: string) {
    super(message);
    this.name = 'SignInDataError';
    this.code = code;
  }
}

export interface AppsScriptOptions {
  url: string;
  idToken: string;
  sourceLabel: string;
  reportingTimezone: string;
  fetch?: typeof fetch;
}

type AppsScriptResponse =
  { ok: true; datasets: Record<string, RawRow[]>; fetchedAt: string } | { ok: false; code: string; message: string };

const KNOWN_CODES: SignInErrorCode[] = ['invalid_token', 'not_authorized', 'missing_tab', 'server_error'];

export function createAppsScriptAdapter(options: AppsScriptOptions): DataSourceAdapter {
  return {
    async load(): Promise<RawDataBundle> {
      if (!options.url) throw new SignInDataError('server_error', 'VITE_APPS_SCRIPT_URL is not configured.');
      let response: Response;
      try {
        // text/plain keeps this a "simple" request, which Apps Script can answer
        // across origins. The token travels in the body, never in the URL.
        response = await (options.fetch ?? fetch)(options.url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ idToken: options.idToken }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch {
        throw new SignInDataError(
          'network_error',
          'The reporting sheet could not be reached. Check your connection and try again.',
        );
      }

      let body: AppsScriptResponse;
      try {
        body = (await response.json()) as AppsScriptResponse;
      } catch {
        throw new SignInDataError(
          'bad_response',
          'The sheet backend returned an unexpected response. Check that VITE_APPS_SCRIPT_URL is the web app URL ending in /exec.',
        );
      }
      if (!body.ok) {
        const code = KNOWN_CODES.includes(body.code as SignInErrorCode)
          ? (body.code as SignInErrorCode)
          : 'server_error';
        throw new SignInDataError(code, body.message);
      }

      const datasets = Object.fromEntries(
        DATASET_KEYS.map((key) => [key, body.datasets[key] ?? []]),
      ) as unknown as RawDatasets;
      return {
        datasets,
        source: {
          sourceLabel: options.sourceLabel,
          sourceKind: 'google-signin',
          dataClassification: 'anonymized',
          fetchedAt: new Date(body.fetchedAt),
          reportingTimezone: options.reportingTimezone,
          contractVersion: 1,
          historyStart: null,
          historyEnd: null,
          limitations: [],
        },
      };
    },
  };
}
