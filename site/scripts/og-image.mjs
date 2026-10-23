// Renders the default Open Graph image (public/og/default.png, 1200 × 630) in the site's type and
// colours. Run again after a copy change: node scripts/og-image.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const out = new URL('../public/og/default.png', import.meta.url).pathname;
mkdirSync(new URL('../public/og/', import.meta.url), { recursive: true });
const html = `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;600&family=Red+Hat+Mono:wght@400;500&display=block" rel="stylesheet">
<style>
  body { margin: 0; width: 1200px; height: 630px; background: oklch(0.985 0.004 85); color: oklch(0.21 0.01 80); font-family: 'Instrument Sans', sans-serif; }
  .card { box-sizing: border-box; height: 100%; padding: 72px 80px; display: flex; flex-direction: column; justify-content: space-between; border-bottom: 10px solid oklch(0.55 0.2 35); }
  .brand { display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 600; }
  .mark { font-family: 'Red Hat Mono', monospace; font-weight: 500; display: flex; align-items: center; gap: 4px; }
  .dot { width: 11px; height: 11px; border-radius: 50%; background: oklch(0.55 0.2 35); }
  h1 { margin: 0; font-size: 150px; line-height: 0.9; letter-spacing: -0.055em; font-weight: 600; }
  h1 span { color: oklch(0.55 0.2 35); }
  p { margin: 0; font-size: 32px; line-height: 1.35; color: oklch(0.43 0.01 80); max-width: 1040px; }
  code { display: block; margin-top: 14px; font-family: 'Red Hat Mono', monospace; font-size: 24px; color: oklch(0.53 0.008 80); }
</style></head><body><div class="card">
  <div class="brand"><span class="mark">{<span class="dot"></span>}</span>Reactive CSS</div>
  <div><h1>CSS that <span>reacts.</span></h1></div>
  <div><p>State, events and interactive behavior in the CSS you already write.</p><code>/* experimental · not a web standard */</code></div>
</div></body></html>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.setContent(html, { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: out });
await b.close();
console.log('wrote', out);
