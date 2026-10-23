// 0.9.0 hardening: the production bundle (dist/reactive-css.min.js) carries diagnostic codes
// instead of message text (tools/diagnostics.mjs). Same behavior; every code decodes offline to
// the development message.
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { frames } from './helpers';
/** Raw diagnostics: coded in production, text in development. */
const diagnostics = (page: Page) => page.evaluate(() => (window as any).ReactiveCSS.diagnostics as string[]);
// @ts-expect-error: plain ESM tooling, no type declarations
import { explain } from '../../tools/diagnostics.mjs';

const MIN = readFileSync('dist/reactive-css.min.js', 'utf8');
const DEV = readFileSync('dist/reactive-css.js', 'utf8');

async function openBoth(page: Page, bundle: 'min' | 'dev', head: string, body: string) {
  await page.route('**/t/lib.js', (r) => r.fulfill({ contentType: 'text/javascript', body: bundle === 'min' ? MIN : DEV }));
  await page.route('**/t/prod.html', (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta charset="utf-8">${head}<script src="/t/lib.js" defer></script></head><body>${body}</body></html>` }));
  await page.goto('/t/prod.html');
  await page.waitForFunction(() => (window as any).ReactiveCSS?.stats().sheets >= 1);
  await frames(page);
}

const PROBLEMS = `<style>
  .a { --n: state(0); --o: state(false) }
  .a b:on(click) { --n: increment(1); color: red }
  .a i:on(click) { --x: set(event(x)) }
  .a s { --attr-href: "x"; --attr-Data-x: 1 }
  .a:on(click), .q { --n: toggle() }
  .a u:on(tap) { --n: set(1) }
  .a p:on(click) { --n: toggle() }
  .a em { attr: disabled var(--o) }
  .a input { --v: state(true, bind(value)) }
</style>`;
const BODY = '<div class="a"><b>b</b><i>i</i><s>s</s><u>u</u><p>p</p><em>e</em><input></div>';

test('production diagnostics are codes; each decodes to exactly the development message', async ({ page, browser }) => {
  await openBoth(page, 'min', PROBLEMS, BODY);
  await page.click('.a p');
  await frames(page);
  const prod = await diagnostics(page);
  const dev = await (async () => { const p2 = await browser.newPage(); await openBoth(p2, 'dev', PROBLEMS, BODY); await p2.click('.a p'); await frames(p2); const d = await diagnostics(p2); await p2.close(); return d; })();
  expect(prod.length).toBeGreaterThan(6);
  expect(prod.length).toBe(dev.length);
  for (const m of prod) expect(m, m).toMatch(/RCSS-[A-Z]\d{3}/);
  expect(prod.map((m: string) => explain(m))).toEqual(dev);
  // Short, stable: no production message carries the long text.
  expect(prod.join('\n')).not.toMatch(/is not one|neither bind|subject of the selector/);
});

test('the production bundle behaves like the development one (counter, drag, attributes, text)', async ({ page }) => {
  await openBoth(page, 'min', `<style>.c { --n: state(0); --x: state(0px); --attr-data-n: var(--n) } .c b:on(click) { --n: increment(2) } .c s { content: var(--n) }
    .c i { display: block; width: 30px; height: 30px; background: red; translate: var(--x) 0; touch-action: none } .c i:on(drag) { --x: set(event(x)) }</style>`,
    '<div class="c"><b>b</b><s>0</s><i></i></div>');
  await page.click('.c b');
  await frames(page);
  expect(await page.textContent('.c s')).toBe('2');
  await expect(page.locator('.c')).toHaveAttribute('data-n', '2');
  const box = (await page.locator('.c i').boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 10); await page.mouse.down(); await page.mouse.move(box.x + 50, box.y + 10, { steps: 5 }); await page.mouse.up();
  await frames(page);
  expect(await page.$eval('.c', (e) => getComputedStyle(e).getPropertyValue('--x').trim())).toBe('40px');
  expect(await diagnostics(page)).toEqual([]);
});

test('a custom element defined later gets disabled in production too (the wait does not read message text)', async ({ page }) => {
  await openBoth(page, 'min', `<style>.f { --o: state(true) } .f x-field { attr: disabled var(--o) }</style>`, '<div class="f"><x-field></x-field></div>');
  expect(await page.getAttribute('x-field', 'disabled')).toBeNull();
  expect((await diagnostics(page)).map((m: string) => explain(m)).join('\n')).toMatch(/<x-field> is not defined yet/);
  await page.evaluate(() => customElements.define('x-field', class extends HTMLElement { static formAssociated = true; }));
  await page.waitForFunction(() => document.querySelector('x-field')!.hasAttribute('disabled'));
});

test('one console summary line in production, which says how to decode', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (m) => logs.push(m.text()));
  await openBoth(page, 'min', '<style>.a { --n: state(0); --attr-href: "x" }</style>', '<div class="a"></div>');
  await page.waitForTimeout(50);
  const rc = logs.filter((l) => l.includes('[reactive-css]'));
  expect(rc).toHaveLength(1);
  expect(rc[0]).toMatch(/1 issue\(s\).*reactive-css explain/);
});

test('a bundler consumer: an app importing the ESM entry (dist/index.js) runs 0.9 syntax', async ({ page }) => {
  const esbuild = await import('esbuild');
  const r = await esbuild.build({ stdin: { contents: `import { start, version } from './dist/index.js'; window.v = version; start();`, resolveDir: process.cwd(), loader: 'js' },
    bundle: true, format: 'iife', minify: true, write: false, logLevel: 'silent' });
  await page.route('**/t/lib.js', (rt) => rt.fulfill({ contentType: 'text/javascript', body: r.outputFiles[0].text }));
  await page.route('**/t/prod.html', (rt) => rt.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><style>.c { --n: state(0) } .c b:on(click) { --n: increment(1) } .c s { content: var(--n) }</style><script src="/t/lib.js" defer></script></head><body><div class="c"><b>b</b><s>0</s></div></body></html>` }));
  await page.goto('/t/prod.html');
  await page.waitForFunction(() => (window as any).v);
  await page.click('.c b');
  await frames(page);
  expect(await page.textContent('.c s')).toBe('1');
  expect(await page.evaluate(() => (window as any).v)).toBe(JSON.parse(readFileSync('package.json', 'utf8')).version);
});
