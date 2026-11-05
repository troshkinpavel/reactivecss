// 0.10: number formatting with the native Intl API. Pure (no DOM); formatter instances cached per
// (locale, options). Used by format.ts and dates.ts; unit-tested directly.

import type { Typed } from '../state/values';

export const NUMBER_STYLES = ['decimal', 'integer', 'percent', 'currency'] as const;
export type NumberStyle = (typeof NUMBER_STYLES)[number];

const numberFormats = new Map<string, Intl.NumberFormat>();

export class FormatError extends Error {}

export function cached<T>(map: Map<string, T>, key: string, make: () => T): T {
  let f = map.get(key);
  if (!f) {
    try { f = make(); } catch (e) { throw new FormatError((e as Error).message); }
    map.set(key, f);
  }
  return f;
}

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
  return cached(numberFormats, `${loc}|${style}|${currency}`, () => new Intl.NumberFormat(loc, opts)).format(n);
}

/** 0.10: date patterns, installed by the datetime feature (functions/dates.ts). */
export const dates: {
  isPattern?(p: string): boolean;
  format?(v: Typed, pattern: string, loc: string | undefined): Typed;
} = {};
