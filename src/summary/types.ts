// The only data the browser ever receives. It is produced at build time by
// src/summary/build.ts from the full source data, after the privacy rules have
// been applied. It must never contain participant IDs, response IDs, or any
// other row-level record from the source.
import type { DataClassification } from '../types';
import type { DistributionRow, OutcomeRow, QuadrantMode, QuadrantPoint, ReturningRow } from '../metrics';
import type { SentimentLabel } from '../sentiment';

export const SUMMARY_VERSION = 1;
export const SUMMARY_FILE = 'dashboard-summary.json';

export type SegDim = 'yoe' | 'gender' | 'jobfam' | 'sector' | 'org';

export interface SummaryEvent {
  id: string;
  name: string;
  date: string | null;
  year: string | null;
  format: string | null;
  topic: string | null;
}

// A free-text answer from an event that met the privacy threshold. Response IDs
// are deliberately omitted so answers from one respondent cannot be linked.
export interface SummaryComment {
  event_id: string;
  question_role: string;
  text: string;
  label: SentimentLabel;
}

export interface CountGroup {
  key: string;
  count: number;
}

export interface CrossTabGroup extends CountGroup {
  children: CountGroup[];
}

export interface Verdict {
  label: SentimentLabel;
  mean: number;
  total: number;
  highShare: number;
}

export interface EffectivenessScope {
  kpis: {
    uniqueEvents: number;
    avgSatisfaction: number | null;
    responseRate: number | null;
    responses: number;
    totalAttended: number | null;
    totalRegistered: number | null;
    returningRate: number | null;
    hotTopic: [string, number] | null;
  };
  quadrant: Record<QuadrantMode, { points: QuadrantPoint[]; skipped: number }>;
  /** Null when the selection has no survey data that meets the privacy threshold. */
  verdict: Verdict | null;
  feedbackSafe: boolean;
}

export interface CommunityScope {
  coveredEvents: number;
  eventsInView: number;
  kpis: {
    uniquePeople: number | null;
    returningRate: number | null;
    topSector: CountGroup | null;
    gender: CountGroup[] | null;
  };
  experienceByGender: CrossTabGroup[];
  topicByGender: CrossTabGroup[];
  jobFamilies: CountGroup[] | null;
  sectors: CountGroup[] | null;
  segments: {
    return: Record<SegDim, ReturningRow[]>;
    sat: DistributionRow[];
    rec: OutcomeRow[];
  };
  /** Comment indexes per survey experience bucket, only for buckets that meet the threshold. */
  surveyBuckets: Record<string, number[]>;
}

export interface ScopeSummary {
  effectiveness: EffectivenessScope;
  community: CommunityScope;
}

export interface DashboardSummary {
  version: typeof SUMMARY_VERSION;
  generatedAt: string;
  source: {
    label: string;
    kind: string;
    classification: DataClassification;
    reportingTimezone: string;
    historyStart: string | null;
    historyEnd: string | null;
    limitations: string[];
  };
  privacy: {
    minimumSegmentSize: number;
    /** Events whose survey ratings and comments were withheld for having too few responses. */
    withheldSurveyEvents: number;
  };
  refs: { medianDemand: number | null; medianSatisfaction: number | null };
  events: SummaryEvent[];
  comments: SummaryComment[];
  /** Filter selection key → index into scopeData. Identical selections share one entry. */
  scopes: Record<string, number>;
  scopeData: ScopeSummary[];
}
