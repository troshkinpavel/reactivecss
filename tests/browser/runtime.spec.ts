// Regression tests for the optimized runtime: shared sources, compact bindings,
// scheduler batching, write suppression and lifecycle cleanup.
import { test, expect, type Page } from '@playwright/test';
import { open, style, frames, stats, diagnostics, sheetCSS } from './helpers';

const inline = (page: Page, sel: string) => page.$$eval(sel, (els) => els.map((e) => (e as HTMLElement).style.cssText));

test.describe('shared mouse source', () => {
  test('dense group: one subscription, value written once on the common ancestor', async ({ page }) => {
    await open(page, {
      head: `<style>body { margin: 0 } .i { --mx: mouse(x); --my: mouse(y) }</style>`,
      body: '<div id="list">' + '<i class="i"></i>'.repeat(50) + '</div>',
    });
    const s = await stats(page);
    expect(s.bindings).toBe(100); // 50 elements x 2 declarations
    expect(s.sources).toBe(2); // one subscription per declaration, not per element
    expect(s.observers).toBe(1); // one pointermove listener for the page
    await page.mouse.move(120, 45);
    await expect.poll(() => style(page, '.i:last-child', '--mx').then((v) => v.trim())).toBe('120px');
    expect((await style(page, '.i:first-child', '--my')).trim()).toBe('45px');
    expect(await page.$eval('#list', (e) => (e as HTMLElement).style.cssText)).toMatch(/--rcss-\w+: 120px/);
    expect((await inline(page, '.i')).every((c) => c === '')).toBe(true);
  });

  test('sparse group: written per element, not on an ancestor shared with unrelated elements', async ({ page }) => {
    await open(page, {
      head: `<style>.i { --mx: mouse(x) }</style>`,
      body: '<div id="list">' + ('<p></p>'.repeat(20) + '<i class="i"></i>').repeat(20) + '</div>',
    });
    await page.mouse.move(77, 10);
    await expect.poll(() => style(page, '.i', '--mx').then((v) => v.trim())).toBe('77px');
    expect(await page.$eval('#list', (e) => (e as HTMLElement).style.cssText)).toBe('');
    expect((await inline(page, '.i')).every((c) => /77px/.test(c))).toBe(true);
    expect(await style(page, 'p', '--mx')).toBe('');
  });

  test('global and local coordinates differ by the element position', async ({ page }) => {
    await open(page, {
      head: `<style>body { margin: 0 } .m { position: absolute; left: 30px; top: 20px; width: 50px; height: 50px; --g: mouse(x); --l: mouse(x, local); --ly: mouse(y, local) }</style>`,
      body: '<div class="m"></div>',
    });
    await page.mouse.move(40, 25);
    await expect.poll(() => style(page, '.m', '--l').then((v) => v.trim())).toBe('10px');
    expect((await style(page, '.m', '--g')).trim()).toBe('40px');
    expect((await style(page, '.m', '--ly')).trim()).toBe('5px');
  });

  test('releases the pointer listener when the last subscriber goes', async ({ page }) => {
    await open(page, {
      head: `<style>.a { --x: mouse(x) } .b { --y: mouse(y, local) }</style>`,
      body: '<div class="a"></div><div class="b"></div>',
    });
    expect((await stats(page)).observers).toBe(1);
    await page.evaluate(() => document.querySelector('.a')!.remove());
    await expect.poll(async () => (await stats(page)).observers).toBe(1);
    await page.evaluate(() => document.querySelector('.b')!.remove());
    await expect.poll(async () => (await stats(page)).observers).toBe(0);
    expect((await stats(page)).sources).toBe(0);
  });
});

