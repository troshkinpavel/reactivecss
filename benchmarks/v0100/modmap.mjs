// Minified bytes per source module in a custom bundle, across trees (esbuild metafile).
//   node benchmarks/v0100/modmap.mjs "feature,feature" name=dir name=dir …
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const [feat, ...trees] = process.argv.slice(2);
const features = feat === 'core' ? [] : feat.split(',');
const tab = {};
for (const a of trees) {
  const [name, dir] = a.split('=');
  process.chdir(dir);
  const esbuild = createRequire(dir + '/package.json')('esbuild');
  const { resolve } = await import(pathToFileURL(`${dir}/tools/bundle.mjs`).href + `?${name}`);
  const { diagnosticsPlugin } = await import(pathToFileURL(`${dir}/tools/diagnostics.mjs`).href + `?${name}`);
  const { CATALOG } = await import(pathToFileURL(`${dir}/src/features/catalog.ts`).href).catch(() => ({ CATALOG: null }));
  const r = resolve({ features });
  const entries = CATALOG ?? [];
  const imports = r.features.map((id) => entries.find((f) => f.id === id)?.entry).filter(Boolean).map((e) => `import ${JSON.stringify('./' + e)};`).join('\n');
  const res = await esbuild.build({ stdin: { contents: `${imports}\nimport * as R from './src/api.ts';window.R=R;R.start();`, resolveDir: dir, loader: 'ts' }, bundle: true, format: 'iife', minify: true, write: false, metafile: true, logLevel: 'silent', target: 'es2020',
    define: { __DEV__: 'false', __RCSS_EXCLUDED__: '{}', __RCSS_BUNDLE__: '[]' }, plugins: [diagnosticsPlugin()] });
  const out = Object.values(res.metafile.outputs)[0];
  tab[name] = Object.fromEntries(Object.entries(out.inputs).map(([k, v]) => [k.replace(/^.*?src\//, ''), v.bytesInOutput]));
}
const names = Object.keys(tab), mods = [...new Set(names.flatMap((n) => Object.keys(tab[n])))];
const rows = mods.map((m) => [m, ...names.map((n) => tab[n][m] ?? 0)]).sort((a, b) => (b.at(-1) - b[1]) - (a.at(-1) - a[1]));
for (const r of rows) if (r.at(-1) !== r[1]) console.log(r[0].padEnd(28), r.slice(1).map((x) => String(x).padStart(7)).join(' '), ' Δ', r.at(-1) - r[1]);
console.log('TOTAL'.padEnd(28), names.map((n) => String(Object.values(tab[n]).reduce((a, b) => a + b, 0)).padStart(7)).join(' '));
