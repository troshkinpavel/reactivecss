// 0.7.1 regressions found by the validation examples.
import { test, expect } from '@playwright/test';
import { frames, diagnostics } from './helpers';

test.describe('stylesheet order (found by the stylesheet lab)', () => {
  test('text:, attr: and focus: that read a state declared in a later-loading sheet show it, without a false warning', async ({ page }) => {
    // b.css (the state) arrives after a.css (its users): the users first see the raw, uncompiled state(…).
    await page.route('**/t/css/a.css', (r) => r.fulfill({ contentType: 'text/css', body: `.lab .n { text: var(--n) } .lab i { attr: data-n var(--n) } .lab h3 { focus: var(--open) }` }));
    await page.route('**/t/css/b.css', async (r) => { await new Promise((res) => setTimeout(res, 300)); await r.fulfill({ contentType: 'text/css', body: `.lab { --n: state(7); --open: state(false) }` }); });
    await page.route('**/t/page.html', (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8">
      <link rel="stylesheet" href="/t/css/a.css"><script src="/dist/reactive-css.js" defer></script></head>
      <body><div class="lab"><span class="n">x</span><i></i><h3 tabindex="-1">h</h3></div>
      <script>setTimeout(() => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/t/css/b.css'; document.head.append(l); }, 50);</script></body></html>` }));
    await page.goto('/t/page.html');
    await page.waitForFunction(() => (window as any).ReactiveCSS?.stats().sheets >= 2, null, { timeout: 5000 });
    await frames(page, 3);
    expect(await page.textContent('.lab .n')).toBe('7');
    expect(await page.getAttribute('.lab i', 'data-n')).toBe('7');
    expect(await diagnostics(page)).toEqual([]);
  });
});

test.describe('<link> disabled and media (found by the stylesheet lab)', () => {
  test('disabling a linked sheet releases its rules; re-enabling processes the fresh sheet; a media change re-reads', async ({ page }) => {
    await page.route('**/t/css/base.css', (r) => r.fulfill({ contentType: 'text/css', body: `.lab { --n: state(0) } .lab .inc { on: click(increment(--n)) } .lab .n { text: var(--n) }` }));
    await page.route('**/t/css/extra.css', (r) => r.fulfill({ contentType: 'text/css', body: `.lab .inc.inc { on: click(increment(--n, 10)) } .lab .flag { text: "on" }` }));
    await page.route('**/t/page.html', (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8">
      <link rel="stylesheet" href="/t/css/base.css"><link rel="stylesheet" href="/t/css/extra.css" id="extra"><script src="/dist/reactive-css.js" defer></script></head>
      <body><div class="lab"><button class="inc">+</button><span class="n">0</span><span class="flag">off</span></div></body></html>` }));
    await page.goto('/t/page.html');
    await page.waitForFunction(() => (window as any).ReactiveCSS?.stats().sheets >= 2);
    const state = async () => { await frames(page, 3); return [await page.textContent('.n'), await page.textContent('.flag')]; };
    await page.click('.inc');
    expect(await state()).toEqual(['10', 'on']);
    await page.evaluate(() => { (document.getElementById('extra') as HTMLLinkElement).disabled = true; });
    await page.click('.inc');
    expect(await state()).toEqual(['11', 'off']);
    await page.evaluate(() => { (document.getElementById('extra') as HTMLLinkElement).disabled = false; });
    await page.waitForFunction(() => (window as any).ReactiveCSS.stats().sheets === 2);
    await page.click('.inc');
    expect(await state()).toEqual(['21', 'on']);
    await page.evaluate(() => { (document.getElementById('extra') as HTMLLinkElement).media = '(max-width: 1px)'; });
    await page.click('.inc');
    expect(await state()).toEqual(['22', 'off']);
    await page.evaluate(() => { (document.getElementById('extra') as HTMLLinkElement).media = 'all'; });
    await page.click('.inc');
    expect(await state()).toEqual(['32', 'on']);
    expect(await diagnostics(page)).toEqual([]);
  });
});

test.describe('focus: and native popovers (found by the focus-transitions example in WebKit)', () => {
  test('a change made by a click inside an open popover does not move focus out, even when the click did not focus anything', async ({ page }) => {
    await page.route('**/t/page.html', (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8">
      <style>.w { --p: state(1) } .w .go2 { on: click(set(--p, 2)) } .w h2 { focus: when(--p == 2) }</style><script src="/dist/reactive-css.js" defer></script></head>
      <body><div class="w"><h2 tabindex="-1" id="h">Two</h2><button popovertarget="pop" id="open">open</button>
      <div popover id="pop"><span class="go2" id="go2">go to 2 (not focusable, like a button in WebKit)</span></div></div></body></html>` }));
    await page.goto('/t/page.html');
    await page.waitForFunction(() => (window as any).ReactiveCSS?.stats().sheets >= 1);
    await page.click('#open');
    await page.click('#go2'); // focus stays on the opener or <body>: not inside the popover
    await frames(page, 3);
    expect(await page.evaluate(() => document.activeElement!.id)).not.toBe('h');
    expect(await page.evaluate(() => document.getElementById('pop')!.matches(':popover-open'))).toBe(true);
  });
});

test.describe('<link> href swap race (found while running the examples on custom bundles, 0.8.0)', () => {
  test('a swapped href is applied to the new sheet even when the browser loads it after the library fetched it', async ({ page }) => {
    await page.route('**/t/css/a.css', (r) => r.fulfill({ contentType: 'text/css', body: `.lab .label { text: "a" }` }));
    // The browser's own stylesheet load of b.css is slow; the library's fetch() of it is not.
    await page.route('**/t/css/b.css', async (r) => {
      if (r.request().resourceType() === 'stylesheet') await new Promise((res) => setTimeout(res, 400));
      await r.fulfill({ contentType: 'text/css', body: `.lab .label { text: "b" }` });
    });
    await page.route('**/t/page.html', (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8">
      <link rel="stylesheet" href="/t/css/a.css" id="l"><script src="/dist/reactive-css.js" defer></script></head>
      <body><div class="lab"><span class="label">none</span></div></body></html>` }));
    await page.goto('/t/page.html');
    await page.waitForFunction(() => (window as any).ReactiveCSS?.stats().sheets >= 1);
    await expect.poll(() => page.textContent('.label')).toBe('a');
    await page.evaluate(() => { (document.getElementById('l') as HTMLLinkElement).href = '/t/css/b.css'; });
    await expect.poll(() => page.textContent('.label'), { timeout: 3000 }).toBe('b');
    expect(await diagnostics(page)).toEqual([]);
  });
});
