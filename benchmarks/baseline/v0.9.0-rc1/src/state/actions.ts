// `on:` declarations and the built-in actions set(), toggle(), increment(), decrement().
//
// `on: click(toggle(--open))` compiles to `--rcss-on: <id>`, a property registered with
// inherits: false. One capturing listener per event type on the document (installed only
// while some rule uses that event) finds the elements on the event path that match an
// `on:` rule and reads their computed --rcss-on. So the cascade decides which `on:`
// declaration applies (specificity, source order, media queries, :hover...), exactly as for
// any other property. Bubbling events (click, change, input) run handlers on the target and
// its ancestors, innermost first; the others only on their target.

import { defineAction, runtimeStats, runtimes, type ActionDef } from '../core/registry';
import { urgently, sync, activation } from '../core/scheduler';
import { warn, note, dev, probes } from '../core/log';
import type { Watcher } from '../core/elements';
import { resolveCell, warnMissing, describeElement } from './state';
import { parseTyped, assignable, coerce, serialize, equal, type Typed } from './values';
import { keyMatches, type KeySpec } from './keys';
import { parseExpr, evaluate, type Expr } from './expr';

export interface Action { def: ActionDef; data: unknown }
export interface Handler { key?: KeySpec; actions: Action[] }
/**
 * Trigger -> handlers, for one `on:` declaration. Triggers are DOM event types ("click",
 * "keydown" for key()) or "outside:<type>" for outside().
 */
export type HandlerSet = Map<string, Handler[]>;

const BUBBLES = new Set(['click', 'change', 'input', 'keydown', 'focusin', 'focusout', 'reset']);
const handlerSets = new Map<number, HandlerSet>();
interface Candidate { id: number; certain: boolean; sheet?: CSSStyleSheet }
/** Per element: the `on:` rules (handler id, certain) whose candidate selector matches it. */
const candidates = new WeakMap<Element, Candidate[]>();

/** The rule surely applies: unconditional, and its sheet is enabled with matching media. */
const applies = (c: Candidate) =>
  c.certain && (!c.sheet || (!c.sheet.disabled && (!c.sheet.media.length || matchMedia(c.sheet.media.mediaText).matches)));
/** Elements whose candidate rules use outside(): the only ones checked for outside events. */
const outsiders = new Map<Element, number>();

const EDITABLE = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date', 'time', 'datetime-local', 'month', 'week']);
export function editable(t: EventTarget | null) {
  return t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t instanceof HTMLElement && t.isContentEditable)
    || (t instanceof HTMLInputElement && EDITABLE.has(t.type));
}

/** The handler set that applies to `el` (cascade-resolved only when needed). */
function handlersOf(el: Element): HandlerSet | undefined {
  const rules = candidates.get(el);
  if (!rules) return undefined;
  // One unconditional rule: it applies, no cascade question. Otherwise ask the cascade
  // (computed --rcss-on), which may force a pending style recalculation.
  const id = rules.length === 1 && applies(rules[0]) ? rules[0].id : +getComputedStyle(el).getPropertyValue('--rcss-on').trim();
  return id ? handlerSets.get(id) : undefined;
}

function run(el: Element, list: Handler[] | undefined, e: Event) {
  if (!list) return;
  for (const h of list) {
    if (h.key) {
      const k = e as KeyboardEvent;
      if (!keyMatches(h.key, k)) continue;
      // Typing a character into a field is not a shortcut.
      if (h.key.printable && !h.key.ctrl && !h.key.alt && !h.key.meta && editable(e.target)) continue;
    }
    for (const a of h.actions) a.def.run(el, a.data, e);
  }
}
const listening = new Map<string, number>();
if (dev) Object.assign(probes, { outsiders: () => outsiders.size, handlerSets: () => handlerSets.size, actionListeners: () => listening.size, cancelingTypes: () => cancelers.size });
let registered = false;

function register() {
  if (registered) return;
  registered = true;
  try {
    CSS.registerProperty({ name: '--rcss-on', syntax: '*', inherits: false });
  } catch (e) {
    // Already registered (another copy of the library) is fine; missing support is not.
    if (!(e instanceof DOMException && e.name === 'InvalidModificationError'))
      warn('on: needs CSS.registerProperty() (Chrome 78+, Safari 16.4+, Firefox 128+); event actions may also run on descendants.');
  }
}

