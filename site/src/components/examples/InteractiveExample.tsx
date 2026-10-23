import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CodePanel } from '~/components/code/CodePanel';
import { MiniButton } from '~/components/ui/MiniButton';
import { TabList } from '~/components/ui/TabList';
import { useCopy } from '~/components/ui/useCopy';
import { highlightCss } from '~/lib/code/css';
import type { Line } from '~/lib/code/types';
import { analyze } from '~/lib/examples/analyze';
import { inactiveBranches } from '~/lib/examples/branches';
import type { ExampleControl, ExampleDefinition } from '~/examples/manifest';
import { EventLog, RESULT_BG, ResultHeader, StateFoot, StateTable } from './Inspector';
import { PreviewFrame } from './PreviewFrame';
import { usePreviewSession } from './usePreviewSession';

export type ExampleSize = 'compact' | 'standard' | 'expanded';

/** Prepended to the vanilla JS tab (and to the JS its caller highlights), so it is never mistaken for part of the example. */
export const COMPARISON_NOTE = '// For comparison only. Not needed with Reactive CSS.\n// The same behavior written in plain JavaScript.\n\n';

export interface InteractiveExampleProps {
  example: ExampleDefinition;
  /** compact: CSS only · standard: CSS, JS and HTML tabs · expanded: adds the state table and event log. */
  size?: ExampleSize;
  /** Show the example's source controls (for example color and transition). */
  controls?: boolean;
  /** Pre-highlighted HTML and vanilla JS (with COMPARISON_NOTE first), from highlight() at build time. */
  highlighted: { html: Line[]; js: Line[] | null };
}

/** Applies control selections to the stylesheet: each control replaces its value token. */
const applyControls = (css: string, controls: ExampleControl[], picked: Record<string, string>) =>
  controls.reduce((s, c) => s.split(c.value).join(picked[c.label] ?? c.value), css);

