// Captures full-page reference screenshots of the original Claude Design pages.
// Needs the design-source server running (see .claude/launch.json "design-source").
import { chromium } from '@playwright/test';
const base = process.env.DESIGN_URL || 'http://localhost:8181';
const out = new URL('../design-source/reference/', import.meta.url).pathname;
const pages = [['home', 'Home.dc.html'], ['docs-intro', 'Docs.dc.html#introduction'], ['docs-getting-started', 'Docs.dc.html#getting-started'], ['docs-api-state', 'Docs.dc.html#api-state'], ['docs-api', 'Docs.dc.html#api'], ['docs-simplify', 'Docs.dc.html#simplify-css'], ['docs-examples', 'Docs.dc.html#examples'], ['docs-ex-advanced', 'Docs.dc.html#ex-advanced'], ['control-center', 'Control Center.dc.html'], ['control-center-deep', 'Control Center Deep Dive.dc.html'], ['playground', 'Playground.dc.html'], ['design-system', 'Design System.dc.html'], ['vision', 'Vision.dc.html'], ['examples', 'Examples.dc.html'], ['vision-v2', 'Vision v2.dc.html'], ['custom-bundles', 'Custom Bundles.dc.html']].filter(([n]) => !process.env.PAGES || process.env.PAGES.split(',').includes(n));
const widths = (process.env.WIDTHS || '1440,390').split(',').map(Number);
const browser = await chromium.launch();
for (const w of widths) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  for (const [name, path] of pages) {
    await page.goto(`${base}/${path}`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}${name}-${w}.png`, fullPage: true });
    console.log(name, w);
  }
  await page.close();
}
await browser.close();
