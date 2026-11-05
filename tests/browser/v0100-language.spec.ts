// 0.10 step 1 (language): `> =` in conditions; hypot(), sqrt(), pow() in :on() actions.
import { test, expect, type Page } from '@playwright/test';
import { open, frames, style, diagnostics } from './helpers';

const v = (page: Page, sel: string, p: string) => style(page, sel, p).then((s) => s.trim());

test('drag distance: hypot() of the pointer position, and :when() with "> ="', async ({ page }) => {
  await open(page, {
    head: `<style>
      .pad { --dist: state(0px); --sq: state(0); position: absolute; left: 100px; top: 100px; width: 300px; height: 200px }
      .pad:on(pointermove) { --dist: set(hypot(event(local-x), event(local-y))); --sq: set(sqrt(event(local-x) / 1px)) }
      .pad:when(--dist > = 50px) { outline: 2px solid rgb(255, 0, 0) }
      .pad:when(--dist < =
        10px) { outline: 2px solid rgb(0, 0, 255) }
    </style>`,
    body: '<div class="pad"></div>',
  });
  await page.mouse.move(130, 140); // local (30px, 40px)
  await frames(page);
  expect([await v(page, '.pad', '--dist'), await v(page, '.pad', '--sq')]).toEqual(['50px', '5.4772']);
  expect(await v(page, '.pad', 'outline-color')).toBe('rgb(255, 0, 0)');
  await page.mouse.move(106, 108); // local (6px, 8px)
  await frames(page);
  expect(await v(page, '.pad', '--dist')).toBe('10px');
  expect(await v(page, '.pad', 'outline-color')).toBe('rgb(0, 0, 255)');
  expect(await diagnostics(page)).toEqual([]);
});

test('synchronous: the second of two clicks in one task sees the first one\'s value', async ({ page }) => {
  await open(page, {
    head: `<style>.b { --n: state(0) } .b:on(click) { --n: set(pow(var(--n) + 1, 2)) }</style>`,
    body: '<button class="b">b</button>',
  });
  await page.evaluate(() => { const b = document.querySelector<HTMLElement>('.b')!; b.click(); b.click(); });
  await frames(page);
  expect(await v(page, '.b', '--n')).toBe('4'); // (0 + 1)² = 1, then (1 + 1)² = 4
});

test('units, CSS formatting, and errors that change nothing', async ({ page }) => {
  await open(page, {
    head: `<style>
      .c { --len: state(0px); --time: state(0s); --r: state(0); --small: state(1); --bad: state(7); --neg: state(-4) }
      .c .units:on(click) { --len: set(hypot(30px, 1in)); --time: set(hypot(1s, 500ms)); --r: set(sqrt(2)); --small: set(pow(10, -5)) }
      .c .err:on(click) { --bad: set(sqrt(var(--neg))) }
      .c .mix:on(click) { --len: set(hypot(3px, 4)) }
    </style>`,
    body: '<div class="c"><button class="units">u</button><button class="err">e</button><button class="mix">m</button></div>',
  });
  await page.click('.units');
  await frames(page);
  expect([await v(page, '.c', '--len'), await v(page, '.c', '--time'), await v(page, '.c', '--r'), await v(page, '.c', '--small')])
    .toEqual(['100.5783px', '1.118s', '1.4142', '0']);
  await page.click('.err');
  await page.click('.mix');
  await frames(page);
  expect([await v(page, '.c', '--bad'), await v(page, '.c', '--len')]).toEqual(['7', '100.5783px']); // unchanged
  const d = await diagnostics(page);
  expect(d).toHaveLength(2);
  expect(d[0]).toMatch(/--bad: set\(\) on button\.err for :on\(click\): sqrt\(-4\) has no finite value\. Nothing is changed\./);
  expect(d[1]).toMatch(/--len: set\(\) on button\.mix for :on\(click\): cannot combine 3px and 4: a dimension and a number\. Nothing is changed\./);
});

test('when() and :when() with spaced operators, runtime path', async ({ page }) => {
  for (const native of [true, false]) {
    await open(page, {
      native,
      head: `<style>.w { --n: state(2); width: when(--n < = 3, 10px, 20px); height: 5px }
        .w:when(--n ! = 2) { height: 9px }
        .w:on(click) { --n: increment(2) }</style>`,
      body: '<div class="w"></div>',
    });
    await frames(page);
    expect([await v(page, '.w', 'width'), await v(page, '.w', 'height')]).toEqual(['10px', '5px']);
    await page.click('.w');
    await frames(page);
    expect([await v(page, '.w', 'width'), await v(page, '.w', 'height')]).toEqual(['20px', '9px']);
    expect(await diagnostics(page)).toEqual([]);
  }
});

test('compile-time errors are reported and the rest of the sheet works', async ({ page }) => {
  await open(page, {
    head: `<style>.e { --n: state(0) } .e:on(click) { --n: set(pow(2)) } .e:on(dblclick) { --n: set(hypot(--a, 3)) }
      .e:when(--n = 1) { color: red } .e:on(contextmenu, prevent()) { --n: set(sqrt(81)) }</style>`,
    body: '<p class="e">e</p>',
  });
  const d = (await diagnostics(page)).join('\n');
  expect(d).toMatch(/expected pow\(number, number\)/);
  expect(d).toMatch(/write var\(--a\) to read a state/);
  expect(d).toMatch(/cannot read condition "--n = 1" near "= 1"/);
  await page.click('.e', { button: 'right' });
  await frames(page);
  expect(await v(page, '.e', '--n')).toBe('9');
});
