// 0.10: date patterns in format() and time zones, with the native Intl API (datetime feature).
// Pure (no DOM); formatter instances cached per (locale, options); unit-tested directly.

import { EvalError } from '../state/actexpr';
import { serialize } from '../state/values';
import { FormatError, cached, dates } from './intl';

const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** Throws FormatError for a time zone the browser does not know. */
export function checkZone(zone: string) {
  cached(dateFormats, `|${zone}|check`, () => new Intl.DateTimeFormat('en', { timeZone: zone }));
}

// Date patterns: Unicode-style letters (a subset), 'quoted' literal text ('' is a quote), everything else literal.
type Seg = string | { t: string };
const TOKENS = new Set(['yyyy', 'yy', 'M', 'MM', 'MMM', 'MMMM', 'd', 'dd', 'E', 'EEE', 'EEEE', 'H', 'HH', 'h', 'hh', 'm', 'mm', 's', 'ss', 'SSS', 'a']);
const patterns = new Map<string, Seg[]>();

/** The segments of a date pattern; FormatError for an unknown field or an open quote. */
export function parsePattern(p: string): Seg[] {
  let segs = patterns.get(p);
  if (segs) return segs;
  segs = [];
  for (let i = 0; i < p.length;) {
    const c = p[i];
    if (c === "'") {
      // 'text' is literal; '' is one quote, also inside quoted text ('o''clock')
      if (p[i + 1] === "'") { segs.push("'"); i += 2; continue; }
      let lit = '';
      for (i++; p[i] !== "'" || p[i + 1] === "'"; i++) {
        if (i >= p.length) throw new FormatError(`unterminated quote in "${p}"`);
        lit += p[i];
        if (p[i] === "'") i++; // the second quote of ''
      }
      segs.push(lit);
      i++;
    } else if (/[a-z]/i.test(c)) {
      let j = i;
      while (p[j] === c) j++;
      const t = p.slice(i, j);
      if (!TOKENS.has(t)) throw new FormatError(`"${t}" is not a date/time field; use yyyy, yy, M, MM, MMM, MMMM, d, dd, E, EEE, EEEE, H, HH, h, hh, m, mm, s, ss, SSS, a or 'quoted text'`);
      segs.push({ t });
      i = j;
    } else { segs.push(c); i++; }
  }
  patterns.set(p, segs);
  return segs;
}

/** True when `p` is a date pattern (at least one field). */
export const isDatePattern = (p: string) => parsePattern(p).some((s) => typeof s !== 'string');

type Parts = Record<string, string>;
function parts(ms: number, zone: string | undefined, loc: string | undefined, opts: Intl.DateTimeFormatOptions, kind: string): Parts {
  // Gregorian calendar and Latin digits for the numeric fields, whatever the locale's defaults.
  const f = cached(dateFormats, `${loc}|${zone}|${kind}`, () => new Intl.DateTimeFormat(loc, { ...opts, timeZone: zone, calendar: 'gregory', numberingSystem: 'latn' }));
  const out: Parts = {};
  for (const p of f.formatToParts(ms)) out[p.type] = p.value;
  return out;
}

// Numbers, not the locale's text: Intl pads minutes and seconds (and days in some locales) itself.
const pad = (s: string | number, n: number) => String(+s).padStart(n, '0');

/**
 * The last result per (locale, zone, pattern): every clock on a page formats the same instant
 * (time() is one instant per task), so one Intl call serves all of them.
 */
const lastDate = new Map<string, [number, string]>();

/** `ms` (epoch milliseconds) with `pattern`, in `zone` (undefined: the browser's) and `loc`. */
export function formatDate(ms: number, pattern: string, zone: string | undefined, loc: string | undefined): string {
  const key = `${loc}|${zone}|${pattern}`;
  const last = lastDate.get(key);
  if (last?.[0] === ms) return last[1];
  const segs = parsePattern(pattern);
  let num: Parts | undefined;
  const n = () => (num ??= parts(ms, zone, loc, { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }, 'num'));
  const name = (o: Intl.DateTimeFormatOptions, k: string, type: string) => parts(ms, zone, loc, o, k)[type];
  let s = '';
  for (const seg of segs) {
    if (typeof seg === 'string') { s += seg; continue; }
    const t = seg.t;
    switch (t) {
      case 'yyyy': s += pad(n().year, 4); break;
      case 'yy': s += pad(+n().year % 100, 2); break;
      case 'M': case 'MM': s += pad(n().month, t.length); break;
      case 'MMM': s += name({ month: 'short' }, 'MMM', 'month'); break;
      case 'MMMM': s += name({ month: 'long' }, 'MMMM', 'month'); break;
      case 'd': case 'dd': s += pad(n().day, t.length); break;
      case 'E': case 'EEE': s += name({ weekday: 'short' }, 'EEE', 'weekday'); break;
      case 'EEEE': s += name({ weekday: 'long' }, 'EEEE', 'weekday'); break;
      case 'H': case 'HH': s += pad(+n().hour % 24, t.length); break; // some engines print 24 at midnight
      case 'h': case 'hh': s += pad(((+n().hour + 11) % 12) + 1, t.length); break;
      case 'm': case 'mm': s += pad(n().minute, t.length); break;
      case 's': case 'ss': s += pad(n().second, t.length); break;
      case 'SSS': s += pad(((ms % 1000) + 1000) % 1000, 3); break;
      case 'a': s += name({ hour: 'numeric', hour12: true }, 'a', 'dayPeriod') ?? (+n().hour < 12 ? 'AM' : 'PM'); break;
    }
  }
  lastDate.set(key, [ms, s]);
  return s;
}

dates.isPattern = isDatePattern;
dates.format = (v, how, loc) => {
  if (v.type !== 'datetime') throw new EvalError(`format(): a date pattern needs a date and time from time() or timezone(); ${serialize(v)} is a ${v.type}`);
  return { type: 'string', v: formatDate(v.v as number, how, v.zone, loc) };
};
