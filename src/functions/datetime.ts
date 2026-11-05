// 0.10: time() and timezone(value, "Area/City").
//
//   .resend { --until: state(time()) }
//   .resend button:on(click) { --until: set(time() + 30s) }
//   .clock { text: format(timezone(time(), "Asia/Tokyo"), "HH:mm") }
//
// - time() is the current instant (Unix epoch milliseconds, a datetime value). Every time() read
//   in one task gives the same instant, so values computed together never straddle a second.
//   It is a value, not a timer: live(…, interval) re-reads it.
// - A datetime serializes to its epoch milliseconds in CSS (calc(), counters). Arithmetic:
//   datetime ± duration (30s, 500ms) = datetime; datetime - datetime = duration in ms.
//   Comparisons: with a datetime or a number of epoch ms. A plain number is never a datetime.
// - timezone() keeps the instant and sets the IANA zone format() shows it in (daylight saving
//   comes from the browser's time zone data). Without timezone(), format() uses the browser's zone.

import { valueFunction } from './calls';
import { EvalError } from '../state/actexpr';
import { serialize, convert, datetimeOps, ConditionError, type Typed } from '../state/values';
import { initFns } from '../state/expr';
import { FormatError } from './intl';
import { checkZone } from './dates';

let frozen: number | undefined;
/** The instant for this task (cleared in a microtask). */
function now(): Typed {
  if (frozen === undefined) {
    frozen = Date.now();
    queueMicrotask(() => { frozen = undefined; });
  }
  return { type: 'datetime', v: frozen };
}

valueFunction('time', 'time()', { min: 0, max: 0, eval: now });
// --until: state(time()): a datetime state (a later set(time() + 30s) keeps the type).
const INIT = 'time';
initFns.set(INIT, (args) => {
  if (args.some((a) => a.trim())) throw new Error(`${INIT}() takes no arguments here`);
  return { k: 'fn', get: now };
});

// A datetime compares with a datetime or with a number of epoch milliseconds, by instant.
datetimeOps.compare = (a, b) => {
  const ms = (t: Typed) => (t.type === 'datetime' || t.type === 'number' ? (t.v as number) : undefined);
  const x = ms(a), y = ms(b);
  if (x === undefined || y === undefined) throw new ConditionError(`cannot compare ${serialize(a)} (${a.type}) with ${serialize(b)} (${b.type})`);
  return [{ type: 'number', v: x, unit: '' }, { type: 'number', v: y, unit: '' }];
};

// datetime ± duration = datetime (same zone); datetime - datetime = duration in ms. A plain number is never a time.
datetimeOps.arith = (op, x, y) => {
  if (x.type === 'datetime' && y.type === 'datetime') {
    if (op !== '-') throw new EvalError(`only subtraction works on two datetimes (it gives the duration between them), not ${op}`);
    return { type: 'dimension', v: (x.v as number) - (y.v as number), unit: 'ms' };
  }
  const [d, other] = x.type === 'datetime' ? [x, y] : [y, x];
  const delta = other.type === 'dimension' ? convert({ type: 'dimension', v: 0, unit: 'ms' }, other) : undefined;
  if ((op !== '+' && op !== '-') || delta === undefined || (op === '-' && d === y))
    throw new EvalError(`${serialize(x)} ${op} ${serialize(y)}: a datetime takes + or - with a time like 30s or 500ms`);
  return { ...d, v: (d.v as number) + (op === '+' ? delta : -delta) };
};

valueFunction('timezone', 'timezone(datetime, "Area/City")', {
  min: 2, max: 2,
  check([, z]) {
    if (z.k !== 'lit') return; // a zone from a state is checked when evaluated
    if (z.t.type !== 'string') throw new Error('the zone of timezone() is a quoted IANA name, e.g. "Europe/London"');
    try { checkZone(z.t.v as string); } catch { throw new Error(`timezone(): unknown time zone "${z.t.v}"`); }
  },
  eval([v, z]) {
    if (v.type !== 'datetime') throw new EvalError(`timezone() needs a date and time from time(); ${serialize(v)} is a ${v.type}`);
    if (z.type !== 'string') throw new EvalError('the zone of timezone() is a quoted IANA name');
    try { checkZone(z.v as string); } catch (e) { if (e instanceof FormatError) throw new EvalError(`timezone(): unknown time zone "${z.v}"`); throw e; }
    return { type: 'datetime', v: v.v, zone: z.v as string };
  },
});
