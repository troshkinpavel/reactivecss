// Shared tools for the 0.4 runtime audit: pages, measurements, heap snapshots.
// Pages are served from the benchmark server's origin through Playwright routes, and load
// the development bundle (class names and stats().internal) or the production bundle.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { startServer } from '../server.mjs';

const SRC = new URL('../../src/', import.meta.url);

/** Constructor names of the library's classes, read from the source (heap snapshot names). */
export const LIBRARY_CLASSES = (() => {
  const names = new Set();
  const files = ['core/engine.ts', 'core/registry.ts', 'state/state.ts', 'state/actions.ts', 'state/bind.ts', 'state/changed.ts', 'state/conditions.ts',
    'functions/values.ts', 'functions/live.ts', 'functions/sources.ts', 'functions/geometry.ts', 'state/expr.ts', 'state/text.ts', 'state/bindattr.ts', 'state/attrdecl.ts', 'state/focusdecl.ts', 'selectors/nth-var.ts', 'selectors/just-checked.ts'];
  for (const f of files) for (const m of readFileSync(new URL(f, SRC), 'utf8').matchAll(/\bclass (\w+)/g)) names.add(m[1]);
  return [...names];
})();

export async function launch() {
  const server = await startServer();
  const browser = await chromium.launch({ args: ['--js-flags=--expose-gc'] });
  return { server, browser, close: async () => { await browser.close(); server.stop(); } };
}

/** Opens a page with the given markup and the chosen bundle; resolves when the library started. */
export async function open(env, { head = '', body = '', bundle = 'dev', csp = '', viewport = { width: 800, height: 600 }, before = '' } = {}) {
  const context = await env.browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // bundle: 'dev', 'min', 'none', or a file under dist/ (custom bundles, e.g. 'custom/basic.js').
  const file = { dev: 'reactive-css.js', min: 'reactive-css.min.js' }[bundle] ?? bundle;
  const src = bundle === 'none' ? '' : `<script src="/dist/${file}" defer></script>`;
  await page.route('**/a/page.html', (r) => r.fulfill({
    contentType: 'text/html', headers: csp ? { 'Content-Security-Policy': csp } : {},
    body: `<!doctype html><html><head><meta charset="utf-8">${before}${head}${src}</head><body>${body}</body></html>`,
  }));
  await page.goto(`http://localhost:${env.server.port}/a/page.html`);
  if (bundle !== 'none') await page.waitForFunction(() => window.ReactiveCSS);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  return { page, cdp, context, errors, close: () => context.close() };
}

export const frames = (page, n = 2) => page.evaluate((n) => new Promise((res) => { const f = () => (n-- ? requestAnimationFrame(f) : res()); f(); }), n);

export async function gc(cdp) {
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.collectGarbage');
}

/** Heap, DOM and library counters after a full GC. */
export async function measure({ page, cdp }) {
  await gc(cdp);
  const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  const dom = await cdp.send('Memory.getDOMCounters');
  const inPage = await page.evaluate(() => ({ stats: window.ReactiveCSS?.stats(), animations: document.getAnimations().length, diagnostics: window.ReactiveCSS?.diagnostics.length }));
  return {
    heapBytes: m.JSHeapUsedSize, nodes: dom.nodes, documents: dom.documents, jsEventListeners: dom.jsEventListeners,
    layoutObjects: m.LayoutObjects, animations: inPage.animations, ...flatStats(inPage.stats),
  };
}

function flatStats(s) {
  if (!s) return {};
  const { internal = {}, ...rest } = s;
  const keep = ['bindings', 'states', 'sources', 'observers', 'sheets', 'scheduled', 'intervals'];
  return { ...Object.fromEntries(keep.map((k) => [k, rest[k]])), ...Object.fromEntries(Object.entries(internal).map(([k, v]) => ['i.' + k, v])) };
}

/** Event listeners registered on document and window (the library's delegated listeners live there). */
export async function globalListeners(cdp) {
  const out = {};
  for (const expr of ['document', 'window']) {
    const { result } = await cdp.send('Runtime.evaluate', { expression: expr });
    const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
    out[expr] = listeners.map((l) => `${l.type}${l.useCapture ? ':capture' : ''}`).sort();
  }
  return out;
}

