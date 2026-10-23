// 0.7.1 validation examples (examples/<name>/), real input under a strict CSP, real DOM assertions.
import { test, expect, type Page } from '@playwright/test';
import { visit, finish, frames, active, scrollY, diagnostics } from './example-helpers';

const attr = (page: Page, sel: string, name: string) => page.getAttribute(sel, name);
const prop = (page: Page, sel: string, name: string) => page.$eval(sel, (e, n) => (e as any)[n], name);
const settle = (page: Page) => page.waitForTimeout(600); // native smooth scrolling

test.describe('A. focus transitions', () => {
  test('user-initiated focus, rapid changes, hidden and disabled targets, the popover keeps focus', async ({ page, browserName }) => {
    const problems = await visit(page, 'focus-transitions');
    expect(await active(page)).toBe('body'); // never on load
    await page.click('.tabs .go2');
    await frames(page);
    expect(await active(page)).toBe('h2');
    await page.click('.more'); // reveal + focus in one action
    await frames(page);
    expect([await active(page), await prop(page, '#extra', 'hidden'), await attr(page, '.more', 'aria-expanded')]).toEqual(['h-extra', false, 'true']);
    await page.click('.tabs .go1');
    const box = (await page.locator('.next').boundingBox())!;
    await page.mouse.click(box.x + 5, box.y + 5); await page.mouse.click(box.x + 5, box.y + 5); // rapid: 1 → 3
    await frames(page, 3);
    expect(await active(page)).toBe('confirm'); // panel 3 focuses Confirm
    // a disabled target: focus stays where it is (deliberately unchanged)
    await page.check('.p3 .lock');
    expect(await prop(page, '#confirm', 'disabled')).toBe(true);
    await page.click('.tabs .go1'); await frames(page);
    await page.click('.tabs .go3'); await frames(page);
    expect(await active(page)).not.toBe('confirm');
    // A disabled target is reported as a note (diagnostics, not a console warning), by design.
    expect(await diagnostics(page)).toEqual(['focus: button#confirm.confirm is disabled; focus is unchanged.']);
    // the native popover manages its own focus: a change made inside it does not move focus out
    await page.uncheck('.p3 .lock');
    await page.click('.open-jump');
    await page.click('#jump1');
    await frames(page);
    // Focus is not moved out of the popover: Chromium focuses the clicked button, WebKit on macOS
    // focuses nothing on click (<body>), WebKit on Linux the button. Never the panel heading behind it.
    expect(browserName === 'webkit' ? ['body', 'jump1'] : ['jump1']).toContain(await active(page));
    expect(await page.textContent('.status .n')).toBe('1');
    // keyboard: Enter on Next focuses the next panel's heading
    await page.keyboard.press('Escape'); // closes the popover natively
    await page.focus('.next');
    await page.keyboard.press('Enter');
    await frames(page);
    expect(await active(page)).toBe('h2');
    await finish(page, problems, [/focus: button#confirm\.confirm is disabled/]);
  });

  test('typing in a field, then a change that does not affect focus targets, keeps focus in the field', async ({ page }) => {
    const problems = await visit(page, 'focus-transitions');
    await page.click('#field');
    await page.keyboard.type('abc');
    await page.click('.tabs .go1'); // already panel 1: no transition, so focus: does nothing
    await frames(page);
    // Chromium focuses the clicked button natively, WebKit keeps the field: never the panel heading.
    expect(await active(page)).not.toBe('h1');
    expect(['go1', 'field', 'body']).toContain(await page.evaluate(() => document.activeElement!.id || (document.activeElement!.classList.contains('go1') ? 'go1' : document.activeElement!.localName)));
    await finish(page, problems);
  });
});

test.describe('B. keyboard navigation', () => {
  test('handled keys move selection and focus without scrolling; unhandled keys and the locked list scroll', async ({ page, browserName }) => {
    const problems = await visit(page, 'keyboard-navigation');
    const sel = () => page.$$eval('.opt', (os) => os.map((o) => `${o.getAttribute('aria-selected')}/${o.getAttribute('tabindex')}`));
    await page.focus('#o1');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => { document.addEventListener('keydown', (e) => ((window as any).__dp = e.defaultPrevented)); });
    for (const k of ['ArrowDown', 'ArrowDown', 'End', 'Home', 'ArrowUp']) await page.keyboard.press(k);
    await settle(page);
    expect(await active(page)).toBe('o6'); // Home → 1, ArrowUp wraps to 6
    expect((await sel())[5]).toBe('true/0');
    expect(await page.evaluate(() => (window as any).__dp)).toBe(true);
    expect(await scrollY(page)).toBe(0); // End/Home scroll natively in both engines; arrows in Chromium
    await page.keyboard.press('PageDown'); // not handled
    await settle(page);
    expect(await scrollY(page)).toBeGreaterThan(0);
    // conditional: locked → no rule → native behavior (End scrolls)
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.check('#lock');
    await page.focus('#o6');
    await page.keyboard.press('Home');
    await settle(page);
    expect(await page.evaluate(() => (window as any).__dp)).toBe(false);
    expect((await sel())[5]).toBe('true/0'); // selection unchanged
    if (browserName === 'chromium') expect(await scrollY(page)).toBe(0); // Home on a page already at the top
    await page.keyboard.press('End');
    await settle(page);
    expect(await scrollY(page)).toBeGreaterThan(0);
    await finish(page, problems);
  });

  test('nested region, Escape in the filter, the filter keeps its keys', async ({ page }) => {
    const problems = await visit(page, 'keyboard-navigation');
    await page.focus('#inner');
    for (const k of ['ArrowRight', 'ArrowRight', 'ArrowLeft']) await page.keyboard.press(k);
    await frames(page);
    expect(await page.textContent('#inner .q')).toBe('2'); // its own keys
    await page.keyboard.press('ArrowDown'); // not the region's key: reaches the list (bubbling), selection 1 → 2
    await frames(page);
    expect(await page.$$eval('.opt[aria-selected="true"]', (os) => os.map((o) => o.id))).toEqual(['o2']);
    await page.check('#lock');
    await page.focus('#filter');
    await page.$eval('#filter', (i: HTMLInputElement) => i.setSelectionRange(0, 0)); // engines place the caret differently on focus
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight'); // caret, not the list (End does not move the caret on macOS)
    expect(await page.$eval('#filter', (i: HTMLInputElement) => i.selectionStart)).toBe(3);
    await page.keyboard.press('Escape'); // the section's key: unlocks; focus stays in the field
    await frames(page);
    expect([await active(page), await prop(page, '#lock', 'checked')]).toEqual(['filter', false]);
    await page.keyboard.press('ArrowLeft'); // unlocked list, but the field is not inside it: still the caret
    expect(await page.$eval('#filter', (i: HTMLInputElement) => i.selectionStart)).toBe(2);
    await finish(page, problems);
  });
});

test.describe('C. attribute playground', () => {
  test('every derived attribute, disabled vs aria-disabled, the bound attribute and the live table', async ({ page }) => {
    const problems = await visit(page, 'attribute-playground');
    const cell = (c: string) => page.$eval(`.${c}`, (e) => getComputedStyle(e, '::after').content);
    expect([await attr(page, '#disclosure', 'aria-expanded'), await prop(page, '#region', 'hidden'), await attr(page, '#save', 'aria-disabled'),
      await attr(page, '#card', 'data-state'), await attr(page, '#item', 'tabindex'), await attr(page, '#bound', 'aria-expanded')])
      .toEqual(['false', true, 'false', 'idle', '-1', 'false']);
    expect(await cell('d-exp')).toBe('"\\"false\\""');
    await page.click('#t-open');
    expect([await attr(page, '#disclosure', 'aria-expanded'), await prop(page, '#region', 'hidden')]).toEqual(['true', false]);
    await page.click('#disclosure'); // the button itself toggles too
    expect(await attr(page, '#disclosure', 'aria-expanded')).toBe('false');
    // native disabled blocks; aria-disabled does not, the conditional rule does
    await page.check('#c-locked');
    await page.check('#c-busy');
    expect([await prop(page, '#submit', 'disabled'), await attr(page, '#save', 'aria-disabled')]).toEqual([true, 'true']);
    await page.$eval('#submit', (b) => (b as HTMLElement).click());
    await page.click('#save', { force: true }); // a real click: Playwright's own check treats aria-disabled as disabled
    await frames(page);
    expect([await page.textContent('.submits'), await page.textContent('.saves')]).toEqual(['0', '0']);
    await page.focus('#save');
    expect(await active(page)).toBe('save');
    await page.uncheck('#c-busy');
    await page.click('#save', { force: true });
    await frames(page);
    expect(await page.textContent('.saves')).toBe('1');
    await page.selectOption('#c-status', 'loading');
    await page.check('#c-selected');
    await page.click('#bound');
    await frames(page);
    expect([await attr(page, '#card', 'data-state'), await attr(page, '#item', 'tabindex'), await attr(page, '#bound', 'aria-expanded')]).toEqual(['loading', '0', 'true']);
    expect([await cell('d-state'), await cell('d-tab'), await cell('d-bound'), await cell('d-disabled')]).toEqual(['"\\"loading\\""', '"\\"0\\""', '"\\"true\\""', '"present"']);
    await finish(page, problems);
  });
});

test.describe('D. dynamic components', () => {
  test('mount, remove with pending work, move, reinsert, stylesheet insertion/removal, recompilation, cleanup', async ({ page }) => {
    const problems = await visit(page, 'dynamic-components');
    const h = async (name: string) => { await page.click(`[data-h="${name}"]`); await frames(page, 3); };
    const counts = () => page.$$eval('.counter', (cs) => cs.map((c) => `${c.id}:${c.querySelector('.n')!.textContent}:${(c.querySelector('.dec') as HTMLButtonElement).disabled}`));
    await page.click('#c1 .inc'); await page.click('#c1 .inc');
    await h('mount'); // inserted after initialization
    await page.click('#c3 .inc');
    await frames(page);
    expect(await counts()).toEqual(['c1:2:false', 'c2:0:true', 'c3:1:false']);
    await h('pending'); // + and removal of c1 in one task
    expect(await counts()).toEqual(['c2:0:true', 'c3:1:false']);
    await h('move');
    expect((await counts())[0]).toMatch(/^c3/);
    await h('reinsert'); // c1 comes back as new: its count starts over
    expect((await counts()).at(-1)).toBe('c1:0:true');
    await h('sheet'); // step 2
    await page.click('#c2 .inc');
    await frames(page);
    expect(await page.textContent('#c2 .n')).toBe('2');
    expect(await page.textContent('#c2 .label')).toBe('count (step 2)');
    await h('sheet'); // removed: back to step 1
    await page.click('#c2 .inc');
    await frames(page);
    expect([await page.textContent('#c2 .n'), await page.textContent('#c2 .label')]).toEqual(['3', 'count']);
    await h('recompile'); await h('recompile'); // labels-a, then swapped to labels-b
    await expect.poll(() => page.textContent('#c2 .label')).toBe('tally');
    expect(await page.textContent('#c2 .n')).toBe('3'); // state kept across the recompilation
    expect(await page.textContent('.stats')).toMatch(/diagnostics: none/);
    await finish(page, problems);
  });
});

test.describe('E. nested state and cascade', () => {
  test('nearest owner, explicit owner, inherited value, specificity, conditions, @layer, !important', async ({ page }) => {
    const problems = await visit(page, 'nested-cascade');
    const n = (id: string) => page.textContent(`#${id} > .row > .n`);
    await page.click('#inner > .row > .inc');
    await page.click('.outer-inc');
    await frames(page);
    expect([await n('outer'), await n('middle'), await n('inner')]).toEqual(['1', '0', '1']);
    expect(await page.textContent('#outer > .inherit .v')).toBe('1');
    expect([await prop(page, '#middle > .row > .dec', 'disabled'), await prop(page, '#inner > .row > .dec', 'disabled')]).toEqual([true, false]);
    expect([await page.textContent('#outer > .row > .label'), await page.textContent('#middle > .row > .label')]).toEqual(['base', 'specific']);
    for (let i = 0; i < 3; i++) await page.click('#middle > .row > .inc');
    await frames(page);
    expect(await page.textContent('#middle > .row > .label')).toBe('three or more');
    expect(await page.$$eval('.chip', (cs) => cs.map((c) => c.getAttribute('data-layer')))).toEqual(['override', 'override', 'override']);
    expect(await page.$$eval('.imp', (cs) => cs.map((c) => c.getAttribute('data-imp')))).toEqual(['important', 'important', 'important']);
    await finish(page, problems);
  });
});

test.describe('F. form interactions', () => {
  test('binding, text, conditional required, validity, keyboard, reset; nothing submitted', async ({ page }) => {
    const problems = await visit(page, 'form-interactions');
    expect([await page.textContent('.who'), await prop(page, '#submit', 'disabled'), await prop(page, '.address-field', 'hidden')]).toEqual(['guest', true, true]);
    await page.fill('#name', 'Ada');
    await page.check('input[value=ship]');
    await page.fill('#qty', '3');
    await frames(page);
    expect([await page.textContent('.who'), await page.textContent('.mode'), await page.textContent('.qty-text')]).toEqual(['Ada', 'Ship', '3']);
    expect([await prop(page, '.address-field', 'hidden'), await prop(page, '#address', 'required')]).toEqual([false, true]);
    expect(await page.$eval('.order', (f) => (f as HTMLFormElement).checkValidity())).toBe(false);
    await page.fill('#address', 'Main St 1');
    await page.focus('#terms');
    await page.keyboard.press('Space');
    expect(await prop(page, '#submit', 'disabled')).toBe(false);
    expect(await page.$eval('.validity', (e) => getComputedStyle(e, '::after').content)).toBe('"ready"');
    await page.click('#submit');
    expect(page.url()).toMatch(/form-interactions\/$/);
    await page.click('#reset');
    await frames(page, 3);
    await expect.poll(() => page.textContent('.who')).toBe('guest');
    expect([await page.textContent('.mode'), await prop(page, '#address', 'required'), await prop(page, '#submit', 'disabled')]).toEqual(['Pick up', false, true]);
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, '']);
    await finish(page, problems);
  });
});

