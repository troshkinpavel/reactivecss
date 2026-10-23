// State engine: `--name: state(value)` creates one state cell per owner element.
//
// - Ownership: every element matching a rule that declares `--name: state(...)` owns its own
//   cell. Cells are never shared between elements.
// - Resolution: a consumer (when(), :when(), :nth-var(), set()...) uses the nearest cell
//   named `--name` on itself or its closest ancestor. References resolve lazily and
//   re-resolve when a closer owner appears (shadowing) or their owner goes away.
// - CSS: the declaration compiles to `--name: var(--rcss-sN, <initial>)`, so the author's
//   cascade still decides `--name`. The runtime writes `--rcss-sN` on the owner only once
//   the value differs from the initial one.

import { dirty, settleLater, type Job } from '../core/scheduler';
import { warn, dev, probes } from '../core/log';
import type { Watcher } from '../core/elements';
import { serialize, equal, type Typed } from './values';
import { evaluate, type Expr } from './expr';
import type { AttrBind, BoundAttribute } from './bindattr';
import { runtimeStats, runtimes } from '../core/registry';

type Styled = Element & ElementCSSInlineStyle;

export interface StateDecl {
  name: string;
  varName: string;
  init: Expr;
  /** Value of this declaration's cascade marker property, `${varName}-w`. */
  id: number;
  /** state(initial, bind(attribute)): the owner's attribute mirrors the state. */
  bind?: AttrBind;
  /** state(initial, persist("key" [, session])) (0.9.0). */
  persist?: PersistSpec;
}

export interface PersistSpec { key: string; session: boolean }
/** A cell's membership in its storage key (persist.ts). */
export interface PersistLink { changed(): void; release(): void }

/** Anything that wants to hear about a state change. */
export interface Subscriber { notify(): void }

const cellsOf = new WeakMap<Element, Cell[]>();
/** Called after every effective state change (text: re-reads the elements inside the owner). */
export const stateChangeHooks = new Set<(c: Cell) => void>();
const waiting = new Map<string, Set<StateRef>>();

export class Cell implements Job {
  queued?: boolean;
  previous: Typed;
  /** Number of effective changes; 0 means still at the initial value. */
  version = 0;
  subs = new Set<StateRef>();
  /** Generated properties of every state() declaration currently matching the owner. */
  vars: string[] = [];
  /** What CSS currently sees. Initially the var() fallback, so nothing is written at start. */
  private shown: string;
  private force = false;
  dead = false;

  /** The initial value (used by form reset of bound controls). */
  initial: Typed;
  /** The state() declaration whose initializer set the initial value. */
  initFrom!: StateDecl;
  /** The owner's attribute bound by the winning declaration (bind()). */
  bound?: BoundAttribute;
  /** Storage of a persist() state. */
  persisted?: PersistLink;
  /** The initial value came from storage: it wins over an edited bound control (bind.ts). */
  restored = false;

  constructor(readonly owner: Styled, readonly name: string, public value: Typed) {
    this.previous = value;
    this.initial = value;
    this.shown = serialize(value);
  }

  /** Applies a new value; returns false when nothing changed. Notifies each subscriber once. */
  set(next: Typed): boolean {
    if (this.dead || equal(next, this.value)) return false;
    this.previous = this.value;
    this.value = next;
    this.version++;
    runtimeStats.stateChanges++;
    this.bound?.write(next); // synchronously: the DOM attribute never lags the state
    this.persisted?.changed();
    dirty(this);
    for (const s of this.subs) s.notify();
    for (const fn of stateChangeHooks) fn(this);
    return true;
  }

  /** Write the current value to every generated property (after a second declaration attached). */
  writeAll() {
    this.force = true;
    settleLater(this);
  }

  compute() {
    if (this.dead) return false;
    const s = serialize(this.value);
    if (s === this.shown && !this.force) return false;
    this.shown = s;
    return true;
  }

  write() {
    this.force = false;
    for (const v of this.vars) this.owner.style.setProperty(v, this.shown);
  }
}

/**
 * With `scope`: only the cell owned by exactly `el.closest(scope)` (explicit closest() scope).
 * Without: the nearest cell named `name` on `el` or its ancestors.
 */
