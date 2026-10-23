// Runtime performance (0.4 audit): startup, idle CPU, interaction latency, scheduler.
//   node benchmarks/audit/runtime.mjs startup|idle|latency|scheduler [--runs=5]
// Production bundle (dist/reactive-css.min.js) unless --bundle=dev. Every library page is
// compared with the same DOM and CSS without the library ("none") or with plain JavaScript.
// Writes benchmarks/audit/results/runtime-<part>.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, median, pct } from './lib.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const part = process.argv[2] ?? 'startup';
const RUNS = +arg('runs', 5);
const BUNDLE = arg('bundle', 'min');

const env = await launch();
const libTag = `<script src="/dist/${BUNDLE === 'min' ? 'reactive-css.min.js' : 'reactive-css.js'}" defer></script>`;

/** New page in its own context; metrics enabled before navigation so startup is included. */
async function load(html, { lib = true, ready = 'sheets', css = {} } = {}) {
  const context = await env.browser.newContext({ viewport: { width: 800, height: 600 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await page.route('**/a/page.html', (r) => r.fulfill({ contentType: 'text/html', body: html.replace('<!--LIB-->', lib ? libTag : '') }));
  await page.route('**/a/*.css', (r) => r.fulfill({ contentType: 'text/css', body: css[new URL(r.request().url()).pathname] ?? '' }));
  const t = Date.now();
  await page.goto(`http://localhost:${env.server.port}/a/page.html`, { waitUntil: 'load' });
  if (lib && ready === 'sheets') await page.waitForFunction(() => window.ReactiveCSS?.stats().sheets > 0 || window.ReactiveCSS?.stats().parseMs > 0, null, { timeout: 120000 });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 300)))));
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  return { page, cdp, context, errors, metrics, wallMs: Date.now() - t, close: () => context.close() };
}

const doc = (head, body) => `<!doctype html><html><head><meta charset="utf-8">${head}<!--LIB--></head><body>${body}</body></html>`;
const ms = (s) => Math.round(s * 10000) / 10; // seconds -> ms, 0.1 precision
const out = { date: new Date().toISOString(), browser: env.browser.version(), bundle: BUNDLE, runs: RUNS, rows: [] };

// A typical interactive component: state, action, when(), :when(), :nth-var().
const COMP_CSS = `.c { --on: state(false); --a: state(1); display: inline-block } .c > b { on: click(toggle(--on)) } .c > i { display: inline-block; width: 4px; height: 4px; opacity: when(--on, 1, 0.4) }
  .c:when(--on) { outline: 1px solid } .c > u { on: click(set(--a, 2)) } .c > u:nth-var(--a) { color: red }`;
const COMP = '<div class="c"><b>t</b><i></i><u>1</u><u>2</u></div>';
const ordinary = (k) => Array.from({ length: k }, (_, i) => `.u${i} > .v${i % 50}:hover, .w${i} { color: #${(i * 4099 % 0xffffff).toString(16).padStart(6, '0')}; margin: ${i % 7}px ${i % 5}px; padding: 1px }`).join('\n');

