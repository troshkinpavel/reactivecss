// The five 0.5 examples (examples/*/), with real mouse and keyboard input, under a strict CSP.
import { test, expect, type Page } from '@playwright/test';
import { routeCustomBundle } from './example-helpers';

const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'";

/** Opens an example with a strict CSP header; collects console errors and CSP violations. */
async function visit(page: Page, name: string) {
  const problems: string[] = [];
  const webkit = page.context().browser()?.browserType().name() === 'webkit';
  const throttle = Number(process.env.RCSS_CPU_THROTTLE ?? 0); // as in helpers.open()
  if (throttle > 1 && !webkit) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: throttle });
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    // WebKit (Playwright 27.2) reports this for its own internal <select> stylesheet under
    // style-src 'self', also on a page with only a <select> and no script (checked): not ours.
    if (webkit && (name === 'live-form-preview' || name === 'settings-panel') && m.text().startsWith('Refused to apply a stylesheet because its hash')) return;
    problems.push(m.text());
  });
  await routeCustomBundle(page, name);
  await page.route(`**/examples/${name}/`, async (r) => {
    const res = await r.fetch();
    await r.fulfill({ response: res, headers: { ...res.headers(), 'content-security-policy': CSP } });
  });
  await page.goto(`/examples/${name}/`);
  await page.waitForFunction(() => (window as any).ReactiveCSS?.stats().sheets >= 1);
  await frames(page);
  return problems;
}
const frames = (page: Page, n = 2) => page.evaluate((n) => new Promise<void>((res) => { const f = () => (n-- ? requestAnimationFrame(f) : res()); f(); }), n);
const css = (page: Page, sel: string, prop: string, pseudo?: string) => page.$eval(sel, (e, [p, ps]) => getComputedStyle(e, ps || null).getPropertyValue(p).trim(), [prop, pseudo ?? ''] as const);
const shown = (page: Page, sel: string) => page.$eval(sel, (e) => getComputedStyle(e).display !== 'none');

/** Everything clean at the end: no errors, no diagnostics; removing the page content releases everything. */
async function finish(page: Page, problems: string[]) {
  expect(problems).toEqual([]);
  expect(await page.evaluate(() => (window as any).ReactiveCSS.diagnostics)).toEqual([]);
  await page.evaluate(() => document.querySelector('main')!.remove());
  await frames(page);
  const s = await page.evaluate(() => (window as any).ReactiveCSS.stats());
  expect([s.bindings, s.states, s.sources]).toEqual([0, 0, 0]);
}

test.describe('product configurator', () => {
  const total = (page: Page, id: string) => page.textContent(`#${id} .total`); // real DOM text (text:)

  test('quantity, color and gift wrapping update the total; bounds, keyboard, reset and isolation', async ({ page }) => {
    const problems = await visit(page, 'product-configurator');
    expect(await total(page, 'lamp')).toBe('$49.00');
    // keyboard: focus + and press Enter / Space
    await page.focus('#lamp .plus');
    await page.keyboard.press('Enter');
    await frames(page);
    await page.keyboard.press('Space');
    await frames(page);
    expect(await page.inputValue('#lamp .count')).toBe('3');
    expect(await total(page, 'lamp')).toBe('$147.00');
    // upper bound (0.6.0): rapid real pointer clicks stop at 10, where + is aria-disabled and clamps
    const aria = (sel: string) => page.getAttribute(sel, 'aria-disabled');
    const box = (await page.locator('#lamp .plus').boundingBox())!;
    for (let i = 0; i < 12; i++) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    expect(await page.inputValue('#lamp .count')).toBe('10');
    expect([await aria('#lamp .plus'), await aria('#lamp .minus')]).toEqual(['true', 'false']);
    // keyboard at the bound: + stays focusable and focused (native disabled would drop focus)
    await page.focus('#lamp .plus');
    for (let i = 0; i < 3; i++) await page.keyboard.press('Enter');
    expect(await page.inputValue('#lamp .count')).toBe('10');
    expect(await page.evaluate(() => document.activeElement!.matches('#lamp .plus'))).toBe(true);
    // color by keyboard (arrow keys move within the radio group), gift by click
    await page.focus('#lamp input[value=black]');
    await page.keyboard.press('ArrowDown');
    await page.click('#lamp .gift input');
    await frames(page);
    expect(await total(page, 'lamp')).toBe('$595.00'); // (49 + 10) * 10 + 5
    // typing a value outside 1–10: native :invalid, total uses the clamped quantity
    await page.fill('#lamp .count', '50');
    await frames(page);
    expect(await page.$eval('#lamp .count', (e) => (e as HTMLInputElement).matches(':invalid'))).toBe(true);
    expect(await total(page, 'lamp')).toBe('$595.00');
    expect(await page.getAttribute('#lamp .plus', 'aria-disabled')).toBe('true'); // 50 >= 10
    // the other card did not change
    expect(await total(page, 'mug')).toBe('$49.00');
    // lower bound
    await page.click('#lamp button[type=reset]');
    await frames(page, 3);
    expect(await page.inputValue('#lamp .count')).toBe('1');
    expect(await page.isChecked('#lamp input[value=black]')).toBe(true);
    expect(await page.isChecked('#lamp .gift input')).toBe(false);
    await expect.poll(() => total(page, 'lamp')).toBe('$49.00'); // bind: applies the native reset after the event
    expect(await page.getAttribute('#lamp .minus', 'aria-disabled')).toBe('true'); // back at 1
    // twelve clicks in one task stop at the bound
    await page.$eval('#lamp .plus', (b) => { for (let i = 0; i < 12; i++) (b as HTMLElement).click(); });
    await frames(page);
    expect(await page.inputValue('#lamp .count')).toBe('10');
    expect(await total(page, 'lamp')).toBe('$490.00');
    expect(await page.$eval('#lamp .dollars', (e) => [...e.childNodes].map((n) => n.nodeType))).toEqual([3]); // one text node
    await finish(page, problems);
  });
});

