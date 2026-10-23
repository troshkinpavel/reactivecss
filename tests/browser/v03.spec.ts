// 0.3: previous(), direction(), :changed(), bind:, key(), outside(), cycle(), closest(), native if(), typed().
import { test, expect, type Page } from '@playwright/test';
import { open, style, frames, stats, diagnostics, sheetCSS } from './helpers';

const marked = (page: Page, sel: string, prefix: string) =>
  page.$eval(sel, (e, p) => e.getAttributeNames().some((a) => a.startsWith(p)), prefix);

test.describe('state history', () => {
  test('previous() and direction() follow effective changes only', async ({ page }) => {
    await open(page, {
      head: `<style>
        .c { --n: state(0) }
        #ten { on: click(set(--n, 10)) } #twenty { on: click(set(--n, 20)) } #fifteen { on: click(set(--n, 15)) }
        #out { display: block; --p: previous(--n); --d: direction(--n);
          width: calc(var(--p) * 1px); height: when(direction(--n) > 0, 5px, 1px); outline: when(--n < previous(--n), 1px solid, none) }
      </style>`,
      body: '<div class="c"><button id="ten">10</button><button id="twenty">20</button><button id="fifteen">15</button><b id="out"></b></div>',
    });
    const read = async () => [await style(page, '#out', 'width'), (await style(page, '#out', '--d')).trim(), await style(page, '#out', 'height'), await style(page, '#out', 'outline-style')];
    expect(await read()).toEqual(['0px', '0', '1px', 'none']); // initial: previous == initial
    await page.click('#ten');
    await expect.poll(read).toEqual(['0px', '1', '5px', 'none']);
    await page.click('#ten'); // no-op: history does not move
    await frames(page);
    expect(await read()).toEqual(['0px', '1', '5px', 'none']);
    await page.click('#twenty');
    await expect.poll(read).toEqual(['10px', '1', '5px', 'none']);
    await page.click('#fifteen');
    await expect.poll(read).toEqual(['20px', '-1', '1px', 'solid']);
  });

  test('direction() of a non-numeric state is unknown with a warning', async ({ page }) => {
    await open(page, {
      head: `<style>.c { --m: state(light) } #b { on: click(set(--m, dark)) } #x { display: block; width: when(direction(--m) > 0, 5px, 1px) }</style>`,
      body: '<div class="c"><button id="b">b</button><i id="x"></i></div>',
    });
    await page.click('#b');
    await frames(page);
    expect(await style(page, '#x', 'width')).not.toMatch(/^(5|1)px$/);
    expect((await diagnostics(page)).join('\n')).toMatch(/direction\(--m\) needs a number or dimension state/);
  });
});

test.describe(':changed()', () => {
  const head = `<style>
    .c { --n: state(0) }
    #inc { on: click(increment(--n)) } #same { on: click(set(--n, 4)) }
    .c:changed(--n) .num { animation: flash 400ms }
    @keyframes flash { from { opacity: 0.2 } }
  </style>`;
  const body = '<div class="c"><button id="inc">+</button><button id="same">1</button><span class="num">n</span></div>';

  test('never on load; set after a real change; cleared when the animation ends', async ({ page }) => {
    await open(page, { head, body });
    await frames(page, 3);
    expect(await marked(page, '.c', 'data-rcss-changed')).toBe(false);
    await page.click('#inc');
    await expect.poll(() => marked(page, '.c', 'data-rcss-changed')).toBe(true);
    expect(await style(page, '.num', 'animation-name')).toBe('flash');
    await page.waitForTimeout(150); // mid-animation (400ms): the marker must still be there
    expect(await marked(page, '.c', 'data-rcss-changed')).toBe(true);
    for (let k = 0; k < 3; k++) await page.click('#inc'); // rapid real clicks
    await page.waitForTimeout(150);
    expect(await marked(page, '.c', 'data-rcss-changed')).toBe(true);
    await expect.poll(() => marked(page, '.c', 'data-rcss-changed'), { timeout: 3000 }).toBe(false);
    await page.click('#same'); // 4 -> 4: no-op
    await frames(page, 3);
    expect(await marked(page, '.c', 'data-rcss-changed')).toBe(false);
  });

  test('rapid changes restart the animation; no stuck marker', async ({ page }) => {
    await open(page, { head, body });
    await page.click('#inc');
    await expect.poll(() => marked(page, '.c', 'data-rcss-changed')).toBe(true);
    const first = await page.evaluate(() => ((window as any).a1 = document.querySelector('.num')!.getAnimations()[0]) && 1);
    expect(first).toBe(1);
    for (let k = 0; k < 4; k++) await page.click('#inc');
    await expect.poll(() => page.evaluate(() => { const a = document.querySelector('.num')!.getAnimations()[0]; return !!a && a !== (window as any).a1; })).toBe(true);
    await expect.poll(() => marked(page, '.c', 'data-rcss-changed'), { timeout: 3000 }).toBe(false);
  });

  test('an interrupted animation still clears the marker; without animations it clears after a frame', async ({ page }) => {
    await open(page, {
      head: head + `<style>.c:changed(--n) #inc { color: rgb(255, 0, 0) }</style>`,
      body,
    });
    await page.click('#inc');
    await expect.poll(() => marked(page, '.c', 'data-rcss-changed')).toBe(true);
    await page.evaluate(() => document.querySelector('.num')!.getAnimations().forEach((a) => a.cancel()));
    await expect.poll(() => marked(page, '.c', 'data-rcss-changed')).toBe(false);
  });

  test('removed elements leave nothing behind', async ({ page }) => {
    await open(page, { head, body });
    await page.click('#inc');
    await page.evaluate(() => document.querySelector('.c')!.remove());
    await frames(page, 3);
    const s = await stats(page);
    expect([s.states, s.bindings]).toEqual([0, 0]);
  });
});

