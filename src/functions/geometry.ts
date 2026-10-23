// element(width | height): the element's own border-box size, in px.
//
// - One ResizeObserver (box: 'border-box') for every element that uses element(); values come
//   from its entries, never from getBoundingClientRect(), so no layout is forced.
// - Physical width/height: inline/block sizes are swapped for vertical writing modes (read once
//   per element when it starts being observed).
// - No value until the first measurement. The browser delivers it before the element's first paint;
//   the value is written in the next flush, so one frame renders with the var() fallback.
//   display: none elements measure 0px.
// - Context-aware: only element(width) and element(height) are Reactive CSS; the standard
//   element(#id) image function (CSS Images 4) is left to the browser.
// - Feedback guard: `width: calc(element(width) + 10px)` would grow forever. When a size keeps
//   changing in the same direction every frame right after its own value was written, writes
//   pause for two frames. If the size then keeps changing, something else drives it (a
//   transition, a drag) and updates resume; if it stops, it was a loop: the value freezes and a
//   warning names the element.

import { defineFunction, runtimeStats, type Ctx, type Instance } from '../core/registry';
import { frame } from '../core/scheduler';
import { warn, dev, probes } from '../core/log';
import { fmt } from '../core/format';
import { describeElement } from '../state/state';

type Axis = 'width' | 'height';

/** One record per observed element: its last size and the instances that read it. */
interface Subject { subs: Set<SizeInstance>; vertical: boolean; width: number; height: number; measured: boolean }

// One Map lookup per entry and no allocation per entry (profiled: the former size objects,
// WeakMap reads/writes and forEach closures were most of the script time above a plain RO).
const subjects = new Map<Element, Subject>();
let ro: ResizeObserver | undefined;
if (dev) probes.sizeSubjects = () => subjects.size;

function onResize(entries: ResizeObserverEntry[]) {
  for (const e of entries) {
    const s = subjects.get(e.target);
    if (!s) continue;
    const box = e.borderBoxSize?.[0];
    const inline = box ? box.inlineSize : e.contentRect.width;
    const block = box ? box.blockSize : e.contentRect.height;
    const first = !s.measured, pw = s.width, ph = s.height;
    s.width = s.vertical ? block : inline;
    s.height = s.vertical ? inline : block;
    s.measured = true;
    for (const i of s.subs) i.measured(first ? undefined : i.axis === 'width' ? pw : ph);
  }
}

function observe(el: Element, i: SizeInstance): Subject {
  if (!ro) { ro = new ResizeObserver(onResize); runtimeStats.observers++; }
  let s = subjects.get(el);
  if (!s) {
    subjects.set(el, (s = { subs: new Set(), vertical: /^(vertical|sideways)/.test(getComputedStyle(el).writingMode), width: 0, height: 0, measured: false }));
    ro.observe(el, { box: 'border-box' });
  }
  s.subs.add(i);
  return s;
}

function unobserve(el: Element, i: SizeInstance) {
  const s = subjects.get(el);
  if (!s?.subs.delete(i) || s.subs.size) return;
  subjects.delete(el);
  ro!.unobserve(el);
  if (!subjects.size) { ro!.disconnect(); ro = undefined; runtimeStats.observers--; }
}

/** Frames of same-direction change, right after our own write, before the loop probe starts. */
const STREAK = 30;

class SizeInstance implements Instance {
  /** Consecutive same-direction changes that each followed a write of ours. */
  private streak = 0;
  private sign = 0;
  private wrote = false;
  private probing = false;
  private changedWhileProbing = false;
  frozen = false;
  readonly subject: Subject;

  constructor(readonly ctx: Ctx, readonly axis: Axis) {
    this.subject = observe(ctx.el, this);
    runtimeStats.sources++;
  }

  /** prev: this axis before the change, undefined for the first measurement. */
  measured(prev: number | undefined) {
    const d = prev === undefined ? 0 : this.subject[this.axis] - prev;
    if (prev !== undefined && d === 0) return;
    if (this.probing) { this.changedWhileProbing = true; return; }
    if (this.frozen) return;
    const s = Math.sign(d);
    this.streak = this.wrote && s !== 0 && s === this.sign ? this.streak + 1 : 0;
    this.sign = s;
    if (this.streak >= STREAK) return this.probe();
    this.wrote = true; // the binding writes this value in the next flush
    this.ctx.notify();
  }

  /** Stop writing for two frames: does the size keep changing without us? */
  private probe() {
    this.probing = true;
    this.changedWhileProbing = false;
    frame(() => frame(() => {
      this.probing = false;
      this.streak = 0;
      if (this.changedWhileProbing) { this.ctx.notify(); return; } // driven from elsewhere: resume
      this.frozen = true;
      warn(`element(${this.axis}) on ${describeElement(this.ctx.el)} feeds back into the element's own size (for example width: calc(element(width) + 10px)). Its value is frozen at ${fmt(this.subject[this.axis])}px. Measure a parent or a child instead.`);
    }));
  }

  get() {
    return this.subject.measured ? fmt(this.subject[this.axis]) + 'px' : '';
  }

  dispose() {
    unobserve(this.ctx.el, this);
    runtimeStats.sources--;
  }
}

defineFunction({
  name: 'element',
  kind: 'source',
  syntax: 'element(width | height)',
  matches: (text) => /^\s*(width|height)\s*$/i.test(text),
  compile: (args) => args[0].text.toLowerCase() as Axis,
  create: (ctx, _args, axis: Axis) => new SizeInstance(ctx, axis),
});
