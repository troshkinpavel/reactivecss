// Test helper: a server process and a line-based JSON-RPC client over its stdio.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const bin = process.env.RCSS_MCP_BIN ?? fileURLToPath(new URL('../dist/index.js', import.meta.url));

/** A server process and a line-based JSON-RPC client that records every stdout line. */
export function start(command = [process.execPath, bin], options = {}) {
  const p = spawn(command[0], command.slice(1), { stdio: ['pipe', 'pipe', 'pipe'], ...options });
  const lines = [], stderr = [], waiting = new Map();
  let buf = '';
  p.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      lines.push(line);
      let msg; try { msg = JSON.parse(line); } catch { continue; }
      if (msg.id !== undefined && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
    }
  });
  p.stderr.on('data', (d) => stderr.push(String(d)));
  const exited = new Promise((r) => p.on('exit', (code, signal) => r({ code, signal })));
  let id = 0;
  const send = (raw) => p.stdin.write(raw + '\n');
  const request = (method, params) => new Promise((resolve, reject) => {
    const n = ++id;
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), 10_000);
    waiting.set(n, (m) => { clearTimeout(t); resolve(m); });
    send(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }));
  });
  const notify = (method, params) => send(JSON.stringify({ jsonrpc: '2.0', method, params }));
  const init = async () => {
    const r = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'protocol-test', version: '0' } });
    notify('notifications/initialized');
    return r;
  };
  return { p, lines, stderr, exited, send, request, notify, init };
}

