// 0.10 step 6 (datetime): time(), timezone(), datetime arithmetic and comparisons, state(time()),
// and date patterns in format(). Fixed instants only (Date.now is stubbed).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { compile, diagnostics } from '../../src/index';
import { parseCondition, evaluate, serialize, equal, conditionCalls, type Typed, type Lookup } from '../../src/state/values';
import { parseAction, value } from '../../src/state/actexpr';
import { parseExpr, evaluate as initial } from '../../src/state/expr';
import { formatDate } from '../../src/functions/intl';

const err = (fn: () => unknown) => { try { fn(); return ''; } catch (e) { return (e as Error).message; } };
const el = { closest: () => null } as unknown as Element;
const run = (expr: string) => value(parseAction(expr, 'other', ':on(click)'), { e: new Event('click'), el });
const out = (expr: string) => serialize(run(expr)!);
const parse = (t: string) => err(() => parseAction(t, 'other', ':on(click)'));
const at = (iso: string) => Date.parse(iso);
const dt = (iso: string, zone?: string): Typed => ({ type: 'datetime', v: at(iso), ...(zone ? { zone } : {}) });
const cond = (text: string, states: Record<string, Typed> = {}) => {
  const lookup: Lookup = (n) => (states[n] ? { value: states[n], previous: states[n] } : undefined);
  lookup.fn = (node) => conditionCalls.evaluate!(node, el);
  return evaluate(parseCondition(text).ast, lookup);
};
/** time() is one instant per task: a new task (await) is needed to see a new Date.now(). */
const tick = () => new Promise((r) => setTimeout(r));
const NOW = '2026-01-01T12:00:00.250Z'; // a Thursday

beforeEach(() => { diagnostics.length = 0; vi.spyOn(Date, 'now').mockReturnValue(at(NOW)); });
afterEach(() => { vi.restoreAllMocks(); });

describe('formatDate(): fixed instants', () => {
  const f = (iso: string, p: string, zone = 'UTC', loc = 'en-US') => formatDate(at(iso), p, zone, loc);
  it('fields, padding and quoted text', () => {
    expect(f(NOW, 'yyyy-MM-dd HH:mm:ss.SSS')).toBe('2026-01-01 12:00:00.250');
    expect(f('2026-03-05T07:08:09Z', 'yy M d H m s')).toBe('26 3 5 7 8 9');
    expect(f(NOW, 'EEEE, MMMM d')).toBe('Thursday, January 1');
    expect(f(NOW, 'EEE d MMM')).toBe('Thu 1 Jan');
    expect(f(NOW, "HH 'h' mm, 'o''clock'")).toBe("12 h 00, o'clock"); // '' is a quote
    expect(f('0999-07-04T00:00:00Z', 'yyyy yy')).toBe('0999 99');
  });
  it('midnight and noon in 24- and 12-hour fields', () => {
    expect(f('2026-01-01T00:00:00Z', 'HH H hh h a')).toBe('00 0 12 12 AM');
    expect(f('2026-01-01T12:00:00Z', 'HH hh a')).toBe('12 12 PM');
    expect(f('2026-01-01T23:59:59.999Z', 'HH:mm:ss.SSS hh a')).toBe('23:59:59.999 11 PM');
  });
  it('daylight saving: London spring-forward, New York fall-back', () => {
    expect(f('2026-03-29T00:59:59Z', 'HH:mm:ss', 'Europe/London')).toBe('00:59:59');
    expect(f('2026-03-29T01:00:00Z', 'HH:mm:ss', 'Europe/London')).toBe('02:00:00'); // 01:xx never happens
    expect(f('2026-11-01T05:30:00Z', 'HH:mm', 'America/New_York')).toBe('01:30'); // EDT
    expect(f('2026-11-01T06:30:00Z', 'HH:mm', 'America/New_York')).toBe('01:30'); // EST: the hour repeats
  });
  it('zones: half and quarter hours, both sides of the date line', () => {
    expect(f('2026-01-01T00:00:00Z', 'HH:mm', 'Asia/Kolkata')).toBe('05:30');
    expect(f('2026-01-01T00:00:00Z', 'HH:mm', 'Asia/Kathmandu')).toBe('05:45');
    expect(f(NOW, 'yyyy-MM-dd HH:mm', 'Pacific/Kiritimati')).toBe('2026-01-02 02:00'); // +14
    expect(f(NOW, 'yyyy-MM-dd HH:mm', 'Pacific/Pago_Pago')).toBe('2026-01-01 01:00'); // -11
  });
  it('leap years: 29 Feb 2028; 2100 is not a leap year', () => {
    expect(f('2028-02-28T12:00:00Z', 'yyyy-MM-dd')).toBe('2028-02-28');
    expect(f(new Date(at('2028-02-28T12:00:00Z') + 864e5).toISOString(), 'yyyy-MM-dd EEE')).toBe('2028-02-29 Tue');
    expect(f(new Date(at('2100-02-28T12:00:00Z') + 864e5).toISOString(), 'yyyy-MM-dd')).toBe('2100-03-01');
  });
  it('Gregorian calendar and Latin digits in numbers; names in the locale', () => {
    expect(f(NOW, 'yyyy-MM-dd', 'UTC', 'th-TH')).toBe('2026-01-01'); // not the Buddhist year 2569
    expect(f(NOW, 'dd/MM/yyyy HH:mm', 'UTC', 'ar-EG')).toBe('01/01/2026 12:00'); // not Arabic-Indic digits
    expect(f(NOW, 'yyyy-MM-dd', 'UTC', 'fa-IR')).toBe('2026-01-01'); // not the Persian calendar
    expect(f(NOW, 'EEEE d MMMM', 'UTC', 'fr-FR')).toBe('jeudi 1 janvier');
    expect(f(NOW, 'EEEE', 'UTC', 'de-DE')).toBe('Donnerstag');
  });
});

