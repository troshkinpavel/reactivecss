// Composition of the full production bundle (docs/release-0.9.0-hardening.md, section B).
//   node benchmarks/v090/composition.mjs [--out=name]
// Builds src/auto.ts exactly as build.mjs builds dist/reactive-css.min.js (minified, __DEV__ false,
// the production plugins of build.mjs) with a metafile, then reports per module and per area:
//   minified bytes in the bundle (esbuild bytesInOutput: additive), and the module compressed on
//   its own (gzip / brotli: NOT additive, shown only to compare modules with each other), and the
//   bytes of string literals of 20+ characters containing a space (diagnostic text, approximately).
// Writes benchmarks/v090/composition[-name].{json,md}.
import * as esbuild from 'esbuild';
import { writeFileSync } from 'node:fs';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { productionPlugins, common } from '../../build.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const name = process.argv.find((a) => a.startsWith('--out='))?.slice(6);
const gz = (s) => gzipSync(s, { level: 9 }).length;
const br = (s) => brotliCompressSync(s, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;

const AREAS = [
  ['parser / compiler', /core\/(parser|tokenizer)\.ts$/],
  ['API registry (describe())', /core\/features\.ts$/],
  ['engine, elements, scheduler, registry, log', /core\/(engine|elements|scheduler|registry|log|config|format|version)\.ts$/],
  ['state engine and values', /state\/(state|values|expr|keys|textof)\.ts$/],
  ['events: legacy on: and dispatcher', /state\/actions\.ts$/],
  ['events: :on() runtime', /state\/on\.ts$/],
  ['events: event-time evaluator', /state\/actexpr\.ts$/],
  ['gestures', /state\/gesture\.ts$/],
  ['persistence', /state\/persist\.ts$/],
  ['forms binding', /state\/bind\.ts$|selectors\/just-checked\.ts$/],
  ['attributes', /state\/(attrdecl|bindattr|bindattr-runtime)\.ts$/],
  ['text', /state\/text\.ts$/],
  ['focus and blur', /state\/focusdecl\.ts$|selectors\/blur\.ts$/],
  ['conditions, history, nth-var', /state\/(conditions|history|changed)\.ts$|selectors\/nth-var\.ts$/],
  ['values, sources, live, geometry', /functions\/|state\/typed\.ts$/],
  ['entry points', /(api|auto|index)\.ts$|features\/[a-z-]+\.ts$/],
];

const r = await esbuild.build({ ...common, entryPoints: [ROOT + 'src/auto.ts'], format: 'iife', minify: true, write: false, metafile: true, sourcemap: false, logLevel: 'silent',
  define: { ...common.define, __DEV__: 'false' }, plugins: productionPlugins() });
const code = r.outputFiles[0].text;
const out = Object.values(r.metafile.outputs)[0];
const modules = [];
for (const [path, v] of Object.entries(out.inputs)) {
  const rel = path.replace(/^.*?src\//, 'src/');
  // The module minified on its own, for its compressed size and its diagnostic text.
  const alone = await esbuild.build({ entryPoints: [ROOT + rel], bundle: false, minify: true, write: false, format: 'esm', logLevel: 'silent',
    define: { __DEV__: 'false' }, plugins: productionPlugins() }).then((x) => x.outputFiles[0].text).catch(() => '');
  const strings = (alone.match(/`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g) ?? []).filter((s) => s.length >= 22 && / /.test(s));
  modules.push({ module: rel, min: v.bytesInOutput, gzipAlone: alone ? gz(alone) : 0, brotliAlone: alone ? br(alone) : 0, messageBytes: strings.join('').length });
}
modules.sort((a, b) => b.min - a.min);
const areas = AREAS.map(([label, re]) => {
  const ms = modules.filter((m) => re.test(m.module));
  return { area: label, modules: ms.length, min: ms.reduce((s, m) => s + m.min, 0), messageBytes: ms.reduce((s, m) => s + m.messageBytes, 0) };
});
const unassigned = modules.filter((m) => !AREAS.some(([, re]) => re.test(m.module)));
const total = { min: code.length, gzip: gz(code), brotli: br(code), messageBytes: modules.reduce((s, m) => s + m.messageBytes, 0) };
const res = { date: new Date().toISOString(), total, areas, modules, unassigned: unassigned.map((m) => m.module) };
const base = ROOT + `benchmarks/v090/composition${name ? '-' + name : ''}`;
writeFileSync(base + '.json', JSON.stringify(res, null, 1) + '\n');
const L = [`# Full production bundle composition${name ? ` (${name})` : ''}`, '', `Total: ${total.min} B minified, ${total.gzip} B gzip, ${total.brotli} B brotli. Long string literals (≈ diagnostic text): ${total.messageBytes} B.`, '',
  '## By area (minified bytes in the bundle: additive)', '', '| Area | Modules | Minified | Share | Long strings |', '|---|---:|---:|---:|---:|',
  ...areas.map((a) => `| ${a.area} | ${a.modules} | ${a.min} | ${(100 * a.min / total.min).toFixed(1)}% | ${a.messageBytes} |`), '',
  '## By module', '', 'gzip / brotli of the module minified alone: for comparing modules, not additive.', '', '| Module | Minified in bundle | gzip alone | brotli alone | Long strings |', '|---|---:|---:|---:|---:|',
  ...modules.map((m) => `| ${m.module} | ${m.min} | ${m.gzipAlone} | ${m.brotliAlone} | ${m.messageBytes} |`), ''];
writeFileSync(base + '.md', L.join('\n'));
console.log(L.slice(0, 24).join('\n'));
