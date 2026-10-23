// Engine: finds stylesheets, compiles the reactive ones into a generated <style> that
// takes the original's place in the cascade, and binds matching elements.

import { compile, hasReactiveSyntax, splitRules, type ReactiveDecl, type ReactiveRule } from './parser';
import { watch, unwatch, stopObserving, afterMutations, type Watcher } from './elements';
import * as scheduler from './scheduler';
import { warn, note, withSource, dev, probes } from './log';
import { config } from './config';
import { stateWatcher } from '../state/state';
import { runtimeStats, refreshers, sheetChangeHooks, runtimes, type Arg, type ArgInstance, type CallNode, type Ctx, type Instance, type SharedSource } from './registry';

// ---- bindings ------------------------------------------------------------------
// Compiled expressions (CallNode trees) are shared by all elements of a rule. Per element we
// keep only mutable state: one Binding (which is also the function context) plus one small
// instance object per reactive call. Static arguments are shared across elements.

type Styled = Element & ElementCSSInlineStyle;

class StaticArg implements ArgInstance {
  constructor(readonly text: string) {}
  get() { return this.text; }
}

class DynamicArg implements ArgInstance {
  constructor(readonly parts: (string | Instance)[]) {}
  get() {
    let s = '';
    for (const p of this.parts) s += typeof p === 'string' ? p : p.get();
    return s;
  }
  reset() { for (const p of this.parts) if (typeof p !== 'string') p.reset?.(); }
  dispose() { for (const p of this.parts) if (typeof p !== 'string') p.dispose?.(); }
}

/** Forwards reset/dispose to argument instances; only created when an argument is dynamic. */
class Composite implements Instance {
  constructor(readonly inst: Instance, readonly args: ArgInstance[]) {}
  get() { return this.inst.get(); }
  reset() { this.inst.reset?.(); for (const a of this.args) a.reset?.(); }
  dispose() { this.inst.dispose?.(); for (const a of this.args) a.dispose?.(); }
}

function argInstance(a: Arg, ctx: Ctx): ArgInstance {
  if (a.parts.every((p) => typeof p === 'string')) return (a.shared ??= new StaticArg(a.parts.join('')));
  if (a.parts.length === 1) return instantiate(a.parts[0] as CallNode, ctx);
  return new DynamicArg(a.parts.map((p) => (typeof p === 'string' ? p : instantiate(p, ctx))));
}

function instantiate(node: CallNode, ctx: Ctx): Instance {
  let args = node.staticArgs;
  if (!args) {
    args = node.args.map((a) => argInstance(a, ctx));
    if (args.some((a) => a.text === undefined)) return new Composite(node.def.create!(ctx, args, node.data), args);
    node.staticArgs = args; // all static: one array for every element
  }
  return node.def.create!(ctx, args, node.data);
}

class Binding implements scheduler.Job, Ctx {
  queued?: boolean;
  dead = false;
  last?: string;
  inst!: Instance;
  constructor(readonly el: Styled, readonly decl: ReactiveDecl) {}
  notify() { if (!this.dead) scheduler.dirty(this); }
  compute() {
    if (this.dead || !this.el.isConnected) return false;
    let v: string;
    try { v = this.inst.get(); } catch (e) {
      warn(`${this.decl.call.name}() failed: ${(e as Error).message}`);
      return false;
    }
    if (v === this.last) return false; // unchanged values are never written
    this.last = v;
    return true;
  }
  write() { this.el.style.setProperty(this.decl.varName, this.last!); }
}

function bind(el: Styled, decl: ReactiveDecl): Binding {
  const b = new Binding(el, decl);
  b.inst = instantiate(decl.call, b);
  scheduler.settleLater(b); // first value in settle(): all reads, then all writes, still in this task
  runtimeStats.bindings++;
  return b;
}

function unbind(b: Binding) {
  b.dead = true; // a queued job is skipped at the next flush
  b.inst.dispose?.();
  b.el.style.removeProperty(b.decl.varName);
  runtimeStats.bindings--;
}

/** Below this many elements, writing each element is always cheaper than an inherited write. */
const SHARED_MIN = 16;

/**
 * One declaration whose value is the same for every element (a SharedSource). The value is
 * computed once per update and written either on each element, or once on the elements'
 * nearest common ancestor when most of that ancestor's subtree is bound. An inherited
 * write restyles the whole subtree, so it only pays off when the subtree is mostly bound
 * (measured: 10k bound elements, 2x less style work; 1 bound element in 10k, 37x more).
 */
