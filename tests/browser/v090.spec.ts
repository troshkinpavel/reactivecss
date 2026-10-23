// 0.9.0 language, integration (docs/rfc-v0.9.0-language.md): the fixtures in tests/fixtures/v090
// are plain HTML + CSS pages with one script tag; every assertion reads the real DOM, computed
// style, focus or storage.
import { test, expect, type Page } from '@playwright/test';
import { frames, diagnostics, stats } from './helpers';

declare global { interface Window { ReactiveCSS: any } }

async function fixture(page: Page, name: string) {
  await page.goto(`/tests/fixtures/v090/${name}.html`);
  await page.waitForFunction(() => window.ReactiveCSS?.stats().sheets > 0);
  await frames(page);
}
const prop = (page: Page, sel: string, name: string) => page.$eval(sel, (el, n) => getComputedStyle(el).getPropertyValue(n).trim(), name);
const text = (page: Page, sel: string) => page.$eval(sel, (el) => el.textContent);

async function drag(page: Page, sel: string, dx: number, dy: number, steps = 6) {
  const b = (await page.locator(sel).first().boundingBox())!;
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps });
  await page.mouse.up();
  await frames(page);
}

test.describe('counter, cascade and DOM text', () => {
  test('mutations, event-time arithmetic, one winning mutation per state, content as text', async ({ page }) => {
    await fixture(page, 'counter');
    const v = '#c1 .value';
    expect(await text(page, v)).toBe('0');
    await expect(page.locator('#c1 .dec')).toBeDisabled(); // --attr-disabled: when(--count <= 0)
    await page.click('#c1 .inc');
    await page.click('#c1 .inc');
    await page.click('#c1 .double');
    await frames(page);
    expect(await text(page, v)).toBe('4');
    // .inc.big matches both rules: the more specific mutation wins, it is not added to the other.
    await page.click('#c1 .inc.big');
    await frames(page);
    expect(await text(page, v)).toBe('14');
    expect(await page.$eval(v, (el) => getComputedStyle(el).color)).toBe('rgb(220, 20, 60)');
    for (let i = 0; i < 4; i++) await page.click('#c1 .double');
    await frames(page);
    expect(await text(page, v)).toBe('100'); // clamp(0, …, 100)
    await page.click('#c1 .reset');
    await frames(page);
    expect(await text(page, v)).toBe('0');
    await expect(page.locator('#c1 .dec')).toBeDisabled();
    // Each component owns its state.
    await page.click('#c2 .inc');
    await frames(page);
    expect([await text(page, '#c1 .value'), await text(page, '#c2 .value')]).toEqual(['0', '1']);
    await expect(page.locator('#c2 .dec')).toBeEnabled();
    // The output element keeps one text node; nothing else was added.
    expect(await page.$eval('#c2 .value', (el) => el.childNodes.length)).toBe(1);
    expect(await diagnostics(page)).toEqual([]);
  });

  test('rapid clicks: every click counts once, in order', async ({ page }) => {
    await fixture(page, 'counter');
    await page.locator('#c1 .inc:not(.big)').click();
    for (let i = 0; i < 30; i++) await page.dispatchEvent('#c1 .inc:not(.big)', 'click');
    await frames(page);
    expect(await text(page, '#c1 .value')).toBe('31');
  });
});

