import { forwardRef, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { tokenClass } from '~/components/code/CodePanel';
import { MiniButton } from '~/components/ui/MiniButton';
import { useCopy } from '~/components/ui/useCopy';
import type { Line } from '~/lib/code/types';
import { sectionsOf, type SourceFile } from './model';

export interface ViewerFile extends SourceFile { lines: Line[] }

export interface SourceViewerProps {
  files: ViewerFile[];
  file: number;
  onFile: (i: number) => void;
  /** Expression id per line of the current file (style.css only). */
  lineEntry?: (string | null)[];
  /** Expression count per section label, for the outline. */
  sectionCounts?: Record<string, number>;
  chips?: Record<number, string>;
  flash?: number[];
  /** Lines of the selected / hovered expression. */
  focus?: number[];
  onSelect?: (entryId: string) => void;
  onHover?: (entryId: string | null) => void;
  /** Called when the reader scrolls by hand (pauses Follow interactions). */
  onManualScroll?: () => void;
  note?: string;
  showOutline?: boolean;
  /** Shown under the file tabs, for example the vanilla-source notice. */
  banner?: ReactNode;
}

export interface SourceViewerHandle { scrollToLine(line: number, onlyIfHidden?: boolean): void }

const LH = 22;

/** The workspace code panel: outline, folding by section, live chips, selectable expressions. */
export const SourceViewer = forwardRef<SourceViewerHandle, SourceViewerProps>(function SourceViewer(
  { files, file, onFile, lineEntry = [], sectionCounts, chips = {}, flash = [], focus = [], onSelect, onHover, onManualScroll, note, showOutline = true, banner }, ref,
) {
  const f = files[file]!;
  const sections = useMemo(() => sectionsOf(f), [f]);
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [active, setActive] = useState(0);
  const body = useRef<HTMLDivElement>(null);
  const programmatic = useRef(false);
  const { copied, copy } = useCopy();
  const fk = (line: number) => `${f.name}:${line}`;

  const visible = useMemo(() => {
    const out: number[] = [];
    let skip = -1;
    f.lines.forEach((_, i) => {
      if (i <= skip) return;
      out.push(i);
      const s = sections.find((x) => x.line === i);
      if (s && folded[fk(i)]) skip = s.end;
    });
    return out;
  }, [f, sections, folded]);

  const scrollToLine = (line: number, onlyIfHidden = false) => {
    const sec = [...sections].reverse().find((s) => s.line <= line);
    const go = () => {
      const el = body.current;
      if (!el) return;
      const idx = visible.indexOf(line);
      if (idx < 0) return;
      const top = 8 + idx * LH;
      if (onlyIfHidden && top >= el.scrollTop + LH && top + LH * 2 <= el.scrollTop + el.clientHeight) return;
      programmatic.current = true;
      setTimeout(() => { programmatic.current = false; }, 800);
      el.scrollTo({ top: Math.max(0, top - 3 * LH), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    };
    if (sec && sec.line !== line && folded[fk(sec.line)]) { setFolded((x) => ({ ...x, [fk(sec.line)]: false })); setTimeout(go, 30); }
    else go();
  };
  useImperativeHandle(ref, () => ({ scrollToLine }));

  const onScroll = () => {
    const el = body.current;
    if (!el) return;
    if (!programmatic.current) onManualScroll?.();
    const top = visible[Math.min(visible.length - 1, Math.floor(el.scrollTop / LH) + 1)] ?? 0;
    let a = 0;
    sections.forEach((s, k) => { if (s.line <= top) a = k; });
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) a = sections.length - 1;
    if (a !== active) setActive(a);
  };

  const allFolded = sections.length > 0 && sections.every((s) => folded[fk(s.line)]);
  const foldAll = () => setFolded(Object.fromEntries(sections.map((s) => [fk(s.line), !allFolded])));
  const flashSet = new Set(flash), focusSet = new Set(focus);
  const isCss = f.lang === 'css' && lineEntry.length > 0;
  const key = (id: string) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(id); } };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[39px] flex-none items-center gap-1.5 border-b border-line bg-paper-2 pr-1.5 pl-0.5">
        <div role="tablist" aria-label="Files" className="flex min-w-0 flex-1 self-stretch overflow-x-auto [scrollbar-width:none]">
          {files.map((x, i) => (
            <button key={x.name} type="button" role="tab" aria-selected={i === file} onClick={() => onFile(i)} className={`flex h-full flex-none items-center gap-2 border-0 border-b-2 bg-transparent px-3 pt-0.5 font-mono text-meta whitespace-nowrap ${i === file ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink-2'}`}>
              <span>{x.name}</span><span className="font-sans text-tag font-normal text-mute">{x.code.split('\n').length} lines</span>
            </button>
          ))}
          {note && <span className="self-center px-2.5 font-mono text-tag whitespace-nowrap text-mute">{note}</span>}
        </div>
        <MiniButton onClick={foldAll} disabled={!sections.length}>{allFolded ? 'Unfold all' : 'Fold all'}</MiniButton>
        <MiniButton onClick={() => copy(f.code)} aria-label="Copy current file"><span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span></MiniButton>
      </div>
      {banner}
      <div className="relative flex min-h-0 flex-1">
        {showOutline && sections.length > 0 && (
          <nav aria-label="Code outline" className="w-[178px] flex-none overflow-y-auto border-r border-line bg-paper py-2.5 max-[1179px]:hidden">
            <div className="flex justify-between pr-3 pb-2 pl-3.5 font-mono text-[11px] text-mute"><span>outline</span><span>{isCss ? 'expr.' : 'lines'}</span></div>
            {sections.map((s, k) => (
              <button key={s.line} type="button" aria-current={k === active ? 'true' : undefined} onClick={() => { setActive(k); scrollToLine(s.line); }} className={`flex w-full items-center justify-between gap-2 border-0 py-[5px] pr-3 pl-3.5 text-left text-sm ${k === active ? 'bg-active font-semibold text-ink' : 'bg-transparent text-ink-2 hover:text-ink'}`}>
                <span className="truncate">{s.label}</span>
                <span className={`font-mono text-[11px] ${isCss && (sectionCounts?.[s.label] ?? 0) > 0 ? 'text-rx' : 'text-mute'}`}>{isCss ? sectionCounts?.[s.label] ?? 0 : s.end - s.line + 1}</span>
              </button>
            ))}
          </nav>
        )}
        <div ref={body} onScroll={onScroll} className="min-w-0 flex-1 overflow-auto bg-paper-2 py-2 font-mono text-[13.5px]" style={{ lineHeight: `${LH}px` }} tabIndex={0} aria-label={`${f.name} source`}>
          <div className="w-max min-w-full">
            {visible.map((n) => {
              const line = f.lines[n] ?? [];
              const sec = sections.find((s) => s.line === n);
              const isFolded = !!(sec && folded[fk(n)]);
              const entry = isCss ? lineEntry[n] ?? null : null;
              const on = flashSet.has(n);
              return (
                <div key={n} data-line={n} className={`flex ${on ? 'bg-trace' : focusSet.has(n) ? 'bg-rx-active/60' : 'transition-[background-color] duration-500'}`} style={{ minHeight: LH }}
                  onMouseEnter={entry ? () => onHover?.(entry) : undefined} onMouseLeave={entry ? () => onHover?.(null) : undefined}>
                  <span className={`flex w-14 flex-none items-center justify-end gap-1 pr-3.5 text-[0.85em] select-none ${on ? 'text-rx shadow-[inset_2px_0_0_var(--color-rx)]' : 'text-faint'}`}>
                    {sec && <button type="button" onClick={() => setFolded((x) => ({ ...x, [fk(n)]: !isFolded }))} aria-label={`${isFolded ? 'Unfold' : 'Fold'} ${sec.label}`} aria-expanded={!isFolded} className="size-3.5 border-0 bg-transparent p-0 text-[9px] leading-[14px] text-mute">{isFolded ? '▸' : '▾'}</button>}
                    <span aria-hidden="true" data-n={n + 1} className="before:content-[attr(data-n)]" />
                  </span>
                  <span className="pr-7 whitespace-pre">
                    {line.map((t, i) => entry && (t.k === 'rx' || t.k === 'var')
                      ? <span key={i} role="button" tabIndex={0} aria-label={`Inspect ${t.t}`} onClick={() => onSelect?.(entry)} onKeyDown={key(entry)} className={`${tokenClass(t.k)} cursor-pointer rounded-tag hover:bg-rx-active`}>{t.t}</span>
                      : <span key={i} className={tokenClass(t.k)}>{t.t}</span>)}
                    {isFolded && <button type="button" onClick={() => setFolded((x) => ({ ...x, [fk(n)]: false }))} className="ml-2.5 h-[18px] rounded-tag border border-line bg-paper px-1.5 align-[1px] text-[11px] text-ink-2">··· {sec!.end - sec!.line} lines</button>}
                    {chips[n] !== undefined && <span data-chip="" className={`ml-3.5 inline-block rounded-tag border border-rx px-1.5 align-[1px] text-[0.8em] leading-[16px] font-medium ${on ? 'bg-rx text-on-ink' : 'text-rx'}`}>{chips[n]}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});
