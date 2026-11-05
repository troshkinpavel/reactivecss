// Bundle sizes across trees: minified / gzip / brotli of the shipped and custom bundles.
//   node benchmarks/v0100/sizes.mjs [out.json] name=dir name=dir …
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const VARIANTS = {
  core: [], events: ['events'], 'events+conditions': ['events', 'conditions'], 'events+conditions+text': ['events', 'conditions', 'text'],
  forms: ['events', 'forms', 'text', 'attributes'], strings: ['strings'], format: ['format'], datetime: ['datetime'], timers: ['timers'], derived: ['derived'],
  'strings+text': ['strings', 'text'], 'format+text': ['format', 'text'], 'datetime+text': ['datetime', 'text'], 'derived+text': ['derived', 'text'], 'events+format+text': ['events', 'format', 'text'],
};
const size = (b) => ({ min: b.length, gzip: gzipSync(b, { level: 9 }).length, brotli: brotliCompressSync(b).length });
const args = process.argv.slice(2);
const out = args[0].includes('=') ? null : args.shift();
const res = {};
for (const a of args) {
  const [name, dir] = a.split('=');
  process.chdir(dir);
  const r = (res[name] = {});
  for (const f of ['reactive-css.min.js', 'reactive-css.compact.min.js', 'index.js', 'reactive-css.js']) r[f] = size(readFileSync(`${dir}/dist/${f}`));
  const { build } = await import(pathToFileURL(`${dir}/tools/bundle.mjs`).href + `?${name}`);
  for (const [v, features] of Object.entries(VARIANTS)) {
    try { const b = await build({ features }); r[v] = b.ok === false ? null : size(Buffer.from(b.code)); } catch { r[v] = null; }
  }
}
if (out) writeFileSync(out, JSON.stringify(res, null, 1) + '\n');
const names = Object.keys(res);
console.log('| Bundle (brotli) | ' + names.join(' | ') + ' |');
for (const v of ['reactive-css.min.js', 'reactive-css.compact.min.js', ...Object.keys(VARIANTS)]) console.log(`| ${v} | ` + names.map((n) => res[n][v]?.brotli ?? '—').join(' | ') + ' |');
