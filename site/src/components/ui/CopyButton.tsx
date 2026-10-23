import { MiniButton } from './MiniButton';
import { useCopy } from './useCopy';

export interface CopyButtonProps {
  text: string;
  label?: string;
  /** Accessible name, such as "Copy code". */
  ariaLabel?: string;
  className?: string;
}

export function CopyButton({ text, label = 'Copy', ariaLabel = 'Copy code', className }: CopyButtonProps) {
  const { copied, copy } = useCopy();
  return (
    // data-copy lets the layout's delegated script copy from static (not hydrated) HTML too.
    <MiniButton onClick={(e) => { e.stopPropagation(); copy(text); }} data-copy={text} aria-label={ariaLabel} className={className}>
      <span aria-live="polite" data-copy-label>{copied ? 'Copied' : label}</span>
    </MiniButton>
  );
}
