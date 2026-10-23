// v0.8.1 vs v0.9.0 comparison (docs/release-0.9.0-preparation.md, section "Performance").
//   node benchmarks/v090/compare.mjs [--runs=5] [--only=startup,click,...] [--report]
//   --only re-measures those sections and keeps the others from results.json (each section has its date);
//   --report only regenerates results.md from results.json.
// Same machine, same Chromium, same pages and the same method for both versions:
//   v0.8.1  benchmarks/baseline/v0.8.1/reactive-css.min.js (frozen copy of the 0.8.1 release candidate)
//   v0.9.0-rc1  benchmarks/baseline/v0.9.0-rc1/reactive-css.min.js (0.9.0 before the hardening pass)
//   v0.9.0  dist/reactive-css.min.js (and custom bundles built with tools/bundle.mjs)
//   --throttle=4  Chromium CPU throttling (slow devices); --out=name writes results-name.{json,md}
// Pages are served from a routed origin; each measurement runs in a fresh browser context, with
// implementations interleaved per run (ABAB…) so drift affects both equally. Medians with min–max.
// Writes benchmarks/v090/results.json and results.md.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { build } from '../../tools/bundle.mjs';
import { build as buildRc1 } from '../baseline/v0.9.0-rc1/tools/bundle.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const RUNS = +arg('runs', 5);
const REPORT = process.argv.includes('--report');
const ONLY = REPORT ? [] : arg('only')?.split(',');
const ORIGIN = 'http://bench.test';

const THROTTLE = +arg('throttle', 0);
/** The 0.9 build to compare with (a folder in benchmarks/baseline/): v0.9.0-rc1, or v0.9.0-hardened for the API cleanup. */
const BEFORE = arg('before', 'v0.9.0-rc1');
/** A focus request in the syntax of each build: rc1 and the hardened build had :focus(when()); the API cleanup restored focus: when(). */
const focusReq = (sel, cond, old) => (old ? `${sel}:focus(when(${cond})) {}` : `${sel} { focus: when(${cond}) }`);
const OUTNAME = arg('out');
const LIBS = {
  'v0.8.1': readFileSync(ROOT + 'benchmarks/baseline/v0.8.1/reactive-css.min.js', 'utf8'),
  [BEFORE]: readFileSync(ROOT + `benchmarks/baseline/${BEFORE}/reactive-css.min.js`, 'utf8'),
  'v0.9.0': readFileSync(ROOT + 'dist/reactive-css.min.js', 'utf8'),
};
const custom = async (features) => (await build({ features, minify: true })).code;
const customRc1 = async (features) => (await buildRc1({ features, minify: true })).code;

const browser = await chromium.launch({ args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] });
const JSON_OUT = ROOT + `benchmarks/v090/results${OUTNAME ? '-' + OUTNAME : ''}.json`;
const prev = ONLY && existsSync(JSON_OUT) ? JSON.parse(readFileSync(JSON_OUT, 'utf8')) : null;
const out = { date: new Date().toISOString(), throttle: THROTTLE || 1, browser: browser.version(), cpu: os.cpus()[0]?.model, cores: os.cpus().length, node: process.version, runs: RUNS,
  results: { ...(prev?.results ?? {}) }, sections: { ...(prev?.sections ?? {}) } };
const measured = (name) => { out.sections[name] = { date: out.date, runs: RUNS }; };

