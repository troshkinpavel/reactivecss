import { test, expect, type Page } from '@playwright/test';
import { open, style, frames, stats, diagnostics } from './helpers';

test('static random() gives each element its own value within range', async ({ page }) => {
  await open(page, {
    head: `<style>.box { width: random(100px, 300px); height: 10px; } .plain { width: 42px }</style>`,
    body: '<div class="box"></div>'.repeat(20) + '<div class="plain"></div>',
  });
  const widths = await page.$$eval('.box', (els) => els.map((e) => parseFloat(getComputedStyle(e).width)));
  for (const w of widths) { expect(w).toBeGreaterThanOrEqual(100); expect(w).toBeLessThanOrEqual(300); }
  expect(new Set(widths).size).toBeGreaterThan(10);
  expect(await style(page, '.box', 'height')).toBe('10px');
  expect(await style(page, '.plain', 'width')).toBe('42px');
  expect(await diagnostics(page)).toEqual([]);
});

test('cascade order, specificity and !important are preserved', async ({ page }) => {
  await open(page, {
    head: `<style>
      .r { color: pick(rgb(255, 0, 0)) } .b { color: rgb(0, 0, 255) }
      .imp { color: pick(rgb(255, 0, 0)) !important } #i { color: rgb(0, 0, 255) }
      #s.s { color: rgb(0, 128, 0) } .s { color: pick(rgb(255, 0, 0)) }
    </style>`,
    body: '<p class="r b" id="o"></p><p class="imp" id="i"></p><p class="s" id="s"></p>',
  });
  expect(await style(page, '#o', 'color')).toBe('rgb(0, 0, 255)');
  expect(await style(page, '#i', 'color')).toBe('rgb(255, 0, 0)');
  expect(await style(page, '#s', 'color')).toBe('rgb(0, 128, 0)');
});

test('linked same-origin stylesheets are rewritten in place: URLs, media, disabled and alternate sheets keep working', async ({ page }) => {
  await open(page, {
    head: `<link rel="stylesheet" href="/t/css/a.css"><link rel="stylesheet" href="/t/css/print.css" media="print">
      <link rel="stylesheet" href="/t/css/off.css" disabled id="off">
      <link rel="alternate stylesheet" title="Other" href="/t/css/alt.css">`,
    body: '<div class="u"></div>',
    css: {
      'a.css': `.u { background-image: url(img/x.png); width: pick(5px) }`,
      'print.css': `.u { height: pick(7px) }`,
      'off.css': `.u { min-width: pick(9px) }`,
      'alt.css': `.u { max-width: pick(3px) }`,
    },
  });
  await expect.poll(() => style(page, '.u', 'width')).toBe('5px');
  expect(await style(page, '.u', 'background-image')).toContain('/t/css/img/x.png'); // relative to the sheet
  expect(await style(page, '.u', 'height')).not.toBe('7px'); // print media still applies only to print
  expect(await style(page, '.u', 'min-width')).not.toBe('9px'); // author-disabled stays off
  expect(await style(page, '.u', 'max-width')).not.toBe('3px'); // alternate set not selected
  const sheets = () => page.evaluate(() => [...document.styleSheets].map((s) => [s.href?.split('/').pop(), s.media.mediaText, [...s.cssRules].some((r) => r.cssText.includes('var(--rcss'))]));
  await expect.poll(sheets).toContainEqual(['print.css', 'print', true]);
  expect(await sheets()).toContainEqual(['a.css', '', true]);
  await page.evaluate(() => { (document.getElementById('off') as HTMLLinkElement).disabled = false; }); // enabled later: works
  await expect.poll(() => style(page, '.u', 'min-width')).toBe('9px');
  await page.emulateMedia({ media: 'print' });
  await expect.poll(() => style(page, '.u', 'height')).toBe('7px'); // the same sheet, now matching
});

test('live() re-evaluates on one shared interval and cleans up on removal', async ({ page }) => {
  await open(page, {
    head: `<style>.l { opacity: live(random(0, 1), 100ms) }</style>`,
    body: '<div id="wrap">' + '<i class="l"></i>'.repeat(50) + '</div>',
  });
  let s = await stats(page);
  expect(s.bindings).toBe(50);
  expect(s.scheduled).toBe(50);
  expect(s.intervals).toBe(1);
  const first = await style(page, '.l', 'opacity');
  await expect.poll(() => style(page, '.l', 'opacity'), { timeout: 2000 }).not.toBe(first);
  await page.evaluate(() => document.querySelector('#wrap')!.remove());
  await frames(page);
  s = await stats(page);
  expect(s.bindings).toBe(0);
  expect(s.scheduled).toBe(0);
  expect(s.intervals).toBe(0);
});

