// Consumer test: npm pack, install the tarball in a clean temporary project (no monorepo, no dev
// dependencies), start the installed bin from another folder and make MCP requests over stdio.
// node test/consumer.mjs   (needs the npm registry for the two runtime dependencies)

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { start } from './helpers.mjs';

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'rcss-mcp-consumer-'));
const sh = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const report = {};
try {
  const [pack] = JSON.parse(sh('npm', ['pack', '--json', '--pack-destination', tmp], PKG));
  report.tarball = { file: pack.filename, size: pack.size, unpackedSize: pack.unpackedSize, files: pack.files.map((f) => f.path).sort() };
  const allowed = /^(package\.json|README\.md|LICENSE|AGENTS\.md|skills\/reactive-css\/SKILL\.md|dist\/(index|server|compiler)\.js|dist\/knowledge\.json)$/;
  for (const f of report.tarball.files) assert.match(f, allowed, `unexpected file in the tarball: ${f}`);

  const app = join(tmp, 'app');
  sh('mkdir', ['-p', app]);
  writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'consumer', private: true, type: 'module' }));
  sh('npm', ['install', join(tmp, pack.filename), '--no-audit', '--no-fund', '--loglevel=error'], app);
  const nm = readdirSync(join(app, 'node_modules')).concat(readdirSync(join(app, 'node_modules/@modelcontextprotocol')).map((x) => '@modelcontextprotocol/' + x));
  report.installed = nm.sort();
  for (const dev of ['esbuild', 'typescript', '@modelcontextprotocol/client', 'vitest', '@playwright']) assert.ok(!nm.includes(dev), `dev dependency installed: ${dev}`);
  report.installedSize = sh('du', ['-sk', join(app, 'node_modules')]).split('\t')[0] + ' KB';

  // Start the installed bin from an unrelated folder.
  const s = start([join(app, 'node_modules/.bin/reactivecss-mcp')], { cwd: tmpdir() });
  const init = await s.init();
  assert.equal(init.result.serverInfo.name, 'reactivecss');
  const call = async (name, args) => (await s.request('tools/call', { name, arguments: args })).result;
  const tools = (await s.request('tools/list', {})).result.tools.map((t) => t.name);
  assert.equal(tools.length, 7);
  const ex = await call('get_example', { id: 'counter' });
  const v = await call('validate_css', { css: ex.structuredContent.css });
  assert.equal(v.structuredContent.valid, true);
  assert.equal(v.structuredContent.diagnostics.length, 0);
  const bad = await call('validate_css', { css: '.pad { --x: state(0); }\n.pad:on(click) { --x: set(event(client-x)); }' });
  assert.equal(bad.structuredContent.diagnostics[0].code, 'MCP-type-mismatch');
  const a = await call('analyze_features', { css: ex.structuredContent.css });
  assert.deepEqual(a.structuredContent.features, ['core', 'events', 'text']);
  const m = await call('migrate_css', { css: '.b { --open: state(false); on: click(toggle(--open)); }' });
  assert.match(m.structuredContent.css, /\.b:on\(click\) \{ --open: toggle\(\); \}/);
  const ref = await call('get_api_reference', { name: 'focus' });
  assert.equal(ref.structuredContent.entry.syntax, 'focus: when(condition) | var(--boolean) | true | false');
  const res = (await s.request('resources/read', { uri: 'reactivecss://version' })).result;
  report.version = JSON.parse(res.contents[0].text);
  for (const line of s.lines) assert.equal(JSON.parse(line).jsonrpc, '2.0');
  s.p.stdin.end();
  assert.equal((await s.exited).code, 0);
  assert.deepEqual(s.stderr, []);
  report.result = 'pass';
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (!process.env.KEEP) rmSync(tmp, { recursive: true, force: true });
}
