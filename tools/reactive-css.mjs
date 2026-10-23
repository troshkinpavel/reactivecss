#!/usr/bin/env node
// reactive-css: custom bundle builder and CSS feature analyzer (0.8.0). Docs: docs/bundle-builder-0.8.md.
//
//   reactive-css features [--json]
//   reactive-css resolve  --features events,focus [--exclude x] [--json]
//   reactive-css build    (--features a,b | --profile name) [--exclude x] [--format iife|esm] [--no-minify]
//                         [--out dist/custom/reactive-css.custom.min.js] [--json]
//   reactive-css analyze  <file.css|page.html|dir>... [--root <dir>] [--assume-complete] [--build <outfile>] [--json]
//   reactive-css explain  "<production diagnostic, e.g. RCSS-P012⟦…⟧>"   (offline; codes in dist/diagnostics.json)
//
// Exit codes: 0 ok, 1 invalid input (unknown feature, conflict), 2 internal error.

// explain needs no esbuild: production diagnostics are decoded from the code registry alone.
if (process.argv[2] === 'explain') {
  const { explain } = await import('./diagnostics.mjs');
  const text = process.argv.slice(3).filter((a) => a !== '--json').join(' ');
  if (!text) { console.error('error [no-input]: give a production diagnostic, e.g. reactive-css explain "RCSS-P012⟦:on()⟧⟦events⟧".'); process.exit(1); }
  const full = explain(text);
  console.log(process.argv.includes('--json') ? JSON.stringify({ ok: true, text: full }, null, 2) : full);
  process.exit(0);
}

// Loaded here, not imported statically, so a missing esbuild gets a clear message.
let tools;
try { tools = await import('./bundle.mjs'); } catch (e) {
  console.error(e.code === 'ERR_MODULE_NOT_FOUND' && /esbuild/.test(e.message)
    ? 'error [no-esbuild]: the bundle builder needs esbuild (npm install --save-dev esbuild).'
    : `internal error: ${e.stack ?? e}`);
  process.exit(2);
}
const { catalog, resolve, build, analyze } = tools;

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name) => rest.includes(`--${name}`);
const opt = (name) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : rest.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3); };
const list = (name) => (opt(name) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const json = flag('json');
const out = (data, text) => { console.log(json ? JSON.stringify(data, null, 2) : text()); };
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const fail = (errors) => { out({ ok: false, errors }, () => errors.map((e) => `error [${e.code}]: ${e.message}`).join('\n')); process.exit(1); };

function report(m) {
  const lines = [
    `Features: ${m.features.join(', ')}`,
    ...(m.added.length ? [`Added automatically: ${m.added.map((a) => `${a.id} (required by ${a.requiredBy})`).join(', ')}`] : []),
    ...(m.optionalMissing?.length ? [`Optional, not included: ${m.optionalMissing.map((o) => `${o.id} (useful for ${o.usefulFor})`).join(', ')}`] : []),
    `Excluded: ${m.excluded.join(', ') || 'none'}`,
    `Size: ${m.sizes.minified} B minified (${kb(m.sizes.minified)}), ${m.sizes.gzip} B gzip, ${m.sizes.brotli} B brotli`,
  ];
  return lines.join('\n');
}

try {
  if (cmd === 'features') {
    const c = catalog();
    out(c, () => c.features.map((f) => `${f.id.padEnd(11)} ${f.category.padEnd(24)} ${f.status.padEnd(12)} requires: ${f.requires.join(', ') || '—'}\n            ${f.syntax.join(' · ')}`).join('\n'));
  } else if (cmd === 'resolve') {
    const r = resolve({ features: list('features'), exclude: list('exclude'), profile: opt('profile') });
    if (r.errors.length) fail(r.errors);
    out(r, () => `Features: ${r.features.join(', ')}${r.added.length ? `\nAdded automatically: ${r.added.map((a) => `${a.id} (required by ${a.requiredBy})`).join(', ')}` : ''}`);
  } else if (cmd === 'build') {
    if (!opt('features') && !opt('profile')) fail([{ code: 'no-features', message: 'Give --features a,b,c or --profile name (see "reactive-css features").' }]);
    const outfile = opt('out') ?? 'dist/custom/reactive-css.custom.min.js';
    const r = await build({ features: list('features'), exclude: list('exclude'), profile: opt('profile'), format: opt('format') ?? 'iife', minify: !flag('no-minify'), outfile });
    if (!r.ok) fail(r.errors);
    out({ ok: true, outfile, manifest: r.manifest }, () => `Built ${outfile}\n${report(r.manifest)}\nManifest: ${outfile.replace(/\.js$/, '')}.manifest.json`);
  } else if (cmd === 'analyze') {
    const inputs = rest.filter((a, i) => !a.startsWith('--') && rest[i - 1] !== '--build' && rest[i - 1] !== '--root');
    if (!inputs.length) fail([{ code: 'no-input', message: 'Give stylesheet files, HTML files or directories to analyze.' }]);
    const a = await analyze(inputs, { assumeComplete: flag('assume-complete'), root: opt('root') });
    let built;
    if (opt('build')) {
      const r = await build({ ...(a.recommended.profile ? { profile: a.recommended.profile } : { features: a.recommended.features }), outfile: opt('build') });
      if (!r.ok) fail(r.errors);
      built = { outfile: opt('build'), manifest: r.manifest };
    }
    out({ ...a, built }, () => [
      `Stylesheets analyzed: ${a.sheets}`,
      `Features used: ${a.used.join(', ') || 'core only'}`,
      ...(a.added.length ? [`Required as well: ${a.added.map((x) => `${x.id} (by ${x.requiredBy})`).join(', ')}`] : []),
      a.complete ? `Recommended: --features ${a.used.join(',') || '(core only)'}` : `Recommended: the full runtime (${a.recommended.reason}).`,
      ...a.notes.map((n) => `${n.severity === 'info' ? 'note' : 'warning'} [${n.code}]${n.file ? ` ${n.file}` : ''}: ${n.message}`),
      ...a.files.flatMap((f) => f.diagnostics.map((d) => `diagnostic ${f.path}: ${d}`)),
      ...(built ? [`Built ${built.outfile}${a.complete ? '' : ' (the full runtime: the analysis is incomplete, so this is not a minimal selection)'}`, report(built.manifest)] : []),
    ].join('\n'));
  } else {
    console.log('Usage: reactive-css <features|resolve|build|analyze|explain> … (see docs/bundle-builder-0.8.md)');
    process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  console.error(`internal error: ${e.stack ?? e}`);
  process.exit(2);
}
