// Pre-beta runtime stabilization: regressions found by the internal experiments
// (docs/prebeta-runtime-stabilization.md). Each test is the minimal repro from the experiment's notes.
import { test, expect } from '@playwright/test';
import { open, frames, diagnostics } from './helpers';

test.describe('focus: armed by a keydown (command palette)', () => {
  const css = `
    .box { --open: state(true); }
    .box .open { on: click(set(--open, true)); attr: aria-expanded var(--open); }
    .box:when(not --open) .open { focus: true; }
    .box .field { on: key(Enter, set(--open, false)); }`;

  test('Enter in a field whose action moves focus to a button does not also click that button', async ({ page }) => {
    await open(page, { head: `<style>${css}</style>`, body: `<div class="box"><button class="open">open</button><input class="field"></div>` });
    let clicks = 0;
    await page.exposeFunction('clicked', () => clicks++);
    await page.evaluate(() => document.querySelector('.open')!.addEventListener('click', () => (window as any).clicked()));
    await page.focus('.field');
    await page.keyboard.press('Enter');
    await expect(page.locator('.open')).toBeFocused();
    await frames(page);
    expect(clicks).toBe(0);
    expect(await page.getAttribute('.open', 'aria-expanded')).toBe('false');
    // Native activation of the focused button is untouched.
    await page.keyboard.press('Enter');
    await expect(page.locator('.open')).toHaveAttribute('aria-expanded', 'true');
    expect(clicks).toBe(1);
    expect(await diagnostics(page)).toEqual([]);
  });

  test('Enter still submits the form it was pressed in', async ({ page }) => {
    await open(page, { head: `<style>${css}</style>`, body: `<div class="box"><form><input class="field" name="q"></form><button class="open">open</button></div>` });
    await page.evaluate(() => { (window as any).n = 0; document.querySelector('form')!.addEventListener('submit', (e) => { e.preventDefault(); (window as any).n++; }); });
    await page.focus('.field');
    await page.keyboard.press('Enter');
    await expect(page.locator('.open')).toBeFocused();
    expect(await page.evaluate(() => (window as any).n)).toBe(1);
    expect(await page.getAttribute('.open', 'aria-expanded')).toBe('false');
    expect(await diagnostics(page)).toEqual([]);
  });

  test('a shortcut key that moves focus into a text field is not typed into it', async ({ page }) => {
    await open(page, {
      head: `<style>.s { --find: state(false); } .s { on: key(k, set(--find, true)); } .s .q { attr: data-find var(--find); } .s:when(--find) .q { focus: true; }</style>`,
      body: `<div class="s"><button class="b">b</button><input class="q"></div>`,
    });
    await page.focus('.s .b');
    await page.keyboard.press('k');
    await expect(page.locator('.s .q')).toBeFocused();
    expect(await page.inputValue('.s .q')).toBe('');
    expect(await diagnostics(page)).toEqual([]);
  });
});

test.describe(':changed() and other animations in its subtree (dashboard)', () => {
  const css = (extra: string) => `
    @keyframes a { to { opacity: .99 } } @keyframes b { to { opacity: .98 } } @keyframes bump { to { scale: 1.1 } }
    .box { --n: state(0); --p: state(false); }
    .box .go { on: click(increment(--n), toggle(--p)); }
    .clock { animation: a 3s; }
    .box:when(--p) .clock { animation-name: b; }
    ${extra}`;
  const flashing = (page: import('@playwright/test').Page) => page.$eval('.num', (e) => getComputedStyle(e).color === 'rgb(255, 0, 0)');

  test('an unrelated animation restarting in the same frame does not hold the marker', async ({ page }) => {
    await open(page, { head: `<style>${css('.box:changed(--n) .num { animation: bump 150ms; color: rgb(255, 0, 0); }')}</style>`, body: `<div class="box"><button class="go">go</button><i class="clock">c</i><b class="num">n</b></div>` });
    await page.click('.go');
    await expect.poll(() => flashing(page)).toBe(true);
    // The bump (150 ms) ends; the clock's new 3 s animation must not keep :changed() matching.
    await expect.poll(() => flashing(page), { timeout: 1000 }).toBe(false);
    // The next change starts the bump again.
    await page.click('.go');
    await expect.poll(() => flashing(page)).toBe(true);
    await expect.poll(() => flashing(page), { timeout: 1000 }).toBe(false);
    expect(await diagnostics(page)).toEqual([]);
  });

  test('a marker rule that sets a custom property still waits for every transition it may start', async ({ page }) => {
    await open(page, {
      head: `<style>${css('.box:changed(--n) { --flash: 1; } .num { color: rgb(calc(var(--flash, 0) * 255), 0, 0); transition: color 400ms steps(1, end); }')}</style>`,
      body: `<div class="box"><button class="go">go</button><i class="clock">c</i><b class="num">n</b></div>`,
    });
    await page.click('.go');
    // The transition to red (400 ms) needs the marker for its whole duration to complete.
    await expect.poll(() => flashing(page), { timeout: 2000 }).toBe(true);
    expect(await diagnostics(page)).toEqual([]);
  });
});

