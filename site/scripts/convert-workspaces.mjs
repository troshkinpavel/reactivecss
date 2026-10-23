// Converts the Control Center expression registries from the design data
// (design-source/control-center*-src.js) into src/content/workspaces/<id>.entries.json.
// The design's out() functions computed simulated values; they are dropped on purpose:
// the workspace shows values observed in the running preview instead.
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
// The output has been edited since the import (0.5.0 updates). Re-importing replaces it.
if (!process.argv.includes('--force')) {
  console.error('This replaces generated content that has been edited since. Re-run with --force to overwrite.');
  process.exit(1);
}
const load = async (files) => {
  const ctx = { window: {} };
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(await readFile(new URL(`design-source/${f}`, root), 'utf8'), ctx);
  return ctx.window.RCSS_CC.entries.map(({ re, out, ...e }) => ({ ...e, re: re.source === '$^' ? null : re.source, ...(out ? { observes: true } : {}) }));
};
await writeFile(new URL('src/content/workspaces/control-center-deep.entries.json', root), JSON.stringify(await load(['control-center-src.js']), null, 2) + '\n');
await writeFile(new URL('src/content/workspaces/control-center.entries.json', root), JSON.stringify(await load(['control-center-src.js', 'control-center-basic-src.js']), null, 2) + '\n');
console.log('ok');
