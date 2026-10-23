// Release metadata on public pages: only published releases, prepared ones in an explicit local
// preview, and never internal fields.
import { describe, expect, it } from 'vitest';
import { changelogStatus, publicReleases, RELEASES } from '~/lib/config';
import type { ReleaseMeta } from '~/lib/config/schema';

const meta = (status: 'local' | 'prepared', extra: Partial<ReleaseMeta> = {}): ReleaseMeta => ({
  title: 'T', summary: 'S', date: '', highlights: ['h'], breaking: '', urls: { github: '', npm: '', cdn: [] },
  notes: 'INTERNAL-NOTE', workflow: { status, preparedAt: '2026-10-21T00:00:00Z', blockers: 0, warnings: 1 }, ...extra,
});
const md = '# Changelog\n\n## 0.9.0 — Next (local, unpublished)\n\n## 0.8.1 — Patch (local, unpublished)\n\n## 0.8.0 — Modular\n';

describe('changelogStatus', () => {
  it('reads "unpublished" from each heading note', () => {
    expect(Object.fromEntries(changelogStatus(md))).toEqual({ '0.9.0': { published: false }, '0.8.1': { published: false }, '0.8.0': { published: true } });
  });
});

describe('publicReleases', () => {
  const records = { '0.8.0': meta('prepared'), '0.8.1': meta('prepared', { limitations: 'L' }), '0.9.0': meta('local'), '1.0.0': meta('prepared') };
  const status = changelogStatus(md);
  it('public build: only releases whose CHANGELOG heading is published', () => {
    expect(publicReleases({ records, status, preview: false }).map((r) => [r.version, r.published])).toEqual([['0.8.0', true]]);
  });
  it('local preview: prepared releases too, marked unpublished; local ones and versions without a CHANGELOG section never', () => {
    expect(publicReleases({ records, status, preview: true }).map((r) => [r.version, r.published])).toEqual([['0.8.1', false], ['0.8.0', true]]);
  });
  it('never exposes internal notes, workflow or URLs', () => {
    for (const r of publicReleases({ records, status, preview: true })) {
      expect(Object.keys(r).sort()).toEqual(['breaking', 'date', 'highlights', 'limitations', 'published', 'summary', 'title', 'version']);
      expect(JSON.stringify(r)).not.toContain('INTERNAL-NOTE');
    }
  });
  it('with the real files, nothing unpublished is public', () => {
    for (const r of publicReleases({ preview: false })) expect(r.published).toBe(true);
    expect(Object.keys(RELEASES)).toContain('0.8.0');
  });
});
