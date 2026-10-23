// reactivecss-mcp: the Reactive CSS MCP server over stdio. stdout carries only MCP messages; logs go
// to stderr. Exits when the client closes stdin or on SIGINT / SIGTERM.

import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.js';
import { K } from './knowledge.js';

if (process.argv.includes('--version')) {
  process.stderr.write(`@reactivecss/mcp ${K().version} (Reactive CSS ${K().reactivecss.version})\n`);
  process.exit(0);
}

const handle = serveStdio(createServer, { onerror: (e) => process.stderr.write(`[reactivecss-mcp] ${e.message}\n`) });
let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  try { await handle.close(); } finally { process.exit(0); }
};
process.stdin.on('end', shutdown);
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
