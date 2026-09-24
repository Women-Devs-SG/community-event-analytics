// Dashboard 2, Community profile
import * as echarts from 'echarts';
import { C, baseAxis, baseTooltip, baseChart, GENDER_ORDER, GENDER_COLORS, SECTOR_ORDER, SECTOR_COLORS, SEQ_BLUE, indexOfOrLast } from './theme';
import type { ChartParams } from './theme';
import { scopeFor } from './data';
import { fmtPct, fmtNum, fmtInt, YOE_ORDER, SURVEY_YOE_ORDER } from './metrics';
import { sentimentSplit } from './sentiment';
import { kpiCard, sentimentSplitHtml, renderFeedbackBoard, esc } from './components';
import { communityConfig } from './config';
import type { CommunityScope, CrossTabGroup, DashboardSummary, SegDim } from './summary/types';
import type { DashboardController } from './types';

type SegOutcome = 'return' | 'sat' | 'rec';

// One row of the segment x outcome chart. Which outcome fields are present
// depends on the selected outcome; `bucket` and `n` are always there.
interface SegRow {
  bucket: string;
  n: number;
  rate?: number | null;
  promoters?: number;
  passives?: number;
  detractors?: number;
  avg?: number;
}

const genderColors: Record<string, string> = GENDER_COLORS;
const sectorColors: Record<string, string> = SECTOR_COLORS;

const ORG_NOISE = new Set(['other', 'na', 'n/a', '-', 'nil', 'unknown', 'none', '']);

const terms = communityConfig.terminology;
const segments = communityConfig.segments;
const satisfaction = communityConfig.ratings.satisfaction;
const recommendation = communityConfig.ratings.recommendation;