test('elements added later or matching after a class change are bound; unmatched ones are released', async ({ page }) => {
  await open(page, {
    head: `<style>.on .x { width: pick(20px) }</style>`,
    body: '<div id="p"><span class="x" style="display:block"></span></div>',
  });
  expect((await stats(page)).bindings).toBe(0);
  await page.evaluate(() => document.querySelector('#p')!.classList.add('on'));
  await expect.poll(async () => (await stats(page)).bindings).toBe(1);
  expect(await style(page, '.x', 'width')).toBe('20px');
  await page.evaluate(() => document.querySelector('#p')!.insertAdjacentHTML('beforeend', '<b class="x" style="display:block"></b>'));
  await expect.poll(async () => (await stats(page)).bindings).toBe(2);
  await page.evaluate(() => document.querySelector('#p')!.classList.remove('on'));
  await expect.poll(async () => (await stats(page)).bindings).toBe(0);
  expect(await page.$eval('.x', (e) => (e as HTMLElement).style.cssText)).toBe('display: block;');
});

test('stylesheets inserted, edited and removed at runtime', async ({ page }) => {
  await open(page, { body: '<div class="d" style="display:block"></div>' });
  await page.evaluate(() => {
    const s = document.createElement('style');
    s.id = 'dyn';
    s.textContent = '.d { width: random(30px, 30px) }';
    document.head.append(s);
  });
  await expect.poll(() => style(page, '.d', 'width')).toBe('30px');
  await page.evaluate(() => { document.querySelector('#dyn')!.textContent = '.d { width: random(40px, 40px) }'; });
  await expect.poll(() => style(page, '.d', 'width')).toBe('40px');
  await page.evaluate(() => document.querySelector('#dyn')!.remove());
  await expect.poll(async () => (await stats(page)).sheets).toBe(0);
  expect(await page.evaluate(() => document.styleSheets.length)).toBe(0);
});

test.describe(':just-checked / :just-unchecked', () => {
  const head = `<style>
    input:just-checked + i { animation: in 10s }
    input:just-unchecked + i { animation: out 10s }
    @keyframes in { from { opacity: 0.5 } } @keyframes out { from { opacity: 0.5 } }
  </style>`;
  const anim = (page: Page, sel: string) => style(page, sel, 'animation-name');

  test('initial state never matches; user toggles do and restart animations', async ({ page }) => {
    await open(page, { head, body: '<label><input type="checkbox" id="a" checked><i id="ai"></i> A</label><input type="checkbox" id="b"><i id="bi"></i>' });
    expect(await anim(page, '#ai')).toBe('none');
    expect(await anim(page, '#bi')).toBe('none');
    await page.click('#a');
    expect(await anim(page, '#ai')).toBe('out');
    await page.click('text=A'); // label click
    expect(await anim(page, '#ai')).toBe('in');
    await page.focus('#b');
    await page.keyboard.press('Space');
    expect(await anim(page, '#bi')).toBe('in');
    expect(await page.$eval('#b', (e: HTMLInputElement) => e.checked)).toBe(true); // form semantics untouched
  });

  test('radio groups mark the radio that lost its checked state', async ({ page }) => {
    await open(page, { head, body: '<form><input type="radio" name="r" id="r1" checked><i id="i1"></i><input type="radio" name="r" id="r2"><i id="i2"></i></form><input type="radio" name="r" id="r3"><i id="i3"></i>' });
    await page.click('#r2');
    expect(await anim(page, '#i1')).toBe('out');
    expect(await anim(page, '#i2')).toBe('in');
    expect(await anim(page, '#i3')).toBe('none'); // different group (outside the form)
  });

  test('programmatic changes: change event, refresh() and form reset', async ({ page }) => {
    await open(page, { head, body: '<form id="f"><input type="checkbox" id="c"><i id="ci"></i></form>' });
    await page.evaluate(() => { (document.querySelector('#c') as HTMLInputElement).checked = true; });
    expect(await anim(page, '#ci')).toBe('none'); // not observable without an event
    await page.evaluate(() => window.ReactiveCSS.refresh());
    expect(await anim(page, '#ci')).toBe('in');
    await page.evaluate(() => (document.querySelector('#f') as HTMLFormElement).reset());
    await expect.poll(() => anim(page, '#ci')).toBe('out');
  });
});

