// state(initial, bind(attribute)) runtime: part of the attributes feature (see bindattr.ts for
// the semantics and the compile-time allowlist, which is core).

import { fmt } from '../core/format';
import { warn } from '../core/log';
import { ownedAttributes } from '../core/elements';
import { runtimes } from '../core/registry';
import type { Typed } from './values';
import { ARIA_CURRENT, NUMBER, IDENT, TABINDEX, type AttrBind, type BoundAttribute } from './bindattr';

/** The state value for an attribute value: undefined when absent, 'invalid' when not acceptable. */
function parse(b: AttrBind, raw: string | null, like: Typed): Typed | undefined | 'invalid' {
  if (b.kind === 'boolean') return raw === null ? undefined : { type: 'boolean', v: true }; // presence is true, whatever the value
  if (raw === null) return undefined;
  const bool = (): Typed | 'invalid' => (raw === 'true' || raw === 'false' ? { type: 'boolean', v: raw === 'true' } : 'invalid');
  if (b.kind === 'aria-boolean') return bool();
  if (b.kind === 'aria-number') return NUMBER.test(raw) ? { type: 'number', v: +raw, unit: '' } : 'invalid';
  if (b.kind === 'aria-tristate') {
    if (raw === 'mixed') return like.type === 'boolean' ? 'invalid' : { type: like.type, v: raw };
    const t = bool();
    return t !== 'invalid' && like.type !== 'boolean' ? { type: like.type, v: raw } : t;
  }
  if (b.kind === 'tabindex') return TABINDEX.has(raw.trim()) ? { type: 'number', v: +raw, unit: '' } : 'invalid';
  if (b.kind === 'aria-current') {
    if (like.type === 'boolean') return bool();
    return ARIA_CURRENT.has(raw) ? { type: like.type, v: raw } : 'invalid';
  }
  switch (like.type) {
    case 'boolean': return bool();
    case 'number': return NUMBER.test(raw) ? { type: 'number', v: +raw, unit: '' } : 'invalid';
    case 'dimension': {
      const u = like.unit ?? '';
      const n = raw.toLowerCase().endsWith(u) ? raw.slice(0, raw.length - u.length) : '';
      return NUMBER.test(n) ? { type: 'dimension', v: +n, unit: u } : 'invalid';
    }
    case 'string': return { type: 'string', v: raw };
    // A keyword state is written into CSS as is: only an identifier is safe (no url(), no ";").
    case 'value': return IDENT.test(raw) ? { type: 'value', v: raw } : 'invalid';
  }
}

/** Attribute text for a state value: null removes the attribute; undefined means not representable. */
function serializeAttr(b: AttrBind, v: Typed): string | null | undefined {
  if (b.kind === 'boolean') return v.type === 'boolean' ? (v.v ? '' : null) : undefined; // never disabled="false"
  if (b.kind === 'tabindex') return v.type === 'number' && TABINDEX.has(String(v.v)) ? String(v.v) : undefined;
  if (v.type === 'boolean') return v.v ? 'true' : 'false'; // ARIA needs an explicit "false"
  if (b.kind === 'aria-boolean') return undefined;
  if (b.kind === 'aria-number') return v.type === 'number' ? fmt(v.v as number) : undefined;
  if (b.kind === 'aria-tristate') return ['true', 'false', 'mixed'].includes(String(v.v)) ? String(v.v) : undefined;
  if (b.kind === 'aria-current') return ARIA_CURRENT.has(String(v.v)) ? String(v.v) : undefined;
  if (v.type === 'number' || v.type === 'dimension') return fmt(v.v as number) + (v.unit ?? '');
  return String(v.v);
}

const describe = (el: Element) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].join('.') : '');
const DISABLEABLE = /^(button|input|select|textarea|fieldset|optgroup|option)$/i;
const REQUIRABLE = /^(input|select|textarea)$/i;

export class AttrBinding implements BoundAttribute {
  /** The attribute before Reactive CSS wrote it (null: absent). */
  readonly original: string | null;
  /** What Reactive CSS last left in the attribute; undefined before the first write. */
  private written?: string | null;
  private warnedForeign = false;

  constructor(readonly el: Element, readonly b: AttrBind) {
    this.original = el.getAttribute(b.name);
    let names = ownedAttributes.get(el);
    if (!names) ownedAttributes.set(el, (names = new Map()));
    names.set(b.name, this); // a state binding always owns its attribute; attr: yields to it
    if (b.name === 'disabled' && !DISABLEABLE.test(el.tagName)) warn(`bind(disabled) on ${describe(el)}: disabled only affects form controls (button, input, select, textarea, fieldset…); the attribute is set but changes nothing natively.`);
    if (b.name === 'required' && !REQUIRABLE.test(el.tagName)) warn(`bind(required) on ${describe(el)}: required only affects input, select and textarea.`);
  }

  get name() { return this.b.name; }

  /** The initial state from the original attribute, or `fallback` (with a diagnostic when invalid). */
  initial(fallback: Typed): Typed {
    const v = parse(this.b, this.original, fallback);
    if (v === 'invalid') {
      warn(`${this.b.name}="${this.original}" on ${describe(this.el)} is not a valid value for this state; using the state() initial value and rewriting the attribute.`);
      return fallback;
    }
    return v ?? fallback;
  }

  /** Writes the state to the attribute (only when its text changes). */
  write(v: Typed) {
    const s = serializeAttr(this.b, v);
    if (s === undefined) {
      warn(`${this.b.name} on ${describe(this.el)} cannot hold the value ${String(v.v)}; the attribute is left unchanged.`);
      return;
    }
    const el = this.el, name = this.b.name;
    const current = el.getAttribute(name);
    if (this.written !== undefined && current !== this.written && !this.warnedForeign) {
      this.warnedForeign = true;
      warn(`${name} on ${describe(el)} was changed by something else; Reactive CSS does not read it back, and overwrites it with the state on every change.`);
    }
    if (this.b.kind === 'boolean') {
      // Presence only: an existing value (e.g. hidden="until-found") is kept while true.
      if ((current !== null) !== (s !== null)) el.toggleAttribute(name, s !== null);
    } else if (s === null) { if (current !== null) el.removeAttribute(name); }
    else if (current !== s) el.setAttribute(name, s);
    this.written = el.getAttribute(name);
  }

  /** Restores the original attribute, unless something else changed it since our last write. */
  release() {
    const names = ownedAttributes.get(this.el);
    if (names?.get(this.b.name) === this) names.delete(this.b.name);
    if (this.written === undefined || this.el.getAttribute(this.b.name) !== this.written) return;
    if (this.original === null) this.el.removeAttribute(this.b.name);
    else this.el.setAttribute(this.b.name, this.original);
  }
}

runtimes.attrBinding = (el, b) => new AttrBinding(el, b);
