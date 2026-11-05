// 0.10: value functions (strings). One definition makes a function available in three places, all
// evaluated by the 0.9 action expression language (state/actexpr.ts), so typing, units and
// errors are the same everywhere:
//   - :on() actions        .f:on(input) { --q: set(trim(event(value))) }
//   - conditions            .card:when(includes(lower(attr(data-name)), lower(--q)))
//   - declarations          .count { text: length(trim(--value)) }
// In their arguments `--name` reads a state, as in :when().

import { defineFunction, runtimes, type Ctx, type Instance } from '../core/registry';
import { warn } from '../core/log';
import { actionFns, parseAction, value, EvalError, type ActionFn, type Node } from '../state/actexpr';
import { conditionCalls, ConditionError, serialize, type Typed } from '../state/values';
import { StateRef } from '../state/state';

/** State names a parsed expression reads (var(--x) and bare --x). */
function refsOf(n: unknown, out = new Set<string>()): string[] {
  if (Array.isArray(n)) for (const x of n) refsOf(x, out);
  else if (n && typeof n === 'object') {
    const node = n as Node;
    if (node.k === 'var') out.add(node.name);
    for (const v of Object.values(node)) if (v && typeof v === 'object') refsOf(v, out);
  }
  return [...out];
}

const names = new Set<string>();

let callTest: { size: number; re: RegExp } | undefined;
/** Whether `text` may contain a call of `names` (a cheap test, so conditions without calls skip the scan below). */
function hasCall(text: string): boolean {
  if (!text.includes('(')) return false;
  if (callTest?.size !== names.size) callTest = { size: names.size, re: new RegExp(`(?:^|[^\\w-])(?:${[...names].join('|')})\\(`, 'i') };
  return callTest.re.test(text);
}

/** Replaces each call of `names` (outside strings) with a placeholder token \x00<n>, kept in `out`. */
function extractCalls(text: string, out: string[]): string {
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

conditionCalls.extract = (text, out) => (hasCall(text) ? extractCalls(text, out) : text);
conditionCalls.parse = (text) => {
  const node = parseAction(text, 'none', ':when()');
  return { node, names: refsOf(node) };
};
conditionCalls.evaluate = (node, el) => {
  try { return value(node as Node, { el }); } catch (e) {
    if (e instanceof EvalError) throw new ConditionError(e.message);
    throw e;
  }
};

/** Value functions called in text the expression language parses (compile().uses). */
let usesRe: { size: number; re: RegExp } | undefined;
runtimes.valueCalls = (s, use) => {
  if (!s.includes('(')) return;
  if (usesRe?.size !== names.size) usesRe = { size: names.size, re: new RegExp(`(?<![\\w-])(${[...names].join('|')})\\(`, 'g') };
  for (const m of s.matchAll(usesRe.re)) use('fn:' + m[1]);
};

interface Compiled { node: Node; names: string[]; text: string }

/** A call in a declaration: re-evaluated when one of its states changes (StateRef notifies the binding). */
class ExprInstance implements Instance {
  refs: StateRef[];
  private reported?: string;
  constructor(readonly ctx: Ctx, readonly c: Compiled) {
    // optional: var() may also read an ordinary custom property (no subscription, no warning)
    this.refs = c.names.map((n) => new StateRef(ctx.el, n, ctx, true));
  }
  get() {
    for (const r of this.refs) r.state(); // resolve (and subscribe) before evaluating
    try {
      const v = value(this.c.node, { el: this.ctx.el });
      this.reported = undefined;
      return v ? serialize(v) : '';
    } catch (e) {
      if (!(e instanceof EvalError)) throw e;
      // Inside live() it is re-evaluated on every tick: report each distinct problem once.
      if (this.reported !== e.message) warn(`${this.c.text}: ${e.message}. No value.`);
      this.reported = e.message;
      return '';
    }
  }
  dispose() { for (const r of this.refs) r.dispose(); }
}

/** Registers `name` as an action function, a condition operand and a declaration function. */
export function valueFunction(name: string, syntax: string, fn: ActionFn) {
  actionFns.set(name, fn);
  names.add(name);
  defineFunction({
    name,
    kind: 'source',
    syntax,
    value: true,
    rawArgs: [0, 1, 2, 3, 4, 5, 6, 7], // the whole call is parsed by the expression language
    compile(args): Compiled {
      const text = `${name}(${args.map((a) => a.text).join(', ')})`;
      const node = parseAction(text, 'none', `${name}()`);
      return { node, names: refsOf(node), text };
    },
    create: (ctx, _args, c: Compiled) => new ExprInstance(ctx, c),
  });
}

/** Text of a string or keyword argument; anything else is an EvalError naming the function. */
export function text(t: Typed, fn: string): string {
  if (t.type === 'string' || t.type === 'value') return t.v as string;
  throw new EvalError(`${fn}() takes text, not ${serialize(t)} (${t.type})`);
}
