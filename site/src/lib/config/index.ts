// Read-only website configuration for the public build. The JSON in site/config/ is edited by the
// local Control Center (admin/); here it is only validated and read. An invalid file fails the
// build instead of shipping. Nothing in this module writes, and no page calls the admin server.
import type { FooterGroup } from '~/components/navigation/SiteFooter';
import { LIBRARY_VERSION } from '~/lib/content/reference';
import links from '../../../config/links.json';
import announcements from '../../../config/announcements.json';
import features from '../../../config/features.json';
import seo from '../../../config/seo.json';
import releases from '../../../config/releases.json';
import changelogText from '../../../../CHANGELOG.md?raw';
import { APPROVED_FEATURES, FOOTER_GROUPS, activeAnnouncement, announcementsSchema, featuresSchema, linksSchema, releasesSchema, seoSchema, type Announcement, type FeatureId, type ReleaseMeta } from './schema';

export const SEO = seoSchema.parse(seo);
export const FEATURES = featuresSchema.parse(features);
export const LINKS = linksSchema.parse(links).links;
export const ANNOUNCEMENTS = announcementsSchema.parse(announcements).announcements;
export const RELEASES = releasesSchema.parse(releases).releases;

/** Routes of hidden website features: links to them are dropped instead of left pointing at a redirect. */
const hiddenRoutes: string[] = (Object.keys(APPROVED_FEATURES) as FeatureId[]).filter((f) => !FEATURES[f]).flatMap((f) => APPROVED_FEATURES[f].routes);
export const isHiddenRoute = (href: string) => hiddenRoutes.includes(href);

export function footerGroups(list = LINKS): FooterGroup[] {
  return FOOTER_GROUPS.map((title) => ({
    title,
    links: list.filter((l) => l.footer === title && l.visible && !isHiddenRoute(l.url)).map(({ label, url }) => ({ label, href: url })),
  })).filter((g) => g.links.length > 0);
}

/** The announcement for a placement on the build date, with `{version}` filled in. */
export function announcementFor(placement: Announcement['placement'], today = new Date().toISOString().slice(0, 10), list = ANNOUNCEMENTS): Announcement | undefined {
  const a = activeAnnouncement(list, placement, today);
  return a && { ...a, message: a.message.replaceAll('{version}', LIBRARY_VERSION) };
}

export function pageTitle(title: string, s = SEO) {
  return title === s.siteName ? s.homeTitle : s.titleTemplate.replace('%s', title);
}

/** What a public page may show about a release: never `notes` or `workflow`. */
export interface PublicRelease {
  version: string; title: string; summary: string; highlights: string[]; limitations?: string; breaking: string; date: string;
  /** false: shown only in a local preview build, and labelled as not published. */
  published: boolean;
}

/** `## x.y.z — Title (note)` headings of CHANGELOG.md → whether the note still says "unpublished". */
export function changelogStatus(md = changelogText): Map<string, { published: boolean }> {
  const out = new Map<string, { published: boolean }>();
  for (const m of md.matchAll(/^## (\d+\.\d+\.\d+)\b([^\n]*)$/gm)) out.set(m[1]!, { published: !/unpublished/i.test(m[2]!) });
  return out;
}

/**
 * Release records the public site may render, newest first. Policy:
 * - published = the CHANGELOG.md heading no longer says "unpublished" (the manual step after
 *   npm publication; the Control Center never sets it);
 * - a local preview build (`RCSS_PREVIEW_RELEASES=1`) also shows `prepared` records, marked as not
 *   published. `local` records and versions without a CHANGELOG section never appear.
 */
export function publicReleases(o: { records?: Record<string, ReleaseMeta>; status?: Map<string, { published: boolean }>; preview?: boolean } = {}): PublicRelease[] {
  const records = o.records ?? RELEASES, status = o.status ?? changelogStatus();
  const preview = o.preview ?? process.env.RCSS_PREVIEW_RELEASES === '1';
  return Object.entries(records)
    .flatMap(([version, r]) => {
      const published = status.get(version)?.published;
      if (published === undefined || (!published && !(preview && r.workflow.status === 'prepared'))) return [];
      return [{ version, title: r.title, summary: r.summary, highlights: r.highlights, limitations: r.limitations, breaking: r.breaking, date: r.date, published }];
    })
    .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
}
