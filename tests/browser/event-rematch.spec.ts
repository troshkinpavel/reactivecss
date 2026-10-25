// Which :on() rules apply to an event: the rules whose selector matches when the event is
// dispatched, as the CSS cascade does. DOM changes made before the event count, also earlier in
// the same task and also attributes Reactive CSS writes (bind(), --attr-*); the event's own
// changes count from the next event on. Cases marked "0.9.0:" behaved differently before.
import { test, expect } from '@playwright/test';
import { open, frames } from './helpers';

const n = (sel = '.w') => `getComputedStyle(document.querySelector('${sel}')).getPropertyValue('--n').trim()`;
const CASES: { name: string; css: string; body: string; run: string; want: string }[] = [
  {
    name: 'bind() attribute in a rule selector', // 0.9.0: 0
    css: `.w { --n: state(0); --open: state(false, bind(data-open)) } .w .o:on(click) { --open: toggle() } .w[data-open="true"] .x:on(click) { --n: increment(1) }`,
    body: '<div class="w"><button class="o">o</button><button class="x">x</button></div>',
    run: `X('.x'); await F(); X('.o'); await F(); X('.x'); await F(); return ${n()};`, want: '1',
  },
  {
    name: '--attr-* attribute in a rule selector, same element', // 0.9.0: 0 edit
    css: `.w { --n: state(0); --on: state(false) } .w .o:on(click) { --on: toggle() } .w .x { --attr-data-mode: when(--on, edit, view) } .w .x[data-mode="edit"]:on(click) { --n: increment(1) }`,
    body: '<div class="w"><button class="o">o</button><button class="x" data-mode="view">x</button></div>',
    run: `X('.x'); await F(); X('.o'); await F(); X('.x'); await F(); return [${n()}, document.querySelector('.x').getAttribute('data-mode')].join(' ');`, want: '1 edit',
  },
  {
    name: 'bind() attribute: the rule stops applying when the attribute goes', // 0.9.0: 2
    css: `.w { --n: state(0); --open: state(true, bind(data-open)) } .w .o:on(click) { --open: toggle() } .w[data-open="true"] .x:on(click) { --n: increment(1) }`,
    body: '<div class="w" data-open="true"><button class="o">o</button><button class="x">x</button></div>',
    run: `X('.x'); await F(); X('.o'); await F(); X('.x'); await F(); return ${n()};`, want: '1',
  },
  {
    name: 'class added by page script, clicked after a frame',
    css: `.w { --n: state(0) } .w .x.on:on(click) { --n: increment(1) }`,
    body: '<div class="w"><button class="x">x</button></div>',
    run: `X('.x'); await F(); document.querySelector('.x').classList.add('on'); await F(); X('.x'); await F(); return ${n()};`, want: '1',
  },
  {
    name: 'class added by page script, clicked in the same task', // 0.9.0: 0
    css: `.w { --n: state(0) } .w .x.on:on(click) { --n: increment(1) }`,
    body: '<div class="w"><button class="x">x</button></div>',
    run: `document.querySelector('.x').classList.add('on'); X('.x'); await F(); return ${n()};`, want: '1',
  },
  {
    name: 'class removed by page script, clicked in the same task', // 0.9.0: 1
    css: `.w { --n: state(0) } .w .x.on:on(click) { --n: increment(1) }`,
    body: '<div class="w"><button class="x on">x</button></div>',
    run: `document.querySelector('.x').classList.remove('on'); X('.x'); await F(); return ${n()};`, want: '0',
  },
  {
    name: 'attribute set by page script',
    css: `.w { --n: state(0) } .w[data-k="1"] .x:on(click) { --n: increment(1) }`,
    body: '<div class="w"><button class="x">x</button></div>',
    run: `document.querySelector('.w').setAttribute('data-k', '1'); await F(); X('.x'); await F(); return ${n()};`, want: '1',
  },
  {
    name: 'nested component: an outer class toggled',
    css: `.w { --n: state(0) } .outer.live .w .x:on(click) { --n: increment(1) }`,
    body: '<div class="outer"><div class="w"><button class="x">x</button></div></div>',
    run: `X('.x'); await F(); document.querySelector('.outer').classList.add('live'); await F(); X('.x'); await F(); return ${n()};`, want: '1',
  },
  {
    name: 'conditional rule (@media min-width: 1px)',
    css: `.w { --n: state(0) } @media (min-width: 1px) { .w .x:on(click) { --n: increment(1) } }`,
    body: '<div class="w"><button class="x">x</button></div>',
    run: `X('.x'); await F(); return ${n()};`, want: '1',
  },
  {
    name: 'cascade layers: the unlayered rule wins over the layered one',
    css: `@layer a { .w .x:on(click) { --n: increment(10) } } .w { --n: state(0) } .w .x:on(click) { --n: increment(1) }`,
    body: '<div class="w"><button class="x">x</button></div>',
    run: `X('.x'); await F(); return ${n()};`, want: '1',
  },
  {
    name: 'reparenting: the button moves to another owner',
    css: `.w { --n: state(0) } .w .x:on(click) { --n: increment(1) }`,
    body: '<div class="w" id="a"><button class="x">x</button></div><div class="w" id="b"></div>',
    run: `document.getElementById('b').append(document.querySelector('.x')); await F(); X('.x'); await F(); return [${n('#a')}, ${n('#b')}].join(' ');`, want: '0 1',
  },
  {
    name: 'reparenting in the same task as the click',
    css: `.w { --n: state(0) } .w .x:on(click) { --n: increment(1) }`,
    body: '<div class="w" id="a"><button class="x">x</button></div><div class="w" id="b"></div>',
    run: `document.getElementById('b').append(document.querySelector('.x')); X('.x'); await F(); return [${n('#a')}, ${n('#b')}].join(' ');`, want: '0 1',
  },
  {
    name: 'reparenting out of every owner, same task',
    css: `.w { --n: state(0) } .w .x:on(click) { --n: increment(1) }`,
    body: '<div class="w" id="a"><button class="x">x</button></div><div id="out"></div>',
    run: `document.getElementById('out').append(document.querySelector('.x')); X('.x'); await F(); return ${n('#a')};`, want: '0',
  },
  {
    name: 'a stylesheet with a new rule added, then removed',
    css: `.w { --n: state(0) }`,
    body: '<div class="w"><button class="x">x</button></div>',
    run: `const s = document.createElement('style'); s.textContent = '.w .x:on(click) { --n: increment(1) }'; document.head.append(s); await F(); X('.x'); await F(); s.remove(); await F(); X('.x'); await F(); return ${n()};`, want: '1',
  },
  {
    name: 'the action that writes a bound attribute does not change which rules run for its own event', // 0.9.0: 0 0
    css: `.w { --n: state(0); --open: state(false, bind(data-open)) } .w .x:on(click) { --open: toggle() } .w[data-open="true"] .x2:on(click) { --n: increment(1) }`,
    body: '<div class="w"><span class="x2"><button class="x">x</button></span></div>',
    // 1st click: data-open is false at dispatch, so only .x runs (n stays 0) and opens.
    // 2nd click: data-open is true at dispatch, so .x2 runs too (n = 1) while .x closes again.
    run: `X('.x'); await F(); const first = ${n()}; X('.x'); await F(); return [first, ${n()}].join(' ');`, want: '0 1',
  },
  {
    name: 'consecutive events in one task: the second sees the bound attribute the first wrote', // 0.9.0: 0 false
    css: `.w { --n: state(0); --open: state(false, bind(data-open)) } .w .x:on(click) { --open: toggle() } .w[data-open="true"] .x2:on(click) { --n: increment(1) }`,
    body: '<div class="w"><span class="x2"><button class="x">x</button></span></div>',
    run: `X('.x'); X('.x'); await F(); return [${n()}, document.querySelector('.w').getAttribute('data-open')].join(' ');`, want: '1 false',
  },
  {
    name: 'consecutive events in one task: the second sees the --attr-* value the first wrote', // 0.9.0: 0
    css: `.w { --n: state(0); --on: state(false) } .w .x { --attr-data-mode: when(--on, edit, view) } .w .x:on(click) { --on: set(true) } .w .x[data-mode="edit"]:on(click) { --n: increment(1) }`,
    body: '<div class="w"><button class="x" data-mode="view">x</button></div>',
    run: `X('.x'); X('.x'); await F(); return ${n()};`, want: '1',
  },
  {
    name: 'a component inserted and clicked in the same task', // 0.9.0: 0
    css: `.w { --n: state(0) } .w .x:on(click) { --n: increment(1) }`,
    body: '<div id="host"></div>',
    run: `document.getElementById('host').innerHTML = '<div class="w"><button class="x">x</button></div>'; X('.x'); await F(); return ${n()};`, want: '1',
  },
  {
    name: 'nested owners: an --attr-* on the outer owner enables a rule inside the inner one', // 0.9.0: 0
    css: `.p { --mode: state(0) } .p .m:on(click) { --mode: set(1) } .p { --attr-data-mode: var(--mode) } .w { --n: state(0) } .p[data-mode="1"] .w .x:on(click) { --n: increment(1) }`,
    body: '<div class="p"><button class="m">m</button><div class="w"><button class="x">x</button></div></div>',
    run: `X('.m'); await F(); X('.x'); await F(); return ${n()};`, want: '1',
  },
];

