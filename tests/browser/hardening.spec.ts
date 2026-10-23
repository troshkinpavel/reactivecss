// 0.9.0 hardening: stress and lifecycle cases for events, drag, persistence, attributes, text,
// focus and blur (docs/release-0.9.0-hardening.md, section F).
import { test, expect, type Page } from '@playwright/test';
import { open, frames, diagnostics, stats } from './helpers';

const prop = (page: Page, sel: string, p: string) => page.$eval(sel, (e, n) => getComputedStyle(e).getPropertyValue(n).trim(), p);
const text = (page: Page, sel: string) => page.$eval(sel, (e) => e.textContent);
async function drag(page: Page, sel: string, dx: number, dy = 0) {
  const b = (await page.locator(sel).first().boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 5 });
  await page.mouse.up();
  await frames(page);
}
/** Synthetic pointer events (pen / touch / several pointers): what Playwright's mouse cannot do. */
const ptr = (page: Page, type: string, target: string | null, id: number, x: number, y: number, pointerType = 'touch') =>
  page.evaluate(([type, target, id, x, y, pointerType]) => {
    const t = target ? document.querySelector(target as string)! : document;
    t.dispatchEvent(new PointerEvent(type as string, { pointerId: id as number, pointerType: pointerType as string, isPrimary: id === 1, clientX: x as number, clientY: y as number, bubbles: true, cancelable: true, button: 0, buttons: 1 }));
  }, [type, target, id, x, y, pointerType] as const);

test.describe('events', () => {
  test('500 event rules on 500 elements: each click runs exactly its own rule', async ({ page }) => {
    const css = Array.from({ length: 500 }, (_, i) => `.e${i}:on(click) { --n: increment(${i + 1}) }`).join('\n');
    await open(page, { head: `<style>.r { --n: state(0) } .r i { display: inline-block; width: 6px; height: 6px } ${css}</style>`, body: `<div class="r">${Array.from({ length: 500 }, (_, i) => `<i class="e${i}"></i>`).join('')}</div>` });
    let expected = 0;
    for (const i of [0, 7, 99, 250, 499, 3, 3]) { await page.click(`.e${i}`); expected += i + 1; }
    await frames(page);
    expect(+(await prop(page, '.r', '--n'))).toBe(expected);
  });

  test('a class change switches the applicable rule at the next event (dynamic selectors)', async ({ page }) => {
    await open(page, { head: '<style>.r { --n: state(0) } .r .b:on(click) { --n: increment(1) } .r .b.big:on(click) { --n: increment(100) }</style>', body: '<div class="r"><button class="b">b</button></div>' });
    await page.click('.b');
    await page.$eval('.b', (e) => e.classList.add('big'));
    await page.click('.b');
    await page.$eval('.b', (e) => e.classList.remove('big'));
    await page.click('.b');
    await frames(page);
    expect(await prop(page, '.r', '--n')).toBe('102');
  });

  test('one state written by an inner and an outer rule in one event: one write (0.9), two in legacy on: (0.8)', async ({ page }) => {
    await open(page, { head: `<style>.a { --n: state(0); --m: state(0) } .a:on(click) { --n: increment(1) } .a b:on(click) { --n: increment(1) }
      .a { on: click(increment(--m)) } .a b { on: click(increment(--m)) }</style>`, body: '<div class="a"><b>b</b></div>' });
    await page.click('.a b');
    await frames(page);
    expect([await prop(page, '.a', '--n'), await prop(page, '.a', '--m')]).toEqual(['1', '2']);
  });

  test('keyboard activation: Enter and Space on a button run :on(click); keydown filters see the focus path', async ({ page }) => {
    await open(page, { head: '<style>.r { --n: state(0); --k: state(0) } .r button:on(click) { --n: increment(1) } .r:on(keydown(ArrowUp), prevent()) { --k: increment(1) }</style>', body: '<div class="r"><button>b</button></div>' });
    await page.focus('.r button');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowUp');
    await frames(page);
    expect([await prop(page, '.r', '--n'), await prop(page, '.r', '--k')]).toEqual(['2', '1']);
  });

  test('a field with no value for this event writes nothing; a type mismatch never corrupts the state', async ({ page }) => {
    await open(page, { head: `<style>.r { --p: state(7); --s: state("x"); --b: state(false) }
      .r b:on(click) { --p: set(event(pointer-id) + 0); --s: set(5); --b: set(event(button)) }</style>`, body: '<div class="r"><b>b</b></div>' });
    await page.click('.r b');
    await frames(page);
    const p = await prop(page, '.r', '--p');
    expect(p === '7' || /^\d+$/.test(p)).toBe(true); // a click is a PointerEvent in Chromium; never NaN
    expect(await prop(page, '.r', '--s')).toBe('"x"');
    expect(await prop(page, '.r', '--b')).toBe('0'); // button 0 stored in a boolean as false
    expect((await diagnostics(page)).join('\n')).toMatch(/5 cannot be stored in --s, which holds "x"/);
  });

  test('event-time var() of a plain custom property, attr() with a typed fallback, element() and viewport()', async ({ page }) => {
    await open(page, { head: `<style>.r { --n: state(0); --w: state(0px); --step: 3; width: 210px } .r b:on(click) { --n: set(var(--n) + var(--step) + attr(data-k, 0) + var(--missing, 1)); --w: set(element(width) - viewport(width) + viewport(width)) }</style>`,
      body: '<div class="r"><b data-k="10" style="display:block;width:40px">b</b></div>' });
    await page.click('.r b');
    await page.click('.r b');
    await frames(page);
    expect(await prop(page, '.r', '--n')).toBe('28');
    expect(await prop(page, '.r', '--w')).toBe('40px');
  });
});

