// Example pages (0.5.3): startup, heap and click-to-attribute time for each example, as shipped
// (production bundle, the example's own HTML and CSS).
//   node benchmarks/audit/examples.mjs [--runs=5] [--cpu=4]
// Writes benchmarks/audit/results/v053/examples[-cpu4].json.
// "act" is the time of one dispatched event, measured in the page: the action, the state change
// and the derived attributes written in the same task (attr:), verified on the real DOM.
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './lib.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const RUNS = +arg('runs', 5), CPU = +arg('cpu', 1);

// [example, element to activate, element whose attribute must change, attribute]
const EXAMPLES = [
  ['product-configurator', '#lamp .plus', '#lamp .minus', 'disabled'],
  ['multi-step-wizard', '#setup .next', '#setup > .steps > li:nth-child(2)', 'aria-current'],
  ['interactive-quiz', '.q1 .opt.correct', '.q1 .opt', 'disabled'],
  ['live-form-preview', 'input[name=display_name]', '.card', 'data-name'],
  ['score-history', '#home .up', '#home .reset', 'disabled'],
  ['settings-panel', '.master input', '.channels', 'disabled'],
  ['accessible-tabs', '#t-security', '#t-security', 'aria-selected'],
  ['shopping-cart', '.l2 .plus', '.l2 .minus', 'disabled'],
  ['notification-center', '.n1 .read', '.n1 .read', 'aria-pressed'],
  ['form-validation', 'input[value=business]', '#f-company', 'required'],
  ['keyboard-playground', '.pad', '.pad', 'data-x'],
  ['accessible-toggle', '.toggle', '.toggle', 'aria-pressed'],
];

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const env = await launch();
const out = { date: new Date().toISOString(), browser: env.browser.version(), cpu: CPU, runs: RUNS, rows: [] };
for (const [name, act, target, attribute] of EXAMPLES) {
  const runs = [];
  for (let r = 0; r < RUNS; r++) {
    const page = await env.browser.newPage();
    const cdp = await page.context().newCDPSession(page);
    if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await page.goto(`http://localhost:${env.server.port}/examples/${name}/`);
    await page.waitForFunction(() => window.ReactiveCSS?.stats().sheets >= 1);
    const ready = await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() =>
      res({ readyMs: performance.now(), parseMs: window.ReactiveCSS.stats().parseMs, diagnostics: window.ReactiveCSS.diagnostics.length })))));
    await cdp.send('HeapProfiler.collectGarbage');
    const heap = (await cdp.send('Runtime.getHeapUsage')).usedSize;
    const a = await page.evaluate(([act, target, attribute]) => {
      const el = document.querySelector(act), t = document.querySelector(target);
      if (el.classList.contains('pad')) el.focus(); // focusin is its own event, not timed
      const before = t.getAttribute(attribute);
      const t0 = performance.now();
      if (el instanceof HTMLInputElement && el.type !== 'radio' && el.type !== 'checkbox') { el.value = 'Grace'; el.dispatchEvent(new Event('input', { bubbles: true })); }
      else if (el.classList.contains('pad')) { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); }
      else el.click();
      const ms = performance.now() - t0;
      return { ms, changed: t.getAttribute(attribute) !== before }; // written in the same task
    }, [act, target, attribute]);
    runs.push({ ...ready, heapKB: heap / 1024, actMs: a.ms, changed: a.changed });
    await page.close();
  }
  const row = { example: name, readyMs: +median(runs.map((x) => x.readyMs)).toFixed(1), compileMs: +median(runs.map((x) => x.parseMs)).toFixed(2),
    heapKB: Math.round(median(runs.map((x) => x.heapKB))), actMs: +median(runs.map((x) => x.actMs)).toFixed(3),
    actRange: `${Math.min(...runs.map((x) => x.actMs)).toFixed(3)}-${Math.max(...runs.map((x) => x.actMs)).toFixed(3)}`,
    attributeInSameTask: runs.every((x) => x.changed), diagnostics: Math.max(...runs.map((x) => x.diagnostics)) };
  out.rows.push(row);
  console.log(JSON.stringify(row));
}
await env.close();
mkdirSync(new URL('./results/v053/', import.meta.url), { recursive: true });
writeFileSync(new URL(`./results/v053/examples${CPU > 1 ? `-cpu${CPU}` : ''}.json`, import.meta.url), JSON.stringify(out, null, 1));