test.describe('G. history and motion', () => {
  test('previous, direction, :changed, rapid actions, bounds, reduced motion', async ({ page }) => {
    const problems = await visit(page, 'history-motion');
    const hist = () => page.$eval('.meter', (m) => ['.cur', '.prev', '.dir', '.word'].map((c) => m.querySelector(c)!.textContent));
    await page.click('.up');
    await frames(page);
    expect(await hist()).toEqual(['6', '5', '1', 'went up']);
    await expect.poll(() => page.$eval('.cur', (e) => e.getAnimations().length)).toBe(1);
    await page.click('.down');
    await frames(page);
    expect(await hist()).toEqual(['5', '6', '-1', 'went down']);
    await page.$eval('.jump', (b) => { for (let i = 0; i < 6; i++) (b as HTMLElement).click(); }); // rapid: 5 → 20, then disabled
    await frames(page);
    expect([(await hist())[0], await prop(page, '.jump', 'disabled'), await prop(page, '.up', 'disabled')]).toEqual(['20', true, true]);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.click('.down');
    await frames(page, 3);
    expect(await page.$eval('.cur', (e) => e.getAnimations().length)).toBe(0);
    expect(await page.$eval('.bar', (e) => getComputedStyle(e).transitionDuration)).toBe('0s');
    expect((await hist())[0]).toBe('19');
    await finish(page, problems);
  });
});