/**
 * key() scope: the focused element and its ancestors. When nothing is focused (Safari does not
 * focus buttons on click), the element last pressed with the pointer stands in for focus.
 */
let lastPressed: WeakRef<Element> | undefined;
const onPress = (e: Event) => { if (e.target instanceof Element) lastPressed = new WeakRef(e.target); };

function keyPath(e: Event): EventTarget[] {
  const path = e.composedPath();
  const t = e.target;
  if (t !== document.body && t !== document.documentElement) return path;
  const pressed = lastPressed?.deref();
  if (!pressed?.isConnected) return path;
  const out: Element[] = [];
  for (let a: Element | null = pressed; a; a = a.parentElement) out.push(a);
  return out;
}

/** The :on() runtime (on.ts) hooks into the same listeners: one dispatcher per event type. */
export const extensions: { dispatch?: (e: Event, path: EventTarget[]) => void } = {};

function dispatch(e: Event) {
  sync(); // an earlier action in this frame may have changed which rules apply
  const path = e.type === 'keydown' || e.type === 'keyup' ? keyPath(e) : e.composedPath();
  activation.event = e;
  try { urgently(() => {
    const own = BUBBLES.has(e.type) ? path : path.slice(0, 1);
    for (const node of own) if (node instanceof Element) run(node, handlersOf(node)?.get(e.type), e);
    activation.event = null; // outside() dismissals never arm focus:
    if (outsiders.size) {
      const trigger = 'outside:' + e.type;
      for (const el of [...outsiders.keys()]) {
        if (path.includes(el)) continue; // composedPath: correct across shadow roots
        run(el, handlersOf(el)?.get(trigger), e);
      }
    }
    if (extensions.dispatch) { activation.event = e; extensions.dispatch(e, path); }
  }); } finally { activation.event = null; }
}

let keyListeners = 0;
export function listen(type: string, delta: number) {
  if (type === 'keydown' || type === 'keyup') {
    keyListeners += delta;
    if (keyListeners > 0 && keyListeners === delta) document.addEventListener('pointerdown', onPress, { capture: true, passive: true });
    if (keyListeners === 0) document.removeEventListener('pointerdown', onPress, { capture: true });
  }
  const n = (listening.get(type) ?? 0) + delta;
  if (n > 0 && n === delta) { document.addEventListener(type, dispatch, { capture: true, passive: !cancelers.get(type) }); runtimeStats.observers++; }
  if (n === 0) { document.removeEventListener(type, dispatch, { capture: true }); runtimeStats.observers--; listening.delete(type); }
  else listening.set(type, n);
}

/**
 * Rules using prevent() per event type. The listener is passive unless one of them is live:
 * switched when rules register or release (never during an event), by removing and re-adding the
 * same listener, so it is never installed twice.
 */
const cancelers = new Map<string, number>();
export function cancel(type: string, delta: number) {
  const before = !!cancelers.get(type);
  const n = (cancelers.get(type) ?? 0) + delta;
  if (n) cancelers.set(type, n); else cancelers.delete(type);
  if (before === !!n || !listening.get(type)) return;
  document.removeEventListener(type, dispatch, { capture: true });
  document.addEventListener(type, dispatch, { capture: true, passive: !n });
}

/** Makes a compiled handler set live; returns its cleanup. */
const domType = (trigger: string) => trigger.replace(/^outside:/, '');

export function registerHandlers(id: number, set: HandlerSet): () => void {
  register();
  handlerSets.set(id, set);
  const cancels = [...set].filter(([, hs]) => hs.some((h) => h.actions.some((a) => a.def.cancels))).map(([t]) => domType(t));
  for (const t of set.keys()) listen(domType(t), 1);
  for (const t of cancels) cancel(t, 1);
  return () => {
    handlerSets.delete(id);
    for (const t of cancels) cancel(t, -1);
    for (const t of set.keys()) listen(domType(t), -1);
  };
}

/** Tracks the elements an `on:` rule may apply to; only these are checked on events. */
export function actionWatcher(match: string, id: number, certain: boolean, set: HandlerSet, sheet?: CSSStyleSheet): Watcher {
  const entry: Candidate = { id, certain, sheet };
  const outside = [...set.keys()].some((t) => t.startsWith('outside:'));
  return {
    selector: match,
    add(el) {
      const list = candidates.get(el);
      if (list) list.push(entry);
      else candidates.set(el, [entry]);
      if (outside) outsiders.set(el, (outsiders.get(el) ?? 0) + 1);
    },
    remove(el) {
      const list = candidates.get(el);
      if (!list) return;
      list.splice(list.indexOf(entry), 1);
      if (!list.length) candidates.delete(el);
      if (outside) {
        const n = (outsiders.get(el) ?? 1) - 1;
        if (n) outsiders.set(el, n);
        else outsiders.delete(el);
      }
    },
  };
}

