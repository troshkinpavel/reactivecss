// Stylesheet compiler: source text in, standard CSS + binding manifest out.
// The output is the original text with targeted splices, so everything we do not
// understand is passed through byte for byte. Pure: no DOM access, unit-testable.

import { tokenize, matching, type Token } from './tokenizer';
import { functions, selectors, actions, runtimes, ACTION_EVENTS, OUTSIDE_EVENTS, CANCELABLE_TRIGGERS, type Arg, type CallNode, type SheetRuntime } from './registry';
import { warn, note } from './log';
import { serialize, parseCondition, type Condition } from '../state/values';
import type { OnRuleSpec, Trigger, Modifiers } from '../state/on';
import { parseExpr, readsAttributes } from '../state/expr';
import { parseBind, kindOf, BINDABLE, type AttrBind } from '../state/bindattr';
import type { StateDecl, PersistSpec } from '../state/state';
import type { HandlerSet, Handler } from '../state/actions';
import { parseKey, type KeySpec } from '../state/keys';
import type { BindSpec } from '../state/bind';

export interface ReactiveDecl {
  varName: string;
  call: CallNode;
}

export interface ReactiveRule {
  /** Selector used to find elements that may need the bindings (state pseudo-classes removed). */
  match: string;
  decls: ReactiveDecl[];
  /** `--name: state(value)` declarations: the matching elements own these states. */
  states: StateDecl[];
  /** Id of the rule's `on:` handler set, if it has one. */
  handler?: number;
  /**
   * True when every element matching `match` is matched by the real rule unconditionally:
   * nothing was stripped from the selector and no @media/@supports/@container wraps it.
   */
  certain?: boolean;
  /** `bind: --x [closest(selector)]` on form controls. */
  bind?: BindSpec;
  /** The rule has a `text:` declaration (compiled to `--rcss-text`). */
  text?: boolean;
  /** Attributes of the rule's `attr:` declarations (each compiled to `--rcss-attr-<name>`). */
  attrs?: string[];
  /** The rule has a `focus:` declaration (compiled to `--rcss-focus`). */
  focus?: boolean;
  /** 0.9.0 :on() rule: its trigger, modifiers and mutation slots. */
  onSpec?: OnRuleSpec;
  /** 0.9.0 :focus(when(condition)) requests of the rule. */
  focusWhen?: Condition[];
  /** 0.9.0 state(…, bind(value | checked)): states bound to the matched control itself. */
  forms?: string[];
  /** Token range of the rule's own selector, and the enclosing rule (nesting): read by content:. */
  prelude?: [number, number];
  parent?: ReactiveRule;
}

/** What a rule prelude contained besides plain selectors (0.9.0 rule-level pseudo-classes). */
interface Prelude {
  on?: { trigger: Trigger; mods: Modifiers };
  focus: Condition[];
  /** Token ranges of :on(…) and :focus(…), replaced by :is(*). */
  special: [number, number][];
}

export interface CompiledSheet {
  css: string;
  rules: ReactiveRule[];
  runtime: SheetRuntime;
  /** `on:` handler sets by id. */
  handlers: Map<number, HandlerSet>;
  /** False when the sheet contains no reactive syntax: leave it alone. */
  changed: boolean;
  /**
   * Syntax this sheet used, as catalog keys (src/features/catalog.ts): `decl:on`, `trigger:key`,
   * `act:set`, `fn:live`, `sel:when`… (the analyzer maps them to bundle features).
   */
  uses: Set<string>;
}

declare const __RCSS_EXCLUDED__: Record<string, string> | undefined;
/**
 * Custom bundles (tools/bundle.mjs): syntax keys of the features left out, mapped to their
 * feature ID, so their use is reported instead of passed silently to the browser. Empty in the
 * full and compact bundles.
 */
export const EXCLUDED: Record<string, string> = typeof __RCSS_EXCLUDED__ !== 'undefined' ? __RCSS_EXCLUDED__ : {};
/** Declarations the parser recognizes and the feature that provides their runtime. */
const DECLARATION_FEATURE = { on: 'events', bind: 'forms', text: 'text', attr: 'attributes', focus: 'focus', typed: 'values', 'state-bind': 'attributes',
  'on-rule': 'events', drag: 'gestures', 'focus-when': 'focus', persist: 'persist', 'state-form': 'forms', 'attr-ns': 'attributes', content: 'text' } as const;
const missing = (what: string, feature: string) =>
  `${what} is not included in this bundle (feature "${feature}"); build a bundle with it (reactive-css build --features ${feature}) or use the full bundle`;
/** Names that may be the native CSS function of the same name: reported as a note, not a warning. */
const NATIVE_TOO = new Set(['random', 'element']);

export interface CompileOptions {
  /** Base URL of a linked sheet: relative URLs are made absolute. */
  baseURL?: string;
  /** `on:` actions are only accepted from trusted (same-origin or inline) stylesheets. */
  trusted?: boolean;
}

export const VAR_PREFIX = '--rcss-';
/** attr: <name> compiles to this prefix + name (see state/attrdecl.ts). */
export const ATTR_PREFIX = '--rcss-attr-';
let varCounter = 0;
/**
 * One generated property per state name for the page's lifetime. Recompiling a sheet (or two
 * sheets declaring the same state) reuses it, so CSS.registerProperty, which cannot be undone,
 * runs once per name instead of once per compile. Safe because a cell is per (owner, name)
 * anyway, the property is not inherited, and detach() removes the inline value only when no
 * other declaration of the cell still uses it.
 */
const stateVars = new Map<string, string>();
/** Identifies each state() declaration in its cascade marker (see stateDeclaration). */
let declCounter = 0;
let handlerCounter = 0;
/**
 * :on() slot properties (0.9.0): one per (trigger, state) and per (trigger, modifier), for the
 * page's lifetime, so recompiling never registers a property twice.
 */
const slotVars = new Map<string, string>();
const slot = (key: string) => {
  let v = slotVars.get(key);
  if (!v) slotVars.set(key, (v = VAR_PREFIX + 'o' + slotVars.size.toString(36)));
  return v;
};
/** Untrusted-sheet message shared by the declarations that act on the page. */
const UNTRUSTED = 'is ignored in untrusted stylesheets (cross-origin, or inline <style> with trustInlineStyles: false); move it to a same-origin stylesheet';
/** Values of a reactive content: declaration: state-derived, and never an image or generated content. */
const CONTENT_STATE = new Set(['var', 'when', 'previous', 'direction']);
const CONTENT_NATIVE = new Set(['url', 'image-set', '-webkit-image-set', 'image', 'cross-fade', 'element', 'attr', 'counter', 'counters',
  'linear-gradient', 'radial-gradient', 'conic-gradient', 'repeating-linear-gradient', 'repeating-radial-gradient', 'repeating-conic-gradient']);

