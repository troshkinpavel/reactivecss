import { Tag } from '~/components/ui/Tag';

export interface SidebarItem { label: string; href: string; current?: boolean; mono?: boolean; status?: string; indent?: boolean }
export interface SidebarCategory { label: string; items: SidebarItem[] }
export interface SidebarGroup { title: string; entries: (SidebarItem | SidebarCategory)[] }

const isCategory = (e: SidebarItem | SidebarCategory): e is SidebarCategory => 'items' in e;

function Item({ item }: { item: SidebarItem }) {
  return (
    <a
      href={item.href}
      aria-current={item.current ? 'page' : undefined}
      className={`flex items-center justify-between gap-2 rounded-block py-[5px] pr-2.5 no-underline max-[899px]:py-2.5 max-[899px]:text-[16px] ${item.indent ? 'pl-[22px]' : 'pl-2.5'} text-ui ${item.current ? 'bg-active font-semibold text-ink' : 'text-ink-2 hover:text-ink hover:underline'}`}
    >
      <span className={item.mono ? `font-mono text-[0.88em] ${item.current ? 'text-rx-strong' : 'text-ink-2'}` : ''}>{item.label}</span>
      {item.status && <Tag className="!px-1 !text-micro !leading-4">{item.status}</Tag>}
    </a>
  );
}

/**
 * Documentation navigation. API categories are native <details>, open when they contain the
 * current page. On narrow screens the whole nav is a popover opened by the header Menu button.
 */
export function DocsSidebar({ id = 'docs-nav', groups }: { id?: string; groups: SidebarGroup[] }) {
  return (
    <nav
      id={id}
      popover="auto"
      aria-label="Documentation"
      className="docs-nav m-0 border-0 bg-paper p-0 text-ink min-[900px]:sticky min-[900px]:top-[calc(var(--height-header)+var(--height-banner))] min-[900px]:block min-[900px]:h-[calc(100vh-var(--height-header)-var(--height-banner))] min-[900px]:w-(--width-nav) min-[900px]:flex-none min-[900px]:overflow-y-auto min-[900px]:border-r min-[900px]:border-line"
    >
      <div className="px-4 pt-5 pb-12 min-[900px]:pt-6 min-[900px]:pr-3.5 min-[900px]:pb-10 min-[900px]:pl-[18px]">
        {groups.map((g) => (
          <div key={g.title} className="mb-5 flex flex-col gap-px">
            <div className="px-2.5 pb-[7px] font-mono text-tag tracking-[0.02em] text-mute">{g.title}</div>
            {g.entries.map((e) => isCategory(e) ? (
              <details key={e.label} open={e.items.some((i) => i.current)} className="group/cat">
                <summary className="flex cursor-pointer list-none items-center justify-between px-2.5 py-[5px] text-sm text-ink-2 max-[899px]:py-2.5 max-[899px]:text-base [&::-webkit-details-marker]:hidden">
                  <span>{e.label}</span>
                  <span className="font-mono text-[11px] text-mute"><span className="group-open/cat:hidden">{e.items.length}</span><span className="hidden group-open/cat:inline">−</span></span>
                </summary>
                {e.items.map((i) => <Item key={i.href} item={{ ...i, indent: true }} />)}
              </details>
            ) : <Item key={e.href} item={e} />)}
          </div>
        ))}
        <div className="border-t border-line px-2.5 pt-3.5 text-label leading-[1.6] text-mute">
          <span className="font-mono text-ink-2">exp</span> experimental · <span className="font-mono text-ink-2">new</span> recently added
        </div>
      </div>
    </nav>
  );
}
