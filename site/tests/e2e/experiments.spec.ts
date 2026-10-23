// Experiments: the homepage section, the index, the detail page with its presentation mode, and
// Perihelion itself (site/experiments/perihelion/), driven with real mouse and keyboard input
// inside its frame on the production build. Port of the Visual Lab motion-card checks to 0.9.
import { existsSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Frame, type Page } from '@playwright/test';

const DETAIL = '/experiments/perihelion/';
const SOURCE = 'https://github.com/troshkinpavel/reactivecss/tree/main/site/experiments/perihelion';

/** The experiment's frame once its runtime has compiled the sheet, with page errors collected. */
async function frameOf(page: Page, scope = '') {
  const el = page.locator(`${scope} [data-experiment-frame="perihelion"]`.trim()).first();
  await el.scrollIntoViewIfNeeded();
  const handle = await el.elementHandle();
  const frame = (await handle!.contentFrame())!;
  await frame.waitForFunction(() => (window as any).ReactiveCSS?.stats().sheets >= 1);
  await frame.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return frame;
}
const cs = (f: Frame, sel: string, prop: string) => f.$eval(sel, (e, p) => getComputedStyle(e).getPropertyValue(p).trim(), prop);
const num = async (f: Frame, sel: string, prop: string) => parseFloat(await cs(f, sel, prop));
const diagnostics = (f: Frame) => f.evaluate(() => (window as any).ReactiveCSS.diagnostics as string[]);
/** Moves the mouse to a fraction of the slot, in page coordinates (the frame is not transformed). */
async function at(page: Page, f: Frame, fx: number, fy: number) {
  const frameBox = (await (await f.frameElement()).boundingBox())!;
  const r = await f.$eval('.slot', (e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  await page.mouse.move(frameBox.x + r.x + r.w * fx, frameBox.y + r.y + r.h * fy, { steps: 6 });
}
const tiltError = (f: Frame, expected: string) => f.$eval('.card', (c, expected) => {
  const t = getComputedStyle(c).transform;
  const a = new DOMMatrix(t === 'none' ? '' : t), b = new DOMMatrix(expected);
  return Math.max(...(['m11', 'm12', 'm13', 'm21', 'm22', 'm23', 'm31', 'm32', 'm33'] as const).map((k) => Math.abs(a[k] - b[k])));
}, expected);

test('navigation: homepage → Experiments → Perihelion; the header marks Experiments; one experiment is listed', async ({ page }) => {
  await page.goto('/');
  const section = page.locator('#experiments');
  await expect(section.getByRole('heading', { level: 2 })).toHaveText(/Experi.?ments\./);
  await expect(section.getByRole('heading', { level: 3 })).toHaveText('Perihelion · motion card');
  await expect(section.getByRole('link', { name: 'View Motion Card →' })).toHaveAttribute('href', DETAIL);
  await page.locator('header').getByRole('link', { name: 'Experiments' }).first().click();
  await expect(page).toHaveURL('/experiments/');
  await expect(page.locator('header').getByRole('link', { name: 'Experiments' }).first()).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-experiment-entry]')).toHaveCount(1);
  await expect(page.getByText('in progress')).toHaveCount(0); // no unfinished drafts are listed
  await page.getByRole('link', { name: 'Open demo' }).click();
  await expect(page).toHaveURL(DETAIL);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Perihelion · motion card');
  expect(await diagnostics(await frameOf(page))).toEqual([]);
});

test('Source ↗ opens the experiment folder on GitHub in a new tab, and that folder exists in the repository', async ({ page }) => {
  for (const path of ['/experiments/', DETAIL]) {
    await page.goto(path);
    const links = page.locator('[data-source-link="perihelion"]');
    expect(await links.count()).toBeGreaterThan(0);
    for (const l of await links.all()) {
      await expect(l).toHaveAttribute('href', SOURCE);
      await expect(l).toHaveAttribute('target', '_blank');
      await expect(l).toHaveAttribute('rel', /noopener/);
    }
  }
  await expect(page.locator('[data-source-note]')).toContainText('once the repository is public');
  for (const f of ['index.html', 'style.css', 'README.md']) expect(existsSync(new URL(`../../experiments/perihelion/${f}`, import.meta.url)), f).toBe(true);
});

test('presentation mode: Full screen covers the window with Close and Source; Esc and Close leave it; #present is a direct URL', async ({ page }) => {
  await page.goto(DETAIL);
  const stage = page.locator('[data-stage]');
  await page.getByRole('button', { name: 'Open full screen demo' }).click();
  await expect(stage).toHaveAttribute('data-present', '');
  await expect(page).toHaveURL(/#present$/);
  const vp = page.viewportSize()!;
  expect(await stage.boundingBox()).toEqual({ x: 0, y: 0, width: vp.width, height: vp.height });
  await expect(page.getByRole('button', { name: 'Close · Esc' })).toBeFocused();
  await expect(stage.locator('[data-source-link]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open full screen demo' })).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(stage).not.toHaveAttribute('data-present');
  await expect(page).toHaveURL(DETAIL);
  await expect(page.getByRole('button', { name: 'Open full screen demo' })).toBeFocused();
  await page.getByRole('button', { name: 'Open full demo' }).click();
  await page.getByRole('button', { name: 'Close · Esc' }).click();
  await expect(stage).not.toHaveAttribute('data-present');
  await expect(page.getByRole('button', { name: 'Open full demo' })).toBeFocused();
  // A shared link opens straight into the presentation, with a running demo.
  await page.goto(`${DETAIL}#present`);
  await expect(stage).toHaveAttribute('data-present', '');
  const f = await frameOf(page);
  await at(page, f, 0.8, 0.3);
  await expect.poll(() => cs(f, '.slot', '--hot')).toBe('1');
});

test('Perihelion: tilt and light follow the local pointer, leaving springs back, editions cycle with a sweep, the foil range works', async ({ page }) => {
  await page.goto(DETAIL);
  const f = await frameOf(page);
  expect(await tiltError(f, 'rotateX(0deg) rotateY(0deg)')).toBeLessThan(1e-6);
  await expect(f.locator('.ed-name')).toHaveText('aurora');
  expect(await num(f, '.foil', 'opacity')).toBeCloseTo(0.7 * (0.1 + 0.9 * 0.12), 3); // the rest pose, no load transition
  // mouse(local) / element(): the pointer normalised to -1..1 on the untransformed slot
  await at(page, f, 0.5, 0.5);
  await at(page, f, 0.85, 0.2);
  await expect.poll(() => cs(f, '.slot', '--hot')).toBe('1');
  await expect.poll(async () => Math.abs((await num(f, '.slot', '--nx')) - 0.7)).toBeLessThan(0.03);
  expect(Math.abs((await num(f, '.slot', '--ny')) + 0.6)).toBeLessThan(0.03);
  const [nx, ny] = [await num(f, '.slot', '--nx'), await num(f, '.slot', '--ny')];
  await expect.poll(() => tiltError(f, `rotateX(${ny * -14}deg) rotateY(${nx * 18}deg)`)).toBeLessThan(0.01);
  await expect.poll(() => num(f, '.card', 'scale')).toBeCloseTo(1.045, 3);
  expect(await num(f, '.slot', '--gx')).toBeCloseTo(nx, 5); // the light follows the pointer
  // Leaving: the state drops at once and the card springs back to rest.
  await page.mouse.move(5, 5);
  await expect.poll(() => cs(f, '.slot', '--hot')).toBe('0');
  await expect.poll(() => tiltError(f, 'rotateX(0deg) rotateY(0deg)'), { timeout: 4000 }).toBeLessThan(1e-3);
  // Click: the next edition, its colours, and one sweep through :changed().
  await f.locator('.card').click();
  await expect(f.locator('.ed-name')).toHaveText('gilt');
  await expect.poll(() => cs(f, '.sweep', 'animation-name')).toBe('flash');
  await expect.poll(() => cs(f, '.stage', '--c-sun'), { timeout: 3000 }).toBe('rgb(255, 216, 137)');
  await f.locator('.card').press('Enter');
  await expect(f.locator('.ed-name')).toHaveText('nocturne');
  await f.locator('.card').press(' ');
  await expect(f.locator('.ed-name')).toHaveText('aurora');
  // The range writes the stage's foil level (event(value-as-number)).
  await f.locator('.foil-range').focus();
  await page.keyboard.press('Home');
  await expect.poll(() => num(f, '.stage', '--foil-k')).toBe(0);
  await expect.poll(() => num(f, '.foil', 'opacity')).toBe(0);
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
  await expect.poll(() => num(f, '.stage', '--foil-k')).toBeCloseTo(0.5, 5);
  expect(await diagnostics(f)).toEqual([]);
});

test('Perihelion: keyboard focus shows the presentation pose; 20 rapid clicks leave no stuck sweep', async ({ page, browserName }) => {
  await page.goto(DETAIL);
  const f = await frameOf(page);
  await f.locator('.card').focus();
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab'); // move focus away and back with the keyboard
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Shift+Tab' : 'Shift+Tab');
  await expect(f.locator('.card')).toBeFocused();
  await expect.poll(() => tiltError(f, 'rotateX(8deg) rotateY(-16deg)'), { timeout: 4000 }).toBeLessThan(0.01);
  await expect.poll(() => cs(f, '.sweep', 'animation-name')).toBe('glint');
  await f.locator('body').evaluate(() => (document.activeElement as HTMLElement)?.blur());
  for (let i = 0; i < 20; i++) await f.locator('.card').click({ delay: 0 });
  await expect(f.locator('.ed-name')).toHaveText('nocturne'); // 20 % 3 = 2 steps from aurora
  await expect.poll(() => f.$eval('.stage', (s) => [...s.attributes].filter((a) => a.name.startsWith('data-rcss-changed')).length), { timeout: 3000 }).toBe(0);
  expect(await diagnostics(f)).toEqual([]);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('no tilt, no parallax, no sweep; the light and the editions still respond', async ({ page }) => {
    await page.goto(DETAIL);
    const f = await frameOf(page);
    await at(page, f, 0.85, 0.2);
    await expect.poll(() => cs(f, '.slot', '--hot')).toBe('1');
    expect(await cs(f, '.card', 'transform')).toBe('none');
    expect(await cs(f, '.moon', 'translate')).toBe('none');
    await expect.poll(async () => Math.abs((await num(f, '.slot', '--gx')) - 0.7)).toBeLessThan(0.03);
    await f.locator('.card').click();
    await expect(f.locator('.ed-name')).toHaveText('gilt');
    expect(await cs(f, '.sweep', 'animation-name')).toBe('none');
  });
});

test('idle and teardown: no runtime work at rest; leaving the page and coming back starts a clean runtime', async ({ page }) => {
  await page.goto(DETAIL);
  let f = await frameOf(page);
  await at(page, f, 0.3, 0.4);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(1600); // the spring settles
  const before = await f.evaluate(() => (window as any).ReactiveCSS.stats().flushes);
  await page.waitForTimeout(1000);
  expect(await f.evaluate(() => (window as any).ReactiveCSS.stats())).toMatchObject({ flushes: before, intervals: 0, scheduled: 0 });
  // Repeated navigation: each visit gets one runtime in the frame, and none in the page itself.
  for (let i = 0; i < 3; i++) {
    await page.goto('/experiments/');
    await page.goto(DETAIL);
    f = await frameOf(page);
    expect(await page.evaluate(() => typeof (window as any).ReactiveCSS)).toBe('undefined');
    expect(await f.evaluate(() => document.querySelectorAll('script[src*="reactive-css"]').length)).toBe(1);
    expect(await diagnostics(f)).toEqual([]);
  }
});

for (const w of [320, 390, 1024, 1440]) {
  test(`layout at ${w}px: no horizontal overflow on the index and the detail page; the card fits its frame`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 900 });
    for (const path of ['/experiments/', DETAIL]) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), path).toBeLessThanOrEqual(0);
      const f = await frameOf(page);
      const fit = await f.evaluate(() => { const r = document.querySelector('.slot')!.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; });
      expect(fit, path).toBe(true);
    }
  });
}

test('accessibility: no serious or critical axe violations on the index and the detail page, nor inside the experiment', async ({ page }) => {
  for (const path of ['/experiments/', DETAIL]) {
    await page.goto(path);
    await frameOf(page);
    const r = await new AxeBuilder({ page }).analyze();
    const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), path).toEqual([]);
  }
});
