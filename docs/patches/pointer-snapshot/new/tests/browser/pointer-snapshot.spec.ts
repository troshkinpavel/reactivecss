// Unreleased: set(--x, mouse(x | y [, local])) stores the pointer position of the triggering event.
// Strict CSP, real mouse and keyboard input. Contract: docs/rfc-pointer-snapshot.md.
import { test, expect } from '@playwright/test';
import { open, style, frames, diagnostics } from './helpers';

const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'";
const CSS = `
  .area { --vx: state(0px); --vy: state(0px); --lx: state(0px); --ly: state(0px); --n: state(0); --in: state(0in);
    position: absolute; left: 100px; top: 50px; width: 300px; height: 200px;
    on: click(set(--vx, mouse(x)), set(--vy, mouse(y)), set(--lx, mouse(x, local)), set(--ly, mouse(y, local)), set(--in, mouse(x, local))); }
  .area button { position: absolute; left: 20px; top: 20px; width: 60px; height: 40px; }
  .wrong { --n: state(0); on: click(set(--n, mouse(x))); position: absolute; left: 0; top: 300px; width: 50px; height: 50px; }
  .menu { --ox: state(-1px); on: outside(pointerdown, set(--ox, mouse(x, local))); position: absolute; left: 500px; top: 50px; width: 50px; height: 50px; }`;
const BODY = '<div class="area"><button>b</button></div><div class="wrong"></div><div class="menu"></div>';

const px = async (page: any, sel: string, p: string) => parseFloat(await style(page, sel, p));

test.beforeEach(async ({ page }) => {
  await open(page, { head: '<link rel="stylesheet" href="/t/css/a.css">', body: BODY, css: { 'a.css': CSS }, csp: CSP });
  await page.waitForFunction(() => window.ReactiveCSS.stats().sheets >= 1);
  await frames(page);
});

test('a real click stores the viewport and local position once; it does not follow the pointer', async ({ page }) => {
  await page.mouse.click(230, 140);
  await frames(page);
  expect([await px(page, '.area', '--vx'), await px(page, '.area', '--vy')]).toEqual([230, 140]);
  expect([await px(page, '.area', '--lx'), await px(page, '.area', '--ly')]).toEqual([130, 90]);
  expect((await px(page, '.area', '--in')) * 96).toBeCloseTo(130, 1); // converted into the state's unit (printed rounded)
  await page.mouse.move(380, 230);
  await page.mouse.move(390, 240);
  await frames(page, 3);
  expect([await px(page, '.area', '--lx'), await px(page, '.area', '--ly')]).toEqual([130, 90]);
  // a click on a descendant: the position is still measured from the element with on:
  await page.mouse.click(130, 80);
  await frames(page);
  expect([await px(page, '.area', '--lx'), await px(page, '.area', '--ly')]).toEqual([30, 30]);
  expect(await diagnostics(page)).toEqual([]);
});

test('a keyboard-activated click (detail 0) gives the center of the element with on:', async ({ page }) => {
  await page.focus('.area button');
  await page.keyboard.press('Enter');
  await frames(page);
  expect([await px(page, '.area', '--lx'), await px(page, '.area', '--ly')]).toEqual([150, 100]);
  expect([await px(page, '.area', '--vx'), await px(page, '.area', '--vy')]).toEqual([250, 150]);
  await page.mouse.click(110, 60);
  await page.evaluate(() => (document.querySelector('.area') as HTMLElement).click()); // element.click(): detail 0 too
  await frames(page);
  expect([await px(page, '.area', '--lx'), await px(page, '.area', '--ly')]).toEqual([150, 100]);
  expect(await diagnostics(page)).toEqual([]);
});

test('outside(pointerdown) measures from the element with on:; a non-length state is reported and unchanged', async ({ page }) => {
  await page.mouse.click(200, 100);
  await frames(page);
  expect(await px(page, '.menu', '--ox')).toBe(-300);
  await page.mouse.click(10, 310);
  await frames(page);
  expect(await style(page, '.wrong', '--n')).toBe('0');
  expect((await diagnostics(page)).join('\n')).toContain('set(--n, 10px): --n holds a number; the value is ignored.');
});
