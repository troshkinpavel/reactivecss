// Experiment (0.4 audit): could wave() share one animation across a dense group?
// Plain platform code, no library. Main-thread cost over 5 s, n elements in one container:
//   per-element  one Web Animation per element of a registered, non-inherited property (what wave() does)
//   ancestor     one animation on the container of a registered, *inherited* property, read by the children
//   keyframes    @keyframes on translate itself (composited; what wave() cannot do)
import { writeFileSync } from 'node:fs';
import { launch, median } from './lib.mjs';

const env = await launch();
const out = [];
for (const n of [100, 1000, 10000]) for (const mode of ['per-element', 'ancestor', 'keyframes']) {
  const runs = [];
  for (let r = 0; r < 3; r++) {
    const ctx = await env.browser.newContext({ viewport: { width: 800, height: 600 } });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable');
    await page.route('**/a/page.html', (q) => q.fulfill({ contentType: 'text/html', body: `<!doctype html><style>
      #c { display: flex; flex-wrap: wrap } #c i { width: 4px; height: 4px; background: #555 }
      ${mode === 'keyframes' ? '#c i { animation: f 2s ease-in-out infinite alternate } @keyframes f { from { translate: 0 -4px } to { translate: 0 4px } }' : '#c i { translate: 0 var(--w) }'}
    </style><div id="c">${'<i></i>'.repeat(n)}</div><script>
      const mode = ${JSON.stringify(mode)};
      if (mode !== 'keyframes') {
        CSS.registerProperty({ name: '--w', syntax: '<length>', inherits: mode === 'ancestor', initialValue: '0px' });
        const kf = [{ '--w': '-4px', easing: 'ease-in-out' }, { '--w': '4px', easing: 'ease-in-out' }, { '--w': '-4px' }];
        const targets = mode === 'ancestor' ? [document.getElementById('c')] : [...document.querySelectorAll('#c i')];
        for (const t of targets) t.animate(kf, { duration: 2000, iterations: Infinity });
      }
    </script>` }));
    await page.goto(`http://localhost:${env.server.port}/a/page.html`);
    await page.waitForTimeout(1000);
    const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
    const a = await m();
    await page.waitForTimeout(5000);
    const b = await m();
    runs.push({ styleMsPerS: ((b.RecalcStyleDuration - a.RecalcStyleDuration) * 1000) / 5, taskMsPerS: ((b.TaskDuration - a.TaskDuration) * 1000) / 5, recalcs: (b.RecalcStyleCount - a.RecalcStyleCount) / 5 });
    await ctx.close();
  }
  const row = { n, mode, styleMsPerS: +median(runs.map((x) => x.styleMsPerS)).toFixed(1), taskMsPerS: +median(runs.map((x) => x.taskMsPerS)).toFixed(1), recalcsPerS: median(runs.map((x) => x.recalcs)) };
  out.push(row);
  console.log(JSON.stringify(row));
}
writeFileSync(new URL('./results/wave-sharing.json', import.meta.url), JSON.stringify({ date: new Date().toISOString(), browser: env.browser.version(), rows: out }, null, 1));
await env.close();