describe('time() and timezone() in the expression language', () => {
  it('time() is a datetime; in CSS its epoch milliseconds', () => {
    expect(run('time()')).toEqual({ type: 'datetime', v: at(NOW) });
    expect(out('time()')).toBe(String(at(NOW)));
  });
  it('one instant per task', async () => {
    const a = run('time()');
    vi.mocked(Date.now).mockReturnValue(at(NOW) + 5000);
    expect(run('time()')).toEqual(a); // same task: the same instant
    await tick();
    expect(run('time()')!.v).toBe(at(NOW) + 5000);
  });
  it('arithmetic: ± a duration, the difference of two datetimes', () => {
    expect(run('time() + 30s')).toEqual({ type: 'datetime', v: at(NOW) + 30000 });
    expect(run('time() - 500ms')!.v).toBe(at(NOW) - 500);
    expect(out('(time() + 90s) - time()')).toBe('90000ms');
    expect(out('((time() + 90s) - time()) / 1s')).toBe('90');
    expect(out('round(up, ((time() + 1500ms) - time()) / 1s)')).toBe('2');
    expect(run('timezone(time(), "Asia/Tokyo") + 1s')).toEqual({ type: 'datetime', v: at(NOW) + 1000, zone: 'Asia/Tokyo' }); // keeps the zone
  });
  it('arithmetic errors: a number is never a time', () => {
    expect(err(() => run('time() + 1'))).toBe(`${at(NOW)} + 1: a datetime takes + or - with a time like 30s or 500ms`);
    expect(err(() => run('time() + 3px'))).toBe(`${at(NOW)} + 3px: a datetime takes + or - with a time like 30s or 500ms`);
    expect(err(() => run('30s - time()'))).toBe(`30s - ${at(NOW)}: a datetime takes + or - with a time like 30s or 500ms`);
    expect(err(() => run('time() * 2'))).toBe(`${at(NOW)} * 2: a datetime takes + or - with a time like 30s or 500ms`);
    expect(err(() => run('time() + time()'))).toBe('only subtraction works on two datetimes (it gives the duration between them), not +');
    expect(err(() => run('max(time(), 1)'))).toBe(`${at(NOW)} is a date and time; add or subtract a duration (time() + 30s), or subtract two datetimes`);
  });
  it('timezone(): IANA names checked at compile time, or when a state gives the zone', () => {
    expect(parse('timezone(time(), "Mars/Olympus")')).toBe('timezone(): unknown time zone "Mars/Olympus"');
    expect(parse('timezone(time(), 3)')).toBe('the zone of timezone() is a quoted IANA name, e.g. "Europe/London"');
    expect(parse('timezone(time())')).toBe('timezone() takes 2 arguments, got 1');
    expect(parse('time(1)')).toBe('time() takes 0 arguments, got 1');
    expect(err(() => run('timezone(5, "UTC")'))).toBe('timezone() needs a date and time from time(); 5 is a number');
  });
  it('equal() compares the instant and the zone', () => {
    expect(equal(dt(NOW), dt(NOW))).toBe(true);
    expect(equal(dt(NOW), dt(NOW, 'UTC'))).toBe(false);
    expect(equal(dt(NOW), { type: 'number', v: at(NOW), unit: '' })).toBe(false);
  });
});

describe('comparisons', () => {
  const until = dt('2026-01-01T12:00:30Z');
  it('with a datetime or with epoch milliseconds, by instant (zones do not matter)', () => {
    expect(cond('--until > time()', { '--until': until })).toBe(true);
    expect(cond('time() >= --until', { '--until': until })).toBe(false);
    expect(cond('--a == --b', { '--a': dt(NOW, 'Asia/Tokyo'), '--b': dt(NOW) })).toBe(true);
    expect(cond(`--until == ${at('2026-01-01T12:00:30Z')}`, { '--until': until })).toBe(true);
    expect(cond('--until > 0', { '--until': until })).toBe(true);
  });
  it('anything else is the 0.9.1 comparison error', () => {
    expect(err(() => cond('--until > 3s', { '--until': until }))).toBe(`cannot compare ${at('2026-01-01T12:00:30Z')} (datetime) with 3s (dimension)`);
    expect(err(() => cond('--until == "x"', { '--until': until }))).toBe(`cannot compare ${at('2026-01-01T12:00:30Z')} (datetime) with "x" (string)`);
    expect(err(() => cond('--until == true', { '--until': until }))).toBe(`cannot compare ${at('2026-01-01T12:00:30Z')} (datetime) with 1 (boolean)`);
  });
});