for (const c of CASES) {
  test(c.name, async ({ page }) => {
    await open(page, { head: `<style>${c.css}</style>`, body: c.body });
    await frames(page);
    const got = await page.evaluate(`(async () => {
      const F = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const X = (s) => document.querySelector(s).click();
      ${c.run}
    })()`);
    expect(got).toBe(c.want);
  });
}

// 0.9.0: the first rule kept matching ('2 true', '3 true', '4 true'): the bound attribute was ignored.
test('a rule whose action writes the attribute its own selector depends on runs once per event', async ({ page }) => {
  await open(page, {
    head: `<style>.w { --n: state(0); --open: state(false, bind(data-open)) } .w:not([data-open="true"]) .x:on(click) { --open: set(true); --n: increment(1) } .w[data-open="true"] .x:on(click) { --open: set(false); --n: increment(10) }</style>`,
    body: '<div class="w"><button class="x">x</button></div>',
  });
  await frames(page);
  const seen: string[] = [];
  for (let i = 0; i < 4; i++) {
    await page.click('.x');
    await frames(page);
    seen.push(await page.evaluate(() => [getComputedStyle(document.querySelector('.w')!).getPropertyValue('--n').trim(), document.querySelector('.w')!.getAttribute('data-open')].join(' ')));
  }
  expect(seen).toEqual(['1 true', '11 false', '12 true', '22 false']);
});
