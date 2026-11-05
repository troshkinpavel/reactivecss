// 0.10: the debounce(time) and throttle(time) modifiers of :on() (feature "event-timing").
// State per (rule, element), shared by every event of an `a | b` rule.

import { runtimes } from '../core/registry';
import { flushMutations } from '../core/elements';
import { activation, sync, urgently } from '../core/scheduler';
import { ms, runElement, commit, type OnRuleSpec, type Tx } from './on';

interface Pending { timer: ReturnType<typeof setTimeout>; e: Event; key: string }
const debounced = new Map<OnRuleSpec, Map<Element, Pending>>();
const throttled = new WeakMap<Element, Map<OnRuleSpec, number>>();

/** Cancels pending debounced runs of `spec` (on `el`, or on every element). */
function cancelDebounced(spec: OnRuleSpec, el?: Element) {
  const m = debounced.get(spec);
  if (!m) return;
  for (const [k, p] of m) if (!el || k === el) { clearTimeout(p.timer); m.delete(k); }
  if (!m.size) debounced.delete(spec);
}

/** A debounced rule's delayed run: the rule must still apply then (the cascade is read again). */
function runLater(el: Element, spec: OnRuleSpec, e: Event, key: string) {
  if (!el.isConnected) return;
  flushMutations(); // DOM changes made earlier in this task count
  sync();
  activation.event = null; // not a user activation any more: never arms focus requests
  urgently(() => {
    const tx: Tx = { e, writes: [], only: spec };
    runElement(el, tx, (t) => (t === spec.trigger ? key : undefined));
    commit(tx);
  });
}

runtimes.eventTiming = {
  parse(p, mods) {
    const timed = /^(debounce|throttle)\(\s*(.*?)\s*\)$/is.exec(p);
    if (!timed) {
      const bare = p.toLowerCase();
      throw new Error(bare === 'debounce' || bare === 'throttle' ? `${bare} needs a time: ${bare}(300ms)` : `unknown modifier "${p}"; use prevent() or stop()`);
    }
    const k = timed[1].toLowerCase() as 'debounce' | 'throttle';
    if (mods[k] !== undefined) throw new Error(`${k}() is given twice`);
    const t = ms(timed[2], `${k}()`);
    if (!(t > 0)) throw new Error(`${k}() needs a time above 0`);
    mods[k] = t;
  },
  check(mods, trigger) {
    if (mods.debounce !== undefined && mods.throttle !== undefined) throw new Error('use debounce() or throttle(), not both');
    if (trigger.outside || trigger.phase) throw new Error(`${mods.debounce !== undefined ? 'debounce' : 'throttle'}() is for DOM events, not ${trigger.outside ? 'outside()' : 'drag'}`);
  },
  // Whether `spec`'s mutations on `el` run now for this event: throttle drops, debounce defers.
  gate(spec, el, tx, key) {
    const { debounce, throttle } = spec.mods;
    if (tx.only === spec) return true;
    if (debounce !== undefined) {
      // Trailing edge: each event restarts the delay; the last event's values are used.
      let m = debounced.get(spec);
      if (!m) debounced.set(spec, (m = new Map()));
      clearTimeout(m.get(el)?.timer);
      const e = tx.e!;
      m.set(el, { e, key, timer: setTimeout(() => { m!.delete(el); if (!m!.size) debounced.delete(spec); runLater(el, spec, e, key); }, debounce) });
      return false;
    }
    // Leading edge: the first event runs, the next ones within the interval are dropped.
    let m = throttled.get(el);
    if (!m) throttled.set(el, (m = new Map()));
    const now = performance.now(), last = m.get(spec);
    if (last !== undefined && now - last < throttle!) return false;
    m.set(spec, now);
    return true;
  },
  drop(spec, el) {
    cancelDebounced(spec, el);
    if (el) throttled.get(el)?.delete(spec);
  },
};