// ---- built-in actions -------------------------------------------------------------

const stateName = (s: string | undefined) => {
  if (!s || !/^--[^\s,()]+$/.test(s)) throw new Error(`expected a state name like --open, got "${s ?? ''}"`);
  return s;
};

type Source = { kind: 'expr'; e: Expr } | { kind: 'sibling-index' } | { kind: 'sibling-count' };

function source(text: string): Source {
  const s = text.trim().toLowerCase();
  if (s === 'sibling-index()') return { kind: 'sibling-index' };
  if (s === 'sibling-count()') return { kind: 'sibling-count' };
  const e = parseExpr(text);
  if (e.k === 'lit' && s.includes('('))
    throw new Error(`"${text}" is not supported; use a value, attr(), pick(), sibling-index() or sibling-count()`);
  return { kind: 'expr', e };
}

function siblingIndex(el: Element) {
  let i = 1;
  for (let s = el.previousElementSibling; s; s = s.previousElementSibling) i++;
  return i;
}

/**
 * Splits an optional trailing closest(selector) scope off the arguments. With a scope, the
 * state must be owned by exactly el.closest(selector); without, the nearest owner is used.
 */
function scoped(args: string[]): [string[], string | undefined] {
  const m = /^closest\((.+)\)$/is.exec(args[args.length - 1]?.trim() ?? '');
  if (!m) return [args, undefined];
  if (!m[1].trim()) throw new Error('closest() needs a selector');
  return [args.slice(0, -1), m[1].trim()];
}

/** The state cell for an action, with a warning when there is none. */
function target(el: Element, name: string, action: string, scope?: string) {
  const c = resolveCell(el, name, scope);
  if (!c) {
    if (scope) warnMissing(name, el, `${action}() with closest(${scope}) on ${describeElement(el)} (the owner must be exactly that ancestor)`);
    else warnMissing(name, el, `${action}() on ${describeElement(el)}`);
  }
  return c;
}

function apply(el: Element, name: string, action: string, v: Typed, scope?: string) {
  const c = target(el, name, action, scope);
  if (!c) return;
  if (!assignable(c.value, v)) {
    warn(`${action}(${name}, ${serialize(v)}): ${name} holds ${c.value.type === 'dimension' ? `a ${c.value.unit} value` : `a ${c.value.type}`}; the value is ignored.`);
    return;
  }
  c.set(coerce(c.value, v));
}

defineAction({
  name: 'set',
  syntax: 'set(--state, value | attr(name) | pick(...) | sibling-index() | sibling-count(), closest(selector)?)',
  compile(all) {
    const [args, scope] = scoped(all);
    if (args.length !== 2) throw new Error('expected set(--state, value)');
    return { name: stateName(args[0]), src: source(args[1]), scope };
  },
  run(el, d: { name: string; src: Source; scope?: string }) {
    const s = d.src;
    // sibling-* use the element that carries the on: declaration (e.g. the clicked tab).
    // attr() too: read at event time from the element with the on: declaration.
    const v = s.kind === 'expr' ? evaluate(s.e, el)
      : { type: 'number' as const, unit: '', v: s.kind === 'sibling-index' ? siblingIndex(el) : el.parentElement?.childElementCount ?? 1 };
    if (v) apply(el, d.name, 'set', v, d.scope); // an empty pick() has no value: nothing changes
  },
});

defineAction({
  name: 'toggle',
  syntax: 'toggle(--boolean-state, closest(selector)?)',
  compile(all) {
    const [args, scope] = scoped(all);
    if (args.length !== 1) throw new Error('expected toggle(--state)');
    return { name: stateName(args[0]), scope };
  },
  run(el, { name, scope }: { name: string; scope?: string }) {
    const c = target(el, name, 'toggle', scope);
    if (!c) return;
    if (c.value.type !== 'boolean') { warn(`toggle(${name}): ${name} is not a boolean state (state(true) or state(false)).`); return; }
    c.set({ type: 'boolean', v: !c.value.v });
  },
});

