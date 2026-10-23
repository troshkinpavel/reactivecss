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
    if (!n || (n.unit !== unit && !(n.unit === '' && n.v === 0)))
      throw new Error(/^m?s$/.test(n?.unit ?? '') && unit !== 's' && unit !== 'ms'
        ? `step "${step}" must use the same unit as min and max; a third argument is a step, never an update interval: to re-roll over time use live(random(...), 2s)`
        : `step "${step}" must use the same unit as min and max`);
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

interface RandomData { shared: boolean; first: number; step?: string; range?: Range; sharedValue?: string; by?: boolean }

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

/** The browser parses this exact random() call natively in some property (no user-agent sniffing). */
const nativeSupports = (call: string) => typeof CSS !== 'undefined' && ['width', 'opacity', 'rotate', 'transition-duration', 'z-index'].some((p) => CSS.supports(p, call));
/**
 * Sharing keys of native random() (CSS Values 5, 2026 draft). Reactive CSS implements none of them;
 * element-shared (an earlier draft's keyword) and auto are its own.
 */
const NATIVE_KEY = /^(element-scoped|property-scoped|--[\w-]+|fixed\b)/;
const text = (args: Arg[]) => `random(${args.map((a) => a.text).join(', ')})`;

defineFunction({
  name: 'random',
  kind: 'generator',
  // Native-first (0.9.0 hardening): a call that uses native-only syntax (a sharing key such as
  // --name, element-scoped, property-scoped or fixed) and that the browser supports is not claimed:
  // it stays native CSS, with no diagnostic.
  matches(argText) {
    return !(NATIVE_KEY.test(argText.trim().toLowerCase()) && nativeSupports(`random(${argText})`));
  },
  compile(args): RandomData {
    let first = 0;
    let shared = false;
    const head = args[0]?.text.toLowerCase() ?? '';
    if (args.length > 2 && isStatic(args[0]) && (/^(auto|element-shared)$/.test(head) || NATIVE_KEY.test(head))) {
      if (NATIVE_KEY.test(head))
        throw new Error(`"${args[0].text}" needs native random() support, which this browser lacks; Reactive CSS supports auto and element-shared`);
      shared = head === 'element-shared';
      first = 1;
    }
    const rest = args.length - first;
    if (rest < 2 || rest > 3) throw new Error('expected random(min, max), random(min, max, step) or random(min, max, by step)');
    let step: string | undefined;
    let by = false;
    if (rest === 3) {
      // "by <step>" (an earlier draft, kept) or a plain step (CSS Values 5): the same meaning.
      // Native random() uses the third argument for steps; it is never an update interval.
      if (!isStatic(args[first + 2])) throw new Error('the step must be a value. To re-roll over time use live(random(...), 2s)');
      const m = /^by\s+(.+)$/i.exec(args[first + 2].text);
      by = !!m;
      step = m ? m[1] : args[first + 2].text;
      const n = parseNumber(step);
      if (!by && n && n.v <= 0) step = undefined; // CSS Values 5: a zero or negative step is ignored
    }
    const [min, max] = [args[first], args[first + 1]];
    let range: Range | undefined;
    if (isStatic(min) && isStatic(max)) {
      randomValue(min.text, max.text, step, 0); // validates
      range = numericRange(min.text, max.text, step); // parsed once, reused for every roll
      if (range && range.max < range.min) warn(`random(${min.text}, ${max.text}): max is below min, so the result is always min.`);
    }
    return { shared, first, step, range, by };
  },
  // Native-first: a top-level call that the browser supports as written, with per-element values,
  // is left to the browser (any units, a plain step). No binding, no JS at runtime. Nested calls
  // (live(), on()) need re-rolling, element-shared and "by" are Reactive CSS syntax: runtime.
  native(args, d: RandomData, nested) {
    if (nested || d.shared || d.by || !nativeRandomIsPerElement()) return undefined;
    const call = text(args);
    return nativeSupports(call) ? call : undefined;
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
