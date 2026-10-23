// Analysis, validation, bundle resolution and migration on top of the library's own compiler
// (dist/compiler.js). Nothing here parses CSS values: the compiler compiles, its tokenizer splits,
// and the checks below read the compiler's structured output (states, :on() mutations, usage keys).

import { C, K, type Knowledge } from './knowledge.js';
import type { Token, Typed, ActNode, CompiledSheet } from './compiler.js';

export type Severity = 'error' | 'warning' | 'info';
export interface Position { line: number; column: number }
export interface Range { start: Position; end: Position }
export interface Edit { range: Range; newText: string }
export interface Diagnostic {
  severity: Severity; code: string; message: string; range?: Range; feature?: string;
  /** Codes of the nested library messages, outermost first, when the message wraps another. */
  causes?: string[];
  tags?: ('deprecated' | 'removed-syntax' | 'runtime')[];
  fix?: { description: string; edits?: Edit[] };
}

// ---- positions --------------------------------------------------------------------------------

function lineStarts(src: string) {
  const out = [0];
  for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) out.push(i + 1);
  return out;
}
function makeRange(starts: number[], from: number, to: number): Range {
  const pos = (o: number): Position => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= o) lo = mid; else hi = mid - 1; }
    return { line: lo + 1, column: o - starts[lo] + 1 };
  };
  return { start: pos(from), end: pos(to) };
}

// ---- structure: rules and declarations from the library's tokens ----------------------------

export interface Decl { name: string; start: number; end: number; vFrom: number; vTo: number; value: string; t0: number; t1: number; semi: number }
export interface Rule {
  prelude: string; pStart: number; pEnd: number; t0: number; t1: number; open: number; close: number;
  decls: Decl[]; nested: number; hasOn: boolean; pseudoElement: boolean; parent?: Rule; at: string[];
}
interface Structure { tokens: Token[]; rules: Rule[]; imports: number[] }

const GROUPING = new Set(['media', 'supports', 'layer', 'container', 'scope', 'starting-style', 'document']);
const LEGACY_PSEUDO_ELEMENTS = new Set(['before', 'after', 'first-line', 'first-letter']);

function structure(src: string, tokenize: (s: string) => Token[], matching: (t: Token[], i: number) => number): Structure {
  const tokens = tokenize(src);
  const rules: Rule[] = [];
  const imports: number[] = [];
  const sig = (i: number, end: number) => { while (i < end && (tokens[i].type === 'ws' || tokens[i].type === 'comment')) i++; return i; };
  const text = (a: number, b: number) => (a < b ? src.slice(tokens[a].start, tokens[b - 1].end) : '');
  const walk = (i: number, end: number, parent: Rule | undefined, at: string[]) => {
    while (i < end) {
      i = sig(i, end);
      if (i >= end) break;
      let j = i;
      for (; j < end; j++) {
        const t = tokens[j].type;
        if (t === '{' || t === ';' || t === '}') break;
        if (t === '(' || t === '[' || t === 'function') j = matching(tokens, j);
      }
      if (j >= end || tokens[j].type !== '{') {
        // A declaration (in a style rule) or an at-rule statement.
        const stop = Math.min(j, end);
        if (parent && tokens[i].type === 'ident') {
          const colon = sig(i + 1, stop);
          if (colon < stop && tokens[colon].type === ':') {
            const v0 = sig(colon + 1, stop);
            let v1 = stop;
            while (v1 > v0 && (tokens[v1 - 1].type === 'ws' || tokens[v1 - 1].type === 'comment')) v1--;
            parent.decls.push({ name: tokens[i].value, start: tokens[i].start, end: tokens[stop - 1].end, vFrom: v0 < v1 ? tokens[v0].start : tokens[colon].end, vTo: v0 < v1 ? tokens[v1 - 1].end : tokens[colon].end,
              value: text(v0, v1), t0: v0, t1: v1, semi: j < end && tokens[j].type === ';' ? tokens[j].end : tokens[stop - 1].end });
          }
        } else if (!parent && tokens[i].type === 'delim' && tokens[i].value === '@' && tokens[i + 1]?.value?.toLowerCase() === 'import') imports.push(i);
        i = j + 1;
        continue;
      }
      const close = Math.min(matching(tokens, j), end);
      if (i === j) { i = close + 1; continue; } // a block with no prelude
      if (tokens[i].type === 'delim' && tokens[i].value === '@') {
        const name = (tokens[i + 1]?.value ?? '').toLowerCase();
        if (GROUPING.has(name)) walk(j + 1, close, parent, [...at, text(i, j).trim()]);
      } else {
        let hasOn = false, pseudoElement = false;
        for (let k = i; k < j; k++) {
          if (tokens[k].type !== ':') continue;
          const n = tokens[k + 1];
          if (n?.type === 'function' && n.value === 'on') hasOn = true;
          if (n?.type === ':' || (n?.type === 'ident' && LEGACY_PSEUDO_ELEMENTS.has(n.value.toLowerCase()))) pseudoElement = true;
        }
        let pe = j;
        while (pe > i && (tokens[pe - 1].type === 'ws' || tokens[pe - 1].type === 'comment')) pe--;
        const rule: Rule = { prelude: text(i, pe), pStart: tokens[i].start, pEnd: tokens[pe - 1].end, t0: i, t1: pe, open: tokens[j].start, close: tokens[close]?.end ?? src.length,
          decls: [], nested: 0, hasOn, pseudoElement, parent, at };
        if (parent) parent.nested++;
        rules.push(rule);
        walk(j + 1, close, rule, at);
      }
      i = close + 1;
    }
  };
  walk(0, tokens.length, undefined, []);
  return { tokens, rules, imports };
}

