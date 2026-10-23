// API reference lookup and examples: the library's registry plus the curated layer, version-aware.

import { K, DOCS_BASE, type RegistryEntry, type Curated } from './knowledge.js';
import { featureOfKey, distance } from './engine.js';
import { search } from './search-index.mjs';
import { ToolError } from './limits.js';

const KIND_ORDER = ['rule', 'mutation', 'modifier', 'function', 'selector', 'declaration', 'expression', 'trigger', 'action'];
/** Entry keys of the library registry whose usage key is not `<kind>:<name>` (tools/bundle.mjs ENTRY_KEYS). */
const ENTRY_KEYS: Record<string, string> = { 'rule:on': 'sel:on', 'rule:drag': 'gesture:drag', 'declaration:--attr-*': 'decl:attr-ns', 'declaration:persist': 'decl:state-persist', 'declaration:bind()': 'decl:state-form' };
const PREFIX: Record<string, string> = { function: 'fn', expression: 'expr', selector: 'sel', declaration: 'decl', trigger: 'trigger', action: 'act', rule: 'sel', mutation: 'mut', modifier: 'mod' };

export function usageKey(kind: string, name: string): string | undefined {
  if (kind === 'function' && name === 'state') return 'decl:state';
  if (ENTRY_KEYS[`${kind}:${name}`]) return ENTRY_KEYS[`${kind}:${name}`];
  return PREFIX[kind] ? `${PREFIX[kind]}:${name.replace('()', '')}` : undefined;
}

/** "0.9", "0.9.0", "v0.8.1" → [0, 9, 0]. */
export function parseVersion(v: string): number[] | undefined {
  const m = /^v?(\d+)\.(\d+)(?:\.(\d+))?(?:\.x)?$/i.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : undefined;
}
const cmp = (a: number[], b: number[]) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

interface Item { key: string; kind: string; name: string; status: string; since?: string; removedIn?: string; legacy: boolean; e?: RegistryEntry; c?: Curated }

