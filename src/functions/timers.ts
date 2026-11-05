// 0.10: :on(after(delay)) and :on(every(interval [, first delay])).
//
//   .toast:when(--visible):on(after(3s)) { --visible: set(false) }
//   .counter:when(--held):on(every(80ms, 400ms)) { --count: increment(1) }
//
// Activation is the rule's own selector, :when() included (on.ts watches the full selector and
// follows the :when() markers): a timer starts when the element starts matching and is
// cancelled when it stops matching or leaves the document. An unrelated state change, or a move
// inside the document, does not restart it. Matching again starts a new timer.
//
// - One timer per (element, trigger key): two active rules with the same trigger share it, and
//   the cascade picks the winning mutation per state when it fires, as for events.
// - after(): one run, `delay` after activation, never again while the rule stays active. The
//   deadline is wall-clock: in a hidden tab the browser may run it late; it then runs once.
// - every(): first run after `first` (default: one interval), then every interval from that
//   planned time (no drift). Missed runs are skipped, never replayed in a burst. Paused while
//   the page is hidden; on return the next run is one interval later.
// - Ticks are not a clock: elapsed time is time() - start (datetime), never a count.
// - A run is a transaction like an event (on.ts fireTimers): the values before the run, then all
//   writes; @media around the rule is checked by the cascade when it fires. event() is not
//   available (a compile-time error).

import { fireTimers, type Trigger } from '../state/on';
import { runtimes, runtimeStats } from '../core/registry';

interface Timer { el: Element; t: Trigger; refs: number; due: number; bucket?: number; paused?: boolean }

/**
 * Timers due at the same moment share one setTimeout and one transaction (a page that starts
 * 500 every(1s) rules together runs them as one batch). Times are taken once per task, so every
 * timer started in one task (one stylesheet, one :when() frame) lands in one bucket, and every()
 * keeps them together from there.
 */
const buckets = new Map<number, { handle: ReturnType<typeof setTimeout>; timers: Set<Timer> }>();
const timers = new Map<Element, Map<string, Timer>>();
/** every() timers, paused while the page is hidden. */
const repeating = new Set<Timer>();
const hidden = () => document.visibilityState === 'hidden';
let taskNow: number | undefined;
function now(): number {
  if (taskNow === undefined) { taskNow = performance.now(); queueMicrotask(() => { taskNow = undefined; }); }
  return taskNow;
}

function arm(r: Timer, due: number) {
  unarm(r);
  r.due = due;
  let b = buckets.get(due);
  if (!b) buckets.set(due, (b = { timers: new Set(), handle: setTimeout(() => fire(due), Math.max(0, due - performance.now())) }));
  b.timers.add(r);
  r.bucket = due;
}

function unarm(r: Timer) {
  if (r.bucket === undefined) return;
  const b = buckets.get(r.bucket)!;
  b.timers.delete(r);
  if (!b.timers.size) { clearTimeout(b.handle); buckets.delete(r.bucket); }
  r.bucket = undefined;
}

function fire(due: number) {
  const b = buckets.get(due);
  if (!b) return;
  buckets.delete(due);
  const list: [Element, string][] = [];
  for (const r of b.timers) {
    r.bucket = undefined;
    const every = r.t.timer!.every;
    if (every !== undefined) {
      if (hidden()) { r.paused = true; continue; }
      let next = r.due + every;
      if (next <= now()) next = now() + every; // throttled or blocked: skip, do not replay
      arm(r, next);
    }
    list.push([r.el, r.t.key]);
  }
  fireTimers(list);
}

function onVisibility() {
  if (hidden()) {
    for (const r of repeating) if (r.bucket !== undefined) { unarm(r); r.paused = true; }
    return;
  }
  for (const r of repeating) if (r.paused) { r.paused = false; arm(r, now() + r.t.timer!.every!); }
}

runtimes.timers = {
  start(el, t) {
    let m = timers.get(el);
    if (!m) timers.set(el, (m = new Map()));
    const old = m.get(t.key);
    if (old) { old.refs++; return; } // another active rule with the same trigger: one timer
    const r: Timer = { el, t, refs: 1, due: 0 };
    m.set(t.key, r);
    runtimeStats.sources++;
    if (t.timer!.every !== undefined) {
      if (!repeating.size) document.addEventListener('visibilitychange', onVisibility);
      repeating.add(r);
      if (hidden()) { r.paused = true; return; }
    }
    arm(r, now() + t.timer!.first);
  },
  stop(el, t) {
    const m = timers.get(el);
    const r = m?.get(t.key);
    if (!r || --r.refs > 0) return;
    unarm(r);
    m!.delete(t.key);
    if (!m!.size) timers.delete(el);
    runtimeStats.sources--;
    if (repeating.delete(r) && !repeating.size) document.removeEventListener('visibilitychange', onVisibility);
  },
};
