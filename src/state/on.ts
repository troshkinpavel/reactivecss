// :on() rules (0.9.0): `.button:on(click) { --count: increment(1) }`.
// Semantics: docs/rfc-v0.9.0-language.md, sections 2–5.
//
// - The parser compiles each :on() rule to an ordinary rule whose declarations are generated slot
//   properties: one per (trigger, state), valued with a mutation id, and one per (trigger,
//   modifier). Registered with inherits: false, so the browser's cascade picks one winning
//   mutation per state for each element, and a modifier applies when any rule gives it.
// - One capturing document listener per DOM event type (shared with the legacy on: runtime in
//   actions.ts) finds the candidate elements on the event path. A single unconditional candidate
//   rule needs no style read; otherwise one getComputedStyle() per element.
// - Each event is a transaction: every winning mutation on the path is evaluated against the
//   values before the event, then all writes are committed, innermost element first.

import { runtimeStats, runtimes, onEventNames } from '../core/registry';
import { warn } from '../core/log';
import type { Watcher } from '../core/elements';
import { parseKey, keyMatches, type KeySpec } from './keys';
import { resolveCell, warnMissing, describeElement, type Cell } from './state';
import { parseTyped, assignable, coerce, serialize, equal, type Typed } from './values';
import { parseAction, evaluateAction, type Category, type Node, type DragInfo, type EvalCtx } from './actexpr';
import { listen, cancel, preventEvent, editable, extensions } from './actions';
import { activation, sync, urgently } from '../core/scheduler';
import { flushMutations } from '../core/elements';

/** DOM events :on() accepts: [bubbles, cancelable, category]. Adding an event is one row. */
export const EVENT_INFO: Record<string, [boolean, boolean, Category]> = {
  click: [true, true, 'pointer'], dblclick: [true, true, 'mouse'], contextmenu: [true, true, 'pointer'],
  pointerdown: [true, true, 'pointer'], pointerup: [true, false, 'pointer'], pointermove: [true, false, 'pointer'],
  pointerenter: [false, false, 'pointer'], pointerleave: [false, false, 'pointer'], pointercancel: [true, false, 'pointer'],
  mousedown: [true, true, 'mouse'], mouseup: [true, false, 'mouse'], mousemove: [true, false, 'mouse'],
  mouseenter: [false, false, 'mouse'], mouseleave: [false, false, 'mouse'],
  input: [true, false, 'form'], change: [true, false, 'form'], submit: [true, true, 'other'], reset: [true, false, 'other'],
  keydown: [true, true, 'keyboard'], keyup: [true, true, 'keyboard'],
  focus: [false, false, 'focus'], blur: [false, false, 'focus'], focusin: [true, false, 'focus'], focusout: [true, false, 'focus'],
  // The element's own animations and transitions only (a child's does not count), as in 0.5.1.
  animationstart: [false, false, 'other'], animationend: [false, false, 'other'], animationcancel: [false, false, 'other'],
  transitionend: [false, false, 'other'], transitioncancel: [false, false, 'other'],
  scroll: [false, false, 'scroll'], scrollend: [false, false, 'scroll'], toggle: [false, false, 'other'],
};
const OUTSIDE = new Set(['click', 'pointerdown', 'focusin']);
const TIME = /^(\d*\.?\d+)(ms|s)$/i;
/** Milliseconds of a CSS time literal; `what` names the place for the message. */
function ms(text: string, what: string): number {
  const m = TIME.exec(text);
  if (!m) throw new Error(`${what} takes a time like 300ms or 2s, got "${text}"`);
  return +m[1] * (m[2].toLowerCase() === 's' ? 1000 : 1);
}
const PHASES = new Set(['start', 'move', 'end', 'cancel']);

export interface Trigger {
  /** Canonical text: the slot key. "click", "keydown(escape)", "outside:click", "drag:move". */
  key: string;
  /** DOM event type to listen to ("pointerdown" for drag). */
  dom: string;
  category: Category;
  filter?: KeySpec;
  outside?: boolean;
  /** Drag phase, for :on(drag(...)). */
  phase?: string;
  cancelable: boolean;
  /** 0.10: `a | b | c`, one rule for several DOM events (each has its own slots). */
  members?: Trigger[];
}
/** Functional modifiers of :on(): prevent() and stop(); 0.10: debounce(t), throttle(t) in ms. */
export interface Modifiers { prevent: boolean; stop: boolean; debounce?: number; throttle?: number }
export type Op = 'set' | 'toggle' | 'increment' | 'decrement' | 'cycle';
export interface Mutation { id: number; name: string; op: Op; expr?: Node; values?: Typed[]; rule?: OnRuleSpec }
export interface OnRuleSpec {
  id: number;
  trigger: Trigger;
  mods: Modifiers;
  /** `key`: the trigger key the slot answers (a member's key for `a | b`). */
  slots: { prop: string; m: Mutation; key: string }[];
  /** Modifier slot properties (valued with the rule id). */
  modSlots: { prevent?: string; stop?: string };
  certain: boolean;
}

