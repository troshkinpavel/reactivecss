// 0.5: attr(), pick() and split() in state() and set(); stable state() registrations.
import { test, expect, type Page } from '@playwright/test';
import { open, style, frames, stats, diagnostics } from './helpers';

const prop = (page: Page, sel: string, p: string) => style(page, sel, p).then((v) => v.trim());
const after = (page: Page, sel: string) => page.$eval(sel, (e) => getComputedStyle(e, '::after').content);
const internal = async (page: Page) => (await stats(page)).internal;

test.describe('attr() in state() and set()', () => {
  test('state(attr()) starts from the owner\'s attribute, is not reset by attribute changes, and stays writable', async ({ page }) => {
    await open(page, {
      head: `<style>.g { --message: state(attr(data-message)) } .g output::after { content: var(--message) }
        .g .b { on: click(set(--message, "Changed")) }</style>`,
      body: '<div class="g" data-message="Hello!"><output></output><button class="b">b</button></div>',
    });
    expect(await after(page, '.g output')).toBe('"Hello!"');
    await page.evaluate(() => document.querySelector('.g')!.setAttribute('data-message', 'Later'));
    await frames(page);
    expect(await after(page, '.g output')).toBe('"Hello!"'); // read once, at initialization
    await page.click('.b');
    await expect.poll(() => after(page, '.g output')).toBe('"Changed"');
  });

  test('set(--x, attr()) reads the element with on: at event time', async ({ page }) => {
    await open(page, {
      head: `<style>.g { --message: state("Hello!") } .g output::after { content: var(--message) }
        .choice { on: click(set(--message, attr(data-message))) }</style>`,
      body: '<div class="g"><output></output><button class="choice" data-message="Bonjour!">fr</button><button class="choice" id="es" data-message="¡Hola!">es</button></div>',
    });
    await page.click('.choice');
    await expect.poll(() => after(page, '.g output')).toBe('"Bonjour!"');
    await page.click('#es');
    await expect.poll(() => after(page, '.g output')).toBe('"¡Hola!"');
    await page.evaluate(() => document.getElementById('es')!.setAttribute('data-message', 'Hola de nuevo'));
    await page.click('#es');
    await expect.poll(() => after(page, '.g output')).toBe('"Hola de nuevo"');
  });

  test('nested owners read their own attribute; no ancestor lookup', async ({ page }) => {
    await open(page, {
      head: `<style>.g { --m: state(attr(data-m, "none")) } .g > output::after { content: var(--m) }</style>`,
      body: '<div class="g" id="outer" data-m="outer"><output></output><div class="g" id="inner"><output></output></div></div>',
    });
    expect(await after(page, '#outer > output')).toBe('"outer"');
    expect(await after(page, '#inner > output')).toBe('"none"'); // the inner owner has no attribute: its fallback
  });

  test('missing, empty, Unicode, quotes, backslashes, newlines and CSS syntax stay one string', async ({ page }) => {
    const values = ['', 'こんにちは 👋', 'say "hi"', 'back\\slash', 'two\nlines', '"; color: red; --x: "', '}</style><script>alert(1)</script>'];
    await open(page, {
      head: `<style>.v { --m: state(attr(data-m, "fallback")); color: rgb(0, 0, 0) } .v::after { content: var(--m) }</style>`,
      body: values.map((v) => `<p class="v" data-m="${v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"></p>`).join('') + '<p class="v" id="missing"></p>',
    });
    const got = await page.$$eval('.v', (els) => els.map((e) => ({ content: getComputedStyle(e, '::after').content, color: getComputedStyle(e).color })));
    expect(got.pop()!.content).toBe('"fallback"');
    expect(got.map((g) => g.content)).toEqual(values.map((v) => JSON.stringify(v).replace(/\\n/g, '\\a ')));
    expect(new Set(got.map((g) => g.color))).toEqual(new Set(['rgb(0, 0, 0)'])); // nothing escaped into a declaration
    expect(await page.evaluate(() => document.querySelectorAll('script').length)).toBe(1); // only the library
  });

  test('attr() never reads password fields', async ({ page }) => {
    await open(page, {
      head: `<style>input { --v: state(attr(value, "hidden")) } input + output::after { content: var(--v) }</style>`,
      body: '<input type="password" value="hunter2"><output></output>',
    });
    expect(await page.$eval('input', (e) => getComputedStyle(e).getPropertyValue('--v'))).not.toContain('hunter2');
  });

  test('native attr() keeps working in sheets with reactive rules', async ({ page }) => {
    await open(page, {
      head: `<style>.l::before { content: attr(data-label) } .l { --on: state(false); --x: attr(data-x) }</style>`,
      body: '<p class="l" data-label="native" data-x="1"></p>',
    });
    expect(await page.$eval('.l', (e) => getComputedStyle(e, '::before').content)).toBe('"native"');
    expect(await prop(page, '.l', '--x')).toBe('"1"'); // the browser's own attr(), substituted natively
    expect(await diagnostics(page)).toEqual([]);
  });
});