/** At-rules whose blocks contain ordinary rules/declarations that we transform. */
const GROUPING = new Set(['media', 'supports', 'layer', 'container', 'scope', 'starting-style', 'document']);

/**
 * Pseudo-classes whose match depends on state we do not observe (hover, focus...), and
 * pseudo-elements. They are replaced by :is(*) when computing which elements to bind,
 * so we bind a superset of elements. Binding an extra element is harmless: the
 * generated var() is only used where the real selector matches.
 */
const STATEFUL = new Set([
  'hover', 'active', 'focus', 'focus-visible', 'focus-within', 'target', 'target-within',
  'visited', 'link', 'any-link', 'checked', 'indeterminate', 'default', 'disabled', 'enabled',
  'valid', 'invalid', 'user-valid', 'user-invalid', 'in-range', 'out-of-range', 'required',
  'optional', 'read-only', 'read-write', 'placeholder-shown', 'autofill', 'open', 'closed',
  'popover-open', 'modal', 'fullscreen', 'picture-in-picture', 'playing', 'paused', 'seeking',
  'buffering', 'stalled', 'muted', 'volume-locked', 'has', 'scope', 'empty', 'blank', 'state',
  'before', 'after', 'first-line', 'first-letter', 'current', 'past', 'future',
]);

export function compile(source: string, options: CompileOptions | string = {}): CompiledSheet {
  const { baseURL, trusted = true } = typeof options === 'string' ? { baseURL: options } : options;
  const tokens = tokenize(source);
  const handlers = new Map<number, HandlerSet>();
  const repl: (string | undefined)[] = [];
  const edits: { from: number; to: number; text: string }[] = [];
  const rules: ReactiveRule[] = [];
  const runtime: SheetRuntime = { setup: [] };
  const uses = new Set<string>();
  const use = (k: string) => { uses.add(k); };

  const raw = (i: number) => repl[i] ?? source.slice(tokens[i].start, tokens[i].end);
  /** Text of tokens [a, b) with comments dropped, as used for selectors and arguments. */
  const text = (a: number, b: number) => {
    let s = '';
    for (let i = a; i < b; i++) s += tokens[i].type === 'comment' ? ' ' : raw(i);
    return s.replace(/\s+/g, ' ').trim();
  };
  const snippet = (a: number, b: number) => {
    const s = text(a, b);
    return s.length > 90 ? s.slice(0, 87) + '...' : s;
  };
  const significant = (i: number, end: number) => {
    while (i < end && (tokens[i].type === 'ws' || tokens[i].type === 'comment')) i++;
    return i;
  };
  /** First '{' or ';' at nesting depth 0 in [i, end). */
  const boundary = (i: number, end: number) => {
    for (; i < end; i++) {
      const t = tokens[i].type;
      if (t === '{' || t === ';') return i;
      if (t === '(' || t === '[' || t === 'function') i = matching(tokens, i);
    }
    return end;
  };

  if (baseURL) rewriteURLs(tokens, repl, baseURL);

  // ---- reactive function calls -------------------------------------------------

  /** Is the function token at i a Reactive CSS call? (A def may decline, e.g. native element(#id).) */
  function claims(i: number): boolean {
    const def = functions.get(tokens[i].value);
    return !!def && (!def.matches || def.matches(text(i + 1, matching(tokens, i))));
  }

  /** A function of a feature left out of this bundle (the call is left to the browser). */
  function excludedFunction(i: number) {
    const name = tokens[i].value, feature = EXCLUDED['fn:' + name];
    const arg = text(i + 1, matching(tokens, i)).trim();
    if (name === 'element' && !/^(width|height)$/i.test(arg)) return; // native element(#id)
    use('fn:' + name);
    if (NATIVE_TOO.has(name)) note(`${name}() may be the native CSS function; the Reactive CSS ${name}() ${missing('', feature).slice(1)}`);
    else warn(missing(`${name}()`, feature));
  }

  function parseCall(open: number, close: number, nested: boolean): CallNode | string {
    const name = tokens[open].value;
    const def = functions.get(name)!;
    use('fn:' + name);
    const args: Arg[] = [];
    let start = open + 1;
    const flush = (end: number) => {
      const parts: (string | CallNode)[] = [];
      let buf = '';
      const keepRaw = def.rawArgs?.includes(args.length);
      for (let i = start; i < end; i++) {
        const t = tokens[i];
        if (!keepRaw && t.type === 'function' && claims(i)) {
          const c = matching(tokens, i);
          const node = parseCall(i, c, true);
          if (typeof node === 'string') buf += node;
          else { if (buf) parts.push(buf); buf = ''; parts.push(node); }
          i = c;
        } else buf += t.type === 'comment' ? ' ' : raw(i);
      }
      if (buf) parts.push(buf);
      if (typeof parts[0] === 'string') parts[0] = parts[0].trimStart();
      const last = parts.length - 1;
      if (typeof parts[last] === 'string') parts[last] = (parts[last] as string).trimEnd();
      args.push({ parts: parts.filter((p) => p !== ''), text: text(start, end) });
    };
    for (let i = start; i < close; i++) {
      const t = tokens[i].type;
      if (t === ',') { flush(i); start = i + 1; }
      else if (t === '(' || t === '[' || t === '{' || t === 'function') i = matching(tokens, i);
    }
    flush(close);
    if (args.length === 1 && args[0].parts.length === 0) args.length = 0; // name()
    let data: unknown;
    try { data = def.compile?.(args); } catch (e) { throw new Error(`${name}(): ${(e as Error).message}`); }
    const native = def.native?.(args, data, nested);
    if (native !== undefined) return native;
    if (!def.create) throw new Error(`${name}() cannot be used here`);
    return { name, def, args, data };
  }

  /** Splits [a, b) at depth-0 commas into token ranges. */
  function split(a: number, b: number): [number, number][] {
    const out: [number, number][] = [];
    let start = a;
    for (let i = a; i < b; i++) {
      const t = tokens[i].type;
      if (t === ',') { out.push([start, i]); start = i + 1; }
      else if (t === '(' || t === '[' || t === '{' || t === 'function') i = matching(tokens, i);
    }
    out.push([start, b]);
    return out.filter(([x, y]) => significant(x, y) < y);
  }

  /** Index after an optional trailing `!important`, plus whether it was there. */
  function important(from: number, to: number): [number, boolean] {
    let end = to;
    while (end > from && (tokens[end - 1].type === 'ws' || tokens[end - 1].type === 'comment')) end--;
    const last = tokens[end - 1], bang = tokens[end - 2];
    if (last?.type === 'ident' && last.value.toLowerCase() === 'important' && bang?.value === '!') return [end - 2, true];
    return [to, false];
  }

  /** `--name: state(value [, bind(…)] [, persist(…)])`: the matching elements own a state cell. */
  function stateDeclaration(name: string, colon: number, to: number, rule: ReactiveRule | null, conditional: boolean) {
    const i = significant(colon + 1, to);
    const [end, imp] = important(colon + 1, to);
    const t = tokens[i];
    if (!rule) throw new Error('state() is only supported inside style rules');
    if (!name.startsWith('--') || t?.type !== 'function' || t.value !== 'state')
      throw new Error('state() must be the whole value of a custom property, e.g. --open: state(false)');
    if (name.startsWith('--attr-') || name.startsWith('--rcss-')) throw new Error(`${name.slice(0, 7)}* is a reserved namespace; name the state differently`);
    const close = matching(tokens, i);
    if (significant(close + 1, end) < end) throw new Error('state() must be the whole value of a custom property');
    const args = split(i + 1, close);
    if (args.length > 3) throw new Error('expected state(initial [, bind(…)] [, persist("key")])');
    const first = text(...args[0]);
    if (/^(bind|persist)\(/i.test(first)) throw new Error(`state() needs an initial value first, e.g. state(false, ${first})`);
    const init = parseExpr(first);
    const initType = init.k === 'lit' ? init.t.type : init.k === 'attr' ? init.fallback.type : init.k === 'split' ? 'string' : undefined;
    let bind: AttrBind | undefined;
    let persist: PersistSpec | undefined;
    let form = false;
    for (const a of args.slice(1)) {
      const m = text(...a);
      if (/^persist\(/i.test(m)) {
        if (persist) throw new Error('persist() is given twice');
        const p = /^persist\(\s*(["'])([A-Za-z0-9_.:-]{1,64})\1\s*(?:,\s*(local|session)\s*)?\)$/i.exec(m);
        if (!p) throw new Error(`expected persist("key") or persist("key", local | session) with a key of letters, digits and _ . : -, got "${m}"`);
        use('decl:state-persist');
        if (!runtimes.persist) throw new Error(missing('persist()', DECLARATION_FEATURE.persist));
        persist = { key: p[2], session: p[3]?.toLowerCase() === 'session' };
      } else if (/^bind\(\s*(value|checked)\s*\)$/i.test(m)) {
        if (bind || form) throw new Error('bind() is given twice');
        const target = /value/i.test(m) ? 'value' : 'checked';
        use('decl:state-form');
        if (!runtimes.bind) throw new Error(missing(`state(…, bind(${target}))`, DECLARATION_FEATURE['state-form']));
        if (!trusted) throw new Error(`bind(${target}) in state() ${UNTRUSTED}`);
        if (conditional || !rule.certain)
          throw new Error(`bind(${target}) must be in an unconditional rule (no @media/@supports/@container, :hover, :focus...), because a binding lasts as long as the element matches`);
        if (target === 'checked' && initType !== 'boolean') throw new Error(`bind(checked) needs a boolean state, e.g. state(false, bind(checked))`);
        if (target === 'value' && initType === 'boolean') throw new Error('bind(value) needs a string or number state; use bind(checked) for a checkbox');
        form = true;
      } else if (/^bind\(/i.test(m)) {
        if (bind || form) throw new Error('bind() is given twice');
        bind = parseBind(m, initType);
      } else throw new Error(`expected state(initial [, bind(…)] [, persist("key")]); "${m}" is neither bind() nor persist()`);
    }
    use('decl:state');
    if (bind) {
      use('decl:state-bind');
      if (!runtimes.attrBinding) throw new Error(missing('state(…, bind(attribute))', DECLARATION_FEATURE['state-bind']));
    }
    if (bind && !trusted)
      throw new Error('bind() in state() is ignored in untrusted stylesheets (cross-origin, or inline <style> with trustInlineStyles: false): it writes HTML attributes');
    if (!trusted && readsAttributes(init))
      throw new Error('attr() in state() is ignored in untrusted stylesheets (cross-origin, or inline <style> with trustInlineStyles: false); move it to a same-origin stylesheet');
    let varName = stateVars.get(name);
    if (!varName) stateVars.set(name, (varName = VAR_PREFIX + 's' + (++varCounter).toString(36)));
    // A literal is the var() fallback (nothing to write at start); an evaluated value is written per owner.
    edits.push({ from: i, to: close + 1, text: init.k === 'lit' ? `var(${varName}, ${serialize(init.t)})` : `var(${varName})` });
    // Cascade marker: declared in the same rule with the same importance, so the browser's cascade
    // (specificity, order, layers, media, !important) picks its winner exactly like the state's.
    // Read only when several declarations of one state match one owner. Not registered.
    const id = ++declCounter;
    edits.push({ from: to, to, text: `; ${varName}-w: ${id}${imp ? ' !important' : ''}` });
    rule.states.push({ name, varName, init, id, bind, persist });
    if (form && !(rule.forms ??= []).includes(name)) rule.forms.push(name);
    if (!rules.includes(rule)) rules.push(rule);
  }

  /** `on: click(action, ...), change(...)`: becomes `--rcss-on: <id>` so the cascade picks it. */
  function onDeclaration(from: number, colon: number, to: number, rule: ReactiveRule | null, conditional: boolean) {
    use('decl:on');
    if (!runtimes.on) throw new Error(missing('on:', DECLARATION_FEATURE.on));
    if (!rule) throw new Error('on: is only supported inside style rules');
    if (conditional) rule.certain = false; // e.g. .btn { @media (...) { on: ... } }
    if (!trusted) throw new Error('on: is ignored in untrusted stylesheets (cross-origin, or inline <style> with trustInlineStyles: false); move it to a same-origin stylesheet');
    const [end, imp] = important(colon + 1, to);
    const set: HandlerSet = new Map();
    for (const [a, b] of split(colon + 1, end)) {
      const i = significant(a, b);
      const ev = tokens[i];
      const triggers = [...ACTION_EVENTS, 'key', 'outside'];
      if (ev.type !== 'function' || !triggers.includes(ev.value) || significant(matching(tokens, i) + 1, b) < b)
        throw new Error(`expected event(action, ...) with one of: ${[...ACTION_EVENTS].join(', ')}, key(Key, ...), outside(event, ...); got "${text(a, b)}"`);
      let parts = split(i + 1, matching(tokens, i));
      let trigger = ev.value;
      use('trigger:' + ev.value);
      let key: KeySpec | undefined;
      if (ev.value === 'key') {
        key = parseKey(parts.length ? text(...parts[0]) : '');
        trigger = 'keydown';
        parts = parts.slice(1);
      } else if (ev.value === 'outside') {
        const t = parts.length ? text(...parts[0]).toLowerCase() : '';
        if (!OUTSIDE_EVENTS.has(t)) throw new Error(`outside() takes one of: ${[...OUTSIDE_EVENTS].join(', ')}; got "${t}"`);
        trigger = 'outside:' + t;
        parts = parts.slice(1);
      }
      if (!parts.length) throw new Error(`${ev.value}() needs at least one action`);
      const handler: Handler = { key, actions: [] };
      const list = set.get(trigger) ?? [];
      list.push(handler);
      for (const [c, d] of parts) {
        const j = significant(c, d);
        const act = tokens[j];
        const def = act.type === 'function' ? actions.get(act.value) : undefined;
        if (!def || significant(matching(tokens, j) + 1, d) < d)
          throw new Error(`unknown action "${text(c, d)}"; available: ${[...actions.keys()].map((n) => n + '()').join(', ')}`);
        const args = split(j + 1, matching(tokens, j)).map(([x, y]) => text(x, y));
        if (def.cancels && !CANCELABLE_TRIGGERS.has(trigger))
          throw new Error(trigger.startsWith('outside:')
            ? 'prevent() is not allowed in outside(): it would cancel clicks on unrelated elements anywhere on the page'
            : `prevent() only works in click(…) and key(…); ${ev.value === 'key' ? 'key' : trigger} events ${trigger === 'reset' ? 'are restored by bind: after a reset, so cancelling them is not supported' : 'are not cancelable'}`);
        use('act:' + def.name);
        try { handler.actions.push({ def, data: def.compile(args) }); } catch (e) { throw new Error(`${def.name}(): ${(e as Error).message}`); }
      }
      set.set(trigger, list);
    }
    const id = ++handlerCounter;
    handlers.set(id, set);
    let stop = to; // keep trailing whitespace and comments as written
    while (stop > from && (tokens[stop - 1].type === 'ws' || tokens[stop - 1].type === 'comment')) stop--;
    edits.push({ from, to: stop, text: `--rcss-on: ${id}${imp ? ' !important' : ''}` });
    rule.handler = id;
    if (!rules.includes(rule)) rules.push(rule);
  }

  /** `bind: --x` or `bind: --x closest(.form)`: two-way binding of a form control. */
  function bindDeclaration(colon: number, to: number, rule: ReactiveRule | null, conditional: boolean) {
    use('decl:bind');
    if (!runtimes.bind) throw new Error(missing('bind:', DECLARATION_FEATURE.bind));
    if (!rule) throw new Error('bind: is only supported inside style rules');
    if (!trusted) throw new Error('bind: is ignored in untrusted stylesheets (cross-origin, or inline <style> with trustInlineStyles: false); move it to a same-origin stylesheet');
    if (conditional || !rule.certain)
      throw new Error('bind: must be in an unconditional rule (no @media/@supports/@container, :hover, :focus...), because a binding lasts as long as the element matches');
    const m = /^(--[^\s,()]+)(?:\s+closest\((.+)\))?$/.exec(text(colon + 1, to));
    if (!m) throw new Error('expected bind: --state or bind: --state closest(selector)');
    rule.bind = { name: m[1], scope: m[2]?.trim() };
    edits.push({ from: colon + 1, to, text: ` ${m[1]}` }); // harmless unknown property for the browser
    if (!rules.includes(rule)) rules.push(rule);
  }

  /** `--x: typed(value)` / `typed(value, "<syntax>")`: registration + a plain declaration. */
  function typedDeclaration(name: string, colon: number, to: number) {
    use('fn:typed');
    const register = runtimes.typed;
    if (!register) throw new Error(missing('typed()', DECLARATION_FEATURE.typed));
    const i = significant(colon + 1, to);
    const [end] = important(colon + 1, to);
    const t = tokens[i];
    if (!name.startsWith('--') || t?.type !== 'function' || t.value !== 'typed')
      throw new Error('typed() must be the whole value of a custom property, e.g. --angle: typed(0deg)');
    const close = matching(tokens, i);
    if (significant(close + 1, end) < end) throw new Error('typed() must be the whole value of a custom property');
    const args = split(i + 1, close).map(([a, b]) => text(a, b));
    if (args.length < 1 || args.length > 2) throw new Error('expected typed(value) or typed(value, "<syntax>")');
    const syntax = args[1]?.replace(/^["']|["']$/g, '');
    if (syntax !== undefined && !/^<[a-z-]+>$/.test(syntax)) throw new Error(`typed(): "${args[1]}" is not a supported syntax like "<length>" or "<color>"`);
    edits.push({ from: i, to: close + 1, text: args[0] });
    runtime.setup.push(() => { register(name, args[0], syntax); return () => {}; });
  }

  function declaration(from: number, to: number, rule: ReactiveRule | null, conditional = false) {
    let colon = from;
    while (colon < to && tokens[colon].type !== ':') colon++;
    const name = text(from, colon);
    if (rule?.onSpec) { mutation(from, colon, to, rule.onSpec); return; }
    if (rule?.focusWhen) { dropDeclaration(from, to, 'a :focus(when()) rule only requests focus; its declarations would apply all the time'); return; }
    if (tokens.slice(colon + 1, to).some((t) => t.type === 'function' && t.value === 'typed')) {
      try { typedDeclaration(name, colon, to); } catch (e) {
        warn(`${(e as Error).message} in "${snippet(from, to)}". Declaration left unchanged.`);
      }
      return;
    }
    if (name.toLowerCase() === 'bind') {
      try { bindDeclaration(colon, to, rule, conditional); } catch (e) {
        warn(`${(e as Error).message} in "${snippet(from, to)}". Declaration left unchanged.`);
      }
      return;
    }
    if (name.trim().toLowerCase() === 'focus') {
      // focus: <value> is compiled to --rcss-focus: <value> (same rule, same importance).
      try {
        use('decl:focus');
        if (!runtimes.focus) throw new Error(missing('focus:', DECLARATION_FEATURE.focus));
        if (!rule) throw new Error('focus: is only supported inside style rules');
        if (!trusted) throw new Error('focus: is ignored in untrusted stylesheets (cross-origin, or inline <style> with trustInlineStyles: false); it moves focus');
        const bad = tokens.slice(colon + 1, to).find((t) => t.type === 'function' && !TEXT_FUNCTIONS.has(t.value));
        if (bad) throw new Error(`focus: takes one boolean value: true, false, var(--x) or when(...); ${bad.value}() is not supported`);
        edits.push({ from, to: colon, text: '--rcss-focus' });
        rule.focus = true;
        if (!rules.includes(rule)) rules.push(rule);
      } catch (e) {
        warn(`${(e as Error).message} in "${snippet(from, to)}". Declaration left unchanged.`);
        return;
      }
    }
    if (name.trim().toLowerCase() === 'text') {
      // text: <value> is compiled to --rcss-text: <value> (same rule, same importance), so the
      // cascade picks the winner; reactive functions in the value become bindings as usual.
      try {
        use('decl:text');
        if (!runtimes.text) throw new Error(missing('text:', DECLARATION_FEATURE.text));
        if (!rule) throw new Error('text: is only supported inside style rules');
        if (!trusted) throw new Error('text: is ignored in untrusted stylesheets (cross-origin, or inline <style> with trustInlineStyles: false); move it to a same-origin stylesheet');
        const bad = tokens.slice(colon + 1, to).find((t) => t.type === 'function' && !TEXT_FUNCTIONS.has(t.value));
        if (bad) throw new Error(`text: takes one value: a string, a number, var(--x), previous(--x), direction(--x) or when(...); ${bad.value}() is not supported`);
        edits.push({ from, to: colon, text: '--rcss-text' });
        rule.text = true;
        if (!rules.includes(rule)) rules.push(rule);
      } catch (e) {
        warn(`${(e as Error).message} in "${snippet(from, to)}". Declaration left unchanged.`);
        return;
      }
    }
    if (name.trim().toLowerCase() === 'attr') {
      // attr: <attribute> <value> is compiled to --rcss-attr-<attribute>: <value>: one property
      // per attribute, so attr: declarations for different attributes never replace each other.
      try {
        use('decl:attr');
        if (!runtimes.attrs) throw new Error(missing('attr:', DECLARATION_FEATURE.attr));
        if (!rule) throw new Error('attr: is only supported inside style rules');
        if (!trusted) throw new Error('attr: is ignored in untrusted stylesheets (cross-origin, or inline <style> with trustInlineStyles: false); it writes HTML attributes');
        let n = colon + 1;
        while (n < to && tokens[n].type === 'ws') n++;
        const attr = tokens[n]?.type === 'ident' ? tokens[n].value.toLowerCase() : '';
        if (!kindOf(attr)) throw new Error(`attr: starts with the attribute to write: ${BINDABLE} (no event handlers, URLs, style or free text)${attr ? `; "${attr}" is not one of them` : ''}`);
        if (!tokens.slice(n + 1, to).some((t) => t.type !== 'ws' && t.type !== 'comment')) throw new Error(`attr: ${attr} needs a value, e.g. attr: ${attr} var(--state)`);
        const bad = tokens.slice(n + 1, to).find((t) => t.type === 'function' && !TEXT_FUNCTIONS.has(t.value));
        if (bad) throw new Error(`attr: takes one value: a string, a number, a keyword, var(--x), previous(--x), direction(--x) or when(...); ${bad.value}() is not supported`);
        edits.push({ from, to: colon, text: ATTR_PREFIX + attr }, { from: n, to: tokens[n + 1].type === 'ws' ? n + 2 : n + 1, text: '' });
        if (!(rule.attrs ??= []).includes(attr)) rule.attrs.push(attr);
        if (!rules.includes(rule)) rules.push(rule);
      } catch (e) {
        warn(`${(e as Error).message} in "${snippet(from, to)}". Declaration left unchanged.`);
        return;
      }
    }
    const hasState = tokens.slice(colon + 1, to).some((t) => t.type === 'function' && t.value === 'state');
    if (name.startsWith('--attr-') && !hasState) {
      // --attr-<attribute>: <value> (0.9.0): the reserved namespace for attributes, compiled like attr:.
      try {
        use('decl:attr-ns');
        const attr = name.slice(7);
        if (!runtimes.attrs) throw new Error(missing('--attr-*', DECLARATION_FEATURE['attr-ns']));
        if (!rule) throw new Error('--attr-* is only supported inside style rules');
        if (!trusted) throw new Error(`--attr-* ${UNTRUSTED}; it writes HTML attributes`);
        if (attr !== attr.toLowerCase()) throw new Error(`write the attribute in lower case: --attr-${attr.toLowerCase()} (custom property names are case-sensitive, HTML attribute names are not)`);
        if (!kindOf(attr)) throw new Error(`--attr-${attr}: only ${BINDABLE} can be written (no event handlers, URLs, style, id, class or value)`);
        if (!tokens.slice(colon + 1, to).some((t) => t.type !== 'ws' && t.type !== 'comment')) throw new Error(`${name} needs a value, e.g. ${name}: var(--state)`);
        const bad = tokens.slice(colon + 1, to).find((t) => t.type === 'url' || (t.type === 'function' && !TEXT_FUNCTIONS.has(t.value)));
        if (bad) throw new Error(`${name} takes one value: a string, a number, a keyword, var(--x), previous(--x), direction(--x) or when(...); ${bad.type === 'url' ? 'url' : bad.value}() is not supported`);
        edits.push({ from, to: colon, text: ATTR_PREFIX + attr });
        if (!(rule.attrs ??= []).includes(attr)) rule.attrs.push(attr);
        if (!rules.includes(rule)) rules.push(rule);
      } catch (e) {
        warn(`${(e as Error).message} in "${snippet(from, to)}". Declaration left unchanged.`);
        return;
      }
    }
    if (name.toLowerCase() === 'on' || hasState) {
      try {
        if (hasState) stateDeclaration(name, colon, to, rule, conditional);
        else onDeclaration(from, colon, to, rule, conditional);
      } catch (e) {
        warn(`${(e as Error).message} in "${snippet(from, to)}". Declaration left unchanged.`);
      }
      return;
    }
    const local: typeof edits = [];
    const decls: ReactiveDecl[] = [];
    try {
      for (let i = colon + 1; i < to; i++) {
        const t = tokens[i];
        if (t.type !== 'function') continue;
        if (!claims(i)) { if (EXCLUDED['fn:' + t.value]) excludedFunction(i); continue; }
        if (!rule) throw new Error('reactive functions are only supported inside style rules');
        const close = matching(tokens, i);
        const node = parseCall(i, close, false);
        if (typeof node === 'string') local.push({ from: i, to: close + 1, text: node });
        else {
          const varName = VAR_PREFIX + (++varCounter).toString(36);
          local.push({ from: i, to: close + 1, text: `var(${varName})` });
          decls.push({ varName, call: node });
        }
        i = close;
      }
    } catch (e) {
      warn(`${(e as Error).message} in "${snippet(from, to)}". Declaration left unchanged.`);
      return;
    }
    edits.push(...local);
    if (decls.length) {
      if (!rules.includes(rule!)) rules.push(rule!);
      rule!.decls.push(...decls);
    }
    if (name.toLowerCase() === 'content' && rule && !pseudo(rule)) contentDeclaration(colon, to, rule, local);
  }

  /** A selector of the rule (or an enclosing one) has a pseudo-element: content: stays native there. */
  function pseudo(rule: ReactiveRule): boolean {
    for (let r: ReactiveRule | undefined = rule; r; r = r.parent)
      if (r.prelude && /::|:(before|after|first-line|first-letter|marker|placeholder|backdrop)\b/i.test(text(...r.prelude))) return true;
    return false;
  }

  /**
   * `content: var(--count)` on elements (0.9.0): kept as written (native), plus `--rcss-text` with
   * the same value for the DOM text runtime. Only state-derived values: literals, images,
   * counters and attr() stay purely native (docs/rfc-v0.9.0-language.md, section 8).
   */
  function contentDeclaration(colon: number, to: number, rule: ReactiveRule, local: typeof edits) {
    const fns = tokens.slice(colon + 1, to).filter((t) => t.type === 'function' || t.type === 'url');
    if (!fns.some((t) => CONTENT_STATE.has(t.value)) || fns.some((t) => t.type === 'url' || CONTENT_NATIVE.has(t.value))) return;
    use('decl:content');
    if (!trusted) return; // native content only, as for text: in untrusted sheets
    if (!runtimes.text) { warn(missing('content: var(…) as DOM text', DECLARATION_FEATURE.content)); return; }
    const [end, imp] = important(colon + 1, to);
    let value = '';
    for (let k = colon + 1; k < end;) {
      const ed = local.find((x) => x.from === k);
      if (ed) { value += ed.text; k = ed.to; } else { value += tokens[k].type === 'comment' ? ' ' : raw(k); k++; }
    }
    edits.push({ from: to, to, text: `; --rcss-text: ${value.trim()}${imp ? ' !important' : ''}` });
    rule.text = true;
    if (!rules.includes(rule)) rules.push(rule);
  }

  // ---- 0.9.0 rule-level constructs -------------------------------------------------

  /** End of a declaration without its trailing whitespace and comments. */
  const trimEnd = (from: number, to: number) => {
    while (to > from && (tokens[to - 1].type === 'ws' || tokens[to - 1].type === 'comment')) to--;
    return to;
  };

  function dropDeclaration(from: number, to: number, why: string) {
    warn(`${why}: "${snippet(from, to)}" is dropped.`);
    edits.push({ from, to: trimEnd(from, to), text: '' });
  }

  function dropNested(from: number, to: number, rule: ReactiveRule) {
    warn(`nested rules and at-rules are not supported inside ${rule.onSpec ? 'an :on()' : 'a :focus(when())'} rule; "${snippet(from, to)}" is dropped.`);
    edits.push({ from, to, text: '' });
  }

  /**
   * `.x:on(click, prevent) { --count: increment(1) }`: an ordinary rule whose declarations are slot
   * properties (mutation ids); the cascade picks one winning mutation per state and element.
   */
  function onRule(r: ReactiveRule, on: { trigger: Trigger; mods: Modifiers }, from: number, b: number, close: number) {
    const spec: OnRuleSpec = { id: ++handlerCounter, sig: text(from, close + 1), trigger: on.trigger, mods: on.mods, slots: [], modSlots: {}, certain: r.certain === true };
    r.onSpec = spec;
    let head = '';
    for (const k of ['prevent', 'stop'] as const) {
      if (!on.mods[k]) continue;
      const prop = (spec.modSlots[k] = slot(`${on.trigger.key}|${k}`));
      head += ` ${prop}: ${spec.id};`;
    }
    if (head) edits.push({ from: b + 1, to: b + 1, text: head });
    block(b + 1, close, r);
    if (!spec.slots.length && !head) warn(`the :on(${on.trigger.key}) rule "${snippet(from, b)}" changes no state and has no modifier; it does nothing.`);
    rules.push(r);
  }

  function mutation(from: number, colon: number, to: number, spec: OnRuleSpec) {
    const name = text(from, colon);
    const [end, imp] = important(colon + 1, to);
    if (!name.startsWith('--') || name.startsWith('--attr-') || name.startsWith('--rcss-'))
      return dropDeclaration(from, to, `an :on() rule contains only state changes like --open: toggle(); "${name}" is not one (a rule describes either an event or a style)`);
    let m;
    try { m = runtimes.onRules!.mutation(name, text(colon + 1, end), spec.trigger); } catch (e) { return dropDeclaration(from, to, (e as Error).message); }
    const mut = { ...m, id: ++handlerCounter, rule: spec };
    use('mut:' + mut.op);
    if (/\bevent\(/i.test(text(colon + 1, end))) use('expr:event');
    const prop = slot(`${spec.trigger.key}|${name}`);
    spec.slots = spec.slots.filter((x) => x.prop !== prop); // the last declaration in a rule wins, as in CSS
    spec.slots.push({ prop, m: mut });
    edits.push({ from, to: trimEnd(from, to), text: `${prop}: ${mut.id}${imp ? ' !important' : ''}` });
  }

  /** `.dialog input:focus(when(--open)) {}`: a focus request, no style. */
  function focusRule(r: ReactiveRule, conds: Condition[], from: number, b: number, close: number) {
    r.focusWhen = conds;
    block(b + 1, close, r);
    rules.push(r);
  }

  // ---- selectors ---------------------------------------------------------------

  /** Replaces custom pseudo-classes in a rule prelude; returns the rule's match selector. */
  function selector(from: number, to: number, parent: string | null, pre?: Prelude): string | null {
    const local: typeof edits = [];
    try {
      let items: [number, number][] | undefined; // selector list items, split only for :on() / :focus(when())
      const itemEnd = (at: number) => (items ??= split(from, to)).find(([a, b]) => at >= a && at < b)?.[1] ?? to;
      const special = new Set<number>(); // item ends with :on() / :focus(when())
      let depth = 0;
      for (let i = from; i < to; i++) {
        const tt = tokens[i].type;
        if (tt === 'function' || tt === '(' || tt === '[') { depth++; continue; }
        if (tt === ')' || tt === ']') { depth--; continue; }
        if (tt !== ':' || tokens[i - 1]?.type === ':') continue;
        const t = tokens[i + 1];
        if (t?.type === 'function' && (t.value === 'on' || t.value === 'focus')) {
          // 0.9.0 rule-level pseudo-classes: :on(trigger, modifiers…) and :focus(when(condition)).
          const what = t.value === 'on' ? ':on()' : ':focus(when())';
          const end = matching(tokens, i + 1) + 1;
          if (!pre) throw new Error(`${what} is not supported in this position`);
          if (depth > 0) throw new Error(`${what} cannot be inside :not(), :is(), :where() or :has()`);
          const [, cTo] = compound(from, to, i);
          const stop = itemEnd(i);
          if (significant(cTo, stop) < stop) throw new Error(`${what} must be on the subject of the selector (its last compound)`);
          if ((t.value === 'on' && pre.focus.length) || (t.value === 'focus' && pre.on)) throw new Error('a rule cannot combine :on() and :focus(when())');
          if (special.has(stop)) throw new Error(`one ${what} per selector`);
          special.add(stop);
          const arg = text(i + 2, end - 1);
          if (t.value === 'on') {
            use('sel:on');
            if (!runtimes.onRules) throw new Error(missing(':on()', DECLARATION_FEATURE['on-rule']));
            let c: { trigger: Trigger; mods: Modifiers };
            try { c = runtimes.onRules.trigger(arg); } catch (e) {
              throw (e as Error).message === 'feature:gestures' ? new Error(missing(':on(drag)', DECLARATION_FEATURE.drag)) : e;
            }
            use(c.trigger.phase !== undefined ? 'gesture:drag' : 'trigger:' + (c.trigger.outside ? 'outside' : c.trigger.dom));
            for (const [k, v] of Object.entries(c.mods)) if (v) use('mod:' + k);
            const same = (a: { trigger: Trigger; mods: Modifiers }) => a.trigger.key === c.trigger.key && JSON.stringify(a.mods) === JSON.stringify(c.mods);
            if (pre.focus.length || (pre.on && !same(pre.on))) throw new Error('every selector of an :on() rule must use the same trigger and modifiers; write one rule per trigger');
            pre.on = c;
          } else {
            const m = /^when\(([\s\S]*)\)$/i.exec(arg.trim());
            if (!m) throw new Error(':focus() takes when(condition), e.g. input:focus(when(--open)); plain :focus is native CSS');
            use('sel:focus-when');
            if (!runtimes.focusWhen) throw new Error(missing(':focus(when())', DECLARATION_FEATURE['focus-when']));
            if (pre.on) throw new Error('a rule cannot combine :on() and :focus(when())');
            pre.focus.push(parseCondition(m[1]));
          }
          pre.special.push([i, end]);
          local.push({ from: i, to: end, text: ':is(*)' });
          i = end - 1;
          continue;
        }
        const def = t && (t.type === 'ident' || t.type === 'function') ? selectors.get(t.value.toLowerCase()) : undefined;
        if (!def) {
          const feature = t && EXCLUDED['sel:' + t.value.toLowerCase()];
          if (feature) throw new Error(missing(`:${t.value.toLowerCase()}${t.type === 'function' ? '()' : ''}`, feature));
          continue;
        }
        use('sel:' + def.name);
        if (def.functional !== (t.type === 'function')) throw new Error(`:${def.name} ${def.functional ? 'needs' : 'takes no'} arguments`);
        const end = def.functional ? matching(tokens, i + 1) + 1 : i + 2;
        const arg = def.functional ? text(i + 2, end - 1) : '';
        const [cFrom, cTo] = compound(from, to, i);
        const candidate = resolveNesting(parent, strip(cFrom, i) + strip(end, cTo));
        local.push({ from: i, to: end, text: def.compile(arg, candidate, runtime) });
        i = end - 1;
      }
      if (special.size && special.size !== items!.length)
        throw new Error(`every selector of the rule must use ${pre?.on ? ':on()' : ':focus(when())'} (a rule describes either an event or a style)`);
    } catch (e) {
      warn(`${(e as Error).message} in selector "${snippet(from, to)}". Rule left unchanged.`);
      return null;
    }
    edits.push(...local);
    return resolveNesting(parent, strip(from, to));
  }

  /** Token range of the compound selector containing token `at`. */
  function compound(from: number, to: number, at: number): [number, number] {
    const isCombinator = (i: number) => {
      const t = tokens[i];
      return t.type === 'ws' || t.type === ',' || (t.type === 'delim' && '>+~'.includes(t.value));
    };
    // An unmatched opener or closer is the edge of an enclosing group, e.g. :has(.x:nth-var(--a)).
    const opener = (i: number) => tokens[i].type === 'function' || tokens[i].type === '(' || tokens[i].type === '[';
    let a = at;
    while (a > from && !isCombinator(a - 1) && !opener(a - 1)) {
      a--;
      if (tokens[a].type === ')' || tokens[a].type === ']') a = openerOf(a, from);
    }
    let b = at;
    while (b < to && !isCombinator(b) && tokens[b].type !== ')' && tokens[b].type !== ']') {
      if (tokens[b].type === '(' || tokens[b].type === '[' || tokens[b].type === 'function') b = matching(tokens, b);
      b++;
    }
    return [a, b];
  }

  function openerOf(close: number, from: number): number {
    let depth = 0;
    for (let i = close; i >= from; i--) {
      const t = tokens[i].type;
      if (t === ')' || t === ']') depth++;
      else if (t === '(' || t === '[' || t === 'function') if (--depth === 0) return i;
    }
    return from;
  }

  /** Selector text of [a, b) with stateful pseudo-classes and pseudo-elements replaced by :is(*). */
  function strip(a: number, b: number): string {
    let s = '';
    let negated = 0;
    const closers: boolean[] = [];
    for (let i = a; i < b; i++) {
      const t = tokens[i];
      if (t.type === ':' && negated === 0) {
        const pe = tokens[i + 1]?.type === ':';
        const n = tokens[i + (pe ? 2 : 1)];
        if (n && (n.type === 'ident' || n.type === 'function')) {
          const name = n.value.toLowerCase();
          if (pe || STATEFUL.has(name) || selectors.has(name) || (name === 'on' && n.type === 'function')) {
            const nameIdx = i + (pe ? 2 : 1);
            i = n.type === 'function' ? matching(tokens, nameIdx) : nameIdx;
            s += ':is(*)';
            continue;
          }
        }
      }
      if (t.type === 'function' || t.type === '(') {
        const isNot = t.type === 'function' && t.value === 'not';
        closers.push(isNot);
        if (isNot) negated++;
      } else if (t.type === ')' && closers.pop()) negated--;
      s += t.type === 'comment' ? ' ' : raw(i);
    }
    return s.replace(/\s+/g, ' ').trim();
  }

  // ---- block structure ---------------------------------------------------------

  function block(from: number, to: number, rule: ReactiveRule | null, conditional = false) {
    let i = from;
    while (i < to) {
      i = significant(i, to);
      if (i >= to) break;
      const t = tokens[i];
      if (t.type === ';') { i++; continue; }
      if (t.type === 'delim' && t.value === '@' && tokens[i + 1]?.type === 'ident') {
        const name = tokens[i + 1].value.toLowerCase();
        const b = boundary(i + 2, to);
        if (rule?.onSpec || rule?.focusWhen) { const end = b >= to || tokens[b].type === ';' ? b + 1 : matching(tokens, b) + 1; dropNested(i, end, rule); i = end; continue; }
        if (b >= to || tokens[b].type === ';') { i = b + 1; continue; }
        const close = matching(tokens, b);
        // @layer only orders the cascade; the other grouping rules make matching conditional.
        if (GROUPING.has(name)) block(b + 1, close, rule, conditional || name !== 'layer');
        else if (hasReactiveSyntax(source.slice(t.start, tokens[close]?.end ?? source.length)))
          warn(`Reactive syntax inside @${name} is not supported; that block is left unchanged.`);
        i = close + 1;
        continue;
      }
      const b = boundary(i, to);
      if (b < to && tokens[b].type === '{') {
        const close = matching(tokens, b);
        if (rule?.onSpec || rule?.focusWhen) { dropNested(i, close + 1, rule); i = close + 1; continue; }
        if (!trusted && tokens.slice(i, b).some((x, k) => x.type === 'function' && (x.value === 'on' || x.value === 'focus') && tokens[i + k - 1]?.type === ':')) {
          // Event and focus rules act on the page: never from untrusted sheets (the browser drops the rule anyway).
          warn(`:on() and :focus(when()) are ignored in untrusted stylesheets (cross-origin, or inline <style> with trustInlineStyles: false); "${snippet(i, b)}" is dropped.`);
          edits.push({ from: i, to: close + 1, text: '' });
          i = close + 1;
          continue;
        }
        const pre: Prelude = { focus: [], special: [] };
        const match = selector(i, b, rule?.match ?? null, pre);
        // :on() and :focus(when()) do not make a rule conditional; any other stateful part does.
        let plain: string;
        if (!pre.special.length) plain = text(i, b);
        else {
          plain = '';
          for (let k = i; k < b; k++) {
            const sp = pre.special.find(([x]) => x === k);
            if (sp) { plain += ':is(*)'; k = sp[1] - 1; } else plain += tokens[k].type === 'comment' ? ' ' : raw(k);
          }
          plain = plain.replace(/\s+/g, ' ').trim();
        }
        const certain = !conditional && (rule ? rule.certain === true : true) && strip(i, b) === plain;
        if (match !== null) {
          const r: ReactiveRule = { match, decls: [], states: [], certain, prelude: [i, b], parent: rule ?? undefined };
          if (pre.on) onRule(r, pre.on, i, b, close);
          else if (pre.focus.length) focusRule(r, pre.focus, i, b, close);
          else block(b + 1, close, r, conditional);
        }
        i = close + 1;
      } else {
        declaration(i, b, rule, conditional);
        i = b + 1;
      }
    }
  }

  block(0, tokens.length, null);

  edits.sort((a, b) => a.from - b.from);
  let css = '';
  for (let i = 0, e = 0; i < tokens.length; ) {
    if (edits[e]?.from === i) { css += edits[e].text; i = edits[e++].to; }
    else css += raw(i++);
  }
  return { css, rules, runtime, handlers, uses, changed: edits.length > 0 || runtime.setup.length > 0 };
}

/** Joins a nested selector with its parent the way CSS Nesting does (`&` = :is(parent)). */
export function resolveNesting(parent: string | null, sel: string): string {
  if (!parent) return sel;
  const tokens = tokenize(sel);
  const parts: string[] = [];
  let start = 0;
  const push = (end: number) => {
    let s = '';
    let amp = false;
    for (let i = start; i < end; i++) {
      const t = tokens[i];
      if (t.type === 'delim' && t.value === '&') { s += `:is(${parent})`; amp = true; }
      else s += sel.slice(t.start, t.end);
    }
    s = s.trim();
    if (s) parts.push(amp ? s : `:is(${parent}) ${s}`);
  };
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === ',') { push(i); start = i + 1; }
    else if (tokens[i].type === '(' || tokens[i].type === 'function' || tokens[i].type === '[') i = matching(tokens, i);
  }
  push(tokens.length);
  return parts.join(', ');
}

/** Top-level rules and statements of a stylesheet, as source text (for insertRule). */
export function splitRules(css: string): string[] {
  const t = tokenize(css);
  const out: string[] = [];
  let i = 0;
  while (i < t.length) {
    if (t[i].type === 'ws' || t[i].type === 'comment' || t[i].type === ';') { i++; continue; }
    let j = i;
    for (; j < t.length; j++) {
      const k = t[j].type;
      if (k === ';') break;
      if (k === '{') { j = matching(t, j); break; }
      if (k === '(' || k === '[' || k === 'function') j = matching(t, j);
    }
    const end = Math.min(j, t.length - 1);
    out.push(css.slice(t[i].start, t[end].end));
    i = end + 1;
  }
  return out;
}

/** Excluded names of one kind (fn:/sel:), so sheets that use only them are still compiled and reported. */
const excludedNames = (kind: string) => Object.keys(EXCLUDED).filter((k) => k.startsWith(kind)).map((k) => k.slice(kind.length));
let quick: RegExp | undefined;
let quickKey = -1;
/** Cheap pre-filter so sheets without reactive syntax are never tokenized. Not a parser. */
export function hasReactiveSyntax(css: string): boolean {
  if (quickKey !== functions.size * 1000 + selectors.size) {
    quickKey = functions.size * 1000 + selectors.size;
    quick = new RegExp(
      `(?:^|[^\\w-])(?:state|typed|${[...functions.keys(), ...excludedNames('fn:')].join('|')})\\(|:(?:${[...selectors.keys(), ...excludedNames('sel:')].join('|')})(?![\\w-])|(?:^|[;{\\s])(?:on|bind|text|attr|focus)\\s*:`
      // 0.9.0: :on(), :focus(when()), --attr-*, and content: reading state.
      + `|:(?:on|focus)\\(|--attr-[a-z]|(?:^|[;{\\s])content\\s*:[^;}]*\\b(?:var|when|previous|direction)\\(`,
      'i',
    );
  }
  return quick!.test(css);
}

const URL_FUNCTIONS = new Set(['url', 'src', 'image-set', '-webkit-image-set']);
/** Functions allowed in a text: value (state-derived scalars only; no template language). */
const TEXT_FUNCTIONS = new Set(['var', 'previous', 'direction', 'when', 'if', 'style']);

/** Makes relative URLs absolute so a sheet copied out of a <link> still resolves them. */
function rewriteURLs(tokens: Token[], repl: (string | undefined)[], base: string) {
  const abs = (u: string) => {
    if (!u || u.startsWith('#')) return undefined; // fragment URLs refer to the document
    try { return `"${new URL(u, base).href}"`; } catch { return undefined; }
  };
  const stack: string[] = [];
  let prev1: Token | undefined, prev2: Token | undefined;
  tokens.forEach((t, i) => {
    if (t.type === 'url') {
      const u = abs(t.value);
      if (u) repl[i] = `url(${u})`;
    } else if (t.type === 'string') {
      const atImport = prev1?.type === 'ident' && prev1.value.toLowerCase() === 'import' && prev2?.value === '@';
      if (atImport || URL_FUNCTIONS.has(stack[stack.length - 1])) {
        const u = abs(t.value);
        if (u) repl[i] = u;
      }
    }
    if (t.type === 'function') stack.push(t.value);
    else if (t.type === '(') stack.push('');
    else if (t.type === ')') stack.pop();
    if (t.type !== 'ws' && t.type !== 'comment') { prev2 = prev1; prev1 = t; }
  });
}
