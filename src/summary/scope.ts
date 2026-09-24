// A "scope" is one filter selection. The build computes a summary for every
// selection the filter bar can produce, and the browser looks it up by key.
import type { SummaryEvent } from './types';

export interface ScopeSelection {
  year: string;
  format: string;
  topic: string;
  eventId: string;
}

export const ALL_EVENTS: ScopeSelection = { year: '', format: '', topic: '', eventId: '' };

export const scopeKey = (selection: ScopeSelection): string =>
  selection.eventId
    ? JSON.stringify(['event', selection.eventId])
    : JSON.stringify([selection.year, selection.format, selection.topic]);

export const matchesSelection = (event: SummaryEvent, selection: ScopeSelection): boolean => {
  if (selection.eventId) return event.id === selection.eventId;
  if (selection.year && event.year !== selection.year) return false;
  if (selection.format && event.format !== selection.format) return false;
  if (selection.topic && event.topic !== selection.topic) return false;
  return true;
};

// Every selection the filter bar can reach: one per event, plus each
// combination of the event's year, format, and topic (including "all").
export function reachableSelections(events: SummaryEvent[]): ScopeSelection[] {
  const selections = new Map<string, ScopeSelection>([[scopeKey(ALL_EVENTS), ALL_EVENTS]]);
  const add = (selection: ScopeSelection) => selections.set(scopeKey(selection), selection);
  for (const event of events) {
    add({ ...ALL_EVENTS, eventId: event.id });
    for (let mask = 0; mask < 8; mask += 1) {
      const year = mask & 1 ? event.year : '';
      const format = mask & 2 ? event.format : '';
      const topic = mask & 4 ? event.topic : '';
      if (year == null || format == null || topic == null) continue;
      add({ year, format, topic, eventId: '' });
    }
  }
  return [...selections.values()];
}
