// 0.9.0 hardening: each representative custom bundle initializes by itself (auto-start, strict
// CSP) and runs its interaction; syntax of omitted features is reported, not ignored.
import { test, expect, type Page } from '@playwright/test';
import { frames } from './helpers';
/** Raw (coded) production diagnostics. */
const diagnostics = (page: Page) => page.evaluate(() => (window as any).ReactiveCSS.diagnostics as string[]);

const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'";
const built = new Map<string, Promise<string>>();
const bundle = (features: string[]) => {
  const k = features.join(',');
  if (!built.has(k)) built.set(k, (async () => {
    // @ts-expect-error: plain ESM tooling
    const { build } = await import('../../tools/bundle.mjs');
    const r = await build({ features, minify: true });
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    return r.code as string;
  })());
  return built.get(k)!;
};
async function page0(page: Page, features: string[], css: string, body: string) {
  await page.route('**/m/lib.js', async (r) => r.fulfill({ contentType: 'text/javascript', body: await bundle(features) }));
  await page.route('**/m/a.css', (r) => r.fulfill({ contentType: 'text/css', body: css }));
  await page.route('**/m/page.html', (r) => r.fulfill({ contentType: 'text/html', headers: { 'Content-Security-Policy': CSP },
    body: `<!doctype html><html><head><link rel="stylesheet" href="/m/a.css"><script src="/m/lib.js" defer></script></head><body>${body}</body></html>` }));
  await page.goto('/m/page.html');
  await page.waitForFunction(() => (window as any).ReactiveCSS?.stats().sheets === 1);
  await frames(page);
}
const prop = (page: Page, sel: string, p: string) => page.$eval(sel, (e, n) => getComputedStyle(e).getPropertyValue(n).trim(), p);

test('minimal state (core only): states work; :on() is reported', async ({ page }) => {
  await page0(page, [], '.a { --n: state(3) } .a b { width: calc(var(--n) * 10px); display: block } .a b:on(click) { --n: increment(1) }', '<div class="a"><b>b</b></div>');
  expect(await page.$eval('.a b', (e) => getComputedStyle(e).width)).toBe('30px');
  expect((await diagnostics(page)).join('\n')).toMatch(/RCSS-P\d{3}⟦:on\(\)⟧⟦events⟧/);
});

test('counter (events, text)', async ({ page }) => {
  await page0(page, ['events', 'text'], '.c { --n: state(0) } .c b:on(click) { --n: increment(1) } .c s { content: var(--n) } .c i:on(drag) { --n: set(5) }', '<div class="c"><b>+</b><s>0</s><i>i</i></div>');
  await page.click('.c b'); await page.click('.c b');
  await frames(page);
  expect(await page.textContent('.c s')).toBe('2');
  expect((await diagnostics(page)).join('\n')).toMatch(/⟦:on\(drag\)⟧⟦gestures⟧/);
});

test('forms (events, forms)', async ({ page }) => {
  await page0(page, ['events', 'forms'], 'form { --s: state(0) } input { --q: state("", bind(value)) } form:on(submit, prevent()) { --s: increment(1) }', '<form><input><button>go</button></form>');
  await page.fill('input', 'hello');
  await page.click('button');
  await frames(page);
  expect(await prop(page, 'input', '--q')).toBe('"hello"');
  expect(await prop(page, 'form', '--s')).toBe('1');
});

test('focus (events, focus)', async ({ page }) => {
  await page0(page, ['events', 'focus', 'conditions'], '.d { --o: state(false) } .d b:on(click) { --o: toggle() } .d input { focus: when(--o) }', '<div class="d"><b role="button" tabindex="0">open</b><input></div>');
  await page.click('.d b');
  await expect(page.locator('.d input')).toBeFocused();
});

test('persistence (persist)', async ({ page }) => {
  await page0(page, ['persist'], '.t { --dark: state(false, persist("m-t")) } .t b { color: red }', '<div class="t"><b>b</b></div>');
  await page.evaluate(() => localStorage.setItem('rcss:m-t', '{"t":"boolean","v":true}'));
  await page.reload();
  await page.waitForFunction(() => (window as any).ReactiveCSS?.stats().sheets === 1);
  expect(await prop(page, '.t', '--dark')).toBe('1');
});

test('drag (events, gestures)', async ({ page }) => {
  await page0(page, ['events', 'gestures'], '.k { --x: state(0px); width: 40px; height: 40px; background: red; translate: var(--x) 0; touch-action: none } .k:on(drag) { --x: set(event(x)) }', '<div class="k"></div>');
  const b = (await page.locator('.k').boundingBox())!;
  await page.mouse.move(b.x + 5, b.y + 5); await page.mouse.down(); await page.mouse.move(b.x + 35, b.y + 5, { steps: 4 }); await page.mouse.up();
  await frames(page);
  expect(await prop(page, '.k', '--x')).toBe('30px');
});

test('sensors (dynamic, geometry)', async ({ page }) => {
  await page0(page, ['dynamic', 'geometry'], '.s { width: 123px; height: 20px; --w: element(width); opacity: visible() }', '<div class="s"></div>');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.s')!).getPropertyValue('--w').trim() === '123px');
  expect(await page.$eval('.s', (e) => getComputedStyle(e).opacity)).toBe('1');
});
