import { useRef, type KeyboardEvent } from 'react';

export interface SegmentedOption<T extends string> { value: T; label: string }

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: 'sm' | 'md';
  mono?: boolean;
  className?: string;
}

/** Joined buttons with one selected (ink fill). A radio group: arrow keys move the selection. */
export function SegmentedControl<T extends string>({ options, value, onChange, label, size = 'md', mono = false, className = '' }: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + options.length) % options.length;
    onChange(options[n]!.value);
    refs.current[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={`flex overflow-hidden rounded-block border border-line bg-paper ${className}`}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={`border-0 whitespace-nowrap ${i ? 'border-l border-line' : ''} ${size === 'sm' ? 'h-[30px] px-3 text-sm' : 'h-9 px-3.5 text-[14px]'} ${mono ? 'font-mono text-label' : ''} ${on ? 'bg-ink text-on-ink' : 'bg-transparent text-ink hover:bg-hover'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
