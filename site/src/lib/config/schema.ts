// Schemas for the website configuration in site/config/*.json, read by the public Astro build
// (src/lib/config/index.ts). External editors of these files (by hand or with a local tool) should
// validate with the same schemas. Plain erasable TypeScript only, so Node can import it directly.
import { z } from 'astro/zod';

/** A site path (`/docs/`) or an https URL. Everything else (javascript:, data:, http:, file:, //host, …) is rejected. */
export function urlProblem(raw: string): string | null {
  const u = raw.trim();
  if (!u) return 'URL is required.';
  if (u !== raw) return 'Remove leading or trailing spaces.';
  if (u.startsWith('/')) {
    if (u.startsWith('//')) return 'Protocol-relative URLs are not allowed. Use https:// or a site path.';
    if (/[\s\\]/.test(u)) return 'Paths cannot contain spaces or backslashes.';
    return null;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(u) && !/^https:/i.test(u)) {
    return /^http:/i.test(u) ? 'Use https. Plain http links are blocked for public destinations.' : 'Unsafe URL scheme. Only https links and site paths are allowed.';
  }
  let p: URL;
  try { p = new URL(u); } catch { return 'Malformed URL. Include the scheme, e.g. https://'; }
  if (p.protocol !== 'https:') return 'Only https links are allowed.';
  if (p.username || p.password) return 'URLs with credentials are not allowed.';
  if (!p.hostname.includes('.')) return 'Hostname looks incomplete.';
  return null;
}
const safeUrl = z.string().superRefine((v, ctx) => { const p = urlProblem(v); if (p) ctx.addIssue({ code: 'custom', message: p }); });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');
const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, 'Use lowercase letters, digits and dashes.');

// ---------- links ----------
export const LINK_CATEGORIES = ['Repository', 'Distribution', 'Documentation', 'Community', 'Social'] as const;
export const FOOTER_GROUPS = ['Learn', 'Build', 'Project'] as const;
export const linkSchema = z.strictObject({
  id,
  label: z.string().trim().min(1, 'Label is required.').max(60),
  url: safeUrl,
  category: z.enum(LINK_CATEGORIES),
  description: z.string().max(200),
  visible: z.boolean(),
  /** Footer column the link appears in; omitted = not in the footer. */
  footer: z.enum(FOOTER_GROUPS).optional(),
});
export const linksSchema = z.strictObject({ links: z.array(linkSchema) }).superRefine((v, ctx) => {
  const seen = new Set<string>();
  v.links.forEach((l, i) => { if (seen.has(l.id)) ctx.addIssue({ code: 'custom', path: ['links', i, 'id'], message: `Duplicate id "${l.id}".` }); seen.add(l.id); });
});

// ---------- announcements ----------
export const PLACEMENTS = { home: 'Homepage announcement bar', 'getting-started': 'Getting Started notice', changelog: 'Changelog notice' } as const;
export const announcementSchema = z.strictObject({
  id,
  title: z.string().trim().min(1, 'Title is required.').max(70, 'Keep the title under 70 characters.'),
  /** `{version}` is replaced with the library version at build time. */
  message: z.string().max(140, 'Keep the message under 140 characters.'),
  ctaLabel: z.string().max(40).optional(),
  ctaUrl: safeUrl.optional(),
  placement: z.enum(Object.keys(PLACEMENTS) as [keyof typeof PLACEMENTS]),
  status: z.enum(['draft', 'active']),
  start: isoDate.optional(),
  end: isoDate.optional(),
}).superRefine((a, ctx) => {
  if (a.ctaLabel && !a.ctaUrl) ctx.addIssue({ code: 'custom', path: ['ctaUrl'], message: 'Add a URL for the CTA.' });
  if (a.start && a.end && a.end < a.start) ctx.addIssue({ code: 'custom', path: ['end'], message: 'End date is before the start date.' });
});
export type Announcement = z.infer<typeof announcementSchema>;
/** Two active announcements in one placement whose date windows overlap (open ends count as unbounded). */
export function announcementConflicts(list: Announcement[]): [Announcement, Announcement][] {
  const act = list.filter((a) => a.status === 'active');
  const out: [Announcement, Announcement][] = [];
  for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
    const a = act[i]!, b = act[j]!;
    if (a.placement === b.placement && (a.start ?? '0000') <= (b.end ?? '9999') && (b.start ?? '0000') <= (a.end ?? '9999')) out.push([a, b]);
  }
  return out;
}
export const announcementsSchema = z.strictObject({ announcements: z.array(announcementSchema) }).superRefine((v, ctx) => {
  for (const [a, b] of announcementConflicts(v.announcements)) ctx.addIssue({ code: 'custom', path: ['announcements'], message: `“${a.title}” and “${b.title}” are both active in ${PLACEMENTS[a.placement]} for overlapping dates.` });
  const seen = new Set<string>();
  v.announcements.forEach((a, i) => { if (seen.has(a.id)) ctx.addIssue({ code: 'custom', path: ['announcements', i, 'id'], message: `Duplicate id "${a.id}".` }); seen.add(a.id); });
});
/** The announcement shown in a placement on a given day, if any. */
export function activeAnnouncement(list: Announcement[], placement: Announcement['placement'], today: string): Announcement | undefined {
  return list.find((a) => a.status === 'active' && a.placement === placement && (!a.start || a.start <= today) && (!a.end || today <= a.end));
}

