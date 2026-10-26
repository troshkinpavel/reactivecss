// The production build is static: no server routes, and the config/ files are read at build time only
// (their validation code never ships to visitors).
import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST = new URL('../../dist/', import.meta.url).pathname;
const files = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(d, e.name)) : [join(d, e.name)]));

test('no server routes: API paths and writes are not served', async ({ request }) => {
  for (const p of ['/admin/', '/api/', '/api/config/links']) expect((await request.get(p)).status(), p).toBe(404);
  expect((await request.put('/api/config/links', { data: {} })).status()).not.toBe(200);
});

test('config schema code does not ship to the client', () => {
  // A message that exists only in src/lib/config/schema.ts.
  const markers = ['Use https and no trailing slash'];
  const text = files(DIST).filter((f) => /\.(html|js|mjs|css|json|xml|txt)$/.test(f));
  expect(text.length).toBeGreaterThan(50);
  for (const f of text) {
    const s = readFileSync(f, 'utf8');
    for (const m of markers) expect(s.includes(m), `${m} in ${f.slice(DIST.length)}`).toBe(false);
  }
});

test('public pages carry the build-time configuration', async ({ page }) => {
  const links = JSON.parse(readFileSync(new URL('../../config/links.json', import.meta.url), 'utf8')).links;
  const seo = JSON.parse(readFileSync(new URL('../../config/seo.json', import.meta.url), 'utf8'));
  await page.goto('/');
  const footer = page.getByRole('navigation', { name: 'Footer' });
  for (const l of links.filter((x: { visible: boolean; footer?: string }) => x.visible && x.footer)) await expect(footer.getByRole('link', { name: l.label, exact: true })).toHaveAttribute('href', l.url);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', seo.robots);
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', seo.siteName);
  await expect(page).toHaveTitle(seo.homeTitle);
});
