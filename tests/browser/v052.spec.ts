// 0.5.2: state(initial, bind(attribute)) — a state mirrored to an allowlisted attribute of its owner.
import { test, expect, type Page } from '@playwright/test';
import { open, frames, stats, diagnostics } from './helpers';

const attr = (page: Page, sel: string, name: string) => page.$eval(sel, (e, n) => e.getAttribute(n), name);
const css = (page: Page, sel: string, p: string) => page.$eval(sel, (e, p) => getComputedStyle(e).getPropertyValue(p).trim(), p);

test.describe('the acceptance case', () => {
  test('a menu button toggles a real aria-expanded attribute', async ({ page }) => {
    await open(page, {
      head: `<style>.menu { --open: state(false, bind(aria-expanded)); on: click(toggle(--open)) } .menu:when(--open) + ul { display: block } ul { display: none }</style>`,
      body: '<button class="menu" aria-expanded="false">Menu</button><ul><li>a</li></ul>',
    });
    expect(await attr(page, '.menu', 'aria-expanded')).toBe('false');
    await page.click('.menu');
    expect(await attr(page, '.menu', 'aria-expanded')).toBe('true'); // written synchronously by the click
    await expect.poll(() => css(page, 'ul', 'display')).toBe('block');
    await page.focus('.menu'); // WebKit does not focus a button on click
    await page.keyboard.press('Enter'); // keyboard toggles too
    expect(await attr(page, '.menu', 'aria-expanded')).toBe('false');
    expect(await page.locator('.menu').ariaSnapshot()).toContain('button "Menu"');
    expect(await diagnostics(page)).toEqual([]);
  });
});

test.describe('initialization', () => {
  test('a valid attribute initializes the state; a missing one uses state(); the effective value is written back', async ({ page }) => {
    await open(page, {
      head: `<style>.b { --open: state(false, bind(aria-expanded)) } .b::after { content: "" }</style>`,
      body: '<button class="b" id="t" aria-expanded="true">t</button><button class="b" id="m">m</button>',
    });
    expect(await css(page, '#t', '--open')).toBe('1');
    expect(await css(page, '#m', '--open')).toBe('0');
    expect(await attr(page, '#m', 'aria-expanded')).toBe('false'); // written: ARIA false is explicit
  });

  test('an invalid value is reported, ignored, and rewritten to the effective state', async ({ page }) => {
    await open(page, {
      head: `<style>.b { --open: state(false, bind(aria-expanded)) } .n { --n: state(5, bind(data-n)) }</style>`,
      body: '<button class="b" aria-expanded="invalid">b</button><div class="n" data-n="12px"></div>',
    });
    expect(await css(page, '.b', '--open')).toBe('0');
    expect(await attr(page, '.b', 'aria-expanded')).toBe('false');
    expect(await css(page, '.n', '--n')).toBe('5');
    expect(await attr(page, '.n', 'data-n')).toBe('5');
    const d = (await diagnostics(page)).join('\n');
    expect(d).toMatch(/aria-expanded="invalid" on button\.b is not a valid value/);
    expect(d).toMatch(/data-n="12px" on div\.n is not a valid value/);
  });

  test('strings (including empty), numbers, dimensions, booleans and keywords from data-*', async ({ page }) => {
    await open(page, {
      head: `<style>.d { --s: state("idle", bind(data-s)); --e: state("x", bind(data-e)); --n: state(0, bind(data-n)); --w: state(10px, bind(data-w));
        --f: state(false, bind(data-f)); --k: state(dark, bind(data-k)) } .d::after { content: var(--s) }</style>`,
      body: '<div class="d" data-s="loading" data-e="" data-n="-2.5" data-w="24px" data-f="true" data-k="light"></div><div class="d" id="x"></div>',
    });
    expect(await page.$eval('.d', (e) => ['--s', '--e', '--n', '--w', '--f', '--k'].map((p) => getComputedStyle(e).getPropertyValue(p).trim())))
      .toEqual(['"loading"', '""', '-2.5', '24px', '1', 'light']);
    expect(await page.$eval('#x', (e) => ['data-s', 'data-e', 'data-n', 'data-w', 'data-f', 'data-k'].map((a) => e.getAttribute(a))))
      .toEqual(['idle', 'x', '0', '10px', 'false', 'dark']);
  });

  test('an attr() initializer still only initializes; a plain state() writes no attribute', async ({ page }) => {
    await open(page, {
      head: `<style>.p { --name: state(attr(data-name)); --c: state(0) } .p b { on: click(set(--name, "changed"), increment(--c)) }</style>`,
      body: '<div class="p" data-name="Ada"><b>b</b></div>',
    });
    await page.click('.p b');
    await frames(page);
    expect(await css(page, '.p', '--name')).toBe('"changed"');
    expect(await attr(page, '.p', 'data-name')).toBe('Ada'); // not bound
    expect(await page.$eval('.p', (e) => e.getAttributeNames())).toEqual(['class', 'data-name', 'style']);
  });
});

