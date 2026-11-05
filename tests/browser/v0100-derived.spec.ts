// 0.10 step 8 (experiment): computed custom properties (derived declarations). The value is a
// read-only state and the CSS custom property at once: these tests check that they agree, and
// cover chains, settling order, cycles, conflicts, cleanup, moves, shadowing and dynamic matches.
import { test, expect, type Page } from '@playwright/test';
import { open, frames, style, stats, diagnostics } from './helpers';

const v = (page: Page, sel: string, p: string) => style(page, sel, p).then((s) => s.trim());
const text = (page: Page, sel: string) => page.$eval(sel, (e) => e.textContent);
const inline = (page: Page, sel: string, p: string) => page.$eval(sel, (e, p) => (e as HTMLElement).style.getPropertyValue(p), p);
const input = (page: Page, sel: string, s: string) => page.$eval(sel, (el: HTMLInputElement, s) => { el.value = s; el.dispatchEvent(new Event('input', { bubbles: true })); }, s);
const diag = async (page: Page) => (await diagnostics(page)).join('\n');

const FORM = `.form { --value: state(""); --clean: trim(--value); --chars: length(--clean); --seen: state(0) }
  .form textarea:on(input) { --value: set(event(value)) }
  .form button:on(click) { --seen: set(var(--chars)) }
  .form .count { text: var(--chars) }
  .form .warn { display: none }
  .form:when(--chars > 3) .warn { display: inline }
  .form .bar { width: calc(var(--chars) * 10px) }
  .form .echo::after { content: var(--clean) }`;
const FORM_BODY = '<div class="form"><textarea></textarea><button>b</button><span class="count"></span><b class="warn">!</b><i class="bar" style="display:block"></i><s class="echo"></s></div>';

test('a chain settles in one input: text:, :when(), calc(), content: and the next action agree', async ({ page }) => {
  await open(page, { head: `<style>${FORM}</style>`, body: FORM_BODY });
  await frames(page);
  expect([await text(page, '.count'), await v(page, '.form', '--chars'), await v(page, '.form', '--clean')]).toEqual(['0', '0', '""']);
  // One input event and, in the same task, a click whose action reads --chars.
  await page.$eval('textarea', (el: HTMLTextAreaElement) => {
    el.value = '  hello  ';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.parentElement!.querySelector('button')!.click();
  });
  await frames(page, 1);
  expect(await v(page, '.form', '--seen')).toBe('5'); // the chain settled inside the input event
  expect([await text(page, '.count'), await v(page, '.warn', 'display'), await v(page, '.bar', 'width')]).toEqual(['5', 'inline', '50px']);
  expect([await v(page, '.form', '--clean'), await v(page, '.form', '--chars')]).toEqual(['"hello"', '5']);
  expect(await page.$eval('.echo', (e) => getComputedStyle(e, '::after').content)).toBe('"hello"');
  // Inherited exactly as written on the owner.
  expect(await v(page, '.count', '--chars')).toBe('5');
  expect(await diagnostics(page)).toEqual([]);
});

test('a clock: live(time(), 1s) and timezone() read as states, format() shows them', async ({ page }) => {
  const at = new Date('2026-10-28T10:00:58Z');
  await page.clock.install({ time: new Date(at.getTime() - 10_000) });
  await page.clock.pauseAt(at);
  await open(page, { head: `<style>.clock { --now: live(time(), 1s); --tokyo: timezone(--now, "Asia/Tokyo") }
    .clock .t { text: format(--tokyo, "HH:mm:ss") }
    .clock:when(format(--tokyo, "ss") == "00") .t { color: rgb(255, 0, 0) }</style>`, body: '<div class="clock"><span class="t"></span></div>' });
  await page.clock.runFor(50);
  expect(await text(page, '.t')).toBe('19:00:58');
  expect(await v(page, '.clock', '--now')).toBe(String(at.getTime()));
  await page.clock.runFor(2000);
  expect(await text(page, '.t')).toBe('19:01:00');
  expect(await v(page, '.t', 'color')).toBe('rgb(255, 0, 0)');
  expect(await diagnostics(page)).toEqual([]);
});

