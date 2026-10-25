// when(condition, a, b) and :when(condition): CSS that depends on state.

import { defineFunction, defineSelector, type ArgInstance, type Ctx, type Instance } from '../core/registry';
import { dirty, settleLater, type Job } from '../core/scheduler';
import { watch, unwatch, type Watcher } from '../core/elements';
import { warn } from '../core/log';
import { config } from '../core/config';
import { StateRef, type Subscriber } from './state';
import { parseCondition, evaluate, ConditionError, type Condition, type Cond } from './values';

// ---- native if() for when() ---------------------------------------------------------------
// when(c, a, b) becomes `if(T(c): a; F(c): b)` with separate truth and falsity style queries,
// which keeps three-valued logic: with neither true nor false (missing state) there is no
// value, exactly like the runtime. Only bare boolean state references with and / or / not
// qualify: a boolean state serializes to 1 / 0 on its owner and the custom property inherits,
// so the element's value is the nearest owner's. Comparisons and history use the runtime.

let nativeIf: boolean | undefined;
function supportsNativeIf() {
  if (config().native === false) return false;
  return (nativeIf ??= typeof CSS !== 'undefined' &&
    CSS.supports('width', 'if((style(--a: 1) and not style(--b: 0)): 1px; style(--a: 0): 2px)'));
}

const booleanOnly = (c: Cond): boolean =>
  c.k === 'ref' || (c.k === 'not' && booleanOnly(c.a)) || ((c.k === 'and' || c.k === 'or') && booleanOnly(c.a) && booleanOnly(c.b));

/** Style-query expression that is true exactly when `c` is true (want = true) or false (want = false). */
function query(c: Cond, want: boolean): string {
  switch (c.k) {
    case 'ref': return `style(${c.name}: ${want ? 1 : 0})`;
    case 'not': return query(c.a, !want);
    case 'and': case 'or': {
      const both = (c.k === 'and') === want; // T(and) / F(or) need both sides
      return `(${query((c as any).a, want)} ${both ? 'and' : 'or'} ${query((c as any).b, want)})`;
    }
    default: throw new Error('not native');
  }
}

/** Native if() text for when(), or undefined to use the runtime. */
export function nativeWhen(cond: Condition, branches: string[]): string | undefined {
  if (!booleanOnly(cond.ast) || branches.some((b) => /[;{}]/.test(b)) || !supportsNativeIf()) return undefined;
  const t = `${query(cond.ast, true)}: ${branches[0]}`;
  return branches.length > 1 ? `if(${t}; ${query(cond.ast, false)}: ${branches[1]})` : `if(${t})`;
}

/** Evaluates a condition for one element; undefined = unknown (missing state or type error). */
function check(cond: Condition, refs: StateRef[]): boolean | undefined {
  try {
    return evaluate(cond.ast, (name) => refs[cond.names.indexOf(name)].state());
  } catch (e) {
    if (!(e instanceof ConditionError)) throw e;
    warn(`${e.message} (in "${cond.text}"). The condition counts as unknown: when() gives no value, :when() does not match.`);
    return undefined;
  }
}

const refsFor = (cond: Condition, el: Element, sub: Subscriber) => cond.names.map((n) => new StateRef(el, n, sub));

defineFunction({
  name: 'when',
  kind: 'condition',
  syntax: 'when(condition, value-if-true?, value-if-false?)',
  rawArgs: [0], // the condition has its own grammar (previous(), direction() are operands there)
  compile(args) {
    if (args.length > 3) throw new Error('expected when(condition, value-if-true, value-if-false)');
    return parseCondition(args[0].text);
  },
  native(args, cond: Condition, nested) {
    if (nested || args.slice(1).some((a) => a.parts.some((p) => typeof p !== 'string'))) return undefined;
    return nativeWhen(cond, args.length > 1 ? args.slice(1).map((a) => a.text) : ['true', 'false']);
  },
  create: (ctx, args, cond: Condition) => new WhenValue(ctx, args, cond),
});

/**
 * Re-evaluated only when one of its own state cells changes. An unknown condition gives no
 * value: the generated var() is unset, so the property behaves as if the declaration were
 * invalid (`unset`), which is visible and never silently "false".
 */
class WhenValue implements Instance {
  refs: StateRef[];
  constructor(ctx: Ctx, readonly args: ArgInstance[], readonly cond: Condition) {
    this.refs = refsFor(cond, ctx.el, ctx);
  }
  get() {
    const r = check(this.cond, this.refs);
    if (r === undefined) return '';
    if (this.args.length === 1) return r ? 'true' : 'false'; // when(condition) alone: a boolean
    return r ? this.args[1].get() : (this.args[2]?.get() ?? '');
  }
  dispose() { for (const r of this.refs) r.dispose(); }
}

/** One element that a :when() rule may apply to: toggles a private marker attribute. */
class WhenMatch implements Job, Subscriber {
  queued?: boolean;
  on?: boolean;
  dead = false;
  refs: StateRef[];
  constructor(readonly el: Element, readonly cond: Condition, readonly attr: string) {
    this.refs = refsFor(cond, el, this);
    settleLater(this);
  }
  notify() { if (!this.dead) dirty(this); }
  compute() {
    if (this.dead) return false;
    const on = check(this.cond, this.refs) === true;
    if (on === this.on) return false;
    this.on = on;
    return true;
  }
  write() { this.el.toggleAttribute(this.attr, this.on); }
  dispose() {
    this.dead = true;
    for (const r of this.refs) r.dispose();
    this.el.removeAttribute(this.attr);
  }
}

let counter = 0;
defineSelector({
  name: 'when',
  kind: 'state',
  functional: true,
  syntax: ':when(condition)',
  compile(arg, compound, sheet) {
    const cond = parseCondition(arg);
    if (!compound.replace(/:is\(\*\)/g, '').trim())
      throw new Error(':when() needs a type, class or attribute selector on the same element, e.g. .card:when(--active)');
    const attr = `data-rcss-when-${counter++}`;
    sheet.setup.push(() => {
      const matches = new WeakMap<Element, WhenMatch>();
      const w: Watcher = {
        selector: compound,
        add: (el) => { matches.set(el, new WhenMatch(el, cond, attr)); },
        remove: (el) => { matches.get(el)?.dispose(); matches.delete(el); },
        // Moved inside the document: the nearest owner of its states may be another one now.
        move: (el) => { for (const r of matches.get(el)?.refs ?? []) r.invalidate(); },
      };
      watch(w);
      return () => unwatch(w);
    });
    return `[${attr}]`; // same specificity as one pseudo-class
  },
});