test.describe('toggle, tabs, accordion', () => {
  test('toggle: bind(aria-pressed), --attr-data-state and content follow one state', async ({ page }) => {
    await fixture(page, 'disclosure');
    const t = page.locator('#toggle');
    await expect(t).toHaveAttribute('aria-pressed', 'false');
    await expect(t).toHaveAttribute('data-state', 'off');
    await t.click();
    await expect(t).toHaveAttribute('aria-pressed', 'true');
    await expect(t).toHaveAttribute('data-state', 'on');
    await frames(page);
    expect(await text(page, '#toggle .label')).toBe('On');
    await t.press('Enter'); // native button activation is a click
    await expect(t).toHaveAttribute('aria-pressed', 'false');
  });

  test('tabs: click, arrow keys with prevent, clamped at both ends; roving tabindex', async ({ page }) => {
    await fixture(page, 'disclosure');
    const tab = (i: number) => page.locator('#tabs [role=tab]').nth(i);
    await expect(tab(0)).toHaveAttribute('aria-selected', 'true');
    await expect(tab(1)).toHaveAttribute('tabindex', '-1');
    await tab(1).click();
    await expect(tab(1)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#tabs [role=tabpanel]').nth(1)).toBeVisible();
    await tab(1).focus();
    const scroll = await page.evaluate(() => scrollX);
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
    await expect(tab(2)).toHaveAttribute('aria-selected', 'true');
    await expect(tab(2)).toHaveAttribute('tabindex', '0');
    expect(await page.evaluate(() => scrollX)).toBe(scroll);
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft');
    await expect(tab(0)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#tabs [role=tabpanel]').nth(0)).toBeVisible();
    await expect(page.locator('#tabs [role=tabpanel]').nth(2)).toBeHidden();
  });

  test('accordion: items are independent', async ({ page }) => {
    await fixture(page, 'disclosure');
    const b = page.locator('#accordion .item > button');
    await b.nth(0).click();
    await expect(b.nth(0)).toHaveAttribute('aria-expanded', 'true');
    await expect(b.nth(1)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#accordion .panel').nth(0)).toBeVisible();
    await expect(page.locator('#accordion .panel').nth(1)).toBeHidden();
    await b.nth(0).click();
    await expect(page.locator('#accordion .panel').nth(0)).toBeHidden();
  });
});

test.describe('dropdown and dialog', () => {
  test('dropdown: outside(click), keydown(Escape), item choice from attr()', async ({ page }) => {
    await fixture(page, 'overlays');
    const button = page.locator('#dropdown > button');
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await page.click('.elsewhere');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.click();
    await page.keyboard.press('Escape');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.click();
    await page.click('#dropdown [data-value=beta]');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await frames(page);
    expect(await text(page, '.choice')).toBe('beta');
  });

  test('dialog: focus: when() focuses on open, returns focus on close, never at load', async ({ page }) => {
    await fixture(page, 'overlays');
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await page.click('#modal .open');
    await expect(page.locator('#modal .name')).toBeFocused();
    await page.keyboard.type('Ada');
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal .sheet')).toBeHidden();
    await expect(page.locator('#modal .open')).toBeFocused();
    await page.keyboard.press('Enter'); // native activation reopens it
    await expect(page.locator('#modal .name')).toBeFocused();
    expect(await page.inputValue('#modal .name')).toBe('Ada');
    expect(await diagnostics(page)).toEqual([]);
  });
});

test.describe('forms', () => {
  test('text preview through event(value); own-state bind(value) stays equal to the control', async ({ page }) => {
    await fixture(page, 'forms');
    await page.fill('input[name=name]', 'Grace');
    await frames(page);
    expect(await text(page, '.preview')).toBe('Grace');
    await page.fill('input[name=name]', '');
    await frames(page);
    expect(await text(page, '.preview')).toBe('(empty)');
  });

  test('checkbox: bind(checked) and event(checked); label styling from the state', async ({ page }) => {
    await fixture(page, 'forms');
    await page.check('input[name=news]');
    await frames(page);
    expect(await prop(page, 'input[name=news]', '--news')).toBe('1');
    expect(await text(page, '.news')).toBe('subscribed');
    expect(await page.$eval('input[name=news]', (el) => getComputedStyle(el.closest('label')!).fontWeight)).toBe('700');
    // Rapid clicks: the state follows the control exactly (0.8.1 fast-choice fix).
    for (let i = 0; i < 7; i++) await page.click('input[name=news]');
    await frames(page);
    expect(await page.isChecked('input[name=news]')).toBe(false);
    expect(await prop(page, 'input[name=news]', '--news')).toBe('0');
  });

  test('select and range: bind(value) both ways; event(value-as-number)', async ({ page }) => {
    await fixture(page, 'forms');
    await page.selectOption('select[name=color]', 'red');
    await frames(page);
    expect(await page.$eval('select', (el) => getComputedStyle(el).outlineStyle)).toBe('solid');
    await page.focus('input[name=volume]');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await frames(page);
    expect(await text(page, '.level')).toBe('7');
    expect(await prop(page, 'input[name=volume]', '--volume')).toBe('7');
  });

  test('radio group keeps bind: to an ancestor state; form reset restores every state', async ({ page }) => {
    await fixture(page, 'forms');
    await page.check('input[value=l]');
    await page.check('input[name=news]');
    await page.selectOption('select[name=color]', 'green');
    await frames(page);
    expect(await text(page, '.size')).toBe('l');
    await page.click('button[type=reset]');
    await page.waitForTimeout(50);
    await frames(page);
    expect(await text(page, '.size')).toBe('m');
    expect(await page.isChecked('input[value=m]')).toBe(true);
    expect(await prop(page, 'input[name=news]', '--news')).toBe('0');
    expect(await prop(page, 'select[name=color]', '--color')).toBe('blue');
  });

  test(':blur:invalid marks a required field only after the user leaves it', async ({ page }) => {
    await fixture(page, 'forms');
    const style = () => page.$eval('input[name=name]', (el) => getComputedStyle(el).outlineColor);
    expect(await page.getAttribute('input[name=name]', 'data-rcss-blur')).toBeNull();
    await page.focus('input[name=name]');
    await page.focus('input[name=nick]');
    expect(await style()).toBe('rgb(255, 165, 0)');
  });
});

test.describe('persistence', () => {
  test('theme: persisted, reflected to data-theme, restored before the attribute on reload', async ({ page }) => {
    await fixture(page, 'persist');
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload();
    await page.waitForFunction(() => window.ReactiveCSS?.stats().sheets > 0);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.click('.theme');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.waitForFunction(() => localStorage.getItem('rcss:fixture-theme') !== null);
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem('rcss:fixture-theme')))!)).toEqual({ t: 'value', v: 'dark' });
    await page.reload();
    await page.waitForFunction(() => window.ReactiveCSS?.stats().sheets > 0);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.$eval('body', (el) => getComputedStyle(el).backgroundColor)).toBe('rgb(17, 17, 17)');
  });

  test('a shared key keeps two widgets equal; writes are coalesced; invalid stored values are ignored', async ({ page }) => {
    await fixture(page, 'persist');
    await page.evaluate(() => { sessionStorage.setItem('rcss:fixture-count', '{"t":"string","v":"oops"}'); });
    await page.reload();
    await page.waitForFunction(() => window.ReactiveCSS?.stats().sheets > 0);
    await frames(page);
    expect(await text(page, '#pc1 .v')).toBe('0');
    expect((await diagnostics(page)).join('\n')).toMatch(/stored value does not fit/);
    for (let i = 0; i < 20; i++) await page.dispatchEvent('#pc1 .inc', 'click');
    await frames(page);
    expect([await text(page, '#pc1 .v'), await text(page, '#pc2 .v')]).toEqual(['20', '20']);
    await page.waitForFunction(() => sessionStorage.getItem('rcss:fixture-count') === '{"t":"number","v":20}');
    const writes = await page.evaluate(() => window.ReactiveCSS.stats().internal.persistWrites);
    expect(writes).toBeLessThanOrEqual(3);
  });

  test('storage that throws: one note, the state still works', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } });
    });
    await fixture(page, 'persist');
    await page.click('.theme');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect((await diagnostics(page)).join('\n')).toMatch(/localStorage is not available \(SecurityError\)/);
  });
});