test('read-only: :on() actions, legacy on: actions and bind: change nothing, with one diagnostic each', async ({ page }) => {
  await open(page, { head: `<style>${FORM}
    .form .a:on(click) { --chars: set(99) }
    .form .b { on: click(increment(--chars)) }
    .form input { bind: --clean }</style>`, body: FORM_BODY.replace('</div>', '<i class="a">a</i><i class="b">b</i><input></div>') });
  await input(page, 'textarea', 'abc');
  await page.click('.a');
  await page.click('.b');
  await input(page, 'input', 'typed');
  await frames(page);
  expect([await v(page, '.form', '--chars'), await v(page, '.form', '--clean')]).toEqual(['3', '"abc"']);
  const d = await diag(page);
  expect(d).toMatch(/set\(\) .*--chars is computed by its declaration \(read-only\); nothing is changed/);
  expect(d).toMatch(/increment\(\) on i\.b: --chars is computed by its declaration \(read-only\)/);
  expect(d).toMatch(/bind: on input: --clean is computed by its declaration \(read-only\)/);
});

test('conflicts: any other declaration of the name in the processed stylesheets turns it off, with a reason', async ({ page }) => {
  await open(page, { head: `<style>.a { --v: state("x"); --low: lower(--v) } .a .inner { --low: "plain" }
      .b { --v: state("x"); --one: lower(--v); --two: trim(--v) } .b .c { --two: trim(--v) }
      @property --reg { syntax: "*"; inherits: false } .r { --v: state("x"); --reg: lower(--v) }</style>
    <style>.s { --dup: state(1) }</style><style>.s { --v: state("x"); --dup: lower(--v) }</style>`,
  body: '<div class="a"><i class="inner"></i></div><div class="b"><i class="c"></i></div><div class="r"></div><div class="s"></div>' });
  await frames(page);
  const d = await diag(page);
  expect(d).toMatch(/--low is declared 2 times in the processed stylesheets/);
  expect(d).toMatch(/--two is declared 2 times/);
  expect(d).toMatch(/--reg is declared 2 times/);
  expect(d).toMatch(/--dup is declared 2 times/);
  expect(d).not.toMatch(/--one/);
  expect(await inline(page, '.a', '--low')).toBe('');
  expect(await v(page, '.inner', '--low')).toBe('"plain"'); // the other declaration still applies as CSS
  expect(await v(page, '.b', '--one')).toBe('"x"'); // an unrelated name in the same rule is computed
  expect(await v(page, '.s', '--dup')).toBe('1'); // the state() of that name still works
});

test('conflicts are dynamic: a stylesheet added later turns the name off; removing it turns it on again', async ({ page }) => {
  await open(page, { head: `<style>${FORM}</style>`, body: FORM_BODY });
  await input(page, 'textarea', 'abcd');
  await frames(page);
  const before = (await stats(page)).states;
  await page.evaluate(() => { const s = document.createElement('style'); s.id = 'late'; s.textContent = '.other { --z: state(0) } .form .count { --chars: 7 }'; document.head.append(s); });
  await frames(page);
  expect(await diag(page)).toMatch(/--chars is declared 2 times/);
  expect(await inline(page, '.form', '--chars')).toBe('');
  expect((await stats(page)).states).toBe(before - 1);
  expect(await v(page, '.warn', 'display')).toBe('none'); // :when(--chars > 3) has no state to read
  await page.evaluate(() => document.getElementById('late')!.remove());
  await frames(page);
  expect([await inline(page, '.form', '--chars'), await text(page, '.count'), await v(page, '.warn', 'display')]).toEqual(['4', '4', 'inline']);
  expect((await stats(page)).states).toBe(before);
});

test('cycles are rejected before anything is computed', async ({ page }) => {
  await open(page, { head: `<style>.c { --a: trim(--b); --b: lower(--a); --s: trim(--s); --v: state("V"); --ok: lower(--v) }</style>`, body: '<div class="c"></div>' });
  await frames(page);
  const d = await diag(page);
  expect(d).toMatch(/--a reads itself through --b; computed custom properties cannot form a cycle/);
  expect(d).toMatch(/--b reads itself through --a/);
  expect(d).toMatch(/--s reads itself through its own value/);
  expect([await inline(page, '.c', '--a'), await inline(page, '.c', '--s'), await v(page, '.c', '--ok')]).toEqual(['', '', '"v"']);
});

