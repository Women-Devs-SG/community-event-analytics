// The filter selection shared by the filter bar and both dashboards.
import type { ScopeSelection } from '../../summary/scope';

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
