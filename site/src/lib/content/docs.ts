// Documentation structure, derived from content metadata: sidebar groups, reading order,
// breadcrumbs and link labels. Astro-only (uses content collections).

import { getCollection, type CollectionEntry } from 'astro:content';
import type { SidebarGroup, SidebarItem } from '~/components/navigation/DocsSidebar';
import type { PageLink } from '~/components/navigation/PageNav';
import { API, CATEGORIES, SHIPPED_API, apiHref, entryStatus } from './reference';

export type DocEntry = CollectionEntry<'docs'>;
export const GROUPS = ['Start', 'Concepts', 'Reference', 'Examples', 'Integrations', 'Project'] as const;

export const docHref = (id: string) => `/docs/${id}/`;

/** Standalone destinations shown in the docs sidebar. */
const EXPLORE: SidebarItem[] = [
  { label: 'Examples', href: '/examples/' },
  { label: 'Playground', href: '/playground/' },
];

/** One reading order for prev / next: docs by `order`, API entries after the reference index. */
export interface PageRef { id: string; href: string; title: string; group: string; category?: string; mono: boolean; status?: string }

export async function pageIndex(): Promise<PageRef[]> {
  const docs = (await getCollection('docs')).sort((a, b) => a.data.order - b.data.order);
  const api: PageRef[] = CATEGORIES.flatMap((c) => SHIPPED_API.filter((a) => a.category === c).map((a) => ({
    id: 'reference/' + a.id, href: apiHref(a.id), title: a.name, group: 'Reference', category: c, mono: true,
    status: entryStatus(a).experimental ? 'exp' : undefined,
  })));
  const pages: PageRef[] = [];
  for (const g of GROUPS) {
    for (const d of docs.filter((x) => x.data.group === g)) {
      pages.push({ id: d.id, href: docHref(d.id), title: d.data.navLabel ?? d.data.title, group: g, mono: false, status: d.data.status === 'experimental' ? 'exp' : d.data.status });
      if (d.id === 'reference') pages.push(...api);
    }
  }
  return pages;
}

export async function sidebar(currentId: string): Promise<SidebarGroup[]> {
  const pages = await pageIndex();
  const item = (p: PageRef, indent = false): SidebarItem => ({ label: p.title, href: p.href, current: p.id === currentId, mono: p.mono, status: p.status, indent });
  return GROUPS.map((g) => {
    const inGroup = pages.filter((p) => p.group === g);
    if (g === 'Reference') {
      return {
        title: g,
        entries: [
          ...inGroup.filter((p) => !p.category).map((p) => item(p)),
          ...CATEGORIES.map((c) => ({ label: c, items: inGroup.filter((p) => p.category === c).map((p) => item(p)) })),
        ],
      };
    }
    // The docs teach the API; the Examples catalog and the Playground show it working. The sidebar
    // links to them instead of listing example pages (the former walkthroughs redirect there).
    if (g === 'Examples') return { title: 'Explore', entries: EXPLORE };
    return { title: g, entries: inGroup.map((p) => item(p)) };
  });
}

export async function neighbours(currentId: string): Promise<{ prev?: PageLink; next?: PageLink }> {
  const pages = await pageIndex();
  const i = pages.findIndex((p) => p.id === currentId);
  if (i < 0) return {};
  const link = (p: PageRef | undefined): PageLink | undefined => p && { label: p.title, href: p.href, mono: p.mono };
  return { prev: link(pages[i - 1]), next: link(pages[i + 1]) };
}

/** Title and style for a content id such as `state`, `reference/when` or `examples/tabs`. */
export async function resolveLinks(ids: string[]) {
  const pages = await pageIndex();
  return ids.flatMap((id) => {
    // Removed API entries are not in the reading order, but still have a page.
    const p = pages.find((x) => x.id === id) ?? removedRef(id);
    return p ? [{ label: p.title, href: p.href, mono: p.mono }] : [];
  });
}

function removedRef(id: string): PageRef | undefined {
  const e = API.find((a) => 'reference/' + a.id === id);
  return e && { id, href: apiHref(e.id), title: e.name, group: 'Reference', category: e.category, mono: true };
}
