import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet';
export type ButtonSize = 'lg' | 'md' | 'sm';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-on-ink border border-ink hover:bg-ink-hover hover:border-ink-hover',
  secondary: 'border border-ink bg-transparent text-ink hover:bg-hover',
  quiet: 'border border-line bg-transparent text-ink hover:border-ink',
};
const SIZE: Record<ButtonSize, string> = { lg: 'h-[46px] px-5 text-base', md: 'h-10 px-4 text-[14px]', sm: 'h-9 px-3.5 text-[14px]' };
const DISABLED = 'disabled:border-transparent disabled:bg-[oklch(0.9_0.005_85)] disabled:text-mute aria-disabled:pointer-events-none aria-disabled:bg-[oklch(0.9_0.005_85)] aria-disabled:text-mute';

export const buttonClass = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra = '') =>
  `inline-flex items-center justify-center gap-2 rounded-block font-medium whitespace-nowrap no-underline transition-colors duration-(--duration-feedback) ${VARIANT[variant]} ${SIZE[size]} ${DISABLED} ${extra}`;

type Common = { variant?: ButtonVariant; size?: ButtonSize };

/** Primary (ink fill), secondary (ink outline) or quiet (hairline). Min height 40px, 46px for hero actions. */
export function Button({ variant, size, className, ...rest }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={buttonClass(variant, size, className)} {...rest} />;
}

/** A link styled as a button, for navigation. */
export function ButtonLink({ variant, size, className, ...rest }: Common & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a className={buttonClass(variant, size, className)} {...rest} />;
}