test.describe('attribute semantics', () => {
  test('boolean HTML attributes: presence is true, absence false; never disabled="false"; hidden="until-found" is kept', async ({ page }) => {
    await open(page, {
      head: `<style>.f { --d: state(false, bind(disabled)); --r: state(true, bind(required)) } .h { --h: state(false, bind(hidden)) }
        .t { on: click(toggle(--d, closest(.w))) } .w { --d: state(false); display: block }</style>`,
      body: `<div class="w"><input class="f" disabled><input class="f" id="b"><p class="h" hidden="until-found">h</p></div>`,
    });
    expect([await attr(page, 'input.f', 'disabled'), await attr(page, '#b', 'disabled')]).toEqual(['', null]);
    expect(await attr(page, '#b', 'required')).toBe(''); // missing: the state() initial value, true
    expect(await css(page, '.h', '--h')).toBe('1'); // present (whatever its value) is true
    expect(await attr(page, '.h', 'hidden')).toBe('until-found');
    const html = await page.$eval('.w', (w) => w.innerHTML);
    expect(html).not.toContain('="false"');
  });

  test('aria-pressed, aria-selected and aria-current (boolean and tokens)', async ({ page }) => {
    await open(page, {
      head: `<style>.p { --on: state(false, bind(aria-pressed)); on: click(toggle(--on)) } .s { --sel: state(true, bind(aria-selected)) }
        .c { --cur: state(false, bind(aria-current)); on: click(toggle(--cur)) } .k { --where: state(page, bind(aria-current)); on: click(cycle(--where, page, step, location)) }</style>`,
      body: '<button class="p">p</button><div class="s" role="tab">s</div><a class="c" href="#x">c</a><a class="k" href="#y" aria-current="step">k</a>',
    });
    expect(await attr(page, '.p', 'aria-pressed')).toBe('false');
    await page.click('.p');
    expect(await attr(page, '.p', 'aria-pressed')).toBe('true');
    expect(await attr(page, '.s', 'aria-selected')).toBe('true');
    await page.click('.c');
    expect(await attr(page, '.c', 'aria-current')).toBe('true');
    expect(await attr(page, '.k', 'aria-current')).toBe('step'); // token from the markup
    await page.click('.k');
    expect(await attr(page, '.k', 'aria-current')).toBe('location');
    await page.click('.k');
    expect(await attr(page, '.k', 'aria-current')).toBe('page');
  });

  test('every action updates the attribute: set, toggle, increment, decrement, cycle', async ({ page }) => {
    await open(page, {
      head: `<style>.c { --n: state(0, bind(data-count)); --mode: state("idle", bind(data-mode)); --on: state(false, bind(data-on)) }
        .c .i { on: click(increment(--n), increment(--n)) } .c .d { on: click(decrement(--n, 5)) } .c .s { on: click(set(--mode, "loading")) }
        .c .y { on: click(cycle(--mode, "idle", "loading", "done")) } .c .t { on: click(toggle(--on)) }</style>`,
      body: '<div class="c"><b class="i">i</b><b class="d">d</b><b class="s">s</b><b class="y">y</b><b class="t">t</b></div>',
    });
    const a = () => page.$eval('.c', (e) => [e.getAttribute('data-count'), e.getAttribute('data-mode'), e.getAttribute('data-on')]);
    await page.click('.c .i'); await page.click('.c .d'); await page.click('.c .s'); await page.click('.c .y'); await page.click('.c .t');
    expect(await a()).toEqual(['-3', 'done', 'true']);
  });

  test('values are attribute text, never markup or CSS; a keyword state only accepts an identifier', async ({ page }) => {
    await open(page, {
      head: `<style>.x { --s: state("", bind(data-s)); --k: state(red, bind(data-k)) } .x b { on: click(set(--s, attr(data-v))) } .x .k { background: var(--k) }</style>`,
      body: `<div class="x" data-k="url(https://example.invalid/x)"><b data-v='"><img src=x onerror="alert(1)">'>b</b><i class="k">k</i></div>`,
    });
    let dialogs = 0;
    page.on('dialog', (d) => { dialogs++; d.dismiss(); });
    await page.click('.x b');
    expect(await attr(page, '.x', 'data-s')).toBe('"><img src=x onerror="alert(1)">');
    expect(await page.$$eval('img', (i) => i.length)).toBe(0);
    expect(await css(page, '.x', '--k')).toBe('red'); // the url() keyword was rejected
    expect(await attr(page, '.x', 'data-k')).toBe('red');
    expect((await diagnostics(page)).join('\n')).toMatch(/data-k="url\(https:\/\/example\.invalid\/x\)" on div\.x is not a valid value/);
    expect(dialogs).toBe(0);
  });
});

