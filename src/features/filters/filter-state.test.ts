import { afterEach, describe, expect, it, vi } from 'vitest';
import { filters, onFilterChange, setFilters } from './filter-state';

describe('filter state', () => {
  afterEach(() => setFilters({ year: '', format: '', topic: '', eventId: '' }));

  it('merges a partial selection and notifies listeners with the full selection', () => {
    const listener = vi.fn();
    const unsubscribe = onFilterChange(listener);
    setFilters({ year: '2025', eventId: 'e1' });
    setFilters({ topic: 'AI' });
    unsubscribe();

    expect(filters).toEqual({ year: '2025', format: '', topic: 'AI', eventId: 'e1' });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(filters);
  });

  it('stops notifying a listener after it unsubscribes', () => {
    const listener = vi.fn();
    onFilterChange(listener)();
    setFilters({ format: 'Workshop' });
    expect(listener).not.toHaveBeenCalled();
  });
});
