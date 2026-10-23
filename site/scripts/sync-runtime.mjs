// Integration boundary: the site never contains its own copy of the Reactive CSS runtime.
// It copies the library's built browser bundle from ../dist into public/runtime/ so the
// sandboxed preview iframes can load it by URL. Rebuild the library (npm run build in ..)
// to pick up changes.
import { copyFile, mkdir, access } from 'node:fs/promises';
const src = new URL('../../dist/reactive-css.min.js', import.meta.url);
const out = new URL('../public/runtime/', import.meta.url);
try { await access(src); } catch {
  console.error('Reactive CSS bundle not found at ../dist/reactive-css.min.js. Run `npm run build` in the library first.');
  process.exit(1);
}
await mkdir(out, { recursive: true });
await copyFile(src, new URL('reactive-css.min.js', out));
// The compact bundle: the same runtime with a shorter describe() registry (a local copy for the docs' links).
await copyFile(new URL('../../dist/reactive-css.compact.min.js', import.meta.url), new URL('reactive-css.compact.min.js', out));
// The development bundle: the same runtime with full diagnostic messages, for the Playground preview.
await copyFile(new URL('../../dist/reactive-css.js', import.meta.url), new URL('reactive-css.js', out));
console.log('synced runtime → public/runtime/reactive-css.min.js, reactive-css.compact.min.js, reactive-css.js');

// The feature registry is consumed through the library's own describe(), at build time only.
// The snapshot is small JSON, so client code (highlighting, inspectors) never loads the runtime.
const { describe } = await import(new URL('../../dist/index.js', import.meta.url).href);
const { writeFile } = await import('node:fs/promises');
const genDir = new URL('../src/generated/', import.meta.url);
await mkdir(genDir, { recursive: true });
await writeFile(new URL('registry.json', genDir), JSON.stringify(describe(), null, 2) + '\n');
console.log('synced registry → src/generated/registry.json');

// The glossary the browser needs (token explanations in code panels): label, kind, summary and page
// per feature. Pages ship this instead of the whole reference. Same rules as GLOSSARY in
// src/lib/content/reference.ts; tests/unit/glossary.test.ts checks that the two agree.
{
  const { readFile: read } = await import('node:fs/promises');
  const entries = JSON.parse(await read(new URL('../src/content/api/entries.json', import.meta.url), 'utf8'));
  const reg = describe();
  const KIND = { function: 'Function', selector: 'Selector', declaration: 'Declaration', action: 'Action', trigger: 'Trigger', expression: 'Expression', scope: 'Scope', rule: 'Rule' };
  const label = (key) => {
    const [kind, name] = key.split(':');
    if (kind === 'rule') return name === 'on' ? ':on()' : name === 'drag' ? ':on(drag)' : ':' + name + '(when())';
    if (kind === 'declaration') return name.endsWith(')') || name.startsWith('--') || name === 'content' ? name : name === 'persist' ? 'persist()' : name + ':';
    if (kind === 'selector') return name.startsWith('just-') || name === 'blur' ? ':' + name : ':' + name + '()';
    return name + '()';
  };
  const plain = (md) => md.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1');
  const experimental = (key) => { const [kind, name] = key.split(':'); return reg.features.find((f) => f.kind === kind && f.name === name)?.status === 'experimental'; };
  const glossary = Object.fromEntries(entries.flatMap((e) => e.features.map((key) => [key, {
    label: label(key), kind: KIND[key.split(':')[0]] + (e.readiness !== 'stable' && experimental(key) ? ' · experimental' : ''), summary: plain(e.summary), href: `/docs/reference/${e.id}/`,
  }])));
  await writeFile(new URL('glossary.json', genDir), JSON.stringify(glossary) + '\n');
  console.log(`synced glossary → src/generated/glossary.json (${Object.keys(glossary).length} features)`);
}

// Version consistency: the bundle, describe() and the library's package.json must agree.
// tests/unit/version.test.ts reads this snapshot; a stale ../dist fails the build here first.
const { readFile, readdir, cp, rm } = await import('node:fs/promises');
const bundle = await readFile(src, 'utf8');
const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
const registryVersion = describe().version;
await writeFile(new URL('runtime.json', genDir), JSON.stringify({ package: pkg.version, registry: registryVersion, bundleHasVersion: bundle.includes(`"${pkg.version}"`) }, null, 2) + '\n');
if (registryVersion !== pkg.version) {
  console.error(`Version mismatch: ../package.json is ${pkg.version}, ../dist describe() is ${registryVersion}. Rebuild the library.`);
  process.exit(1);
}
console.log(`synced versions → src/generated/runtime.json (${pkg.version})`);

