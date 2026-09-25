import { describe, expect, it, vi } from 'vitest';
import { loadData } from '../data/load';
import { createSyntheticAdapter } from '../data/adapters/synthetic';
import { createGoogleSheetsAdapter } from '../data/adapters/google-sheets';
import type { RawDataBundle, RawDatasets } from '../data/contract';
import type { RawRow } from '../types';
import { assertNoRowIdentifiers, buildSummary } from './build';
import { ALL_EVENTS, reachableSelections, scopeKey } from './scope';
import type { DashboardSummary } from './types';

const scopeOf = (summary: DashboardSummary, selection = ALL_EVENTS) =>
  summary.scopeData[summary.scopes[scopeKey(selection)]];

function surveyRows(eventId: string, count: number, satisfaction: number) {
  const responses: RawRow[] = [];
  const feedback: RawRow[] = [];
  for (let index = 0; index < count; index += 1) {
    const responseId = `${eventId}-response-${index}`;
    responses.push({
      response_id: responseId,
      event_id: eventId,
      satisfaction,
      recommend: satisfaction,
      experience_segment: '2-3 years',
    });
    feedback.push({
      response_id: responseId,
      event_id: eventId,
      question_role: 'positive',
      text: `${eventId} comment ${index}`,
    });
  }
  return { responses, feedback };
}

function smallAndLargeEvent(): RawDataBundle {
  const large = surveyRows('large', 10, 9);
  const small = surveyRows('small', 2, 3);
  const datasets: RawDatasets = {
    events: [
      {
        event_id: 'large',
        event_name: 'Large event',
        event_date: '2026-01-10',
        format: 'Talk',
        topic_primary: 'Data',
        registered: 30,
        attended: 20,
        year_median_registered: 20,
      },
      {
        event_id: 'small',
        event_name: 'Small event',
        event_date: '2026-02-10',
        format: 'Talk',
        topic_primary: 'Data',
        registered: 5,
        attended: 3,
        year_median_registered: 20,
      },
    ],
    surveyResponses: [...large.responses, ...small.responses],
    feedbackAnswers: [...large.feedback, ...small.feedback],
    registrations: [],
    participants: [],
  };
  return {
    datasets,
    source: {
      sourceLabel: 'Test',
      sourceKind: 'test',
      dataClassification: 'synthetic',
      fetchedAt: new Date('2026-03-01T00:00:00Z'),
      reportingTimezone: 'UTC',
      contractVersion: 1,
      historyStart: null,
      historyEnd: null,
      limitations: [],
    },
  };
}

describe('build-time summary', () => {
  it('publishes no participant or response identifiers', async () => {
    const data = await loadData(createSyntheticAdapter());
    const summary = buildSummary(data);

    expect(() => assertNoRowIdentifiers(summary, data)).not.toThrow();
    const json = JSON.stringify(summary);
    expect(json).not.toMatch(/sample-participant-|sample-response-/);
    expect(json).not.toMatch(/participant_id|response_id/);
  });

  it('refuses to publish a summary that contains a row identifier', async () => {
    const data = await loadData(createSyntheticAdapter());
    const summary = buildSummary(data);
    summary.source.limitations.push(data.responses[0].response_id);

    expect(() => assertNoRowIdentifiers(summary, data)).toThrow(/row identifier/);
  });

  it('leaves survey data from events below the threshold out of every figure', async () => {
    const summary = buildSummary(await loadData({ load: async () => smallAndLargeEvent() }));
    const all = scopeOf(summary).effectiveness;
    const small = scopeOf(summary, { ...ALL_EVENTS, eventId: 'small' }).effectiveness;

    expect(summary.comments.every((comment) => comment.event_id === 'large')).toBe(true);
    expect(all.quadrant.event.points.map((point) => point.id)).toEqual(['large']);
    expect(all.quadrant.topic.points[0]).toMatchObject({ id: 'Data', satisfaction: 9, events: 1 });
    expect(all.kpis.avgSatisfaction).toBe(9);
    expect(all.verdict).toMatchObject({ mean: 9, total: 10 });
    expect(summary.refs.medianSatisfaction).toBe(9);

    expect(small.verdict).toBeNull();
    expect(small.feedbackSafe).toBe(false);
    expect(small.kpis.avgSatisfaction).toBeNull();
    // counts are not suppressed: they reveal how many responded, not what they said
    expect(small.kpis.responses).toBe(2);
    expect(summary.privacy.withheldSurveyEvents).toBe(1);
  });

  it('has a summary for every drill-down the effectiveness chart can open', async () => {
    const summary = buildSummary(await loadData(createSyntheticAdapter()));
    for (const selection of reachableSelections(summary.events)) {
      if (selection.eventId) continue;
      const quadrant = scopeOf(summary, selection).effectiveness.quadrant;
      for (const point of quadrant.topic.points)
        expect(summary.scopes[scopeKey({ ...selection, topic: point.id })]).toBeDefined();
      for (const point of quadrant.format.points)
        expect(summary.scopes[scopeKey({ ...selection, format: point.id })]).toBeDefined();
      for (const point of quadrant.event.points)
        expect(summary.scopes[scopeKey({ ...ALL_EVENTS, eventId: point.id })]).toBeDefined();
    }
  });

  it('shares one computed summary between selections with the same events', async () => {
    const summary = buildSummary(await loadData(createSyntheticAdapter()));
    expect(summary.scopeData.length).toBeLessThan(Object.keys(summary.scopes).length);
  });
});

describe('Google Sheets adapter', () => {
  const tabs = {
    events: 'events',
    surveyResponses: 'survey',
    feedbackAnswers: 'feedback',
    registrations: 'registrations',
    participants: 'participants',
  };

  async function serviceAccountKey() {
    const pair = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    );
    const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
    const body = btoa(String.fromCharCode(...der)).replace(/(.{64})/g, '$1\n');
    return {
      client_email: 'reader@example.iam.gserviceaccount.com',
      private_key: `-----BEGIN ${'PRIVATE KEY'}-----\n${body}\n-----END ${'PRIVATE KEY'}-----\n`,
    };
  }

  it('reads a private sheet through the Sheets API with a service account', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).startsWith('https://oauth2.googleapis.com/token')) {
        expect(String(init?.body)).toContain('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer');
        return Response.json({ access_token: 'token-123' });
      }
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token-123');
      return Response.json({ values: [['event_id', 'event_name'], ['e1', 'Meetup'], [], ['e2']] });
    });
    const adapter = createGoogleSheetsAdapter({
      sheetId: 'sheet-1',
      tabs,
      sourceLabel: 'Sheet',
      reportingTimezone: 'UTC',
      serviceAccountKey: await serviceAccountKey(),
      fetch: fetchMock as typeof fetch,
    });

    const bundle = await adapter.load();
    expect(bundle.datasets.events).toEqual([
      { event_id: 'e1', event_name: 'Meetup' },
      { event_id: 'e2', event_name: '' },
    ]);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/spreadsheets/sheet-1/values/');
  });

  it('warns when falling back to the public link, and explains a private sheet', async () => {
    const warn = vi.fn();
    const fetchMock = vi.fn(
      async () => new Response('<html>Sign in</html>', { headers: { 'content-type': 'text/html' } }),
    );
    const adapter = createGoogleSheetsAdapter({
      sheetId: 'sheet-1',
      tabs,
      sourceLabel: 'Sheet',
      reportingTimezone: 'UTC',
      onWarning: warn,
      fetch: fetchMock as typeof fetch,
    });

    await expect(adapter.load()).rejects.toThrow(/probably private.*GOOGLE_SERVICE_ACCOUNT_KEY/);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/public link/));
  });
});