test.describe('timing and native behavior', () => {
  test('a disabled attribute set by one click is in place before the next event: a second click in the same task does nothing', async ({ page }) => {
    await open(page, {
      head: `<style>.form { --n: state(0) } .once { --done: state(false, bind(disabled)); on: click(set(--done, true), increment(--n)) }</style>`,
      body: '<div class="form"><button class="once">submit once</button></div>',
    });
    await page.$eval('.once', (b) => { (b as HTMLElement).click(); (b as HTMLElement).click(); (b as HTMLElement).click(); });
    await frames(page);
    expect(await css(page, '.form', '--n')).toBe('1');
    expect(await attr(page, '.once', 'disabled')).toBe('');
    expect(await page.$eval('.once', (b) => (b as HTMLButtonElement).matches(':disabled'))).toBe(true);
  });
});

test.describe('cascade', () => {
  test('the winning declaration chooses the binding: specificity, source order, layers, media, !important', async ({ page }) => {
    await open(page, {
      head: `<style>
        .button { --open: state(false, bind(aria-expanded)) }
        .dialog .button { --open: state(true, bind(data-open)) }
        @layer a, b; @layer b { .l { --o: state(true, bind(data-b)) } } @layer a { .l.l.l { --o: state(false, bind(data-a)) } }
        .i { --o: state(true, bind(data-imp)) !important } .i.i { --o: state(false, bind(data-normal)) }
        .m { --o: state(false, bind(data-base)) } @media (max-width: 1px) { .m.m { --o: state(true, bind(data-tiny)) } }
      </style>`,
      body: '<button class="button" id="plain">p</button><div class="dialog"><button class="button" id="dlg">d</button></div><p class="l"></p><p class="i"></p><p class="m"></p>',
    });
    expect([await attr(page, '#plain', 'aria-expanded'), await attr(page, '#plain', 'data-open')]).toEqual(['false', null]);
    expect([await attr(page, '#dlg', 'data-open'), await attr(page, '#dlg', 'aria-expanded')]).toEqual(['true', null]);
    expect([await attr(page, '.l', 'data-b'), await attr(page, '.l', 'data-a')]).toEqual(['true', null]);
    expect([await attr(page, '.i', 'data-imp'), await attr(page, '.i', 'data-normal')]).toEqual(['true', null]);
    expect([await attr(page, '.m', 'data-base'), await attr(page, '.m', 'data-tiny')]).toEqual(['false', null]);
  });

  test('a later winning stylesheet switches the binding before any change (old attribute restored), never after', async ({ page }) => {
    await open(page, {
      head: `<style>.c { --o: state(false, bind(data-first)) } .c b { on: click(toggle(--o)) }</style>`,
      body: '<div class="c" id="u"></div><div class="c" id="t"><b>b</b></div>',
    });
    await page.click('#t b');
    await page.evaluate(() => { const s = document.createElement('style'); s.textContent = '.c.c { --o: state(false, bind(data-second)) }'; document.head.append(s); });
    await frames(page);
    expect([await attr(page, '#u', 'data-first'), await attr(page, '#u', 'data-second')]).toEqual([null, 'false']); // unchanged state: switched, old one restored (absent)
    expect([await attr(page, '#t', 'data-first'), await attr(page, '#t', 'data-second')]).toEqual(['true', null]); // changed state: kept its binding
  });
});

