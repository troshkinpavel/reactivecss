// focus: <value> (experimental, 0.6.0): moves focus to the matched element when its value goes
// from false to true because of a user action. Semantics: docs/rfc-focus-declaration-0.6.md.
//
// - Compiled to `--rcss-focus: <value>` (registered, non-inherited): the cascade picks the winner.
// - Transition only: the first read (load, insertion, a new rule) records the value silently; a
//   true value read again never refocuses.
// - Armed only by state changes made during a trusted click, keydown, input or change (actions and
//   bound controls). Scripts, timers, form reset, focus events and outside() never move focus, so
//   focus → focusin → state → focus cannot cycle.
// - Resolved after a late phase (after the state's CSS, attr: and text: writes): the first eligible
//   target in document order gets focus; nothing is retried, the library never adds tabindex.

import { late, onAfterLate, activation, type Job } from '../core/scheduler';
import { warn, note, dev, probes } from '../core/log';
import { runtimeStats, refreshers, sheetChangeHooks, runtimes } from '../core/registry';
import type { Watcher } from '../core/elements';
import { stateChangeHooks, describeElement, within } from './state';
import { textOf } from './textof';
import { hasReactiveSyntax } from '../core/parser';

const PROP = '--rcss-focus';
// pointerup and submit (0.9.0) arm requests from :on(pointerup), :on(submit) and drag end; no 0.8 trigger uses them.
const ARMING = new Set(['click', 'keydown', 'input', 'change', 'pointerup', 'submit']);
const bindings = new Map<Element, FocusBinding>();
/** Bindings armed by the current activation; disarmed when it is resolved. */
const armed = new Set<FocusBinding>();
let candidates: FocusBinding[] = [];
/** The keydown that armed the pending request, if any (see resolve()). */
let keyArm: KeyboardEvent | null = null;
/**
 * The key press continues after keydown: Enter and printable keys get a keypress, which activates
 * a focused button or link (Enter) or types into a focused field. A prevented keydown has none.
 */
const pressContinues = (e: KeyboardEvent | null) => !!e && !e.defaultPrevented && (e.key === 'Enter' || [...e.key].length === 1);
let registered = false;
if (dev) probes.focusBindings = () => bindings.size;

class FocusBinding implements Job {
  queued?: boolean;
  rules = 0;
  dead = false;
  /** Last value read; undefined before the first read (which never focuses). */
  last?: boolean;
  /** The focused element when the activating event changed the state. */
  activeAtArm: Element | null = null;
  /** The activating event's target (a click need not focus anything, e.g. buttons in WebKit). */
  originAtArm: Element | null = null;
  constructor(readonly el: Element) {}

  compute() {
    if (this.dead || !this.el.isConnected) return false;
    const raw = getComputedStyle(this.el).getPropertyValue(PROP);
    const t = textOf(raw);
    let v = t === 'true' || t === '1';
    if (t !== null && !v && t !== 'false' && t !== '0') {
      if (hasReactiveSyntax(raw)) return false; // another sheet is not compiled yet: read again after it (no transition recorded)
      warn(`focus: on <${this.el.localName}> needs true or false (1 or 0), not ${raw.trim().slice(0, 60)}; it counts as false.`);
      v = false;
    }
    if (this.last === false && v && armed.has(this)) candidates.push(this);
    this.last = v;
    return false; // no DOM writes in the late phase: focus is resolved after it
  }

  write() {}

  dispose() {
    this.dead = true;
    armed.delete(this);
  }
}

/** Arms a request when the state change comes from trusted user activation. */
function arm(b: FocusBinding) {
  const e = activation.event;
  if (!e || !e.isTrusted || !ARMING.has(e.type)) return;
  if (!armed.has(b)) { armed.add(b); b.activeAtArm = document.activeElement; b.originAtArm = e.target instanceof Element ? e.target : null; }
  if (e instanceof KeyboardEvent) keyArm = e;
}

const isOpenLayer = (el: Element) => (el instanceof HTMLDialogElement && el.open) || (el.hasAttribute('popover') && el.matches(':popover-open'));

/**
 * Moves focus to the first eligible candidate (document order); see the RFC, rules 5–8.
 * When the arming key press continues (pressContinues), the request waits for the frame: focusing
 * during the keydown would send the rest of the press to the new element, so Enter in a field
 * would also click the button it moved focus to, and a shortcut letter would be typed into the
 * field it focused.
 */
function resolve(sameTask: boolean) {
  if (sameTask && pressContinues(keyArm)) return; // the frame flush that urgently() requested resolves it
  keyArm = null;
  // b.last: a later event in the same frame may have turned an earlier candidate false again.
  const list = candidates.filter((b) => !b.dead && b.el.isConnected && b.last);
  candidates = [];
  try { pick(list); } finally {
    for (const b of armed) b.activeAtArm = b.originAtArm = null;
    armed.clear();
  }
}

function pick(list: FocusBinding[]) {
  list.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  for (const b of list) {
    const el = b.el as HTMLElement;
    const active = document.activeElement;
    // The user moved focus elsewhere before this resolution: leave it there.
    if (active && active !== document.body && b.activeAtArm && active !== b.activeAtArm) return;
    if (active && (active === el || el.contains(active))) return; // already there
    // A dialog or popover that has focus, or that the user acted in, manages its own focus.
    for (const start of [active, b.originAtArm])
      for (let a: Element | null = start; a && a !== document.body; a = a.parentElement)
        if (isOpenLayer(a) && !a.contains(el)) return;
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true } as CheckVisibilityOptions)) { note(`focus: ${describeElement(el)} is not rendered when its state applies; focus is unchanged.`); continue; }
    if (el.closest('[inert]') || el.matches(':disabled')) { note(`focus: ${describeElement(el)} is ${el.matches(':disabled') ? 'disabled' : 'inert'}; focus is unchanged.`); continue; }
    el.focus();
    if (document.activeElement === el) return;
    warn(el.hasAttribute('tabindex') || el.matches('a[href], button, input, select, textarea, summary, [contenteditable]')
      ? `focus: ${describeElement(el)} did not take focus (inert, inside a modal dialog, or not focusable here); focus is unchanged.`
      : `focus: ${describeElement(el)} is not focusable. Give it tabindex="-1" in the HTML (Reactive CSS never adds tabindex).`);
  }
}

function register() {
  if (registered) return;
  registered = true;
  try { CSS.registerProperty({ name: PROP, syntax: '*', inherits: false }); } catch (e) {
    if (!(e instanceof DOMException && e.name === 'InvalidModificationError'))
      warn('focus: needs CSS.registerProperty() (Chrome 78+, Safari 16.4+, Firefox 128+); a focus: rule on an element would also apply to its descendants.');
  }
  stateChangeHooks.add((c) => within(bindings, c.owner, (b) => { arm(b); late(b); }));
  refreshers.add(() => bindings.forEach((b) => late(b)));
  sheetChangeHooks.add(() => bindings.forEach((b) => late(b)));
  onAfterLate(resolve);
}

/** Watcher for a rule with `focus:`. */
export function focusWatcher(match: string): Watcher {
  register();
  return {
    selector: match,
    add(el) {
      let b = bindings.get(el);
      if (!b) { bindings.set(el, (b = new FocusBinding(el))); runtimeStats.bindings++; }
      b.rules++;
      late(b);
    },
    remove(el) {
      const b = bindings.get(el);
      if (!b || --b.rules) { if (b) late(b); return; }
      bindings.delete(el);
      runtimeStats.bindings--;
      b.dispose();
    },
  };
}

// Feature runtime (src/features): the parser and the engine find it here.
runtimes.focus = focusWatcher;
