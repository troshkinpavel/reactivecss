// 0.10: format(number, style [, currency]).
//
//   format(1234567.89, "decimal")       1,234,567.89    grouping, up to 3 decimals
//   format(1234.8, "integer")           1,235           rounded half away from zero
//   format(0.42, "percent")             42%
//   format(9.5, "currency", "EUR")      €9.50
//
// - The result is a string. A string that is exactly a decimal number ("09") still compares and
//   calculates as a number (values.ts, actexpr.ts).
// - Locale: the nearest lang attribute of the element (<html lang> by default, or lang on any
//   ancestor, e.g. <span lang="de">); none or invalid: the browser's. No locale argument, so the
//   third position always means the currency.
// - format is also a CSS name (@font-face src: … format("woff2")): which calls are claimed is
//   decided in core (parser.ts CLAIM), so a bundle without this feature leaves fonts alone too.

import { valueFunction } from './calls';
import { EvalError, type Node, type EvalCtx } from '../state/actexpr';
import { numericString, serialize, type Typed } from '../state/values';
import { NUMBER_STYLES, FormatError, formatNumber, locale, type NumberStyle } from './intl';

const lit = (n: Node | undefined) => (n?.k === 'lit' && (n.t.type === 'string' || n.t.type === 'value') ? (n.t.v as string) : undefined);

/** The element's language: the nearest lang attribute (cached per element). */
const langs = new WeakMap<Element, string | undefined>();
function localeOf(el: Element): string | undefined {
  if (langs.has(el)) return langs.get(el);
  const l = locale(el.closest('[lang]')?.getAttribute('lang'));
  langs.set(el, l);
  return l;
}

function format(v: Typed, how: NumberStyle, currency: string | undefined, ctx: EvalCtx): Typed {
  const n = v.type === 'number' ? v : numericString(v);
  if (!n) throw new EvalError(`format(): "${how}" formats numbers; ${serialize(v)} is a ${v.type}`);
  try {
    return { type: 'string', v: formatNumber(n.v as number, how, currency, localeOf(ctx.el)) };
  } catch (e) {
    if (e instanceof FormatError) throw new EvalError(`format(): ${e.message}`);
    throw e;
  }
}

valueFunction('format', 'format(number, "decimal" | "integer" | "percent" | "currency" [, "currency code"])', {
  min: 2, max: 3,
  // The style and the currency are literals: every mistake is reported at compile time.
  check(args) {
    const how = lit(args[1]);
    if (how === undefined) throw new Error('the second argument of format() is a style: "decimal", "integer", "percent" or "currency"');
    if (!(NUMBER_STYLES as readonly string[]).includes(how)) throw new Error(`"${how}" is not a format() style; use "decimal", "integer", "percent" or "currency"`);
    const cur = lit(args[2]);
    if (how === 'currency' && !/^[a-z]{3}$/i.test(cur ?? '')) throw new Error('"currency" needs a three-letter ISO 4217 code, e.g. format(9.5, "currency", "EUR")');
    if (how !== 'currency' && args[2]) throw new Error(`"${how}" takes no third argument`);
  },
  eval: ([v, how, cur], ctx) => format(v, how.v as NumberStyle, cur?.v as string | undefined, ctx),
});
