// Three-way benchmark: 0.9.1 baseline (e35d91f), 0.10 Steps 1-8, 0.10 optimized.
//   node benchmarks/v0100/bench.mjs out.json name=dir name=dir name=dir
// Compile: alternating rounds in Node. Browser: production bundles, Chromium; start, retained heap,
// update script time (the synchronous work plus the frame flush it causes), and mount/unmount retention.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [outFile, ...treeArgs] = process.argv.slice(2);
const TREES = Object.fromEntries(treeArgs.map((a) => a.split('=')));
const names = Object.keys(TREES), BASE = names[0], NEW = names.slice(1);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const rep = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');
const out = { date: new Date().toISOString(), compile: {}, browser: [] };

// ---- compile -------------------------------------------------------------------------------
const SHEETS = {
  'conditions (1,000)': { css: '.c { --n: state(0) }' + rep(1000, (i) => `.c${i}:when(--n >= ${i} and --n <= ${i + 5}) { color: red }`) },
  ':on() actions (1,000)': { css: '.c { --n: state(0) }' + rep(1000, (i) => `.c${i} b:on(click) { --n: set(var(--n) + ${i}) }`) },
  'plain rules with state (1,000)': { css: '.c { --n: state(0) }' + rep(1000, (i) => `.c${i} { width: calc(var(--n) * ${i}px); color: red }`) },
  'text: format() (500)': { css: '.c { --n: state(0) }' + rep(500, (i) => `.c${i} { text: format(--n * ${i}.5, "currency", "EUR") }`), new: true },
  'computed declarations (1,000)': { css: '.c { --n: state("") }' + rep(1000, (i) => `.c${i} { --d${i}: lower(--n) }`), new: true },
  'timer rules (1,000)': { css: '.c { --n: state(0) }' + rep(1000, (i) => `.c${i}:when(--n >= ${i}):on(after(1s)) { --n: set(0) }`), new: true },
};
const mods = {};
for (const [k, d] of Object.entries(TREES)) mods[k] = await import(pathToFileURL(d + '/dist/index.js').href + '?' + k);
for (const [name, s] of Object.entries(SHEETS)) {
  const res = Object.fromEntries(names.map((k) => [k, []]));
  for (let round = 0; round < 6; round++) for (const k of names) {
    if (s.new && k === BASE) continue;
    const { compile, diagnostics } = mods[k];
    diagnostics.length = 0;
    for (let w = 0; w < 5; w++) compile(s.css);
    if (diagnostics.length) throw new Error(`${name}/${k}: ${diagnostics[0]}`);
    const t = [];
    for (let r = 0; r < 40; r++) { const t0 = performance.now(); compile(s.css); t.push(performance.now() - t0); }
    res[k].push(median(t));
  }
  out.compile[name] = Object.fromEntries(names.map((k) => [k, res[k].length ? +median(res[k]).toFixed(2) : null]));
  console.log(name, JSON.stringify(out.compile[name]));
}

