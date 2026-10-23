// Event-time expressions (0.9.0): the value of set(), increment() and decrement() in :on() rules.
// Semantics: docs/rfc-v0.9.0-language.md, sections 1.5 and 5.
//
// - Parsed and validated once per stylesheet (field names against the trigger, arity, units of
//   literals); evaluated at each event against a snapshot: state values, attributes and geometry
//   as they are before any write of that event.
// - Typed arithmetic over the 0.8.1 state values: booleans count as 1 / 0, dimensions convert
//   within a unit family, incompatible units are an EvalError (one diagnostic, no write).
// - Never JavaScript: a closed set of node kinds, no property access, no evaluation of strings.

import { warn } from '../core/log';
import { fmt } from '../core/format';
import { sensitive } from './expr';
import { resolveCell, type Cell } from './state';
import { parseTyped, convert, serialize, type Typed } from './values';

/** What kind of event a trigger delivers: decides which event() fields exist. */
export type Category = 'pointer' | 'mouse' | 'keyboard' | 'form' | 'focus' | 'scroll' | 'drag' | 'other';

export type Node =
  | { k: 'lit'; t: Typed }
  | { k: 'op'; op: '+' | '-' | '*' | '/'; a: Node; b: Node }
  | { k: 'neg'; a: Node }
  | { k: 'math'; fn: 'min' | 'max' | 'clamp' | 'abs'; args: Node[] }
  | { k: 'round'; mode: string; a: Node; b?: Node }
  | { k: 'var'; name: string; fallback?: Node }
  | { k: 'event'; field: string }
  | { k: 'mouse'; axis: 'x' | 'y'; local: boolean }
  | { k: 'size'; of: 'element' | 'viewport'; dim: 'width' | 'height' }
  | { k: 'attr'; name: string; fallback?: Typed }
  | { k: 'pick'; items: Node[] }
  | { k: 'split'; of: Node; sep: string }
  | { k: 'random'; min: Node; max: Node; step?: Node }
  | { k: 'sibling'; count: boolean };

/** Drag gesture data (gesture.ts) for the drag fields of event(). */
export interface DragInfo {
  startX: number; startY: number;
  x: number; y: number;
  lastX: number; lastY: number;
  /** The rule element's border box at drag start (local coordinates, no layout read per move). */
  rect: DOMRect;
  /** Each mutated state's value when the drag started (read on first use in the gesture). */
  starts: Map<Cell, Typed>;
}

export interface EvalCtx {
  e: Event;
  /** The element matched by the :on() rule. */
  el: Element;
  /** The state being mutated (event(x) / event(y) start from its value). */
  target?: Cell;
  drag?: DragInfo;
  /** Border boxes read during this event (one layout read per element per event). */
  rects?: Map<Element, DOMRect>;
}

export class EvalError extends Error {}

// ---- event() field catalog ------------------------------------------------------------

const POINTERISH: Category[] = ['pointer', 'mouse', 'drag'];
const FIELDS: Record<string, Category[] | 'all'> = {
  type: 'all',
  'client-x': POINTERISH, 'client-y': POINTERISH, 'page-x': POINTERISH, 'page-y': POINTERISH,
  'local-x': POINTERISH, 'local-y': POINTERISH, button: POINTERISH, buttons: POINTERISH,
  'pointer-id': ['pointer', 'drag'], 'pointer-type': ['pointer', 'drag'], pressure: ['pointer', 'drag'],
  'alt-key': [...POINTERISH, 'keyboard'], 'ctrl-key': [...POINTERISH, 'keyboard'], 'shift-key': [...POINTERISH, 'keyboard'], 'meta-key': [...POINTERISH, 'keyboard'],
  key: ['keyboard'], code: ['keyboard'], repeat: ['keyboard'],
  value: ['form'], 'value-as-number': ['form'], checked: ['form'],
  x: ['drag'], y: ['drag'], 'delta-x': ['drag'], 'delta-y': ['drag'], 'movement-x': ['drag'], 'movement-y': ['drag'], 'start-x': ['drag'], 'start-y': ['drag'],
  'scroll-top': ['scroll'], 'scroll-left': ['scroll'],
};