test.describe('split()', () => {
  test('pick(split()) chooses an entry per owner at initialization and per click in set()', async ({ page }) => {
    await open(page, {
      head: `<style>.g { --m: state(pick(split("Hello!|Bonjour!|Hola!|Ciao!", "|"))) } .g output::after { content: var(--m) }
        .shuffle { on: click(set(--m, pick(split(attr(data-greetings), "|")))) }</style>`,
      body: '<div class="g"><output></output><button class="shuffle" data-greetings="Hej! | Salut! |  | Hallo!">s</button></div>'.repeat(20),
    });
    const all = ['"Hello!"', '"Bonjour!"', '"Hola!"', '"Ciao!"'];
    const initial = await page.$$eval('.g output', (os) => os.map((o) => getComputedStyle(o, '::after').content));
    for (const v of initial) expect(all).toContain(v);
    expect(new Set(initial).size).toBeGreaterThan(1); // per owner (20 owners, 4 values)
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      await page.click('.shuffle');
      await frames(page, 1);
      seen.add(await after(page, '.g output'));
    }
    expect([...seen].every((v) => ['"Hej!"', '"Salut!"', '"Hallo!"'].includes(v))).toBe(true); // trimmed, empty entry dropped
    expect(seen.size).toBeGreaterThan(1);
  });

  test('an empty list changes nothing; invalid split() is reported and the declaration left unchanged', async ({ page }) => {
    await open(page, {
      head: `<style>.g { --m: state("start") } .g output::after { content: var(--m) }
        .e { on: click(set(--m, pick(split(attr(data-none), "|")))) } .bad { --x: state(split("a|b", "|")) }</style>`,
      body: '<div class="g"><output></output><button class="e">e</button></div><div class="bad"></div>',
    });
    await page.click('.e');
    await frames(page);
    expect(await after(page, '.g output')).toBe('"start"');
    expect((await diagnostics(page)).join('\n')).toMatch(/split\(\) makes a list; use it inside pick\(\)/);
  });
});