test.describe('multi-step wizard', () => {
  const step = (page: Page, id: string) => page.$eval(`#${id}`, (w) => [...w.querySelectorAll(':scope > .panels > .panel')].findIndex((p) => getComputedStyle(p).display !== 'none') + 1);

  const disabled = (page: Page, sel: string) => page.$eval(sel, (b) => (b as HTMLButtonElement).disabled);
  const current = (page: Page, id: string) => page.$$eval(`#${id} > .steps > li`, (ls) => ls.map((l) => l.getAttribute('aria-current')));

  test('Next, Back, validation gate, Finish and restart; disabled bounds and aria-current', async ({ page }) => {
    const problems = await visit(page, 'multi-step-wizard');
    expect(await step(page, 'setup')).toBe(1);
    expect(await disabled(page, '#setup .back')).toBe(true); // 0.5.3: rendered, natively disabled
    expect(await current(page, 'setup')).toEqual(['step', null, null, null]);
    expect(await page.textContent('#setup > .status')).toBe('Step 1 of 4');
    await page.focus('#setup .next');
    await page.keyboard.press('Enter'); // keyboard
    await frames(page);
    expect(await step(page, 'setup')).toBe(2);
    expect(await current(page, 'setup')).toEqual([null, 'step', null, null]); // same task as the key press
    // 0.6.0: focus moved to the new step's heading (focus:)
    expect(await page.evaluate(() => document.activeElement!.matches('#setup > .panels > .panel:nth-child(2) > h2'))).toBe(true);
    expect(await disabled(page, '#setup .back')).toBe(false);
    // required field empty: Next does not advance, the hint appears
    await page.click('#setup .next');
    await frames(page);
    expect(await step(page, 'setup')).toBe(2);
    expect(await shown(page, '#setup .hint')).toBe(true);
    await page.fill('#setup input[name=workspace]', 'Acme');
    await frames(page);
    expect(await shown(page, '#setup .hint')).toBe(false);
    await page.click('#setup .next');
    await frames(page);
    expect(await step(page, 'setup')).toBe(3);
    await page.click('#setup .back');
    await frames(page);
    expect(await step(page, 'setup')).toBe(2);
    expect(await page.inputValue('#setup input[name=workspace]')).toBe('Acme'); // panels keep their DOM
    await page.click('#setup .next'); await frames(page);
    await page.click('#setup .next'); await frames(page);
    expect(await step(page, 'setup')).toBe(4);
    expect([await disabled(page, '#setup .next'), await shown(page, '#setup .finish'), await disabled(page, '#setup .finish')]).toEqual([true, true, false]);
    expect(await current(page, 'setup')).toEqual([null, null, null, 'step']);
    await page.click('#setup .finish');
    await frames(page);
    expect(await step(page, 'setup')).toBe(5);
    expect(await shown(page, '#setup .nav')).toBe(false);
    expect(await css(page, '#setup .progress span', 'width')).not.toBe('0px');
    expect(await shown(page, '#setup > .done')).toBe(true);
    await page.click('#setup .restart');
    await frames(page);
    expect(await step(page, 'setup')).toBe(1);
    expect(await page.textContent('#setup > .status')).toBe('Step 1 of 4');
    expect(await step(page, 'second')).toBe(1); // untouched
    // rapid clicks in one task never leave steps 1–4 (Finish only from step 4)
    await page.$eval('#second input[name=display]', (i) => { (i as HTMLInputElement).value = 'Ada'; }); // on a hidden step: set, not typed
    const seen = await page.$eval('#second', (w) => {
      const b = (c: string) => w.querySelector<HTMLElement>(`:scope > .nav > .${c}`)!;
      for (let i = 0; i < 9; i++) b('next').click();
      b('finish').click(); // allowed: the logical step is 4 (still hidden until the frame)
      return 1;
    });
    await frames(page);
    expect(seen).toBe(1);
    expect(await step(page, 'second')).toBe(5);
    await page.click('#second .restart'); await frames(page);
    await page.$eval('#second', (w) => { for (let i = 0; i < 9; i++) w.querySelector<HTMLElement>(':scope > .nav > .back')!.click(); w.querySelector<HTMLElement>(':scope > .nav > .finish')!.click(); });
    await frames(page);
    expect(await step(page, 'second')).toBe(1); // Back is disabled at 1, Finish before step 4
    expect(await current(page, 'second')).toEqual(['step', null, null, null]);
    await finish(page, problems);
  });

  test('hidden panels are not in the tab order', async ({ page }) => {
    await visit(page, 'multi-step-wizard');
    const focused: string[] = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      focused.push(await page.evaluate(() => { const a = document.activeElement!; const p = a.closest('.panel'); return p ? String(getComputedStyle(p).display !== 'none') : 'outside'; }));
    }
    expect(focused).not.toContain('false');
  });

  test('a wizard nested in another wizard\'s panel is independent', async ({ page }) => {
    await visit(page, 'multi-step-wizard');
    await page.evaluate(() => {
      const inner = document.getElementById('second')!;
      inner.remove();
      document.querySelector('#setup .panel')!.append(inner); // inside step 1 of the outer wizard
    });
    await frames(page, 3);
    await page.click('#second > .nav > .next');
    await frames(page);
    expect(await step(page, 'second')).toBe(2);
    expect(await step(page, 'setup')).toBe(1);
    // The outer validation gate (:has(... :invalid)) also sees the inner wizard's empty required
    // field, as native constraint validation would: complete it first.
    await page.fill('#second input[name=display]', 'Ada');
    await page.click('#setup > .nav > .next'); // child selectors: #setup now contains the inner wizard
    await frames(page);
    expect(await step(page, 'setup')).toBe(2);
    expect(await step(page, 'second')).toBe(2);
  });
});

