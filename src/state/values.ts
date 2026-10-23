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
  | { k: 'cmp'; op: string; a: Cond; b: Cond };

export interface Condition { ast: Cond; names: string[]; text: string }

const TOKEN = /\s*((?:previous|direction)\(\s*--[\w-]+\s*\)|--[\w-]+|>=|<=|==|!=|>|<|\(|\)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?[a-z%]*|#[0-9a-f]+|[a-z_][\w-]*)/iy;
const OPS = new Set(['==', '!=', '>', '<', '>=', '<=']);

/**
 * Grammar:  or  := and ('or' and)*      and := not ('and' not)*
 *           not := 'not' not | cmp       cmp := operand (op operand)?
 *           operand := --state | previous(--state) | direction(--state) | number | dimension
 *                    | true | false | keyword | #hex | "string" | '(' or ')'
 */
export function parseCondition(text: string): Condition {
  const toks: string[] = [];
  let pos = 0;
  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN.exec(text))) { toks.push(m[1]); pos = TOKEN.lastIndex; }
  if (text.slice(pos).trim()) throw new Error(`cannot read condition "${text}" near "${text.slice(pos).trim()}"`);
  let i = 0;
  const names = new Set<string>();
  const peek = () => toks[i]?.toLowerCase();
  const fail = (what: string): never => { throw new Error(`condition "${text}": ${what}`); };

  const operand = (): Cond => {
    const t = toks[i++];
    if (t === undefined) fail('expression ends too early');
    if (t === '(') {
      const e = or();
      if (toks[i++] !== ')') fail('missing ")"');
      return e;
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
  return { ast, names: [...names], text };
}

/** Thrown for type errors; the caller reports it once and treats the condition as unknown. */
export class ConditionError extends Error {}

/** What a condition can read from a state: its current and previous value. */
export interface StateValues { value: Typed; previous: Typed }
export type Lookup = (name: string) => StateValues | undefined;

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
  const r = evaluate(c, lookup);
  return r === undefined ? undefined : { type: 'boolean', v: r };
}

const describe = (c: Cond) =>
  c.k === 'ref' ? c.name : c.k === 'prev' ? `previous(${c.name})` : c.k === 'dir' ? `direction(${c.name})` : c.k === 'lit' ? serialize(c.t) : 'expression';

function compare(op: string, a: Typed, b: Typed): boolean {
  const ordered = op !== '==' && op !== '!=';
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