// ---- library messages → codes, severity, ranges ----------------------------------------------

let templates: { code: string; re: RegExp; part: RegExp; size: number }[] | undefined;
function matchers(k: Knowledge) {
  return (templates ??= Object.entries(k.diagnosticCodes).map(([code, { template }]) => {
    const parts = template.split(/\{\d+\}/);
    const body = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('([\\s\\S]*?)');
    return { code, re: new RegExp('^' + body + '$'), part: new RegExp(body), size: parts.join('').length };
  }).sort((a, b) => b.size - a.size));
}
/**
 * The registry codes of a message: the most specific template, then the ones nested in its values.
 * Some wrappers are too short to have a code (tools/diagnostics.mjs codes 20+ character texts):
 * then the most specific coded text inside the message is the cause.
 */
function codesOf(k: Knowledge, message: string, depth = 0): string[] {
  for (const t of matchers(k)) {
    const m = t.re.exec(message);
    if (!m) continue;
    if (depth > 3) return [t.code];
    for (const g of m.slice(1)) {
      const inner = g.length > 20 ? codesOf(k, g, depth + 1) : [];
      if (inner.length) return [t.code, ...inner];
    }
    return [t.code];
  }
  if (depth === 0) for (const t of matchers(k)) if (t.size >= 20 && t.part.test(message)) return [t.code];
  return [];
}
const AREA_FEATURE: Record<string, string> = { E: 'events', G: 'gestures', K: 'persist', F: 'forms', A: 'attributes', T: 'text', C: 'focus', W: 'conditions', V: 'values', P: 'core', R: 'core', S: 'core' };
const REMOVED = /once is not supported|write the modifier as a function|:focus\(\) takes no arguments|:blur takes no arguments|drag\(\) takes start/;

/** Offsets of a compiler snippet (whitespace collapsed, comments dropped, maybe cut with "...") in the source. */
function locate(src: string, snippet: string): [number, number] | undefined {
  let s = snippet;
  const cut = s.endsWith('...');
  if (cut) s = s.slice(0, -3);
  if (!s.trim()) return undefined;
  let flat = '';
  const map: number[] = [];
  for (let i = 0; i < src.length; i++) {
    if (src[i] === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 1; if (!flat.endsWith(' ')) { flat += ' '; map.push(i); } continue; }
    if (/\s/.test(src[i])) { if (!flat.endsWith(' ')) { flat += ' '; map.push(i); } continue; }
    flat += src[i]; map.push(i);
  }
  const at = flat.indexOf(s);
  if (at < 0) return undefined;
  return [map[at], map[at + s.length - 1] + 1];
}
const SNIPPETS = [/in selector "([\s\S]*)"\. Rule left unchanged\.$/, /: "([\s\S]*)" is dropped\.$/, /in "([\s\S]*)"\. Declaration left unchanged\.$/, /rule "([\s\S]*?)" changes no state/, /"([^"]{6,})"/];

function libraryDiagnostic(k: Knowledge, src: string, starts: number[], message: string, isNote: boolean): Diagnostic {
  const codes = codesOf(k, message);
  const code = codes[codes.length - 1] ?? 'RCSS-UNCODED';
  const severity: Severity = isNote ? 'info' : /(Rule|Declaration) left unchanged\.$|is dropped\.$/.test(message) ? 'error' : 'warning';
  let range: Range | undefined;
  for (const re of SNIPPETS) {
    const m = re.exec(message);
    const at = m && locate(src, m[1]);
    if (at) { range = makeRange(starts, at[0], at[1]); break; }
  }
  const d: Diagnostic = { severity, code, message, range, feature: AREA_FEATURE[code[5]] };
  if (codes.length > 1) d.causes = codes;
  if (REMOVED.test(message)) d.tags = ['removed-syntax'];
  return d;
}

// ---- types: what a mutation can store ---------------------------------------------------------

type T = Typed & { known?: boolean };
const PX: T = { type: 'dimension', v: 0, unit: 'px' };
const NUM: T = { type: 'number', v: 0 };
const STR: T = { type: 'string', v: '' };
const BOOL: T = { type: 'boolean', v: false };
/** Types of event() fields (src/state/actexpr.ts, field()). 'like' = the mutated state's own type (drag x / y). */
const FIELD_TYPE: Record<string, T | 'like'> = {
  type: STR, 'client-x': PX, 'client-y': PX, 'page-x': PX, 'page-y': PX, 'local-x': PX, 'local-y': PX, button: NUM, buttons: NUM,
  'pointer-id': NUM, 'pointer-type': STR, pressure: NUM, 'alt-key': BOOL, 'ctrl-key': BOOL, 'shift-key': BOOL, 'meta-key': BOOL,
  key: STR, code: STR, repeat: BOOL, value: STR, 'value-as-number': NUM, checked: BOOL,
  x: 'like', y: 'like', 'delta-x': PX, 'delta-y': PX, 'movement-x': PX, 'movement-y': PX, 'start-x': PX, 'start-y': PX, 'scroll-top': PX, 'scroll-left': PX,
};
class Incompatible { constructor(public a: Typed, public b: Typed) {} }
const show = (t: Typed) => t.type === 'dimension' ? `a ${t.unit} length` : t.type === 'value' ? 'a keyword' : `a ${t.type}`;