/** event() fields available for a trigger category (for messages and describe()). */
export const fieldsFor = (c: Category) => Object.keys(FIELDS).filter((f) => FIELDS[f] === 'all' || (FIELDS[f] as Category[]).includes(c));
export const EVENT_FIELDS = Object.keys(FIELDS);

// ---- lexer ----------------------------------------------------------------------------

type Tok =
  | { t: 'num'; v: number; unit: string; text: string }
  | { t: 'str'; v: string }
  | { t: 'id'; v: string }
  | { t: 'fn'; v: string }
  | { t: 'p'; v: string };

const NUM = /[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(?:%|[a-z]+)?/iy;
const IDENT = /-{0,2}[a-z_][\w-]*|#[0-9a-f]+/iy;

function lex(s: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const operand = () => { const p = out[out.length - 1]; return !!p && (p.t === 'num' || p.t === 'str' || p.t === 'id' || p.v === ')'); };
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"' || c === "'") {
      let v = '';
      let j = i + 1;
      for (; j < s.length && s[j] !== c; j++) v += s[j] === '\\' && j + 1 < s.length ? s[++j] : s[j];
      if (j >= s.length) throw new Error('unterminated string');
      out.push({ t: 'str', v });
      i = j + 1;
      continue;
    }
    // A sign is part of a number only where an operand is expected (CSS needs spaces around + and -).
    if (/[\d.]/.test(c) || ((c === '+' || c === '-') && /[\d.]/.test(s[i + 1] ?? '') && !operand())) {
      NUM.lastIndex = i;
      const m = NUM.exec(s);
      if (m) {
        const n = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(.*)$/i.exec(m[0])!;
        out.push({ t: 'num', v: +n[1], unit: n[2].toLowerCase(), text: m[0] });
        i += m[0].length;
        continue;
      }
    }
    IDENT.lastIndex = i;
    const id = (c === '-' && s[i + 1] !== '-' && !/[a-z_]/i.test(s[i + 1] ?? '')) ? null : IDENT.exec(s);
    if (id) {
      i += id[0].length;
      if (s[i] === '(') { out.push({ t: 'fn', v: id[0].toLowerCase() }); i++; }
      else out.push({ t: 'id', v: id[0] });
      continue;
    }
    if ('(),+-*/'.includes(c)) { out.push({ t: 'p', v: c }); i++; continue; }
    throw new Error(`unexpected "${c}"`);
  }
  return out;
}

// ---- parser ---------------------------------------------------------------------------

const ATTR_NAME = /^[a-z_][\w.-]*$/i;

/**
 * Parses an event-time expression. `category` is the trigger's (event() and mouse() are checked
 * against it); `trigger` names it in messages.
 */
