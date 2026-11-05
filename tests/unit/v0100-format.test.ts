// 0.10 step 5 (format): format(number, style [, currency]) and numeric strings.
import { describe, it, expect, beforeEach } from 'vitest';
import { compile, diagnostics } from '../../src/index';
import { hasReactiveSyntax } from '../../src/core/parser';
import { parseCondition, evaluate, serialize, type Typed, type Lookup } from '../../src/state/values';
import { parseAction, value } from '../../src/state/actexpr';
import { formatNumber, locale } from '../../src/functions/intl';

const err = (fn: () => unknown) => { try { fn(); return ''; } catch (e) { return (e as Error).message; } };
// No lang attribute anywhere: the default locale of the test process.
const el = { closest: () => null } as unknown as Element;
const run = (expr: string) => value(parseAction(expr, 'other', ':on(click)'), { e: new Event('click'), el });
const out = (expr: string) => serialize(run(expr)!);
const str = (v: string): Typed => ({ type: 'string', v });
const cond = (text: string, states: Record<string, Typed> = {}) => {
  const lookup: Lookup = (n) => (states[n] ? { value: states[n], previous: states[n] } : undefined);
  return evaluate(parseCondition(text).ast, lookup);
};
const NBSP = ' ';

beforeEach(() => { diagnostics.length = 0; });

describe('formatNumber(): styles × locales', () => {
  it('en-US', () => {
    expect(formatNumber(1234567.891, 'decimal', undefined, 'en-US')).toBe('1,234,567.891');
    expect(formatNumber(1.23456, 'decimal', undefined, 'en-US')).toBe('1.235'); // up to 3 decimals
    expect(formatNumber(1234.5, 'integer', undefined, 'en-US')).toBe('1,235'); // half away from zero
    expect(formatNumber(-1.5, 'integer', undefined, 'en-US')).toBe('-2');
    expect(formatNumber(-0.4, 'integer', undefined, 'en-US')).toBe('0'); // never "-0"
    expect(formatNumber(-0, 'decimal', undefined, 'en-US')).toBe('0');
    expect(formatNumber(0.42, 'percent', undefined, 'en-US')).toBe('42%');
    expect(formatNumber(9.5, 'currency', 'eur', 'en-US')).toBe('€9.50');
    expect(formatNumber(-9.5, 'currency', 'USD', 'en-US')).toBe('-$9.50');
  });
  it('de-DE, fr-FR, ar-EG: separators, spacing and digits of the locale', () => {
    expect(formatNumber(1234567.89, 'decimal', undefined, 'de-DE')).toBe('1.234.567,89');
    expect(formatNumber(0.42, 'percent', undefined, 'de-DE')).toBe(`42${NBSP}%`);
    expect(formatNumber(9.5, 'currency', 'EUR', 'de-DE')).toBe(`9,50${NBSP}€`);
    expect(formatNumber(1234.5, 'decimal', undefined, 'fr-FR')).toBe('1 234,5'); // narrow no-break space
    expect(formatNumber(12, 'integer', undefined, 'ar-EG')).toBe('١٢'); // Arabic-Indic digits
  });
  it('non-finite numbers are an error', () => {
    expect(err(() => formatNumber(Infinity, 'decimal', undefined, 'en'))).toBe('Infinity is not a finite number');
    expect(err(() => formatNumber(NaN, 'integer', undefined, 'en'))).toBe('NaN is not a finite number');
  });
  it('locale(): canonical BCP 47, or the browser default for none / invalid', () => {
    expect(locale('de-de')).toBe('de-DE');
    expect(locale('EN')).toBe('en');
    expect(locale('')).toBeUndefined();
    expect(locale(null)).toBeUndefined();
    expect(locale('not a tag!')).toBeUndefined();
  });
});

