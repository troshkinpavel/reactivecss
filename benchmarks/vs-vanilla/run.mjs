// Reactive CSS 0.9.0 vs vanilla JavaScript: a quick, reproducible comparison.
//   node benchmarks/vs-vanilla/run.mjs [--runs=5]
// Each scenario (scenarios/<name>/) has shared markup and CSS, plus either reactive.css (with
// dist/reactive-css.min.js, the production bundle) or vanilla.js. Both run in the same Chromium,
// interleaved, one warm-up load each (discarded), then --runs measured loads.
// Per load: startup (CDP script and task time, ready time), heap after GC, then 40 interactions:
//   - event → DOM mutation (ms, MutationObserver; performance.now() is coarsened to 0.1 ms here),
//   - frames until the update is painted (a frame counter: an update made inside a frame's rAF
//     callbacks is painted in that frame, one made during the event in the next),
//   - script ms per interaction (CDP ScriptDuration),
// then 3 s idle (CDP script and task time), and a check that both end in the same DOM state.
// Writes results/results.{json,md}.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import * as esbuild from 'esbuild';
import { analyze, build } from '../../tools/bundle.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const HERE = fileURLToPath(new URL('./', import.meta.url));
const RUNS = +(process.argv.find((a) => a.startsWith('--runs='))?.slice(7) ?? 5);
const LIB = readFileSync(ROOT + 'dist/reactive-css.min.js', 'utf8');
const N = 40;
const gz = (s) => gzipSync(s, { level: 9 }).length;
const median = (a) => { const s = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y); return s.length ? s[(s.length - 1) >> 1] : NaN; };
const r2 = (v) => +(+v).toPrecision(3);

const SCENARIOS = ['counter', 'toggle', 'form', 'drag', 'many'];
const read = (s, f) => readFileSync(`${HERE}scenarios/${s}/${f}`, 'utf8');

/** Instrumentation shared by both implementations (inline, runs first). */
const PROBE = `<script>
  window.__f = 0; window.__ft = [];
  (function loop(t) { window.__f++; window.__ft[window.__f] = performance.now(); if (!window.__stop) requestAnimationFrame(loop); })();
  window.__lat = []; window.__frames = [];
  let t0 = 0, f0 = 0;
  for (const type of ['click', 'input', 'pointermove']) addEventListener(type, () => { if (!t0) { t0 = performance.now(); f0 = window.__f; } }, true);
  window.__watch = (el) => new MutationObserver(() => {
    if (!t0) return;
    const fm = window.__f;
    const painted = fm > f0 ? fm : fm + 1; // updated inside a later frame's callbacks, or during the event
    window.__lat.push(performance.now() - t0); window.__frames.push(painted - f0);
    t0 = 0;
  }).observe(el, { attributes: true, childList: true, characterData: true, subtree: true });
  addEventListener('DOMContentLoaded', () => { window.__ready = performance.now(); });
</script>`;

function page(s, impl) {
  const markup = read(s, 'markup.html').repeat(existsSync(`${HERE}scenarios/${s}/repeat`) ? +read(s, 'repeat') : 1);
  const css = read(s, 'shared.css') + (impl === 'rcss' ? read(s, 'reactive.css') : '');
  const script = impl === 'rcss' ? '<script src="/lib.js" defer></script>' : '<script src="/app.js" defer></script>';
  return `<!doctype html><html><head><meta charset="utf-8">${PROBE}<style>${css}</style>${script}</head><body>${markup}</body></html>`;
}

const browser = await chromium.launch({ args: ['--js-flags=--expose-gc'] });

