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
// Every selection of up to three features, their complements, and a seeded sample of the rest: all
// 2^n selections became too many to compare (2^20 with the 0.10 features).
const upTo3 = (from = 0, left = 3): string[][] => [[], ...(left ? optional.slice(from).flatMap((id, i) => upTo3(from + i + 1, left - 1).map((s) => [id, ...s])) : [])];
const complement = (s: string[]) => optional.filter((id) => !s.includes(id));
const minstd = (seed = 1) => () => (seed = (seed * 48271) % 2147483647);
const seeded = (n: number, next = minstd()) => Array.from({ length: n }, () => optional.filter(() => next() / 2147483647 < 0.5));
const small = upTo3();
const large = small.map(complement);
const sample = seeded(2000);
const subsets = [...small, ...large, ...sample];
const byId = new Map(CATALOG.map((f) => [f.id, f]));
/** The feature and everything it needs, directly or not. */
const closure = (id: string, seen = new Set<string>()): Set<string> => { if (!seen.has(id)) { seen.add(id); byId.get(id)!.requires.forEach((r) => closure(r, seen)); } return seen; };
const strip = (r: { features: string[]; added: unknown[]; optionalMissing: unknown[] }) => ({ features: r.features, added: r.added, optionalMissing: r.optionalMissing });

describe('resolver = the library resolver', () => {
  it(`${subsets.length} selections`, () => {
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

describe('the selections cover what they claim', () => {
  const n = optional.length, key = (s: string[]) => [...s].sort().join();
  it('every selection of up to three features, once', () => {
    expect(small).toHaveLength(1 + n + (n * (n - 1)) / 2 + (n * (n - 1) * (n - 2)) / 6);
    expect(new Set(small.map(key)).size).toBe(small.length);
    expect(Math.max(...small.map((s) => s.length))).toBe(3);
  });
  it('the complement of each, once', () => {
    expect(new Set(large.map(key)).size).toBe(small.length);
    expect(Math.min(...large.map((s) => s.length))).toBe(n - 3);
    expect(large[0]).toEqual(optional); // the complement of nothing: every feature
  });
  it('the random sample is reproducible', () => {
    const next = minstd();
    expect([next(), next(), next()]).toEqual([48271, 182605794, 1291394886]); // MINSTD from seed 1
    expect(seeded(2000)).toEqual(sample);
    expect(seeded(2000, minstd(2))).not.toEqual(sample);
  });
  it('the random sample reaches sizes the other two do not, with every feature in and out', () => {
    expect(sample.filter((s) => s.length > 3 && s.length < n - 3).length).toBeGreaterThan(1900);
    expect(new Set(sample.map(key)).size).toBeGreaterThan(1900);
    for (const id of optional) {
      expect(sample.some((s) => s.includes(id)), id).toBe(true);
      expect(sample.some((s) => !s.includes(id)), id).toBe(true);
    }
  });
});

describe('dependency closure', () => {
  it(`${subsets.length} selections: all requirements in, nothing else, in catalog order`, () => {
    const order = CATALOG.map((f) => f.id);
    for (const s of subsets) {
      const { features, added } = resolve({ features: s });
      expect(features, s.join()).toEqual(order.filter((id) => id === 'core' || s.some((x) => closure(x).has(id))));
      expect(added.map((a) => a.id).sort(), s.join()).toEqual(features.filter((id) => id !== 'core' && !s.includes(id)).sort());
      for (const a of added) expect(byId.get(a.requiredBy)!.requires, s.join()).toContain(a.id);
    }
  });
  it('the requirements of each 0.10 feature, and who added them', () => {
    const r = (f: string) => { const x = resolve({ features: [f] }); return [x.features, x.added]; };
    expect(r('strings')).toEqual([['core', 'strings'], []]);
    expect(r('format')).toEqual([['core', 'format'], []]);
    expect(r('datetime')).toEqual([['core', 'format', 'datetime'], [{ id: 'format', requiredBy: 'datetime' }]]);
    expect(r('derived')).toEqual([['core', 'strings', 'derived'], [{ id: 'strings', requiredBy: 'derived' }]]);
    expect(r('event-timing')).toEqual([['core', 'events', 'event-timing'], [{ id: 'events', requiredBy: 'event-timing' }]]);
    expect(r('timers')).toEqual([['core', 'events', 'timers'], [{ id: 'events', requiredBy: 'timers' }]]);
  });
});

describe('invalid combinations', () => {
  const errors = (r: { errors: { code: string; feature?: string }[] }) => r.errors.map((e) => [e.code, e.feature]);
  for (const features of [['evnts'], ['Events'], ['events', 'nope'], ['nope', 'nada'], ['datetime', 'date-time'], ['derived', 'computed']]) {
    it(`[${features}]: same errors as the CLI, and only the known features selected`, () => {
      const mine = resolve({ features }), lib = tools.resolve({ features });
      expect(errors(mine)).toEqual(errors(lib));
      expect(mine.errors.length).toBeGreaterThan(0);
      expect(mine.features).toEqual(lib.features);
    });
  }
  it('an unknown profile', () => {
    expect(errors(resolve({ profile: 'nope', features: ['events'] }))).toEqual(errors(tools.resolve({ profile: 'nope', features: ['events'] })));
  });
  it('a profile with more features', () => {
    for (const p of Object.keys(PROFILES)) expect(strip(resolve({ profile: p, features: ['derived'] })), p).toEqual(strip(tools.resolve({ profile: p, features: ['derived'] })));
  });
});

describe('feature exclusion', () => {
  const needs = (f: string) => optional.filter((id) => closure(id).has(f));
  for (const f of optional) {
    it(`${f}: left out with everything that needs it, kept by anything that needs it`, () => {
      const rest = optional.filter((id) => !needs(f).includes(id));
      for (const r of [resolve({ features: rest }), tools.resolve({ features: rest })]) {
        expect(r.errors).toEqual([]);
        expect(r.features).not.toContain(f);
        expect(r.features).toEqual(['core', ...rest].sort((a, b) => CATALOG.findIndex((x) => x.id === a) - CATALOG.findIndex((x) => x.id === b)));
      }
      for (const dependent of needs(f)) expect(resolve({ features: [dependent] }).features, dependent).toContain(f);
    });
  }
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
