// :nth-var(--name): matches the element whose one-based index among its element siblings
// (as in :nth-child) equals the integer value of --name, read on the siblings' parent.
//
// Change detection is explicit, not polled. A sibling group is re-evaluated when:
// - its children are added, removed or reordered;
// - any attribute (style, class, data-*, ...) changes on the parent or one of its ancestors,
//   which covers inline `style.setProperty('--active', 4)`, class toggles, and values
//   written by Reactive CSS functions such as live();
// - ReactiveCSS.refresh() is called.
// Not detected: changes coming only from media/container queries, animations, or
// stylesheet edits. Call ReactiveCSS.refresh() after those.
// The value must compute to an integer literal (e.g. 3). For calc() expressions,
// register the property with @property { syntax: "<integer>" } so the browser computes it.

import { defineSelector, refreshers } from '../core/registry';
import { watch, unwatch, type Watcher } from '../core/elements';
import { frame, onSync } from '../core/scheduler';
import { StateRef } from '../state/state';
import { dev, probes } from '../core/log';

interface Use { varName: string; attr: string; members: Map<Element, Element> }
interface Group {
  parent: Element;
  count: number;
  /** Children were added/removed/reordered or members changed: next run checks every sibling. */
  structural: boolean;
  /** Element that currently carries each use's marker, so a value change touches only two elements. */
  active: Map<Use, Element | null>;
  /** When the variable is a state() (on the parent or an ancestor), its cell is read directly. */
  refs: Map<string, StateRef>;
}

const uses = new Set<Use>();
const groups = new Map<Element, Group>();
/** Observed element -> groups at or below it, so an attribute change finds its groups in O(1). */
let under = new Map<Element, Group[]>();
const pending = new Set<Group>();
let rebuild = false;
let observer: MutationObserver | undefined;
if (dev) Object.assign(probes, { nthUses: () => uses.size, nthGroups: () => groups.size, nthIndexed: () => under.size, nthPending: () => pending.size });

function schedule(g?: Group) {
  if (g) pending.add(g);
  frame(run);
}

function add(use: Use, el: Element) {
  const parent = el.parentElement;
  if (!parent) return;
  use.members.set(el, parent);
  let g = groups.get(parent);
  if (!g) { groups.set(parent, (g = { parent, count: 0, structural: true, active: new Map(), refs: new Map() })); rebuild = true; }
  g.count++;
  g.structural = true;
  schedule(g);
}

function remove(use: Use, el: Element) {
  const parent = use.members.get(el);
  if (!parent) return;
  use.members.delete(el);
  el.removeAttribute(use.attr);
  const g = groups.get(parent);
  if (g && --g.count === 0) {
    groups.delete(parent);
    pending.delete(g);
    g.refs.forEach((r) => r.dispose());
    rebuild = true;
    schedule();
  }
  else if (g) { g.structural = true; schedule(g); }
}

function onMutations(records: MutationRecord[]) {
  for (const r of records) {
    if (r.type === 'attributes' && r.attributeName?.startsWith('data-rcss')) continue;
    const t = r.target as Element;
    if (r.type === 'childList') {
      const g = groups.get(t);
      if (g) { g.structural = true; pending.add(g); }
    } else under.get(t)?.forEach((g) => pending.add(g));
  }
  if (pending.size) schedule();
}

/** Observe each group parent (children + attributes) and its ancestors (attributes). */
function observeGroups() {
  rebuild = false;
  if (observer) { onMutations(observer.takeRecords()); observer.disconnect(); }
  observer ??= new MutationObserver(onMutations);
  under = new Map();
  for (const g of groups.values()) {
    for (let a: Element | null = g.parent; a; a = a.parentElement) {
      const list = under.get(a);
      if (list) list.push(g);
      else under.set(a, [g]);
    }
  }
  under.forEach((_, el) => observer!.observe(el, { attributes: true, childList: groups.has(el) }));
}

function run() {
  if (rebuild) observeGroups();
  // Read every value first, then write, so groups do not force style recalcs on each other.
  // A group deleted since it was queued (via the stale `under` index) must not get a new StateRef:
  // nothing would dispose it, and it would stay subscribed to the live cell.
  const reads = [...pending].filter((g) => groups.get(g.parent) === g && g.parent.isConnected).map((g) => {
    let cs: CSSStyleDeclaration | undefined;
    const values = new Map<string, number>();
    for (const u of uses) {
      if (values.has(u.varName)) continue;
      // State path: the value comes straight from the cell, which notifies on change.
      let ref = g.refs.get(u.varName);
      if (!ref) g.refs.set(u.varName, (ref = new StateRef(g.parent, u.varName, { notify: () => schedule(g) }, true)));
      const t = ref.get();
      if (t) { values.set(u.varName, t.type === 'number' ? (t.v as number) : NaN); continue; }
      // Ordinary custom property: read the computed value (only when something changed).
      cs ??= getComputedStyle(g.parent);
      values.set(u.varName, Number(cs.getPropertyValue(u.varName).trim() || NaN));
    }
    return [g, values] as const;
  });
  pending.clear();
  for (const [g, values] of reads) {
    const children = g.parent.children;
    if (g.structural) {
      g.structural = false;
      g.active.clear();
      for (let i = 0; i < children.length; i++) {
        const c = children[i];
        for (const u of uses) {
          if (u.members.get(c) !== g.parent) continue;
          const want = values.get(u.varName) === i + 1;
          if (want) g.active.set(u, c);
          if (c.hasAttribute(u.attr) !== want) c.toggleAttribute(u.attr, want);
        }
      }
      continue;
    }
    // Only the value changed: move each marker from the old element to the new one.
    for (const u of uses) {
      const n = values.get(u.varName)!;
      const c = Number.isInteger(n) && n >= 1 ? children[n - 1] : undefined;
      const next = c && u.members.get(c) === g.parent ? c : null;
      const prev = g.active.get(u) ?? null;
      if (next === prev) continue;
      prev?.removeAttribute(u.attr);
      next?.setAttribute(u.attr, '');
      g.active.set(u, next);
    }
  }
}

// Before an event, apply pending group changes now (state-driven ones read no layout).
onSync(() => { if (pending.size) run(); });

refreshers.add(() => {
  groups.forEach((g) => { g.structural = true; pending.add(g); });
  schedule();
});

let counter = 0;
defineSelector({
  name: 'nth-var',
  kind: 'structural',
  functional: true,
  compile(arg, compound, sheet) {
    if (!/^--[^\s,()]+$/.test(arg)) throw new Error(`:nth-var() expects a custom property name like --active, got "${arg}"`);
    if (!compound.replace(/:is\(\*\)/g, '').trim())
      throw new Error(':nth-var() needs a type, class or attribute selector on the same element, e.g. .slide:nth-var(--active)');
    const use: Use = { varName: arg, attr: `data-rcss-nth-${counter++}`, members: new Map() };
    sheet.setup.push(() => {
      uses.add(use);
      const w: Watcher = {
        selector: compound,
        add: (el) => add(use, el),
        remove: (el) => remove(use, el),
        move: (el) => { remove(use, el); add(use, el); },
      };
      watch(w);
      return () => { unwatch(w); uses.delete(use); };
    });
    return `[${use.attr}]`; // same specificity as :nth-child()
  },
});
