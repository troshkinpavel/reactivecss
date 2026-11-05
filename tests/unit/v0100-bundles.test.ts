// 0.10 optimization: custom bundles include only what they need. The value functions use the
// expression language, not the event runtime; format() does not bring the string functions.
import { describe, it, expect } from 'vitest';
// @ts-expect-error: plain ESM tooling
import { build, resolve } from '../../tools/bundle.mjs';

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
  it('core carries none of the 0.10 modules', async () => {
    const m = await modules([]);
    for (const x of ['calls', 'strings', 'format', 'intl', 'datetime', 'timers', 'derived']) expect(m).not.toContain(`src/functions/${x}.ts`);
    expect(m).not.toContain('src/state/actexpr.ts');
  }, 30000);
});
