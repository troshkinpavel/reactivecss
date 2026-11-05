// Typed state values and the condition grammar used by when() and :when().
// Pure: no DOM access. A deliberately small, explicit language: no JavaScript is ever
// evaluated, and values are compared by type, never by JavaScript string ordering.

import { fmt } from '../core/format';

export type StateType = 'boolean' | 'number' | 'dimension' | 'value' | 'string';

/**
 * A logical value: booleans, unitless numbers, dimensions (number + unit), quoted strings
 * and plain values (colors, keywords).
 */
export interface Typed {
  type: StateType;
  v: boolean | number | string;
  /** Lower-case unit for dimensions ('px', '%', 'deg'...), '' for numbers. */
  unit?: string;
}

const NUMBER = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([a-z%]*)$/i;

/** Parses one state value. Throws on empty values or lists. */
export function parseTyped(text: string): Typed {
  const s = text.trim();
  if (!s) throw new Error('a value is required');
  const q = /^(["'])((?:\\.|(?!\1)[^\\])*)\1$/s.exec(s);
  if (q) return { type: 'string', v: q[2].replace(/\\(.)/gs, '$1') };
  if (/^(true|false)$/i.test(s)) return { type: 'boolean', v: s.toLowerCase() === 'true' };
  const m = NUMBER.exec(s);
  if (m) return m[2] ? { type: 'dimension', v: +m[1], unit: m[2].toLowerCase() } : { type: 'number', v: +m[1], unit: '' };
  if (/[,;{}]/.test(s)) throw new Error(`"${s}" is not a single value`);
  return { type: 'value', v: s };
}

/** CSS text for a value. Booleans become 1 / 0 so var() works in calc(), opacity, etc. */
export function serialize(t: Typed): string {
  if (t.type === 'boolean') return t.v ? '1' : '0';
  if (t.type === 'value') return t.v as string;
  // One CSS string token whatever the text (attribute values are untrusted): quotes and
  // backslashes escaped, every control character as a hex escape (a raw newline ends a string).
  if (t.type === 'string') return '"' + (t.v as string).replace(/[\\"]/g, '\\$&').replace(/[\0-\x1f\x7f]/g, (c) => '\\' + c.charCodeAt(0).toString(16) + ' ') + '"';
  return fmt(t.v as number) + (t.unit ?? '');
}

/** Units that convert to a canonical unit of the same dimension. */
const UNITS: Record<string, [string, number]> = {
  px: ['length', 1], cm: ['length', 96 / 2.54], mm: ['length', 96 / 25.4], q: ['length', 96 / 101.6],
  in: ['length', 96], pt: ['length', 4 / 3], pc: ['length', 16],
  deg: ['angle', 1], grad: ['angle', 0.9], rad: ['angle', 180 / Math.PI], turn: ['angle', 360],
  s: ['time', 1000], ms: ['time', 1], hz: ['frequency', 1], khz: ['frequency', 1000],
};

/** Numeric value of `b` in the unit of `a`, or undefined when they are not comparable. */
export function convert(a: Typed, b: Typed): number | undefined {
  if (a.unit === b.unit) return b.v as number;
  const ua = UNITS[a.unit!], ub = UNITS[b.unit!];
  return ua && ub && ua[0] === ub[0] ? ((b.v as number) * ub[1]) / ua[1] : undefined;
}

/** True when a value of `from` may be stored in a state of type `to`. */
export function assignable(to: Typed, from: Typed): boolean {
  if (to.type === 'value' || to.type === 'string') return from.type === to.type;
  if (to.type !== from.type) return false;
  return to.type !== 'dimension' || convert(to, from) !== undefined;
}

/** `from` converted to the unit of `to` (assignable() must be true). */
export function coerce(to: Typed, from: Typed): Typed {
  return to.type === 'dimension' ? { type: 'dimension', v: convert(to, from)!, unit: to.unit } : from;
}

export function equal(a: Typed, b: Typed): boolean {
  return a.type === b.type && a.v === b.v && a.unit === b.unit;
}

// ---- conditions -------------------------------------------------------------------

export type Cond =
  | { k: 'ref'; name: string }
  | { k: 'prev'; name: string }
  | { k: 'dir'; name: string }
  | { k: 'lit'; t: Typed }
  | { k: 'not'; a: Cond }
  | { k: 'and' | 'or'; a: Cond; b: Cond }
  | { k: 'cmp'; op: string; a: Cond; b: Cond }
  /** 0.10: a value function call (strings), parsed and evaluated by conditionCalls. */
  | { k: 'call'; node: unknown; text: string };

/** 0.10: a string that is exactly a decimal number ("09", "-1.5", format(…) output) as that number. */
export function numericString(t: Typed): Typed | undefined {
  if (t.type !== 'string' || !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(t.v as string)) return undefined;
  return { type: 'number', v: +(t.v as string), unit: '' };
}

/**
 * 0.10: value function calls in conditions, `:when(includes(lower(--name), --q))`. Installed by
 * functions/calls.ts (the expression language lives in actexpr.ts, which imports this file);
 * without it the grammar is unchanged.
 */
export const conditionCalls: {
  names?: Set<string>;
  parse?(text: string): { node: unknown; names: string[] };
  /** Undefined = unknown; throws ConditionError for a type error. */
  evaluate?(node: unknown, el: Element): Typed | undefined;
} = {};

export interface Condition {
  ast: Cond; names: string[]; text: string;
  /** 0.10: states read inside call operands (resolved before each evaluation, to subscribe). */
  calls?: string[];
}

const TOKEN = /\s*((?:previous|direction)\(\s*--[\w-]+\s*\)|\x00\d+|--[\w-]+|[<>=!]\s*=|>|<|\(|\)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?[a-z%]*|#[0-9a-f]+|[a-z_][\w-]*)/iy;
const OPS = new Set(['==', '!=', '>', '<', '>=', '<=']);

/**
 * Grammar:  or  := and ('or' and)*      and := not ('and' not)*
 *           not := 'not' not | cmp       cmp := operand (op operand)?
 *           operand := --state | previous(--state) | direction(--state) | number | dimension
 *                    | true | false | keyword | #hex | "string" | '(' or ')'
 *                    | value function call (0.10: length(), includes(), lower(), trim())
 */
export function parseCondition(text: string): Condition {
  const toks: string[] = [];
  const calls: string[] = [];
  const source = text;
  if (conditionCalls.names?.size && hasCall(text, conditionCalls.names)) text = extractCalls(text, conditionCalls.names, calls);
  let pos = 0;
  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  // A two-character operator may contain whitespace after formatting: `> =` is `>=` (0.10).
  // Only a spaced operator is longer than two characters and starts with one of < > = !.
  while ((m = TOKEN.exec(text))) { const t = m[1]; toks.push(t.length > 2 && '<>=!'.includes(t[0]) ? t[0] + '=' : t); pos = TOKEN.lastIndex; }
  if (text.slice(pos).trim()) throw new Error(`cannot read condition "${source}" near "${text.slice(pos).trim().replace(/\x00(\d+)/g, (_, n) => calls[+n])}"`);
  let i = 0;
  const names = new Set<string>();
  let callNames: Set<string> | undefined;
  const peek = () => toks[i]?.toLowerCase();
  const fail = (what: string): never => { throw new Error(`condition "${source}": ${what}`); };

  const operand = (): Cond => {
    const t = toks[i++];
    if (t === undefined) fail('expression ends too early');
    if (t === '(') {
      const e = or();
      if (toks[i++] !== ')') fail('missing ")"');
      return e;
    }
    if (t[0] === '\x00') {
      const call = calls[+t.slice(1)];
      let parsed;
      try { parsed = conditionCalls.parse!(call); } catch (e) { return fail(`${call}: ${(e as Error).message}`); }
      for (const n of parsed.names) { names.add(n); (callNames ??= new Set()).add(n); }
      return { k: 'call', node: parsed.node, text: call };
    }
    if (t.startsWith('--')) { names.add(t); return { k: 'ref', name: t }; }
    const fn = /^(previous|direction)\(\s*(--[\w-]+)\s*\)$/i.exec(t);
    if (fn) { names.add(fn[2]); return { k: fn[1].toLowerCase() === 'previous' ? 'prev' : 'dir', name: fn[2] }; }
    if (t === ')' || OPS.has(t) || /^(and|or|not)$/i.test(t)) fail(`unexpected "${t}"`);
    return { k: 'lit', t: parseTyped(t) };
  };
  const cmp = (): Cond => {
    const a = operand();
    if (!OPS.has(toks[i])) return a;
    const op = toks[i++];
    return { k: 'cmp', op, a, b: operand() };
  };
  const not = (): Cond => (peek() === 'not' ? (i++, { k: 'not', a: not() }) : cmp());
  const and = (): Cond => {
    let a = not();
    while (peek() === 'and') { i++; a = { k: 'and', a, b: not() }; }
    return a;
  };
  const or = (): Cond => {
    let a = and();
    while (peek() === 'or') { i++; a = { k: 'or', a, b: and() }; }
    return a;
  };
  const ast = or();
  if (i < toks.length) fail(`unexpected "${toks[i]}"`);
  const c: Condition = { ast, names: [...names], text: source };
  if (callNames) c.calls = [...callNames];
  return c;
}

let callTest: { size: number; re: RegExp } | undefined;
/** Whether `text` may contain a call of `names` (a cheap test, so conditions without calls skip the scan below). */
function hasCall(text: string, names: Set<string>): boolean {
  if (!text.includes('(')) return false;
  if (callTest?.size !== names.size) callTest = { size: names.size, re: new RegExp(`(?:^|[^\\w-])(?:${[...names].join('|')})\\(`, 'i') };
  return callTest.re.test(text);
}

/** Replaces each call of `names` (outside strings) with a placeholder token \x00<n>, kept in `out`. */
function extractCalls(text: string, names: Set<string>, out: string[]): string {
  let s = '';
  for (let i = 0; i < text.length;) {
    const c = text[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < text.length && text[j] !== c) j += text[j] === '\\' ? 2 : 1;
      s += text.slice(i, j + 1); i = j + 1; continue;
    }
    const m = /^[a-z][\w-]*\(/i.exec(text.slice(i));
    if (m && names.has(m[0].slice(0, -1).toLowerCase()) && !/[\w-]/.test(text[i - 1] ?? '')) {
      let depth = 0, j = i + m[0].length - 1, q = '';
      for (; j < text.length; j++) {
        const d = text[j];
        if (q) { if (d === '\\') j++; else if (d === q) q = ''; continue; }
        if (d === '"' || d === "'") q = d;
        else if (d === '(') depth++;
        else if (d === ')' && --depth === 0) break;
      }
      if (j >= text.length) throw new Error(`condition "${text}": missing ")"`);
      s += ` \x00${out.length} `;
      out.push(text.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    s += c; i++;
  }
  return s;
}

/** Thrown for type errors; the caller reports it once and treats the condition as unknown. */
export class ConditionError extends Error {}

/** What a condition can read from a state: its current and previous value. */
export interface StateValues { value: Typed; previous: Typed }
export type Lookup = ((name: string) => StateValues | undefined) & {
  /** 0.10: evaluates a call operand for the element (conditions.ts). */
  call?(node: unknown): Typed | undefined;
};

/** direction(): 1, 0 or -1 for number and dimension states; a ConditionError otherwise. */
export function direction(s: StateValues, name = 'the state'): Typed {
  const { value: a, previous: b } = s;
  if ((a.type !== 'number' && a.type !== 'dimension') || a.type !== b.type || a.unit !== b.unit)
    throw new ConditionError(`direction(${name}) needs a number or dimension state, not a ${a.type}`);
  const d = (a.v as number) - (b.v as number);
  return { type: 'number', v: d > 0 ? 1 : d < 0 ? -1 : 0, unit: '' };
}

/**
 * Evaluates a condition. `lookup` returns a state's values, or undefined when it cannot be
 * resolved; the result is then undefined ("unknown"), never silently false.
 */
export function evaluate(c: Cond, lookup: Lookup): boolean | undefined {
  switch (c.k) {
    case 'not': { const a = evaluate(c.a, lookup); return a === undefined ? undefined : !a; }
    // Three-valued: unknown and false = false, unknown or true = true.
    case 'and': {
      const a = evaluate(c.a, lookup);
      if (a === false) return false;
      const b = evaluate(c.b, lookup);
      return b === false ? false : a === undefined || b === undefined ? undefined : true;
    }
    case 'or': {
      const a = evaluate(c.a, lookup);
      if (a === true) return true;
      const b = evaluate(c.b, lookup);
      return b === true ? true : a === undefined || b === undefined ? undefined : false;
    }
    case 'cmp': {
      const a = value(c.a, lookup), b = value(c.b, lookup);
      return a === undefined || b === undefined ? undefined : compare(c.op, a, b);
    }
    default: {
      const t = value(c, lookup);
      if (t === undefined) return undefined;
      if (t.type !== 'boolean') throw new ConditionError(`${describe(c)} is ${t.type === 'value' ? `"${t.v}"` : serialize(t)}, not a boolean; compare it explicitly (for example ${describe(c)} != 0)`);
      return t.v as boolean;
    }
  }
}

function value(c: Cond, lookup: Lookup): Typed | undefined {
  if (c.k === 'ref') return lookup(c.name)?.value;
  if (c.k === 'prev') return lookup(c.name)?.previous;
  if (c.k === 'dir') { const s = lookup(c.name); return s && direction(s, c.name); }
  if (c.k === 'lit') return c.t;
  if (c.k === 'call') return lookup.call?.(c.node);
  const r = evaluate(c, lookup);
  return r === undefined ? undefined : { type: 'boolean', v: r };
}

const describe = (c: Cond) =>
  c.k === 'call' ? c.text : c.k === 'ref' ? c.name : c.k === 'prev' ? `previous(${c.name})` : c.k === 'dir' ? `direction(${c.name})` : c.k === 'lit' ? serialize(c.t) : 'expression';

function compare(op: string, a: Typed, b: Typed): boolean {
  const ordered = op !== '==' && op !== '!=';
  // 0.10: a numeric string compares with a number ("09" >= 9); two strings still compare as text.
  if ((a.type === 'string') !== (b.type === 'string')) { a = numericString(a) ?? a; b = numericString(b) ?? b; }
  if (a.type === 'boolean' || b.type === 'boolean' || a.type === 'value' || b.type === 'value' || a.type === 'string' || b.type === 'string') {
    if (a.type !== b.type) throw new ConditionError(`cannot compare ${serialize(a)} (${a.type}) with ${serialize(b)} (${b.type})`);
    if (ordered) throw new ConditionError(`${op} needs numbers, got ${a.type} values`);
    // Keywords and colors compare ASCII case-insensitively, strings exactly.
    const eq = a.type === 'value' ? String(a.v).toLowerCase() === String(b.v).toLowerCase() : a.v === b.v;
    return op === '==' ? eq : !eq;
  }
  // numbers and dimensions: a unitless 0 compares with anything, as in CSS
  const zero = (t: Typed) => t.v === 0 && t.type === 'number';
  const bv = a.unit === b.unit || zero(a) || zero(b) ? (b.v as number) : convert(a, b);
  if (bv === undefined || (a.type !== b.type && !zero(a) && !zero(b)))
    throw new ConditionError(`cannot compare ${serialize(a)} with ${serialize(b)}: incompatible units`);
  const av = a.v as number;
  switch (op) {
    case '==': return av === bv;
    case '!=': return av !== bv;
    case '>': return av > bv;
    case '<': return av < bv;
    case '>=': return av >= bv;
    default: return av <= bv;
  }
}
