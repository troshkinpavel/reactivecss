import { useId, useMemo, useState } from 'react';
import { CodePanel } from '~/components/code/CodePanel';
import { TabList } from '~/components/ui/TabList';
import { highlightCss } from '~/lib/code/css';
import type { Lang, Line } from '~/lib/code/types';
import type { Relation } from '~/lib/content/comparisons';
import { RELATION_LABEL } from '~/lib/content/comparisons';
import { analyze } from '~/lib/examples/analyze';
import type { ExampleDefinition } from '~/examples/manifest';
import { RESULT_BG, ResultHeader } from './Inspector';
import { PreviewFrame } from './PreviewFrame';
import { usePreviewSession } from './usePreviewSession';

export interface CodeComparisonProps {
  title: string;
  relation: Relation;
  status: 'stable' | 'experimental';
  nativeNote: string;
  reactiveNote: string;
  native: { label: string; lang: Lang; code: string; lines: Line[] }[];
  /** The Reactive CSS side, run for real in the result pane. */
  example: ExampleDefinition;
  simpler: string;
  differences: string[];
  links: [string, string][];
}

type Pane = 'native' | 'reactive' | 'result';

/**
 * Native CSS next to Reactive CSS, with the Reactive version running live. Below 680px of
 * container width the three panes become tabs (a container query, so it adapts to wherever
 * the comparison is placed).
 */
export function CodeComparison(p: CodeComparisonProps) {
  const uid = useId().replace(/:/g, '');
  const [pane, setPane] = useState<Pane>('reactive');
  const css = p.example.files.css;
  const analysis = useMemo(() => analyze(css), [css]);
  const lines = useMemo(() => highlightCss(css), [css]);
  const session = usePreviewSession(analysis);
  const accent = p.relation === 'only';
  const show = (k: Pane) => ({ 'data-pane': k, 'data-active': pane === k || undefined, id: `${uid}-panel-${k}`, role: 'tabpanel', 'aria-labelledby': `${uid}-tab-${k}` });

  return (
    <div className="cmp @container w-full min-w-0 overflow-hidden rounded-block border border-line bg-paper text-ink" data-comparison={p.example.id}>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-line bg-paper-2 px-3.5 py-3">
        <span className="text-base font-semibold tracking-[-0.01em]">{p.title}</span>
        <span className="flex-1" />
        <span title="How the two versions relate" className={`rounded-tag border px-[7px] py-0.5 font-mono text-tag whitespace-nowrap ${accent ? 'border-rx text-rx' : 'border-ink text-ink'}`}>{RELATION_LABEL[p.relation]}</span>
        <span className={`rounded-tag border px-[7px] py-0.5 font-mono text-tag whitespace-nowrap ${p.status === 'experimental' ? 'border-dashed border-rx text-rx' : 'border-line-strong text-ink-2'}`}>{p.status}</span>
      </div>

      <TabList
        label="Comparison panes"
        idBase={uid}
        items={[{ id: 'native', label: 'Native' }, { id: 'reactive', label: 'Reactive' }, { id: 'result', label: 'Result' }]}
        selected={pane}
        onSelect={(id) => setPane(id as Pane)}
        className="cmp-tabs grid grid-cols-3 border-b border-line"
        tabClassName={(on) => `h-11 border-0 border-b-2 bg-transparent text-[14.5px] ${on ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink-2'}`}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] @min-[680px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* One tinted code band: each pane is a single header row and its code. The pane name
            sits in the file header, so there is no extra label row and no card inside the card. */}
        <div {...show('native')} className="cmp-pane flex min-w-0 flex-col bg-paper-2">
          {p.native.map((f, i) => (
            <div key={f.label} className={`min-w-0 ${i === p.native.length - 1 ? 'flex-1' : ''} ${i ? 'border-t border-line' : ''}`}>
              <CodePanel lines={f.lines} code={f.code} label={f.label} badge={i === 0 ? p.nativeNote : undefined} explain={false} bare
                heading={i === 0 ? <><span className="text-ink">Native CSS</span><span className="text-mute"> · </span>{f.label}</> : f.label} />
            </div>
          ))}
        </div>
        <div {...show('reactive')} className="relative cmp-pane flex min-w-0 flex-col bg-paper-2 @min-[680px]:shadow-[-1px_0_0_var(--color-line)]">
          <div className="min-w-0 flex-1">
            <CodePanel lines={lines} code={css} label={`${p.example.stem}.css`} badge={p.reactiveNote} chips={session.chips} flash={session.flash} explain={false} legend={false} bare
              heading={<><span className="text-rx">Reactive CSS</span><span className="text-mute"> · </span>{p.example.stem}.css</>} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] @min-[680px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div {...show('result')} className="cmp-pane flex min-w-0 flex-col border-t border-line bg-paper-result">
          <ResultHeader label={p.example.a11y} />
          <div className="relative min-h-[240px] flex-1">
            <PreviewFrame sources={{ css, base: `${p.example.files.base}\n${RESULT_BG}`, html: p.example.files.html }} analysis={analysis} title={`${p.title}: live result`} onMessage={session.handle} className="absolute inset-0 bg-paper-result!" />
          </div>
        </div>
        <div data-pane="result" data-active={pane === 'result' || undefined} className="relative cmp-pane flex min-w-0 flex-col gap-[18px] border-t border-line px-4 py-[18px] @min-[680px]:shadow-[-1px_0_0_var(--color-line)]">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-tag text-mute">What becomes simpler</span>
            <p className="m-0 text-base leading-[1.6] text-pretty text-ink-body">{p.simpler}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-tag text-mute">Differences and compatibility</span>
            <ul className="m-0 flex list-none flex-col gap-[7px] p-0">
              {p.differences.map((d) => <li key={d} className="flex gap-2.5 text-[14px] leading-[1.55] text-ink-body"><span aria-hidden="true" className="flex-none font-mono text-mute">–</span><span className="text-pretty">{d}</span></li>)}
            </ul>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {p.links.map(([label, href]) => <a key={href} href={href}>{label} {href.startsWith('/') ? '→' : '↗'}</a>)}
          </div>
        </div>
      </div>
    </div>
  );
}
