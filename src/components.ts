// Shared DOM components: filter bar, KPI cards, sentiment split, feedback table
import { eventsIn, filters, setFilters } from './data';
import { SENTIMENT_COLORS } from './theme';
import { FIELD_LABELS, isNonAnswer } from './sentiment';
import { communityConfig } from './config';
import type { VerdictLabel } from './metrics';
import type { DashboardSummary, SummaryComment, SummaryEvent } from './summary/types';

export interface BoardFilter {
  dim: 'event' | 'topic' | 'format';
  id: string;
  label: string;
}

type SentimentKey = 'positive' | 'neutral' | 'negative';
type SentimentSplit = { counts: Record<SentimentKey, number>; share: Record<SentimentKey, number>; total: number };
type Verdict = { label: VerdictLabel; mean: number; total: number; highShare: number };

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);

export { esc };

// ── filter bar ────────────────────────────────────────────────────────────────
const isText = (value: string | null): value is string => Boolean(value);

export function buildFilterBar(container: HTMLElement, summary: DashboardSummary) {
  const unique = (values: (string | null)[]) => [...new Set(values.filter(isText))];
  const years = unique(summary.events.map((e) => e.year)).sort().reverse();
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
        .map((e) => `<option value="${esc(e.id)}"${filters.eventId === e.id ? ' selected' : ''}>${esc(e.name)}${e.date ? ` (${esc(e.date)})` : ''}</option>`)
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

// ── KPI card ──────────────────────────────────────────────────────────────────
export const kpiCard = (value: string, label: string, sub = '', unit = '') => `
  <div class="card kpi">
    <div class="kpi-value">${value}${unit ? `<span class="unit"> ${unit}</span>` : ''}</div>
    <div class="kpi-label">${esc(label)}</div>
    ${sub ? `<div class="kpi-sub">${esc(sub)}</div>` : ''}
  </div>`;

// ── sentiment split (stat chips + 100% bar) ───────────────────────────────────
export function sentimentSplitHtml(split: SentimentSplit, isSafe = true) {
  if (!isSafe) return '<div class="empty-note">Feedback is hidden for this selection to protect respondent privacy.</div>';
  const { counts, share, total } = split;
  if (!total) return '<div class="empty-note">No feedback in this selection</div>';
  const seg = (k: SentimentKey) =>
    share[k] > 0 ? `<div style="width:${(share[k] * 100).toFixed(1)}%;background:${SENTIMENT_COLORS[k]}" title="${k}: ${counts[k]}"></div>` : '';
  const stat = (k: SentimentKey, name: string) => `
    <div class="senti-stat"><span class="dot" style="background:${SENTIMENT_COLORS[k]}"></span>
      <b>${(share[k] * 100).toFixed(0)}%</b><span>${name} (${counts[k]})</span></div>`;
  return `
    <div class="senti-row">${stat('positive', 'positive')}${stat('neutral', 'neutral')}${stat('negative', 'negative')}</div>
    <div class="split-bar">${seg('positive')}${seg('neutral')}${seg('negative')}</div>
    <div class="table-count">${total} feedback comments</div>`;
}

// ── overall verdict banner ───────────────────────────────────────────────────
// One verdict from the satisfaction rating, not a three-way sentiment split.
const VERDICT_COPY: Record<VerdictLabel, { word: string; gloss: string }> = {
  positive: { word: 'Positive', gloss: 'Attendees rate these events highly.' },
  neutral: { word: 'Mixed', gloss: 'Ratings are middling, read the themes below before repeating the formula.' },
  negative: { word: 'Negative', gloss: 'Ratings are low, treat the themes below as priorities.' },
};

export function verdictBannerHtml(verdict: Verdict | null, scopeLabel: string, isSafe = true) {
  if (!isSafe) {
    return '<div class="verdict-inner"><div class="empty-note">Feedback is hidden for this selection to protect respondent privacy.</div></div>';
  }
  if (!verdict) {
    return `<div class="verdict-inner"><div class="empty-note">No satisfaction ratings in this selection</div></div>`;
  }
  const copy = VERDICT_COPY[verdict.label];
  const satisfaction = communityConfig.ratings.satisfaction;
  return `
    <div class="verdict-inner">
      <div class="verdict-main">
        <span class="verdict-badge ${verdict.label}"><span class="dot"></span>${copy.word}</span>
        <div class="verdict-copy">
          <div class="verdict-gloss">${esc(copy.gloss)}</div>
          <div class="verdict-meta">
            Average satisfaction <b>${verdict.mean.toFixed(1)} / ${satisfaction.max}</b> across
            ${verdict.total.toLocaleString()} rating${verdict.total === 1 ? '' : 's'} for ${esc(scopeLabel)}
            · ${Math.round(verdict.highShare * 100)}% scored ${satisfaction.verdictPositiveMin} or above.
          </div>
        </div>
      </div>
      <div class="verdict-scope" id="verdict-scope"></div>
    </div>`;
}

// ── feedback board: one column per survey question, active filters in the header ──
const FIELD_ORDER = communityConfig.feedbackRoles.map((role) => role.id);

function activeFilterChips(eventsById: Map<string, SummaryEvent>) {
  const chips: [string, string][] = [];
  if (filters.year) chips.push(['Year', filters.year]);
  if (filters.format) chips.push(['Format', filters.format]);
  if (filters.topic) chips.push(['Topic', filters.topic]);
  if (filters.eventId) chips.push(['Event', eventsById.get(filters.eventId)?.name ?? filters.eventId]);
  if (!chips.length) return '<span class="chip filter-chip all">All events</span>';
  return chips.map(([k, v]) => `<span class="chip filter-chip"><b>${esc(k)}:</b> ${esc(v)}</span>`).join('');
}

// `rows` must already be privacy-safe: the build publishes only comments from
// events that met the threshold. `isSafe` is false when the selection has none.
export function renderFeedbackBoard(
  container: HTMLElement,
  rows: SummaryComment[],
  eventsById: Map<string, SummaryEvent>,
  isSafe: boolean,
  boardFilter: BoardFilter | null = null,
  onClearBoardFilter: (() => void) | null = null,
) {
  if (!isSafe) {
    container.innerHTML = '<div class="empty-note">Feedback is hidden for this selection to protect respondent privacy.</div>';
    return;
  }
  const sorted = [...rows].sort((a, b) =>
    (eventsById.get(b.event_id)?.date ?? '').localeCompare(eventsById.get(a.event_id)?.date ?? ''));
  const nonAnswers = sorted.filter((r) => isNonAnswer(r.text)).length;

  const boardChip = boardFilter
    ? `<button type="button" class="chip filter-chip board" title="Clear this filter">
        <b>${esc(boardFilter.dim[0].toUpperCase() + boardFilter.dim.slice(1))}:</b> ${esc(boardFilter.label)} <span aria-hidden="true">&times;</span>
      </button>`
    : '';

  container.innerHTML = `
    <div class="fb-context">
      <div class="fb-context-chips">Showing ${activeFilterChips(eventsById)}${boardChip}</div>
      <label class="fb-toggle"${nonAnswers ? '' : ' hidden'}>
        <input type="checkbox" checked />
        Hide non-answers <span class="table-count">(${nonAnswers})</span>
      </label>
      <input type="search" placeholder="Search feedback…" aria-label="Search feedback" />
      <span class="table-count"></span>
    </div>
    <div class="fb-board">
      ${FIELD_ORDER.map((f) => `
        <section class="fb-col" data-field="${f}">
          <header class="fb-col-head">
            <h4>${esc(FIELD_LABELS[f])}</h4>
            <div class="fb-col-overall"></div>
          </header>
          <div class="fb-col-list"></div>
        </section>`).join('')}
    </div>`;

  const count = container.querySelector<HTMLElement>('.table-count')!;
  const search = container.querySelector<HTMLInputElement>('input[type=search]')!;
  const hideToggle = container.querySelector<HTMLInputElement>('.fb-toggle input')!;

  function draw() {
    const needle = search.value.trim().toLowerCase();
    const hideNon = hideToggle.checked;
    const kept = hideNon ? sorted.filter((r) => !isNonAnswer(r.text)) : sorted;
    const visible = needle
      ? kept.filter((r) => r.text.toLowerCase().includes(needle) || r.event_id.toLowerCase().includes(needle))
      : kept;
    count.textContent = `${visible.length} of ${sorted.length} comments`;

    for (const field of FIELD_ORDER) {
      const col = container.querySelector<HTMLElement>(`.fb-col[data-field="${field}"]`)!;
      const colRows = visible.filter((r) => r.question_role === field);
      const colTotal = sorted.filter((r) => r.question_role === field).length;

      // the header counts, no sentiment verdict: "What was good" is positive by
      // construction, so a chip there would only restate the column name
      col.querySelector<HTMLElement>('.fb-col-overall')!.innerHTML =
        `<span class="table-count">${colRows.length}${colRows.length === colTotal ? '' : ` of ${colTotal}`}</span>`;

      col.querySelector<HTMLElement>('.fb-col-list')!.innerHTML = colRows.length
        ? colRows
            .slice(0, 300)
            .map((r) => {
              const ev = eventsById.get(r.event_id);
              return `<div class="fb-item">
                <div class="fb-item-text">${esc(r.text)}</div>
                <div class="fb-item-meta">${esc(ev?.name ?? r.event_id)} · ${esc(ev?.date ?? '')}</div>
              </div>`;
            })
            .join('')
        : '<div class="empty-note">No comments</div>';
    }
  }
  if (boardFilter && onClearBoardFilter) {
    container.querySelector<HTMLElement>('.chip.filter-chip.board')!.addEventListener('click', onClearBoardFilter);
  }
  search.addEventListener('input', draw);
  hideToggle.addEventListener('change', draw);
  draw();
}
