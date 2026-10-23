import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { CodePanel } from '~/components/code/CodePanel';
import { EventLog, StateTable } from '~/components/examples/Inspector';
import { PreviewFrame } from '~/components/examples/PreviewFrame';
import { usePreviewSession } from '~/components/examples/usePreviewSession';
import { TabList } from '~/components/ui/TabList';
import { highlightCss } from '~/lib/code/css';
import type { Line } from '~/lib/code/types';
import { analyze } from '~/lib/examples/analyze';
import type { ExampleDefinition } from '~/examples/manifest';

export interface ExampleDetailProps {
  example: ExampleDefinition;
  /** index.html, highlighted at build time. */
  htmlLines: Line[];
  /** Opens this example's stylesheet in the Playground, where it is supported. */
  playgroundHref?: string;
  /** One line under the source: which part of the file is shown. */
  sourceNote?: string;
  /** One line under the preview: how to use it (the README's "How to interact"). */
  hint?: string;
  /** "How it works", rendered at build time: beside the source on wide screens, above it otherwise. */
  children?: ReactNode;
}

const btn = 'inline-flex h-8 items-center rounded-block border border-line bg-paper px-3 text-[13px] text-ink no-underline hover:border-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink';

/**
 * An example's detail page: the live preview (Reset, View source, Playground, an optional
 * inspector), the explanation, and the real source with its live values. One runtime, the real one.
 */
export function ExampleDetail({ example, htmlLines, playgroundHref, sourceNote, hint, children }: ExampleDetailProps) {
  const uid = useId().replace(/:/g, '');
  const css = example.files.css;
  const analysis = useMemo(() => analyze(css), [css]);
  const lines = useMemo(() => highlightCss(css), [css]);
  const session = usePreviewSession(analysis);
  const [resetKey, setResetKey] = useState(0);
  const [inspect, setInspect] = useState(false);
  const [tab, setTab] = useState<'css' | 'html'>('css');
  const [all, setAll] = useState(false);
  const shown = tab === 'css' ? lines : htmlLines;
  const long = shown.length > 18;
  const reset = () => { setResetKey((k) => k + 1); session.reset(); };
  const panel = useRef<HTMLDivElement>(null);
  // The button disappears when the code opens: keep keyboard focus on the code, not the page.
  const showAll = () => { setAll(true); requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('pre')?.focus()); };

  return (
    <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-x-10" data-example-detail={example.id}>
      <section aria-label="Live preview" data-pagefind-ignore className="overflow-hidden rounded-block border border-line bg-paper-result lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 pt-2.5 pr-3">
          <span className="flex items-center gap-2 font-mono text-label text-ink-2" title="The real Reactive CSS runtime, in a sandboxed frame.">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-rx" /><span className="text-ink">Live preview</span><span>real runtime</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={reset} className={btn}>Reset</button>
            <a href="#source" className={btn}>View source</a>
            {playgroundHref && <a href={playgroundHref} className={btn}>Open in Playground ↗</a>}
            <button type="button" aria-pressed={inspect} aria-controls={`${uid}-inspect`} onClick={() => setInspect((v) => !v)} className={`${btn} border-ink font-mono text-[12.5px]`}>Inspect</button>
          </div>
        </div>
        {/* The stage, as in the design: the example centered in a tall area, the hint under it. */}
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-6 px-4 pt-7 pb-8 sm:min-h-[440px] sm:px-[clamp(20px,4vw,56px)] sm:pt-[clamp(32px,4vw,56px)] sm:pb-[clamp(40px,5vw,64px)]">
          <div className="w-full"><PreviewFrame sources={{ css, base: example.files.base, html: example.files.html }} analysis={analysis} title={`${example.title}: live preview`} onMessage={session.handle} resetKey={resetKey} autoHeight minHeight={120} maxHeight={720} className="bg-transparent!" /></div>
          {hint && <p className="m-0 max-w-[60ch] text-center font-mono text-[11.5px] leading-normal text-mute">{hint}</p>}
        </div>
        <div id={`${uid}-inspect`} hidden={!inspect} className="grid gap-6 border-t border-line bg-paper-band px-4 py-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="min-w-0"><div className="pb-1.5 font-mono text-tag text-mute">state</div><StateTable rows={[...session.values.values()]} /></div>
          <div className="min-w-0"><div className="pb-1.5 font-mono text-tag text-mute">events</div><EventLog entries={session.log} /></div>
        </div>
        {session.diagnostics.length > 0 && (
          <p role="status" className="m-0 flex gap-2.5 border-t border-ink px-4 py-2.5 text-sm text-ink"><span aria-hidden="true" className="font-mono text-label">!</span>ReactiveCSS.diagnostics · {session.diagnostics.at(-1)}</p>
        )}
      </section>

      {children && <div className="min-w-0 lg:col-start-2 lg:row-start-2 lg:pt-1">{children}</div>}

      {/* Source text is left out of search: the reference pages, not example code, should answer a query. */}
      <section id="source" aria-labelledby="implementation" className="min-w-0 scroll-mt-[120px] lg:col-start-1 lg:row-start-2" data-pagefind-ignore>
        <div className="mb-2.5 flex items-baseline gap-3">
          <h2 id="implementation" className="m-0 text-[20px] font-semibold tracking-[-0.015em]">Implementation</h2>
          <span className="font-mono text-[11.5px] text-mute">2 files · {shown.length} lines</span>
        </div>
        <TabList
          label="Files"
          idBase={uid}
          items={[{ id: 'css', label: <>style.css<span aria-hidden="true" className="font-normal text-[11px] text-mute">Reactive CSS</span></> }, { id: 'html', label: <>index.html<span aria-hidden="true" className="font-normal text-[11px] text-mute">HTML</span></> }]}
          selected={tab}
          onSelect={(t) => { setTab(t as 'css' | 'html'); setAll(false); }}
          className="mb-3 flex border-b border-line"
          tabClassName={(on) => `mr-3.5 flex h-10 items-baseline gap-2 border-0 border-b-2 bg-transparent pt-3 pr-3.5 pl-0.5 font-mono text-[13px] ${on ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink-2'}`}
        />
        <div ref={panel} role="tabpanel" id={`${uid}-panel-${tab}`} aria-labelledby={`${uid}-tab-${tab}`} className={`relative ${long && !all ? 'max-h-[440px] overflow-hidden' : ''}`}>
          {tab === 'css'
            ? <CodePanel lines={lines} code={css} label="style.css" chips={session.chips} flash={session.flash} fontSize={13.5} />
            : <CodePanel lines={htmlLines} code={example.files.html} label="index.html" explain={false} fontSize={13.5} />}
          {long && !all && (
            <div className="absolute inset-x-px bottom-px flex h-[110px] items-end justify-center bg-[linear-gradient(oklch(0.968_0.005_85/0),oklch(0.968_0.005_85)_70%)] pb-3.5">
              <button type="button" onClick={showAll} className="h-[34px] rounded-block border border-ink bg-paper px-3.5 text-[13.5px] font-medium">Show all {shown.length} lines</button>
            </div>
          )}
        </div>
        {sourceNote && <p className="m-0 mt-2.5 font-mono text-tag text-mute">{sourceNote}</p>}
      </section>
    </div>
  );
}
