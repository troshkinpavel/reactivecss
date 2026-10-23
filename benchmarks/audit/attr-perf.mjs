// attr: update-path cost (performance experiment after 0.5.3).
//   node benchmarks/audit/attr-perf.mjs [--loads=3] [--samples=5] [--groups=10] [--out=name] [--only=a,b]
// Production bundle, Chromium. n components, each: <span class="dv"><b>t</b><button></button><i></i></span>.
// One sample = `groups` groups; a group = k clicks on <b> of different components in ONE task (so
// every style recalculation measured is a forced one), then two frames. k = 1 is a person
// clicking; k = 20 is a burst (several events before a frame, like benchmarks/run.mjs). Per click:
//   us       script time of the click (action + state + same-task attr: work)
//   gcs      getComputedStyle() calls in the click task (wrapper installed before the library)
//   frameGcs getComputedStyle() calls in the following frames (frame re-reads)
//   recalcs  forced style recalculations (CDP RecalcStyleCount) in the click task
//   styleUs  their duration (CDP RecalcStyleDuration)
//   scriptUs, taskUs  CDP ScriptDuration / TaskDuration of the click task (precise; `us` is
//            performance.now(), clamped to 100 µs steps in this context, so noisy at k = 1)
// Writes benchmarks/audit/results/v053/attr-perf-<out>.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, open, frames } from './lib.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
// --lib=file.js loads /dist/<file> instead of the production bundle (to interleave two builds).
const LIB = arg('lib', 'reactive-css.min.js');
const LOADS = +arg('loads', 3), SAMPLES = +arg('samples', 5), GROUPS = +arg('groups', 10), OUT = arg('out', 'run');

const BASE = `.dv { --on: state(false); display: inline-block } .dv b { on: click(toggle(--on)) } .dv button { width: 4px; height: 4px; padding: 0 }`;
const SCENARIOS = {
  // control: the same click and state change, no attr: (subtract to get the attr: cost)
  control: BASE,
  // one derived attribute that no selector reads
  plain: `${BASE} .dv i { attr: data-on var(--on) }`,
  // one derived attribute that a plain CSS rule selects
  selector: `${BASE} .dv i { attr: data-on var(--on) } .dv i[data-on="1"] { outline: 1px solid red }`,
  // native disabled + :disabled styling (the 0.5.3 benchmark case)
  disabled: `${BASE} .dv button { attr: disabled var(--on) } .dv button:disabled { outline: 1px solid red }`,
  // three derived attributes on one element
  multi: `${BASE} .dv button { attr: disabled var(--on); attr: aria-pressed var(--on); attr: data-on var(--on) }`,
  // a derived attribute that changes which attr: rule applies to another element (needs a second read)
  chained: `${BASE} .dv { attr: data-on var(--on) } .dv i { attr: data-c "off" } .dv[data-on="1"] i { attr: data-c "on" }`,
};

const COUNTER = `<script>(() => { const g = window.getComputedStyle; window.__gcs = 0; window.getComputedStyle = function (...a) { window.__gcs++; return g.apply(this, a); }; })();</script>`;
const metrics = async (cdp) => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const r = (v, d = 2) => +v.toFixed(d);

const env = await launch();
const out = { date: new Date().toISOString(), browser: env.browser.version(), loads: LOADS, samples: SAMPLES, groups: GROUPS, rows: [] };
for (const k of arg('k', '1,20').split(',').map(Number)) for (const n of [1000, 10000]) for (const [name, css] of Object.entries(SCENARIOS)) {
  if (arg('only') && !arg('only').split(',').includes(name)) continue;
  const samples = [];
  let check = true;
  for (let l = 0; l < LOADS; l++) {
    const p = await open(env, { bundle: 'none', before: COUNTER + `<script src="/dist/${LIB}" defer></script>`, head: `<style>${css}</style>`, body: '<span class="dv"><b>t</b><button></button><i></i></span>'.repeat(n) });
    await p.page.waitForFunction(() => window.ReactiveCSS?.stats().sheets >= 1);
    await frames(p.page, 3);
    for (let s = 0; s < SAMPLES; s++) {
      const acc = { ms: 0, gcs: 0, frameGcs: 0, recalcs: 0, style: 0, script: 0, task: 0 };
      for (let g = 0; g < GROUPS; g++) {
        const m0 = await metrics(p.cdp);
        const res = await p.page.evaluate(([k, seed]) => {
          const bs = document.querySelectorAll('.dv b');
          const g0 = window.__gcs;
          let i = seed, ms = 0;
          for (let j = 0; j < k; j++) {
            const b = bs[(i = (i * 31 + 17) % bs.length)];
            const t = performance.now(); b.click(); ms += performance.now() - t;
          }
          return { ms, gcs: window.__gcs - g0 };
        }, [k, s * 1000 + g * 37 + l]);
        const m1 = await metrics(p.cdp);
        const g1 = await p.page.evaluate(() => window.__gcs);
        await frames(p.page, 2);
        acc.ms += res.ms; acc.gcs += res.gcs; acc.frameGcs += (await p.page.evaluate(() => window.__gcs)) - g1;
        acc.recalcs += m1.RecalcStyleCount - m0.RecalcStyleCount; acc.style += m1.RecalcStyleDuration - m0.RecalcStyleDuration;
        acc.script += m1.ScriptDuration - m0.ScriptDuration; acc.task += m1.TaskDuration - m0.TaskDuration;
      }
      const c = k * GROUPS;
      samples.push({ us: (acc.ms * 1000) / c, gcs: acc.gcs / c, frameGcs: acc.frameGcs / c, recalcs: acc.recalcs / c, styleUs: (acc.style * 1e6) / c, scriptUs: (acc.script * 1e6) / c, taskUs: (acc.task * 1e6) / c });
    }
    // Correctness: every component's attribute matches its state after the run.
    check &&= await p.page.evaluate((name) => [...document.querySelectorAll('.dv')].every((d) => {
      const on = getComputedStyle(d).getPropertyValue('--on').trim() === '1';
      const btn = d.querySelector('button'), i = d.querySelector('i');
      if (name === 'disabled' || name === 'multi') if (btn.disabled !== on) return false;
      if (name === 'multi' && btn.getAttribute('aria-pressed') !== String(on)) return false;
      if (name === 'chained') return d.getAttribute('data-on') === (on ? '1' : '0') && i.getAttribute('data-c') === (on ? 'on' : 'off');
      if (name === 'plain' || name === 'selector') return i.getAttribute('data-on') === (on ? '1' : '0');
      return true;
    }), name);
    await p.close();
  }
  const col = (k) => samples.map((x) => x[k]);
  const row = { scenario: name, n, k, correct: check };
  for (const k of ['us', 'taskUs', 'scriptUs', 'styleUs', 'recalcs', 'gcs', 'frameGcs']) { row[k] = r(median(col(k))); row[k + 'Range'] = `${r(Math.min(...col(k)))}-${r(Math.max(...col(k)))}`; }
  out.rows.push(row);
  console.log(JSON.stringify(row));
}
await env.close();
mkdirSync(new URL('./results/v053/', import.meta.url), { recursive: true });
writeFileSync(new URL(`./results/v053/attr-perf-${OUT}.json`, import.meta.url), JSON.stringify(out, null, 1));
