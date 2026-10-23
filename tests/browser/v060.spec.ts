// 0.6.0: focus: (declarative focus on state transitions) and the new attributes (aria-disabled,
// tabindex 0/-1). Semantics: docs/rfc-focus-declaration-0.6.md (rule numbers in the test names).
import { test, expect, type Page } from '@playwright/test';
import { open, frames, stats, diagnostics } from './helpers';

const active = (page: Page) => page.evaluate(() => { const a = document.activeElement!; return a === document.body ? 'body' : a.id || a.className || a.localName; });
const diag = async (page: Page) => (await diagnostics(page)).join('\n');

// A two-step widget; `extra` adds rules. attr: on the buttons makes the same-task path run.
const WIZ = (extra = '', attrs = true) => `<style>
  .w { --step: state(1) }
  .w .next { on: click(increment(--step)); ${attrs ? 'attr: disabled when(--step >= 3);' : ''} }
  .w .back { on: click(decrement(--step)); ${attrs ? 'attr: disabled when(--step <= 1);' : ''} }
  .w .panel { display: none } .w .panel:nth-var(--step) { display: block }
  .w .panel > h2 { focus: false } .w .panel:nth-var(--step) > h2 { focus: true }
  ${extra}
</style>`;
const WIZ_BODY = `<div class="w" id="w"><div class="panels">
  <section class="panel"><h2 tabindex="-1" id="h1">One</h2></section>
  <section class="panel"><h2 tabindex="-1" id="h2">Two</h2></section>
  <section class="panel"><h2 tabindex="-1" id="h3">Three</h2></section>
</div><button class="back" id="back">Back</button><button class="next" id="next">Next</button><input id="other"></div>`;

for (const attrs of [true, false]) {
  const mode = attrs ? 'same-task path (attr: present)' : 'frame path (no attr:)';
  test.describe(`transitions, ${mode}`, () => {
    test('rules 2–4: no focus on load; a user click moves focus to the new step heading; Back too', async ({ page }) => {
      await open(page, { head: WIZ('', attrs), body: WIZ_BODY });
      await frames(page);
      expect(await active(page)).toBe('body'); // rule 3: never on load
      await page.click('#next');
      await frames(page);
      expect(await active(page)).toBe('h2');
      await page.click('#next');
      await frames(page);
      expect(await active(page)).toBe('h3');
      await page.click('#back');
      await frames(page);
      expect(await active(page)).toBe('h2');
      expect(await diagnostics(page)).toEqual([]);
    });

    test('rule 4: keyboard activation arms; a scripted click, a timer and focusin do not', async ({ page }) => {
      await open(page, { head: WIZ(`.w #other { on: focusin(set(--step, 3)) }`, attrs), body: WIZ_BODY });
      await page.focus('#next');
      await page.keyboard.press('Enter');
      await frames(page);
      expect(await active(page)).toBe('h2');
      await page.focus('#back');
      await page.$eval('#next', (b) => (b as HTMLElement).click()); // untrusted: state changes, focus stays
      await frames(page);
      expect([await active(page), await page.$eval('#h3', (h) => getComputedStyle(h.parentElement!).display)]).toEqual(['back', 'block']);
      await page.click('#back');
      await frames(page);
      expect(await active(page)).toBe('h2');
      await page.focus('#other'); // focusin sets --step 3: not armed, focus stays on the input (no cycle)
      await frames(page, 3);
      expect(await active(page)).toBe('other');
    });

    test('rapid clicks never focus an outdated step', async ({ page }) => {
      await open(page, { head: WIZ('', attrs), body: WIZ_BODY });
      const box = (await page.locator('#next').boundingBox())!;
      await page.mouse.click(box.x + 5, box.y + 5);
      await page.mouse.click(box.x + 5, box.y + 5);
      await frames(page, 3);
      expect(await active(page)).toBe('h3');
    });

    test('rule 8: focus moved by the user (or a page script) before resolution is left alone', async ({ page }) => {
      await open(page, { head: WIZ('', attrs), body: WIZ_BODY });
      // A bubble listener runs after the library's capture listener, in the same task: like a
      // user moving focus before the request resolves.
      await page.evaluate(() => document.addEventListener('click', () => document.getElementById('other')!.focus(), { once: true }));
      await page.click('#next');
      await frames(page, 3);
      // Frame path: the request is dropped (focus moved since the click). Same-task path: focus went
      // to the heading during the click, then the page's listener moved it: the page wins either way.
      expect(await active(page)).toBe('other');
    });
  });
}

