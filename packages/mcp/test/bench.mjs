// Measurements: package size, cold start, idle memory, latency of lookups, search, validation,
// analysis and migration, large inputs, and memory over many calls. node test/bench.mjs [--json]

import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { start } from './helpers.mjs';

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..');
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const p95 = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]; };
const r2 = (n) => Math.round(n * 100) / 100;
const out = { node: process.version, platform: `${process.platform} ${process.arch}`, date: new Date().toISOString() };

// ---- package size
const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { cwd: PKG, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
out.package = { tarball: pack.size, unpacked: pack.unpackedSize, files: pack.entryCount,
  dist: Object.fromEntries(['index.js', 'server.js', 'compiler.js', 'knowledge.json'].map((f) => [f, statSync(join(PKG, 'dist', f)).size])) };

// ---- cold start and idle memory (separate processes)
const rss = (pid) => Number(execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8' }).trim()) * 1024;
const cold = [], firstValidate = [], idle = [], afterUse = [];
for (let i = 0; i < 7; i++) {
  const t0 = performance.now();
  const s = start();
  await s.init();
  cold.push(performance.now() - t0);
  await new Promise((r) => setTimeout(r, 300));
  idle.push(rss(s.p.pid));
  const t1 = performance.now();
  await s.request('tools/call', { name: 'validate_css', arguments: { css: '.c { --n: state(0); } .c:on(click) { --n: increment(1); }' } });
  firstValidate.push(performance.now() - t1);
  afterUse.push(rss(s.p.pid));
  s.p.stdin.end();
  await s.exited;
}
out.coldStart = { spawnToInitializeMs: { median: r2(median(cold)), max: r2(Math.max(...cold)) }, firstValidateMs: { median: r2(median(firstValidate)) }, runs: cold.length };
out.memory = { idleRssMB: r2(median(idle) / 2 ** 20), afterFirstValidateRssMB: r2(median(afterUse) / 2 ** 20) };

// ---- latency in process (the same code the tools run)
const S = await import(new URL('../dist/server.js', import.meta.url).href);
const k = S.knowledge();
const time = async (n, fn) => { const ts = []; for (let i = 0; i < n; i++) { const t = performance.now(); await fn(i); ts.push(performance.now() - t); } return { medianMs: r2(median(ts) * 1000) / 1000, p95Ms: r2(p95(ts) * 1000) / 1000, n }; };
await S.validate('.a{}'); // warm the compiler
const counter = S.getExample({ id: 'counter' }).css;
const all = k.examples.map((e) => e.css).join('\n');
out.latency = {
  get_api_reference: await time(2000, (i) => S.getReference({ name: ['toggle', ':on', 'state', 'focus', '--attr-*'][i % 5] })),
  search_docs: await time(2000, (i) => S.search(k.index, ['drag a card', 'persist theme', 'focus dialog', 'minifier empty rule'][i % 4], { limit: 5 })),
  get_example: await time(2000, () => S.getExample({ topic: 'drag' })),
  validate_counter: await time(500, () => S.validate(counter)),
  validate_all_examples: await time(100, () => S.validate(all)),
  analyze_all_examples: await time(100, () => S.analyze(all)),
  migrate_legacy: await time(200, () => S.migrate('.b { --o: state(false); on: click(toggle(--o)), key(Escape, set(--o, false)); text: var(--o); attr: aria-pressed var(--o); }')),
  exampleCssBytes: all.length,
};

// ---- large inputs
const unit = '.c { --n: state(0); }\n.c .b:on(click) { --n: increment(1); }\n.c .v { content: var(--n); }\n';
const big = unit.repeat(Math.floor(S.LIMITS.css / unit.length));
const line = '.card:hover { color: red; transition: color 200ms; }\n';
const native = line.repeat(Math.floor(S.LIMITS.css / line.length));
out.largeInput = {
  reactiveBytes: big.length, validateReactiveMs: (await time(5, () => S.validate(big))).medianMs,
  nativeBytes: native.length, validateNativeMs: (await time(5, () => S.validate(native))).medianMs,
  migrateReactiveMs: (await time(3, () => S.migrate(big))).medianMs,
};

// ---- memory over many calls with distinct state names (the compiler keeps one generated property per name)
globalThis.gc?.();
const h0 = process.memoryUsage().heapUsed;
for (let i = 0; i < 2000; i++) await S.validate(`.c${i} { --s${i}: state(0); } .c${i}:on(click) { --s${i}: increment(1); }`);
globalThis.gc?.();
out.memoryGrowth = { calls: 2000, distinctStateNames: 2000, heapGrowthKB: Math.round((process.memoryUsage().heapUsed - h0) / 1024), gcExposed: !!globalThis.gc };

console.log(process.argv.includes('--json') ? JSON.stringify(out, null, 2) : JSON.stringify(out, null, 1));

