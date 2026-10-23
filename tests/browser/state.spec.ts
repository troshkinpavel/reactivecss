// Phase 5: state(), on:, set()/toggle()/increment()/decrement(), when(), :when(), state-driven :nth-var().
import { test, expect, type Page } from '@playwright/test';
import { open, style, frames, stats, diagnostics } from './helpers';

const width = (page: Page, sel: string) => page.$$eval(sel, (els) => els.map((e) => parseFloat(getComputedStyle(e).width)));
const styleWrites = (page: Page, sel: string, action: () => Promise<void>) =>
  page.evaluate((sel) => {
    (window as any).__writes = 0;
    const mo = new MutationObserver((r) => { (window as any).__writes += r.length; });
    document.querySelectorAll(sel).forEach((e) => mo.observe(e, { attributes: true }));
    (window as any).__mo = mo;
  }, sel).then(action).then(() => frames(page, 2)).then(() => page.evaluate(() => { (window as any).__mo.disconnect(); return (window as any).__writes as number; }));

test.describe('state()', () => {
  test('initial values are usable through var() without any inline write', async ({ page }) => {
    await open(page, {
      head: `<style>.c { --n: state(3); --b: state(true); --off: state(false); --w: state(12px); display: block;
        width: calc(var(--n) * 10px); opacity: var(--off); height: var(--w); outline-width: calc(var(--b) * 2px) }</style>`,
      body: '<div class="c"></div>',
    });
    expect(await style(page, '.c', 'width')).toBe('30px');
    expect(await style(page, '.c', 'opacity')).toBe('0');
    expect(await style(page, '.c', 'height')).toBe('12px');
    expect(await page.$eval('.c', (e) => (e as HTMLElement).style.cssText)).toBe('');
    expect((await stats(page)).states).toBe(4);
    expect(await diagnostics(page)).toEqual([]);
  });

  test('every owner element has its own independent state', async ({ page }) => {
    await open(page, {
      head: `<style>.counter { --count: state(0) } .counter b { display: block; width: calc(var(--count) * 1px + 1px) } .counter button { on: click(increment(--count)) }</style>`,
      body: '<div class="counter"><button>+</button><b></b></div>'.repeat(3),
    });
    const buttons = page.locator('.counter button');
    await buttons.nth(1).click();
    await buttons.nth(1).click();
    await buttons.nth(2).click();
    await expect.poll(() => width(page, '.counter b')).toEqual([1, 3, 2]);
  });

  test('nested scopes: the nearest owner wins, and an inner owner added later shadows the outer one', async ({ page }) => {
    await open(page, {
      head: `<style>
        .outer, .inner.scoped { --a: state(false) }
        button { on: click(toggle(--a)) }
        i { display: block; width: when(--a, 50px, 10px) }
      </style>`,
      body: '<div class="outer"><button id="o">o</button><i id="io"></i><div class="inner"><button id="in">in</button><i id="ii"></i></div></div>',
    });
    await page.click('#in'); // no inner owner yet: toggles the outer state
    await expect.poll(() => width(page, 'i')).toEqual([50, 50]);
    await page.evaluate(() => document.querySelector('.inner')!.classList.add('scoped'));
    await expect.poll(() => width(page, 'i')).toEqual([50, 10]); // #ii now reads the inner state
    await page.click('#in');
    await expect.poll(() => width(page, 'i')).toEqual([50, 50]);
    await page.click('#o');
    await expect.poll(() => width(page, 'i')).toEqual([10, 50]);
  });

  test('missing state and type errors warn and change nothing', async ({ page }) => {
    await open(page, {
      native: false, // checks runtime behavior (warnings, bindings)
      head: `<style>
        .c { --n: state(5); --b: state(false) }
        #s { on: click(set(--nope, 1)) } #t { on: click(set(--n, red)) } #u { on: click(toggle(--n)) } #v { on: click(increment(--n, 2px)) }
        #m { display: block; width: when(--missing, 20px, 30px) }
        .c b { display: block; width: calc(var(--n) * 1px) }
      </style>`,
      body: '<div class="c"><button id="s">s</button><button id="t">t</button><button id="u">u</button><button id="v">v</button><b></b></div><div id="m"></div>',
    });
    for (const id of ['#s', '#t', '#u', '#v']) await page.click(id);
    await frames(page);
    expect(await style(page, '.c b', 'width')).toBe('5px');
    expect((await stats(page)).stateChanges).toBe(0);
    const d = (await diagnostics(page)).join('\n');
    expect(d).toMatch(/--nope, but no element declares "--nope: state/);
    expect(d).toMatch(/set\(--n, red\): --n holds a number/);
    expect(d).toMatch(/toggle\(--n\): --n is not a boolean/);
    expect(d).toMatch(/increment\(--n, 2px\): the step does not match/);
    // A condition's missing state is reported after a grace period (its owner may be in a sheet still loading).
    await expect.poll(async () => (await diagnostics(page)).join('\n'), { timeout: 3000 }).toMatch(/A condition uses --missing/);
    expect(await style(page, '#m', 'width')).not.toMatch(/^(20|30)px$/); // unknown: no value, not "false"
  });

  test('redundant updates do not notify or write', async ({ page }) => {
    await open(page, {
      head: `<style>.c { --n: state(3) } .c button { on: click(set(--n, 3)) } .c b { display: block; width: when(--n > 1, 5px, 1px) }</style>`,
      body: '<div class="c"><button>b</button><b></b></div>',
    });
    const writes = await styleWrites(page, '.c, .c b', async () => { await page.click('.c button'); });
    expect(writes).toBe(0);
    expect((await stats(page)).stateChanges).toBe(0);
  });

  test('state is disposed with its owner and fresh when the owner comes back', async ({ page }) => {
    await open(page, {
      native: false, // checks runtime behavior (warnings, bindings)
      head: `<style>.c { --on: state(false) } .c button { on: click(toggle(--on)) } .c b { display: block; width: when(--on, 9px, 1px) }</style>`,
      body: '<div id="host"><div class="c"><button>b</button><b></b></div></div>',
    });
    await page.click('.c button');
    await expect.poll(() => style(page, '.c b', 'width')).toBe('9px');
    await page.evaluate(() => { (window as any).held = document.querySelector('.c'); (window as any).held.remove(); });
    await frames(page, 1);
    let s = await stats(page);
    expect([s.states, s.bindings]).toEqual([0, 0]);
    await page.evaluate(() => document.getElementById('host')!.append((window as any).held));
    await expect.poll(() => style(page, '.c b', 'width')).toBe('1px'); // a new owner starts at the initial value
    s = await stats(page);
    expect([s.states, s.bindings]).toEqual([1, 1]);
  });

  test('when two state() declarations match, the cascade winner sets the initial value; later changes keep the state', async ({ page }) => {
    await open(page, {
      head: `<style>.c { --n: state(1) } .c.big { --n: state(7) } .c b { display: block; width: calc(var(--n) * 1px) } .c button { on: click(increment(--n)) }</style>`,
      body: '<div class="c big"><button>+</button><b></b></div>',
    });
    expect(await style(page, '.c b', 'width')).toBe('7px');
    await page.click('.c button');
    await expect.poll(() => style(page, '.c b', 'width')).toBe('8px');
    await page.evaluate(() => document.querySelector('.c')!.classList.remove('big'));
    await expect.poll(() => style(page, '.c b', 'width')).toBe('8px'); // still the same cell
  });
});

test.describe('on: actions', () => {
  test('click, change and input events; rapid repeats; multiple actions and events', async ({ page }) => {
    await open(page, {
      head: `<style>
        .c { --n: state(0); --b: state(false); --h: state(false) }
        #multi { on: click(increment(--n), toggle(--b)), pointerenter(set(--h, true)) }
        #box { on: change(toggle(--b)) }
        #range { on: input(increment(--n, 10)) }
        .c i { display: block; width: calc(var(--n) * 1px); height: when(--b, 5px, 1px); outline: when(--h, 1px solid, none) }
      </style>`,
      body: '<div class="c"><button id="multi">m</button><input type="checkbox" id="box"><input type="range" id="range"><i></i></div>',
    });
    for (let k = 0; k < 7; k++) await page.click('#multi');
    await expect.poll(() => style(page, '.c i', 'width')).toBe('7px');
    expect(await style(page, '.c i', 'height')).toBe('5px'); // toggled 7 times
    expect(await style(page, '.c i', 'outline-style')).toBe('solid'); // the pointer entered
    await page.click('#box');
    await expect.poll(() => style(page, '.c i', 'height')).toBe('1px');
    await page.$eval('#range', (r: HTMLInputElement) => { r.value = '80'; r.dispatchEvent(new Event('input', { bubbles: true })); });
    await expect.poll(() => style(page, '.c i', 'width')).toBe('17px');
  });

  test('on: follows the cascade, and handlers on ancestors run too (innermost first)', async ({ page }) => {
    await open(page, {
      head: `<style>
        .c { --n: state(0); on: click(increment(--n, 100)) }
        .btn { on: click(increment(--n)) }
        .btn.big { on: click(increment(--n, 10)) }
        .c i { display: block; width: calc(var(--n) * 1px) }
      </style>`,
      body: '<div class="c"><button class="btn">a</button><button class="btn big">b</button><i></i></div>',
    });
    await page.click('.btn.big');
    await expect.poll(() => style(page, '.c i', 'width')).toBe('110px'); // .big wins over .btn, plus the container
    await page.click('.btn:not(.big)');
    await expect.poll(() => style(page, '.c i', 'width')).toBe('211px');
  });

  test('conditional on: rules (media queries, :hover, nested @media) go through the cascade', async ({ page }) => {
    await open(page, {
      head: `<style>
        .c { --n: state(0) }
        .a { on: click(increment(--n)) }
        @media (min-width: 1px) { .a { on: click(increment(--n, 10)) } }
        @media (max-width: 1px) { .b { on: click(increment(--n, 100)) } }
        .d { on: click(increment(--n, 1000)); @media (max-width: 1px) { on: click(increment(--n, 5)) } }
        .c i { display: block; width: calc(var(--n) * 1px) }
      </style>`,
      body: '<div class="c"><button class="a">a</button><button class="b">b</button><button class="d">d</button><i></i></div>',
    });
    await page.click('.a'); // the media rule wins: +10, not +1
    await expect.poll(() => style(page, '.c i', 'width')).toBe('10px');
    await page.click('.b'); // its only rule does not apply: nothing
    await page.click('.d'); // nested @media does not apply: +1000
    await expect.poll(() => style(page, '.c i', 'width')).toBe('1010px');
  });

  test('works next to the value function on(), and listeners are released with the stylesheet', async ({ page }) => {
    await open(page, {
      head: `<style id="s">.c { --b: state(false) } .c button { on: click(toggle(--b)); rotate: on(click, random(1deg, 359deg)) } .c i { display: block; width: when(--b, 4px, 2px) }</style>`,
      body: '<div class="c"><button>b</button><i></i></div>',
    });
    const r0 = await style(page, '.c button', 'rotate');
    await page.click('.c button');
    await expect.poll(() => style(page, '.c i', 'width')).toBe('4px');
    expect(await style(page, '.c button', 'rotate')).not.toBe(r0);
    expect((await stats(page)).observers).toBe(1); // one delegated click listener
    await page.evaluate(() => document.getElementById('s')!.remove());
    await expect.poll(async () => { const s = await stats(page); return [s.observers, s.states, s.bindings, s.sources]; }).toEqual([0, 0, 0, 0]);
  });

  test('a click is applied in the next frame even behind thousands of background updates', async ({ page }) => {
    await open(page, {
      head: `<style>.bg { --v: live(random(0, 1), 50ms) } .c { --on: state(false) } .c button { on: click(toggle(--on)) } .c i { display: block; width: when(--on, 8px, 2px) }</style>`,
      body: '<i class="bg"></i>'.repeat(6000) + '<div class="c"><button>b</button><i></i></div>',
    });
    await page.waitForTimeout(200);
    const frameCount = await page.evaluate(() => new Promise<number>((res) => {
      document.querySelector<HTMLElement>('.c button')!.click();
      let n = 0;
      const f = () => { n++; if (getComputedStyle(document.querySelector('.c i')!).width === '8px' || n > 10) res(n); else requestAnimationFrame(f); };
      requestAnimationFrame(f);
    }));
    expect(frameCount).toBeLessThanOrEqual(2);
  });
});

test.describe('when() and :when()', () => {
  test('booleans, comparisons, logical operators and parentheses', async ({ page }) => {
    await open(page, {
      head: `<style>
        .c { --v: state(75); --a: state(true); --b: state(false); --w: state(10px) }
        #up { on: click(increment(--v, 10)) } #flip { on: click(toggle(--b)) }
        #x { display: block;
          color: when(--v >= 80, rgb(0, 128, 0), rgb(255, 165, 0));
          width: when(--a and not (--v < 50 or --b), 20px, 5px);
          height: when(--w > 1cm or --w == 7.5pt, 1px, 3px) }
      </style>`,
      body: '<div class="c"><button id="up">up</button><button id="flip">flip</button><b id="x"></b></div>',
    });
    expect(await style(page, '#x', 'color')).toBe('rgb(255, 165, 0)');
    expect(await style(page, '#x', 'width')).toBe('20px');
    expect(await style(page, '#x', 'height')).toBe('1px'); // 10px == 7.5pt after unit conversion
    await page.click('#up');
    await expect.poll(() => style(page, '#x', 'color')).toBe('rgb(0, 128, 0)');
    await page.click('#flip');
    await expect.poll(() => style(page, '#x', 'width')).toBe('5px');
  });

  test('incompatible comparisons are unknown and reported, never guessed', async ({ page }) => {
    await open(page, {
      head: `<style>.c { --v: state(5); --s: state(red) } #x { display: block; width: when(--v > 10px, 1px, 2px); height: when(--s > 3, 1px, 2px) }</style>`,
      body: '<div class="c"><b id="x"></b></div>',
    });
    expect(await style(page, '#x', 'width')).not.toMatch(/^(1|2)px$/);
    expect(await style(page, '#x', 'height')).not.toMatch(/^(1|2)px$/);
    const d = (await diagnostics(page)).join('\n');
    expect(d).toMatch(/incompatible units/);
    expect(d).toMatch(/cannot compare red \(value\) with 3 \(number\)/);
  });

  test('only dependents of the changed state are re-evaluated, and unchanged results are not written', async ({ page }) => {
    await open(page, {
      native: false, // checks runtime behavior (warnings, bindings)
      head: `<style>.c { --a: state(false); --v: state(1) } #a { on: click(toggle(--a)) } #v { on: click(increment(--v)) }
        .dep { display: block; width: when(--a, 2px, 1px) } #vdep { display: block; width: when(--v > 100, 2px, 1px) }</style>`,
      body: '<div class="c"><button id="a">a</button><button id="v">v</button>' + '<i class="dep"></i>'.repeat(50) + '<i id="vdep"></i></div>',
    });
    const before = await stats(page);
    await page.click('#v');
    await frames(page);
    const after = await stats(page);
    expect(after.stateChanges - before.stateChanges).toBe(1);
    expect(after.jobs - before.jobs).toBeLessThanOrEqual(2); // the cell + its one dependent, not the 50 others
    const writes = await styleWrites(page, '#vdep', async () => { await page.click('#v'); });
    expect(writes).toBe(0); // 3 > 100 is still false
  });

  test(':when() toggles a marker with pseudo-class specificity, respects layers, nests, and transitions', async ({ page }) => {
    await open(page, {
      head: `<style>
        .card { --on: state(false); display: block; opacity: 0.5; transition: opacity 1s linear; on: click(toggle(--on)) }
        .card:when(--on) { opacity: 1; color: rgb(255, 0, 0) }
        .card.blue { color: rgb(0, 0, 255) } /* same specificity, later: wins */
        @layer low { .card:when(--on) { outline-style: dashed } }
        .card { outline-style: dotted }      /* unlayered beats the layer */
        .box { --open: state(true); & .in:when(--open) { width: 33px; display: block } }
      </style>`,
      body: '<div class="card blue" id="c">card</div><div class="box"><i class="in"></i></div>',
    });
    expect(await style(page, '.box .in', 'width')).toBe('33px');
    await page.click('#c');
    await page.waitForTimeout(150);
    const mid = parseFloat(await style(page, '#c', 'opacity'));
    expect(mid).toBeGreaterThan(0.5); // native transition is running
    expect(mid).toBeLessThan(1);
    expect(await style(page, '#c', 'color')).toBe('rgb(0, 0, 255)');
    expect(await style(page, '#c', 'outline-style')).toBe('dotted');
    expect(await page.$eval('#c', (e) => e.getAttributeNames().some((a) => a.startsWith('data-rcss-when')))).toBe(true);
    await page.click('#c');
    await expect.poll(() => page.$eval('#c', (e) => e.getAttributeNames().some((a) => a.startsWith('data-rcss-when')))).toBe(false);
  });

  test('elements added later get the current state at once', async ({ page }) => {
    await open(page, {
      head: `<style>.c { --on: state(false); on: click(toggle(--on)) } .c i { display: block; width: when(--on, 7px, 1px) } .c i:when(--on) { height: 3px }</style>`,
      body: '<div class="c">click<i></i></div>',
    });
    await page.click('.c');
    await expect.poll(() => style(page, '.c i', 'width')).toBe('7px');
    const added = await page.evaluate(() => {
      const i = document.createElement('i');
      document.querySelector('.c')!.append(i);
      return new Promise((res) => queueMicrotask(() => res([getComputedStyle(i).width, getComputedStyle(i).height])));
    });
    expect(added).toEqual(['7px', '3px']);
  });
});

test.describe('components', () => {
  const tabs = `<div class="tabs"><div class="tab-list"><button class="tab">A</button><button class="tab">B</button><button class="tab">C</button></div>
    <div class="panels"><section class="panel">a</section><section class="panel">b</section><section class="panel">c</section></div></div>`;
  const tabsCSS = `<style>
    .tabs { --active: state(1) }
    .tab { on: click(set(--active, sibling-index())) }
    .tab:nth-var(--active) { color: rgb(0, 0, 255) }
    .panel { display: none } .panel:nth-var(--active) { display: block }
  </style>`;
  const visible = (page: Page, k: number) => page.$$eval('.tabs', (all, k) => [...all[k].querySelectorAll('.panel')].map((p) => getComputedStyle(p).display === 'block'), k);

  test('tabs: two sibling groups share the nearest state; components stay independent', async ({ page }) => {
    await open(page, { head: tabsCSS, body: tabs + tabs });
    expect(await visible(page, 0)).toEqual([true, false, false]);
    const touched = await page.evaluate(() => new Promise<number>((res) => {
      let n = 0;
      const mo = new MutationObserver((r) => { n += r.filter((x) => x.attributeName?.startsWith('data-rcss-nth')).length; });
      mo.observe(document.body, { attributes: true, subtree: true });
      document.querySelectorAll<HTMLElement>('.tab')[2].click();
      requestAnimationFrame(() => requestAnimationFrame(() => { mo.disconnect(); res(n); }));
    }));
    expect(touched).toBe(4); // old and new tab, old and new panel: nothing else
    expect(await visible(page, 0)).toEqual([false, false, true]);
    expect(await visible(page, 1)).toEqual([true, false, false]);
    expect(await page.$$eval('.tab', (t) => t.map((e) => getComputedStyle(e).color === 'rgb(0, 0, 255)'))).toEqual([false, false, true, true, false, false]);
    await page.locator('.tabs').nth(1).locator('.tab').nth(1).click();
    await expect.poll(() => visible(page, 1)).toEqual([false, true, false]);
    expect(await visible(page, 0)).toEqual([false, false, true]);
  });

  test('accordion: closed at start, toggles, rapid clicks, independent instances, removal and recreation', async ({ page }) => {
    const acc = '<div class="accordion"><button class="trigger">t</button><div class="content">c</div></div>';
    await open(page, {
      head: `<style>.accordion { --open: state(false) } .trigger { on: click(toggle(--open)) } .content { opacity: when(--open, 1, 0); display: when(--open, block, none) }</style>`,
      body: `<div id="host">${acc}${acc}</div>`,
    });
    const shown = () => page.$$eval('.content', (c) => c.map((e) => getComputedStyle(e).display));
    expect(await shown()).toEqual(['none', 'none']);
    await page.locator('.trigger').first().click();
    await expect.poll(shown).toEqual(['block', 'none']);
    await page.locator('.trigger').first().click();
    await expect.poll(shown).toEqual(['none', 'none']);
    for (let k = 0; k < 5; k++) await page.locator('.trigger').nth(1).click();
    await expect.poll(shown).toEqual(['none', 'block']);
    await page.evaluate((acc) => { const h = document.getElementById('host')!; h.lastElementChild!.remove(); h.insertAdjacentHTML('beforeend', acc); }, acc);
    await expect.poll(shown).toEqual(['none', 'none']);
    const s = await stats(page);
    expect(s.states).toBe(2);
  });
});
