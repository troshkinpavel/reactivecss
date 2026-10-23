// typed(): `--x: typed(0deg)` or `--x: typed(0, "<length>")` registers --x as a typed custom
// property (CSS.registerProperty, inherits: true like an unregistered property) and leaves a
// plain `--x: 0deg` declaration. Experimental: registrations are document-wide and permanent.
// Never overrides a native @property rule for the same name. See docs/api-0.3.md.

import { warn, dev, probes } from '../core/log';
import { runtimes } from '../core/registry';

const LENGTH = new Set(['px', 'cm', 'mm', 'q', 'in', 'pt', 'pc', 'em', 'rem', 'ex', 'rex', 'ch', 'rch', 'cap', 'rcap', 'ic', 'ric', 'lh', 'rlh',
  'vw', 'vh', 'vi', 'vb', 'vmin', 'vmax', 'svw', 'svh', 'lvw', 'lvh', 'dvw', 'dvh', 'cqw', 'cqh', 'cqi', 'cqb', 'cqmin', 'cqmax']);
const UNIT_SYNTAX: Record<string, string> = { deg: '<angle>', rad: '<angle>', grad: '<angle>', turn: '<angle>', s: '<time>', ms: '<time>', dpi: '<resolution>', dpcm: '<resolution>', dppx: '<resolution>', x: '<resolution>', '%': '<percentage>' };
const COLOR_FN = /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(/i;

/** Syntax for a value, or undefined when it cannot be inferred safely. Pure except named colors. */
export function inferSyntax(value: string): string | undefined {
  const v = value.trim();
  const m = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?([a-z%]*)$/i.exec(v);
  if (m) {
    const unit = m[1].toLowerCase();
    if (!unit) return '<number>'; // 0 is a number unless you say "<length>"
    return LENGTH.has(unit) ? '<length>' : UNIT_SYNTAX[unit];
  }
  if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) || COLOR_FN.test(v)) return '<color>';
  if (/^[a-z-]+$/i.test(v) && typeof CSS !== 'undefined' && CSS.supports('color', v) && !/^(inherit|initial|unset|revert|revert-layer|currentcolor)$/i.test(v)) return '<color>';
  return undefined;
}

const registered = new Map<string, string>();
if (dev) probes.typedProperties = () => registered.size;

/** Names declared by native @property rules in readable stylesheets. */
function nativeRegistrations(): Set<string> {
  const out = new Set<string>();
  const walk = (rules: CSSRuleList) => {
    for (const r of rules) {
      if (typeof CSSPropertyRule !== 'undefined' && r instanceof CSSPropertyRule) out.add(r.name);
      else if ('cssRules' in r) walk((r as CSSGroupingRule).cssRules);
    }
  };
  for (const sheet of document.styleSheets) {
    try { walk(sheet.cssRules); } catch { /* cross-origin: cannot see it */ }
  }
  return out;
}

export function registerTyped(name: string, initial: string, explicit?: string) {
  const syntax = explicit ?? inferSyntax(initial);
  if (!syntax) {
    warn(`typed(${initial}) for ${name}: cannot infer a type; write it, e.g. ${name}: typed(${initial}, "<length>"). Left as a plain custom property.`);
    return;
  }
  const prev = registered.get(name);
  if (prev) {
    if (prev !== syntax) warn(`typed(): ${name} is already registered as ${prev}; the ${syntax} registration is skipped (registrations are document-wide).`);
    return;
  }
  if (nativeRegistrations().has(name)) {
    warn(`typed(): ${name} has a native @property rule; it is kept and typed() only sets the value.`);
    registered.set(name, 'native');
    return;
  }
  try {
    CSS.registerProperty({ name, syntax, inherits: true, initialValue: initial });
    registered.set(name, syntax);
  } catch (e) {
    const why = (e as DOMException).name === 'InvalidModificationError'
      ? 'it is already registered by a script'
      : `the browser rejects ${initial} as the initial value of ${syntax} (it must not depend on the element, e.g. no em or %)`;
    warn(`typed(): ${name} was not registered: ${why}. Left as a plain custom property.`);
    registered.set(name, 'failed');
  }
}

// Feature runtime (src/features): the parser and the engine find it here.
runtimes.typed = registerTyped;
