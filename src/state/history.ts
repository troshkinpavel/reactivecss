// previous(--x) and direction(--x) as values (history feature). As condition operands they are core
// (the condition grammar in values.ts); :changed() is in changed.ts.

import { defineFunction, type Ctx, type Instance } from '../core/registry';
import { warn } from '../core/log';
import { StateRef } from './state';
import { ConditionError, direction, serialize } from './values';

const stateArg = (fn: string) => (args: { text: string }[]) => {
  if (args.length !== 1 || !/^--[^\s,()]+$/.test(args[0].text)) throw new Error(`expected ${fn}(--state)`);
  return args[0].text;
};

/** The value before the last effective change (the initial value until the first change). */
defineFunction({
  name: 'previous',
  kind: 'source',
  syntax: 'previous(--state)',
  compile: stateArg('previous'),
  create: (ctx, _args, name: string) => new HistoryValue(ctx, name, false),
});

/** 1, 0 or -1: whether the last change of a number or dimension state went up or down. */
defineFunction({
  name: 'direction',
  kind: 'source',
  syntax: 'direction(--state)',
  compile: stateArg('direction'),
  create: (ctx, _args, name: string) => new HistoryValue(ctx, name, true),
});

class HistoryValue implements Instance {
  ref: StateRef;
  constructor(ctx: Ctx, readonly name: string, readonly dir: boolean) { this.ref = new StateRef(ctx.el, name, ctx); }
  get() {
    const s = this.ref.state();
    if (!s) return '';
    if (!this.dir) return serialize(s.previous);
    try { return serialize(direction(s, this.name)); } catch (e) {
      if (!(e instanceof ConditionError)) throw e;
      warn(e.message);
      return '';
    }
  }
  dispose() { this.ref.dispose(); }
}
