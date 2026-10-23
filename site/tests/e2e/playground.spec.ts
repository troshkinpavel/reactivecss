// The Playground as a developer tool: HTML and CSS edits run for real in the 0.9.0 runtime,
// drafts survive preset switches, problems are visible, the page survives invalid input, and the
// preview stays sandboxed.
import { expect, test, type Page } from '@playwright/test';

const RUNNING = 'No diagnostics · running';
const css = (page: Page) => page.locator('#pg-css');
const html = (page: Page) => page.locator('#pg-html');
const frame = (page: Page) => page.getByRole('region', { name: 'Preview' }).frameLocator('iframe');
// The status row is in the Inspect pane, which narrow screens hide behind a tab: located by CSS, not by role.
const status = (page: Page) => page.locator('[data-pane-id=inspect] [role=status]');
const preset = (page: Page, name: string | RegExp) => page.getByRole('radiogroup', { name: 'Presets' }).getByRole('radio', { name });
const inspect = (page: Page, tab: string) => page.getByRole('region', { name: 'Inspector' }).getByRole('tab', { name: new RegExp(`^${tab}`) });

test.beforeEach(async ({ page }) => {
  await page.goto('/playground/');
  await expect(status(page)).toHaveText(new RegExp(RUNNING), { timeout: 10_000 });
});

test('opens on Toggle with the CSS tab; the runtime in the preview is 0.9.0', async ({ page }) => {
  await expect(preset(page, 'Toggle')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('tab', { name: 'CSS' })).toHaveAttribute('aria-selected', 'true');
  expect(await frame(page).locator('body').evaluate(() => (window as any).ReactiveCSS.version)).toBe('0.9.0');
});

test('an edit restarts the preview with the new stylesheet', async ({ page }) => {
  const color = () => frame(page).locator('.switch').evaluate((el) => getComputedStyle(el).backgroundColor);
  await frame(page).locator('.switch').click();
  await expect.poll(color).toBe('rgb(242, 84, 45)');
  await css(page).fill((await css(page).inputValue()).replace('#f2542d', '#2563eb'));
  await expect(status(page)).toHaveText(new RegExp(RUNNING));
  await frame(page).locator('.switch').click();
  await expect.poll(color).toBe('rgb(37, 99, 235)');
});

test('Blank: write HTML and Reactive CSS from scratch; state and events come from the runtime', async ({ page }) => {
  await preset(page, 'Blank').click();
  await expect(page.getByRole('tab', { name: 'HTML' })).toHaveAttribute('aria-selected', 'true');
  await expect(html(page)).toHaveValue('');
  await expect(css(page)).toHaveValue('');
  await expect(frame(page).locator('body')).toHaveText('');
  await html(page).fill('<button class="counter">\n  <span class="value">0</span>\n</button>');
  await page.getByRole('tab', { name: 'CSS' }).click();
  await css(page).fill('.counter {\n  --count: state(0);\n}\n\n.counter:on(click) {\n  --count: increment(1);\n}\n\n.value {\n  content: var(--count);\n}');
  await expect(status(page)).toHaveText(new RegExp(RUNNING));
  const button = frame(page).getByRole('button');
  await button.click();
  await button.click();
  await expect(button).toHaveText('2');
  await inspect(page, 'State').click();
  await expect(page.getByRole('region', { name: 'Inspector' }).getByRole('table')).toContainText(/--count\s*2\s*1\s*2/);
  await inspect(page, 'Events').click();
  await expect(page.getByRole('region', { name: 'Inspector' }).getByRole('list', { name: 'Events' })).toContainText('--count 1 → 2');
  await inspect(page, 'Features').click();
  await expect(page.getByRole('region', { name: 'Inspector' }).getByRole('link', { name: ':on()' })).toBeVisible();
});

test('drafts: edits survive a preset switch; Reset restores the preset; Clear empties both editors', async ({ page }) => {
  await css(page).fill('/* mine */\n' + (await css(page).inputValue()));
  await expect(preset(page, /^Toggle •/)).toBeVisible();
  await preset(page, 'Counter').click();
  await expect(css(page)).toHaveValue(/--count: state\(0\)/);
  await preset(page, /^Toggle/).click();
  await expect(css(page)).toHaveValue(/^\/\* mine \*\//);
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(css(page)).not.toHaveValue(/mine/);
  await expect(preset(page, 'Toggle')).toBeVisible();
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(css(page)).toHaveValue('');
  await expect(html(page)).toHaveValue('');
  await expect(status(page)).toHaveText(new RegExp(RUNNING));
  await inspect(page, 'State').click();
  await expect(page.getByRole('region', { name: 'Inspector' }).getByRole('table')).toContainText('No states yet');
});

test('Split shows HTML above CSS, and both stay editable', async ({ page }) => {
  const split = page.getByRole('button', { name: 'Split' });
  await split.click();
  await expect(split).toHaveAttribute('aria-pressed', 'true');
  await expect(html(page)).toBeVisible();
  await expect(css(page)).toBeVisible();
  expect((await html(page).boundingBox())!.y).toBeLessThan((await css(page).boundingBox())!.y);
  await html(page).fill('<button class="switch" role="switch">Edited</button>');
  await expect(frame(page).getByRole('switch')).toHaveText('Edited');
  await split.click();
  await expect(page.getByRole('tab', { name: 'HTML' })).toBeVisible();
});

test('Copy HTML, CSS and both', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only in Playwright');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const copy = page.getByRole('button', { name: /^Copy/ });
  const read = () => page.evaluate(() => navigator.clipboard.readText());
  await copy.click();
  await page.getByRole('button', { name: 'Copy HTML' }).click();
  expect(await read()).toBe(await html(page).inputValue());
  await copy.click();
  await page.getByRole('button', { name: 'Copy CSS' }).click();
  expect(await read()).toBe(await css(page).inputValue());
  await copy.click();
  await page.getByRole('button', { name: 'Copy both' }).click();
  const both = await read();
  expect(both).toMatch(/^<!-- HTML -->\n<button class="switch"[\s\S]*\n\n\/\* CSS \*\/\n[\s\S]*toggle\(\)/);
  expect(both).not.toMatch(/<script/);
});

