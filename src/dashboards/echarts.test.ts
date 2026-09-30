import { describe, expect, it } from 'vitest';
import { numValue, tooltipPoint, tooltipPoints } from './echarts';
import type { ChartParams } from './echarts';

// Only the fields the helpers read; ECharts fills in the rest at runtime.
const point = (name: string, value: number) => ({ name, value, dataIndex: 0 }) as ChartParams;

describe('ECharts callback params', () => {
  it('reads an axis tooltip as every series at the hovered category', () => {
    const ps = [point('Female', 3), point('Male', 5)];
    expect(tooltipPoints(ps)).toBe(ps);
    expect(tooltipPoint(ps)).toBe(ps[0]);
  });

  it('reads an item tooltip as the one hovered point', () => {
    const p = point('Private', 7);
    expect(tooltipPoints(p)).toEqual([p]);
    expect(tooltipPoint(p)).toBe(p);
  });

  it('keeps a zero value as zero', () => {
    expect(numValue(point('Academia', 0))).toBe(0);
  });
});
