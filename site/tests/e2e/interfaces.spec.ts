// The Interfaces group (src/catalog/interfaces/) and the context menu and draggable card examples, run on their real
// pages with the production runtime: every behavior comes from the stylesheet, none from the site.
import { expect, test, type Page } from '@playwright/test';

async function detail(page: Page, id: string) {
  await page.goto(`/examples/${id}/`);
  await page.waitForFunction((x) => !document.querySelector(`astro-island[ssr] [data-example-detail="${x}"]`), id);
  const root = page.locator(`[data-example-detail="${id}"]`);
  const f = root.frameLocator('iframe').first();
  await expect.poll(() => f.locator('body').evaluate(() => typeof (window as any).ReactiveCSS)).toBe('object');
  expect(await f.locator('body').evaluate(() => (window as any).ReactiveCSS.diagnostics.length), `${id}: runtime diagnostics`).toBe(0);
  return { root, f };
}

test('accordion: each item owns its state; aria-expanded follows', async ({ page }) => {
  const { f } = await detail(page, 'accordion');
  const q = (n: string) => f.getByRole('button', { name: n });
  await q('Is it a framework?').click();
  await expect(q('Is it a framework?')).toHaveAttribute('aria-expanded', 'true');
  await expect(q('Do I need a build step?')).toHaveAttribute('aria-expanded', 'false');
  await expect(f.locator('#faq-1')).toBeVisible();
  await expect(f.locator('#faq-2')).toBeHidden();
  await q('Is it a framework?').click();
  await expect(f.locator('#faq-1')).toBeHidden();
});