test.describe('stable state() registrations', () => {
  test('recompiling, editing, removing and reinserting a sheet keeps one registration per state name', async ({ page }) => {
    await open(page, {
      head: `<style id="s">.c { --open: state(false); --n: state(0) } .c b { on: click(toggle(--open), increment(--n)) } .c i { opacity: when(--open, 1, 0.5) }</style>`,
      body: '<div class="c"><b>b</b><i>i</i></div>',
    });
    const regs = async () => (await internal(page)).registeredStateVars;
    const first = await regs();
    expect(first).toBe(2);
    for (let k = 0; k < 10; k++) {
      await page.evaluate((k) => { const s = document.getElementById('s')!; s.textContent += `/* ${k} */`; }, k);
      await frames(page);
    }
    expect(await regs()).toBe(first); // 10 recompiles of identical rules
    await page.evaluate(() => { const s = document.getElementById('s')!; s.textContent = s.textContent!.replace('state(0)', 'state(5)') + ' .c { --extra: state(1) }'; });
    await frames(page);
    expect(await regs()).toBe(first + 1); // changed content: only the new name registers
    await page.evaluate(() => { const s = document.getElementById('s')!; s.remove(); document.head.append(s); });
    await frames(page);
    expect(await regs()).toBe(first + 1);
    // State still works after all of it, with the edited initial value.
    await page.click('.c b');
    await expect.poll(() => prop(page, '.c i', 'opacity')).toBe('1');
    expect(await page.$eval('.c', (e) => getComputedStyle(e).getPropertyValue('--n').trim())).toBe('6');
  });

  test('two sheets declaring the same state on one element: removing one keeps the value working', async ({ page }) => {
    await open(page, {
      head: `<style id="a">.c { --open: state(false) } .c b { on: click(toggle(--open)) }</style>
        <style id="b">.c { --open: state(false) } .c i { opacity: when(--open, 1, 0.5) }</style>`,
      body: '<div class="c"><b>b</b><i>i</i></div>',
    });
    await page.click('.c b');
    await expect.poll(() => prop(page, '.c i', 'opacity')).toBe('1');
    await page.evaluate(() => document.getElementById('a')!.remove()); // its declaration of --open goes away
    await frames(page);
    expect(await prop(page, '.c i', 'opacity')).toBe('1'); // sheet b's declaration still sees the value
    expect(await prop(page, '.c', '--open')).toBe('1');
    await page.evaluate(() => document.getElementById('b')!.remove());
    await frames(page);
    const s = await stats(page);
    expect([s.states, s.bindings]).toEqual([0, 0]);
    expect(await page.$eval('.c', (e) => (e as HTMLElement).style.length)).toBe(0); // nothing left inline
  });

  test('nested owners stay isolated with the shared property; cascade-chosen initial values still apply', async ({ page }) => {
    await open(page, {
      head: `<style>.s { --on: state(false) } .s.preset { --on: state(true) } .s > b { on: click(toggle(--on)) } .s > i { opacity: when(--on, 1, 0.5) }</style>`,
      body: '<div class="s" id="o"><b>o</b><i></i><div class="s preset" id="n"><b>n</b><i></i></div></div>',
    });
    expect(await prop(page, '#o > i', 'opacity')).toBe('0.5');
    expect(await prop(page, '#n > i', 'opacity')).toBe('1'); // the more specific declaration's initial value
    await page.click('#o > b');
    await expect.poll(() => prop(page, '#o > i', 'opacity')).toBe('1');
    expect(await prop(page, '#n > i', 'opacity')).toBe('1');
    await page.click('#n > b');
    await expect.poll(() => prop(page, '#n > i', 'opacity')).toBe('0.5');
    expect(await prop(page, '#o > i', 'opacity')).toBe('1'); // the inner change did not leak out
  });

  test('works under a strict CSP with attr() and split() from a linked sheet', async ({ page }) => {
    await open(page, {
      head: '<link rel="stylesheet" href="/t/css/g.css">', body: '<div class="g" data-m="Hi"><output></output><button data-o="a|b">x</button></div>',
      css: { 'g.css': `.g { --m: state(attr(data-m)) } .g output::after { content: var(--m) } .g button { on: click(set(--m, pick(split(attr(data-o), "|")))) }` },
      csp: "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'",
    });
    await expect.poll(() => after(page, '.g output')).toBe('"Hi"');
    await page.click('.g button');
    await expect.poll(() => after(page, '.g output')).not.toBe('"Hi"');
  });
});

