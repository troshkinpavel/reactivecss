// Builds dist/ with esbuild. `node build.mjs --serve` serves the repo for the demo and tests.
import * as esbuild from 'esbuild';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { CATALOG, PROFILES } from './src/features/catalog.ts';
import { diagnosticsPlugin, loadRegistry } from './tools/diagnostics.mjs';

/**
 * Production bundles (__DEV__ false) carry diagnostic codes instead of message text
 * (tools/diagnostics.mjs); development bundles keep the text. `assign` records new messages in
 * the code registry (only this build does).
 */
export const productionPlugins = ({ assign = false } = {}) => [diagnosticsPlugin({ assign })];

// The full and compact bundles contain every feature: describe().bundle lists them all.
export const common = { bundle: true, target: ['chrome111', 'firefox113', 'safari16.4'], sourcemap: true, logLevel: 'info', define: { __RCSS_BUNDLE__: JSON.stringify(CATALOG.map((f) => f.id)) } };
const builds = [
  { ...common, entryPoints: ['src/auto.ts'], outfile: 'dist/reactive-css.js', format: 'iife', define: { ...common.define, __DEV__: 'true' } },
  { ...common, entryPoints: ['src/auto.ts'], outfile: 'dist/reactive-css.min.js', format: 'iife', minify: true, define: { ...common.define, __DEV__: 'false' }, plugins: productionPlugins({ assign: true }) },
  { ...common, entryPoints: ['src/index.ts'], outfile: 'dist/index.js', format: 'esm', define: { ...common.define, __DEV__: 'true' } },
];

const main = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (!main) { /* imported for its configuration (benchmarks/v090/composition.mjs) */ }
else if (process.argv.includes('--serve')) {
  const ctx = await esbuild.context(builds[0]);
  await ctx.watch();
  await Promise.all(builds.slice(1).map((b) => esbuild.build(b)));
  const port = Number(process.env.PORT ?? 8080);
  const { hosts } = await ctx.serve({ servedir: '.', port });
  console.log(`Serving on http://${hosts[0]}:${port}/examples/`);
} else {
  await Promise.all(builds.map((b) => esbuild.build(b)));
  // Feature metadata for tooling (docs, editors) without loading or running the library.
  const { describe } = await import('./dist/index.js');
  const info = describe();
  writeFileSync('dist/features.json', JSON.stringify(info, null, 1) + '\n');
  // Bundle units for custom-bundle tools (docs/bundle-builder-0.8.md), the same data as `reactive-css features --json`.
  writeFileSync('dist/catalog.json', JSON.stringify({ version: info.version, features: CATALOG, profiles: PROFILES }, null, 1) + '\n');
  // Opt-in compact production bundle: the same runtime, with a registry generated from the same
  // source that keeps only name, kind, status, since and syntax (descriptions, examples and
  // reasons are in dist/features.json). The default bundle and its describe() are unchanged.
  const compact = info.features.map(({ name, kind, status, since, syntax }) => ({ name, kind, status, since, syntax }));
  // Code → message template, to decode production diagnostics offline (reactive-css explain).
  writeFileSync('dist/diagnostics.json', JSON.stringify(Object.fromEntries(Object.entries(loadRegistry().codes).map(([c, e]) => [c, e.template])), null, 1) + '\n');
  await esbuild.build({
    ...builds[1], outfile: 'dist/reactive-css.compact.min.js',
    plugins: [...productionPlugins(), { name: 'compact-features', setup(b) {
      b.onLoad({ filter: /src[\\/]core[\\/]features\.ts$/ }, () => ({
        loader: 'ts',
        contents: `export const FEATURES: any[] = ${JSON.stringify(compact)};\nexport const KEEP_NATIVE = ${JSON.stringify(info.keepNative)};\n`,
      }));
    } }],
  });
}