// ---- compile time (called by the parser through runtimes.onRules) -------------------------

/** `click`, `keydown(Escape)`, `outside(click)`, `drag(start)`, `click | keydown(Enter)` and the modifiers prevent() / stop(), as written in :on(). */
export function compileTrigger(text: string): { trigger: Trigger; mods: Modifiers } {
  const parts = splitTop(text);
  if (!parts.length || !parts[0]) throw new Error(':on() needs an event, e.g. :on(click)');
  const alts = splitTop(parts[0], '|');
  let trigger: Trigger;
  if (alts.length > 1) {
    if (alts.some((a) => !a)) throw new Error(`an event is missing around "|" in "${parts[0]}"`);
    const members = alts.map(single);
    for (const t of members) if (t.outside || t.phase !== undefined)
      throw new Error(`${t.outside ? `outside(${t.dom})` : `drag(${t.phase})`} cannot be combined with other events in one :on(); write one rule for it`);
    const keys = members.map((t) => t.key);
    const dup = keys.find((k, i) => keys.indexOf(k) !== i);
    if (dup) throw new Error(`${dup} is listed twice in :on(${parts[0]})`);
    const cats = new Set(members.map((t) => t.category));
    trigger = {
      key: keys.join('|'), dom: members[0].dom, members,
      // event() fields: those of the shared category; mixed categories give only the common ones (event(type)).
      category: cats.size === 1 ? members[0].category : 'other',
      cancelable: members.every((t) => t.cancelable),
    };
  } else trigger = single(parts[0]);
  const mods: Modifiers = { prevent: false, stop: false };
  for (const p of parts.slice(1)) {
    const timed = /^(debounce|throttle)\(\s*(.*?)\s*\)$/is.exec(p);
    if (timed) {
      const k = timed[1].toLowerCase() as 'debounce' | 'throttle';
      if (mods[k] !== undefined) throw new Error(`${k}() is given twice`);
      const t = ms(timed[2], `${k}()`);
      if (!(t > 0)) throw new Error(`${k}() needs a time above 0`);
      mods[k] = t;
      continue;
    }
    const fn = /^(prevent|stop)\(\s*\)$/i.exec(p);
    if (!fn) {
      const bare = p.toLowerCase();
      throw new Error(bare === 'prevent' || bare === 'stop' ? `write the modifier as a function: ${bare}()`
        : /^once(\(\s*\))?$/.test(bare) ? 'once is not supported in :on(); for a one-time change, guard the rule with :when(), e.g. .b:when(not --done):on(click) { --done: set(true) }'
        : bare === 'debounce' || bare === 'throttle' ? `${bare} needs a time: ${bare}(300ms)`
        : `unknown modifier "${p}"; use prevent() or stop()`);
    }
    const k = fn[1].toLowerCase() as 'prevent' | 'stop';
    if (mods[k]) throw new Error(`${k}() is given twice`);
    mods[k] = true;
  }
  if (mods.prevent && !trigger.cancelable)
    throw new Error(trigger.outside ? 'prevent() is not allowed with outside(): it would cancel events on unrelated elements anywhere on the page'
      : `prevent() needs a cancelable event (click, dblclick, contextmenu, mousedown, pointerdown, keydown, keyup, submit, drag); ${(trigger.members?.find((t) => !t.cancelable) ?? trigger).key} is not`);
  if (mods.stop && (trigger.outside || trigger.phase)) throw new Error(`stop() has no meaning for ${trigger.outside ? 'outside()' : 'drag'}`);
  if (mods.debounce !== undefined && mods.throttle !== undefined) throw new Error('use debounce() or throttle(), not both');
  if ((mods.debounce !== undefined || mods.throttle !== undefined) && (trigger.outside || trigger.phase))
    throw new Error(`${mods.debounce !== undefined ? 'debounce' : 'throttle'}() is for DOM events, not ${trigger.outside ? 'outside()' : 'drag'}`);
  return { trigger, mods };
}

