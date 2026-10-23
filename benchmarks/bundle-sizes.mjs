// Bundle sizes and startup per feature selection (0.8.0).
//   node benchmarks/bundle-sizes.mjs [--runs=5] [--n=1000]
// Builds every selection with tools/bundle.mjs (minified iife, as the CLI does) into dist/custom/bench/
// and writes benchmarks/audit/results/v<version without dots>/bundle-sizes.{json,md} (0.8.1 → v081):
//   sizes      core alone, each profile, full custom, the dist full and compact bundles
//   overhead   each feature over its own requirements (what selecting it adds)
//   startup    median over runs, on n components using state + on: click + text: (a bundle without a
//              feature reports it as a diagnostic and skips it): CDP ScriptDuration and TaskDuration
//              until the second frame after the first sheet is compiled (wall-clock time is frame-bound
//              and says nothing here), and JS heap after GC.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { build, sizes, catalog } from '../tools/bundle.mjs';
import { launch, measure } from './audit/lib.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const RUNS = +arg('runs', 5), N = +arg('n', 1000);
// One folder per version, so earlier measurements stay as they were.
const OUT = `benchmarks/audit/results/v${catalog().version.replaceAll('.', '')}`;
const { features, profiles } = catalog();
const metrics = async (cdp) => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

const out = { date: new Date().toISOString(), version: catalog().version, n: N, runs: RUNS, sizes: [], overhead: [], startup: [] };
const files = {};
async function custom(name, selection) {
  const r = await build({ ...selection, outfile: `dist/custom/bench/${name}.min.js` });
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  files[name] = `custom/bench/${name}.min.js`;
  out.sizes.push({ name, features: r.manifest.features, ...r.manifest.sizes });
  return r.manifest.sizes;
}

await custom('core', { features: [] });
for (const p of Object.keys(profiles)) await custom(p, { profile: p });
for (const [name, file] of [['dist full', 'reactive-css.min.js'], ['dist compact', 'reactive-css.compact.min.js']]) {
  files[name] = file;
  out.sizes.push({ name, features: null, ...sizes(readFileSync(`dist/${file}`, 'utf8')) });
}
for (const f of features.filter((x) => x.id !== 'core')) {
  const deps = f.requires.filter((x) => x !== 'core');
  const [base, withF] = await Promise.all([build({ features: deps }), build({ features: [f.id] })]);
  out.overhead.push({ id: f.id, over: ['core', ...deps], minified: withF.manifest.sizes.minified - base.manifest.sizes.minified,
    gzip: withF.manifest.sizes.gzip - base.manifest.sizes.gzip, brotli: withF.manifest.sizes.brotli - base.manifest.sizes.brotli });
}

const body = '<div class="c"><b>+</b><span class="t">0</span></div>'.repeat(N);
const css = `.c { --n: state(0) } .c b { on: click(increment(--n)) } .c .t { text: var(--n) }`;
// Like audit/lib.mjs open(), but CDP metrics are enabled before navigation so they cover startup.
async function load(env, file) {
  const context = await env.browser.newContext({ viewport: { width: 800, height: 600 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/a/page.html', (r) => r.fulfill({ contentType: 'text/html',
    body: `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style><script src="/dist/${file}" defer></script></head><body>${body}</body></html>` }));
  await page.goto(`http://localhost:${env.server.port}/a/page.html`);
  await page.waitForFunction(() => window.ReactiveCSS?.stats().sheets >= 1);
  return { page, cdp, errors, close: () => context.close() };
}

const env = await launch();
for (const name of ['core', ...Object.keys(profiles), 'dist full', 'dist compact']) {
  const script = [], task = [], heap = [];
  for (let r = 0; r < RUNS; r++) {
    const p = await load(env, files[name]);
    await p.page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
    const t = await metrics(p.cdp);
    script.push(t.ScriptDuration * 1000); task.push(t.TaskDuration * 1000);
    const m = await measure(p);
    heap.push(m.heapBytes);
    if (r === 0) out.startup.push({ name, bindings: m.bindings, diagnostics: await p.page.evaluate(() => window.ReactiveCSS.diagnostics.length), errors: p.errors });
    await p.close();
  }
  Object.assign(out.startup.at(-1), { scriptMs: +median(script).toFixed(1), taskMs: +median(task).toFixed(1), heapMB: +(median(heap) / 1048576).toFixed(2) });
  console.error(name, out.startup.at(-1));
}
await env.close();

const kb = (n) => (n / 1024).toFixed(1);
const md = [
  `# Bundle sizes and startup (${out.version})`, '', `${out.date} · Chromium (Playwright) · startup: ${N} components, median of ${RUNS} loads`, '',
  '## Sizes', '', '| Bundle | Features | Minified | gzip | brotli |', '|---|---|---:|---:|---:|',
  ...out.sizes.map((s) => `| ${s.name} | ${s.features?.join(', ') ?? '(prebuilt)'} | ${s.minified} B (${kb(s.minified)} KB) | ${s.gzip} B | ${s.brotli} B |`),
  '', '## What each feature adds over its requirements', '', '| Feature | Over | Minified | gzip | brotli |', '|---|---|---:|---:|---:|',
  ...out.overhead.map((o) => `| ${o.id} | ${o.over.join(', ')} | +${o.minified} B | +${o.gzip} B | +${o.brotli} B |`),
  '', '## Startup', '', '| Bundle | Script (ms) | Task (ms) | Heap after GC (MB) | Bindings | Diagnostics |', '|---|---:|---:|---:|---:|---:|',
  ...out.startup.map((s) => `| ${s.name} | ${s.scriptMs} | ${s.taskMs} | ${s.heapMB} | ${s.bindings} | ${s.diagnostics} |`), '',
].join('\n');
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/bundle-sizes.json`, JSON.stringify(out, null, 2) + '\n');
writeFileSync(`${OUT}/bundle-sizes.md`, md);
console.log(md);
