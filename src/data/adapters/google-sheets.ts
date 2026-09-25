// Build-time only. Reads the source spreadsheet during `npm run summary`; the
// browser never contacts Google and never sees the sheet ID or its rows.
//
// Preferred: a private sheet shared with a Google Cloud service account, read
// through the Sheets API. Fallback: the public "anyone with the link" CSV
// export, which still works but leaves every row readable by anyone who has
// the sheet ID, so it is reported as a warning.
import Papa from 'papaparse';
import type { DataSourceAdapter, RawDataBundle, RawDatasets } from '../contract';
import type { RawRow, SourceMetadata } from '../../types';

const DATASET_KEYS = [
  'events',
  'surveyResponses',
  'feedbackAnswers',
  'registrations',
  'participants',
] as const satisfies readonly (keyof RawDatasets)[];

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const REQUEST_TIMEOUT_MS = 30_000;

export interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

export interface GoogleSheetsOptions {
  sheetId: string;
  tabs: Record<keyof RawDatasets, string>;
  sourceLabel: string;
  reportingTimezone: string;
  /** Service-account key JSON. When absent, the public CSV export is used. */
  serviceAccountKey?: ServiceAccountKey;
  onWarning?: (message: string) => void;
  fetch?: typeof fetch;
}

export function parseServiceAccountKey(json: string): ServiceAccountKey {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON. Paste the whole key file downloaded from Google Cloud.',
    );
  }
  const key = parsed as Partial<ServiceAccountKey>;
  if (typeof key.client_email !== 'string' || typeof key.private_key !== 'string') {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY must contain client_email and private_key.');
  }
  return { client_email: key.client_email, private_key: key.private_key };
}

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const base64UrlJson = (value: unknown) => base64Url(new TextEncoder().encode(JSON.stringify(value)));

// Signs a service-account JWT with WebCrypto and exchanges it for an access token.
async function accessToken(key: ServiceAccountKey, fetchImpl: typeof fetch): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64UrlJson({ alg: 'RS256', typ: 'JWT' })}.${base64UrlJson({
    iss: key.client_email,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })}`;
  const der = Uint8Array.from(atob(key.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) =>
    c.charCodeAt(0),
  );
  const signingKey = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', signingKey, new TextEncoder().encode(unsigned)),
  );

  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${base64Url(signature)}`,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok)
    throw new Error(
      `Google rejected the service-account key (HTTP ${response.status}). Check GOOGLE_SERVICE_ACCOUNT_KEY.`,
    );
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error('Google did not return an access token for the service account.');
  return body.access_token;
}

function rowsFromValues(values: string[][]): RawRow[] {
  const [header = [], ...rows] = values;
  return rows
    .filter((row) => row.some((cell) => String(cell ?? '').trim()))
    .map((row) => Object.fromEntries(header.map((field, index) => [field, row[index] ?? ''])));
}

async function fetchTabWithApi(
  sheetId: string,
  tab: string,
  token: string,
  clientEmail: string,
  fetchImpl: typeof fetch,
): Promise<RawRow[]> {
  const range = encodeURIComponent(`'${tab.replace(/'/g, "''")}'`);
  const response = await fetchImpl(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${range}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );
  if (response.status === 403 || response.status === 404) {
    throw new Error(
      `${tab}: the service account cannot read this sheet or tab (HTTP ${response.status}). Share the sheet with ${clientEmail} as a Viewer and check the tab name.`,
    );
  }
  if (!response.ok) throw new Error(`${tab}: Google Sheets API returned HTTP ${response.status}.`);
  const body = (await response.json()) as { values?: string[][] };
  return rowsFromValues(body.values ?? []);
}

async function fetchTabAsPublicCsv(sheetId: string, tab: string, fetchImpl: typeof fetch): Promise<RawRow[]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`${tab}: HTTP ${response.status}`);
  if (response.headers.get('content-type')?.includes('text/html')) {
    throw new Error(
      `${tab}: Google returned a web page instead of CSV. The sheet is probably private; set GOOGLE_SERVICE_ACCOUNT_KEY to read it.`,
    );
  }
  const parsed = Papa.parse<Record<string, string>>(await response.text(), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) {
    const first = parsed.errors[0];
    throw new Error(`${tab}: CSV parse error${first.row == null ? '' : ` on row ${first.row + 1}`}: ${first.message}`);
  }
  return parsed.data;
}

export function createGoogleSheetsAdapter(options: GoogleSheetsOptions): DataSourceAdapter {
  return {
    async load(): Promise<RawDataBundle> {
      const { sheetId, tabs, serviceAccountKey } = options;
      const fetchImpl = options.fetch ?? fetch;
      if (!sheetId) throw new Error('Google Sheets is selected but GOOGLE_SHEET_ID is not configured.');

      let fetchTab: (tab: string) => Promise<RawRow[]>;
      if (serviceAccountKey) {
        const token = await accessToken(serviceAccountKey, fetchImpl);
        fetchTab = (tab) => fetchTabWithApi(sheetId, tab, token, serviceAccountKey.client_email, fetchImpl);
      } else {
        options.onWarning?.(
          'Reading the sheet through its public link. The dashboard no longer publishes raw rows, but anyone with the sheet ID can still open the sheet. ' +
            'Make the sheet private and set GOOGLE_SERVICE_ACCOUNT_KEY instead.',
        );
        fetchTab = (tab) => fetchTabAsPublicCsv(sheetId, tab, fetchImpl);
      }

      const rows = await Promise.all(DATASET_KEYS.map((key) => fetchTab(tabs[key])));
      const datasets = Object.fromEntries(
        DATASET_KEYS.map((key, index) => [key, rows[index]]),
      ) as unknown as RawDatasets;
      const source: SourceMetadata = {
        sourceLabel: options.sourceLabel,
        sourceKind: 'google-sheets',
        dataClassification: 'anonymized',
        fetchedAt: new Date(),
        reportingTimezone: options.reportingTimezone,
        contractVersion: 1,
        historyStart: null,
        historyEnd: null,
        limitations: [],
      };
      return { datasets, source };
    },
  };
}
