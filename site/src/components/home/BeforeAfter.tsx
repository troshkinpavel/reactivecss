import { useMemo, useState } from 'react';
import { CodePanel } from '~/components/code/CodePanel';
import { PreviewFrame } from '~/components/examples/PreviewFrame';
import { usePreviewSession } from '~/components/examples/usePreviewSession';
import { highlightCss } from '~/lib/code/css';
import type { Line } from '~/lib/code/types';
import { analyze } from '~/lib/examples/analyze';
import type { ExampleDefinition } from '~/examples/manifest';

export interface BeforeAfterProps {
  /** The greeting example: its stylesheet runs in the "Same result" strip. */
  example: ExampleDefinition;
  /** The JavaScript version and its markup, highlighted at build time. */
  js: { code: string; lines: Line[] };
  html: { code: string; lines: Line[] };
}

type Part = 'none' | 'state' | 'events' | 'output';
const PARTS: [Part, string][] = [['none', 'None'], ['state', 'State'], ['events', 'Event'], ['output', 'Output']];
const NOTE: Record<Part, string> = {
  none: 'Pick a part to see where each version handles it.',
  state: 'Where the current greeting is kept.',
  events: 'What runs on click.',
  output: 'How the greeting reaches the page.',
};
/** Zero-based lines per part, for greeting.js, index.html and greeting.css as they are. */
const FOCUS: Record<Part, { js: number[]; html: number[]; css: number[] }> = {
  none: { js: [], html: [], css: [] },
  state: { js: [1, 4, 5], html: [1], css: [1, 6, 7] },
  events: { js: [3, 6], html: [2], css: [4, 5, 8, 9] },
  output: { js: [0, 5], html: [1], css: [11, 12, 13] },
};
/** The strip shows the greeting in one row. Presentation only. */
const STRIP = 'body { place-items: center start; padding: 4px 2px; } .greeting { flex-direction: row; flex-wrap: wrap; gap: 12px 20px; } .message { height: auto; min-width: 5.5ch; font-size: 24px; letter-spacing: -0.03em; } .shuffle { height: 40px; padding: 0 14px; font-size: 14px; }';

const seg = (on: boolean, i: number) => `h-[34px] border-0 px-3 font-mono text-label whitespace-nowrap ${i ? 'border-l border-line' : ''} ${on ? 'bg-ink text-on-ink' : 'bg-transparent text-ink'}`;

/**
 * Homepage "Before / after": the JavaScript and Reactive CSS versions of the greeting, with a
 * part highlighter. Below 960px the two versions are tabs. The strip under both runs the real
 * stylesheet; its chips and trace show in the CSS card.
 */
export function BeforeAfter({ example, js, html }: BeforeAfterProps) {
  const css = example.files.css;
  const analysis = useMemo(() => analyze(css), [css]);
  const lines = useMemo(() => highlightCss(css), [css]);
  const session = usePreviewSession(analysis);
  const [part, setPart] = useState<Part>('none');
  const [tab, setTab] = useState<'js' | 'css'>('css');
  const f = FOCUS[part];
  const col = (k: 'js' | 'css') => `flex min-w-0 flex-[1_1_420px] flex-col gap-2.5 ${tab === k ? '' : 'max-[959px]:hidden'}`;

  return (
    <div data-before-after="">
      <div className="mb-4 flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
        <span id="ba-hl" className="font-mono text-label text-ink-2">Highlight</span>
        <div role="radiogroup" aria-labelledby="ba-hl" className="flex overflow-hidden rounded-block border border-line bg-paper">
          {PARTS.map(([k, l], i) => <button key={k} type="button" role="radio" aria-checked={part === k} onClick={() => setPart(k)} className={seg(part === k, i)}>{l}</button>)}
        </div>
        <span className="text-sm text-ink-2" aria-live="polite">{NOTE[part]}</span>
      </div>

      <div role="tablist" aria-label="Version" className="mb-6 grid grid-cols-2 overflow-hidden rounded-block border border-line bg-paper min-[960px]:hidden">
        {([['js', 'Today — JavaScript'], ['css', 'With Reactive CSS']] as const).map(([k, l], i) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} aria-controls={`ba-${k}`} id={`ba-tab-${k}`} onClick={() => setTab(k)}
            className={`h-10 border-0 text-[14px] font-medium ${i ? 'border-l border-line' : ''} ${tab === k ? 'bg-ink text-on-ink' : 'bg-transparent text-ink'}`}>{l}</button>
        ))}
      </div>

      <div className="flex flex-wrap gap-6">
        <div id="ba-js" role="tabpanel" aria-labelledby="ba-tab-js" className={col('js')}>
          <div className="flex justify-between gap-3 text-[14px] text-ink-2"><span>Today — JavaScript</span><span className="font-mono text-label">script + markup</span></div>
          <div className="min-h-[240px]"><CodePanel lines={js.lines} code={js.code} label="greeting.js" explain={false} focus={f.js} /></div>
          <div className="min-h-[180px]"><CodePanel lines={html.lines} code={html.code} label="index.html" explain={false} focus={f.html} /></div>
        </div>
        <div id="ba-css" role="tabpanel" aria-labelledby="ba-tab-css" className={col('css')}>
          <div className="flex justify-between gap-3 text-[14px] text-ink"><span>With Reactive CSS</span><span className="font-mono text-label text-ink-2">stylesheet + markup</span></div>
          <div className="min-h-[420px] flex-1"><CodePanel lines={lines} code={css} label="greeting.css" chips={session.chips} flash={session.flash} focus={f.css} /></div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-block border border-dashed border-line-dashed px-4 py-3.5">
        <span className="font-mono text-label text-ink-2">Same result</span>
        <div className="min-w-[230px] flex-[0_1_320px]">
          <PreviewFrame sources={{ css, base: `${example.files.base}\n${STRIP}`, html: example.files.html }} analysis={analysis} title="Greeting, Reactive CSS version" onMessage={session.handle} autoHeight minHeight={44} />
        </div>
        <span className="flex-[1_1_240px] text-[14px] text-pretty text-ink-2">Both versions produce this greeting. This one runs <span className="font-mono text-[0.92em]">greeting.css</span> above, with the real runtime; its value shows in the code.</span>
      </div>
    </div>
  );
}