export function resolveCell(el: Element, name: string, scope?: string): Cell | undefined {
  if (!scope) return findCell(el, name);
  let owner: Element | null = null;
  try { owner = el.closest(scope); } catch { warn(`closest(${scope}): not a valid selector.`); }
  return owner ? cellsOf.get(owner)?.find((c) => c.name === name) : undefined;
}

/** Nearest cell named `name` on `el` or its ancestors. */
export function findCell(el: Element | null, name: string): Cell | undefined {
  for (let a = el; a; a = a.parentElement) {
    const list = cellsOf.get(a);
    if (list) for (const c of list) if (c.name === name) return c;
  }
  return undefined;
}

/**
 * Calls fn for each binding in `bound` whose element is `owner` or inside it (text:, attr:).
 * Few bindings: check each. Many: look up only the owner's subtree (a component is small;
 * measured 141 µs per change with 10,000 bindings checked one by one).
 */
export function within<T>(bound: Map<Element, T>, owner: Element, fn: (b: T) => void) {
  if (bound.size <= 64) {
    for (const [el, b] of bound) if (owner === el || owner.contains(el)) fn(b);
    return;
  }
  const self = bound.get(owner);
  if (self) fn(self);
  for (const el of owner.getElementsByTagName('*')) { const b = bound.get(el); if (b) fn(b); }
}

export const describeElement = (el: Element) =>
  el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].join('.') : '');

export function warnMissing(name: string, el: Element, user: string) {
  warn(`${user} uses ${name}, but no element declares "${name}: state(...)" on ${describeElement(el)} or its ancestors. Nothing is changed.`);
}

/** A consumer's link to the nearest cell of one state name. */
export class StateRef {
  cell: Cell | undefined;
  private resolved = false;
  /** optional: an ordinary custom property is fine too (no warning when no state exists). */
  constructor(readonly el: Element, readonly name: string, readonly sub: Subscriber, readonly optional = false, readonly scope?: string) {}

  /** Current value, or undefined when no state can be resolved. */
  get(): Typed | undefined {
    return this.state()?.value;
  }

  /** The resolved cell (current value, previous value, version), or undefined. */
  state(): Cell | undefined {
    if (!this.resolved) this.resolve();
    return this.cell;
  }

  private resolve() {
    this.resolved = true;
    const c = resolveCell(this.el, this.name, this.scope);
    if (c !== this.cell) {
      this.cell?.subs.delete(this);
      this.cell = c;
      c?.subs.add(this);
    }
    if (c) {
      waiting.get(this.name)?.delete(this);
      return;
    }
    let set = waiting.get(this.name);
    if (!set) waiting.set(this.name, (set = new Set()));
    set.add(this);
    if (!this.optional) suspect(this);
  }

  notify() { this.sub.notify(); }

  /** Resolve again on the next get(), and tell the consumer to re-evaluate. */
  invalidate() {
    this.resolved = false;
    this.sub.notify();
  }

  dispose() {
    this.cell?.subs.delete(this);
    waiting.get(this.name)?.delete(this);
    this.cell = undefined;
  }
}

// The owner may come from a stylesheet that is still loading: warn only if it stays missing.
const suspects = new Set<StateRef>();
let registeredVars = 0;
if (dev) Object.assign(probes, {
  waitingRefs: () => { let n = 0; for (const s of waiting.values()) n += s.size; return n; },
  waitingNames: () => waiting.size, suspects: () => suspects.size, registeredStateVars: () => registeredVars,
});
let suspectTimer: ReturnType<typeof setTimeout> | undefined;
function suspect(r: StateRef) {
  suspects.add(r);
  suspectTimer ??= setTimeout(() => {
    suspectTimer = undefined;
    for (const s of suspects) if (!s.cell && s.el.isConnected && waiting.get(s.name)?.has(s)) warnMissing(s.name, s.el, 'A condition');
    suspects.clear();
  }, 1000);
}

/**
 * Initial value of `d` on `owner`. Precedence (0.9.0): a valid persisted value, then the DOM
 * source (the bound attribute), then the declared initial value.
 */
function initialize(c: Cell | undefined, owner: Styled, d: StateDecl): [Typed, BoundAttribute | undefined, boolean] {
  let v = evaluate(d.init, owner) ?? EMPTY;
  let bound = c?.bound;
  if (bound && bound.name !== d.bind?.name) { bound.release(); bound = undefined; }
  if (d.bind) {
    // Same attribute as before: keep the binding, whose original predates our writes.
    bound ??= runtimes.attrBinding!(owner, d.bind); // the parser accepts bind() only when the attributes feature is present
    v = bound.initial(v);
  }
  const stored = d.persist && runtimes.persist!.initial(d.persist, owner, v); // the parser accepts persist() only with its feature
  return [stored ?? v, bound, !!stored];
}