test('dynamic matches and cleanup: a class makes an owner, removal disposes it, nothing leaks', async ({ page }) => {
  await open(page, { head: `<style>.list { --q: state("AB") } .item.on { --up: lower(--q) } .item .t { text: var(--up, "-") }</style>`,
    body: '<div class="list"><div class="item"><span class="t"></span></div></div>' });
  await frames(page);
  const base = (await stats(page)).states;
  expect(await text(page, '.t')).toBe('-');
  await page.$eval('.item', (e) => e.classList.add('on'));
  await frames(page);
  expect([await text(page, '.t'), await inline(page, '.item', '--up')]).toEqual(['ab', '"ab"']);
  await page.$eval('.item', (e) => e.classList.remove('on'));
  await frames(page);
  expect([await text(page, '.t'), await inline(page, '.item', '--up')]).toEqual(['-', '']);
  for (let i = 0; i < 50; i++) {
    await page.evaluate(() => {
      const it = document.createElement('div'); it.className = 'item on'; it.innerHTML = '<span class="t"></span>';
      document.querySelector('.list')!.append(it);
    });
    await frames(page, 1);
    await page.evaluate(() => document.querySelector('.list')!.lastElementChild!.remove());
  }
  await frames(page);
  expect((await stats(page)).states).toBe(base);
  expect(await diagnostics(page)).toEqual([]);
});

test('element moves: a moved consumer reads its new owner at once; a moved owner reads its new ancestor', async ({ page }) => {
  await open(page, { head: `<style>.list { --q: state("A") } #l2 { --q: state("B") } .item { --up: lower(--q) } .item .t { text: var(--up) }
    #l2 button:on(click) { --q: set("C") }</style>`,
  body: '<div class="list" id="l1"><div class="item" id="i1"><span class="t" id="t1"></span></div></div><div class="list" id="l2"><button>c</button><div class="item" id="i2"><span class="t" id="t2"></span></div></div>' });
  await frames(page);
  expect([await text(page, '#t1'), await text(page, '#t2')]).toEqual(['a', 'b']);
  // A consumer moved into another owner: CSS and text: both follow at once (v0100-move.spec.ts covers every reader).
  await page.evaluate(() => document.getElementById('i2')!.append(document.getElementById('t1')!));
  await frames(page);
  expect([await v(page, '#t1', '--up'), await text(page, '#t1')]).toEqual(['"b"', 'b']);
  await page.click('button');
  await frames(page);
  expect([await v(page, '#t1', '--up'), await text(page, '#t1')]).toEqual(['"c"', 'c']);
  // A moved owner re-resolves its inputs at once.
  await page.evaluate(() => document.getElementById('l1')!.append(document.getElementById('i2')!));
  await frames(page);
  expect([await inline(page, '#i2', '--up'), await text(page, '#t2')]).toEqual(['"a"', 'a']);
  expect(await diagnostics(page)).toEqual([]);
});

test('shadowing: nested owners, and a closer input owner that appears later', async ({ page }) => {
  await open(page, { head: `<style>.box { --v: state("Outer"); --low: lower(--v) } #n { --v: state("Inner") } .box .t { text: var(--low) }
      .list { --q: state("LIST") } .group.on { --q: state("GROUP") } .item { --up: lower(--q) } .item .u { text: var(--up) }</style>`,
  body: '<div class="box" id="o"><span class="t" id="to"></span><div class="box" id="n"><span class="t" id="tn"></span></div></div>'
    + '<div class="list"><div class="group"><div class="item"><span class="u"></span></div></div></div>' });
  await frames(page);
  expect([await text(page, '#to'), await text(page, '#tn')]).toEqual(['outer', 'inner']); // the nearest owner, for CSS and state
  expect([await v(page, '#to', '--low'), await v(page, '#tn', '--low')]).toEqual(['"outer"', '"inner"']);
  expect(await text(page, '.u')).toBe('list');
  await page.$eval('.group', (e) => e.classList.add('on'));
  await frames(page);
  expect([await text(page, '.u'), await inline(page, '.item', '--up')]).toEqual(['group', '"group"']);
  await page.$eval('.group', (e) => e.classList.remove('on'));
  await frames(page);
  expect(await text(page, '.u')).toBe('list');
  expect(await diagnostics(page)).toEqual([]);
});

test('a diamond settles once: previous() never sees an intermediate value', async ({ page }) => {
  await open(page, { head: `<style>.d { --v: state("a"); --a: lower(--v); --b: trim(--v); --c: format(length(--a) + length(--b), "integer") }
    .d button:on(click) { --v: set("abc") } .d .now { text: var(--c) } .d .was { text: previous(--c) }</style>`,
  body: '<div class="d"><button>x</button><span class="now"></span><span class="was"></span></div>' });
  await frames(page);
  expect(await text(page, '.now')).toBe('2');
  await page.click('button');
  await frames(page);
  expect([await text(page, '.now'), await text(page, '.was')]).toEqual(['6', '2']); // not 4
  expect(await diagnostics(page)).toEqual([]);
});