test.describe('event-time snapshots', () => {
  test('pointer position, element size, random, pick and viewport are read once at the event', async ({ page }) => {
    await fixture(page, 'snapshots');
    await page.mouse.click(40 + 30, 40 + 50);
    await frames(page);
    expect(await prop(page, '.pad', '--x')).toBe('30px');
    expect(await prop(page, '.pad', '--y')).toBe('50px');
    await page.mouse.move(300, 300); // a snapshot does not follow the pointer
    await frames(page);
    expect(await prop(page, '.pad', '--x')).toBe('30px');
    await page.click('.box');
    await frames(page);
    expect(await text(page, '.box .w')).toBe('123px');
    await page.click('.dice');
    await frames(page);
    const roll = +(await prop(page, '.dice', '--roll'));
    expect(Number.isInteger(roll) && roll >= 1 && roll <= 6).toBe(true);
    expect(['"a"', '"b"', '"c"']).toContain(await prop(page, '.dice', '--face'));
    expect(await prop(page, '.dice', '--vw')).toBe(`${page.viewportSize()!.width}px`);
  });

  test('one transaction per event: a swap reads both values before writing', async ({ page }) => {
    await fixture(page, 'snapshots');
    await page.click('.swap');
    await frames(page);
    expect([await prop(page, '.swap', '--a'), await prop(page, '.swap', '--b')]).toEqual(['2', '1']);
  });
});

