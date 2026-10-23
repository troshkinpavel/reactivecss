export interface RelatedLink { label: string; href: string; mono?: boolean }

/** Related pages. API entries are set in mono vermilion because they are reactive syntax. */
export function RelatedLinks({ links }: { links: RelatedLink[] }) {
  return (
    <div className="mt-1 mb-6 flex flex-wrap gap-2">
      {links.map((l) => (
        <a key={l.href} href={l.href} className={`rounded-block border border-line px-3 py-2 no-underline hover:border-ink ${l.mono ? 'font-mono text-sm text-rx' : 'text-[14px]'}`}>{l.label}</a>
      ))}
    </div>
  );
}
