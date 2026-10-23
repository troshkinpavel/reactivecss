// Bundle builder costs, on the production build (run `npm run build` first):
//   node scripts/measure-builder.mjs [--runs=7]
// Writes docs/bundle-builder-performance.json. Medians over `runs` page loads, headless Chromium:
//   initialJsGz       gzipped JS the page loads before any interaction (islands included)
//   analyzerJsGz      gzipped JS loaded by the first "Analyze" (the library's compiler)
//   toggleMs          checkbox click → the build command shows the new selection
//   analyzeFirstMs    first "Analyze" click → result shown (includes loading the compiler)
//   analyzeNextMs     a second analysis
//   cls               layout shift until idle, with a shared link (?profile=forms) restored on load
// and the size of the catalog data the island embeds. (toggleMs includes resolving the selection.)
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const RUNS = +arg('runs', 7), PORT = 4421;
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const CSS = (await readFile(new URL('../../examples/accessible-tabs/style.css', import.meta.url), 'utf8'));

const server = spawn('npx', ['astro', 'preview', '--port', String(PORT), '--ignore-lock'], { stdio: 'ignore' });
for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
const browser = await chromium.launch();
const rows = [];
try {
  for (let r = 0; r < RUNS; r++) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const js = new Map();
    page.on('response', async (res) => { if (res.request().resourceType() === 'script') try { js.set(res.url(), gzipSync(await res.body()).length); } catch {} });
    await page.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
    await page.goto(`http://localhost:${PORT}/bundle-builder/?profile=forms`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
    const cls = await page.evaluate(() => window.__cls);
    const initial = [...js.values()].reduce((a, b) => a + b, 0);
    const toggleMs = await page.evaluate(() => new Promise((res) => {
      const code = document.querySelector('[data-output="2 · Build"] code');
      const t = performance.now();
      new MutationObserver((_, o) => { o.disconnect(); requestAnimationFrame(() => res(performance.now() - t)); }).observe(code, { childList: true, characterData: true, subtree: true });
      document.querySelector('[data-feature="history"] input').click();
    }));
    await page.getByLabel(/Paste every stylesheet/).fill(CSS);
    const analyze = () => page.evaluate(() => new Promise((res) => {
      const box = document.querySelector('[data-analysis]');
      const t = performance.now();
      const check = () => (box.dataset.analysis === 'done' ? res(performance.now() - t) : requestAnimationFrame(check));
      [...document.querySelectorAll('[data-analyzer] button')].find((b) => b.textContent === 'Analyze').click();
      requestAnimationFrame(check);
    }));
    const before = new Set(js.keys());
    const analyzeFirstMs = await analyze();
    await page.waitForLoadState('networkidle');
    const analyzer = [...js].filter(([u]) => !before.has(u)).reduce((a, [, n]) => a + n, 0);
    const analyzeNextMs = await analyze();
    rows.push({ initial, analyzer, toggleMs, analyzeFirstMs, analyzeNextMs, cls });
    await page.close();
  }
} finally { await browser.close(); server.kill(); }

const data = await readFile(new URL('../src/generated/bundles.json', import.meta.url));
const out = {
  date: new Date().toISOString(), engine: `Chromium (headless, Playwright)`, runs: RUNS,
  initialJsGzKB: +(median(rows.map((r) => r.initial)) / 1024).toFixed(1),
  analyzerJsGzKB: +(median(rows.map((r) => r.analyzer)) / 1024).toFixed(1),
  toggleMs: +median(rows.map((r) => r.toggleMs)).toFixed(1),
  analyzeFirstMs: +median(rows.map((r) => r.analyzeFirstMs)).toFixed(1),
  analyzeNextMs: +median(rows.map((r) => r.analyzeNextMs)).toFixed(1),
  cls: +median(rows.map((r) => r.cls)).toFixed(4),
  catalogDataKB: { raw: +(data.length / 1024).toFixed(1), gz: +(gzipSync(data).length / 1024).toFixed(1) },
};
await writeFile(new URL('../docs/bundle-builder-performance.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(out);
