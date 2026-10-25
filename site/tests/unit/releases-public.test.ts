// Release metadata on public pages: only published releases, prepared ones in an explicit local
// preview, and never internal fields.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { changelogVersions, DISTRIBUTION, onNpm, publicReleases, RELEASES, SEO } from '~/lib/config';
import type { ReleaseMeta } from '~/lib/config/schema';

const meta = (status: 'local' | 'prepared', extra: Partial<ReleaseMeta> = {}): ReleaseMeta => ({
  title: 'T', summary: 'S', date: '', highlights: ['h'], breaking: '', urls: { github: '', npm: '', cdn: [] },
  notes: 'INTERNAL-NOTE', workflow: { status, preparedAt: '2026-10-21T00:00:00Z', blockers: 0, warnings: 1 }, ...extra,
});
const md = '# Changelog\n\n## 0.9.0 — Next\n\n## 0.8.1 — Patch (local, unpublished)\n\n## 0.8.0 — Modular\n';

describe('changelogVersions', () => {
  it('lists the versions with a section, whatever their heading says', () => {
    expect([...changelogVersions(md)]).toEqual(['0.9.0', '0.8.1', '0.8.0']);
  });
});

describe('publicReleases', () => {
  const records = { '0.8.0': meta('prepared'), '0.8.1': meta('prepared', { limitations: 'L' }), '0.9.0': meta('local'), '1.0.0': meta('prepared') };
  const sections = changelogVersions(md), npmVersions = ['0.8.0'];
  it('public build: only versions verified on npm, never because a heading lost its "unpublished" note', () => {
    expect(publicReleases({ records, sections, npmVersions, preview: false }).map((r) => [r.version, r.published])).toEqual([['0.8.0', true]]);
  });
  it('local preview: prepared releases too, marked unpublished; local ones and versions without a CHANGELOG section never', () => {
    expect(publicReleases({ records, sections, npmVersions, preview: true }).map((r) => [r.version, r.published])).toEqual([['0.8.1', false], ['0.8.0', true]]);
  });
  it('never exposes internal notes, workflow or URLs', () => {
    for (const r of publicReleases({ records, sections, npmVersions, preview: true })) {
      expect(Object.keys(r).sort()).toEqual(['breaking', 'date', 'highlights', 'limitations', 'published', 'summary', 'title', 'version']);
      expect(JSON.stringify(r)).not.toContain('INTERNAL-NOTE');
    }
  });
  it('with the real files, nothing unpublished is public', () => {
    for (const r of publicReleases({ preview: false })) expect(r.published).toBe(true);
    expect(Object.keys(RELEASES)).toContain('0.8.0');
  });
});

describe('config/distribution.json', () => {
  const pkg = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  it('names the real packages, the canonical domain and the repository the package metadata points to', () => {
    expect(DISTRIBUTION.core.package).toBe(pkg('../../../package.json').name);
    expect(DISTRIBUTION.mcp.package).toBe(pkg('../../../packages/mcp/package.json').name);
    expect(DISTRIBUTION.website.url).toBe(SEO.canonical);
    expect(`git+${DISTRIBUTION.repository.url}.git`).toBe(pkg('../../../package.json').repository.url);
  });
  it('onNpm: only a listed version of that package counts', () => {
    const d = { ...DISTRIBUTION, core: { ...DISTRIBUTION.core, npmVersions: [pkg('../../../package.json').version] }, mcp: { ...DISTRIBUTION.mcp, npmVersions: ['0.0.1'] } };
    expect([onNpm('core', d), onNpm('mcp', d)]).toEqual([true, false]);
    // An earlier release on npm does not make the current version published.
    expect(onNpm('core', { ...d, core: { ...d.core, npmVersions: ['0.0.1'] } })).toBe(false);
  });
});
