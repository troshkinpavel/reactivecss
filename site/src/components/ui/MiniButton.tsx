import type { ButtonHTMLAttributes } from 'react';

/** The small mono button used in panel headers: Copy, Reset, Fold all, Explain. */
export function MiniButton({ className = '', pressed, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`h-7 shrink-0 whitespace-nowrap rounded-tag border px-2.5 font-mono text-tag transition-colors duration-(--duration-feedback) ${pressed ? 'border-ink bg-paper text-ink' : 'border-line bg-paper text-ink hover:border-ink'} ${className}`}
      {...rest}
    />
  );
}
