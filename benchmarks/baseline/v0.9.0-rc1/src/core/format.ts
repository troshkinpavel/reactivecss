/** Number to CSS text with at most 4 decimals; "+ 0" turns -0 into 0. Cheaper than toFixed(). */
export const fmt = (v: number) => String(Math.round(v * 1e4) / 1e4 + 0);