function items(): Item[] {
  const k = K();
  const out: Item[] = k.registry.features.map((e) => {
    const key = `${e.kind}:${e.name}`;
    return { key, kind: e.kind, name: e.name, status: e.status, since: e.since, removedIn: e.removedIn, legacy: !!k.overlay[key]?.legacy || e.kind === 'trigger' || e.kind === 'action', e };
  });
  for (const [key, c] of [...Object.entries(k.mutations), ...Object.entries(k.modifiers)]) out.push({ key, kind: c.kind, name: c.name, status: c.status, since: c.since, legacy: false, c });
  return out;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/^:+/, '').replace(/\(\s*\)$/, '').replace(/\($/, '').replace(/:$/, '').trim();

function available(it: Item, v: number[] | undefined) {
  if (!v) return true;
  const since = it.since && parseVersion(it.since);
  return !since || cmp(since, v) <= 0;
}

export function getReference(args: { name: string; kind?: string; version?: string; includeLegacy?: boolean }) {
  const k = K();
  const current = parseVersion(k.reactivecss.version)!;
  let v: number[] | undefined;
  if (args.version) {
    v = parseVersion(args.version);
    if (!v) throw new ToolError('invalid-version', `Cannot read the version "${args.version}". Write it like 0.9 or 0.8.1.`);
    if (cmp(v, current) > 0 && !(v[0] === current[0] && v[1] === current[1])) throw new ToolError('unsupported-version', `This server knows Reactive CSS up to ${k.reactivecss.version}; ${args.version} is newer. Update @reactivecss/mcp.`);
  }
  const old = v && (v[0] < current[0] || v[1] < current[1]);
  const raw = args.name.trim();
  const n = norm(raw);
  const all = items().filter((it) => available(it, v) && (!args.kind || it.kind === args.kind));
  let matches = all.filter((it) => norm(it.name) === n || (n.startsWith('--attr-') && it.name === '--attr-*'));
  const alias = k.aliases[n] ?? k.aliases[raw.toLowerCase()];
  let primary: Item | undefined;
  if (!args.kind && raw.endsWith(':') && !raw.startsWith(':')) primary = matches.find((it) => it.kind === 'declaration');
  if (!primary && !args.kind && raw.startsWith(':')) primary = matches.find((it) => it.kind === 'rule' || it.kind === 'selector');
  if (!primary && alias && !old) primary = all.find((it) => it.key === alias);
  if (!primary && matches.length) {
    const rank = (it: Item) => (it.legacy && !old ? 100 : 0) + (['planned', 'rejected'].includes(it.status) ? 50 : it.status === 'removed' ? 30 : 0) + KIND_ORDER.indexOf(it.kind);
    primary = [...matches].sort((a, b) => rank(a) - rank(b))[0];
  }
  if (!primary) {
    const names = [...new Set([...all.map((it) => it.name), ...Object.keys(k.aliases)])];
    const suggestions = names.map((x) => [x, distance(n, norm(x))] as const).sort((a, b) => a[1] - b[1]).filter((x) => x[1] <= 3).slice(0, 5).map((x) => x[0]);
    throw new ToolError('not-found', `No Reactive CSS API named "${raw}"${args.kind ? ` of kind ${args.kind}` : ''}${v ? ` in ${args.version}` : ''}.`,
      { suggestions, search: search(k.index, raw, { limit: 3 }).map((r) => ({ id: r.id, title: r.title, ref: r.ref })) });
  }
  if (alias && !matches.some((m) => m.key === primary!.key)) matches = [primary, ...matches];
  const alternatives = matches.filter((it) => it.key !== primary!.key && (args.includeLegacy || !it.legacy || old))
    .map((it) => ({ key: it.key, name: it.name, kind: it.kind, status: it.status, legacy: it.legacy || undefined }));
  const hiddenLegacy = matches.filter((it) => it.key !== primary!.key && it.legacy && !args.includeLegacy && !old).map((it) => it.key);
  return {
    reactivecssVersion: v ? args.version : k.reactivecss.version,
    entry: describeItem(primary, !!old),
    alternatives,
    ...(hiddenLegacy.length ? { legacyAlternatives: hiddenLegacy, legacyNote: 'Legacy 0.8 forms exist under the same name; pass includeLegacy: true to list them. Write the 0.9 form.' } : {}),
    ...(old ? { versionNote: `Filtered to APIs available in ${args.version}. The descriptions are those of ${k.reactivecss.version}; behavior may differ in older versions.` } : {}),
  };
}

function describeItem(it: Item, old: boolean) {
  const k = K();
  const ov = k.overlay[it.key] ?? {};
  const legacyTarget = it.legacy && !old ? (ov.replacement ?? 'rule:on') : undefined;
  const replacement = legacyTarget ? summary(legacyTarget) : undefined;
  const base = it.c ?? it.e!;
  const c = it.c;
  const e = it.e;
  const mistakes = k.mistakes.filter((m) => m.entries.includes(it.key) || (c?.mistakes ?? ov.mistakes ?? []).includes(m.id))
    .map((m) => ({ id: m.id, title: m.title, wrong: m.wrong, right: m.right, explanation: m.explanation }));
  const doc = c?.doc ?? ov.doc;
  const usage = usageKey(it.kind, it.name);
  return {
    key: it.key, name: it.name, kind: it.kind, status: it.status, since: it.since, removedIn: it.removedIn,
    legacy: it.legacy && !old ? true : undefined,
    syntax: base.syntax, syntax09: ov.syntax09,
    description: base.description,
    parameters: c?.parameters ?? e?.parameters, returns: e?.returns,
    constraints: [...(c?.constraints ?? []), ...(ov.constraints ?? [])],
    notes: [...(ov.notes ?? []), ...(e?.reason ? [`Why: ${e.reason}`] : []), ...(e?.nativeEquivalent ? [`Native equivalent: ${e.nativeEquivalent}`] : []), ...(e?.support ? [`Support: ${e.support}`] : []),
      ...(legacyTarget ? [`Legacy 0.8 syntax, still supported in ${k.reactivecss.version}. Use ${replacement?.name} instead.`] : [])],
    examples: c?.examples ?? e?.examples ?? [],
    related: [...new Set([...(c?.related ?? []), ...(ov.related ?? [])])].map(summary).filter(Boolean),
    commonMistakes: mistakes,
    replacement,
    legacyForm: c?.legacyForm ? { key: c.legacyForm, note: 'The 0.8 on: action of the same name; legacy.' } : undefined,
    bundleFeature: usage ? featureOfKey(usage) : undefined,
    docUrl: doc ? `${DOCS_BASE}${doc}` : undefined,
    docTitle: doc ? k.docPages[doc] : undefined,
  };
}

function summary(key: string) {
  const it = items().find((x) => x.key === key);
  if (!it) return undefined;
  return { key, name: it.name, kind: it.kind, syntax: (it.c ?? it.e!).syntax, status: it.status };
}

/** Compact API list for the catalog resource. */
export function apiList() {
  return items().map((it) => ({ key: it.key, name: it.name, kind: it.kind, status: it.status, since: it.since, removedIn: it.removedIn, legacy: it.legacy || undefined,
    syntax: (it.c ?? it.e!).syntax, replacement: it.legacy ? (K().overlay[it.key]?.replacement ?? 'rule:on') : undefined }));
}

// ---- examples ---------------------------------------------------------------------------------

export function getExample(args: { id?: string; topic?: string; include?: string[] }) {
  const k = K();
  const list = () => k.examples.map((e) => ({ id: e.id, title: e.title, group: e.group, topics: e.topics, features: e.features }));
  if (!args.id && !args.topic) return { reactivecssVersion: k.reactivecss.version, examples: list() };
  let ex = args.id ? k.examples.find((e) => e.id === args.id!.trim().toLowerCase()) : undefined;
  if (!ex && (args.topic || args.id)) {
    const q = (args.topic ?? args.id)!.trim().toLowerCase();
    ex = k.examples.find((e) => e.topics.includes(q)) ?? k.examples.find((e) => e.topics.some((t) => t.includes(q) || q.includes(t)));
    if (!ex) {
      const hit = search(k.index, q, { limit: 1, types: ['example'] })[0];
      ex = hit && k.examples.find((e) => `example:${e.id}` === hit.id);
    }
  }
  if (!ex) throw new ToolError('not-found', `No example for "${args.id ?? args.topic}".`, { examples: list().map((e) => e.id) });
  const inc = new Set(args.include?.length ? args.include : ['css', 'html', 'readme']);
  return {
    reactivecssVersion: k.reactivecss.version,
    id: ex.id, title: ex.title, topics: ex.topics, summary: ex.summary,
    css: inc.has('css') ? ex.css : undefined, html: inc.has('html') ? ex.html : undefined,
    readme: inc.has('readme') ? ex.sections : undefined,
    features: ex.features, uses: ex.uses, source: ex.source,
    note: 'From the maintained example catalog; compiles with no diagnostics on this Reactive CSS version. Load the runtime with <script src="reactive-css.min.js" defer></script>.',
  };
}