/** Takes a heap snapshot and summarizes detached DOM and library objects. */
export async function heapSnapshot(cdp, { paths = 0, pathClass = '', largest = '', classes = LIBRARY_CLASSES, aggregate = false } = {}) {
  await cdp.send('HeapProfiler.enable');
  await gc(cdp);
  let chunks = [];
  const on = (e) => chunks.push(e.chunk);
  cdp.on('HeapProfiler.addHeapSnapshotChunk', on);
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false, captureNumericValue: false });
  cdp.off('HeapProfiler.addHeapSnapshotChunk', on);
  const snap = JSON.parse(chunks.join(''));
  chunks = null;
  const meta = snap.snapshot.meta;
  const nf = meta.node_fields, ef = meta.edge_fields;
  const N = nf.length, E = ef.length;
  const iType = nf.indexOf('type'), iName = nf.indexOf('name'), iSize = nf.indexOf('self_size'), iEdges = nf.indexOf('edge_count'), iDet = nf.indexOf('detachedness');
  const eType = ef.indexOf('type'), eName = ef.indexOf('name_or_index'), eTo = ef.indexOf('to_node');
  const nodeTypes = meta.node_types[iType], edgeTypes = meta.edge_types[eType];
  const { nodes, edges, strings } = snap;
  const count = nodes.length / N;
  const want = new Set(classes);
  const byClass = Object.fromEntries(classes.map((c) => [c, 0]));
  let detachedElements = 0, detachedNodes = 0, total = 0;
  const detachedSample = [];
  for (let i = 0; i < count; i++) {
    const o = i * N;
    total += nodes[o + iSize];
    const name = strings[nodes[o + iName]];
    if (nodes[o + iDet] === 2) {
      detachedNodes++;
      if (/^<[a-z]/.test(name)) { detachedElements++; if (!pathClass && detachedSample.length < paths) detachedSample.push(i); }
    }
    if (nodeTypes[nodes[o + iType]] === 'object' && want.has(name)) byClass[name]++;
    // Samples of one class instead of detached elements (the last ones: usually the newest).
    if (pathClass && name === pathClass && nodeTypes[nodes[o + iType]] === 'object') { detachedSample.push(i); if (detachedSample.length > paths) detachedSample.shift(); }
  }
  if (largest) {
    // Retainer paths of the biggest nodes of one type (e.g. 'array'): what holds a growing buffer.
    const big = [];
    for (let i = 0; i < count; i++) if (nodeTypes[nodes[i * N + iType]] === largest) big.push(i);
    big.sort((x, y) => nodes[y * N + iSize] - nodes[x * N + iSize]);
    detachedSample.length = 0;
    detachedSample.push(...big.slice(0, paths));
  }
  const result = { nodes: count, totalBytes: total, detachedElements, detachedNodes, byClass };
  if (aggregate) {
    // Self size and count per "type:name" (names of strings and closures truncated), for heap diffs.
    result.groups = {};
    for (let i = 0; i < count; i++) {
      const o = i * N, type = nodeTypes[nodes[o + iType]];
      const k = `${type}:${type === 'string' || type === 'concatenated string' || type === 'sliced string' ? '' : strings[nodes[o + iName]].slice(0, 50)}`;
      const g = (result.groups[k] ??= [0, 0]);
      g[0]++; g[1] += nodes[o + iSize];
    }
  }
  if (paths && detachedSample.length) {
    // Reverse edges, then the shortest strong path from a GC root to each sample.
    const first = new Uint32Array(count + 1);
    for (let i = 0, e = 0; i < count; i++) { first[i] = e; e += nodes[i * N + iEdges] * E; }
    first[count] = edges.length;
    const inCount = new Uint32Array(count + 1);
    for (let e = 0; e < edges.length; e += E) inCount[edges[e + eTo] / N]++;
    const inStart = new Uint32Array(count + 1);
    for (let i = 0; i < count; i++) inStart[i + 1] = inStart[i] + inCount[i];
    const fill = inStart.slice(), inFrom = new Uint32Array(edges.length / E), inEdge = new Uint32Array(edges.length / E);
    for (let i = 0; i < count; i++) for (let e = first[i]; e < first[i + 1]; e += E) {
      const t = edges[e + eTo] / N;
      inFrom[fill[t]] = i; inEdge[fill[t]++] = e;
    }
    const label = (i) => strings[nodes[i * N + iName]].slice(0, 60);
    const edgeLabel = (e) => { const t = edgeTypes[edges[e + eType]]; return t === 'element' || t === 'hidden' ? `[${edges[e + eName]}]` : strings[edges[e + eName]]; };
    result.retainerPaths = detachedSample.map((start) => {
      const prev = new Int32Array(count).fill(-1), via = new Int32Array(count).fill(-1);
      prev[start] = start;
      let queue = [start], found = -1;
      while (queue.length && found < 0) {
        const next = [];
        for (const n of queue) {
          for (let k = inStart[n]; k < inStart[n + 1]; k++) {
            const from = inFrom[k], e = inEdge[k];
            const t = edgeTypes[edges[e + eType]];
            if (t === 'weak' || prev[from] !== -1) continue;
            prev[from] = n; via[from] = e;
            if (from === 0) { found = from; break; }
            next.push(from);
          }
          if (found >= 0) break;
        }
        queue = next;
      }
      const size = ` (${nodes[start * N + iSize]} B)`;
      if (found < 0) return `${label(start)}${size}: no strong path to a root`;
      const chain = [];
      for (let n = found; n !== start; n = prev[n]) chain.push(`${label(n)} -${edgeLabel(via[n])}->`);
      return chain.slice(1).join(' ') + ' ' + label(start) + size;
    });
  }
  return result;
}

/** Least-squares slope of y over x. */
export function slope(xs, ys) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den ? num / den : 0;
}

export const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
