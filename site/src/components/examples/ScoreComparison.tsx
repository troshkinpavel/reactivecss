import { useMemo, useState } from 'react';
import { CodePanel } from '~/components/code/CodePanel';
import { StateFoot } from '~/components/examples/Inspector';
import { PreviewFrame } from '~/components/examples/PreviewFrame';
import { usePreviewSession } from '~/components/examples/usePreviewSession';
import { highlightCss } from '~/lib/code/css';
import type { Line } from '~/lib/code/types';
import { analyze } from '~/lib/examples/analyze';
import { BUNDLES, bytes } from '~/lib/content/engineering';
import { LIBRARY_VERSION } from '~/lib/content/glossary';
import type { ExampleDefinition } from '~/examples/manifest';

type Source = { code: string; lines: Line[] };
export interface ScoreComparisonProps {
  /** The library's score-history demo: its stylesheet runs with the Reactive CSS runtime. */
  demo: ExampleDefinition;
  /** The plain JavaScript version (JS highlighted at build time) and its stylesheet. It runs without Reactive CSS. */
  js: Source;
  jsCss: string;
  /** The shared markup, highlighted at build time. */
  html: Line[];
}

type Group = 'none' | 'state' | 'events' | 'output';
const GROUPS: [Group, string][] = [['none', 'None'], ['state', 'State'], ['events', 'Events'], ['output', 'Output']];
type Impl = 'rcss' | 'js';

