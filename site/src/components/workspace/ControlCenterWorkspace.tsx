import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PreviewFrame } from '~/components/examples/PreviewFrame';
import { usePreviewSession, type Transition } from '~/components/examples/usePreviewSession';
import { SegmentedControl } from '~/components/ui/SegmentedControl';
import { Switch } from '~/components/ui/Switch';
import { TabList } from '~/components/ui/TabList';
import { MiniButton } from '~/components/ui/MiniButton';
import { analyze } from '~/lib/examples/analyze';
import type { WorkspaceDef } from '~/lib/content/workspaces';
import type { ExampleDefinition } from '~/examples/manifest';
import { linesOfCode, mapEntries, nativeTrace, sectionsOf, traceFor, type TraceRecord } from './model';
import { ExpressionInspector, GuidedBar, PanelHead, StatePanel, SubmissionPreview, TraceChain } from './Panels';
import { SourceViewer, type SourceViewerHandle, type ViewerFile } from './SourceViewer';

export interface ControlCenterWorkspaceProps {
  ws: WorkspaceDef;
  example: ExampleDefinition;
  /** Highlighted files, built at build time: reactive and vanilla versions. */
  files: { rcss: ViewerFile[]; js: ViewerFile[] };
  /** API reference href per expression function name (state, set, :when …). */
  apiHrefs: Record<string, string>;
}

type Tier = 'L' | 'M' | 'S';
const useTier = (): Tier => {
  const [t, setT] = useState<Tier>('L');
  useEffect(() => {
    const l = matchMedia('(min-width: 1180px)'), m = matchMedia('(min-width: 760px)');
    const set = () => setT(l.matches ? 'L' : m.matches ? 'M' : 'S');
    set();
    l.addEventListener('change', set); m.addEventListener('change', set);
    return () => { l.removeEventListener('change', set); m.removeEventListener('change', set); };
  }, []);
  return t;
};

/**
 * The advanced example workspace. The preview runs the real example; every value, previous
 * value and transition shown is observed in it. Which source line belongs to which expression,
 * and which preview region an expression changes, is static documentation from the workspace data.
 */