test.describe('text: in a section hidden by CSS (wizard)', () => {
  const css = `.c { --v: state(""); --show: state(true); } .c .i { bind: --v; } .c .t { on: click(toggle(--show)); }
    .c:when(not --show) .box { display: none; } .c .o { text: var(--v); }`;
  const body = `<div class="c"><input class="i"><button type="button" class="t">toggle</button><p class="box"><span class="o">-</span></p></div>`;

  test('a section shown again by a state change shows the current value', async ({ page }) => {
    await open(page, { head: `<style>${css}</style>`, body });
    await page.fill('.i', 'a');
    await page.click('.t'); // hide
    await page.fill('.i', 'ab');
    await page.fill('.i', 'abc');
    await page.click('.t'); // show: the state change re-reads the text
    await expect(page.locator('.o')).toHaveText('abc');
    expect(await diagnostics(page)).toEqual([]);
  });

  test('engine: an element rendered once keeps its computed style current while an ancestor is display: none', async ({ page, browserName }) => {
    test.fail(browserName === 'webkit', 'WebKit bug (Playwright WebKit 2370): getComputedStyle() returns the inherited value from before the ancestor was hidden. No Reactive CSS on this page.');
    await page.setContent(`<style>.c[data-h] .box { display: none }</style><div class="c" style="--v: a"><p class="box"><span class="o">x</span></p></div>`);
    const seen = await page.evaluate(async () => {
      const c = document.querySelector('.c') as HTMLElement, o = document.querySelector('.o')!;
      const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      getComputedStyle(o).getPropertyValue('--v');
      await raf();
      c.setAttribute('data-h', '');
      getComputedStyle(o).getPropertyValue('--v');
      c.style.setProperty('--v', 'b');
      return getComputedStyle(o).getPropertyValue('--v').trim();
    });
    expect(seen).toBe('b');
  });
});

test.describe('attr: that depends on :has(:invalid) (wizard)', () => {
  test('engine: :has(:invalid) applies after a required <select> is enabled', async ({ page, browserName }) => {
    test.fail(browserName === 'webkit', 'WebKit bug (Playwright WebKit 2370): removing disabled from a required, empty <select> does not invalidate :has(:invalid), although matches() is true. No Reactive CSS on this page.');
    await page.setContent(`<style>.f .b { color: rgb(0, 128, 0) } .f:has(:invalid) .b { color: rgb(255, 0, 0) }</style>
      <form class="f"><select class="t" required disabled><option value="">-</option><option>x</option></select><button type="button" class="b">Go</button></form>`);
    await page.evaluate(() => document.querySelector('.t')!.removeAttribute('disabled'));
    expect(await page.evaluate(() => document.querySelector('.f')!.matches(':has(:invalid)'))).toBe(true);
    await expect.poll(() => page.$eval('.b', (e) => getComputedStyle(e).color), { timeout: 1000 }).toBe('rgb(255, 0, 0)');
  });

  test('a condition on state gives the same gate in both engines', async ({ page }) => {
    await open(page, {
      head: `<style>.f { --on: state(a); --size: state(""); } .f .c { bind: --on; } .f .t { bind: --size; attr: disabled when(--on != b); }
        .f .b { attr: aria-disabled when(--on == b and --size == "", true, false); }</style>`,
      body: `<form class="f"><select class="c"><option>a</option><option>b</option></select><select class="t" required disabled><option value="">-</option><option>x</option></select><button type="button" class="b">Go</button></form>`,
    });
    await expect(page.locator('.b')).toHaveAttribute('aria-disabled', 'false');
    await page.selectOption('.c', 'b');
    await expect(page.locator('.b')).toHaveAttribute('aria-disabled', 'true');
    await page.selectOption('.t', 'x');
    await expect(page.locator('.b')).toHaveAttribute('aria-disabled', 'false');
    expect(await diagnostics(page)).toEqual([]);
  });
});

