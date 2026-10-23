// live(expr, interval): re-evaluates `expr` every interval on the shared scheduler.

import { defineFunction, type ArgInstance, type Ctx, type Instance } from '../core/registry';
import { every, unevery } from '../core/scheduler';
import { warn } from '../core/log';

export const DEFAULT_INTERVAL = 1000;
export const MIN_INTERVAL = 50;

export function parseTime(s: string): number | undefined {
  const m = /^(\d*\.?\d+)(ms|s)$/i.exec(s.trim());
  return m ? +m[1] * (m[2].toLowerCase() === 's' ? 1000 : 1) : undefined;
}

defineFunction({
  name: 'live',
  kind: 'operator',
  compile(args) {
    if (args.length < 1 || args.length > 2) throw new Error('expected live(expression) or live(expression, interval)');
    if (args.length === 1) return DEFAULT_INTERVAL;
    const t = args[1].parts.length === 1 && typeof args[1].parts[0] === 'string' ? parseTime(args[1].text) : undefined;
    if (t === undefined) throw new Error(`interval "${args[1].text}" must be a time like 500ms or 2s`);
    if (t < MIN_INTERVAL) {
      warn(`live(): interval ${args[1].text} is below the ${MIN_INTERVAL}ms minimum; using ${MIN_INTERVAL}ms.`);
      return MIN_INTERVAL;
    }
    return t;
  },
  create: (ctx, args, ms: number) => new LiveInstance(ctx, args, ms),
});

/** Subscribes itself to the shared interval group: no closure, no timer per element. */
class LiveInstance implements Instance {
  constructor(readonly ctx: Ctx, readonly args: ArgInstance[], readonly ms: number) { every(ms, this); }
  tick() {
    this.args[0].reset?.(); // random()/pick() inside re-roll, per element
    this.ctx.notify();
  }
  get() { return this.args[0].get(); }
  dispose() { unevery(this.ms, this); }
}
