// Drag gestures (0.9.0): :on(drag), :on(drag(start | move | end | cancel)). Semantics:
// docs/rfc-v0.9.0-language.md, section 6.
//
// - Idle: one capturing pointerdown listener on the document while drag rules exist; nothing per
//   element, no pointermove listener, no frame callbacks.
// - A pointerdown on (or in) an element with drag rules arms a gesture for that pointer. After
//   3 px of movement the drag starts: pointer capture, then start and move phases. pointerup
//   ends it; pointercancel or a lost capture cancels it (cancel, then end).
// - pointermove, pointerup, pointercancel and lostpointercapture are listened to only while a
//   gesture is armed, and only for the gesture's pointer. Moves run synchronously; the state
//   engine coalesces style writes per frame, so the final position is never dropped.
// - The element's box is read once at pointerdown: local coordinates during the drag are
//   relative to it (no layout read per move, and no feedback when the element moves).

import { runtimes } from '../core/registry';
import { urgently, activation } from '../core/scheduler';
import { note, dev, probes } from '../core/log';
import { preventEvent } from './actions';
import { fireDrag, afterDrag, dragTarget } from './on';
import { describeElement } from './state';
import type { DragInfo } from './actexpr';

const THRESHOLD = 3;

interface Gesture { el: Element; id: number; info: DragInfo; started: boolean }
const gestures = new Map<number, Gesture>();
const dragged = new Set<Element>();
let users = 0;
let preventers = 0;
let moving = false;
const warnedTouch = new WeakSet<Element>();
if (dev) Object.assign(probes, { gestures: () => gestures.size, gestureListeners: () => +moving + (users > 0 ? 1 : 0) });

const opts = (passive: boolean) => ({ capture: true, passive });

function installDown(on: boolean, passive: boolean) {
  document.removeEventListener('pointerdown', onDown, { capture: true });
  if (on) document.addEventListener('pointerdown', onDown, opts(passive));
}

function moveListeners(on: boolean) {
  if (on === moving) return;
  moving = on;
  const m = on ? 'addEventListener' : 'removeEventListener';
  document[m]('pointermove', onMove as EventListener, opts(true));
  document[m]('pointerup', onUp as EventListener, opts(true));
  document[m]('pointercancel', onCancel as EventListener, opts(true));
  document[m]('lostpointercapture', onCancel as EventListener, opts(true));
}

function onDown(e: PointerEvent) {
  if (gestures.has(e.pointerId) || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const el = dragTarget(e.composedPath());
  if (!el || dragged.has(el)) return;
  if (el.matches(':disabled') || el.closest('[inert]')) return;
  if (dev && e.pointerType === 'touch' && !warnedTouch.has(el) && getComputedStyle(el).touchAction === 'auto') {
    warnedTouch.add(el);
    note(`:on(drag) on ${describeElement(el)}: touch-action is auto, so a touch drag scrolls the page and is cancelled. Add touch-action: none (or pan-y / pan-x) to the element.`);
  }
  if (preventers && dragTarget.prevents(el)) preventEvent(el, e);
  const r = el.getBoundingClientRect();
  const info: DragInfo = { startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, rect: r, starts: new Map() };
  gestures.set(e.pointerId, { el, id: e.pointerId, info, started: false });
  dragged.add(el);
  moveListeners(true);
}

function run(g: Gesture, phase: string, e: Event, activate = false) {
  activation.event = activate ? e : null;
  try { urgently(() => fireDrag(g.el, phase, e, g.info)); } finally { activation.event = null; }
}

function end(g: Gesture) {
  gestures.delete(g.id);
  dragged.delete(g.el);
  if (g.started) { try { if (g.el.hasPointerCapture?.(g.id)) g.el.releasePointerCapture(g.id); } catch { /* already released */ } }
  if (!gestures.size) moveListeners(false);
}

/** The element left the document or lost its drag rules: stop without running any phase. */
const gone = (g: Gesture) => !g.el.isConnected || !dragTarget.has(g.el);

function onMove(e: PointerEvent) {
  const g = gestures.get(e.pointerId);
  if (!g) return;
  if (gone(g)) { end(g); return; }
  const d = g.info;
  d.lastX = d.x; d.lastY = d.y;
  d.x = e.clientX; d.y = e.clientY;
  if (!g.started) {
    if (Math.hypot(d.x - d.startX, d.y - d.startY) < THRESHOLD) return;
    g.started = true;
    d.lastX = d.startX; d.lastY = d.startY;
    try { g.el.setPointerCapture(g.id); } catch { /* not an active pointer (synthetic event): moves still arrive on the document */ }
    run(g, 'start', e);
  }
  run(g, 'move', e);
}

function onUp(e: PointerEvent) {
  const g = gestures.get(e.pointerId);
  if (!g) return;
  end(g);
  if (!g.started || gone(g)) return;
  run(g, 'end', e, true);
  // The click that follows a drag runs no :on() rules on the element (the native click is untouched).
  afterDrag.el = g.el;
  setTimeout(() => { if (afterDrag.el === g.el) afterDrag.el = null; });
}

function onCancel(e: PointerEvent) {
  const g = gestures.get(e.pointerId);
  if (!g || (e.type === 'lostpointercapture' && e.target !== g.el)) return;
  end(g);
  if (!g.started || gone(g)) return;
  run(g, 'cancel', e);
  run(g, 'end', e);
}

runtimes.gestures = {
  register(prevent) {
    users++;
    if (prevent) preventers++;
    installDown(true, preventers === 0);
    return () => {
      users--;
      if (prevent) preventers--;
      if (users) { installDown(true, preventers === 0); return; }
      installDown(false, true);
      for (const g of [...gestures.values()]) end(g);
    };
  },
};