/** One trigger as written in :on(): an event, keydown(Key), outside(event) or drag(phase). */
function single(part: string): Trigger {
  const m = /^([a-z-]+)(?:\(\s*(.*?)\s*\))?$/is.exec(part);
  if (!m) throw new Error(`cannot read the trigger "${part}"`);
  const name = m[1].toLowerCase(), arg = m[2];
  let trigger: Trigger;
  if (name === 'drag') {
    const phase = (arg ?? 'move').toLowerCase();
    if (!PHASES.has(phase)) throw new Error(`drag() takes start, move, end or cancel; got "${arg}"`);
    if (!runtimes.gestures) throw new Error('feature:gestures');
    trigger = { key: 'drag:' + phase, dom: 'pointerdown', category: 'drag', phase, cancelable: true };
  } else if (name === 'outside') {
    const ev = (arg ?? '').toLowerCase();
    if (!OUTSIDE.has(ev)) throw new Error(`outside() takes one of: ${[...OUTSIDE].join(', ')}; got "${arg ?? ''}"`);
    trigger = { key: 'outside:' + ev, dom: ev, category: EVENT_INFO[ev][2], outside: true, cancelable: false };
  } else {
    const info = EVENT_INFO[name];
    if (!info) throw new Error(`unknown event "${name}"; supported: ${Object.keys(EVENT_INFO).join(', ')}, outside(…), drag`);
    if (arg !== undefined && name !== 'keydown' && name !== 'keyup') throw new Error(`${name} takes no argument (key filters are for keydown(Key) and keyup(Key))`);
    const filter = arg === undefined ? undefined : parseKey(arg);
    trigger = { key: filter ? `${name}(${arg!.toLowerCase()})` : name, dom: name, category: info[2], filter, cancelable: info[1] };
  }
  return trigger;
}

/** `--count: increment(1)` in a rule with `trigger`. */
export function compileMutation(name: string, text: string, trigger: Trigger): Omit<Mutation, 'id'> {
  const m = /^([a-z-]+)\(([\s\S]*)\)$/i.exec(text.trim());
  const op = m?.[1].toLowerCase() as Op;
  if (!m || !['set', 'toggle', 'increment', 'decrement', 'cycle'].includes(op))
    throw new Error(`expected set(value), toggle(), increment(step?), decrement(step?) or cycle(a, b, …), got "${text.trim()}"`);
  const body = m[2].trim();
  const where = `${name} in :on(${trigger.key})`;
  try {
    if (op === 'toggle') { if (body) throw new Error('toggle() takes no arguments'); return { name, op }; }
    if (op === 'cycle') {
      const values = splitTop(body).map((v) => parseTyped(v));
      if (values.length < 2) throw new Error('cycle() needs at least two values');
      return { name, op, values };
    }
    if (op === 'set' && !body) throw new Error('set() needs a value');
    return { name, op, expr: body ? parseAction(body, trigger.category, trigger.key) : undefined };
  } catch (e) { throw new Error(`${op}() for ${where}: ${(e as Error).message}`); }
}

/** Splits at depth-0 commas, or `sep` (outside quotes and parentheses); trims. */
function splitTop(s: string, sep = ','): string[] {
  const out: string[] = [];
  let depth = 0, q = '', cur = '';
  for (const c of s) {
    if (q) { if (c === q) q = ''; cur += c; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === sep && !depth) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim() || out.length) out.push(cur.trim());
  return out;
}

// ---- runtime --------------------------------------------------------------------------

interface Candidate { spec: OnRuleSpec; sheet?: CSSStyleSheet }
const candidates = new WeakMap<Element, Candidate[]>();
const outsiders = new Map<Element, number>();
const mutations = new Map<number, Mutation>();
const registeredProps = new Set<string>();

const applies = (c: Candidate) =>
  c.spec.certain && (!c.sheet || (!c.sheet.disabled && (!c.sheet.media.length || matchMedia(c.sheet.media.mediaText).matches)));

function registerProp(name: string) {
  if (registeredProps.has(name)) return;
  registeredProps.add(name);
  try { CSS.registerProperty({ name, syntax: '*', inherits: false }); } catch (e) {
    if (!(e instanceof DOMException && e.name === 'InvalidModificationError'))
      warn(':on() needs CSS.registerProperty() (Chrome 78+, Safari 16.4+, Firefox 128+); event rules may also apply to descendants.');
  }
}