export function parseAction(text: string, category: Category, trigger: string): Node {
  const toks = lex(text);
  let i = 0;
  const peek = () => toks[i];
  const fail = (m: string): never => { throw new Error(m); };
  const expect = (v: string) => { const t = toks[i++]; if (!t || t.t !== 'p' || t.v !== v) fail(`expected "${v}" in "${text}"`); };
  const args = (): Node[] => {
    const list: Node[] = [];
    if (peek()?.t === 'p' && peek().v === ')') { i++; return list; }
    for (;;) {
      list.push(sum());
      const t = toks[i++];
      if (t?.t === 'p' && t.v === ')') return list;
      if (!(t?.t === 'p' && t.v === ',')) fail(`expected "," or ")" in "${text}"`);
    }
  };
  /** Single plain words inside a call: event(client-x), mouse(x, local), round(up, …). */
  const word = (): string | undefined => {
    const t = peek();
    if (t?.t !== 'id') return undefined;
    i++;
    return t.v.toLowerCase();
  };

  function primary(): Node {
    const t = toks[i++];
    if (!t) return fail(`"${text}" ends too early`);
    if (t.t === 'num') return { k: 'lit', t: t.unit ? { type: 'dimension', v: t.v, unit: t.unit } : { type: 'number', v: t.v, unit: '' } };
    if (t.t === 'str') return { k: 'lit', t: { type: 'string', v: t.v } };
    if (t.t === 'id') {
      if (t.v.startsWith('--')) fail(`write var(${t.v}) to read a state`);
      return { k: 'lit', t: parseTyped(t.v) };
    }
    if (t.t === 'p') {
      if (t.v === '(') { const e = sum(); expect(')'); return e; }
      return fail(`unexpected "${t.v}" in "${text}"`);
    }
    switch (t.v) {
      case 'calc': { const a = args(); if (a.length !== 1) fail('calc() takes one expression'); return a[0]; }
      case 'min': case 'max': { const a = args(); if (!a.length) fail(`${t.v}() needs at least one value`); return { k: 'math', fn: t.v, args: a }; }
      case 'clamp': { const a = args(); if (a.length !== 3) fail('expected clamp(min, value, max)'); return { k: 'math', fn: 'clamp', args: a }; }
      case 'abs': { const a = args(); if (a.length !== 1) fail('expected abs(value)'); return { k: 'math', fn: 'abs', args: a }; }
      case 'round': {
        let mode = 'nearest';
        const save = i;
        const w = word();
        if (w && ['nearest', 'up', 'down', 'to-zero'].includes(w) && peek()?.v === ',') { mode = w; i++; } else i = save;
        const a = args();
        if (a.length < 1 || a.length > 2) fail('expected round([nearest | up | down | to-zero,] value [, interval])');
        return { k: 'round', mode, a: a[0], b: a[1] };
      }
      case 'var': {
        const n = toks[i++];
        if (n?.t !== 'id' || !n.v.startsWith('--')) fail('expected var(--name)');
        let fallback: Node | undefined;
        if (peek()?.v === ',') { i++; fallback = sum(); }
        expect(')');
        return { k: 'var', name: (n as { v: string }).v, fallback };
      }
      case 'event': {
        const f = word();
        expect(')');
        if (!f || !(f in FIELDS)) fail(`event(${f ?? ''}): unknown field; ${trigger} provides ${fieldsFor(category).join(', ')}`);
        const cats = FIELDS[f!];
        if (cats !== 'all' && !cats.includes(category)) fail(`event(${f}) is not available for ${trigger}; it provides ${fieldsFor(category).join(', ')}`);
        return { k: 'event', field: f! };
      }
      case 'mouse': {
        const axis = word();
        let local = false;
        if (peek()?.v === ',') { i++; const m = word(); if (m !== 'local' && m !== 'viewport') fail('expected mouse(x | y [, viewport | local])'); local = m === 'local'; }
        expect(')');
        if (axis !== 'x' && axis !== 'y') fail('expected mouse(x) or mouse(y)');
        if (!POINTERISH.includes(category)) fail(`mouse() in an action needs a pointer or drag trigger; ${trigger} has no pointer position`);
        return { k: 'mouse', axis: axis as 'x' | 'y', local };
      }
      case 'element': case 'viewport': {
        const d = word();
        expect(')');
        if (d !== 'width' && d !== 'height') fail(`expected ${t.v}(width) or ${t.v}(height)`);
        return { k: 'size', of: t.v, dim: d as 'width' | 'height' };
      }
      case 'attr': {
        const n = toks[i++];
        if (n?.t !== 'id' || !ATTR_NAME.test(n.v)) fail('expected attr(name) or attr(name, fallback)');
        let fallback: Typed | undefined;
        if (peek()?.v === ',') {
          i++;
          const f = primary();
          if (f.k !== 'lit') fail('the attr() fallback must be a value');
          fallback = (f as { t: Typed }).t;
        }
        expect(')');
        return { k: 'attr', name: (n as { v: string }).v.toLowerCase(), fallback };
      }
      case 'pick': {
        const a = args();
        if (!a.length) fail('pick() needs at least one value');
        if (a.some((x) => x.k === 'split') && a.length > 1) fail('split() must be the only argument of pick()');
        return { k: 'pick', items: a };
      }
      case 'split': {
        const a = args();
        if (a.length !== 2 || a[1].k !== 'lit' || a[1].t.type !== 'string' || !a[1].t.v) fail('expected split(text, "delimiter")');
        return { k: 'split', of: a[0], sep: (a[1] as { t: Typed }).t.v as string };
      }
      case 'random': {
        const a: Node[] = [];
        a.push(sum());
        expect(',');
        a.push(sum());
        let step: Node | undefined;
        if (peek()?.v === ',') {
          i++;
          // random(min, max, step) (CSS Values 5) or random(min, max, by step) (the earlier draft): the same step.
          if (peek()?.t === 'id' && (peek() as { v: string }).v.toLowerCase() === 'by') i++;
          step = sum();
        }
        expect(')');
        return { k: 'random', min: a[0], max: a[1], step };
      }
      case 'sibling-index': case 'sibling-count': expect(')'); return { k: 'sibling', count: t.v === 'sibling-count' };
    }
    return fail(`${t.v}() is not available in actions; use calc(), min(), max(), clamp(), round(), abs(), var(), event(), mouse(), element(), viewport(), attr(), pick(), random(), sibling-index() or sibling-count()`);
  }
  function unary(): Node {
    if (peek()?.t === 'p' && peek().v === '-') { i++; return { k: 'neg', a: unary() }; }
    return primary();
  }
  function product(): Node {
    let a = unary();
    while (peek()?.t === 'p' && (peek().v === '*' || peek().v === '/')) { const op = toks[i++].v as '*' | '/'; a = { k: 'op', op, a, b: unary() }; }
    return a;
  }
  function sum(): Node {
    let a = product();
    while (peek()?.t === 'p' && (peek().v === '+' || peek().v === '-')) { const op = toks[i++].v as '+' | '-'; a = { k: 'op', op, a, b: product() }; }
    return a;
  }
  if (!toks.length) fail('a value is required');
  const n = sum();
  if (i < toks.length) fail(`unexpected "${(toks[i] as { v: unknown }).v}" in "${text}"`);
  if (n.k === 'split') fail('split() makes a list; use it inside pick()');
  return n;
}

