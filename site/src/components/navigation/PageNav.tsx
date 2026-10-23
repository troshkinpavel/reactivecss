export interface Crumb { label: string; href: string }

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3.5 flex flex-wrap gap-1.5 font-mono text-label text-mute">
      {items.map((c, i) => (
        <span key={c.href + i} className="flex gap-1.5">
          {i > 0 && <span aria-hidden="true">/</span>}
          <a href={c.href} className="text-inherit no-underline hover:text-ink">{c.label}</a>
        </span>
      ))}
    </nav>
  );
}

export interface PageLink { label: string; href: string; mono?: boolean }

export function PrevNext({ prev, next, prevLabel = '← Previous', nextLabel = 'Next →' }: { prev?: PageLink; next?: PageLink; prevLabel?: string; nextLabel?: string }) {
  const card = (l: PageLink | undefined, label: string, end: boolean) => l ? (
    <a href={l.href} className={`flex min-w-0 flex-col gap-1 rounded-block border border-line p-4 no-underline hover:border-ink ${end ? 'text-right' : ''}`}>
      <span className="font-mono text-label text-mute">{label}</span>
      <span className={`truncate font-semibold ${l.mono ? 'font-mono text-rx' : ''}`}>{l.label}</span>
    </a>
  ) : <span />;
  return (
    <nav aria-label="Previous and next" className="mt-18 grid max-w-[860px] grid-cols-2 gap-2.5">
      {card(prev, prevLabel, false)}
      {card(next, nextLabel, true)}
    </nav>
  );
}

export interface TocEntry { id: string; label: string; depth: 2 | 3 }

/** "On this page". The scroll-follow highlight is added by a small inline script on the page. */
export function TableOfContents({ entries }: { entries: TocEntry[] }) {
  return (
    <aside aria-label="On this page" className="toc sticky top-[calc(var(--height-header)+var(--height-banner))] max-h-[calc(100vh-var(--height-header)-var(--height-banner))] w-(--width-toc) flex-none overflow-y-auto pt-12 pr-6 pb-6 max-[1299px]:hidden">
      <div className="mb-3 font-mono text-tag text-mute">On this page</div>
      <div className="flex flex-col border-l border-line">
        {entries.map((t) => (
          <a
            key={t.id}
            href={`#${t.id}`}
            data-toc={t.id}
            className={`-ml-px border-l border-transparent leading-[1.4] text-ink-2 no-underline hover:text-ink data-[active]:border-ink data-[active]:font-semibold data-[active]:text-ink ${t.depth === 3 ? 'py-1 pl-[26px] text-[13px]' : 'py-[5px] pl-3.5 text-sm'}`}
          >
            {t.label}
          </a>
        ))}
      </div>
    </aside>
  );
}

/** Below 1300px the table of contents folds into the article as a native disclosure. */
export function InlineToc({ entries }: { entries: TocEntry[] }) {
  const count = entries.filter((e) => e.depth === 2).length;
  return (
    <details className="group/toc mb-7 max-w-(--container-prose) rounded-block border border-line min-[1300px]:hidden">
      <summary className="flex h-[46px] cursor-pointer list-none items-center justify-between px-3.5 text-ui [&::-webkit-details-marker]:hidden">
        <span className="whitespace-nowrap">On this page · {count} sections</span>
        <span className="font-mono text-[14px]"><span className="group-open/toc:hidden">+</span><span className="hidden group-open/toc:inline">−</span></span>
      </summary>
      <div className="flex flex-col border-t border-line px-3.5 pb-2.5">
        {entries.map((t) => <a key={t.id} href={`#${t.id}`} className={`border-b border-line py-[9px] text-base text-ink-2 no-underline last:border-b-0 ${t.depth === 3 ? 'pl-4' : ''}`}>{t.label}</a>)}
      </div>
    </details>
  );
}
