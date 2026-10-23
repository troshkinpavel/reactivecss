import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem { id: string; label: ReactNode }

export interface TabListProps {
  items: TabItem[];
  selected: string;
  onSelect: (id: string) => void;
  label: string;
  /** id prefix shared with the panels: panel `${idBase}-panel-${id}`. */
  idBase: string;
  className?: string;
  tabClassName?: (selected: boolean) => string;
}

/** ARIA tabs with roving tabindex: arrow keys, Home and End move between tabs. */
export function TabList({ items, selected, onSelect, label, idBase, className = '', tabClassName }: TabListProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const n = items.length;
    const to = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    onSelect(items[to]!.id);
    refs.current[to]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={className}>
      {items.map((t, i) => {
        const on = t.id === selected;
        return (
          <button
            key={t.id}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            id={`${idBase}-tab-${t.id}`}
            aria-selected={on}
            aria-controls={`${idBase}-panel-${t.id}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onSelect(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={tabClassName?.(on)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
