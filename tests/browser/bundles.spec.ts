// 0.8.0: custom bundles built by tools/bundle.mjs, executed in the browser under a strict CSP.
import { test, expect, type Page } from '@playwright/test';
import { open, frames, stats, diagnostics } from './helpers'; // decoded: custom bundles carry diagnostic codes

const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'";
const built = new Map<string, Promise<{ code: string; manifest: any }>>();
function bundle(features: string[] | string) {
  const key = JSON.stringify(features);
  if (!built.has(key)) built.set(key, (async () => {
    // @ts-expect-error: plain ESM tooling
    const { build } = await import('../../tools/bundle.mjs');
    const r = await build(typeof features === 'string' ? { profile: features } : { features });
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    return r;
  })());
  return built.get(key)!;
}
/** Opens a page whose library script is the given custom bundle (the helpers' dev bundle URL is rerouted). */
async function openWith(page: Page, features: string[] | string, o: { css: string; body: string }) {
  const { code } = await bundle(features);
  await page.route('**/dist/reactive-css.js', (r) => r.fulfill({ contentType: 'text/javascript', body: code }));
  await open(page, { head: '<link rel="stylesheet" href="/t/css/a.css">', css: { 'a.css': o.css }, body: o.body, csp: CSP });
  await page.waitForFunction(() => (window as any).ReactiveCSS?.stats().sheets >= 1);
  await frames(page);
}
const unmount = async (page: Page) => {
  await page.evaluate(() => document.body.replaceChildren());
  await frames(page, 3);
  const s = await stats(page);
  expect([s.bindings, s.states, s.sources]).toEqual([0, 0, 0]);
};