test.describe('live() under :when() (dashboard): documented behavior', () => {
  test(':when() decides where the value applies; the source runs while its element is bound', async ({ page }) => {
    await open(page, {
      head: `<style>.box { --on: state(false); } .box button { on: click(toggle(--on)); } .box:when(--on) .dot { --x: live(random(1, 100), 50ms); } .dot { display: block; width: calc(var(--x, 0) * 1px); }</style>`,
      body: `<div class="box"><button>t</button><i class="dot"></i></div>`,
    });
    const width = () => page.$eval('.dot', (e) => parseFloat(getComputedStyle(e).width));
    expect(await width()).toBe(0);
    await page.click('button');
    await expect.poll(width).toBeGreaterThan(0);
    await page.click('button');
    await expect.poll(width).toBe(0);
    // Superset binding (README, Bindings): the timer keeps running; the value no longer applies.
    expect((await page.evaluate(() => window.ReactiveCSS.stats())).scheduled).toBe(1);
    expect(await diagnostics(page)).toEqual([]);
  });

  test('a native attribute (details[open]) starts and releases the source', async ({ page }) => {
    await open(page, {
      head: `<style>.box[open] .dot { --x: live(random(1, 100), 50ms); } .dot { display: block; width: calc(var(--x, 0) * 1px); }</style>`,
      body: `<details class="box"><summary>s</summary><i class="dot"></i></details>`,
    });
    const scheduled = () => page.evaluate(() => window.ReactiveCSS.stats().scheduled);
    expect(await scheduled()).toBe(0);
    await page.click('summary');
    await expect.poll(scheduled).toBe(1);
    await page.click('summary');
    await expect.poll(scheduled).toBe(0);
    expect(await diagnostics(page)).toEqual([]);
  });
});

test.describe('element() before the first measurement (motion): documented behavior', () => {
  test('a new element has no value until measured, so var() fallbacks apply; the value arrives within a few frames', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page, { head: `<style>.m { width: 120px; height: 10px; --w: element(width); } .o { width: var(--w, 77px); height: 10px; }</style>` });
    const log: string[] = await page.evaluate(() => new Promise((done) => {
      const m = document.createElement('div'); m.className = 'm'; m.innerHTML = '<div class="o"></div>';
      document.body.append(m);
      const o = m.firstElementChild!, out = [getComputedStyle(o).width];
      const t = () => { out.push(getComputedStyle(o).width); if (out.length < 8) requestAnimationFrame(t); else done(out); };
      requestAnimationFrame(t);
    }));
    expect(log[0]).toBe('77px'); // the fallback, never 0px
    const at = log.indexOf('120px');
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThanOrEqual(4);
    expect(log.slice(at).every((w) => w === '120px')).toBe(true);
    expect(errors).toEqual([]);
    expect(await diagnostics(page)).toEqual([]);
  });
});

