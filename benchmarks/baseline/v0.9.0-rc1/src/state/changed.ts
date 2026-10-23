// :changed(--x): matches an element for a short while after an observed change of the
// nearest state --x.
//
// - Trigger: the cell's version counter. Each consumer remembers the version it last saw, so
//   nothing matches on load, after a no-op assignment, or when a reference is (re)resolved.
// - Active: a private marker attribute is set in the frame after the change.
// - Inactive: when every CSS animation and transition that the marker started in the
//   element's subtree has finished (cancelled counts as finished), or right away if it
//   started none. "Started by the marker": an animation whose name, or a transition whose
//   property, is declared in a rule with :changed() of the same state (read from the CSSOM
//   once per sheet change; every :changed(--x) rule counts for --x, so markers of one state
//   clear together, as authors expect of one condition). Other animations that start in the same frame (a clock restarting in
//   the subtree) do not hold the marker. A marker rule that sets custom properties can start
//   anything indirectly: then every animation that started in the subtree counts.
//   Found with ONE document.getAnimations() per frame for all new markers
//   (which flushes style, so pending animations are visible), then awaited through their
//   `finished` promises. No timers. (Measured: one getAnimations({ subtree: true }) per
//   change cost 2.8 s per 3 s with 10,000 counters; start events can arrive after the next
//   frame in Chromium, so they are not used to decide "nothing started".)
// - Another change while active removes the marker and sets it again one frame later, so
//   animations restart.

import { defineSelector, sheetChangeHooks } from '../core/registry';
import { dirty, frame, settleLater, type Job } from '../core/scheduler';
import { watch, unwatch, type Watcher } from '../core/elements';
import { StateRef, type Cell, type Subscriber } from './state';
import { dev, probes } from '../core/log';

const now = () => (document.timeline?.currentTime as number | null) ?? performance.now();
const isStyleAnimation = (a: Animation) => 'animationName' in a || 'transitionProperty' in a;

/** Markers set since the last check, with the time they were set. */
const checking = new Map<ChangedMatch, number>();
if (dev) probes.changedChecking = () => checking.size;

/** What the :changed() rules of one state declare: animation names, longhand properties. */
interface Effects { names: Set<string>; props: Set<string>; indirect: boolean }
/** By state name. */
let effects: Map<string, Effects> | undefined;
/** Marker attribute → its state name (set at compile time). shortcut: entries of recompiled sheets stay (one short string each); prune if sheets are recompiled in a loop. */
const stateOfMarker = new Map<string, string>();
sheetChangeHooks.add(() => { effects = undefined; });
const MARKER = /\[(data-rcss-changed-\d+)\]/g;

function scan(rules: CSSRuleList, inherited: string[], out: Map<string, Effects>) {
  for (const r of rules) {
    let attrs = inherited;
    if (r instanceof CSSStyleRule) {
      const own = [...r.selectorText.matchAll(MARKER)].map((m) => m[1]!);
      if (own.length) attrs = [...inherited, ...own];
      for (const a of attrs) {
        const name = stateOfMarker.get(a);
        if (!name) continue;
        let e = out.get(name);
        if (!e) out.set(name, (e = { names: new Set(), props: new Set(), indirect: false }));
        for (let i = 0; i < r.style.length; i++) {
          const p = r.style[i]!, v = r.style.getPropertyValue(p);
          // A custom property (not the library's own) or a var() value can start anything.
          if ((p.startsWith('--') && !p.startsWith('--rcss-')) || v.includes('var(') || v === '') e.indirect = true;
          if (p === 'animation-name') for (const n of v.split(',')) e.names.add(n.trim());
          e.props.add(p);
        }
      }
    }
    if ('cssRules' in r) scan((r as CSSGroupingRule).cssRules, attrs, out);
  }
}

function effectsOf(name: string): Effects | undefined {
  if (!effects) {
    effects = new Map();
    for (const sheet of [...document.styleSheets, ...(document.adoptedStyleSheets ?? [])]) {
      try { scan(sheet.cssRules, [], effects); } catch { /* cross-origin: never processed */ }
    }
  }
  return effects.get(name);
}

