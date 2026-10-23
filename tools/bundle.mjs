// Reactive CSS bundle tooling (0.8.0): feature catalog, dependency resolution, custom builds and
// static CSS analysis. Programmatic API, used by tools/reactive-css.mjs (CLI) and meant for the
// website's bundle builder later. Reference: docs/bundle-builder-0.8.md.
//
//   import { catalog, resolve, build, analyze } from './tools/bundle.mjs';
//
// Every result is plain JSON. Errors are { code, message, feature? } objects, never thrown for
// user input (only for internal failures).

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, isAbsolute, resolve as resolvePath, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import * as esbuild from 'esbuild';
import { diagnosticsPlugin, explain } from './diagnostics.mjs';
export { explain };
export const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
// Loaded through esbuild, not imported: Node does not strip types under node_modules.
const tsModule = async (file) => import('data:text/javascript;base64,' + Buffer.from((await esbuild.build({
  entryPoints: [join(ROOT, file)], bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'silent' })).outputFiles[0].text).toString('base64'));
const { CATALOG, PROFILES } = await tsModule('src/features/catalog.ts');
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const BY_ID = new Map(CATALOG.map((f) => [f.id, f]));
export const TARGET = ['chrome111', 'firefox113', 'safari16.4'];

/** The catalog as JSON (for tools and the website): features, profiles, version. */
export function catalog() {
  return { version: VERSION, features: CATALOG, profiles: PROFILES };
}

/** Which catalog feature provides a usage key (`fn:live`, `trigger:click`, `act:set`…). Exact keys win over wildcards. */
export function featureOfKey(key) {
  for (const f of CATALOG) if (f.provides.includes(key)) return f.id;
  for (const f of CATALOG) for (const p of f.provides) {
    if (p.endsWith(':*') && key.startsWith(p.slice(0, -1))) return f.id;
  }
  return undefined;
}

/** 0.8 declarations that 0.9 writes differently (they keep working; docs/migration-0.9.md). */
const LEGACY = {
  'decl:on': '.x:on(event) { --state: action() }',
  'decl:text': 'content: <value>',
  'decl:attr': '--attr-<attribute>: <value>',
};

/** API registry entries whose usage key is not `<kind>:<name>` (0.9.0 rule-level syntax). */
const ENTRY_KEYS = { 'rule:on': 'sel:on', 'rule:drag': 'gesture:drag', 'declaration:--attr-*': 'decl:attr-ns', 'declaration:persist': 'decl:state-persist', 'declaration:bind()': 'decl:state-form' };

/** The usage key of an API registry entry (core/features.ts). */
export function keyOfApiEntry(e) {
  if (e.kind === 'function' && e.name === 'state') return 'decl:state';
  if (ENTRY_KEYS[`${e.kind}:${e.name}`]) return ENTRY_KEYS[`${e.kind}:${e.name}`];
  const prefix = { function: 'fn', expression: 'expr', selector: 'sel', declaration: 'decl', trigger: 'trigger', action: 'act', rule: 'sel' }[e.kind];
  return prefix ? `${prefix}:${e.name}` : undefined;
}

/** Edit distance (Levenshtein), for "did you mean". */
const distance = (a, b) => {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return d[b.length];
};
const suggest = (id) => {
  const [best] = [...BY_ID.keys()].map((x) => [x, distance(id, x)]).sort((x, y) => x[1] - y[1]);
  return best[1] <= 3 ? ` Did you mean "${best[0]}"?` : '';
};

/**
 * Resolves a selection: { features: [...], exclude?: [...] } or a profile name.
 * Returns { features, requested, added: [{ id, requiredBy }], optionalMissing, errors }.
 */