test('owner-level checks: an inline style value is left alone; an !important rule we do not process is reported', async ({ page }) => {
  await open(page, { head: `<style>${FORM}</style><style>.form.forced { --clean: "forced" !important }</style>`,
    body: FORM_BODY.replace('class="form"', 'class="form" id="f1" style="--clean: \'mine\'"') + FORM_BODY.replace('class="form"', 'class="form forced" id="f2"') + FORM_BODY.replace('class="form"', 'class="form" id="f3"') });
  await page.waitForTimeout(200);
  const d = await diag(page);
  expect(d).toMatch(/--clean on div#f1\.form has an inline style value; it is not computed on that element/);
  expect(d).toMatch(/--clean on div#f2\.form\.forced: CSS shows "forced", its computed state is ""/);
  expect(await inline(page, '#f1', '--clean')).toMatch(/^['"]mine['"]$/); // untouched (WebKit serializes it with double quotes)
  expect(await v(page, '#f3', '--clean')).toBe('""');
});

test('errors keep the last value; a missing input is reported once after a second', async ({ page }) => {
  await open(page, { head: `<style>.e { --x: state("5"); --n: format(--x, "integer") } .e button:on(click) { --x: set("abc") } .e .t { text: var(--n) }
    .m { --k: trim(--nothing) }</style>`, body: '<div class="e"><button>x</button><span class="t"></span></div><div class="m"></div>' });
  await frames(page);
  expect(await text(page, '.t')).toBe('5');
  await page.click('button');
  await frames(page);
  expect([await text(page, '.t'), await inline(page, '.e', '--n')]).toEqual(['5', '"5"']);
  await page.waitForTimeout(1100);
  const d = await diag(page);
  expect(d).toMatch(/--n: format\(--x, "integer"\) on div\.e: format\(\): "integer" formats numbers; "abc" is a string; it keeps its last value/);
  expect(d).toMatch(/--k: trim\(--nothing\) on div\.m reads --nothing, but no element declares --nothing as a state/);
  expect(await inline(page, '.m', '--k')).toBe('');
});

test('not computed, with a reason; the declaration stays CSS-only', async ({ page }) => {
  await open(page, { head: `<style>.f { --v: state("Ab"); --on: state(true) }
    .f:when(--on) { --w: lower(--v) }
    @media (min-width: 1px) { .f { --m: lower(--v) } }
    .f { --i: lower(--v) !important; --at: lower(attr(data-x)); --t: time() }
    .f .w::after { content: var(--w) }</style>`, body: '<div class="f" data-x="X"><span class="w"></span></div>' });
  await frames(page);
  const d = await diag(page);
  expect(d).toMatch(/--w is not a computed state: it is in a conditional rule/);
  expect(d).toMatch(/--m is not a computed state: it is in a conditional rule/);
  expect(d).toMatch(/--i is not a computed state: !important is not supported on it/);
  expect(d).toMatch(/--at is not a computed state: it reads attr\(data-x\), which can change without a state change/);
  expect(d).toMatch(/--t is not a computed state: it reads time\(\) outside live\(\).*live\(time\(\), 1s\)/);
  expect(await page.$eval('.w', (e) => getComputedStyle(e, '::after').content)).toBe('"ab"'); // CSS-only, as in step 7
  expect(await inline(page, '.f', '--w')).toBe('');
});

test('custom bundles: without the feature the declaration stays CSS-only (step 7); with it, it is a state', async ({ page }) => {
  // @ts-expect-error: plain ESM tooling
  const { build } = await import('../../tools/bundle.mjs');
  const css = '.f { --v: state(" Hi "); --c: trim(--v) } .f .t { text: var(--c) } .f .k::after { content: var(--c) }';
  const body = '<div class="f"><span class="t"></span><i class="k"></i></div>';
  const without = await build({ features: ['strings', 'text'] });
  await page.route('**/dist/reactive-css.js', (x) => x.fulfill({ contentType: 'text/javascript', body: without.code }));
  await open(page, { head: `<style>${css}</style>`, body });
  await frames(page);
  expect(await page.$eval('.k', (e) => getComputedStyle(e, '::after').content)).toBe('"Hi"');
  expect(await inline(page, '.f', '--c')).toBe('');
  const withIt = await build({ features: ['derived', 'text'] });
  expect(withIt.ok).toBe(true);
  await page.unroute('**/dist/reactive-css.js');
  await page.route('**/dist/reactive-css.js', (x) => x.fulfill({ contentType: 'text/javascript', body: withIt.code }));
  await open(page, { head: `<style>${css}</style>`, body });
  await frames(page);
  expect([await text(page, '.t'), await inline(page, '.f', '--c')]).toEqual(['Hi', '"Hi"']);
  expect(await diagnostics(page)).toEqual([]);
});