export function ControlCenterWorkspace({ ws, example, files, apiHrefs }: ControlCenterWorkspaceProps) {
  const tier = useTier();
  const css = example.files.css;
  const analysis = useMemo(() => analyze(css), [css]);
  const map = useMemo(() => mapEntries(css, ws.entries), [css, ws]);
  const cssSections = useMemo(() => sectionsOf({ name: 'style.css', lang: 'css', code: css }), [css]);
  const sectionOf = (line: number) => [...cssSections].reverse().find((s) => s.line <= line)?.label;
  const ordered = useMemo(() => ws.entries.filter((e) => map.entryLines[e.id]?.length).sort((a, b) => map.entryLines[a.id]![0]! - map.entryLines[b.id]![0]!), [ws, map]);
  const sectionCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of ordered) { const s = sectionOf(map.entryLines[e.id]![0]!); if (s) c[s] = (c[s] ?? 0) + 1; }
    return c;
  }, [ordered]);

  const [mode, setMode] = useState<'explore' | 'guided'>('explore');
  const [src, setSrc] = useState<'rcss' | 'js'>('rcss');
  const [file, setFile] = useState(0);
  const [follow, setFollow] = useState(false);
  const [followHeld, setFollowHeld] = useState<{ id: string; label: string } | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [hoverRegion, setHoverRegion] = useState<string | null>(null);
  const [traces, setTraces] = useState<TraceRecord[]>([]);
  const [traceSel, setTraceSel] = useState(0);
  const [stateFlash, setStateFlash] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [resetKey, setResetKey] = useState(0);
  const [pane, setPane] = useState('preview');
  const [dockTab, setDockTab] = useState('expr');
  const viewer = useRef<SourceViewerHandle>(null);
  const counter = useRef(0);
  const lastManual = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const reveal = useCallback((id: string, onlyIfHidden = true) => {
    const line = map.entryLines[id]?.[0];
    if (line === undefined) return;
    setSrc('rcss'); setFile(0);
    setTimeout(() => viewer.current?.scrollToLine(line, onlyIfHidden), 30);
  }, [map]);

  const markDone = (pred: (s: (typeof ws.guide)[number]) => boolean) =>
    setDone((d) => (mode === 'guided' && pred(ws.guide[step]!) ? { ...d, [step]: true } : d));

  const addTrace = (t: TraceRecord) => { setTraces((x) => [t, ...x].slice(0, 12)); setTraceSel(0); };

  const onTransition = (t: Transition) => {
    const rec = traceFor(t, ws, map, ++counter.current);
    if (!rec) return;
    addTrace(rec);
    const keys = t.changes.map((c) => c.name.slice(2));
    setStateFlash(keys);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setStateFlash([]), 700);
    markDone((g) => g.keys.some((k) => keys.includes(k)));
    const trig = rec.steps.find((s) => s.kind === 'bind')?.entry;
    if (follow && trig) {
      if (Date.now() - lastManual.current < 2000) setFollowHeld({ id: trig, label: ws.entries.find((e) => e.id === trig)?.expr ?? '' });
      else reveal(trig);
    }
  };
  const session = usePreviewSession(analysis, {
    onTransition,
    onNative: ({ type, detail }) => {
      addTrace(nativeTrace(type, detail, ++counter.current));
      markDone((g) => g.trig === (type === 'submit' ? 'n-submit' : type === 'reset' ? 'n-reset' : 'n-invalid'));
    },
  });

  const select = (id: string) => {
    setSel((s) => (s === id ? null : id));
    setHover(null);
    markDone((g) => g.keys.includes('inspect'));
    if (tier === 'S') setPane('inspect');
    if (tier === 'M') setDockTab('expr');
    reveal(id);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSel(null); setHover(null); } };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);

  const restart = () => {
    setResetKey((k) => k + 1); session.reset(); setTraces([]); setSel(null); setHover(null); setDone({}); setStep(0); setFollowHeld(null);
  };

  const shownId = hover ?? sel;
  const entry = ws.entries.find((e) => e.id === shownId) ?? null;
  const derivedAt = (lines: number[]) => analysis.derived.find((d) => lines.includes(d.line));
  const observed = entry ? (entry.own ? session.current.get('--' + entry.own) : (() => { const d = derivedAt(map.entryLines[entry.id] ?? []); return d && session.current.get(d.name); })()) : undefined;
  const regionSel = (ids: string[]) => ids.map((r) => ws.regions[r]?.selector).filter((s): s is string => !!s);
  const highlight = hoverRegion ? regionSel([hoverRegion]) : entry ? regionSel(entry.aff) : mode === 'guided' && !done[step] ? regionSel(ws.guide[step]!.regions) : [];
  const cur = ordered.findIndex((e) => e.id === shownId);
  const move = (d: number) => { const n = ordered[(cur + d + ordered.length) % ordered.length]; if (n) select(n.id); };

  const viewerFiles = files[src];
  const onMainCss = src === 'rcss' && file === 0;
  const trace = traces[traceSel] ?? null;
  const loc = (list: ViewerFile[]) => list.reduce((n, f) => n + linesOfCode(f.code), 0);

  const previewPane = (
    <div className="flex min-w-0 flex-col" data-ws="preview">
      <PanelHead><span>preview · runtime</span><span className="flex-1" /><span className="text-ink-2">{example.label ?? 'local state · nothing saved'}</span></PanelHead>
      {/* The frame grows to its content, so the preview never scrolls on its own. */}
      <div className="bg-paper-2">
        <PreviewFrame sources={{ css, base: example.files.base, html: example.files.html }} analysis={analysis} title={`${ws.title} preview`} onMessage={session.handle} highlight={highlight} resetKey={resetKey} autoHeight minHeight={260} />
      </div>
      {session.submission && <div className="flex-none border-t border-line bg-paper-2"><SubmissionPreview submission={session.submission} onClose={() => session.setSubmission(null)} /></div>}
    </div>
  );
  const tracePane = (
    <div className="min-h-[160px] overflow-auto border-t border-line px-3.5 py-3" data-ws="trace">
      <TraceChain trace={trace} history={traces} selectedIndex={traceSel} onPick={select} onPickHistory={setTraceSel} />
    </div>
  );
  const codePane = (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col" data-ws="code">
      <SourceViewer
        banner={src === 'js' && (
          <div className="flex flex-none flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-paper px-3.5 py-2 text-sm">
            <span className="font-semibold">Vanilla JavaScript · browsing only</span>
            <span className="text-ink-2">The preview keeps running the Reactive CSS version.</span>
            <button type="button" onClick={() => setSrc('rcss')} className="border-0 bg-transparent p-0 text-sm underline decoration-underline underline-offset-3">Back to Reactive CSS</button>
          </div>
        )}
        ref={viewer}
        files={viewerFiles}
        file={Math.min(file, viewerFiles.length - 1)}
        onFile={setFile}
        lineEntry={onMainCss ? map.lineEntry : []}
        sectionCounts={sectionCounts}
        chips={onMainCss ? session.chips : {}}
        flash={onMainCss ? session.flash : []}
        focus={onMainCss && entry ? map.entryLines[entry.id] ?? [] : []}
        onSelect={select}
        onHover={(id) => setHover(id)}
        onManualScroll={() => { lastManual.current = Date.now(); }}
        note={src === 'rcss' && files.rcss.length < 3 ? 'no script needed' : undefined}
        showOutline={tier === 'L'}
      />
      {followHeld && (
        <button type="button" onClick={() => { reveal(followHeld.id, false); setFollowHeld(null); }} className="absolute right-4 bottom-3.5 z-[2] flex h-8 items-center gap-2 rounded-block border border-rx-soft bg-paper px-3 text-[13px] shadow-float">
          <span className="size-1.5 rounded-full bg-rx" />Follow paused while you read<span className="max-w-[24ch] truncate font-mono text-label text-rx">{followHeld.label}</span>
        </button>
      )}
    </div>
  );
  const inspector = src === 'js' ? (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHead><span>inspector</span><span className="text-ink-2">comparing</span></PanelHead>
      <div className="flex flex-col gap-2.5 overflow-auto px-3.5 py-3">
        <div className="font-semibold">Comparing implementations</div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-[18px] gap-y-[5px] font-mono text-[12.5px]">
          <span className="text-[11px] text-mute">lines of code</span><span className="text-right text-[11px] text-mute">reactive</span><span className="text-right text-[11px] text-mute">vanilla</span>
          {['style.css', 'index.html', 'script.js'].map((n) => <Fragment key={n}><span>{n}</span><span className="text-right font-semibold text-rx">{linesOfCode(files.rcss.find((f) => f.name === n)?.code ?? '')}</span><span className="text-right">{linesOfCode(files.js.find((f) => f.name === n)?.code ?? '')}</span></Fragment>)}
          <span className="font-semibold">total</span><span className="text-right font-semibold text-rx">{loc(files.rcss)}</span><span className="text-right font-semibold">{loc(files.js)}</span>
        </div>
        <p className="m-0 text-sm leading-[1.55] text-ink-body">Counted from the files above, without blank and comment lines. The vanilla version also keeps ARIA attributes in sync where it uses buttons, which Reactive CSS cannot do; with native controls neither version needs to.</p>
      </div>
    </div>
  ) : (
    <ExpressionInspector ws={ws} entry={entry} pinned={!!sel && !hover} lines={entry ? map.entryLines[entry.id] ?? [] : []} section={entry ? sectionOf(map.entryLines[entry.id]?.[0] ?? 0) : undefined}
      values={session.current} observed={observed} onSelect={select} onClear={() => setSel(null)} onRegion={setHoverRegion} onPrev={() => move(-1)} onNext={() => move(1)} apiHref={(fn) => apiHrefs[fn] ?? '/docs/reference/'} />
  );
  const statePane = <StatePanel ws={ws} values={session.current} flashKey={stateFlash} onSelect={select} selected={sel} />;

  return (
    <section aria-label={`${ws.title} workspace`} className="overflow-hidden rounded-block border border-line bg-paper" data-workspace={ws.id}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-paper-2 px-2.5 py-2">
        <SegmentedControl label="Learning mode" size="sm" value={mode} onChange={(m) => { setMode(m); setStep(0); }} options={[{ value: 'explore', label: 'Explore' }, { value: 'guided', label: 'Guided' }]} />
        <div className="flex items-center gap-2">
          <span className="font-mono text-tag text-mute">source</span>
          <SegmentedControl label="Implementation to browse" size="sm" value={src} onChange={(v) => { setSrc(v); setFile(0); }} options={[{ value: 'rcss', label: 'Reactive CSS' }, { value: 'js', label: 'Vanilla JS' }]} />
        </div>
        <span className="flex-1" />
        <Switch checked={follow} onChange={(v) => { setFollow(v); setFollowHeld(null); }} label="Follow interactions" title="Scroll the source to the expression behind each interaction" />
        <MiniButton onClick={restart} className="h-[30px]">Restart demo</MiniButton>
      </div>
      {mode === 'guided' && <GuidedBar steps={ws.guide} step={step} done={done} onStep={setStep} onExit={() => setMode('explore')} />}

      {tier === 'S' && (
        <TabList label="Workspace panes" idBase="ws" selected={pane} onSelect={setPane} items={[{ id: 'preview', label: 'Preview' }, { id: 'code', label: 'Code' }, { id: 'inspect', label: 'Inspect' }]}
          className="grid grid-cols-3 border-b border-line" tabClassName={(on) => `h-11 border-0 border-b-2 bg-transparent text-[14.5px] ${on ? 'border-ink font-semibold' : 'border-transparent text-ink-2'}`} />
      )}

      {tier === 'L' && (
        // The left column sets the height (preview at its content height, then the trace); the
        // code scrolls inside the right column, which stretches to match.
        <div className="grid grid-cols-[minmax(380px,0.72fr)_minmax(0,1.28fr)]">
          <div className="flex min-w-0 flex-col border-r border-line">{previewPane}<div className="min-h-[262px] flex-1 overflow-hidden">{tracePane}</div></div>
          <div className="flex min-h-[740px] min-w-0 flex-col">
            <div className="relative min-h-[420px] flex-1"><div className="absolute inset-0">{codePane}</div></div>
            <div className="grid h-[262px] flex-none grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] border-t border-line"><div className="min-h-0 border-r border-line">{inspector}</div><div className="min-h-0">{statePane}</div></div>
          </div>
        </div>
      )}
      {tier === 'M' && (
        <div className="flex flex-col">
          {previewPane}
          {tracePane}
          <div className="h-[460px] border-t border-line">{codePane}</div>
          <div className="border-t border-line">
            <TabList label="Inspector panels" idBase="dock" selected={dockTab} onSelect={setDockTab} items={[{ id: 'expr', label: 'Inspector' }, { id: 'state', label: 'State' }]}
              className="flex border-b border-line" tabClassName={(on) => `h-10 border-0 border-b-2 bg-transparent px-3.5 text-sm ${on ? 'border-ink font-semibold' : 'border-transparent text-ink-2'}`} />
            <div className="h-[300px]">{dockTab === 'expr' ? inspector : statePane}</div>
          </div>
        </div>
      )}
      {tier === 'S' && (
        <div>
          <div className={pane === 'preview' ? '' : 'hidden'}>{previewPane}{tracePane}</div>
          {pane === 'code' && <div className="h-[560px]">{codePane}</div>}
          {pane === 'inspect' && <div className="flex flex-col"><div className="min-h-[300px]">{inspector}</div><div className="border-t border-line">{statePane}</div></div>}
        </div>
      )}
    </section>
  );
}

