// 0.10 (experimental, step 8): computed custom properties ("derived declarations").
//
//   .form  { --value: state(""); --clean: trim(--value); --chars: length(--clean) }
//   .clock { --now: live(time(), 1s); --tokyo: timezone(--now, "Asia/Tokyo") }
//
// A custom property whose whole value is one value function (or live() around one), in an
// unconditional rule, is a read-only state of that name on every element the rule matches.
//
// - One value, two readers, within limits. The runtime writes the value inline on the owner as
//   the property itself (the declaration is removed from the stylesheet). This is not a general
//   CSS cascade: the value takes part in the cascade only as that inline value.
//   - Guaranteed: on an owner, CSS shows the state unless an !important declaration or an
//     @property overrides it; inside the owner, by inheritance, unless another declaration of the
//     name applies to an element there.
//   - Enforced: another declaration of the name in the processed stylesheets (state(), a plain
//     value, !important, @property, another computed one) is a conflict, and the name is not
//     computed until it is resolved. An inline style value on an owner is left alone.
//   - Development builds also check, after new owners appear, the computed value on each owner,
//     the stylesheets Reactive CSS does not process but can read, and inline styles inside owners.
//   - Not checked: cross-origin stylesheets (reported as not checkable in development builds),
//     shadow roots, and inline styles or stylesheets that scripts change later.
// - Inputs are states only: a computed value never reads the DOM, the event, random() or the
//   clock outside live(), so it changes exactly when a state it reads changes (or live() ticks).
// - Synchronous and glitch-free: a change notifies every subscriber first, then the computed
//   values settle in depth order (an input before what reads it), before the change returns.
// - No cycles: names that read each other are rejected when the stylesheet is applied.

import { runtimes, type CallNode } from '../core/registry';
import { warn, note, msg, dev } from '../core/log';
import { every, unevery } from '../core/scheduler';
import type { DerivedDecl } from '../core/parser';
import type { Watcher } from '../core/elements';
import { Cell, StateRef, adoptCell, disposeCell, readOnly, changeHooks, isChanging, stateChangeHooks, describeElement, findCell, type Subscriber } from '../state/state';
import { value, EvalError, type Node } from '../state/actexpr';

type Styled = Element & ElementCSSInlineStyle;
interface Compiled { node: Node; names: string[]; text: string }

interface Info {
  name: string;
  node: Node;
  reads: string[];
  text: string;
  /** live() interval in ms. */
  ms?: number;
  /** 0 for a value read only from state(); 1 + the deepest computed input otherwise. */
  depth: number;
  on: boolean;
  w?: Group;
}

/** A value function, or live() around exactly one. */
function inner(c: CallNode): CallNode | undefined {
  if (c.def.value) return c;
  if (c.def.name !== 'live') return undefined;
  const p = c.args[0]?.parts.filter((x) => typeof x !== 'string' || x.trim());
  return p?.length === 1 && typeof p[0] !== 'string' && p[0].def.value ? p[0] : undefined;
}

const infos = new WeakMap<DerivedDecl, Info>();
/** Declarations of each custom property name in the processed stylesheets. */
const declared = new Map<string, number>();
const byName = new Map<string, Set<Info>>();
const status = new Map<string, string>();

function info(d: DerivedDecl): Info {
  let i = infos.get(d);
  if (!i) {
    const f = inner(d.call)!, c = f.data as Compiled;
    i = { name: d.name, node: c.node, reads: c.names, text: `${d.name}: ${c.text}`, ms: f === d.call ? undefined : (d.call.data as number), depth: 0, on: false };
    infos.set(d, i);
  }
  return i;
}