test.describe('drag lifecycle', () => {
  const CARDS = (n: number) => `<style>.k { --x: state(0px); --y: state(0px); --d: state(0); display: inline-block; width: 30px; height: 30px; margin: 2px; background: tomato; translate: var(--x) var(--y); touch-action: none }
    .k:on(drag) { --x: set(event(x)); --y: set(event(y)) } .k:on(drag(start)) { --d: increment(1) } .k:on(drag(end)) { --d: decrement(1) }</style>`;

  test('100 draggables: dragging one moves only that one, every time', async ({ page }) => {
    await open(page, { head: CARDS(100), body: '<i class="k"></i>'.repeat(100) });
    for (const i of [1, 50, 99, 50]) await drag(page, `.k:nth-child(${i})`, 10, 5);
    const xs = await page.$$eval('.k', (els) => els.map((e) => getComputedStyle(e).getPropertyValue('--x').trim()));
    expect(xs.filter((x) => x !== '0px')).toEqual(['10px', '20px', '10px']);
    expect(await page.$$eval('.k', (els) => els.every((e) => getComputedStyle(e).getPropertyValue('--d').trim() === '0'))).toBe(true);
  });

  test('two pointers drag two elements at once; a second pointer on a dragged element is ignored', async ({ page }) => {
    await open(page, { head: CARDS(2), body: '<i class="k" id="a"></i><i class="k" id="b"></i>' });
    await ptr(page, 'pointerdown', '#a', 1, 10, 10);
    await ptr(page, 'pointerdown', '#b', 2, 50, 10);
    await ptr(page, 'pointerdown', '#a', 3, 12, 12); // second finger on #a
    await ptr(page, 'pointermove', null, 1, 30, 10);
    await ptr(page, 'pointermove', null, 2, 50, 40);
    await ptr(page, 'pointermove', null, 3, 99, 99);
    await ptr(page, 'pointerup', null, 1, 30, 10);
    await ptr(page, 'pointerup', null, 2, 50, 40);
    await ptr(page, 'pointerup', null, 3, 99, 99);
    await frames(page);
    expect([await prop(page, '#a', '--x'), await prop(page, '#a', '--y')]).toEqual(['20px', '0px']);
    expect([await prop(page, '#b', '--x'), await prop(page, '#b', '--y')]).toEqual(['0px', '30px']);
    expect((await stats(page)).internal.gestures).toBe(0);
  });

  test('lostpointercapture cancels; the pointer released outside the element ends normally', async ({ page }) => {
    await open(page, { head: CARDS(1) + '<style>body { --c: state(0) } .k:on(drag(cancel)) { --c: increment(1) }</style>', body: '<i class="k"></i>' });
    await ptr(page, 'pointerdown', '.k', 1, 10, 10);
    await ptr(page, 'pointermove', null, 1, 40, 10);
    await page.$eval('.k', (e) => e.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 1, bubbles: true })));
    await frames(page);
    expect([await prop(page, 'body', '--c'), await prop(page, '.k', '--d')]).toEqual(['1', '0']);
    await drag(page, '.k', 400, 300); // released far outside: capture keeps the moves coming
    expect(await prop(page, '.k', '--x')).toBe('430px');
    expect(await prop(page, '.k', '--d')).toBe('0');
  });

  test('during a drag: reparenting cancels it (the browser releases pointer capture); class change or rule removal end it silently', async ({ page }) => {
    await open(page, { head: CARDS(1) + '<style id="extra">.zone .k:on(drag) { --x: set(event(x) * 2) } body { --c: state(0) } .k:on(drag(cancel)) { --c: increment(1) }</style>', body: '<div class="zone"><i class="k"></i></div><div id="other"></div>' });
    const b = (await page.locator('.k').boundingBox())!;
    const press = async () => { await page.mouse.move(b.x + 10, b.y + 10); await page.mouse.down(); await page.mouse.move(b.x + 20, b.y + 10, { steps: 2 }); };
    // reparented out of .zone: removal from the document releases pointer capture, so the drag is cancelled
    await press();
    await frames(page);
    expect(await prop(page, '.k', '--x')).toBe('20px'); // the more specific .zone rule doubled it
    await page.evaluate(() => document.getElementById('other')!.append(document.querySelector('.k')!));
    await page.mouse.move(b.x + 40, b.y + 10, { steps: 2 });
    await page.mouse.up();
    await frames(page);
    expect([await prop(page, '.k', '--x'), await prop(page, 'body', '--c'), await prop(page, '.k', '--d')]).toEqual(['20px', '1', '0']);
    expect((await stats(page)).internal.gestures).toBe(0);
    // and the moved element no longer belongs to .zone rules: the next drag uses the plain rule
    await drag(page, '.k', 10);
    expect(await prop(page, '.k', '--x')).toBe('30px');
    // class change: no drag rule matches any more: the gesture ends, nothing more runs
    await press();
    await page.$eval('.k', (e) => e.classList.replace('k', 'q'));
    await page.mouse.move(b.x + 90, b.y + 10, { steps: 2 });
    await page.mouse.up();
    await frames(page);
    expect((await stats(page)).internal.gestures).toBe(0);
    await page.$eval('.q', (e) => e.classList.replace('q', 'k'));
    // the stylesheet removed mid-drag
    await press();
    await page.evaluate(() => document.querySelectorAll('style').forEach((s) => s.remove()));
    await page.mouse.move(b.x + 90, b.y + 10, { steps: 2 });
    await page.mouse.up();
    await frames(page);
    const s = await stats(page);
    expect([s.internal.gestures, s.internal.gestureListeners]).toEqual([0, 0]);
    expect(await diagnostics(page)).toEqual([]);
  });

  test('stop() during a drag ends it; after start() the next drag works from the kept position', async ({ page }) => {
    await open(page, { head: CARDS(1), body: '<i class="k"></i>' });
    await drag(page, '.k', 20);
    const b = (await page.locator('.k').boundingBox())!;
    await page.mouse.move(b.x + 5, b.y + 5); await page.mouse.down(); await page.mouse.move(b.x + 30, b.y + 5, { steps: 3 });
    await page.evaluate(() => (window as any).ReactiveCSS.stop());
    await page.mouse.move(b.x + 60, b.y + 5, { steps: 3 }); await page.mouse.up();
    expect((await stats(page)).internal.gestureListeners).toBe(0);
    await page.evaluate(() => (window as any).ReactiveCSS.start());
    await page.waitForFunction(() => (window as any).ReactiveCSS.stats().sheets === 1);
    await drag(page, '.k', 15);
    expect(await prop(page, '.k', '--x')).toBe('15px'); // a restarted runtime starts from the declared state
  });

  test('a press in a field inside the element selects text, never drags; a button inside still drags', async ({ page }) => {
    await open(page, { head: CARDS(1) + '<style>.k { width: 200px; height: 60px }</style>', body: '<div class="k"><input value="select me please"><button>btn</button></div>' });
    await drag(page, '.k input', 60);
    expect(await prop(page, '.k', '--x')).toBe('0px');
    await drag(page, '.k button', 25);
    expect(await prop(page, '.k', '--x')).toBe('25px');
  });

  test('reduced motion does not change drag behavior; the last move is never lost', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, { head: CARDS(1), body: '<i class="k"></i>' });
    const b = (await page.locator('.k').boundingBox())!;
    await page.mouse.move(b.x + 5, b.y + 5); await page.mouse.down();
    for (let i = 1; i <= 120; i++) await page.mouse.move(b.x + 5 + i * 1.5, b.y + 5);
    await page.mouse.up();
    await frames(page);
    expect(await prop(page, '.k', '--x')).toBe('180px');
  });
});

