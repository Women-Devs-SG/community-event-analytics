import { describe, expect, it } from 'vitest';
import { fmtInt, fmtNum, fmtPct } from './format';

describe('number formatting', () => {
  it('shows missing values as a dash, never as zero', () => {
    for (const missing of [null, undefined, NaN]) {
      expect(fmtPct(missing)).toBe('–');
      expect(fmtNum(missing)).toBe('–');
      expect(fmtInt(missing)).toBe('–');
    }
  });

  it('keeps a real zero distinct from a missing value', () => {
    expect(fmtPct(0)).toBe('0%');
    expect(fmtNum(0)).toBe('0.0');
    expect(fmtInt(0)).toBe('0');
  });

  it('formats rates, decimals, and rounded counts', () => {
    expect(fmtPct(0.4567, 1)).toBe('45.7%');
    expect(fmtNum(4.25, 2)).toBe('4.25');
    expect(fmtInt(12.6)).toBe('13');
  });
});
