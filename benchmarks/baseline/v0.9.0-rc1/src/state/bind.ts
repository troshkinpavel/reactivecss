// bind: --x  — two-way binding between a native form control and the nearest state --x.
//
// Control → state on user input (one delegated listener per event type for all bindings).
// State → control when the state changes otherwise, writing only when the control does not
// already show the value, so typing never rewrites the field and the caret stays put.
// Initialization is state-first, except when the control already differs from its HTML
// default (autofill, restored form state): then the control wins. Form reset restores the
// state's initial value. See docs/api-0.3.md.

import { runtimeStats, runtimes } from '../core/registry';
import { dirty, frame, settleLater, urgently, activation, type Job } from '../core/scheduler';
import { warn, dev, probes } from '../core/log';
import { sensitive } from './expr';
import type { Watcher } from '../core/elements';
import { StateRef, describeElement, type Cell, type Subscriber } from './state';
import { parseTyped, assignable, coerce, type Typed } from './values';
import { fmt } from '../core/format';

export interface BindSpec { name: string; scope?: string }

type Kind = 'text' | 'number' | 'checkbox' | 'radio' | 'select';
type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const TEXT = new Set(['text', 'search', 'email', 'url', 'tel', 'password']);
/** Which state types each control kind can hold. */
const TYPES: Record<Kind, string[]> = {
  text: ['string'],
  number: ['number', 'dimension'],
  checkbox: ['boolean'],
  radio: ['string', 'value', 'number'],
  select: ['string', 'value', 'number'],
};

function kindOf(el: Element): Kind | undefined {
  if (el instanceof HTMLTextAreaElement) return 'text';
  if (el instanceof HTMLSelectElement) return el.multiple ? undefined : 'select';
  if (!(el instanceof HTMLInputElement)) return undefined;
  const t = el.type;
  if (TEXT.has(t)) return 'text';
  if (t === 'number' || t === 'range') return 'number';
  if (t === 'checkbox' || t === 'radio') return t;
  return undefined;
}

/** Text a radio/select option value stands for, in the state's type. */
function optionValue(raw: string, like: Typed): Typed | undefined {
  if (like.type === 'string') return { type: 'string', v: raw };
  if (!raw.trim()) return undefined;
  try {
    const t = parseTyped(raw);
    return assignable(like, t) ? coerce(like, t) : undefined;
  } catch { return undefined; }
}

const rawOf = (t: Typed) => (t.type === 'string' || t.type === 'value' ? String(t.v) : fmt(t.v as number) + (t.unit ?? ''));

/** True when the control differs from its HTML default (autofill, restored state, early typing). */
function edited(el: Control, kind: Kind): boolean {
  if (el instanceof HTMLSelectElement) {
    // Without a selected attribute, a single select shows its first option by default.
    const def = [...el.options].findIndex((o) => o.defaultSelected);
    return el.selectedIndex !== (def === -1 ? 0 : def);
  }
  if (kind === 'checkbox' || kind === 'radio') return (el as HTMLInputElement).checked !== (el as HTMLInputElement).defaultChecked;
  return el.value !== (el as HTMLInputElement).defaultValue;
}

const controls = new Map<Element, Binder>();
if (dev) probes.bindControls = () => controls.size;

/**
 * A bound checkbox or radio that the browser has just toggled for a click (a pointer click, or an
 * arrow key in a radio group) and whose input/change has not arrived yet. Writes to it and to its
 * radio group wait meanwhile: a click action's sync() would otherwise write the previous state
 * back and undo the user's choice before it is read. Cleared by that input/change, or by the next
 * frame when the click was cancelled (the browser then reverts the control itself).
 */
let toggled: HTMLInputElement | null = null;
const sameGroup = (a: Control, t: HTMLInputElement) => a === t ||
  (a instanceof HTMLInputElement && a.type === 'radio' && t.type === 'radio' && !!a.name && a.name === t.name && a.form === t.form && a.getRootNode() === t.getRootNode());

class Binder implements Job, Subscriber {
  queued?: boolean;
  dead = false;
  ref: StateRef;
  private cell?: Cell;
  /** Set on the first resolution when the control, not the state, provides the value. */
  private takeControl = false;
  forceWrite = false;

  constructor(readonly el: Control, readonly kind: Kind, readonly spec: BindSpec) {
    this.ref = new StateRef(el, spec.name, this, false, spec.scope);
    settleLater(this);
  }

  notify() { if (!this.dead) dirty(this); }

  private compatible(c: Cell) {
    if (TYPES[this.kind].includes(c.value.type)) return true;
    warn(`bind: ${this.spec.name} on ${describeElement(this.el)}: a ${this.kind} control cannot hold a ${c.value.type} state (use ${TYPES[this.kind].join(' or ')}). Not bound.`);
    return false;
  }

  compute() {
    if (this.dead) return false;
    const c = this.ref.state();
    if (c !== this.cell) {
      this.cell = c;
      if (!c || !this.compatible(c)) { this.cell = undefined; return false; }
      this.takeControl = !c.restored && edited(this.el, this.kind); // a persisted value wins (0.9.0)
      return true;
    }
    if (!c) return false;
    if (toggled && sameGroup(this.el, toggled)) { frame(() => this.notify()); return false; }
    return this.forceWrite || !this.shows(c.value);
  }

