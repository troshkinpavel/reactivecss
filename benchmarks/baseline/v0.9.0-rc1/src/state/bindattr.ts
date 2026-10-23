// state(initial, bind(attribute)) (experimental, 0.5.2): one state mirrored to one allowlisted
// HTML attribute of the element that owns it.
//
// - Attribute → state once, when the state is created: a valid attribute value initializes it;
//   a missing one leaves the state() initial value; an invalid one is reported and ignored.
// - State → attribute on every change, synchronously (the DOM never lags the state, so a
//   `disabled` written by one click is in place before the next event is dispatched).
// - Later changes made by other scripts are not read back; the next state change overwrites
//   them (reported once). When the state goes away, the original attribute is restored, but only
//   if it still holds what Reactive CSS last wrote.
// - Only the attributes below, with their HTML/ARIA semantics. Values are set with
//   setAttribute(), never parsed as markup. Element manager re-matching ignores bound attributes,
//   so writes cannot feed back into selector matching.

import type { Typed } from './values';

export type AttrKind = 'aria-boolean' | 'aria-current' | 'boolean' | 'data' | 'tabindex' | 'aria-tristate' | 'aria-number' | 'text';
export interface AttrBind { name: string; kind: AttrKind }

// 0.9.0 adds aria-hidden, aria-busy, aria-invalid (true / false), aria-checked (true / false / mixed),
// aria-valuenow (a number), aria-label and aria-valuetext (text, like data-*).
const ARIA_BOOLEAN = new Set(['aria-expanded', 'aria-pressed', 'aria-selected', 'aria-disabled', 'aria-hidden', 'aria-busy', 'aria-invalid']);
const ARIA_TEXT = new Set(['aria-label', 'aria-valuetext']);
/** tabindex: only 0 and -1 (roving tabindex); positive values would reorder the page's Tab order. */
export const TABINDEX = new Set(['0', '-1']);
const HTML_BOOLEAN = new Set(['disabled', 'hidden', 'required']);
export const ARIA_CURRENT = new Set(['page', 'step', 'location', 'date', 'time', 'true', 'false']);
/** Lower-case data-* names (HTML lower-cases attribute names). */
const DATA = /^data-[a-z0-9_.-]+$/;
export const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
export const IDENT = /^-?[a-z_][\w-]*$/i;

export const BINDABLE = 'aria-expanded, aria-pressed, aria-selected, aria-disabled, aria-hidden, aria-busy, aria-invalid, aria-checked, aria-current, aria-valuenow, aria-label, aria-valuetext, disabled, hidden, required, tabindex (0 or -1), data-*';

/** The value semantics of an allowlisted attribute (lower-case name); undefined when not allowed. */
export const kindOf = (name: string): AttrKind | undefined => ARIA_BOOLEAN.has(name) ? 'aria-boolean'
  : name === 'aria-current' ? 'aria-current' : name === 'aria-checked' ? 'aria-tristate' : name === 'aria-valuenow' ? 'aria-number'
  : ARIA_TEXT.has(name) ? 'text' : HTML_BOOLEAN.has(name) ? 'boolean' : name === 'tabindex' ? 'tabindex' : DATA.test(name) ? 'data' : undefined;

/** Compile-time: the binding for `bind(name)`, checked against the initial value's type. */
export function parseBind(text: string, initType: Typed['type'] | 'string' | undefined): AttrBind {
  const m = /^bind\(\s*([^()\s]*)\s*\)$/i.exec(text.trim());
  if (!m) throw new Error(`expected bind(attribute) as the second argument of state(), got "${text.trim()}"`);
  const name = m[1].toLowerCase();
  const kind = kindOf(name);
  if (!kind) throw new Error(`bind(${m[1]}): only ${BINDABLE} can be bound (no event handlers, URLs, style or free text)`);
  if ((kind === 'aria-boolean' || kind === 'boolean') && initType !== 'boolean')
    throw new Error(`bind(${name}) needs a boolean state, e.g. state(false, bind(${name}))`);
  if (kind === 'tabindex' && initType !== 'number')
    throw new Error(`bind(tabindex) needs a number state (0 or -1), e.g. state(-1, bind(tabindex))`);
  if (kind === 'aria-current' && initType !== 'boolean' && initType !== 'value' && initType !== 'string')
    throw new Error(`bind(aria-current) needs a boolean or a token (page, step, location, date, time)`);
  if (kind === 'aria-tristate' && initType !== 'boolean' && initType !== 'value' && initType !== 'string')
    throw new Error(`bind(aria-checked) needs a boolean, or a keyword state that can hold mixed`);
  if (kind === 'aria-number' && initType !== 'number') throw new Error(`bind(aria-valuenow) needs a number state, e.g. state(0, bind(aria-valuenow))`);
  return { name, kind };
}

/** A state's own attribute, kept in sync (implemented by the attributes feature: bindattr-runtime). */
export interface BoundAttribute {
  readonly name: string;
  initial(fallback: Typed): Typed;
  write(v: Typed): void;
  release(): void;
}
