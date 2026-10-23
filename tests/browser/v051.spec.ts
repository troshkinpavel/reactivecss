// 0.5.1: same-task correctness of :when()-gated actions, mutation consistency, text: binding.
import { test, expect, type Page } from '@playwright/test';
import { open, frames, stats, diagnostics } from './helpers';

const v = (page: Page, sel: string, p: string) => page.$eval(sel, (e, p) => getComputedStyle(e).getPropertyValue(p).trim(), p);
/** n synchronous clicks in one task (no frame in between), then two frames so the CSS shows the result. */
const burst = async (page: Page, sel: string, n: number) => {
  await page.$eval(sel, (e, n) => { for (let i = 0; i < n; i++) (e as HTMLElement).click(); }, n);
  await frames(page); // logical state is updated synchronously; the CSS value is written in the next frame
};

test.describe(':when()-gated actions see the latest state in the same frame', () => {
  const BOUNDED = `.c { --n: state(0) } .c .up { on: click(increment(--n)) } .c .down { on: click(decrement(--n)) }
    .c:when(--n >= 3) .up { on: click(set(--n, 3)) } .c:when(--n <= 0) .down { on: click(set(--n, 0)) }`;

  test('1. many clicks in one task stop at the bound', async ({ page }) => {
    await open(page, { head: `<style>${BOUNDED}</style>`, body: '<div class="c"><button class="up">+</button><button class="down">-</button></div>' });
    await burst(page, '.c .up', 12);
    expect(await v(page, '.c', '--n')).toBe('3');
    await burst(page, '.c .down', 12);
    expect(await v(page, '.c', '--n')).toBe('0');
    expect((await stats(page)).syncs).toBeGreaterThan(0);
  });

  test('2. rapid real clicks sent before the next frame', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'sends raw input through the DevTools protocol');
    await open(page, {
      head: `<style>.q { --a: state(0); --score: state(0) } .q:when(--a == 0) .ok { on: click(set(--a, 1), increment(--score)) } .ok { width: 80px; height: 30px }</style>`,
      body: '<div class="q"><button class="ok">answer</button></div>',
    });
    const box = (await page.locator('.ok').boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const ev = (type: string) => cdp.send('Input.dispatchMouseEvent', { type, x: box.x + 10, y: box.y + 10, button: 'left', clickCount: 1 });
    await Promise.all([ev('mousePressed'), ev('mouseReleased'), ev('mousePressed'), ev('mouseReleased'), ev('mousePressed'), ev('mouseReleased')]);
    await frames(page);
    expect(await v(page, '.q', '--score')).toBe('1');
  });

  test('3–4. several actions on one state, and different elements on the same state, interleaved', async ({ page }) => {
    await open(page, {
      head: `<style>${BOUNDED} .c .up2 { on: click(increment(--n), increment(--n)) } .c:when(--n >= 2) .up2 { on: click(set(--n, 3)) }</style>`,
      body: '<div class="c"><button class="up">+</button><button class="down">-</button><button class="up2">++</button></div>',
    });
    await page.evaluate(() => {
      const [up, down, up2] = ['.up', '.down', '.up2'].map((s) => document.querySelector<HTMLElement>(s)!);
      up2.click(); up.click(); up.click(); down.click(); up2.click(); up.click(); // 2, 3, 3(clamp), 2, 3(clamp), 3(clamp)
    });
    await frames(page);
    expect(await v(page, '.c', '--n')).toBe('3');
  });

  test('5. nested owners keep separate bounds', async ({ page }) => {
    await open(page, {
      head: `<style>${BOUNDED}</style>`,
      body: '<div class="c" id="o"><button class="up">o</button><div class="c" id="i"><button class="up">i</button></div></div>',
    });
    await burst(page, '#i > .up', 5);
    await burst(page, '#o > .up', 2);
    expect([await v(page, '#o', '--n'), await v(page, '#i', '--n')]).toEqual(['2', '3']);
  });

  test('6–7. several matching :when() rules: the cascade winner applies, re-evaluated after each action', async ({ page }) => {
    await open(page, {
      head: `<style>.s { --n: state(0); --log: state("") } .s b { on: click(increment(--n)) }
        .s:when(--n >= 1) b { on: click(increment(--n), set(--log, "one")) }
        .s:when(--n >= 2):when(--n < 4) b { on: click(increment(--n), set(--log, "two")) }
        .s:when(--n >= 4) b { on: click(set(--log, "capped")) }</style>`,
      body: '<div class="s"><b>b</b></div>',
    });
    const seen = await page.$eval('.s b', (b) => {
      const out: string[] = [];
      for (let i = 0; i < 6; i++) { (b as HTMLElement).click(); out.push(getComputedStyle(b.parentElement!).getPropertyValue('--n')); }
      return out;
    });
    await frames(page);
    expect(await v(page, '.s', '--n')).toBe('4');
    expect(await v(page, '.s', '--log')).toBe('"capped"');
    expect(seen.length).toBe(6);
  });

  test('8. removing a component with pending work in the same task; other components keep working', async ({ page }) => {
    await open(page, { head: `<style>${BOUNDED}</style>`, body: '<div id="h"><div class="c" id="a"><button class="up">a</button></div><div class="c" id="b"><button class="up">b</button></div></div>' });
    await page.evaluate(() => {
      document.querySelector<HTMLElement>('#a .up')!.click();
      document.getElementById('a')!.remove();
      for (let i = 0; i < 5; i++) document.querySelector<HTMLElement>('#b .up')!.click();
    });
    await frames(page);
    expect(await v(page, '#b', '--n')).toBe('3');
    await page.evaluate(() => document.getElementById('h')!.remove());
    await frames(page);
    const s = await stats(page);
    expect([s.bindings, s.states, s.scheduled]).toEqual([0, 0, 0]);
    expect(await diagnostics(page)).toEqual([]);
  });

  test(':nth-var() gates are up to date too (a second Next in the same task meets the next step\'s validation)', async ({ page }) => {
    await open(page, {
      head: `<style>.w { --step: state(1) } .w > .p > i { display: none } .w > .p > i:nth-var(--step) { display: block }
        .w > .next { on: click(increment(--step)) } .w:has(> .p > i:nth-var(--step) :invalid) > .next { on: click(set(--step, --step)) }
        .w:when(--step >= 3) > .next { on: click(set(--step, 3)) }</style>`,
      body: '<div class="w"><div class="p"><i>one</i><i><input required></i><i>three</i></div><button class="next">next</button></div>',
    });
    await burst(page, '.w > .next', 4); // step 1 -> 2, then blocked by the required field on step 2
    expect(await v(page, '.w', '--step')).toBe('2');
    await page.fill('.w input', 'x');
    await burst(page, '.w > .next', 4);
    expect(await v(page, '.w', '--step')).toBe('3');
  });
});

