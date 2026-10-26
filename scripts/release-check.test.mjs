// node --test scripts/release-check.test.mjs
// Fixtures are temporary copies of the files the check reads. Nothing here touches the network
// or the real checkout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as check from './release-check.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FILES = ['package.json', 'package-lock.json', 'src/core/version.ts', 'README.md', 'CHANGELOG.md', 'docs/library-reference.md', 'site/src/content/docs/installation.mdx', 'site/config/distribution.json', 'packages/mcp/package.json', 'packages/mcp/package-lock.json', 'packages/mcp/README.md', 'packages/mcp/AGENTS.md'];
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'rcss-check-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const f of FILES) { mkdirSync(dirname(join(dir, f)), { recursive: true }); cpSync(join(ROOT, f), join(dir, f)); }
  return dir;
}
const read = (dir, f) => readFileSync(join(dir, f), 'utf8');
const edit = (dir, f, fn) => writeFileSync(join(dir, f), fn(read(dir, f)));
const files = (dir) => check.checkConsistency(dir).problems.map((p) => p.file);

test('the checkout itself is consistent', () => {
  assert.deepEqual(check.checkConsistency(ROOT).problems, []);
});

test('finds drift between the places that state a version', (t) => {
  const dir = fixture(t);
  const v = JSON.parse(read(dir, 'package.json')).version;
  edit(dir, 'README.md', (s) => s.replace(`@reactivecss/core@${v}/`, '@reactivecss/core@0.0.1/'));
  edit(dir, 'src/core/version.ts', (s) => s.replace(`'${v}'`, "'0.0.2'"));
  assert.ok(files(dir).includes('README.md'));
  assert.ok(files(dir).includes('src/core/version.ts'));
});

test('an unpublished version passes once its notes are written; the placeholder does not', (t) => {
  const dir = fixture(t);
  const v = JSON.parse(read(dir, 'package.json')).version;
  // Turn the current version into a prepared, unpublished one.
  edit(dir, 'site/config/distribution.json', (s) => { const d = JSON.parse(s); d.core.npmVersions = d.core.npmVersions.filter((x) => x !== v); return JSON.stringify(d); });
  edit(dir, 'CHANGELOG.md', (s) => s.replace(new RegExp(`^## ${v.replaceAll('.', '\\.')}([^\\n]*)$`, 'm'), `## ${v}$1 (unpublished)\n\n${check.NOTES_PLACEHOLDER}\n`));
  edit(dir, 'packages/mcp/package.json', (s) => s.replace(/"knowledge": "[^"]*"/, `"knowledge": "${v}"`));
  assert.deepEqual(files(dir), ['CHANGELOG.md']);
  edit(dir, 'CHANGELOG.md', (s) => s.replace(check.NOTES_PLACEHOLDER, '- Faster.'));
  assert.deepEqual(check.checkConsistency(dir).problems, []);
  assert.match(check.changelogSection(read(dir, 'CHANGELOG.md'), v), /\(unpublished\)\n\n- Faster\./);
  assert.equal(check.changelogSection(read(dir, 'CHANGELOG.md'), '0.0.0'), null);
});

test('publication facts', (t) => {
  const dir = fixture(t);
  const dist = JSON.parse(read(dir, 'site/config/distribution.json'));
  writeFileSync(join(dir, 'site/config/distribution.json'), JSON.stringify({ ...dist, core: { ...dist.core, npmVersions: [...dist.core.npmVersions, '99.0.0'] } }));
  edit(dir, 'packages/mcp/package.json', (s) => s.replace(/"knowledge": "[^"]*"/, '"knowledge": "0.9.9"'));
  const msgs = check.checkConsistency(dir).problems.map((p) => p.message).join('\n');
  assert.match(msgs, /lists 99\.0\.0, newer than package\.json/);
  assert.match(msgs, /knowledge 0\.9\.9 is neither published nor the current core/);
});

test('an MCP version change asks for the generated AGENTS.md to be rebuilt', (t) => {
  const dir = fixture(t);
  const v = JSON.parse(read(dir, 'packages/mcp/package.json')).version;
  for (const f of ['packages/mcp/package.json', 'packages/mcp/package-lock.json']) edit(dir, f, (s) => s.replaceAll(`"version": "${v}"`, '"version": "7.7.7"'));
  edit(dir, 'README.md', (s) => s.replace(new RegExp(`(\\[\`@reactivecss/mcp\`\\]\\([^)]*\\) )${v.replaceAll('.', '\\.')}`), '$17.7.7'));
  edit(dir, 'packages/mcp/README.md', (s) => s.replace(`The npm release ${v} has`, 'The npm release 7.7.7 has').replace(`for the npm release ${v})`, 'for the npm release 7.7.7)'));
  assert.deepEqual(files(dir), ['packages/mcp/AGENTS.md']);
});
