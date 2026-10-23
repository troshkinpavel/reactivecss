import { Logo } from '~/components/ui/Logo';
import { Kbd, Tag } from '~/components/ui/Tag';

export interface NavLink { label: string; href: string; current?: boolean }

export interface SiteHeaderProps {
  /** home: centered marketing header · app: full-width header for docs and tools. */
  variant?: 'home' | 'app';
  /** Mono label after the logo: `docs`, `playground`, `design system`. */
  context?: string;
  contextHref?: string;
  links: NavLink[];
  /** id of the popover the Menu button opens on narrow screens (the docs sidebar, or the site menu). */
  menuTarget?: string;
}

const searchButton = (wide: boolean) => (
  <button
    type="button"
    data-search-open=""
    className={`flex h-[34px] items-center gap-6 rounded-block border border-line bg-paper pr-1.5 pl-3 text-sm text-mute max-[899px]:h-10 ${wide ? 'w-60 max-[899px]:w-auto' : ''}`}
  >
    <span className="flex-1 text-left">Search<span className="visually-hidden"> documentation</span>{!wide && ' docs'}</span>
    <span className="max-[899px]:hidden" aria-hidden="true"><Kbd>⌘K</Kbd></span>
  </button>
);

/**
 * Sticky header. Static HTML: the Menu button opens a native popover, and the search button is
 * picked up by the search dialog island, so the header itself needs no JavaScript.
 */
export function SiteHeader({ variant = 'app', context, contextHref, links, menuTarget }: SiteHeaderProps) {
  const home = variant === 'home';
  const menuButton = menuTarget && (
    <button
      type="button"
      popoverTarget={menuTarget}
      aria-label="Menu"
      className="h-10 rounded-block border border-line bg-transparent px-3 text-[14px] min-[900px]:hidden"
    >
      <span className="menu-label" aria-hidden="true" />
    </button>
  );
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[oklch(0.985_0.004_85/0.96)] backdrop-blur-[8px]">
      <div className={`flex h-(--height-header) items-center ${home ? 'mx-auto max-w-(--container-marketing) gap-6 px-(--gutter)' : 'gap-[18px] px-(--gutter-app) max-[419px]:gap-3'}`}>
        {!home && menuButton}
        <Logo />
        {home ? <Tag className="max-[419px]:hidden">experimental</Tag> : context && (contextHref
          ? <a href={contextHref} className="font-mono text-meta text-mute no-underline max-[419px]:hidden">{context}</a>
          : <span className="font-mono text-meta text-mute max-[419px]:hidden">{context}</span>)}
        {home && (
          <nav aria-label="Main" className="flex gap-6 text-ui text-ink-2 max-[959px]:hidden">
            {links.map((l) => <a key={l.href} href={l.href} aria-current={l.current ? 'page' : undefined} className="no-underline hover:text-ink aria-[current=page]:text-ink">{l.label}</a>)}
          </nav>
        )}
        <div className="flex-1" />
        <div className={home ? 'max-[959px]:hidden' : ''}>{searchButton(!home)}</div>
        {!home && (
          <nav aria-label="Site" className="flex gap-[22px] text-ui text-ink-2 max-[899px]:hidden">
            {links.map((l) => <a key={l.href} href={l.href} aria-current={l.current ? 'page' : undefined} className="no-underline hover:text-ink aria-[current=page]:font-medium aria-[current=page]:text-ink">{l.label}</a>)}
          </nav>
        )}
        {home && menuTarget && (
          <button type="button" popoverTarget={menuTarget} className="h-10 rounded-block border border-line bg-transparent px-3.5 text-[14px] min-[960px]:hidden">Menu</button>
        )}
      </div>
    </header>
  );
}

/** The narrow-screen site menu on the homepage, a native popover under the header. */
export function SiteMenu({ id, links }: { id: string; links: NavLink[] }) {
  return (
    <nav id={id} popover="auto" aria-label="Main" className="site-menu inset-x-0 top-(--height-header) m-0 w-full border-0 border-t border-b border-line bg-paper px-(--gutter) pt-2 pb-4 text-[17px]">
      {links.map((l) => <a key={l.href} href={l.href} className="block border-b border-line py-3 no-underline last:border-b-0">{l.label}</a>)}
      <button type="button" data-search-open="" className="block w-full border-0 bg-transparent py-3 text-left text-[17px]">Search docs</button>
    </nav>
  );
}

/** Status strip under the docs header. */
export function DocsBanner({ children }: { children: string }) {
  return <section aria-label="Documentation status" className="truncate border-b border-line bg-paper-2 px-(--gutter-app) py-[7px] font-mono text-tag whitespace-nowrap text-ink-2">{children}</section>;
}