export function initCommunity(root: HTMLElement, summary: DashboardSummary): DashboardController {
  const q = <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const eventsById = new Map(summary.events.map((event) => [event.id, event]));
  root.innerHTML = `
    <div class="status" id="comm-empty" hidden>No ${esc(terms.events)} match the current filters.</div>
    <div id="comm-body">
    <div class="kpi-row" id="comm-kpis"></div>

    <h2 class="section-title">Who we're reaching</h2>
    <p class="section-note" id="comm-coverage">Participant attributes for the current filters.</p>
    <div class="grid-2">
      <div class="card chart-card">
        <h3>${esc(segments.experience.label)}</h3>
        <div class="card-sub">Ordered by configured category order, split by ${esc(segments.gender.shortLabel.toLowerCase())}.</div>
        <div class="chart short" id="yoe-chart"></div>
      </div>
      <div class="card chart-card">
        <h3>${esc(segments.gender.label)} mix by topic</h3>
        <div class="card-sub">How topics differ by ${esc(segments.gender.shortLabel.toLowerCase())}, as a share of ${esc(terms.registrations)}.</div>
        <div class="chart short" id="topic-gender-chart"></div>
      </div>
      <div class="card chart-card">
        <h3>${esc(segments.jobFamily.label)}</h3>
        <div class="card-sub">Configured participant categories. Area = number of ${esc(terms.registrations)}.</div>
        <div class="chart" id="jobfam-chart"></div>
      </div>
      <div class="card chart-card">
        <h3>${esc(segments.sector.label)}</h3>
        <div class="card-sub">Reported at registration, as a share of all ${esc(terms.registrations)}.</div>
        <div class="chart" id="sector-chart" style="height:120px"></div>
        <div id="sector-legend"></div>
      </div>
    </div>

    <h2 class="section-title">Segment × outcome</h2>
    <p class="section-note" id="seg-note"></p>
    <div class="card chart-card">
      <div class="seg-controls">
        <div class="toggle-group"><span class="toggle-group-label">Segment</span>
          <div class="toggle-row" id="seg-toggle">
            <button class="toggle-chip active" data-dim="yoe">${esc(segments.experience.shortLabel)}</button>
            <button class="toggle-chip" data-dim="gender">${esc(segments.gender.shortLabel)}</button>
            <button class="toggle-chip" data-dim="jobfam">${esc(segments.jobFamily.shortLabel)}</button>
            <button class="toggle-chip" data-dim="sector">${esc(segments.sector.shortLabel)}</button>
            <button class="toggle-chip" data-dim="org">${esc(segments.organization.shortLabel)}</button>
          </div>
        </div>
        <div class="toggle-group"><span class="toggle-group-label">Outcome</span>
          <div class="toggle-row" id="outcome-toggle">
            <button class="toggle-chip active" data-out="return">Returning rate</button>
            <button class="toggle-chip" data-out="sat">Satisfaction mix</button>
            <button class="toggle-chip" data-out="rec">Recommend score</button>
          </div>
        </div>
      </div>
      <div class="chart" id="seg-chart"></div>
    <div class="table-count" id="seg-hint">Small segments are hidden according to the configured privacy threshold.</div>
    </div>
    <div class="grid-2">
      <div class="card chart-card span-2" id="seg-fb-card" hidden>
        <div class="seg-fb-head">
          <h3>Survey feedback from <span id="seg-sel-label"></span></h3>
          <button class="clear-btn" id="seg-clear" aria-label="Clear segment selection">✕ Clear</button>
        </div>
        <div class="card-sub">Free-text answers from responses in this experience bracket only. Directly attributed, nothing inferred.</div>
        <div id="seg-senti"></div>
        <div id="seg-fb-table"></div>
      </div>
    </div>
    </div>`;

  const yoeChart = echarts.init(q('#yoe-chart'));
  const topicGenderChart = echarts.init(q('#topic-gender-chart'));
  const jobfamChart = echarts.init(q('#jobfam-chart'));
  const sectorChart = echarts.init(q('#sector-chart'));
  const segChart = echarts.init(q('#seg-chart'));
  const donutEl = () => q('#gender-donut');
  let donutChart: echarts.ECharts | null = null;

  let segDim: SegDim = 'yoe';
  let segOutcome: SegOutcome = 'return';
  let segSelection: { bucket: string } | null = null;
  let scope: CommunityScope | null = null;

  const responseSegmentLabel = segments.experience.label;
  // Survey outcomes are attributable only to the response-level segment configured by this version.
  const validCombo = (dim: string | undefined, out: string | undefined) => out === 'return' || dim === 'yoe';

  function refreshChipStates() {
    root.querySelectorAll<HTMLElement>('#seg-toggle .toggle-chip').forEach((b) => {
      const off = !validCombo(b.dataset.dim, segOutcome);
      b.classList.toggle('disabled', off);
      b.title = off ? `The survey only records ${responseSegmentLabel.toLowerCase()}; pick Returning rate to use this segment` : '';
    });
    root.querySelectorAll<HTMLElement>('#outcome-toggle .toggle-chip').forEach((b) => {
      const off = !validCombo(segDim, b.dataset.out);
      b.classList.toggle('disabled', off);
      b.title = off ? `Survey answers can only be attributed by ${responseSegmentLabel.toLowerCase()}` : '';
    });
  }

  q('#seg-toggle').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('button[data-dim]');
    if (!btn || btn.classList.contains('disabled')) return;
    segDim = btn.dataset.dim as SegDim;
    segSelection = null;
    root.querySelectorAll('#seg-toggle .toggle-chip').forEach((b) => b.classList.toggle('active', b === btn));
    drawSegment();
    drawSegmentFeedback();
  });
  q('#outcome-toggle').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('button[data-out]');
    if (!btn || btn.classList.contains('disabled')) return;
    segOutcome = btn.dataset.out as SegOutcome;
    segSelection = null;
    root.querySelectorAll('#outcome-toggle .toggle-chip').forEach((b) => b.classList.toggle('active', b === btn));
    drawSegment();
    drawSegmentFeedback();
  });

  // feedback drill-down only where it's directly attributable: survey outcomes carry
  // years_exp on each response, everything else is anonymous, so no feedback opens
  const canDrill = () => segDim === 'yoe' && segOutcome !== 'return';

  segChart.on('click', (p) => {
    if (!canDrill()) return;
    // published rows already meet the privacy threshold
    if (!segmentRows().some((candidate) => candidate.bucket === p.name)) return;
    segSelection = { bucket: p.name };
    drawSegmentFeedback();
  });
  q('#seg-clear').addEventListener('click', () => {
    segSelection = null;
    drawSegmentFeedback();
  });

  function drawKpis() {
    const k = scope!.kpis;
    const gender = k.gender ?? [];
    const safeGender = gender.length > 0;
    const genderTotal = gender.reduce((total, group) => total + group.count, 0) || 1;
    q('#comm-kpis').innerHTML = [
      kpiCard(k.uniquePeople != null ? fmtInt(k.uniquePeople) : 'Hidden', `Unique ${terms.participants}`, k.uniquePeople != null ? 'distinct de-identified participant keys' : 'Selection is below the privacy threshold'),
      `<div class="card kpi"><div class="kpi-label" style="margin-top:0">${esc(segments.gender.label)} mix</div>${safeGender ? '<div id="gender-donut" style="height:110px"></div>' : '<div class="empty-note">Hidden to protect privacy</div>'}</div>`,
      kpiCard(k.returningRate != null ? fmtPct(k.returningRate) : 'Hidden', 'Returning rate', k.returningRate != null ? `share of ${terms.participants} who registered for another ${terms.event}` : 'Selection is below the privacy threshold'),
      kpiCard(k.topSector ? esc(k.topSector.key) : 'Hidden', `Largest ${segments.sector.shortLabel.toLowerCase()}`, k.topSector ? `${fmtInt(k.topSector.count)} ${terms.registrations}` : 'Segment totals would reveal a small group'),
    ].join('');

    donutChart?.dispose();
    if (!safeGender) return;
    donutChart = echarts.init(donutEl());
    const gData = gender.map((group) => ({
      name: group.key, value: group.count, itemStyle: { color: genderColors[group.key] ?? C.notStated },
    }));
    donutChart.setOption({
      ...baseChart,
      tooltip: { ...baseTooltip, formatter: (p: ChartParams) => `${esc(p.name)}: <b>${fmtInt(p.value)}</b> (${p.percent}%)` },
      series: [{
        type: 'pie', radius: ['58%', '85%'], center: ['30%', '50%'],
        itemStyle: { borderColor: C.card, borderWidth: 2 },
        label: { show: false },
        data: gData,
      }],
      legend: {
        orient: 'vertical', right: 0, top: 'middle', itemWidth: 10, itemHeight: 10,
        textStyle: { color: C.ink2, fontSize: 11 },
        formatter: (name: string) => `${name} ${(((gData.find((item) => item.name === name)?.value ?? 0) / genderTotal) * 100).toFixed(0)}%`,
      },
    });
  }

  const stackedGenderSeries = (buckets: string[], tab: Map<string, CrossTabGroup>) => {
    const genderKeys = [...new Set(buckets.flatMap((b) => tab.get(b)?.children.map((child) => child.key) ?? []))];
    return genderKeys.sort((a, b) => indexOfOrLast(GENDER_ORDER, a) - indexOfOrLast(GENDER_ORDER, b)).map((g) => ({
      name: g, type: 'bar', stack: 'g', barMaxWidth: 22,
      itemStyle: { color: genderColors[g] ?? C.notStated, borderColor: C.card, borderWidth: 1 },
      data: buckets.map((b) => tab.get(b)?.children.find((child) => child.key === g)?.count ?? 0),
    }));
  };

  const hideChart = (chart: echarts.ECharts, message: string) => chart.setOption({
    ...baseChart,
    xAxis: { show: false }, yAxis: { show: false }, series: [],
    graphic: [{ type: 'text', left: 'center', top: 'middle', style: { text: message, fill: C.muted, fontSize: 12 } }],
  }, true);

  function drawYoe() {
    const tab = new Map(scope!.experienceByGender.map((group) => [group.key, group]));
    const buckets = YOE_ORDER.filter((b) => tab.has(b));
    if (!buckets.length) return hideChart(yoeChart, 'No privacy-safe segments for this selection.');
    yoeChart.setOption({
      ...baseChart,
      tooltip: {
        ...baseTooltip, trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (ps: ChartParams[]) => {
          const total = ps.reduce((s, p) => s + p.value, 0);
          return `<b>${esc(ps[0].name)}</b> · ${fmtInt(total)} ${terms.registrations}<br/>` +
            ps.filter((p) => p.value).map((p) => `${p.marker} ${esc(p.seriesName)}: ${fmtInt(p.value)}`).join('<br/>');
        },
      },
      legend: { bottom: 0, itemWidth: 12, itemHeight: 12, textStyle: { color: C.ink2, fontSize: 11 } },
      grid: { left: 8, right: 30, top: 8, bottom: 28, containLabel: true },
      xAxis: { ...baseAxis, type: 'value' },
      yAxis: { ...baseAxis, type: 'category', inverse: true, data: buckets, splitLine: { show: false } },
      series: stackedGenderSeries(buckets, tab),
    }, true);
  }

  function drawTopicGender() {
    const tab = new Map(scope!.topicByGender.map((group) => [group.key, group]));
    const tot = (t: string) => tab.get(t)?.count ?? 0;
    const topics = [...tab.keys()].sort((a, b) => tot(b) - tot(a));
    if (!topics.length) return hideChart(topicGenderChart, 'No privacy-safe segments for this selection.');
    const totals = topics.map(tot);
    const genders = [...new Set(topics.flatMap((t) => tab.get(t)?.children.map((child) => child.key) ?? []))];
    const series = genders.map((g) => ({
      name: g, type: 'bar', stack: 'g', barMaxWidth: 18,
      itemStyle: { color: genderColors[g] ?? C.notStated, borderColor: C.card, borderWidth: 1 },
      label: {
        show: true, color: '#fff', fontSize: 10,
        formatter: (p: ChartParams) => (p.value >= 15 ? `${Math.round(p.value)}%` : ''),
      },
      data: topics.map((t, i) => +(((tab.get(t)?.children.find((child) => child.key === g)?.count ?? 0) / (totals[i] || 1)) * 100).toFixed(1)),
    }));
    topicGenderChart.setOption({
      ...baseChart,
      tooltip: {
        ...baseTooltip, trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (ps: ChartParams[]) => `<b>${esc(ps[0].name)}</b> · ${fmtInt(totals[ps[0].dataIndex])} ${terms.registrations}<br/>` +
          ps.filter((p) => p.value).map((p) => `${p.marker} ${esc(p.seriesName)}: ${Math.round(p.value)}%`).join('<br/>'),
      },
      legend: { bottom: 0, itemWidth: 12, itemHeight: 12, textStyle: { color: C.ink2, fontSize: 11 } },
      grid: { left: 8, right: 16, top: 8, bottom: 28, containLabel: true },
      xAxis: { ...baseAxis, type: 'value', max: 100, axisLabel: { ...baseAxis.axisLabel, formatter: '{value}%' } },
      yAxis: {
        ...baseAxis, type: 'category', inverse: true, data: topics, splitLine: { show: false },
        axisLabel: { ...baseAxis.axisLabel, width: 110, overflow: 'truncate' },
      },
      series,
    }, true);
  }

  function drawJobFamilies() {
    const groups = scope!.jobFamilies;
    if (!groups) return hideChart(jobfamChart, 'Hidden because a total could reveal a small group.');
    const total = groups.reduce((sum, group) => sum + group.count, 0) || 1;
    const items = [...groups].sort((a, b) => b.count - a.count);
    jobfamChart.setOption({
      ...baseChart,
      tooltip: { ...baseTooltip, formatter: (p: ChartParams) => `<b>${esc(p.name)}</b><br/>${fmtInt(p.value)} ${terms.registrations} (${fmtPct(p.value / total)})` },
      series: [{
        type: 'treemap', roam: false, nodeClick: false, breadcrumb: { show: false },
        left: 0, right: 0, top: 0, bottom: 0,
        visualMin: 0, visualMax: items[0]?.count ?? 1,
        label: {
          color: '#fff', fontSize: 11, fontWeight: 600,
          formatter: (p: ChartParams) => `${p.name}\n${fmtInt(p.value)} · ${fmtPct(p.value / total)}`,
        },
        levels: [{
          color: SEQ_BLUE.slice(3), // light -> dark so the biggest family reads darkest, white labels stay legible
          colorMappingBy: 'value',
          itemStyle: { borderColor: C.card, borderWidth: 2, gapWidth: 2 },
        }],
        data: items.map((group) => ({ name: group.key, value: group.count })),
      }],
    }, true);
  }

  function drawSector() {
    const groups = scope!.sectors;
    if (!groups) {
      hideChart(sectorChart, 'Hidden because a total could reveal a small group.');
      q('#sector-legend').innerHTML = '';
      return;
    }
    const counts = new Map(groups.map((group) => [group.key, group.count]));
    const total = groups.reduce((sum, group) => sum + group.count, 0) || 1;
    const sectors = [...counts.keys()].sort((a, b) => indexOfOrLast(SECTOR_ORDER, a) - indexOfOrLast(SECTOR_ORDER, b));
    sectorChart.setOption({
      ...baseChart,
      tooltip: {
        ...baseTooltip, trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: (ps: ChartParams[]) => ps.filter((p) => p.value).map((p) => `${p.marker} ${esc(p.seriesName)}: <b>${fmtInt(counts.get(p.seriesName))}</b> (${Math.round(p.value)}%)`).join('<br/>'),
      },
      grid: { left: 8, right: 60, top: 6, bottom: 6, containLabel: true },
      xAxis: { ...baseAxis, type: 'value', max: 100, show: false },
      yAxis: { ...baseAxis, type: 'category', data: ['All'], show: false },
      series: sectors.map((s) => ({
        name: s, type: 'bar', stack: 's', barMaxWidth: 34,
        itemStyle: { color: sectorColors[s] ?? C.notStated, borderColor: C.card, borderWidth: 1 },
        label: { show: true, color: '#fff', fontSize: 10, formatter: (p: ChartParams) => (p.value >= 9 ? `${Math.round(p.value)}%` : '') },
        data: [+(((counts.get(s) ?? 0) / total) * 100).toFixed(1)],
      })),
    }, true);
    q('#sector-legend').innerHTML =
      `<div class="senti-row" style="gap:12px">` +
      sectors.map((s) => `<div class="senti-stat"><span class="dot" style="background:${sectorColors[s] ?? C.notStated}"></span><span>${esc(s)} · ${fmtInt(counts.get(s))}</span></div>`).join('') +
      `</div><div class="table-count">${fmtInt(total)} ${terms.registrations}</div>`;
  }

  // ── segment × outcome ──────────────────────────────────────────────────────
  const MIN_N = summary.privacy.minimumSegmentSize;
  const DIM_LABELS: Record<SegDim, string> = {
    yoe: segments.experience.label.toLowerCase(),
    gender: segments.gender.label.toLowerCase(),
    jobfam: segments.jobFamily.label.toLowerCase(),
    sector: segments.sector.label.toLowerCase(),
    org: segments.organization.label.toLowerCase(),
  };

  // YOE stays in career order (it's ordinal, the progression is the point); every
  // other dim ranks by the outcome, best at the top. For org/jobfam keep the 12
  // biggest groups (by n) before ranking so a tiny group can't crowd out a big one.
  function orderRows(rows: SegRow[]): SegRow[] {
    if (segDim === 'yoe') {
      const order = segOutcome === 'return' ? YOE_ORDER : SURVEY_YOE_ORDER;
      return order.flatMap((b) => {
        const row = rows.find((r) => r.bucket === b);
        return row ? [row] : [];
      });
    }
    if (segDim === 'org') rows = rows.filter((r) => !ORG_NOISE.has(r.bucket.toLowerCase()) && r.n >= 4);
    rows.sort((a, b) => b.n - a.n);
    rows = rows.slice(0, 12);
    const metric: (r: SegRow) => number =
      segOutcome === 'return' ? (r) => r.rate ?? 0
      : segOutcome === 'sat' ? (r) => (r.promoters ?? 0) / (r.n || 1)
      : (r) => r.avg ?? 0;
    rows.sort((a, b) => metric(b) - metric(a));
    return rows;
  }

  // Rows arrive already filtered to the privacy threshold. Copied because
  // orderRows sorts in place.
  function segmentRows(): SegRow[] {
    const segs = scope!.segments;
    if (segOutcome === 'return') return orderRows(segs.return[segDim].map((row) => ({ ...row })));
    // survey outcomes: years-of-experience only, the one attribute responses carry
    return orderRows((segOutcome === 'sat' ? segs.sat : segs.rec).map((row) => ({ ...row })));
  }

  function segNote() {
    const dim = `<b>${DIM_LABELS[segDim]}</b>`;
    const surveyNote = ` Computed directly from survey responses; the survey records ${responseSegmentLabel.toLowerCase()} only, so other segment cuts are unavailable for this outcome.`;
    if (segOutcome === 'return')
      return `Share of each segment's ${terms.participants} who registered for 2+ ${terms.events}, by ${dim}.`;
    if (segOutcome === 'sat')
      return `Satisfaction mix by ${dim}: promoters scored ${satisfaction.promoterMin}–${satisfaction.max}, passives ${satisfaction.passiveMin}–${satisfaction.promoterMin - 1}, detractors ${satisfaction.passiveMin - 1} or below.` + surveyNote;
    return `Average "would you recommend" score by ${dim}, shown as the gap vs the overall average.` + surveyNote;
  }

  // Horizontal layout: with up to 12 long category names, rows never collide the way
  // rotated/wrapped x-axis labels do, each segment owns a row, n= rides on the bar label.
  function drawSegment() {
    refreshChipStates();
    const rows = segmentRows();
    q('#seg-note').innerHTML = segNote();
    q('#seg-hint').innerHTML = canDrill()
      ? `Only segments with at least ${MIN_N} responses are shown. Click a bar to read that group’s survey feedback below.`
      : `Only segments with at least ${MIN_N} people or responses are shown. Survey responses are anonymous, so feedback opens only for survey outcomes by ${esc(responseSegmentLabel.toLowerCase())}.`;

    if (!rows.length) return hideChart(segChart, 'No privacy-safe segments for this selection.');

    const base = {
      ...baseChart,
      grid: { left: 8, right: 90, top: 12, bottom: 30, containLabel: true },
      yAxis: {
        ...baseAxis, type: 'category', inverse: true, data: rows.map((r) => r.bucket),
        splitLine: { show: false },
        axisLabel: { ...baseAxis.axisLabel, interval: 0, width: 120, overflow: 'truncate' },
      },
    };
    const valueAxisName = (name: string) => ({ name, nameLocation: 'middle', nameGap: 24 });

    if (segOutcome === 'return') {
      segChart.setOption({
        ...base,
        tooltip: {
          ...baseTooltip,
          formatter: (p: ChartParams) => {
            const r = rows[p.dataIndex];
            return `<b>${esc(r.bucket)}</b><br/>Returning: <b>${fmtPct(r.rate)}</b> of ${fmtInt(r.n)} people`;
          },
        },
        xAxis: {
          ...baseAxis, type: 'value', ...valueAxisName('Returning %'),
          axisLabel: { ...baseAxis.axisLabel, formatter: '{value}%' },
        },
        series: [{
          type: 'bar', barMaxWidth: 26,
          itemStyle: { color: C.green, borderRadius: [0, 4, 4, 0] },
          label: {
            show: true, position: 'right', color: C.ink2, fontSize: 11,
            formatter: (p: ChartParams) => `${Math.round(p.value)}% {n|· n=${fmtInt(rows[p.dataIndex].n)}}`,
            rich: { n: { color: C.muted, fontSize: 10 } },
          },
          data: rows.map((r) => +((r.rate ?? 0) * 100).toFixed(1)),
        }],
      }, true);
      return;
    }

    if (segOutcome === 'sat') {
      // per-row shares normalised to sum to exactly 100, so the stack never
      // overshoots the axis and gets its end label clipped
      const shares = rows.map((r) => {
        const pa = +(((r.passives ?? 0) / (r.n || 1)) * 100).toFixed(1);
        const d = +(((r.detractors ?? 0) / (r.n || 1)) * 100).toFixed(1);
        return { promoters: +(100 - pa - d).toFixed(1), passives: pa, detractors: d };
      });
      const mk = (key: 'promoters' | 'passives' | 'detractors', name: string, color: string) => ({
        name, type: 'bar', stack: 'd', barMaxWidth: 26,
        itemStyle: { color, borderColor: C.card, borderWidth: 1 },
        label: { show: true, color: '#fff', fontSize: 10, formatter: (p: ChartParams) => (p.value >= 12 ? `${Math.round(p.value)}%` : '') },
        data: rows.map((_r, i) => ({
          value: shares[i][key],
        })),
      });
      // invisible stack cap that carries the n= label past the 100% mark
      const nCap = {
        name: '__n', type: 'bar', stack: 'd', silent: true, itemStyle: { color: 'transparent' },
        label: {
          show: true, position: 'right', color: C.muted, fontSize: 10,
          formatter: (p: ChartParams) => `n=${fmtInt(rows[p.dataIndex].n)}`,
        },
        data: rows.map(() => 0),
      };
      segChart.setOption({
        ...base,
        tooltip: {
          ...baseTooltip, trigger: 'axis', axisPointer: { type: 'shadow' },
          formatter: (ps: ChartParams[]) => {
            const r = rows[ps[0].dataIndex];
            return `<b>${esc(r.bucket)}</b> · n=${fmtInt(r.n)} responses<br/>` +
              ps.filter((p) => p.seriesName !== '__n').map((p) => `${p.marker} ${p.seriesName}: ${Math.round(p.value)}%`).join('<br/>');
          },
        },
        legend: {
          bottom: 0, itemWidth: 12, itemHeight: 12, textStyle: { color: C.ink2, fontSize: 11 },
          data: [`Promoters (${satisfaction.promoterMin}–${satisfaction.max})`, `Passives (${satisfaction.passiveMin}–${satisfaction.promoterMin - 1})`, `Detractors (≤${satisfaction.passiveMin - 1})`],
        },
        grid: { ...base.grid, bottom: 46 },
        xAxis: {
          ...baseAxis, type: 'value', max: 100, ...valueAxisName('Share of responses'),
          axisLabel: { ...baseAxis.axisLabel, formatter: '{value}%' },
        },
        series: [
          mk('promoters', `Promoters (${satisfaction.promoterMin}–${satisfaction.max})`, C.green),
          mk('passives', `Passives (${satisfaction.passiveMin}–${satisfaction.promoterMin - 1})`, C.muted),
          mk('detractors', `Detractors (≤${satisfaction.passiveMin - 1})`, C.jasper),
          nCap,
        ],
      }, true);
      return;
    }

    // recommend: deviation from the overall average, so small differences stay legible
    const avgOf = (r: SegRow) => r.avg ?? 0;
    const totalN = rows.reduce((s, r) => s + r.n, 0);
    const overall = totalN ? rows.reduce((s, r) => s + avgOf(r) * r.n, 0) / totalN : 0;
    const maxAbs = Math.max(0.3, ...rows.map((r) => Math.abs(avgOf(r) - overall))) * 1.35;
    segChart.setOption({
      ...base,
      tooltip: {
        ...baseTooltip,
        formatter: (p: ChartParams) => {
          const r = rows[p.dataIndex];
          return `<b>${esc(r.bucket)}</b><br/>Avg recommend: <b>${fmtNum(r.avg)}</b> / ${recommendation.max} (overall ${fmtNum(overall)})<br/>` +
            `n=${fmtInt(r.n)} responses`;
        },
      },
      xAxis: {
        ...baseAxis, type: 'value', min: -maxAbs, max: maxAbs,
        ...valueAxisName(`Δ vs overall recommend (${fmtNum(overall)})`),
        axisLabel: { ...baseAxis.axisLabel, formatter: (v: number) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)) },
      },
      series: [{
        type: 'bar', barMaxWidth: 26,
        itemStyle: {
          color: (p: ChartParams) => (avgOf(rows[p.dataIndex]) >= overall ? C.green : C.jasper),
          borderRadius: 4,
        },
        data: rows.map((r) => ({
          value: +(avgOf(r) - overall).toFixed(2),
          label: {
            show: true, position: avgOf(r) >= overall ? 'right' : 'left', color: C.ink2, fontSize: 11,
            formatter: () => `${fmtNum(r.avg)} {n|· n=${fmtInt(r.n)}}`,
            rich: { n: { color: C.muted, fontSize: 10 } },
          },
        })),
        markLine: { silent: true, symbol: 'none', lineStyle: { color: C.axis }, label: { show: false }, data: [{ xAxis: 0 }] },
      }],
    }, true);
  }

  function drawSegmentFeedback() {
    const card = q('#seg-fb-card');
    if (!segSelection || !canDrill()) {
      card.hidden = true;
      return;
    }
    const { bucket } = segSelection;
    // only buckets with enough respondents are published
    const indexes = scope?.surveyBuckets[bucket];
    const rows = (indexes ?? []).map((index) => summary.comments[index]);
    card.hidden = false;
    q('#seg-sel-label').textContent = bucket;
    const safe = indexes != null;
    q('#seg-senti').innerHTML = sentimentSplitHtml(sentimentSplit(rows), safe);
    renderFeedbackBoard(q('#seg-fb-table'), rows, eventsById, safe);
  }

  function update() {
    scope = scopeFor(summary)?.community ?? null;
    segSelection = null;
    q('#comm-empty').hidden = !!scope;
    q('#comm-body').hidden = !scope;
    if (!scope) {
      q('#seg-fb-card').hidden = true;
      return;
    }
    q('#comm-coverage').textContent =
      `Participant attributes for the current filters. Configured team registrations are excluded. Participant-level data covers ${scope.coveredEvents} of ${scope.eventsInView} ${terms.events} in view.`;
    drawKpis();
    drawYoe();
    drawTopicGender();
    drawJobFamilies();
    drawSector();
    drawSegment();
    drawSegmentFeedback();
  }

  return {
    update,
    resize: () => [yoeChart, topicGenderChart, jobfamChart, sectorChart, segChart, donutChart].forEach((c) => c?.resize()),
    dispose: () => [yoeChart, topicGenderChart, jobfamChart, sectorChart, segChart, donutChart].forEach((c) => c?.dispose()),
  };
}
