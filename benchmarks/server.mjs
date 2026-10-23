// Starts the esbuild static server on a free-ish port and waits until it answers.
import { spawn } from 'node:child_process';

export async function startServer() {
  const port = 9000 + Math.floor(Math.random() * 900);
  const proc = spawn('node', ['build.mjs', '--serve'], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`http://localhost:${port}/dist/index.js`)).ok) return { port, stop: () => proc.kill() }; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  proc.kill();
  throw new Error('benchmark server did not start');
}
