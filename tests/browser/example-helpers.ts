// Shared by the 0.7.1 example tests: open an example under a strict CSP, collect problems, clean up.
import { expect, type Page } from '@playwright/test';
// @ts-expect-error: plain ESM tooling, no type declarations
import { explain } from '../../tools/diagnostics.mjs';

const bundles = new Map<string, Promise<string>>();
/**
 * RCSS_CUSTOM=1 (0.8.0): serve each example the custom bundle the analyzer recommends for its own
 * directory (only the features it uses), instead of the full dist/reactive-css.min.js. The example
 * tests then prove the custom bundle runs the real example, and finish() proves nothing is missing.
 */
/** With RCSS_CUSTOM=1 (or force), serves the smallest bundle the analyzer picks for examples/<name> in place of the full one. */
export async function routeCustomBundle(page: Page, name: string, force = false) {
  if (!process.env.RCSS_CUSTOM && !force) return;
  if (!bundles.has(name)) bundles.set(name, (async () => {
    // @ts-expect-error: plain ESM tooling
    const { analyze, build } = await import('../../tools/bundle.mjs');
    const a = await analyze([`examples/${name}`], { assumeComplete: true }); // the harness labs' extra sheets are in the directory
    const r = await build({ features: a.recommended.features ?? [] });
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    return r.code as string;
  })());
  const code = await bundles.get(name)!;
  await page.route('**/dist/reactive-css.min.js', (r) => r.fulfill({ contentType: 'text/javascript', body: code }));
}

export const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'";

/** Opens /examples/<name>/ with a strict CSP header; collects console errors, warnings and CSP violations. */
export async function visit(page: Page, name: string, { custom = false } = {}) {
  const problems: string[] = [];
  const webkit = page.context().browser()?.browserType().name() === 'webkit';
  const throttle = Number(process.env.RCSS_CPU_THROTTLE ?? 0);
  if (throttle > 1 && page.context().browser()?.browserType().name() === 'chromium')
    await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: throttle });
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    // WebKit (Playwright 27.2) reports its own internal <select> stylesheet under style-src 'self' (not ours).
    if (webkit && m.text().startsWith('Refused to apply a stylesheet because its hash')) return;
    problems.push(m.text());
  });
  await routeCustomBundle(page, name, custom);
  await page.route(`**/examples/${name}/`, async (r) => {
    const res = await r.fetch();
    await r.fulfill({ response: res, headers: { ...res.headers(), 'content-security-policy': CSP } });
  });
  await page.goto(`/examples/${name}/`);
  await page.waitForFunction(() => (window as any).ReactiveCSS?.stats().sheets >= 1);
  await frames(page);
  return problems;
}

export const frames = (page: Page, n = 2) => page.evaluate((n) => new Promise<void>((res) => { const f = () => (n-- ? requestAnimationFrame(f) : res()); f(); }), n);
/** Decoded: example pages load the production bundle, which carries diagnostic codes (0.9.0). */
export const diagnostics = async (page: Page) => (await page.evaluate(() => (window as any).ReactiveCSS.diagnostics as string[])).map((m) => explain(m) as string);
export const active = (page: Page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.localName);
export const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));

/**
 * No errors, no diagnostics (except the `expected` ones, matched exactly once each); removing the
 * page content releases every state and binding.
 */
export async function finish(page: Page, problems: string[], expected: RegExp[] = []) {
  expect(problems).toEqual([]);
  const d = await diagnostics(page);
  expect(d.length).toBe(expected.length);
  for (const re of expected) expect(d.filter((m) => re.test(m))).toHaveLength(1);
  await page.evaluate(() => document.querySelector('main')!.remove());
  await frames(page);
  const s = await page.evaluate(() => (window as any).ReactiveCSS.stats());
  expect([s.bindings, s.states, s.sources]).toEqual([0, 0, 0]);
}