class SharedDecl implements scheduler.Job {
  queued?: boolean;
  members = new Set<Styled>();
  value?: string;
  target: Styled | null = null;
  replan = true;
  constructor(readonly decl: ReactiveDecl, readonly source: SharedSource) {}
  notify() { scheduler.dirty(this); }
  add(el: Styled) {
    if (!this.members.size) this.source.subscribe(this);
    this.members.add(el);
    this.replan = true;
    scheduler.dirty(this);
    runtimeStats.bindings++;
  }
  remove(el: Styled) {
    if (!this.members.delete(el)) return;
    runtimeStats.bindings--;
    el.style.removeProperty(this.decl.varName);
    this.replan = true;
    if (this.members.size) { scheduler.dirty(this); return; }
    this.source.unsubscribe(this);
    this.target?.style.removeProperty(this.decl.varName);
    this.target = null;
    this.value = undefined;
  }
  compute() {
    if (!this.members.size) return false;
    const v = this.source.get();
    if (!this.replan && v === this.value) return false;
    this.value = v;
    return true;
  }
  write() {
    const name = this.decl.varName;
    if (this.replan) {
      this.replan = false;
      const old = this.target;
      this.target = this.members.size >= SHARED_MIN ? this.ancestor() : null;
      if (old && old !== this.target) old.style.removeProperty(name);
      if (this.target && !old) for (const el of this.members) if (el !== this.target) el.style.removeProperty(name);
    }
    if (this.target) this.target.style.setProperty(name, this.value!);
    else for (const el of this.members) el.style.setProperty(name, this.value!);
  }
  private ancestor(): Styled | null {
    let lca: Element | null = null;
    for (const el of this.members) {
      if (!lca) lca = el;
      else while (lca && !lca.contains(el)) lca = lca.parentElement;
    }
    if (!lca || !('style' in lca)) return null;
    return lca.getElementsByTagName('*').length + 1 <= 2 * this.members.size ? (lca as Styled) : null;
  }
}

function ruleWatcher(rule: ReactiveRule): Watcher {
  const bound = new WeakMap<Element, Binding | Binding[]>();
  const shared = rule.decls.map((d) => {
    const src = d.call.def.shared?.(d.call.data);
    return src ? new SharedDecl(d, src) : null;
  });
  const local = rule.decls.filter((_, i) => !shared[i]);
  return {
    selector: rule.match,
    add(el) {
      if (!('style' in el)) return;
      for (const s of shared) s?.add(el as Styled);
      if (local.length === 1) bound.set(el, bind(el as Styled, local[0]));
      else if (local.length) bound.set(el, local.map((d) => bind(el as Styled, d)));
    },
    remove(el) {
      for (const s of shared) s?.remove(el as Styled);
      const b = bound.get(el);
      if (!b) return;
      if (Array.isArray(b)) b.forEach(unbind);
      else unbind(b);
      bound.delete(el);
    },
  };
}

// ---- stylesheets ---------------------------------------------------------------
// A processed sheet is rewritten in place through the CSSOM (deleteRule / insertRule): the
// same CSSStyleSheet keeps its position in the cascade, its media, disabled and alternate
// state, its URL base, and its entry in document.styleSheets. CSSOM edits are not subject to
// CSP style-src, so this works under strict policies without nonces or 'unsafe-inline'
// (an injected <style> copy was blocked there, and the page lost the whole sheet).

type Source = HTMLStyleElement | HTMLLinkElement;
interface SheetRecord {
  sheet: CSSStyleSheet;
  /** Leading @import / @namespace / @layer statements left untouched. */
  keep: number;
  /** cssText of the rules that were replaced, to restore them. */
  original: string[];
  watchers: Watcher[];
  cleanups: (() => void)[];
}

const records = new Map<Source, SheetRecord>();
if (dev) probes.sheetRecords = () => records.size;
const loads = new WeakMap<Source, object>();

/** Name of a stylesheet for diagnostics. */
export function sheetLabel(el: Source): string {
  if (el instanceof HTMLLinkElement) return el.getAttribute('href') ?? 'a <link>';
  const i = [...document.querySelectorAll('style')].indexOf(el);
  return el.id ? `<style id="${el.id}">` : `inline <style> #${i + 1}`;
}

function readable(href: string, link: HTMLLinkElement): boolean {
  const u = new URL(href, location.href);
  return u.origin === location.origin || u.protocol === 'data:' || u.protocol === 'blob:' || link.crossOrigin !== null;
}

/** Pending linkSheet() wait per link: a newer load releases the older one. */
const waits = new WeakMap<HTMLLinkElement, () => void>();

