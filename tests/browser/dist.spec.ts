// The generated browser bundle on its own: no source modules, no test helpers.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// The compact bundle (0.5.1, opt-in) is the same runtime with a smaller registry: same checks.
for (const file of ['reactive-css.min.js', 'reactive-css.compact.min.js'])
test(`${file} runs a plain HTML + CSS page`, async ({ page }) => {
  await page.route('**/tests/dist-smoke/reactive-css.min.js', (r) => r.fulfill({ contentType: 'text/javascript', body: readFileSync(`dist/${file}`, 'utf8') }));
  const logs: string[] = [];
  page.on('console', (m) => logs.push(m.text()));
  await page.goto('/tests/dist-smoke/index.html');
  await page.waitForFunction(() => (window as any).ReactiveCSS);
  const s = (sel: string, prop: string, pseudo?: string) => page.$eval(sel, (e, [p, ps]) => getComputedStyle(e, ps || null).getPropertyValue(p!), [prop, pseudo]);
  await expect.poll(() => s('.dot', 'height')).toBe('3px');
  expect(await s('.dot', 'width')).toBe('5px');
  await page.click('.inc'); await page.click('.inc');
  await expect.poll(() => s('.counter output', 'color')).toBe('rgb(0, 128, 0)');
  expect(await s('.counter output', 'counter-reset')).toBe('n 2');
  expect(await s('.acc .content', 'display')).toBe('none');
  await page.click('.trigger');
  await expect.poll(() => s('.acc .content', 'display')).toBe('block');
  await page.fill('.form input', 'Ada');
  await expect.poll(() => s('.form .preview', 'content', '::before')).toBe('"Ada"');
  await page.click('.tab >> nth=1');
  await expect.poll(() => page.$$eval('.panel', (p) => p.map((x) => getComputedStyle(x).display))).toEqual(['none', 'block']);
  const info = await page.evaluate(() => { const R = (window as any).ReactiveCSS; return { version: R.version, diag: R.diagnostics, d: R.describe() }; });
  expect(info.version).toBe(JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version);
  expect(info.diag).toEqual([]);
  // every shipped function, selector and action is registered in the bundle
  const shipped = (k: string) => info.d.features.filter((f: any) => f.kind === k && (f.status === 'stable' || f.status === 'experimental')).map((f: any) => f.name).sort();
  expect(shipped('function').filter((n: string) => n !== 'state' && n !== 'typed')).toEqual(info.d.functions.map((f: any) => f.name).sort());
  expect(shipped('action')).toEqual(info.d.actions.map((a: any) => a.name).sort());
  expect(shipped('selector')).toEqual(info.d.selectors.map((a: any) => a.name).sort());
  expect(shipped('expression')).toEqual([...info.d.expressions, ...info.d.actionExpressions].sort());
  expect(logs.filter((l) => l.includes('[reactive-css]'))).toEqual([]); // production: silent when nothing is wrong
});
