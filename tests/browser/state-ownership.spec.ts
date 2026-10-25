// State ownership: nested owners, shadowing, states that appear and go, removal, stop()/start(),
// and :when() elements that move to another owner. Every case also passed on 0.9.0, except the
// moves marked "0.9.0:".
import { test, expect, type Page } from '@playwright/test';
import { open, frames, stats, diagnostics } from './helpers';

const has = (page: Page, sel: string) => page.$eval(sel, (e) => [...e.attributes].some((a) => a.name.startsWith('data-rcss-when')));
const v = async (page: Page, sel: string, p: string) => { await frames(page); return page.$eval(sel, (e, p) => getComputedStyle(e).getPropertyValue(p).trim(), p); };

const NESTED = `<style>
  .o { --n: state(0) }
  .o .inc:on(click) { --n: increment(1) }
  .o:when(--n > 0) > .badge { display: inline }
  .badge { display: none }
</style>`;
const NESTED_BODY = `<div class="o" id="outer"><button class="inc" id="oi">+</button><span class="badge" id="ob">o</span>
  <div class="o" id="inner"><button class="inc" id="ii">+</button><span class="badge" id="ib">i</span></div></div>`;

test('nested owners of one state: each marker follows its own owner', async ({ page }) => {
  await open(page, { head: NESTED, body: NESTED_BODY });
  await frames(page);
  expect([await has(page, '#outer'), await has(page, '#inner')]).toEqual([false, false]);
  await page.click('#ii');
  await frames(page);
  expect([await has(page, '#outer'), await has(page, '#inner')]).toEqual([false, true]);
  await page.click('#oi');
  await frames(page);
  expect([await has(page, '#outer'), await has(page, '#inner')]).toEqual([true, true]);
  expect([await v(page, '#outer', '--n'), await v(page, '#inner', '--n')]).toEqual(['1', '1']);
});

test('a marker on an element inside an owner follows the nearest owner, also when one appears or goes', async ({ page }) => {
  await open(page, {
    head: '<style>.o { --n: state(0) } .o .inc:on(click) { --n: increment(1) } .t:when(--n > 0) { outline: 1px solid red }</style>',
    body: '<div class="o" id="outer"><button class="inc" id="oi">+</button><div id="mid"><span class="t" id="t">t</span></div></div>',
  });
  await frames(page);
  await page.click('#oi');
  await frames(page);
  expect(await has(page, '#t')).toBe(true); // outer --n = 1
  await page.evaluate(() => document.getElementById('mid')!.classList.add('o')); // a new owner in between, --n = 0
  await frames(page);
  expect(await has(page, '#t')).toBe(false);
  await page.evaluate(() => document.getElementById('mid')!.classList.remove('o')); // gone: the outer one again
  await frames(page);
  expect(await has(page, '#t')).toBe(true);
});

test('a :when() on a state nobody declares warns once it stays missing', async ({ page }) => {
  await open(page, { head: '<style>.x:when(--ghost) { color: red }</style>', body: '<p class="x">x</p>' });
  await page.waitForTimeout(1300);
  expect((await diagnostics(page)).join('\n')).toContain('--ghost');
});

test('a state that appears later (stylesheet added) switches the marker on', async ({ page }) => {
  await open(page, { head: '<style>.x:when(--late) { color: red }</style>', body: '<div class="w"><p class="x" id="x">x</p></div>' });
  await frames(page);
  expect(await has(page, '#x')).toBe(false);
  await page.evaluate(() => { const s = document.createElement('style'); s.textContent = '.w { --late: state(true) }'; document.head.append(s); });
  await expect.poll(() => has(page, '#x')).toBe(true);
  expect((await diagnostics(page)).join('\n')).not.toContain('--late');
});

test('states are counted while declared, cells or not; removal releases them', async ({ page }) => {
  await open(page, { head: NESTED, body: NESTED_BODY + NESTED_BODY.replace(/id="(\w+)"/g, 'id="$1-2"') });
  await frames(page);
  expect((await stats(page)).states).toBe(4);
  await page.click('#ii');
  await frames(page);
  expect((await stats(page)).states).toBe(4);
  await page.evaluate(() => { document.getElementById('outer')!.remove(); document.getElementById('outer-2')!.remove(); });
  await frames(page);
  expect((await stats(page)).states).toBe(0);
});

