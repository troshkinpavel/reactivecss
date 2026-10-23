import { useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import type { Line, Token, TokenKind } from '~/lib/code/types';
import { GLOSSARY, type GlossaryItem } from '~/lib/content/glossary';
import { CopyButton } from '~/components/ui/CopyButton';

export interface CodePanelProps {
  /** Tokenized source, from highlight() or highlightCss(). */
  lines: Line[];
  /** Raw source for Copy. */
  code: string;
  label?: string;
  /** Replaces the label in the header, for example "Native CSS · card.css". */
  heading?: ReactNode;
  badge?: string;
  /** Header with label, legend and Copy. */
  header?: boolean;
  /** `● reactive` legend when the code contains Reactive CSS. */
  legend?: boolean;
  /** Explanation rail for reactive tokens. Off for non-CSS code. */
  explain?: boolean;
  /** No border or radius, for embedding in another panel. */
  bare?: boolean;
  fontSize?: number;
  /** Minimum height of the explanation rail, to line up with a neighbouring panel. */
  footHeight?: number;
  /** Value chip at the end of a line, keyed by zero-based line. */
  chips?: Record<number, string>;
  /** Lines currently reacting (trace). */
  flash?: number[];
  /** Lines to emphasise without the trace color. */
  focus?: number[];
  /** [line, token text] to dim: the branch of a when() that does not apply. */
  dim?: [number, string][];
  /** Extra controls in the header, before Copy. */
  actions?: ReactNode;
  className?: string;
}

const KIND_CLASS: Partial<Record<TokenKind, string>> = {
  com: 'text-mute italic',
  sel: 'text-ink font-semibold',
  tag: 'text-ink font-semibold',
  at: 'text-ink font-semibold',
  var: 'text-ink font-medium',
  kw: 'text-ink font-medium',
  prop: 'text-ink',
  id: 'text-ink',
  rx: 'text-rx font-semibold underline decoration-dotted decoration-rx-underline decoration-[1.5px] underline-offset-4',
  pun: 'text-mute',
  ws: '',
};
export const tokenClass = (k: TokenKind) => KIND_CLASS[k] ?? 'text-ink-2';

/** Code with live value chips, a reaction trace and explanations of reactive syntax. */
export function CodePanel({
  lines, code, label = 'styles.css', heading, badge, header = true, legend = true, explain = true, bare = false,
  fontSize = 14, footHeight = 0, chips = {}, flash = [], focus = [], dim = [], actions, className = '',
}: CodePanelProps) {
  const [hover, setHover] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const lh = Math.round(fontSize * 1.72);
  const hasRx = lines.some((l) => l.some((t) => t.k === 'rx'));
  const firstKey = explain ? lines.flat().find((t) => t.feature && GLOSSARY[t.feature])?.feature ?? null : null;
  const activeKey = hover ?? pin ?? firstKey;
  const active: GlossaryItem | undefined = activeKey ? GLOSSARY[activeKey] : undefined;
  const isDefault = !hover && !pin;
  const flashSet = new Set(flash), focusSet = new Set(focus);

  const togglePin = (key: string) => setPin((p) => (p === key ? null : key));
  const onKey = (key: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePin(key); }
    if (e.key === 'Escape') setPin(null);
  };

  const renderToken = (tok: Token, i: number, dimmed: boolean) => {
    const cls = `${tokenClass(tok.k)} ${dimmed ? 'opacity-30' : ''} transition-[opacity,background-color] duration-200`;
    // data-dim: the when() branch that does not apply, faded on purpose (Design System · 03).
    const key = tok.feature;
    if (explain && key && GLOSSARY[key]) {
      const on = !isDefault && activeKey === key;
      return (
        <span
          key={i}
          role="button"
          tabIndex={0}
          aria-label={tok.t === GLOSSARY[key]!.label || GLOSSARY[key]!.label.startsWith(tok.t) ? `Explain ${GLOSSARY[key]!.label}` : `Explain ${tok.t} (${GLOSSARY[key]!.label})`}
          aria-pressed={pin === key}
          data-feature={key}
          className={`${cls} cursor-help rounded-tag outline-offset-1 ${on ? 'bg-rx-active' : ''}`}
          onMouseEnter={() => setHover(key)}
          onMouseLeave={() => setHover((h) => (h === key ? null : h))}
          onFocus={() => setHover(key)}
          onBlur={() => setHover((h) => (h === key ? null : h))}
          onClick={() => togglePin(key)}
          onKeyDown={onKey(key)}
        >
          {tok.t}
        </span>
      );
    }
    return <span key={i} className={cls} data-dim={dimmed || undefined}>{tok.t}</span>;
  };

  return (
    <div
      className={`relative flex h-full w-full min-w-0 flex-col bg-paper-2 font-mono text-ink ${bare ? '' : 'overflow-hidden rounded-block border border-line'} ${className}`}
      data-code-panel=""
    >
      {header && (
        <div className="flex h-[38px] flex-none items-center gap-3 border-b border-line pr-1.5 pl-3.5 text-label text-ink-2">
          <span className="min-w-0 flex-1 truncate">{heading ?? label}</span>
          {badge && <span className="whitespace-nowrap">{badge}</span>}
          {hasRx && legend && (
            <span title="Reactive CSS syntax is vermilion with a dotted underline. Hover or tap it for an explanation." className="flex items-center gap-1.5 whitespace-nowrap text-rx">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-rx" />reactive
            </span>
          )}
          {actions}
          <CopyButton text={code} className="h-[26px]" />
        </div>
      )}
      <pre
        className="m-0 flex-[1_0_auto] overflow-x-auto overflow-y-hidden py-3.5 [scrollbar-width:thin]"
        style={{ fontSize, lineHeight: `${lh}px` }}
        // Focusable so keyboard users can scroll long lines.
        tabIndex={0}
        aria-label={label ? `${label} source` : 'Source'}
      >
        <code className="block min-w-max font-mono">
          {lines.map((line, n) => {
            const on = flashSet.has(n);
            const dimTexts = dim.filter((d) => d[0] === n).map((d) => d[1]);
            let dimDone = false;
            const chip = chips[n];
            return (
              <span
                key={n}
                data-line={n}
                data-flash={on || undefined}
                className={`flex ${on ? 'bg-trace transition-[background-color] duration-75' : focusSet.has(n) ? 'bg-[oklch(0.93_0.006_85)]' : 'transition-[background-color] duration-(--duration-trace-fade) ease-(--ease-state)'}`}
                style={{ minHeight: lh }}
              >
                {/* Line numbers are generated content: decorative, never copied with the code. */}
                <span
                  aria-hidden="true"
                  data-n={n + 1}
                  className={`w-12 flex-none pr-4 text-right text-[0.85em] select-none transition-[box-shadow,color] duration-400 before:content-[attr(data-n)] ${on ? 'text-rx shadow-[inset_2px_0_0_var(--color-rx)]' : 'text-faint shadow-[inset_2px_0_0_transparent]'}`}
                />
                <span className="whitespace-pre pr-5">
                  {line.map((t, i) => {
                    const d = !dimDone && dimTexts.includes(t.t);
                    if (d) dimDone = true;
                    return renderToken(t, i, d);
                  })}
                  {chip !== undefined && chip !== '' && (
                    <span
                      data-chip=""
                      className={`ml-3.5 inline-block rounded-tag border border-rx px-1.5 align-[1px] text-[0.8em] font-medium transition-[background-color,color] duration-300 ${on ? 'bg-rx text-on-ink' : 'bg-transparent text-rx'}`}
                      style={{ lineHeight: `${lh - 8}px` } as CSSProperties}
                    >
                      {chip}
                    </span>
                  )}
                </span>
              </span>
            );
          })}
        </code>
      </pre>
      {explain && active && (
        <div
          aria-live="polite"
          className="flex flex-none items-center gap-3 overflow-hidden border-t border-line bg-paper py-2 pr-2 pl-3.5 font-sans"
          style={{ height: Math.max(footHeight, 72) }}
        >
          <span className="font-mono text-[13px] leading-5 font-semibold whitespace-nowrap text-rx">{active.label}</span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate font-mono text-[11px] text-mute">
              {active.kind}{pin === activeKey ? ' · pinned' : isDefault ? ' · hover any red token' : ''}
            </span>
            <span className="truncate text-sm leading-[1.45] text-ink-body" title={active.summary}>{active.summary}</span>
          </span>
          <span className="flex flex-none items-center gap-1.5">
            <a href={active.href} className="inline-flex h-7 items-center whitespace-nowrap rounded-tag border border-line bg-paper px-2.5 text-[12.5px] text-ink no-underline hover:border-ink">Reference →</a>
            {pin === activeKey && (
              <button type="button" onClick={() => { setPin(null); setHover(null); }} aria-label="Close explanation" className="grid size-7 place-items-center rounded-tag border border-line bg-paper p-0 text-[15px] leading-none hover:border-ink">×</button>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
