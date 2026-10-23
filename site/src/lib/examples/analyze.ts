// Static analysis of an example stylesheet: where each state is declared, which rules write
// it (:on() mutations, and the 0.8 on: and bind:) and which lines read it. The preview bridge reports *what* changed at
// runtime; this map says *where* in the source that lives, so the code panel can light up
// the right lines. Nothing here invents values.

import { highlightCss, lex } from '~/lib/code/css';
import type { FeatureKey } from '~/lib/code/types';

export type StateType = 'boolean' | 'number' | 'dimension' | 'string' | 'keyword';

export interface Declaration {
  /** Selector of the rule, nesting resolved. */
  selector: string;
  prop: string;
  value: string;
  /** Zero-based line of the property name. */
  line: number;
  /** Inside @media, @supports or another conditional group. */
  conditional: boolean;
}

export interface StateDecl { name: string; line: number; selector: string; initial: string; type: StateType }
/** A custom property computed by another reactive function (previous(), on(), mouse() ...). */
export interface DerivedDecl { name: string; line: number; selector: string; fn: string; type?: StateType }
/** events: 'click', 'input', 'key:Escape', 'outside:click' ... as listed in the declaration. */
export interface TriggerDecl { line: number; selector: string; kind: 'on' | 'bind'; writes: string[]; events: string[] }

export interface Analysis {
  declarations: Declaration[];
  states: StateDecl[];
  derived: DerivedDecl[];
  triggers: TriggerDecl[];
  /** For each custom property name: lines that read it (not its declaration, not triggers). */
  reads: Record<string, number[]>;
  /** Reactive features used, in order of first appearance. */
  features: FeatureKey[];
}

const REACTIVE_PSEUDO = /:(when|changed|nth-var|on)\((?:[^()]|\([^()]*\))*\)|:just-(un)?checked|:blur\b/g;

/** Selector usable with querySelectorAll / closest(): reactive pseudo-classes and pseudo-elements removed. */
/** Splits a selector list at top-level commas, so :on(click, prevent()) stays one item. */
function splitList(selector: string): string[] {
  const out: string[] = [];
  let depth = 0, from = 0;
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) { out.push(selector.slice(from, i)); from = i + 1; }
  }
  return [...out, selector.slice(from)];
}

export function querySelectorFor(selector: string): string {
  return splitList(selector)
    .map((s) => s.replace(REACTIVE_PSEUDO, '').replace(/::?(after|before|marker|placeholder|selection|backdrop)\b/g, '').trim() || '*')
    .join(', ');
}

export function inferType(initial: string): StateType {
  const v = initial.trim();
  if (v === 'true' || v === 'false') return 'boolean';
  if (/^[+-]?(\d*\.)?\d+$/.test(v)) return 'number';
  if (/^[+-]?(\d*\.)?\d+([a-z]+|%)$/i.test(v)) return 'dimension';
  if (/^["']/.test(v)) return 'string';
  return 'keyword';
}

/** Walks rules and declarations, resolving `&` and nested selectors. */
export function declarations(css: string): Declaration[] {
  const raw = lex(css).filter((t) => t.type !== 'comment');
  const lineAt = lineIndex(css);
  const out: Declaration[] = [];
  // Stack of open blocks: a selector for style rules, null for at-rule groups.
  const stack: { selector: string | null; conditional: boolean }[] = [];
  const current = () => [...stack].reverse().find((b) => b.selector !== null)?.selector ?? '';
  const conditional = () => stack.some((b) => b.conditional);
  let i = 0;

  const textUntil = (stop: (t: string, depth: number) => boolean) => {
    let depth = 0, s = '';
    const start = i;
    for (; i < raw.length; i++) {
      const t = raw[i]!;
      if (stop(t.type, depth)) break;
      if (t.type === '(' || t.type === '[') depth++;
      if (t.type === ')' || t.type === ']') depth--;
      s += t.text;
    }
    return { text: s.trim().replace(/\s+/g, ' '), start };
  };

  while (i < raw.length) {
    const t = raw[i]!;
    if (t.type === 'ws' || t.type === ';') { i++; continue; }
    if (t.type === '}') { stack.pop(); i++; continue; }
    if (t.type === 'at') {
      const name = t.text.slice(1).toLowerCase();
      i++;
      textUntil((type, d) => d === 0 && (type === '{' || type === ';'));
      if (raw[i]?.type === '{') { stack.push({ selector: null, conditional: name !== 'layer' }); }
      i++;
      continue;
    }
    // Declaration or nested rule? A rule prelude reaches `{` before `;` or `}`.
    let isRule = true;
    if (stack.length && current()) {
      let d = 0;
      for (let j = i; j < raw.length; j++) {
        const type = raw[j]!.type;
        if (type === '(' || type === '[') d++;
        else if (type === ')' || type === ']') d--;
        else if (d === 0 && type === '{') break;
        else if (d === 0 && (type === ';' || type === '}')) { isRule = false; break; }
      }
    }
    if (isRule) {
      const { text } = textUntil((type, d) => d === 0 && type === '{');
      const parent = current();
      const selector = !parent ? text
        : text.split(',').map((part) => part.includes('&') ? part.trim().replaceAll('&', parent.includes(',') ? `:is(${parent})` : parent) : `${parent.includes(',') ? `:is(${parent})` : parent} ${part.trim()}`).join(', ');
      stack.push({ selector, conditional: false });
      i++;
      continue;
    }
    const propTok = raw[i]!;
    const prop = propTok.text.toLowerCase();
    i++;
    while (raw[i] && raw[i]!.type !== ':') i++;
    i++;
    const { text: value } = textUntil((type, d) => d === 0 && (type === ';' || type === '}'));
    out.push({ selector: current(), prop, value, line: lineAt(propTok.start), conditional: conditional() });
  }
  return out;
}

function lineIndex(src: string) {
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1);
  return (offset: number) => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid]! <= offset) lo = mid; else hi = mid - 1; }
    return lo;
  };
}

