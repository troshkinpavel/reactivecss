// Tiny static server for viewing the original Claude Design files (dev only).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
const [root = '.', argPort = '8181'] = process.argv.slice(2);
const port = process.env.PORT || argPort;
const base = resolve(root);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = resolve(join(base, path === '/' ? 'Home.dc.html' : path));
  if (!file.startsWith(base)) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }).end(await readFile(file)); }
  catch { res.writeHead(404).end('not found'); }
}).listen(+port, () => console.log(`serving ${base} on http://localhost:${port}`));
