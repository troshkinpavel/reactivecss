// The score-history example page's comparison (moved from Vision v1) runs two independent implementations of the library's score-history
// demo: Reactive CSS with the production runtime, and vanilla JavaScript with no Reactive CSS.
// The same interactions must leave both in the same visible state.
import { expect, test, type FrameLocator, type Page } from '@playwright/test';

async function open(page: Page) {
  await page.goto('/examples/score-history/');
  const cmp = page.locator('[data-score-comparison]');
  await cmp.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr] [data-score-comparison]'));
  await page.waitForFunction(() => document.querySelectorAll('[data-score-comparison] iframe').length === 2);
  return { cmp, rcss: cmp.locator('[data-run="rcss"] iframe').contentFrame(), js: cmp.locator('[data-run="js"] iframe').contentFrame() };
}

/** Everything a reader can see or a script can read on one board. */
const snapshot = (f: FrameLocator, board: string) => f.locator(board).evaluate((el) => {
  const q = (s: string) => el.querySelector(s) as HTMLElement;
  const shown = (s: string) => getComputedStyle(q(s)).display !== 'none';
  return {
    text: (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
    current: q('.current').textContent, prev: q('.prev').textContent, delta: q('.delta').textContent, direction: q('.direction').textContent,
    directionColor: getComputedStyle(q('.direction')).color,
    history: shown('.history'), nochange: shown('.nochange'),
    resetDisabled: (q('.reset') as HTMLButtonElement).disabled, dataDirection: el.getAttribute('data-direction'),
  };
});

test('both implementations run, and only one of them loads Reactive CSS', async ({ page }) => {
  const { rcss, js } = await open(page);
  await expect(rcss.locator('#home .reset')).toBeDisabled();
  await expect(js.locator('#home .reset')).toBeDisabled();
  expect(await rcss.locator('body').evaluate(() => typeof (window as any).ReactiveCSS)).toBe('object');
  expect(await js.locator('body').evaluate(() => typeof (window as any).ReactiveCSS)).toBe('undefined');
});

test('same interactions give the same visible state', async ({ page }) => {
  const { cmp, rcss, js } = await open(page);
  const steps: [string, string][] = [['#home', '.up'], ['#home', '.up'], ['#home', '.down'], ['#away', '.down'], ['#home', '.reset'], ['#away', '.up'], ['#away', '.up']];
  // Each frame is shown before it is read: innerText needs a rendered document.
  const show = (name: string) => cmp.getByRole('radio', { name }).click();
  const compare = async (label: string) => {
    for (const b of ['#home', '#away']) {
      await show('Vanilla JS');
      const want = await snapshot(js, b);
      await show('Reactive CSS');
      // Reactive CSS writes in the frame after the click; poll until it settles.
      await expect.poll(() => snapshot(rcss, b), { message: `${label} ${b}` }).toEqual(want);
    }
  };
  await compare('initial');
  for (const [b, btn] of steps) {
    await show('Reactive CSS');
    await rcss.locator(`${b} ${btn}`).click();
    await show('Vanilla JS');
    await js.locator(`${b} ${btn}`).click();
    await compare(`after ${b} ${btn}`);
  }
  expect((await snapshot(js, '#away')).current).toBe('1');
});

test('keyboard: Tab order and Enter/Space are the same in both', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'WebKit does not Tab to buttons by default');
  const { cmp, rcss, js } = await open(page);
  for (const [name, f] of [['Reactive CSS', rcss], ['Vanilla JS', js]] as const) {
    await cmp.getByRole('radio', { name }).click();
    await f.locator('#home .down').focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await expect(f.locator('#home .current'), name).toHaveText('2');
    await page.keyboard.press('Tab');
    await expect(f.locator('#home .reset'), name).toBeFocused();
  }
});

test('both restart the same keyframes on each change', async ({ page }) => {
  const { cmp, rcss, js } = await open(page);
  const anim = (f: FrameLocator) => f.locator('#home .current').evaluate((el) => el.getAnimations().map((a) => (a as CSSAnimation).animationName).join());
  for (const [name, f] of [['Reactive CSS', rcss], ['Vanilla JS', js]] as const) {
    await cmp.getByRole('radio', { name }).click();
    await f.locator('#home .up').click();
    await expect.poll(() => anim(f), { message: `${name} up` }).toBe('bump');
    await f.locator('#home .down').click();
    await expect.poll(() => anim(f), { message: `${name} down` }).toBe('dip');
  }
});
