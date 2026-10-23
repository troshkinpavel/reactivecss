// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { unified } from '@astrojs/markdown-remark';
import { rehypeStepHeadings } from './src/lib/content/rehype-step-headings.mjs';
import { remarkCodeBlocks } from './src/lib/content/remark-code-blocks.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { APPROVED_FEATURES } from './src/lib/config/schema.ts';

// Canonical base and sitemap come from config/seo.json (validated by src/lib/config/ when pages build).
// Pages of features hidden in config/features.json are redirects, so they stay out of the sitemap.
const readConfig = (/** @type {string} */ name) => JSON.parse(readFileSync(new URL(`./config/${name}.json`, import.meta.url), 'utf8'));
const seo = readConfig('seo');
const features = readConfig('features');
/** @type {string[]} */
const hidden = Object.entries(APPROVED_FEATURES).filter(([id]) => !features[id]).flatMap(([, f]) => f.routes);
// Older site examples: their pages are noindex (src/pages/examples/[id].astro, legacy branch), so they
// stay out of the sitemap too. Same rule as that page: a site example that is not a library API
// example and not a Control Center workspace. tests/e2e/site.spec.ts checks the two agree.
const dirs = (/** @type {string} */ path) => readdirSync(new URL(path, import.meta.url), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
// API examples: src/catalog/api/ plus the two library examples the catalog reuses (src/lib/content/catalog.ts).
// Interfaces: src/catalog/interfaces/. Their ids take over a docs example's URL (tabs, accordion, dropdown).
const apiExamples = [...dirs('./src/catalog/api/'), 'live-values', 'mouse-tracker', ...dirs('./src/catalog/interfaces/')];
const legacy = dirs('./src/examples/').filter((id) => id !== '_shared' && !id.startsWith('control-center') && !id.startsWith('docs-') && !apiExamples.includes(id)).map((id) => `/examples/${id}/`);
// The 0.8 reference pages: kept at their URLs for existing stylesheets, listed only on the migration page.
/** @type {{ id: string; category: string }[]} */
const apiEntries = JSON.parse(readFileSync(new URL('./src/content/api/entries.json', import.meta.url), 'utf8'));
const legacyReference = apiEntries.filter((e) => e.category === 'Legacy').map((e) => `/docs/reference/${e.id}/`);
// Redirects from retired example and walkthrough URLs (src/lib/content/redirects.json), and the standalone
// persistence page (noindex: it repeats the example's own page).
const redirects = JSON.parse(readFileSync(new URL('./src/lib/content/redirects.json', import.meta.url), 'utf8'));
const redirected = [...Object.keys(redirects.examples).map((id) => `/examples/${id}/`), ...Object.keys(redirects.walkthroughs).map((slug) => (slug ? `/docs/examples/${slug}/` : '/docs/examples/'))];
const notInSitemap = [...hidden, ...legacy, ...legacyReference, ...redirected, '/docs/', '/examples/persistent-preference/standalone/'];
if (/^http:\/\/(localhost|127\.0\.0\.1)/.test(seo.canonical)) console.warn(`[seo] config/seo.json canonical is ${seo.canonical}: canonical URLs, og:url, robots.txt and the sitemap will point there. Set the production https origin before deploying.`);

export default defineConfig({
  site: seo.canonical,
  output: 'static',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  integrations: [react(), mdx(), ...(seo.sitemap ? [sitemap({ filter: (page) => !notInSitemap.includes(new URL(page).pathname) })] : [])],
  markdown: { processor: unified({ remarkPlugins: [remarkCodeBlocks], rehypePlugins: [rehypeStepHeadings] }) },
  vite: {
    plugins: [tailwindcss()],
    // Pre-bundle React's runtimes: otherwise Vite discovers them late, re-optimizes during a
    // session, and open pages fail with "_jsxDEV is not a function" until a restart.
    optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'] },
  },
});