const doc = (css, body, extra = '') => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>${extra}<script src="/lib.js"></script></head><body>${body}</body></html>`;
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
/** Three significant digits (small per-event costs stay visible), at most one decimal above 100. */
const r1 = (v) => (Math.abs(v) >= 100 ? Math.round(v * 10) / 10 : +v.toPrecision(3));
const r2 = (v) => +v.toPrecision(4);

/** A fresh context with the page and library routed; CDP metrics enabled before navigation. */
async function load(html, lib, { ready = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(ORIGIN + '/**', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/lib.js') return r.fulfill({ contentType: 'text/javascript', body: lib ?? '' });
    return r.fulfill({ contentType: 'text/html', body: html });
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  if (THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  await page.goto(ORIGIN + '/page.html', { waitUntil: 'load' });
  if (lib) await page.waitForFunction((ready) => window.ReactiveCSS && (!ready || window.ReactiveCSS.stats().sheets > 0), ready, { timeout: 120000 });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 100)))));
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  return { page, cdp, metrics, errors, close: () => context.close() };
}

async function series(name, impls, runs, fn) {
  const rows = Object.fromEntries(Object.keys(impls).map((k) => [k, []]));
  for (let r = 0; r < runs; r++) {
    const order = r % 2 ? Object.keys(impls).reverse() : Object.keys(impls);
    for (const k of order) rows[k].push(await fn(impls[k], k));
  }
  return rows;
}
const summarize = (rows, keys) => Object.fromEntries(Object.entries(rows).map(([impl, list]) => [impl,
  Object.fromEntries(keys.map((k) => { const v = list.map((x) => x[k]).filter((x) => x !== undefined); return [k, { median: r2(median(v)), min: r2(Math.min(...v)), max: r2(Math.max(...v)) }]; }))]));
const want = (k) => !ONLY || ONLY.includes(k);
const log = (...a) => console.log(...a);

// ---- components --------------------------------------------------------------------------
// The same behavior written in 0.8 syntax (runs on both) and in 0.9 syntax (0.9 only).
const LEGACY_CSS = `.c { --n: state(0); --on: state(false); display: inline-block; margin: 1px }
  .c > b { on: click(increment(--n)) } .c > i { on: click(toggle(--on)); attr: aria-pressed var(--on) }
  .c > s { text: var(--n) } .c:when(--on) { outline: 1px solid }`;
const NEW_CSS = `.c { --n: state(0); --on: state(false); display: inline-block; margin: 1px }
  .c > b:on(click) { --n: increment(1) } .c > i:on(click) { --on: toggle() } .c > i { --attr-aria-pressed: var(--on) }
  .c > s { content: var(--n) } .c:when(--on) { outline: 1px solid }`;
const COMP = '<div class="c"><b>+</b><i role="button">t</i><s>0</s></div>';
const PLAIN_SCRIPT = `<script>addEventListener('click', (e) => { const c = e.target.closest('.c'); if (!c) return;
  if (e.target.matches('b')) { c.n = (c.n || 0) + 1; c.querySelector('s').textContent = c.n; }
  if (e.target.matches('i')) { const on = !c.on; c.on = on; e.target.setAttribute('aria-pressed', on); c.style.outline = on ? '1px solid' : ''; } });</script>`;

// ---- 1. startup --------------------------------------------------------------------------
if (want('startup')) {
  const minimal = await custom(['events', 'conditions', 'attributes', 'text']);
  const res = {};
  for (const n of [100, 1000, 5000, 10000]) {
    const body = COMP.repeat(n);
    const impls = {
      'v0.8.1 (0.8 syntax)': [LEGACY_CSS, LIBS['v0.8.1']],
      [`${BEFORE} (0.9 syntax)`]: [NEW_CSS, LIBS[BEFORE]],
      'v0.9.0 (0.8 syntax)': [LEGACY_CSS, LIBS['v0.9.0']],
      'v0.9.0 (0.9 syntax)': [NEW_CSS, LIBS['v0.9.0']],
      'v0.9.0 custom (events, conditions, attributes, text)': [NEW_CSS, minimal],
      'no library': [LEGACY_CSS, null],
    };
    const rows = await series('startup', impls, RUNS, async ([css, lib]) => {
      const p = await load(doc(css, body), lib);
      const m = await p.metrics();
      const inPage = await p.page.evaluate(() => ({ parseMs: window.ReactiveCSS?.stats().parseMs ?? 0, heap: performance.memory?.usedJSHeapSize }));
      if (p.errors.length) throw new Error(p.errors.join('\n'));
      await p.close();
      return { scriptMs: m.ScriptDuration * 1000, taskMs: m.TaskDuration * 1000, styleMs: m.RecalcStyleDuration * 1000, compileMs: inPage.parseMs, heapMB: m.JSHeapUsedSize / 1048576 };
    });
    res[`${n} components (${n * 3} elements)`] = summarize(rows, ['taskMs', 'scriptMs', 'styleMs', 'compileMs', 'heapMB']);
    log('startup', n, JSON.stringify(Object.fromEntries(Object.entries(res[`${n} components (${n * 3} elements)`]).map(([k, v]) => [k, v.taskMs.median]))));
  }
  // Minimal bundles for one feature each (0.9 only): what a page pays for what it uses.
  const feat = {
    'core + events': [['events'], `.c { --n: state(0) } .c b:on(click) { --n: increment(1) }`],
    'core + forms': [['forms'], `input.c { --v: state("", bind(value)) }`],
    'core + focus (+ conditions for when())': [['focus', 'conditions'], `.c { --o: state(false) } ${focusReq('.c input', '--o', false)}`],
    'core + persist': [['persist'], `.c { --n: state(0, persist("b")) }`],
    'core + events + gestures': [['gestures'], `.c { --x: state(0px) } .c b:on(drag) { --x: set(event(x)) }`],
  };
  const body = '<div class="c"><b>b</b><input class="c"></div>'.repeat(1000);
  const impls = {};
  for (const [k, [f, css]] of Object.entries(feat)) impls[k] = [css, await custom(f)];
  const rows = await series('startup-features', impls, RUNS, async ([css, lib]) => {
    const p = await load(doc(css, body), lib);
    const m = await p.metrics();
    if (p.errors.length) throw new Error(p.errors.join('\n'));
    await p.close();
    return { taskMs: m.TaskDuration * 1000, scriptMs: m.ScriptDuration * 1000 };
  });
  res['1000 components, one-feature bundles (v0.9.0)'] = summarize(rows, ['taskMs', 'scriptMs']);
  measured('startup');
  out.results.startup = res;
}

// ---- 2. click: dispatch cost and event → DOM latency ---------------------------------------
async function clickBench(css, lib, body, extra = '', target = '.c:nth-child(500) > b', watch = '.c:nth-child(500) > s', clicks = 150) {
  const p = await load(doc(css, body, extra), lib);
  // Window capture listener (runs before the library's document listener) and a bubble listener added
  // last on window: the time between them is the synchronous cost of handling the event.
  await p.page.evaluate(({ watch }) => {
    window.__d = []; window.__l = [];
    let t0 = 0, tl = 0;
    addEventListener('click', () => { t0 = tl = performance.now(); }, true);
    addEventListener('click', () => { window.__d.push(performance.now() - t0); });
    new MutationObserver(() => { if (tl) { window.__l.push(performance.now() - tl); tl = 0; } }).observe(document.querySelector(watch), { childList: true, characterData: true, subtree: true });
  }, { watch });
  await p.page.locator(target).scrollIntoViewIfNeeded();
  const box = await p.page.locator(target).boundingBox();
  const m0 = await p.metrics();
  for (let i = 0; i < clicks; i++) {
    await p.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    if (i % 10 === 9) await p.page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  }
  await p.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const m1 = await p.metrics();
  const { l } = await p.page.evaluate(() => ({ l: window.__l }));
  const text = await p.page.textContent(watch);
  await p.close();
  // performance.now() is coarsened to 0.1 ms here: script time per click comes from CDP totals.
  return { scriptMsPerClick: ((m1.ScriptDuration - m0.ScriptDuration) * 1000) / clicks, taskMsPerClick: ((m1.TaskDuration - m0.TaskDuration) * 1000) / clicks, latencyMedian: median(l), latencyP95: pct(l, 0.95), final: text };
}

if (want('click')) {
  const body = COMP.repeat(1000);
  const impls = {
    'v0.8.1 (0.8 syntax)': [LEGACY_CSS, LIBS['v0.8.1']],
    [`${BEFORE} (0.9 syntax)`]: [NEW_CSS, LIBS[BEFORE]],
    'v0.9.0 (0.8 syntax)': [LEGACY_CSS, LIBS['v0.9.0']],
    'v0.9.0 (0.9 syntax)': [NEW_CSS, LIBS['v0.9.0']],
    'plain JavaScript': [LEGACY_CSS.replace(/state\([^)]*\)|on:[^;}]*|attr:[^;}]*|text:[^;}]*|:when\(--on\)/g, 'x'), null, PLAIN_SCRIPT],
  };
  const rows = await series('click', impls, RUNS, async ([css, lib, extra]) => {
    const r = await clickBench(css, lib, body, extra);
    if (r.final !== '150') throw new Error(`expected 150 clicks counted, got ${r.final}`);
    return r;
  });
  const res = { '1000 components, 150 clicks': summarize(rows, ['scriptMsPerClick', 'taskMsPerClick', 'latencyMedian', 'latencyP95']) };
  // Cascade read path: five rules for the same state on the clicked element (0.9 only) vs one.
  const five = `.c { --n: state(0) } .c b:on(click) { --n: increment(1) } .c > b:on(click) { --n: increment(1) } div.c > b:on(click) { --n: increment(1) }
    .c b.x:on(click) { --n: increment(1) } .c > b.x:on(click) { --n: increment(1) } .c s { content: var(--n) }`;
  const one = `.c { --n: state(0) } .c b:on(click) { --n: increment(1) } .c s { content: var(--n) }`;
  const b2 = '<div class="c"><b class="x">+</b><s>0</s></div>'.repeat(1000);
  const check = (r) => { if (r.final !== '150') throw new Error(`expected 150 clicks counted, got ${r.final}`); return r; };
  const rows2 = await series('click-cascade', { 'one rule (no style read)': [one], 'five competing rules (one style read)': [five] }, RUNS, async ([css]) => check(await clickBench(css, LIBS['v0.9.0'], b2)));
  res['1000 components, rules per element (v0.9.0)'] = summarize(rows2, ['scriptMsPerClick', 'taskMsPerClick', 'latencyMedian']);
  // Several writes per event in one transaction.
  const multi = `.c { --a: state(0); --b: state(0); --c: state(0); --d: state(0) } .c b:on(click) { --a: increment(1); --b: set(var(--a) * 2); --c: set(clamp(0, var(--b) + 1, 1000)); --d: set(event(client-x)) } .c s { content: var(--a) }`;
  const rows3 = await series('click-multi', { 'four mutations per click': [multi] }, RUNS, async ([css]) => check(await clickBench(css, LIBS['v0.9.0'], b2)));
  res['1000 components, four mutations per click (v0.9.0)'] = summarize(rows3, ['scriptMsPerClick', 'taskMsPerClick', 'latencyMedian']);
  measured('click');
  out.results.click = res;
  log('click', JSON.stringify(Object.fromEntries(Object.entries(res['1000 components, 150 clicks']).map(([k, v]) => [k, v.scriptMsPerClick.median]))));
}

// ---- 3. high-frequency pointer events ------------------------------------------------------
/** Moves the mouse `n` times across the page; returns script/task ms per second and long tasks. */
async function moves(p, n = 600, area = [100, 100, 700, 500]) {
  await p.page.evaluate(() => { window.__long = 0; new PerformanceObserver((l) => { window.__long += l.getEntries().length; }).observe({ type: 'longtask' }); });
  const m0 = await p.metrics();
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const t = i / n;
    await p.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: area[0] + (area[2] - area[0]) * t, y: area[1] + (area[3] - area[1]) * Math.abs(Math.sin(t * 6)), buttons: 0 });
  }
  await p.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const secs = (Date.now() - t0) / 1000;
  const m1 = await p.metrics();
  const long = await p.page.evaluate(() => window.__long);
  return { scriptMsPerS: ((m1.ScriptDuration - m0.ScriptDuration) * 1000) / secs, taskMsPerS: ((m1.TaskDuration - m0.TaskDuration) * 1000) / secs, longTasks: long, eventsPerS: n / secs };
}

if (want('pointer')) {
  const res = {};
  // Optimized 0.8 scenario: mouse() as a live shared source on 1,000 elements (must not regress).
  const mouseCss = `.m { width: 4px; height: 4px; display: inline-block; translate: calc(mouse(x) / 100) 0 }`;
  const body = '<i class="m"></i>'.repeat(1000);
  const rows = await series('mouse', { 'v0.8.1': [LIBS['v0.8.1']], [`${BEFORE}`]: [LIBS[BEFORE]], 'v0.9.0': [LIBS['v0.9.0']] }, RUNS, async ([lib]) => {
    const p = await load(doc(mouseCss, body), lib); const r = await moves(p); await p.close(); return r;
  });
  res['mouse(x) live on 1,000 elements (same CSS)'] = summarize(rows, ['scriptMsPerS', 'taskMsPerS', 'longTasks', 'eventsPerS']);
  // :on(pointermove) snapshot vs plain JS.
  const pm = `.pad { --x: state(0px); --y: state(0px); position: fixed; inset: 0 } .pad:on(pointermove) { --x: set(event(client-x)); --y: set(event(client-y)) }
    .pad .dot { position: absolute; translate: var(--x) var(--y); width: 8px; height: 8px; background: red }`;
  const pmPlain = `<script>addEventListener('pointermove', (e) => { const d = document.querySelector('.dot'); d.style.translate = e.clientX + 'px ' + e.clientY + 'px'; });</script>`;
  const rows2 = await series('pointermove', { [`${BEFORE} :on(pointermove)`]: [pm, LIBS[BEFORE]], 'v0.9.0 :on(pointermove)': [pm, LIBS['v0.9.0']], 'plain JavaScript': ['.pad{position:fixed;inset:0}.dot{position:absolute;width:8px;height:8px;background:red}', null, pmPlain] }, RUNS, async ([css, lib, extra]) => {
    const p = await load(doc(css, '<div class="pad"><i class="dot"></i></div>', extra), lib); const r = await moves(p); await p.close(); return r;
  });
  res['pointermove snapshot, one element'] = summarize(rows2, ['scriptMsPerS', 'taskMsPerS', 'longTasks', 'eventsPerS']);
  measured('pointer');
  out.results.pointer = res;
  log('pointer', JSON.stringify(res));
}

// ---- 4. drag -------------------------------------------------------------------------------
async function dragRun(p, sel, n = 300) {
  const box = await p.page.locator(sel).first().boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await p.page.evaluate(() => { window.__long = 0; new PerformanceObserver((l) => { window.__long += l.getEntries().length; }).observe({ type: 'longtask' }); });
  await p.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await p.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  const m0 = await p.metrics();
  const t0 = Date.now();
  for (let i = 1; i <= n; i++) await p.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + i, y: y + (i % 50), button: 'left', buttons: 1 });
  await p.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x + n, y: y + (n % 50), button: 'left', buttons: 0, clickCount: 1 });
  await p.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const secs = (Date.now() - t0) / 1000;
  const m1 = await p.metrics();
  const translate = await p.page.$eval(sel, (el) => getComputedStyle(el).translate);
  return { scriptMsPerS: ((m1.ScriptDuration - m0.ScriptDuration) * 1000) / secs, scriptMsPerMove: ((m1.ScriptDuration - m0.ScriptDuration) * 1000) / n, layoutCount: m1.LayoutCount - m0.LayoutCount, longTasks: await p.page.evaluate(() => window.__long), translate };
}

if (want('drag')) {
  const res = {};
  const css = `.k { --x: state(0px); --y: state(0px); width: 10px; height: 10px; display: inline-block; margin: 2px; background: #9cf; translate: var(--x) var(--y); touch-action: none }
    .k:on(drag) { --x: set(event(x)); --y: set(event(y)) }`;
  const plain = `<script>let d; addEventListener('pointerdown', (e) => { const k = e.target.closest('.k'); if (!k) return; d = { k, x: e.clientX, y: e.clientY, ox: k.ox || 0, oy: k.oy || 0 }; k.setPointerCapture(e.pointerId); });
    addEventListener('pointermove', (e) => { if (!d) return; d.k.ox = d.ox + e.clientX - d.x; d.k.oy = d.oy + e.clientY - d.y; d.k.style.translate = d.k.ox + 'px ' + d.k.oy + 'px'; });
    addEventListener('pointerup', () => { d = null; });</script>`;
  for (const n of [1, 1000]) {
    const body = '<i class="k"></i>'.repeat(n);
    const rows = await series('drag', { [`${BEFORE} :on(drag)`]: [css, LIBS[BEFORE]], 'v0.9.0 :on(drag)': [css, LIBS['v0.9.0']], 'v0.9.0 custom (events, gestures)': [css, await custom(['gestures'])], 'plain JavaScript': ['.k{width:10px;height:10px;display:inline-block;margin:2px;background:#9cf}', null, plain] }, RUNS, async ([c, lib, extra]) => {
      const p = await load(doc(c, body, extra), lib); const r = await dragRun(p, '.k'); await p.close();
      if (r.translate !== '300px') throw new Error('drag ended at ' + r.translate);
      return r;
    });
    res[`one active drag among ${n} candidates`] = summarize(rows, ['scriptMsPerS', 'scriptMsPerMove', 'layoutCount', 'longTasks']);
  }
  // Persisted position: storage writes during a 300-move drag.
  const pcss = css.replace('--x: state(0px)', '--x: state(0px, persist("bench-x"))');
  const rows = await series('drag-persist', { 'persisted --x': [pcss] }, RUNS, async ([c]) => {
    const p = await load(doc(c, '<i class="k"></i>', '<script>let w = 0; const s = Storage.prototype.setItem; Storage.prototype.setItem = function (...a) { w++; window.__w = w; return s.apply(this, a); };</script>'), LIBS['v0.9.0']);
    const r = await dragRun(p, '.k');
    await p.page.waitForTimeout(400);
    r.storageWrites = await p.page.evaluate(() => window.__w ?? 0);
    await p.close();
    return r;
  });
  res['persisted position, 300 moves'] = summarize(rows, ['storageWrites', 'scriptMsPerMove']);
  measured('drag');
  out.results.drag = res;
  log('drag', JSON.stringify(res));
}

// ---- 5. idle -------------------------------------------------------------------------------
if (want('idle')) {
  const idleCss = (old) => NEW_CSS + ` .k { --x: state(0px, persist("i")) } .k:on(drag) { --x: set(event(x)) } input:blur { color: red } ${focusReq('.c input', '--on', old)}`;
  const css = idleCss(false);
  const rows = await series('idle', { 'v0.8.1 (0.8 syntax)': [LEGACY_CSS, LIBS['v0.8.1']], [`${BEFORE} (0.9 syntax, every new feature)`]: [idleCss(true), LIBS[BEFORE]], 'v0.9.0 (0.9 syntax, every new feature)': [css, LIBS['v0.9.0']] }, Math.min(RUNS, 3), async ([c, lib]) => {
    const p = await load(doc(c, (COMP + '<i class="k"></i><input>').repeat(1000)), lib);
    await p.page.waitForTimeout(1000);
    const s0 = await p.page.evaluate(() => window.ReactiveCSS.stats());
    const m0 = await p.metrics();
    await p.page.waitForTimeout(10000);
    const m1 = await p.metrics();
    const s1 = await p.page.evaluate(() => window.ReactiveCSS.stats());
    await p.close();
    return { scriptMs: (m1.ScriptDuration - m0.ScriptDuration) * 1000, taskMs: (m1.TaskDuration - m0.TaskDuration) * 1000, flushes: s1.flushes - s0.flushes, ticks: s1.ticks - s0.ticks };
  });
  measured('idle');
  out.results.idle = { '10 s idle after start, 1000 components': summarize(rows, ['scriptMs', 'taskMs', 'flushes', 'ticks']) };
  log('idle', JSON.stringify(out.results.idle));
}

// ---- 6. memory: mount / unmount ---------------------------------------------------------------
if (want('memory')) {
  const heap = async (p) => { await p.page.evaluate(() => { for (let i = 0; i < 3; i++) window.gc?.(); }); return (await p.metrics()).JSHeapUsedSize / 1048576; };
  const rows = await series('memory', { 'v0.8.1 (0.8 syntax)': [LEGACY_CSS, LIBS['v0.8.1']], [`${BEFORE} (0.9 syntax)`]: [NEW_CSS, LIBS[BEFORE]], 'v0.9.0 (0.8 syntax)': [LEGACY_CSS, LIBS['v0.9.0']], 'v0.9.0 (0.9 syntax)': [NEW_CSS, LIBS['v0.9.0']] }, RUNS, async ([css, lib]) => {
    const p = await load(doc(css, '<main></main>'), lib);
    const empty = await heap(p);
    await p.page.evaluate((c) => { document.querySelector('main').innerHTML = c; }, COMP.repeat(10000));
    await p.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const mounted = await heap(p);
    for (let i = 0; i < 10; i++) {
      await p.page.evaluate(() => { document.querySelector('main').textContent = ''; });
      await p.page.evaluate((c) => { document.querySelector('main').innerHTML = c; }, COMP.repeat(1000));
      await p.page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    }
    await p.page.evaluate(() => { document.querySelector('main').textContent = ''; });
    await p.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const after = await heap(p);
    const s = await p.page.evaluate(() => window.ReactiveCSS.stats());
    await p.close();
    return { mountedMB: mounted - empty, retainedMB: after - empty, bindings: s.bindings, states: s.states };
  });
  measured('memory');
  out.results.memory = { '10,000 components mounted, then 10 × 1,000 mount/unmount': summarize(rows, ['mountedMB', 'retainedMB', 'bindings', 'states']) };
  log('memory', JSON.stringify(out.results.memory));
}

// ---- 7. live() at 200 ms on 10,000 elements (optimized 0.4 scenario) ---------------------------
if (want('live')) {
  const css = `.l { display: inline-block; width: 2px; height: 2px; opacity: live(random(0.2, 1), 200ms) }`;
  const rows = await series('live', { 'v0.8.1': [LIBS['v0.8.1']], [`${BEFORE}`]: [LIBS[BEFORE]], 'v0.9.0': [LIBS['v0.9.0']] }, RUNS, async ([lib]) => {
    const p = await load(doc(css, '<i class="l"></i>'.repeat(10000)), lib);
    const frames = await p.page.evaluate(() => new Promise((res) => { const f = []; let last = performance.now(); const end = last + 3000; const loop = (t) => { f.push(t - last); last = t; if (t < end) requestAnimationFrame(loop); else res(f); }; requestAnimationFrame(loop); }));
    const m = await p.metrics();
    await p.close();
    return { frameP95: pct(frames, 0.95), frameMedian: median(frames), heapMB: m.JSHeapUsedSize / 1048576 };
  });
  measured('live');
  out.results.live = { 'live(random(), 200ms) on 10,000 elements, 3 s': summarize(rows, ['frameMedian', 'frameP95', 'heapMB']) };
  log('live', JSON.stringify(out.results.live));
}

// ---- 8. compilation ------------------------------------------------------------------------------
if (want('compile')) {
  const onRules = Array.from({ length: 500 }, (_, i) => `.e${i}:on(click) { --n: increment(${i % 5 + 1}) }`).join('\n');
  const legacyOn = Array.from({ length: 500 }, (_, i) => `.e${i} { on: click(increment(--n, ${i % 5 + 1})) }`).join('\n');
  const whens = Array.from({ length: 2000 }, (_, i) => `.w${i}:when(--n > ${i}) { color: red }`).join('\n');
  const native = Array.from({ length: 5000 }, (_, i) => `.u${i} > .v${i % 50}:hover, .x${i} { color: #${(i * 4099 % 0xffffff).toString(16).padStart(6, '0')}; margin: ${i % 7}px }`).join('\n');
  const cases = {
    '500 event rules': { 'v0.8.1 (on:)': [`.r { --n: state(0) } ${legacyOn}`, LIBS['v0.8.1']], 'v0.9.0 (on:)': [`.r { --n: state(0) } ${legacyOn}`, LIBS['v0.9.0']], [`${BEFORE} (:on())`]: [`.r { --n: state(0) } ${onRules}`, LIBS[BEFORE]], 'v0.9.0 (:on())': [`.r { --n: state(0) } ${onRules}`, LIBS['v0.9.0']] },
    '2000 :when() selectors': { 'v0.8.1': [`.r { --n: state(0) } ${whens}`, LIBS['v0.8.1']], [`${BEFORE}`]: [`.r { --n: state(0) } ${whens}`, LIBS[BEFORE]], 'v0.9.0': [`.r { --n: state(0) } ${whens}`, LIBS['v0.9.0']] },
    '5000 native rules + one reactive rule': { 'v0.8.1': [`${native} .r { --n: state(0) }`, LIBS['v0.8.1']], [`${BEFORE}`]: [`${native} .r { --n: state(0) }`, LIBS[BEFORE]], 'v0.9.0': [`${native} .r { --n: state(0) }`, LIBS['v0.9.0']] },
    '5000 native rules only (the pre-filter path)': { 'v0.8.1': [native, LIBS['v0.8.1']], [`${BEFORE}`]: [native, LIBS[BEFORE]], 'v0.9.0': [native, LIBS['v0.9.0']] },
  };
  const res = {};
  for (const [name, impls] of Object.entries(cases)) {
    const rows = await series('compile', impls, RUNS, async ([css, lib]) => {
      const p = await load(doc(css, '<div class="r"></div>'), lib, { ready: /state\(/.test(css) });
      const parseMs = await p.page.evaluate(() => window.ReactiveCSS.stats().parseMs);
      const m = await p.metrics();
      // Replace the sheet with an edited copy: recompilation cost.
      const t = await p.page.evaluate(() => { const s = document.querySelector('style'); const t0 = performance.now(); s.textContent += '\n.zz { color: red }'; return new Promise((r) => requestAnimationFrame(() => r(performance.now() - t0))); });
      await p.close();
      return { compileMs: parseMs, taskMs: m.TaskDuration * 1000, replaceMs: t };
    });
    res[name] = summarize(rows, ['compileMs', 'taskMs', 'replaceMs']);
  }
  measured('compile');
  out.results.compile = res;
  log('compile', JSON.stringify(res));
}

// ---- 9. form input, mousemove, scroll ------------------------------------------------------------
if (want('input')) {
  const res = {};
  const body = '<form class="f"><input class="q"><span class="o"></span></form>';
  const legacyIn = `.f { --q: state("") } .f .q { bind: --q } .f .o { text: var(--q) }`;
  const newIn = `.f { --q: state("") } .f .q:on(input) { --q: set(event(value)) } .f .o { content: var(--q) } .f .q { --own: state("", bind(value)) }`;
  const plainIn = `<script>addEventListener('input', (e) => { if (e.target.matches('.q')) document.querySelector('.o').textContent = e.target.value; });</script>`;
  const typeRun = async (p) => {
    await p.page.focus('.q');
    const m0 = await p.metrics();
    for (let i = 0; i < 100; i++) await p.cdp.send('Input.insertText', { text: 'x' });
    await p.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const m1 = await p.metrics();
    const shown = await p.page.textContent('.o');
    if (shown.length !== 100) throw new Error('input preview shows ' + shown.length + ' characters');
    return { scriptMsPerInput: ((m1.ScriptDuration - m0.ScriptDuration) * 1000) / 100, taskMsPerInput: ((m1.TaskDuration - m0.TaskDuration) * 1000) / 100 };
  };
  const rows = await series('input', { 'v0.8.1 (bind:, text:)': [legacyIn, LIBS['v0.8.1']], 'v0.9.0 (bind:, text:)': [legacyIn, LIBS['v0.9.0']], [`${BEFORE} (:on(input), event(value), bind(value))`]: [newIn, LIBS[BEFORE]],
    'v0.9.0 (:on(input), event(value), bind(value))': [newIn, LIBS['v0.9.0']], 'plain JavaScript': ['.f{}', null, plainIn] }, RUNS, async ([css, lib, extra]) => {
    const p = await load(doc(css, body, extra), lib); const r = await typeRun(p); await p.close(); return r;
  });
  res['100 characters typed into a bound field with a live preview'] = summarize(rows, ['scriptMsPerInput', 'taskMsPerInput']);
  const mm = `.pad { --x: state(0px); position: fixed; inset: 0 } .pad:on(mousemove) { --x: set(event(client-x)) } .pad .dot { position: absolute; translate: var(--x) 0; width: 8px; height: 8px; background: red }`;
  const mmPlain = `<script>addEventListener('mousemove', (e) => { document.querySelector('.dot').style.translate = e.clientX + 'px 0'; });</script>`;
  const rows2 = await series('mousemove', { [`${BEFORE} :on(mousemove)`]: [mm, LIBS[BEFORE]], 'v0.9.0 :on(mousemove)': [mm, LIBS['v0.9.0']], 'plain JavaScript': ['.pad{position:fixed;inset:0}.dot{position:absolute;width:8px;height:8px}', null, mmPlain] }, RUNS, async ([css, lib, extra]) => {
    const p = await load(doc(css, '<div class="pad"><i class="dot"></i></div>', extra), lib); const r = await moves(p); await p.close(); return r;
  });
  res['mousemove snapshot, one element'] = summarize(rows2, ['scriptMsPerS', 'taskMsPerS', 'longTasks']);
  const sc = `.list { --top: state(0px); height: 300px; overflow: auto } .list:on(scroll) { --top: set(event(scroll-top)) } .list .bar { position: sticky; top: 0; height: 4px; background: red; scale: calc(var(--top) / 5000px) 1; transform-origin: left }`;
  const scPlain = `<script>document.addEventListener('scroll', (e) => { if (e.target.matches?.('.list')) e.target.querySelector('.bar').style.scale = (e.target.scrollTop / 5000) + ' 1'; }, true);</script>`;
  const scBody = '<div class="list"><i class="bar"></i><div style="height:6000px"></div></div>';
  const scrollRun = async (p) => {
    const box = await p.page.locator('.list').boundingBox();
    const m0 = await p.metrics(); const t0 = Date.now();
    for (let i = 0; i < 200; i++) await p.cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: box.x + 50, y: box.y + 50, deltaX: 0, deltaY: 20 });
    await p.page.evaluate(() => new Promise((r) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), 300)));
    const m1 = await p.metrics(); const secs = (Date.now() - t0) / 1000;
    return { scriptMsPerS: ((m1.ScriptDuration - m0.ScriptDuration) * 1000) / secs, taskMsPerS: ((m1.TaskDuration - m0.TaskDuration) * 1000) / secs };
  };
  const rows3 = await series('scroll', { [`${BEFORE} :on(scroll)`]: [sc, LIBS[BEFORE]], 'v0.9.0 :on(scroll)': [sc, LIBS['v0.9.0']], 'plain JavaScript': ['.list{height:300px;overflow:auto}.bar{position:sticky;top:0;height:4px;display:block}', null, scPlain] }, RUNS, async ([css, lib, extra]) => {
    const p = await load(doc(css, scBody, extra), lib); const r = await scrollRun(p); await p.close(); return r;
  });
  res['scroll snapshot (200 wheel steps)'] = summarize(rows3, ['scriptMsPerS', 'taskMsPerS']);
  measured('input');
  out.results.input = res;
  log('input', JSON.stringify(res).slice(0, 400));
}

