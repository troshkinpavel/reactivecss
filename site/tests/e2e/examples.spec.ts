// Every example runs the real Reactive CSS runtime in its preview. These tests interact with
// the preview the way a reader does and check the values the inspector observed.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// The Control Center examples live in workspace pages.
const WORKSPACE: Record<string, string> = { 'control-center': '/examples/control-center/', 'control-center-deep': '/examples/control-center-deep-dive/' };
// Site examples whose id a catalog entry uses (/examples/tabs/ is the Tabs interface): a docs page embeds them.
const EMBEDDED: Record<string, string> = { tabs: '/docs/selectors/' };
const open = async (page: Page, id: string) => {
  await page.goto(WORKSPACE[id] ?? EMBEDDED[id] ?? `/examples/${id}/`);
  const root = page.locator(WORKSPACE[id] ? `[data-workspace="${id}"]` : `[data-example="${id}"]`);
  const preview = root.frameLocator('iframe');
  // Chromium pauses animation frames in an off-screen sandboxed frame, and the runtime and the
  // bridge both work in animation frames. Long examples put the preview below the fold.
  await root.locator('iframe').scrollIntoViewIfNeeded();
  // The bridge has reported initial values once the first chip is rendered.
  await expect(root.locator('[data-line] span.border-rx').first()).toBeVisible({ timeout: 10_000 });
  return { root, preview };
};
const chip = (root: ReturnType<Page['locator']>, line: number) => root.locator(`[data-line="${line}"] span.border-rx`);
/** Zero-based line of a declaration in an example's style.css, so the tests follow edits to the file. */
const lineOf = (id: string, text: string) => readFileSync(new URL(`../../src/examples/${id}/style.css`, import.meta.url), 'utf8').split('\n').findIndex((l) => l.includes(text));

test('switch: click toggles --on', async ({ page }) => {
  const { root, preview } = await open(page, 'switch');
  await expect(chip(root, 1)).toHaveText('false');
  await preview.locator('.switch').click();
  await expect(chip(root, 1)).toHaveText('true');
  await expect(root.getByRole('table')).toContainText('--on');
});

test('greeting: set() writes a greeting picked from the list', async ({ page }) => {
  const { root, preview } = await open(page, 'greeting');
  await expect(chip(root, 1)).toHaveText('"Hello!"');
  await expect(preview.locator('.message')).toHaveCSS('height', '64px');
  // pick() is random and may pick the current greeting again: click until it changes.
  await expect.poll(async () => { await preview.getByRole('button', { name: 'Surprise me' }).click(); return chip(root, 1).textContent(); }, { timeout: 10_000 })
    .toMatch(/^"(Bonjour|Hola|Ciao)!"$/);
});

test('like: a source control edits the stylesheet', async ({ page }) => {
  const { root, preview } = await open(page, 'like');
  await preview.locator('.like').click();
  await expect(chip(root, 1)).toHaveText('true');
  await expect(preview.locator('.like')).toHaveCSS('color', 'rgb(242, 84, 45)');
});

test('previews are sandboxed with an opaque origin', async ({ page }) => {
  await page.goto('/examples/switch/');
  const frame = page.locator('[data-example="switch"] iframe');
  await expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-forms');
  const origin = await frame.contentFrame().locator('body').evaluate(() => window.origin);
  expect(origin).toBe('null');
});

// ── Docs examples ───────────────────────────────────────────────────────────

test('history: previous() keeps the last value', async ({ page }) => {
  const { root, preview } = await open(page, 'history');
  await preview.getByRole('button', { name: 'Increase' }).click();
  await preview.getByRole('button', { name: 'Increase' }).click();
  await expect(chip(root, 1)).toHaveText('2');
  await expect(chip(root, 2)).toHaveText('1');
  await preview.getByRole('button', { name: 'Decrease' }).click();
  await expect(chip(root, 1)).toHaveText('1');
  await expect(chip(root, 2)).toHaveText('2');
  // The strip shows -5 up to the current number, the current one marked.
  await expect(preview.locator('.trail span:visible')).toHaveText(['-5', '-4', '-3', '-2', '-1', '0', '1']);
  await expect(preview.locator('.trail span').nth(6)).toHaveCSS('color', 'oklch(0.55 0.2 35)');
});

