// 0.5 event audit: what on: actually does for each DOM event (see docs/event-support-0.5.md).
import { test, expect, type Page } from '@playwright/test';
import { open, frames, diagnostics } from './helpers';

const n = (page: Page, sel: string) => page.$eval(sel, (e) => getComputedStyle(e).getPropertyValue('--n').trim());

test.describe('supported on: triggers', () => {
  test('click, change and input bubble: the target and its ancestors run their actions, innermost first', async ({ page }) => {
    await open(page, {
      head: `<style>.o { --n: state(0); --log: state("") } .o { on: click(increment(--n)), change(increment(--n, 10)), input(increment(--n, 100)) }
        .o button { on: click(set(--log, "inner first")) }
        .o form { on: click(set(--log, "form after inner")) }</style>`,
      body: '<div class="o"><form><button type="button">b</button><input type="checkbox"><input type="text"></form></div>',
    });
    await page.click('.o button');
    await frames(page);
    expect(await n(page, '.o')).toBe('1');
    expect(await page.$eval('.o', (e) => getComputedStyle(e).getPropertyValue('--log').trim())).toBe('"form after inner"'); // the form ran after the button
    await page.click('.o input[type=checkbox]'); // a checkbox click fires click, input and change natively
    await frames(page);
    expect(await n(page, '.o')).toBe('112');
    await page.focus('.o input[type=text]');
    await page.keyboard.type('x'); // one input event
    await frames(page);
    expect(await n(page, '.o')).toBe('212');
  });

  test('focus and blur run on the focused element only (no ancestor), with keyboard focus too', async ({ page }) => {
    await open(page, {
      head: `<style>.w { --n: state(0); on: focus(increment(--n)) } .w input { --n: state(0); on: focus(increment(--n)), blur(increment(--n, 10)) }</style>`,
      body: '<div class="w" tabindex="-1"><input></div><button id="other">o</button>',
    });
    await page.keyboard.press('Tab'); // focus the input by keyboard
    await frames(page);
    expect(await n(page, '.w input')).toBe('1');
    expect(await n(page, '.w')).toBe('0'); // focus does not bubble to the wrapper
    await page.keyboard.press('Tab'); // blur
    await frames(page);
    expect(await n(page, '.w input')).toBe('11');
  });

  test('pointerenter and pointerleave run on the entered element only', async ({ page }) => {
    await open(page, {
      head: `<style>.p { --n: state(0); on: pointerenter(increment(--n)), pointerleave(increment(--n, 10)); display: block; width: 100px; height: 50px }
        .p span { display: block; width: 20px; height: 20px }</style>`,
      body: '<div class="p" id="p"><span></span></div><div style="height:200px"></div>',
    });
    await page.mouse.move(5, 5);
    await page.mouse.move(10, 10); // over the child too: no second enter for the parent
    await page.mouse.move(50, 150);
    await frames(page);
    expect(await n(page, '#p')).toBe('11');
  });
});

test.describe('events that on: does not accept (0.5.1)', () => {
  const UNSUPPORTED = ['animationstart', 'animationiteration', 'transitionrun', 'transitionstart', 'submit', 'dblclick', 'keyup'];
  test('each is reported at compile time and never runs', async ({ page }) => {
    await open(page, {
      head: `<style>.u { --n: state(0) } ${UNSUPPORTED.map((e, i) => `.u.e${i} { on: ${e}(increment(--n)) }`).join(' ')}</style>`,
      body: UNSUPPORTED.map((_, i) => `<form class="u e${i}"><input></form>`).join(''),
    });
    const d = (await diagnostics(page)).join('\n');
    for (const e of UNSUPPORTED) expect(d, e).toContain(`got "${e}(increment(--n))"`);
    // dispatching the real events changes nothing
    await page.evaluate(() => document.querySelectorAll('.u').forEach((f) => {
      for (const t of ['focusin', 'animationend', 'transitionend', 'submit', 'reset']) f.dispatchEvent(new Event(t, { bubbles: true }));
    }));
    await frames(page);
    expect(await page.$$eval('.u', (els) => els.map((e) => getComputedStyle(e).getPropertyValue('--n').trim()))).toEqual(UNSUPPORTED.map(() => '0'));
  });

  test('the on() value function does re-evaluate on animationend and transitionend (a different feature)', async ({ page }) => {
    await open(page, {
      head: `<style>.v { --r: on(animationend, random(0, 1000000, by 1)); --t: on(transitionend, random(0, 1000000, by 1)) }</style>`,
      body: '<div class="v"></div>',
    });
    const read = () => page.$eval('.v', (e) => [getComputedStyle(e).getPropertyValue('--r'), getComputedStyle(e).getPropertyValue('--t')]);
    const before = await read();
    await page.evaluate(() => { const v = document.querySelector('.v')!; v.dispatchEvent(new AnimationEvent('animationend')); v.dispatchEvent(new TransitionEvent('transitionend')); });
    await frames(page);
    const after = await read();
    expect(after[0]).not.toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
  });
});