/** The link's CSSStyleSheet once the browser has loaded (or failed to load) it. */
function linkSheet(el: HTMLLinkElement): Promise<CSSStyleSheet | null> {
  // After an href change, el.sheet can still be the previous URL's sheet until the browser loads
  // the new one: compiling into it would be lost (0.8.0 fix). Wait for the load event then.
  const noHash = (u: string | null) => u?.replace(/#.*$/, '');
  if (el.sheet && noHash(el.sheet.href) === noHash(el.href)) return Promise.resolve(el.sheet);
  // A disabled link fires neither event until enabled; without this, every href change while
  // disabled added two listeners (and kept the fetched text), and "error" stayed after a load.
  waits.get(el)?.();
  return new Promise((res) => {
    const done = () => {
      el.removeEventListener('load', done);
      el.removeEventListener('error', done);
      if (waits.get(el) === done) waits.delete(el);
      res(el.sheet);
    };
    waits.set(el, done);
    el.addEventListener('load', done);
    el.addEventListener('error', done);
  });
}

async function load(el: Source) {
  const token = {};
  loads.set(el, token);
  let text: string;
  let base: string | undefined;
  if (el instanceof HTMLLinkElement) {
    if (!el.href) return;
    if (!readable(el.href, el)) {
      // Fetching every third-party sheet (fonts, CDNs) would cost requests for nothing.
      note(`Skipped cross-origin stylesheet ${el.href}. If it contains Reactive CSS, serve it with CORS and add the crossorigin attribute to the <link>.`);
      drop(el);
      return;
    }
    try {
      const res = await fetch(el.href, { credentials: el.crossOrigin === 'use-credentials' ? 'include' : 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = await res.text();
    } catch (e) {
      if (loads.get(el) === token)
        warn(`Cannot read stylesheet ${el.href} (${(e as Error).message}). Reactive CSS needs the stylesheet source: serve the page over http(s), and cross-origin sheets with CORS and the crossorigin attribute. If a Content-Security-Policy is set, connect-src must allow the stylesheet URL.`);
      return;
    }
    base = el.href;
    await linkSheet(el);
  } else text = el.textContent ?? '';
  if (loads.get(el) !== token || !el.isConnected) return;
  apply(el, text, base);
}

function apply(el: Source, text: string, base: string | undefined) {
  drop(el);
  if (!hasReactiveSyntax(text)) return;
  const label = sheetLabel(el);
  const sheet = el.sheet;
  if (!sheet) {
    warn(`${label}: the browser did not apply this stylesheet (blocked or failed to load), so its Reactive CSS is not processed.`);
    return;
  }
  const t0 = performance.now();
  // Behavior (on:, bind:) only from trusted sources: same-origin, and inline unless disabled by config.
  const trusted = base ? new URL(base).origin === location.origin : config().trustInlineStyles !== false;
  const c = withSource(label, () => compile(text, { baseURL: base, trusted }));
  runtimeStats.parseMs += performance.now() - t0;
  if (!c.changed) return;
  const swapped = withSource(label, () => rewrite(sheet, c.css));
  if (!swapped) return;
  const watchers: Watcher[] = [];
  for (const r of c.rules) {
    if (r.states.length) watchers.push(stateWatcher(r.match, r.states));
    if (r.decls.length) watchers.push(ruleWatcher(r));
    // Declaration runtimes come from their feature modules; the parser only emits a rule flag
    // when the runtime is present (otherwise it reports the missing feature).
    if (r.handler !== undefined) watchers.push(runtimes.on!.watcher(r.match, r.handler, r.certain === true, c.handlers.get(r.handler)!, sheet));
    if (r.bind) watchers.push(runtimes.bind!(r.match, r.bind));
    if (r.text) watchers.push(runtimes.text!(r.match));
    if (r.attrs) watchers.push(runtimes.attrs!(r.match, r.attrs));
    if (r.focus) watchers.push(runtimes.focus!(r.match));
    // 0.9.0: :on() rules, state(…, bind(value | checked)).
    if (r.onSpec) watchers.push(runtimes.onRules!.watcher(r.match, r.onSpec, sheet));
    for (const name of r.forms ?? []) watchers.push(runtimes.bind!(r.match, { name }));
  }
  const rec: SheetRecord = { sheet, ...swapped, watchers, cleanups: [] };
  records.set(el, rec);
  runtimeStats.sheets++;
  rec.watchers.forEach(watch); // state owners exist before selector runtimes look for them
  rec.cleanups = [...c.runtime.setup.map((fn) => fn()), ...[...c.handlers].map(([id, set]) => runtimes.on!.register(id, set)),
    ...c.rules.filter((r) => r.onSpec).map((r) => runtimes.onRules!.register(r.onSpec!))];
  scheduler.settle();
  sheetChangeHooks.forEach((fn) => fn());
  scheduler.flush(); // apply initial selector state in this task, not a frame later
}

const LEADING = (r: CSSRule) => r instanceof CSSImportRule || r instanceof CSSNamespaceRule || (typeof CSSLayerStatementRule !== 'undefined' && r instanceof CSSLayerStatementRule);

/** Replaces the sheet's rules with the compiled ones. Returns what is needed to restore them. */
function rewrite(sheet: CSSStyleSheet, css: string): { keep: number; original: string[] } | undefined {
  let rules: CSSRuleList;
  try { rules = sheet.cssRules; } catch {
    warn('the stylesheet rules are not readable (cross-origin without CORS); its Reactive CSS is not processed.');
    return undefined;
  }
  let keep = 0;
  while (keep < rules.length && LEADING(rules[keep])) keep++;
  const original = [...rules].slice(keep).map((r) => r.cssText);
  // Skip only the leading statements (they stay in the sheet, above). A later `@layer a, b;`
  // is an ordinary rule and must be re-inserted, or the layer order changes.
  const all = splitRules(css);
  let lead = 0;
  while (lead < all.length && (/^@(import|namespace|charset)\b/i.test(all[lead]) || /^@layer\b[^{]*;$/i.test(all[lead]))) lead++;
  const parts = all.slice(lead);
  for (let i = rules.length - 1; i >= keep; i--) sheet.deleteRule(i);
  for (const p of parts) {
    // A rule the browser rejects here is one it would also have dropped when parsing the file.
    try { sheet.insertRule(p, sheet.cssRules.length); } catch { /* dropped, like the original parse */ }
  }
  return { keep, original };
}

function drop(el: Source) {
  const rec = records.get(el);
  if (!rec) return;
  records.delete(el);
  rec.watchers.forEach(unwatch);
  rec.cleanups.forEach((fn) => fn());
  // Restore the original rules if the same sheet is still attached (not replaced or removed).
  if (el.isConnected && el.sheet === rec.sheet) {
    for (let i = rec.sheet.cssRules.length - 1; i >= rec.keep; i--) rec.sheet.deleteRule(i);
    for (const t of rec.original) {
      try { rec.sheet.insertRule(t, rec.sheet.cssRules.length); } catch { /* serialized by the browser: valid */ }
    }
  }
  runtimeStats.sheets--;
  sheetChangeHooks.forEach((fn) => fn());
}

let sourceObserver: MutationObserver | undefined;

const sources: Watcher = {
  // Alternate and disabled sheets are processed too: they keep their native on/off state.
  selector: 'style, link[rel~="stylesheet" i]',
  add(el) {
    sourceObserver!.observe(el, el instanceof HTMLLinkElement
      // disabled: the browser drops the sheet, and loads a fresh, unprocessed one when re-enabled;
      // media: what applies changes. Both are reprocessed like an href change (0.7.1).
      ? { attributes: true, attributeFilter: ['href', 'disabled', 'media'] }
      : { childList: true, characterData: true, subtree: true });
    load(el as Source);
  },
  remove(el) {
    loads.delete(el as Source);
    drop(el as Source);
  },
  // A moved <style> or <link> gets a new CSSStyleSheet from its original source: process it again.
  move(el) { load(el as Source); },
};

// ---- public API ----------------------------------------------------------------

let started = false;

/** Processes all current and future stylesheets. Safe to call more than once. */
export function start(): void {
  if (started || typeof document === 'undefined') return;
  started = true;
  sourceObserver = new MutationObserver((recs) => {
    const changed = new Set<Source>();
    for (const r of recs) {
      const n = r.target.nodeType === 1 ? (r.target as Element) : r.target.parentElement;
      const src = n?.closest('style, link');
      if (src) changed.add(src as Source);
    }
    // A disabled link has no sheet any more: release its rules now (its load waits for re-enabling).
    changed.forEach((el) => { if (el instanceof HTMLLinkElement && el.disabled) drop(el); load(el); });
  });
  afterMutations(scheduler.settle);
  watch(sources);
}

/** Stops everything and restores the original stylesheets. */
export function stop(): void {
  if (!started) return;
  started = false;
  unwatch(sources);
  sourceObserver?.disconnect();
  stopObserving();
}

/**
 * Re-reads state that the browser gives no change notification for: programmatic
 * `input.checked = ...` assignments and :nth-var() variables set by stylesheets.
 */
export function refresh(): void {
  refreshers.forEach((fn) => fn());
  scheduler.flush();
}

export function stats() {
  return {
    ...runtimeStats,
    scheduled: scheduler.subscriptionCount(),
    intervals: scheduler.groupCount(),
    ...scheduler.counters,
    ...(dev ? { internal: Object.fromEntries(Object.entries(probes).map(([k, f]) => [k, f()])) } : {}),
  };
}