test('tabs: set(sibling-index()) and :nth-var() pick the panel', async ({ page }) => {
  const { root, preview } = await open(page, 'tabs');
  const panels = preview.locator('.panel');
  await expect(panels.nth(0)).toBeVisible();
  await preview.getByRole('tab', { name: 'Syntax' }).click();
  await expect(chip(root, 1)).toHaveText('2');
  await expect(panels.nth(1)).toBeVisible();
  await expect(panels.nth(0)).toBeHidden();
});

test('form: :on(input) and :on(change) copy a text field, a select and a checkbox', async ({ page }) => {
  const { root, preview } = await open(page, 'form');
  await preview.getByRole('textbox').fill('Ada');
  await expect(chip(root, lineOf('form', '--name: state'))).toHaveText('"Ada"');
  await preview.getByRole('combobox').selectOption('pro');
  await expect(chip(root, lineOf('form', '--plan: state'))).toHaveText('"pro"');
  await preview.getByRole('checkbox').check();
  await expect(chip(root, lineOf('form', '--news: state'))).toHaveText('true');
  await expect(preview.locator('.badge')).toBeVisible();
});

test('theme: cycle() moves through the themes', async ({ page }) => {
  const { root, preview } = await open(page, 'theme');
  await expect(chip(root, 1)).toHaveText('light');
  await preview.getByRole('button', { name: 'Theme' }).click();
  await expect(chip(root, 1)).toHaveText('dark');
  await expect(preview.locator('.page')).toHaveCSS('background-color', 'rgb(28, 25, 23)');
  await preview.getByRole('button', { name: 'Theme' }).click();
  await expect(chip(root, 1)).toHaveText('sepia');
});

const px = (s: string | null) => parseFloat(s ?? '');

test('pointer: mouse(x, local) follows the pointer', async ({ page }) => {
  const { root, preview } = await open(page, 'pointer');
  await preview.locator('.pad').hover({ position: { x: 120, y: 60 } });
  await expect.poll(async () => px(await chip(root, 1).textContent())).toBeCloseTo(120, -0.5);
  await expect.poll(async () => px(await chip(root, 2).textContent())).toBeCloseTo(60, -0.5);
  await expect(preview.locator('.dot')).not.toHaveCSS('translate', 'none');
});

