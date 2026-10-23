// Heap growth by object type between two points of a mount/unmount run (0.4 audit).
//   node benchmarks/audit/heapdiff.mjs --n=1000 --from=200 --to=1000
import { launch, open, frames, heapSnapshot } from './lib.mjs';
import { FULL_CSS, COMPONENT, HELPERS } from './memory.mjs';
const arg = (k, d) => +(process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d);
const N = arg('n', 1000), FROM = arg('from', 200), TO = arg('to', 1000);
const env = await launch();
const p = await open(env, { before: HELPERS, head: `<style>${FULL_CSS}</style>`, body: '<div id="host"></div>' });
const cycle = () => p.page.evaluate(([h, n]) => __cycle(h, n, false), [COMPONENT, N]);
let a;
for (let c = 1; c <= TO; c++) {
  await cycle();
  if (c === FROM) { await frames(p.page, 3); a = await heapSnapshot(p.cdp, { aggregate: true }); }
}
await frames(p.page, 3);
const b = await heapSnapshot(p.cdp, { aggregate: true, largest: 'array', paths: 3 });
for (const x of b.retainerPaths) console.log(x.replace(/http:\/\/localhost:\d+/g, '').slice(-300));
const rows = Object.keys({ ...a.groups, ...b.groups }).map((k) => [k, (b.groups[k]?.[0] ?? 0) - (a.groups[k]?.[0] ?? 0), (b.groups[k]?.[1] ?? 0) - (a.groups[k]?.[1] ?? 0)]).sort((x, y) => y[2] - x[2]);
console.log(`total ${(a.totalBytes / 1048576).toFixed(2)} -> ${(b.totalBytes / 1048576).toFixed(2)} MB between cycle ${FROM} and ${TO}`);
for (const [k, dc, ds] of rows.slice(0, 15)) console.log(`${(ds / 1024).toFixed(1).padStart(8)} KB ${String(dc).padStart(7)}  ${k}`);
await env.close();