test('dropdown: focus moves in on open and back on Escape or a choice; outside click closes without taking focus', async ({ page }) => {
  const { f } = await detail(page, 'dropdown');
  const trigger = f.getByRole('button', { name: 'Options' });
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(f.getByRole('button', { name: 'Rename' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(f.locator('ul')).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await f.getByRole('button', { name: 'Archive' }).click();
  await expect(f.locator('.choice')).toHaveText('Archive');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await f.locator('.readout').click(); // outside .menu
  await expect(f.locator('ul')).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

test('theme switcher: cycle() through three themes, the label is DOM text', async ({ page }) => {
  const { f } = await detail(page, 'theme-switcher');
  const button = f.getByRole('button', { name: /Theme/ });
  await button.click();
  await expect(button).toHaveText('Theme: dark');
  await expect(f.locator('.themes')).toHaveCSS('background-color', 'rgb(28, 25, 23)');
  await button.click();
  await button.click();
  await expect(button).toHaveText('Theme: light');
});

test('signup form: controls feed the preview, Reset restores both', async ({ page }) => {
  const { f } = await detail(page, 'signup-form');
  await f.getByRole('textbox', { name: 'Name' }).fill('Ada');
  await f.getByRole('combobox', { name: 'Plan' }).selectOption('team');
  await f.getByRole('checkbox', { name: 'Newsletter' }).check();
  await expect(f.locator('.preview')).toHaveText('Ada · team · subscribed', { useInnerText: true });
  await f.getByRole('button', { name: 'Reset' }).click();
  await expect(f.getByRole('textbox', { name: 'Name' })).toHaveValue('');
  await expect(f.locator('.preview')).toHaveText('Your name · basic', { useInnerText: true });
});

test('step wizard: Back and Next clamp, the step list jumps, aria-current and disabled are real', async ({ page }) => {
  const { f } = await detail(page, 'step-wizard');
  const back = f.getByRole('button', { name: '← Back' }), next = f.getByRole('button', { name: 'Next →' });
  await expect(back).toBeDisabled();
  await expect(f.getByRole('button', { name: '1 · Account' })).toHaveAttribute('aria-current', 'step');
  await next.click();
  await next.click();
  await expect(next).toBeDisabled();
  await expect(f.locator('.panel').nth(2)).toBeVisible();
  await f.getByRole('button', { name: '1 · Account' }).click();
  await expect(f.locator('.panel').nth(0)).toBeVisible();
  await expect(f.getByRole('button', { name: '3 · Confirm' })).not.toHaveAttribute('aria-current');
});

test('task list: a checked task fades', async ({ page }) => {
  const { f } = await detail(page, 'task-list');
  await f.getByRole('checkbox', { name: 'Run the engine tests' }).check();
  await expect(f.locator('.task').nth(1).locator('span')).toHaveCSS('opacity', '0.5');
  await expect(f.locator('.task').nth(0).locator('span')).toHaveCSS('opacity', '1');
});

test('pricing toggle: role="switch" gets a real aria-checked, the price is DOM text', async ({ page }) => {
  const { f } = await detail(page, 'pricing-toggle');
  const sw = f.getByRole('switch', { name: 'Bill annually' });
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect(f.locator('.price')).toHaveText('$96 / year');
  await expect(f.locator('.saving')).toBeVisible();
});

test('context menu: opens at the right-click, clamped inside the desk; the native menu is cancelled', async ({ page }) => {
  const { f } = await detail(page, 'context-menu');
  const desk = f.locator('.desk');
  await f.locator('body').evaluate(() => { (window as any).cancelled = []; addEventListener('contextmenu', (e) => (window as any).cancelled.push(e.defaultPrevented)); });
  const box = (await desk.boundingBox())!;
  await desk.click({ button: 'right', position: { x: 40, y: 30 } });
  const menu = f.getByRole('menu');
  await expect(menu).toBeVisible();
  const m = (await menu.boundingBox())!;
  expect([Math.round(m.x - box.x), Math.round(m.y - box.y)]).toEqual([40, 30]); // the menu is positioned in the stage, whose box is the desk's border box
  // contextmenu does not arm focus requests (runtime: click, keydown, input, change, pointerup, submit).
  await expect(f.getByRole('menuitem', { name: 'New note' })).not.toBeFocused();
  // Near the bottom-right corner the position is clamped so the menu stays inside.
  await page.keyboard.press('Escape');
  await desk.click({ button: 'right', position: { x: box.width - 5, y: box.height - 5 } });
  const c = (await menu.boundingBox())!;
  expect(c.x + c.width).toBeLessThanOrEqual(box.x + box.width);
  expect(c.y + c.height).toBeLessThanOrEqual(box.y + box.height);
  await f.getByRole('menuitem', { name: 'Paste' }).click();
  await expect(menu).toBeHidden();
  await expect(f.locator('.last')).toHaveText('Paste');
  await expect(desk).toBeFocused();
  expect(await f.locator('body').evaluate(() => (window as any).cancelled)).toEqual([true, true]);
});

test('draggable card: the limits follow the area, so the card reaches its left and right edges', async ({ page }) => {
  const { f } = await detail(page, 'draggable-card');
  const area = (await f.locator('.area').boundingBox())!;
  const card = f.locator('.card');
  const drag = async (dx: number) => {
    const c = (await card.boundingBox())!;
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(c.x + c.width / 2 + (dx * i) / 8, c.y + c.height / 2);
    await page.mouse.up();
  };
  await drag(-area.width);
  await expect.poll(async () => Math.round((await card.boundingBox())!.x - area.x)).toBe(1);
  await drag(area.width * 2);
  await expect.poll(async () => Math.round(area.x + area.width - (await card.boundingBox())!.x - (await card.boundingBox())!.width)).toBe(1);
});

// The reported Playground reproduction: event(client-x) is a length, so a number state cannot hold it.
test('event(client-x) stores into a length state, and is refused (with a diagnostic) by a number state', async ({ page }) => {
  const runtime = new URL('/runtime/reactive-css.min.js', test.info().project.use.baseURL ?? 'http://localhost:4400').href;
  await page.goto('/');
  const css = (init: string) => `.area { --x: state(${init}); --y: state(${init}); height: 400px; }
    .area:on(contextmenu, prevent()) { --x: set(event(client-x)); --y: set(event(client-y)); }
    .menu { position: fixed; left: var(--x); top: var(--y); width: 10px; height: 10px; }`;
  for (const [init, want] of [['0px', [300, 200]], ['0', [0, 0]]] as const) {
    await page.setContent(`<!doctype html><style>body { margin: 0 }</style><style>${css(init)}</style><body><div class="area"><div class="menu"></div></div><script src="${runtime}"></script></body>`);
    await page.waitForFunction(() => (window as any).ReactiveCSS?.stats);
    await page.mouse.click(300, 200, { button: 'right' });
    await expect.poll(async () => { const b = (await page.locator('.menu').boundingBox())!; return [b.x, b.y]; }).toEqual(want);
    const diagnostics = await page.evaluate(() => (window as any).ReactiveCSS.diagnostics.length);
    expect(diagnostics, `state(${init})`).toBe(init === '0' ? 2 : 0);
  }
});
