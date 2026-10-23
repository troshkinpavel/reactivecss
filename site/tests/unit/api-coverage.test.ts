// API coverage: the library's own registry (describe()) and bundle catalog are canonical. Every
// shipped feature must be documented, belong to a catalog feature, have compiling examples, and be
// findable by name. `npm run api-coverage` also writes the matrix to docs/api-coverage.json.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { afterAll, describe, expect, it, vi } from 'vitest';
import registry from '~/generated/registry.json';
import bundles from '~/generated/bundles.json';
import { API, entryStatus } from '~/lib/content/reference';
import { DEMOS } from '~/lib/content/demos';
import { highlightCss } from '~/lib/code/css';

const lib = new URL('../../../', import.meta.url);
const { compile } = await import(new URL('dist/index.js', lib).href);
const catalog = JSON.parse(readFileSync(new URL('dist/catalog.json', lib), 'utf8')) as { version: string; features: { id: string; status: string; provides: string[] }[] };
const read = (u: URL) => readFileSync(u, 'utf8');
const docs = new URL('../../src/content/docs/', import.meta.url);
const doc = (name: string) => read(new URL(name, docs));

type Feature = (typeof registry.features)[number] & { examples?: string[] };
const key = (f: Feature) => `${f.kind}:${f.name}`;
const shipped = (registry.features as Feature[]).filter((f) => f.status === 'stable' || f.status === 'experimental');

/** The catalog feature that provides a registry feature, as the library's own keyOfApiEntry() and featureOfKey() map it (synced into bundles.json). */
const catalogOf = (f: Feature) => (bundles.apiFeature as Record<string, string | null>)[key(f)] ?? undefined;

/** Compiles and returns the diagnostics. */
const diagnose = (css: string) => {
  const w: string[] = [];
  const spy = vi.spyOn(console, 'warn').mockImplementation((...a) => { w.push(a.join(' ')); });
  try { compile(css); } finally { spy.mockRestore(); }
  return w;
};

/** Features used by stylesheets that the site's browser tests run: every published library demo, and the site examples the e2e specs open. */
const featuresIn = (css: string) => new Set<string>(highlightCss(css).flat().flatMap((t) => (t.k === 'rx' && t.feature ? [t.feature] : [])));
const e2e = readdirSync(new URL('../e2e/', import.meta.url)).filter((f) => f.endsWith('.ts')).map((f) => read(new URL(`../e2e/${f}`, import.meta.url))).join('\n');
const examplesDir = new URL('../../src/examples/', import.meta.url);
const openedExamples = readdirSync(examplesDir).filter((id) => !id.includes('.') && id !== '_shared' && new RegExp(`['"/]${id}['"/]`).test(e2e));
const browserSources = [
  ...DEMOS.map((d) => ({ where: `demo ${d.id}`, used: featuresIn(d.files.css) })),
  ...openedExamples.map((id) => ({ where: `example ${id}`, used: featuresIn(read(new URL(`${id}/style.css`, examplesDir))) })),
];

const rows = shipped.map((f) => {
  const entry = API.find((e) => (e.features as string[]).includes(key(f)));
  const text = entry ? [entry.name, entry.summary, entry.signature, ...entry.params.map((p) => p.name)].join(' ') : '';
  const ex = entry?.example;
  const exampleCss = !ex ? '' : 'code' in ex ? ex.code : read(new URL(`${ex.id}/style.css`, examplesDir));
  return {
    feature: key(f), status: f.status, since: f.since ?? null,
    catalog: catalogOf(f) ?? null,
    registered: true,
    documented: entry ? `/docs/reference/${entry.id}/` : null,
    statusOnPage: entry ? (entryStatus(entry).experimental ? 'experimental' : 'stable') : null,
    // The page may show a registry-experimental feature as stable only through an explicit, documented
    // `readiness: "stable"` (the 0.9.0 release recommendation); never the other way round.
    expectedOnPage: f.status === 'experimental' && entry?.readiness === 'stable' ? 'stable' : f.status,
    nameOnPage: !!entry && text.includes(f.name),
    registryExamplesCompile: (f.examples ?? []).every((x) => diagnose(x).length === 0),
    pageExampleCompiles: !!exampleCss && diagnose(exampleCss).length === 0,
    browserCoverage: browserSources.filter((s) => s.used.has(key(f))).map((s) => s.where),
  };
});

describe('API coverage against the registry and the bundle catalog', () => {
  it('registry, catalog and site agree on the version', () => expect(catalog.version).toBe(registry.version));
  it('the Custom bundles page lists the catalog the site synced, which is the library\'s', async () => {
    const { CATALOG } = await import('~/lib/bundles/catalog');
    expect(CATALOG.map((c: { id: string }) => c.id)).toEqual(catalog.features.map((c) => c.id));
    expect(doc('custom-bundles.mdx')).toContain('<Bundles part="catalog" />');
  });
  for (const r of rows) {
    it(r.feature, () => {
      expect(r.documented, 'no reference entry').toBeTruthy();
      expect(r.catalog, 'no bundle catalog feature provides it').toBeTruthy();
      expect(r.statusOnPage, 'status label differs from the registry (and its readiness override)').toBe(r.expectedOnPage);
      expect(r.nameOnPage, 'its name is not on its reference page').toBe(true);
      expect(r.registryExamplesCompile, "describe()'s own examples do not compile").toBe(true);
      expect(r.pageExampleCompiles, 'the reference example does not compile').toBe(true);
    });
  }
  it('documents the JavaScript API, configuration and CLI', () => {
    const install = doc('installation.mdx'), bundles = doc('custom-bundles.mdx');
    for (const name of ['start()', 'stop()', 'refresh()', 'stats()', 'diagnostics', 'describe()', 'compile(', 'version', 'defineFunction', 'trustInlineStyles', 'native']) expect(install, name).toContain(name);
    for (const cmd of ['features', 'resolve', 'build', 'analyze']) expect(bundles, cmd).toContain(`\`${cmd}\``);
    for (const exp of ['@reactivecss/core/bundle', '@reactivecss/core/auto', '@reactivecss/core/catalog.json']) expect(install, exp).toContain(exp);
  });
  it('no removed or unshipped registry feature is presented as available', () => {
    const notShipped = (registry.features as Feature[]).filter((f) => f.status !== 'stable' && f.status !== 'experimental').map(key);
    for (const e of API) for (const k of e.features) if (notShipped.includes(k)) expect(e.removal, e.id).toBeTruthy();
  });
});

afterAll(() => {
  if (!process.env.API_COVERAGE) return;
  const out = {
    version: registry.version, generated: 'tests/unit/api-coverage.test.ts (npm run api-coverage)',
    sources: ['describe() → src/generated/registry.json', 'dist/catalog.json', 'src/content/api/entries.json', 'library demos and e2e-opened site examples'],
    shipped: rows.length, catalog: catalog.features.map((c) => c.id), rows,
  };
  writeFileSync(new URL('../../docs/api-coverage.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
});