test.describe('bind:', () => {
  const preview = (page: Page, sel = '.preview') => page.$eval(sel, (e) => getComputedStyle(e, '::before').content);

  test('text input: typing, paste, delete, IME composition, caret kept', async ({ page }) => {
    await open(page, {
      head: `<style>.f { --name: state("") } .f input { bind: --name } .f .preview::before { content: var(--name) }</style>`,
      body: '<div class="f"><input><span class="preview"></span></div>',
    });
    expect(await preview(page)).toBe('""');
    await page.click('.f input');
    await page.keyboard.type('Ac');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.type('d'); // in the middle: the field must not be rewritten
    await page.keyboard.type('a');
    await expect.poll(() => preview(page)).toBe('"Adac"');
    expect(await page.$eval('.f input', (i: HTMLInputElement) => [i.value, i.selectionStart])).toEqual(['Adac', 3]);
    await page.keyboard.press('ArrowRight'); // to the end (End does not move the caret in WebKit on macOS)
    await page.keyboard.press('Backspace');
    await expect.poll(() => preview(page)).toBe('"Ada"');
    await page.evaluate(() => { // paste
      const i = document.querySelector('.f input') as HTMLInputElement;
      i.setRangeText(' "L"', i.value.length, i.value.length, 'end');
      i.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
    });
    await expect.poll(() => preview(page)).toBe('"Ada \\"L\\""');
    await page.evaluate(() => { // IME: no state update while composing, one at the end
      const i = document.querySelector('.f input') as HTMLInputElement;
      i.value = 'にほ';
      i.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      i.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
    });
    await frames(page);
    expect(await preview(page)).toBe('"Ada \\"L\\""');
    await page.evaluate(() => {
      const i = document.querySelector('.f input') as HTMLInputElement;
      i.value = '日本';
      i.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '日本' }));
    });
    await expect.poll(() => preview(page)).toBe('"日本"');
  });

  test('state → control: set() updates the field, keeps focus and clamps the selection', async ({ page }) => {
    await open(page, {
      head: `<style>.f { --name: state("Grace") } .f input { bind: --name } #clear { on: click(set(--name, "Al")) }</style>`,
      body: '<div class="f"><input><button id="clear">x</button></div>',
    });
    expect(await page.inputValue('.f input')).toBe('Grace'); // state-first
    await page.focus('.f input');
    await page.$eval('.f input', (i: HTMLInputElement) => i.setSelectionRange(4, 5));
    await page.$eval('#clear', (b: HTMLElement) => b.click()); // click without moving focus
    await expect.poll(() => page.inputValue('.f input')).toBe('Al');
    expect(await page.evaluate(() => [document.activeElement!.tagName, (document.activeElement as HTMLInputElement).selectionStart])).toEqual(['INPUT', 2]);
  });

  test('number, checkbox, radio, select and textarea', async ({ page }) => {
    await open(page, {
      head: `<style>
        .f { --qty: state(2); --on: state(true); --size: state(m); --plan: state("pro"); --note: state("hi") }
        .f [name=qty] { bind: --qty } .f [type=checkbox] { bind: --on } .f [type=radio] { bind: --size }
        .f select { bind: --plan } .f textarea { bind: --note }
        #out { display: block; width: calc(var(--qty) * 1px); opacity: var(--on);
          outline: when(--size == l and --plan == "team", 1px solid, none) }
        #out::before { content: var(--note) }
      </style>`,
      body: `<div class="f"><input name="qty" type="number"><input type="checkbox">
        <input type="radio" name="s" value="s"><input type="radio" name="s" value="m"><input type="radio" name="s" value="l">
        <select><option>free</option><option>pro</option><option>team</option></select><textarea></textarea><b id="out"></b></div>`,
    });
    expect(await page.$$eval('.f input, .f select, .f textarea', (els) => els.map((e: any) => (e.type === 'checkbox' || e.type === 'radio' ? e.checked : e.value))))
      .toEqual(['2', true, false, true, false, 'pro', 'hi']);
    await page.fill('[name=qty]', '7');
    await page.click('[type=checkbox]');
    await page.check('[value=l]');
    await page.selectOption('select', 'team');
    await page.fill('textarea', 'line1\nline2');
    await expect.poll(() => style(page, '#out', 'width')).toBe('7px');
    await expect.poll(() => style(page, '#out', 'opacity')).toBe('0');
    await expect.poll(() => style(page, '#out', 'outline-style')).toBe('solid');
    await expect.poll(() => page.$eval('#out', (e) => getComputedStyle(e, '::before').content)).toBe('"line1\\a line2"');
    await page.fill('[name=qty]', ''); // invalid / empty: the state keeps its value
    await frames(page);
    expect(await style(page, '#out', 'width')).toBe('7px');
  });

  test('autofilled controls win over the CSS initial value; form reset restores the initial state', async ({ page }) => {
    await open(page, {
      head: `<style>.f { --email: state(""); --news: state(true) } .f [type=email] { bind: --email } .f [type=checkbox] { bind: --news }
        .f .preview::before { content: var(--email) } #o { display: block; opacity: var(--news) }</style>`,
      body: `<form class="f"><input type="email" value=""><input type="checkbox"><span class="preview"></span><b id="o"></b></form>
        <script>document.querySelector('[type=email]').value = 'ada@example.com';</script>`,
    });
    expect(await preview(page)).toBe('"ada@example.com"'); // the control was edited before start: it wins
    expect(await page.isChecked('[type=checkbox]')).toBe(true); // untouched: the state wins
    await page.click('[type=checkbox]');
    await expect.poll(() => style(page, '#o', 'opacity')).toBe('0');
    await page.evaluate(() => (document.querySelector('form') as HTMLFormElement).reset());
    await expect.poll(() => preview(page)).toBe('""');
    await expect.poll(() => page.isChecked('[type=checkbox]')).toBe(true);
    expect(await page.inputValue('[type=email]')).toBe('');
  });

  test('nested owners, closest() scope, incompatible types, cleanup', async ({ page }) => {
    await open(page, {
      head: `<style>
        .outer, .inner { --v: state("") }
        .inner input.own { bind: --v }
        .inner input.up { bind: --v closest(.outer) }
        .outer > .out::before, .inner > .out::before { content: var(--v) }
        .bad { --n: state(1) } .bad input { bind: --n }
      </style>`,
      body: '<div class="outer"><span class="out"></span><div class="inner"><input class="own"><input class="up"><span class="out"></span></div></div><div class="bad"><input></div>',
    });
    await page.fill('.own', 'in');
    await page.fill('.up', 'out');
    await expect.poll(() => page.$$eval('.out', (e) => e.map((x) => getComputedStyle(x, '::before').content))).toEqual(['"out"', '"in"']);
    expect((await diagnostics(page)).join('\n')).toMatch(/a text control cannot hold a number state/);
    await page.evaluate(() => document.querySelector('.outer')!.remove());
    await frames(page);
    const s = await stats(page);
    expect(s.states).toBe(1); // only .bad remains
  });
});

