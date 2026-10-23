// robots.txt from config/seo.json: the sitemap's absolute URL, and a full block when the site is noindex.
import type { APIRoute } from 'astro';
import { SEO } from '~/lib/config';

export const GET: APIRoute = ({ site }) => {
  const lines = ['User-agent: *', SEO.robots.startsWith('noindex') ? 'Disallow: /' : 'Allow: /'];
  if (SEO.sitemap) lines.push('', `Sitemap: ${new URL('/sitemap-index.xml', site)}`);
  return new Response(lines.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