test('pricing: the switch changes the price text', async ({ page }) => {
  const { root, preview } = await open(page, 'pricing');
  const price = preview.locator('.price');
  const after = () => price.evaluate((el) => getComputedStyle(el, '::after').content);
  await expect.poll(after).toBe('"$10 / month"');
  await preview.getByRole('switch').click();
  await expect(chip(root, lineOf('pricing', '--annual: state'))).toHaveText('true');
  await expect(preview.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  await expect.poll(after).toBe('"$96 / year"');
  await expect(preview.locator('.saving')).toBeVisible();
});

test('check: bind: and :just-checked on a task', async ({ page }) => {
  const { root, preview } = await open(page, 'check');
  await preview.getByRole('checkbox').first().check();
  await expect(chip(root, 1)).toHaveText('true');
  const label = preview.locator('.task span').first();
  await expect(label).toHaveCSS('animation-name', 'pop');
  await expect(label).toHaveCSS('opacity', '0.55');
  await preview.getByRole('checkbox').first().uncheck();
  await expect(label).toHaveCSS('animation-name', 'settle');
});

test('dice: on() re-rolls random() and pick()', async ({ page }) => {
  const { root, preview } = await open(page, 'dice');
  await expect(chip(root, 1)).toHaveText(/^[1-6]$/);
  await preview.getByRole('button', { name: 'Roll the die' }).click();
  await expect(chip(root, 1)).toHaveText(/^[1-6]$/);
  await preview.locator('.greet').click();
  await expect(chip(root, 10)).toHaveText(/^"(Hello|Hi|Hey)"$/);
  // random() may repeat the value, and an unchanged value logs nothing: roll until one changes.
  await expect(async () => {
    await preview.getByRole('button', { name: 'Roll the die' }).click();
    await expect(root.getByLabel('Events')).toContainText('click', { timeout: 500 });
  }).toPass();
});

test('size: set() writes a dimension', async ({ page }) => {
  const { root, preview } = await open(page, 'size');
  await expect(chip(root, 1)).toHaveText('16px');
  await preview.getByRole('button', { name: 'L', exact: true }).click();
  await expect(chip(root, 1)).toHaveText('20px');
  await expect(preview.locator('.reader p')).toHaveCSS('font-size', '20px');
  // :when() marks the current size.
  await expect(preview.locator('.reader .l')).toHaveCSS('color', 'oklch(0.985 0.004 85)');
  await expect(preview.locator('.reader .m')).not.toHaveCSS('color', 'oklch(0.985 0.004 85)');
});

test('geometry: element(width) measures the card', async ({ page }) => {
  const { root, preview } = await open(page, 'geometry');
  await expect(chip(root, 1)).toHaveText('320px');
  await expect(chip(root, 13)).toHaveText(/^\d+(\.\d+)?px$/);
  await preview.getByRole('button', { name: '− 40px' }).click();
  await expect(chip(root, 1)).toHaveText('280px');
  const card = preview.locator('.geo');
  await expect.poll(async () => px(await chip(root, 13).textContent())).toBeCloseTo(await card.evaluate((el) => el.getBoundingClientRect().width), 0);
});

// ── Homepage demos ──────────────────────────────────────────────────────────

test('wizard: dots and Next move --step', async ({ page }) => {
  const { root, preview } = await open(page, 'wizard');
  await preview.getByRole('button', { name: /Plan/ }).click();
  await expect(chip(root, 1)).toHaveText('2');
  await expect(preview.locator('.panel').nth(1)).toBeVisible();
  await preview.getByRole('button', { name: 'Next →' }).click();
  await expect(chip(root, 1)).toHaveText('3');
  await expect(preview.locator('.next')).toHaveCSS('visibility', 'hidden');
});

test('score: previous() and direction() report the trend', async ({ page }) => {
  const { root, preview } = await open(page, 'score');
  const trend = () => preview.locator('.trend').evaluate((el) => getComputedStyle(el, '::after').content);
  await preview.getByRole('button', { name: 'Raise the score' }).click();
  await expect(chip(root, 1)).toHaveText('11');
  await expect(chip(root, 2)).toHaveText('10');
  await expect.poll(trend).toBe('"▲ up"');
  await preview.getByRole('button', { name: 'Lower the score' }).click();
  await expect(chip(root, 1)).toHaveText('10');
  await expect.poll(trend).toBe('"▼ down"');
});

test('profile: bind: copies the name into the card', async ({ page }) => {
  const { root, preview } = await open(page, 'profile');
  await expect(chip(root, 1)).toHaveText('""');
  await preview.getByRole('textbox', { name: 'Display name' }).fill('Ada');
  await expect(chip(root, 1)).toHaveText('"Ada"');
});

test('spotlight: the gradient follows the pointer', async ({ page }) => {
  const { root, preview } = await open(page, 'spotlight');
  const spot = preview.locator('.spotlight');
  await spot.hover({ position: { x: 100, y: 50 } });
  await expect.poll(async () => px(await chip(root, 1).textContent())).toBeCloseTo(100, -0.5);
  await expect(spot).toHaveCSS('background-image', /at 10\d(\.\d+)?px 5\d(\.\d+)?px/);
});

// ── Compare page ────────────────────────────────────────────────────────────

test('compare-typed: typed() lets the rotation animate on hover', async ({ page }) => {
  const { root, preview } = await open(page, 'compare-typed');
  await expect(chip(root, 1)).toHaveText('0deg');
  await preview.locator('.card').hover();
  await expect(preview.locator('.card')).toHaveCSS('rotate', '90deg');
});

test('compare-when: when() picks the background', async ({ page }) => {
  const { root, preview } = await open(page, 'compare-when');
  await expect(preview.locator('.card')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await preview.getByRole('button', { name: '.mode' }).click();
  await expect(chip(root, 1)).toHaveText('dark');
  await expect(preview.locator('.card')).toHaveCSS('background-color', 'rgb(23, 23, 23)');
});

test('compare-whensel: :when() shows the banner from three items', async ({ page }) => {
  const { root, preview } = await open(page, 'compare-whensel');
  const add = preview.getByRole('button', { name: 'Add an item' });
  await add.click();
  await expect(chip(root, 1)).toHaveText('2');
  await expect(preview.locator('.banner')).toHaveCSS('opacity', '0');
  await add.click();
  await expect(chip(root, 1)).toHaveText('3');
  await expect(preview.locator('.banner')).toHaveCSS('opacity', '1');
});

// ── Playground starters ─────────────────────────────────────────────────────

test('pg-toggle: click toggles --on', async ({ page }) => {
  const { root, preview } = await open(page, 'pg-toggle');
  await preview.getByRole('switch').click();
  await expect(chip(root, lineOf('pg-toggle', '--on: state'))).toHaveText('true');
  await expect(preview.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  await expect(preview.locator('.switch')).toHaveCSS('background-color', 'rgb(242, 84, 45)');
});

test('pg-counter: increment(), decrement() and DOM text', async ({ page }) => {
  const { root, preview } = await open(page, 'pg-counter');
  await preview.getByRole('button', { name: 'Increase' }).click();
  await preview.getByRole('button', { name: 'Increase' }).click();
  await expect(chip(root, lineOf('pg-counter', '--count: state'))).toHaveText('2');
  await preview.getByRole('button', { name: 'Decrease' }).click();
  await expect(preview.locator('output')).toHaveText('1');
});

test('pg-tabs: the clicked tab shows its panel', async ({ page }) => {
  const { root, preview } = await open(page, 'pg-tabs');
  await preview.getByRole('tab', { name: 'Support' }).click();
  await expect(chip(root, 1)).toHaveText('3');
  await expect(preview.locator('.panel').nth(2)).toBeVisible();
});

test('pg-input: bind(value) on the field, a copy feeds the greeting, Clear resets both', async ({ page }) => {
  const { root, preview } = await open(page, 'pg-input');
  const field = preview.getByRole('textbox', { name: 'Your name' });
  await field.fill('Ada');
  await expect(chip(root, lineOf('pg-input', '--name: state'))).toHaveText('"Ada"');
  await expect(chip(root, lineOf('pg-input', '--greeting: state'))).toHaveText('"Ada"');
  await expect(preview.locator('.greeting')).toHaveText('Hello, Ada.');
  await expect(field).toHaveCSS('border-color', 'rgb(21, 128, 61)');
  await preview.getByRole('button', { name: 'Clear' }).click();
  await expect(field).toHaveValue('');
  await expect(preview.locator('.greeting')).toHaveText('Hello, stranger.');
});

// ── Control Center ──────────────────────────────────────────────────────────

test('control-center: native controls drive the preview, submit stays native', async ({ page }) => {
  const { root, preview } = await open(page, 'control-center');
  await expect(chip(root, 5)).toHaveText('"light"');
  await preview.getByRole('radio', { name: 'Dark' }).check();
  await expect(chip(root, 5)).toHaveText('"dark"');
  await expect(preview.locator('.control-center')).toHaveCSS('background-color', 'rgb(28, 25, 23)');
  await preview.getByRole('radio', { name: 'Moss' }).check();
  await expect(chip(root, 6)).toHaveText('"moss"');
  await expect(preview.locator('.avatar')).toHaveCSS('background-color', 'rgb(63, 122, 90)');
  await preview.getByRole('checkbox', { name: 'Notifications' }).uncheck();
  await expect(chip(root, 7)).toHaveText('false');
  await expect(preview.locator('.badge')).toBeHidden();
  await preview.getByRole('textbox', { name: 'Display name' }).fill('Sam');
  await expect(chip(root, 8)).toHaveText('"Sam"');
  await preview.getByRole('button', { name: 'Save settings' }).click();
  const submission = root.getByRole('status', { name: 'Submission preview' });
  await expect(submission).toContainText('displayName');
  await expect(submission).toContainText('Sam');
  await expect(root.getByRole('list', { name: 'Latest state transition' })).toContainText('submission preview · nothing sent');
  await preview.getByRole('button', { name: 'Reset' }).click();
  await expect(chip(root, 5)).toHaveText('"light"');
  await expect(chip(root, 8)).toHaveText('"Alex Rivera"');
});

test('control-center-deep: actions, bindings and history', async ({ page }) => {
  const { root, preview } = await open(page, 'control-center-deep');
  await preview.getByRole('button', { name: 'Dark' }).click();
  await expect(chip(root, 4)).toHaveText('dark');
  await preview.locator('.density-button').click();
  await expect(chip(root, 6)).toHaveText('compact');
  await expect(chip(root, 68)).toHaveText('8px');
  await preview.getByRole('button', { name: 'Notifications' }).click();
  await expect(chip(root, 7)).toHaveText('false');
  await expect(preview.locator('.digest')).toHaveCSS('opacity', '0.4');
  await expect(preview.getByRole('radio', { name: 'Daily' })).toBeChecked();
  await preview.getByRole('button', { name: 'More sessions' }).click();
  await expect(chip(root, 11)).toHaveText('5');
  await expect(chip(root, 12)).toHaveText('4');
  await expect(preview.locator('.goal .history')).toHaveCSS('visibility', 'visible');
});