test('two declarations of one state on one owner: the cascade winner initializes it', async ({ page }) => {
  await open(page, {
    head: '<style>.w { --n: state(1) } .w.big { --n: state(10) } .w .inc:on(click) { --n: increment(1) } .w:when(--n > 5) { outline: 1px solid red }</style>',
    body: '<div class="w big" id="a"><button class="inc">+</button></div>',
  });
  await frames(page);
  expect(await v(page, '#a', '--n')).toBe('10');
  expect(await has(page, '#a')).toBe(true);
  await page.click('#a .inc');
  expect(await v(page, '#a', '--n')).toBe('11');
});

test('the first action on an untouched state starts from its initial value; previous() follows', async ({ page }) => {
  await open(page, {
    head: '<style>.w { --n: state(5) } .w .inc:on(click) { --n: increment(2) } .w:when(previous(--n) == 5) { outline: 1px solid red }</style>',
    body: '<div class="w" id="a"><button class="inc">+</button></div>',
  });
  await frames(page);
  expect(await has(page, '#a')).toBe(true); // previous of an untouched state is its initial value
  await page.click('#a .inc');
  expect(await v(page, '#a', '--n')).toBe('7');
  expect(await has(page, '#a')).toBe(true); // previous is 5
  await page.click('#a .inc');
  expect(await v(page, '#a', '--n')).toBe('9');
  expect(await has(page, '#a')).toBe(false);
});

test('stop() removes markers and inline values; start() brings them back', async ({ page }) => {
  await open(page, { head: NESTED, body: NESTED_BODY });
  await page.click('#ii');
  await frames(page);
  await page.evaluate(() => window.ReactiveCSS.stop());
  expect(await has(page, '#inner')).toBe(false);
  expect(await page.$eval('#inner', (e) => (e as HTMLElement).style.cssText)).toBe('');
  await page.evaluate(() => window.ReactiveCSS.start());
  await frames(page);
  expect((await stats(page)).states).toBe(2);
});

test('a missing state warns once per element and name, however often the condition is read', async ({ page }) => {
  await open(page, {
    head: '<style>.w { --n: state(0) } .w .inc:on(click) { --n: increment(1) } .w:when(--n > 0 and --ghost) { color: red }</style>',
    body: '<div class="w" id="a"><button class="inc">+</button></div>',
  });
  for (let i = 0; i < 4; i++) { await page.click('#a .inc'); await frames(page); }
  await page.waitForTimeout(1300);
  expect((await diagnostics(page)).filter((d) => d.includes('--ghost')).length).toBe(1);
});

test('one owner with literal states and a bind() state: every state works (regression)', async ({ page }) => {
  await open(page, {
    head: '<style>.w { --n: state(0); --on: state(false); --open: state(false, bind(data-open)) } .w .inc:on(click) { --n: increment(1) } .w .tog:on(click) { --on: toggle() } .w .opn:on(click) { --open: toggle() }</style>',
    body: '<div class="w" id="a"><button class="inc">+</button><button class="tog">t</button><button class="opn">o</button></div>',
  });
  await frames(page);
  for (const b of ['inc', 'tog', 'opn']) await page.click(`#a .${b}`);
  expect([await v(page, '#a', '--n'), await v(page, '#a', '--on'), await v(page, '#a', '--open')]).toEqual(['1', '1', '1']);
  expect(await page.$eval('#a', (e) => e.getAttribute('data-open'))).toBe('true');
  expect((await diagnostics(page)).join('\n')).not.toContain('Internal error');
});

test('removing owners re-reads no marker outside them, and markers inside go with them', async ({ page }) => {
  await open(page, {
    head: '<style>.o { --n: state(0) } .o .inc:on(click) { --n: increment(1) } .t:when(--n > 0) { outline: 1px solid red }</style>',
    body: '<div class="o" id="outer"><button class="inc" id="oi">+</button><span class="t" id="t0">t</span><div class="o" id="inner"><span class="t" id="t1">t</span></div></div>',
  });
  await page.click('#oi');
  await frames(page);
  expect([await has(page, '#t0'), await has(page, '#t1')]).toEqual([true, false]);
  await page.evaluate(() => document.getElementById('inner')!.remove());
  await frames(page);
  expect(await has(page, '#t0')).toBe(true);
  expect((await stats(page)).states).toBe(1);
  expect((await diagnostics(page)).join('\n')).not.toContain('Internal error');
});

