// Quick single-scenario measurement: node benchmarks/quick.mjs <scenario> <n> <impl...>
import { chromium } from '@playwright/test';
import { startServer } from './server.mjs';
const [scenario, n, ...impls] = process.argv.slice(2);
const server = await startServer();
const PORT = server.port;
const browser = await chromium.launch();
const m = async (cdp) => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
const pct = (a, p) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))].toFixed(1);
try {
  for (const impl of impls) {
    const page = await browser.newPage();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    await page.goto(`http://localhost:${PORT}/benchmarks/bench.html?scenario=${scenario}&n=${n}&impl=${impl}`);
    await page.waitForFunction(() => window.bench, null, { timeout: 120000 });
    await cdp.send('HeapProfiler.collectGarbage');
    const m0 = await m(cdp);
    await page.evaluate(() => bench.drive());
    const fr = await page.evaluate(() => bench.frames(3000));
    const m1 = await m(cdp);
    const d = (k) => ((m1[k] - m0[k]) * 1000 / 3).toFixed(1);
    console.log(`${impl.padEnd(10)} init ${(await page.evaluate(() => bench.initMs)).toFixed(1)}ms heap ${(m0.JSHeapUsedSize / 1048576).toFixed(1)}MB script ${d('ScriptDuration')} style ${d('RecalcStyleDuration')} layout ${d('LayoutDuration')} ms/s  p50 ${pct(fr, .5)} p95 ${pct(fr, .95)} p99 ${pct(fr, .99)}`);
    await page.close();
  }
} finally { await browser.close(); server.stop(); }