/** Started by the marker's own rules (see the header); unknown rules count everything. */
function startedBy(e: Effects | undefined, a: Animation) {
  if (!e || e.indirect) return true;
  return 'animationName' in a ? e.names.has((a as CSSAnimation).animationName) : e.props.has((a as CSSTransition).transitionProperty);
}

function checkAll() {
  const anims = document.getAnimations().filter(isStyleAnimation);
  for (const [m, since] of checking) {
    const e = effectsOf(m.name);
    const started = anims.filter((a) => {
      const t = (a.effect as KeyframeEffect | null)?.target;
      return !!t && m.el.contains(t) && (a.startTime === null || (a.startTime as number) >= since - 1) && startedBy(e, a);
    });
    m.watch(started);
  }
  checking.clear();
}

class ChangedMatch implements Job, Subscriber {
  queued?: boolean;
  dead = false;
  ref: StateRef;
  private cell?: Cell;
  private seen = 0;
  /** Increases with every observed change; stale callbacks compare against it. */
  private epoch = 0;

  constructor(readonly el: Element, readonly name: string, readonly attr: string) {
    this.ref = new StateRef(el, name, this);
    settleLater(this); // records the current version without firing
  }

  notify() { if (!this.dead) dirty(this); }

  compute() {
    if (this.dead) return false;
    const c = this.ref.state();
    if (c !== this.cell) {
      // New or lost owner: start observing from its current version, never fire for it.
      this.cell = c;
      this.seen = c?.version ?? 0;
      if (!c) this.clear();
      return false;
    }
    if (!c || c.version === this.seen) return false;
    this.seen = c.version;
    this.epoch++;
    return true;
  }

  write() {
    const epoch = this.epoch;
    if (this.el.hasAttribute(this.attr)) {
      this.clear(); // restart: one frame without the marker
      frame(() => this.mark(epoch));
    } else this.mark(epoch);
  }

  private mark(epoch: number) {
    if (this.dead || epoch !== this.epoch) return;
    this.el.setAttribute(this.attr, '');
    // Check after this frame has rendered: its style update created the animations, so
    // getAnimations() finds clean styles instead of forcing a recalculation (measured 2x cheaper).
    if (!checking.size) setTimeout(checkAll);
    checking.set(this, now());
  }

  /** Keeps the marker until the animations it started have settled. */
  watch(started: Animation[]) {
    const epoch = this.epoch;
    if (!started.length) return this.clear();
    Promise.allSettled(started.map((a) => a.finished)).then(() => { if (epoch === this.epoch) this.clear(); });
  }

  private clear() {
    this.el.removeAttribute(this.attr);
    checking.delete(this);
  }

  dispose() {
    this.dead = true;
    this.ref.dispose();
    this.clear();
  }
}

let counter = 0;
defineSelector({
  name: 'changed',
  kind: 'state',
  functional: true,
  syntax: ':changed(--state)',
  compile(arg, compound, sheet) {
    if (!/^--[^\s,()]+$/.test(arg)) throw new Error(`:changed() expects a state name like --count, got "${arg}"`);
    if (!compound.replace(/:is\(\*\)/g, '').trim())
      throw new Error(':changed() needs a type, class or attribute selector on the same element, e.g. .counter:changed(--count)');
    const attr = `data-rcss-changed-${counter++}`;
    stateOfMarker.set(attr, arg);
    sheet.setup.push(() => {
      const matches = new WeakMap<Element, ChangedMatch>();
      const w: Watcher = {
        selector: compound,
        add: (el) => { matches.set(el, new ChangedMatch(el, arg, attr)); },
        remove: (el) => { matches.get(el)?.dispose(); matches.delete(el); },
      };
      watch(w);
      return () => unwatch(w);
    });
    return `[${attr}]`; // same specificity as one pseudo-class
  },
});
