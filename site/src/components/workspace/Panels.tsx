import type { ReactNode } from 'react';
import type { ObservedValue, Submission } from '~/components/examples/usePreviewSession';
import { Button } from '~/components/ui/Button';
import type { GuideStep, WorkspaceDef, WorkspaceEntry } from '~/lib/content/workspaces';
import type { TraceRecord, TraceStep } from './model';

export const PanelHead = ({ children }: { children: ReactNode }) => (
  <div className="flex h-[39px] flex-none items-center gap-2.5 border-b border-line px-3.5 font-mono text-tag text-mute">{children}</div>
);

const stepClass = (s: TraceStep) =>
  s.kind === 'bind' || s.kind === 'state' ? 'border-rx-soft text-rx font-semibold' : s.kind === 'native' && s.k === 'native form' ? 'border-dashed border-ink text-ink' : s.kind === 'native' ? 'border-ink text-ink' : 'border-line text-ink';

/** The latest transition as a chain: native event → binding/action → state → conditions → result. */
export function TraceChain({ trace, history, onPick, onPickHistory, selectedIndex }: { trace: TraceRecord | null; history: TraceRecord[]; onPick: (entry: string) => void; onPickHistory: (i: number) => void; selectedIndex: number }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2.5">
        <span className="font-mono text-tag whitespace-nowrap text-mute">trace{trace && <span className="text-ink-2">{`  #${trace.n} · ${selectedIndex ? 'earlier' : 'latest'}`}</span>}</span>
        <span aria-hidden="true" className="ml-auto flex gap-2.5 overflow-hidden font-mono text-micro whitespace-nowrap text-mute">
          <span className="flex items-center gap-1"><span className="size-[9px] rounded-tag border border-rx-soft" />reactive</span>
          <span className="flex items-center gap-1"><span className="size-[9px] rounded-tag border border-ink" />native</span>
          <span className="flex items-center gap-1"><span className="size-[9px] rounded-tag border border-dashed border-ink" />form</span>
        </span>
      </div>
      {!trace && <p className="m-0 text-sm leading-normal text-ink-2">Interact with the preview to see how state flows through CSS. Every value here is observed in the running preview.</p>}
      {trace && (
        <ol aria-live="polite" aria-label="Latest state transition" className="m-0 flex list-none flex-wrap items-center gap-x-1 gap-y-1.5 p-0">
          {trace.steps.map((s, i) => (
            <li key={i} className="flex max-w-full min-w-0 items-center gap-1">
              <button type="button" onClick={() => s.entry && onPick(s.entry)} disabled={!s.entry} title={s.entry ? 'Open in the inspector' : undefined} className={`flex max-w-full min-w-0 flex-col gap-0.5 rounded-block border bg-paper px-[9px] py-1.5 text-left font-mono text-[12.5px] disabled:cursor-default ${stepClass(s)}`}>
                <span className="text-[10px] font-normal text-mute">{s.k}</span>
                <span className="max-w-full truncate">{s.t}</span>
              </button>
              {i < trace.steps.length - 1 && <span aria-hidden="true" className="font-mono text-label text-mute">→</span>}
            </li>
          ))}
        </ol>
      )}
      {history.length > 1 && (
        <details className="group/h">
          <summary className="w-fit cursor-pointer list-none rounded-tag border border-line bg-paper px-2 py-0.5 font-mono text-[11px] [&::-webkit-details-marker]:hidden">history ({history.length})</summary>
          <ol className="m-0 mt-2 flex list-none flex-col gap-px border-t border-line p-0 pt-1.5">
            {history.map((h, i) => (
              <li key={h.n}><button type="button" onClick={() => onPickHistory(i)} className={`flex w-full gap-2 rounded-tag border-0 px-1.5 py-1 text-left font-mono text-label ${i === selectedIndex ? 'bg-active' : 'bg-transparent hover:bg-paper-2'}`}><span className="w-7 flex-none text-mute">#{h.n}</span><span className="truncate">{h.steps.map((s) => s.t).join(' → ')}</span></button></li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

const chipCls = 'rounded-tag border px-1.5 py-px font-mono text-label whitespace-nowrap';

export interface InspectorProps {
  ws: WorkspaceDef;
  entry: WorkspaceEntry | null;
  pinned: boolean;
  /** Line numbers of the entry in style.css, for "where". */
  lines: number[];
  section?: string;
  /** Observed values by state key (`theme`) and by custom property (`--gap`). */
  values: Map<string, ObservedValue>;
  /** Observed value of the custom property this entry declares, if any. */
  observed?: ObservedValue;
  onSelect: (id: string) => void;
  onClear: () => void;
  onRegion: (region: string | null) => void;
  onPrev: () => void;
  onNext: () => void;
  apiHref: (fn: string) => string;
}

/** Explains the selected expression: what it reads and writes, the observed values, what it changes. */
export function ExpressionInspector(p: InspectorProps) {
  const e = p.entry;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHead>
        <span>inspector</span><span className="text-ink-2">{e ? (p.pinned ? 'pinned' : 'preview') : ''}</span>
        <span className="flex-1" />
        {e && <span className="flex gap-[3px]"><button type="button" onClick={p.onPrev} aria-label="Previous expression" className="h-[22px] w-6 rounded-tag border border-line bg-paper p-0 text-label">‹</button><button type="button" onClick={p.onNext} aria-label="Next expression" className="h-[22px] w-6 rounded-tag border border-line bg-paper p-0 text-label">›</button></span>}
      </PanelHead>
      <div className="flex min-h-0 flex-1 flex-col gap-[9px] overflow-auto px-3.5 pt-3 pb-3.5">
        {!e && (
          <>
            <p className="m-0 text-[14px] leading-[1.55] text-pretty text-ink-2">Select any <span className="rx font-mono">red</span> expression or state name in <span className="font-mono">style.css</span>, a step in the trace, or a row in the state panel. Hover previews it, a click pins it.</p>
            <p className="m-0 text-[13px] leading-normal text-mute">Keyboard: Tab reaches each expression; Enter pins it, Escape clears it.</p>
          </>
        )}
        {e && (
          <>
            <div className="flex justify-between gap-2.5 font-mono text-tag text-mute">
              <span>{e.where ?? `style.css · line ${(p.lines[0] ?? 0) + 1}${p.section ? ' · ' + p.section : ''}`}</span>
              {p.pinned && <button type="button" onClick={p.onClear} aria-label="Clear selection" className="border-0 bg-transparent p-0 text-[14px] leading-none text-ink-2">×</button>}
            </div>
            <div className={`font-mono text-[14.5px] font-semibold break-words ${e.kind.startsWith('Native') || e.kind === 'Prototype only' ? 'text-ink' : 'text-rx'}`}>{e.expr}</div>
            <p className="m-0 text-[14px] leading-[1.55] text-pretty text-ink-body">{e.what}</p>
            <div className="mt-0.5 flex flex-col gap-1.5">
              <Row k="kind"><span className="text-[13px]">{e.kind}</span></Row>
              {e.trig && <Row k="trigger"><span className={`${chipCls} border-ink text-ink`}>{e.trig}</span></Row>}
              {(e.own || e.w) && <Row k={e.own ? 'declares' : 'writes'}><StateChip name={(e.own ?? e.w)!} values={p.values} onSelect={p.onSelect} /></Row>}
              {e.r && e.r.length > 0 && <Row k="reads">{e.r.map((r) => <StateChip key={r} name={r} values={p.values} onSelect={p.onSelect} />)}</Row>}
              {p.observed
                ? <Row k="value now"><span className="font-mono text-label font-semibold text-rx">{p.observed.value}</span><span className="text-[11px] text-mute">observed</span></Row>
                : !e.kind.startsWith('Native') && e.kind !== 'Prototype only' && e.kind !== 'Declaration' && e.kind !== 'Action' && e.kind !== 'Binding' && <Row k="result"><span className="text-[12.5px] text-mute">not observable from outside the runtime · static annotation</span></Row>}
              {e.facts?.map(([k, v]) => <Row key={k} k={k}><span className="font-mono text-label">{v}</span></Row>)}
              {e.aff.length > 0 && <Row k="changes">{e.aff.filter((a) => p.ws.regions[a]?.selector).map((a) => (
                <button key={a} type="button" onMouseEnter={() => p.onRegion(a)} onMouseLeave={() => p.onRegion(null)} onFocus={() => p.onRegion(a)} onBlur={() => p.onRegion(null)} title="Outline in the preview" className={`${chipCls} border-line bg-paper text-ink hover:border-ink`}>{p.ws.regions[a]!.label}</button>
              ))}</Row>}
            </div>
            <a href={e.href ?? p.apiHref(e.fn)} className="mt-0.5 self-start text-[13px]">Reference: <span className="font-mono text-rx">{e.ref ?? (e.fn.startsWith(':') ? e.fn + '()' : e.fn === 'bind' ? 'bind:' : e.fn + '()')}</span> →</a>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return <div className="grid grid-cols-[88px_minmax(0,1fr)] items-baseline gap-2.5"><span className="font-mono text-[11px] text-mute">{k}</span><span className="flex min-w-0 flex-wrap items-center gap-x-[5px] gap-y-1">{children}</span></div>;
}

function StateChip({ name, values, onSelect }: { name: string; values: Map<string, ObservedValue>; onSelect: (id: string) => void }) {
  const v = values.get('--' + name);
  return <button type="button" onClick={() => onSelect('d-' + name)} className={`${chipCls} border-rx-soft bg-paper text-rx`}>--{name}{v && <span className="text-ink-2"> = {v.value}</span>}</button>;
}

/** States grouped as in the settings, with observed value and previous value. */
export function StatePanel({ ws, values, flashKey, onSelect, selected }: { ws: WorkspaceDef; values: Map<string, ObservedValue>; flashKey: string[]; onSelect: (id: string) => void; selected: string | null }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHead><span>state</span><span className="text-ink-2">owned by .control-center</span></PanelHead>
      <div className="min-h-0 flex-1 overflow-auto pt-0.5 pb-2.5">
        <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-2 px-3.5 pt-1.5 pb-0.5 font-mono text-micro text-mute"><span>state</span><span>value</span><span>previous</span></div>
        {ws.groups.map(([label, keys]) => (
          <div key={label}>
            <div className="px-3.5 pt-[7px] pb-0.5 text-label font-semibold text-ink-2">{label}</div>
            {keys.map((k) => {
              const v = values.get('--' + k);
              const on = flashKey.includes(k), sel = selected === 'd-' + k;
              return (
                <button key={k} type="button" onClick={() => onSelect('d-' + k)} className={`grid w-full grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.9fr)] items-baseline gap-2 border-0 px-3.5 py-[5px] text-left font-mono text-[12.5px] transition-[background-color] duration-500 ${on ? 'bg-trace duration-75' : sel ? 'bg-active' : 'bg-transparent hover:bg-paper-2'}`}>
                  <span className="truncate">--{k}</span>
                  <span className="truncate font-semibold text-rx">{v?.value ?? '…'}</span>
                  <span className="truncate text-ink-2">{v?.previous ?? '—'}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The guided tour: five steps, each done when its state changes or its form event happens. */
export function GuidedBar({ steps, step, done, onStep, onExit }: { steps: GuideStep[]; step: number; done: Record<number, boolean>; onStep: (i: number) => void; onExit: () => void }) {
  const g = steps[step]!;
  const last = step === steps.length - 1;
  return (
    <div className="flex flex-none flex-wrap items-center gap-x-[22px] gap-y-2.5 border-b border-line bg-paper px-3.5 py-3">
      <div className="flex flex-none flex-col gap-1.5">
        <span className="font-mono text-tag text-ink-2">guide · {step + 1} of {steps.length}</span>
        <div className="flex gap-1">{steps.map((s, i) => <button key={i} type="button" onClick={() => onStep(i)} aria-label={`Step ${i + 1}: ${s.title}`} aria-current={i === step ? 'step' : undefined} className={`h-1.5 w-[18px] rounded-block border-0 p-0 ${i === step ? 'bg-ink' : done[i] ? 'bg-rx' : 'bg-line'}`} />)}</div>
      </div>
      <div className="min-w-0 flex-[1_1_320px]">
        <div className="flex items-center gap-2.5 text-note font-semibold">{g.title}{done[step] && <span className="font-mono text-tag font-medium text-rx">✓ done</span>}</div>
        <p className="m-0 mt-[3px] text-[14px] leading-normal text-pretty text-ink-2">{g.text}</p>
      </div>
      <div className="flex flex-none gap-1.5">
        <Button variant="quiet" size="sm" disabled={step === 0} onClick={() => onStep(step - 1)}>Back</Button>
        <Button variant={done[step] ? 'primary' : 'secondary'} size="sm" onClick={() => (last ? onExit() : onStep(step + 1))}>{last ? 'Finish' : 'Next'}</Button>
        <button type="button" onClick={onExit} className="h-8 border-0 bg-transparent px-2.5 text-sm text-ink-2 underline decoration-underline underline-offset-3">Skip guide</button>
      </div>
    </div>
  );
}

/** What the native form would have sent. The page has no server; nothing is saved. */
export function SubmissionPreview({ submission, onClose }: { submission: Submission; onClose: () => void }) {
  return (
    <div role="status" aria-label="Submission preview" className="m-3 rounded-block border border-ink bg-paper shadow-float">
      <div className="flex items-center justify-between gap-2.5 border-b border-line py-2 pr-2 pl-3.5">
        <span className="flex flex-wrap items-baseline gap-2.5"><span className="text-[14px] font-semibold">Submission preview</span><span className="font-mono text-[11px] text-ink-2">prototype only · {submission.method} {submission.action}</span></span>
        <button type="button" onClick={onClose} aria-label="Close submission preview" className="size-[26px] flex-none border-0 bg-transparent p-0 text-[16px] leading-none text-ink-2">×</button>
      </div>
      <div className="flex flex-col gap-2.5 px-3.5 pt-3 pb-3.5">
        <div className="flex flex-col gap-[3px]">
          <span className="font-mono text-micro text-mute">native form data</span>
          <div className="flex flex-col gap-[3px] border-t border-line pt-1.5 font-mono text-[12.5px]">
            {submission.fields.map(([k, v], i) => <div key={k + i} className="grid grid-cols-[118px_minmax(0,1fr)] gap-2.5"><span className="text-ink-2">{k}</span><span className="[overflow-wrap:anywhere]">{v}</span></div>)}
            {submission.omitted.map((k) => <div key={k} className="grid grid-cols-[118px_minmax(0,1fr)] gap-2.5 text-mute"><span>{k}</span><span>not sent · unchecked</span></div>)}
          </div>
        </div>
        {submission.omitted.length > 0 && <p className="m-0 text-[13px] leading-normal text-pretty text-ink-2">Unchecked checkboxes are left out of form data. A server would read the missing field as off.</p>}
        <p className="m-0 text-[13px] leading-normal text-pretty text-ink-body">These values were read from the real form with FormData. No data has been saved or sent.</p>
        <div className="flex flex-wrap items-center gap-[5px] font-mono text-tag text-ink-2">
          <span className="rounded-tag border border-ink px-1.5 py-0.5 text-ink">form</span><span aria-hidden="true">→</span>
          <span className="rounded-tag border border-ink px-1.5 py-0.5 text-ink">submit</span><span aria-hidden="true">→</span>
          <span className="rounded-tag border border-dashed border-[oklch(0.6_0.006_80)] px-1.5 py-0.5">server · not on this page</span>
        </div>
      </div>
    </div>
  );
}
