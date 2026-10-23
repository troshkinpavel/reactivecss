// Integration with the real builder: for representative selections, the commands and script the
// bundle builder page generates are run with the library's CLI and API in a scratch project
// (the library linked as node_modules/@reactivecss/core, as an installed package would be), the
// manifest is checked against the page's summary, and the bundle runs a page in this browser,
// loaded with the snippet the page generated, under a strict CSP.
import { expect, test, type Page } from '@playwright/test';
import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LIB = new URL('../../../', import.meta.url).pathname.replace(/\/$/, '');
// Minified bundles report diagnostics as codes; the library's explain() turns them back into text.
const { explain } = await import(new URL('../../../tools/diagnostics.mjs', import.meta.url).href) as { explain: (s: string) => string };
const diagnostics = async (page: Page) => explain((await page.evaluate(() => (window as any).ReactiveCSS.diagnostics as string[])).join('\n'));
const FEATURES = (JSON.parse(readFileSync(new URL('../../src/generated/bundles.json', import.meta.url), 'utf8')).catalog.features as unknown[]).length;
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'";
const ORIGIN = 'http://cli.test';

function scratchProject() {
  const dir = mkdtempSync(join(tmpdir(), 'rcss-cli-'));
  mkdirSync(join(dir, 'node_modules/.bin'), { recursive: true });
  mkdirSync(join(dir, 'node_modules/@reactivecss'));
  symlinkSync(LIB, join(dir, 'node_modules/@reactivecss/core'));
  symlinkSync(join(LIB, 'node_modules/esbuild'), join(dir, 'node_modules/esbuild'));
  symlinkSync('../@reactivecss/core/tools/reactive-css.mjs', join(dir, 'node_modules/.bin/reactive-css'));
  writeFileSync(join(dir, 'package.json'), '{ "private": true, "type": "module" }\n');
  return dir;
}
const run = (cmd: string, cwd: string) => execSync(cmd, { cwd, encoding: 'utf8', env: { ...process.env, npm_config_offline: 'true', npm_config_update_notifier: 'false' } });

/** What the page shows for the current selection. */
async function generated(page: Page) {
  return {
    command: (await page.locator('[data-output="2 · Build"] code').textContent())!,
    script: (await page.locator('[data-output="build-reactive-css.mjs"] code').textContent())!,
    html: (await page.locator('[data-output="3 · Load it"] code').textContent())!,
    included: (await page.locator('[data-included]').textContent())!.split(' · '),
    demos: await page.locator('[data-summary] a[href^="/examples/"]').allTextContents(),
  };
}

