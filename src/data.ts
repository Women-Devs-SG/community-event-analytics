// Browser-side data access. In the public modes the dashboard loads only the
// privacy-safe summary produced at build time (see src/summary/) and never sees
// raw rows. In google-signin mode, src/summary/live.ts builds the same summary
// in the browser from rows the Apps Script returns to a signed-in viewer.
import { SignInDataError } from './data/adapters/apps-script';
import { DataContractError, formatDataContractError } from './data/contract';
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
    throw new SummaryLoadError(
      `The dashboard data is missing (HTTP ${response.status}). Run "npm run summary" locally, or check that the deployment built it.`,
    );
  }
  const summary = (await response.json()) as DashboardSummary;
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

export function formatSignInError(error: unknown, email: string): string {
  if (error instanceof SignInDataError) {
    if (error.code === 'not_authorized') {
      return `${email || 'This Google account'} doesn't have access. Ask an organiser to share the reporting sheet with this account, or sign in with another account.`;
    }
    if (error.code === 'invalid_token') return 'Your sign-in expired or could not be verified. Please sign in again.';
    return error.message;
  }
  if (error instanceof DataContractError) return formatDataContractError(error);
  if (error instanceof Error && /timezone|not configured/i.test(error.message)) return error.message;
  return 'The dashboard data could not be loaded. Please try again.';
}
