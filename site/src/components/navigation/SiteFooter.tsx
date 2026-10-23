import { LogoMark } from '~/components/ui/Logo';

export interface FooterGroup { title: string; links: { label: string; href: string }[] }

/**
 * "End of stylesheet": a call to start, the brand with link groups, and a version bar. The copy
 * button is static HTML; BaseLayout's [data-copy] handler copies it.
 */
/** `start={false}`: a page with its own "Start with one script" section (the homepage) leaves out the footer's. */
export function SiteFooter({ groups, installTag, version, start = true }: { groups: FooterGroup[]; installTag: string; version: string; start?: boolean }) {
  return (
    <footer className={`border-t ${start ? 'border-ink' : 'border-line'} bg-paper-band`}>
      <div className="mx-auto flex max-w-(--container-marketing) flex-col gap-[clamp(40px,5vw,64px)] px-(--gutter) pt-[clamp(48px,6vw,80px)] pb-7">
        {start && <div className="flex flex-wrap items-end justify-between gap-x-16 gap-y-6">
          <div className="flex flex-[1_1_420px] flex-col gap-3.5">
            <span className="font-mono text-meta text-mute">/* end of stylesheet */</span>
            <p className="m-0 max-w-[16ch] text-[clamp(32px,4.4vw,56px)] leading-none font-semibold tracking-h1 text-balance">Start with one script.</p>
          </div>
          <button type="button" data-copy={installTag} className="flex h-[52px] min-w-0 flex-[0_1_460px] items-center gap-3 rounded-block border border-ink bg-paper pr-2 pl-4 text-left font-mono text-[13.5px] hover:bg-hover">
            <span className="min-w-0 flex-1 truncate text-ink">{installTag}</span>
            <span data-copy-label className="rounded-tag bg-ink px-2.5 py-1 text-[11.5px] text-on-ink">Copy</span>
          </button>
        </div>}
        <div className={`flex flex-wrap gap-x-16 gap-y-8 ${start ? 'border-t border-line pt-7' : ''}`}>
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3">
            <span className="flex items-center gap-2.5 font-semibold"><LogoMark />Reactive CSS</span>
            <span className="max-w-[44ch] text-sm leading-[1.55] text-pretty text-ink-2">An experimental open-source library. Not an official CSS standard. Syntax shown here follows the current design direction; check the changelog before relying on it.</span>
          </div>
          <nav aria-label="Footer" className="grid min-w-0 flex-[2_1_420px] grid-cols-3 gap-6">
            {groups.map((g) => (
              <div key={g.title} className="flex min-w-0 flex-col gap-3">
                <span className="font-mono text-label text-mute">{g.title}</span>
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-ui">
                  {g.links.map((l) => <li key={l.href}><a href={l.href} className="text-ink-body no-underline hover:text-rx-strong">{l.label}</a></li>)}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="flex flex-wrap justify-between gap-x-6 gap-y-2 border-t border-line pt-[18px] font-mono text-label text-mute">
          <span>v{version} · experimental</span>
          <span>Not affiliated with the CSS Working Group or browser vendors.</span>
        </div>
      </div>
    </footer>
  );
}
