// Browser-side data access. The dashboard only ever loads the privacy-safe
// summary produced at build time (see src/summary/); it never sees raw rows.
import { matchesSelection, scopeKey } from './summary/scope';
import type { ScopeSelection } from './summary/scope';
import { SUMMARY_FILE, SUMMARY_VERSION } from './summary/types';
import type { DashboardSummary, ScopeSummary, SummaryComment, SummaryEvent } from './summary/types';

export type DashboardFilters = ScopeSelection;

export const filters: DashboardFilters = { year: '', format: '', topic: '', eventId: '' };
const listeners = new Set<(filters: DashboardFilters) => void>();

export const onFilterChange = (listener: (filters: DashboardFilters) => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function setFilters(patch: Partial<DashboardFilters>) {
  Object.assign(filters, patch);
  listeners.forEach((listener) => listener(filters));
}

export class SummaryLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SummaryLoadError';
  }
}

export async function loadSummary(): Promise<DashboardSummary> {
  let response: Response;
  try {
    response = await fetch(`./${SUMMARY_FILE}`, { cache: 'no-cache' });
  } catch {
    throw new SummaryLoadError('The dashboard data could not be downloaded. Check your connection and reload.');
  }
  if (!response.ok) {
    throw new SummaryLoadError(`The dashboard data is missing (HTTP ${response.status}). Run "npm run summary" locally, or check that the deployment built it.`);
  }
  const summary = await response.json() as DashboardSummary;
  if (summary.version !== SUMMARY_VERSION) {
    throw new SummaryLoadError('The dashboard data was built by a different version of this app. Rebuild the site.');
  }
  return summary;
}

export const formatLoadError = (error: unknown): string =>
  error instanceof SummaryLoadError ? error.message : 'The dashboard data could not be loaded.';

// The summary for a filter selection, or null when no event matches it.
export function scopeFor(summary: DashboardSummary, selection: ScopeSelection = filters): ScopeSummary | null {
  const index = summary.scopes[scopeKey(selection)];
  return index == null ? null : summary.scopeData[index];
}

export const eventsIn = (summary: DashboardSummary, selection: ScopeSelection = filters): SummaryEvent[] =>
  summary.events.filter((event) => matchesSelection(event, selection));

export const commentsFor = (summary: DashboardSummary, events: SummaryEvent[]): SummaryComment[] => {
  const ids = new Set(events.map((event) => event.id));
  return summary.comments.filter((comment) => ids.has(comment.event_id));
};
