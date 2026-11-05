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
import { serialize, type Typed } from '../state/values';
import { initFns } from '../state/expr';
import { checkZone, FormatError } from './intl';

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
initFns.set('time', now);

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
