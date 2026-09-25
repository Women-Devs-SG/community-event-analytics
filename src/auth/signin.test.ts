import { describe, expect, it, vi } from 'vitest';
import appsScriptSource from '../../apps-script/Code.gs?raw';
import { createAppsScriptAdapter, SignInDataError } from '../data/adapters/apps-script';
import { createSyntheticAdapter } from '../data/adapters/synthetic';
import { loadData } from '../data/load';
import { buildSummary } from '../summary/build';
import { formatSignInError } from '../data';
import { readIdToken } from './google-identity';
import type { RawRow } from '../types';

// The Apps Script's pure checks, evaluated without Google's services.
type Claims = Record<string, unknown>;
const script = new Function(`${appsScriptSource}\nreturn { checkClaims_, isAllowed_, rowsFromValues_ };`)() as {
  checkClaims_: (claims: Claims, clientId: string, now: number) => { email: string };
  isAllowed_: (email: string, shared: string[]) => boolean;
  rowsFromValues_: (values: string[][]) => RawRow[];
};

const CLIENT_ID = 'dashboard.apps.googleusercontent.com';
const NOW = 1_800_000_000;
const validClaims = {
  aud: CLIENT_ID,
  iss: 'https://accounts.google.com',
  exp: String(NOW + 600),
  email: 'Organiser@Example.com',
  email_verified: 'true',
};

describe('Apps Script access checks', () => {
  it('accepts a current Google token issued for this dashboard', () => {
    expect(script.checkClaims_(validClaims, CLIENT_ID, NOW)).toEqual({ email: 'organiser@example.com' });
  });

  it.each([
    ['another app', { aud: 'other.apps.googleusercontent.com' }, /different app/],
    ['another issuer', { iss: 'https://evil.example' }, /not issued by Google/],
    ['an expired token', { exp: String(NOW - 1) }, /expired/],
    ['an unverified email', { email_verified: 'false' }, /verified email/],
  ])('rejects %s', (_label, override, message) => {
    expect(() => script.checkClaims_({ ...validClaims, ...override }, CLIENT_ID, NOW)).toThrow(message);
  });

  it('allows only accounts on the sheet sharing list, ignoring case', () => {
    expect(script.isAllowed_('organiser@example.com', ['Organiser@example.com', 'x@example.com'])).toBe(true);
    expect(script.isAllowed_('stranger@example.com', ['organiser@example.com'])).toBe(false);
  });

  it('turns sheet values into rows keyed by header, skipping blank rows', () => {
    expect(
      script.rowsFromValues_([['event_id', 'event_name', ''], ['e1', 'Meetup', 'x'], ['', '', ''], ['e2']]),
    ).toEqual([
      { event_id: 'e1', event_name: 'Meetup' },
      { event_id: 'e2', event_name: '' },
    ]);
  });
});

// Exercise the web-app entry point without an active spreadsheet or real Google services.
function webAppHarness(sheetId: string | null = 'test-reporting-sheet', claims: Claims = {}) {
  const getSheetByName = vi.fn(() => ({
    getDataRange: () => ({ getDisplayValues: () => [['event_id'], ['test-event']] }),
  }));
  const openById = vi.fn(() => ({
    getOwner: () => ({ getEmail: () => 'organiser@example.com' }),
    getEditors: () => [],
    getViewers: () => [],
    getSheetByName,
  }));
  const getProperty = vi.fn(() => sheetId);
  const handler = new Function(
    'PropertiesService',
    'SpreadsheetApp',
    'UrlFetchApp',
    'ContentService',
    'console',
    `${appsScriptSource}\nreturn doPost;`,
  )(
    { getScriptProperties: () => ({ getProperty }) },
    { openById },
    {
      fetch: () => ({
        getResponseCode: () => 200,
        getContentText: () =>
          JSON.stringify({
            ...validClaims,
            aud: 'replace-with-your-client-id.apps.googleusercontent.com',
            exp: Math.floor(Date.now() / 1000) + 600,
            ...claims,
          }),
      }),
    },
    { MimeType: { JSON: 'application/json' }, createTextOutput: (text: string) => ({ setMimeType: () => text }) },
    { error: vi.fn() },
  ) as (event: { postData: { contents: string } }) => string;
  return {
    openById,
    getProperty,
    getSheetByName,
    request: () =>
      JSON.parse(handler({ postData: { contents: JSON.stringify({ idToken: 'test-token' }) } })) as {
        ok: boolean;
        code?: string;
        message?: string;
        datasets?: Record<string, RawRow[]>;
      },
  };
}

