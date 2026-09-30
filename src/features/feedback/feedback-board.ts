// Feedback components: sentiment split and the per-question feedback board.
import { SENTIMENT_COLORS } from '../../shared/chart-theme';
import { esc } from '../../shared/html';
import { FIELD_LABELS, isNonAnswer } from './themes';
import { communityConfig } from '../../config';
import type { ScopeSelection } from '../../summary/scope';
import type { SummaryComment, SummaryEvent } from '../../summary/types';

export interface BoardFilter {
  dim: 'event' | 'topic' | 'format';
  id: string;
  label: string;
}

type SentimentKey = 'positive' | 'neutral' | 'negative';
type SentimentSplit = { counts: Record<SentimentKey, number>; share: Record<SentimentKey, number>; total: number };

// ── sentiment split (stat chips + 100% bar) ───────────────────────────────────
export function sentimentSplitHtml(split: SentimentSplit, isSafe = true) {
  if (!isSafe)
    return '<div class="empty-note">Feedback is hidden for this selection to protect respondent privacy.</div>';
  const { counts, share, total } = split;
  if (!total) return '<div class="empty-note">No feedback in this selection</div>';
  const seg = (k: SentimentKey) =>
    share[k] > 0
      ? `<div style="width:${(share[k] * 100).toFixed(1)}%;background:${SENTIMENT_COLORS[k]}" title="${k}: ${counts[k]}"></div>`
      : '';
  const stat = (k: SentimentKey, name: string) => `
    <div class="senti-stat"><span class="dot" style="background:${SENTIMENT_COLORS[k]}"></span>
      <b>${(share[k] * 100).toFixed(0)}%</b><span>${name} (${counts[k]})</span></div>`;
  return `
    <div class="senti-row">${stat('positive', 'positive')}${stat('neutral', 'neutral')}${stat('negative', 'negative')}</div>
    <div class="split-bar">${seg('positive')}${seg('neutral')}${seg('negative')}</div>
    <div class="table-count">${total} feedback comments</div>`;
}

// ── feedback board: one column per survey question, active filters in the header ──
const FIELD_ORDER = communityConfig.feedbackRoles.map((role) => role.id);

function activeFilterChips(selection: ScopeSelection, eventsById: Map<string, SummaryEvent>) {
  const chips: [string, string][] = [];
  if (selection.year) chips.push(['Year', selection.year]);
  if (selection.format) chips.push(['Format', selection.format]);
  if (selection.topic) chips.push(['Topic', selection.topic]);
  if (selection.eventId) chips.push(['Event', eventsById.get(selection.eventId)?.name ?? selection.eventId]);
  if (!chips.length) return '<span class="chip filter-chip all">All events</span>';
  return chips.map(([k, v]) => `<span class="chip filter-chip"><b>${esc(k)}:</b> ${esc(v)}</span>`).join('');
}

// `rows` must already be privacy-safe: the build publishes only comments from
// events that met the threshold. `isSafe` is false when the selection has none.
// `selection` is the active filter selection, shown as chips in the header.
export function renderFeedbackBoard(
  container: HTMLElement,
  rows: SummaryComment[],
  eventsById: Map<string, SummaryEvent>,
  selection: ScopeSelection,
  isSafe: boolean,
  boardFilter: BoardFilter | null = null,
  onClearBoardFilter: (() => void) | null = null,
) {
  if (!isSafe) {
    container.innerHTML =
      '<div class="empty-note">Feedback is hidden for this selection to protect respondent privacy.</div>';
    return;
  }
  const sorted = [...rows].sort((a, b) =>
    (eventsById.get(b.event_id)?.date ?? '').localeCompare(eventsById.get(a.event_id)?.date ?? ''),
  );
  const nonAnswers = sorted.filter((r) => isNonAnswer(r.text)).length;

  const boardChip = boardFilter
    ? `<button type="button" class="chip filter-chip board" title="Clear this filter">
        <b>${esc(boardFilter.dim[0].toUpperCase() + boardFilter.dim.slice(1))}:</b> ${esc(boardFilter.label)} <span aria-hidden="true">&times;</span>
      </button>`
    : '';

  container.innerHTML = `
    <div class="fb-context">
      <div class="fb-context-chips">Showing ${activeFilterChips(selection, eventsById)}${boardChip}</div>
      <label class="fb-toggle"${nonAnswers ? '' : ' hidden'}>
        <input type="checkbox" checked />
        Hide non-answers <span class="table-count">(${nonAnswers})</span>
      </label>
      <input type="search" placeholder="Search feedback…" aria-label="Search feedback" />
      <span class="table-count"></span>
    </div>
    <div class="fb-board">
      ${FIELD_ORDER.map(
        (f) => `
        <section class="fb-col" data-field="${f}">
          <header class="fb-col-head">
            <h4>${esc(FIELD_LABELS[f])}</h4>
            <div class="fb-col-overall"></div>
          </header>
          <div class="fb-col-list"></div>
        </section>`,
      ).join('')}
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
