// Runs every scenario in headless Chromium and writes benchmarks/results.{json,md}.
//   npm run bench                      all sizes
//   node benchmarks/run.mjs 1000 5000  selected sizes
//   --only=a,b      scenarios (merged into the existing results)
//   --runs=N        repetitions (default 3); tables show the median, results.json keeps every run
//   --build=dev     measure the development ESM build instead of the production bundle
//   --out=file      write JSON (and .md) elsewhere
//   --no-trace      skip the traced window (phase columns empty)
//
// Implementations (see bench.html): rcss = current build, baseline = v0.1.0 build,
// plain = direct property writes, plainvars = the same custom-property writes as rcss,
// none = the same DOM without any script (memory reference).
import { chromium } from '@playwright/test';
import { startServer } from './server.mjs';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import os from 'node:os';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const ONLY = arg('only')?.split(',');
const RUNS = +(arg('runs') ?? 3);
const BUILD = arg('build') ?? 'min';
const OUT = arg('out') ?? 'benchmarks/results.json';
const TRACING = !process.argv.includes('--no-trace');
const SIZES = process.argv.slice(2).map(Number).filter(Boolean);
const sizes = SIZES.length ? SIZES : [100, 1000, 5000, 10000];
const MATRIX = {
  static: ['rcss', 'baseline', 'plain'],
  staticjs: ['rcss', 'baseline'],
  live2s: ['rcss', 'baseline', 'plain', 'plainvars'],
  live200: ['rcss', 'baseline', 'plain', 'plainvars'],
  mouse: ['rcss', 'baseline', 'plain', 'plainvars'],
  mouselocal: ['rcss', 'baseline', 'plainvars'],
  checkbox: ['rcss', 'baseline'],
  nthvar: ['rcss', 'baseline'],
  insert: ['rcss', 'baseline'],
  churn: ['rcss', 'baseline'],
  mixed: ['rcss', 'baseline'],
  components: ['rcss', 'plain'],
  fanout: ['rcss', 'plain'],
  tabsstate: ['rcss'],
  nested: ['rcss'],
  statechurn: ['rcss'],
  components_runtime: ['rcss'],
  fanout_runtime: ['rcss'],
  bindtext: ['rcss', 'plain'],
  bindcheck: ['rcss', 'plain'],
  changed: ['rcss'],
  keyout: ['rcss'],
  geometry: ['rcss', 'plain'],
  attrsplit: ['rcss', 'plain'],
  textcount: ['rcss', 'plain'],
  pressed: ['rcss', 'plain'],
  pressedstate: ['rcss'],
  derived: ['rcss', 'plain'],
};
const SAME_DOM_AS_NONE = new Set(['static', 'staticjs', 'live2s', 'live200', 'mouse', 'churn', 'mixed']);
const WINDOW_MS = 3000;
/** The workload runs this long before the window: JIT, first layouts and caches settle (steady state). */
const WARMUP_MS = 500;
const TRACE = ['devtools.timeline', 'disabled-by-default-devtools.timeline'];
// Chromium trace events summed per phase (main thread, except raster on worker threads).
const PHASES = { style: ['UpdateLayoutTree'], layout: ['Layout'], paint: ['PrePaint', 'Paint'], composite: ['Layerize', 'UpdateLayer', 'CompositeLayers'], raster: ['RasterTask'] };

const server = await startServer();
const browser = await chromium.launch();
const results = [];
const metrics = async (cdp) => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const r1 = (v) => (v === undefined ? undefined : Math.round(v * 10) / 10);
const r2 = (v) => (v === undefined ? undefined : Math.round(v * 100) / 100);