const parts = {
  /** Startup cost by element count, and with large amounts of ordinary CSS. */
  async startup() {
    const cases = [];
    for (const n of [0, 10, 100, 1000, 10000]) cases.push({ name: `components-${n}`, elements: n * 5, html: doc(`<style>${COMP_CSS}</style>`, COMP.repeat(n)) });
    const big = ordinary(5000);
    cases.push({ name: 'ordinary-5000-rules-only', html: doc(`<style>${big}</style>`, COMP.repeat(100)), ready: 'none' });
    cases.push({ name: 'ordinary-5000-plus-reactive-same-sheet', html: doc(`<style>${big}\n${COMP_CSS}</style>`, COMP.repeat(100)) });
    cases.push({ name: 'ordinary-5000-plus-reactive-separate-sheet', html: doc(`<style>${big}</style><style>${COMP_CSS}</style>`, COMP.repeat(100)) });
    cases.push({ name: 'linked-reactive-1000', html: doc(`<link rel="stylesheet" href="/a/app.css">`, COMP.repeat(1000)), css: { '/a/app.css': COMP_CSS } });
    // 0.5 cascade-winner path: one vs two state() declarations of --m per owner (the second reads the marker).
    for (const n of [1000, 10000]) {
      cases.push({ name: `state-one-decl-${n}`, elements: n, html: doc(`<style>.s { --m: state(attr(data-m)) }</style>`, '<i class="s w" data-m="x"></i>'.repeat(n)) });
      cases.push({ name: `state-two-decls-${n}`, elements: n, html: doc(`<style>.s { --m: state("a") } .s.w { --m: state(attr(data-m)) }</style>`, '<i class="s w" data-m="x"></i>'.repeat(n)) });
    }
    // 0.5.2: bound vs unbound boolean state per owner.
    for (const n of [1000, 10000]) {
      cases.push({ name: `bound-${n}`, elements: n, html: doc(`<style>.b { --p: state(false, bind(aria-pressed)) }</style>`, '<button class="b">b</button>'.repeat(n)) });
      cases.push({ name: `unbound-${n}`, elements: n, html: doc(`<style>.b { --p: state(false) }</style>`, '<button class="b">b</button>'.repeat(n)) });
    }
    for (const c of cases) {
      if (arg('only') && !arg('only').split(',').some((o) => c.name.startsWith(o))) continue;
      const rows = { rcss: [], none: [] };
      for (let r = 0; r < RUNS; r++) for (const impl of r % 2 ? ['none', 'rcss'] : ['rcss', 'none']) {
        const p = await load(c.html, { lib: impl === 'rcss', ready: c.ready ?? 'sheets', css: c.css });
        const m = await p.metrics();
        const inPage = await p.page.evaluate(() => ({ fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime, dcl: performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd, parseMs: window.ReactiveCSS?.stats().parseMs, diag: window.ReactiveCSS?.diagnostics.length }));
        rows[impl].push({ scriptMs: ms(m.ScriptDuration), styleMs: ms(m.RecalcStyleDuration), layoutMs: ms(m.LayoutDuration), taskMs: ms(m.TaskDuration), styleCount: m.RecalcStyleCount, fcp: inPage.fcp, dcl: inPage.dcl, parseMs: inPage.parseMs, diag: inPage.diag, errors: p.errors.length });
        await p.close();
      }
      const med = (impl, k) => +median(rows[impl].map((x) => x[k] ?? 0)).toFixed(1);
      const rng = (impl, k) => `${Math.min(...rows[impl].map((x) => x[k] ?? 0)).toFixed(1)}-${Math.max(...rows[impl].map((x) => x[k] ?? 0)).toFixed(1)}`;
      const row = { case: c.name, elements: c.elements };
      for (const k of ['scriptMs', 'styleMs', 'layoutMs', 'taskMs', 'fcp']) { row[k] = med('rcss', k); row[k + 'None'] = med('none', k); row[k + 'Range'] = rng('rcss', k); }
      row.compileMs = med('rcss', 'parseMs');
      row.overheadTaskMs = +(row.taskMs - row.taskMsNone).toFixed(1);
      row.errors = rows.rcss.reduce((a, x) => a + x.errors, 0);
      out.rows.push(row);
      out.raw ??= {}; out.raw[c.name] = rows;
      console.log(JSON.stringify(row));
    }
  },

  /** CPU while nothing happens, per page type, compared with the same page without the library. */
  async idle() {
    const N = 1000;
    const pages = {
      static: { css: `.e { translate: random(0px, 100px) 0; width: pick(4px, 5px); height: 4px; display: block }`, body: '<i class="e"></i>'.repeat(N) },
      state: { css: COMP_CSS, body: COMP.repeat(N / 5) },
      forms: { css: `form { --t: state(""); --c: state(false) } form input[type=text] { bind: --t } form input[type=checkbox] { bind: --c } form output::after { content: var(--t) }`, body: '<form><input type="text"><input type="checkbox"><output></output></form>'.repeat(N / 4) },
      history: { css: `.h { --n: state(0); display: block } .h b { on: click(increment(--n)) } .h:changed(--n) i { animation: f 200ms } .h i { display: block; width: calc(4px + (var(--n) - previous(--n)) * 1px); height: 2px; rotate: calc(direction(--n) * 1deg) } @keyframes f { from { opacity: .3 } }`, body: '<div class="h"><b>b</b><i></i></div>'.repeat(N / 3) },
      geometry: { css: `.g { --w: element(width); display: block; height: 2px } .g i { display: block; height: 1px; width: calc(var(--w) / 2) }`, body: '<div class="g"><i></i></div>'.repeat(N / 2) },
      sources: { css: `.e { display: block; width: 4px; height: 4px; --v: visible(); --mx: mouse(x, local); opacity: calc(0.5 + var(--v) * 0.5) }`, body: '<i class="e"></i>'.repeat(N) },
      bound: { css: `.b { --p: state(false, bind(aria-pressed)); on: click(toggle(--p)) } .b[aria-pressed="true"] { outline: 1px solid }`, body: '<button class="b">b</button>'.repeat(N) },
      text: { css: `.t { --n: state(0) } .t b { on: click(increment(--n)) } .t span { text: var(--n) }`, body: '<p class="t"><b>b</b><span>0</span></p>'.repeat(N / 2) },
      live1s: { css: `.e { display: block; width: 4px; height: 4px; translate: live(random(0px, 100px), 1s) 0 }`, body: '<i class="e"></i>'.repeat(N), note: 'not idle by design: one update per second' },
    };
    const WINDOW = 10000;
    for (const [name, pg] of Object.entries(pages)) {
      if (arg('only') && !arg('only').split(',').includes(name)) continue;
      const rows = { rcss: [], none: [] };
      for (let r = 0; r < Math.min(RUNS, 3); r++) for (const impl of ['rcss', 'none']) {
        const css = impl === 'none' ? (pg.plain ?? pg.css.replace(/(^|[;{\s])(on|bind):[^;}]+;?/g, '$1')) : pg.css;
        const p = await load(doc(`<style>${css}</style>`, pg.body), { lib: impl === 'rcss' });
        await p.page.waitForTimeout(2000); // settle: first values, observers, fonts
        const m0 = await p.metrics();
        const s0 = await p.page.evaluate(() => window.ReactiveCSS?.stats());
        await p.page.waitForTimeout(WINDOW);
        const m1 = await p.metrics();
        const s1 = await p.page.evaluate(() => window.ReactiveCSS?.stats());
        const per = (k) => +(((m1[k] - m0[k]) * 1000) / (WINDOW / 1000)).toFixed(2); // ms per second
        rows[impl].push({
          taskMsPerS: per('TaskDuration'), scriptMsPerS: per('ScriptDuration'), styleMsPerS: per('RecalcStyleDuration'), layoutMsPerS: per('LayoutDuration'),
          styleRecalcs: m1.RecalcStyleCount - m0.RecalcStyleCount,
          flushes: s1 ? s1.flushes - s0.flushes : 0, ticks: s1 ? s1.ticks - s0.ticks : 0, jobs: s1 ? s1.jobs - s0.jobs : 0,
        });
        await p.close();
      }
      const row = { page: name, note: pg.note };
      for (const k of Object.keys(rows.rcss[0])) { row[k] = median(rows.rcss.map((x) => x[k])); row[k + 'None'] = median(rows.none.map((x) => x[k])); }
      out.rows.push(row);
      console.log(JSON.stringify(row));
    }
  },

  /** Input-to-correct-frame latency for common widgets, Reactive CSS vs plain JavaScript, idle and under load. */
  async latency() {
    const W = widgets();
    const K = +arg('k', 100), SAMPLES = +arg('samples', 60);
    for (const load of arg('load', 'idle,busy').split(',')) for (const [name, w] of Object.entries(W)) for (const impl of ['rcss', 'plain']) {
      if (arg('only') && !arg('only').split(',').includes(name)) continue;
      const p = await loadWidget(w, impl, K, load);
      const lat = [];
      let wrong = 0;
      for (let i = 0; i < SAMPLES; i++) {
        // A lost input (never observed) counts as incorrect instead of stalling the run.
        const r = await Promise.race([w.act(p.page, i, K), new Promise((res) => setTimeout(() => res(undefined), 5000))]);
        if (r === undefined || r.frames > 8) wrong++;
        else lat.push(r.ms);
      }
      const f1 = (v) => (v === undefined || !isFinite(v) ? null : +v.toFixed(1));
      const row = { widget: name, impl, load, k: K, n: lat.length, p50: f1(pct(lat, 0.5)), p95: f1(pct(lat, 0.95)), max: f1(Math.max(...lat)), incorrect: wrong, errors: p.errors.length };
      out.rows.push(row);
      console.log(JSON.stringify(row));
      await p.close();
    }
  },

  async scheduler() {
    // 1. Starvation: 20,000 live(50ms) values (beyond the frame budget) plus a toggle.
    {
      const p = await load(doc(`<style>.e { display: block; width: 2px; height: 1px; --x: live(random(0px, 100px), 50ms) } ${W_TOGGLE.css}</style>` + PROBE, W_TOGGLE.html + '<i class="e"></i>'.repeat(20000)));
      await p.page.evaluate(() => { window.__q = []; const f = () => { __q.push(ReactiveCSS.stats().internal?.queued ?? -1); requestAnimationFrame(f); }; f(); });
      const lat = [];
      let lost = 0;
      for (let i = 0; i < 30; i++) {
        const r = await Promise.race([W_TOGGLE.act(p.page, i, 1), new Promise((res) => setTimeout(() => res(undefined), 5000))]);
        if (r && r.frames <= 8) lat.push(r.ms); else lost++;
      }
      const r = await p.page.evaluate(async () => {
        const els = [...document.querySelectorAll('.e')];
        const v0 = els.map((e) => e.style.getPropertyValue('--rcss-1') + e.getAttribute('style'));
        const s0 = ReactiveCSS.stats();
        await new Promise((r) => setTimeout(r, 2000));
        const v1 = els.map((e) => e.style.getPropertyValue('--rcss-1') + e.getAttribute('style'));
        const s1 = ReactiveCSS.stats();
        return { updatedFraction: v1.filter((v, i) => v !== v0[i]).length / els.length, jobsPerS: (s1.jobs - s0.jobs) / 2, flushesPerS: (s1.flushes - s0.flushes) / 2, maxQueued: Math.max(...__q), lastFlushMs: s1.lastFlushMs };
      });
      out.rows.push({ test: 'starvation-20k-live50ms', toggleP50: lat.length ? +pct(lat, 0.5).toFixed(1) : null, toggleP95: lat.length ? +pct(lat, 0.95).toFixed(1) : null, toggleLost: lost, ...r });
      console.log(JSON.stringify(out.rows.at(-1)));
      await p.close();
    }
    // 2. Removal with a full queue: 10,000 clicks queue 10,000 jobs, then everything is removed in
    //    the same task. Dead jobs must be skipped cheaply, the queue must drain, nothing retained.
    {
      const p = await load(doc(`<style>.e { display: block; width: 2px; height: 1px; --x: on(click, random(0px, 100px)) }</style>`, '<div id="h">' + '<i class="e"></i>'.repeat(10000) + '</div>'));
      const r = await p.page.evaluate(async () => {
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        for (const e of document.querySelectorAll('.e')) e.click();
        const queuedBefore = ReactiveCSS.stats().internal?.queued;
        document.getElementById('h').remove();
        const j0 = ReactiveCSS.stats();
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r)));
        const j1 = ReactiveCSS.stats();
        return { queuedBefore, jobsInNextFrame: j1.jobs - j0.jobs, writesInNextFrame: j1.writes - j0.writes, flushMs: +j1.lastFlushMs.toFixed(2), after: { bindings: j1.bindings, sources: j1.sources, queued: j1.internal?.queued } };
      });
      out.rows.push({ test: 'remove-10k-with-full-queue', ...r });
      console.log(JSON.stringify(out.rows.at(-1)));
      await p.close();
    }
    // 3. Visibility: periodic work stops while hidden (emulated: the headless shell keeps pages visible).
    {
      const p = await load(doc(`<style>.e { --x: live(pick(1px, 2px), 100ms) }</style>`, '<i class="e"></i>'.repeat(100)));
      const r = await p.page.evaluate(async () => {
        const ticks = () => ReactiveCSS.stats().ticks;
        const t0 = ticks(); await new Promise((r) => setTimeout(r, 1000)); const visible = ticks() - t0;
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
        const t1 = ticks(); await new Promise((r) => setTimeout(r, 1000)); const hidden = ticks() - t1;
        delete document.visibilityState;
        document.dispatchEvent(new Event('visibilitychange'));
        const t2 = ticks(); await new Promise((r) => setTimeout(r, 1000)); const again = ticks() - t2;
        return { ticksPerSVisible: visible, ticksPerSHidden: hidden, ticksPerSAfter: again, timerPendingWhileHidden: undefined };
      });
      // Real background tab: a second page in front (reported, may not hide pages in headless).
      const other = await p.context.newPage(); await other.bringToFront();
      r.realBackgroundVisibility = await p.page.evaluate(() => document.visibilityState);
      out.rows.push({ test: 'visibility', ...r });
      console.log(JSON.stringify(out.rows.at(-1)));
      await p.close();
    }
  },
};

