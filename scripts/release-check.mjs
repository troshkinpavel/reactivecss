#!/usr/bin/env node
// Checks that every version and publication fact stated in more than one file agrees.
// Plain Node, no dependencies, no network. CI runs it (docs/releasing.md):
//
//   node scripts/release-check.mjs          problems, exit 1; or "consistent", exit 0
//
// It only reads. It never changes a version, publishes, tags or deploys.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const PACKAGES = { core: '@reactivecss/core', mcp: '@reactivecss/mcp' };
const V = '(\\d+\\.\\d+\\.\\d+)';

const read = (root, file) => readFileSync(join(root, file), 'utf8');
const readJson = (root, file) => JSON.parse(read(root, file));
export const compareVersions = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };

/**
 * Every place that states the *current* version of a package. Each pattern captures the version
 * (group 1). Historical mentions ("added in 0.9.0", past release entries) are deliberately not here.
 */
export const VERSION_REFS = {
  core: [
    { file: 'package.json', json: ['version'] },
    { file: 'package-lock.json', json: ['version'] },
    { file: 'package-lock.json', json: ['packages', '', 'version'] },
    { file: 'src/core/version.ts', re: `VERSION = '${V}'` },
    { file: 'README.md', re: `\\*\\*Note: ${V} is experimental\\.\\*\\*` },
    { file: 'README.md', re: `\\[\`@reactivecss/core\`\\]\\([^)]*\\) ${V} and` },
    { file: 'README.md', re: `@reactivecss/core@${V}/`, all: true },
    { file: 'README.md', re: `reactivecss-core-${V}\\.tgz` },
    { file: 'README.md', re: `Measured from the ${V} build` },
    { file: 'docs/library-reference.md', re: `@reactivecss/core\\) on npm \\(${V}\\)` },
    { file: 'site/src/content/docs/installation.mdx', re: `Measured from the ${V} build` },
  ],
  mcp: [
    { file: 'packages/mcp/package.json', json: ['version'] },
    { file: 'packages/mcp/package-lock.json', json: ['version'] },
    { file: 'packages/mcp/package-lock.json', json: ['packages', '', 'version'] },
    { file: 'README.md', re: `\\[\`@reactivecss/mcp\`\\]\\([^)]*\\) ${V}` },
    { file: 'packages/mcp/README.md', re: `The npm release ${V} has knowledge of` },
    { file: 'packages/mcp/README.md', re: `for the npm release ${V}\\)` },
  ],
};

const getPath = (o, path) => path.reduce((x, k) => x?.[k], o);

/** The versions each reference states, or why it could not be read. */
export function readRefs(root, pkg) {
  return VERSION_REFS[pkg].map((r) => {
    if (!existsSync(join(root, r.file))) return { ...r, found: [], error: 'file missing' };
    if (r.json) return { ...r, found: [getPath(readJson(root, r.file), r.json)].filter(Boolean) };
    const found = [...read(root, r.file).matchAll(new RegExp(r.re, 'g'))].map((m) => m[1]);
    return { ...r, found, error: found.length ? undefined : 'pattern not found' };
  });
}