export function InteractiveExample({ example, size = 'standard', controls = false, highlighted }: InteractiveExampleProps) {
  const uid = useId().replace(/:/g, '');
  const compact = size === 'compact', expanded = size === 'expanded';
  const ctrls = controls ? example.controls ?? [] : [];
  const [picked, setPicked] = useState<Record<string, string>>({});
  const css = useMemo(() => applyControls(example.files.css, ctrls, picked), [example.files.css, picked]);
  const analysis = useMemo(() => analyze(css), [css]);
  const cssLines = useMemo(() => highlightCss(css), [css]);
  const session = usePreviewSession(analysis);
  const [tab, setTab] = useState('css');
  const [explain, setExplain] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [pulse, setPulse] = useState<number[]>([]);
  const pulseTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(pulseTimer.current), []);
  const { copied, copy } = useCopy();

  // A changed stylesheet starts a new preview, as editing a stylesheet resets state at runtime.
  useEffect(() => { session.reset(); }, [css]);

  const files = [
    { id: 'css', name: `${example.stem}.css`, tag: 'Reactive CSS', code: css, lines: cssLines },
    ...(!compact ? [
      { id: 'html', name: 'index.html', tag: 'HTML', code: example.files.html, lines: highlighted.html },
      ...(example.files.js && highlighted.js ? [{ id: 'js', name: 'vanilla.js', tag: 'comparison · not shipped', code: COMPARISON_NOTE + example.files.js, lines: highlighted.js }] : []),
    ] : []),
  ];
  const file = files.find((f) => f.id === tab) ?? files[0]!;
  const onCss = file.id === 'css';

  const rows = [...session.current.values()];
  const footH = Math.max(72, 18 + (rows.length + 1) * 18 + rows.length * 3 + 1);
  const shown = new Map([...session.current].map(([k, v]) => [k, v.value]));
  const dim = onCss ? inactiveBranches(css.split('\n'), shown) : [];
  // Sized from the stylesheet, so switching to a wider file never moves the preview under the code.
  const longest = Math.min(64, Math.max(...css.split('\n').map((l) => l.length)));
  // A demo that asks for a wider preview keeps it beside the code by letting long code lines scroll.
  const codeCap = example.previewWidth ? `, max(320px, calc(100% - ${example.previewWidth}px))` : '';
  const codeFlex = `1.45 1 min(100%, calc(${longest}ch + 72px)${codeCap})`;
  const prevFlex = `1 1 ${example.previewWidth ?? (compact ? 200 : 250)}px`;

  const pick = (c: ExampleControl, v: string) => {
    setPicked((p) => ({ ...p, [c.label]: v }));
    const line = example.files.css.split('\n').findIndex((l) => l.includes(c.value));
    setPulse([line]);
    clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulse([]), 600);
  };
  const restart = () => { setPicked({}); setResetKey((k) => k + 1); session.reset(); };

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-block border border-line bg-paper font-sans text-ink" data-example={example.id}>
      <div className="flex min-h-10 items-center gap-1.5 border-b border-line bg-paper-2 pr-1.5 pl-0.5">
        <TabList
          label="Example files"
          idBase={uid}
          items={files.map((f) => ({ id: f.id, label: <><span>{f.name}</span>{!compact && f.id === file.id && <span className="font-sans text-tag font-normal text-mute">{f.tag}</span>}</> }))}
          selected={file.id}
          onSelect={setTab}
          className="flex min-w-0 flex-1 self-stretch overflow-x-auto overflow-y-hidden [scrollbar-width:none]"
          tabClassName={(on) => `flex h-10 flex-none items-center gap-2 border-0 border-b-2 bg-transparent px-3 pt-0.5 font-mono text-meta whitespace-nowrap ${on ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink-2'}`}
        />
        {!compact && onCss && (
          <MiniButton pressed={explain} onClick={() => setExplain((e) => !e)} title="Show explanations for Reactive CSS syntax">{explain ? 'Explain ✓' : 'Explain'}</MiniButton>
        )}
        {expanded && <MiniButton onClick={restart}>Reset</MiniButton>}
        <MiniButton onClick={() => copy(file.code)} aria-label="Copy current file"><span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span></MiniButton>
      </div>

      <div className="flex flex-wrap">
        <div
          role="tabpanel"
          id={`${uid}-panel-${file.id}`}
          aria-labelledby={`${uid}-tab-${file.id}`}
          className="flex min-w-0 flex-col bg-paper-2"
          style={{ flex: codeFlex }}
        >
          <div className="grid min-w-0 flex-[1_0_auto] grid-cols-[minmax(0,1fr)]">
            <CodePanel
              lines={file.lines}
              code={file.code}
              header={false}
              bare
              explain={onCss && explain}
              fontSize={compact ? 13 : 14}
              footHeight={footH}
              chips={onCss ? session.chips : {}}
              flash={onCss ? [...session.flash, ...pulse] : []}
              dim={dim}
            />
          </div>
        </div>

        <div className="relative flex min-w-0 flex-col bg-paper-result shadow-[-1px_0_0_var(--color-line),0_-1px_0_var(--color-line)]" style={{ flex: prevFlex }}>
          <ResultHeader label={example.a11y} />
          <div className="relative flex flex-1 flex-col" style={{ minHeight: compact ? 150 : expanded ? 280 : 230 }}>
            <PreviewFrame reportProblems={false}
              sources={{ css, base: `${example.files.base}\n${RESULT_BG}`, html: example.files.html }}
              analysis={analysis}
              title={`${example.title} preview`}
              onMessage={session.handle}
              resetKey={resetKey}
              growToContent
              className="min-h-0 flex-1 bg-paper-result!"
            />
            {ctrls.length > 0 && (
              <div className="flex flex-col items-center gap-3 px-3 pb-4">
                {ctrls.map((c) => (
                  <div key={c.label} role="radiogroup" aria-label={c.label} className="flex items-center gap-1.5">
                    <span className="mr-1 font-mono text-tag text-ink-2">{c.label}</span>
                    {c.kind === 'swatch'
                      ? c.options.map((o) => {
                        const on = (picked[c.label] ?? c.value) === o;
                        return <button key={o} type="button" role="radio" aria-checked={on} aria-label={o} onClick={() => pick(c, o)} className={`size-[30px] rounded-block border-0 ${on ? 'shadow-[0_0_0_2px_var(--color-paper),0_0_0_3.5px_var(--color-ink)]' : ''}`} style={{ background: o }} />;
                      })
                      : <div className="flex overflow-hidden rounded-block border border-line">{c.options.map((o, i) => {
                        const on = (picked[c.label] ?? c.value) === o;
                        return <button key={o} type="button" role="radio" aria-checked={on} onClick={() => pick(c, o)} className={`h-[30px] border-0 px-2.5 font-mono text-label ${i ? 'border-l border-line' : ''} ${on ? 'bg-ink text-on-ink' : 'bg-transparent text-ink'}`}>{o}</button>;
                      })}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <StateFoot rows={rows} lastEvent={session.lastEvent} height={footH} />
        </div>
      </div>

      {expanded && (
        <div className="flex flex-wrap border-t border-line">
          <div className="min-w-0 py-2.5" style={{ flex: codeFlex }}>
            <div className="px-3.5 pb-1.5 font-mono text-tag text-mute">state</div>
            <StateTable rows={[...session.values.values()]} />
          </div>
          <div className="relative min-w-0 px-3 py-2.5 shadow-[-1px_0_0_var(--color-line),0_-1px_0_var(--color-line)]" style={{ flex: prevFlex }}>
            <div className="pb-1.5 font-mono text-tag text-mute">events</div>
            <EventLog entries={session.log} />
          </div>
        </div>
      )}
      {session.diagnostics.length > 0 && (
        <div role="status" className="flex gap-2.5 border-t border-ink px-3.5 py-2.5 text-sm text-ink">
          <span className="font-mono text-label">!</span>
          <span><span className="font-mono text-label">ReactiveCSS.diagnostics</span> · {session.diagnostics.at(-1)}</span>
        </div>
      )}
    </div>
  );
}