function relink(c: Cell, d: StateDecl) {
  c.persisted?.release();
  c.persisted = d.persist ? runtimes.persist!.link(d.persist, c) : undefined;
}

function createCell(owner: Styled, d: StateDecl) {
  const [v, bound, restored] = initialize(undefined, owner, d);
  const c = new Cell(owner, d.name, v);
  c.initFrom = d;
  c.bound = bound;
  c.restored = restored;
  relink(c, d);
  c.vars.push(d.varName);
  // The CSS has no fallback to show (evaluated initial value) or may show another one (the
  // attribute or storage initialized it): write the owner's value.
  if (d.init.k !== 'lit' || bound || restored) c.writeAll();
  bound?.write(v);
  const list = cellsOf.get(owner);
  if (list) list.push(c);
  else cellsOf.set(owner, [c]);
  runtimeStats.states++;
  // References that should now resolve here: waiting ones inside the owner, and those
  // inside the owner that currently use an enclosing cell of the same name (shadowing).
  const w = waiting.get(d.name);
  if (w) for (const r of [...w]) if (owner.contains(r.el)) r.invalidate();
  const outer = findCell(owner.parentElement, d.name);
  if (outer) for (const r of [...outer.subs]) if (owner.contains(r.el)) r.invalidate();
}

function disposeCell(c: Cell) {
  c.dead = true;
  c.bound?.release();
  c.persisted?.release();
  const list = cellsOf.get(c.owner)!;
  list.splice(list.indexOf(c), 1);
  if (!list.length) cellsOf.delete(c.owner);
  runtimeStats.states--;
  for (const r of [...c.subs]) { c.subs.delete(r); r.invalidate(); }
}

function attach(owner: Styled, d: StateDecl) {
  const c = cellsOf.get(owner)?.find((x) => x.name === d.name);
  if (!c) return createCell(owner, d);
  c.vars.push(d.varName);
  // Several state() declarations for one name on one element: one cell. While it is still
  // unchanged, the declaration that wins the cascade initializes it (once it has attached:
  // declarations attach in any order, and stylesheets may load later). Never after a change.
  if (c.version === 0 && c.initFrom !== d && cascadeWinner(owner, d) === d.id) {
    c.initFrom = d;
    const [v, bound, restored] = initialize(c, owner, d);
    c.bound = bound;
    c.restored = restored;
    relink(c, d);
    if (!equal(v, c.value)) {
      c.value = c.previous = c.initial = v;
      for (const s of c.subs) s.notify();
    }
    bound?.write(v);
  }
  c.writeAll();
}

const EMPTY: Typed = { type: 'string', v: '' };

/** Id of the state() declaration that wins the cascade on `owner` (its marker's computed value). */
const cascadeWinner = (owner: Element, d: StateDecl) => +getComputedStyle(owner).getPropertyValue(d.varName + '-w');

function detach(owner: Styled, d: StateDecl) {
  const c = cellsOf.get(owner)?.find((x) => x.name === d.name);
  if (!c) return;
  c.vars.splice(c.vars.indexOf(d.varName), 1);
  // Another declaration (another rule or sheet) of the same state may still use the property.
  if (!c.vars.includes(d.varName)) owner.style.removeProperty(d.varName);
  if (!c.vars.length) disposeCell(c);
}

/**
 * Watcher for a rule with state() declarations. A cell lives while at least one state()
 * declaration for its name matches the owner; it is created with the initial value and
 * disposed (not kept) when no declaration matches any more.
 */
export function stateWatcher(match: string, decls: StateDecl[]): Watcher {
  // Not inherited: nested owners matched by the same rule must not see an ancestor's value
  // through the shared generated property (each owner shows its own value or the initial).
  for (const d of decls) {
    try { CSS.registerProperty({ name: d.varName, syntax: '*', inherits: false }); registeredVars++; } catch { /* registered already */ }
  }
  return {
    selector: match,
    add(el) { if ('style' in el) for (const d of decls) attach(el as Styled, d); },
    remove(el) { for (const d of decls) detach(el as Styled, d); },
  };
}
