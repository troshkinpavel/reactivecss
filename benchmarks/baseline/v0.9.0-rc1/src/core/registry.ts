import { VERSION } from './version';
import { FEATURES, KEEP_NATIVE } from './features';
import { EXPRESSIONS } from '../state/expr';
import type { Watcher } from './elements';
import type { HandlerSet } from '../state/actions';
import type { BindSpec } from '../state/bind';
import type { AttrBind, BoundAttribute } from '../state/bindattr';
import type { Trigger, Modifiers, Mutation, OnRuleSpec } from '../state/on';
import type { Condition } from '../state/values';
import type { PersistSpec, PersistLink, Cell } from '../state/state';
import type { Typed } from '../state/values';
// Registries for reactive functions and custom selectors. The parser, scheduler and
// element manager only talk to these interfaces, so adding a function means adding
// one definition object, nothing else.

/** One parsed argument: literal CSS text with nested reactive calls in between. */
export interface Arg {
  parts: (string | CallNode)[];
  /** Raw source text of the argument (comments removed, trimmed). */
  text: string;
  /** Runtime instance shared by all elements when the argument is static (set by the engine). */
  shared?: ArgInstance;
}

export interface CallNode {
  name: string;
  def: FunctionDef;
  args: Arg[];
  /** Whatever `def.compile` returned: pre-parsed, validated arguments. */
  data: unknown;
  /** Argument instances shared by all elements when every argument is static (set by the engine). */
  staticArgs?: ArgInstance[];
}

/** Runtime context of one binding: the owning element and a way to request re-evaluation. */
export interface Ctx {
  el: Element;
  /** Marks the binding dirty; the scheduler re-evaluates and writes it in the next frame. */
  notify(): void;
}

export interface Instance {
  /** Current CSS text of this expression. Must not write to the DOM. */
  get(): string;
  /** Forget cached values so the next get() produces a fresh one (used by live(), on()). */
  reset?(): void;
  dispose?(): void;
}

export interface ArgInstance extends Instance {
  /** Static text when the argument contains no reactive calls, otherwise undefined. */
  text?: string;
}

export type FunctionKind =
  | 'generator' // produces a value: random(), pick()
  | 'operator'  // controls when its child re-evaluates: live()
  | 'event'     // re-evaluates on a DOM event: on()
  | 'source'    // reads a browser source: mouse(), visible()
  | 'native'    // compiles to plain CSS, no runtime: viewport()
  | 'condition'; // chooses a value from state: when()

export interface FunctionDef {
  name: string;
  kind: FunctionKind;
  /** Human- and machine-readable signature, e.g. "random(min, max)". */
  syntax?: string;
  /** Argument positions kept as plain text (not parsed for nested reactive calls). */
  rawArgs?: number[];
  /**
   * Context-aware claim: return false to leave a call with this name to the browser, e.g. the
   * standard element(#id) image function next to Reactive CSS element(width). Default: claim all.
   */
  matches?(argText: string): boolean;
  /** Validate and pre-parse arguments once. Throw an Error with a helpful message to reject. */
  compile?(args: Arg[]): unknown;
  /**
   * Return plain CSS to replace the call at compile time (no binding is created),
   * or undefined to fall back to the runtime. Called after compile().
   */
  native?(args: Arg[], data: any, nested: boolean): string | undefined;
  /**
   * For a top-level call whose value is the same for every element (e.g. mouse(x) in
   * viewport mode): return the shared source. The engine then computes the value once
   * and writes it for all matching elements together instead of per element.
   */
  shared?(data: any): SharedSource | undefined;
  create?(ctx: Ctx, args: ArgInstance[], data: any): Instance;
}

/** A value computed once for all subscribers. Subscribers are reference-counted by the source. */
export interface SharedSource {
  /** Current CSS text. Must be cheap: called once per flush per subscribing declaration. */
  get(): string;
  subscribe(sub: { notify(): void }): void;
  unsubscribe(sub: { notify(): void }): void;
}

export interface SelectorDef {
  name: string;
  kind: 'state' | 'structural';
  syntax?: string;
  /** True for functional pseudo-classes like :nth-var(--x). */
  functional: boolean;
  /**
   * Returns the attribute selector that replaces the pseudo-class in generated CSS
   * and registers whatever runtime the selector needs on `sheet`.
   * `compound` is the selector of the element the pseudo-class applies to (without it).
   */
  compile(arg: string, compound: string, sheet: SheetRuntime): string;
}

/** Runtime hooks a compiled sheet carries; created by selector defs at compile time. */
export interface SheetRuntime {
  /** Called when the sheet goes live; returns a cleanup function. */
  setup: (() => () => void)[];
}

export const functions = new Map<string, FunctionDef>();
export const selectors = new Map<string, SelectorDef>();

const NAME = /^[a-z][a-z0-9-]*$/;

export function defineFunction(def: FunctionDef): void {
  if (!NAME.test(def.name)) throw new Error(`Invalid function name "${def.name}"`);
  functions.set(def.name.toLowerCase(), def);
}

export function defineSelector(def: SelectorDef): void {
  if (!NAME.test(def.name)) throw new Error(`Invalid selector name "${def.name}"`);
  selectors.set(def.name.toLowerCase(), def);
}

/** Live counters for diagnostics and benchmarks. */
export const runtimeStats = {
  sheets: 0,
  /** Element-declaration pairs currently bound (shared declarations count each element). */
  bindings: 0,
  /** Event listeners and source subscriptions held by bindings. */
  sources: 0,
  /** Shared IntersectionObservers and the shared pointer listener currently alive. */
  observers: 0,
  parseMs: 0,
  /** State cells alive, and effective state changes so far. */
  states: 0,
  stateChanges: 0,
};

