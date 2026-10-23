// attr: <attribute> <value> (experimental, 0.5.3): an allowlisted HTML attribute of the matched
// element, derived from a reactive value (usually state owned by an ancestor).
//
// - Compiled to `--rcss-attr-<attribute>: <value>` in the same rule: one registered,
//   non-inherited property per attribute. The browser's cascade picks the winner for each
//   attribute independently: attr: declarations for different attributes combine (in one rule
//   or several); for the same attribute, specificity, order, layers, media, :when() and
//   !important decide, as for any property.
// - Values: one string, number or keyword, with the semantics of state(…, bind()):
//   disabled/hidden/required present for true, removed for false (never disabled="false");
//   aria-expanded/pressed/selected "true"/"false"; aria-current a token; data-* any text.
//   Written with setAttribute()/toggleAttribute(), never parsed as markup.
// - No applicable declaration (no rule matches, or the winning value is a when() with no value):
//   the attribute as it was before the first write is restored.
// - Ownership: if anything else changes the attribute after a write, the binding yields: no
//   more writes, no restore. A state(…, bind(attribute)) on the same element owns that
//   attribute; attr: for it is ignored with a diagnostic.
// - Timing: re-read when a state changes inside an ancestor-or-self owner, when the element
//   starts or stops matching an attr: rule, and on ReactiveCSS.refresh(). After event-driven
//   changes (actions, bound controls) the write happens at once, in the same task, so a
//   `disabled` derived from a click is in place before the next click; otherwise in the late
//   phase of the frame.
// - HTML applicability is checked when a write would set the attribute: disabled and required
//   only where HTML gives them a meaning; otherwise one warning and no write. ARIA values are
//   checked; ARIA patterns are not (an attribute does not make a component accessible).

import { late, type Job } from '../core/scheduler';
import { warn, dev, probes } from '../core/log';
import { runtimeStats, refreshers, sheetChangeHooks, runtimes } from '../core/registry';
import { ownedAttributes, type Watcher } from '../core/elements';
import { stateChangeHooks, describeElement, within } from './state';
import { textOf } from './textof';
import { kindOf, ARIA_CURRENT, TABINDEX, NUMBER, type AttrKind } from './bindattr';
import { ATTR_PREFIX, hasReactiveSyntax } from '../core/parser';

const sets = new Map<Element, AttrSet>();
const registered = new Set<string>();
if (dev) probes.attrBindings = () => sets.size;

/** Attribute text for a value: null removes the attribute; false means not acceptable. */
function attrText(kind: AttrKind, s: string): string | null | false {
  if (kind === 'tabindex') return TABINDEX.has(s) ? s : false;
  if (kind === 'aria-number') return NUMBER.test(s) ? s : false;
  if (kind !== 'data' && kind !== 'text') s = s === '1' ? 'true' : s === '0' ? 'false' : s; // var(--boolean-state) is 1 or 0 in CSS
  switch (kind) {
    case 'boolean': return s === 'true' ? '' : s === 'false' ? null : false;
    case 'aria-boolean': return s === 'true' || s === 'false' ? s : false;
    case 'aria-tristate': return s === 'true' || s === 'false' || s === 'mixed' ? s : false;
    case 'aria-current': return ARIA_CURRENT.has(s) ? s : false;
    case 'data': case 'text': return s;
  }
}

const tagOf = (el: Element) => el.localName + (el instanceof HTMLInputElement ? `[type=${el.type}]` : '');
/** Input types where `required` has no meaning (HTML: it applies to text-like, date, number, checkbox, radio, file). */
const NOT_REQUIRABLE = new Set(['hidden', 'range', 'color', 'submit', 'reset', 'image', 'button']);
const PRESSABLE = /^(button|summary)$/;
const SELECTABLE_ROLES = new Set(['option', 'tab', 'row', 'gridcell', 'columnheader', 'rowheader', 'treeitem']);

/**
 * HTML applicability: 'skip' when the attribute has no native meaning on this element (or the
 * element is a custom element that is not defined yet), 'warn' for obvious ARIA misuse.
 */
