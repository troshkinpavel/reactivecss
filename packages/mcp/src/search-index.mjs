// Local, deterministic search over the packaged knowledge: BM25 over a prebuilt inverted index.
// No hosted search, no embeddings, no model. buildIndex() runs at build time (scripts/build.mjs);
// search() runs in the server.

const STOP = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'do', 'does', 'for', 'from', 'how', 'i', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'the', 'this', 'to', 'use', 'what', 'when', 'with', 'write', 'can', 'my', 'you']);
// "on" and "when" are Reactive CSS names, but as plain words they match everything; ":on(" and
// "when(" are kept through their function forms below.

/** Terms of a text: lower case; CSS identifiers kept whole (client-x, --attr-*) and also split. */
export function terms(text) {
  const out = [];
  const s = String(text).toLowerCase();
  for (const m of s.matchAll(/:?-{0,2}[a-z0-9][a-z0-9-]*\*?(\()?/g)) {
    let w = m[0];
    const fn = w.endsWith('(');
    if (fn) w = w.slice(0, -1);
    const bare = w.replace(/^:/, '').replace(/^--/, '');
    if (fn || w.startsWith(':')) out.push(bare + '()');
    if (!STOP.has(bare) && bare.length > 1) out.push(bare);
    if (bare.includes('-')) for (const p of bare.split('-')) if (p.length > 1 && !STOP.has(p)) out.push(p);
  }
  return out;
}

const snippet = (s, n = 240) => { const t = String(s).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

/** Documents of the knowledge, each with a pointer to the tool or resource that has the details. */
function documents(k) {
  const docs = [];
  const add = (d) => docs.push(d);
  const ov = k.overlay;
  for (const e of k.registry.features) {
    const key = `${e.kind}:${e.name}`;
    const o = ov[key] ?? {};
    const legacy = !!o.legacy || e.kind === 'trigger' || e.kind === 'action';
    if (['planned', 'rejected'].includes(e.status)) {
      add({ id: key, type: 'not-shipped', title: `${e.name} (${e.status})`, text: [e.syntax, e.description, e.reason].join(' '), weight: 0.4, ref: { tool: 'get_api_reference', args: { name: e.name, kind: e.kind } } });
      continue;
    }
    add({ id: key, type: legacy ? 'legacy-api' : 'api', title: `${e.name} (${e.kind}${legacy ? ', legacy 0.8' : ''})`,
      text: [e.name, e.syntax, o.syntax09, e.description, ...(o.constraints ?? []), ...(o.notes ?? []), ...(e.examples ?? [])].filter(Boolean).join(' '),
      weight: legacy ? 0.5 : e.status === 'removed' ? 0.4 : 1.2, ref: { tool: 'get_api_reference', args: { name: e.name, kind: e.kind } } });
  }
  for (const [key, m] of [...Object.entries(k.mutations), ...Object.entries(k.modifiers)]) {
    add({ id: key, type: 'api', title: `${m.name} (${m.kind})`, text: [m.name, m.syntax, m.description, ...m.constraints, ...m.examples].join(' '), weight: 1.2,
      ref: { tool: 'get_api_reference', args: { name: m.name.replace('()', ''), kind: m.kind } } });
  }
  for (const e of k.examples) {
    add({ id: `example:${e.id}`, type: 'example', title: `Example: ${e.title}`, text: [e.title, e.topics.join(' '), e.summary, e.sections['APIs used'] ?? '', e.sections['Limitations'] ?? ''].join(' '), weight: 1,
      ref: { tool: 'get_example', args: { id: e.id } } });
  }
  for (const m of k.mistakes) {
    add({ id: `mistake:${m.id}`, type: 'mistake', title: `Mistake: ${m.title}`, text: [m.title, m.explanation, m.wrong, m.right].join(' '), weight: 0.9,
      ref: { resource: 'reactivecss://mistakes' } });
  }
  // Migration guide sections (docs/migration-0.9.md, a public document).
  let title = 'Migrating to the 0.9 syntax', body = [];
  const flush = () => { if (body.length) add({ id: `migration:${docs.length}`, type: 'migration', title: `Migration: ${title}`, text: body.join(' '), weight: 0.9, ref: { resource: 'reactivecss://migration/0.9', tool: 'migrate_css' } }); body = []; };
  for (const line of k.migrationGuide.split('\n')) {
    const h = /^#{1,3} (.+)$/.exec(line) ?? /^\*\*([^*]+)\*\*\s*$/.exec(line.trim());
    if (h) { flush(); title = h[1].replace(/[.*`]/g, '').trim(); } else if (line.trim()) body.push(line);
  }
  flush();
  for (const n of k.nativeFirst) add({ id: `native:${n.need}`, type: 'native-first', title: `Native first: ${n.need}`, text: [n.need, n.native, n.note].join(' '), weight: 1, ref: { resource: 'reactivecss://compatibility' } });
  const c = k.compatibility;
  add({ id: 'compat:browsers', type: 'compatibility', title: 'Browser support and verification', text: [c.buildTarget, c.tested, ...c.notVerified].join(' '), weight: 1, ref: { resource: 'reactivecss://compatibility' } });
  add({ id: 'compat:minifiers', type: 'compatibility', title: 'Minifiers remove empty rules', text: c.minifiers, weight: 1, ref: { resource: 'reactivecss://compatibility' } });
  add({ id: 'compat:stylesheets', type: 'compatibility', title: 'Which stylesheets are processed', text: [c.nativeCss, ...c.stylesheets, c.csp].join(' '), weight: 1, ref: { resource: 'reactivecss://compatibility' } });
  add({ id: 'compat:diagnostics', type: 'compatibility', title: 'Production diagnostic codes', text: c.productionDiagnostics, weight: 1, ref: { tool: 'validate_css' } });
  for (const f of k.catalog.features) {
    add({ id: `feature:${f.id}`, type: 'bundle-feature', title: `Bundle feature: ${f.id} (${f.title})`, text: [f.id, f.title, f.category, ...f.syntax, 'requires', ...f.requires].join(' '), weight: 0.8,
      ref: { tool: 'suggest_bundle', args: { features: [f.id] } } });
  }
  return docs;
}

export function buildIndex(k) {
  const docs = documents(k);
  const postings = {};
  const lengths = [];
  docs.forEach((d, i) => {
    const tf = new Map();
    const bump = (t, n) => tf.set(t, (tf.get(t) ?? 0) + n);
    for (const t of terms(d.title)) bump(t, 3);
    const body = terms(d.text);
    for (const t of body) bump(t, 1);
    lengths.push(body.length + 3 * terms(d.title).length);
    for (const [t, n] of tf) (postings[t] ??= []).push([i, n]);
  });
  return {
    docs: docs.map(({ id, type, title, text, weight, ref }) => ({ id, type, title, snippet: snippet(text), weight, ref })),
    postings, lengths, avgdl: lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length),
  };
}

/**
 * Ranked results: BM25 (k1 1.2, b 0.75) times the document weight; ties keep index order.
 * @param {{ docs: any[], postings: Record<string, [number, number][]>, lengths: number[], avgdl: number }} index
 * @param {string} query
 * @param {{ limit?: number, types?: string[] }} [options]
 */
export function search(index, query, { limit = 5, types } = {}) {
  const q = [...new Set(terms(query))];
  const N = index.docs.length;
  const scores = new Map();
  for (const t of q) {
    const list = index.postings[t];
    if (!list) continue;
    const idf = Math.log(1 + (N - list.length + 0.5) / (list.length + 0.5));
    for (const [i, f] of list) {
      const dl = index.lengths[i];
      scores.set(i, (scores.get(i) ?? 0) + idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * dl / index.avgdl)));
    }
  }
  return [...scores]
    .map(([i, s]) => ({ i, score: s * index.docs[i].weight }))
    .filter((r) => !types || types.includes(index.docs[r.i].type))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map(({ i, score }) => ({ ...index.docs[i], score: Math.round(score * 1000) / 1000, weight: undefined }));
}