test.describe('lifecycle', () => {
  test('removal restores the original attribute; reinsertion starts again from it; sheet removal restores; stats return to zero', async ({ page }) => {
    await open(page, {
      head: `<style id="s">.m { --open: state(false, bind(aria-expanded)); on: click(toggle(--open)) }</style>`,
      body: '<div id="host"><button class="m" aria-expanded="false">m</button><button class="m" id="n">n</button></div>',
    });
    await page.click('.m');
    expect(await attr(page, '.m', 'aria-expanded')).toBe('true');
    const after = await page.evaluate(async () => {
      const b = document.querySelector('.m')!; b.remove();
      await new Promise((r) => setTimeout(r));
      const detached = b.getAttribute('aria-expanded');
      document.getElementById('host')!.prepend(b);
      await new Promise((r) => setTimeout(r));
      return [detached, b.getAttribute('aria-expanded')];
    });
    expect(after).toEqual(['false', 'false']); // restored on removal; a new state from the original
    await page.click('#n');
    expect(await attr(page, '#n', 'aria-expanded')).toBe('true');
    await page.evaluate(() => document.getElementById('s')!.remove());
    await frames(page);
    expect([await attr(page, '.m', 'aria-expanded'), await attr(page, '#n', 'aria-expanded')]).toEqual(['false', null]);
    const s = await stats(page);
    expect([s.states, s.bindings]).toEqual([0, 0]);
  });

  test('something else changing the attribute is not read back; the next change overwrites it; removal then leaves it alone', async ({ page }) => {
    await open(page, {
      head: `<style>.m { --open: state(false, bind(aria-expanded)); on: click(toggle(--open)) }</style>`,
      body: '<div id="host"><button class="m">m</button></div>',
    });
    await page.evaluate(() => document.querySelector('.m')!.setAttribute('aria-expanded', 'true'));
    await frames(page);
    expect(await css(page, '.m', '--open')).toBe('0'); // not a state change
    await page.click('.m'); // false -> true
    expect(await attr(page, '.m', 'aria-expanded')).toBe('true');
    expect((await diagnostics(page)).join('\n')).toMatch(/was changed by something else/);
    await page.evaluate(() => document.querySelector('.m')!.setAttribute('aria-expanded', 'mixed'));
    await page.evaluate(() => document.getElementById('host')!.replaceChildren());
    await frames(page);
    expect((await stats(page)).states).toBe(0);
  });

  test('nested owners and dynamic insertion: each owner binds its own attribute', async ({ page }) => {
    await open(page, {
      head: `<style>.g { --n: state(0, bind(data-n)) } .g > b { on: click(increment(--n)) }</style>`,
      body: '<div class="g" id="o"><b>o</b><div class="g" id="i"><b>i</b></div></div><div id="host"></div>',
    });
    await page.click('#i > b'); await page.click('#i > b'); await page.click('#o > b');
    expect([await attr(page, '#o', 'data-n'), await attr(page, '#i', 'data-n')]).toEqual(['1', '2']);
    await page.evaluate(() => { document.getElementById('host')!.innerHTML = '<div class="g" id="d" data-n="7"><b>d</b></div>'; });
    await frames(page);
    await page.click('#d > b');
    expect(await attr(page, '#d', 'data-n')).toBe('8');
  });

  test('a selector that depends on the bound attribute cannot loop', async ({ page }) => {
    await open(page, {
      head: `<style>.m[aria-expanded] { --open: state(true, bind(aria-expanded)) } .m[aria-expanded="true"] { --x: pick(1px) } .m { on: click(toggle(--open)) }</style>`,
      body: '<button class="m" aria-expanded="false">m</button>',
    });
    for (let i = 0; i < 5; i++) await page.click('.m');
    await frames(page, 5);
    const s = await stats(page);
    expect(s.states).toBe(1);
    expect(await attr(page, '.m', 'aria-expanded')).toBe('true');
    expect(s.stateChanges).toBe(5);
  });
});

test.describe('with text:, bind: and strict CSP', () => {
  test('the attribute, the text and a form control show the same state', async ({ page }) => {
    await open(page, {
      head: '<link rel="stylesheet" href="/t/css/c.css">',
      css: { 'c.css': `.counter { --count: state(0, bind(data-count)); --name: state("", bind(data-name)) } .counter output { text: var(--count) }
        .counter .inc { on: click(increment(--count)) } .counter input { bind: --name }` },
      body: '<div class="counter"><output>0</output><button class="inc">+</button><input></div>',
      csp: "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'",
    });
    await expect.poll(() => attr(page, '.counter', 'data-count')).toBe('0');
    await page.click('.inc'); await page.click('.inc');
    await page.fill('.counter input', 'Ada');
    await expect.poll(() => page.textContent('.counter output')).toBe('2');
    expect([await attr(page, '.counter', 'data-count'), await attr(page, '.counter', 'data-name')]).toEqual(['2', 'Ada']);
  });

  test('untrusted stylesheets cannot bind attributes', async ({ page }) => {
    await open(page, {
      head: `<script>window.ReactiveCSSConfig = { trustInlineStyles: false }</script><style>.m { --open: state(false, bind(aria-expanded)) }</style>`,
      body: '<button class="m">m</button>',
    });
    expect(await attr(page, '.m', 'aria-expanded')).toBe(null);
    expect((await diagnostics(page)).join('\n')).toMatch(/bind\(\) in state\(\) is ignored in untrusted stylesheets/);
  });
});
