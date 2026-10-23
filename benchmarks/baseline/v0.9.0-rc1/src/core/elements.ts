// Element lifecycle. Watchers declare a selector; the manager tells them when an element
// starts or stops matching. One MutationObserver for the document; it only looks at the
// mutated subtrees, never re-queries the whole document per mutation.

import { tokenize } from './tokenizer';
import { warn, dev, probes } from './log';

export interface Watcher {
  selector: string;
  add(el: Element): void;
  remove(el: Element): void;
  /** Element moved inside the document (removed and re-inserted in one batch). Default: ignore. */
  move?(el: Element): void;
}

interface Entry {
  w: Watcher;
  members: Set<Element>;
  sibling: boolean;
  /** Attributes whose change can alter the match ('class', 'id', [attr] names). */
  deps: Set<string>;
}

const entries = new Map<Watcher, Entry>();
/**
 * Attributes Reactive CSS writes (state(…, bind(attribute)) and attr:), with their writer.
 * Their changes never re-match watchers: a written attribute in a reactive rule's selector
 * cannot feed back into which bindings exist (use :when(--state) to style by the state).
 */
export const ownedAttributes = new WeakMap<Element, Map<string, object>>();
if (dev) probes.watchers = () => entries.size;
const memberOf = new WeakMap<Element, Entry[]>(); // arrays: most elements belong to one or two watchers
let observer: MutationObserver | undefined;
let filter = new Set<string>();

const subtree = (root: Element) => [root, ...root.querySelectorAll('*')];

function join(e: Entry, el: Element) {
  if (e.members.has(el)) return;
  e.members.add(el);
  const list = memberOf.get(el);
  if (list) list.push(e);
  else memberOf.set(el, [e]);
  try { e.w.add(el); } catch (err) { warn(`Internal error while binding an element: ${(err as Error).message}`); }
}

function leave(e: Entry, el: Element) {
  if (!e.members.delete(el)) return;
  const list = memberOf.get(el);
  if (list) {
    list.splice(list.indexOf(e), 1);
    if (!list.length) memberOf.delete(el);
  }
  try { e.w.remove(el); } catch (err) { warn(`Internal error while unbinding an element: ${(err as Error).message}`); }
}

/** Brings membership of `root` and its subtree up to date for one entry. */
function reconcile(e: Entry, root: Element, removals: boolean) {
  const sel = e.w.selector;
  if (root.matches(sel)) join(e, root);
  for (const el of root.querySelectorAll(sel)) join(e, el);
  if (!removals) return;
  // Check whichever is smaller: the members, or the elements under root.
  const below = root.getElementsByTagName('*');
  if (e.members.size < below.length) {
    for (const m of [...e.members]) if (root.contains(m) && !m.matches(sel)) leave(e, m);
  } else {
    for (const el of [root, ...below]) if (e.members.has(el) && !el.matches(sel)) leave(e, el);
  }
}

/** Selectors whose match can change when siblings are added, removed or reordered. */
function siblingSensitive(sel: string): boolean {
  return tokenize(sel).some((t) =>
    (t.type === 'delim' && (t.value === '+' || t.value === '~')) ||
    ((t.type === 'ident' || t.type === 'function') && /^(nth-|first-|last-|only-)/i.test(t.value)));
}

/** Attribute names a selector depends on; changes to any other attribute are ignored. */
function attributesOf(sel: string): Set<string> {
  const t = tokenize(sel);
  const out = new Set<string>();
  t.forEach((tok, i) => {
    if (tok.type === 'delim' && tok.value === '.' && t[i + 1]?.type === 'ident') out.add('class');
    if (tok.type === 'delim' && tok.value === '#' && t[i + 1]?.type === 'ident') out.add('id');
    if (tok.type !== '[') return;
    let j = i + 1;
    while (t[j]?.type === 'ws') j++;
    if (t[j]?.type === 'ident') out.add(t[j].value.toLowerCase());
  });
  return out;
}

function observe() {
  const next = new Set<string>();
  for (const e of entries.values()) for (const a of e.deps) next.add(a);
  if (observer && [...next].every((a) => filter.has(a))) return;
  filter = next;
  if (observer) { handle(observer.takeRecords(), false); observer.disconnect(); }
  observer ??= new MutationObserver((records) => handle(records));
  observer.observe(document.documentElement, filter.size
    ? { childList: true, subtree: true, attributes: true, attributeFilter: [...filter] }
    : { childList: true, subtree: true });
}

let batchEnd: (() => void) | undefined;
/** Called after each batch of mutations has been applied to all watchers. */
export function afterMutations(fn: () => void): void { batchEnd = fn; }

function handle(records: MutationRecord[], endOfBatch = true) {
  const added = new Set<Element>();
  const changed = new Map<Element, Set<string>>(); // element -> changed attribute names
  const parents = new Set<Element>();
  for (const r of records) {
    if (r.type === 'attributes') {
      const el = r.target as Element;
      if (ownedAttributes.get(el)?.has(r.attributeName!)) continue;
      let names = changed.get(el);
      if (!names) changed.set(el, (names = new Set()));
      names.add(r.attributeName!);
      continue;
    }
    if (r.target instanceof Element) parents.add(r.target);
    for (const n of r.removedNodes) {
      if (!(n instanceof Element)) continue;
      const moved = n.isConnected;
      for (const el of subtree(n)) {
        for (const e of [...(memberOf.get(el) ?? [])]) {
          if (!moved) leave(e, el);
          else e.w.move?.(el);
        }
      }
    }
    for (const n of r.addedNodes) if (n instanceof Element && n.isConnected) added.add(n);
  }
  for (const e of entries.values()) {
    for (const el of added) reconcile(e, el, false);
    for (const [el, names] of changed) {
      // Only watchers whose selector mentions a changed attribute are re-matched.
      if (!el.isConnected || ![...names].some((n) => e.deps.has(n))) continue;
      reconcile(e, el, true);
      // Sibling combinators/structural pseudo-classes: bounded fallback, re-match the parent's subtree.
      if (e.sibling && el.parentElement) parents.add(el.parentElement);
    }
    if (e.sibling) for (const p of parents) if (p.isConnected) reconcile(e, p, true);
  }
  // Only a real observer callback ends a batch; records flushed while a watcher is being
  // added belong to the caller's batch, which settles itself.
  if (endOfBatch) batchEnd?.();
}

export function watch(w: Watcher): void {
  try { document.querySelector(w.selector); } catch {
    warn(`Unsupported selector "${w.selector}"; its reactive declarations are ignored.`);
    return;
  }
  const deps = attributesOf(w.selector);
  deps.delete('style'); // our own inline writes must never feed back into the observer
  for (const a of deps) if (a.startsWith('data-rcss')) deps.delete(a);
  const e: Entry = { w, members: new Set(), sibling: siblingSensitive(w.selector), deps };
  entries.set(w, e);
  observe();
  reconcile(e, document.documentElement, false);
}

export function unwatch(w: Watcher): void {
  const e = entries.get(w);
  if (!e) return;
  entries.delete(w);
  for (const el of [...e.members]) leave(e, el);
}

export function membersOf(w: Watcher): ReadonlySet<Element> {
  return entries.get(w)?.members ?? new Set();
}

export function stopObserving(): void {
  observer?.disconnect();
  observer = undefined;
  for (const w of [...entries.keys()]) unwatch(w);
}
