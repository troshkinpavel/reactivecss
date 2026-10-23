// The Examples catalog is built from the library's files: every API example folder becomes one
// entry, every entry has one route, and every primary API it names has a reference page.
import { readdirSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { API_ORDER, CATALOG, CATEGORIES, catalogEntry, docsHref, gallerySpans, howRows, inCategory, neighbours } from '~/lib/content/catalog';

const { compile } = await import(new URL('../../../dist/index.js', import.meta.url).href);
// 0.9: the site's own API examples (src/catalog/api/) plus the library ones it reuses, in API_ORDER.
const siteApi = readdirSync(new URL('../../src/catalog/api/', import.meta.url), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

describe('Examples catalog', () => {
  it('has every API example, in the catalog order', () => {
    expect(inCategory('api').map((e) => e.id)).toEqual([...API_ORDER]);
    for (const id of siteApi) expect(API_ORDER, id).toContain(id);
    expect(inCategory('api')[0]!.id).toBe('counter');
  });
  it('gives every entry one route and every category entries', () => {
    expect(new Set(CATALOG.map((e) => e.href)).size).toBe(CATALOG.length);
    for (const c of CATEGORIES) expect(inCategory(c.id).length, c.id).toBeGreaterThan(0);
  });
  it('links every primary API of an API example to its reference page', () => {
    for (const e of inCategory('api')) for (const label of e.primary) expect(docsHref(label), `${e.id}: ${label}`).toBeTruthy();
  });
  it('runs every API example card and page on stylesheets that compile', () => {
    for (const e of inCategory('api')) {
      const w: string[] = [];
      const spy = vi.spyOn(console, 'warn').mockImplementation((...a) => { w.push(a.join(' ')); });
      compile(e.card!.css); compile(e.example!.files.css);
      spy.mockRestore();
      expect(w, e.id).toEqual([]);
      expect(e.card!.html).toMatch(/^<section class="demo/);
      expect(e.example!.files.html).not.toMatch(/<script|class="kicker"|class="files"/);
    }
  });
  it('fills whole four-column rows, with one wide card in each row of three', () => {
    expect(gallerySpans(16)).toEqual([2, 1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 2, 1, 1, 1, 1]);
    expect(gallerySpans(2)).toEqual([2, 2]);
    expect(gallerySpans(1)).toEqual([2]);
    for (let n = 2; n <= 24; n++) {
      let row = 0;
      for (const w of gallerySpans(n)) { row += w; if (row > 4) throw new Error(`n=${n}: a card crosses a row`); if (row === 4) row = 0; }
      expect(row, `n=${n}`).toBe(0);
    }
  });
  it('explains each primary API of a page with the lines that use it', () => {
    expect(howRows(catalogEntry('counter')!).map((r) => [r.label, r.lines])).toEqual([['state()', [2]], [':on()', [4, 5]], ['increment()', [4]], ['decrement()', [5]], ['content', [7]]]);
    for (const e of CATALOG.filter((x) => x.example)) for (const r of howRows(e)) {
      expect(r.summary, `${e.id}: ${r.label}`).not.toBe('');
      expect(r.lines.length, `${e.id}: ${r.label}`).toBeGreaterThan(0);
    }
  });
  it('recommends other examples of the same category', () => {
    for (const e of CATALOG) for (const n of neighbours(e)) { expect(n).not.toBe(e); expect(n.category).toBe(e.category); }
  });
});