test.describe('interactive quiz', () => {
  const card = (page: Page) => page.$eval('.quiz', (q) => [...q.querySelectorAll('.card')].findIndex((c) => getComputedStyle(c).display !== 'none') + 1);
  const score = (page: Page) => page.textContent('.quiz .scoreline .sc');

  test('answering, first answer counts, verdicts, Next, result and restart', async ({ page }) => {
    const problems = await visit(page, 'interactive-quiz');
    await page.click('.quiz .next'); // not answered yet
    await frames(page);
    expect(await card(page)).toBe(1);
    expect(await shown(page, '.quiz .nudge')).toBe(true);
    // Q1 correct (keyboard)
    await page.focus('.q1 .opt.correct');
    await page.keyboard.press('Enter');
    await frames(page);
    expect(await page.textContent('.q1 .verdict')).toBe('Correct!');
    expect(await shown(page, '.q1 .explain')).toBe(true);
    // 0.5.3: answered options are natively disabled; the chosen one is pressed
    expect(await page.$$eval('.q1 .opt', (os) => os.map((o) => [(o as HTMLButtonElement).disabled, o.getAttribute('aria-pressed')])))
      .toEqual([[true, 'false'], [true, 'true'], [true, 'false']]);
    expect(await page.$$eval('.q2 .opt', (os) => os.map((o) => [(o as HTMLButtonElement).disabled, o.getAttribute('aria-pressed')])))
      .toEqual([[false, 'false'], [false, 'false'], [false, 'false']]);
    await page.$eval('.q1 .opt', (o) => (o as HTMLElement).click()); // a second answer is not dispatched
    expect(await score(page)).toBe('1');
    // 0.6.0: answering moved focus from the (now disabled) option to Next; Next moves it to the next heading
    expect(await page.evaluate(() => document.activeElement!.matches('.quiz .next'))).toBe(true);
    await page.keyboard.press('Enter');
    await frames(page);
    expect(await page.evaluate(() => document.activeElement!.matches('.q2 > h2'))).toBe(true);
    // Q2 wrong
    await page.click('.q2 .opt >> nth=0');
    await frames(page);
    expect(await page.textContent('.q2 .verdict')).toBe('Not quite.');
    expect(await css(page, '.q2 .opt.correct', 'background-color')).toBe('rgb(220, 252, 231)'); // the right answer is shown
    expect(await css(page, '.q2 .opt >> nth=0'.replace(' >> nth=0', ':first-child'), 'background-color')).toBe('rgb(254, 243, 242)');
    await page.click('.quiz .next'); await frames(page);
    await page.click('.q3 .opt.correct'); await frames(page);
    await page.click('.quiz .next'); await frames(page);
    expect(await card(page)).toBe(4);
    expect(await page.textContent('.result .final')).toBe('You scored 2 of 3.');
    expect(await page.textContent('.result .praise')).toBe('Review the explanations and try again.');
    await page.click('.quiz .restart');
    await frames(page);
    expect([await card(page), await score(page)]).toEqual([1, '0']);
    expect(await page.evaluate(() => document.activeElement!.matches('.q1 > h2'))).toBe(true); // 0.6.0: restart focuses the first heading
    expect(await shown(page, '.q1 .explain')).toBe(false);
    expect(await page.$$eval('.question .opt', (os) => os.every((o) => !(o as HTMLButtonElement).disabled && o.getAttribute('aria-pressed') === 'false'))).toBe(true);
    // a perfect run
    for (const q of [1, 2, 3]) {
      await page.click(`.q${q} .opt.correct`); await frames(page);
      await page.click('.quiz .next'); await frames(page);
    }
    expect(await page.textContent('.result .praise')).toBe('Perfect score!');
    // a triple answer in one task and a real double click score once
    await page.click('.quiz .restart'); await frames(page);
    await page.$eval('.q1 .opt.correct', (b) => { for (let i = 0; i < 3; i++) (b as HTMLElement).click(); });
    expect(await score(page)).toBe('1');
    await page.click('.quiz .next');
    await page.dblclick('.q2 .opt.correct');
    expect(await score(page)).toBe('2');
    await finish(page, problems);
  });
});

