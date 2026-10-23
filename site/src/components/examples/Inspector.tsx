import type { LogEntry, ObservedValue } from './usePreviewSession';

/** Appended to a site example's base.css: its stage takes the result panel's lighter paper. Library demos keep their own background. */
export const RESULT_BG = ':root { --preview-bg: oklch(0.995 0.002 85); }';

/** Header of the result half of a code + result card: "● Result" and an optional label on the right. */
export function ResultHeader({ label }: { label?: string }) {
  return (
    <div className="flex h-[38px] flex-none items-center justify-between gap-3 px-4 font-mono text-label text-ink-2">
      <span className="flex min-w-0 items-center gap-2" title="This preview runs the real Reactive CSS runtime in a sandboxed frame.">
        <span aria-hidden="true" className="size-1.5 flex-none rounded-full bg-rx" /><span className="text-ink">Result</span>
      </span>
      {label && <span className="truncate">{label}</span>}
    </div>
  );
}

/** Name and current value rows under a preview, plus the last event. */
export function StateFoot({ rows, lastEvent, height, boxed = false }: { rows: ObservedValue[]; lastEvent: string; height: number; boxed?: boolean }) {
  return (
    <div className={`flex flex-none flex-col justify-center gap-[3px] px-3 py-[9px] font-mono text-label leading-[18px] ${boxed ? 'mx-4 mb-3.5 rounded-block border border-dashed border-line-dashed' : 'border-t border-line'}`} style={{ height }}>
      {rows.map((r) => (
        <div key={r.name} className="flex justify-between gap-2.5">
          <span className="truncate text-ink-2">{r.name}{r.ownerLabel && /\s\d+$/.test(r.ownerLabel) ? <span className="text-mute"> · {r.ownerLabel.replace(/^.*\s/, 'item ')}</span> : null}</span>
          <span className="truncate font-semibold whitespace-nowrap text-rx">{r.value}</span>
        </div>
      ))}
      <div className="truncate text-mute" aria-live="polite">{lastEvent}</div>
    </div>
  );
}

/** The state table: one row per observed property and owner. */
export function StateTable({ rows, empty = 'Waiting for the preview to start.' }: { rows: ObservedValue[]; empty?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[300px] border-collapse font-mono text-[12.5px]">
        <thead>
          <tr className="text-left text-[11px] text-mute">
            <th className="px-3.5 py-1.5 font-normal">name</th>
            <th className="px-3.5 py-1.5 font-normal">value</th>
            <th className="px-3.5 py-1.5 font-normal">previous</th>
            <th className="px-3.5 py-1.5 text-right font-normal" title="Changes observed since the preview started">changes</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr className="border-t border-line"><td colSpan={4} className="px-3.5 py-2 font-sans text-[13px] text-mute">{empty}</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r.name + r.owner} className="border-t border-line">
              <td className="px-3.5 py-[7px]">{r.name}{/\s\d+$/.test(r.ownerLabel) && <span className="text-mute"> {r.ownerLabel.replace(/^.*\s/, '#')}</span>}</td>
              <td className="px-3.5 py-[7px] font-semibold text-rx">{r.value}</td>
              <td className="px-3.5 py-[7px] text-ink-2">{r.previous ?? '—'}</td>
              <td className="px-3.5 py-[7px] text-right text-ink-2">{r.changes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Recent events, newest first. */
export function EventLog({ entries, empty = 'Interact with the preview to record events.' }: { entries: LogEntry[]; empty?: string }) {
  return (
    <ol aria-live="polite" aria-label="Events" className="m-0 flex min-h-[54px] list-none flex-col gap-[3px] p-0 font-mono text-label">
      {entries.map((l) => (
        <li key={l.id} className="flex gap-2.5 overflow-hidden whitespace-nowrap">
          <span className="text-mute">{l.time}</span>
          <span className={`truncate ${l.kind === 'none' ? 'text-mute' : ''}`}>{l.text}</span>
        </li>
      ))}
      {entries.length === 0 && <li className="font-sans text-[13px] text-mute">{empty}</li>}
    </ol>
  );
}