const MOVE = {
  head: '<style>.o { --n: state(0) } .o .inc:on(click) { --n: increment(1) } .o .dec:on(click) { --n: increment(-1) } .t:when(--n > 0) { outline: 1px solid red }</style>',
  body: `<div class="o" id="a"><button class="inc" id="ai">+</button><button class="dec" id="ad">-</button><div id="wrap"><span class="t" id="t">t</span></div></div>
         <div class="o" id="b"><button class="inc" id="bi">+</button><button class="dec" id="bd">-</button></div>`,
};
async function moveSteps(page: Page, move: string) {
  await open(page, MOVE);
  await frames(page);
  await page.click('#ai'); await frames(page);
  const seen: Record<string, boolean> = { before: await has(page, '#t') }; // a: 1
  await page.evaluate(move); // into b: 0
  await frames(page); seen.afterMove = await has(page, '#t');
  await page.click('#ad'); await frames(page); seen.oldOwnerTo0 = await has(page, '#t');
  await page.click('#ai'); await frames(page); seen.oldOwnerTo1 = await has(page, '#t');
  await page.click('#bi'); await frames(page); seen.newOwnerTo1 = await has(page, '#t');
  await page.click('#bd'); await frames(page); seen.newOwnerTo0 = await has(page, '#t');
  return seen;
}
// 0.9.0: stale after the move and bound to the old owner's cell until it was disposed
// (afterMove true, oldOwnerTo1 true, newOwnerTo0 true).
const FOLLOWS = { before: true, afterMove: false, oldOwnerTo0: false, oldOwnerTo1: false, newOwnerTo1: true, newOwnerTo0: false };

test('a :when() element moved to another owner reads the new owner at once', async ({ page }) => {
  expect(await moveSteps(page, `document.getElementById('b').append(document.getElementById('t'))`)).toEqual(FOLLOWS);
});

test('a :when() element moved with its wrapper reads the new owner at once', async ({ page }) => {
  expect(await moveSteps(page, `document.getElementById('b').append(document.getElementById('wrap'))`)).toEqual(FOLLOWS);
});

test('many markers (more than 64): each follows its own nearest owner through changes and moves', async ({ page }) => {
  const cards = Array.from({ length: 100 }, (_, i) => `<div class="o" id="c${i}"><button class="inc">+</button><span class="t" id="m${i}">m</span></div>`).join('');
  await open(page, { head: MOVE.head, body: cards });
  await frames(page);
  for (const i of [3, 50, 99]) await page.click(`#c${i} .inc`);
  await frames(page);
  const on = () => page.$$eval('.t', (ts) => ts.flatMap((t) => ([...t.attributes].some((a) => a.name.startsWith('data-rcss-when')) ? [t.id] : [])));
  expect(await on()).toEqual(['m3', 'm50', 'm99']);
  await page.evaluate(() => { document.getElementById('c3')!.append(document.getElementById('m7')!); document.getElementById('c8')!.append(document.getElementById('m50')!); });
  await frames(page);
  expect((await on()).sort()).toEqual(['m3', 'm7', 'm99']);
});

test('a :root state changed often re-reads only the markers that name it', async ({ page }) => {
  const cards = Array.from({ length: 100 }, (_, i) => `<div class="o"><span class="t">m</span><span class="g">g</span></div>`).join('');
  await open(page, {
    head: '<style>:root { --g: state(0) } .bump:on(click) { --g: increment(1) } .o { --n: state(0) } .t:when(--n > 0) { outline: 1px solid red } .g:when(--g > 2) { outline: 1px solid blue }</style>',
    body: '<button class="bump">+</button>' + cards,
  });
  await frames(page);
  for (let i = 0; i < 3; i++) await page.click('.bump');
  await frames(page);
  const count = (sel: string) => page.$$eval(sel, (ts) => ts.filter((t) => [...t.attributes].some((a) => a.name.startsWith('data-rcss-when'))).length);
  expect([await count('.t'), await count('.g')]).toEqual([0, 100]);
});
