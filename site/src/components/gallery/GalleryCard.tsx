import type { ReactNode } from 'react';
import { InlineMarkdown } from '~/components/docs/InlineMarkdown';
import { Tag } from '~/components/ui/Tag';

export interface GalleryCardProps {
  title: string;
  href: string;
  description: string;
  /** API labels; Reactive CSS ones are vermilion, native ones neutral. */
  apis: { label: string; reactive: boolean }[];
  experimental?: boolean;
  /** Written in the 0.8 syntax (library demos). */
  legacy?: boolean;
  /** The live preview, for API examples. Cards without one show `tech` instead. */
  preview?: ReactNode;
  tech?: string;
  /** Spans two grid columns in the four-column layout: a larger title there. */
  wide?: boolean;
}

/**
 * One example in the gallery. The preview is the largest part and stays interactive; the rest
 * of the card is one link to the example (the title's link stretched over it). Rendered as
 * static HTML: only the preview hydrates.
 */
export function GalleryCard({ title, href, description, apis, experimental, legacy, preview, tech, wide }: GalleryCardProps) {
  return (
    <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-block border border-line bg-paper-result transition-colors hover:border-ink" data-gallery-card="">
      {preview && <div className="border-b border-line">{preview}</div>}
      <div className="group relative flex flex-1 flex-col gap-2.5 px-[18px] pt-4 pb-[18px]">
        <h3 className={`m-0 leading-[1.25] font-semibold tracking-[-0.015em] text-[17px] ${wide ? 'min-[68.75rem]:text-[21px]' : ''}`}>
          <a href={href} className="text-ink no-underline after:absolute after:inset-0 after:content-[''] group-hover:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ink">{title}</a>
        </h3>
        {/* The wrapper grows, so the clamped paragraph keeps its own height and hides the rest. */}
        <div className="flex-1"><p className="m-0 line-clamp-4 text-[14px] leading-[1.5] text-pretty text-ink-2"><InlineMarkdown text={description} /></p></div>
        {tech && <span className="font-mono text-label leading-[1.5] text-ink-body">{tech}</span>}
        <div className="flex flex-wrap gap-1.5">
          {experimental && <Tag tone="experimental">experimental</Tag>}
          {legacy && <Tag>0.8 syntax</Tag>}
          {apis.map((a) => <Tag key={a.label} tone={a.reactive ? 'reactive' : 'default'}>{a.label}</Tag>)}
        </div>
      </div>
    </article>
  );
}
