// 0.9.0 hardening: representative custom bundles. Omitted features must be physically absent
// (code, not a runtime switch); automatic analysis must pick the same minimal set as the explicit
// selection; ESM bundles must export the public API. Sizes: benchmarks/v090/matrix.mjs.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error: plain ESM tooling, no type declarations
import { build, analyze } from '../../tools/bundle.mjs';

/** A string that only the feature's own modules contain, in minified output. */
const MARKERS: Record<string, RegExp> = {
  events: /composedPath/,
  gestures: /setPointerCapture|lostpointercapture/,
  persist: /localStorage|sessionStorage/,
  forms: /compositionend|data-rcss-just-checked/,
  text: /createTextNode/,
  attributes: /formAssociated|whenDefined/,
  focus: /checkVisibility/,
  blur: /data-rcss-blur/,
  conditions: /and not style\(/,
  dynamic: /IntersectionObserver/,
  geometry: /ResizeObserver/,
  values: /random\(0px, 1000000px\)/,
};

export const CONFIGS: { name: string; features: string[]; css: string }[] = [
  { name: 'minimal state', features: [], css: '.a { --n: state(0) } .a b { width: calc(var(--n) * 1px) }' },
  { name: 'counter', features: ['events', 'text'], css: '.c { --n: state(0) } .c b:on(click) { --n: increment(1) } .c s { content: var(--n) }' },
  { name: 'forms', features: ['events', 'forms'], css: 'input { --q: state("", bind(value)) } form { --s: state(0) } form:on(submit, prevent()) { --s: increment(1) }' },
  { name: 'focus', features: ['events', 'focus', 'conditions'], css: '.d { --o: state(false) } .d input { focus: when(--o) } .d b:on(click) { --o: toggle() }' },
  { name: 'persistence', features: ['persist'], css: '.t { --dark: state(false, persist("t")) }' },
  { name: 'drag', features: ['events', 'gestures'], css: '.k { --x: state(0px) } .k:on(drag) { --x: set(event(x)) }' },
  { name: 'sensors', features: ['dynamic', 'geometry'], css: '.s { --mx: mouse(x); --w: element(width); opacity: visible(0.5) }' },
];

describe('representative custom bundles', () => {
  for (const c of CONFIGS) {
    it(`${c.name}: exactly its features, the others physically absent`, async () => {
      const r = await build({ features: c.features, minify: true });
      expect(r.ok).toBe(true);
      const want = new Set(['core', ...c.features]);
      expect(new Set(r.manifest.features)).toEqual(want);
      for (const [f, re] of Object.entries(MARKERS)) expect(re.test(r.code), `${c.name}: ${f} ${want.has(f) ? 'present' : 'absent'}`).toBe(want.has(f));
    });
    it(`${c.name}: analyzing its CSS selects the same features`, async () => {
      const dir = mkdtempSync(join(tmpdir(), 'rcss-matrix-'));
      writeFileSync(join(dir, 'a.css'), c.css);
      const a = await analyze([join(dir, 'a.css')]);
      expect(a.features.sort()).toEqual(['core', ...c.features].sort());
    });
  }
  it('ESM bundles export the public API; production bundles carry codes, development ones text', async () => {
    const esm = await build({ features: ['events'], format: 'esm', minify: false });
    for (const name of ['start', 'stop', 'refresh', 'stats', 'compile', 'describe', 'diagnostics', 'defineFunction', 'version'])
      expect(esm.code, name).toMatch(new RegExp(`\\b${name}\\b`));
    expect(esm.code).toMatch(/is not included in this bundle/);
    const prod = await build({ features: ['events'], minify: true });
    expect(prod.code).not.toMatch(/is not included in this bundle/);
    expect(prod.code).toMatch(/RCSS-P\d{3}/);
  });
});