// ---------- feature visibility ----------
/** The only website features that config may hide. Website pages only, never runtime APIs. */
export const APPROVED_FEATURES = {
  bundleBuilder: { name: 'Custom Bundle Builder', description: 'The interactive bundle configurator. Hidden: the page redirects to the Custom Bundles guide and the footer link is removed.', routes: ['/bundle-builder/'], fallback: '/docs/custom-bundles/' },
  designSystem: { name: 'Design System page', description: 'The public colour, type and component reference. Hidden: the page redirects to the homepage and the footer link is removed.', routes: ['/design-system/'], fallback: '/' },
  docsStatusBanner: { name: 'Documentation status banner', description: 'The mono strip under the docs header with the version and, until it is on npm, “not on npm yet”.', routes: ['/docs/*', '/examples/*', '/playground/'], fallback: null },
} as const;
export type FeatureId = keyof typeof APPROVED_FEATURES;
export const featuresSchema = z.strictObject({ bundleBuilder: z.boolean(), designSystem: z.boolean(), docsStatusBanner: z.boolean() });

// ---------- SEO ----------
export const seoSchema = z.strictObject({
  siteName: z.string().trim().min(1, 'Site name is required.').max(60),
  /** Page titles: `%s` is the page title. */
  titleTemplate: z.string().includes('%s', { message: 'Template must include %s for the page title.' }),
  homeTitle: z.string().trim().min(1).max(70),
  description: z.string().trim().min(1).max(300),
  /** Base for canonical URLs and the sitemap. http is allowed only for localhost. */
  canonical: z.string().regex(/^(https:\/\/[^/\s]+\.[a-z]{2,}|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/i, 'Use https and no trailing slash, e.g. https://reactive-css.dev'),
  ogImage: z.union([z.literal(''), z.string().regex(/^(\/[\w./-]+\.(png|jpe?g|webp)|https:\/\/\S+)$/i, 'Use a path to a .png, .jpg or .webp file in public/, or an https URL.')]),
  robots: z.enum(['index, follow', 'noindex, follow', 'noindex, nofollow']),
  sitemap: z.boolean(),
});

// ---------- release presentation metadata ----------
const version = z.string().regex(/^\d+\.\d+\.\d+$/);
export const releaseSchema = z.strictObject({
  title: z.string().trim().min(1, 'Title is required.').max(60, 'Keep the title under 60 characters.'),
  summary: z.string().trim().min(1, 'Add a one- or two-sentence summary.').max(200),
  date: z.union([z.literal(''), isoDate]),
  highlights: z.array(z.string().trim().min(1)).max(10),
  /** Empty = no breaking changes. */
  breaking: z.string().max(400),
  /** Public known limitations, shown with the release. Optional: older records have none. */
  limitations: z.string().max(600).optional(),
  urls: z.strictObject({
    github: z.union([z.literal(''), z.string().regex(/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/releases\/tag\/v?\d+\.\d+\.\d+$/, 'Expected https://github.com/<owner>/<repo>/releases/tag/v<version>')]),
    npm: z.union([z.literal(''), z.string().regex(/^https:\/\/(www\.)?npmjs\.com\/package\/\S+$/, 'Expected https://www.npmjs.com/package/<name>/v/<version>')]),
    cdn: z.array(z.string().regex(/^https:\/\/(cdn\.jsdelivr\.net|unpkg\.com)\/\S+$/, 'CDN URLs must be on jsDelivr or unpkg.')),
  }),
  /** Never shown on the website. */
  notes: z.string().max(2000),
  /** Local workflow state. Not publication evidence: nothing here is verified against GitHub, npm or a CDN. */
  workflow: z.strictObject({
    status: z.enum(['local', 'prepared']),
    preparedAt: z.string().optional(),
    blockers: z.number().int().min(0).optional(),
    warnings: z.number().int().min(0).optional(),
  }),
});
export type ReleaseMeta = z.infer<typeof releaseSchema>;
export const releasesSchema = z.strictObject({ releases: z.record(version, releaseSchema) });

// ---------- distribution: what is live ----------
/**
 * config/distribution.json, edited by hand after checking each fact (the registry page, the
 * repository settings, the production domain). Nothing infers it from
 * the CHANGELOG, the README or a URL. `npmVersions` lists the versions verified on npm.
 */
const npmPackage = (name: string) => z.strictObject({ package: z.literal(name), npmVersions: z.array(version) });
export const distributionSchema = z.strictObject({
  repository: z.strictObject({ url: z.string().regex(/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+$/, 'Expected https://github.com/<owner>/<repo>'), public: z.boolean() }),
  website: z.strictObject({ url: z.string().regex(/^https:\/\/[^/\s]+\.[a-z]{2,}$/i, 'Use https and no trailing slash'), production: z.boolean() }),
  core: npmPackage('@reactivecss/core'),
  mcp: npmPackage('@reactivecss/mcp'),
});
export type Distribution = z.infer<typeof distributionSchema>;
