// Website configuration in config/*.json: schemas, URL safety, announcement rules and the public
// build-time reader (src/lib/config/).
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ANNOUNCEMENTS, FEATURES, LINKS, SEO, announcementFor, footerGroups, isHiddenRoute, pageTitle } from '~/lib/config';
import { APPROVED_FEATURES, activeAnnouncement, announcementConflicts, announcementsSchema, distributionSchema, featuresSchema, linksSchema, releasesSchema, seoSchema, urlProblem, type Announcement } from '~/lib/config/schema';
import { LIBRARY_VERSION } from '~/lib/content/reference';

describe('config files', () => {
  it('every file in site/config/ is a known, valid config', () => {
    const dir = new URL('../../config/', import.meta.url);
    const all = { links: linksSchema, announcements: announcementsSchema, features: featuresSchema, seo: seoSchema, releases: releasesSchema, distribution: distributionSchema };
    expect(readdirSync(dir).sort()).toEqual(Object.keys(all).map((n) => `${n}.json`).sort());
    for (const [name, schema] of Object.entries(all)) {
      const r = schema.safeParse(JSON.parse(readFileSync(new URL(`${name}.json`, dir), 'utf8')));
      expect(r.success, `${name}: ${JSON.stringify(r.error?.issues)}`).toBe(true);
    }
  });
  it('only approved website features exist, and none is a runtime feature', () => {
    expect(Object.keys(featuresSchema.shape).sort()).toEqual(Object.keys(APPROVED_FEATURES).sort());
    const runtime = new Set(JSON.parse(readFileSync(new URL('../../../dist/catalog.json', import.meta.url), 'utf8')).features.map((f: { id: string }) => f.id));
    for (const id of Object.keys(APPROVED_FEATURES)) expect(runtime.has(id)).toBe(false);
  });
});

describe('URL safety', () => {
  it.each(['/docs/', '/docs/a-b/#x', 'https://www.npmjs.com/package/reactive-css', 'https://cdn.jsdelivr.net/npm/x@1/dist/a.js'])('accepts %s', (u) => expect(urlProblem(u)).toBeNull());
  it.each(['', ' /docs/', 'javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,x', 'vbscript:x', 'file:///etc/passwd', 'http://example.com', '//evil.example', '/a b', '/a\\b', 'https://localhost', 'https://u:p@example.com', 'mailto:a@b.c', 'example.com'])('rejects %j', (u) => expect(urlProblem(u)).not.toBeNull());
});

describe('announcements', () => {
  const a = (o: Partial<Announcement>): Announcement => ({ id: 'a', title: 'A', message: '', placement: 'home', status: 'active', ...o });
  it('finds overlapping active announcements in one placement', () => {
    expect(announcementConflicts([a({}), a({ id: 'b' })])).toHaveLength(1);
    expect(announcementConflicts([a({ end: '2026-01-31' }), a({ id: 'b', start: '2026-02-01' })])).toHaveLength(0);
    expect(announcementConflicts([a({ start: '2026-01-01', end: '2026-02-01' }), a({ id: 'b', start: '2026-02-01' })])).toHaveLength(1);
    expect(announcementConflicts([a({}), a({ id: 'b', placement: 'changelog' })])).toHaveLength(0);
    expect(announcementConflicts([a({}), a({ id: 'b', status: 'draft' })])).toHaveLength(0);
  });
  it('shows an announcement only while active and inside its window', () => {
    const list = [a({ start: '2026-03-01', end: '2026-03-31' }), a({ id: 'd', status: 'draft', placement: 'changelog' })];
    expect(activeAnnouncement(list, 'home', '2026-02-28')).toBeUndefined();
    expect(activeAnnouncement(list, 'home', '2026-03-15')?.id).toBe('a');
    expect(activeAnnouncement(list, 'home', '2026-04-01')).toBeUndefined();
    expect(activeAnnouncement(list, 'changelog', '2026-03-15')).toBeUndefined();
  });
});

describe('public build-time consumption', () => {
  it('footer groups come from links.json: the previous hand-written footer, plus Experiments (Home v2)', () => {
    expect(footerGroups()).toEqual([
      { title: 'Learn', links: [{ label: 'Getting started', href: '/docs/getting-started/' }, { label: 'Examples', href: '/examples/' }, { label: 'Experiments', href: '/experiments/' }, { label: 'Browser support', href: '/docs/compat/' }] },
      { title: 'Build', links: [{ label: 'Playground', href: '/playground/' }, { label: 'Bundle builder', href: '/bundle-builder/' }, { label: 'Design system', href: '/design-system/' }, { label: 'npm package', href: 'https://www.npmjs.com/package/@reactivecss/core' }] },
      { title: 'Project', links: [{ label: 'Changelog', href: '/docs/changelog/' }, { label: 'Simplify CSS', href: '/docs/simplify-css/' }, { label: 'Vision', href: '/vision/' }, { label: 'Performance', href: '/docs/performance/' }, { label: 'GitHub', href: 'https://github.com/troshkinpavel/reactivecss' }] },
    ]);
  });
  it('hidden links, links to hidden features and links without a column stay out of the footer', () => {
    const extra = [...LINKS.map((l) => (l.id === 'vision' ? { ...l, visible: false } : l))];
    const flat = footerGroups(extra).flatMap((g) => g.links.map((l) => l.href));
    expect(flat).not.toContain('/vision/');
    // The only external footer links: the npm package and the public repository.
    expect(flat.filter((h) => h.startsWith('https://'))).toEqual(['https://www.npmjs.com/package/@reactivecss/core', 'https://github.com/troshkinpavel/reactivecss']);
    expect(isHiddenRoute('/bundle-builder/')).toBe(!FEATURES.bundleBuilder);
  });
  it('announcements fill in the library version', () => {
    expect(announcementFor('home', '2026-10-20')?.message).toBe(`Reactive CSS ${LIBRARY_VERSION} is experimental, and its syntax may still change.`);
    expect(announcementFor('changelog', '2026-10-20', ANNOUNCEMENTS)).toBeUndefined();
  });
  it('page titles follow the SEO template', () => {
    expect(pageTitle('Reactive CSS')).toBe('Reactive CSS · CSS that reacts.');
    expect(pageTitle('State')).toBe('State · Reactive CSS');
    expect(pageTitle('X', { ...SEO, titleTemplate: '%s | RCSS' })).toBe('X | RCSS');
  });
});
