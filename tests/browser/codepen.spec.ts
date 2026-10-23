// 0.9.0 hardening: a local CodePen-style harness (NOT the real CodePen service). An editor page
// rebuilds a preview iframe from HTML and CSS text (srcdoc), edits the CSS live, and reloads the
// preview, with only the auto-starting production script. The pens contain no JavaScript; the
// harness script only plays the editor.
import { test, expect, type Page, type FrameLocator } from '@playwright/test';
import { frames } from './helpers';

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"></head><body><iframe id="preview" style="width:800px;height:500px"></iframe><script>
  window.render = ({ html, css, scriptFirst = true, csp = '', dev = false }) => new Promise((res) => {
    const RUNTIME = '<script src="/dist/reactive-css' + (dev ? '' : '.min') + '.js"><\\/script>';
    const f = document.getElementById('preview');
    f.onload = () => res();
    const meta = csp ? '<meta http-equiv="Content-Security-Policy" content="' + csp + '">' : '';
    const doc = '<!doctype html><html><head><meta charset="utf-8">' + meta + (scriptFirst ? RUNTIME : '') + '<style id="pen">' + css + '<\\/style></head><body>' + html + (scriptFirst ? '' : RUNTIME) + '</body></html>';
    // With a CSP, a real same-origin URL (as CodePen serves its preview): Firefox does not count a srcdoc document as 'self'.
    if (csp) f.src = '/t/preview.html?doc=' + encodeURIComponent(doc); else f.srcdoc = doc;
  });
  window.editCSS = (css) => { document.getElementById('preview').contentDocument.getElementById('pen').textContent = css; };
  window.rt = () => document.getElementById('preview').contentWindow.ReactiveCSS;