test.describe('H. stylesheet lifecycle lab', () => {
  test('layers, media, disabled sheet, media attribute, insertion/removal, recompilation and state across it', async ({ page }) => {
    const problems = await visit(page, 'stylesheet-lab');
    const cell = (c: string) => page.textContent(`.out .${c}`);
    const h = async (name: string) => { await page.click(`[data-h="${name}"]`); await frames(page, 3); };
    await expect.poll(() => cell('label')).toBe('labels v1');
    expect([await cell('layer'), await cell('media'), await cell('flag'), await cell('step')]).toEqual(['high layer wins', 'wide (more than 600px)', 'extra.css is on', '10']);
    await page.click('.inc');
    await frames(page);
    expect(await page.textContent('.lab .n')).toBe('10'); // extra.css's more specific on:
    await h('extra'); // disabled
    await page.click('.inc');
    await frames(page);
    expect(await page.textContent('.lab .n')).toBe('11');
    expect([await cell('flag'), await cell('step')]).toEqual(['extra.css is off', '1']);
    await h('extra'); // enabled again
    await page.click('.inc');
    await frames(page);
    expect([await page.textContent('.lab .n'), await cell('flag')]).toEqual(['21', 'extra.css is on']);
    await h('media'); // media query that never matches
    await page.click('.inc');
    await frames(page);
    expect([await page.textContent('.lab .n'), await cell('flag')]).toEqual(['22', 'extra.css is off']);
    await h('media');
    await h('insert');
    await expect.poll(() => cell('ins')).toBe('inserted.css is live');
    await h('insert');
    await expect.poll(() => cell('ins')).toBe('no inserted sheet');
    await h('labels'); // recompile: v2, with a condition on the state
    await expect.poll(() => cell('label')).toBe('labels v2, n ≥ 3');
    expect(await page.textContent('.lab .n')).toBe('22'); // the state survived a recompilation of a sheet that uses it
    await h('decl'); // the state's own sheet swapped: the new file still has to download
    // Wait for the swap itself (state-v2.css makes .count bold), not for text that was already there.
    await expect.poll(() => page.$eval('.lab .count', (e) => getComputedStyle(e).fontWeight)).toBe('700');
    await expect.poll(() => page.textContent('.lab .n')).toBe('0'); // swapping the sheet that DECLARES the state restarts it (README, section 5)
    await page.setViewportSize({ width: 500, height: 700 });
    await h('refresh'); // media change: text: re-reads on refresh()
    expect(await cell('media')).toBe('narrow (600px or less)');
    await finish(page, problems);
  });

  test('a swapped state sheet that downloads slowly: the state keeps its value until the new sheet applies, then restarts', async ({ page }) => {
    // Reproduces a slower runner (Linux CI): the replacement for the sheet that declares --n arrives late.
    let release!: () => void;
    const held = new Promise<void>((res) => { release = res; });
    await page.route('**/state-v2.css', async (r) => { await held; await r.continue(); });
    const problems = await visit(page, 'stylesheet-lab');
    for (let i = 0; i < 2; i++) { await page.click('.inc'); await frames(page); }
    const before = await page.textContent('.lab .n');
    expect(Number(before)).toBeGreaterThan(0);
    await page.click('[data-h="decl"]');
    await frames(page, 5);
    expect(await page.textContent('.lab .n')).toBe(before); // still the old sheet's state while the new one downloads
    await page.click('.inc');
    await frames(page);
    expect(Number(await page.textContent('.lab .n'))).toBeGreaterThan(Number(before)); // and it still works
    release();
    await expect.poll(() => page.$eval('.lab .count', (e) => getComputedStyle(e).fontWeight)).toBe('700');
    await expect.poll(() => page.textContent('.lab .n')).toBe('0'); // the new declaring sheet restarts it
    await page.click('.inc');
    await frames(page);
    expect(Number(await page.textContent('.lab .n'))).toBeGreaterThan(0); // the restarted state is live
    await finish(page, problems);
  });
});

test.describe('demo lab: cross-browser checklist', () => {
  test('every example has checklist rows; every cell starts as not tested; results copy as Markdown', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/examples/lab/checklist.html');
    await page.waitForFunction(() => document.querySelectorAll('.checklist section').length === 20);
    const counts = await page.$$eval('.checklist section', (ss) => ss.map((s) => [s.id, s.querySelectorAll('tr').length - 1]));
    for (const [id, n] of counts) expect(n, String(id)).toBeGreaterThan(3);
    expect(await page.$$eval('.checklist select', (ss) => ss.every((s) => (s as HTMLSelectElement).value === ''))).toBe(true);
    expect(await page.$$eval('#keyboard-navigation .notes', (n) => n.map((e) => e.textContent).join(''))).toMatch(/Safari: Clicking a button does not focus it/);
    await page.selectOption('#focus-transitions select >> nth=0', 'pass');
    await page.click('.copy');
    const md = await page.inputValue('.out');
    expect(md).toMatch(/\| Load the page \| pass \| not tested \| not tested \|/);
    expect(md).toMatch(/Unset cells are \*\*not tested\*\*/);
    expect(errors).toEqual([]);
  });
});
