// The bundle builder page against the library's own builder (../tools/bundle.mjs): the page's
// resolver and analyzer must give the library's answers, the sizes it shows must be what a build
// measures now, and the publication status must follow the release record.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeCss } from '~/lib/bundles/analyzer';
import { CATALOG, COMPACT, PACKAGE, PROFILES, SIZES, STANDARD, featureOfKey, measuredFor, profileOf, resolve } from '~/lib/bundles/catalog';
import { buildArgs, buildCommand, configScript, htmlSnippet, installCommand, outError } from '~/lib/bundles/command';
import registry from '~/generated/registry.json';
import { DISTRIBUTION } from '~/lib/config';

const tools = await import(new URL('../../../tools/bundle.mjs', import.meta.url).href);
const compiler = () => import(new URL('../../../dist/index.js', import.meta.url).href);
const optional = CATALOG.map((f) => f.id).filter((id) => id !== 'core');
const subsets = Array.from({ length: 2 ** optional.length }, (_, m) => optional.filter((_, i) => m & (1 << i)));
const strip = (r: { features: string[]; added: unknown[]; optionalMissing: unknown[] }) => ({ features: r.features, added: r.added, optionalMissing: r.optionalMissing });

describe('resolver = the library resolver', () => {
  it(`every one of the ${subsets.length} possible selections`, () => {
    for (const s of subsets) expect(strip(resolve({ features: s })), s.join()).toEqual(strip(tools.resolve({ features: s })));
  });
  it('selections in any order, with duplicates', () => {
    for (const s of [['focus', 'history'], ['text', 'events', 'text'], ['geometry', 'focus', 'core']]) expect(strip(resolve({ features: s }))).toEqual(strip(tools.resolve({ features: s })));
  });
  it('every profile', () => {
    for (const p of Object.keys(PROFILES)) expect(strip(resolve({ profile: p }))).toEqual(strip(tools.resolve({ profile: p })));
  });
  it('rejects what the CLI rejects, with the same codes', () => {
    expect(resolve({ features: ['evnts'] }).errors.map((e) => e.code)).toEqual(tools.resolve({ features: ['evnts'] }).errors.map((e: { code: string }) => e.code));
    expect(resolve({ profile: 'nope' }).errors.map((e) => e.code)).toEqual(['unknown-profile']);
  });
  it('maps every registry entry and provided key to the same feature', () => {
    const keys = [...CATALOG.flatMap((f) => f.provides), ...registry.features.map((e) => tools.keyOfApiEntry(e)).filter(Boolean), 'trigger:pointerenter', 'act:prevent', 'fn:nope'];
    for (const k of keys) expect(featureOfKey(k), k).toBe(tools.featureOfKey(k));
  });
  it('finds profiles only for exact selections', () => {
    expect(profileOf(['events'])).toBe('basic');
    expect(profileOf(['forms', 'events', 'attributes', 'text'])).toBe('forms');
    expect(profileOf(['events', 'forms'])).toBeUndefined();
    expect(profileOf(PROFILES.full!.filter((f) => f !== 'core'))).toBe('full');
    expect(profileOf([])).toBeUndefined();
  });
});

describe('analyzer = the library analyzer, with the real compiler', () => {
  const demos = new URL('../../../examples/', import.meta.url);
  const sheets = readdirSync(demos, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== 'lab')
    .flatMap((d) => readdirSync(new URL(`${d.name}/`, demos)).filter((f) => f.endsWith('.css')).map((f) => ({ path: `${d.name}/${f}`, text: readFileSync(new URL(`${d.name}/${f}`, demos), 'utf8') })));
  const fixtures = [
    { path: 'nested.css', text: '/* live(1s) :when( */ .x::before { content: "random(1, 2)"; background: element(#native) } @layer a { @media (min-width: 1px) { .y { translate: calc(live(random(0px, 9px), 1s) * 2) 0 } } } .z { --n: state(0); on: key(ArrowDown, prevent(), increment(--n)) } .z:changed(--n) .w { text: previous(--n) }' },
    { path: 'import.css', text: '@import url(other.css); .a { --n: state(0) }' },
    { path: 'focus.css', text: '.a h2 { focus: when(--s == 2) } .a { --s: state(1) }' },
    { path: 'plain.css', text: '.a { color: red }' },
    { path: 'invalid.css', text: '.a { on: click(nope()) }' },
    // Pre-launch audit inputs: CSS nesting, one feature, two pasted sheets, empty, a value set from script.
    { path: 'nesting.css', text: '.card { --open: state(false); & .toggle { on: click(toggle(--open)) } &:when(--open) .body { display: block } @media (width > 600px) { & .body { text: var(--open) } } }' },
    { path: 'one.css', text: '.tabs [role=tab]:nth-var(--t) { font-weight: bold } .tabs { --t: state(1) }' },
    { path: 'two-sheets.css', text: '/* a.css */ .a { --n: state(0); on: click(increment(--n)) }\n/* b.css */ .b input { bind: --q } .b output { text: var(--q) } .b { --q: state("") }' },
    { path: 'empty.css', text: '' },
    { path: 'scripted.css', text: '.a { --x: state(0) } .a i { width: calc(var(--x) * 1px) }' },
  ];
  it('finds stylesheets to compare', () => expect(sheets.length).toBeGreaterThan(15));
  for (const s of [...sheets, ...fixtures]) {
    it(s.path, async () => {
      const mine = await analyzeCss(s.text, compiler);
      const lib = await tools.analyze([s]);
      // One deliberate difference: the library calls an empty stylesheet complete (core only); the
      // page calls an empty paste incomplete, since nothing was analyzed (its Analyze button is disabled then).
      const libComplete = s.text.trim() === '' ? false : lib.complete;
      expect({ used: mine.used, features: mine.resolved.features, added: mine.resolved.added, uses: mine.uses, complete: mine.complete, diagnostics: mine.diagnostics })
        .toEqual({ used: lib.used, features: lib.features, added: lib.added, uses: lib.uses, complete: libComplete, diagnostics: lib.files[0].diagnostics });
    });
  }
});