function applicability(el: Element, name: string): ['skip' | 'warn', string] | undefined {
  if (name === 'disabled') {
    if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement || el instanceof HTMLSelectElement
      || el instanceof HTMLTextAreaElement || el instanceof HTMLFieldSetElement || el instanceof HTMLOptGroupElement
      || el instanceof HTMLOptionElement) return;
    if (el.localName.includes('-')) {
      const ce = customElements.get(el.localName) as { formAssociated?: boolean } | undefined;
      if (ce?.formAssociated) return; // form-associated custom elements get :disabled and formDisabledCallback
      if (!ce) return ['skip', `<${el.localName}> is not defined yet; disabled is written once it is defined and form-associated.`];
      return ['skip', `<${el.localName}> is not form-associated (static formAssociated = true), so disabled does nothing natively.`];
    }
    return ['skip', `disabled only works on button, input, select, textarea, option, optgroup and fieldset; on <${tagOf(el)}> it would not disable anything. Use aria-disabled with an inactive action, or a native control.`];
  }
  if (name === 'required') {
    if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) return;
    if (el instanceof HTMLInputElement && !NOT_REQUIRABLE.has(el.type)) return;
    return ['skip', `required only works on input (text-like, date, number, checkbox, radio, file), select and textarea; on <${tagOf(el)}> it would not be validated.`];
  }
  if (name === 'hidden') return el instanceof HTMLElement ? undefined : ['skip', `hidden is an HTML attribute; <${el.localName}> is not an HTML element.`];
  const role = el.getAttribute('role');
  if (name === 'aria-pressed' && !(role ? role === 'button' : PRESSABLE.test(el.localName) || (el instanceof HTMLInputElement && el.type === 'button')))
    return ['warn', `aria-pressed is for toggle buttons; <${tagOf(el)}>${role ? ` with role="${role}"` : ''} is not a button. The attribute is written; check the pattern.`];
  if (name === 'aria-selected' && !(role ? SELECTABLE_ROLES.has(role) : /^(option|tr|td|th)$/.test(el.localName)))
    return ['warn', `aria-selected needs a role like tab, option, row or gridcell; <${tagOf(el)}>${role ? ` with role="${role}"` : ' without a role'} does not support it. The attribute is written; check the pattern.`];
  return;
}

interface Slot {
  kind: AttrKind;
  rules: number;
  /** Computed by compute(): text to write, null to remove, undefined to restore. */
  next?: string | null;
  /** What was last applied (same encoding); false: not applied yet (skipped), retry. */
  done?: string | null | false;
  /** The attribute before our first write (null: absent). */
  original?: string | null;
  /** What we last left in the attribute; undefined while it is not ours. */
  written?: string | null;
  yielded?: boolean;
}

class AttrSet implements Job {
  queued?: boolean;
  dead = false;
  waiting = false;
  slots = new Map<string, Slot>();
  constructor(readonly el: Element) {}

  compute() {
    if (this.dead || !this.el.isConnected) return false;
    const cs = getComputedStyle(this.el);
    let change = false;
    for (const [name, s] of this.slots) {
      if (s.yielded) continue;
      const raw = cs.getPropertyValue(ATTR_PREFIX + name);
      const t = textOf(raw);
      let next = t === null ? undefined : t === undefined ? false : attrText(s.kind, t);
      if (next === false && hasReactiveSyntax(raw)) next = s.done === false ? undefined : s.done; // another sheet is not compiled yet: read again after it
      else if (next === false) {
        warn(`attr: ${name} on <${tagOf(this.el)}> cannot be ${raw.trim().slice(0, 60)}: ${s.kind === 'boolean' || s.kind === 'aria-boolean' ? 'use true or false (1 or 0)' : s.kind === 'aria-tristate' ? 'use true, false or mixed' : s.kind === 'aria-number' ? 'use a number' : s.kind === 'aria-current' ? `use one of ${[...ARIA_CURRENT].join(', ')}` : s.kind === 'tabindex' ? 'use 0 or -1' : 'use one string, number or keyword'}. The attribute is left unchanged.`);
        next = s.done === false ? undefined : s.done;
      }
      s.next = next;
      if (next !== s.done) change = true;
    }
    return change;
  }

  write() {
    if (this.dead) return;
    for (const [name, s] of this.slots) if (!s.yielded && s.next !== s.done) this.apply(name, s);
  }

