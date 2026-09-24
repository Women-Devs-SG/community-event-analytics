// Turns the full, validated source data into the privacy-safe summary the
// browser loads. Runs at build time only. Everything published here is either
// event metadata, an aggregate that met the privacy threshold, or a free-text
// answer from an event with enough respondents.
import { communityConfig } from '../config';
import type { SegmentId } from '../config';
import { median } from '../data/load';
import {
  kpisCommunity, kpisEffectiveness, quadrantPoints, satisfactionVerdict,
  outcomeByYoe, distributionByYoe, returningBySegment,
} from '../metrics';
import type { QuadrantMode } from '../metrics';
import { disclosureGroups, isDisclosureSafe, minimumSegmentSize, protectedCrossTab } from '../privacy';
import type { DisclosureGroup, ProtectedCrossTab } from '../privacy';
import type { DashboardData, DataSlice, EventRecord, FeedbackRecord, RegistrationRecord, ResponseRecord } from '../types';
import { reachableSelections, scopeKey, matchesSelection } from './scope';
import { scoreFeedback } from './sentiment-score';
import { SUMMARY_VERSION } from './types';
import type {
  CommunityScope, CountGroup, CrossTabGroup, DashboardSummary, EffectivenessScope,
  ScopeSummary, SegDim, SummaryComment, SummaryEvent,
} from './types';

const QUADRANT_MODES: QuadrantMode[] = ['event', 'topic', 'format'];

// ── participant attribute helpers (registration grain) ───────────────────────
const excludedOrganisations = new Set(communityConfig.privacy.excludedOrganisations.map((name) => name.toLowerCase()));
const segmentValue = (row: RegistrationRecord, id: SegmentId): string => {
  const segment = communityConfig.segments[id];
  return row[segment.registrationField] ?? segment.unknownLabel;
};
const isCommunityStaff = (r: RegistrationRecord) => excludedOrganisations.has(segmentValue(r, 'organization').trim().toLowerCase());
const experienceOf = (r: RegistrationRecord) => segmentValue(r, 'experience');
const genderOf = (r: RegistrationRecord) => segmentValue(r, 'gender');
const participantIdOf = (r: RegistrationRecord) => r.participant_id;
const SEGMENT_KEYS: Record<SegDim, (r: RegistrationRecord) => string> = {
  yoe: experienceOf,
  gender: genderOf,
  jobfam: (r) => segmentValue(r, 'jobFamily'),
  sector: (r) => segmentValue(r, 'sector'),
  org: (r) => segmentValue(r, 'organization'),
};
const surveyBucketOf = (r: ResponseRecord) => r.experience_segment ?? 'Not stated';

const countGroups = <T>(groups: DisclosureGroup<T>[]): CountGroup[] => groups.map(({ key, count }) => ({ key, count }));
const crossTabGroups = <T>(groups: ProtectedCrossTab<T>[]): CrossTabGroup[] =>
  groups.map(({ key, count, children }) => ({ key, count, children: countGroups(children) }));

const distinctCount = <T>(rows: T[], keyFor: (row: T) => string) => new Set(rows.map(keyFor)).size;

// Survey data is published per event only when the event itself met the
// threshold. Otherwise a small event's ratings or comments could be recovered by
// comparing two selections that differ only by that event, or simply read off
// the event label shown beside each comment.
function eventsMeetingThreshold<T extends { event_id: string; response_id: string }>(rows: T[]): Set<string> {
  const respondents = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = respondents.get(row.event_id) ?? new Set<string>();
    set.add(row.response_id);
    respondents.set(row.event_id, set);
  }
  return new Set([...respondents].filter(([, set]) => isDisclosureSafe(set.size)).map(([eventId]) => eventId));
}

const summaryEvent = (event: EventRecord): SummaryEvent => ({
  id: event.event_id,
  name: event.event_name.replace(/_/g, ' '),
  date: event.date ? event.event_date : null,
  year: event.date ? event.event_date.slice(0, 4) : null,
  format: event.format,
  topic: event.topic_primary,
});

