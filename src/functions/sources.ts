// Reactive sources: on(), mouse(), visible(), and the native viewport().

import { defineFunction, runtimeStats, type Arg, type ArgInstance, type Ctx, type Instance, type SharedSource } from '../core/registry';
import { frame } from '../core/scheduler';
import { fmt } from '../core/format';
import { dev, probes } from '../core/log';

const word = (a: Arg | undefined) => (a && a.parts.length <= 1 ? a.text.toLowerCase() : undefined);

// ---- on(event, expr) -----------------------------------------------------------

export const EVENTS = new Set([
  'click', 'dblclick', 'contextmenu', 'pointerenter', 'pointerleave', 'pointerdown', 'pointerup',
  'mouseenter', 'mouseleave', 'focus', 'blur', 'focusin', 'focusout', 'input', 'change',
  'keydown', 'keyup', 'animationend', 'animationiteration', 'transitionend', 'toggle',
]);

defineFunction({
  name: 'on',
  kind: 'event',
  compile(args) {
    if (args.length !== 2) throw new Error('expected on(event, expression)');
    const ev = word(args[0]);
    if (!ev || !EVENTS.has(ev)) throw new Error(`unsupported event "${args[0].text}". Supported: ${[...EVENTS].join(', ')}`);
    return ev;
  },
  // Evaluates once when bound, then again on every event on the element itself.
  create: (ctx, args, ev: string) => new OnInstance(ctx, args, ev),
});

/** The instance is its own listener (handleEvent), so no closure per element. */
class OnInstance implements Instance {
  constructor(readonly ctx: Ctx, readonly args: ArgInstance[], readonly ev: string) {
    ctx.el.addEventListener(ev, this, { passive: true });
    runtimeStats.sources++;
  }
  handleEvent() {
    this.args[1].reset?.();
    this.ctx.notify();
  }
  get() { return this.args[1].get(); }
  dispose() {
    this.ctx.el.removeEventListener(this.ev, this);
    runtimeStats.sources--;
  }
}

// ---- mouse(x | y, viewport | local) ---------------------------------------------
// One pointermove listener for the page. Each axis is a SharedSource: it formats its value
// once per change and notifies only its own subscribers, and only when that axis changed.

const pointer = { x: 0, y: 0 };
let listeners = 0;

class PointerAxis implements SharedSource {
  subs = new Set<{ notify(): void }>();
  text?: string;
  changed = false;
  constructor(readonly axis: 'x' | 'y') {}
  get() { return (this.text ??= fmt(pointer[this.axis]) + 'px'); }
  subscribe(s: { notify(): void }) {
    if (this.subs.has(s)) return;
    this.subs.add(s);
    if (listeners++ === 0) { addEventListener('pointermove', onMove, { passive: true }); runtimeStats.observers++; }
    runtimeStats.sources++;
  }
  unsubscribe(s: { notify(): void }) {
    if (!this.subs.delete(s)) return;
    if (--listeners === 0) { removeEventListener('pointermove', onMove); runtimeStats.observers--; }
    runtimeStats.sources--;
  }
}

const axes = { x: new PointerAxis('x'), y: new PointerAxis('y') };

function notifyPointer() {
  for (const a of [axes.x, axes.y]) {
    if (!a.changed) continue;
    a.changed = false;
    for (const s of a.subs) s.notify();
  }
}

function onMove(e: PointerEvent) {
  for (const a of [axes.x, axes.y]) {
    const v = a.axis === 'x' ? e.clientX : e.clientY;
    if (v === pointer[a.axis]) continue;
    pointer[a.axis] = v;
    a.text = undefined;
    a.changed = true;
  }
  if (axes.x.changed || axes.y.changed) frame(notifyPointer); // at most one update per frame
}

interface MouseData { axis: 'x' | 'y'; local: boolean }