test.describe('live form preview', () => {
  const preview = (page: Page) => page.$$eval('.card p', (ps) => ps.map((p) => p.textContent)); // real DOM text (text:)

  test('every control updates the preview; native reset restores controls and states; nothing is stored', async ({ page }) => {
    const problems = await visit(page, 'live-form-preview');
    expect(await preview(page)).toEqual(['Ada', 'Developer', 'Accent: teal', 'Notifications: on']);
    await page.fill('input[name=display_name]', '');
    await page.keyboard.type('Grace');
    await page.selectOption('select[name=role]', 'Designer');
    await page.focus('input[value=teal]');
    await page.keyboard.press('ArrowDown'); // radio group by keyboard
    await page.focus('input[name=notifications]');
    await page.keyboard.press('Space');
    await frames(page);
    expect(await preview(page)).toEqual(['Grace', 'Designer', 'Accent: violet', 'Notifications: off']);
    expect(await css(page, '.avatar', 'background-color')).toBe('rgb(109, 40, 217)');
    expect(await page.getAttribute('#profile', 'data-accent')).toBe('violet'); // 0.5.2: bound data attribute
    const data = () => page.$eval('.card', (c) => [c.getAttribute('data-name'), c.getAttribute('data-role'), c.getAttribute('data-notify')]);
    expect(await data()).toEqual(['Grace', 'Designer', 'off']); // 0.5.3: derived data attributes
    await page.fill('input[name=display_name]', '');
    await frames(page);
    expect((await preview(page))[0]).toBe('(no name yet)');
    expect(await data()).toEqual(['', 'Designer', 'off']); // an empty value is present and empty
    await page.click('button[type=reset]');
    await frames(page, 3);
    expect(await page.inputValue('input[name=display_name]')).toBe('Ada');
    expect(await page.isChecked('input[value=teal]')).toBe(true);
    expect(await page.getAttribute('#profile', 'data-accent')).toBe('teal');
    expect(await preview(page)).toEqual(['Ada', 'Developer', 'Accent: teal', 'Notifications: on']);
    expect(await data()).toEqual(['Ada', 'Developer', 'on']);
    // Enter in the text field does not submit (the only submit button is disabled)
    await page.press('input[name=display_name]', 'Enter');
    expect(page.url()).toMatch(/live-form-preview\/$/);
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, '']);
    await finish(page, problems);
  });
});

