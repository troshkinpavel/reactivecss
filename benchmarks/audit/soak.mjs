// Long-running stability test (0.4 audit).
//   node benchmarks/audit/soak.mjs 5            minutes (default 1)
//   --bundle=min                                production bundle (no stats().internal)
// A mixed application runs continuously: 200 full-feature components, 10 of them replaced
// every 500 ms, clicks/typing/keys/outside clicks/pointer moves every 100 ms, a container
// resized every 100 ms (element()), and a reactive stylesheet disabled/enabled every 10 s.
// Every sample: GC, then heap, DOM nodes, listeners, library counters, animations, long tasks
// and frame times since the previous sample.
// Pass: no unexplained monotonic growth. The heap trend is fitted over the second half of the
// run (after warm-up) and compared with the sample noise.
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, open, measure, slope, pct } from './lib.mjs';
import { FULL_CSS, COMPONENT } from './memory.mjs';

const minutes = +(process.argv.slice(2).find((a) => /^\d+(\.\d+)?$/.test(a)) ?? 1);
const BUNDLE = process.argv.find((a) => a.startsWith('--bundle='))?.slice(9) ?? 'dev';
const SAMPLE_MS = minutes <= 1 ? 5000 : minutes <= 5 ? 10000 : 30000;

const APP = `<script>
  window.ReactiveCSSConfig = { native: false };
  window.__frames = []; window.__longTasks = 0;
  try { new PerformanceObserver((l) => { window.__longTasks += l.getEntries().length; }).observe({ type: 'longtask' }); } catch {}
  let last = performance.now();
  const f = (t) => { __frames.push(t - last); last = t; requestAnimationFrame(f); };
  requestAnimationFrame(f);
  window.__start = (html) => {
    const host = document.getElementById('host');
    host.innerHTML = html.repeat(200);
    let k = 0;
    setInterval(() => { // churn: 10 components replaced
      for (let i = 0; i < 10; i++) { host.firstElementChild?.remove(); host.insertAdjacentHTML('beforeend', html); }
    }, 500);
    setInterval(() => { // interaction
      k++;
      const list = host.children, c = list[(k * 7) % list.length];
      c.querySelector('.t').click();
      c.querySelectorAll('.tabs > b')[k % 2].click();
      const inp = c.querySelector('.in'); inp.value = 'v' + k; inp.dispatchEvent(new InputEvent('input', { bubbles: true }));
      if (k % 5 === 0) c.querySelector('.cb').click();
      if (k % 7 === 0) document.body.click();
      if (k % 11 === 0) { c.querySelector('.t').focus(); c.querySelector('.t').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }
      document.dispatchEvent(new PointerEvent('pointermove', { clientX: k % 800, clientY: k % 600, bubbles: true }));
      host.style.width = 400 + (k % 300) + 'px';
    }, 100);
    setInterval(() => { const s = document.getElementById('extra'); s.disabled = !s.disabled; }, 10000);
  };
  window.__sample = () => {
    const fr = __frames; __frames = [];
    const lt = __longTasks; __longTasks = 0;
    return { frames: fr, longTasks: lt };
  };
</script>`;

const env = await launch();
const p = await open(env, {
  before: APP, bundle: BUNDLE,
  head: `<style>${FULL_CSS}</style><style id="extra">.cmp .o { --x: live(random(0px, 4px), 1s) } .cmp:when(--on) .t { outline: 1px dashed }</style>`,
  body: '<div id="host"></div>',
});
await p.page.evaluate((h) => __start(h), COMPONENT);
const samples = [];
const end = Date.now() + minutes * 60000;
const t0 = Date.now();
while (Date.now() < end) {
  await p.page.waitForTimeout(Math.min(SAMPLE_MS, Math.max(0, end - Date.now())));
  const s = await p.page.evaluate(() => __sample());
  const m = await measure(p);
  const row = {
    t: Math.round((Date.now() - t0) / 1000), ...m, longTasks: s.longTasks, frameCount: s.frames.length,
    frameP50: +pct(s.frames, 0.5).toFixed(1), frameP95: +pct(s.frames, 0.95).toFixed(1), frameMax: +Math.max(...s.frames).toFixed(1),
  };
  samples.push(row);
  console.error(`t=${row.t}s heap ${(row.heapBytes / 1048576).toFixed(2)} MB nodes ${row.nodes} listeners ${row.jsEventListeners} bindings ${row.bindings} states ${row.states} anim ${row.animations} queued ${row['i.queued'] ?? '-'} long ${row.longTasks} p95 ${row.frameP95}`);
}

// Trend over the second half (after warm-up): least-squares slope, and the residual noise.
const half = samples.slice(Math.floor(samples.length / 2));
const xs = half.map((s) => s.t / 60);
const trend = {};
for (const key of ['heapBytes', 'nodes', 'jsEventListeners', 'bindings', 'states', 'sources', 'animations', 'i.queued', 'i.waitingRefs', 'i.bindControls', 'i.nthGroups', 'i.nthIndexed', 'i.outsiders', 'i.sizeSubjects', 'i.changedChecking', 'i.diagnostics']) {
  const ys = half.map((s) => s[key]);
  if (ys.some((v) => v === undefined)) continue;
  const k = slope(xs, ys), mean = ys.reduce((a, b) => a + b, 0) / ys.length;
  const resid = Math.sqrt(ys.reduce((a, y, i) => a + (y - (mean + k * (xs[i] - xs.reduce((p, q) => p + q, 0) / xs.length))) ** 2, 0) / ys.length);
  const span = xs[xs.length - 1] - xs[0];
  trend[key] = { perMinute: +k.toFixed(1), mean: +mean.toFixed(1), noise: +resid.toFixed(1), driftOverHalf: +(k * span).toFixed(1), min: Math.min(...ys), max: Math.max(...ys) };
}
// Growth counts only when the drift over the measured half exceeds 3x the noise and 1% of the mean.
const growing = Object.entries(trend).filter(([, v]) => v.driftOverHalf > 3 * v.noise && v.driftOverHalf > 0.01 * Math.abs(v.mean) && v.driftOverHalf >= 1).map(([k]) => k);
const result = {
  date: new Date().toISOString(), browser: env.browser.version(), bundle: BUNDLE, minutes, sampleMs: SAMPLE_MS, samples, trend, growing,
  pass: growing.length === 0, pageErrors: [...new Set(p.errors)],
  totals: { longTasks: samples.reduce((a, s) => a + s.longTasks, 0), frameP95Median: pct(samples.map((s) => s.frameP95), 0.5), frameMaxWorst: Math.max(...samples.map((s) => s.frameMax)) },
};
mkdirSync(new URL('./results/', import.meta.url), { recursive: true });
writeFileSync(new URL(`./results/soak-${minutes}min${BUNDLE === 'min' ? '-min' : ''}.json`, import.meta.url), JSON.stringify(result, null, 1));
console.log(`${minutes} min: ${result.pass ? 'PASS' : 'GROWTH: ' + growing.join(', ')}; heap ${(samples[0].heapBytes / 1048576).toFixed(2)} -> ${(samples.at(-1).heapBytes / 1048576).toFixed(2)} MB (trend ${(trend.heapBytes.perMinute / 1024).toFixed(1)} KB/min, noise ${(trend.heapBytes.noise / 1024).toFixed(1)} KB); long tasks ${result.totals.longTasks}; frame p95 ${result.totals.frameP95Median} ms; errors ${result.pageErrors.length}`);
await env.close();
