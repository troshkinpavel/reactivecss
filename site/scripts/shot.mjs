// Dev helper: full-page screenshot of a URL. node scripts/shot.mjs <url> <out.png> [width] [scrollToSelector]
import { chromium } from '@playwright/test';
const [url, out, width = '1440', selector] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +width, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('console error:', m.text()); });
page.on('pageerror', (e) => console.log('page error:', e.message));
await page.goto(url, { waitUntil: 'networkidle' });
// Trigger client:visible islands by scrolling through the page.
await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); });
await page.waitForTimeout(1500);
if (selector) { await page.locator(selector).first().scrollIntoViewIfNeeded(); await page.locator(selector).first().screenshot({ path: out }); }
else await page.screenshot({ path: out, fullPage: true });
await browser.close();