test('static random(min, max) uses native CSS when the browser has per-element random()', async ({ page }) => {
  await open(page, {
    head: `<style>.n { width: random(10px, 1000px); display: block } .st { width: random(0px, 1000px, by 10px); display: block } .lv { --v: live(random(0, 1), 1s) }</style>`,
    body: '<i class="n"></i>'.repeat(20) + '<i class="st"></i>'.repeat(5) + '<i class="lv"></i>',
  });
  const native = await page.evaluate(() => CSS.supports('width', 'random(0px, 1px)'));
  const css = await sheetCSS(page);
  const widths = await page.$$eval('.n', (els) => els.map((e) => parseFloat(getComputedStyle(e).width)));
  expect(new Set(widths).size).toBeGreaterThan(15);
  widths.forEach((w) => { expect(w).toBeGreaterThanOrEqual(10); expect(w).toBeLessThanOrEqual(1000); });
  // `by` steps and live() always run in JS (6 bindings); plain random() only when not native.
  expect((await stats(page)).bindings).toBe(native ? 6 : 26);
  if (native) expect(css).toMatch(/\.n \{ width: random\((element-scoped [^,]+, )?10px, 1000px\)/); // engines may serialize a caching key
  await page.evaluate(() => document.querySelectorAll('.n').forEach((e) => e.classList.add('restyled')));
  await frames(page);
  expect(await page.$$eval('.n', (els) => els.map((e) => parseFloat(getComputedStyle(e).width)))).toEqual(widths);
  const steps = await page.$$eval('.st', (els) => els.map((e) => parseFloat(getComputedStyle(e).width) % 10));
  expect(steps.every((r) => Math.abs(r) < 0.01)).toBe(true);
});

test('live(): one interval group, independent random values per element', async ({ page }) => {
  await open(page, {
    head: `<style>.l { --v: live(random(0, 1000), 100ms) }</style>`,
    body: '<i class="l"></i>'.repeat(60),
  });
  const s = await stats(page);
  expect(s.scheduled).toBe(60);
  expect(s.intervals).toBe(1);
  const read = () => page.$$eval('.l', (els) => els.map((e) => getComputedStyle(e).getPropertyValue('--v')));
  const before = await read();
  expect(new Set(before).size).toBeGreaterThan(50);
  await page.waitForTimeout(350);
  const after = await read();
  expect(new Set(after).size).toBeGreaterThan(50); // not synchronized to one shared value
  expect(after.filter((v, i) => v !== before[i]).length).toBeGreaterThan(50);
});

test('unchanged values are never written again', async ({ page }) => {
  await open(page, {
    head: `<style>.u { --v: live(pick(5px), 50ms); --w: on(click, pick(1)) }</style>`,
    body: '<button class="u">u</button>'.repeat(20),
  });
  const writes = await page.evaluate(() => new Promise<number>((res) => {
    let n = 0;
    const mo = new MutationObserver((r) => { n += r.length; });
    document.querySelectorAll('.u').forEach((e) => mo.observe(e, { attributes: true, attributeFilter: ['style'] }));
    (document.querySelector('.u') as HTMLElement).click();
    setTimeout(() => { mo.disconnect(); res(n); }, 400);
  }));
  expect(writes).toBe(0);
  expect((await stats(page)).flushes).toBeGreaterThan(0); // the ticks ran, they just wrote nothing
});

test('rapid DOM mutations and repeated mount/unmount leave no bindings, timers or subscriptions', async ({ page }) => {
  await open(page, {
    head: `<style>.r { opacity: live(random(0, 1), 100ms); rotate: on(click, random(0deg, 9deg)); --vis: visible(0.5); --mx: mouse(x) }</style>`,
    body: '<div id="host"></div>',
  });
  for (let cycle = 0; cycle < 10; cycle++) {
    await page.evaluate(() => {
      const host = document.getElementById('host')!;
      for (let i = 0; i < 100; i++) host.append(Object.assign(document.createElement('div'), { className: 'r' }));
      for (let i = 0; i < 30; i++) host.lastChild!.remove(); // removed in the same task
    });
    await frames(page, 1);
    const s = await stats(page);
    expect(s.bindings).toBe(70 * 4);
    expect(s.scheduled).toBe(70);
    await page.evaluate(() => document.getElementById('host')!.replaceChildren());
    await frames(page, 1);
    const empty = await stats(page);
    expect([empty.bindings, empty.scheduled, empty.intervals, empty.sources, empty.observers]).toEqual([0, 0, 0, 0, 0]);
  }
});

test('a removed element gets a fresh, working context when re-added', async ({ page }) => {
  await open(page, {
    head: `<style>.f { opacity: live(random(0, 1), 100ms) }</style>`,
    body: '<div id="a"><i class="f"></i></div><div id="b"></div>',
  });
  await page.evaluate(() => { window.held = document.querySelector('.f'); window.held.remove(); });
  await frames(page, 1);
  expect((await stats(page)).scheduled).toBe(0);
  await page.evaluate(() => document.getElementById('b')!.append(window.held));
  await expect.poll(async () => (await stats(page)).scheduled).toBe(1);
  const first = await style(page, '.f', 'opacity');
  await expect.poll(() => style(page, '.f', 'opacity')).not.toBe(first);
});

test('unrelated attribute and class changes do not rebind (static values stay put)', async ({ page }) => {
  await open(page, {
    head: `<style>.a { width: random(1px, 1000px); display: block }</style>`,
    body: '<div class="a" id="x"></div>',
  });
  const w = await style(page, '#x', 'width');
  await page.evaluate(() => {
    const el = document.getElementById('x')!;
    el.setAttribute('data-foo', '1');
    el.classList.add('zzz');
    el.title = 't';
  });
  await frames(page);
  expect(await style(page, '#x', 'width')).toBe(w);
});

test('start() twice and stop()/start() do not duplicate work', async ({ page }) => {
  await open(page, {
    head: `<style>.s { opacity: live(random(0, 1), 1s) }</style>`,
    body: '<i class="s"></i>'.repeat(5),
  });
  await page.evaluate(() => window.ReactiveCSS.start());
  expect((await stats(page)).scheduled).toBe(5);
  await page.evaluate(() => window.ReactiveCSS.stop());
  let s = await stats(page);
  expect([s.bindings, s.scheduled, s.sheets]).toEqual([0, 0, 0]);
  expect(await sheetCSS(page)).not.toContain('var(--rcss'); // original rules restored
  expect(await sheetCSS(page)).toContain('.s {'); // the plain rule is still there
  await page.evaluate(() => window.ReactiveCSS.start());
  s = await stats(page);
  expect([s.bindings, s.scheduled, s.sheets]).toEqual([5, 5, 1]);
  expect((await sheetCSS(page)).match(/var\(--rcss-/g)?.length).toBe(1);
  expect(await page.evaluate(() => document.styleSheets.length)).toBe(1); // no extra sheet
  expect(await diagnostics(page)).toEqual([]);
});

test('large batches are spread over frames without losing updates', async ({ page }) => {
  await open(page, {
    head: `<style>.b { --v: live(random(0, 100000), 200ms) }</style>`,
    body: '<i class="b"></i>'.repeat(3000),
  });
  const read = () => page.$$eval('.b', (els) => els.map((e) => e.style.cssText));
  const before = await read();
  await page.waitForTimeout(600);
  const after = await read();
  expect(after.filter((v, i) => v !== before[i]).length).toBeGreaterThan(2950);
});

test.describe('state selectors under stress', () => {
  const head = `<style>
    input:just-checked + i { animation: in 10s }
    input:just-unchecked + i { animation: out 10s }
    @keyframes in { from { opacity: .5 } } @keyframes out { from { opacity: .5 } }
  </style>`;

  test('rapid toggling always ends in the marker that matches the last transition', async ({ page }) => {
    await open(page, { head, body: '<input type="checkbox" id="c"><i id="i"></i>' });
    for (let n = 1; n <= 7; n++) {
      await page.click('#c');
      const [checked, name] = await page.evaluate(() => [
        (document.getElementById('c') as HTMLInputElement).checked,
        getComputedStyle(document.getElementById('i')!).animationName,
      ]);
      expect(name).toBe(checked ? 'in' : 'out');
      expect(await page.$eval('#c', (e) => e.getAttributeNames().filter((a) => a.startsWith('data-rcss')).length)).toBe(1);
    }
  });

  test('a new transition restarts the animation (new Animation object)', async ({ page }) => {
    await open(page, { head, body: '<input type="checkbox" id="c"><i id="i"></i>' });
    await page.click('#c');
    const first = await page.evaluate(() => (window.a1 = document.getElementById('i')!.getAnimations()[0]) && 1);
    expect(first).toBe(1);
    await page.click('#c');
    await page.click('#c');
    expect(await page.evaluate(() => { const a = document.getElementById('i')!.getAnimations()[0]; return !!a && a !== window.a1 && a.currentTime! < 1000; })).toBe(true);
  });
});

test(':nth-var() moves between indices touching only the old and new element', async ({ page }) => {
  await open(page, {
    head: `<style>.c { --active: 1 } .s:nth-var(--active) { color: rgb(255, 0, 0) }</style>`,
    body: '<div class="c">' + '<i class="s"></i>'.repeat(10) + '</div>',
  });
  const marked = () => page.$$eval('.s', (els) => els.map((e, i) => (e.getAttributeNames().some((a) => a.startsWith('data-rcss-nth')) ? i + 1 : 0)).filter(Boolean));
  expect(await marked()).toEqual([1]);
  for (const n of [4, 9, 2, 10]) {
    const touched = await page.evaluate((n) => new Promise<number>((res) => {
      let count = 0;
      const mo = new MutationObserver((r) => { count += r.length; });
      document.querySelectorAll('.s').forEach((e) => mo.observe(e, { attributes: true }));
      (document.querySelector('.c') as HTMLElement).style.setProperty('--active', String(n));
      requestAnimationFrame(() => requestAnimationFrame(() => { mo.disconnect(); res(count); }));
    }), n);
    expect(touched).toBe(2);
    expect(await marked()).toEqual([n]);
  }
  await page.evaluate(() => (document.querySelector('.c') as HTMLElement).style.setProperty('--active', '11'));
  await expect.poll(marked).toEqual([]);
});

declare global { interface Window { held: Element; a1: Animation } }