/** What makes `n` change without a state change (undefined: only states, literals and value functions). */
function impure(n: Node, live: boolean): string | undefined {
  switch (n.k) {
    case 'event': return `event(${n.field})`;
    case 'mouse': return 'mouse()';
    case 'size': return `${n.of}()`;
    case 'attr': return `attr(${n.name})`;
    case 'pick': case 'split': return 'pick()';
    case 'random': return 'random()';
    case 'sibling': return n.count ? 'sibling-count()' : 'sibling-index()';
    case 'fn': if (n.name === 'time' && !live) return 'time()'; break;
  }
  for (const v of Object.values(n)) {
    const list = Array.isArray(v) ? v : [v];
    for (const x of list) if (x && typeof x === 'object' && 'k' in x) { const r = impure(x as Node, live); if (r) return r; }
  }
  return undefined;
}

/** Re-evaluates which names are computed: unique declarations, no cycles; sets each depth. */
function recheck() {
  const next = new Map<string, string>();
  for (const [name, set] of byName) {
    const n = declared.get(name) ?? 0;
    if (set.size > 1 || n > 1)
      next.set(name, msg(`${name} is declared ${n} times in the processed stylesheets (state(), plain values, @property and other computed declarations count). A computed custom property must be the only declaration of its name, so ${name} is not computed until the others are removed or renamed.`));
    else next.set(name, '');
  }
  const reads = (n: string) => [...byName.get(n)!][0].reads.filter((r) => next.has(r));
  // Cycles: a name that can reach itself through computed inputs (among the unique names).
  const unique = new Set([...next].filter(([, why]) => !why).map(([n]) => n));
  for (const name of unique) {
    const seen = new Set<string>(), stack = [...reads(name)];
    while (stack.length) {
      const r = stack.pop()!;
      if (r === name) { next.set(name, msg(`${name} reads itself through ${[...seen].join(', ') || 'its own value'}; computed custom properties cannot form a cycle, so ${name} is not computed.`)); break; }
      if (seen.has(r) || !unique.has(r)) continue;
      seen.add(r);
      stack.push(...reads(r));
    }
  }
  const ok = (n: string) => next.get(n) === '';
  const depth = new Map<string, number>();
  const depthOf = (n: string): number => {
    let d = depth.get(n);
    if (d === undefined) { depth.set(n, 0); d = 1 + Math.max(-1, ...reads(n).filter(ok).map(depthOf)); depth.set(n, d); }
    return d;
  };
  for (const [name, why] of next) {
    for (const i of byName.get(name)!) i.depth = why ? 0 : depthOf(name);
    if (status.get(name) === why) continue;
    status.set(name, why);
    if (why) warn(why);
    for (const i of byName.get(name)!) { i.on = !why; i.w?.enable(i.on); }
  }
  for (const name of status.keys()) if (!next.has(name)) status.delete(name);
}

// ---- settling: depth order, inside the change ----------------------------------------------

const queue: Set<Derived>[] = [];
let draining = false;
function drain() {
  if (draining) return;
  draining = true;
  try {
    for (;;) {
      const k = queue.findIndex((s) => s?.size);
      if (k < 0) break;
      // The whole depth at once: values().next() after deletes rescans the removed slots (quadratic).
      const batch = queue[k];
      queue[k] = new Set();
      for (const d of batch) d.update();
    }
  } finally { draining = false; }
}
changeHooks.settled = drain;

const toVerify = new Set<Derived>();
let verifyTimer: ReturnType<typeof setTimeout> | undefined;
const sheetLabel = (s: CSSStyleSheet) => s.href ?? (s.ownerNode instanceof Element ? `<${s.ownerNode.localName}${s.ownerNode.id ? ` id="${s.ownerNode.id}"` : ''}>` : 'a constructed stylesheet');
/** Style rules (also nested and inside @media, @supports, @layer…) of `rules` that declare `name`. */
function* declaring(rules: CSSRuleList, name: string): Generator<string> {
  for (const r of rules) {
    if (r instanceof CSSStyleRule && r.style.getPropertyValue(name)) yield r.selectorText;
    if (typeof CSSPropertyRule !== 'undefined' && r instanceof CSSPropertyRule && r.name === name) yield `@property ${name}`;
    if ('cssRules' in r) yield* declaring((r as CSSGroupingRule).cssRules, name);
  }
}
/**
 * Development builds: what Reactive CSS cannot enforce, checked where it can be seen. CSS on each
 * new owner must show the state; stylesheets we do not process and inline styles inside owners
 * must not declare a computed name. Cross-origin stylesheets cannot be read: said once.
 */
