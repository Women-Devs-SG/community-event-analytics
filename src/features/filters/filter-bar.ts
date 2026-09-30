// Filter bar: year, format, topic, and event selects with a reset button.
import { eventsIn } from '../../summary/client';
import type { DashboardSummary } from '../../summary/types';
import { esc } from '../../shared/html';
import { filters, setFilters } from './filter-state';

const isText = (value: string | null): value is string => Boolean(value);

export function buildFilterBar(container: HTMLElement, summary: DashboardSummary) {
  const unique = (values: (string | null)[]) => [...new Set(values.filter(isText))];
  const years = unique(summary.events.map((e) => e.year))
    .sort()
    .reverse();
  const formats = unique(summary.events.map((e) => e.format)).sort();
  const topics = unique(summary.events.map((e) => e.topic)).sort();
  const options = (values: string[]) => values.map((v) => `<option>${esc(v)}</option>`).join('');

  container.innerHTML = `
    <div class="filterbar-inner">
      <div class="filter-group"><label for="f-year">Year</label><select id="f-year"><option value="">All years</option>${options(years)}</select></div>
      <div class="filter-group"><label for="f-format">Format</label><select id="f-format"><option value="">All formats</option>${options(formats)}</select></div>
      <div class="filter-group"><label for="f-topic">Topic</label><select id="f-topic"><option value="">All topics</option>${options(topics)}</select></div>
      <div class="filter-group"><label for="f-event">Event</label><select id="f-event"><option value="">All events</option></select></div>
      <button type="button" class="reset-btn" id="f-reset">Reset filters</button>
    </div>
  `;

  const el = <T extends HTMLElement = HTMLElement>(id: string) => container.querySelector<T>(id)!;
  const eventSelect = el<HTMLSelectElement>('#f-event');

  function refreshEventOptions() {
    // summary.events is already newest first
    const opts = eventsIn(summary, { ...filters, eventId: '' });
    eventSelect.innerHTML =
      '<option value="">All events</option>' +
      opts
        .map(
          (e) =>
            `<option value="${esc(e.id)}"${filters.eventId === e.id ? ' selected' : ''}>${esc(e.name)}${e.date ? ` (${esc(e.date)})` : ''}</option>`,
        )
        .join('');
  }
  refreshEventOptions();

  const onSelect = (id: string, key: 'year' | 'format' | 'topic') =>
    el<HTMLSelectElement>(id).addEventListener('change', (e) => {
      setFilters({ [key]: (e.target as HTMLSelectElement).value, eventId: '' });
      refreshEventOptions();
    });
  onSelect('#f-year', 'year');
  onSelect('#f-format', 'format');
  onSelect('#f-topic', 'topic');
  eventSelect.addEventListener('change', (e) => setFilters({ eventId: (e.target as HTMLSelectElement).value }));
  el('#f-reset').addEventListener('click', () => {
    for (const id of ['#f-year', '#f-format', '#f-topic']) el<HTMLSelectElement>(id).value = '';
    setFilters({ year: '', format: '', topic: '', eventId: '' });
    refreshEventOptions();
  });
}