test.describe('state() initial value follows the cascade winner', () => {
  const text = (page: Page, sel: string) => page.$eval(sel, (e) => getComputedStyle(e, '::after').content);
  const OUT = `.c::after { content: var(--m) }`;

  test('specificity: the more specific rule\'s initializer wins, in either source order, including attr()', async ({ page }) => {
    await open(page, {
      head: `<style>.c.special { --m: state(attr(data-message)) } .c { --m: state("Hello") } ${OUT}
        .d { --m: state("Hello") } .d.special { --m: state(attr(data-message)) } .d::after { content: var(--m) }</style>`,
      body: '<p class="c special" data-message="Special!"></p><p class="c" id="plain" data-message="unused"></p><p class="d special" data-message="Also special"></p>',
    });
    expect(await text(page, '.c.special')).toBe('"Special!"');
    expect(await text(page, '#plain')).toBe('"Hello"');
    expect(await text(page, '.d.special')).toBe('"Also special"');
  });

  test('stylesheet order, !important and media queries decide like the browser does', async ({ page }) => {
    await open(page, {
      head: `<style>.c { --m: state("first sheet") } .i { --m: state("important") !important } ${OUT}</style>
        <style>.c { --m: state("second sheet") } .i.c { --m: state("not important") } @media (max-width: 1px) { .c.m { --m: state("tiny screens") } }</style>`,
      body: '<p class="c" id="a"></p><p class="c i" id="b"></p><p class="c m" id="m"></p>',
    });
    expect(await text(page, '#a')).toBe('"second sheet"');
    expect(await text(page, '#b')).toBe('"important"');
    expect(await text(page, '#m')).toBe('"second sheet"'); // the media rule does not apply
  });

  test('cascade layers: a later layer wins over higher specificity in an earlier layer', async ({ page }) => {
    await open(page, {
      head: `<style>@layer base, theme; @layer theme { .c { --m: state("theme") } } @layer base { .c.x#y { --m: state("base, very specific") } } ${OUT}</style>`,
      body: '<p class="c x" id="y"></p>',
    });
    expect(await text(page, '#y')).toBe('"theme"');
  });

  test('state(pick()) winning over a literal initializer', async ({ page }) => {
    await open(page, {
      head: `<style>.c { --m: state("literal") } .c.p { --m: state(pick("a", "b")) } ${OUT}</style>`,
      body: '<p class="c p"></p>'.repeat(10),
    });
    const all = await page.$$eval('.c', (els) => els.map((e) => getComputedStyle(e, '::after').content));
    expect(all.every((v) => v === '"a"' || v === '"b"')).toBe(true);
  });

  test('nested owners each use their own winner', async ({ page }) => {
    await open(page, {
      head: `<style>.c { --m: state("outer default") } .c.special { --m: state(attr(data-m)) } .c > i::after { content: var(--m) }</style>`,
      body: '<div class="c" id="o"><i></i><div class="c special" id="n" data-m="inner special"><i></i></div></div>',
    });
    expect(await page.$eval('#o > i', (e) => getComputedStyle(e, '::after').content)).toBe('"outer default"');
    expect(await page.$eval('#n > i', (e) => getComputedStyle(e, '::after').content)).toBe('"inner special"');
  });

  test('a later stylesheet with the winner initializes an unchanged state, but never resets a changed one', async ({ page }) => {
    await open(page, {
      head: `<style>.c { --m: state("early") } .c b { on: click(set(--m, "clicked")) } .c::after { content: var(--m) }</style>`,
      body: '<p class="c" id="u"></p><p class="c" id="t"><b>b</b></p>',
    });
    await page.click('#t b');
    await expect.poll(() => text(page, '#t')).toBe('"clicked"');
    await page.evaluate(() => { const s = document.createElement('style'); s.textContent = '.c.c { --m: state("late winner") }'; document.head.append(s); });
    await expect.poll(() => text(page, '#u')).toBe('"late winner"'); // unchanged state: initialized by the winner
    expect(await text(page, '#t')).toBe('"clicked"'); // changed state: kept
  });

  test('an unrelated stylesheet update keeps a changed state; recompiling keeps the winner and adds no registration', async ({ page }) => {
    await open(page, {
      head: `<style id="s1">.c { --m: state("one") } .c.w { --m: state(attr(data-m)) } .c b { on: click(set(--m, "clicked")) } .c::after { content: var(--m) }</style>
        <style id="other">.z { --q: state(1) }</style>`,
      body: '<p class="c w" id="t" data-m="winner"><b>b</b></p>',
    });
    expect(await text(page, '#t')).toBe('"winner"');
    const regs = (await stats(page)).internal.registeredStateVars;
    await page.click('#t b');
    await expect.poll(() => text(page, '#t')).toBe('"clicked"');
    await page.evaluate(() => { document.getElementById('other')!.textContent = '.z { --q: state(2) }'; });
    await frames(page);
    expect(await text(page, '#t')).toBe('"clicked"'); // another sheet changed: this state is untouched
    for (let k = 0; k < 10; k++) {
      await page.evaluate((k) => { document.getElementById('s1')!.textContent += `/* ${k} */`; }, k);
      await frames(page);
    }
    expect(await text(page, '#t')).toBe('"winner"'); // its own sheet recompiled: a new state, initialized by the winner
    expect((await stats(page)).internal.registeredStateVars).toBe(regs);
  });

  test('removing and reinserting the owner starts a new state from the winner', async ({ page }) => {
    await open(page, {
      head: `<style>.c { --m: state("default") } .c.w { --m: state(attr(data-m)) } .c b { on: click(set(--m, "clicked")) } .c::after { content: var(--m) }</style>`,
      body: '<div id="host"><p class="c w" data-m="winner"><b>b</b></p></div>',
    });
    await page.click('.c b');
    await expect.poll(() => text(page, '.c')).toBe('"clicked"');
    await page.evaluate(async () => {
      const p = document.querySelector('.c')!; p.remove();
      await new Promise((r) => setTimeout(r));
      document.getElementById('host')!.append(p);
    });
    await expect.poll(() => text(page, '.c')).toBe('"winner"');
    await page.evaluate(() => document.getElementById('host')!.replaceChildren());
    await frames(page);
    expect((await stats(page)).states).toBe(0);
  });
});