function verify() {
  verifyTimer = undefined;
  const names = new Set<string>();
  for (const d of toVerify) {
    const c = d.cell;
    if (d.dead || !c || c.queued || !d.el.isConnected) continue;
    names.add(c.name);
    const mine = d.el.style.getPropertyValue(c.name).trim(), css = getComputedStyle(d.el).getPropertyValue(c.name).trim();
    if (mine !== css) warn(`${c.name} on ${describeElement(d.el)}: CSS shows ${css || 'no value'}, its computed state is ${mine}. A declaration Reactive CSS does not process overrides it (!important, @property, or a stylesheet without reactive syntax); remove it or rename the property.`);
  }
  toVerify.clear();
  if (!names.size) return;
  for (const sheet of [...document.styleSheets, ...(document.adoptedStyleSheets ?? [])]) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch {
      note(`${sheetLabel(sheet)} cannot be read (cross-origin without CORS), so Reactive CSS cannot check whether it declares ${[...names].join(', ')}. Where such a declaration applies inside an owner, CSS shows its value instead of the computed state.`);
      continue;
    }
    // A processed stylesheet never declares a name that is still computed (that is a conflict), so every hit is foreign.
    for (const name of names) for (const where of declaring(rules, name))
      warn(`${name} is computed, and ${sheetLabel(sheet)} also declares it (${where}). Reactive CSS does not process that stylesheet: where it applies inside an owner (or with !important on one), CSS shows its value, not the computed state. Remove it or rename the property.`);
  }
  for (const name of names) for (const el of document.querySelectorAll(`[style*=${JSON.stringify(name)}]`)) {
    const c = el.parentElement && findCell(el.parentElement, name);
    if (c && readOnly.has(c) && (el as HTMLElement).style.getPropertyValue(name) && findCell(el, name) === c)
      warn(`${name} on ${describeElement(el)} has an inline style value inside a computed owner (${describeElement(c.owner)}): CSS there shows the inline value, not the computed state. Remove it or rename the property.`);
  }
}

/** One computed custom property on one owner. */
class Derived implements Subscriber {
  cell?: Cell;
  refs: StateRef[];
  dead = false;
  private reported?: string;
  private missing?: ReturnType<typeof setTimeout>;
  constructor(readonly el: Styled, readonly i: Info) {
    this.refs = i.reads.map((n) => new StateRef(el, n, this, true));
    if (i.ms) every(i.ms, this);
    this.update();
  }
  notify() {
    if (this.dead) return;
    (queue[this.i.depth] ??= new Set()).add(this);
    if (!isChanging()) drain(); // inside a change, drain() runs once everyone is notified
  }
  tick() { this.notify(); }
  update() {
    if (this.dead) return;
    const { el, i } = this;
    const gone = this.refs.find((r) => !r.state());
    if (gone) {
      if (this.cell) this.report(msg(`${i.text} on ${describeElement(el)} reads ${gone.name}, which is no longer a state there; it keeps its last value.`));
      else this.missing ??= setTimeout(() => {
        this.missing = undefined;
        if (!this.dead && !this.cell && el.isConnected)
          warn(`${i.text} on ${describeElement(el)} reads ${gone.name}, but no element declares ${gone.name} as a state on it or its ancestors; ${i.name} has no value.`);
      }, 1000);
      return;
    }
    let v;
    try { v = value(i.node, { el }); } catch (e) {
      if (!(e instanceof EvalError)) throw e;
      this.report(msg(`${i.text} on ${describeElement(el)}: ${e.message}; it keeps its last value.`));
      return;
    }
    this.reported = undefined;
    if (!v) return;
    if (this.cell) { this.cell.set(v); return; }
    const c = (this.cell = new Cell(el, i.name, v));
    c.vars.push(i.name); // written inline as the property itself: CSS shows exactly the state
    readOnly.add(c);
    adoptCell(c);
    c.writeAll();
    for (const fn of stateChangeHooks) fn(c); // text:, attr: and focus: inside the owner read it now
    if (dev) { toVerify.add(this); verifyTimer ??= setTimeout(verify, 100); }
  }
  private report(m: string) {
    if (this.reported !== m) warn(m);
    this.reported = m;
  }
  dispose() {
    this.dead = true;
    queue[this.i.depth]?.delete(this);
    for (const r of this.refs) r.dispose();
    if (this.i.ms) unevery(this.i.ms, this);
    clearTimeout(this.missing);
    if (this.cell) {
      disposeCell(this.cell);
      this.el.style.removeProperty(this.i.name);
      for (const fn of stateChangeHooks) fn(this.cell);
    }
  }
}

