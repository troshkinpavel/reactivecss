// Protocol tests against a real stdio process (node dist/index.js): raw newline-delimited JSON-RPC
// for the wire-level checks, then the official MCP client. node --test test/protocol.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

import { start, bin } from './helpers.mjs';

test('stdio session: handshake, listings, calls, errors, clean stdout and shutdown', async () => {
  const s = start();
  const init = await s.init();
  assert.equal(init.result.serverInfo.name, 'reactivecss');
  assert.ok(init.result.capabilities.tools && init.result.capabilities.resources && init.result.capabilities.prompts);
  assert.match(init.result.instructions, /validate_css/);

  const tools = (await s.request('tools/list', {})).result.tools;
  assert.deepEqual(tools.map((t) => t.name).sort(), ['analyze_features', 'get_api_reference', 'get_example', 'migrate_css', 'search_docs', 'suggest_bundle', 'validate_css']);
  for (const t of tools) {
    assert.equal(t.inputSchema.type, 'object', t.name);
    assert.equal(t.annotations.readOnlyHint, true, t.name);
    assert.ok(t.description.length > 40, t.name);
  }
  assert.deepEqual(tools.find((t) => t.name === 'validate_css').inputSchema.required, ['css']);

  const resources = (await s.request('resources/list', {})).result.resources;
  assert.equal(resources.length, 8);
  for (const r of resources) {
    const read = (await s.request('resources/read', { uri: r.uri })).result;
    const text = read.contents[0].text;
    assert.ok(text.length > 100, r.uri);
    if (r.mimeType === 'application/json') assert.equal(JSON.parse(text).reactivecssVersion ?? JSON.parse(text).reactivecss.version, '0.9.1', r.uri);
  }
  const missing = await s.request('resources/read', { uri: 'reactivecss://nope' });
  assert.ok(missing.error, 'unknown resource → JSON-RPC error');

  const prompts = (await s.request('prompts/list', {})).result.prompts;
  assert.deepEqual(prompts.map((p) => p.name).sort(), ['create_reactive_component', 'migrate_to_v09', 'optimize_reactive_bundle', 'review_reactive_css']);
  const prompt = (await s.request('prompts/get', { name: 'review_reactive_css', arguments: { css: '.a { --x: state(0); }' } })).result;
  assert.match(prompt.messages[0].content.text, /validate_css/);
  assert.ok((await s.request('prompts/get', { name: 'review_reactive_css', arguments: {} })).error, 'missing prompt argument → error');

  const ok = (await s.request('tools/call', { name: 'validate_css', arguments: { css: '.a:on(click, prevent) {}' } })).result;
  assert.equal(ok.isError, undefined);
  assert.equal(ok.structuredContent.valid, false);
  assert.equal(ok.structuredContent.diagnostics[0].code, 'RCSS-E067');
  const badArgs = (await s.request('tools/call', { name: 'validate_css', arguments: { css: 5 } })).result;
  assert.equal(badArgs.isError, true);
  const unknownTool = await s.request('tools/call', { name: 'nope', arguments: {} });
  assert.ok(unknownTool.error || unknownTool.result.isError);
  const unknownMethod = await s.request('nope/nope', {});
  assert.equal(unknownMethod.error.code, -32601);

  // Garbage on stdin does not stop the server.
  s.send('this is not json');
  s.send('{"jsonrpc":"2.0","id":"x","method":');
  assert.deepEqual((await s.request('ping', {})).result, {});

  for (const line of s.lines) {
    const m = JSON.parse(line); // every stdout line is a JSON-RPC message: no banner, no logs
    assert.equal(m.jsonrpc, '2.0');
  }
  s.p.stdin.end();
  const { code } = await s.exited;
  assert.equal(code, 0);
  assert.deepEqual(s.stderr, [], 'nothing on stderr in a normal session');
});

test('SIGTERM shuts down cleanly', async () => {
  const s = start();
  await s.init();
  s.p.kill('SIGTERM');
  const r = await s.exited;
  assert.ok(r.code === 0 || r.signal === 'SIGTERM');
});

test('the official MCP client works over stdio', async () => {
  const transport = new StdioClientTransport({ command: process.execPath, args: [bin], stderr: 'pipe' });
  const client = new Client({ name: 'sdk-test', version: '0' });
  await client.connect(transport);
  assert.equal(client.getServerVersion().name, 'reactivecss');
  const ref = await client.callTool({ name: 'get_api_reference', arguments: { name: ':on' } });
  assert.equal(ref.structuredContent.entry.key, 'rule:on');
  const ex = await client.callTool({ name: 'get_example', arguments: { topic: 'drag' } });
  assert.equal(ex.structuredContent.id, 'draggable-card');
  const mig = await client.callTool({ name: 'migrate_css', arguments: { css: '.b { on: click(toggle(--open)); }' } });
  assert.match(mig.structuredContent.css, /\.b:on\(click\) \{ --open: toggle\(\); \}/);
  const search = await client.callTool({ name: 'search_docs', arguments: { query: 'persist state across reloads', limit: 3 } });
  assert.equal(search.structuredContent.results.length, 3);
  const res = await client.readResource({ uri: 'reactivecss://version' });
  assert.equal(JSON.parse(res.contents[0].text).reactivecss.version, '0.9.1');
  await client.close();
});

test('the client negotiates the newest protocol revision it can (2025 and 2026 eras)', async () => {
  for (const mode of ['legacy', 'auto']) {
    const transport = new StdioClientTransport({ command: process.execPath, args: [bin], stderr: 'pipe' });
    const client = new Client({ name: 'era-test', version: '0' }, { versionNegotiation: { mode } });
    await client.connect(transport);
    const version = client.getNegotiatedProtocolVersion();
    const tools = await client.listTools();
    assert.equal(tools.tools.length, 7, `${mode}: ${version}`);
    const r = await client.callTool({ name: 'validate_css', arguments: { css: '.a:on(click, stop) {}' } });
    assert.equal(r.structuredContent.diagnostics[0].code, 'RCSS-E067', `${mode}: ${version}`);
    console.log(`# versionNegotiation ${mode}: ${version}`);
    await client.close();
  }
});

test('a message over the SDK transport limit (10 MB) closes the connection cleanly', async () => {
  const s = start();
  await s.init();
  s.p.stdin.on('error', () => {}); // the server stops reading: our write may end in EPIPE
  s.send(JSON.stringify({ jsonrpc: '2.0', id: 1e6, method: 'tools/call', params: { name: 'validate_css', arguments: { css: 'a'.repeat(11 * 1024 * 1024) } } }));
  const { code } = await s.exited;
  assert.equal(code, 0);
  assert.match(s.stderr.join(''), /ReadBuffer exceeded maximum size/);
  for (const line of s.lines) assert.equal(JSON.parse(line).jsonrpc, '2.0');
});
