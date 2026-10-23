// 0.9.0 hardening: 0.8 and 0.9 syntax on one page, with the full bundle and with the bundle the
// analyzer picks for this CSS (docs/release-0.9.0-hardening.md, section E).
import { test, expect, type Page } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { open, frames, diagnostics } from './helpers';

const CSS = `
  .old { --n: state(0); --on: state(false); --size: state("m") }
  .old .inc { on: click(increment(--n)), key(ArrowUp, increment(--n, 10)) }
  .old .t { text: var(--n) }
  .old .tog { on: click(toggle(--on)); attr: aria-pressed var(--on) }
  .old input[type=radio] { bind: --size }
  .old .size { text: var(--size) }
  .old .panel { focus: var(--on) }
  .old:changed(--n) .t { animation: flash 50ms }
  .old .tabs i:nth-var(--n) { color: rgb(1, 2, 3) }
  .old input[type=checkbox]:just-checked + b { color: rgb(4, 5, 6) }
  .new { --n: state(0); --open: state(false) }
  .new .inc:on(click) { --n: increment(1) }
  .new .t { content: var(--n) }
  .new .tog { --attr-aria-expanded: var(--open) }
  .new .tog:on(click) { --open: toggle() }
  .new .field { focus: when(--open) }
  .sensors { --mx: mouse(x); --vw: viewport(width); --w: element(width); --v: visible(); height: random(5px, 5px); --p: pick(a); --l: live(pick(1), 1s); width: 50px }
  @keyframes flash { to { opacity: 0.9 } }`;
const BODY = `<div class="old"><button class="inc">+</button><span class="t">0</span><button class="tog">t</button><input type="radio" name="s" value="m" checked><input type="radio" name="s" value="l"><span class="size">m</span>
  <div class="panel" tabindex="-1">p</div><div class="tabs"><i>1</i><i>2</i></div><input type="checkbox"><b>b</b></div>
  <div class="new"><button class="inc">+</button><span class="t">0</span><button class="tog">t</button><input class="field"></div><div class="sensors"></div>`;

async function run(page: Page) {
  await page.click('.old .inc');
  await page.focus('.old .inc'); await page.keyboard.press('ArrowUp');
  await page.click('.old .tog');
  await page.check('.old input[value=l]');
  await page.check('.old input[type=checkbox]');
  await page.click('.new .inc'); await page.click('.new .inc');
  await page.click('.new .tog');
  await frames(page);
  expect(await page.textContent('.old .t')).toBe('11');
  await expect(page.locator('.old .tog')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.textContent('.old .size')).toBe('l');
  expect(await page.$eval('.old input[type=checkbox] + b', (e) => getComputedStyle(e).color)).toBe('rgb(4, 5, 6)');
  expect(await page.textContent('.new .t')).toBe('2');
  await expect(page.locator('.new .tog')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.new .field')).toBeFocused();
  const s = await page.$eval('.sensors', (e) => ['--vw', '--w', 'height', '--p'].map((p) => getComputedStyle(e).getPropertyValue(p).trim()));
  expect(s[0]).toMatch(/^\d+px$|^100dvw$/);
  expect(s.slice(1)).toEqual(['50px', '5px', 'a']);
  expect(await diagnostics(page)).toEqual([]);
}

test('0.8 and 0.9 syntax together, full bundle', async ({ page }) => {
  await open(page, { head: `<style>${CSS}</style>`, body: BODY });
  await run(page);
});

test('0.8 and 0.9 syntax together, the analyzer-chosen trimmed bundle', async ({ page }) => {
  // @ts-expect-error: plain ESM tooling
  const { analyze, build } = await import('../../tools/bundle.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'rcss-compat-'));
  writeFileSync(join(dir, 'a.css'), CSS);
  const a = await analyze([join(dir, 'a.css')]);
  const b = await build({ features: a.recommended.features, minify: true });
  expect(b.manifest.excluded.length).toBeGreaterThan(0); // trimmed for real
  await page.route('**/dist/reactive-css.js', (r) => r.fulfill({ contentType: 'text/javascript', body: b.code }));
  await open(page, { head: `<style>${CSS}</style>`, body: BODY });
  await run(page);
});