test.describe('score history', () => {
  const board = (page: Page, id: string) => page.$eval(`#${id}`, (b) => ['.current', '.prev', '.delta', '.direction'].map((c) => b.querySelector(c)!.textContent));

  test('current, previous, change and direction; rapid clicks; reset; independent boards', async ({ page }) => {
    const problems = await visit(page, 'score-history');
    expect([await shown(page, '#home .nochange'), await shown(page, '#home .history')]).toEqual([true, false]);
    await page.click('#home .up');
    await frames(page);
    expect(await board(page, 'home')).toEqual(['1', '0', '1', '▲ up']);
    expect([await shown(page, '#home .nochange'), await shown(page, '#home .history')]).toEqual([false, true]);
    for (let i = 0; i < 15; i++) await page.click('#home .up', { delay: 0 }); // as fast as input goes
    await frames(page);
    expect((await board(page, 'home'))[0]).toBe('16'); // no change lost
    await page.focus('#home .down');
    await page.keyboard.press('Enter');
    await frames(page);
    expect(await board(page, 'home')).toEqual(['15', '16', '-1', '▼ down']);
    await page.click('#home .reset');
    await frames(page);
    expect(await board(page, 'home')).toEqual(['0', '15', '-15', '▼ down']); // Reset is a change
    // 0.5.3: Reset is disabled at 0; the board reports the direction
    expect(await page.$eval('#home .reset', (b) => (b as HTMLButtonElement).disabled)).toBe(true);
    expect(await page.getAttribute('#home', 'data-direction')).toBe('down');
    expect(await page.getAttribute('#away', 'data-direction')).toBe('none');
    expect((await board(page, 'away'))[0]).toBe('0');
    // 0.5.1: 20 clicks in one task: all counted; previous is the value before the last one
    await page.$eval('#away .up', (b) => { for (let i = 0; i < 20; i++) (b as HTMLElement).click(); });
    await frames(page);
    expect(await board(page, 'away')).toEqual(['20', '19', '1', '▲ up']);
    expect(await page.getAttribute('#away', 'data-direction')).toBe('up');
    expect(await page.$eval('#away .reset', (b) => (b as HTMLButtonElement).disabled)).toBe(false);
    await finish(page, problems);
  });

  test(':changed() animates each change; prefers-reduced-motion turns the animation off', async ({ page }) => {
    await visit(page, 'score-history');
    await page.click('#home .up');
    await expect.poll(() => page.$eval('#home .current', (e) => e.getAnimations().length)).toBe(1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.click('#away .up');
    await frames(page, 3);
    expect(await page.$eval('#away .current', (e) => e.getAnimations().length)).toBe(0);
    expect((await board(page, 'away'))[0]).toBe('1'); // state still changes
  });
});

test.describe('accessible toggle (0.5.2)', () => {
  test('aria-pressed and aria-expanded are real attributes: markup initializes, mouse and keyboard toggle', async ({ page }) => {
    const problems = await visit(page, 'accessible-toggle');
    const t = page.locator('.toggle');
    expect([await t.nth(0).getAttribute('aria-pressed'), await t.nth(1).getAttribute('aria-pressed')]).toEqual(['false', 'true']);
    await t.nth(0).click();
    expect(await t.nth(0).getAttribute('aria-pressed')).toBe('true');
    await t.nth(1).focus();
    await page.keyboard.press('Space');
    expect(await t.nth(1).getAttribute('aria-pressed')).toBe('false');
    expect(await page.locator('.demo').first().ariaSnapshot()).toMatch(/button "Notifications" \[pressed\]/);
    expect(await shown(page, '.panel')).toBe(false);
    await page.focus('.disclosure');
    await page.keyboard.press('Enter');
    expect(await page.getAttribute('.disclosure', 'aria-expanded')).toBe('true');
    await expect.poll(() => shown(page, '.panel')).toBe(true);
    expect(await page.locator('.demo').nth(1).ariaSnapshot()).toMatch(/button "Shipping details" \[expanded\]/);
    await finish(page, problems);
  });
});

// ---- 0.5.3 examples: derived attributes (attr:) ----------------------------------------------------

const prop = (page: Page, sel: string, name: string) => page.$eval(sel, (e, n) => (e as any)[n], name);
const attrOf = (page: Page, sel: string, name: string) => page.getAttribute(sel, name);
const realClicks = async (page: Page, sel: string, n: number) => {
  const box = (await page.locator(sel).boundingBox())!;
  for (let i = 0; i < n; i++) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

test.describe('settings panel (0.5.3)', () => {
  test('master switch disables the channels fieldset; disclosure; theme and size; reset', async ({ page }) => {
    const problems = await visit(page, 'settings-panel');
    expect(await prop(page, '.channels', 'disabled')).toBe(false);
    expect([await attrOf(page, '.more', 'aria-expanded'), await prop(page, '.advanced', 'hidden')]).toEqual(['false', true]);
    await page.click('.master input');
    expect(await prop(page, '.channels', 'disabled')).toBe(true); // same task as the change
    expect(await page.$eval('input[name=email]', (i) => i.matches(':disabled'))).toBe(true); // inherited from the fieldset
    // Tab skips the disabled group: from the master checkbox straight to the theme select
    await page.focus('.master input');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => (document.activeElement as HTMLSelectElement).name)).toBe('theme');
    await page.focus('.more');
    await page.keyboard.press('Enter');
    expect([await attrOf(page, '.more', 'aria-expanded'), await prop(page, '.advanced', 'hidden')]).toEqual(['true', false]);
    await page.selectOption('select[name=theme]', 'dark');
    await page.$eval('input[name=size]', (i: HTMLInputElement) => { i.value = '20'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    await frames(page);
    expect(await attrOf(page, '.preview', 'data-theme')).toBe('dark');
    expect(await css(page, '.preview', 'font-size')).toBe('20px');
    expect(await page.textContent('.size')).toBe('20');
    await page.click('button[type=reset]');
    await frames(page, 3);
    expect(await prop(page, '.channels', 'disabled')).toBe(false);
    expect([await attrOf(page, '.more', 'aria-expanded'), await prop(page, '.advanced', 'hidden')]).toEqual(['false', true]);
    await expect.poll(() => attrOf(page, '.preview', 'data-theme')).toBe('light');
    expect(await page.textContent('.size')).toBe('16');
    await finish(page, problems);
  });
});

test.describe('accessible tabs (0.5.3)', () => {
  const selected = (page: Page, id: string) => page.$$eval(`#${id} [role=tab]`, (ts) => ts.map((t) => t.getAttribute('aria-selected')));
  const visible = (page: Page, id: string) => page.$$eval(`#${id} [role=tabpanel]`, (ps) => ps.map((p) => !(p as HTMLElement).hidden));

  test('aria-selected, hidden panels, static and derived disabled tabs, keyboard, independent sets', async ({ page, browserName }) => {
    const problems = await visit(page, 'accessible-tabs');
    expect(await selected(page, 'account')).toEqual(['true', 'false', 'false', 'false']);
    expect(await visible(page, 'account')).toEqual([true, false, false, false]);
    expect([await prop(page, '#t-billing', 'disabled'), await prop(page, '#t-team', 'disabled')]).toEqual([true, true]);
    await page.click('#t-security');
    expect(await selected(page, 'account')).toEqual(['false', 'true', 'false', 'false']);
    expect(await visible(page, 'account')).toEqual([false, true, false, false]);
    await page.focus('#t-profile');
    await page.keyboard.press('Enter');
    expect(await visible(page, 'account')).toEqual([true, false, false, false]);
    if (browserName === 'chromium') { // WebKit's default Tab order skips buttons (macOS keyboard setting)
      await page.keyboard.press('Tab'); // 0.6.0 roving tabindex: only the selected tab is in the Tab order; next is its panel
      expect(await page.evaluate(() => document.activeElement!.id)).toBe('p-profile');
    }
    await page.check('#p-profile .has-billing');
    expect(await prop(page, '#t-billing', 'disabled')).toBe(false);
    await page.click('#t-billing');
    expect(await visible(page, 'account')).toEqual([false, false, true, false]);
    expect(await selected(page, 'docs')).toEqual(['true', 'false']); // the other set is untouched
    // rapid clicks across tabs in one task: exactly one panel visible, the last one
    await page.$eval('#account', (w) => { for (const id of ['t-profile', 't-security', 't-billing', 't-security']) (w.querySelector('#' + id) as HTMLElement).click(); });
    expect(await visible(page, 'account')).toEqual([false, true, false, false]);
    await finish(page, problems);
  });

  test('0.6.0 keyboard: arrows, Home, End move selection and focus; roving tabindex; disabled tabs skipped', async ({ page, browserName }) => {
    const problems = await visit(page, 'accessible-tabs');
    const focused = () => page.evaluate(() => document.activeElement!.id);
    const tabindex = (id: string) => page.$$eval(`#${id} [role=tab]`, (ts) => ts.map((t) => t.getAttribute('tabindex')));
    expect(await tabindex('account')).toEqual(['0', '-1', '-1', '-1']);
    await page.focus('#t-profile');
    await page.keyboard.press('ArrowRight');
    expect([await focused(), await selected(page, 'account')]).toEqual(['t-security', ['false', 'true', 'false', 'false']]);
    expect(await tabindex('account')).toEqual(['-1', '0', '-1', '-1']);
    await page.keyboard.press('ArrowRight'); // Billing (disabled) and Team skipped: wraps to Profile
    expect(await focused()).toBe('t-profile');
    await page.keyboard.press('ArrowLeft');
    expect(await focused()).toBe('t-security');
    await page.keyboard.press('Home');
    expect(await focused()).toBe('t-profile');
    if (browserName === 'chromium') { // WebKit's default Tab order skips buttons (macOS keyboard setting)
      await page.keyboard.press('Tab'); // only the selected tab is in the Tab order: next is its panel
      expect(await focused()).toBe('p-profile');
      await page.keyboard.press('Shift+Tab');
      expect(await focused()).toBe('t-profile');
    }
    await page.check('#p-profile .has-billing');
    await page.focus('#t-profile');
    await page.keyboard.press('End'); // Billing is in the arrow order now
    expect([await focused(), await visible(page, 'account')]).toEqual(['t-billing', [false, false, true, false]]);
    await page.keyboard.press('ArrowRight');
    expect(await focused()).toBe('t-profile');
    expect(await selected(page, 'docs')).toEqual(['true', 'false']);
    await finish(page, problems);
  });
});

test.describe('shopping cart (0.5.3)', () => {
  const totals = (page: Page) => page.$eval('.cart', (c) => [c.querySelector('.items')!.textContent, c.querySelector('.total')!.textContent]);

  test('quantities, bounds, subtotals, totals, remove, empty cart', async ({ page }) => {
    const problems = await visit(page, 'shopping-cart');
    expect(await totals(page)).toEqual(['3', '28']);
    expect([await prop(page, '.l2 .minus', 'disabled'), await prop(page, '.l2 .remove', 'disabled'), await prop(page, '.checkout', 'disabled')]).toEqual([true, true, false]);
    await page.click('.l2 .plus');
    await frames(page);
    expect(await totals(page)).toEqual(['4', '58']);
    expect(await page.textContent('.l2 .sub')).toBe('$30');
    expect(await prop(page, '.l2 .minus', 'disabled')).toBe(false);
    await realClicks(page, '.l1 .plus', 12); // rapid: stops at 9
    expect(await page.textContent('.l1 .qty')).toBe('9');
    expect(await prop(page, '.l1 .plus', 'disabled')).toBe(true);
    await page.click('.l3 .remove');
    await frames(page);
    expect(await attrOf(page, '.l3', 'data-empty')).toBe('true');
    expect(await totals(page)).toEqual(['10', '138']);
    await page.focus('.clear');
    await page.keyboard.press('Enter');
    await frames(page);
    expect(await totals(page)).toEqual(['0', '0']);
    expect([await prop(page, '.checkout', 'disabled'), await prop(page, '.clear', 'disabled'), await prop(page, '.empty', 'hidden')]).toEqual([true, true, false]);
    await finish(page, problems);
  });
});

test.describe('notification center (0.5.3)', () => {
  test('disclosure, read toggles, dismiss, one-step undo, dismiss all, unread count', async ({ page }) => {
    const problems = await visit(page, 'notification-center');
    const unread = () => page.textContent('.count .n');
    expect([await attrOf(page, '.toggle', 'aria-expanded'), await prop(page, '.body', 'hidden'), await unread()]).toEqual(['true', false, '3']);
    expect(await prop(page, '.undo', 'disabled')).toBe(true);
    await page.click('.n1 .read');
    await frames(page);
    expect([await attrOf(page, '.n1 .read', 'aria-pressed'), await attrOf(page, '.n1', 'data-read'), await unread()]).toEqual(['true', '1', '2']);
    await page.dblclick('.n2 .read'); // twice: back to unread
    expect(await attrOf(page, '.n2 .read', 'aria-pressed')).toBe('false');
    await page.click('.n2 .dismiss');
    await page.click('.n3 .dismiss');
    expect([await prop(page, '.n2', 'hidden'), await prop(page, '.n3', 'hidden')]).toEqual([true, true]);
    await page.click('.undo'); // only the last one comes back
    expect([await prop(page, '.n2', 'hidden'), await prop(page, '.n3', 'hidden'), await prop(page, '.undo', 'disabled')]).toEqual([true, false, true]);
    await frames(page);
    expect(await unread()).toBe('1');
    await page.click('.dismiss-all');
    await frames(page);
    expect([await prop(page, '.empty', 'hidden'), await prop(page, '.dismiss-all', 'disabled'), await unread()]).toEqual([false, true, '0']);
    await page.focus('.toggle');
    await page.keyboard.press('Space');
    expect([await attrOf(page, '.toggle', 'aria-expanded'), await prop(page, '.body', 'hidden')]).toEqual(['false', true]);
    await finish(page, problems);
  });
});

test.describe('form validation (0.5.3)', () => {
  test('derived required and hidden for business accounts; submit disabled until terms; native messages; nothing sent', async ({ page }) => {
    const problems = await visit(page, 'form-validation');
    expect([await prop(page, '.company', 'hidden'), await prop(page, '#f-company', 'required'), await prop(page, 'button[type=submit]', 'disabled')]).toEqual([true, false, true]);
    await page.check('.terms input');
    expect(await prop(page, 'button[type=submit]', 'disabled')).toBe(false);
    await page.click('button[type=submit]'); // invalid: native validation blocks, messages appear
    await frames(page);
    expect(await shown(page, '#e-name')).toBe(true);
    expect(await page.evaluate(() => document.activeElement!.id)).toBe('f-name'); // the browser focuses the first invalid field
    await page.fill('#f-name', 'Ada');
    await page.fill('#f-email', 'ada@example.com');
    await page.fill('#f-password', 'correct horse');
    await page.check('input[value=business]');
    expect([await prop(page, '.company', 'hidden'), await prop(page, '#f-company', 'required')]).toEqual([false, true]);
    await frames(page);
    expect(await page.textContent('.kind')).toBe('Business');
    expect(await page.$eval('.signup', (f) => (f as HTMLFormElement).checkValidity())).toBe(false); // company is required now
    await page.check('input[value=personal]');
    expect(await page.$eval('.signup', (f) => (f as HTMLFormElement).checkValidity())).toBe(true);
    await page.click('button[type=submit]');
    await frames(page);
    expect(await shown(page, '.ok')).toBe(true);
    expect(page.url()).toMatch(/form-validation\/$/); // method="dialog": nothing navigated
    await finish(page, problems);
  });
});

test.describe('keyboard playground (0.5.3)', () => {
  test('key() movement, focusin/focusout, nested regions, reset', async ({ page }) => {
    const problems = await visit(page, 'keyboard-playground');
    expect(await prop(page, '.reset', 'disabled')).toBe(true);
    await page.focus('.pad');
    expect(await attrOf(page, '.pad', 'data-focused')).toBe('1');
    for (const k of ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft']) await page.keyboard.press(k);
    expect([await attrOf(page, '.pad', 'data-x'), await attrOf(page, '.pad', 'data-y')]).toEqual(['1', '1']);
    await frames(page);
    expect(await page.textContent('.last')).toBe('ArrowLeft');
    expect(await page.textContent('.focus-text')).toBe('pad focused');
    await page.keyboard.press('Escape');
    expect(await attrOf(page, '.pad', 'data-x')).toBe('0');
    await page.focus('.target');
    expect(await attrOf(page, '.pad', 'data-focused')).toBe('0');
    await page.keyboard.press('Enter');
    await page.focus('.outer-target');
    await page.keyboard.press('Enter');
    await frames(page);
    expect([await page.textContent('.inner-n'), await page.textContent('.outer-n')]).toEqual(['1', '2']);
    expect(await prop(page, '.reset', 'disabled')).toBe(false);
    await page.click('.reset');
    await frames(page);
    expect([await page.textContent('.inner-n'), await page.textContent('.outer-n'), await page.textContent('.last')]).toEqual(['0', '0', 'none']);
    expect(await prop(page, '.reset', 'disabled')).toBe(true);
    await finish(page, problems);
  });
});

test.describe('demo lab (0.5.3)', () => {
  test('lists every example, loads each one cleanly, shows its source; diagnostics log attribute writes', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/examples/lab/');
    const names = await page.$$eval('.examples li', (ls) => ls.map((l) => (l as HTMLElement).dataset.name!));
    expect(names).toHaveLength(20); // 12 + the eight 0.7.1 validation examples
    const frame = page.frameLocator('.frame');
    for (const name of names) {
      // A click reloads the frame, even for the example shown on load (the first one): mark the
      // current document so the wait below cannot match it just before it is replaced (Firefox).
      await page.waitForFunction(() => { const w = (document.querySelector('.frame') as HTMLIFrameElement).contentWindow as any; return w?.ReactiveCSS && (w.__shown = true); });
      await page.click(`.examples li[data-name="${name}"] a`);
      await expect(page.locator('.frame')).toHaveAttribute('src', `../${name}/`);
      await page.waitForFunction((n) => {
        const w = (document.querySelector('.frame') as HTMLIFrameElement).contentWindow as any;
        return !w?.__shown && w?.location.pathname === `/examples/${n}/` && w.document.readyState === 'complete' && w.ReactiveCSS?.stats().sheets >= 1;
      }, name);
      expect(await page.$eval('.frame', (f) => ((f as HTMLIFrameElement).contentWindow as any).ReactiveCSS.diagnostics), name).toEqual([]);
      await expect(page.locator('.source')).toContainText('## 8. Manual test checklist');
    }
    await page.click('.examples li[data-name="product-configurator"] a');
    await page.waitForFunction(() => ((document.querySelector('.frame') as HTMLIFrameElement).contentWindow as any)?.ReactiveCSS?.stats().sheets >= 1);
    await page.check('.diag-toggle');
    await frame.locator('#lamp .minus').isDisabled();
    await frame.locator('#lamp .plus').click();
    await expect(page.locator('.log')).toContainText('button.minus aria-disabled = "false"');
    await page.click('.sources [role=tab][data-file="style.css"]');
    await expect(page.locator('.source')).toContainText('attr: aria-disabled when(--qty >= 10)');
    expect(errors).toEqual([]);
  });
});

// ---- 0.7.0: prevent() in the demos, on pages that really scroll (small viewport) -------------------

test.describe('prevent() in the demos (0.7.0)', () => {
  const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
  const settle = (page: Page) => page.waitForTimeout(600);

  test('tabs: handled keys select without scrolling; an unhandled key still scrolls', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 360, height: 260 });
    const problems = await visit(page, 'accessible-tabs');
    expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.focus('#t-profile');
    await settle(page); // with Linux fonts the tabs start below the fold: WebKit scrolls the focused tab into view asynchronously
    const y0 = await scrollY(page);
    await page.keyboard.press('End'); // End and Home scroll natively in both engines
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await settle(page);
    expect(await page.evaluate(() => document.activeElement!.id)).toBe('t-security');
    expect(await scrollY(page)).toBe(y0);
    if (browserName === 'chromium') { // headless WebKit never scrolls on arrow keys
      await page.keyboard.press('ArrowLeft');
      await settle(page);
      expect(await scrollY(page)).toBe(y0);
    }
    await page.keyboard.press('PageDown'); // not handled by the tabs: native scrolling
    await settle(page);
    expect(await scrollY(page)).toBeGreaterThan(y0);
    await finish(page, problems);
  });

  test('keyboard playground: arrow keys move the dot without scrolling; Space still scrolls', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 360, height: 300 });
    const problems = await visit(page, 'keyboard-playground');
    await page.evaluate(() => { document.addEventListener('keydown', (e) => ((window as any).__last = e.defaultPrevented)); });
    await page.focus('.pad');
    const y0 = await scrollY(page);
    for (const k of ['ArrowDown', 'ArrowDown', 'ArrowRight']) await page.keyboard.press(k);
    expect(await page.evaluate(() => (window as any).__last)).toBe(true);
    await settle(page);
    if (browserName === 'chromium') expect(await scrollY(page)).toBe(y0);
    expect([await page.getAttribute('.pad', 'data-x'), await page.getAttribute('.pad', 'data-y')]).toEqual(['1', '2']);
    await page.keyboard.press('Space'); // not handled: native
    expect(await page.evaluate(() => (window as any).__last)).toBe(false);
    await settle(page);
    expect(await scrollY(page)).toBeGreaterThan(y0);
    await finish(page, problems);
  });
});
