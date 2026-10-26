// Builds @reactivecss/mcp from the Reactive CSS library in this repository (../../).
//
// 1. dist/compiler.js: the library's own compiler (src/index.ts, every feature registered), bundled
//    for Node. Pure: compiling touches no DOM. Console output is dropped (stdout is the MCP channel),
//    and a build-time shim on src/core/log.ts records which diagnostics are notes (info level).
// 2. dist/knowledge.json: the API registry (describe()), the feature catalog and profiles, the
//    production diagnostic codes, the maintained examples (site/src/catalog), the migration guide,
//    the curated agent knowledge (knowledge/*.mjs), bundle sizes measured now with the library's
//    own builder (tools/bundle.mjs), and a prebuilt search index.
// 3. dist/index.js: the server (src/), bundled; the MCP SDK and zod stay npm dependencies.
// 4. AGENTS.md and skills/reactive-css/SKILL.md, generated from the same knowledge.
//
// Run from the monorepo: needs the library's source and devDependencies (esbuild).

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync, chmodSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';
import { OVERLAY, MUTATIONS, MODIFIERS, ALIASES, MISTAKES, NATIVE_FIRST, COMPATIBILITY, DOC_PAGES, EXAMPLE_TOPICS } from '../knowledge/overlay.mjs';
import { agentsMd, skillMd } from '../knowledge/agents.mjs';
import { buildIndex } from '../src/search-index.mjs';

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LIB = resolve(PKG, '../..');
const DIST = join(PKG, 'dist');
const read = (p) => readFileSync(join(LIB, p), 'utf8');
const t0 = Date.now();

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// ---- 1. the compiler ----------------------------------------------------------------------

const LOG = /src[\\/]core[\\/]log\.ts$/;
const logShim = { name: 'log-severity', setup(b) {
  b.onLoad({ filter: LOG }, (args) => {
    const src = readFileSync(args.path, 'utf8');
    const anchor = 'diagnostics.push(message);\n  if (dev) console.info(';
    if (!src.includes(anchor)) throw new Error('src/core/log.ts changed: update the note() shim in packages/mcp/scripts/build.mjs');
    return { loader: 'ts', contents: src.replace(anchor, 'diagnostics.push(message); noted.add(message);\n  if (dev) console.info(') + '\nexport const noted = new Set<string>();\n' };
  });
} };
// The compiler keeps one generated property name per state and per :on() slot for the page's
// lifetime. A page has a bounded set; a long MCP session compiling unrelated sheets does not, so
// the server clears both maps before each compile (each validation is independent).
const PARSER = /src[\\/]core[\\/]parser\.ts$/;
const parserReset = { name: 'parser-reset', setup(b) {
  b.onLoad({ filter: PARSER }, (args) => {
    const src = readFileSync(args.path, 'utf8');
    if (!src.includes('const stateVars = new Map<string, string>();') || !src.includes('const slotVars = new Map<string, string>();'))
      throw new Error('src/core/parser.ts changed: update the reset shim in packages/mcp/scripts/build.mjs');
    return { loader: 'ts', contents: src + '\nexport function resetNames(): void { stateVars.clear(); slotVars.clear(); }\n' };
  });
} };
const entry = `
export { compile, diagnostics, describe, version } from './src/index.ts';
export { tokenize, matching } from './src/core/tokenizer.ts';
export { assignable, convert } from './src/state/values.ts';
export { noted } from './src/core/log.ts';
export { resetNames } from './src/core/parser.ts';
`;
await esbuild.build({
  stdin: { contents: entry, resolveDir: LIB, loader: 'ts', sourcefile: 'mcp-compiler.ts' },
  bundle: true, format: 'esm', platform: 'neutral', target: 'node22', minify: true, legalComments: 'none',
  define: { __DEV__: 'true' }, drop: ['console'], plugins: [logShim, parserReset], outfile: join(DIST, 'compiler.js'), logLevel: 'warning',
  banner: { js: '// Reactive CSS compiler (from the library source), bundled for @reactivecss/mcp. MIT License.' },
});
const compiler = await import(pathToFileURL(join(DIST, 'compiler.js')).href);

// ---- 2. knowledge ---------------------------------------------------------------------------

const libPkg = JSON.parse(read('package.json'));
if (libPkg.version !== compiler.version) throw new Error(`package.json ${libPkg.version} and src/core/version.ts ${compiler.version} differ`);
const registry = compiler.describe();
const tools = await import(pathToFileURL(join(LIB, 'tools/bundle.mjs')).href);
const cat = tools.catalog();
const diagnosticCodes = JSON.parse(read('src/core/diagnostics.json')).codes;

// Every overlay key must name a registry entry, so the curated layer cannot drift silently.
const keyOf = (e) => `${e.kind}:${e.name}`;
const keys = new Set(registry.features.map(keyOf));
for (const k of Object.keys(OVERLAY)) if (!keys.has(k)) throw new Error(`knowledge/overlay.mjs: no registry entry "${k}"`);
for (const [alias, k] of Object.entries(ALIASES)) if (!keys.has(k) && !MUTATIONS[k] && !MODIFIERS[k]) throw new Error(`alias ${alias}: unknown target ${k}`);

