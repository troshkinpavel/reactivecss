// 0.10 optimization: custom bundles include only what they need. The value functions use the
// expression language, not the event runtime; format() does not bring the string functions.
import { describe, it, expect } from 'vitest';
// @ts-expect-error: plain ESM tooling
import { build, resolve, analyze, catalog } from '../../tools/bundle.mjs';

const modules = async (features: string[]) => (await build({ features, minify: false, format: 'esm' })).manifest.modules as string[];
const EVENT_RUNTIME = ['src/state/on.ts', 'src/state/actions.ts'];

describe('dependency boundaries', () => {
  it('requirements', () => {
    expect(resolve({ features: ['strings'] }).features).toEqual(['core', 'strings']);
    expect(resolve({ features: ['format'] }).features).toEqual(['core', 'format']);
    expect(resolve({ features: ['datetime'] }).features).toEqual(['core', 'format', 'datetime']);
    expect(resolve({ features: ['derived'] }).features).toEqual(['core', 'strings', 'derived']);
    expect(resolve({ features: ['timers'] }).features).toEqual(['core', 'events', 'timers']);
  });
  for (const f of ['strings', 'format', 'datetime', 'derived']) it(`${f} carries no event runtime`, async () => {
    const m = await modules([f]);
    for (const x of EVENT_RUNTIME) expect(m).not.toContain(x);
    expect(m).toContain('src/state/actexpr.ts');
  }, 30000);
  it('format carries no string functions and no date patterns', async () => {
    const m = await modules(['format']);
    expect(m).not.toContain('src/functions/strings.ts');
    expect(m).not.toContain('src/functions/dates.ts');
  }, 30000);
  it('events carries no debounce / throttle, timers or value functions', async () => {
    const m = await modules(['events']);
    for (const x of ['src/state/on-timing.ts', 'src/functions/timers.ts', 'src/functions/calls.ts']) expect(m).not.toContain(x);
    expect(resolve({ features: ['event-timing'] }).features).toEqual(['core', 'events', 'event-timing']);
  }, 30000);
  it('the analyzer recommends exactly what a stylesheet uses', async () => {
    const used = async (text: string) => (await analyze([{ path: 'a.css', text }], { assumeComplete: true })).used.sort();
    expect(await used('.a { --q: state("") } .a input:on(input, debounce(300ms)) { --q: set(event(value)) }')).toEqual(['event-timing', 'events']);
    expect(await used('.a { --n: state(0) } .a:on(every(1s)) { --n: increment(1) }')).toEqual(['events', 'timers']);
    expect(await used('.a { --v: state(""); --c: trim(--v) }')).toEqual(['derived', 'strings']);
    expect(await used('.a { --n: state(1) } .a b { text: format(--n, "integer") }')).toEqual(['format', 'text']);
    expect(await used('.a { --t: state(time()) } .a b { text: format(--t, "HH:mm") }')).toEqual(['datetime', 'format', 'text']);
  }, 30000);
  it('core carries none of the 0.10 modules', async () => {
    const m = await modules([]);
    for (const x of ['calls', 'strings', 'format', 'intl', 'dates', 'datetime', 'timers', 'derived']) expect(m).not.toContain(`src/functions/${x}.ts`);
    expect(m).not.toContain('src/state/actexpr.ts');
  }, 30000);
});

describe('feature exclusion', () => {
  const FEATURES = catalog().features as { id: string; requires: string[]; modules: string[] }[];
  const optional = FEATURES.map((f) => f.id).filter((id) => id !== 'core');
  const needing = (f: string): string[] => { const out = FEATURES.filter((x) => x.requires.includes(f)).map((x) => x.id); return [...new Set([...out, ...out.flatMap(needing)])]; };
  const codes = (r: { errors: { code: string; feature?: string }[] }) => r.errors.map((e) => [e.code, e.feature]);

  it('the core cannot be excluded', async () => {
    expect(codes(resolve({ exclude: ['core'] }))).toEqual([['core-required', 'core']]);
    expect((await build({ exclude: ['core'] })).ok).toBe(false);
  });
  it('an unknown exclusion is an error', () => expect(codes(resolve({ exclude: ['evnts'] }))).toEqual([['unknown-feature', 'evnts']]));
  it('a feature both requested and excluded is a conflict', async () => {
    expect(codes(resolve({ features: ['text'], exclude: ['text'] }))).toEqual([['conflict', 'text']]);
    expect((await build({ features: ['text'], exclude: ['text'] })).ok).toBe(false);
  });
  for (const f of optional) for (const d of needing(f)) it(`${d} with ${f} excluded is a conflict that names both`, () => {
    const e = resolve({ features: [d], exclude: [f] }).errors;
    expect(e.map((x: { code: string }) => x.code)).toContain('conflict');
    expect(e.some((x: { message: string }) => x.message.includes(`"${f}"`))).toBe(true);
  });
  for (const f of optional) it(`full without ${f}: its own modules are not in the build`, async () => {
    const left = needing(f).concat(f), keep = optional.filter((id) => !left.includes(id));
    const r = await build({ features: keep, exclude: left, format: 'esm', minify: false });
    expect(r.ok).toBe(true);
    expect(r.manifest.features).not.toContain(f);
    const others = new Set(FEATURES.filter((x) => !left.includes(x.id)).flatMap((x) => x.modules));
    for (const m of FEATURES.find((x) => x.id === f)!.modules) if (!others.has(m)) expect(r.manifest.modules, m).not.toContain(m);
  }, 30000);
  it('a selection without exclusions gives byte-identical output when reordered', async () => {
    const a = await build({ features: ['derived', 'timers', 'text'] }), b = await build({ features: ['text', 'timers', 'derived', 'text'] });
    expect(b.code).toBe(a.code);
  }, 30000);
});