test.describe('actions: key(), outside(), cycle(), closest()', () => {
  test('key(): focus scope, modifiers, no shortcuts while typing', async ({ page }) => {
    await open(page, {
      head: `<style>
        .dlg { --open: state(true); --n: state(0); on: key(Escape, set(--open, false)), key(ctrl+k, toggle(--open)), key(j, increment(--n)) }
        .dlg i { display: block; width: when(--open, 10px, 1px); height: calc(var(--n) * 1px + 1px) }
      </style>`,
      body: '<button id="outsideBtn">x</button><div class="dlg"><button id="inBtn">in</button><input id="field"><i></i></div>',
    });
    await page.focus('#outsideBtn');
    await page.keyboard.press('Escape'); // focus is not inside: nothing
    await frames(page);
    expect(await style(page, '.dlg i', 'width')).toBe('10px');
    await page.focus('#inBtn');
    await page.keyboard.press('j');
    await page.keyboard.press('Escape');
    await expect.poll(() => style(page, '.dlg i', 'width')).toBe('1px');
    expect(await style(page, '.dlg i', 'height')).toBe('2px');
    await page.keyboard.press('Control+k');
    await expect.poll(() => style(page, '.dlg i', 'width')).toBe('10px');
    await page.keyboard.press('Shift+Escape'); // modifiers must match exactly
    await page.keyboard.press('k'); // ctrl+k needs ctrl
    await page.focus('#field');
    await page.keyboard.type('jj'); // typing in a field is not a shortcut
    await frames(page);
    expect([await style(page, '.dlg i', 'width'), await style(page, '.dlg i', 'height')]).toEqual(['10px', '2px']);
    await page.keyboard.press('Escape'); // non-printable keys still work from a field
    await expect.poll(() => style(page, '.dlg i', 'width')).toBe('1px');
    // Nothing focused (Safari does not focus clicked buttons): the last pressed element is the scope.
    await page.keyboard.press('Control+k');
    await expect.poll(() => style(page, '.dlg i', 'width')).toBe('10px');
    await page.click('#inBtn');
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.keyboard.press('Escape');
    await expect.poll(() => style(page, '.dlg i', 'width')).toBe('1px');
    await page.click('#outsideBtn');
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.keyboard.press('Control+k'); // last pressed outside the element: nothing
    await frames(page);
    expect(await style(page, '.dlg i', 'width')).toBe('1px');
  });

  test('outside(): closes on outside clicks only, also across shadow DOM; independent instances', async ({ page }) => {
    await open(page, {
      head: `<style>
        .dd { --open: state(false); on: outside(click, set(--open, false)) }
        .dd > button { on: click(toggle(--open)) }
        .dd .menu { display: when(--open, block, none) }
      </style>`,
      body: `<div class="dd" id="a"><button>a</button><div class="menu">menu <span id="host"></span></div></div>
             <div class="dd" id="b"><button>b</button><div class="menu">menu</div></div><p id="away">away</p>`,
    });
    await page.evaluate(() => { const r = document.getElementById('host')!.attachShadow({ mode: 'open' }); r.innerHTML = '<button id="deep">deep</button>'; });
    const open_ = () => page.$$eval('.menu', (m) => m.map((x) => getComputedStyle(x).display === 'block'));
    await page.click('#a > button');
    await expect.poll(open_).toEqual([true, false]);
    await page.click('#host >> #deep'); // inside #a (through a shadow root): stays open
    await frames(page);
    expect(await open_()).toEqual([true, false]);
    await page.click('#b > button'); // outside #a: closes a, opens b
    await expect.poll(open_).toEqual([false, true]);
    await page.click('#away');
    await expect.poll(open_).toEqual([false, false]);
    expect((await stats(page)).observers).toBe(1); // one shared click listener
  });

  test('cycle() wraps and recovers from unlisted values; closest() targets one owner exactly', async ({ page }) => {
    await open(page, {
      head: `<style>
        .theme { --mode: state(light) }
        #next { on: click(cycle(--mode, light, dark, system)) } #weird { on: click(set(--mode, sepia)) }
        .theme b::before { content: when(--mode == light, "L", when(--mode == dark, "D", when(--mode == system, "S", "?"))) }
        .outer, .inner { --n: state(0) }
        #up { on: click(increment(--n, 1, closest(.outer))) } #miss { on: click(increment(--n, 1, closest(.nope))) }
        .outer > i, .inner > i { display: block; width: calc(var(--n) * 1px + 1px) }
      </style>`,
      body: `<div class="theme"><button id="next">n</button><button id="weird">w</button><b></b></div>
             <div class="outer"><i></i><div class="inner"><button id="up">u</button><button id="miss">m</button><i></i></div></div>`,
    });
    const mode = () => page.$eval('.theme b', (e) => getComputedStyle(e, '::before').content);
    const seq: string[] = [];
    for (let k = 0; k < 4; k++) { await page.click('#next'); await frames(page); seq.push(await mode()); }
    expect(seq).toEqual(['"D"', '"S"', '"L"', '"D"']);
    await page.click('#weird');
    await expect.poll(mode).toBe('"?"');
    await page.click('#next'); // not in the list: back to the first value
    await expect.poll(mode).toBe('"L"');
    await page.click('#up');
    await page.click('#miss');
    await expect.poll(() => page.$$eval('i', (e) => e.map((x) => getComputedStyle(x).width))).toEqual(['2px', '1px']);
    expect((await diagnostics(page)).join('\n')).toMatch(/closest\(\.nope\)/);
  });
});

