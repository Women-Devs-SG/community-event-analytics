// Display formatting for dashboard numbers. Missing values show as a dash, never zero.
type Numeric = number | null | undefined;

export const fmtPct = (v: Numeric, dp = 0) => (v == null || isNaN(v) ? '–' : (v * 100).toFixed(dp) + '%');
export const fmtNum = (v: Numeric, dp = 1) => (v == null || isNaN(v) ? '–' : Number(v).toFixed(dp));
export const fmtInt = (v: Numeric) => (v == null || isNaN(v) ? '–' : Math.round(v).toLocaleString());
