// :just-checked / :just-unchecked
//
// An observed checked-state transition sets a marker attribute on the control; the
// marker stays until the next observed transition of that control. The initial state is
// recorded silently, so nothing matches on page load. Because markers swap on every
// transition, an animation bound to one of them restarts each time; no timers are
// involved, so interrupted or cancelled animations cannot leave a stuck state.
//
// Observed: user interaction (mouse, keyboard, label clicks, i.e. every `change` event),
// radio-group siblings that lose their checked state, and form resets. A script that
// assigns `input.checked` directly fires no event: dispatch a `change` event afterwards
// or call ReactiveCSS.refresh().

import { defineSelector, refreshers } from '../core/registry';
import { watch, unwatch, membersOf, type Watcher } from '../core/elements';

export const CHECKED = 'data-rcss-just-checked';
export const UNCHECKED = 'data-rcss-just-unchecked';

const known = new WeakMap<Element, boolean>();

const controls: Watcher = {
  selector: 'input[type="checkbox" i], input[type="radio" i]',
  add: (el) => known.set(el, (el as HTMLInputElement).checked),
  remove: (el) => known.delete(el), // explicit: keeps the WeakMap table small (see geometry.ts)
};

function check(el: HTMLInputElement, assumedPrevious?: boolean) {
  const prev = known.get(el) ?? assumedPrevious;
  known.set(el, el.checked);
  if (prev === undefined || prev === el.checked) return;
  el.toggleAttribute(CHECKED, el.checked);
  el.toggleAttribute(UNCHECKED, !el.checked);
}

function onChange(e: Event) {
  const el = e.target;
  if (!(el instanceof HTMLInputElement) || (el.type !== 'checkbox' && el.type !== 'radio')) return;
  if (el.type === 'radio' && el.name) {
    const group = el.form ? [...el.form.elements] : [...(el.getRootNode() as ParentNode).querySelectorAll('input')];
    for (const r of group)
      if (r instanceof HTMLInputElement && r.type === 'radio' && r.name === el.name && r.form === el.form && r !== el) check(r);
  }
  check(el, !el.checked); // a change event always means the state flipped
}

function onReset(e: Event) {
  const form = e.target;
  // Reset runs after the event; read the new states once it is done.
  if (form instanceof HTMLFormElement) setTimeout(() => { for (const c of form.elements) if (c instanceof HTMLInputElement) check(c); });
}

const refresh = () => membersOf(controls).forEach((el) => check(el as HTMLInputElement));

let users = 0;
function install(): () => void {
  if (users++ === 0) {
    watch(controls);
    document.addEventListener('change', onChange, true);
    document.addEventListener('reset', onReset, true);
    refreshers.add(refresh);
  }
  return () => {
    if (--users) return;
    membersOf(controls).forEach((el) => { el.removeAttribute(CHECKED); el.removeAttribute(UNCHECKED); });
    unwatch(controls);
    document.removeEventListener('change', onChange, true);
    document.removeEventListener('reset', onReset, true);
    refreshers.delete(refresh);
  };
}

for (const [name, attr] of [['just-checked', CHECKED], ['just-unchecked', UNCHECKED]]) {
  defineSelector({
    name,
    kind: 'state',
    functional: false,
    compile(_arg, _compound, sheet) {
      sheet.setup.push(install);
      return `[${attr}]`; // same specificity as a pseudo-class
    },
  });
}