  private apply(name: string, s: Slot) {
    const el = this.el;
    const cur = el.getAttribute(name);
    if (s.written !== undefined && cur !== s.written) {
      s.yielded = true;
      this.disown(name);
      warn(`attr: ${name} on ${describeElement(el)} stopped: the attribute was changed by something else, which now owns it.`);
      return;
    }
    if (s.next === undefined && s.written === undefined) { s.done = undefined; return; } // nothing of ours to restore
    let owners = ownedAttributes.get(el);
    const owner = owners?.get(name);
    if (owner && owner !== this) {
      s.done = false;
      warn(`attr: ${name} on ${describeElement(el)} is ignored: a state(…, bind(${name})) on the same element owns that attribute. Use one of the two.`);
      return;
    }
    if (s.next === undefined) { // no attr: declaration applies: back to the original
      if (s.written !== undefined) {
        if (s.original === null) el.removeAttribute(name);
        else el.setAttribute(name, s.original!);
        s.written = undefined;
        this.disown(name);
      }
      s.done = undefined;
      return;
    }
    if (s.next !== null) { // only setting needs an applicable element; removing never hurts
      const why = applicability(el, name);
      if (why) {
        warn(`attr: ${name} on <${tagOf(el)}>: ${why[1]}`);
        if (why[0] === 'skip') {
          s.done = false;
          if (why[1].includes('not defined yet') && !this.waiting) {
            this.waiting = true; // one wait per element; a WeakRef so a never-defined element can still be collected
            const ref = new WeakRef(this);
            customElements.whenDefined(el.localName).then(() => { const b = ref.deref(); if (b) late(b); });
          }
          return;
        }
      }
    }
    if (s.written === undefined) {
      s.original = cur;
      if (!owners) ownedAttributes.set(el, (owners = new Map()));
      owners.set(name, this);
    }
    if (s.kind === 'boolean') {
      // Presence only: an existing value (e.g. hidden="until-found") is kept while true.
      if ((cur !== null) !== (s.next !== null)) el.toggleAttribute(name, s.next !== null);
    } else if (s.next === null) { if (cur !== null) el.removeAttribute(name); }
    else if (cur !== s.next) el.setAttribute(name, s.next);
    s.written = el.getAttribute(name);
    s.done = s.next;
  }

  private disown(name: string) {
    const owners = ownedAttributes.get(this.el);
    if (owners?.get(name) === this) owners.delete(name);
  }

  add(name: string) {
    const s = this.slots.get(name);
    if (s) s.rules++;
    else this.slots.set(name, { kind: kindOf(name)!, rules: 1 });
  }

  /** One rule for `name` stopped matching; the last one restores the attribute. */
  drop(name: string) {
    const s = this.slots.get(name);
    if (!s || --s.rules) return;
    if (!s.yielded) { s.next = undefined; this.apply(name, s); }
    this.slots.delete(name);
  }

  dispose() {
    for (const name of [...this.slots.keys()]) { this.slots.get(name)!.rules = 1; this.drop(name); }
    this.dead = true; // a queued job does nothing after this
  }
}

function register(names: string[]) {
  if (!registered.size) {
    stateChangeHooks.add((c) => within(sets, c.owner, (b) => late(b, true)));
    refreshers.add(() => sets.forEach((b) => late(b)));
  sheetChangeHooks.add(() => sets.forEach((b) => late(b)));
  }
  for (const name of names) {
    if (registered.has(name)) continue;
    registered.add(name);
    // Not inherited: an attr: rule on a parent must not reach a child's binding.
    try { CSS.registerProperty({ name: ATTR_PREFIX + name, syntax: '*', inherits: false }); } catch (e) {
      if (!(e instanceof DOMException && e.name === 'InvalidModificationError'))
        warn('attr: needs CSS.registerProperty() (Chrome 78+, Safari 16.4+, Firefox 128+); an attr: rule on an element would also apply to its descendants.');
    }
  }
}

/** Watcher for a rule with attr: declarations for `names`. */
export function attrWatcher(match: string, names: string[]): Watcher {
  register(names);
  return {
    selector: match,
    add(el) {
      let b = sets.get(el);
      if (!b) { sets.set(el, (b = new AttrSet(el))); runtimeStats.bindings++; }
      for (const n of names) b.add(n);
      late(b);
    },
    remove(el) {
      const b = sets.get(el);
      if (!b) return;
      for (const n of names) b.drop(n);
      if (b.slots.size) { late(b); return; }
      sets.delete(el);
      runtimeStats.bindings--;
      b.dispose();
    },
  };
}

// Feature runtime (src/features): the parser and the engine find it here.
runtimes.attrs = attrWatcher;