export function resolve(selection) {
  const sel = typeof selection === 'string' ? { profile: selection } : selection ?? {};
  const errors = [];
  let requested = sel.features ?? [];
  if (sel.profile) {
    if (!PROFILES[sel.profile]) errors.push({ code: 'unknown-profile', message: `Unknown profile "${sel.profile}". Profiles: ${Object.keys(PROFILES).join(', ')}.` });
    else requested = [...PROFILES[sel.profile], ...requested];
  }
  requested = [...new Set(requested.map((x) => String(x).trim()).filter(Boolean))];
  const exclude = new Set((sel.exclude ?? []).map((x) => String(x).trim()));
  for (const id of [...requested, ...exclude]) {
    if (!BY_ID.has(id)) errors.push({ code: 'unknown-feature', feature: id, message: `Unknown feature "${id}".${suggest(id)} Features: ${[...BY_ID.keys()].join(', ')}.` });
  }
  if (exclude.has('core')) errors.push({ code: 'core-required', feature: 'core', message: 'The core cannot be excluded: every feature needs the parser, state engine and scheduler.' });
  const included = new Set(['core']);
  const added = [];
  const visit = (id, by) => {
    if (included.has(id) || !BY_ID.has(id)) return;
    if (exclude.has(id)) {
      errors.push({ code: 'conflict', feature: id, message: `"${id}" is excluded, but "${by}" requires it. Remove "${id}" from the exclusions or "${by}" from the features.` });
      return;
    }
    included.add(id);
    if (by) added.push({ id, requiredBy: by });
    for (const r of BY_ID.get(id).requires) visit(r, id);
  };
  for (const id of requested) if (BY_ID.has(id) && !exclude.has(id)) visit(id, undefined);
  for (const id of requested) if (exclude.has(id)) errors.push({ code: 'conflict', feature: id, message: `"${id}" is both requested and excluded.` });
  // Catalog order, so equal selections give byte-identical bundles.
  const features = CATALOG.map((f) => f.id).filter((id) => included.has(id));
  const optionalMissing = features.flatMap((id) => BY_ID.get(id).optional.filter((o) => !included.has(o)).map((o) => ({ id: o, usefulFor: id })));
  return { features, requested, added, optionalMissing, errors };
}

/** gzip (level 9) and brotli (quality 11) sizes of a string or buffer. */
export function sizes(code) {
  const b = Buffer.from(code);
  return { minified: b.length, gzip: gzipSync(b, { level: 9 }).length, brotli: brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length };
}

/** API registry entries (core/features.ts) of the included features, compact form. */
async function compactRegistry(included) {
  const mod = await tsModule('src/core/features.ts');
  const keep = mod.FEATURES.filter((e) => {
    if (!['stable', 'experimental'].includes(e.status)) return false;
    const k = keyOfApiEntry(e);
    const f = k && featureOfKey(k);
    return f && included.has(f);
  }).map(({ name, kind, status, since, syntax }) => ({ name, kind, status, since, syntax }));
  return { features: keep, keepNative: mod.KEEP_NATIVE };
}

/**
 * Builds a real bundle. config: { features | profile, exclude?, format: 'iife' (default, starts
 * itself, sets window.ReactiveCSS) | 'esm', minify (default true), outfile? }.
 * Returns { ok, code, manifest, errors }. Writes outfile (and outfile.manifest.json) when given.
 */