// ---- evaluation -----------------------------------------------------------------------

const px = (v: number): Typed => ({ type: 'dimension', v, unit: 'px' });
const num = (v: number): Typed => ({ type: 'number', v, unit: '' });
const bool = (v: boolean): Typed => ({ type: 'boolean', v });
const str = (v: string): Typed => ({ type: 'string', v });

/** A number or dimension for arithmetic; booleans count as 1 / 0, as var(--open) does in CSS. */
function numeric(t: Typed): Typed {
  if (t.type === 'boolean') return num(t.v ? 1 : 0);
  if (t.type === 'number' || t.type === 'dimension') return t;
  throw new EvalError(`${serialize(t)} is not a number`);
}
const round6 = (v: number) => Math.round(v * 1e6) / 1e6;
const like = (t: Typed, v: number): Typed => (t.type === 'dimension' ? { type: 'dimension', v: round6(v), unit: t.unit } : num(round6(v)));

/**
 * Values in one unit: the first dimension's (CSS: a unitless 0 combines with any unit; other
 * numbers only with numbers). Returns the unit carrier and every value in its unit.
 */
function common(list: Typed[]): [Typed, number[]] {
  const ts = list.map(numeric);
  const carrier = ts.find((t) => t.type === 'dimension') ?? ts[0];
  return [carrier, ts.map((t) => {
    if (t.type === 'number') {
      if (carrier.type === 'dimension' && t.v !== 0) throw new EvalError(`cannot combine ${serialize(carrier)} and ${serialize(t)}: a dimension and a number`);
      return t.v as number;
    }
    const v = convert(carrier, t);
    if (v === undefined) throw new EvalError(`cannot combine ${serialize(carrier)} and ${serialize(t)}: incompatible units`);
    return v;
  })];
}

function arith(op: string, x: Typed, y: Typed): Typed {
  const a = numeric(x), b = numeric(y);
  if (op === '+' || op === '-') {
    const [u, [av, bv]] = common([a, b]);
    return like(u, op === '+' ? av + bv : av - bv);
  }
  if (op === '*') {
    if (a.type === 'dimension' && b.type === 'dimension') throw new EvalError(`cannot multiply ${serialize(a)} by ${serialize(b)}`);
    return like(a.type === 'dimension' ? a : b, (a.v as number) * (b.v as number));
  }
  if (b.v === 0) throw new EvalError('division by zero');
  if (b.type === 'number') return like(a, (a.v as number) / (b.v as number));
  if (a.type === 'number') throw new EvalError(`cannot divide ${serialize(a)} by ${serialize(b)}`);
  const [, [av, bv]] = common([a, b]);
  return num(round6(av / bv));
}