// ---- browser --------------------------------------------------------------------------------
const CARD = '<div class="card"><button>+</button><p class="b">b</p></div>';
const ROW = '<div class="row"><button>+</button><span class="t"></span></div>';
const FORM = '<div class="f"><textarea></textarea><span class="count"></span></div>';
const ITEMS = (n) => `<div class="page"><button id="go">+</button><div id="g1">${rep(n, () => '<p class="item"></p>')}</div><div id="g2"></div></div>`;
const W = {
  'event dispatch: cards': { css: '.card { --n: state(0) } .card button:on(click) { --n: increment(1) } .card:when(--n >= 3) .b { display: none }', body: (n) => rep(n, () => CARD), act: 'click', count: 500 },
  'state update: 1 state, N readers': { css: '.page { --v: state(0) } #go:on(click) { --v: increment(1) } .item:when(--v >= 5) { color: red } .item { width: when(--v >= 3, 1px, 2px) }', body: ITEMS, act: 'go', count: 20 },
  'state update: text:': { css: '.row { --n: state(0) } .row button:on(click) { --n: increment(1) } .row .t { text: var(--n) }', body: (n) => rep(n, () => ROW), act: 'click', count: 200 },
  'moves: 100 subtrees': { css: '.page { --v: state(0) } .item:when(--v >= 5) { color: red }', body: ITEMS, act: 'move' },
  'value functions inline': { css: '.f { --value: state("") } .f textarea:on(input) { --value: set(event(value)) } .f .count { text: length(trim(--value)) } .f:when(length(trim(--value)) > 3) .count { color: red }', body: (n) => rep(n, () => FORM), act: 'input', count: 200, new: true },
  'derived chain: form': { css: '.f { --value: state(""); --clean: trim(--value); --chars: length(--clean) } .f textarea:on(input) { --value: set(event(value)) } .f .count { text: var(--chars) } .f:when(--chars > 3) .count { color: red }', body: (n) => rep(n, () => FORM), act: 'input', count: 200, new: true },
  'derived fan-out: filter': { css: '.page { --q: state("") } .item { --name: state(attr(data-name)); --match: includes(lower(--name), lower(--q)) } .item:when(not --match) { display: none } #go:on(click) { --q: set("red") }', body: (n) => `<div class="page"><button id="go">+</button>${rep(n, (i) => `<p class="item" data-name="Item ${i % 97} ${['red', 'green', 'blue'][i % 3]}"></p>`)}</div>`, act: 'go', count: 1, new: true },
  'timers: every(1s), one tick': { css: '.k { --n: state(0) } .k:on(every(1s)) { --n: increment(1) }', body: (n) => rep(n, () => '<i class="k"></i>'), act: 'tick', new: true },
  'clocks: live(time()) derived, one tick': { css: '.c { --now: live(time(), 1s); --tokyo: timezone(--now, "Asia/Tokyo") } .c .t { text: format(--tokyo, "HH:mm:ss") }', body: (n) => rep(n, () => '<div class="c"><span class="t"></span></div>'), act: 'tick', new: true },
  'modifiers: throttle()': { css: '.f { --value: state("") } .f textarea:on(input, throttle(1ms)) { --value: set(event(value)) }', body: (n) => rep(n, () => FORM), act: 'input', count: 200, new: true },
};
const browser = await chromium.launch();
async function run(tree, w, n, runs, runtime) {
  const s = { start: [], heap: [], update: [], retained: [] };
  for (let r = 0; r < runs; r++) {
    const page = await browser.newPage();
    const cdp = await page.context().newCDPSession(page);
    await page.route('**/rt.js', (x) => x.fulfill({ contentType: 'text/javascript', body: runtime }));
    await page.route('**/b.html', (x) => x.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en"><head><style>${w.css}</style><script src="/rt.js" defer></script></head><body>${w.body(n)}</body></html>` }));
    await page.goto('http://bench.test/b.html');
    await page.waitForFunction(() => window.ReactiveCSS);
    const d = await page.evaluate(() => window.ReactiveCSS.diagnostics);
    if (d.length) throw new Error(`${tree}: ${d.join('\n')}`);
    const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); return (await cdp.send('Runtime.getHeapUsage')).usedSize; };
    await page.evaluate(() => window.ReactiveCSS.stop());
    const h0 = await heap();
    s.start.push(await page.evaluate(() => { const t = performance.now(); window.ReactiveCSS.start(); return performance.now() - t; }));
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    s.heap.push(((await heap()) - h0) / 1024);
    s.update.push(await page.evaluate(({ act, count }) => new Promise((res) => {
      const raf = window.requestAnimationFrame, st = window.setTimeout;
      let total = 0, armed = true;
      window.requestAnimationFrame = (cb) => raf((t) => { const t0 = performance.now(); cb(t); if (armed) total += performance.now() - t0; });
      const finish = () => raf(() => raf(() => { armed = false; res(total); }));
      if (act === 'tick') {
        let done = false;
        window.setTimeout = (f, ms, ...a) => st(() => {
          if (done || ms < 500) return f(...a);
          done = true;
          const t0 = performance.now(); f(...a); total += performance.now() - t0;
          finish();
        }, ms, ...a);
        return;
      }
      const t0 = performance.now();
      if (act === 'click') { const bs = document.querySelectorAll('button'); for (let i = 0; i < count; i++) bs[(i * 7919) % bs.length].click(); }
      else if (act === 'go') { const b = document.getElementById('go'); for (let i = 0; i < count; i++) b.click(); }
      else if (act === 'input') { const fs = document.querySelectorAll('textarea'); for (let i = 0; i < count; i++) { const f = fs[(i * 7919) % fs.length]; f.value = ' text ' + i; f.dispatchEvent(new Event('input', { bubbles: true })); } }
      else if (act === 'move') { const a = document.getElementById('g1'), b = document.getElementById('g2'); for (let i = 0; i < 100; i++) b.append(a.firstElementChild); }
      queueMicrotask(() => { total += performance.now() - t0; finish(); }); // after the MutationObserver callback
    }), { act: w.act, count: w.count }));
    // Retention: remove every element while running; what stays after a collection, against the page before start.
    await page.evaluate(() => new Promise((r) => { document.body.replaceChildren(); requestAnimationFrame(() => requestAnimationFrame(r)); }));
    await page.evaluate(() => new Promise((r) => setTimeout(r, 50)));
    s.retained.push(((await heap()) - h0) / 1024);
    await page.close();
  }
  return { startMs: +median(s.start).toFixed(2), heapKB: Math.round(median(s.heap)), updateMs: +median(s.update).toFixed(2), retainedKB: Math.round(median(s.retained)) };
}
for (const n of [1000, 10000]) for (const [name, w] of Object.entries(W)) for (const tree of names) {
  if (w.new && tree === BASE) continue;
  const runtime = readFileSync(`${TREES[tree]}/dist/reactive-css.min.js`, 'utf8');
  const row = { n, workload: name, tree, ...(await run(tree, w, n, n >= 10000 ? 5 : 9, runtime)) };
  out.browser.push(row);
  console.log(JSON.stringify(row));
}
await browser.close();
writeFileSync(outFile, JSON.stringify(out, null, 1) + '\n');