// Maintained examples: site/src/catalog/{api,interfaces}/<id>/{README.md,index.html,style.css}.
const examples = [];
for (const group of ['api', 'interfaces']) {
  const dir = join(LIB, 'site/src/catalog', group);
  for (const id of readdirSync(dir).sort()) {
    const base = join(dir, id);
    if (!existsSync(join(base, 'style.css'))) continue;
    const readme = readFileSync(join(base, 'README.md'), 'utf8');
    const css = readFileSync(join(base, 'style.css'), 'utf8');
    const html = readFileSync(join(base, 'index.html'), 'utf8');
    const sections = {};
    let cur;
    for (const line of readme.split('\n')) {
      const h = /^## (.+)$/.exec(line);
      if (h) { cur = h[1].trim(); sections[cur] = ''; } else if (cur) sections[cur] += line + '\n';
    }
    for (const k of Object.keys(sections)) sections[k] = sections[k].trim();
    compiler.diagnostics.length = 0;
    const uses = [...compiler.compile(css, { trusted: true }).uses].sort();
    if (compiler.diagnostics.length) throw new Error(`example ${group}/${id} has diagnostics: ${compiler.diagnostics.join(' | ')}`);
    const used = [...new Set(uses.map(tools.featureOfKey).filter(Boolean))].filter((f) => f !== 'core');
    examples.push({
      id, group, title: /^# (.+)$/m.exec(readme)?.[1] ?? id, topics: EXAMPLE_TOPICS[id] ?? [],
      summary: sections['What it demonstrates'] ?? '', sections, css, html, uses, features: tools.resolve({ features: used }).features,
      source: `site/src/catalog/${group}/${id}`,
    });
  }
}
for (const [id] of Object.entries(EXAMPLE_TOPICS)) if (!examples.some((e) => e.id === id)) throw new Error(`EXAMPLE_TOPICS: no example "${id}"`);

// Measured sizes: real builds with the library's builder, now (min, gzip 9, brotli 11).
const measured = [];
const measure = async (label, selection) => {
  const r = await tools.build(selection);
  if (!r.ok) throw new Error(`size build ${label}: ${JSON.stringify(r.errors)}`);
  measured.push({ label, features: r.manifest.features, sizes: r.manifest.sizes, kind: 'custom' });
};
for (const p of Object.keys(cat.profiles)) await measure(`profile ${p}`, { profile: p });
for (const f of cat.features) await measure(`feature ${f.id}`, { features: [f.id] });
const prebuilt = [];
for (const [file, label] of [['dist/reactive-css.min.js', 'full'], ['dist/reactive-css.compact.min.js', 'compact']]) {
  if (!existsSync(join(LIB, file))) continue;
  const code = readFileSync(join(LIB, file));
  // Only a file built from this version: a stale dist/ would give the sizes of another release.
  if (!code.toString().includes(`"${libPkg.version}"`)) { console.warn(`skipped ${file}: not built from ${libPkg.version}`); continue; }
  prebuilt.push({ file, label, sizes: tools.sizes(code) });
}

// Publication is a verified fact recorded in site/config/distribution.json, never assumed.
const published = JSON.parse(read('site/config/distribution.json')).core.npmVersions.includes(libPkg.version);
const migrationGuide = read('docs/migration-0.9.md');
const knowledge = {
  name: '@reactivecss/mcp',
  version: JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8')).version,
  reactivecss: {
    version: libPkg.version, package: libPkg.name, status: published ? `experimental, published on npm (@reactivecss/core ${libPkg.version})` : `experimental, ${libPkg.version} not on npm yet`,
    homepage: libPkg.homepage, published,
  },
  builtAt: new Date().toISOString(),
  registry, catalog: cat, diagnosticCodes,
  overlay: OVERLAY, mutations: MUTATIONS, modifiers: MODIFIERS, aliases: ALIASES, mistakes: MISTAKES,
  nativeFirst: NATIVE_FIRST, compatibility: COMPATIBILITY, docPages: DOC_PAGES,
  examples, sizes: { measured, prebuilt, method: 'tools/bundle.mjs build(): minified IIFE; gzip level 9; brotli quality 11', measuredWith: libPkg.version },
  migrationGuide,
};
knowledge.index = buildIndex(knowledge);
writeFileSync(join(DIST, 'knowledge.json'), JSON.stringify(knowledge));

// ---- 3. the server --------------------------------------------------------------------------

// dist/server.js: createServer() and the engine (imported by the tests); dist/index.js: the stdio bin.
await esbuild.build({
  entryPoints: [join(PKG, 'src/server.ts')], bundle: true, format: 'esm', platform: 'node', target: 'node22',
  packages: 'external', outfile: join(DIST, 'server.js'), logLevel: 'warning',
});
await esbuild.build({
  entryPoints: [join(PKG, 'src/index.ts')], bundle: true, format: 'esm', platform: 'node', target: 'node22',
  packages: 'external', external: ['./server.js'], outfile: join(DIST, 'index.js'), banner: { js: '#!/usr/bin/env node' }, logLevel: 'warning',
});
chmodSync(join(DIST, 'index.js'), 0o755);

// ---- 4. agent instructions ------------------------------------------------------------------

writeFileSync(join(PKG, 'AGENTS.md'), agentsMd(knowledge));
mkdirSync(join(PKG, 'skills/reactive-css'), { recursive: true });
writeFileSync(join(PKG, 'skills/reactive-css/SKILL.md'), skillMd(knowledge));

console.error(`built @reactivecss/mcp ${knowledge.version} for Reactive CSS ${libPkg.version}: ${registry.features.length} registry entries, ${examples.length} examples, ${measured.length} measured bundles, ${knowledge.index.docs.length} indexed documents (${Date.now() - t0} ms)`);
