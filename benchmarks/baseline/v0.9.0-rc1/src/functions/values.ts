// Value generators: random() and pick().

import { defineFunction, type Arg, type ArgInstance, type Instance } from '../core/registry';
import { warn } from '../core/log';

const NUMBER = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([a-z%]*)$/i;

interface Num { v: number; unit: string }

export function parseNumber(s: string): Num | undefined {
  const m = NUMBER.exec(s.trim());
  return m ? { v: +m[1], unit: m[2].toLowerCase() } : undefined;
}

import { fmt } from '../core/format';
export { fmt };

const isStatic = (a: Arg) => a.parts.every((p) => typeof p === 'string');

/** Same-unit numeric range, or undefined when min/max need calc() (mixed units, var()...). */
function numericRange(min: string, max: string, step?: string) {
  const a = parseNumber(min);
  const b = parseNumber(max);
  if (!a || !b) return undefined;
  // A unitless 0 takes the other side's unit, as in `random(0, 10px)`.
  const unit = a.unit === b.unit ? a.unit : a.v === 0 && !a.unit ? b.unit : b.v === 0 && !b.unit ? a.unit : undefined;
  if (unit === undefined) return undefined;
  let s: number | undefined;
  if (step !== undefined) {
    const n = parseNumber(step);
    if (!n || (n.unit !== unit && !(n.unit === '' && n.v === 0))) throw new Error(`step "${step}" must use the same unit as min and max`);
    if (n.v <= 0) throw new Error('step must be greater than 0');
    s = n.v;
  }
  return { min: a.v, max: b.v, step: s, unit };
}

/** CSS Values 5 random(): uniform in [min, max], or a multiple of `by` step above min. */
export function randomValue(min: string, max: string, step: string | undefined, r: number): string {
  const n = numericRange(min, max, step);
  if (n) return fromRange(n, r);
  if (step !== undefined) throw new Error('`by` steps need min and max as plain numbers in one unit');
  // Different units, var(), calc(): let the browser do the arithmetic.
  return `calc(${min} + (${max} - ${min}) * ${fmt(r)})`;
}

type Range = NonNullable<ReturnType<typeof numericRange>>;

function fromRange(n: Range, r: number): string {
  let v = n.min;
  if (n.max > n.min) {
    v = n.step
      ? n.min + Math.floor(r * (Math.floor((n.max - n.min) / n.step + 1e-9) + 1)) * n.step
      : n.min + r * (n.max - n.min);
  }
  return fmt(v) + n.unit;
}

interface RandomData { shared: boolean; first: number; step?: string; range?: Range; sharedValue?: string }

let perElementNative: boolean | undefined;
/**
 * True when the browser implements random() with per-element values, as Reactive CSS
 * does. CSS.supports() alone is not enough: earlier drafts shared one value across
 * elements, so two probe elements must get different values.
 */
function nativeRandomIsPerElement(): boolean {
  if (perElementNative !== undefined) return perElementNative;
  perElementNative = false;
  if (typeof CSS === 'undefined' || typeof document === 'undefined' || !CSS.supports('width', 'random(0px, 1px)')) return false;
  const probe = document.createElement('div');
  probe.style.setProperty('display', 'none'); // computed values still resolve; measured 2x cheaper than a hidden box
  // CSSOM, not style="" attributes, so a CSP with style-src-attr is neither violated nor fooled.
  for (let i = 0; i < 2; i++) {
    const c = probe.appendChild(document.createElement('i'));
    c.style.setProperty('display', 'block');
    c.style.setProperty('width', 'random(0px, 1000000px)');
  }
  document.documentElement.append(probe);
  const [a, b] = [...probe.children].map((e) => getComputedStyle(e).width);
  probe.remove();
  return (perElementNative = a !== b);
}

/** A property that accepts values of `unit`, to ask CSS.supports() about this exact call. */
const PROBE: Record<string, string> = { '': 'opacity', deg: 'rotate', turn: 'rotate', rad: 'rotate', grad: 'rotate', s: 'transition-duration', ms: 'transition-duration' };

defineFunction({
  name: 'random',
  kind: 'generator',
  compile(args): RandomData {
    let first = 0;
    let shared = false;
    const head = args[0]?.text.toLowerCase() ?? '';
    if (args.length > 2 && isStatic(args[0]) && /^(auto|element-shared|--|fixed\b)/.test(head)) {
      if (head.startsWith('--') || head.startsWith('fixed'))
        throw new Error(`"${args[0].text}" (named or fixed random values) is not supported yet`);
      shared = head === 'element-shared';
      first = 1;
    }
    const rest = args.length - first;
    if (rest < 2 || rest > 3) throw new Error('expected random(min, max) or random(min, max, by step)');
    let step: string | undefined;
    if (rest === 3) {
      const m = /^by\s+(.+)$/i.exec(args[first + 2].text);
      // Native random() uses the third argument for steps; it is never an update interval.
      if (!m || !isStatic(args[first + 2])) throw new Error('the third argument must be "by <step>". To re-roll over time use live(random(...), 2s)');
      step = m[1];
    }
    const [min, max] = [args[first], args[first + 1]];
    let range: Range | undefined;
    if (isStatic(min) && isStatic(max)) {
      randomValue(min.text, max.text, step, 0); // validates
      range = numericRange(min.text, max.text, step); // parsed once, reused for every roll
      if (range && range.max < range.min) warn(`random(${min.text}, ${max.text}): max is below min, so the result is always min.`);
    }
    return { shared, first, step, range };
  },
  // Native fast path: a top-level random(min, max) with literal, same-unit bounds is left to
  // the browser when it has per-element native random(). No binding, no JS at runtime.
  // Nested calls (live(), on()) need re-rolling, so they always use the runtime.
  native(args, d: RandomData, nested) {
    if (nested || d.shared || d.step || !d.range || !nativeRandomIsPerElement()) return undefined;
    const call = `random(${args[d.first].text}, ${args[d.first + 1].text})`;
    return CSS.supports(PROBE[d.range.unit] ?? 'width', call) ? call : undefined;
  },
  create: (_ctx, args, d: RandomData) => new RandomInstance(args, d),
});

class RandomInstance implements Instance {
  value?: string;
  constructor(readonly args: ArgInstance[], readonly d: RandomData) {}
  roll() {
    const d = this.d;
    return d.range
      ? fromRange(d.range, Math.random())
      : randomValue(this.args[d.first].get(), this.args[d.first + 1].get(), d.step, Math.random());
  }
  // element-shared: one value for every element, never re-rolled.
  get() { return this.d.shared ? (this.d.sharedValue ??= this.roll()) : (this.value ??= this.roll()); }
  reset() { this.value = undefined; }
}

class PickInstance implements Instance {
  index = -1;
  constructor(readonly args: ArgInstance[]) {}
  get() {
    if (this.index < 0) this.index = Math.floor(Math.random() * this.args.length);
    return this.args[this.index].get();
  }
  reset() { this.index = -1; }
}

defineFunction({
  name: 'pick',
  kind: 'generator',
  compile(args) {
    if (args.length === 0) throw new Error('expected at least one value');
  },
  create: (_ctx, args) => new PickInstance(args),
});