function infer(n: ActNode, stateType: (name: string) => Typed | undefined, convert: (a: Typed, b: Typed) => number | undefined): T | 'like' | undefined {
  const asNum = (t: T | 'like' | undefined) => (t && t !== 'like' && t.type === 'boolean' ? NUM : t);
  switch (n.k) {
    case 'lit': return { ...n.t, known: true };
    case 'event': return FIELD_TYPE[n.field];
    case 'mouse': case 'size': return PX;
    case 'var': { const t = stateType(n.name); return t ? { ...t, known: false } : undefined; }
    case 'neg': case 'round': return infer(n.a, stateType, convert);
    case 'sibling': return NUM;
    case 'attr': return n.fallback ? { ...n.fallback, known: false } : STR;
    case 'random': return infer(n.min, stateType, convert);
    case 'math': {
      const ts = n.args.map((a) => asNum(infer(a, stateType, convert)));
      const dims = ts.filter((t): t is T => !!t && t !== 'like' && t.type === 'dimension');
      for (const d of dims) if (convert(dims[0], d) === undefined) throw new Incompatible(dims[0], d);
      return ts.find((t) => t && t !== 'like');
    }
    case 'op': {
      const a = asNum(infer(n.a, stateType, convert)), b = asNum(infer(n.b, stateType, convert));
      if (!a || !b || a === 'like' || b === 'like') return undefined;
      const zero = (t: T) => t.known && t.v === 0;
      if (n.op === '+' || n.op === '-') {
        if (a.type === 'dimension' && b.type === 'dimension') { if (convert(a, b) === undefined && !zero(a) && !zero(b)) throw new Incompatible(a, b); return { ...a, known: false }; }
        return a.type === 'number' && b.type === 'number' ? NUM : undefined;
      }
      if (n.op === '*') return a.type === 'dimension' && b.type === 'number' ? a : b.type === 'dimension' && a.type === 'number' ? b : a.type === 'number' && b.type === 'number' ? NUM : undefined;
      return a.type === 'dimension' && b.type === 'number' ? a : a.type === 'number' && b.type === 'number' ? NUM : a.type === 'dimension' && b.type === 'dimension' ? NUM : undefined;
    }
  }
  return undefined;
}

// ---- validate ---------------------------------------------------------------------------------

export const SCOPE = 'Static checks of the CSS given: the library compiler\'s own diagnostics (syntax, triggers, modifiers, event fields, placement, attribute allowlist, removed syntax) plus provable problems in that CSS (mutations outside :on(), types a state can never store, mutated states nothing declares, legacy 0.8 syntax, minifier risks). It does not see the HTML, other stylesheets, the bundle that will run (unless given), or runtime behavior: focusability, the DOM structure that decides ownership, and values known only at the event are not checked.';
const MUTATIONS = new Set(['set', 'toggle', 'increment', 'decrement', 'cycle']);

export interface CompileResult { sheet: CompiledSheet; messages: { text: string; note: boolean }[]; s: Structure; starts: number[] }

export async function compileCss(src: string): Promise<CompileResult> {
  const c = await C();
  c.diagnostics.length = 0;
  c.noted.clear();
  c.resetNames();
  const sheet = c.compile(src, { trusted: true });
  const messages = c.diagnostics.map((text) => ({ text, note: c.noted.has(text) }));
  c.diagnostics.length = 0;
  c.noted.clear();
  return { sheet, messages, s: structure(src, c.tokenize, c.matching), starts: lineStarts(src) };
}