/** Makes a compiled rule live; returns its cleanup. */
export function registerRule(spec: OnRuleSpec): () => void {
  for (const s of spec.slots) { mutations.set(s.m.id, s.m); registerProp(s.prop); }
  if (spec.modSlots.prevent) registerProp(spec.modSlots.prevent);
  if (spec.modSlots.stop) registerProp(spec.modSlots.stop);
  const gesture = spec.trigger.phase !== undefined;
  const release = gesture ? runtimes.gestures!.register(spec.mods.prevent) : undefined;
  const doms = [...new Set(spec.trigger.members?.map((t) => t.dom) ?? [spec.trigger.dom])];
  if (!gesture) for (const d of doms) { listen(d, 1); if (spec.mods.prevent) cancel(d, 1); }
  return () => {
    for (const s of spec.slots) mutations.delete(s.m.id);
    cancelDebounced(spec);
    if (release) release();
    else for (const d of doms) { if (spec.mods.prevent) cancel(d, -1); listen(d, -1); }
  };
}

/** Tracks the elements a rule may apply to; only these are checked on events. */
export function ruleWatcher(match: string, spec: OnRuleSpec, sheet?: CSSStyleSheet): Watcher {
  const entry: Candidate = { spec, sheet };
  return {
    selector: match,
    followsOwned: true,
    add(el) {
      const list = candidates.get(el);
      if (list) list.push(entry); else candidates.set(el, [entry]);
      if (spec.trigger.outside) outsiders.set(el, (outsiders.get(el) ?? 0) + 1);
      runtimeStats.bindings++;
    },
    remove(el) {
      const list = candidates.get(el);
      const i = list ? list.indexOf(entry) : -1;
      if (i < 0) return;
      list!.splice(i, 1);
      if (!list!.length) candidates.delete(el);
      if (spec.trigger.outside) { const n = (outsiders.get(el) ?? 1) - 1; if (n) outsiders.set(el, n); else outsiders.delete(el); }
      cancelDebounced(spec, el);
      throttled.get(el)?.delete(spec);
      runtimeStats.bindings--;
    },
  };
}

const dragRules = (el: Element) => candidates.get(el)?.filter((c) => c.spec.trigger.phase !== undefined) ?? [];
/** A drag rule of `el` applies now: unconditional, or one of its slots has a computed value. */
function dragApplies(el: Element, prevent = false): boolean {
  let cs: CSSStyleDeclaration | undefined;
  for (const c of dragRules(el)) {
    if (prevent && !c.spec.mods.prevent) continue;
    if (applies(c)) return true;
    const props = prevent ? [c.spec.modSlots.prevent!] : [...c.spec.slots.map((s) => s.prop), ...Object.values(c.spec.modSlots)];
    cs ??= getComputedStyle(el);
    if (props.some((p) => p && cs!.getPropertyValue(p).trim())) return true;
  }
  return false;
}
/** gesture.ts: the innermost element on the path with an applicable drag rule. */
export const dragTarget = Object.assign(
  (path: EventTarget[]) => path.find((n): n is Element => n instanceof Element && dragRules(n).length > 0 && dragApplies(n)),
  { has: (el: Element) => dragRules(el).length > 0, prevents: (el: Element) => dragApplies(el, true) },
);

interface Write { cell: Cell; v: Typed; where: () => string }
interface Tx {
  e: Event; writes: Write[]; drag?: DragInfo; rects?: Map<Element, DOMRect>;
  /** 0.10: a debounced run of this rule only (its delay ended). */
  only?: OnRuleSpec;
}

// ---- 0.10: debounce() and throttle() -------------------------------------------------------
// State per (rule, element), shared by every event of an `a | b` rule.

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