/** `## <version> …` sections of CHANGELOG.md, newest first, with the heading's trailing note. */
export function changelogSections(md) {
  return [...md.matchAll(/^## (\d+\.\d+\.\d+)(?: — ([^\n(]*?))?\s*(?:\(([^)]*)\))?\s*$/gm)].map((m) => ({ version: m[1], title: (m[2] ?? '').trim(), note: m[3] ?? '' }));
}

/** Text of the `## <version>` section of CHANGELOG.md, heading included, or null. */
export function changelogSection(md, version) {
  const m = new RegExp(`^## ${version.replaceAll('.', '\\.')}\\b[\\s\\S]*?(?=^## |(?![\\s\\S]))`, 'm').exec(md);
  return m ? m[0].trim() : null;
}

/** Placeholder release notes: the check fails while the current version's section still has it. */
export const NOTES_PLACEHOLDER = '- Describe the changes.';

// ---------- README bundle sizes ----------
const SIZE_ROWS = [
  ['reactive-css.min.js', '`reactive-css.min.js`'],
  ['reactive-css.compact.min.js', '`reactive-css.compact.min.js` (same runtime, shorter `describe()` registry)'],
  ['reactive-css.js', '`reactive-css.js` (development build, full diagnostic messages)'],
];
const fmt = (n) => n.toLocaleString('en-US') + ' B';
/** Minified and gzip (level 9) sizes of the prebuilt bundles in dist/, or null if dist/ is not a build of `version`. */
export function bundleSizes(root, version) {
  const min = join(root, 'dist/reactive-css.min.js');
  if (!existsSync(min) || !readFileSync(min, 'utf8').includes(`"${version}"`)) return null;
  return SIZE_ROWS.map(([file, label]) => { const b = readFileSync(join(root, 'dist', file)); return { file, label, min: b.length, gzip: gzipSync(b, { level: 9 }).length }; });
}
/** README's bundle table for `bundleSizes` rows. */
export const sizeTable = (rows) => ['| File | Minified | gzip |', '|---|---:|---:|', ...rows.map((r) => `| ${r.label} | ${fmt(r.min)} | ${fmt(r.gzip)} |`)].join('\n');

/**
 * Every version and publication fact that is stated in more than one place. Problems only, no
 * network: CI runs this before and after a publication, so nothing here assumes either state.
 */
export function checkConsistency(root) {
  const problems = [];
  const p = (file, message) => problems.push({ file, message });
  const versions = {};
  for (const pkg of Object.keys(VERSION_REFS)) {
    const refs = readRefs(root, pkg);
    versions[pkg] = refs[0].found[0];
    for (const r of refs) {
      if (r.error) p(r.file, `${pkg} version reference ${r.json ? r.json.join('.') : r.re}: ${r.error}`);
      for (const v of r.found) if (v !== versions[pkg]) p(r.file, `states ${pkg} ${v}, package.json is ${versions[pkg]}`);
    }
  }
  const core = versions.core, mcp = versions.mcp;
  const sections = changelogSections(read(root, 'CHANGELOG.md'));
  if (sections[0]?.version !== core) p('CHANGELOG.md', `newest section is ${sections[0]?.version}, package.json is ${core}`);
  if (changelogSection(read(root, 'CHANGELOG.md'), core)?.includes(NOTES_PLACEHOLDER)) p('CHANGELOG.md', `the ${core} section still has the placeholder: write the release notes`);

  const dist = readJson(root, 'site/config/distribution.json');
  for (const [pkg, current] of [['core', core], ['mcp', mcp]]) {
    const list = dist[pkg].npmVersions;
    if (dist[pkg].package !== PACKAGES[pkg]) p('site/config/distribution.json', `${pkg}.package is ${dist[pkg].package}`);
    if (new Set(list).size !== list.length) p('site/config/distribution.json', `${pkg}.npmVersions has duplicates`);
    if ([...list].sort(compareVersions).join() !== list.join()) p('site/config/distribution.json', `${pkg}.npmVersions is not in version order`);
    for (const v of list) if (compareVersions(v, current) > 0) p('site/config/distribution.json', `${pkg}.npmVersions lists ${v}, newer than package.json ${current}`);
    if (pkg === 'core') for (const v of list) {
      const s = sections.find((x) => x.version === v);
      if (!s) p('CHANGELOG.md', `published core ${v} has no section`);
      else if (/unpublished/i.test(s.note)) p('CHANGELOG.md', `published core ${v} is still marked "${s.note}"`);
    }
  }

  // MCP knowledge: the Core release it describes must be published, or be the current Core version.
  const mcpPkg = readJson(root, 'packages/mcp/package.json');
  const knowledge = mcpPkg.reactivecss?.knowledge, supports = mcpPkg.reactivecss?.supports;
  if (!knowledge) p('packages/mcp/package.json', 'reactivecss.knowledge is missing');
  else {
    if (knowledge !== core && !dist.core.npmVersions.includes(knowledge)) p('packages/mcp/package.json', `reactivecss.knowledge ${knowledge} is neither published nor the current core ${core}`);
    if (supports && !new RegExp(`^${supports.replaceAll('.', '\\.').replaceAll('x', '\\d+')}$`).test(knowledge)) p('packages/mcp/package.json', `reactivecss.knowledge ${knowledge} is outside reactivecss.supports ${supports}`);
    const readme = read(root, 'packages/mcp/README.md');
    for (const m of readme.matchAll(new RegExp(`has knowledge of ${V}|\\(${V} for the npm release`, 'g'))) if ((m[1] ?? m[2]) !== knowledge) p('packages/mcp/README.md', `states knowledge ${m[1] ?? m[2]}, package.json reactivecss.knowledge is ${knowledge}`);
  }
  const agents = existsSync(join(root, 'packages/mcp/AGENTS.md')) ? /Generated by @reactivecss\/mcp (\S+) \(scripts\/build\.mjs\) for Reactive CSS (\S+)\./.exec(read(root, 'packages/mcp/AGENTS.md')) : null;
  if (agents && (agents[1] !== mcp || agents[2] !== knowledge)) p('packages/mcp/AGENTS.md', `generated for mcp ${agents[1]} / core ${agents[2]}; run npm run build in packages/mcp`);

  const sizes = bundleSizes(root, core);
  if (sizes) {
    const md = read(root, 'README.md');
    // Minified bytes only: gzip output differs between zlib versions (CI and local Node), so an exact
    // gzip comparison would fail for reasons unrelated to the release.
    for (const s of sizes) if (!md.includes(`| ${s.label} | ${fmt(s.min)} |`)) p('README.md', `${s.file} is ${fmt(s.min)} in dist/; update the README bundle table`);
  }
  return { versions: { core, mcp, knowledge }, problems };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = checkConsistency(fileURLToPath(new URL('..', import.meta.url)));
  if (r.problems.length) { for (const x of r.problems) console.error(`${x.file}: ${x.message}`); process.exit(1); }
  console.log(`consistent: core ${r.versions.core}, mcp ${r.versions.mcp} (knowledge ${r.versions.knowledge})`);
}