describe('Apps Script web-app handler', () => {
  it('opens the configured sheet and returns rows for an authorized viewer without active context', () => {
    const app = webAppHarness('  test-reporting-sheet  ');
    const response = app.request();
    expect(app.getProperty).toHaveBeenCalledWith('REPORTING_SHEET_ID');
    expect(app.openById).toHaveBeenCalledExactlyOnceWith('test-reporting-sheet');
    expect(response).toMatchObject({ ok: true, datasets: { events: [{ event_id: 'test-event' }] } });
    expect(Object.keys(response.datasets!)).toEqual([
      'events',
      'surveyResponses',
      'feedbackAnswers',
      'registrations',
      'participants',
    ]);
  });

  it.each([null, '', '   '])('fails clearly before opening a sheet when its ID is %j', (sheetId) => {
    const app = webAppHarness(sheetId);
    expect(app.request()).toMatchObject({
      ok: false,
      code: 'server_error',
      message: expect.stringContaining('REPORTING_SHEET_ID'),
    });
    expect(app.openById).not.toHaveBeenCalled();
  });

  it('rejects an invalid token before accessing spreadsheet configuration', () => {
    const app = webAppHarness('test-reporting-sheet', { aud: 'another-app' });
    expect(app.request()).toMatchObject({ ok: false, code: 'invalid_token' });
    expect(app.getProperty).not.toHaveBeenCalled();
    expect(app.openById).not.toHaveBeenCalled();
  });

  it('checks the configured spreadsheet sharing list before reading rows', () => {
    const app = webAppHarness('test-reporting-sheet', { email: 'stranger@example.com' });
    expect(app.request()).toMatchObject({ ok: false, code: 'not_authorized' });
    expect(app.openById).toHaveBeenCalledWith('test-reporting-sheet');
    expect(app.getSheetByName).not.toHaveBeenCalled();
  });

  it('returns a generic error when the configured spreadsheet cannot be opened', () => {
    const app = webAppHarness();
    app.openById.mockImplementation(() => {
      throw new Error('Private spreadsheet details');
    });
    const response = app.request();
    expect(response).toMatchObject({ ok: false, code: 'server_error' });
    expect(response.message).not.toContain('Private spreadsheet details');
    expect(response.datasets).toBeUndefined();
    expect(app.getSheetByName).not.toHaveBeenCalled();
  });
});

// Mimics the Apps Script: every value arrives as displayed text.
const asDisplayedText = (rows: RawRow[]) =>
  rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value == null ? '' : String(value)])),
  );

describe('google-signin data loading', () => {
  it('sends the token in the request body as a simple request', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true, datasets: {}, fetchedAt: '2026-09-24T00:00:00Z' }));
    await createAppsScriptAdapter({
      url: 'https://script.example/exec',
      idToken: 'token-abc',
      sourceLabel: 'Sheet',
      reportingTimezone: 'UTC',
      fetch: fetchMock as typeof fetch,
    }).load();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://script.example/exec');
    expect(url).not.toContain('token-abc');
    expect(JSON.parse(String(init.body))).toEqual({ idToken: 'token-abc' });
    expect(new Headers(init.headers).get('Content-Type')).toMatch(/^text\/plain/);
  });

  it('builds the dashboard summary from rows returned to a signed-in viewer', async () => {
    const synthetic = await createSyntheticAdapter().load();
    const datasets = Object.fromEntries(
      Object.entries(synthetic.datasets).map(([key, rows]) => [key, asDisplayedText(rows)]),
    );
    const fetchMock = vi.fn(async () => Response.json({ ok: true, datasets, fetchedAt: '2026-09-24T00:00:00Z' }));

    const data = await loadData(
      createAppsScriptAdapter({
        url: 'https://script.example/exec',
        idToken: 't',
        sourceLabel: 'Sheet',
        reportingTimezone: 'UTC',
        fetch: fetchMock as typeof fetch,
      }),
    );
    const summary = buildSummary(data);
    expect(summary.source).toMatchObject({ kind: 'google-signin', label: 'Sheet' });
    expect(summary.events).toHaveLength(24);
    expect(summary.comments.length).toBeGreaterThan(0);
  });

  it('explains refusals from the sheet backend', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ ok: false, code: 'not_authorized', message: 'x is not on the list' }),
    );
    const load = createAppsScriptAdapter({
      url: 'https://script.example/exec',
      idToken: 't',
      sourceLabel: 'Sheet',
      reportingTimezone: 'UTC',
      fetch: fetchMock as typeof fetch,
    }).load();

    const error = await load.catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(SignInDataError);
    expect(formatSignInError(error, 'stranger@example.com')).toMatch(
      /stranger@example\.com doesn't have access.*share the reporting sheet/,
    );
  });

  it('reports a misconfigured backend URL instead of failing silently', async () => {
    const fetchMock = vi.fn(
      async () => new Response('<html>Page not found</html>', { headers: { 'content-type': 'text/html' } }),
    );
    await expect(
      createAppsScriptAdapter({
        url: 'https://script.example/wrong',
        idToken: 't',
        sourceLabel: 'Sheet',
        reportingTimezone: 'UTC',
        fetch: fetchMock as typeof fetch,
      }).load(),
    ).rejects.toThrow(/VITE_APPS_SCRIPT_URL/);
  });
});

describe('ID token display', () => {
  it('reads the signed-in name and email for display', () => {
    const payload = btoa(
      String.fromCharCode(...new TextEncoder().encode(JSON.stringify({ email: 'ana@example.com', name: 'Ána Tan' }))),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(readIdToken(`header.${payload}.signature`)).toEqual({ email: 'ana@example.com', name: 'Ána Tan' });
    expect(readIdToken('not-a-jwt')).toEqual({ email: '', name: '' });
  });
});