defineFunction({
  name: 'mouse',
  kind: 'source',
  compile(args): MouseData {
    const axis = word(args[0]);
    const mode = args.length > 1 ? word(args[1]) : 'viewport';
    if (args.length > 2 || (axis !== 'x' && axis !== 'y')) throw new Error('expected mouse(x) or mouse(y), optionally with "viewport" or "local"');
    if (mode !== 'viewport' && mode !== 'local') throw new Error(`unknown coordinate mode "${args[1].text}"; use viewport or local`);
    return { axis, local: mode === 'local' };
  },
  // Viewport coordinates are identical for every element: share one computation and write.
  shared: (d: MouseData) => (d.local ? undefined : axes[d.axis]),
  // Used for local mode, and for viewport mode nested inside another function.
  create: (ctx, _args, d: MouseData) => new MouseInstance(ctx, d),
});

class MouseInstance implements Instance {
  constructor(readonly ctx: Ctx, readonly d: MouseData) { axes[d.axis].subscribe(this); }
  notify() { this.ctx.notify(); }
  get() {
    const a = axes[this.d.axis];
    if (!this.d.local) return a.get();
    // Runs in the scheduler's read phase, before any writes of the same frame.
    const r = this.ctx.el.getBoundingClientRect();
    return fmt(pointer[this.d.axis] - (this.d.axis === 'x' ? r.left : r.top)) + 'px';
  }
  dispose() { axes[this.d.axis].unsubscribe(this); }
}

// ---- visible(threshold) ----------------------------------------------------------

interface VisibilitySub { update(visible: boolean): void }
interface Shared { io: IntersectionObserver; subs: Map<Element, Set<VisibilitySub>> }
const observers = new Map<number, Shared>();
if (dev) Object.assign(probes, { pointerListeners: () => listeners, intersectionObservers: () => observers.size });

function observeVisibility(el: Element, threshold: number, sub: VisibilitySub) {
  let s = observers.get(threshold);
  if (!s) {
    const subs: Shared['subs'] = new Map();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const visible = e.isIntersecting && e.intersectionRatio >= threshold;
        subs.get(e.target)?.forEach((f) => f.update(visible));
      }
    }, { threshold: threshold || 0 });
    observers.set(threshold, (s = { io, subs }));
    runtimeStats.observers++;
  }
  let set = s.subs.get(el);
  if (!set) { s.subs.set(el, (set = new Set())); s.io.observe(el); }
  set.add(sub);
}

function unobserveVisibility(el: Element, threshold: number, sub: VisibilitySub) {
  const s = observers.get(threshold);
  const set = s?.subs.get(el);
  if (!s || !set?.delete(sub) || set.size) return;
  s.subs.delete(el);
  s.io.unobserve(el);
  if (!s.subs.size) { s.io.disconnect(); observers.delete(threshold); runtimeStats.observers--; }
}

defineFunction({
  name: 'visible',
  kind: 'source',
  compile(args) {
    if (args.length > 1) throw new Error('expected visible() or visible(<number between 0 and 1>)');
    if (!args.length) return 0;
    const t = Number(word(args[0]));
    if (!(t >= 0 && t <= 1)) throw new Error(`threshold "${args[0].text}" must be a number between 0 and 1`);
    return t;
  },
  // 0 until the browser reports the element as visible (at least `threshold` of it), then 1.
  create: (ctx, _args, threshold: number) => new VisibleInstance(ctx, threshold),
});

class VisibleInstance implements Instance, VisibilitySub {
  visible = false;
  constructor(readonly ctx: Ctx, readonly threshold: number) {
    observeVisibility(ctx.el, threshold, this);
    runtimeStats.sources++;
  }
  update(v: boolean) {
    if (v === this.visible) return;
    this.visible = v;
    this.ctx.notify();
  }
  get() { return this.visible ? '1' : '0'; }
  dispose() {
    unobserveVisibility(this.ctx.el, this.threshold, this);
    runtimeStats.sources--;
  }
}

// ---- viewport(width | height) -----------------------------------------------------

defineFunction({
  name: 'viewport',
  kind: 'native',
  compile(args) {
    const v = word(args[0]);
    if (args.length !== 1 || (v !== 'width' && v !== 'height')) throw new Error('expected viewport(width) or viewport(height)');
    return v;
  },
  // Dynamic viewport units track window.innerWidth / innerHeight natively: no runtime needed.
  native: (_args, v: string) => (v === 'width' ? '100dvw' : '100dvh'),
});