describe('format() in the expression language', () => {
  it('numbers and numeric strings; keywords as the style', () => {
    const local = (n: number, o?: Intl.NumberFormatOptions) => new Intl.NumberFormat(undefined, o).format(n);
    expect(out('format(1234.5, "integer")')).toBe(`"${local(1235, { maximumFractionDigits: 0 })}"`);
    expect(out('format("1234.5", decimal)')).toBe(`"${local(1234.5)}"`);
    expect(out('format(length("abcd") / 8, "percent")')).toBe(`"${local(0.5, { style: 'percent' })}"`);
  });
  it('values that are not numbers are an error (no value)', () => {
    expect(err(() => run('format(3px, "decimal")'))).toBe('format(): "decimal" formats numbers; 3px is a dimension');
    expect(err(() => run('format("abc", "integer")'))).toBe('format(): "integer" formats numbers; "abc" is a string');
    expect(err(() => run('format(true, "decimal")'))).toBe('format(): "decimal" formats numbers; 1 is a boolean');
  });
  it('style and currency are checked when the sheet is compiled', () => {
    const parse = (t: string) => err(() => parseAction(t, 'other', ':on(click)'));
    expect(parse('format(1)')).toBe('format() takes 2 to 3 arguments, got 1');
    expect(parse('format(1, var(--s))')).toBe('the second argument of format() is a style: "decimal", "integer", "percent" or "currency"');
    expect(parse('format(1, "HH:mm")')).toBe('"HH:mm" is not a format() style; use "decimal", "integer", "percent" or "currency"');
    expect(parse('format(1, "currency")')).toBe('"currency" needs a three-letter ISO 4217 code, e.g. format(9.5, "currency", "EUR")');
    expect(parse('format(1, "currency", "EURO")')).toBe('"currency" needs a three-letter ISO 4217 code, e.g. format(9.5, "currency", "EUR")');
    expect(parse('format(1, "decimal", "EUR")')).toBe('"decimal" takes no third argument');
    expect(parse('format(--n, "currency", "CHF")')).toBe(''); // a bare --n reads a state, as in the other value functions
  });
});

describe('numeric strings', () => {
  it('a string that is exactly a decimal number compares and calculates as that number', () => {
    expect(cond('--s >= 9', { '--s': str('09') })).toBe(true);
    expect(cond('--s < 0', { '--s': str('-1.5') })).toBe(true);
    expect(cond('--s == 0.5', { '--s': str('.5') })).toBe(true);
    expect(out('"09" + 1')).toBe('10');
    expect(out('max("3", 2)')).toBe('3');
    expect(out('"2" * 3px')).toBe('6px');
  });
  it('two strings still compare as text', () => {
    expect(cond('--s == "9"', { '--s': str('09') })).toBe(false);
    expect(cond('--s == "09"', { '--s': str('09') })).toBe(true);
  });
  it('anything else keeps its 0.9.1 error', () => {
    expect(err(() => cond('--s > 1', { '--s': str('abc') }))).toBe('cannot compare "abc" (string) with 1 (number)');
    expect(err(() => cond('--s > 1', { '--s': str(' 5') }))).toBe('cannot compare " 5" (string) with 1 (number)'); // no trimming
    expect(err(() => cond('--s > 1', { '--s': str('1e3') }))).toBe('cannot compare "1e3" (string) with 1 (number)'); // no exponent
    expect(err(() => cond('--s > 1', { '--s': str('1,5') }))).toBe('cannot compare "1,5" (string) with 1 (number)');
    expect(err(() => run('"abc" + 1'))).toBe('"abc" is not a number');
    expect(err(() => run('"" * 2'))).toBe('"" is not a number');
  });
});

describe('format is also a CSS name', () => {
  const fonts = `@font-face { font-family: A; src: url(a.woff2) format("woff2"), url(a.woff) format(woff) }
    @font-face { font-family: B; src: local(B), url(b.ttf) format('truetype') tech(variations) }`;
  it('font-only sheets are not reactive: no processing, no diagnostic', () => {
    expect(hasReactiveSyntax(fonts)).toBe(false);
    const c = compile(fonts + ' body { font-family: A, B }');
    expect(c.changed).toBe(false);
    expect(diagnostics).toEqual([]);
  });
  it('Reactive CSS calls are found by the pre-filter, also with nested arguments', () => {
    expect(hasReactiveSyntax('.p { text: format(var(--x) * 2, "decimal") }')).toBe(true);
    expect(hasReactiveSyntax('.p { text: format(((1 + 2) * 3), "integer") }')).toBe(true);
    expect(hasReactiveSyntax('.p { text: format(1,"percent") }')).toBe(true);
  });
  it('fonts next to reactive rules: fonts unchanged, format() claimed only in its Reactive CSS form', () => {
    const c = compile(fonts + ' .p { --n: state(3) } .p .t { text: format(--n / 4, "percent") }');
    expect(diagnostics).toEqual([]);
    expect(c.css).toContain('format("woff2")');
    expect(c.css).toContain('format(woff)');
    expect(c.css).toContain("format('truetype')");
    expect(c.uses.has('fn:format')).toBe(true);
  });
});