const DERIVED_FN = /^(previous|direction|on|mouse|element|random|pick|live|visible|wave|when|typed)\(/;
const MUTATION = /^(set|toggle|increment|decrement|cycle)\(/;

/** The first top-level argument: `state(0, persist("k"))` → `0`. */
function firstArg(args: string): string {
  let depth = 0, quote = '';
  for (let i = 0; i < args.length; i++) {
    const c = args[i]!;
    if (quote) { if (c === quote && args[i - 1] !== '\\') quote = ''; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) return args.slice(0, i).trim();
  }
  return args.trim();
}

/** The trigger of a 0.9 `:on()` selector, in the bridge's event names: click, key:Escape, outside:click… */
function onEvent(selector: string): string | undefined {
  const m = /:on\(\s*([\w-]+)(?:\(\s*([^)]*?)\s*\))?/.exec(selector);
  if (!m) return undefined;
  const [, name, arg] = m;
  if ((name === 'keydown' || name === 'keyup') && arg) return `key:${arg}`;
  if (name === 'outside' && arg) return `outside:${arg}`;
  return name;
}

export function analyze(css: string): Analysis {
  const decls = declarations(css);
  const states: StateDecl[] = [];
  const derived: DerivedDecl[] = [];
  const triggers: TriggerDecl[] = [];
  for (const d of decls) {
    if (d.prop.startsWith('--')) {
      const m = /^state\(([\s\S]*)\)$/.exec(d.value);
      if (m) { const initial = firstArg(m[1]!); states.push({ name: d.prop, line: d.line, selector: d.selector, initial, type: inferType(initial) }); continue; }
      // 0.9: a mutation in an :on() rule writes the state named on its left.
      const ev = MUTATION.test(d.value) ? onEvent(d.selector) : undefined;
      if (ev) { triggers.push({ line: d.line, selector: d.selector, kind: 'on', writes: [d.prop], events: [ev] }); continue; }
      const f = DERIVED_FN.exec(d.value);
      if (f) derived.push({ name: d.prop, line: d.line, selector: d.selector, fn: f[1]! });
    } else if (d.prop === 'on' || d.prop === 'bind') {
      const writes = d.prop === 'bind'
        ? [d.value.split(/\s+/)[0]!]
        : [...d.value.matchAll(/\b(?:set|toggle|increment|decrement|cycle)\(\s*(--[\w-]+)/g)].map((m) => m[1]!);
      const events = d.prop === 'bind' ? ['input', 'change'] : [...d.value.matchAll(/\b(click|change|input|pointerenter|pointerleave|focus|blur|key|outside)\(\s*([^,()]*)/g)]
        .map((m) => (m[1] === 'key' || m[1] === 'outside' ? `${m[1]}:${m[2]!.trim()}` : m[1]!));
      triggers.push({ line: d.line, selector: d.selector, kind: d.prop, writes: [...new Set(writes)], events: [...new Set(events)] });
    }
  }
  // previous(--x) has the type of --x.
  for (const d of derived) {
    const src = /^previous\(\s*(--[\w-]+)/.exec(decls.find((x) => x.prop === d.name && x.line === d.line)!.value)?.[1];
    const st = src && states.find((s) => s.name === src);
    if (st) d.type = st.type;
  }

  const lines = css.split('\n');
  const skip = new Set([...states.map((s) => s.line), ...derived.map((s) => s.line), ...triggers.map((t) => t.line)]);
  const names = [...new Set([...states, ...derived].map((s) => s.name))];
  const reads: Record<string, number[]> = {};
  for (const name of names) {
    const re = new RegExp(name.replace(/[-]/g, '\\-') + '(?![\\w-])');
    reads[name] = lines.flatMap((l, i) => (!skip.has(i) && re.test(l) ? [i] : []));
    // A derived declaration reads the state it is computed from.
    for (const d of derived) if (re.test(lines[d.line] ?? '') && d.name !== name) reads[name]!.push(d.line);
    reads[name]!.sort((a, b) => a - b);
  }

  const features: FeatureKey[] = [];
  for (const t of highlightCss(css).flat()) if (t.feature && !features.includes(t.feature)) features.push(t.feature);

  return { declarations: decls, states, derived, triggers, reads, features };
}