/** Whether `spec`'s mutations on `el` run now for this event: throttle drops, debounce defers. */
function gate(spec: OnRuleSpec, el: Element, tx: Tx, key: string): boolean {
  const { debounce, throttle } = spec.mods;
  if (tx.only === spec) return true;
  if (debounce !== undefined) {
    // Trailing edge: each event restarts the delay; the last event's values are used.
    let m = debounced.get(spec);
    if (!m) debounced.set(spec, (m = new Map()));
    clearTimeout(m.get(el)?.timer);
    const e = tx.e;
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


/** A value `v` stored in a cell holding `cur` (0.9 adds a unitless 0 for dimensions, 0 / 1 for booleans). */
function fit(cur: Typed, v: Typed): Typed | undefined {
  if (cur.type === 'dimension' && v.type === 'number' && v.v === 0) return { ...cur, v: 0 };
  if (cur.type === 'boolean' && v.type === 'number' && (v.v === 0 || v.v === 1)) return { type: 'boolean', v: v.v === 1 };
  return assignable(cur, v) ? coerce(cur, v) : undefined;
}

function compute(m: Mutation, cell: Cell, ctx: EvalCtx, where: () => string): Typed | undefined {
  const cur = cell.value;
  switch (m.op) {
    case 'set': return evaluateAction(m.expr!, ctx, where);
    case 'toggle':
      if (cur.type !== 'boolean') { warn(`${where()}: toggle() needs a boolean state; ${m.name} holds ${serialize(cur)}.`); return undefined; }
      return { type: 'boolean', v: !cur.v };
    case 'cycle': {
      const values = m.values!.map((v) => fit(cur, v));
      if (values.some((v) => !v)) { warn(`${where()}: cycle() values cannot be stored in ${m.name} (${cur.type}).`); return undefined; }
      const i = values.findIndex((v) => equal(v!, cur));
      return values[(i + 1) % values.length];
    }
    default: {
      if (cur.type !== 'number' && cur.type !== 'dimension') { warn(`${where()}: ${m.op}() needs a number or dimension state; ${m.name} holds ${serialize(cur)}.`); return undefined; }
      const step = m.expr ? evaluateAction(m.expr, ctx, where) : { ...cur, v: 1 };
      if (!step) return undefined;
      const s = fit(cur, step);
      if (!s || s.type === 'boolean') { warn(`${where()}: the step ${serialize(step)} does not match the unit of ${m.name} (${serialize(cur)}).`); return undefined; }
      const sign = m.op === 'increment' ? 1 : -1;
      return { ...cur, v: Math.round(((cur.v as number) + sign * (s.v as number)) * 1e6) / 1e6 };
    }
  }
}

/** The key `t` answers with when `test` accepts it (or one of its `a | b` members), else undefined. */
const keyFor = (t: Trigger, test: (m: Trigger) => boolean) => (t.members ? t.members.find(test)?.key : test(t) ? t.key : undefined);

/**
 * Runs the rules of `el` whose trigger matches (`match` returns the matched key): winners per
 * slot, then modifiers. Returns true when a rule with `stop` ran (the caller then skips the
 * element's ancestors).
 */
function runElement(el: Element, tx: Tx, match: (t: Trigger) => string | undefined): boolean {
  const all = candidates.get(el);
  if (!all) return false;
  let keys: Map<OnRuleSpec, string> | undefined; // the member that matched, for `a | b` rules
  const hit = (c: Candidate) => {
    const k = match(c.spec.trigger);
    if (k !== undefined && c.spec.trigger.members) (keys ??= new Map()).set(c.spec, k);
    return k !== undefined;
  };
  const cands = all.length === 1 ? (hit(all[0]) ? all : []) : all.filter(hit);
  if (!cands.length) return false;
  /** The candidate's slots for this event: all of them, except in an `a | b` rule (the matched member's). */
  const slots = (c: Candidate) => (c.spec.trigger.members ? c.spec.slots.filter((s) => s.key === keys!.get(c.spec)) : c.spec.slots);
  let gates: Map<OnRuleSpec, boolean> | undefined; // debounce / throttle: decided once per rule, element and event
  const run = (m: Mutation | undefined) => {
    if (!m || !m.rule) return;
    if (tx.only && m.rule !== tx.only) return; // a debounced run executes only its own rule
    const r = m.rule;
    if (r.mods.debounce !== undefined || r.mods.throttle !== undefined) {
      let g = gates?.get(r);
      if (g === undefined) (gates ??= new Map()).set(r, (g = gate(r, el, tx, keys?.get(r) ?? r.trigger.key)));
      if (!g) return;
    }
    const cell = resolveCell(el, m.name);
    // Built only for a diagnostic: describing the element on every event cost more than the mutation.
    const where = () => `${m.name}: ${m.op}() on ${describeElement(el)} for :on(${m.rule!.trigger.key})`;
    if (!cell) { warnMissing(m.name, el, `:on(${m.rule.trigger.key}) on ${describeElement(el)}`); return; }
    const ctx: EvalCtx = { e: tx.e, el, target: cell, drag: tx.drag, rects: tx.rects };
    const v = compute(m, cell, ctx, where);
    tx.rects ??= ctx.rects; // one layout read per element per event, created only when a mutation reads geometry
    if (v) tx.writes.push({ cell, v, where });
  };
  let cs: CSSStyleDeclaration | undefined;
  const style = () => (cs ??= getComputedStyle(el));
  if (cands.length === 1 && applies(cands[0])) {
    // Fast path: one unconditional rule, no cascade question.
    for (const s of slots(cands[0])) run(s.m);
  } else {
    // Several rules: without a conditional rule or two rules for one state there is no cascade
    // question; otherwise the computed slot values pick each winner.
    const props = new Map<string, Mutation>();
    let read = false;
    for (const c of cands) {
      if (!applies(c)) read = true;
      for (const s of slots(c)) { if (props.has(s.prop)) read = true; props.set(s.prop, s.m); }
    }
    for (const [prop, m] of props) {
      if (!read) { run(m); continue; }
      const id = +style().getPropertyValue(prop).trim();
      run(id ? mutations.get(id) : undefined);
    }
  }
  // A modifier applies when any applicable rule for this trigger gives it (its slot has a value).
  const modifier = (k: 'prevent' | 'stop') => cands.some((c) => {
    const prop = c.spec.modSlots[k];
    return !!prop && (applies(c) || style().getPropertyValue(prop).trim() !== '');
  });
  if (tx.only) return false; // a debounced run: the event is over
  if (modifier('prevent') && tx.drag === undefined) preventEvent(el, tx.e);
  const stop = modifier('stop');
  if (stop) {
    // Stop native propagation when the event reaches the element (never in the capture phase).
    const e = tx.e, type = e.type;
    const f = (ev: Event) => { el.removeEventListener(type, f); if (ev === e) ev.stopPropagation(); };
    el.addEventListener(type, f);
    setTimeout(() => el.removeEventListener(type, f));
  }
  return stop;
}

/** Applies the writes in order; when one cell is written twice, only the last write (the outer element) applies. */
function commit(tx: Tx) {
  const w0 = tx.writes;
  const list = w0.length < 2 ? w0 : w0.filter((w, i) => !w0.some((x, j) => j > i && x.cell === w.cell));
  for (const w of list) {
    if (w.cell.dead) continue;
    const v = fit(w.cell.value, w.v);
    if (!v) { warn(`${w.where()}: ${serialize(w.v)} cannot be stored in ${w.cell.name}, which holds ${serialize(w.cell.value)}.`); continue; }
    w.cell.set(v);
  }
}

/** The element whose next click runs no :on() rules (the end of a drag); set by gesture.ts. */
export const afterDrag: { el: Element | null } = { el: null };

/** One DOM event: called by the shared dispatcher in actions.ts with the event path. */
function dispatch(e: Event, path: EventTarget[]) {
  const type = e.type;
  const info = EVENT_INFO[type];
  if (type === 'click' && afterDrag.el && path.includes(afterDrag.el)) return;
  const tx: Tx = { e, writes: [] };
  const key = type === 'keydown' || type === 'keyup';
  const match = (t: Trigger) => keyFor(t, (m) => m.dom === type && !m.outside && m.phase === undefined && (!m.filter || keyAllowed(m.filter, e as KeyboardEvent)));
  const own = info?.[0] ? path : path.slice(0, 1);
  for (const node of own) if (node instanceof Element && runElement(node, tx, match)) break;
  commit(tx);
  if (outsiders.size && OUTSIDE.has(type) && !key) {
    activation.event = null; // outside() dismissals never arm focus requests
    const out: Tx = { e, writes: [], rects: tx.rects };
    const outside = (t: Trigger) => (t.outside === true && t.dom === type ? t.key : undefined);
    for (const el of [...outsiders.keys()]) if (!path.includes(el)) runElement(el, out, outside);
    commit(out);
  }
}

function keyAllowed(spec: KeySpec, e: KeyboardEvent) {
  if (!keyMatches(spec, e)) return false;
  // Typing a character into a field is not a shortcut (as for key()).
  return !(spec.printable && !spec.ctrl && !spec.alt && !spec.meta && editable(e.target));
}

/** A drag phase on its element (gesture.ts). */
export function fireDrag(el: Element, phase: string, e: Event, drag: DragInfo) {
  const tx: Tx = { e, writes: [], drag };
  runElement(el, tx, (t) => (t.phase === phase ? t.key : undefined));
  commit(tx);
}

extensions.dispatch = dispatch;
onEventNames.push(...Object.keys(EVENT_INFO));
runtimes.onRules = { trigger: compileTrigger, mutation: compileMutation, watcher: ruleWatcher, register: registerRule };
