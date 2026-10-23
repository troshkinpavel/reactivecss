// :blur (0.9.0): matches an element from a genuine focus loss until it is focused again.
// Semantics: docs/rfc-v0.9.0-language.md, section 10.
//
// - Never matches an element that has not lost focus (nothing on page load), unlike :not(:focus).
// - The element's own blur event sets a marker attribute; its next focus event removes it, so an
//   animation on :blur plays once per focus loss and restarts on the next one. No timers.
// - Only elements matched by a :blur rule's compound get the marker (one watcher per rule), and
//   the listeners exist only while such a rule is live.

import { defineSelector } from '../core/registry';
import { watch, unwatch, type Watcher } from '../core/elements';

export const BLURRED = 'data-rcss-blur';

/** Elements matched by a :blur compound, with the number of rules that match them. */
const members = new Map<Element, number>();
let users = 0;

function onBlur(e: Event) {
  const el = e.target;
  if (el instanceof Element && members.has(el)) el.setAttribute(BLURRED, '');
}
function onFocus(e: Event) {
  const el = e.target;
  if (el instanceof Element && el.hasAttribute(BLURRED)) el.removeAttribute(BLURRED);
}

function install(compound: string): () => void {
  const w: Watcher = {
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
  watch(w);
  return () => {
    unwatch(w);
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
    if (!compound.replace(/:is\(\*\)/g, '').trim())
      throw new Error(':blur needs a type, class or attribute selector on the same element, e.g. input:blur');
    sheet.setup.push(() => install(compound));
    return `[${BLURRED}]`; // same specificity as a pseudo-class
  },
});