/** Elements matching one computed declaration's rule; owners while the name is computed. */
class Group implements Watcher {
  members = new Set<Styled>();
  live = new Map<Element, Derived>();
  constructor(readonly selector: string, readonly i: Info) { i.w = this; }
  add(el: Element) {
    if (!('style' in el)) return;
    this.members.add(el as Styled);
    if (this.i.on) this.start(el as Styled);
  }
  remove(el: Element) { this.members.delete(el as Styled); this.stop(el); }
  enable(on: boolean) { for (const el of this.members) if (on) this.start(el); else this.stop(el); }
  private start(el: Styled) {
    if (this.live.has(el)) return;
    if (el.style.getPropertyValue(this.i.name)) { warn(`${this.i.name} on ${describeElement(el)} has an inline style value; it is not computed on that element.`); return; }
    this.live.set(el, new Derived(el, this.i));
  }
  private stop(el: Element) { this.live.get(el)?.dispose(); this.live.delete(el); }
}

runtimes.derived = {
  accept(n, call, imp, unconditional, at) {
    const f = inner(call);
    if (!f) return false;
    const reads = imp || !unconditional ? undefined : impure((f.data as Compiled).node, f !== call);
    if (!imp && unconditional && !reads) return true;
    if (imp) warn(`${n} is not a computed state: !important is not supported on it. It stays a CSS-only value that :when(), text: and actions cannot read, in "${at}".`);
    else if (!reads) warn(`${n} is not a computed state: it is in a conditional rule (:when(), :hover and other state pseudo-classes, a pseudo-element, @media, @supports or @container), and computed custom properties need an unconditional rule. It stays a CSS-only value that :when(), text: and actions cannot read, in "${at}".`);
    else if (reads === 'time()') warn(`${n} is not a computed state: it reads time() outside live(), which gives one instant; write live(time(), 1s) for a clock. It stays a CSS-only value that :when(), text: and actions cannot read, in "${at}".`);
    else warn(`${n} is not a computed state: it reads ${reads}, which can change without a state change. It stays a CSS-only value that :when(), text: and actions cannot read, in "${at}".`);
    return false;
  },
  sheet(names, decls) {
    for (const [n, k] of names) declared.set(n, (declared.get(n) ?? 0) + k);
    const mine = decls.map(info);
    for (const i of mine) { let s = byName.get(i.name); if (!s) byName.set(i.name, (s = new Set())); s.add(i); }
    recheck();
    return () => {
      for (const [n, k] of names) { const left = declared.get(n)! - k; if (left) declared.set(n, left); else declared.delete(n); }
      for (const i of mine) { const s = byName.get(i.name)!; s.delete(i); if (!s.size) byName.delete(i.name); i.on = false; i.w?.enable(false); }
      recheck();
    };
  },
  watchers: (list) => list.map(([match, d]) => new Group(match, info(d))).sort((a, b) => a.i.depth - b.i.depth),
};