test.describe('eligibility (rule 6)', () => {
  test('a heading inside a panel un-hidden by attr: hidden in the same transition gets focus', async ({ page }) => {
    await open(page, {
      head: `<style>.d { --open: state(false) } .d .t { on: click(toggle(--open)) } .d .p { attr: hidden when(--open, false, true) } .d .p h3 { focus: var(--open) }</style>`,
      body: '<div class="d"><button class="t">t</button><div class="p"><h3 tabindex="-1" id="h">Details</h3></div></div>',
    });
    await page.click('.t');
    await frames(page);
    expect(await active(page)).toBe('h');
  });

  test('not focusable (no tabindex): a warning, focus unchanged; tabindex is never added', async ({ page }) => {
    await open(page, { head: `<style>.n { --on: state(false) } .n b { on: click(toggle(--on)) } .n h3 { focus: var(--on) }</style>`, body: '<div class="n"><button><b>t</b></button><h3>Plain</h3></div>' });
    await page.click('.n b');
    await frames(page);
    expect(await page.$eval('.n h3', (h) => h.hasAttribute('tabindex'))).toBe(false);
    expect(await active(page)).not.toBe('h3');
    expect(await diag(page)).toMatch(/focus: h3 is not focusable\. Give it tabindex="-1"/);
  });

  test('display: none, disabled and inert targets: a note, focus unchanged', async ({ page }) => {
    await open(page, {
      head: `<style>.e { --on: state(false) } .e .t { on: click(toggle(--on)) } .e .x { focus: var(--on) } .e .gone { display: none }</style>`,
      body: '<div class="e"><button class="t" id="t">t</button><h3 class="x gone" tabindex="-1" id="a">a</h3><button class="x" disabled id="b">b</button><div inert><button class="x" id="c">c</button></div></div>',
    });
    await page.click('#t');
    await frames(page);
    expect(['a', 'b', 'c']).not.toContain(await active(page));
    const d = await diag(page);
    expect(d).toMatch(/focus: h3#a\.x\.gone is not rendered/);
    expect(d).toMatch(/focus: button#b\.x is disabled/);
    expect(d).toMatch(/focus: button#c\.x is inert/);
  });

  test('rule 7: several transitions in one update: the first eligible in document order', async ({ page }) => {
    await open(page, {
      head: `<style>.m { --on: state(false) } .m .t { on: click(toggle(--on)) } .m h3 { focus: var(--on) } .m .hidden { display: none }</style>`,
      body: '<div class="m"><button class="t">t</button><h3 tabindex="-1" class="hidden" id="first">1</h3><h3 tabindex="-1" id="second">2</h3><h3 tabindex="-1" id="third">3</h3></div>',
    });
    await page.click('.t');
    await frames(page);
    expect(await active(page)).toBe('second'); // the first is not rendered: skipped
  });

  test('rule 8: focus already inside the target, or inside an open dialog, is not moved', async ({ page }) => {
    await open(page, {
      head: `<style>.k { --on: state(false); on: key(x, toggle(--on)) } .k .t { on: click(toggle(--on)) } .k .region { focus: var(--on) }</style>`,
      body: `<div class="k"><div class="region" tabindex="-1" id="region"><button class="t" id="inside">toggle</button></div></div>
        <div class="k" id="k2"><div class="region" tabindex="-1" id="r2">r</div><dialog open id="dlg"><button id="in-dialog">x</button></dialog><button id="plain">p</button></div>`,
    });
    await page.focus('#inside');
    await page.keyboard.press('Enter');
    await frames(page);
    expect(await active(page)).toBe('inside'); // already inside the target
    await page.focus('#in-dialog');
    await page.keyboard.press('x'); // a trusted keydown inside the owner, while focus is in an open dialog
    await frames(page);
    expect(await active(page)).toBe('in-dialog');
    await page.keyboard.press('x'); // back to false
    await frames(page); // a value that goes true → false → true before a frame is no transition (rule 2)
    await page.focus('#plain');
    await page.keyboard.press('x'); // outside the dialog: focus moves
    await frames(page);
    expect(await active(page)).toBe('r2');
  });
});

test.describe('lifecycle, cascade, ownership', () => {
  test('cascade: a more specific focus: false wins; a removed target cancels; inserted true targets never focus', async ({ page }) => {
    await open(page, {
      head: `<style>.c { --on: state(false) } .c .t { on: click(toggle(--on)) } .c h3 { focus: var(--on) } .c h3.never { focus: false }
</style>`,
      body: '<div class="c" id="c"><button class="t" id="t">t</button><h3 tabindex="-1" class="never" id="n">n</h3></div><div id="host"></div>',
    });
    await page.focus('#t');
    await page.keyboard.press('Enter');
    await frames(page);
    expect(await active(page)).toBe('t');
    await page.keyboard.press('Enter'); // back to false
    // a target removed in the same task as the transition: no focus, no error
    await page.evaluate(() => document.getElementById('c')!.insertAdjacentHTML('beforeend', '<h3 tabindex="-1" id="gone">g</h3>'));
    await frames(page);
    await page.evaluate(() => document.addEventListener('click', () => document.getElementById('gone')!.remove(), { once: true, capture: true }));
    await page.keyboard.press('Enter'); // frame path: the target is removed before the request resolves
    await frames(page);
    expect(await active(page)).toBe('t');
    // inserted while already true: initial read, no focus
    await page.evaluate(() => document.getElementById('c')!.insertAdjacentHTML('beforeend', '<h3 tabindex="-1" id="late">late</h3>'));
    await frames(page, 3);
    expect(await active(page)).toBe('t');
    expect(await diagnostics(page)).toEqual([]);
    await page.evaluate(() => document.getElementById('c')!.remove());
    await frames(page);
    expect((await stats(page)).bindings).toBe(0);
  });

  test('nested owners: each focus: follows its nearest owner', async ({ page }) => {
    await open(page, {
      head: `<style>.o { --on: state(false) } .o > .t { on: click(toggle(--on)) } .o > h3 { focus: var(--on) }</style>`,
      body: '<div class="o"><button class="t" id="outer">o</button><h3 tabindex="-1" id="ho">outer</h3><div class="o"><button class="t" id="inner">i</button><h3 tabindex="-1" id="hi">inner</h3></div></div>',
    });
    await page.click('#inner');
    await frames(page);
    expect(await active(page)).toBe('hi');
    await page.click('#outer');
    await frames(page);
    expect(await active(page)).toBe('ho');
  });

  test('recompiling or replacing the sheet never moves focus; untrusted sheets cannot use focus:', async ({ page }) => {
    await open(page, { head: `<style id="s">.r { --on: state(true) } .r h3 { focus: var(--on) }</style>`, body: '<div class="r"><h3 tabindex="-1" id="h">h</h3><input id="i"></div>' });
    await page.focus('#i');
    await page.evaluate(() => { document.getElementById('s')!.textContent = '.r { --on: state(true) } .r h3 { focus: true; color: red }'; });
    await frames(page, 3);
    expect(await active(page)).toBe('i');
    const p2 = await page.context().newPage();
    await open(p2, { head: `<script>window.ReactiveCSSConfig = { trustInlineStyles: false }</script><style>.u h3 { focus: true }</style>`, body: '<div class="u"><h3 tabindex="-1">u</h3></div>' });
    expect((await diagnostics(p2)).join('\n')).toMatch(/focus: is ignored in untrusted stylesheets/);
    await p2.close();
  });

  test('invalid values are reported and count as false', async ({ page }) => {
    await open(page, { head: `<style>.v { --s: state("x") } .v .t { on: click(set(--s, "yes")) } .v h3 { focus: var(--s) }</style>`, body: '<div class="v"><button class="t">t</button><h3 tabindex="-1">h</h3></div>' });
    await page.click('.t');
    await frames(page);
    expect(await active(page)).not.toBe('h3');
    expect(await diag(page)).toMatch(/focus: on <h3> needs true or false/);
  });
});

test.describe('new attributes', () => {
  test('aria-disabled: true/false from booleans; it does not block clicks (conditional on: does)', async ({ page }) => {
    await open(page, {
      head: `<style>.a { --n: state(0) } .a .plus { on: click(increment(--n)); attr: aria-disabled when(--n >= 2) }
        .a:when(--n >= 2) .plus { on: click(set(--n, 2)) } .a .free { attr: aria-disabled var(--locked) } .a { --locked: state(true) }</style>`,
      body: '<div class="a"><button class="plus">+</button><button class="free">f</button></div>',
    });
    await frames(page);
    expect(await page.getAttribute('.plus', 'aria-disabled')).toBe('false');
    expect(await page.getAttribute('.free', 'aria-disabled')).toBe('true'); // 1 → "true"
    await page.$eval('.plus', (b) => { for (let i = 0; i < 5; i++) (b as HTMLElement).click(); });
    expect(await page.getAttribute('.plus', 'aria-disabled')).toBe('true');
    expect(await page.$eval('.a', (e) => getComputedStyle(e).getPropertyValue('--n').trim())).toBe('2'); // the clamp rule, not the attribute, stops it
    await page.focus('.plus');
    await page.keyboard.press('Enter');
    expect(await active(page)).toBe('plus'); // still focusable (unlike disabled)
  });

  test('tabindex: only 0 and -1; restored on removal; bind(tabindex) needs a number state', async ({ page }) => {
    await open(page, {
      head: `<style>.r { --a: state(1) } .r b { attr: tabindex "-1" } .r b:nth-child(1) { attr: tabindex "0" } .r i { attr: tabindex "3" }
        .x { --t: state("a", bind(tabindex)) }</style>`,
      body: '<div class="r"><b>1</b><b>2</b><i tabindex="5">i</i></div><div class="x"></div>',
    });
    await frames(page);
    expect(await page.$$eval('.r b', (bs) => bs.map((b) => b.getAttribute('tabindex')))).toEqual(['0', '-1']);
    expect(await page.getAttribute('.r i', 'tabindex')).toBe('5'); // invalid value: unchanged
    const d = await diag(page);
    expect(d).toMatch(/attr: tabindex on <i> cannot be "?3"?: use 0 or -1/);
    expect(d).toMatch(/bind\(tabindex\) needs a number state/);
  });
});
