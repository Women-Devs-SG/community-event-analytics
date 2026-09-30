// Tree-shakeable ECharts: register only the charts, components, and renderer the
// dashboards use, so the bundle skips the rest of the library. A chart that needs
// another series type or component must add it here and to ECOption, or it will
// not render (and its option will not typecheck). Features have no option type,
// so a missing one fails silently: check the charts in a browser against main.
import * as echarts from 'echarts/core';
import { BarChart, PieChart, ScatterChart, TreemapChart } from 'echarts/charts';
import type { BarSeriesOption, PieSeriesOption, ScatterSeriesOption, TreemapSeriesOption } from 'echarts/charts';
import {
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import type {
  GraphicComponentOption,
  GridComponentOption,
  LegendComponentOption,
  MarkLineComponentOption,
  TooltipComponentOption,
} from 'echarts/components';
import { LabelLayout, LegacyGridContainLabel } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';
import type { ComposeOption } from 'echarts/core';
import type { DefaultLabelFormatterCallbackParams, TooltipComponentFormatterCallbackParams } from 'echarts';

echarts.use([
  BarChart,
  PieChart,
  ScatterChart,
  TreemapChart,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  LabelLayout, // scatter labelLayout.hideOverlap
  LegacyGridContainLabel, // grid.containLabel; without it ECharts 6 silently lays the grid out differently
  CanvasRenderer,
]);

export type ECOption = ComposeOption<
  | BarSeriesOption
  | PieSeriesOption
  | ScatterSeriesOption
  | TreemapSeriesOption
  | GraphicComponentOption
  | GridComponentOption
  | LegendComponentOption
  | MarkLineComponentOption
  | TooltipComponentOption
>;

export type { EChartsType } from 'echarts/core';
export type { BarSeriesOption };
export { echarts };

// What ECharts passes to label, tooltip, colour, and symbol-size callbacks. The
// bare 'echarts' entry is imported for types only, so it adds nothing to the bundle.
export type ChartParams = DefaultLabelFormatterCallbackParams;

// Axis-triggered tooltips receive every series at the hovered category;
// item-triggered tooltips receive the one hovered point.
export const tooltipPoints = (p: TooltipComponentFormatterCallbackParams): ChartParams[] =>
  Array.isArray(p) ? p : [p];
export const tooltipPoint = (p: TooltipComponentFormatterCallbackParams): ChartParams => (Array.isArray(p) ? p[0] : p);

// Every bar, pie, and treemap series here plots plain numbers.
export const numValue = (p: ChartParams) => p.value as number;