/** Which lines belong to each concern, found by pattern so they follow the real files. */
const MATCH: Record<Exclude<Group, 'none'>, { css: RegExp; js: RegExp; jsCss: RegExp }> = {
  state: { css: /state\(|previous\(|direction\(|@property|--delta:/, js: /let points|const prev|points = value|const up/, jsCss: /(?!)/ },
  events: { css: /\bon:/, js: /addEventListener/, jsCss: /(?!)/ },
  output: { css: /\btext:|\battr:|animation|display:/, js: /textContent|hidden|disabled|dataset|classList/, jsCss: /animation|data-direction|:disabled/ },
};
const linesOf = (code: string, re: RegExp) => code.split('\n').flatMap((l, n) => (re.test(l) && !/^\s*(\/\/|\/\*)/.test(l) ? [n] : []));
const countLines = (code: string) => code.trimEnd().split('\n').length;
const head = 'flex justify-between gap-3 font-mono text-label';
const off = (inactive: boolean) => (inactive ? { inert: true, 'aria-hidden': true, className: 'invisible h-0 overflow-hidden' } : {});
const tag = 'font-mono text-[0.92em]';

/**
 * The same scoreboard, implemented twice and run twice: the library's Reactive CSS demo with the
 * production runtime, and a plain JavaScript version on the same markup with no Reactive CSS
 * loaded. One preview slot switches between the two independent frames; both keep their state.
 */
export function ScoreComparison({ demo, js, jsCss, html }: ScoreComparisonProps) {
  const css = demo.files.css;
  const analysis = useMemo(() => analyze(css), [css]);
  const jsAnalysis = useMemo(() => analyze(jsCss), [jsCss]);
  const lines = useMemo(() => highlightCss(css), [css]);
  const jsCssLines = useMemo(() => highlightCss(jsCss), [jsCss]);
  const baseLines = useMemo(() => highlightCss(demo.files.base), [demo.files.base]);
  const session = usePreviewSession(analysis);
  const [hl, setHl] = useState<Group>('none');
  const [impl, setImpl] = useState<Impl>('rcss');
  const f = (code: string, k: 'css' | 'js' | 'jsCss') => (hl === 'none' ? [] : linesOf(code, MATCH[hl][k]));
  const rows = [...session.current.values()];
  const jsTotal = countLines(js.code) + countLines(jsCss);

  return (
    <div data-score-comparison="">
      <div className="mb-3.5 flex flex-wrap items-center gap-x-3.5 gap-y-2">
        <span id="score-hl" className="font-mono text-label text-mute">Highlight</span>
        <div role="radiogroup" aria-labelledby="score-hl" className="flex overflow-hidden rounded-block border border-line">
          {GROUPS.map(([k, l], i) => (
            <button key={k} type="button" role="radio" aria-checked={hl === k} onClick={() => setHl(k)}
              className={`h-[34px] border-0 px-3 font-mono text-label whitespace-nowrap ${i ? 'border-l border-line' : ''} ${hl === k ? 'bg-ink text-on-ink' : 'bg-transparent text-ink'}`}>{l}</button>
          ))}
        </div>
        <span className="text-sm text-pretty text-ink-2">Score history, implemented twice. Line counts include comments and setup.</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2">
          <div className={`${head} text-ink-2`}><span>Vanilla JavaScript · runs without Reactive CSS</span><span>{countLines(js.code)} + {countLines(jsCss)} = {jsTotal} lines</span></div>
          <div><CodePanel lines={js.lines} code={js.code} label="score-history.js" explain={false} focus={f(js.code, 'js')} fontSize={13} /></div>
          <div className="flex-1"><CodePanel lines={jsCssLines} code={jsCss} label="score-history.css" explain={false} focus={f(jsCss, 'jsCss')} fontSize={13} /></div>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <div className={head}><span className="text-rx-strong">Reactive CSS · runtime {LIBRARY_VERSION}</span><span className="text-ink-2">{countLines(css)} lines</span></div>
          <CodePanel lines={lines} code={css} label="style.css" chips={session.chips} flash={session.flash} focus={f(css, 'css')} fontSize={13} className="flex-1" />
        </div>
      </div>

      <details className="mt-3 rounded-block border border-line bg-paper">
        <summary className="cursor-pointer px-3.5 py-2.5 text-sm text-ink-2">Shared by both: <span className={tag}>index.html</span> and the {countLines(demo.files.base)} layout lines at the top of <span className={tag}>style.css</span> (not counted above)</summary>
        <div className="grid gap-3 border-t border-line p-3 lg:grid-cols-2">
          <CodePanel lines={html} code={demo.files.html} label="index.html" explain={false} fontSize={12.5} />
          <CodePanel lines={baseLines} code={demo.files.base} label="style.css · layout" explain={false} legend={false} fontSize={12.5} />
        </div>
      </details>

      <div className="mt-4 grid gap-px overflow-hidden rounded-block border border-line bg-line lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2 bg-paper px-4 py-4">
          <span className="font-mono text-tag text-mute">What the JavaScript does</span>
          <p className="m-0 text-[14.5px] leading-[1.55] text-pretty text-ink-body">Keeps the score in a variable per board, attaches three listeners, and on each change writes text, <code className={tag}>hidden</code>, <code className={tag}>disabled</code> and <code className={tag}>data-direction</code>, and restarts the animation by swapping a class.</p>
        </div>
        <div className="flex min-w-0 flex-col bg-paper-result" data-impl={impl}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-1.5">
            <span className="flex items-center gap-2 font-mono text-label"><span aria-hidden="true" className="size-1.5 rounded-full bg-rx" /><span className="text-ink">Result</span></span>
            <div role="radiogroup" aria-label="Implementation to run" className="flex overflow-hidden rounded-block border border-line">
              {([['rcss', 'Reactive CSS'], ['js', 'Vanilla JS']] as const).map(([k, l], i) => (
                <button key={k} type="button" role="radio" aria-checked={impl === k} onClick={() => setImpl(k)}
                  className={`h-[30px] border-0 px-3 font-mono text-label whitespace-nowrap ${i ? 'border-l border-line' : ''} ${impl === k ? 'bg-ink text-on-ink' : 'bg-transparent text-ink'}`}>{l}</button>
              ))}
            </div>
            <span className="ml-auto px-1 font-mono text-tag text-ink-2">{impl === 'rcss' ? `style.css · Reactive CSS runtime ${LIBRARY_VERSION}` : 'score-history.js · no Reactive CSS loaded'}</span>
          </div>
          {/* Two independent documents. The inactive one is collapsed and inert, not unloaded: it keeps
              its state and its layout, so its height is right when it is shown again. */}
          <div {...off(impl !== 'rcss')} data-run="rcss">
            <PreviewFrame sources={{ css, base: demo.files.base, html: demo.files.html }} analysis={analysis} title="Score history, Reactive CSS version" onMessage={session.handle} autoHeight minHeight={300} />
            <div className="pt-3.5"><StateFoot rows={rows} lastEvent={session.lastEvent} height={Math.max(72, 18 + (rows.length + 1) * 18 + rows.length * 3 + 1)} boxed /></div>
          </div>
          <div {...off(impl !== 'js')} data-run="js">
            <PreviewFrame sources={{ css: jsCss, base: demo.files.base, html: demo.files.html, script: js.code }} analysis={jsAnalysis} title="Score history, vanilla JavaScript version" autoHeight minHeight={300} />
          </div>
        </div>
        <div className="flex flex-col gap-2 bg-paper px-4 py-4">
          <span className="font-mono text-tag text-rx-strong">What the Reactive CSS does</span>
          <p className="m-0 text-[14.5px] leading-[1.55] text-pretty text-ink-body">Declares <code className={tag}>--points</code> on each <code className={tag}>.score</code>. The runtime attaches the listeners and keeps the previous value; <code className={tag}>text:</code> and <code className={tag}>attr:</code> write real DOM text and attributes, and <code className={tag}>:changed()</code> restarts the native keyframes.</p>
        </div>
      </div>

      <ul className="m-0 mt-5 grid list-none gap-x-8 gap-y-3 p-0 md:grid-cols-3">
        {[
          'Neither version is much shorter. The difference is where the behavior lives: with Reactive CSS, state, events and presentation are declared together in the stylesheet, without application-specific JavaScript.',
          'Both write real DOM text and attributes, so copy, find-in-page and assistive technology see the same thing. The tests on this site click both and compare every board after each step.',
          `Each needs a script: the JavaScript version its own, the CSS version the Reactive CSS runtime (${bytes(BUNDLES[0]!.now[1]!)} bytes gzip in ${LIBRARY_VERSION}). Without its script, neither does anything.`,
        ].map((t) => <li key={t} className="flex gap-2.5 text-[14px] leading-[1.55] text-ink-body"><span aria-hidden="true" className="font-mono text-mute">–</span><span className="text-pretty">{t}</span></li>)}
      </ul>
    </div>
  );
}
