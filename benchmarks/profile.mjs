// Heap and CPU profile of one benchmark scenario, summarized by constructor / function.
// Usage: node benchmarks/profile.mjs <scenario> <n> <impl>   e.g. live200 10000 baseline
import { chromium } from '@playwright/test';
import { startServer } from './server.mjs';

const [scenario = 'live200', n = '10000', impl = 'rcss'] = process.argv.slice(2);
const server = await startServer();
const PORT = server.port;
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const cdp = await page.context().newCDPSession(page);
  await page.goto(`http://localhost:${PORT}/benchmarks/bench.html?scenario=${scenario}&n=${n}&impl=${impl}&build=dev`); // dev build: readable function names
  await page.waitForFunction(() => window.bench, null, { timeout: 120000 });

  // Heap snapshot: self size grouped by node type + name.
  let chunks = '';
  cdp.on('HeapProfiler.addHeapSnapshotChunk', (e) => { chunks += e.chunk; });
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  const snap = JSON.parse(chunks);
  const f = snap.snapshot.meta.node_fields, types = snap.snapshot.meta.node_types[0];
  const W = f.length, iT = f.indexOf('type'), iN = f.indexOf('name'), iS = f.indexOf('self_size');
  const groups = new Map();
  let total = 0;
  for (let i = 0; i < snap.nodes.length; i += W) {
    const key = `${types[snap.nodes[i + iT]]}:${snap.strings[snap.nodes[i + iN]].slice(0, 40)}`;
    const g = groups.get(key) ?? { count: 0, bytes: 0 };
    g.count++; g.bytes += snap.nodes[i + iS]; total += snap.nodes[i + iS];
    groups.set(key, g);
  }
  console.log(`heap total ${(total / 1048576).toFixed(1)} MB (${scenario}, n=${n}, ${impl})`);
  for (const [k, g] of [...groups].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 22))
    console.log(`${(g.bytes / 1024).toFixed(0).padStart(8)} KB ${String(g.count).padStart(8)}  ${k}`);

  // CPU profile over 3 s of the workload: self time by function.
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
  await cdp.send('Profiler.start');
  await page.evaluate(() => bench.drive());
  await page.waitForTimeout(3000);
  const { profile } = await cdp.send('Profiler.stop');
  const dt = new Map();
  profile.samples.forEach((id, i) => dt.set(id, (dt.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0)));
  const self = new Map();
  for (const node of profile.nodes) {
    const cf = node.callFrame;
    const key = `${cf.functionName || '(anon)'} ${cf.url.split('/').pop()}:${cf.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + (dt.get(node.id) ?? 0));
  }
  console.log('\nCPU self time over 3 s (ms):');
  for (const [k, us] of [...self].filter(([k]) => !k.startsWith('(idle)')).sort((a, b) => b[1] - a[1]).slice(0, 18))
    console.log(`${(us / 1000).toFixed(1).padStart(8)}  ${k}`);
} finally {
  await browser.close();
  server.stop();
}
