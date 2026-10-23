// 0.9.0 hardening: random() native-first audit (docs/release-0.9.0-hardening.md, section E).
// Real native support is Chromium 156 / WebKit 27.2 (both implement the 2026 draft: plain step,
// sharing keys). "No native support" and "partial support" are simulated by making CSS.supports()
// answer false for some random() forms: the runtime uses capability tests only, never the user agent.
import { test, expect, type Page } from '@playwright/test';
import { open, frames, diagnostics, stats, sheetCSS } from './helpers';

const NO_NATIVE = `<script>{ const s = CSS.supports.bind(CSS); CSS.supports = (...a) => !a.join(' ').includes('random(') && s(...a); }</script>`;
const NO_STEP = `<script>{ const s = CSS.supports.bind(CSS); CSS.supports = (...a) => !/random\\([^,]+,[^,]+,/.test(a.join(' ')) && s(...a); }</script>`;
const px = (page: Page, sel: string, prop: string) => page.$$eval(sel, (els, p) => els.map((e) => parseFloat(getComputedStyle(e).getPropertyValue(p))), prop);
const many = (n: number, cls = 'r') => `<i class="${cls}"></i>`.repeat(n);
const distinct = (a: number[]) => new Set(a).size;

test.describe('declarations: native when supported, polyfilled when not', () => {
  const css = '.r { display: block; width: random(0px, 100px); height: random(10px, 20px, 5px); rotate: random(0deg, 90deg); animation-duration: random(1s, 2s) }';

  test('full native support: the calls stay native CSS, no bindings, per-element values', async ({ page }) => {
    await open(page, { head: `<style>${css}</style>`, body: many(8) });
    await frames(page);
    // Chromium serializes native random() with its internal sharing key: match the arguments only.
    expect(await sheetCSS(page)).toMatch(/width: random\([^)]*0px, 100px\)/);
    expect(await sheetCSS(page)).toMatch(/height: random\([^)]*10px, 20px, 5px\)/);
    expect((await stats(page)).bindings).toBe(0);
    const w = await px(page, '.r', 'width'), h = await px(page, '.r', 'height');
    expect(distinct(w)).toBeGreaterThan(4);
    for (const v of w) expect(v >= 0 && v <= 100).toBe(true);
    for (const v of h) expect([10, 15, 20]).toContain(v);
    expect(await diagnostics(page)).toEqual([]);
  });

  test('no native support: the runtime rolls per element, steps included (both step forms)', async ({ page }) => {
    await open(page, { head: NO_NATIVE + `<style>${css} .b { width: random(0px, 100px, by 25px) }</style>`, body: many(8) + many(6, 'b') });
    await frames(page);
    expect((await stats(page)).bindings).toBeGreaterThan(20);
    const w = await px(page, '.r', 'width'), h = await px(page, '.r', 'height'), b = await px(page, '.b', 'width');
    expect(distinct(w)).toBeGreaterThan(4);
    for (const v of h) expect([10, 15, 20]).toContain(v);
    for (const v of b) expect([0, 25, 50, 75, 100]).toContain(v);
    expect(await diagnostics(page)).toEqual([]);
  });

  test('partial support (no step form): two-argument calls native, step calls polyfilled', async ({ page }) => {
    await open(page, { head: NO_STEP + `<style>${css}</style>`, body: many(6) });
    await frames(page);
    const t = await sheetCSS(page);
    expect(t).toMatch(/width: random\([^)]*0px, 100px\)/);
    expect(t).toMatch(/height: var\(--rcss-/);
    for (const v of await px(page, '.r', 'height')) expect([10, 15, 20]).toContain(v);
  });

  test('integers, decimals, units, max below min, zero step', async ({ page }) => {
    for (const head of ['', NO_NATIVE]) {
      await open(page, { head: head + `<style>.i { --v: random(1, 5, 1); z-index: random(1, 5, 1) } .d { opacity: random(0.25, 0.75) } .m { width: random(10px, 0px) } .z { width: random(0px, 100px, 0px) }</style>`, body: many(6, 'i') + many(6, 'd') + many(3, 'm') + many(6, 'z') });
      await frames(page);
      for (const v of await page.$$eval('.i', (els) => els.map((e) => +getComputedStyle(e).zIndex))) expect([1, 2, 3, 4, 5]).toContain(v);
      for (const v of await px(page, '.d', 'opacity')) expect(v >= 0.25 && v <= 0.75).toBe(true);
      expect(await px(page, '.m', 'width')).toEqual([10, 10, 10]); // max < min behaves as min
      const z = await px(page, '.z', 'width');
      expect(distinct(z)).toBeGreaterThan(2); // a zero step is ignored, not an error
      expect((await diagnostics(page)).join('\n')).not.toMatch(/step must be greater/);
    }
  });

  test('native-only sharing keys are never claimed: --name, element-scoped, property-scoped, fixed', async ({ page }) => {
    await open(page, { head: `<style>.k { width: random(--k, 0px, 100px); height: random(--k, 0px, 100px) } .e { width: random(element-scoped, 0px, 100px); height: random(element-scoped, 0px, 100px) }
      .p { width: random(property-scoped, 0px, 100px) } .f { width: random(fixed 0.5, 0px, 100px) } .c { --n: state(0) }</style>`, body: many(4, 'k') + many(4, 'e') + many(4, 'p') + many(2, 'f') + '<div class="c"></div>' });
    await frames(page);
    const k = [...await px(page, '.k', 'width'), ...await px(page, '.k', 'height')];
    expect(distinct(k)).toBe(1); // one value for every element and property
    const ew = await px(page, '.e', 'width'), eh = await px(page, '.e', 'height');
    expect(ew).toEqual(eh); // shared across one element's properties
    expect(distinct(ew)).toBeGreaterThan(1);
    expect(distinct(await px(page, '.p', 'width'))).toBe(1);
    expect(await px(page, '.f', 'width')).toEqual([50, 50]);
    expect(await diagnostics(page)).toEqual([]);
    expect((await stats(page)).bindings).toBe(0);
  });

  test('without native support, a native-only key gets one clear diagnostic', async ({ page }) => {
    await open(page, { head: NO_NATIVE + '<style>.k { width: random(--k, 0px, 100px) }</style>', body: many(2, 'k') });
    expect((await diagnostics(page)).join('\n')).toMatch(/needs native random\(\) support, which this browser lacks/);
  });
});