async function run(scenario, n, impl, seed = 1) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await page.goto(`http://localhost:${server.port}/benchmarks/bench.html?scenario=${scenario}&n=${n}&impl=${impl}&build=${BUILD}&seed=${seed}`);
  await page.waitForFunction(() => window.bench, null, { timeout: 120000 });
  const init = await page.evaluate(() => ({ initMs: bench.initMs, firstFrameMs: bench.firstFrameMs, stats: bench.stats(), diagnostics: bench.diagnostics() }));
  await cdp.send('HeapProfiler.collectGarbage');
  const heap = (await metrics(cdp)).JSHeapUsedSize;
  const row = {
    scenario, impl, n, initMs: r1(init.initMs), firstFrameMs: r1(init.firstFrameMs), parseMs: r2(init.stats?.parseMs),
    bindings: init.stats?.bindings, states: init.stats?.states, subscriptions: init.stats ? init.stats.scheduled + init.stats.sources : undefined, heapMB: r2(heap / 1048576),
  };
  if (init.diagnostics.length) row.diagnostics = init.diagnostics;

  if (scenario === 'insert') {
    const ir = await page.evaluate(() => bench.insertRemove());
    Object.assign(row, { insertMs: r1(ir.insertMs), boundAfterInsert: ir.bound, removeMs: r1(ir.removeMs), bindingsAfterRemove: ir.after.bindings, scheduledAfterRemove: ir.after.scheduled });
  } else if (impl !== 'none') {
    await page.evaluate(() => bench.drive());
    await page.waitForTimeout(WARMUP_MS);
    await page.evaluate(() => bench.resetClicks());
    await cdp.send('HeapProfiler.collectGarbage'); // no GC debt from startup inside the window
    const m0 = await metrics(cdp);
    const s0 = await page.evaluate(() => bench.stats());
    // Script time, frames, clicks and counters come from an untraced window: with tracing on,
    // CDP's ScriptDuration missed most timer-driven script in some runs (live200: 4 vs 21 ms/s).
    const frames = await page.evaluate((ms) => bench.frames(ms), WINDOW_MS);
    const m1 = await metrics(cdp);
    const s1 = await page.evaluate(() => bench.stats());
    const cl = await page.evaluate(() => bench.clicks());
    // Then a second window of the same workload, traced, for the rendering phases only.
    let trace = [];
    if (TRACING) {
      await browser.startTracing(page, { categories: TRACE });
      await page.waitForTimeout(WINDOW_MS);
      trace = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
    }
    const perSec = (ms) => r1(ms / (WINDOW_MS / 1000));
    Object.assign(row, { scriptMsPerS: perSec((m1.ScriptDuration - m0.ScriptDuration) * 1000) });
    if (TRACING) for (const [phase, names] of Object.entries(PHASES)) {
      let us = 0;
      for (const e of trace) if (e.ph === 'X' && e.dur && names.includes(e.name)) us += e.dur;
      row[`${phase}MsPerS`] = perSec(us / 1000);
    }
    if (cl) Object.assign(row, { clicks: cl.n, clickAvgMs: r2(cl.avgMs * 1000) / 1000, clickP95Ms: r2(cl.p95 * 1000) / 1000, clickP99Ms: r2(cl.p99 * 1000) / 1000 });
    if (s1?.stateChanges !== undefined) row.stateChangesPerS = Math.round((s1.stateChanges - s0.stateChanges) / (WINDOW_MS / 1000));
    Object.assign(row, { frames: frames.length, frameP50: r1(pct(frames, 0.5)), frameP95: r1(pct(frames, 0.95)), frameP99: r1(pct(frames, 0.99)), longFrames: frames.filter((f) => f > 50).length });
    if (s1?.computeMs !== undefined) {
      const d = (k) => s1[k] - s0[k];
      Object.assign(row, {
        tickMsPerS: perSec(d('tickMs')), sourceMsPerS: perSec(d('sourceMs')), evalMsPerS: perSec(d('computeMs')), writeMsPerS: perSec(d('writeMs')),
        jobsPerS: Math.round(d('jobs') / (WINDOW_MS / 1000)), writesPerS: Math.round(d('writes') / (WINDOW_MS / 1000)),
      });
    }
  }
  await page.evaluate(() => bench.clear());
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50))));
  await cdp.send('HeapProfiler.collectGarbage');
  const after = await page.evaluate(() => bench.stats());
  Object.assign(row, { heapAfterCleanupMB: r2((await metrics(cdp)).JSHeapUsedSize / 1048576), bindingsAfterCleanup: after?.bindings, subscriptionsAfterCleanup: after ? after.scheduled + after.sources : undefined });
  await page.close();
  return row;
}

