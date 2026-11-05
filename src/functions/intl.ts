// 0.10: number formatting with the native Intl API. Pure (no DOM); formatter instances cached per
// (locale, options). Used by format.ts; unit-tested directly.

export const NUMBER_STYLES = ['decimal', 'integer', 'percent', 'currency'] as const;
export type NumberStyle = (typeof NUMBER_STYLES)[number];

const numberFormats = new Map<string, Intl.NumberFormat>();

export class FormatError extends Error {}

/** A valid BCP 47 tag from a lang attribute, or undefined (the browser's default locale). */
export function locale(lang: string | null | undefined): string | undefined {
  if (!lang) return undefined;
  try { return Intl.getCanonicalLocales(lang)[0]; } catch { return undefined; }
}

/** `n` in `style`: grouping separators, locale digits and signs; currency needs an ISO 4217 code. */
export function formatNumber(n: number, style: NumberStyle, currency: string | undefined, loc: string | undefined): string {
  if (!Number.isFinite(n)) throw new FormatError(`${n} is not a finite number`);
  // signDisplay "negative": -0 and values that round to zero show no minus sign.
  // It is ES2023 (the project's lib is ES2022); every target browser supports it.
  const opts = (
    style === 'integer' ? { maximumFractionDigits: 0, signDisplay: 'negative' }
    : style === 'percent' ? { style: 'percent', signDisplay: 'negative' }
    : style === 'currency' ? { style: 'currency', currency: currency!.toUpperCase(), signDisplay: 'negative' }
    : { signDisplay: 'negative' }) as unknown as Intl.NumberFormatOptions;
  const key = `${loc}|${style}|${currency}`;
  let f = numberFormats.get(key);
  if (!f) {
    try { f = new Intl.NumberFormat(loc, opts); } catch (e) { throw new FormatError((e as Error).message); }
    numberFormats.set(key, f);
  }
  return f.format(n);
}