// ---- widgets for the latency test ------------------------------------------------------
// Each has Reactive CSS and plain JavaScript versions with the same visible result, an input
// performed with real (CDP) mouse or keyboard events, and a check of the expected style.

const W_TOGGLE = {
  css: `.w { --on: state(false); display: inline-block; margin: 1px } .w > button { on: click(toggle(--on)); width: 20px; height: 14px } .w > i { display: inline-block; width: 4px; height: 4px; opacity: when(--on, 1, 0.5) }`,
  plainCss: `.w { display: inline-block; margin: 1px } .w > button { width: 20px; height: 14px } .w > i { display: inline-block; width: 4px; height: 4px; opacity: 0.5 } .w[data-on] > i { opacity: 1 }`,
  plainJs: `document.addEventListener('click', (e) => { const w = e.target.closest('.w > button')?.parentElement; if (w) w.toggleAttribute('data-on'); });`,
  html: '<div class="w"><button>t</button><i></i></div>',
  act: (page, i, k) => clickAndWait(page, `.w:nth-of-type(${(i * 37) % k + 1}) > button`, `(t, e) => getComputedStyle(t.parentElement.querySelector('i')).opacity === e`, `(t) => ((t.__on = !t.__on) ? '1' : '0.5')`),
};

function widgets() {
  return {
    toggle: W_TOGGLE,
    counter: {
      css: `.w { --n: state(0); display: inline-block; margin: 1px } .w > button { on: click(increment(--n)); width: 20px; height: 14px } .w > i { display: inline-block; height: 4px; width: calc(2px + var(--n) * 1px) }`,
      plainCss: `.w { display: inline-block; margin: 1px } .w > button { width: 20px; height: 14px } .w > i { display: inline-block; height: 4px; width: calc(2px + var(--n, 0) * 1px) }`,
      plainJs: `document.addEventListener('click', (e) => { const w = e.target.closest('.w > button')?.parentElement; if (w) { w.n = (w.n ?? 0) + 1; w.style.setProperty('--n', w.n); } });`,
      html: '<div class="w"><button>+</button><i></i></div>',
      act: (page, i, k) => clickAndWait(page, `.w:nth-of-type(${(i * 37) % k + 1}) > button`, `(t, e) => getComputedStyle(t.parentElement.querySelector('i')).width === e`, `(t) => (2 + (t.__n = (t.__n ?? 0) + 1)) + 'px'`),
    },
    tabs: {
      // Tabs and panels in separate rows: :nth-var() counts positions among siblings, like :nth-child().
      css: `.w { --a: state(1); display: inline-block; margin: 1px } .w > .t > button { on: click(set(--a, sibling-index())); width: 14px; height: 14px } .w > .t > button:nth-var(--a) { color: red } .w > .p > p { display: none; margin: 0 } .w > .p > p:nth-var(--a) { display: block }`,
      plainCss: `.w { display: inline-block; margin: 1px } .w > .t > button { width: 14px; height: 14px } .w > .t > button.on { color: red } .w > .p > p { display: none; margin: 0 } .w > .p > p.on { display: block }`,
      plainJs: `document.addEventListener('click', (e) => { const b = e.target.closest('.w > .t > button'); if (!b) return; const w = b.closest('.w'), k = [...b.parentElement.children].indexOf(b); for (const row of w.children) [...row.children].forEach((c, j) => c.classList.toggle('on', j === k)); });`,
      html: '<div class="w"><div class="t"><button>1</button><button>2</button><button>3</button></div><div class="p"><p>a</p><p>b</p><p>c</p></div></div>',
      act: (page, i, k) => clickAndWait(page, `.w:nth-of-type(${(i * 37) % k + 1}) > .t > button:nth-child(${(i % 3) + 1})`, `(t) => getComputedStyle(t.closest('.w').querySelector('.p').children[${i % 3}]).display === 'block' && getComputedStyle(t).color === 'rgb(255, 0, 0)'`),
    },
    accordion: {
      css: `.w { --open: state(false); display: inline-block; margin: 1px; vertical-align: top } .w > button { on: click(toggle(--open)); width: 20px; height: 14px } .w > div { display: when(--open, block, none); height: 6px }`,
      plainCss: `.w { display: inline-block; margin: 1px; vertical-align: top } .w > button { width: 20px; height: 14px } .w > div { display: none; height: 6px } .w.open > div { display: block }`,
      plainJs: `document.addEventListener('click', (e) => { const w = e.target.closest('.w > button')?.parentElement; if (w) w.classList.toggle('open'); });`,
      html: '<div class="w"><button>a</button><div></div></div>',
      act: (page, i, k) => clickAndWait(page, `.w:nth-of-type(${(i * 37) % k + 1}) > button`, `(t, e) => getComputedStyle(t.nextElementSibling).display === e`, `(t) => ((t.__o = !t.__o) ? 'block' : 'none')`),
    },
    dropdownOutside: {
      // Open one dropdown by clicking it, then measure the click outside that closes it.
      css: `.w { --open: state(false); display: inline-block; margin: 1px; on: outside(click, set(--open, false)) } .w > button { on: click(toggle(--open)); width: 20px; height: 14px } .w > ul { display: when(--open, block, none); margin: 0; height: 4px }`,
      plainCss: `.w { display: inline-block; margin: 1px } .w > button { width: 20px; height: 14px } .w > ul { display: none; margin: 0; height: 4px } .w.open > ul { display: block }`,
      plainJs: `document.addEventListener('click', (e) => { const w = e.target.closest('.w > button')?.parentElement; if (w) w.classList.toggle('open'); for (const o of document.querySelectorAll('.w.open')) if (!o.contains(e.target)) o.classList.remove('open'); });`,
      html: '<div class="w"><button>v</button><ul></ul></div>',
      act: async (page, i, k) => {
        const sel = `.w:nth-of-type(${(i * 37) % k + 1})`;
        await clickAndWait(page, `${sel} > button`, `(t) => getComputedStyle(t.nextElementSibling).display === 'block'`);
        return clickAndWait(page, '#outside', `() => getComputedStyle(document.querySelector('${sel} > ul')).display === 'none'`);
      },
    },
    keyboard: {
      css: `.w { --n: state(0); display: inline-block; margin: 1px; on: key(ArrowRight, increment(--n)) } .w > button { width: 20px; height: 14px } .w > i { display: inline-block; height: 4px; width: calc(2px + var(--n) * 1px) }`,
      plainCss: `.w { display: inline-block; margin: 1px } .w > button { width: 20px; height: 14px } .w > i { display: inline-block; height: 4px; width: calc(2px + var(--n, 0) * 1px) }`,
      plainJs: `document.addEventListener('keydown', (e) => { if (e.key !== 'ArrowRight') return; const w = document.activeElement?.closest('.w'); if (w) { w.n = (w.n ?? 0) + 1; w.style.setProperty('--n', w.n); } });`,
      html: '<div class="w"><button>k</button><i></i></div>',
      act: async (page, i, k) => {
        const sel = `.w:nth-of-type(${(i * 37) % k + 1}) > button`;
        await page.focus(sel);
        return keyAndWait(page, 'ArrowRight', sel, `(t, e) => getComputedStyle(t.parentElement.querySelector('i')).width === e`, `(t) => (2 + (t.__n = (t.__n ?? 0) + 1)) + 'px'`);
      },
    },
    inputBinding: {
      css: `.w { --v: state(""); display: inline-block; margin: 1px } .w > input { bind: --v; width: 30px } .w > output::after { content: var(--v) }`,
      plainCss: `.w { display: inline-block; margin: 1px } .w > input { width: 30px } .w > output::after { content: attr(data-v) }`,
      plainJs: `document.addEventListener('input', (e) => { const w = e.target.closest('.w'); if (w) w.querySelector('output').dataset.v = e.target.value; });`,
      html: '<div class="w"><input><output></output></div>',
      act: async (page, i, k) => {
        const sel = `.w:nth-of-type(${(i * 37) % k + 1}) > input`;
        await page.focus(sel);
        return keyAndWait(page, 'a', sel, `(t) => getComputedStyle(t.nextElementSibling, '::after').content === JSON.stringify(t.value)`);
      },
    },
    history: {
      // Two buttons: up and down. direction() and previous() show the last step.
      css: `.w { --n: state(0); display: inline-block; margin: 1px } .w > .u { on: click(increment(--n)) } .w > .d { on: click(decrement(--n)) } .w > button { width: 12px; height: 14px }
        .w > i { display: inline-block; height: 4px; width: calc(5px + direction(--n) * 3px); margin-left: calc((var(--n) - previous(--n) + 1) * 1px) }`,
      plainCss: `.w { display: inline-block; margin: 1px } .w > button { width: 12px; height: 14px } .w > i { display: inline-block; height: 4px; width: calc(5px + var(--dir, 0) * 3px); margin-left: calc((var(--step, 0) + 1) * 1px) }`,
      plainJs: `document.addEventListener('click', (e) => { const b = e.target.closest('.w > button'); if (!b) return; const w = b.parentElement, d = b.classList.contains('u') ? 1 : -1; w.style.setProperty('--dir', d); w.style.setProperty('--step', d); });`,
      html: '<div class="w"><button class="u">+</button><button class="d">-</button><i></i></div>',
      act: (page, i, k) => clickAndWait(page, `.w:nth-of-type(${(i * 37) % k + 1}) > .${i % 2 ? 'd' : 'u'}`, `(t) => getComputedStyle(t.parentElement.querySelector('i')).width === '${i % 2 ? 2 : 8}px'`),
    },
    pressedAttr: {
      // 0.5.2: state bound to aria-pressed; plain JS flips the attribute. Checked: the attribute and its native style.
      css: `.w { display: inline-block; margin: 1px } .w > button { --p: state(false, bind(aria-pressed)); on: click(toggle(--p)); width: 20px; height: 14px } .w > button[aria-pressed="true"] { outline: 2px solid red }`,
      plainCss: `.w { display: inline-block; margin: 1px } .w > button { width: 20px; height: 14px } .w > button[aria-pressed="true"] { outline: 2px solid red }`,
      plainJs: `document.addEventListener('click', (e) => { const b = e.target.closest('.w > button'); if (b) b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); });`,
      html: '<div class="w"><button aria-pressed="false">p</button></div>',
      act: (page, i, k) => clickAndWait(page, `.w:nth-of-type(${(i * 37) % k + 1}) > button`, `(t, e) => t.getAttribute('aria-pressed') === e && getComputedStyle(t).outlineStyle === (e === 'true' ? 'solid' : 'none')`, `(t) => ((t.__p = !t.__p) ? 'true' : 'false')`),
    },
    derivedDisabled: {
      // 0.5.3: ancestor state, attr: disabled on a sibling; plain JS toggles the sibling's attribute. Checked: the attribute and :disabled style.
      css: `.w { --on: state(false); display: inline-block; margin: 1px } .w > b { on: click(toggle(--on)); display: inline-block; width: 20px; height: 14px } .w > button { attr: disabled var(--on); width: 8px; height: 8px; padding: 0 } .w > button:disabled { outline: 2px solid red }`,
      plainCss: `.w { display: inline-block; margin: 1px } .w > b { display: inline-block; width: 20px; height: 14px } .w > button { width: 8px; height: 8px; padding: 0 } .w > button:disabled { outline: 2px solid red }`,
      plainJs: `document.addEventListener('click', (e) => { const b = e.target.closest('.w > b'); if (b) b.nextElementSibling.toggleAttribute('disabled'); });`,
      html: '<div class="w"><b>t</b><button></button></div>',
      act: (page, i, k) => clickAndWait(page, `.w:nth-of-type(${(i * 37) % k + 1}) > b`, `(t, e) => t.nextElementSibling.disabled === e && getComputedStyle(t.nextElementSibling).outlineStyle === (e ? 'solid' : 'none')`, `(t) => (t.__d = !t.__d)`),
    },
    textCounter: {
      // 0.5.1: real DOM text; plain JS writes textContent in the listener
      css: `.w { --n: state(0); display: inline-block; margin: 1px } .w > button { on: click(increment(--n)); width: 20px; height: 14px } .w > span { text: var(--n) }`,
      plainCss: `.w { display: inline-block; margin: 1px } .w > button { width: 20px; height: 14px }`,
      plainJs: `document.addEventListener('click', (e) => { const w = e.target.closest('.w > button')?.parentElement; if (w) { w.n = (w.n ?? 0) + 1; w.querySelector('span').textContent = w.n; } });`,
      html: '<div class="w"><button>+</button><span>0</span></div>',
      act: (page, i, k) => clickAndWait(page, `.w:nth-of-type(${(i * 37) % k + 1}) > button`, `(t, e) => t.nextElementSibling.textContent === e`, `(t) => String(t.__n = (t.__n ?? 0) + 1)`),
    },
    conditional: {
      css: `.w { --on: state(false); display: inline-block; margin: 1px } .w > button { on: click(toggle(--on)); width: 20px; height: 14px } .w:when(--on) > i { outline: 2px solid red } .w > i { display: inline-block; width: 4px; height: 4px }`,
      plainCss: `.w { display: inline-block; margin: 1px } .w > button { width: 20px; height: 14px } .w.on > i { outline: 2px solid red } .w > i { display: inline-block; width: 4px; height: 4px }`,
      plainJs: `document.addEventListener('click', (e) => { const w = e.target.closest('.w > button')?.parentElement; if (w) w.classList.toggle('on'); });`,
      html: '<div class="w"><button>c</button><i></i></div>',
      act: (page, i, k) => clickAndWait(page, `.w:nth-of-type(${(i * 37) % k + 1}) > button`, `(t, e) => getComputedStyle(t.parentElement.querySelector('i')).outlineStyle === e`, `(t) => ((t.__o = !t.__o) ? 'solid' : 'none')`),
    },
  };
}