export async function build(config = {}) {
  const r = resolve(config);
  if (r.errors.length) return { ok: false, errors: r.errors, manifest: null, code: null };
  const included = new Set(r.features);
  const format = config.format ?? 'iife';
  const minify = config.minify ?? true;
  // Usage keys of the left-out features: their syntax is reported instead of ignored (parser.ts).
  const excluded = {};
  for (const f of CATALOG) if (!included.has(f.id)) for (const p of f.provides) if (!p.endsWith(':*') && (p.startsWith('fn:') || p.startsWith('sel:'))) excluded[p] = f.id;
  const imports = r.features.map((id) => BY_ID.get(id).entry).filter(Boolean).map((e) => `import ${JSON.stringify('./' + e)};`).join('\n');
  const contents = format === 'esm'
    ? `${imports}\nexport * from './src/api.ts';\n`
    : `${imports}\nimport * as ReactiveCSS from './src/api.ts';\nwindow.ReactiveCSS = ReactiveCSS;\nif (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => ReactiveCSS.start());\nelse ReactiveCSS.start();\n`;
  const registry = await compactRegistry(included);
  const result = await esbuild.build({
    stdin: { contents, resolveDir: ROOT, loader: 'ts', sourcefile: 'reactive-css.custom.ts' },
    bundle: true, format, minify, target: TARGET, write: false, metafile: true, logLevel: 'silent',
    define: { __DEV__: minify ? 'false' : 'true', __RCSS_EXCLUDED__: JSON.stringify(excluded), __RCSS_BUNDLE__: JSON.stringify(r.features) },
    // Minified bundles are production bundles: diagnostic codes instead of message text (tools/diagnostics.mjs).
    plugins: [...(minify ? [diagnosticsPlugin()] : []), { name: 'feature-registry', setup(b) {
      b.onLoad({ filter: /src[\\/]core[\\/]features\.ts$/ }, () => ({ loader: 'ts',
        contents: `export const FEATURES: any[] = ${JSON.stringify(registry.features)};\nexport const KEEP_NATIVE = ${JSON.stringify(registry.keepNative)};\n` }));
    } }],
  });
  const code = result.outputFiles[0].text;
  const modules = Object.keys(result.metafile.inputs).map((p) => p.replace(/^.*?src\//, 'src/')).filter((p) => p.startsWith('src/')).sort();
  const manifest = {
    name: 'reactive-css', version: VERSION, format, minify,
    features: r.features, requested: r.requested, added: r.added, excluded: CATALOG.map((f) => f.id).filter((id) => !included.has(id)),
    optionalMissing: r.optionalMissing,
    provides: r.features.flatMap((id) => BY_ID.get(id).provides),
    sizes: sizes(code), modules,
  };
  if (config.outfile) {
    const { mkdirSync, writeFileSync } = await import('node:fs');
    mkdirSync(dirname(config.outfile), { recursive: true });
    writeFileSync(config.outfile, code);
    writeFileSync(config.outfile.replace(/\.js$/, '') + '.manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  }
  return { ok: true, code, manifest, errors: [] };
}

// ---- analysis -------------------------------------------------------------------------------

let compilerPromise;
/** The real compiler with every feature registered (bundled from src in memory). */
function compiler() {
  compilerPromise ??= esbuild.build({ entryPoints: [join(ROOT, 'src/index.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'silent', define: { __DEV__: 'true' } })
    .then((r) => import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64')));
  return compilerPromise;
}

const decode = (s) => { try { return decodeURI(s); } catch { return s; } };

/**
 * Stylesheets of an HTML file: inline <style> blocks and local <link rel="stylesheet"> files.
 * A root-relative href (/x.css) is resolved against `root` only: without it the location is
 * unknown, and guessing (the filesystem root, the page's folder) could analyze the wrong file.
 */
function sheetsOfHtml(path, html, notes, root) {
  const out = [];
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) out.push({ path: `${path} <style>`, text: m[1] });
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/\brel\s*=\s*["']?[^"'>]*stylesheet/i.test(tag)) continue;
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href) continue;
    if (/^[a-z]+:|^\/\//i.test(href)) { notes.push({ code: 'remote-stylesheet', file: path, message: `Linked stylesheet ${href} is not local and was not analyzed.` }); continue; }
    const local = decode(href.replace(/[?#].*$/, ''));
    let file;
    if (local.startsWith('/')) {
      if (!root) { notes.push({ code: 'root-relative-link', file: path, message: `Linked stylesheet ${href} is relative to the site root, which was not given: it was not analyzed. Pass --root <dir> (option root) with the folder the site serves as "/".` }); continue; }
      file = join(root, local);
      const rel = relative(root, file);
      if (rel.startsWith('..') || isAbsolute(rel)) { notes.push({ code: 'missing-file', file: path, message: `Linked stylesheet ${href} points outside the root ${root}.` }); continue; }
    } else file = resolvePath(dirname(path), local);
    if (existsSync(file) && statSync(file).isFile()) out.push({ path: file, text: readFileSync(file, 'utf8') });
    else notes.push({ code: 'missing-file', file: path, message: `Linked stylesheet ${href} was not found${local.startsWith('/') ? ` under the root ${root}` : ''}.` });
  }
  // Scripts other than Reactive CSS itself may create or change stylesheets at runtime.
  const others = [...html.matchAll(/<script\b([^>]*)>/gi)].filter((m) => !/\bsrc\s*=\s*["'][^"']*reactive-css[^"']*["']/i.test(m[1]));
  if (others.length) notes.push({ code: 'scripts-present', file: path, message: 'The page has other scripts: stylesheets they create or change at runtime are not analyzed. The safe recommendation is the full runtime (or confirm with assumeComplete / --assume-complete).' });
  return out;
}

function collect(inputs, notes, root) {
  const sheets = [];
  const walk = (p) => {
    if (!existsSync(p)) { notes.push({ code: 'missing-file', file: p, message: `${p} does not exist.` }); return; }
    if (statSync(p).isDirectory()) { for (const f of readdirSync(p)) if (!f.startsWith('.') && f !== 'node_modules') walk(join(p, f)); return; }
    const ext = extname(p).toLowerCase();
    if (ext === '.css') sheets.push({ path: p, text: readFileSync(p, 'utf8') });
    else if (ext === '.html' || ext === '.htm') sheets.push(...sheetsOfHtml(p, readFileSync(p, 'utf8'), notes, root));
  };
  for (const i of inputs) {
    if (typeof i === 'object') sheets.push({ path: i.path ?? '(inline)', text: i.text });
    else walk(resolvePath(i));
  }
  return [...new Map(sheets.map((s) => [s.path, s])).values()];
}

/**
 * Analyzes stylesheets with the real compiler. inputs: file or directory paths (.css, .html), or
 * { path, text } objects. options.assumeComplete: trust that no other stylesheet is created at
 * runtime (by scripts). options.root: the folder the site serves as "/", for root-relative links
 * (/x.css) in HTML files. Returns { complete, features, recommended, uses, files, notes }.
 */
export async function analyze(inputs, options = {}) {
  const notes = [];
  let root;
  if (options.root) {
    root = resolvePath(options.root);
    if (!existsSync(root) || !statSync(root).isDirectory()) { notes.push({ code: 'missing-file', file: root, message: `The root ${root} is not a folder.` }); root = undefined; }
  }
  const sheets = collect(inputs, notes, root);
  const { compile, diagnostics } = await compiler();
  const used = new Set(), files = [], unknown = new Set();
  for (const s of sheets) {
    diagnostics.length = 0;
    let c;
    try { c = compile(s.text, { trusted: true }); } catch (e) { notes.push({ code: 'compile-error', file: s.path, message: e.message }); continue; }
    const fileUses = [...c.uses].sort();
    for (const k of fileUses) { used.add(k); if (!featureOfKey(k)) unknown.add(k); }
    if (/@import\b/i.test(s.text)) notes.push({ code: 'import-not-followed', file: s.path, message: '@import rules are not followed: analyze the imported files too.' });
    const legacy = fileUses.filter((k) => LEGACY[k]).map((k) => ({ syntax: k.slice(5) + ':', use: LEGACY[k] }));
    files.push({ path: s.path, uses: fileUses, features: [...new Set(fileUses.map(featureOfKey).filter(Boolean))], diagnostics: [...diagnostics], legacy });
  }
  for (const k of unknown) notes.push({ code: 'unknown-syntax', message: `Usage "${k}" belongs to no catalog feature.` });
  const direct = [...new Set([...used].map(featureOfKey).filter(Boolean))].filter((f) => f !== 'core');
  const r = resolve({ features: direct });
  // assumeComplete: the caller confirms no other stylesheet exists (scripts, dynamic sheets).
  const incomplete = notes.some((n) => n.severity !== 'info' && !(options.assumeComplete && n.code === 'scripts-present'));
  return {
    complete: !incomplete && sheets.length > 0,
    sheets: sheets.length,
    features: r.features, used: direct, added: r.added, optionalMissing: r.optionalMissing,
    uses: [...used].sort(),
    recommended: !incomplete && sheets.length ? { features: direct } : { profile: 'full', reason: sheets.length ? 'analysis incomplete (see notes)' : 'no stylesheet found' },
    files, notes,
  };
}