test.describe('persistence', () => {
  test('a reload right after a change keeps it (pending write flushed on pagehide); rapid changes keep the last', async ({ page }) => {
    await open(page, { head: '<style>.p { --n: state(0, persist("h-n")) } .p b:on(click) { --n: increment(1) }</style>', body: '<div class="p"><b>b</b></div>' });
    await page.evaluate(() => localStorage.clear());
    for (let i = 0; i < 9; i++) await page.click('.p b');
    await page.reload(); // well inside the 250 ms window
    await page.waitForFunction(() => (window as any).ReactiveCSS?.stats().sheets === 1);
    expect(await prop(page, '.p', '--n')).toBe('9');
  });

  test('quota errors: one note, no corruption; unchanged values are not written again', async ({ page }) => {
    await page.addInitScript(() => {
      const set = Storage.prototype.setItem;
      (window as any).writes = 0;
      Storage.prototype.setItem = function (k: string, v: string) { (window as any).writes++; if ((window as any).full) throw new DOMException('full', 'QuotaExceededError'); return set.call(this, k, v); };
    });
    await open(page, { head: '<style>.p { --n: state(0, persist("q-n")); --o: state(1, persist("q-o")) } .p b:on(click) { --n: increment(1); --o: set(1) }</style>', body: '<div class="p"><b>b</b></div>' });
    await page.click('.p b');
    await page.waitForFunction(() => (window as any).writes >= 1);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as any).writes)).toBe(1); // --o was set to its own value: no write
    await page.evaluate(() => { (window as any).full = true; });
    await page.click('.p b');
    await page.waitForTimeout(400);
    expect(await prop(page, '.p', '--n')).toBe('2');
    expect((await diagnostics(page)).join('\n')).toMatch(/could not be stored \(QuotaExceededError\)/);
    expect(await page.evaluate(() => localStorage.getItem('rcss:q-n'))).toBe('{"t":"number","v":1}');
  });

  test('other tabs: a change arrives through the storage event, without being written back', async ({ context }) => {
    const a = await context.newPage(), b = await context.newPage();
    const css = '<style>.p { --theme: state(light, persist("tabs-theme")) } .p b:on(click) { --theme: cycle(light, dark) }</style>';
    await open(a, { head: css, body: '<div class="p"><b>b</b></div>' });
    await a.evaluate(() => localStorage.clear());
    await open(b, { head: css, body: '<div class="p"><b>b</b></div>' });
    await b.evaluate(() => { (window as any).w = 0; const s = Storage.prototype.setItem; Storage.prototype.setItem = function (...x: [string, string]) { (window as any).w++; return s.apply(this, x); }; });
    await a.click('.p b');
    await b.waitForFunction(() => getComputedStyle(document.querySelector('.p')!).getPropertyValue('--theme').trim() === 'dark');
    await b.waitForTimeout(400);
    expect(await b.evaluate(() => (window as any).w)).toBe(0);
  });

  test('types: lengths, percentages, strings; a stored value of another type is ignored; bind(value) + persist: storage wins over the control', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('rcss:t-len', '{"t":"dimension","v":1,"u":"in"}');
      localStorage.setItem('rcss:t-pct', '{"t":"dimension","v":40,"u":"%"}');
      localStorage.setItem('rcss:t-str', '{"t":"number","v":3}');
      localStorage.setItem('rcss:t-in', '{"t":"string","v":"stored"}');
    });
    await open(page, { head: `<style>.p { --len: state(0px, persist("t-len")); --pct: state(10%, persist("t-pct")); --str: state("x", persist("t-str")) }
      input { --v: state("", bind(value), persist("t-in")) }</style>`, body: '<div class="p"></div><input value="from html">' });
    await frames(page);
    expect([await prop(page, '.p', '--len'), await prop(page, '.p', '--pct'), await prop(page, '.p', '--str')]).toEqual(['96px', '40%', '"x"']);
    expect(await page.inputValue('input')).toBe('stored');
  });

  test('after stop() there are no more writes; restart reads the stored value back', async ({ page }) => {
    await open(page, { head: '<style>.p { --n: state(0, persist("s-n")) } .p b:on(click) { --n: increment(1) }</style>', body: '<div class="p"><b>b</b></div>' });
    await page.evaluate(() => localStorage.clear());
    await page.click('.p b');
    await page.evaluate(() => { (window as any).ReactiveCSS.stop(); (window as any).w = 0; const s = Storage.prototype.setItem; Storage.prototype.setItem = function (...x: [string, string]) { (window as any).w++; return s.apply(this, x); }; });
    expect(await page.evaluate(() => localStorage.getItem('rcss:s-n'))).toBe('{"t":"number","v":1}'); // flushed on release
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => (window as any).w)).toBe(0);
    await page.evaluate(() => (window as any).ReactiveCSS.start());
    await page.waitForFunction(() => (window as any).ReactiveCSS.stats().sheets === 1);
    expect(await prop(page, '.p', '--n')).toBe('1');
  });
});

