// Value expressions: the initial value in `--x: state(...)` and the value in `set(--x, ...)`.
//
// Context rule: Reactive CSS evaluates attr(), pick() and split() only in these two positions.
// Everywhere else (content: attr(data-label), --x: attr(data-x), if(), calc()...) they are the
// browser's own functions and are never touched.
//
//   literal                     state(false), set(--n, 2), set(--msg, "Hi")
//   attr(name [, fallback])     the attribute of the element that evaluates the expression:
//                               the state owner for state(), the element with on: for set().
//                               A string; with a non-string fallback (0.9.0: attr(aria-expanded,
//                               false)) the attribute is read as that type, and a missing or
//                               invalid value gives the fallback. Missing: the fallback, else "".
//   pick(a, b, ...)             one of the values, at random, each time it is evaluated
//   pick(split(s, "|"))         one entry of a string split at a delimiter
//
// split() makes a transient list that only pick() consumes: state stays scalar. Entries are
// trimmed and empty entries dropped. A pick() with nothing to pick has no value: set() then
// changes nothing, and state() starts as "".
// Attribute values are data: they become one escaped CSS string, never syntax or actions.

import { tokenize, matching, type Token } from '../core/tokenizer';
import { parseTyped, type Typed } from './values';

export type Expr =
  | { k: 'lit'; t: Typed }
  | { k: 'attr'; name: string; fallback: Typed }
  | { k: 'pick'; items: Expr[] }
  | { k: 'split'; of: Expr; sep: string };

/** HTML attribute names (data-*, aria-*, title...); no selectors, no namespaces. */
const ATTR_NAME = /^[a-z_][\w.-]*$/i;

function call(text: string): { name: string; args: string[] } | undefined {
  const toks = tokenize(text);
  const first = toks.findIndex((t) => t.type !== 'ws' && t.type !== 'comment');
  const f = toks[first];
  if (f?.type !== 'function') return undefined;
  const close = matching(toks, first);
  if (toks.slice(close + 1).some((t) => t.type !== 'ws' && t.type !== 'comment')) return undefined;
  const args: string[] = [];
  let from = f.end;
  for (let j = first + 1; j < close; j++) {
    const t: Token = toks[j];
    if (t.type === 'function' || t.type === '(' || t.type === '[') j = matching(toks, j);
    else if (t.type === ',') { args.push(text.slice(from, t.start)); from = t.end; }
  }
  args.push(text.slice(from, toks[close].start));
  return { name: f.value, args: args.length === 1 && !args[0].trim() ? [] : args };
}

function stringLiteral(text: string, what: string): string {
  const t = parseTyped(text);
  if (t.type !== 'string') throw new Error(`${what} must be a quoted string, got ${text.trim()}`);
  return t.v as string;
}

/** Functions evaluated by Reactive CSS inside state(...) and set(); everywhere else they are native. */
export const EXPRESSIONS = ['attr', 'pick', 'split'];

/** Parses an expression; plain values go through parseTyped() as before. */
export function parseExpr(text: string, top = true): Expr {
  const c = call(text);
  if (!c || !EXPRESSIONS.includes(c.name)) return { k: 'lit', t: parseTyped(text) };
  if (c.name === 'attr') {
    if (c.args.length < 1 || c.args.length > 2) throw new Error('expected attr(name) or attr(name, "fallback")');
    const name = c.args[0].trim();
    if (!ATTR_NAME.test(name))
      throw new Error(`attr(${name}): expected an attribute name like data-message (typed attr(name type(...)) is not supported in state() and set())`);
    if (c.args[1] !== undefined && /[(,]/.test(c.args[1])) throw new Error('the attr() fallback must be one value, e.g. attr(data-n, 0)');
    return { k: 'attr', name: name.toLowerCase(), fallback: c.args[1] === undefined ? { type: 'string', v: '' } : parseTyped(c.args[1]) };
  }
  if (c.name === 'split') {
    if (top) throw new Error('split() makes a list; use it inside pick(), e.g. pick(split(attr(data-options), "|"))');
    if (c.args.length !== 2) throw new Error('expected split(text, "delimiter")');
    const of = parseExpr(c.args[0], false);
    if (of.k === 'pick' || of.k === 'split' || (of.k === 'lit' && of.t.type !== 'string'))
      throw new Error('split() splits a quoted string or attr()');
    const sep = stringLiteral(c.args[1], 'the split() delimiter');
    if (!sep) throw new Error('the split() delimiter must not be empty');
    return { k: 'split', of, sep };
  }
  if (!c.args.length) throw new Error('pick() needs at least one value');
  const items = c.args.map((a) => parseExpr(a, false));
  if (items.some((e) => e.k === 'split') && items.length > 1) throw new Error('split() must be the only argument of pick()');
  if (items.some((e) => e.k === 'pick')) throw new Error('pick() cannot be nested');
  const types = new Set(items.map((e) => (e.k === 'lit' ? e.t.type : e.k === 'attr' ? e.fallback.type : 'string')));
  if (types.size > 1) throw new Error('pick() values must all have the same type (attr() and split() give strings)');
  return { k: 'pick', items };
}

/** True when evaluating `e` reads the DOM (attributes). */
export const readsAttributes = (e: Expr): boolean =>
  e.k === 'attr' || (e.k === 'pick' && e.items.some(readsAttributes)) || (e.k === 'split' && readsAttributes(e.of));

/**
 * Controls whose values CSS must never see: with bind: or attr() and a conditional url(),
 * injected CSS could otherwise read a password or card number. Shared by bind: and attr().
 */
const SENSITIVE = /^(current-password|new-password|one-time-code|cc-|webauthn)/i;
export function sensitive(el: Element) {
  return (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'password')
    // The attribute, not the IDL property: Firefox's .autocomplete is "" for tokens it does not know (one-time-code).
    || el.getAttribute('autocomplete')?.split(/\s+/).some((t) => SENSITIVE.test(t));
}

function attribute(e: Extract<Expr, { k: 'attr' }>, el: Element): Typed {
  const raw = sensitive(el) ? null : el.getAttribute(e.name);
  if (raw === null) return e.fallback;
  if (e.fallback.type === 'string') return str(raw);
  // A typed fallback: the attribute must hold a value of that type (a keyword must be an identifier).
  try {
    const t = parseTyped(raw);
    return t.type === e.fallback.type && (t.type !== 'value' || /^-?[a-z_][\w-]*$/i.test(t.v as string)) ? t : e.fallback;
  } catch { return e.fallback; }
}

const str = (v: string): Typed => ({ type: 'string', v });

function list(e: Expr, el: Element): Typed[] {
  if (e.k === 'split') {
    const s = scalar(e.of, el);
    if (!s) return [];
    return (s.v as string).split(e.sep).map((x) => x.trim()).filter(Boolean).map(str);
  }
  const v = scalar(e, el);
  return v ? [v] : [];
}

function scalar(e: Expr, el: Element): Typed | undefined {
  switch (e.k) {
    case 'lit': return e.t;
    case 'attr': return attribute(e, el);
    case 'split': return undefined; // a list is never a value
    case 'pick': {
      const all = e.items.flatMap((x) => list(x, el));
      return all.length ? all[Math.floor(Math.random() * all.length)] : undefined;
    }
  }
}

/** The value of `e` for element `el`; undefined when it has none (an empty pick()). */
export const evaluate = scalar;