test('invalid Reactive CSS shows the runtime diagnostic in full, and the page keeps working', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await css(page).fill('.switch { --on: state(false); }\n.switch:on(click, prevent) { --on: toggle(); }');
  await expect(status(page)).toContainText('write the modifier as a function: prevent()');
  await expect(inspect(page, 'Diagnostics')).toHaveAttribute('aria-selected', 'true');
  await css(page).fill('.switch { color: red; } } } @media {');
  await expect(status(page)).toBeVisible();
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(status(page)).toHaveText(new RegExp(RUNNING));
  await expect(css(page)).toHaveValue(/--on: toggle\(\)/);
  expect(errors).toEqual([]);
});

test('Input binding: bind(value) and the greeting follow the field', async ({ page }) => {
  await preset(page, 'Input binding').click();
  await expect(status(page)).toHaveText(new RegExp(RUNNING));
  await frame(page).getByRole('textbox', { name: 'Your name' }).fill('Ada');
  await expect(frame(page).locator('.greeting')).toHaveText('Hello, Ada.');
});

test('Drag: :on(drag) moves the card with the pointer, repeatedly, and arrow keys move it too', async ({ page }) => {
  await preset(page, 'Drag').click();
  await expect(status(page)).toHaveText(new RegExp(RUNNING));
  const card = frame(page).locator('.card');
  const at = async () => { const b = (await card.boundingBox())!; return [Math.round(b.x), Math.round(b.y)]; };
  const [x0, y0] = await at();
  const drag = async (dx: number, dy: number) => {
    const b = (await card.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 5; i++) await page.mouse.move(b.x + b.width / 2 + (dx * i) / 5, b.y + b.height / 2 + (dy * i) / 5);
    await page.mouse.up();
  };
  await drag(40, 20);
  await expect.poll(at).toEqual([x0! + 40, y0! + 20]);
  await drag(30, 0); // the second drag starts from where the first ended
  await expect.poll(at).toEqual([x0! + 70, y0! + 20]);
  await card.focus();
  await page.keyboard.press('ArrowLeft');
  await expect.poll(at).toEqual([x0! + 60, y0! + 20]);
});

test('keyboard: Tab indents, Enter keeps the indentation, Esc then Tab leaves the editor', async ({ page }) => {
  await css(page).fill('.a {');
  await css(page).focus();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('--x: 1;');
  await expect(css(page)).toHaveValue('.a {\n  --x: 1;');
  await page.keyboard.press('Tab');
  await expect(css(page)).toBeFocused();
  await expect(css(page)).toHaveValue('.a {\n  --x: 1;  ');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await expect(css(page)).not.toBeFocused();
});

test('the preview is sandboxed: opaque origin, scripts only, strict CSP, user scripts never run', async ({ page }) => {
  const iframe = page.getByRole('region', { name: 'Preview' }).locator('iframe');
  await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-forms');
  const csp = await iframe.evaluate((el: HTMLIFrameElement) => el.srcdoc.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '');
  expect(csp).toContain("default-src 'none'");
  expect(csp).toMatch(/script-src 'nonce-[A-Za-z0-9]+'/);
  expect(await frame(page).locator('body').evaluate(() => origin)).toBe('null');
  expect(await frame(page).locator('body').evaluate(() => { try { return String(parent.document); } catch { return 'blocked'; } })).toBe('blocked');
  // User HTML: a script element and an inline handler stay inert under the CSP.
  await preset(page, 'Blank').click();
  await html(page).fill('<p id="out">safe</p><script>document.getElementById("out").textContent = "ran"</script><img src="x" onerror="document.getElementById(\'out\').textContent = \'ran\'">');
  await expect(frame(page).locator('#out')).toBeAttached();
  await page.waitForTimeout(500);
  await expect(frame(page).locator('#out')).toHaveText('safe');
});

test('one runtime per preview: rebuilding replaces the document instead of stacking runtimes', async ({ page }) => {
  for (let i = 0; i < 3; i++) {
    await css(page).fill(`/* ${i} */\n` + (await css(page).inputValue()).replace(/^\/\* \d \*\/\n/, ''));
    await expect(status(page)).toHaveText(new RegExp(RUNNING));
  }
  await expect(page.getByRole('region', { name: 'Preview' }).locator('iframe')).toHaveCount(1);
  expect(await frame(page).locator('body').evaluate(() => document.querySelectorAll('script').length)).toBe(3); // the watch spec, the bridge, the runtime
  await frame(page).locator('.switch').click();
  await inspect(page, 'Events').click();
  await expect(page.getByRole('region', { name: 'Inspector' }).getByRole('list', { name: 'Events' }).locator('li')).toHaveCount(1);
});

test.describe('narrow viewport', () => {
  test.use({ viewport: { width: 320, height: 760 } });
  test('Code, Preview and Inspect panes stay usable at 320px', async ({ page }) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    await expect(css(page)).toBeVisible();
    await expect(page.getByRole('tab', { name: 'HTML' })).toBeVisible();
    await css(page).fill('.switch { --on: state(true); }');
    await page.getByRole('tab', { name: 'Preview' }).click();
    await expect(page.getByRole('region', { name: 'Preview' })).toBeVisible();
    await page.getByRole('tab', { name: 'Inspect' }).click();
    await expect(status(page)).toBeVisible();
  });
});