describe('measured sizes are what a build measures now', () => {
  it('were measured for this version', () => expect(SIZES.version).toBe(PACKAGE.version));
  for (const m of SIZES.measured.filter((x) => x.features)) {
    it(m.name, async () => {
      const r = await tools.build({ features: m.features!.filter((f) => f !== 'core') });
      expect(r.manifest.features).toEqual(m.features);
      expect(r.manifest.sizes).toEqual({ minified: m.minified, gzip: m.gzip, brotli: m.brotli });
    }, 30000);
  }
  it('the standard and compact bundles in ../dist', () => {
    expect(tools.sizes(readFileSync(new URL('../../../dist/reactive-css.min.js', import.meta.url)))).toEqual({ minified: STANDARD.minified, gzip: STANDARD.gzip, brotli: STANDARD.brotli });
    expect(tools.sizes(readFileSync(new URL('../../../dist/reactive-css.compact.min.js', import.meta.url)))).toEqual({ minified: COMPACT.minified, gzip: COMPACT.gzip, brotli: COMPACT.brotli });
  });
  it('are found only for exactly measured feature sets', () => {
    expect(measuredFor(['core'])?.name).toBe('core');
    expect(measuredFor(resolve({ profile: 'basic' }).features)?.name).toBe('basic');
    expect(measuredFor(resolve({ features: ['events', 'text'] }).features)).toBeUndefined();
  });
});

describe('generated commands', () => {
  const c = { selected: [] as string[], out: 'public/reactive-css.min.js', format: 'iife' as const, minify: true };
  it('use --profile for an exact profile, --features otherwise, core when empty', () => {
    expect(buildArgs({ ...c, selected: ['events'] })).toEqual(['build', '--profile', 'basic', '--out', 'public/reactive-css.min.js']);
    expect(buildArgs({ ...c, selected: ['focus', 'text'] })).toEqual(['build', '--features', 'text,focus', '--out', 'public/reactive-css.min.js']);
    expect(buildArgs(c)).toEqual(['build', '--features', 'core', '--out', 'public/reactive-css.min.js']);
    expect(buildArgs({ ...c, selected: ['text'], format: 'esm', minify: false })).toEqual(['build', '--features', 'text', '--out', 'public/reactive-css.min.js', '--format', 'esm', '--no-minify']);
  });
  it('validate the output path', () => {
    for (const ok of ['public/reactive-css.min.js', 'static/js/rcss.js', 'rcss.js']) expect(outError(ok), ok).toBeUndefined();
    for (const bad of ['/etc/x.js', '../x.js', 'a b.js', 'x.css', 'x.js; rm -rf ~', '']) expect(outError(bad), bad).toBeTruthy();
  });
  it('script tag and module import', () => {
    expect(htmlSnippet(c).code).toBe('<script src="/reactive-css.min.js" defer></script>');
    expect(htmlSnippet({ ...c, out: 'static/rcss.js', format: 'esm' }).code).toContain("from './static/rcss.js'");
  });
  it('install from npm only once the version is verified there, otherwise from a pack of the public repository', () => {
    if (PACKAGE.published) expect(installCommand()).toBe(`npm install --save-dev ${PACKAGE.name}@${PACKAGE.version} esbuild`);
    else {
      expect(installCommand()).toContain('git clone https://github.com/troshkinpavel/reactivecss.git && cd reactivecss\nnpm install && npm run build && npm pack');
      expect(installCommand()).not.toMatch(new RegExp(`npm install --save-dev ${PACKAGE.name}@`));
    }
    expect(configScript({ ...c, selected: ['events'] })).toContain(`from '${PACKAGE.name}/bundle'`);
  });
  it('name the scoped package in the npx command: the unscoped npm name reactive-css is another project', () => {
    expect(buildCommand(c)).toBe('npx -p @reactivecss/core -p esbuild reactive-css build --features core --out public/reactive-css.min.js');
  });
});

describe('package metadata', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));
  it('is the library package.json, and the publication status is config/distribution.json', () => {
    expect([PACKAGE.name, PACKAGE.version, PACKAGE.bin]).toEqual([pkg.name, pkg.version, pkg.bin]);
    expect(PACKAGE.published).toBe(DISTRIBUTION.core.npmVersions.includes(pkg.version));
  });
  it('ships the files the docs point to', () => {
    for (const f of ['reactive-css.min.js', 'reactive-css.compact.min.js', 'reactive-css.js', 'index.js', 'catalog.json']) expect(readdirSync(new URL('../../../dist/', import.meta.url))).toContain(f);
    expect(PACKAGE.exports['./bundle']).toBe('./tools/bundle.mjs');
    expect(PACKAGE.jsdelivr).toBe('./dist/reactive-css.min.js');
  });
});