test.describe(':nth-var()', () => {
  const head = `<style>
    .c { --active: 2 } .c.alt { --active: 1 } body.far .c { --active: 4 }
    .s { width: 10px } .s:nth-var(--active) { width: 50px }
  </style>`;
  const body = '<div class="c">' + '<div class="s"></div>'.repeat(4) + '</div>';
  const active = (page: Page) => page.$$eval('.s', (els) => els.findIndex((e) => getComputedStyle(e).width === '50px') + 1);

  test('follows the variable from inline style, classes, ancestors and sibling changes', async ({ page }) => {
    await open(page, { head, body });
    expect(await active(page)).toBe(2);
    await page.evaluate(() => (document.querySelector('.c') as HTMLElement).style.setProperty('--active', '3'));
    await expect.poll(() => active(page)).toBe(3);
    await page.evaluate(() => { const c = document.querySelector('.c') as HTMLElement; c.style.removeProperty('--active'); c.classList.add('alt'); });
    await expect.poll(() => active(page)).toBe(1);
    await page.evaluate(() => { document.querySelector('.c')!.classList.remove('alt'); document.body.classList.add('far'); });
    await expect.poll(() => active(page)).toBe(4);
    await page.evaluate(() => document.querySelector('.c')!.prepend(Object.assign(document.createElement('div'), { className: 's' })));
    await expect.poll(() => active(page)).toBe(4);
    expect(await page.$$eval('.s', (e) => e.length)).toBe(5);
    await page.evaluate(() => { (document.querySelector('.c') as HTMLElement).style.setProperty('--active', '9'); });
    await expect.poll(() => active(page)).toBe(0);
  });

  test('works with live() writing the variable', async ({ page }) => {
    await open(page, {
      head: `<style>.c { --active: live(pick(1, 3), 100ms) } .s { width: 10px } .s:nth-var(--active) { width: 50px }</style>`,
      body,
    });
    const seen = new Set<number>();
    for (let i = 0; i < 30 && seen.size < 2; i++) { seen.add(await active(page)); await page.waitForTimeout(60); }
    expect([...seen].sort()).toEqual([1, 3]);
  });
});

test('mouse(), on() and visible() update from their sources', async ({ page }) => {
  await open(page, {
    head: `<style>
      body { margin: 0 } .m { position: absolute; left: 100px; top: 50px; width: 10px; height: 10px; --vx: mouse(x); --ly: mouse(y, local) }
      .o { rotate: on(click, random(1deg, 359deg)) }
      .v { margin-top: 3000px; height: 50px; opacity: visible() }
    </style>`,
    body: '<div class="m"></div><button class="o">o</button><div class="v"></div>',
  });
  await page.mouse.move(130, 80);
  await expect.poll(() => style(page, '.m', '--vx').then((v) => v.trim())).toBe('130px');
  expect((await style(page, '.m', '--ly')).trim()).toBe('30px');

  const before = await style(page, '.o', 'rotate');
  let changed = false;
  for (let i = 0; i < 5 && !changed; i++) { await page.click('.o'); await frames(page); changed = (await style(page, '.o', 'rotate')) !== before; }
  expect(changed).toBe(true);

  expect(await style(page, '.v', 'opacity')).toBe('0');
  await page.$eval('.v', (e) => e.scrollIntoView());
  await expect.poll(() => style(page, '.v', 'opacity')).toBe('1');

  expect((await stats(page)).sources).toBe(4);
  await page.evaluate(() => document.querySelectorAll('.m, .o, .v').forEach((e) => e.remove()));
  await expect.poll(async () => (await stats(page)).sources).toBe(0); // listeners and observers released
});

test('invalid syntax produces diagnostics and leaves other CSS working', async ({ page }) => {
  await open(page, {
    head: `<style>.a { width: 33px; rotate: on(scroll, 1deg); height: live(random(1px, 2px), 1s, 3) } :nth-var(--x) { color: red }</style>`,
    body: '<div class="a"></div>',
  });
  expect(await style(page, '.a', 'width')).toBe('33px');
  const d = (await diagnostics(page)).join('\n');
  expect(d).toMatch(/unsupported event "scroll"/);
  expect(d).toMatch(/live\(\): expected/);
  expect(d).toMatch(/:nth-var\(\) needs/);
});

test('cross-origin stylesheets are skipped or reported, never bypassed', async ({ page }) => {
  // The page is served from 127.0.0.1, the sheets from localhost: different origins.
  await page.route('**/t/page.html', (r) => r.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><link rel="stylesheet" href="http://localhost:8181/examples/demo.css">
      <link rel="stylesheet" crossorigin href="http://localhost:8181/examples/site.css">
      <script src="/dist/reactive-css.js" defer></script>`,
  }));
  await page.goto('http://127.0.0.1:8181/t/page.html');
  await page.waitForFunction(() => window.ReactiveCSS);
  await expect.poll(async () => (await diagnostics(page)).length).toBe(2);
  const d = (await diagnostics(page)).join('\n');
  expect(d).toMatch(/Skipped cross-origin stylesheet .*demo\.css/);
  expect(d).toMatch(/Cannot read stylesheet .*site\.css/);
});

test('diagnostics name the stylesheet, the construct and a fix', async ({ page }) => {
  await open(page, {
    head: `<link rel="stylesheet" href="/t/css/app.css"><style id="theme">.b { on: click(explode()) }</style>`,
    body: '<i class="a"></i><b class="b"></b>',
    css: { 'app.css': `.a { width: random(1px, 2px, 3s) }` },
  });
  await expect.poll(async () => (await diagnostics(page)).length).toBe(2);
  const d = await diagnostics(page);
  expect(d.find((x) => x.startsWith('/t/css/app.css: random():'))).toMatch(/use live\(random\(\.\.\.\), 2s\)/);
  expect(d.find((x) => x.startsWith('<style id="theme">:'))).toMatch(/unknown action "explode\(\)"; available: set\(\)/);
});
