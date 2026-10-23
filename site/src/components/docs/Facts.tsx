import type { ReactNode } from 'react';

/** A row of facts above a tutorial: Time, You need, You will use. */
export function Facts({ children }: { children: ReactNode }) {
  return <dl className="mb-8 grid max-w-[860px] grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] border-t border-b border-t-ink border-b-line">{children}</dl>;
}
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 pr-4">
      <dt className="font-mono text-tag text-mute">{label}</dt>
      <dd className="m-0 text-base">{children}</dd>
    </div>
  );
}

/** Numbered steps with arrows: the compile pipeline, the reaction loop. */
export function Flow({ children, label = 'Steps' }: { children: ReactNode; label?: string }) {
  return <ol aria-label={label} className="mt-2 mb-7 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] overflow-hidden rounded-block border border-line p-0 [counter-reset:flow]">{children}</ol>;
}
export function FlowStep({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="relative group flex flex-col gap-1.5 p-3.5 shadow-[-1px_0_0_var(--color-line),0_-1px_0_var(--color-line)] [counter-increment:flow]">
      <span className="flex items-center justify-between font-mono text-label text-mute">
        <span className="before:content-[counter(flow,decimal-leading-zero)]" />
        <span aria-hidden="true" className="group-last:hidden">→</span>
      </span>
      <span className="text-[16px] font-semibold">{title}</span>
      <span className="text-sm leading-normal text-ink-2">{children}</span>
    </li>
  );
}

/** Next-step cards. */
export function Cards({ children }: { children: ReactNode }) {
  return <div className="mt-1 mb-6 grid max-w-[860px] grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2.5">{children}</div>;
}
export function Card({ href, title, children }: { href: string; title: string; children?: ReactNode }) {
  return (
    <a href={href} className="flex flex-col gap-1.5 rounded-block border border-line p-4 no-underline hover:border-ink">
      <span className="font-semibold">{title} →</span>
      {children && <span className="text-[14px] leading-normal text-ink-2">{children}</span>}
    </a>
  );
}
