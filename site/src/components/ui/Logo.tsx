/** The mark: a declaration block holding one live value. */
export function LogoMark({ size = 16 }: { size?: number }) {
  return (
    <span aria-hidden="true" className="flex items-center gap-[3px] font-mono font-medium" style={{ fontSize: size }}>
      {'{'}<span className="size-[7px] rounded-full bg-rx" />{'}'}
    </span>
  );
}

export interface LogoProps {
  href?: string;
  /** Hide the wordmark (very narrow headers). */
  compact?: boolean;
}

export function Logo({ href = '/', compact = false }: LogoProps) {
  return (
    <a href={href} aria-label="Reactive CSS home" className="flex items-center gap-2.5 text-base font-semibold tracking-[-0.01em] no-underline">
      <LogoMark />
      {!compact && <span className="text-[16px] whitespace-nowrap">Reactive CSS</span>}
    </a>
  );
}