test.describe('event time and mixed pages', () => {
  test('set(random()) is a snapshot per event; several per element; repeated events vary', async ({ page }) => {
    await open(page, { head: `<style>.b { --x: state(0); --y: state(0px); --s: state(0) }
      .b:on(click) { --x: set(random(0, 100)); --y: set(random(0px, 50px, by 10px)); --s: set(random(1, 3, 1)) }</style>`, body: '<button class="b">b</button>' });
    const xs: number[] = [], ys: number[] = [], ss: number[] = [];
    for (let i = 0; i < 20; i++) {
      await page.click('.b');
      await frames(page, 1);
      const [x, y, s] = await page.$eval('.b', (e) => ['--x', '--y', '--s'].map((p) => parseFloat(getComputedStyle(e).getPropertyValue(p))));
      xs.push(x); ys.push(y); ss.push(s);
    }
    for (const x of xs) expect(x >= 0 && x <= 100).toBe(true);
    for (const y of ys) expect([0, 10, 20, 30, 40, 50]).toContain(y);
    for (const s of ss) expect([1, 2, 3]).toContain(s);
    expect(distinct(xs)).toBeGreaterThan(10);
    expect(await diagnostics(page)).toEqual([]);
  });

  test('native random(), Reactive live(random()) and event random() on one page; sheet replacement keeps native values native', async ({ page }) => {
    await open(page, { head: `<style id="s">.n { width: random(0px, 100px) } .l { width: live(random(0px, 100px), 100ms) } .b { --x: state(0) } .b:on(click) { --x: set(random(0, 9, 1)) }</style>`,
      body: many(3, 'n') + many(3, 'l') + '<button class="b">b</button>' });
    await frames(page);
    const before = await px(page, '.l', 'width');
    await page.waitForTimeout(350);
    expect(await px(page, '.l', 'width')).not.toEqual(before); // live() re-rolls (runtime)
    expect((await stats(page)).bindings).toBe(4); // three live() bindings and the :on() candidate: the native call has none
    await page.click('.b');
    await frames(page);
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).toContain(await page.$eval('.b', (e) => +getComputedStyle(e).getPropertyValue('--x')));
    for (let i = 0; i < 5; i++) await page.evaluate((i) => { document.getElementById('s')!.textContent += `\n.x${i} { color: red }`; }, i);
    await frames(page);
    expect((await stats(page)).bindings).toBe(4);
    expect(await sheetCSS(page)).toMatch(/width: random\([^)]*0px, 100px\)/);
    expect(await diagnostics(page)).toEqual([]);
  });
});