</script></body></html>`;

async function harness(page: Page) {
  await page.route('**/t/codepen.html', (r) => r.fulfill({ contentType: 'text/html', body: HARNESS }));
  await page.route(/\/t\/preview\.html\?/, (r) => r.fulfill({ contentType: 'text/html', body: new URL(r.request().url()).searchParams.get('doc')! }));
  await page.goto('/t/codepen.html');
}
async function pen(page: Page, html: string, css: string, o: { scriptFirst?: boolean; csp?: string; dev?: boolean } = {}): Promise<FrameLocator> {
  await page.evaluate((a) => (window as any).render(a), { html, css, ...o });
  await page.waitForFunction(() => (window as any).rt()?.stats().sheets >= 1);
  await frames(page);
  return page.frameLocator('#preview');
}
const pv = (page: Page) => page.frame({ url: /srcdoc/ }) ?? page.frames()[1];
const prop = (page: Page, sel: string, p: string) => pv(page).$eval(sel, (e, n) => getComputedStyle(e).getPropertyValue(n).trim(), p);
const rtStats = (page: Page) => page.evaluate(() => (window as any).rt().stats());
const diag = (page: Page) => page.evaluate(() => (window as any).rt().diagnostics as string[]);

const PENS: Record<string, { html: string; css: string; run: (page: Page, f: FrameLocator) => Promise<void> }> = {
  counter: {
    html: '<div class="c"><button class="inc">+</button><output class="v">0</output></div>',
    css: '.c { --n: state(0) } .c .inc:on(click) { --n: increment(1) } .c .v { content: var(--n) }',
    async run(page, f) { await f.locator('.inc').click(); await f.locator('.inc').click(); await frames(page); await expect(f.locator('.v')).toHaveText('2'); },
  },
  toggle: {
    html: '<button class="t">T</button>',
    css: '.t { --on: state(false, bind(aria-pressed)); --attr-data-state: when(--on, "on", "off") } .t:on(click) { --on: toggle() }',
    async run(_page, f) { await f.locator('.t').click(); await expect(f.locator('.t')).toHaveAttribute('aria-pressed', 'true'); await expect(f.locator('.t')).toHaveAttribute('data-state', 'on'); },
  },
  tabs: {
    html: '<div class="tabs"><nav role="tablist"><button role="tab">1</button><button role="tab">2</button><button role="tab">3</button></nav><div><p>A</p><p>B</p><p>C</p></div></div>',
    css: '.tabs { --t: state(1) } .tabs button:on(click) { --t: set(sibling-index()) } .tabs p { display: none } .tabs p:nth-var(--t) { display: block } .tabs button { --attr-aria-selected: false } .tabs button:nth-var(--t) { --attr-aria-selected: true }',
    async run(_page, f) { await f.locator('button').nth(2).click(); await expect(f.locator('p').nth(2)).toBeVisible(); await expect(f.locator('button').nth(2)).toHaveAttribute('aria-selected', 'true'); },
  },
  forms: {
    html: '<form><input name="q"><span class="echo"></span></form>',
    css: 'form { --q: state("") } input:on(input) { --q: set(event(value)) } form .echo { content: var(--q) } input { --own: state("", bind(value)) }',
    async run(page, f) { await f.locator('input').fill('pen'); await frames(page); await expect(f.locator('.echo')).toHaveText('pen'); expect(await prop(page, 'input', '--own')).toBe('"pen"'); },
  },
  persistence: {
    html: '<button class="p">+</button><span class="v">0</span>',
    css: 'body { --n: state(0, persist("pen-n", session)) } .p:on(click) { --n: increment(1) } .v { content: var(--n) }',
    async run(page, f) {
      await f.locator('.p').click(); await f.locator('.p').click();
      await page.waitForFunction(() => document.getElementById('preview')!.contentWindow!.sessionStorage.getItem('rcss:pen-n') === '{"t":"number","v":2}');
      await pen(page, PENS.persistence.html, PENS.persistence.css); // the preview is rebuilt, as after an edit
      await expect(page.frameLocator('#preview').locator('.v')).toHaveText('2');
    },
  },
  drag: {
    html: '<div class="k"></div>',
    css: '.k { --x: state(0px); width: 50px; height: 50px; background: tomato; translate: var(--x) 0; touch-action: none } .k:on(drag) { --x: set(event(x)) }',
    async run(page, f) {
      const b = (await f.locator('.k').boundingBox())!;
      await page.mouse.move(b.x + 10, b.y + 10); await page.mouse.down(); await page.mouse.move(b.x + 50, b.y + 10, { steps: 5 }); await page.mouse.up();
      await frames(page);
      expect(await prop(page, '.k', '--x')).toBe('40px');
    },
  },
  focus: {
    html: '<div class="d"><button class="o">open</button><input class="i"></div>',
    css: '.d { --open: state(false) } .d .o:on(click) { --open: set(true) } .d .i { focus: when(--open) }',
    async run(_page, f) { await f.locator('.o').click(); await expect(f.locator('.i')).toBeFocused(); },
  },
  blur: {
    html: '<input class="a"><input class="b">',
    css: 'input:blur { outline: 3px solid rgb(255, 0, 0) }',
    async run(page, f) {
      await f.locator('.a').focus(); await f.locator('.b').focus();
      expect(await pv(page).$eval('.a', (e) => getComputedStyle(e).outlineColor)).toBe('rgb(255, 0, 0)');
      expect(await pv(page).$eval('.b', (e) => getComputedStyle(e).outlineStyle)).not.toBe('solid');
    },
  },
  text: {
    html: '<div class="w"><button>go</button><b class="t">idle</b></div>',
    css: '.w { --s: state("idle") } .w button:on(click) { --s: cycle("idle", "busy", "done") } .w .t { content: var(--s) }',
    async run(page, f) { await f.locator('button').click(); await f.locator('button').click(); await frames(page); await expect(f.locator('.t')).toHaveText('done'); },
  },
  attributes: {
    html: '<div class="m"><button class="x">menu</button><ul class="l"><li>a</li></ul></div>',
    css: '.m { --open: state(false) } .m .x:on(click) { --open: toggle() } .m .x { --attr-aria-expanded: var(--open) } .m .l { --attr-hidden: when(not --open) }',
    async run(_page, f) { await expect(f.locator('.l')).toBeHidden(); await f.locator('.x').click(); await expect(f.locator('.x')).toHaveAttribute('aria-expanded', 'true'); await expect(f.locator('.l')).toBeVisible(); },
  },
};

test.describe('each pen works with only the external runtime', () => {
  for (const [name, p] of Object.entries(PENS)) {
    test(name, async ({ page }) => {
      await harness(page);
      const f = await pen(page, p.html, p.css);
      await p.run(page, f);
      expect(await diag(page)).toEqual([]);
    });
  }
});

test('the runtime script after the stylesheet (end of body) works the same', async ({ page }) => {
  await harness(page);
  const f = await pen(page, PENS.counter.html, PENS.counter.css, { scriptFirst: false });
  await PENS.counter.run(page, f);
});

test('fast live CSS edits (25 in a row): the last version applies, nothing accumulates', async ({ page }) => {
  await harness(page);
  await pen(page, PENS.counter.html, PENS.counter.css, { dev: true }); // the development runtime, for its internal counters
  const before = await rtStats(page);
  for (let i = 1; i <= 25; i++) await page.evaluate((i) => (window as any).editCSS(`.c { --n: state(0) } .c .inc:on(click) { --n: increment(${i}) } .c .v { content: var(--n) } .c .x { focus: when(--n > 0) }`), i);
  await frames(page, 3);
  const f = page.frameLocator('#preview');
  await f.locator('.inc').click();
  await frames(page);
  await expect(f.locator('.v')).toHaveText('25');
  const after = await rtStats(page);
  expect(after.sheets).toBe(1);
  expect(after.internal.actionListeners).toBe(before.internal.actionListeners);
  expect(after.internal.watchers).toBeLessThanOrEqual(before.internal.watchers + 2);
});

test('the preview rebuilt 15 times (as CodePen does on HTML edits): every runtime starts fresh and works', async ({ page }) => {
  await harness(page);
  for (let i = 0; i < 15; i++) await pen(page, PENS.toggle.html, PENS.toggle.css);
  await PENS.toggle.run(page, page.frameLocator('#preview'));
});

test('stop / start cycles inside the preview', async ({ page }) => {
  await harness(page);
  const f = await pen(page, PENS.counter.html, PENS.counter.css, { dev: true });
  for (let i = 0; i < 10; i++) await page.evaluate(() => { const r = (window as any).rt(); r.stop(); r.start(); });
  await page.waitForFunction(() => (window as any).rt().stats().sheets === 1);
  await PENS.counter.run(page, f);
  expect((await rtStats(page)).internal.actionListeners).toBe(1);
});

test('a preview with a strict CSP (no eval, scripts from self only)', async ({ page }) => {
  await harness(page);
  const errors: string[] = [];
  page.on('console', (m) => { if (/Content Security Policy|Refused/i.test(m.text())) errors.push(m.text()); });
  const f = await pen(page, PENS.drag.html + PENS.attributes.html, PENS.drag.css + PENS.attributes.css, { csp: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'" });
  await PENS.attributes.run(page, f);
  await PENS.drag.run(page, f);
  expect(errors).toEqual([]);
});
