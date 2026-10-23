// Size matrix of representative bundles (docs/release-0.9.0-hardening.md, section C).
//   node benchmarks/v090/matrix.mjs
// Each configuration is built twice with the same settings (minified IIFE, auto-start): with the
// current builder and source, and with the frozen pre-hardening ones (benchmarks/baseline/v0.9.0-rc1).
// Writes benchmarks/v090/matrix.{json,md}.
import { writeFileSync, readFileSync } from 'node:fs';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { build as buildNow } from '../../tools/bundle.mjs';
import { build as buildRc1 } from '../baseline/v0.9.0-rc1/tools/bundle.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const sizes = (s) => ({ min: Buffer.byteLength(s), gzip: gzipSync(s, { level: 9 }).length, brotli: brotliCompressSync(s, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length });
const CONFIGS = [
  ['minimal state', []],
  ['counter', ['events', 'text']],
  ['forms', ['events', 'forms']],
  ['focus', ['focus']],
  ['persistence', ['persist']],
  ['drag', ['gestures']],
  ['sensors', ['dynamic', 'geometry']],
  ['interactive profile', 'interactive'],
  ['full (custom, compact registry)', 'full'],
];
const rows = [];
for (const [name, sel] of CONFIGS) {
  const cfg = typeof sel === 'string' ? { profile: sel } : { features: sel };
  const now = await buildNow({ ...cfg, minify: true });
  const rc1 = await buildRc1({ ...cfg, minify: true });
  rows.push({ name, features: now.manifest.features, added: now.manifest.added.map((a) => a.id), before: sizes(rc1.code), after: sizes(now.code) });
}
for (const [name, file, rc1File] of [['dist/reactive-css.min.js (full registry)', 'dist/reactive-css.min.js', 'benchmarks/baseline/v0.9.0-rc1/reactive-css.min.js'],
  ['dist/reactive-css.compact.min.js', 'dist/reactive-css.compact.min.js', 'benchmarks/baseline/v0.9.0-rc1/reactive-css.compact.min.js']]) {
  rows.push({ name, features: ['all'], added: [], before: sizes(readFileSync(ROOT + rc1File)), after: sizes(readFileSync(ROOT + file)) });
}
const v081 = { 'dist/reactive-css.min.js (full registry)': { min: 117830, gzip: 39715, brotli: 34983 }, 'dist/reactive-css.compact.min.js': { min: 101644, gzip: 34357, brotli: 30418 }, 'minimal state': { min: 41873, gzip: 15530, brotli: 14102 } };
writeFileSync(ROOT + 'benchmarks/v090/matrix.json', JSON.stringify({ date: new Date().toISOString(), v081, rows }, null, 1) + '\n');
const d = (a, b) => `${b - a >= 0 ? '+' : ''}${b - a} (${(100 * (b - a) / a).toFixed(1)}%)`;
const L = ['# Bundle matrix (minified IIFE, auto-start)', '', 'Before = pre-hardening 0.9.0 (rc1); after = hardened. gzip level 9, brotli quality 11.', '',
  '| Bundle | Features (added automatically) | Min before | Min after | Δ min | gzip before | gzip after | Δ gzip | brotli after | 0.8.1 min / gzip |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...rows.map((r) => `| ${r.name} | ${r.features.join(', ')}${r.added.length ? ` (${r.added.join(', ')})` : ''} | ${r.before.min} | ${r.after.min} | ${d(r.before.min, r.after.min)} | ${r.before.gzip} | ${r.after.gzip} | ${d(r.before.gzip, r.after.gzip)} | ${r.after.brotli} | ${v081[r.name] ? `${v081[r.name].min} / ${v081[r.name].gzip}` : '—'} |`), ''];
writeFileSync(ROOT + 'benchmarks/v090/matrix.md', L.join('\n'));
console.log(L.join('\n'));