// Background load identical for both implementations, without the library: 1,000 elements
// animated with @keyframes, 1,000 updated by a 100 ms JS interval, and 8 ms of app work every 32 ms.
const BUSY = `<script>
  addEventListener('DOMContentLoaded', () => {
    const bg = document.getElementById('bg');
    bg.innerHTML = '<i class="ka"></i>'.repeat(1000) + '<i class="js"></i>'.repeat(1000);
    const js = [...bg.querySelectorAll('.js')];
    setInterval(() => requestAnimationFrame(() => { for (const e of js) e.style.translate = (Math.random() * 50).toFixed(1) + 'px 0'; }), 100);
    setInterval(() => { const t = performance.now(); while (performance.now() - t < 8); }, 32);
  });
</script><style>#bg i { display: inline-block; width: 2px; height: 2px; background: #888 } #bg .ka { animation: ka 1s linear infinite alternate } @keyframes ka { to { translate: 20px 0 } }</style>`;

const PROBE = `<script>
      // Input latency probe: from the input event's timestamp to the end of the first frame
      // whose style matches the expected result (checked after rendering, every frame).
      window.__probe = (start, check) => new Promise((res) => {
        let frames = 0;
        const after = () => { const mc = new MessageChannel(); mc.port1.onmessage = test; mc.port2.postMessage(0); };
        const test = () => { frames++; if (check() || frames > 8) res({ ms: performance.now() - start, frames }); else requestAnimationFrame(after); };
        requestAnimationFrame(after);
      });
    </script>`;

