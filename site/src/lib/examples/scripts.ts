// The runtime and the bridge are fetched once from this site (same origin) and inlined into
// each preview document under a per-document CSP nonce. The preview then needs no network
// access at all, which keeps the sandbox opaque-origin while working on any dev server.

export interface PreviewScripts { runtime: string; bridge: string }

const cached = new Map<string, Promise<PreviewScripts>>();

/** `dev`: the development bundle, the same runtime with full diagnostic messages instead of codes. */
export function loadPreviewScripts(base = '', dev = false): Promise<PreviewScripts> {
  const file = dev ? '/runtime/reactive-css.js' : '/runtime/reactive-css.min.js';
  const get = (path: string) => fetch(base + path).then((r) => {
    if (!r.ok) throw new Error(`${path}: ${r.status}. Run npm run sync-runtime.`);
    return r.text();
  });
  if (!cached.has(file)) {
    cached.set(file, Promise.all([get(file), get('/preview/bridge.js')])
      .then(([runtime, bridge]) => ({ runtime, bridge }))
      .catch((e) => { cached.delete(file); throw e; }));
  }
  return cached.get(file)!;
}

export function nonce(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/[^a-zA-Z0-9]/g, '');
}
