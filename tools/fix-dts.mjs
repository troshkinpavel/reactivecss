// Adds explicit extensions to relative imports in dist/**/*.d.ts (TypeScript emits them as written,
// extensionless), so the declarations resolve under moduleResolution node16 / nodenext as well as
// bundler. Run after `tsc --emitDeclarationOnly` (npm run build).
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const DIST = resolve(dirname(new URL(import.meta.url).pathname), '../dist');
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.d.ts') ? [p] : []; });
let changed = 0;
for (const file of walk(DIST)) {
  const src = readFileSync(file, 'utf8');
  const out = src.replace(/(from\s+|import\s+|import\s*\(\s*)(['"])(\.\.?\/[^'"]+?)\2/g, (m, pre, q, spec) => {
    if (/\.(js|mjs|cjs|json)$/.test(spec)) return m;
    const base = resolve(dirname(file), spec);
    if (existsSync(base + '.d.ts')) return `${pre}${q}${spec}.js${q}`;
    if (existsSync(join(base, 'index.d.ts'))) return `${pre}${q}${spec}/index.js${q}`;
    return m;
  });
  if (out !== src) { writeFileSync(file, out); changed++; }
}
console.log(`fix-dts: ${changed} declaration files given explicit extensions`);