async function loadWidget(w, impl, k, load) {
  const head = (load === 'busy' ? BUSY : '') + (impl === 'rcss' ? `<style>${w.css}</style>` : `<style>${w.plainCss}</style><script>${w.plainJs}</script>`)
    + PROBE;
  const body = `<div id="outside" style="width:100%;height:20px"></div><div id="ws">${w.html.repeat(k)}</div><div id="bg"></div>`;
  return load_(doc(head, body), impl === 'rcss');
}
const load_ = (html, lib) => load(html, { lib });

/** Real mouse click on sel; latency from pointerdown to the first frame where check(target) is true. */
async function clickAndWait(page, sel, check, prep = '() => null') {
  const box = await (await page.$(sel)).boundingBox();
  // Install the probe before sending input: input events are prioritized over script tasks.
  await page.evaluate(([sel, check, prep]) => {
    const t = document.querySelector(sel);
    const expected = (0, eval)(prep)(t), ok = (0, eval)(check);
    window.__done = new Promise((res) => addEventListener('pointerdown', (e) => {
      const start = e.timeStamp;
      addEventListener('click', () => __probe(start, () => ok(t, expected)).then(res), { once: true, capture: true });
    }, { once: true, capture: true }));
  }, [sel, check, prep]);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  return page.evaluate(() => window.__done);
}

async function keyAndWait(page, key, sel, check, prep = '() => null') {
  await page.evaluate(([sel, check, prep]) => {
    const t = document.querySelector(sel);
    const expected = (0, eval)(prep)(t), ok = (0, eval)(check);
    window.__done = new Promise((res) => addEventListener('keydown', (e) => __probe(e.timeStamp, () => ok(t, expected)).then(res), { once: true, capture: true }));
  }, [sel, check, prep]);
  await page.keyboard.press(key);
  return page.evaluate(() => window.__done);
}

try {
  await parts[part]();
  mkdirSync(new URL('./results/', import.meta.url), { recursive: true });
  writeFileSync(new URL(`./results/runtime-${part}${BUNDLE === 'dev' ? '-dev' : ''}.json`, import.meta.url), JSON.stringify(out, null, 1));
} finally {
  await env.close();
}
