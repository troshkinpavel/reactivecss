// persist() (0.9.0): `--dark: state(false, persist("theme"))`. Semantics:
// docs/rfc-v0.9.0-language.md, section 9.
//
// - Stored as JSON {t, v, u} under "rcss:<key>" in localStorage (default) or sessionStorage.
// - Read once when a cell is created; used only when it fits the declared type, and keywords
//   only when they are identifiers or #hex colors (stored text never becomes url() or syntax).
// - Writes are coalesced per key: at most one setItem per 250 ms, the last value wins, and
//   pending writes are flushed when the page is hidden or unloaded.
// - Cells with the same key and storage share the value: a change is applied to the others in
//   the page, and to other tabs through the storage event (localStorage).
// - Storage that throws (disabled, sandboxed, quota) gives one note; the state still works.

import { runtimes } from '../core/registry';
import { note, warn, dev, probes } from '../core/log';
import { sensitive } from './expr';
import { describeElement, type Cell, type PersistSpec, type PersistLink } from './state';
import { assignable, coerce, equal, type Typed } from './values';

const PREFIX = 'rcss:';
const DELAY = 250;
const IDENT = /^(-?[a-z_][\w-]*|#[0-9a-f]{3,8})$/i;

interface Group { spec: PersistSpec; cells: Set<Cell>; pending?: Typed; timer?: ReturnType<typeof setTimeout>; lastWrite: number; written?: string }
const groups = new Map<string, Group>();
export const counters = { writes: 0, reads: 0 };
if (dev) Object.assign(probes, { persistKeys: () => groups.size, persistWrites: () => counters.writes });

const id = (s: PersistSpec) => (s.session ? 's:' : 'l:') + s.key;

function store(s: PersistSpec): Storage | undefined {
  try { return s.session ? sessionStorage : localStorage; } catch (e) {
    note(`persist("${s.key}"): ${s.session ? 'sessionStorage' : 'localStorage'} is not available (${(e as Error).name}); the state is not persisted.`);
    return undefined;
  }
}

const encode = (v: Typed) => JSON.stringify(v.type === 'dimension' ? { t: v.type, v: v.v, u: v.unit } : { t: v.type, v: v.v });

/** The stored value, when it is valid for a state holding values like `like`. */
export function decode(raw: string | null, like: Typed): Typed | undefined {
  if (raw === null) return undefined;
  let o: { t?: unknown; v?: unknown; u?: unknown };
  try { o = JSON.parse(raw); } catch { return undefined; }
  if (!o || typeof o !== 'object') return undefined;
  let t: Typed;
  switch (o.t) {
    case 'boolean': if (typeof o.v !== 'boolean') return undefined; t = { type: 'boolean', v: o.v }; break;
    case 'number': if (typeof o.v !== 'number' || !Number.isFinite(o.v)) return undefined; t = { type: 'number', v: o.v, unit: '' }; break;
    case 'dimension':
      if (typeof o.v !== 'number' || !Number.isFinite(o.v) || typeof o.u !== 'string' || !/^(%|[a-z]{1,6})$/.test(o.u)) return undefined;
      t = { type: 'dimension', v: o.v, unit: o.u }; break;
    case 'string': if (typeof o.v !== 'string' || o.v.length > 10000) return undefined; t = { type: 'string', v: o.v }; break;
    case 'value': if (typeof o.v !== 'string' || !IDENT.test(o.v)) return undefined; t = { type: 'value', v: o.v }; break;
    default: return undefined;
  }
  return assignable(like, t) ? coerce(like, t) : undefined;
}

function read(s: PersistSpec, like: Typed): Typed | undefined {
  const st = store(s);
  if (!st) return undefined;
  let raw: string | null;
  try { raw = st.getItem(PREFIX + s.key); } catch { return undefined; }
  counters.reads++;
  const v = decode(raw, like);
  if (raw !== null && !v) note(`persist("${s.key}"): the stored value does not fit this state (${raw.slice(0, 60)}); the initial value is used.`);
  return v;
}

function flush(g: Group) {
  clearTimeout(g.timer);
  g.timer = undefined;
  const v = g.pending;
  if (!v) return;
  g.pending = undefined;
  const st = store(g.spec);
  if (!st) return;
  const text = encode(v);
  if (text === g.written) return;
  try {
    st.setItem(PREFIX + g.spec.key, text);
    g.written = text;
    g.lastWrite = Date.now();
    counters.writes++;
  } catch (e) {
    note(`persist("${g.spec.key}"): the value could not be stored (${(e as Error).name}); the state keeps working without persistence.`);
  }
}

function schedule(g: Group, v: Typed) {
  g.pending = v;
  if (g.timer !== undefined) return;
  const wait = Math.max(0, g.lastWrite + DELAY - Date.now());
  g.timer = setTimeout(() => flush(g), wait);
}

const flushAll = () => groups.forEach(flush);
let listening = false;
function listen(on: boolean) {
  if (on === listening) return;
  listening = on;
  const m = on ? 'addEventListener' : 'removeEventListener';
  window[m]('storage', onStorage as EventListener);
  window[m]('pagehide', flushAll);
  document[m]('visibilitychange', onVisibility);
}
const onVisibility = () => { if (document.visibilityState === 'hidden') flushAll(); };

/** Another tab changed a localStorage key: apply it, without writing it back. */
function onStorage(e: StorageEvent) {
  if (!e.key?.startsWith(PREFIX)) return;
  const g = groups.get('l:' + e.key.slice(PREFIX.length));
  if (!g || e.storageArea !== localStorage) return;
  g.written = e.newValue ?? undefined;
  for (const c of g.cells) {
    const v = decode(e.newValue, c.value);
    if (v) apply(g, c, v);
  }
}

let applying = false;
function apply(g: Group, c: Cell, v: Typed) {
  applying = true;
  try { c.set(v); } finally { applying = false; }
}

class Link implements PersistLink {
  constructor(readonly g: Group, readonly cell: Cell) {}
  changed() {
    if (applying) return; // a value from storage or from a sibling cell: nothing to write
    const v = this.cell.value;
    applying = true;
    try { for (const c of this.g.cells) if (c !== this.cell && !c.dead && !equal(c.value, v)) { const w = decode(encode(v), c.value); if (w) c.set(w); } } finally { applying = false; }
    schedule(this.g, v);
  }
  release() {
    this.g.cells.delete(this.cell);
    if (this.g.cells.size) return;
    flush(this.g);
    groups.delete(id(this.g.spec));
    if (!groups.size) listen(false);
  }
}

runtimes.persist = {
  initial(spec, owner, fallback) {
    if (sensitive(owner)) { warn(`persist("${spec.key}") on ${describeElement(owner)} is refused: password, one-time-code and payment fields are never stored.`); return undefined; }
    // A cell of the same key already in the page shares its current value.
    const g = groups.get(id(spec));
    for (const c of g?.cells ?? []) { const v = decode(encode(c.value), fallback); if (v) return v; }
    return read(spec, fallback);
  },
  link(spec, cell) {
    if (sensitive(cell.owner)) return { changed() {}, release() {} };
    let g = groups.get(id(spec));
    if (!g) { groups.set(id(spec), (g = { spec, cells: new Set(), lastWrite: 0 })); listen(true); }
    g.cells.add(cell);
    return new Link(g, cell);
  },
};