  write() {
    const c = this.cell;
    if (!c) return;
    if (this.takeControl) {
      this.takeControl = false;
      this.fromControl();
    }
    if (!this.forceWrite && this.shows(c.value)) return;
    this.forceWrite = false;
    this.toControl(c.value);
  }

  /** Does the control already show `v`? */
  shows(v: Typed): boolean {
    const el = this.el;
    switch (this.kind) {
      case 'text': return el.value === v.v;
      case 'number': return (el as HTMLInputElement).valueAsNumber === v.v;
      case 'checkbox': return (el as HTMLInputElement).checked === v.v;
      case 'radio': {
        const o = optionValue(el.value, v);
        return (el as HTMLInputElement).checked === (!!o && o.v === v.v);
      }
      default: return el.value === rawOf(v);
    }
  }

  toControl(v: Typed) {
    const el = this.el;
    switch (this.kind) {
      case 'text': {
        const focused = el.ownerDocument.activeElement === el;
        const t = el as HTMLInputElement;
        const [a, b] = focused ? [t.selectionStart, t.selectionEnd] : [null, null];
        el.value = v.v as string;
        if (focused && a !== null && b !== null) {
          const n = el.value.length;
          try { t.setSelectionRange(Math.min(a, n), Math.min(b, n)); } catch { /* type without selection */ }
        }
        break;
      }
      case 'checkbox': (el as HTMLInputElement).checked = v.v as boolean; break;
      case 'radio': {
        const o = optionValue(el.value, v);
        (el as HTMLInputElement).checked = !!o && o.v === v.v;
        break;
      }
      default: el.value = rawOf(v);
    }
  }

  /** Reads the control into the state (user input). Invalid input leaves the state alone. */
  fromControl() {
    const c = this.cell;
    if (!c || this.dead) return;
    const el = this.el;
    let next: Typed | undefined;
    switch (this.kind) {
      case 'text': next = { type: 'string', v: el.value }; break;
      case 'checkbox': next = { type: 'boolean', v: (el as HTMLInputElement).checked }; break;
      case 'number': {
        const n = (el as HTMLInputElement).valueAsNumber;
        if (!Number.isFinite(n)) return; // empty or not a number: keep the state
        next = { type: c.value.type, v: n, unit: c.value.unit };
        break;
      }
      case 'radio':
        if (!(el as HTMLInputElement).checked) return;
        next = optionValue(el.value, c.value);
        break;
      default: next = optionValue(el.value, c.value);
    }
    if (!next) { warn(`bind: ${this.spec.name}: "${el.value}" is not a valid ${c.value.type} value.`); return; }
    c.set(next);
  }

  dispose() {
    this.dead = true;
    this.ref.dispose();
  }
}

// ---- shared listeners -------------------------------------------------------------

function onClick(e: Event) {
  const b = controls.get(e.target as Element);
  if (!b || (b.kind !== 'checkbox' && b.kind !== 'radio')) return;
  toggled = b.el as HTMLInputElement;
  frame(() => { toggled = null; });
}

function onInput(e: Event) {
  if (e.target === toggled) toggled = null;
  const b = controls.get(e.target as Element);
  if (!b) return;
  if (e.type === 'input' && (e as InputEvent).isComposing) return; // wait for compositionend
  if (e.type === 'change' && (b.kind === 'text' || b.kind === 'number')) return; // already taken on input
  activation.event = e;
  try { urgently(() => b.fromControl()); } finally { activation.event = null; }
}

function onReset(e: Event) {
  const form = e.target;
  if (!(form instanceof HTMLFormElement)) return;
  // The reset runs after this event: restore the state's initial value afterwards.
  setTimeout(() => urgently(() => {
    for (const b of controls.values()) {
      if (b.el.form !== form) continue;
      const c = b.ref.state();
      if (!c) continue;
      c.set(c.initial);
      b.forceWrite = true;
      b.notify();
    }
  }));
}

const EVENTS = ['input', 'change', 'compositionend'] as const;

function listen(on: boolean) {
  const m = on ? 'addEventListener' : 'removeEventListener';
  for (const t of EVENTS) document[m](t, onInput, true);
  // On window: capture listeners there run before the document ones that dispatch on: actions.
  window[m]('click', onClick, true);
  document[m]('reset', onReset, true);
  runtimeStats.observers += on ? 1 : -1;
}


/** Watcher for a rule with `bind:`. */
export function bindWatcher(match: string, spec: BindSpec): Watcher {
  return {
    selector: match,
    add(el) {
      if (sensitive(el)) { warn(`bind: is refused on ${describeElement(el)}: password, one-time-code and payment fields are never exposed to CSS.`); return; }
      const kind = kindOf(el);
      if (!kind) { warn(`bind: is not supported on ${describeElement(el)} (supported: text-like inputs, textarea, number, range, checkbox, radio, single select).`); return; }
      if (controls.has(el)) { warn(`bind: ${describeElement(el)} matches more than one bind: rule; the first one is used.`); return; }
      if (!controls.size) listen(true);
      controls.set(el, new Binder(el as Control, kind, spec));
      runtimeStats.sources++;
    },
    remove(el) {
      const b = controls.get(el);
      if (!b || b.spec !== spec) return;
      b.dispose();
      controls.delete(el);
      runtimeStats.sources--;
      if (!controls.size) listen(false);
    },
  };
}

// Feature runtime (src/features): the parser and the engine find it here.
runtimes.bind = bindWatcher;
