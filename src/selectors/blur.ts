// :blur (0.9.0): matches an element from a genuine focus loss until it is focused again.
// Semantics: docs/rfc-v0.9.0-language.md, section 10.
//
// - Never matches an element that has not lost focus (nothing on page load), unlike :not(:focus).
// - The element's own blur event sets a marker attribute; its next focus event removes it, so an
//   animation on :blur plays once per focus loss and restarts on the next one. No timers.
// - Only elements matched by a :blur rule's compound get the marker (one watcher per rule); a bare
//   :blur (for example .form:has(:blur)) marks any element that loses focus. The listeners exist
//   only while such a rule is live.

import { defineSelector } from '../core/registry';
import { watch, unwatch, type Watcher } from '../core/elements';

export const BLURRED = 'data-rcss-blur';

/** Elements matched by a :blur compound, with the number of rules that match them. */
const members = new Map<Element, number>();
let users = 0;
/** Rules with a bare :blur (e.g. .form:has(:blur)): every element that loses focus is marked. */
let anywhere = 0;

function onBlur(e: Event) {
  const el = e.target;
  if (el instanceof Element && (anywhere || members.has(el))) el.setAttribute(BLURRED, '');
}
function onFocus(e: Event) {
  const el = e.target;
  if (el instanceof Element && el.hasAttribute(BLURRED)) el.removeAttribute(BLURRED);
}

function install(compound: string | null): () => void {
  const w: Watcher | null = compound === null ? null : {
    selector: compound,
    add: (el) => { members.set(el, (members.get(el) ?? 0) + 1); },
    remove: (el) => {
      const n = (members.get(el) ?? 1) - 1;
      if (n) { members.set(el, n); return; }
      members.delete(el);
      el.removeAttribute(BLURRED);
    },
  };
  if (users++ === 0) {
    document.addEventListener('blur', onBlur, true);
    document.addEventListener('focus', onFocus, true);
  }
  if (w) watch(w); else anywhere++;
  return () => {
    if (w) unwatch(w);
    else if (!--anywhere) document.querySelectorAll(`[${BLURRED}]`).forEach((el) => { if (!members.has(el)) el.removeAttribute(BLURRED); });
    if (--users) return;
    document.removeEventListener('blur', onBlur, true);
    document.removeEventListener('focus', onFocus, true);
  };
}

defineSelector({
  name: 'blur',
  kind: 'state',
  functional: false,
  syntax: ':blur',
  compile(_arg, compound, sheet) {
    // A bare :blur (inside :has(), or alone) can match any element: no watcher, any blurred element is marked.
    const bare = !compound.replace(/:is\(\*\)/g, '').trim();
    sheet.setup.push(() => install(bare ? null : compound));
    return `[${BLURRED}]`; // same specificity as a pseudo-class
  },
});
