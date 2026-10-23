import type { ReactNode } from 'react';

export type TagTone = 'default' | 'experimental' | 'ink' | 'reactive' | 'planned';

const TONE: Record<TagTone, string> = {
  default: 'border border-line-strong text-ink-2',
  experimental: 'border border-dashed border-rx text-rx',
  ink: 'border border-ink text-ink',
  reactive: 'border border-line text-rx',
  planned: 'border border-dashed border-[oklch(0.72_0.006_80)] text-ink-2',
};

/** Status label in mono: `tutorial`, `exp`, `since 0.2`. Status is text, never color alone. */
export function Tag({ children, tone = 'default', className = '' }: { children: ReactNode; tone?: TagTone; className?: string }) {
  return <span className={`inline-block rounded-tag px-1.5 py-px font-mono text-tag leading-[1.45] whitespace-nowrap ${TONE[tone]} ${className}`}>{children}</span>;
}

/** Keyboard shortcut hint. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-tag border border-line px-[5px] py-px font-mono text-[11px] leading-normal">{children}</kbd>;
}