/** Opens a page at ORIGIN whose head is the generated snippet, serving the built file and the CSS. */
async function openWith(page: Page, bundle: string, snippet: string, css: string, body: string) {
  const src = /src="([^"]+)"/.exec(snippet)![1]!;
  await page.route(`${ORIGIN}${src}`, (r) => r.fulfill({ contentType: 'text/javascript', body: bundle }));
  await page.route(`${ORIGIN}/style.css`, (r) => r.fulfill({ contentType: 'text/css', body: css }));
  await page.route(`${ORIGIN}/`, (r) => r.fulfill({ contentType: 'text/html', headers: { 'content-security-policy': CSP },
    body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="stylesheet" href="/style.css">${snippet}</head><body>${body}</body></html>` }));
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => (window as any).ReactiveCSS?.stats().sheets >= 1);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return errors;
}
const demo = (name: string) => {
  const html = readFileSync(join(LIB, `examples/${name}/index.html`), 'utf8');
  return { css: readFileSync(join(LIB, `examples/${name}/style.css`), 'utf8'), body: /<body>([\s\S]*)<\/body>/.exec(html)![1]! };
};

const CASES: { name: string; select: (page: Page) => Promise<void>; check: (page: Page, g: Awaited<ReturnType<typeof generated>>) => Promise<{ css: string; body: string; verify: (page: Page) => Promise<void> }> }[] = [
  {
    name: 'profile "basic"',
    select: (page) => page.getByRole('button', { name: /^Basic interactions/ }).click(),
    check: async () => ({
      css: '.c { --n: state(0) } .c b:on(click) { --n: increment(1) } .c i { width: calc(var(--n) * 10px); display: block; height: 1px }',
      body: '<div class="c"><b>+</b><i></i></div>',
      verify: async (page) => { await page.click('.c b'); await page.click('.c b'); await expect.poll(() => page.$eval('.c i', (e) => getComputedStyle(e).width)).toBe('20px'); },
    }),
  },
  {
    name: 'focus + text (events added; focus: var() needs no conditions)',
    select: async (page) => { await page.getByRole('checkbox', { name: /^Declarative focus/ }).check(); await page.getByRole('checkbox', { name: /^DOM text/ }).check(); },
    check: async (_, g) => {
      expect(g.included).toEqual(['core', 'events', 'text', 'focus']);
      return {
        css: '.c { --n: state(0); --open: state(false) } .c b:on(click) { --n: increment(1); --open: set(true) } .c output { content: var(--n) } .c h2 { focus: var(--open) }',
        body: '<div class="c"><b>+</b><output>x</output><h2 tabindex="-1">h</h2></div>',
        verify: async (page) => {
          await page.click('.c b');
          await expect(page.locator('.c output')).toHaveText('1');
          await expect(page.locator('.c h2')).toBeFocused();
        },
      };
    },
  },
  {
    name: 'analyzer: focus: when() adds conditions',
    select: async (page) => {
      await page.getByLabel(/Paste every stylesheet/).fill('.c { --open: state(false) } .c b:on(click) { --open: set(true) } .c h2 { focus: when(--open) }');
      await page.getByRole('button', { name: 'Analyze' }).click();
      await page.getByRole('button', { name: 'Use these features' }).click();
    },
    check: async (_, g) => {
      expect(g.included).toEqual(['core', 'events', 'conditions', 'focus']);
      return {
        css: '.c { --open: state(false) } .c b:on(click) { --open: set(true) } .c h2 { focus: when(--open) }',
        body: '<div class="c"><b>open</b><h2 tabindex="-1">h</h2></div>',
        verify: async (page) => { await page.click('.c b'); await expect(page.locator('.c h2')).toBeFocused(); expect(await diagnostics(page)).toBe(''); },
      };
    },
  },
  {
    name: 'nothing selected (core alone)',
    select: async () => {},
    check: async (_, g) => {
      expect(g.command).toContain('--features core');
      return {
        css: '.c { --n: state(3) } .c i { width: calc(var(--n) * 1px); display: block; height: 1px } .c b:on(click) { --n: increment(1) }',
        body: '<div class="c"><i></i><b>b</b></div>',
        verify: async (page) => {
          expect(await page.$eval('.c i', (e) => getComputedStyle(e).width)).toBe('3px');
          // :on() is not in this bundle: reported, not silently dropped.
          expect(await diagnostics(page)).toContain(':on() is not included in this bundle (feature "events")');
        },
      };
    },
  },
  {
    name: 'analyzer on the accessible-tabs demo',
    select: async (page) => {
      await page.getByLabel(/Paste every stylesheet/).fill(demo('accessible-tabs').css);
      await page.getByRole('button', { name: 'Analyze' }).click();
      await page.getByRole('button', { name: 'Use these features' }).click();
    },
    check: async (_, g) => {
      expect(g.demos).toContain('accessible-tabs');
      return {
        ...demo('accessible-tabs'),
        verify: async (page) => {
          await page.click('#t-security');
          await expect(page.locator('#t-security')).toHaveAttribute('aria-selected', 'true');
          await expect(page.locator('#t-profile')).toHaveAttribute('aria-selected', 'false');
        },
      };
    },
  },
  {
    name: 'profile "forms" (bind(value), content, --attr-*; conditions excluded and reported)',
    select: (page) => page.getByRole('button', { name: /^Forms/ }).click(),
    check: async (_, g) => {
      expect(g.included).toEqual(['core', 'events', 'forms', 'text', 'attributes']);
      return {
        css: '.f { --name: state("") } .f input { --v: state("", bind(value)); --attr-data-v: var(--v) } .f input:on(input) { --name: set(event(value)) } .f output { content: var(--name) } .f button { --attr-data-name: var(--name) } .f:when(--name == "x") i { display: block }',
        body: '<form class="f"><input name="n" aria-label="n"><output>-</output><button type="button">b</button><i hidden></i></form>',
        verify: async (page) => {
          await page.fill('.f input', 'Ada');
          await expect(page.locator('.f output')).toHaveText('Ada');
          await expect(page.locator('.f button')).toHaveAttribute('data-name', 'Ada');
          await expect(page.locator('.f input')).toHaveAttribute('data-v', 'Ada');
          expect(await diagnostics(page)).toContain('feature "conditions"');
        },
      };
    },
  },
  {
    name: 'profile "stateful-ui" (history, focus; forms optional and not bundled, legacy bind: reported)',
    select: (page) => page.getByRole('button', { name: /^Stateful interfaces/ }).click(),
    check: async (_, g) => {
      expect(g.included).toEqual(['core', 'events', 'conditions', 'history', 'attributes', 'focus']);
      return {
        css: '.s { --n: state(0); --was: previous(--n) } .s b:on(click) { --n: increment(1) } .s:when(--n > 0) i { display: block; width: calc(var(--was) * 1px + 1px); height: 1px } .s input { bind: --n }',
        body: '<div class="s"><b>+</b><i hidden></i><input aria-label="n"></div>',
        verify: async (page) => {
          await page.click('.s b'); await page.click('.s b');
          await expect.poll(() => page.$eval('.s i', (e) => getComputedStyle(e).width)).toBe('2px');
          expect(await page.evaluate(() => (window as any).ReactiveCSS.describe().bundle)).not.toContain('forms');
          expect(await diagnostics(page)).toContain('feature "forms"');
        },
      };
    },
  },
  {
    name: 'profile "dynamic" (values, dynamic, geometry; events excluded)',
    select: (page) => page.getByRole('button', { name: /^Dynamic values/ }).click(),
    check: async (_, g) => {
      expect(g.included).toEqual(['core', 'values', 'dynamic', 'geometry']);
      return {
        css: '.d { --w: viewport(width); --r: random(1, 9, by 1); --e: element(width) } .d i { display: block; height: 1px; width: var(--w) } .d u { display: block; height: 1px; width: calc(var(--r) * 1px) }',
        body: '<div class="d"><i></i><u></u></div>',
        verify: async (page) => {
          // viewport(width) compiles to native 100dvw: a length, used as one.
          await expect.poll(() => page.$eval('.d i', (e) => getComputedStyle(e).width)).toBe(`${page.viewportSize()!.width}px`);
          const r = parseFloat(await page.$eval('.d u', (e) => getComputedStyle(e).width));
          expect(r).toBeGreaterThanOrEqual(1); expect(r).toBeLessThanOrEqual(9);
        },
      };
    },
  },
  {
    name: 'profile "full" (every feature)',
    select: (page) => page.getByRole('button', { name: /^Full runtime/ }).click(),
    check: async (_, g) => {
      expect(g.included).toHaveLength(FEATURES);
      expect(g.command).toContain('--profile full');
      return { ...demo('focus-transitions'), verify: async (page) => { expect(await page.evaluate(() => (window as any).ReactiveCSS.diagnostics)).toEqual([]); } };
    },
  },
];

for (const c of CASES) {
  test(`generated build for ${c.name} works with the real CLI and API`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/bundle-builder/');
    await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
    await c.select(page);
    await page.getByText('The same build through the API (Node script)').click();
    const g = await generated(page);
    const { css, body, verify } = await c.check(page, g);
    const dir = scratchProject();

    // The CLI, exactly as generated.
    const stdout = run(g.command, dir);
    expect(stdout).toContain(`Features: ${g.included.join(', ')}`);
    const manifest = JSON.parse(readFileSync(join(dir, 'public/reactive-css.min.manifest.json'), 'utf8'));
    expect(manifest.features).toEqual(g.included);
    const bundle = readFileSync(join(dir, 'public/reactive-css.min.js'), 'utf8');

    // The API script, exactly as generated: the same bytes (builds are deterministic).
    writeFileSync(join(dir, 'build-reactive-css.mjs'), g.script);
    run('node build-reactive-css.mjs', dir);
    expect(readFileSync(join(dir, 'public/reactive-css.min.js'), 'utf8')).toBe(bundle);

    // The bundle, loaded with the generated snippet.
    const errors = await openWith(page, bundle, g.html, css, body);
    expect(await page.evaluate(() => (window as any).ReactiveCSS.describe().bundle)).toEqual(g.included);
    await verify(page);
    expect(errors).toEqual([]);
  });
}

// Custom Bundles guide: every command it shows with an output is run in a scratch project, with
// the stylesheets the guide shows as input, and must print exactly that output.
const GUIDE = readFileSync(new URL('../../src/content/docs/custom-bundles.mdx', import.meta.url), 'utf8');
const BLOCKS = [...GUIDE.matchAll(/```(\w+) ([^\n]+)\n([\s\S]*?)\n```/g)].map(([, lang, label, code]) => ({ lang: lang!, label: label!, code: code! }));
const exec = (cmd: string, cwd: string) => {
  const r = spawnSync(cmd, { cwd, shell: true, encoding: 'utf8', env: { ...process.env, npm_config_offline: 'true', npm_config_update_notifier: 'false' } });
  // The CLI names files by absolute (real) path; the guide shows them as …/name.
  return { status: r.status, out: (r.stdout + r.stderr).split(realpathSync(cwd) + '/').join('…/').split(cwd + '/').join('…/').trim() };
};

test('every command the Custom Bundles guide shows prints the output it shows', () => {
  const dir = scratchProject();
  mkdirSync(join(dir, 'public'));
  for (const b of BLOCKS.filter((x) => x.lang === 'css' && !x.label.includes(' '))) {
    mkdirSync(join(dir, b.label, '..'), { recursive: true });
    writeFileSync(join(dir, b.label), b.code + '\n');
  }
  const pairs = BLOCKS.flatMap((b, i) =>
    b.lang === 'txt' && b.label.startsWith('npx reactive-css ') ? [{ cmd: b.label, shown: b.code }]
    : b.lang === 'sh' && BLOCKS[i + 1]?.label === 'output' ? [{ cmd: b.code, shown: BLOCKS[i + 1]!.code }] : []);
  expect(pairs.length).toBeGreaterThanOrEqual(6);
  for (const { cmd, shown } of pairs) expect(exec(cmd, dir).out, cmd).toBe(shown.trim());
  // Every other command it shows runs too.
  for (const b of BLOCKS.filter((x) => x.lang === 'sh' && x.code.startsWith('npx reactive-css'))) expect(exec(b.code, dir).status, b.code).toBe(0);
  // The manifest it shows is what that build wrote (it leaves out two long lists).
  const shownManifest = JSON.parse(BLOCKS.find((b) => b.label === 'reactive-css.min.manifest.json')!.code);
  exec('npx reactive-css build --features events,conditions,focus --out public/reactive-css.min.js', dir);
  const manifest = JSON.parse(readFileSync(join(dir, 'public/reactive-css.min.manifest.json'), 'utf8'));
  expect({ ...manifest, provides: undefined, modules: undefined }).toEqual({ ...shownManifest, provides: undefined, modules: undefined });
  // The Node API script it shows writes the same bytes as the CLI.
  const cli = readFileSync(join(dir, 'public/reactive-css.min.js'));
  writeFileSync(join(dir, 'build-reactive-css.mjs'), BLOCKS.find((b) => b.label === 'build-reactive-css.mjs')!.code);
  expect(exec('node build-reactive-css.mjs', dir).status).toBe(0);
  expect(readFileSync(join(dir, 'public/reactive-css.min.js')).equals(cli)).toBe(true);
});

test('the missing-feature diagnostic the guide shows is what the bundle reports', async ({ page }) => {
  const dir = scratchProject();
  exec('npx reactive-css build --features events,conditions,focus --out public/reactive-css.min.js', dir);
  const bundle = readFileSync(join(dir, 'public/reactive-css.min.js'), 'utf8');
  await page.route(`${ORIGIN}/**`, (r) => r.request().url().endsWith('.js')
    ? r.fulfill({ contentType: 'text/javascript', body: bundle })
    : r.fulfill({ contentType: 'text/html', body: '<style>.count { --n: state(0); } .count output { content: var(--n); }</style><div class="count"><output>0</output></div><script src="/reactive-css.min.js"></script>' }));
  await page.goto(`${ORIGIN}/`);
  const shown = BLOCKS.find((b) => b.label === 'ReactiveCSS.diagnostics')!.code;
  await expect.poll(() => page.evaluate(() => (window as any).ReactiveCSS?.diagnostics ?? [])).toEqual([shown]);
});

test('ES module + development build: the generated command writes an unminified ES module that the import snippet starts', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/bundle-builder/');
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
  await page.getByRole('checkbox', { name: /^Events & actions/ }).check();
  await page.getByRole('radio', { name: 'ES module' }).click();
  await page.getByRole('checkbox', { name: 'Development build' }).check();
  const command = (await page.locator('[data-output="2 · Build"] code').textContent())!;
  const snippet = (await page.locator('[data-output="3 · Import it"] code').textContent())!;
  expect(command).toContain('--format esm'); expect(command).toContain('--no-minify');
  const out = / --out (\S+)/.exec(command)![1]!;
  expect(out).not.toMatch(/\.min\.js$/); // an unminified file is not named .min.js
  const dir = scratchProject();
  run(command, dir);
  const code = readFileSync(join(dir, out), 'utf8');
  expect(code).toMatch(/^export \{/m);
  expect(code.split('\n').length).toBeGreaterThan(500); // not minified
  const src = /from '([^']+)'/.exec(snippet)![1]!;
  await page.route(`${ORIGIN}${src.replace(/^\./, '')}`, (r) => r.fulfill({ contentType: 'text/javascript', body: code }));
  await page.route(`${ORIGIN}/`, (r) => r.fulfill({ contentType: 'text/html', body: `<!doctype html><style>.c{--n:state(0)} .c b{on:click(increment(--n))} .c i{display:block;height:1px;width:calc(var(--n)*5px)}</style><div class="c"><b>+</b><i></i></div><script type="module">${snippet.replace(/^\/\/.*\n/, '')}</script>` }));
  await page.goto(`${ORIGIN}/`);
  await page.click('.c b');
  await expect.poll(() => page.$eval('.c i', (e) => getComputedStyle(e).width)).toBe('5px');
});

test('output path: rejected paths keep the last valid command; a nested relative path builds there', async ({ page }) => {
  await page.goto('/bundle-builder/');
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
  const field = page.getByLabel('Output file');
  const command = () => page.locator('[data-output="2 · Build"] code').textContent();
  for (const bad of ['my bundle.js', '/var/www/rcss.js', '../outside.js', 'public/rcss.css', 'a;rm -rf x.js']) {
    await field.fill(bad);
    await expect(page.getByRole('alert')).toContainText('Use a relative path ending in .js');
    expect(await command()).toContain('--out public/reactive-css.min.js');
  }
  await field.fill('assets/js/rcss.min.js');
  await expect(page.getByRole('alert')).toHaveCount(0);
  const cmd = (await command())!;
  expect(cmd).toContain('--out assets/js/rcss.min.js');
  const dir = scratchProject();
  run(cmd, dir);
  expect(readFileSync(join(dir, 'assets/js/rcss.min.js'), 'utf8').length).toBeGreaterThan(30_000);
});

// Every demo the builder may list as compatible: built with exactly its listed features, it runs
// without a missing-feature diagnostic. Its page must exist on the site.
const bundles = JSON.parse(readFileSync(new URL('../../src/generated/bundles.json', import.meta.url), 'utf8'));
test('every demo the builder lists runs with a bundle of only its listed features, and links to a real page', async ({ page, request }) => {
  test.setTimeout(240_000);
  const { DEMO_ORDER } = await import('../../src/lib/content/demo-order');
  const listed = bundles.demos.filter((d: { complete: boolean; name: string }) => d.complete && (DEMO_ORDER as readonly string[]).includes(d.name));
  expect(listed.length).toBe(DEMO_ORDER.length);
  const dir = scratchProject();
  for (const d of listed as { name: string; features: string[] }[]) {
    expect((await request.get(`/examples/${d.name}/`)).status(), d.name).toBe(200);
    const features = d.features.filter((f) => f !== 'core');
    run(`npx reactive-css build --features ${features.join(',') || 'core'} --out public/${d.name}.js`, dir);
    const p = await page.context().newPage();
    const { css, body } = demo(d.name);
    const errors = await openWith(p, readFileSync(join(dir, `public/${d.name}.js`), 'utf8'), `<script src="/${d.name}.js" defer></script>`, css, body);
    const missing = (await p.evaluate(() => (window as any).ReactiveCSS.diagnostics as string[])).filter((m) => /is not included in this bundle/.test(m));
    expect(missing, d.name).toEqual([]);
    // This harness serves pages under a strict CSP (style-src 'self'); a demo's inline style attribute is refused by it, not by the runtime.
    expect(errors.filter((e) => !/Refused to apply a stylesheet .*style-src/.test(e)), d.name).toEqual([]);
    await p.close();
  }
});