// The library's own demos (../examples/<name>/), copied as-is. The site splits and renders them
// (src/lib/content/demos.ts) but never edits them.
const demosSrc = new URL('../../examples/', import.meta.url);
const demosOut = new URL('demos/', genDir);
await rm(demosOut, { recursive: true, force: true });
let count = 0;
for (const d of await readdir(demosSrc, { withFileTypes: true })) {
  if (!d.isDirectory() || d.name === 'lab') continue;
  const dir = new URL(`${d.name}/`, demosSrc);
  const files = await readdir(dir);
  if (!['index.html', 'style.css', 'README.md'].every((f) => files.includes(f))) continue;
  for (const f of ['index.html', 'style.css', 'README.md']) await cp(new URL(f, dir), new URL(`${d.name}/${f}`, demosOut));
  count++;
}
console.log(`synced ${count} library demos → src/generated/demos/`);

// The library's small API examples (../examples/api/<name>/, 0.8.0), and their shared api.css.
// The Examples gallery runs them unchanged (src/lib/content/catalog.ts).
const apiSrc = new URL('../../examples/api/', import.meta.url);
const apiOut = new URL('api-examples/', genDir);
await rm(apiOut, { recursive: true, force: true });
let apiCount = 0;
try {
  await mkdir(apiOut, { recursive: true });
  await cp(new URL('api.css', apiSrc), new URL('api.css', apiOut));
  for (const d of await readdir(apiSrc, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const dir = new URL(`${d.name}/`, apiSrc);
    const files = await readdir(dir);
    if (!['index.html', 'style.css', 'README.md'].every((f) => files.includes(f))) continue;
    for (const f of ['index.html', 'style.css', 'README.md']) await cp(new URL(f, dir), new URL(`${d.name}/${f}`, apiOut));
    apiCount++;
  }
} catch (e) { if (e.code !== 'ENOENT') throw e; }
console.log(`synced ${apiCount} API examples → src/generated/api-examples/`);

// Custom bundles (0.8.0). Everything the bundle builder page shows comes from the library:
// - catalog and profiles: ../dist/catalog.json (the builder's own catalog);
// - which feature each API entry belongs to: the library's featureOfKey/keyOfApiEntry;
// - measured sizes: the library's size benchmark report, only if it was measured for this version;
// - which demos run on which features: the library's analyzer, on each demo folder (the same
//   analysis the library's RCSS_CUSTOM test suite builds and runs every demo with);
// - package metadata and publication status: ../package.json and the CHANGELOG's latest heading.
// The builder itself (esbuild) never reaches the site: only this JSON and, for "Analyze my CSS",
// the library's ESM build (compile()), loaded on demand.
const tools = await import(new URL('../../tools/bundle.mjs', import.meta.url).href);
const catalog = JSON.parse(await readFile(new URL('../../dist/catalog.json', import.meta.url), 'utf8'));
if (catalog.version !== pkg.version) {
  console.error(`Version mismatch: ../dist/catalog.json is ${catalog.version}, ../package.json is ${pkg.version}. Rebuild the library.`);
  process.exit(1);
}
const sizesPath = `benchmarks/audit/results/v${pkg.version.replaceAll('.', '')}/bundle-sizes.json`;
let report = JSON.parse(await readFile(new URL(`../../${sizesPath}`, import.meta.url), 'utf8').catch(() => 'null')) ?? { version: 'none' };
// A report is current only if its full bundle is the file in ../dist now (a later library build
// changes it). Otherwise the sizes are measured here from the current artifacts, with the
// library's own build() and sizes() (the same method as its benchmark, without the startup runs).
const distSizes = async (f) => tools.sizes(await readFile(new URL(`../../dist/${f}`, import.meta.url), 'utf8'));
const distFull = await distSizes('reactive-css.min.js');
if (report.version !== pkg.version || report.sizes?.find((s) => s.name === 'dist full')?.minified !== distFull.minified) {
  const measured = [];
  const custom = async (name, sel) => { const r = await tools.build(sel); if (!r.ok) throw new Error(`${name}: ${JSON.stringify(r.errors)}`); measured.push({ name, features: r.manifest.features, ...r.manifest.sizes }); };
  await custom('core', { features: [] });
  for (const p of Object.keys(catalog.profiles)) await custom(p, { profile: p });
  measured.push({ name: 'dist full', features: null, ...distFull }, { name: 'dist compact', features: null, ...await distSizes('reactive-css.compact.min.js') });
  const overhead = [];
  for (const f of catalog.features.filter((x) => x.id !== 'core')) {
    const deps = f.requires.filter((x) => x !== 'core');
    const [base, withF] = await Promise.all([tools.build({ features: deps }), tools.build({ features: [f.id] })]);
    const d = (k) => withF.manifest.sizes[k] - base.manifest.sizes[k];
    overhead.push({ id: f.id, over: ['core', ...deps], minified: d('minified'), gzip: d('gzip'), brotli: d('brotli') });
  }
  report = { version: pkg.version, date: new Date().toISOString(), browser: null, sizes: measured, overhead };
  console.log(`${sizesPath} does not match ../dist: sizes measured from the current build artifacts`);
}
const apiFeature = Object.fromEntries(describe().features.map((e) => {
  const k = tools.keyOfApiEntry(e);
  return [`${e.kind}:${e.name}`, k ? tools.featureOfKey(k) ?? null : null];
}));
const demoFeatures = [];
for (const d of await readdir(demosOut, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const a = await tools.analyze([new URL(`../../examples/${d.name}`, import.meta.url).pathname], { assumeComplete: true });
  demoFeatures.push({ name: d.name, complete: a.complete, used: a.used, features: a.features });
}
const latest = (await readFile(new URL('../../CHANGELOG.md', import.meta.url), 'utf8')).match(/^## (\d+\.\d+\.\d+)[^\n]*/m)?.[0] ?? '';
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
await writeFile(new URL('bundles.json', genDir), JSON.stringify({
  package: { ...pick(pkg, ['name', 'version', 'license', 'bin', 'exports', 'files', 'peerDependencies', 'peerDependenciesMeta', 'unpkg', 'jsdelivr']),
    // The only publication record the project keeps: release headings say "(local, unpublished)".
    published: !/unpublished/i.test(latest), releaseHeading: latest.replace(/^## /, '') },
  catalog: { features: catalog.features, profiles: catalog.profiles },
  apiFeature,
  sizes: { version: report.version, date: report.date, browser: report.browser, measured: report.sizes, overhead: report.overhead },
  demos: demoFeatures.sort((x, y) => x.name.localeCompare(y.name)),
}, null, 1) + '\n');
// Without its source map comment: the map is not copied.
await writeFile(new URL('reactive-css.esm.js', genDir), (await readFile(new URL('../../dist/index.js', import.meta.url), 'utf8')).replace(/\n\/\/# sourceMappingURL=.*\s*$/, '\n'));
// Only the part of the ESM API the analyzer uses (dist/index.d.ts spans many files).
await writeFile(new URL('reactive-css.esm.d.ts', genDir), 'export function compile(css: string, options?: { trusted?: boolean }): { uses: Set<string> };\nexport const diagnostics: string[];\n');
console.log(`synced bundle catalog, sizes (${report.version}) and ${demoFeatures.length} demo analyses → src/generated/bundles.json`);

// Experiments (site/experiments/<slug>/, a public source folder each). The site shows each one in
// an iframe of public/embed/experiments/<slug>.<mode>.html: the experiment's own markup with its
// stylesheet inlined (one request, and the frame works wherever the page is copied) and
// data-embed="<mode>" on <html>, which its stylesheet uses for the site layout: "stage" on the
// experiment's page, "card" (the card alone) in the homepage and gallery previews.
const xpSrc = new URL('../experiments/', import.meta.url);
const xpOut = new URL('../public/embed/experiments/', import.meta.url);
await rm(xpOut, { recursive: true, force: true });
await mkdir(xpOut, { recursive: true });
let xpCount = 0;
for (const d of await readdir(xpSrc, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const dir = new URL(`${d.name}/`, xpSrc);
  const html = await readFile(new URL('index.html', dir), 'utf8');
  const css = (await readFile(new URL('style.css', dir), 'utf8')).replace(/<\/(style)/gi, '<\\/$1');
  const link = '<link rel="stylesheet" href="style.css">';
  if (!html.includes(link) || !html.includes('<html lang="en"')) throw new Error(`experiments/${d.name}/index.html: expected ${link} and <html lang="en">`);
  for (const mode of ['stage', 'card']) {
    const embed = html
      .replace('<html lang="en"', `<html lang="en" data-embed="${mode}"`)
      .replace(link, `<meta name="robots" content="noindex">\n  <style>${css}</style>`);
    await writeFile(new URL(`${d.name}.${mode}.html`, xpOut), embed);
  }
  xpCount++;
}
console.log(`synced ${xpCount} experiments → public/embed/experiments/`);