test.describe('event triggers added in 0.5.1', () => {
  test('focusin and focusout bubble: a wrapper sees focus entering and leaving its fields', async ({ page }) => {
    await open(page, {
      head: `<style>.w { --n: state(0); on: focusin(increment(--n)), focusout(increment(--n, 10)) }</style>`,
      body: '<div class="w"><input id="a"><input id="b"></div><button id="out">o</button>',
    });
    await page.focus('#a'); await page.focus('#b'); await page.focus('#out');
    await frames(page);
    expect(await n(page, '.w')).toBe('22'); // in a, out a + in b, out b
  });

  test('reset runs on the form (and bubbles), after the native reset', async ({ page }) => {
    await open(page, {
      head: `<style>.f { --sent: state(true); on: reset(set(--sent, false)) }</style>`,
      body: '<form class="f"><input value="x"><button type="reset">r</button></form>',
    });
    await page.fill('.f input', 'changed');
    await page.click('.f button');
    await frames(page);
    expect(await page.$eval('.f', (e) => getComputedStyle(e).getPropertyValue('--sent').trim())).toBe('0');
    expect(await page.inputValue('.f input')).toBe('x');
  });

  test('animationend and animationcancel: the element\'s own animations only, not its children\'s', async ({ page }) => {
    await open(page, {
      head: `<style>.a { --n: state(0); on: animationend(increment(--n)), animationcancel(increment(--n, 100)) }
        .a.go { animation: f 60ms } .a.long { animation: f 10s } .a i.go { animation: f 30ms; display: block } @keyframes f { to { opacity: 0.5 } }</style>`,
      body: '<div class="a"><i>child</i></div>',
    });
    await page.evaluate(() => document.querySelector('.a i')!.classList.add('go')); // a child animation
    await page.waitForTimeout(150);
    expect(await n(page, '.a')).toBe('0');
    await page.evaluate(() => document.querySelector('.a')!.classList.add('go'));
    await expect.poll(() => n(page, '.a')).toBe('1');
    // A cancel event fires only for an animation that has started (native behavior): wait for it.
    await page.$eval('.a', (a) => new Promise((res) => { a.addEventListener('animationstart', res, { once: true }); a.classList.replace('go', 'long'); }));
    await page.evaluate(() => document.querySelector('.a')!.getAnimations()[0].cancel()); // fires animationcancel
    await expect.poll(() => n(page, '.a')).toBe('101');
  });

  test('transitionend fires once per transitioning property; transitioncancel when cancelled', async ({ page }) => {
    await open(page, {
      head: `<style>.t { --n: state(0); width: 10px; height: 10px; transition: width 40ms, height 40ms; on: transitionend(increment(--n)), transitioncancel(increment(--n, 100)) }
        .t.big { width: 20px; height: 20px } .t.slow { transition: width 10s; width: 30px }</style>`,
      body: '<div class="t"></div>',
    });
    await page.evaluate(() => document.querySelector('.t')!.classList.add('big'));
    await expect.poll(() => n(page, '.t')).toBe('2'); // width and height
    await page.evaluate(() => document.querySelector('.t')!.classList.add('slow'));
    await expect.poll(() => page.$eval('.t', (t) => Number(t.getAnimations()[0]?.currentTime ?? 0) > 0)).toBe(true);
    await page.evaluate(() => document.querySelector('.t')!.getAnimations()[0].cancel()); // fires transitioncancel
    await expect.poll(() => n(page, '.t')).toBe('102');
  });
});

test.describe('propagation and default actions (why modifiers are not trivial)', () => {
  test('actions never prevent the default action: a link still navigates (the listener is passive)', async ({ page }) => {
    await open(page, {
      head: `<style>a { --n: state(0); on: click(increment(--n)) }</style>`,
      body: '<a href="#moved">link</a>',
    });
    await page.click('a');
    await frames(page);
    expect(await n(page, 'a')).toBe('1');
    expect(await page.evaluate(() => location.hash)).toBe('#moved');
  });

  test('actions run in the capture phase at document: before target handlers, unaffected by their stopPropagation, but skipped if a window capture listener stops the event', async ({ page }) => {
    await open(page, {
      head: `<style>.s { --n: state(0); on: click(increment(--n)) }</style>`,
      body: '<div class="s"><button id="b">b</button></div><div class="s" id="blocked"><button id="c">c</button></div>',
    });
    const order = await page.evaluate(async () => {
      const log: string[] = [];
      const b = document.getElementById('b')!;
      b.addEventListener('click', (e) => { log.push('target handler sees n=' + getComputedStyle(b.parentElement!).getPropertyValue('--n').trim()); e.stopPropagation(); });
      b.click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      log.push('after: n=' + getComputedStyle(b.parentElement!).getPropertyValue('--n').trim());
      const c = document.getElementById('c')!;
      window.addEventListener('click', (e) => { if (e.target === c) e.stopPropagation(); }, true);
      c.click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      log.push('blocked: n=' + getComputedStyle(c.parentElement!).getPropertyValue('--n').trim());
      return log;
    });
    // The state changed before the target's own handler ran (its value is written in the next frame).
    expect(order).toEqual(['target handler sees n=0', 'after: n=1', 'blocked: n=0']);
  });

  test('synthetic events (element.click(), dispatchEvent) run actions like real input', async ({ page }) => {
    await open(page, { head: `<style>.s { --n: state(0); on: click(increment(--n)) }</style>`, body: '<button class="s">b</button>' });
    await page.evaluate(() => { const b = document.querySelector('.s')!; (b as HTMLElement).click(); b.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await frames(page);
    expect(await n(page, '.s')).toBe('2');
  });
});