/** Events an `on:` declaration may react to. Anything else is rejected at compile time. */
export const ACTION_EVENTS = new Set(['click', 'change', 'input', 'pointerenter', 'pointerleave', 'focus', 'blur',
  // 0.5.1: focus moving in or out of a subtree, form reset, and the end or cancellation of the
  // element's own animations and transitions (target only: a child's animation does not count).
  'focusin', 'focusout', 'reset', 'animationend', 'animationcancel', 'transitionend', 'transitioncancel']);
/** Events outside(event, ...) may react to. */
export const OUTSIDE_EVENTS = new Set(['click', 'pointerdown', 'focusin']);

/**
 * A state mutation that `on:` may run. Actions can only change declared state cells: they
 * have no access to the DOM, network, storage or JavaScript.
 */
export interface ActionDef {
  name: string;
  syntax: string;
  /** Validate the argument texts once; throw to reject the declaration. */
  compile(args: string[]): unknown;
  /** Run for the element that carries the `on:` declaration, during the event's dispatch. */
  run(el: Element, data: any, event: Event): void;
  /** Cancels the event's default (prevent()): its event type needs a non-passive listener. */
  cancels?: boolean;
}

/** Triggers where prevent() is meaningful and safe (docs/rfc-prevent-action-0.7.md, section 4). */
export const CANCELABLE_TRIGGERS = new Set(['click', 'keydown']);

export const actions = new Map<string, ActionDef>();

/**
 * Runtimes of the declarations the parser recognizes, registered by their feature modules
 * (src/features/*). The parser reports a declaration whose runtime is absent (a custom bundle
 * without that feature) instead of compiling it; the engine and the state engine only look here.
 */
export interface DeclarationRuntimes {
  on?: { watcher(match: string, id: number, certain: boolean, set: HandlerSet, sheet?: CSSStyleSheet): Watcher; register(id: number, set: HandlerSet): () => void };
  bind?: (match: string, spec: BindSpec) => Watcher;
  text?: (match: string) => Watcher;
  attrs?: (match: string, names: string[]) => Watcher;
  focus?: (match: string) => Watcher;
  attrBinding?: (el: Element, b: AttrBind) => BoundAttribute;
  typed?: (name: string, value: string, syntax?: string) => void;
  /** 0.9.0 :on() rules (events feature, on.ts). */
  onRules?: {
    trigger(text: string): { trigger: Trigger; mods: Modifiers };
    mutation(name: string, text: string, trigger: Trigger): Omit<Mutation, 'id'>;
    watcher(match: string, spec: OnRuleSpec, sheet?: CSSStyleSheet): Watcher;
    register(spec: OnRuleSpec): () => void;
  };
  /** Drag gestures (gestures feature): the pointerdown listener, reference-counted by drag rules. */
  gestures?: { register(prevent: boolean): () => void };
  /** :focus(when(condition)) requests (focus feature). */
  focusWhen?: (match: string, cond: Condition) => Watcher;
  /** persist() (persist feature): initial value from storage, then a link that writes changes. */
  persist?: { initial(spec: PersistSpec, owner: Element, fallback: Typed): Typed | undefined; link(spec: PersistSpec, cell: Cell): PersistLink };
}
export const runtimes: DeclarationRuntimes = {};
/** Set by on.ts: the events :on() accepts (describe()). */
export const onEventNames: string[] = [];
const onEvents = () => [...onEventNames];

export function defineAction(def: ActionDef): void {
  if (!NAME.test(def.name)) throw new Error(`Invalid action name "${def.name}"`);
  actions.set(def.name, def);
}

/**
 * Machine-readable description: the feature registry (shipped, experimental, planned, with
 * categories and native equivalents), the native constructs left alone, and what is actually
 * registered at runtime (for tooling, docs, future MCP use).
 */
declare const __RCSS_BUNDLE__: string[] | undefined;

export function describe() {
  return {
    /** Feature IDs in this bundle (src/features/catalog.ts); null when built from source (all). */
    bundle: typeof __RCSS_BUNDLE__ !== 'undefined' ? __RCSS_BUNDLE__ : null,
    version: VERSION,
    features: FEATURES,
    keepNative: KEEP_NATIVE,
    functions: [...functions.values()].map((f) => ({ name: f.name, kind: f.kind, syntax: f.syntax })),
    selectors: [...selectors.values()].map((s) => ({ name: s.name, kind: s.kind, syntax: s.syntax })),
    actions: [...actions.values()].map((a) => ({ name: a.name, syntax: a.syntax })),
    expressions: EXPRESSIONS,
    events: [...ACTION_EVENTS],
    outsideEvents: [...OUTSIDE_EVENTS],
    /** 0.9.0: functions that exist only inside :on() mutations. */
    actionExpressions: ['event'],
    /** 0.9.0: events :on() accepts in this bundle (empty without the events feature). */
    onEvents: onEvents(),
  };
}

/** Functions run by ReactiveCSS.refresh(): re-read state that has no change notification. */
export const refreshers = new Set<() => void>();
/**
 * Run after a stylesheet is compiled or dropped: bindings that read computed values (text:, attr:,
 * focus:) read again, since another sheet's rules can change what they see (0.7.1: a state
 * declared in a sheet that loads after its users).
 */
export const sheetChangeHooks = new Set<() => void>();