test.describe('native if() for when()', () => {
  const head = `<style>
    .c { --a: state(true); --b: state(false) }
    #fa { on: click(toggle(--a)) } #fb { on: click(toggle(--b)) }
    .c i { display: block;
      width: when(--a, 10px, 1px);
      height: when(--a and not --b, 10px, 1px);
      outline-width: when(not (--a or --b), 3px, 1px);
      min-width: when(--missing, 5px, 6px) }
    .c i { outline-style: solid }
  </style>`;
  const body = '<div class="c"><button id="fa">a</button><button id="fb">b</button><i></i></div>';
  const read = (page: Page) => page.$eval('.c i', (e) => { const s = getComputedStyle(e); return [s.width, s.height, s.outlineWidth, s.minWidth]; });

  test('compiles boolean conditions to if() and gives the same results as the runtime, including unknown', async ({ browser }) => {
    const results: string[][][] = [];
    for (const native of [true, false]) {
      const page = await browser.newPage();
      await open(page, { head, body, native });
      const css = await sheetCSS(page);
      const supported = await page.evaluate(() => CSS.supports('width', 'if(style(--a: 1): 1px)'));
      if (native && supported) {
        expect(css).toContain('width: if(style(--a: 1): 10px; style(--a: 0): 1px)');
        expect(css).toContain('height: if((style(--a: 1) and style(--b: 0)): 10px; (style(--a: 0) or style(--b: 1)): 1px)');
        expect((await stats(page)).bindings).toBe(0); // no JS per element
      } else expect(css).not.toContain('if(');
      const seq = [await read(page)];
      await page.click('#fb'); await frames(page, 2); seq.push(await read(page));
      await page.click('#fa'); await frames(page, 2); seq.push(await read(page));
      await page.click('#fb'); await frames(page, 2); seq.push(await read(page));
      results.push(seq);
      await page.close();
    }
    expect(results[0]).toEqual(results[1]);
    expect(results[0][0][3]).toBe('0px'); // --missing: unknown, no value (min-width falls back to its initial 0px)
  });

  test('nested owners: the nearest owner decides, as at runtime', async ({ page }) => {
    await open(page, {
      head: `<style>.o { --on: state(true) } .o .in { --on: state(false) } .o i { display: block; width: when(--on, 10px, 1px) }</style>`,
      body: '<div class="o"><i id="x"></i><div class="in"><i id="y"></i></div></div>',
    });
    expect([await style(page, '#x', 'width'), await style(page, '#y', 'width')]).toEqual(['10px', '1px']);
  });
});

