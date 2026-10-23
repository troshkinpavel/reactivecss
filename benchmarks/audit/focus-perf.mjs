// focus: cost (0.6.0) against a baseline bundle.
//   node benchmarks/audit/focus-perf.mjs --lib=reactive-css.min.js [--runs=5] [--out=name]
// Page: n components <div class="f"><button class="t">t</button><button class="o">o</button><h3 tabindex="-1"></h3></div>,
// --on and --other states on .f, `.f h3 { focus: var(--on) }`, and (path=task) an attr: on .o so the
// same-task path runs. On a bundle without focus:, the declaration is an unknown property (no
// bindings), so the difference is what focus: adds. Measures, median of `runs` page loads:
//   startupMs   navigation start to the second frame after the library is ready
//   startupTaskMs  CDP TaskDuration until then
//   updateUs, updateGcs  a click that changes --other only (focus value unchanged): script time and
//                        getComputedStyle() calls per click, 20 clicks per task (no focus moves)
//   focusMs     trusted click to focusin on the heading (qualifying transition; 0.6 only)
//   idleTaskMsPerS  CDP TaskDuration per second over 3 s with nothing happening
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, open, frames } from './lib.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const LIB = arg('lib', 'reactive-css.min.js'), RUNS = +arg('runs', 5), OUT = arg('out', 'run');
const COUNTER = `<script>(() => { const g = window.getComputedStyle; window.__gcs = 0; window.getComputedStyle = function (...a) { window.__gcs++; return g.apply(this, a); }; })();</script>`;
const css = (task) => `.f { --on: state(false); --other: state(0); display: inline-block } .f .t { on: click(toggle(--on)) } .f .o { on: click(increment(--other)); ${task ? 'attr: data-n var(--other);' : ''} }
  .f h3 { focus: var(--on); margin: 0; font-size: 4px }`;
const metrics = async (cdp) => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

const env = await launch();
const out = { date: new Date().toISOString(), browser: env.browser.version(), lib: LIB, runs: RUNS, rows: [] };
for (const path of ['task', 'frame']) for (const n of [1000, 10000]) {
  const runs = [];
  for (let r = 0; r < RUNS; r++) {
    const p = await open(env, { bundle: 'none', before: COUNTER + `<script src="/dist/${LIB}" defer></script>`, head: `<style>${css(path === 'task')}</style>`,
      body: '<div class="f"><button class="t">t</button><button class="o">o</button><h3 tabindex="-1">h</h3></div>'.repeat(n) });
    await p.page.waitForFunction(() => window.ReactiveCSS?.stats().sheets >= 1);
    const startupMs = await p.page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res(performance.now())))));
    const m0 = await metrics(p.cdp);
    await frames(p.page, 2);
    // updates that do not change the focus value
    const upd = await p.page.evaluate(() => {
      const os = document.querySelectorAll('.f .o'); const g0 = window.__gcs; let ms = 0;
      for (let i = 0; i < 20; i++) { const t = performance.now(); os[(i * 37) % os.length].click(); ms += performance.now() - t; }
      return { us: (ms * 1000) / 20, gcs: (window.__gcs - g0) / 20 };
    });
    await frames(p.page, 2);
    // a qualifying transition: trusted click → focusin on that component's heading
    const i = Math.floor(n / 2);
    await p.page.evaluate((i) => {
      const f = document.querySelectorAll('.f')[i], h = f.querySelector('h3');
      window.__focus = new Promise((res) => {
        let t0 = 0;
        f.querySelector('.t').addEventListener('pointerdown', () => { t0 = performance.now(); }, { once: true });
        h.addEventListener('focusin', () => res(performance.now() - t0), { once: true });
        setTimeout(() => res(-1), 1000);
      });
    }, i);
    await p.page.locator('.f .t').nth(i).scrollIntoViewIfNeeded();
    await frames(p.page, 2);
    await p.page.locator('.f .t').nth(i).click(); // a trusted click
    const focusMs = await p.page.evaluate(() => window.__focus);
    // idle
    await frames(p.page, 3);
    const i0 = await metrics(p.cdp);
    await p.page.waitForTimeout(3000);
    const i1 = await metrics(p.cdp);
    runs.push({ startupMs, startupTaskMs: m0.TaskDuration * 1000, updateUs: upd.us, updateGcs: upd.gcs, focusMs, idleTaskMsPerS: ((i1.TaskDuration - i0.TaskDuration) * 1000) / 3,
      bindings: await p.page.evaluate(() => window.ReactiveCSS.stats().bindings) });
    await p.close();
  }
  const row = { path, n };
  for (const k of Object.keys(runs[0])) {
    const v = runs.map((x) => x[k]);
    row[k] = +median(v).toFixed(2);
    row[k + 'Range'] = `${Math.min(...v).toFixed(2)}-${Math.max(...v).toFixed(2)}`;
  }
  out.rows.push(row);
  console.log(JSON.stringify(row));
}
await env.close();
mkdirSync(new URL('./results/v060/', import.meta.url), { recursive: true });
writeFileSync(new URL(`./results/v060/focus-perf-${OUT}.json`, import.meta.url), JSON.stringify(out, null, 1));
