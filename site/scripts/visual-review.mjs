// Visual review: captures the built site at 1440, 1280, 1024 and 390 px and puts each page
// next to the Claude Design reference (design-source/reference/, 1440 and 390 only).
// Usage: npm run build, then `node scripts/visual-review.mjs` (starts astro preview itself).
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, readFile, access } from 'node:fs/promises';

const PORT = 4410;
const out = new URL('../docs/visual-review/', import.meta.url).pathname;
const ref = new URL('../design-source/reference/', import.meta.url).pathname;
const PAGES = [
  ['home', '/'], ['docs-intro', '/docs/introduction/'], ['docs-getting-started', '/docs/getting-started/'], ['docs-api-state', '/docs/reference/state/'],
  ['docs-api', '/docs/reference/'], ['docs-simplify', '/docs/simplify-css/'], ['docs-examples', '/docs/examples/'], ['docs-ex-advanced', '/docs/examples/advanced/'],
  ['control-center', '/examples/control-center/'], ['control-center-deep', '/examples/control-center-deep-dive/'], ['playground', '/playground/'], ['design-system', '/design-system/'], ['vision', '/vision/'],
].filter(([n]) => !process.env.PAGES || process.env.PAGES.split(',').includes(n));
const WIDTHS = [1440, 1280, 1024, 390];

const server = spawn('npx', ['astro', 'preview', '--port', String(PORT), '--ignore-lock'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 3000));
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const w of WIDTHS) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    for (const [name, path] of PAGES) {
      await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: 'networkidle' });
      // Hydrate client:visible islands, then let previews report their values.
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); } scrollTo(0, 0); });
      await page.waitForTimeout(1200);
      const file = `${out}${name}-${w}.png`;
      await page.screenshot({ path: file, fullPage: true });
      const design = `${ref}${name}-${w}.png`;
      if (await access(design).then(() => true, () => false)) {
        const b64 = async (f) => (await readFile(f)).toString('base64');
        const cmp = await browser.newPage({ viewport: { width: w * 2 + 48, height: 900 } });
        await cmp.setContent(`<body style="margin:0;display:flex;gap:16px;padding:16px;background:#ccc;font:14px system-ui;align-items:flex-start">
          <figure style="margin:0;width:${w}px"><figcaption>Claude Design · ${name} · ${w}px</figcaption><img style="width:${w}px" src="data:image/png;base64,${await b64(design)}"></figure>
          <figure style="margin:0;width:${w}px"><figcaption>Implementation · ${path}</figcaption><img style="width:${w}px" src="data:image/png;base64,${await b64(file)}"></figure></body>`);
        await cmp.waitForTimeout(300);
        await cmp.screenshot({ path: `${out}compare-${name}-${w}.png`, fullPage: true });
        await cmp.close();
      }
      console.log(name, w);
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
