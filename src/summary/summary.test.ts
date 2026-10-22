import { describe, expect, it, vi } from 'vitest';
import { loadData } from '../data/load';
import { createSyntheticAdapter } from '../data/adapters/synthetic';
import { createGoogleSheetsAdapter } from '../data/adapters/google-sheets';
import type { RawDataBundle, RawDatasets } from '../data/contract';
import type { RawRow } from '../data/types';
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

const showUpRateSource = {
  sourceLabel: 'Test',
  sourceKind: 'test',
  dataClassification: 'synthetic' as const,
  fetchedAt: new Date('2026-03-01T00:00:00Z'),
  reportingTimezone: 'UTC',
  contractVersion: 1 as const,
  historyStart: null,
  historyEnd: null,
  limitations: [] as string[],
};

function showUpRateEvents(
  ...rows: Array<{ id: string; registered: number | null; attended: number | null }>
): RawDataBundle {
  return {
    datasets: {
      events: rows.map((row) => ({
        event_id: row.id,
        event_name: row.id,
        event_date: '2026-01-10',
        format: 'Talk',
        topic_primary: 'Data',
        registered: row.registered,
        attended: row.attended,
        year_median_registered: 20,
      })),
      surveyResponses: [],
      feedbackAnswers: [],
      registrations: [],
      participants: [],
    },
    source: showUpRateSource,
  };
}