test.describe('typed()', () => {
  test('registers number, length, angle, color and time; inherits like a plain custom property', async ({ page }) => {
    await open(page, {
      head: `<style>.c { --n: typed(1.5); --l: typed(0px); --a: typed(0deg); --col: typed(#ffffff); --t: typed(1s); --x: typed(0, "<length>") }
        .c { --l: 1in; --a: 0.5turn; --col: red; --x: 3pt } .c i { display: block }</style>`,
      body: '<div class="c"><i></i></div>',
    });
    const v = (p: string) => style(page, '.c i', p).then((s) => s.trim());
    expect([await v('--n'), await v('--l'), await v('--a'), await v('--col'), await v('--t'), await v('--x')])
      .toEqual(['1.5', '96px', '180deg', 'rgb(255, 0, 0)', '1s', '4px']); // computed (typed) values, inherited by <i>
    expect(await diagnostics(page)).toEqual([]);
  });

  test('a typed property can be transitioned (the reason to register it)', async ({ page }) => {
    await open(page, {
      head: `<style>.c { --deg: typed(0deg); transition: --deg 1s linear; display: block; width: 10px; height: 10px }
        .c.on { --deg: 90deg }</style>`,
      body: '<div class="c"></div>',
    });
    await page.evaluate(() => document.querySelector('.c')!.classList.add('on'));
    await page.waitForTimeout(300);
    const mid = parseFloat(await style(page, '.c', '--deg'));
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(90);
  });

  test('never overrides a native @property, warns on conflicts and invalid initial values', async ({ page }) => {
    await open(page, {
      head: `<style>
        @property --k { syntax: "<color>"; inherits: false; initial-value: blue }
        .a { --k: typed(10px); --m: typed(0px); --e: typed(1em); --u: typed(auto) }
        .b { --m: typed(0deg) }
      </style>`,
      body: '<div class="a"></div><div class="b"></div>',
    });
    const d = (await diagnostics(page)).join('\n');
    expect(d).toMatch(/--k has a native @property rule/);
    expect(d).toMatch(/--m is already registered as <length>/);
    expect(d).toMatch(/--e was not registered: the browser rejects 1em/);
    expect(d).toMatch(/typed\(auto\) for --u: cannot infer a type/);
    expect((await style(page, '.a', '--k')).trim()).toBe('rgb(0, 0, 255)'); // native color registration kept: 10px is invalid there
  });
});

