// Measures the production build in headless Chromium: JavaScript per page, layout shift,
// long tasks, island hydration and memory with live previews. Writes docs/performance-results.json.
// Usage: npm run build, then node scripts/measure-performance.mjs
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const PORT = 4420;
const PAGES = ['/', '/docs/introduction/', '/docs/troubleshooting/', '/docs/reference/state/', '/examples/', '/examples/tabs/', '/examples/control-center/', '/playground/', '/design-system/', '/vision/', '/examples/score-history/', '/docs/performance/', '/bundle-builder/', '/docs/custom-bundles/'];
const server = spawn('npx', ['astro', 'preview', '--port', String(PORT), '--ignore-lock'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 3000));
const browser = await chromium.launch();
const results = { date: new Date().toISOString(), engine: `Chromium ${browser.version()} (headless, Playwright)`, pages: [], bundles: [], memory: null };

try {
  for (const path of PAGES) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const js = new Map();
    page.on('response', async (r) => {
      if (r.request().resourceType() !== 'script' || !r.url().includes(`:${PORT}/`)) return;
      try { const b = await r.body(); js.set(r.url(), { raw: b.length, gz: gzipSync(b).length }); } catch {}
    });
    await page.addInitScript(() => {
      window.__perf = { cls: 0, long: [], };
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.long.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true });
    });
    const t0 = Date.now();
    await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: 'load' });
    const load = Date.now() - t0;
    // Islands that hydrate on load or idle; visible ones need a scroll.
    await page.waitForTimeout(1500);
    const before = await page.evaluate(() => ({ islands: document.querySelectorAll('astro-island').length, hydrated: document.querySelectorAll('astro-island:not([ssr])').length }));
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } });
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => ({ hydrated: document.querySelectorAll('astro-island:not([ssr])').length, previews: document.querySelectorAll('iframe[srcdoc]').length, ...window.__perf, nav: performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd }));
    const sum = (k) => [...js.values()].reduce((n, v) => n + v[k], 0);
    results.pages.push({ path, jsRequests: js.size, jsKB: +(sum('raw') / 1024).toFixed(1), jsGzKB: +(sum('gz') / 1024).toFixed(1), loadMs: load, dclMs: Math.round(after.nav ?? 0), islands: before.islands, hydratedAtLoad: before.hydrated, hydratedAfterScroll: after.hydrated, previews: after.previews, cls: +after.cls.toFixed(4), longTasks: after.long.length, longestTaskMs: Math.max(0, ...after.long) });
    await page.close();
  }

  // Memory: the Control Center page with its preview running, then after navigating away.
  const page = await browser.newPage();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); const m = (await cdp.send('Performance.getMetrics')).metrics; return +(m.find((x) => x.name === 'JSHeapUsedSize').value / 1048576).toFixed(1); };
  await page.goto(`http://localhost:${PORT}/docs/troubleshooting/`); await page.waitForTimeout(1000);
  const baseline = await heap();
  await page.goto(`http://localhost:${PORT}/examples/control-center/`); await page.waitForTimeout(2500);
  const workspace = await heap();
  await page.goto(`http://localhost:${PORT}/docs/troubleshooting/`); await page.waitForTimeout(1500);
  const afterNav = await heap();
  results.memory = { note: 'JS heap of the top-level page after GC. Sandboxed previews may run in their own process and are not included.', baselineMB: baseline, controlCenterMB: workspace, afterNavigatingAwayMB: afterNav };
  await page.close();
} finally { await browser.close(); server.kill(); }

const dir = new URL('../dist/_astro/', import.meta.url).pathname;
for (const f of (await readdir(dir)).filter((f) => f.endsWith('.js'))) {
  const b = await readFile(dir + f);
  results.bundles.push({ file: f, kB: +(b.length / 1024).toFixed(1), gzKB: +(gzipSync(b).length / 1024).toFixed(1) });
}
results.bundles.sort((a, b) => b.kB - a.kB);
for (const f of ['runtime/reactive-css.min.js', 'preview/bridge.js']) {
  const b = await readFile(new URL(`../dist/${f}`, import.meta.url));
  results.bundles.push({ file: f + ' (inlined into each preview document)', kB: +(b.length / 1024).toFixed(1), gzKB: +(gzipSync(b).length / 1024).toFixed(1) });
}
await writeFile(new URL('../docs/performance-results.json', import.meta.url), JSON.stringify(results, null, 2) + '\n');
console.table(results.pages);
console.log(results.memory);
console.table(results.bundles.slice(0, 8));
void stat;