// Events with turnout and capacity, each with `respondents` survey answers (10 meets the threshold).
function turnoutEvents(
  ...rows: Array<{
    id: string;
    registered: number | null;
    attended: number | null;
    capacity: number | null;
    respondents?: number;
    topic?: string;
    format?: string;
  }>
): RawDataBundle {
  const surveys = rows.map((row) => surveyRows(row.id, row.respondents ?? 10, 8));
  return {
    datasets: {
      events: rows.map((row) => ({
        event_id: row.id,
        event_name: row.id,
        event_date: '2026-01-10',
        format: row.format ?? 'Workshop',
        topic_primary: row.topic ?? 'Data',
        registered: row.registered,
        attended: row.attended,
        capacity: row.capacity,
        year_median_registered: 20,
      })),
      surveyResponses: surveys.flatMap((survey) => survey.responses),
      feedbackAnswers: surveys.flatMap((survey) => survey.feedback),
      registrations: [],
      participants: [],
    },
    source: showUpRateSource,
  };
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

  it('publishes a paired-event show-up rate for the all-events and single-event scopes', async () => {
    const data = await loadData(createSyntheticAdapter());
    const summary = buildSummary(data);
    const pairedRate = (events: typeof data.events) => {
      const paired = events.filter((row) => row.attended != null && row.registered != null && row.registered > 0);
      if (!paired.length) return null;
      return (
        paired.reduce((sum, row) => sum + row.attended!, 0) / paired.reduce((sum, row) => sum + row.registered!, 0)
      );
    };

    expect(scopeOf(summary).effectiveness.kpis.showUpRate).toBe(pairedRate(data.events));
    for (const event of data.events) {
      expect(scopeOf(summary, { ...ALL_EVENTS, eventId: event.event_id }).effectiveness.kpis.showUpRate).toBe(
        pairedRate([event]),
      );
    }
  });

  //Given one event has registered: 50, attended: null and another event has registered 40, attended: 30
  //When summary built
  //Then showUpRate should be 0.75, and event with null attended should be excluded
  it('excludes events with unknown attendance from both sides of showUpRate', async () => {
    const summary = buildSummary(
      await loadData({
        load: async () =>
          showUpRateEvents(
            { id: 'unknown', registered: 50, attended: null },
            { id: 'known', registered: 40, attended: 30 },
          ),
      }),
    );
    expect(scopeOf(summary).effectiveness.kpis.showUpRate).toBe(0.75);
    expect(scopeOf(summary, { ...ALL_EVENTS, eventId: 'unknown' }).effectiveness.kpis.showUpRate).toBeNull();
    expect(scopeOf(summary, { ...ALL_EVENTS, eventId: 'known' }).effectiveness.kpis.showUpRate).toBe(0.75);
  });

  // Given one event has registered: 0, attended: 0
  // When the summary is built
  // Then showUpRate is null (no showed up phrase, –, 0%, or NaN on the card)
  it('omits showUpRate when registrations are zero', async () => {
    const summary = buildSummary(
      await loadData({
        load: async () => showUpRateEvents({ id: 'empty', registered: 0, attended: 0 }),
      }),
    );
    expect(scopeOf(summary).effectiveness.kpis.showUpRate).toBeNull();
    expect(scopeOf(summary, { ...ALL_EVENTS, eventId: 'empty' }).effectiveness.kpis.showUpRate).toBeNull();
  });

  // Given an event with registered: 50, attended: 52
  // When it is the only event selected
  // Then the sub-line reads 104% showed up · ...
  it('keeps showUpRate above 100% when attendance exceeds registrations', async () => {
    const summary = buildSummary(
      await loadData({
        load: async () => showUpRateEvents({ id: 'walkins', registered: 50, attended: 52 }),
      }),
    );
    expect(scopeOf(summary, { ...ALL_EVENTS, eventId: 'walkins' }).effectiveness.kpis.showUpRate).toBe(1.04);
    expect(scopeOf(summary).effectiveness.kpis.showUpRate).toBe(1.04);
  });

  // Given a topic with two rated events, one missing attendance and capacity
  // When the summary is built
  // Then each rate covers only the event where its inputs are known
  it('computes quadrant turnout and room fill over the events where both inputs are known', async () => {
    const summary = buildSummary(
      await loadData({
        load: async () =>
          turnoutEvents(
            { id: 'full', registered: 40, attended: 30, capacity: 50 },
            { id: 'partial', registered: 60, attended: null, capacity: null },
          ),
      }),
    );
    const { quadrant } = scopeOf(summary).effectiveness;

    expect(quadrant.topic.points[0]).toMatchObject({
      id: 'Data',
      events: 2,
      showUpRate: 0.75,
      showUpEvents: 1,
      fillRate: 0.8,
      capacity: 50,
      fillEvents: 1,
    });
    expect(quadrant.event.points.find((point) => point.id === 'partial')).toMatchObject({
      showUpRate: null,
      showUpEvents: 0,
      fillRate: null,
      capacity: null,
      fillEvents: 0,
    });
  });

  it('pools quadrant turnout and room fill as totals, not an average of event rates', async () => {
    const summary = buildSummary(
      await loadData({
        load: async () =>
          turnoutEvents(
            { id: 'a', registered: 40, attended: 30, capacity: 50 },
            { id: 'b', registered: 20, attended: 10, capacity: 40 },
          ),
      }),
    );
    const workshop = scopeOf(summary).effectiveness.quadrant.format.points[0];

    expect(workshop).toMatchObject({ id: 'Workshop', events: 2, showUpEvents: 2, fillEvents: 2, capacity: 90 });
    expect(workshop.showUpRate).toBeCloseTo(40 / 60); // not (0.75 + 0.5) / 2
    expect(workshop.fillRate).toBeCloseTo(60 / 90); // not (0.8 + 0.5) / 2
  });

  it('leaves zero capacity out of room fill and keeps overbooking above 100%', async () => {
    const summary = buildSummary(
      await loadData({
        load: async () =>
          turnoutEvents(
            { id: 'no-seats', registered: 10, attended: 8, capacity: 0, topic: 'Cloud' },
            { id: 'overbooked', registered: 70, attended: 60, capacity: 60, topic: 'Data' },
          ),
      }),
    );
    const points = scopeOf(summary).effectiveness.quadrant.event.points;

    expect(points.find((point) => point.id === 'no-seats')).toMatchObject({
      showUpRate: 0.8,
      fillRate: null,
      capacity: null,
      fillEvents: 0,
    });
    expect(points.find((point) => point.id === 'overbooked')?.fillRate).toBeCloseTo(70 / 60);
  });

  // Given an event whose survey responses fall below the privacy threshold
  // When the summary is built
  // Then its registered, attended and capacity reach no quadrant point
  it('keeps events withheld for privacy out of quadrant turnout and room fill', async () => {
    const summary = buildSummary(
      await loadData({
        load: async () =>
          turnoutEvents(
            { id: 'rated', registered: 30, attended: 20, capacity: 40 },
            { id: 'withheld', registered: 5, attended: 5, capacity: 5, respondents: 2 },
          ),
      }),
    );

    for (const scope of summary.scopeData) {
      for (const mode of ['event', 'topic', 'format'] as const) {
        for (const point of scope.effectiveness.quadrant[mode].points) {
          expect(point.id).not.toBe('withheld');
          expect(point).toMatchObject({ events: 1, showUpEvents: 1, fillEvents: 1, capacity: 40 });
          expect(point.showUpRate).toBeCloseTo(20 / 30);
          expect(point.fillRate).toBeCloseTo(30 / 40);
        }
      }
    }
    expect(scopeOf(summary, { ...ALL_EVENTS, eventId: 'withheld' }).effectiveness.quadrant.event.points).toEqual([]);
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
