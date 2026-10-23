import { DEEP, FEATURED, UPCOMING } from '~/lib/content/advanced';
import { Tag } from '~/components/ui/Tag';

const chip = (t: string, planned = false) => (
  <span key={t} className={`rounded-tag px-1.5 py-px font-mono text-label whitespace-nowrap ${planned ? 'border border-dashed border-[oklch(0.72_0.006_80)] text-ink-2' : 'border border-line text-rx'}`}>{t}</span>
);

/** Advanced Examples: the featured workspace, its deep dive and the dashed upcoming cards. */
export function AdvancedIndex() {
  return (
    <div className="mt-1 mb-8 flex max-w-(--container-article) flex-col gap-3">
      <a href={FEATURED.href} className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] overflow-hidden rounded-block border border-ink no-underline hover:bg-paper-band">
        <span className="flex flex-col gap-2.5 px-[22px] pt-[22px] pb-5">
          <span className="flex items-center gap-2.5 font-mono text-tag text-ink-2"><span>01</span><span className="flex items-center gap-1.5 text-rx"><span className="size-1.5 rounded-full bg-rx" />available</span></span>
          <span className="text-[24px] leading-[1.15] font-semibold tracking-[-0.02em]">{FEATURED.title} →</span>
          <span className="text-note leading-[1.55] text-pretty text-ink-2">{FEATURED.summary}</span>
          <span className="mt-1 flex flex-wrap gap-[5px]">{FEATURED.uses.map((u) => chip(u))}</span>
        </span>
        <span className="relative flex flex-col justify-center gap-2.5 bg-paper-alt p-[22px] shadow-[-1px_0_0_var(--color-line),0_-1px_0_var(--color-line)]">
          <span className="font-mono text-tag text-mute">every change is traced</span>
          <span className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
            {FEATURED.chain.map(([k, t, red], i) => (
              <span key={k} className="flex items-center gap-1">
                <span className={`flex flex-col gap-0.5 rounded-block border bg-paper px-[9px] py-1.5 font-mono text-[12.5px] whitespace-nowrap ${red ? 'border-rx-soft font-semibold text-rx' : 'border-line text-ink'}`}>
                  <span className="text-[10px] font-normal text-mute">{k}</span>{t}
                </span>
                {i < FEATURED.chain.length - 1 && <span aria-hidden="true" className="font-mono text-label text-mute">→</span>}
              </span>
            ))}
          </span>
        </span>
      </a>
      <a href={DEEP.href} className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-center gap-x-7 gap-y-2.5 rounded-block border border-line px-[22px] py-4 no-underline hover:border-ink">
        <span className="flex flex-col gap-[5px]"><span className="font-mono text-tag text-ink-2">02 · deep dive</span><span className="text-[18px] font-semibold tracking-[-0.015em]">{DEEP.title} →</span><span className="text-ui leading-normal text-pretty text-ink-2">{DEEP.summary}</span></span>
        <span className="flex flex-wrap content-center gap-[5px]">{DEEP.uses.map((u) => chip(u))}</span>
      </a>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-2.5">
        {UPCOMING.map((u) => (
          <div key={u.title} className="flex flex-col gap-2 rounded-block border border-dashed border-line-dashed px-3 pt-3 pb-4">
            <div aria-hidden="true" className="grid h-[92px] place-items-center rounded-tag bg-[repeating-linear-gradient(135deg,var(--color-stripe-a)_0_6px,var(--color-stripe-b)_6px_12px)] font-mono text-[11px] text-mute">{u.placeholder}</div>
            <div className="flex items-baseline justify-between gap-2 px-0.5"><span className="text-[16px] font-semibold">{u.title}</span><Tag className="!px-1 !text-micro">upcoming</Tag></div>
            <span className="px-0.5 text-sm leading-normal text-ink-2">{u.summary}</span>
            <span className="flex flex-wrap gap-1 px-0.5">{u.uses.map(([t, p]) => chip(t, p))}</span>
            {u.note && <span className="px-0.5 text-[12.5px] leading-[1.45] text-mute">{u.note}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
