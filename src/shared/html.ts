// HTML helpers shared by the dashboards and features: escaping and KPI cards.
const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);

export { esc };

// ── KPI card ──────────────────────────────────────────────────────────────────
export const kpiCard = (value: string, label: string, sub = '', unit = '') => `
  <div class="card kpi">
    <div class="kpi-value">${value}${unit ? `<span class="unit"> ${unit}</span>` : ''}</div>
    <div class="kpi-label">${esc(label)}</div>
    ${sub ? `<div class="kpi-sub">${esc(sub)}</div>` : ''}
  </div>`;