test.describe('focus and blur', () => {
  test(':blur matches after a real focus loss only, until the next focus', async ({ page }) => {
    await fixture(page, 'focus');
    const marked = (id: string) => page.$eval(`#${id}`, (el) => el.hasAttribute('data-rcss-blur'));
    expect([await marked('a'), await marked('b')]).toEqual([false, false]);
    await page.focus('#a');
    await page.focus('#b');
    expect([await marked('a'), await marked('b')]).toEqual([true, false]);
    expect(await page.$eval('#a', (el) => el.getAnimations().length)).toBe(1);
    await page.focus('#a');
    expect([await marked('a'), await marked('b')]).toEqual([false, true]);
  });

  test('focus: when() after a click; native :focus styling untouched', async ({ page }) => {
    await fixture(page, 'focus');
    await page.click('#search .toggle');
    await expect(page.locator('#search .field')).toBeFocused();
    expect(await page.$eval('#search .field', (el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 224)');
  });
});

test.describe('nested events and modifiers', () => {
  test('bubbling runs inner and outer rules; stop() keeps the outer rule out; prevent() cancels navigation', async ({ page }) => {
    await fixture(page, 'events');
    await page.click('#outer .inner');
    await frames(page);
    expect([await text(page, '.o'), await text(page, '.i')]).toEqual(['1', '1']);
    let outerListener = 0;
    await page.exposeFunction('outerHeard', () => outerListener++);
    await page.evaluate(() => document.querySelector('#outer')!.addEventListener('click', () => (window as any).outerHeard()));
    await page.click('#outer .stopper');
    await frames(page);
    expect([await text(page, '.o'), await text(page, '.i')]).toEqual(['1', '101']);
    expect(outerListener).toBe(0); // native propagation stopped at the element, after its own listeners
    await page.click('#outer .plain');
    await page.click('#outer .plain');
    await frames(page);
    expect(await text(page, '.o')).toBe('3'); // a button without its own rule: its clicks bubble to the outer rule
    await page.click('#outer a.confirm');
    await frames(page);
    expect(page.url()).not.toContain('#navigated');
    expect(await text(page, '.q')).toBe('1');
  });

  test('conditional rules: :when() changes which mutation wins, at each event', async ({ page }) => {
    await fixture(page, 'events');
    await page.click('#mode .add');
    await page.click('#mode .lock');
    await page.click('#mode .add');
    await page.click('#mode .add');
    await page.click('#mode .lock');
    await page.click('#mode .add');
    await frames(page);
    expect(await text(page, '#mode .v')).toBe('2');
  });

  test('submit with prevent: counted, not sent', async ({ page }) => {
    await fixture(page, 'events');
    await page.click('form.f button');
    await page.press('form.f input', 'Enter');
    await frames(page);
    expect(await text(page, 'form.f .s')).toBe('2');
    expect(page.url()).toContain('/tests/fixtures/v090/events.html');
  });
});

test.describe('drag', () => {
  test('card: positions continue across drags; start / end phases; keyboard alternative', async ({ page }) => {
    await fixture(page, 'drag');
    await drag(page, '.card', 40, 30);
    expect([await prop(page, '.card', '--x'), await prop(page, '.card', '--y')]).toEqual(['40px', '30px']);
    await drag(page, '.card', 25, -10);
    expect([await prop(page, '.card', '--x'), await prop(page, '.card', '--y')]).toEqual(['65px', '20px']);
    expect(await prop(page, '.card', '--dragging')).toBe('0');
    await page.focus('.card');
    await page.keyboard.press('ArrowRight');
    await frames(page);
    expect(await prop(page, '.card', '--x')).toBe('75px');
  });

  test('a drag starts no text selection and no native drag, so the next drag still runs (WebKit on Linux froze)', async ({ page }) => {
    // The fixture has text beside the card (.cancels). Unprevented, the first press started a text selection
    // that grew over that text; the second press then started a native drag of the selection, and WebKit
    // for Linux delivered no more pointer events: the second drag stopped after its first move.
    await fixture(page, 'drag');
    await page.evaluate(() => {
      const w = window as any; w.cancelled = [];
      for (const t of ['selectstart', 'dragstart']) document.addEventListener(t, (e) => w.cancelled.push(`${t}:${e.defaultPrevented}`));
    });
    await drag(page, '.card', 40, 30);
    expect(await page.evaluate(() => getSelection()!.toString())).toBe('');
    await drag(page, '.card', 25, -10);
    expect([await prop(page, '.card', '--x'), await prop(page, '.card', '--y')]).toEqual(['65px', '20px']);
    // Every engine: during a gesture the browser's own selection and drag are cancelled.
    const b = (await page.locator('.card').boundingBox())!;
    await page.mouse.move(b.x + 10, b.y + 10);
    await page.mouse.down();
    const during = await page.evaluate(() => ['selectstart', 'dragstart'].map((t) => { const e = new Event(t, { bubbles: true, cancelable: true }); document.querySelector('.card')!.dispatchEvent(e); return e.defaultPrevented; }));
    await page.mouse.up();
    expect(during).toEqual([true, true]);
    expect((await page.evaluate(() => (window as any).cancelled)).every((x: string) => x.endsWith(':true'))).toBe(true);
    // Outside a gesture, text selects as usual.
    expect(await page.evaluate(() => { const e = new Event('selectstart', { bubbles: true, cancelable: true }); document.body.dispatchEvent(e); return e.defaultPrevented; })).toBe(false);
  });

  test('the dragging state is on during the drag only; below the threshold nothing happens', async ({ page }) => {
    await fixture(page, 'drag');
    const b = (await page.locator('.card').boundingBox())!;
    await page.mouse.move(b.x + 10, b.y + 10);
    await page.mouse.down();
    await page.mouse.move(b.x + 12, b.y + 10);
    await frames(page);
    expect(await prop(page, '.card', '--dragging')).toBe('0');
    await page.mouse.move(b.x + 40, b.y + 10, { steps: 3 });
    await frames(page);
    expect(await prop(page, '.card', '--dragging')).toBe('1');
    expect(await page.$eval('.card', (el) => getComputedStyle(el).outlineStyle)).toBe('solid');
    await page.mouse.up();
    await frames(page);
    expect(await prop(page, '.card', '--dragging')).toBe('0');
  });

  test('sliders and split panel are clamped; the pointer may leave the element', async ({ page }) => {
    await fixture(page, 'drag');
    await drag(page, '.hs .thumb', 120, 40);
    expect(await prop(page, '.hs', '--v')).toBe('120px');
    await drag(page, '.hs .thumb', 500, 0);
    expect(await prop(page, '.hs', '--v')).toBe('200px');
    expect(await text(page, '.hs .out')).toBe('200px');
    await drag(page, '.vs .thumb', 0, -70);
    expect(await prop(page, '.vs', '--v')).toBe('30px');
    await drag(page, '.split .divider', -300, 0);
    expect(await prop(page, '.split', '--w')).toBe('50px');
    expect(await page.$eval('.split .left', (el) => el.getBoundingClientRect().width)).toBe(50);
  });

  test('many draggables, inserted later: each keeps its own position', async ({ page }) => {
    await fixture(page, 'drag');
    await page.evaluate(() => { const m = document.querySelector('.many')!; for (let i = 0; i < 300; i++) m.append(document.createElement('i')); });
    await frames(page);
    await drag(page, '.many i:nth-child(3)', 30, 0);
    const xs = await page.$$eval('.many i', (els) => els.slice(0, 5).map((el) => getComputedStyle(el).getPropertyValue('--dx').trim()));
    expect(xs).toEqual(['0px', '0px', '30px', '0px', '0px']);
    const s = await stats(page);
    expect(s.internal.gestures).toBe(0);
    expect(s.internal.gestureListeners).toBe(1); // the pointerdown listener only
  });

  test('cancel: pointercancel runs cancel then end; touch and pen pointers drag too', async ({ page }) => {
    await fixture(page, 'drag');
    const ptr = (type: string, x: number, y: number, pointerType = 'touch') =>
      page.evaluate(([t, x, y, pt]) => {
        const target = t === 'pointerdown' ? document.querySelector('.card')! : document;
        target.dispatchEvent(new PointerEvent(t as string, { pointerId: 9, pointerType: pt as string, isPrimary: true, clientX: x as number, clientY: y as number, bubbles: true, cancelable: true, button: 0, buttons: 1 }));
      }, [type, x, y, pointerType] as const);
    await ptr('pointerdown', 30, 30);
    await ptr('pointermove', 50, 30);
    await frames(page);
    expect(await prop(page, '.card', '--dragging')).toBe('1');
    await ptr('pointercancel', 50, 30);
    await frames(page);
    expect(await prop(page, '.card', '--dragging')).toBe('0');
    expect(await text(page, '.cancels')).toBe('1');
    expect(await prop(page, '.card', '--x')).toBe('20px');
    await ptr('pointerdown', 50, 30, 'pen');
    await ptr('pointermove', 70, 40, 'pen');
    await ptr('pointerup', 70, 40, 'pen');
    await frames(page);
    expect([await prop(page, '.card', '--x'), await prop(page, '.card', '--y')]).toEqual(['40px', '10px']);
    expect((await stats(page)).internal.gestures).toBe(0);
  });

  test('20 rapid drags accumulate exactly; the click after a drag runs no :on(click) rule', async ({ page }) => {
    await fixture(page, 'drag');
    await page.addStyleTag({ content: '.stage { --clicks: state(0) } .card:on(click) { --clicks: increment(1) }' });
    await page.waitForFunction(() => window.ReactiveCSS.stats().sheets === 2);
    for (let i = 0; i < 20; i++) await drag(page, '.card', 5, 2, 2);
    expect([await prop(page, '.card', '--x'), await prop(page, '.card', '--y')]).toEqual(['100px', '40px']);
    expect(await prop(page, '.stage', '--clicks')).toBe('0');
    await page.click('.card');
    await frames(page);
    expect(await prop(page, '.stage', '--clicks')).toBe('1');
  });

  test('the element removed during a drag: the gesture ends, nothing runs, no listener stays', async ({ page }) => {
    await fixture(page, 'drag');
    const b = (await page.locator('.card').boundingBox())!;
    await page.mouse.move(b.x + 10, b.y + 10);
    await page.mouse.down();
    await page.mouse.move(b.x + 40, b.y + 10, { steps: 3 });
    await page.evaluate(() => document.querySelector('.card')!.remove());
    await page.mouse.move(b.x + 80, b.y + 10, { steps: 3 });
    await page.mouse.up();
    await frames(page);
    const s = await stats(page);
    expect(s.internal.gestures).toBe(0);
    expect(s.internal.gestureListeners).toBe(1);
    expect(await diagnostics(page)).toEqual([]);
  });

  test('stop() releases everything; start() drags again without duplicate listeners', async ({ page }) => {
    await fixture(page, 'drag');
    await page.evaluate(() => window.ReactiveCSS.stop());
    expect((await stats(page)).internal.gestureListeners).toBe(0);
    await page.evaluate(() => window.ReactiveCSS.start());
    await page.waitForFunction(() => window.ReactiveCSS.stats().sheets > 0);
    await frames(page);
    await drag(page, '.card', 15, 0);
    expect(await prop(page, '.card', '--x')).toBe('15px');
    expect((await stats(page)).internal.gestureListeners).toBe(1);
  });
});

test.describe('more events and attributes', () => {
  test('scroll: event(scroll-top) on the scrolling element; ARIA tristate, number and text attributes', async ({ page }) => {
    await page.route('**/t/scroll.html', (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><style>
      .list { --top: state(0px); --checked: state(false); --n: state(3); height: 100px; overflow: auto }
      .list:on(scroll) { --top: set(event(scroll-top)) }
      .list .t { content: var(--top) }
      .list .box { --attr-aria-checked: when(--top > 50px, mixed, var(--checked)); --attr-aria-valuenow: var(--n); --attr-aria-label: when(--top > 0px, "Scrolled", "At top") }
    </style><script src="/dist/reactive-css.js" defer></script></head><body><div class="list"><span class="t">0px</span><div class="box" role="checkbox" style="height: 1000px">x</div></div></body></html>` }));
    await page.goto('/t/scroll.html');
    await page.waitForFunction(() => window.ReactiveCSS?.stats().sheets === 1);
    await frames(page);
    const box = page.locator('.box');
    await expect(box).toHaveAttribute('aria-checked', 'false');
    await expect(box).toHaveAttribute('aria-valuenow', '3');
    await expect(box).toHaveAttribute('aria-label', 'At top');
    await page.$eval('.list', (el) => { el.scrollTop = 120; });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.list')!).getPropertyValue('--top').trim() === '120px');
    await frames(page);
    expect(await text(page, '.t')).toBe('120px');
    await expect(box).toHaveAttribute('aria-checked', 'mixed');
    await expect(box).toHaveAttribute('aria-label', 'Scrolled');
    expect(await diagnostics(page)).toEqual([]);
  });
});

test.describe('lifecycle, CodePen-style pages, CSP', () => {
  const page0 = '<div class="c"><button class="inc">+</button><span class="v">0</span></div>';
  const css = (step: number) => `.c { --n: state(0) } .c .inc:on(click) { --n: increment(${step}) } .c .v { content: var(--n) }`;

  test('CodePen-style: an injected <style>, replaced 20 times, with delayed script loading', async ({ page }) => {
    await page.route('**/t/codepen.html', (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head></head><body>${page0}</body></html>` }));
    await page.goto('/t/codepen.html');
    await page.evaluate((c) => { const s = document.createElement('style'); s.id = 'pen'; s.textContent = c; document.head.append(s); }, css(1));
    await page.evaluate(() => new Promise<void>((res) => { const s = document.createElement('script'); s.src = '/dist/reactive-css.js'; s.onload = () => res(); document.head.append(s); }));
    await page.waitForFunction(() => window.ReactiveCSS?.stats().sheets === 1);
    await page.click('.inc');
    await frames(page);
    expect(await text(page, '.v')).toBe('1');
    for (let i = 2; i <= 21; i++) await page.evaluate((c) => { document.getElementById('pen')!.textContent = c; }, css(i));
    await frames(page);
    const before = await stats(page);
    await page.click('.inc');
    await frames(page);
    // The state restarts with the new sheet (a recompiled state is a new cell); the last step applies once.
    expect(await text(page, '.v')).toBe('21');
    expect(before.sheets).toBe(1);
    expect(before.internal.watchers).toBeLessThan(12);
    expect(before.internal.actionListeners).toBe(1);
    expect(await diagnostics(page)).toEqual([]);
  });

  test('stop / start 20 times: no accumulated listeners, rules or bindings', async ({ page }) => {
    await page.route('**/t/cycle.html', (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><style>${css(1)} .c { --open: state(false); --attr-aria-expanded: var(--open) } .c:on(keydown(Escape)) { --open: set(false) }</style><script src="/dist/reactive-css.js" defer></script></head><body>${page0}</body></html>` }));
    await page.goto('/t/cycle.html');
    await page.waitForFunction(() => window.ReactiveCSS?.stats().sheets === 1);
    const first = await stats(page);
    for (let i = 0; i < 20; i++) await page.evaluate(() => { window.ReactiveCSS.stop(); window.ReactiveCSS.start(); });
    await page.waitForFunction(() => window.ReactiveCSS.stats().sheets === 1);
    await frames(page);
    const after = await stats(page);
    expect(after.bindings).toBe(first.bindings);
    expect(after.states).toBe(first.states);
    expect(after.internal.actionListeners).toBe(first.internal.actionListeners);
    expect(after.internal.watchers).toBe(first.internal.watchers);
    await page.click('.inc');
    await frames(page);
    expect(await text(page, '.v')).toBe('1');
  });

  test('strict CSP (no unsafe-inline, no eval): :on(), --attr-*, content and drag work', async ({ page }) => {
    const csp = "default-src 'self'; style-src 'self'; script-src 'self'";
    await page.route('**/t/csp/app.css', (r) => r.fulfill({ contentType: 'text/css', body: `${css(2)} .c { --attr-data-n: var(--n) } .d { --x: state(0px); width: 40px; height: 40px; background: red; translate: var(--x) 0 } .d:on(drag) { --x: set(event(x)) }` }));
    await page.route('**/t/csp/page.html', (r) => r.fulfill({ contentType: 'text/html', headers: { 'Content-Security-Policy': csp },
      body: `<!doctype html><html><head><link rel="stylesheet" href="/t/csp/app.css"><script src="/dist/reactive-css.js" defer></script></head><body>${page0}<div class="d"></div></body></html>` }));
    const violations: string[] = [];
    page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) violations.push(m.text()); });
    await page.goto('/t/csp/page.html');
    await page.waitForFunction(() => window.ReactiveCSS?.stats().sheets === 1);
    await page.click('.inc');
    await frames(page);
    expect(await text(page, '.v')).toBe('2');
    await expect(page.locator('.c')).toHaveAttribute('data-n', '2');
    await drag(page, '.d', 30, 0);
    expect(await prop(page, '.d', '--x')).toBe('30px');
    expect(violations).toEqual([]);
  });

  test('mount and unmount 200 components 10 times: bindings, states and candidates go away', async ({ page }) => {
    await page.route('**/t/mount.html', (r) => r.fulfill({ contentType: 'text/html',
      body: `<!doctype html><html><head><style>${css(1)} .c { --t: state(false, persist("m")) } .c .inc:on(click) { --t: toggle() } .c { --attr-data-n: var(--n) }</style><script src="/dist/reactive-css.js" defer></script></head><body><main></main></body></html>` }));
    await page.goto('/t/mount.html');
    await page.waitForFunction(() => window.ReactiveCSS?.stats().sheets === 1);
    const empty = await stats(page);
    for (let round = 0; round < 10; round++) {
      await page.evaluate((html) => { document.querySelector('main')!.innerHTML = html; }, page0.repeat(200));
      await frames(page);
      await page.click('.c:first-child .inc');
      await page.evaluate(() => { document.querySelector('main')!.textContent = ''; });
      await frames(page);
    }
    const s = await stats(page);
    expect([s.bindings, s.states, s.sources]).toEqual([empty.bindings, empty.states, empty.sources]);
    expect(s.internal.persistKeys).toBe(0);
    expect(s.internal.attrBindings).toBe(0);
    expect(s.internal.textBindings).toBe(0);
  });
});