test.describe('a feature left out is reported, never silently ignored', () => {
  test('0.9 syntax of missing features: one diagnostic each, the rest keeps working', async ({ page }) => {
    await openWith(page, ['events'], {
      css: `.a { --n: state(0); --x: state(0px); --t: state(false, persist("k")) } .a b:on(click) { --n: increment(1) }
        .a i:on(drag) { --x: set(event(x)) } .a input { --v: state("", bind(value)) } .a u:blur { color: red }
        .a s { --attr-hidden: false; content: var(--n) } .a input { focus: when(--n > 1) }`,
      body: '<div class="a"><b>b</b><i>i</i><input><u>u</u><s></s></div>',
    });
    const d = (await diagnostics(page)).join('\n');
    for (const [what, feature] of [[':on(drag)', 'gestures'], ['persist()', 'persist'], ['state(…, bind(value))', 'forms'], [':blur', 'blur'],
      ['--attr-*', 'attributes'], ['content: var(…) as DOM text', 'text'], ['focus:', 'focus']] as const)
      expect(d, what).toContain(`${what} is not included in this bundle (feature "${feature}")`);
    await page.click('.a b');
    await frames(page);
    expect(await page.$eval('.a', (e) => getComputedStyle(e).getPropertyValue('--n').trim())).toBe('1');
  });

  test('a bundle without events: :on() is reported, states still work', async ({ page }) => {
    await openWith(page, ['conditions'], { css: `.a { --n: state(2) } .a b:on(click) { --n: increment(1) } .a:when(--n == 2) i { color: red }`, body: '<div class="a"><b>b</b><i>i</i></div>' });
    expect((await diagnostics(page)).join('\n')).toContain(':on() is not included in this bundle (feature "events")');
    expect(await page.$eval('.a i', (e) => getComputedStyle(e).color)).toBe('rgb(255, 0, 0)');
  });

  test('events-only bundle: declarations, functions and selectors of missing features each get one diagnostic', async ({ page }) => {
    await openWith(page, ['events'], {
      css: `.a { --n: state(0); --t: typed(0deg); --o: state(false, bind(aria-expanded)) }
        .a b { on: click(increment(--n)) } .a .t { text: var(--n) } .a .x { attr: data-n var(--n); focus: var(--o) }
        .a input { bind: --n } .a .l { width: live(pick(1px), 1s); background: element(#native); height: element(width) }
        .a:when(--n > 1) .y { color: red } .a .z:nth-var(--n) { color: red } .a .p { text: previous(--n) }
        .a .r { translate: random(0px, 10px) 0 }`,
      body: '<div class="a"><b>b</b><span class="t">t</span><i class="x"></i><input><i class="l"></i><i class="y"></i><i class="z"></i><i class="p"></i><i class="r"></i></div>',
    });
    const d = (await diagnostics(page)).join('\n');
    for (const [what, feature] of [['typed()', 'values'], ['state(…, bind(attribute))', 'attributes'], ['text:', 'text'], ['attr:', 'attributes'], ['focus:', 'focus'],
      ['bind:', 'forms'], ['live()', 'dynamic'], ['element()', 'geometry'], [':when()', 'conditions'], [':nth-var()', 'nth-var']] as const)
      expect(d, what).toContain(`${what} is not included in this bundle (feature "${feature}")`);
    expect(d).toMatch(/random\(\) may be the native CSS function/); // a note, not a warning
    expect(d).not.toMatch(/element\(\) is not included.*#native/);
    expect(d.match(/is not included/g)!.length).toBeGreaterThanOrEqual(10);
    // what is included still works
    await page.click('.a b'); await page.click('.a b');
    await frames(page);
    expect(await page.$eval('.a', (e) => getComputedStyle(e).getPropertyValue('--n').trim())).toBe('2');
    const info = await page.evaluate(() => (window as any).ReactiveCSS.describe());
    expect(info.bundle).toEqual(['core', 'events']);
    expect(new Set(info.features.map((f: any) => f.kind))).toEqual(new Set(['function', 'expression', 'trigger', 'action', 'declaration', 'rule'])); // 0.9.0: :on() is a rule
    expect(info.features.some((f: any) => f.name === 'text')).toBe(false);
  });
});

test.describe('profiles run real interfaces', () => {
  test('basic: state, actions, events (key, outside, prevent)', async ({ page }) => {
    await openWith(page, 'basic', {
      css: `.c { --n: state(0); --open: state(false); on: key(ArrowUp, prevent(), increment(--n)), outside(click, set(--open, false)) }
        .c b { on: click(increment(--n), set(--open, true)) }`,
      body: '<div class="c" tabindex="0"><b>+</b><output></output></div><p id="out">outside</p>',
    });
    await page.click('.c b');
    await page.focus('.c');
    await page.keyboard.press('ArrowUp');
    await frames(page);
    expect(await page.$eval('.c', (e) => getComputedStyle(e).getPropertyValue('--n').trim())).toBe('2');
    expect(await diagnostics(page)).toEqual([]);
    await unmount(page);
  });

  test('forms: bind:, text:, attr:, state(…, bind())', async ({ page }) => {
    await openWith(page, 'forms', {
      // Only this profile's features: var() instead of when() (conditions is not in "forms").
      css: `.f { --name: state(""); --locked: state(true); --open: state(false, bind(data-open)) } .f input[type=text] { bind: --name } .f .who { text: var(--name) }
        .f input[type=checkbox] { bind: --locked } .f button { attr: disabled var(--locked); on: click(toggle(--open)) }`,
      body: '<div class="f"><input type="text"><input type="checkbox" checked><span class="who">x</span><button>go</button></div>',
    });
    expect(await page.$eval('.f button', (b) => (b as HTMLButtonElement).disabled)).toBe(true);
    await page.fill('.f input[type=text]', 'Ada');
    await page.uncheck('.f input[type=checkbox]');
    await frames(page);
    expect([await page.textContent('.who'), await page.$eval('.f button', (b) => (b as HTMLButtonElement).disabled)]).toEqual(['Ada', false]);
    await page.click('.f button');
    expect(await page.getAttribute('.f', 'data-open')).toBe('true');
    expect(await diagnostics(page)).toEqual([]);
    await unmount(page);
  });

  test('stateful UI: conditions, history, attributes, focus, prevent', async ({ page }) => {
    await openWith(page, 'stateful-ui', {
      css: `.s { --step: state(1) } .s .next { on: click(increment(--step)); attr: disabled when(--step >= 3) }
        .s h2 { focus: false } .s h2:nth-child(2):where(.two) { focus: when(--step == 2) } .s:when(--step == 2) .two { color: red }
        .s:changed(--step) .two { outline: 1px solid } .s { on: key(End, prevent(), set(--step, 3)) }`,
      body: '<div class="s" tabindex="0"><button class="next">next</button><h2 class="two" tabindex="-1">two</h2></div>',
    });
    await page.click('.s .next');
    await frames(page);
    expect(await page.evaluate(() => document.activeElement!.className)).toBe('two');
    expect(await page.$eval('.two', (e) => getComputedStyle(e).color)).toBe('rgb(255, 0, 0)');
    expect(await diagnostics(page)).toEqual([]);
    await unmount(page);
  });

  test('dynamic values: random(), pick(), typed(), live(), mouse(), visible(), element()', async ({ page }) => {
    await openWith(page, 'dynamic', {
      css: `.d { --angle: typed(10deg); --v: visible(); width: 50px; height: 20px; --w: element(width) } .d i { display: block; height: 2px;
        width: calc(var(--w) / 2); translate: random(0px, 5px) 0; opacity: calc(0.5 + var(--v) * 0.5) } .d b { --p: pick(1px, 1px); --l: live(pick(2px), 50ms) }`,
      body: '<div class="d"><i></i><b>b</b></div>',
    });
    await page.waitForTimeout(150);
    expect(await page.$eval('.d i', (e) => getComputedStyle(e).width)).toBe('25px');
    expect(await page.$eval('.d b', (e) => getComputedStyle(e).getPropertyValue('--l').trim())).toBe('2px');
    expect(await diagnostics(page)).toEqual([]);
    await unmount(page);
  });

  test('full profile: every feature runs; describe().bundle lists all of them', async ({ page }) => {
    await openWith(page, 'full', { css: `.a { --n: state(0) } .a b { on: click(increment(--n)) } .a .t { text: var(--n) }`, body: '<div class="a"><b>b</b><span class="t">0</span></div>' });
    await page.click('.a b');
    await frames(page);
    expect(await page.textContent('.a .t')).toBe('1');
    const info = await page.evaluate(() => (window as any).ReactiveCSS.describe());
    expect(info.bundle).toHaveLength(15); // 0.9.0 adds gestures, persist, blur
    expect(await diagnostics(page)).toEqual([]);
    await unmount(page);
  });
});