const raw = [];
try {
  // Repetitions are interleaved (all scenarios, then again) and the implementation order
  // rotates per run, so slow drift (thermal, background load) does not favor one side.
  for (let r = 0; r < RUNS; r++) {
    const add = (row) => { row.run = r; raw.push(row); console.log(JSON.stringify(row)); };
    // Library + compiled rule overhead without any element.
    add(await run('static', 0, 'none', r + 1)); add(await run('static', 0, 'rcss', r + 1));
    for (const n of sizes) {
      const none = await run('static', n, 'none', r + 1);
      add(none);
      for (const [scenario, impls] of Object.entries(MATRIX)) {
        if (ONLY && !ONLY.includes(scenario)) continue;
        for (const impl of impls.map((_, i) => impls[(i + r) % impls.length])) {
          const row = await run(scenario, n, impl, r + 1);
          if (SAME_DOM_AS_NONE.has(scenario)) row.retainedBytesPerElement = Math.round(((row.heapMB - none.heapMB) * 1048576) / n);
          add(row);
        }
      }
    }
  }
  results.push(...aggregate(raw));
} finally {
  const env = {
    date: new Date().toISOString(), browser: `Chromium ${browser.version()} (Playwright, headless shell, software raster)`,
    os: `${os.type()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0].model, cores: os.cpus().length, memoryGB: Math.round(os.totalmem() / 2 ** 30),
    node: process.version, windowMs: WINDOW_MS, warmupMs: WARMUP_MS, runs: RUNS, build: BUILD === 'min' ? 'dist/reactive-css.min.js (production)' : 'dist/index.js (development ESM)',
    tracing: TRACING ? TRACE : false, statistic: 'median of runs; *Range fields give min-max',
  };
  await browser.close();
  server.stop();
  // --only merges into the existing results instead of replacing them.
  let all = results, allRaw = raw;
  const same = (x, r) => x.scenario === r.scenario && x.impl === r.impl && x.n === r.n;
  if (ONLY && existsSync(OUT)) {
    const old = JSON.parse(readFileSync(OUT, 'utf8'));
    all = [...old.results.filter((r) => !results.some((x) => same(x, r))), ...results];
    allRaw = [...(old.raw ?? []).filter((r) => !results.some((x) => same(x, r))), ...raw];
  }
  writeFileSync(OUT, JSON.stringify({ env, results: all, raw: allRaw }, null, 2));
  writeFileSync(OUT.replace(/\.json$/, '.md'), markdown(env, all));
}

/** One row per scenario/impl/n: the median of every numeric field, plus min-max for the key ones. */
function aggregate(rows) {
  const groups = new Map();
  for (const r of rows) {
    const k = `${r.scenario}|${r.impl}|${r.n}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const med = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  return [...groups.values()].map((list) => {
    const out = { ...list[0], runs: list.length };
    delete out.run;
    for (const key of Object.keys(list[0])) {
      const vals = list.map((r) => r[key]).filter((v) => typeof v === 'number');
      if (key === 'run' || vals.length !== list.length) continue;
      out[key] = Math.round(med(vals) * 1e5) / 1e5; // click times are fractions of a millisecond
      if (/MsPerS$|^frameP|^click(Avg|P95)|^initMs$|^heapMB$/.test(key) && list.length > 1) out[key + 'Range'] = `${Math.min(...vals)}-${Math.max(...vals)}`;
    }
    return out;
  });
}

function markdown(env, rows) {
  const table = (cols, list) => [`| ${cols.join(' | ')} |`, `|${cols.map(() => '---').join('|')}|`, ...list.map((r) => `| ${cols.map((c) => r[c] ?? '').join(' | ')} |`)].join('\n');
  const state = ['scenario', 'impl', 'n', 'initMs', 'heapMB', 'states', 'bindings', 'clicks', 'clickAvgMs', 'clickP95Ms', 'clickP99Ms', 'stateChangesPerS', 'scriptMsPerS', 'styleMsPerS', 'frameP95', 'frameP99', 'heapAfterCleanupMB', 'bindingsAfterCleanup', 'subscriptionsAfterCleanup'];
  const main = ['scenario', 'impl', 'n', 'initMs', 'firstFrameMs', 'heapMB', 'retainedBytesPerElement', 'scriptMsPerS', 'styleMsPerS', 'layoutMsPerS', 'paintMsPerS', 'compositeMsPerS', 'rasterMsPerS', 'frames', 'frameP50', 'frameP95', 'frameP99', 'longFrames'];
  const phases = ['scenario', 'n', 'tickMsPerS', 'sourceMsPerS', 'evalMsPerS', 'writeMsPerS', 'jobsPerS', 'writesPerS', 'bindings', 'subscriptions', 'parseMs'];
  const cleanup = ['scenario', 'impl', 'n', 'heapMB', 'heapAfterCleanupMB', 'bindingsAfterCleanup', 'subscriptionsAfterCleanup'];
  const lib = rows.filter((r) => r.n === 0);
  const sized = rows.filter((r) => r.n > 0);
  return [
    '# Benchmark results', '', 'Generated by `npm run bench`. Methodology: [README](../README.md#performance).', '', '```', JSON.stringify(env, null, 2), '```', '',
    '## Throughput, rendering and frames', '', 'All `...MsPerS` columns are milliseconds of work per second of the 3 s window. `frames` is the sample count for the percentiles.', '',
    table(main, sized.filter((r) => r.scenario !== 'insert' && r.impl !== 'none')), '',
    '## Reactive CSS internal phases (current build only)', '', '`tick` = interval dispatch, `source` = shared event sources, `eval` = expression evaluation and change detection, `write` = DOM writes.', '',
    table(phases, sized.filter((r) => r.impl === 'rcss' && r.evalMsPerS !== undefined)), '',
    '## State, actions and conditions (Phase 5)', '', '`click*` columns time one `element.click()` dispatch: action, state change and notifications (writes happen in the next frame and are in the script/style columns).', '',
    table(state, sized.filter((r) => ['components', 'components_runtime', 'fanout', 'fanout_runtime', 'tabsstate', 'nested', 'statechurn', 'bindtext', 'bindcheck', 'changed', 'keyout', 'attrsplit'].includes(r.scenario))), '',
    '## Insertion and removal', '', table(['impl', 'n', 'insertMs', 'boundAfterInsert', 'removeMs', 'bindingsAfterRemove', 'scheduledAfterRemove'], sized.filter((r) => r.scenario === 'insert')), '',
    '## Memory', '', `Library and compiled rule, no elements: ${lib.map((r) => `${r.impl} ${r.heapMB} MB`).join(', ')}.`, '',
    table(cleanup, sized.filter((r) => r.impl !== 'none')), '',
  ].join('\n');
}