function rect(ctx: EvalCtx): DOMRect {
  if (ctx.drag) return ctx.drag.rect;
  const cache = (ctx.rects ??= new Map());
  let r = cache.get(ctx.el);
  if (!r) cache.set(ctx.el, (r = ctx.el.getBoundingClientRect()));
  return r;
}

function field(f: string, ctx: EvalCtx): Typed | undefined {
  const e = ctx.e as PointerEvent & KeyboardEvent;
  const d = ctx.drag;
  switch (f) {
    case 'type': return str(d ? 'drag' : e.type);
    case 'client-x': return px(e.clientX);
    case 'client-y': return px(e.clientY);
    case 'page-x': return px(e.pageX);
    case 'page-y': return px(e.pageY);
    case 'local-x': return px(e.clientX - rect(ctx).left);
    case 'local-y': return px(e.clientY - rect(ctx).top);
    case 'button': return num(e.button);
    case 'buttons': return num(e.buttons);
    case 'pointer-id': return 'pointerId' in e ? num(e.pointerId) : undefined;
    case 'pressure': return 'pressure' in e ? num(round6(e.pressure)) : undefined;
    case 'pointer-type': return 'pointerType' in e ? str(e.pointerType) : undefined;
    case 'alt-key': return bool(e.altKey);
    case 'ctrl-key': return bool(e.ctrlKey);
    case 'shift-key': return bool(e.shiftKey);
    case 'meta-key': return bool(e.metaKey);
    case 'key': return str(e.key);
    case 'code': return str(e.code);
    case 'repeat': return bool(e.repeat);
    case 'value': case 'value-as-number': case 'checked': {
      const t = e.target;
      if (!(t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement)) return undefined;
      if (f === 'checked') return t instanceof HTMLInputElement ? bool(t.checked) : undefined;
      if (sensitive(t)) return f === 'value' ? str('') : undefined; // never exposed to CSS
      if (f === 'value') return str(t.value);
      const n = t instanceof HTMLInputElement ? t.valueAsNumber : parseFloat(t.value);
      return Number.isFinite(n) ? num(n) : undefined;
    }
    case 'scroll-top': return px(ctx.el.scrollTop);
    case 'scroll-left': return px(ctx.el.scrollLeft);
  }
  if (!d) return undefined;
  switch (f) {
    case 'delta-x': return px(d.x - d.startX);
    case 'delta-y': return px(d.y - d.startY);
    case 'movement-x': return px(d.x - d.lastX);
    case 'movement-y': return px(d.y - d.lastY);
    case 'start-x': return px(d.startX);
    case 'start-y': return px(d.startY);
    case 'x': case 'y': {
      const c = ctx.target;
      if (!c) return undefined;
      let s = d.starts.get(c);
      if (!s) d.starts.set(c, (s = c.value));
      const delta = f === 'x' ? d.x - d.startX : d.y - d.startY;
      if (s.type === 'number') return num(round6((s.v as number) + delta));
      if (s.type === 'dimension' && s.unit === 'px') return px(round6((s.v as number) + delta));
      throw new EvalError(`event(${f}) moves a px or number state; ${c.name} holds ${serialize(s)}`);
    }
  }
  return undefined;
}

function siblingIndex(el: Element) {
  let n = 1;
  for (let s = el.previousElementSibling; s; s = s.previousElementSibling) n++;
  return n;
}

function list(n: Node, ctx: EvalCtx): Typed[] {
  if (n.k === 'split') {
    const s = value(n.of, ctx);
    if (!s) return [];
    if (s.type !== 'string') throw new EvalError('split() splits a string');
    return (s.v as string).split(n.sep).map((x) => x.trim()).filter(Boolean).map(str);
  }
  const v = value(n, ctx);
  return v ? [v] : [];
}

function size(n: Extract<Node, { k: 'size' }>, el: Element): Typed {
  if (n.of === 'viewport') return px(n.dim === 'width' ? innerWidth : innerHeight);
  if (el instanceof HTMLElement) return px(n.dim === 'width' ? el.offsetWidth : el.offsetHeight);
  const b = (el as SVGGraphicsElement).getBBox?.();
  return px(b ? (n.dim === 'width' ? b.width : b.height) : 0);
}