async function measure(s, impl) {
  const context = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const p = await context.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.route('http://vs.test/**', (r) => {
    const u = new URL(r.request().url()).pathname;
    if (u === '/lib.js') return r.fulfill({ contentType: 'text/javascript', body: LIB });
    if (u === '/app.js') return r.fulfill({ contentType: 'text/javascript', body: read(s, 'vanilla.js') });
    return r.fulfill({ contentType: 'text/html', body: page(s, impl) });
  });
  const cdp = await context.newCDPSession(p);
  await cdp.send('Performance.enable');
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  await p.goto('http://vs.test/page.html', { waitUntil: 'load' });
  if (impl === 'rcss') await p.waitForFunction(() => window.ReactiveCSS?.stats().sheets > 0);
  await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const m0 = await metrics();
  await p.evaluate(() => { for (let i = 0; i < 3; i++) window.gc(); });
  const heap = (await metrics()).JSHeapUsedSize / 1048576;
  const ready = await p.evaluate(() => window.__ready);

  // Interactions
  const target = { counter: '.v', toggle: '.t', form: '.o', drag: '.k', many: '.c:nth-child(500) .v' }[s];
  await p.evaluate((sel) => window.__watch(document.querySelector(sel)), target);
  const frames2 = () => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  let act;
  if (s === 'form') {
    await p.focus('.q');
    act = () => cdp.send('Input.insertText', { text: 'x' });
  } else if (s === 'drag') {
    const b = await p.locator('.k').boundingBox();
    let x = b.x + 30;
    const y = b.y + 30;
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    act = () => cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: (x += 5), y, button: 'left', buttons: 1 });
  } else {
    const sel = s === 'many' ? '.c:nth-child(500) .inc' : s === 'toggle' ? '.t' : '.inc';
    await p.locator(sel).scrollIntoViewIfNeeded();
    const b = await p.locator(sel).boundingBox();
    const [x, y] = [b.x + b.width / 2, b.y + b.height / 2];
    act = async () => { await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 }); await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 }); };
  }
  for (let i = 0; i < 5; i++) { await act(); await frames2(); } // warm-up interactions
  await p.evaluate(() => { window.__lat.length = 0; window.__frames.length = 0; });
  const i0 = await metrics();
  for (let i = 0; i < N; i++) { await act(); await frames2(); }
  const i1 = await metrics();
  if (s === 'drag') {
    const b = await p.locator('.k').boundingBox();
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x + 30, y: b.y + 30, button: 'left', buttons: 0, clickCount: 1 });
  }
  const { lat, frames } = await p.evaluate(() => ({ lat: window.__lat, frames: window.__frames }));

  // Idle (the probe's frame counter stops first, so only the implementation is measured)
  await p.evaluate(() => { window.__stop = true; });
  await p.waitForTimeout(300);
  const d0 = await metrics();
  await p.waitForTimeout(3000);
  const d1 = await metrics();

  const state = await p.evaluate((sel) => {
    const el = document.querySelector(sel);
    return { text: el.textContent, pressed: el.getAttribute('aria-pressed'), translate: getComputedStyle(el).translate };
  }, target);
  await context.close();
  if (errors.length) throw new Error(`${s}/${impl}: ${errors.join('; ')}`);
  return {
    startScriptMs: (m0.ScriptDuration) * 1000, startTaskMs: m0.TaskDuration * 1000, readyMs: ready, heapMB: heap,
    domLatencyMs: median(lat), paintFrames: median(frames), updates: lat.length,
    scriptMsPerInteraction: ((i1.ScriptDuration - i0.ScriptDuration) * 1000) / N,
    idleScriptMs: (d1.ScriptDuration - d0.ScriptDuration) * 1000, idleTaskMs: (d1.TaskDuration - d0.TaskDuration) * 1000,
    state,
  };
}

const out = { date: new Date().toISOString(), browser: browser.version(), cpu: os.cpus()[0]?.model, runs: RUNS, interactionsPerRun: N, scenarios: {} };
for (const s of SCENARIOS) {
  const rows = { vanilla: [], rcss: [] };
  for (const impl of ['vanilla', 'rcss']) await measure(s, impl); // warm-up loads, discarded
  for (let r = 0; r < RUNS; r++) for (const impl of r % 2 ? ['rcss', 'vanilla'] : ['vanilla', 'rcss']) rows[impl].push(await measure(s, impl));
  const keys = Object.keys(rows.vanilla[0]).filter((k) => k !== 'state');
  const sum = (list) => Object.fromEntries(keys.map((k) => { const v = list.map((x) => x[k]); return [k, { median: r2(median(v)), min: r2(Math.min(...v)), max: r2(Math.max(...v)) }]; }));
  const same = JSON.stringify(rows.vanilla.map((x) => x.state)) === JSON.stringify(rows.rcss.map((x) => x.state));
  out.scenarios[s] = { vanilla: sum(rows.vanilla), rcss: sum(rows.rcss), equivalentFinalState: same, finalState: { vanilla: rows.vanilla[0].state, rcss: rows.rcss[0].state } };
  console.log(s, 'equivalent:', same, JSON.stringify({ v: out.scenarios[s].vanilla.scriptMsPerInteraction, r: out.scenarios[s].rcss.scriptMsPerInteraction }));
}
await browser.close();

// Sizes: the shared runtime (full bundle, and the custom bundle the analyzer picks) vs app code.
const sizes = {};
for (const s of SCENARIOS) {
  const css = read(s, 'reactive.css');
  const js = read(s, 'vanilla.js');
  const jsMin = (await esbuild.transform(js, { minify: true, loader: 'js' })).code;
  const tmp = `${HERE}results/.${s}.css`;
  writeFileSync(tmp, css);
  const a = await analyze([tmp]);
  const custom = await build({ features: a.recommended.features, minify: true });
  sizes[s] = { appCss: { bytes: css.length, gzip: gz(css) }, vanillaJs: { bytes: jsMin.length, gzip: gz(jsMin) },
    customRuntime: { features: custom.manifest.features, minified: custom.manifest.sizes.minified, gzip: custom.manifest.sizes.gzip } };
}
out.sizes = { fullRuntime: { minified: LIB.length, gzip: gz(LIB) }, perScenario: sizes };
writeFileSync(HERE + 'results/results.json', JSON.stringify(out, null, 1) + '\n');
console.log('written', HERE + 'results/results.json');