export async function validate(src: string, opts: { features?: string[]; profile?: string } = {}) {
  const k = K();
  const c = await C();
  const { sheet, messages, s, starts } = await compileCss(src);
  const out: Diagnostic[] = messages.map((m) => libraryDiagnostic(k, src, starts, m.text, m.note));
  const R = (a: number, b: number) => makeRange(starts, a, b);
  const uses = sheet.uses;

  // State declarations, by name, with their initial types (literals only; attr() gives its fallback type).
  const declared = new Map<string, (Typed | undefined)[]>();
  for (const r of sheet.rules) for (const st of r.states) {
    const t = st.init.k === 'lit' ? st.init.t : st.init.k === 'attr' ? st.init.fallback : undefined;
    declared.set(st.name, [...(declared.get(st.name) ?? []), t]);
  }
  const single = (name: string) => { const ts = declared.get(name); return ts && ts.length && ts.every((t) => t && ts[0] && t.type === ts[0].type && t.unit === ts[0].unit) ? ts[0] : undefined; };
  const byPrelude = new Map(s.rules.map((r) => [r.t0, r]));
  const declOf = (rule: Rule | undefined, name: string) => rule?.decls.find((d) => d.name === name);
  const fits = (cur: Typed, v: T) => {
    if (cur.type === 'dimension' && v.type === 'number' && (!v.known || v.v === 0)) return true;
    if (cur.type === 'boolean' && v.type === 'number' && (!v.known || v.v === 0 || v.v === 1)) return true;
    return c.assignable(cur, v);
  };

  for (const r of sheet.rules) {
    if (!r.onSpec) continue;
    const rule = r.prelude ? byPrelude.get(r.prelude[0]) : undefined;
    for (const { m } of r.onSpec.slots) {
      const d = declOf(rule, m.name);
      const range = d ? R(d.start, d.end) : rule ? R(rule.pStart, rule.pEnd) : undefined;
      const types = declared.get(m.name);
      if (!types) {
        out.push({ severity: 'warning', code: 'MCP-no-state-owner', feature: 'core', range,
          message: `${m.name} is changed in :on(${r.onSpec.trigger.key}), but no rule in this CSS declares ${m.name}: state(…). The mutation changes the nearest owner on the element or an ancestor; with none, nothing happens. (Ignore if another stylesheet declares it.)`,
          fix: { description: `Declare the state on the element or on a container of everything that uses it, e.g. .container { ${m.name}: state(0); }` } });
        continue;
      }
      if (types.some((t) => !t)) continue; // an initial value whose type is known only at runtime
      const known = types as Typed[];
      const mismatch = (what: string, fix?: Diagnostic['fix']) => out.push({ severity: 'error', code: 'MCP-type-mismatch', feature: 'events', range, tags: ['runtime'],
        message: `${m.name}: ${m.op}() in :on(${r.onSpec!.trigger.key}) ${what}; every write is rejected at runtime.`, fix });
      try {
        if (m.op === 'toggle') {
          if (known.every((t) => t.type !== 'boolean')) mismatch(`needs a boolean state, but ${m.name} is declared as ${show(known[0])}`, { description: `Declare it as a boolean: ${m.name}: state(false).` });
        } else if (m.op === 'cycle') {
          const bad = m.values?.find((v) => known.every((t) => !fits(t, v)));
          if (bad) mismatch(`lists ${show(bad)}, which ${m.name} (${show(known[0])}) cannot hold`);
        } else {
          if ((m.op === 'increment' || m.op === 'decrement') && known.every((t) => t.type !== 'number' && t.type !== 'dimension')) {
            mismatch(`needs a number or length state, but ${m.name} is declared as ${show(known[0])}`);
            continue;
          }
          const v = m.expr && infer(m.expr, single, c.convert);
          if (v === 'like') {
            if (known.every((t) => !(t.type === 'number' || (t.type === 'dimension' && t.unit === 'px'))))
              mismatch(`uses event(x) / event(y), which move a number or px state, but ${m.name} is declared as ${show(known[0])}`, { description: `Declare it as a px length: ${m.name}: state(0px).` });
          } else if (v && known.every((t) => !fits(t, v))) {
            const lengthFix = v.type === 'dimension' && v.unit === 'px' && known.length === 1 && known[0].type === 'number';
            mismatch(`stores ${show(v)}, but ${m.name} is declared as ${show(known[0])}`,
              { description: lengthFix ? `Declare it as a length: ${m.name}: state(${known[0].v}px).` : `Make the value and the state the same type.`,
                edits: lengthFix ? stateEdit(s, starts, m.name, `${known[0].v}`, `${known[0].v}px`) : undefined });
          }
        }
      } catch (e) {
        if (!(e instanceof Incompatible)) throw e;
        out.push({ severity: 'error', code: 'MCP-incompatible-units', feature: 'events', range, tags: ['runtime'],
          message: `${m.name}: ${m.op}() in :on(${r.onSpec.trigger.key}) combines ${show(e.a)} and ${show(e.b)}, which do not convert (px, %, em and vw are different units): the event gives an error and no write.`,
          fix: { description: 'Use one unit family. Layout-dependent units are not resolved in mutations: use element() or viewport() instead.' } });
      }
    }
  }

  for (const rule of s.rules) {
    const R2 = (d: Decl) => R(d.start, d.end);
    if (rule.hasOn && rule.decls.length === 0 && rule.nested === 0 && uses.has('sel:on'))
      out.push({ severity: 'info', code: 'MCP-empty-rule-minifier', feature: 'events', range: R(rule.pStart, rule.close),
        message: `"${rule.prelude}" is an empty rule (modifiers only). It is valid, but CSS minifiers that remove empty rules (esbuild minify, csso, lightningcss) delete it silently.`,
        fix: { description: 'Minify this stylesheet for whitespace only (esbuild minifyWhitespace), or exclude it from empty-rule removal.' } });
    for (const d of rule.decls) {
      const name = d.name.toLowerCase();
      const first = s.tokens[d.t0];
      if (!rule.hasOn && d.name.startsWith('--') && !name.startsWith('--attr-') && first?.type === 'function' && MUTATIONS.has(first.value) && matching(s, d.t0) === d.t1 - 1)
        out.push({ severity: 'warning', code: 'MCP-mutation-outside-on', feature: 'events', range: R2(d),
          message: `${d.name}: ${first.value}(…) is outside an :on() rule, so it is a plain custom property value and changes nothing.`,
          fix: { description: `Move it into an event rule: ${rule.prelude}:on(click) { ${d.name}: ${d.value}; }` } });
      if (!rule.hasOn && hasFunction(s, d, 'event'))
        out.push({ severity: 'warning', code: 'MCP-event-outside-mutation', feature: 'events', range: R2(d),
          message: `event() in "${d.name}: ${clip(d.value)}" is outside a mutation: there is no event there, and the value is never computed. event(field) works only in set(), increment() and decrement() inside :on() rules.` });
      if (name === 'on' && uses.has('decl:on'))
        out.push({ severity: 'warning', code: 'MCP-legacy-on', feature: 'events', range: R2(d), tags: ['deprecated'],
          message: `on: is the legacy 0.8 event syntax (still supported in ${k.reactivecss.version}). Write :on() rules: ${rule.prelude}:on(click) { --state: toggle(); }.`, fix: { description: 'Run migrate_css on this stylesheet.' } });
      if (name === 'text' && uses.has('decl:text'))
        out.push({ severity: 'warning', code: 'MCP-legacy-text', feature: 'text', range: R2(d), tags: ['deprecated'],
          message: `text: is legacy 0.8 syntax. Write content: ${clip(d.value)} on the element (it must read state to become DOM text).`, fix: { description: 'Run migrate_css on this stylesheet.' } });
      if (name === 'attr' && uses.has('decl:attr'))
        out.push({ severity: 'warning', code: 'MCP-legacy-attr', feature: 'attributes', range: R2(d), tags: ['deprecated'],
          message: `attr: is legacy 0.8 syntax. Write --attr-<attribute>: <value>, e.g. --attr-aria-expanded: var(--open).`, fix: { description: 'Run migrate_css on this stylesheet.' } });
      if (name === 'bind' && uses.has('decl:bind')) {
        const target = d.value.trim();
        if (/^--[\w-]+$/.test(target) && rule.decls.some((x) => x.name === target && /^state\(/i.test(x.value)))
          out.push({ severity: 'info', code: 'MCP-legacy-bind', feature: 'forms', range: R2(d), tags: ['deprecated'],
            message: `bind: ${target} binds a control to a state it declares itself; 0.9 writes ${target}: state(…, bind(value)) (or bind(checked) for checkboxes). bind: stays for a control that writes an ancestor's state.`, fix: { description: 'Run migrate_css on this stylesheet.' } });
      }
      if (rule.pseudoElement && name === 'content' && [...d.value.matchAll(/var\(\s*(--[\w-]+)/g)].some((m) => declared.has(m[1])))
        out.push({ severity: 'info', code: 'MCP-content-pseudo-element', feature: 'text', range: R2(d),
          message: `content in a pseudo-element stays native CSS: it does not become DOM text, and a number or boolean state renders nothing there. For DOM text put content: ${clip(d.value)} on an element.` });
    }
  }
  for (const i of s.imports) out.push({ severity: 'info', code: 'MCP-import-not-followed', range: R(s.tokens[i].start, s.tokens[i].end + 6),
    message: '@import is not followed: imported stylesheets are not processed by Reactive CSS at runtime, and not checked here.' });

  // A given bundle: syntax that needs a feature it does not include.
  let bundle: ReturnType<typeof resolve> | undefined;
  if (opts.features || opts.profile) {
    bundle = resolve({ features: opts.features, profile: opts.profile });
    if (!bundle.errors.length) {
      const have = new Set(bundle.features);
      for (const key of [...uses].sort()) {
        const f = featureOfKey(key);
        if (f && !have.has(f)) out.push({ severity: 'error', code: 'MCP-missing-feature', feature: f,
          message: `"${key}" needs the "${f}" feature, which the given bundle (${bundle.features.join(', ')}) does not include: the runtime reports it and ignores the syntax.`,
          fix: { description: `Add "${f}" to the bundle (suggest_bundle resolves its dependencies).` } });
      }
    }
  }
  const order = { error: 0, warning: 1, info: 2 };
  out.sort((a, b) => order[a.severity] - order[b.severity] || (a.range?.start.line ?? 1e9) - (b.range?.start.line ?? 1e9) || (a.range?.start.column ?? 0) - (b.range?.start.column ?? 0));
  return { diagnostics: out, uses: [...uses].sort(), reactive: sheet.changed, bundleErrors: bundle?.errors ?? [] };
}

function matching(s: Structure, i: number) {
  // Index of the token closing the function or bracket at i (the tokenizer's matching(), on tokens already split).
  let depth = 0;
  for (let j = i; j < s.tokens.length; j++) {
    const t = s.tokens[j].type;
    if (t === '(' || t === '[' || t === '{' || t === 'function') depth++;
    else if (t === ')' || t === ']' || t === '}') { depth--; if (depth === 0) return j; }
  }
  return s.tokens.length;
}
const hasFunction = (s: Structure, d: Decl, name: string) => { for (let i = d.t0; i < d.t1; i++) if (s.tokens[i].type === 'function' && s.tokens[i].value === name) return true; return false; };
const clip = (v: string, n = 60) => (v.length > n ? v.slice(0, n - 1) + '…' : v);

/** The edit turning state(<from>…) into state(<to>…) in the one declaration of a state, if there is exactly one. */
function stateEdit(s: Structure, starts: number[], name: string, from: string, to: string): Edit[] | undefined {
  const ds = s.rules.flatMap((r) => r.decls).filter((d) => d.name === name && /^state\(/i.test(d.value));
  if (ds.length !== 1) return undefined;
  const open = /^state\(\s*/i.exec(ds[0].value)![0].length;
  if (!ds[0].value.startsWith(from, open) || !/^[\s,)]/.test(ds[0].value.slice(open + from.length))) return undefined;
  const at = ds[0].vFrom + open;
  return [{ range: makeRange(starts, at, at + from.length), newText: to }];
}

// ---- features and bundles ---------------------------------------------------------------------
// shortcut: featureOfKey() and resolve() are ports of tools/bundle.mjs (which imports esbuild at
// load, so it cannot run here); test/unit.test.mjs checks parity with it on every profile, feature
// and example. Upgrade: move both into a pure module in the library and import that.

export function featureOfKey(key: string): string | undefined {
  const cat = K().catalog.features;
  for (const f of cat) if (f.provides.includes(key)) return f.id;
  for (const f of cat) for (const p of f.provides) if (p.endsWith(':*') && key.startsWith(p.slice(0, -1))) return f.id;
  return undefined;
}

export function resolve(sel: { features?: string[]; profile?: string; exclude?: string[] }) {
  const { features: cat, profiles } = K().catalog;
  const byId = new Map(cat.map((f) => [f.id, f]));
  const errors: { code: string; message: string; feature?: string }[] = [];
  let requested = sel.features ?? [];
  if (sel.profile) {
    if (!profiles[sel.profile]) errors.push({ code: 'unknown-profile', message: `Unknown profile "${sel.profile}". Profiles: ${Object.keys(profiles).join(', ')}.` });
    else requested = [...profiles[sel.profile], ...requested];
  }
  requested = [...new Set(requested.map((x) => String(x).trim()).filter(Boolean))];
  const exclude = new Set((sel.exclude ?? []).map((x) => String(x).trim()));
  const suggest = (id: string) => { const [best] = [...byId.keys()].map((x) => [x, distance(id, x)] as const).sort((x, y) => x[1] - y[1]); return best[1] <= 3 ? ` Did you mean "${best[0]}"?` : ''; };
  for (const id of [...requested, ...exclude]) if (!byId.has(id)) errors.push({ code: 'unknown-feature', feature: id, message: `Unknown feature "${id}".${suggest(id)} Features: ${[...byId.keys()].join(', ')}.` });
  if (exclude.has('core')) errors.push({ code: 'core-required', feature: 'core', message: 'The core cannot be excluded: every feature needs the parser, state engine and scheduler.' });
  const included = new Set(['core']);
  const added: { id: string; requiredBy: string }[] = [];
  const visit = (id: string, by?: string) => {
    if (included.has(id) || !byId.has(id)) return;
    if (exclude.has(id)) { errors.push({ code: 'conflict', feature: id, message: `"${id}" is excluded, but "${by}" requires it. Remove "${id}" from the exclusions or "${by}" from the features.` }); return; }
    included.add(id);
    if (by) added.push({ id, requiredBy: by });
    for (const r of byId.get(id)!.requires) visit(r, id);
  };
  for (const id of requested) if (byId.has(id) && !exclude.has(id)) visit(id);
  for (const id of requested) if (exclude.has(id)) errors.push({ code: 'conflict', feature: id, message: `"${id}" is both requested and excluded.` });
  const features = cat.map((f) => f.id).filter((id) => included.has(id));
  const optionalMissing = features.flatMap((id) => byId.get(id)!.optional.filter((o) => !included.has(o)).map((o) => ({ id: o, usefulFor: id })));
  return { features, requested, added, optionalMissing, errors };
}

/** Edit distance (Levenshtein), for "did you mean". */
export function distance(a: string, b: string) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return d[b.length];
}

/** 0.8 declarations that 0.9 writes differently (as tools/bundle.mjs reports them). */
const LEGACY: Record<string, string> = { 'decl:on': '.x:on(event) { --state: action() }', 'decl:text': 'content: <value>', 'decl:attr': '--attr-<attribute>: <value>' };

export async function analyze(src: string) {
  const { sheet, messages, s } = await compileCss(src);
  const uses = [...sheet.uses].sort();
  const byFeature: Record<string, string[]> = {};
  const unknown: string[] = [];
  for (const key of uses) { const f = featureOfKey(key); if (f) (byFeature[f] ??= []).push(key); else unknown.push(key); }
  const direct = Object.keys(byFeature).filter((f) => f !== 'core');
  const r = resolve({ features: direct });
  const cat = K().catalog.features;
  return {
    reactive: sheet.changed,
    uses,
    features: r.features,
    used: cat.map((f) => f.id).filter((id) => direct.includes(id)),
    usage: byFeature,
    added: r.added,
    optionalMissing: r.optionalMissing,
    legacy: uses.filter((key) => LEGACY[key]).map((key) => ({ syntax: key.slice(5) + ':', use: LEGACY[key] })),
    diagnostics: messages.length,
    notes: [
      ...(s.imports.length ? [{ code: 'import-not-followed', message: '@import rules are not followed: analyze the imported files too.' }] : []),
      ...unknown.map((key) => ({ code: 'unknown-syntax', message: `Usage "${key}" belongs to no catalog feature.` })),
    ],
  };
}

// ---- migrate (0.8 → 0.9) ----------------------------------------------------------------------

interface Change { kind: string; line: number; from: string; to: string }
interface Manual { line: number; kind: string; reason: string; original: string; suggestion?: string }

const CANCELABLE = new Set(['click', 'dblclick', 'contextmenu', 'mousedown', 'pointerdown', 'keydown', 'keyup', 'submit']);
const STATE_FN = /\b(var|when|previous|direction)\(/i;

/** Depth-0 comma split of a token range, as source text. */
function splitTokens(src: string, tokens: Token[], a: number, b: number): { text: string; t0: number; t1: number }[] {
  const out: { text: string; t0: number; t1: number }[] = [];
  let start = a, depth = 0;
  for (let i = a; i <= b; i++) {
    const t = i < b ? tokens[i].type : ',';
    if (t === '(' || t === '[' || t === 'function') depth++;
    else if (t === ')' || t === ']') depth--;
    else if (t === ',' && depth === 0) {
      let x = start, y = i;
      while (x < y && (tokens[x].type === 'ws' || tokens[x].type === 'comment')) x++;
      while (y > x && (tokens[y - 1].type === 'ws' || tokens[y - 1].type === 'comment')) y--;
      out.push({ text: x < y ? src.slice(tokens[x].start, tokens[y - 1].end) : '', t0: x, t1: y });
      start = i + 1;
    }
  }
  return out;
}

export async function migrate(src: string) {
  const k = K();
  const { s, starts } = await compileCss(src);
  const before = await analyze(src);
  const edits: { from: number; to: number; text: string }[] = [];
  const changes: Change[] = [];
  const manual: Manual[] = [];
  const line = (o: number) => makeRange(starts, o, o).start.line;
  const triggers = new Set([...k.registry.events, ...k.registry.onEvents]);
  const removeDecl = (d: Decl) => {
    let a = d.start, b = d.semi;
    while (a > 0 && (src[a - 1] === ' ' || src[a - 1] === '\t')) a--;
    while (b < src.length && (src[b] === ' ' || src[b] === '\t')) b++;
    if ((a === 0 || src[a - 1] === '\n') && src[b] === '\n') b++;
    else a = d.start;
    edits.push({ from: a, to: b, text: '' });
  };
  const indentOf = (o: number) => { let a = o; while (a > 0 && src[a - 1] !== '\n') a--; return /^[ \t]*/.exec(src.slice(a))![0]; };
  const selectorItems = (r: Rule) => splitTokens(src, s.tokens, r.t0, r.t1).map((x) => x.text);

  for (const r of s.rules) {
    const after: string[] = [];
    const removed = new Set<Decl>();
    // Candidate syntax that never shipped: :focus(when()), bare modifiers, once.
    if (r.hasOn) {
      for (let i = r.t0; i < r.t1; i++) {
        const t = s.tokens[i];
        if (!(t.type === 'function' && t.value === 'on' && s.tokens[i - 1]?.type === ':')) continue;
        const close = matching(s, i);
        for (const part of splitTokens(src, s.tokens, i + 1, close).slice(1)) {
          const p = part.text.toLowerCase();
          if (p === 'prevent' || p === 'stop') {
            edits.push({ from: s.tokens[part.t0].start, to: s.tokens[part.t1 - 1].end, text: p + '()' });
            changes.push({ kind: 'modifier-function', line: line(s.tokens[part.t0].start), from: part.text, to: p + '()' });
          } else if (/^once(\(\s*\))?$/.test(p)) manual.push({ line: line(s.tokens[part.t0].start), kind: 'once', original: r.prelude,
            reason: 'once was removed from :on(); a one-time change needs a guard state.', suggestion: `${r.prelude.replace(/,\s*once(\(\s*\))?/i, '').replace(/:on\(/, ':when(not --done):on(')} { --done: set(true); … } with --done: state(false) on the owner` });
        }
      }
    }
    for (let i = r.t0; i < r.t1; i++) {
      const t = s.tokens[i];
      if (!(t.type === 'function' && t.value === 'focus' && s.tokens[i - 1]?.type === ':')) continue;
      const close = matching(s, i);
      const arg = src.slice(t.end, s.tokens[close].start).trim();
      const m = /^when\(([\s\S]*)\)$/i.exec(arg);
      const bodyEmpty = !src.slice(r.open + 1, r.close - 1).trim();
      if (m && bodyEmpty && !selectorItems(r).slice(1).length) {
        const sel = (src.slice(r.pStart, s.tokens[i - 1].start) + src.slice(s.tokens[close].end, r.pEnd)).trim() || '*';
        edits.push({ from: r.pStart, to: r.close, text: `${sel} { focus: when(${m[1].trim()}); }` });
        changes.push({ kind: 'focus-request', line: line(r.pStart), from: src.slice(r.pStart, r.close), to: `${sel} { focus: when(${m[1].trim()}); }` });
      } else manual.push({ line: line(r.pStart), kind: 'focus-selector', original: r.prelude, reason: ':focus(…) with arguments is not CSS; focus requests are the focus: when(…) declaration.', suggestion: 'Remove :focus(when(X)) from the selector and add focus: when(X); to the rule.' });
    }

    for (const d of r.decls) {
      const name = d.name.toLowerCase();
      if (name === 'on') {
        const items = splitTokens(src, s.tokens, d.t0, d.t1);
        const rules: string[] = [];
        let ok = !r.pseudoElement;
        if (!ok) manual.push({ line: line(d.start), kind: 'on', original: `on: ${d.value}`, reason: 'on: in a rule with a pseudo-element has no :on() form.' });
        for (const it of items) {
          if (!ok) break;
          const f = s.tokens[it.t0];
          const close = f?.type === 'function' ? matching(s, it.t0) : -1;
          if (!f || f.type !== 'function' || close !== it.t1 - 1) { ok = false; manual.push({ line: line(d.start), kind: 'on', original: `on: ${d.value}`, reason: `cannot read the trigger "${it.text}"` }); break; }
          let args = splitTokens(src, s.tokens, it.t0 + 1, close).map((a) => a.text);
          let trigger = f.value;
          if (trigger === 'key') { trigger = `keydown(${args[0]})`; args = args.slice(1); }
          else if (trigger === 'outside') { trigger = `outside(${args[0]})`; args = args.slice(1); }
          else if (!triggers.has(trigger)) { ok = false; manual.push({ line: line(d.start), kind: 'on', original: `on: ${d.value}`, reason: `"${trigger}" is not a 0.9 event name` }); break; }
          let prevent = false;
          const muts: string[] = [];
          const seen = new Set<string>();
          for (const a of args) {
            const m = /^([a-z-]+)\(([\s\S]*)\)$/i.exec(a.trim());
            const op = m?.[1].toLowerCase();
            if (op === 'prevent' && !m![2].trim()) { prevent = true; continue; }
            const parts = m ? splitTop(m[2]) : [];
            if (!m || !op || !MUTATIONS.has(op) || !/^--[\w-]+$/.test(parts[0] ?? '')) { ok = false; manual.push({ line: line(d.start), kind: 'on', original: `on: ${d.value}`, reason: `the action "${a}" has no 0.9 mutation form` }); break; }
            if (parts.some((p) => /^closest\(/i.test(p))) { ok = false; manual.push({ line: line(d.start), kind: 'on', original: `on: ${d.value}`, reason: 'closest() owners have no 0.9 form: keep this on: declaration (it still works in 0.9).' }); break; }
            if (seen.has(parts[0])) { ok = false; manual.push({ line: line(d.start), kind: 'on', original: `on: ${d.value}`, reason: `${parts[0]} changes twice in one trigger: legacy on: runs actions in turn, 0.9 applies one write per state. Rewrite by hand.` }); break; }
            seen.add(parts[0]);
            muts.push(`${parts[0]}: ${op}(${parts.slice(1).join(', ')});`);
          }
          if (!ok) break;
          const base = trigger.replace(/\(.*$/, '');
          if (prevent && !CANCELABLE.has(base)) { ok = false; manual.push({ line: line(d.start), kind: 'on', original: `on: ${d.value}`, reason: `prevent() needs a cancelable event; ${trigger} is not.` }); break; }
          const sel = selectorItems(r).map((x) => `${x}:on(${trigger}${prevent ? ', prevent()' : ''})`).join(', ');
          rules.push(`${sel} { ${muts.join(' ')} }`.replace('{  }', '{}'));
        }
        if (ok) { after.push(...rules); removed.add(d); changes.push({ kind: 'on', line: line(d.start), from: `on: ${d.value}`, to: rules.join('\n') }); }
      } else if (name === 'text') {
        if (r.pseudoElement || !STATE_FN.test(d.value) || /\b(url|attr)\(/i.test(d.value) || r.decls.some((x) => x.name.toLowerCase() === 'content'))
          manual.push({ line: line(d.start), kind: 'text', original: `text: ${d.value}`, reason: r.decls.some((x) => x.name.toLowerCase() === 'content') ? 'the rule already has a content declaration' : 'content becomes DOM text only on elements, when the value reads state (var(), when(), previous(), direction()) without url() or attr(); text: with a literal has no content equivalent.' });
        else { edits.push({ from: d.start, to: d.vTo, text: `content: ${d.value}` }); changes.push({ kind: 'text', line: line(d.start), from: `text: ${d.value}`, to: `content: ${d.value}` }); }
      } else if (name === 'attr') {
        const m = /^([a-z][\w-]*)\s+([\s\S]+)$/i.exec(d.value);
        if (!m) manual.push({ line: line(d.start), kind: 'attr', original: `attr: ${d.value}`, reason: 'cannot read "attr: <attribute> <value>"' });
        else { const to = `--attr-${m[1].toLowerCase()}: ${m[2]}`; edits.push({ from: d.start, to: d.vTo, text: to }); changes.push({ kind: 'attr', line: line(d.start), from: `attr: ${d.value}`, to }); }
      } else if (name === 'bind') {
        const target = d.value.trim();
        const own = /^--[\w-]+$/.test(target) ? r.decls.find((x) => x.name === target && /^state\(/i.test(x.value)) : undefined;
        if (!own) continue; // bind: to an ancestor's state is still the 0.9 way.
        const sel = r.prelude.toLowerCase();
        const kind = /type\s*=\s*["']?checkbox/.test(sel) ? 'checked' : /type\s*=\s*["']?radio/.test(sel) ? undefined : /\b(input|select|textarea)\b/.test(sel) ? 'value' : undefined;
        const args = splitTop(own.value.replace(/^state\(/i, '').replace(/\)$/, ''));
        if (!kind || args.some((a) => /^bind\(/i.test(a))) { manual.push({ line: line(d.start), kind: 'bind', original: `bind: ${target}`, reason: 'the control type is not clear from the selector (or it is a radio button): keep bind: or write state(…, bind(value | checked)) by hand.' }); continue; }
        const to = `state(${[...args.slice(0, 1), `bind(${kind})`, ...args.slice(1)].join(', ')})`;
        edits.push({ from: own.vFrom, to: own.vTo, text: to });
        removed.add(d);
        changes.push({ kind: 'bind', line: line(d.start), from: `${target}: ${own.value}; bind: ${target}`, to: `${target}: ${to}` });
      } else if (name === 'focus' && /^true$/i.test(d.value.trim()) && /:when\(/i.test(r.prelude)) {
        manual.push({ line: line(d.start), kind: 'focus', original: `${r.prelude} { focus: true }`, reason: 'Works in 0.9, but the 0.9 form is one declaration.', suggestion: `${r.prelude.replace(/:when\(([^)]*)\)/i, '')} { focus: when(${/:when\(([^)]*)\)/i.exec(r.prelude)?.[1] ?? '…'}); }` });
      }
    }
    for (const d of removed) removeDecl(d);
    if (after.length) {
      const indent = indentOf(r.pStart);
      edits.push({ from: r.close, to: r.close, text: after.map((x) => `\n${indent}${x}`).join('') });
    }
  }

  edits.sort((a, b) => b.from - a.from || b.to - a.to);
  let out = src;
  for (const e of edits) out = out.slice(0, e.from) + e.text + out.slice(e.to);
  const check = await validate(out);
  const notes: string[] = [];
  if (changes.some((x) => x.kind === 'on')) notes.push('0.9 mutations of one event form one transaction (values are read before any write), and the cascade picks one mutation per state instead of one on: declaration per element. Review rules where several actions change related states.');
  if (before.legacy.length && !changes.length && !manual.length) notes.push('Nothing to rewrite.');
  return {
    css: out, changed: out !== src, changes, manual: manual.sort((a, b) => a.line - b.line),
    diagnostics: check.diagnostics.filter((d) => d.severity !== 'info' || d.code === 'MCP-empty-rule-minifier'),
    notes, wrote: false,
  };
}

/** Depth-0 comma split of plain text (outside quotes and parentheses). */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0, q = '', cur = '';
  for (const ch of s) {
    if (q) { if (ch === q) q = ''; cur += ch; continue; }
    if (ch === '"' || ch === "'") q = ch;
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