test.describe('state mutations are sequential', () => {
  test('each action reads the value the previous one wrote, in one task', async ({ page }) => {
    await open(page, {
      head: `<style>.k { --n: state(0); --on: state(false); --m: state(a) } .k .i { on: click(increment(--n)) } .k .d { on: click(decrement(--n, 2)) }
        .k .t { on: click(toggle(--on)) } .k .y { on: click(cycle(--m, a, b, c)) } .k .s { on: click(set(--n, 100)) }</style>`,
      body: '<div class="k"><b class="i">i</b><b class="d">d</b><b class="t">t</b><b class="y">y</b><b class="s">s</b></div>',
    });
    await burst(page, '.k .i', 50);
    expect(await v(page, '.k', '--n')).toBe('50');
    await burst(page, '.k .d', 5);
    expect(await v(page, '.k', '--n')).toBe('40');
    await burst(page, '.k .t', 3);
    expect(await v(page, '.k', '--on')).toBe('1');
    await burst(page, '.k .y', 4);
    expect(await v(page, '.k', '--m')).toBe('b');
    await page.$eval('.k', (k) => { (k.querySelector('.s') as HTMLElement).click(); (k.querySelector('.i') as HTMLElement).click(); });
    await frames(page);
    expect(await v(page, '.k', '--n')).toBe('101');
  });
});

