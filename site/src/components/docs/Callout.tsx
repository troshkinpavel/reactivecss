import type { ReactNode } from 'react';

export type CalloutKind = 'note' | 'tip' | 'caution' | 'warning' | 'provisional' | 'experimental' | 'outcome';

const LABEL: Record<CalloutKind, string> = { note: 'Note', tip: 'Tip', caution: 'Caution', warning: 'Warning', provisional: 'Provisional', experimental: 'Experimental', outcome: 'Expected result' };
const BOX: Record<CalloutKind, string> = {
  note: 'bg-paper-2 border border-line',
  tip: 'bg-paper-2 border border-line',
  caution: 'border border-ink',
  warning: 'border-[1.5px] border-ink',
  provisional: 'border border-dashed border-[oklch(0.72_0.006_80)]',
  experimental: 'border border-dashed border-rx-soft',
  outcome: 'border border-line',
};

export interface CalloutProps { kind?: CalloutKind; title?: string; children: ReactNode }

/** Note and tip are tinted; caution and warning use an ink border, so they never read as reactive. */
export function Callout({ kind = 'note', title, children }: CalloutProps) {
  const base = LABEL[kind];
  const label = (kind === 'warning' ? '! ' : kind === 'outcome' ? '✓ ' : '') + base + (title && title.toLowerCase() !== base.toLowerCase() ? ' · ' + title : '');
  return (
    <div role="note" className={`my-6 mt-1 flex max-w-(--container-prose) flex-col gap-1.5 rounded-block px-[18px] py-3.5 ${BOX[kind]}`}>
      <span className={`font-mono text-label ${kind === 'caution' || kind === 'warning' ? 'text-ink' : 'text-ink-2'} ${kind === 'warning' ? 'font-semibold' : ''}`}>{label}</span>
      <div className="text-note leading-[1.6] text-pretty text-ink-body [&_p]:m-0">{children}</div>
    </div>
  );
}