// ---- 10. rendering: event → style, text, attribute, focus ---------------------------------------
if (want('render')) {
  const css = `.c { --n: state(0); --o: state(false) } .c b:on(click) { --n: increment(1); --o: toggle() } .c .s { width: calc(10px + var(--n) * 1px) }
    .c .t { content: var(--n) } .c .a { --attr-data-n: var(--n) } FOCUS_REQ`;
  const cssOld = css.replace('FOCUS_REQ', focusReq('.c input', '--o', true));
  const cssNew = css.replace('FOCUS_REQ', focusReq('.c input', '--o', false));
  const legacy = `.c { --n: state(0); --o: state(false) } .c b { on: click(increment(--n), toggle(--o)) } .c .s { width: calc(10px + var(--n) * 1px) }
    .c .t { text: var(--n) } .c .a { attr: data-n var(--n) } .c input { focus: var(--o) }`;
  const body = '<div class="c"><b>b</b><i class="s" style="display:block"></i><span class="t">0</span><em class="a"></em><input></div>';
  const renderRun = async (p) => {
    await p.page.evaluate(() => {
      const c = document.querySelector('.c'); window.__r = { style: [], text: [], attr: [], focus: [] };
      let t0 = 0, pending = {};
      addEventListener('click', () => { t0 = performance.now(); pending = { style: 1, text: 1, attr: 1, focus: 1 }; }, true);
      const rec = (k) => { if (pending[k]) { window.__r[k].push(performance.now() - t0); pending[k] = 0; } };
      new MutationObserver(() => rec('text')).observe(c.querySelector('.t'), { childList: true, characterData: true, subtree: true });
      new MutationObserver(() => rec('attr')).observe(c.querySelector('.a'), { attributes: true });
      c.querySelector('input').addEventListener('focus', () => rec('focus'));
      const w0 = () => getComputedStyle(c.querySelector('.s')).width;
      let last = w0();
      const loop = () => { const w = w0(); if (w !== last) { last = w; rec('style'); } requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    });
    const box = await p.page.locator('.c b').boundingBox();
    for (let i = 0; i < 40; i++) {
      await p.page.mouse.click(box.x + 2, box.y + 2);
      await p.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    }
    const r = await p.page.evaluate(() => window.__r);
    return { styleMs: median(r.style), textMs: median(r.text), attrMs: median(r.attr), focusMs: r.focus.length ? median(r.focus) : -1, focusCount: r.focus.length };
  };
  const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
  const rows = await series('render', { 'v0.8.1 (0.8 syntax)': [legacy, LIBS['v0.8.1']], [`${BEFORE} (0.9 syntax)`]: [BEFORE === 'v0.9.0-rc1' || BEFORE === 'v0.9.0-hardened' ? cssOld : cssNew, LIBS[BEFORE]], 'v0.9.0 (0.8 syntax)': [legacy, LIBS['v0.9.0']], 'v0.9.0 (0.9 syntax)': [cssNew, LIBS['v0.9.0']] }, RUNS, async ([c, lib]) => {
    const p = await load(doc(c, body), lib); const r = await renderRun(p); await p.close(); return r;
  });
  measured('render');
  out.results.render = { 'click → first observation (ms, median of 40 clicks)': summarize(rows, ['styleMs', 'textMs', 'attrMs', 'focusMs', 'focusCount']) };
  log('render', JSON.stringify(out.results.render).slice(0, 400));
}

// ---- 11. lifecycle memory: 100 mount cycles, drag cycles, sheet replacement -----------------------
if (want('lifecycle')) {
  const heap = async (p) => { await p.page.evaluate(() => { for (let i = 0; i < 3; i++) window.gc?.(); }); return (await p.metrics()).JSHeapUsedSize / 1048576; };
  const rows = await series('mount100', { 'v0.8.1 (0.8 syntax)': [LEGACY_CSS, LIBS['v0.8.1']], [`${BEFORE} (0.9 syntax)`]: [NEW_CSS, LIBS[BEFORE]], 'v0.9.0 (0.9 syntax)': [NEW_CSS, LIBS['v0.9.0']] }, Math.min(RUNS, 3), async ([css, lib]) => {
    const p = await load(doc(css, '<main></main>'), lib);
    const empty = await heap(p);
    for (let i = 0; i < 100; i++) {
      await p.page.evaluate((c) => { document.querySelector('main').innerHTML = c; }, COMP.repeat(500));
      await p.page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
      await p.page.evaluate(() => { document.querySelector('main').textContent = ''; });
    }
    await p.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const after = await heap(p);
    const s = await p.page.evaluate(() => window.ReactiveCSS.stats());
    await p.close();
    return { retainedMB: after - empty, bindings: s.bindings, states: s.states };
  });
  const dcss = `.k { --x: state(0px, persist("lc")); width: 20px; height: 20px; display: inline-block; translate: var(--x) 0; touch-action: none } .k:on(drag) { --x: set(event(x)) } .k:on(drag(start)) { --x: set(var(--x)) }`;
  const rows2 = await series('dragmem', { [`${BEFORE}`]: [LIBS[BEFORE]], 'v0.9.0': [LIBS['v0.9.0']] }, Math.min(RUNS, 3), async ([lib]) => {
    const p = await load(doc(dcss, '<i class="k"></i>'.repeat(50)), lib);
    await dragRun(p, '.k', 20);
    const first = await heap(p);
    for (let i = 0; i < 100; i++) await dragRun(p, `.k:nth-child(${(i % 50) + 1})`, 20);
    const after = await heap(p);
    await p.close();
    return { retainedMBAfter100Drags: after - first };
  });
  const rows3 = await series('sheetmem', { 'v0.8.1 (0.8 syntax)': [LEGACY_CSS, LIBS['v0.8.1']], [`${BEFORE} (0.9 syntax)`]: [NEW_CSS, LIBS[BEFORE]], 'v0.9.0 (0.9 syntax)': [NEW_CSS, LIBS['v0.9.0']] }, Math.min(RUNS, 3), async ([css, lib]) => {
    const p = await load(doc(css, COMP.repeat(200)), lib);
    const first = await heap(p);
    for (let i = 0; i < 100; i++) await p.page.evaluate((c) => { document.querySelector('style').textContent = c + `\n.v${Date.now()} { color: red }`; }, css);
    await p.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const after = await heap(p);
    const s = await p.page.evaluate(() => window.ReactiveCSS.stats());
    await p.close();
    return { retainedMB: after - first, sheets: s.sheets, bindings: s.bindings };
  });
  measured('lifecycle');
  out.results.lifecycle = {
    '100 × mount/unmount of 500 components': summarize(rows, ['retainedMB', 'bindings', 'states']),
    '100 drags (50 persisted draggables)': summarize(rows2, ['retainedMBAfter100Drags']),
    '100 stylesheet replacements (200 components)': summarize(rows3, ['retainedMB', 'sheets', 'bindings']),
  };
  log('lifecycle', JSON.stringify(out.results.lifecycle).slice(0, 400));
}

await browser.close();

// ---- report ---------------------------------------------------------------------------------------
writeFileSync(JSON_OUT, JSON.stringify(out, null, 1) + '\n');
const lines = [`# v0.8.1 vs v0.9.0 (rc1 and hardened)${out.throttle > 1 ? ` at ${out.throttle}× CPU throttling` : ''}`, '', `Chromium ${out.browser} · ${out.cpu} (${out.cores} cores) · runs per cell interleaved (ABAB…) · median (min–max)`, ''];
for (const [section, groups] of Object.entries(out.results)) {
  const when = out.sections[section];
  lines.push(`## ${section}`, '', when ? `Measured ${when.date.slice(0, 16).replace('T', ' ')} UTC, ${when.runs} runs per cell.` : '', '');
  for (const [group, impls] of Object.entries(groups)) {
    const keys = Object.keys(Object.values(impls)[0]);
    lines.push(`### ${group}`, '', `| Implementation | ${keys.join(' | ')} |`, `|---|${keys.map(() => '---').join('|')}|`);
    for (const [impl, v] of Object.entries(impls)) lines.push(`| ${impl} | ${keys.map((k) => `${r1(v[k].median)} (${r1(v[k].min)}–${r1(v[k].max)})`).join(' | ')} |`);
    lines.push('');
  }
}
writeFileSync(JSON_OUT.replace(/\.json$/, '.md'), lines.join('\n'));
log('written ' + JSON_OUT.replace(ROOT, '') + ' and .md');