test.describe(':changed() animation lifecycle', () => {
  const head = (rules: string) => `<style>.c { --n: state(0) } #inc { on: click(increment(--n)) } .c i, .c u { display: block } ${rules}</style>`;
  const body = '<div class="c"><button id="inc">+</button><i></i><u></u></div>';
  const on = (page: Page) => marked(page, '.c', 'data-rcss-changed');
  /** Milliseconds the marker stayed after one change, measured in the page. */
  const lifetime = async (page: Page) => {
    await page.evaluate(() => {
      const c = document.querySelector('.c')!;
      const w = (window as any).__life = { added: 0, removed: 0 };
      new MutationObserver((rs) => rs.forEach((r) => {
        if (!r.attributeName?.startsWith('data-rcss-changed')) return;
        if (c.hasAttribute(r.attributeName)) w.added = performance.now(); else w.removed = performance.now();
      })).observe(c, { attributes: true });
    });
    await page.click('#inc');
    await expect.poll(() => page.evaluate(() => (window as any).__life.removed), { timeout: 4000, intervals: [20] }).toBeGreaterThan(0);
    return page.evaluate(() => (window as any).__life.removed - (window as any).__life.added);
  };

  test('waits for the longest of several animations on several descendants', async ({ page }) => {
    await open(page, { head: head(`.c:changed(--n) i { animation: a 150ms, b 600ms } .c:changed(--n) u { animation: a 300ms }
      @keyframes a { from { opacity: 0.5 } } @keyframes b { from { opacity: 0.6 } }`), body });
    expect(await lifetime(page)).toBeGreaterThanOrEqual(550);
  });

  test('waits through an animation delay', async ({ page }) => {
    await open(page, { head: head(`.c:changed(--n) i { animation: a 200ms 400ms } @keyframes a { from { opacity: 0.5 } }`), body });
    expect(await lifetime(page)).toBeGreaterThanOrEqual(550);
  });

  test('a zero-duration animation or no animation at all clears promptly', async ({ page }) => {
    await open(page, { head: head(`.c:changed(--n) i { animation: a 0s } .c:changed(--n) u { color: red } @keyframes a { from { opacity: 0.5 } }`), body });
    expect(await lifetime(page)).toBeLessThan(400);
  });

  test('a change during an active animation restarts it and extends the marker', async ({ page }) => {
    await open(page, { head: head(`.c:changed(--n) i { animation: a 500ms } @keyframes a { from { opacity: 0.5 } }`), body });
    await page.click('#inc');
    await page.waitForTimeout(300);
    const t1 = Date.now();
    await page.click('#inc');
    await expect.poll(() => page.$eval('.c i', (e) => Number(e.getAnimations()[0]?.currentTime ?? 999))).toBeLessThan(250); // restarted
    await expect.poll(() => on(page), { timeout: 4000, intervals: [20] }).toBe(false);
    expect(Date.now() - t1).toBeGreaterThanOrEqual(450);
  });
});
