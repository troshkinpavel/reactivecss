// 0.10: value functions (strings). One definition makes a function available in three places, all
// evaluated by the 0.9 action expression language (state/actexpr.ts), so typing, units and
// errors are the same everywhere:
//   - :on() actions        .f:on(input) { --q: set(trim(event(value))) }
//   - conditions            .card:when(includes(lower(attr(data-name)), lower(--q)))
//   - declarations          .count { text: length(trim(--value)) }
// In their arguments `--name` reads a state, as in :when().

import { defineFunction, type Ctx, type Instance } from '../core/registry';
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

const names = (conditionCalls.names ??= new Set());
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
