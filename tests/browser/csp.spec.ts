// Content-Security-Policy: real response headers. The library rewrites stylesheets through
// the CSSOM and sets custom properties through element.style, neither of which CSP style-src
// governs, so it needs no 'unsafe-inline' and no nonce of its own.
import { test, expect, type Page } from '@playwright/test';
import { open, style, frames, diagnostics } from './helpers';

const css = `.plain { color: rgb(1, 2, 3) }
  .c { --on: state(false) } .c button { on: click(toggle(--on)) }
  .c i { display: block; width: when(--on, 10px, 1px); height: pick(6px) }
  .t { --v: live(pick(4px), 50ms); display: block; width: var(--v) }`;
const body = '<p class="plain">p</p><div class="c"><button>b</button><i></i></div><b class="t"></b>';

/** Collects CSP violations reported on the page. */
async function violations(page: Page) {
  return page.evaluate(() => (window as any).__csp ?? []);
}
const watchViolations = (page: Page) => page.addInitScript(() => {
  (window as any).__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => (window as any).__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
});

async function works(page: Page) {
  expect(await style(page, '.plain', 'color')).toBe('rgb(1, 2, 3)'); // unrelated rules intact
  expect(await style(page, '.c i', 'height')).toBe('6px'); // reactive value
  expect(await style(page, '.t', 'width')).toBe('4px'); // inline custom property writes
  await page.click('.c button');
  await expect.poll(() => style(page, '.c i', 'width')).toBe('10px'); // state + on: + when()
}

const STRICT = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'";

test.describe('CSP', () => {
  test('1. no policy', async ({ page }) => {
    await watchViolations(page);
    await open(page, { head: '<link rel="stylesheet" href="/t/css/a.css">', body, css: { 'a.css': css } });
    await expect.poll(() => style(page, '.c i', 'height')).toBe('6px');
    await works(page);
    expect(await violations(page)).toEqual([]);
  });

  test('2. restrictive script policy that allows the external library', async ({ page }) => {
    await watchViolations(page);
    await open(page, { head: '<link rel="stylesheet" href="/t/css/a.css">', body, css: { 'a.css': css }, csp: "script-src 'self'; object-src 'none'; base-uri 'none'" });
    await expect.poll(() => style(page, '.c i', 'height')).toBe('6px');
    await works(page);
    expect(await violations(page)).toEqual([]);
  });

  test("3. style-src 'self': same-origin stylesheets, no inline styles allowed", async ({ page }) => {
    await watchViolations(page);
    await open(page, { head: '<link rel="stylesheet" href="/t/css/a.css">', body, css: { 'a.css': css }, csp: STRICT });
    await expect.poll(() => style(page, '.c i', 'height')).toBe('6px');
    await works(page);
    expect(await violations(page)).toEqual([]); // the library caused none
    expect(await diagnostics(page)).toEqual([]);
  });

  test('4. nonce-based style policy with an inline <style nonce>', async ({ page }) => {
    await watchViolations(page);
    await open(page, {
      head: `<style nonce="n0nce">${css}</style>`, body, scriptNonce: 'n0nce',
      csp: "default-src 'none'; script-src 'nonce-n0nce'; style-src 'nonce-n0nce'",
    });
    await expect.poll(() => style(page, '.c i', 'height')).toBe('6px');
    await works(page);
    expect(await violations(page)).toEqual([]);
  });

  test('5. a policy that rejects inline style: blocked author styles stay blocked, the rest works, nothing is injected', async ({ page }) => {
    await watchViolations(page);
    await open(page, {
      head: `<link rel="stylesheet" href="/t/css/a.css"><style id="inline">.extra { width: pick(77px) }</style>`,
      body: body + '<i class="extra" style="display:block"></i>', css: { 'a.css': css },
      csp: STRICT + "; style-src-attr 'none'",
    });
    await expect.poll(() => style(page, '.c i', 'height')).toBe('6px');
    await works(page); // element.style writes are CSSOM: allowed even with style-src-attr 'none'
    expect(await style(page, '.extra', 'width')).not.toBe('77px'); // the blocked <style> stays blocked
    const v = await violations(page);
    expect(v.every((x: string) => /^style-src/.test(x))).toBe(true); // only the author's own inline style / style="" attribute
    expect(v.length).toBeLessThanOrEqual(2);
    expect((await diagnostics(page)).join('\n')).toMatch(/<style id="inline">: the browser did not apply this stylesheet/);
    await frames(page);
    expect(await page.evaluate(() => document.querySelectorAll('style').length)).toBe(1); // nothing injected
  });
});