describe('state(time())', () => {
  it('a datetime state; other arguments are an error', () => {
    expect(initial(parseExpr('time()'), el)).toEqual({ type: 'datetime', v: at(NOW) });
    expect(err(() => parseExpr('time(1)'))).toBe('time() takes no arguments here');
    expect(parseExpr('time() + 1s')).toEqual({ k: 'lit', t: { type: 'value', v: 'time() + 1s' } }); // as in 0.9.1: not an expression
  });
  it('compiles with the deadline pattern, without a diagnostic', () => {
    const c = compile('.r { --until: state(time()) } .r button:on(click) { --until: set(time() + 30s) } .r .left { text: format(max(0, round(up, (--until - time()) / 1s)), "integer") }');
    expect(diagnostics).toEqual([]);
    expect(c.uses.has('fn:time')).toBe(true);
    expect(c.uses.has('fn:format')).toBe(true);
  });
});

describe('format() with datetimes', () => {
  it('a pattern in the nearest lang, in the zone of timezone()', () => {
    expect(out('format(timezone(time(), "Asia/Tokyo"), "yyyy-MM-dd HH:mm")')).toBe('"2026-01-01 21:00"');
    expect(out('format(timezone(time(), "UTC"), HH)')).toBe('"12"'); // a keyword pattern
    expect(out('format(timezone(time(), "UTC"), "HH") + 1')).toBe('13'); // a numeric string
  });
  it('numbers and datetimes are separate', () => {
    expect(err(() => run('format(5, "HH:mm")'))).toBe('format(): a date pattern needs a date and time from time() or timezone(); 5 is a number');
    expect(err(() => run('format("12:00", "HH:mm")'))).toBe('format(): a date pattern needs a date and time from time() or timezone(); "12:00" is a string');
    expect(err(() => run('format(time(), "integer")'))).toBe(`format(): "integer" formats numbers; ${at(NOW)} is a date and time, format it with a pattern such as "HH:mm"`);
  });
  it('pattern mistakes are compile-time errors', () => {
    expect(parse('format(time(), "HH:mm", "UTC")')).toBe('a date pattern takes no third argument');
    expect(parse('format(time(), "YYYY")')).toBe(`format(): "YYYY" is not a date/time field; use yyyy, yy, M, MM, MMM, MMMM, d, dd, E, EEE, EEEE, H, HH, h, hh, m, mm, s, ss, SSS, a or 'quoted text'`);
    expect(parse("format(time(), \"HH 'h\")")).toBe(`format(): unterminated quote in "HH 'h"`);
    expect(parse('format(time(), "--")')).toBe('"--" is neither a format() style ("decimal", "integer", "percent", "currency") nor a date pattern such as "HH:mm"');
  });
});

describe('compile().uses lists value functions wherever they are (bundle analysis)', () => {
  // Steps 4–5 recorded only top-level calls in declarations, so analyze() missed these.
  const fns = (css: string) => [...compile(css).uses].filter((u) => u.startsWith('fn:')).sort();
  it('in actions, conditions, state() and inside other calls', () => {
    expect(fns('.f { --q: state("") } .f input:on(input) { --q: set(lower(event(value))) }')).toEqual(['fn:lower']);
    expect(fns('.f { --q: state("") } .c:when(includes(--q, "a")) { color: red }')).toEqual(['fn:includes']);
    expect(fns('.f { --q: state("") } .c { text: format(length(--q), "integer") }')).toEqual(['fn:format', 'fn:length']);
    expect(fns('.f { --u: state(time()) }')).toEqual(['fn:time']);
    expect(fns('.f { --u: state(time()) } .f b:on(click) { --u: set(timezone(time() + 30s, "UTC")) }')).toEqual(['fn:time', 'fn:timezone']);
  });
  it('fonts are still not counted', () => {
    expect(fns('@font-face { font-family: A; src: url(a.woff2) format("woff2") }')).toEqual([]);
  });
});

describe('corrections to steps 4–5 found here', () => {
  it('a condition call that reads no state still gets the call hook (step 5 made it lazy)', () => {
    expect(parseCondition('length("ab") == 2').calls).toEqual([]);
    expect(parseCondition('--u > time()').calls).toEqual([]);
    expect(cond('length("ab") == 2')).toBe(true);
  });
  it('without the hook a call is unknown, never Function.prototype.call (step 4 named it "call")', () => {
    const lookup: Lookup = () => { throw new Error('the lookup was called'); };
    expect(evaluate(parseCondition('time() > 0').ast, lookup)).toBeUndefined();
  });
  it('text: accepts any expression inside a value function (step 4 rejected max(), round()…)', () => {
    compile('.p { --n: state(2) } .p .t { text: format(max(0, round(up, --n / 3)), "integer") }');
    expect(diagnostics).toEqual([]);
  });
});