for (const [name, sign] of [['increment', 1], ['decrement', -1]] as const) {
  defineAction({
    name,
    syntax: `${name}(--number-state, step = 1, closest(selector)?)`,
    compile(all) {
      const [args, scope] = scoped(all);
      if (args.length < 1 || args.length > 2) throw new Error(`expected ${name}(--state) or ${name}(--state, step)`);
      const step = args[1] === undefined ? undefined : parseTyped(args[1]);
      if (step && step.type !== 'number' && step.type !== 'dimension') throw new Error(`step "${args[1]}" must be a number or a dimension`);
      return { name: stateName(args[0]), step, scope };
    },
    run(el, d: { name: string; step?: Typed; scope?: string }) {
      const c = target(el, d.name, name, d.scope);
      if (!c) return;
      const cur = c.value;
      if (cur.type !== 'number' && cur.type !== 'dimension') { warn(`${name}(${d.name}): ${d.name} is not a number or dimension state.`); return; }
      const step = d.step ?? { type: cur.type, v: 1, unit: cur.unit };
      if (!assignable(cur, step)) { warn(`${name}(${d.name}, ${serialize(step)}): the step does not match the unit of ${d.name}.`); return; }
      // Rounded so 0.1 + 0.2 compares equal to 0.3 in conditions.
      c.set({ ...cur, v: Math.round(((cur.v as number) + sign * (coerce(cur, step).v as number)) * 1e6) / 1e6 });
    },
  });
}

/**
 * Cancels the event's default for a rule on `el` (prevent() and :on(…, prevent)). Contract:
 * docs/rfc-prevent-action-0.7.md, section 5. Synchronous; never stops propagation.
 */
export function preventEvent(el: Element, e: Event) {
  const t = e.target;
  if (!(t instanceof Node) || !e.composedPath().includes(el)) return; // only events inside the element
  // A form control (text, radio, range, select…) keeps its keys unless it carries the rule itself.
  if ((e.type === 'keydown' || e.type === 'keyup') && t !== el && (t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable))) return;
  if (!e.cancelable) {
    warn(`prevent() on ${describeElement(el)}: this ${e.type} event is not cancelable (script-created events need cancelable: true); its default action happens.`);
    return;
  }
  e.preventDefault();
  if (!e.defaultPrevented) {
    warn(`prevent() on ${describeElement(el)} did not cancel the ${e.type} event (a passive listener?); its default action happens.`);
    return;
  }
  if (dev && e.type === 'click' && t instanceof Element) {
    const inner = t.closest(INTERACTIVE);
    if (inner && inner !== el && el.contains(inner))
      note(`prevent() on ${describeElement(el)} also cancelled the click on ${describeElement(inner)} inside it (link navigation, toggling or submission). Move the rule to a more specific element if that is not intended.`);
  }
}

/** Interactive descendants whose own default a cancelling ancestor also cancels (diagnostic only). */
const INTERACTIVE = 'a[href], button, input, select, textarea, summary, label, [contenteditable]';

defineAction({
  name: 'prevent',
  syntax: 'prevent()',
  cancels: true,
  compile(args) {
    if (args.length && args.some((a) => a.trim())) throw new Error('prevent() takes no arguments');
    return null;
  },
  run: (el, _d, e) => preventEvent(el, e),
});

defineAction({
  name: 'cycle',
  syntax: 'cycle(--state, value1, value2, ..., closest(selector)?)',
  compile(all) {
    const [args, scope] = scoped(all);
    if (args.length < 3) throw new Error('expected cycle(--state, value1, value2, ...) with at least two values');
    return { name: stateName(args[0]), values: args.slice(1).map((v) => parseTyped(v)), scope };
  },
  // Next value in the list, wrapping around; the first value when the current one is not listed.
  run(el, d: { name: string; values: Typed[]; scope?: string }) {
    const c = target(el, d.name, 'cycle', d.scope);
    if (!c) return;
    const bad = d.values.find((v) => !assignable(c.value, v));
    if (bad) { warn(`cycle(${d.name}): ${serialize(bad)} cannot be stored in ${d.name} (${c.value.type}).`); return; }
    const values = d.values.map((v) => coerce(c.value, v));
    const i = values.findIndex((v) => equal(v, c.value));
    c.set(values[(i + 1) % values.length]);
  },
});

// Feature runtime (src/features): the parser and the engine find it here.
runtimes.on = { watcher: actionWatcher, register: registerHandlers };