test.describe('text: (experimental)', () => {
  const txt = (page: Page, sel: string) => page.$eval(sel, (e) => ({ text: e.textContent, nodes: [...e.childNodes].map((n) => n.nodeType) }));

  test('writes a real text node: textContent, selection, one text node; updates with state', async ({ page }) => {
    await open(page, {
      head: `<style>.profile { --name: state("Alex") } .profile-name { text: var(--name) } .change-name { on: click(set(--name, "John")) }</style>`,
      body: '<div class="profile"><span class="profile-name"></span><button class="change-name">Change</button></div>',
    });
    expect(await txt(page, '.profile-name')).toEqual({ text: 'Alex', nodes: [3] });
    await page.click('.change-name');
    await expect.poll(() => page.textContent('.profile-name')).toBe('John');
    const selected = await page.$eval('.profile-name', (e) => { const s = getSelection()!; s.selectAllChildren(e); return s.toString(); });
    expect(selected).toBe('John');
    expect(await page.locator('.profile').ariaSnapshot()).toContain('John');
  });

  test('previous(), when() (native if() and runtime), numbers and keywords', async ({ page }) => {
    for (const native of [true, false]) {
      await open(page, {
        native,
        head: `<style>.s { --score: state(0); --online: state(false); --mode: state(dark) } .s b { on: click(increment(--score), toggle(--online)) }
          .s .cur { text: var(--score) } .s .prev { text: previous(--score) } .s .on { text: when(--online, "Online", "Offline") } .s .mode { text: var(--mode) }</style>`,
        body: '<div class="s"><b>b</b><i class="cur"></i><i class="prev"></i><i class="on"></i><i class="mode"></i></div>',
      });
      const all = () => page.$$eval('.s i', (is) => is.map((i) => i.textContent));
      expect(await all()).toEqual(['0', '0', 'Offline', 'dark']);
      await page.click('.s b');
      await expect.poll(all).toEqual(['1', '0', 'Online', 'dark']);
      await page.click('.s b');
      await expect.poll(all).toEqual(['2', '1', 'Offline', 'dark']);
    }
  });

  test('special characters, Unicode, very long strings and markup stay literal text', async ({ page }) => {
    const values = ['', 'こんにちは 👋', 'say "hi" & <b>bold</b>', 'back\\slash', 'two\nlines', '<img src=x onerror=alert(1)>', 'x'.repeat(20000)];
    await open(page, {
      head: `<style>.v { --t: state(attr(data-t)) } .v span { text: var(--t) }</style>`,
      body: values.map((v) => `<p class="v" data-t="${v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"><span></span></p>`).join(''),
    });
    let dialogs = 0;
    page.on('dialog', (d) => { dialogs++; d.dismiss(); });
    expect(await page.$$eval('.v span', (s) => s.map((x) => x.textContent))).toEqual(values);
    expect(await page.$$eval('.v span', (s) => s.map((x) => x.children.length))).toEqual(values.map(() => 0));
    expect(await page.$$eval('img', (i) => i.length)).toBe(0);
    expect(dialogs).toBe(0);
  });

  test('never touches an element with child elements (diagnostic); a dedicated child works', async ({ page }) => {
    await open(page, {
      head: `<style>.f { --label: state("Send") } .submit { text: var(--label) } .ok span { text: var(--label) }</style>`,
      body: '<div class="f"><button class="submit"><svg width="10" height="10"></svg><span>Submit</span></button><button class="ok"><svg width="10" height="10"></svg><span>Submit</span></button></div>',
    });
    expect(await page.$eval('.submit', (b) => b.innerHTML)).toBe('<svg width="10" height="10"></svg><span>Submit</span>');
    expect(await page.textContent('.ok span')).toBe('Send');
    expect((await diagnostics(page)).join('\n')).toMatch(/text: on button\.submit is ignored: the element has other content/);
  });

  test('cascade: specificity, :when(), media; the original text when no declaration applies', async ({ page }) => {
    await open(page, {
      head: `<style>.d { --n: state(0) } .d b { on: click(increment(--n)) }
        .d .dir.dir { text: "special" } .d .dir { text: "base" }
        .d:when(--n > 0) .arrow { text: "up" }
        @media (max-width: 1px) { .d .m { text: "tiny" } }</style>`,
      body: '<div class="d"><b>b</b><i class="dir"></i><i class="arrow">—</i><i class="m">wide</i></div>',
    });
    expect([await page.textContent('.dir'), await page.textContent('.arrow'), await page.textContent('.m')]).toEqual(['special', '—', 'wide']);
    await page.click('.d b');
    await expect.poll(() => page.textContent('.arrow')).toBe('up');
  });

  test('lifecycle: rule unmatch restores the original, reinsertion binds again, recompile keeps working, sheet removal restores', async ({ page }) => {
    await open(page, {
      head: `<style id="s">.p { --name: state("Alex") } .p .on { text: var(--name) }</style>`,
      body: '<div id="host"><div class="p"><span class="on">Loading…</span></div></div>',
    });
    expect(await page.textContent('.p span')).toBe('Alex');
    await page.evaluate(() => document.querySelector('.p span')!.classList.remove('on'));
    await expect.poll(() => page.textContent('.p span')).toBe('Loading…');
    await page.evaluate(() => document.querySelector('.p span')!.classList.add('on'));
    await expect.poll(() => page.textContent('.p span')).toBe('Alex');
    await page.evaluate(async () => { const p = document.querySelector('.p')!; p.remove(); await new Promise((r) => setTimeout(r)); document.getElementById('host')!.append(p); });
    await expect.poll(() => page.textContent('.p span')).toBe('Alex');
    for (let k = 0; k < 5; k++) await page.evaluate((k) => { document.getElementById('s')!.textContent += `/* ${k} */`; }, k);
    await frames(page);
    expect(await page.textContent('.p span')).toBe('Alex');
    expect(await page.$eval('.p span', (e) => e.childNodes.length)).toBe(1);
    await page.evaluate(() => document.getElementById('s')!.remove());
    await frames(page);
    expect(await page.textContent('.p span')).toBe('Loading…');
    expect((await stats(page)).bindings).toBe(0);
  });

  test('nested owners; text changed by someone else is left alone (the binding yields)', async ({ page }) => {
    await open(page, {
      head: `<style>.o { --name: state(attr(data-n)) } .o > span { text: var(--name) } .o b { on: click(set(--name, "changed")) }</style>`,
      body: '<div class="o" id="a" data-n="outer"><span></span><div class="o" id="b" data-n="inner"><span></span><b>b</b></div></div>',
    });
    expect([await page.textContent('#a > span'), await page.textContent('#b > span')]).toEqual(['outer', 'inner']);
    await page.evaluate(() => { document.querySelector('#b > span')!.textContent = 'framework'; });
    await page.click('#b b');
    await frames(page);
    expect(await page.textContent('#b > span')).toBe('framework');
    expect((await diagnostics(page)).join('\n')).toMatch(/stopped: its text or children were changed by something else/);
  });

  test('untrusted stylesheets cannot write text; a strict CSP is fine; native content is untouched', async ({ page }) => {
    await open(page, {
      head: `<script>window.ReactiveCSSConfig = { trustInlineStyles: false }</script><style>.p { --name: state("Alex") } .p span { text: var(--name) } .p i::after { content: var(--name) }</style>`,
      body: '<div class="p"><span>original</span><i></i></div>',
    });
    expect(await page.textContent('.p span')).toBe('original');
    expect((await diagnostics(page)).join('\n')).toMatch(/text: is ignored in untrusted stylesheets/);
    expect(await page.$eval('.p i', (e) => getComputedStyle(e, '::after').content)).toBe('"Alex"');
  });

  test('works from a linked sheet under a strict CSP', async ({ page }) => {
    await open(page, {
      head: '<link rel="stylesheet" href="/t/css/t.css">', body: '<div class="p"><span></span><b>b</b></div>',
      css: { 't.css': `.p { --n: state(0) } .p span { text: var(--n) } .p b { on: click(increment(--n)) }` },
      csp: "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'",
    });
    await expect.poll(() => page.textContent('.p span')).toBe('0');
    await page.click('.p b');
    await expect.poll(() => page.textContent('.p span')).toBe('1');
  });

  test('values that are not one scalar are reported, not shown; unsupported functions are compile errors', async ({ page }) => {
    await open(page, {
      head: `<style>.p { --a: state("x") } .p .two { text: "a" "b" } .p .calc { text: calc(1 + 2) } .p .live { text: live(pick("a"), 1s) }</style>`,
      body: '<div class="p"><i class="two">two</i><i class="calc">calc</i><i class="live">live</i></div>',
    });
    expect(await page.$$eval('.p i', (is) => is.map((i) => i.textContent))).toEqual(['two', 'calc', 'live']);
    const d = (await diagnostics(page)).join('\n');
    expect(d).toMatch(/needs one value/);
    expect(d).toMatch(/calc\(\) is not supported/);
    expect(d).toMatch(/live\(\) is not supported/);
  });

  test('many bindings (the owner-subtree path): one component updates alone; a page-level owner updates all', async ({ page }) => {
    await open(page, {
      head: `<style>body { --mode: state("light") } .t { --n: state(0) } .t b { on: click(increment(--n)) } .t .n { text: var(--n) } .t .m { text: var(--mode) }
        #switch { on: click(set(--mode, "dark")) }</style>`,
      body: '<button id="switch">s</button>' + '<p class="t"><b>b</b><i class="n">0</i><i class="m"></i></p>'.repeat(100),
    });
    await page.click('.t:nth-of-type(37) b');
    await frames(page);
    const ns = await page.$$eval('.t .n', (is) => is.map((i) => i.textContent));
    expect(ns.filter((x) => x === '1').length).toBe(1);
    expect(ns.indexOf('1')).toBe(36);
    await page.click('#switch');
    await frames(page);
    expect(new Set(await page.$$eval('.t .m', (is) => is.map((i) => i.textContent)))).toEqual(new Set(['dark']));
  });
});