test.describe('attributes and text', () => {
  test('--attr-*: no redundant writes; restore on unmatch; external changes win (the binding yields); bind() owns its attribute', async ({ page }) => {
    await open(page, { head: `<style>.r { --o: state(false); --n: state(0) } .r b:on(click) { --n: increment(1) } .r i:on(click) { --o: toggle() }
      .r.on .t { --attr-aria-expanded: var(--o) } .r .t { --attr-data-big: when(--n > 100, "yes", "no") }
      .r .own { --x: state(false, bind(aria-pressed)); --attr-aria-pressed: true }</style>`,
      body: '<div class="r on"><b>b</b><i>i</i><span class="t" aria-expanded="orig"></span><button class="own">o</button></div>' });
    await frames(page);
    await page.evaluate(() => { (window as any).m = 0; new MutationObserver((r) => { (window as any).m += r.length; }).observe(document.querySelector('.t')!, { attributes: true }); });
    for (let i = 0; i < 5; i++) await page.click('.r b'); // data-big stays "no": nothing to write
    await frames(page);
    expect(await page.evaluate(() => (window as any).m)).toBe(0);
    await page.click('.r i');
    await expect(page.locator('.t')).toHaveAttribute('aria-expanded', 'true');
    await page.$eval('.r', (e) => e.classList.remove('on'));
    await expect(page.locator('.t')).toHaveAttribute('aria-expanded', 'orig'); // restored
    await page.$eval('.r', (e) => e.classList.add('on'));
    await expect(page.locator('.t')).toHaveAttribute('aria-expanded', 'true'); // owned again before the script changes it
    await page.$eval('.t', (e) => e.setAttribute('aria-expanded', 'mixed-by-script'));
    await page.click('.r i');
    await frames(page);
    await expect(page.locator('.t')).toHaveAttribute('aria-expanded', 'mixed-by-script');
    const d = (await diagnostics(page)).join('\n');
    expect(d).toMatch(/aria-expanded on span\.t stopped: the attribute was changed by something else/);
    expect(d).toMatch(/aria-pressed on button\.own is ignored: a state\(…, bind\(aria-pressed\)\)/);
    await expect(page.locator('.own')).toHaveAttribute('aria-pressed', 'false');
  });

  test('content: empty, single text, nested HTML, several text nodes, markup in values, a pseudo-element, insertion and source replacement', async ({ page }) => {
    await open(page, { head: `<style id="s">.r { --v: state("<b>x</b> & ok") } .r .t { content: var(--v) } .r .t::before { content: "native " }</style>`,
      body: '<div class="r"><span class="t" id="e"></span><span class="t" id="one">old</span><span class="t" id="nested"><em>keep</em></span><span class="t" id="two">a<!-- c -->b</span></div>' });
    await frames(page);
    expect(await text(page, '#e')).toBe('<b>x</b> & ok');
    expect(await page.$eval('#e', (e) => e.children.length)).toBe(0); // text, never markup
    expect(await text(page, '#one')).toBe('<b>x</b> & ok');
    expect(await page.$eval('#nested', (e) => e.innerHTML)).toBe('<em>keep</em>');
    expect(await page.$eval('#two', (e) => e.childNodes.length)).toBe(3);
    expect(await page.$eval('#e', (e) => getComputedStyle(e, '::before').content)).toBe('"native "');
    const d = (await diagnostics(page)).join('\n');
    expect(d).toMatch(/span#nested\.t is ignored: the element has other content/);
    await page.evaluate(() => document.querySelector('.r')!.insertAdjacentHTML('beforeend', '<span class="t" id="late"></span>'));
    await frames(page);
    expect(await text(page, '#late')).toBe('<b>x</b> & ok');
    await page.evaluate(() => { document.getElementById('s')!.textContent = '.r { --v: state("v2") } .r .t { content: var(--v) }'; });
    await frames(page);
    expect(await text(page, '#one')).toBe('v2');
    await page.evaluate(() => { document.getElementById('s')!.textContent = '.r .t { color: red }'; });
    await frames(page);
    expect(await text(page, '#one')).toBe('old'); // the original text comes back
    expect(await text(page, '#e')).toBe('');
  });
});

test.describe('focus and blur', () => {
  const FOCUS = `<style>.d { --o: state(false) } .d .t:on(click) { --o: toggle() } .d .f { focus: when(--o) } .d:when(--o) .f { display: inline-block } .d .f { display: none }</style>`;

  test('initially true never focuses; repeated true never refocuses; a user move is respected', async ({ page }) => {
    await open(page, { head: `<style>.d { --o: state(true) } .d .t:on(click) { --o: set(true) } .d .f { focus: when(--o) }</style>`, body: '<div class="d"><button class="t">t</button><input class="f"><input class="g"></div>' });
    await frames(page);
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await page.click('.d .t');
    await frames(page);
    await expect(page.locator('.d .f')).not.toBeFocused(); // still true: no transition, no focus move
  });

  test('false → true focuses; hidden, disabled, removed and non-focusable targets are skipped with a note; the first eligible target wins', async ({ page }) => {
    await open(page, { head: FOCUS + '<style>.d .f[disabled] { display: inline-block }</style>', body: '<div class="d"><button class="t">t</button><input class="f" disabled><span class="f" id="nf">x</span><input class="f" id="ok"><input class="f" id="second"></div>' });
    await page.click('.d .t');
    await expect(page.locator('#ok')).toBeFocused();
    const d = (await diagnostics(page)).join('\n');
    expect(d).toMatch(/is disabled; focus is unchanged/);
    expect(d).toMatch(/span#nf\.f is not focusable/);
    await page.click('.d .t');
    await page.evaluate(() => document.getElementById('ok')!.remove());
    await page.click('.d .t');
    await expect(page.locator('#second')).toBeFocused();
  });

  test('a dialog: opening focuses its field; Escape closes it; reopening by keyboard focuses again; rule removal stops requests', async ({ page }) => {
    await open(page, { head: `<style id="s">.m { --o: state(false) } .m .open:on(click) { --o: set(true) } .m .sheet:on(keydown(Escape)) { --o: set(false) }
      .m .sheet { display: none } .m:when(--o) .sheet { display: block } .m .sheet input { focus: when(--o) } .m .open { focus: when(not --o) }</style>`,
      body: '<div class="m"><button class="open">open</button><div class="sheet"><input></div></div>' });
    await page.click('.m .open');
    await expect(page.locator('.m input')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('.m .open')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.m input')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('.m .open')).toBeFocused();
    await page.evaluate(() => { const s = document.getElementById('s')!; s.textContent = s.textContent!.replace('.m .sheet input { focus: when(--o) }', ''); });
    await frames(page);
    await page.click('.m .open');
    await frames(page, 3);
    await expect(page.locator('.m .sheet')).toBeVisible();
    await expect(page.locator('.m input')).not.toBeFocused(); // no request any more
  });

  test(':blur: repeated and very fast cycles, nested fields, animation end and cancel, removal, stop/start', async ({ page }) => {
    await open(page, { head: '<style>@keyframes k { to { opacity: 0.5 } } input:blur { animation: k 50ms } .wrap:has(:blur) { outline: 1px solid } .na:blur { color: red }</style>',
      body: '<div class="wrap"><input id="a"><input id="b"></div><input class="na" id="c">' });
    const marked = (id: string) => page.$eval(`#${id}`, (e) => e.hasAttribute('data-rcss-blur'));
    for (let i = 0; i < 20; i++) { await page.focus('#a'); await page.focus('#b'); }
    expect([await marked('a'), await marked('b')]).toEqual([true, false]);
    expect(await page.$eval('.wrap', (e) => getComputedStyle(e).outlineStyle)).toBe('solid');
    await page.waitForTimeout(120); // the animation ended: the marker stays until the next focus
    expect(await marked('a')).toBe(true);
    await page.focus('#a'); // focus removes it: an animation in progress is cancelled with it
    expect(await marked('a')).toBe(false);
    await page.focus('#c'); await page.focus('#a');
    expect(await page.$eval('#c', (e) => getComputedStyle(e).color)).toBe('rgb(255, 0, 0)'); // no animation declared: still matches
    await page.evaluate(() => { document.getElementById('c')!.remove(); (window as any).ReactiveCSS.stop(); });
    expect(await marked('b')).toBe(false);
    await page.evaluate(() => (window as any).ReactiveCSS.start());
    await page.waitForFunction(() => (window as any).ReactiveCSS.stats().sheets === 1);
    await page.focus('#b'); await page.focus('#a');
    expect(await marked('b')).toBe(true);
  });
});
