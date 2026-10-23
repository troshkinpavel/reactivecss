// The ESM build and its type declarations, as a consumer sees them (run after `npm run build`).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('dist/index.js', () => {
  it('imports in Node without a DOM and exposes the API', async () => {
    const m = await import('../../dist/index.js');
    for (const k of ['start', 'stop', 'refresh', 'stats', 'compile', 'diagnostics', 'describe', 'defineFunction', 'defineSelector', 'defineAction', 'FEATURES', 'version'])
      expect(m).toHaveProperty(k);
    expect(m.version).toBe(JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version);
    expect(m.compile('.a { width: pick(1px) }').css).toMatch(/var\(--rcss-/);
    expect(m.describe().functions.map((f: { name: string }) => f.name)).toEqual(expect.arrayContaining(['random', 'pick', 'live', 'when', 'previous']));
  });

  it('dist/features.json is the same metadata as describe(), for tools that do not run the library', async () => {
    const m = await import('../../dist/index.js');
    const { readFileSync } = await import('node:fs');
    expect(JSON.parse(readFileSync(new URL('../../dist/features.json', import.meta.url), 'utf8'))).toEqual(JSON.parse(JSON.stringify(m.describe())));
  });

  it('dist/catalog.json is the bundle builder catalog, and describe().bundle lists every feature', async () => {
    const m = await import('../../dist/index.js');
    const { readFileSync } = await import('node:fs');
    // @ts-expect-error: plain ESM tooling
    const { catalog } = await import('../../tools/bundle.mjs');
    const json = JSON.parse(readFileSync(new URL('../../dist/catalog.json', import.meta.url), 'utf8'));
    expect(json).toEqual(JSON.parse(JSON.stringify(catalog())));
    expect(m.describe().bundle).toEqual(json.features.map((f: { id: string }) => f.id));
  });
});
