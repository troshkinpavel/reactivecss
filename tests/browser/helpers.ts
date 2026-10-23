import { expect, type Page } from '@playwright/test';
// @ts-expect-error: plain ESM tooling, no type declarations
import { explain } from '../../tools/diagnostics.mjs';

declare global { interface Window { ReactiveCSS: any } }

/** Serves a page (and optional stylesheets) from the test server's origin, then waits for the library. */
/** native: false forces the runtime path for when() (ReactiveCSSConfig.native = false). */
export async function open(page: Page, { head = '', body = '', css = {} as Record<string, string>, native = true, csp = '', scriptNonce = '' }) {
  if (!native) head = '<script>window.ReactiveCSSConfig = { native: false }</script>' + head;
  // RCSS_CPU_THROTTLE=4 runs every page 4x slower in Chromium: the suite as a correctness-under-load test.
  const throttle = Number(process.env.RCSS_CPU_THROTTLE ?? 0);
  if (throttle > 1 && page.context().browser()?.browserType().name() === 'chromium')
    await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: throttle });
  for (const [name, text] of Object.entries(css))
    await page.route(`**/t/css/${name}`, (r) => r.fulfill({ contentType: 'text/css', body: text }));
  await page.route('**/t/page.html', (r) => r.fulfill({
    contentType: 'text/html',
    headers: csp ? { 'Content-Security-Policy': csp } : {},
    body: `<!doctype html><html><head><meta charset="utf-8">${head}<script src="/dist/reactive-css.js" defer${scriptNonce ? ` nonce="${scriptNonce}"` : ''}></script></head><body>${body}</body></html>`,
  }));
  await page.goto('/t/page.html');
  await page.waitForFunction(() => window.ReactiveCSS);
}

export const style = (page: Page, sel: string, prop: string) =>
  page.$eval(sel, (el, p) => getComputedStyle(el).getPropertyValue(p), prop);
export const frames = (page: Page, n = 2) =>
  page.evaluate((n) => new Promise<void>((res) => { const f = () => (n-- ? requestAnimationFrame(f) : res()); f(); }), n);
export const stats = (page: Page) => page.evaluate(() => window.ReactiveCSS.stats());
/**
 * ReactiveCSS.diagnostics, decoded: production bundles (examples, custom bundles) carry diagnostic
 * codes (0.9.0, tools/diagnostics.mjs); development bundles have none, so their text is unchanged.
 */
export const diagnostics = async (page: Page) => (await page.evaluate(() => window.ReactiveCSS.diagnostics as string[])).map((m) => explain(m) as string);

/** CSSOM text of every readable stylesheet in the document (processed sheets are rewritten in place). */
export const sheetCSS = (page: Page) => page.evaluate(() => [...document.styleSheets].map((s) => {
  try { return [...s.cssRules].map((r) => r.cssText).join('\n'); } catch { return ''; }
}).join('\n'));

export { expect };