/** The value of `n` at this event; undefined when it has none (an empty pick(), a missing field). */
export function value(n: Node, ctx: EvalCtx): Typed | undefined {
  switch (n.k) {
    case 'lit': return n.t;
    case 'op': {
      const a = value(n.a, ctx), b = value(n.b, ctx);
      return a && b ? arith(n.op, a, b) : undefined;
    }
    case 'neg': { const a = value(n.a, ctx); return a && like(numeric(a), -(numeric(a).v as number)); }
    case 'math': {
      const vals = n.args.map((a) => value(a, ctx));
      if (vals.some((v) => !v)) return undefined;
      const all = vals as Typed[];
      if (n.fn === 'abs') { const a = numeric(all[0]); return like(a, Math.abs(a.v as number)); }
      const [u, v] = common(all);
      if (n.fn === 'clamp') return like(u, Math.max(v[0], Math.min(v[1], v[2])));
      return like(u, n.fn === 'min' ? Math.min(...v) : Math.max(...v));
    }
    case 'round': {
      const a = value(n.a, ctx);
      if (!a) return undefined;
      const x = numeric(a);
      const b = n.b ? value(n.b, ctx) : like(x, 1);
      if (!b) return undefined;
      const [u, [xv, step]] = common([x, b]);
      if (!step) throw new EvalError('round() needs a non-zero interval');
      const q = xv / step;
      const r = n.mode === 'up' ? Math.ceil(q) : n.mode === 'down' ? Math.floor(q) : n.mode === 'to-zero' ? Math.trunc(q) : Math.round(q);
      return like(u, r * step);
    }
    case 'var': {
      const c = resolveCell(ctx.el, n.name);
      if (c) return c.value;
      const raw = getComputedStyle(ctx.el).getPropertyValue(n.name).trim();
      if (raw) { try { return parseTyped(raw); } catch { throw new EvalError(`var(${n.name}) is "${raw.slice(0, 40)}", not a single value`); } }
      if (n.fallback) return value(n.fallback, ctx);
      throw new EvalError(`var(${n.name}): no state or custom property named ${n.name} applies to the element`);
    }
    case 'event': return field(n.field, ctx);
    case 'mouse': {
      const e = ctx.e as MouseEvent;
      const v = n.axis === 'x' ? e.clientX : e.clientY;
      return px(n.local ? v - (n.axis === 'x' ? rect(ctx).left : rect(ctx).top) : v);
    }
    case 'size': return size(n, ctx.el);
    case 'attr': {
      const raw = sensitive(ctx.el) ? null : ctx.el.getAttribute(n.name);
      const fb = n.fallback;
      if (raw === null) return fb ?? str('');
      if (!fb || fb.type === 'string') return str(raw);
      try {
        const t = parseTyped(raw);
        return t.type === fb.type ? t : fb;
      } catch { return fb; }
    }
    case 'pick': {
      const all = n.items.flatMap((x) => list(x, ctx));
      if (new Set(all.map((t) => t.type)).size > 1) throw new EvalError('pick() values must all have the same type');
      return all.length ? all[Math.floor(Math.random() * all.length)] : undefined;
    }
    case 'split': return undefined;
    case 'random': {
      const a = value(n.min, ctx), b = value(n.max, ctx);
      if (!a || !b) return undefined;
      const s = n.step ? value(n.step, ctx) : undefined;
      if (n.step && !s) return undefined;
      const [u, [min, max, step]] = common(s ? [a, b, s] : [a, b]);
      let v = min + Math.random() * Math.max(0, max - min);
      if (s) {
        if (!(step > 0)) return like(u, v); // CSS Values 5: a zero or negative step is ignored
        v = min + Math.floor(Math.random() * (Math.floor((max - min) / step + 1e-9) + 1)) * step;
      }
      return like(u, v);
    }
    case 'sibling': return num(n.count ? ctx.el.parentElement?.childElementCount ?? 1 : siblingIndex(ctx.el));
  }
}

/** Evaluates with one diagnostic per problem; undefined means "no write". */
export function evaluateAction(n: Node, ctx: EvalCtx, where: () => string): Typed | undefined {
  try { return value(n, ctx); } catch (e) {
    if (!(e instanceof EvalError)) throw e;
    warn(`${where()}: ${e.message}. Nothing is changed.`);
    return undefined;
  }
}

export { fmt };