test.describe('bind: on checkboxes and radios with click actions on the page (visual lab: equalizer)', () => {
  const head = (extra = '') => `<style>.g { --p: state(a); --c: state(false); --n: state(0); } .g [name=p] { bind: --p; } .g [type=checkbox] { bind: --c; }
    .g button { on: click(increment(--n)); } .g output { text: var(--p); } ${extra}</style>`;
  const body = `<div class="g"><input type="radio" name="p" value="a" checked><input type="radio" name="p" value="b"><input type="radio" name="p" value="c">
    <input type="checkbox"><button>+</button><output></output></div>`;
  const state = (page: import('@playwright/test').Page, name: string) => page.$eval('.g', (e, n) => getComputedStyle(e).getPropertyValue(n).trim(), name);

  test('two arrow-key moves in one frame both land on the radio group', async ({ page }) => {
    await open(page, { head: head(), body });
    await page.focus('[value=a]');
    // Both keydowns before the next frame: the browser checks b, then c, firing click + input + change each time.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await frames(page, 2);
    expect(await page.evaluate(() => [(document.activeElement as HTMLInputElement).value, document.querySelector<HTMLInputElement>('[name=p]:checked')!.value])).toEqual(['c', 'c']);
    await expect(page.locator('.g output')).toHaveText('c');
    expect(await diagnostics(page)).toEqual([]);
  });

  test('two radio choices in one task (what arrow keys do: check, then click) both land', async ({ page }) => {
    await open(page, { head: head(), body });
    await page.evaluate(() => { document.querySelector<HTMLInputElement>('[value=b]')!.click(); document.querySelector<HTMLInputElement>('[value=c]')!.click(); });
    await frames(page, 2);
    expect(await page.$eval('[name=p]:checked', (e) => (e as HTMLInputElement).value)).toBe('c');
    expect(await state(page, '--p')).toBe('c');
    await expect(page.locator('.g output')).toHaveText('c');
    expect(await diagnostics(page)).toEqual([]);
  });

  test('two clicks on a bound checkbox in one task leave it unchecked, and the state follows', async ({ page }) => {
    await open(page, { head: head(), body });
    await page.evaluate(() => { const c = document.querySelector<HTMLInputElement>('.g [type=checkbox]')!; c.click(); c.click(); });
    await frames(page, 2);
    expect(await page.isChecked('.g [type=checkbox]')).toBe(false);
    expect(await state(page, '--c')).toBe('0');
    expect(await diagnostics(page)).toEqual([]);
  });

  test('a cancelled click changes neither the control nor the state', async ({ page }) => {
    await open(page, { head: head('.g [type=checkbox] { on: click(prevent()); }'), body });
    await page.click('.g [type=checkbox]');
    await frames(page, 2);
    expect(await page.isChecked('.g [type=checkbox]')).toBe(false);
    expect(await state(page, '--c')).toBe('0');
    // Radios still work afterwards.
    await page.click('[value=b]');
    await expect(page.locator('.g output')).toHaveText('b');
    expect(await diagnostics(page)).toEqual([]);
  });

  test('the window click listener exists only while bound controls do, across stop() and start()', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'listener inspection needs the Chrome DevTools Protocol');
    await open(page, { head: head(), body });
    const cdp = await page.context().newCDPSession(page);
    const windowClicks = async () => {
      const { result } = await cdp.send('Runtime.evaluate', { expression: 'window' });
      const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId! });
      return listeners.filter((l) => l.type === 'click' && l.useCapture).length;
    };
    // Playwright's own injected script also listens on window: count relative to the stopped runtime.
    const running = await windowClicks();
    await page.evaluate(() => (window as any).ReactiveCSS.stop());
    const base = await windowClicks();
    expect(running - base).toBe(1);
    await page.evaluate(() => (window as any).ReactiveCSS.start());
    await page.waitForFunction(() => (window as any).ReactiveCSS.stats().sheets >= 1);
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => (window as any).ReactiveCSS.stop());
      expect(await windowClicks(), `after stop() ${i + 1}`).toBe(base);
      await page.evaluate(() => (window as any).ReactiveCSS.start());
      await page.waitForFunction(() => (window as any).ReactiveCSS.stats().sheets >= 1);
      await frames(page, 2);
      expect(await windowClicks(), `after start() ${i + 1}`).toBe(base + 1);
    }
    // The last bound control removed: the listener goes; a new one brings it back, once.
    const html = await page.$eval('.g', (e) => e.outerHTML);
    await page.evaluate(() => document.querySelector('.g')!.remove());
    await frames(page, 2);
    expect(await windowClicks()).toBe(base);
    await page.evaluate((h) => document.body.insertAdjacentHTML('beforeend', h), html);
    await frames(page, 2);
    expect(await windowClicks()).toBe(base + 1);
    // and the fix still works after the cycles
    await page.evaluate(() => { document.querySelector<HTMLInputElement>('[value=b]')!.click(); document.querySelector<HTMLInputElement>('[value=c]')!.click(); });
    await frames(page, 2);
    expect(await state(page, '--p')).toBe('c');
    expect(await diagnostics(page)).toEqual([]);
  });
});
