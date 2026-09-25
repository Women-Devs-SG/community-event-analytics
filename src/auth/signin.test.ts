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