export function buildSummary(data: DashboardData): DashboardSummary {
  const ratingEvents = eventsMeetingThreshold(data.responses);
  const commentEvents = eventsMeetingThreshold(data.feedback);
  const ratedResponses = data.responses.filter((r) => ratingEvents.has(r.event_id));
  const safeSatByEvent = new Map([...data.satByEvent].filter(([eventId]) => ratingEvents.has(eventId)));

  const publishedFeedback = data.feedback.filter((r) => commentEvents.has(r.event_id));
  const comments: SummaryComment[] = publishedFeedback.map((row) => ({
    event_id: row.event_id,
    question_role: row.question_role,
    text: row.text,
    label: scoreFeedback(row).label,
  }));
  const commentIndex = new Map<FeedbackRecord, number>(publishedFeedback.map((row, index) => [row, index]));
  const bucketByResponse = new Map(data.responses.map((r) => [r.response_id, surveyBucketOf(r)]));

  const events = data.events.map(summaryEvent);

  function effectivenessScope(slice: DataSlice, rated: DataSlice, feedback: FeedbackRecord[]): EffectivenessScope {
    const all = kpisEffectiveness(slice);
    const ratedKpis = kpisEffectiveness(rated);
    return {
      kpis: {
        uniqueEvents: all.uniqueEvents,
        avgSatisfaction: ratedKpis.avgSatisfaction,
        responseRate: all.responseRate,
        responses: all.responses,
        totalAttended: all.totalAttended,
        totalRegistered: all.totalRegistered,
        returningRate: isDisclosureSafe(all.returningPopulation) ? all.returningRate : null,
        hotTopic: all.hotTopic,
      },
      quadrant: Object.fromEntries(QUADRANT_MODES.map((mode) => [mode, quadrantPoints(rated, safeSatByEvent, mode)])) as EffectivenessScope['quadrant'],
      verdict: satisfactionVerdict(rated.responses),
      feedbackSafe: feedback.length > 0,
    };
  }

  function communityScope(slice: DataSlice, rated: DataSlice, feedback: FeedbackRecord[]): CommunityScope {
    const people: DataSlice = { ...slice, registrations: slice.registrations.filter((r) => !isCommunityStaff(r)) };
    const regs = people.registrations;
    const k = kpisCommunity(people);
    const gender = disclosureGroups(regs, genderOf, participantIdOf);
    const sectors = disclosureGroups(regs, SEGMENT_KEYS.sector, participantIdOf);
    const jobFamilies = disclosureGroups(regs, SEGMENT_KEYS.jobfam, participantIdOf);
    const topSector = sectors.hasUnsafeRemainder ? null : [...sectors.groups].sort((a, b) => b.count - a.count)[0] ?? null;

    const surveyBuckets: Record<string, number[]> = {};
    const byBucket = new Map<string, FeedbackRecord[]>();
    for (const row of feedback) {
      const bucket = bucketByResponse.get(row.response_id) ?? 'Not stated';
      byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), row]);
    }
    for (const [bucket, rows] of byBucket) {
      if (isDisclosureSafe(distinctCount(rows, (row) => row.response_id))) surveyBuckets[bucket] = rows.map((row) => commentIndex.get(row)!);
    }

    return {
      coveredEvents: distinctCount(regs, (r) => r.event_id),
      eventsInView: slice.events.length,
      kpis: {
        uniquePeople: isDisclosureSafe(k.uniquePeople) ? k.uniquePeople : null,
        returningRate: isDisclosureSafe(k.returningPopulation) ? k.returningRate : null,
        topSector: topSector ? { key: topSector.key, count: topSector.count } : null,
        gender: !gender.hasUnsafeRemainder && gender.groups.length ? countGroups(gender.groups) : null,
      },
      experienceByGender: crossTabGroups(protectedCrossTab(regs, experienceOf, genderOf, participantIdOf)),
      topicByGender: crossTabGroups(protectedCrossTab(regs, (r) => data.eventsById.get(r.event_id)?.topic_primary ?? 'Not stated', genderOf, participantIdOf)),
      jobFamilies: jobFamilies.hasUnsafeRemainder ? null : countGroups(jobFamilies.groups),
      sectors: sectors.hasUnsafeRemainder ? null : countGroups(sectors.groups),
      segments: {
        return: Object.fromEntries(
          (Object.keys(SEGMENT_KEYS) as SegDim[]).map((dim) => [dim, returningBySegment(people, SEGMENT_KEYS[dim]).filter((row) => isDisclosureSafe(row.n))]),
        ) as CommunityScope['segments']['return'],
        sat: distributionByYoe(rated).filter((row) => isDisclosureSafe(row.n)),
        rec: outcomeByYoe(rated, 'recommend').filter((row) => isDisclosureSafe(row.n)),
      },
      surveyBuckets,
    };
  }

  function scopeSummary(eventIds: Set<string>): ScopeSummary {
    const inScope = (row: { event_id: string }) => eventIds.has(row.event_id);
    const slice: DataSlice = {
      events: data.events.filter((event) => eventIds.has(event.event_id)),
      responses: data.responses.filter(inScope),
      feedback: data.feedback.filter(inScope),
      registrations: data.registrations.filter(inScope),
    };
    const rated: DataSlice = { ...slice, responses: ratedResponses.filter(inScope) };
    const feedback = publishedFeedback.filter(inScope);
    return {
      effectiveness: effectivenessScope(slice, rated, feedback),
      community: communityScope(slice, rated, feedback),
    };
  }

  // Selections that contain the same events share one computed summary.
  const scopes: Record<string, number> = {};
  const scopeData: ScopeSummary[] = [];
  const bySignature = new Map<string, number>();
  for (const selection of reachableSelections(events)) {
    const ids = events.filter((event) => matchesSelection(event, selection)).map((event) => event.id);
    const signature = ids.join('\u0000');
    let index = bySignature.get(signature);
    if (index == null) {
      index = scopeData.push(scopeSummary(new Set(ids))) - 1;
      bySignature.set(signature, index);
    }
    scopes[scopeKey(selection)] = index;
  }

  const withheldSurveyEvents = new Set(
    [...data.responses, ...data.feedback].map((r) => r.event_id).filter((id) => !ratingEvents.has(id) || !commentEvents.has(id)),
  ).size;
  const limitations = [...data.source.limitations];
  if (withheldSurveyEvents) {
    limitations.push(
      `Survey ratings or comments from ${withheldSurveyEvents} ${withheldSurveyEvents === 1 ? 'event' : 'events'} with fewer than ${minimumSegmentSize()} respondents are left out of every figure.`,
    );
  }

  return {
    version: SUMMARY_VERSION,
    generatedAt: data.fetchedAt.toISOString(),
    source: {
      label: data.source.sourceLabel,
      kind: data.source.sourceKind,
      classification: data.source.dataClassification,
      reportingTimezone: data.source.reportingTimezone,
      historyStart: data.source.historyStart,
      historyEnd: data.source.historyEnd,
      limitations,
    },
    privacy: { minimumSegmentSize: minimumSegmentSize(), withheldSurveyEvents },
    refs: { medianDemand: data.refs.medianDemand, medianSatisfaction: median([...safeSatByEvent.values()]) },
    events: [...events].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
    comments,
    scopes,
    scopeData,
  };
}

// Last line of defence: fail the build if a participant or response ID from the
// source appears anywhere in the published summary.
export function assertNoRowIdentifiers(summary: DashboardSummary, data: DashboardData) {
  const published = new Set<string>();
  const walk = (value: unknown) => {
    if (typeof value === 'string') published.add(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.entries(value).forEach(([key, child]) => { published.add(key); walk(child); });
  };
  walk(summary);
  const identifiers = [
    ...data.registrations.map((r) => r.participant_id),
    ...data.persons.keys(),
    ...data.responses.map((r) => r.response_id),
  ];
  const leaked = identifiers.filter((id) => id && published.has(id));
  if (leaked.length) throw new Error(`The summary contains ${new Set(leaked).size} row identifier(s) from the source; refusing to publish it.`);
}
