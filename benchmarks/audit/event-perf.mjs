// Event dispatch cost (0.7.0, prevent()) against a baseline bundle.
//   node benchmarks/audit/event-perf.mjs --lib=reactive-css.min.js [--loads=3] [--out=name] [--prevent=1]
// Per scenario: µs per dispatched event (200 cancelable synthetic events per task, on a focused
// element, the library's real capture listener), median over loads × 5 samples; and the time to
// insert / remove a sheet with 200 on: rules (until its handlers are live / released).
// --prevent=0 skips the scenarios that use prevent() (a bundle without it rejects them).
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, open, frames } from './lib.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const LIB = arg('lib', 'reactive-css.min.js'), LOADS = +arg('loads', 3), OUT = arg('out', 'run'), PREVENT = arg('prevent', '1') === '1';
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

const N = '<div class="r" tabindex="0"><div class="m"><div class="i" tabindex="0">x</div></div></div>';
const SCEN = {
  'key, no prevent': { css: `.r { --y: state(0); on: key(ArrowDown, increment(--y)) }`, sel: '.r' },
  'key, prevent': { css: `.r { --y: state(0); on: key(ArrowDown, prevent(), increment(--y)) }`, sel: '.r', prevent: true },
  'key, conditional prevent (inactive)': { css: `.r { --y: state(0); --c: state(false); on: key(ArrowDown, increment(--y)) } .r:when(--c) { on: key(ArrowDown, prevent(), increment(--y)) }`, sel: '.r', prevent: true },
  'key, conditional prevent (active)': { css: `.r { --y: state(0); --c: state(true); on: key(ArrowDown, increment(--y)) } .r:when(--c) { on: key(ArrowDown, prevent(), increment(--y)) }`, sel: '.r', prevent: true },
  'key, 3 nested handlers, no prevent': { css: `.r, .m, .i { --y: state(0); on: key(ArrowDown, increment(--y)) }`, sel: '.i' },
  'key, 3 nested handlers, prevent': { css: `.r, .m, .i { --y: state(0); on: key(ArrowDown, prevent(), increment(--y)) }`, sel: '.i', prevent: true },
  'click, no prevent': { css: `.r { --y: state(0); on: click(increment(--y)) }`, sel: '.r', click: true },
};

const env = await launch();
const out = { date: new Date().toISOString(), browser: env.browser.version(), lib: LIB, loads: LOADS, rows: [] };
for (const n of [1000, 10000]) for (const [name, sc] of Object.entries(SCEN)) {
  if (sc.prevent && !PREVENT) continue;
  const us = []; let prevented;
  for (let l = 0; l < LOADS; l++) {
    const p = await open(env, { bundle: 'none', before: `<script src="/dist/${LIB}" defer></script>`, head: `<style>${sc.css}</style>`, body: N.repeat(n) });
    await p.page.waitForFunction(() => window.ReactiveCSS?.stats().sheets >= 1);
    await frames(p.page, 3);
    for (let s = 0; s < 5; s++) {
      const r = await p.page.evaluate(([sel, click]) => {
        const els = document.querySelectorAll(sel); let ms = 0, prevented = 0;
        for (let i = 0; i < 200; i++) {
          const el = els[(i * 37) % els.length];
          const e = click ? new MouseEvent('click', { bubbles: true, cancelable: true }) : new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
          if (!click) el.focus({ preventScroll: true });
          const t = performance.now(); el.dispatchEvent(e); ms += performance.now() - t;
          if (e.defaultPrevented) prevented++;
        }
        return { us: (ms * 1000) / 200, prevented };
      }, [sc.sel, !!sc.click]);
      us.push(r.us); prevented = r.prevented;
      await frames(p.page, 2);
    }
    await p.close();
  }
  const row = { scenario: name, n, us: +median(us).toFixed(2), usRange: `${Math.min(...us).toFixed(2)}-${Math.max(...us).toFixed(2)}`, preventedOf200: prevented };
  out.rows.push(row); console.log(JSON.stringify(row));
}
// Listener setup / teardown: a sheet with 200 on: rules inserted and removed.
for (const withPrevent of PREVENT ? [false, true] : [false]) {
  const ins = [], rem = [];
  for (let l = 0; l < LOADS; l++) {
    const p = await open(env, { bundle: 'none', before: `<script src="/dist/${LIB}" defer></script>`, head: `<style>.base { --y: state(0) }</style>`, body: '<div class="base"></div>' });
    await p.page.waitForFunction(() => window.ReactiveCSS);
    const r = await p.page.evaluate(async (wp) => {
      const rules = Array.from({ length: 200 }, (_, i) => `.k${i} { on: key(ArrowDown, ${wp ? 'prevent(), ' : ''}increment(--y)), click(${wp ? 'prevent(), ' : ''}increment(--y)) }`).join('\n');
      const s = document.createElement('style'); s.textContent = rules;
      const n0 = window.ReactiveCSS.stats().observers;
      const t0 = performance.now(); document.head.append(s);
      while (window.ReactiveCSS.stats().observers === n0) await new Promise((r) => setTimeout(r));
      const t1 = performance.now(); s.remove();
      while (window.ReactiveCSS.stats().observers !== n0) await new Promise((r) => setTimeout(r));
      return [t1 - t0, performance.now() - t1];
    }, withPrevent);
    ins.push(r[0]); rem.push(r[1]);
    await p.close();
  }
  const row = { scenario: `sheet with 200 on: rules${withPrevent ? ' using prevent()' : ''}`, insertMs: +median(ins).toFixed(2), removeMs: +median(rem).toFixed(2) };
  out.rows.push(row); console.log(JSON.stringify(row));
}
await env.close();
mkdirSync(new URL('./results/v070/', import.meta.url), { recursive: true });
writeFileSync(new URL(`./results/v070/event-perf-${OUT}.json`, import.meta.url), JSON.stringify(out, null, 1));
