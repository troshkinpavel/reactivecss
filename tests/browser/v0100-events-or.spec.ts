// 0.10 step 2 (events): `a | b` in :on(), one rule for several DOM events.
import { test, expect, type Page } from '@playwright/test';
import { open, frames, style, stats, diagnostics } from './helpers';

const v = (page: Page, sel: string, p: string) => style(page, sel, p).then((s) => s.trim());

test('pointer release: one body for three events, event(type), cascade per event', async ({ page }) => {
  await open(page, {
    head: `<style>.btn { --held: state(false); --n: state(0); --last: state("") }
      .btn:on(pointerdown) { --held: set(true) }
      .btn:on(pointerup | pointerleave | pointercancel) { --held: set(false); --n: increment(1); --last: set(event(type)) }
      .btn.special:on(pointerup) { --n: increment(10) }</style>`,
    body: '<button class="btn" style="position:absolute;left:100px;top:100px;width:100px;height:50px">hold</button><div style="height:400px"></div>',
  });
  const read = async () => [await v(page, '.btn', '--held'), await v(page, '.btn', '--n'), await v(page, '.btn', '--last')];
  await page.mouse.move(150, 125);
  await page.mouse.down();
  await frames(page);
  expect(await v(page, '.btn', '--held')).toBe('1');
  await page.mouse.up();
  await frames(page);
  expect(await read()).toEqual(['0', '1', '"pointerup"']);
  await page.mouse.down();
  await page.mouse.move(150, 300); // leaves while held
  await frames(page);
  expect(await read()).toEqual(['0', '2', '"pointerleave"']);
  await page.mouse.up();
  // A more specific single-event rule wins for pointerup only; pointerleave still runs the group.
  await page.$eval('.btn', (b) => b.classList.add('special'));
  await page.mouse.move(150, 125);
  await page.mouse.down();
  await page.mouse.up();
  await frames(page);
  expect(await read()).toEqual(['0', '12', '"pointerup"']); // --n from .special (+10); --held, --last from the group
  await page.mouse.move(150, 300);
  await frames(page);
  expect(await read()).toEqual(['0', '13', '"pointerleave"']);
  expect(await diagnostics(page)).toEqual([]);
});

test('click | keydown(Enter): key filter, prevent() for each member, one run per event', async ({ page }) => {
  await open(page, {
    head: `<style>.t { --n: state(0); --last: state("") }
      .t a:on(click | keydown(Enter), prevent()) { --n: increment(1); --last: set(event(type)) }</style>`,
    body: '<div class="t"><a href="#moved">go</a></div>',
  });
  await page.evaluate(() => { (window as any).prevented = []; document.addEventListener('click', (e) => (window as any).prevented.push(e.defaultPrevented)); document.addEventListener('keydown', (e) => (window as any).prevented.push(e.defaultPrevented)); });
  await page.click('a');
  await frames(page);
  expect([await v(page, '.t', '--n'), await v(page, '.t', '--last')]).toEqual(['1', '"click"']);
  await page.focus('a');
  await page.keyboard.press('x'); // not Enter: no run, not prevented
  await page.keyboard.press('Enter'); // keydown runs once; the prevented keydown makes no click
  await frames(page);
  expect([await v(page, '.t', '--n'), await v(page, '.t', '--last')]).toEqual(['2', '"keydown"']);
  expect(await page.evaluate(() => (window as any).prevented)).toEqual([true, false, true]);
  expect(await page.evaluate(() => location.hash)).toBe('');
  // Two members in one task: each sees the other's write.
  await page.$eval('a', (a) => { a.click(); a.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); });
  await frames(page);
  expect(await v(page, '.t', '--n')).toBe('4');
  expect(await diagnostics(page)).toEqual([]);
});

test(':when() group rule: applies to every member while the condition holds', async ({ page }) => {
  await open(page, {
    head: `<style>.g { --armed: state(false); --n: state(0) }
      .g .arm:on(click) { --armed: toggle() }
      .g:when(--armed) .hit:on(click | keyup) { --n: increment(1) }
      .g .hit:on(keyup) { --n: increment(100) }</style>`,
    body: '<div class="g"><button class="arm">arm</button><input class="hit"></div>',
  });
  await page.click('.hit'); // not armed: no rule for click
  await page.focus('.hit');
  await page.keyboard.press('a'); // not armed: the plain keyup rule
  await frames(page);
  expect(await v(page, '.g', '--n')).toBe('100');
  await page.click('.arm');
  await frames(page);
  await page.click('.hit');
  await page.keyboard.press('a'); // armed: the group rule is more specific (:when()) and wins for keyup too
  await frames(page);
  expect(await v(page, '.g', '--n')).toBe('102');
  expect(await diagnostics(page)).toEqual([]);
});

test('listeners: one per DOM event type, shared, released with the stylesheet', async ({ page }) => {
  await open(page, { body: '<button class="b">b</button>' });
  const base = (await stats(page)).observers;
  await page.evaluate(() => {
    const s = document.createElement('style');
    s.id = 'x';
    s.textContent = '.b { --n: state(0) } .b:on(pointerup | pointerleave) { --n: increment(1) } .b:on(pointerup) { --n: increment(1) } .b:on(keydown(a) | keydown(b)) { --n: increment(1) }';
    document.head.append(s);
  });
  await frames(page);
  expect((await stats(page)).observers).toBe(base + 3); // pointerup, pointerleave, keydown
  await page.evaluate(() => document.getElementById('x')!.remove());
  await frames(page);
  expect((await stats(page)).observers).toBe(base);
  expect(await diagnostics(page)).toEqual([]);
});

test('invalid groups are reported; the rest of the sheet works', async ({ page }) => {
  await open(page, {
    head: `<style>.a { --n: state(0) }
      .a:on(click | click) { --n: increment(1) }
      .a:on(outside(click) | keydown) { --n: increment(1) }
      .a:on(click |) { --n: increment(1) }
      .a:on(click | pointermove, prevent()) { --n: increment(1) }
      .a:on(pointermove | keydown) { --n: set(event(client-x)) }
      .a:on(dblclick | contextmenu, prevent()) { --n: increment(5) }</style>`,
    body: '<p class="a">a</p>',
  });
  const d = (await diagnostics(page)).join('\n');
  expect(d).toMatch(/click is listed twice in :on\(click \| click\)/);
  expect(d).toMatch(/outside\(click\) cannot be combined with other events in one :on\(\)/);
  expect(d).toMatch(/an event is missing around "\|" in "click \|"/);
  expect(d).toMatch(/pointermove is not/);
  expect(d).toMatch(/event\(client-x\) is not available/);
  await page.click('.a', { button: 'right' });
  await page.dblclick('.a');
  await frames(page);
  expect(await v(page, '.a', '--n')).toBe('10');
});
