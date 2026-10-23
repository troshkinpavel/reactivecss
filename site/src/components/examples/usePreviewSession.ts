import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Analysis, StateType } from '~/lib/examples/analyze';
import type { PreviewMessage, Reading } from '~/lib/examples/protocol';

export interface ObservedValue {
  name: string;
  owner: number;
  ownerLabel: string;
  /** Formatted for display: booleans as true/false, strings quoted. */
  value: string;
  previous: string | null;
  /** Observed changes since the preview started. */
  changes: number;
  /** When it last changed, for picking the owner to show. */
  at: number;
}

/** One observed reaction: the native event that caused it (if any) and every value that changed. */
export interface Transition {
  event: { id: number; type: string; target: string; key: string | null; triggers: number[] } | null;
  changes: { name: string; owner: number; from: string | null; to: string }[];
}
export interface SessionOptions {
  onTransition?: (t: Transition) => void;
  /** submit, reset and invalid: native form behavior, reported separately. */
  onNative?: (e: { type: 'submit' | 'reset' | 'invalid'; detail: string }) => void;
}

export interface LogEntry { id: number; time: string; text: string; kind: 'state' | 'native' | 'none' }
export interface Submission { method: string; action: string; fields: [string, string][]; omitted: string[] }

/** Booleans compute to 1 / 0; the declared type says how to show them. */
export function formatValue(raw: string, type: StateType | undefined): string {
  if (type === 'boolean') return raw === '1' ? 'true' : raw === '0' ? 'false' : raw || 'none';
  return raw === '' ? 'none' : raw;
}

const clock = () => new Date().toTimeString().slice(0, 8);
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Turns bridge messages into what the example UI shows: current and previous values, the
 * event log, and the trace (trigger line → state line → reading lines, 120 ms apart).
 * Every value here was observed in the running preview.
 */
export function usePreviewSession(analysis: Analysis, options: SessionOptions = {}) {
  const opts = useRef(options);
  opts.current = options;
  const types = useMemo(() => {
    const m = new Map<string, StateType | undefined>();
    for (const s of analysis.states) m.set(s.name, s.type);
    for (const d of analysis.derived) m.set(d.name, d.type);
    return m;
  }, [analysis]);
  const declLine = useMemo(() => new Map([...analysis.states, ...analysis.derived].map((s) => [s.name, s.line])), [analysis]);

  const [values, setValues] = useState<Map<string, ObservedValue>>(new Map());
  const [log, setLog] = useState<LogEntry[]>([]);
  const [flash, setFlash] = useState<number[]>([]);
  const [lastEvent, setLastEvent] = useState('waiting for interaction');
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [invalid, setInvalid] = useState<{ field: string; reason: string } | null>(null);
  const [ready, setReady] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pending = useRef<{ id: number; event: string; target: string; key: string | null; triggers: number[]; timer: ReturnType<typeof setTimeout> } | null>(null);
  const seq = useRef(0);
  useEffect(() => () => { timers.current.forEach(clearTimeout); if (pending.current) clearTimeout(pending.current.timer); }, []);

  const trace = useCallback((steps: number[][]) => {
    timers.current.forEach(clearTimeout);
    let s = steps.map((l) => [...new Set(l)]).filter((l) => l.length);
    if (!s.length) return;
    if (reducedMotion()) s = [s.flat()];
    timers.current = s.map((lines, i) => setTimeout(() => setFlash(lines), i * 120));
    timers.current.push(setTimeout(() => setFlash([]), s.length * 120 + 520));
  }, []);

  const push = useCallback((text: string, kind: LogEntry['kind']) => {
    setLastEvent(text);
    setLog((l) => [{ id: ++seq.current, time: clock(), text, kind }, ...l].slice(0, 8));
  }, []);

  const apply = useCallback((readings: Reading[], fresh: boolean) => {
    const now = performance.now();
    setValues((prev) => {
      const next = fresh ? new Map<string, ObservedValue>() : new Map(prev);
      for (const r of readings) {
        const key = r.name + '@' + r.owner;
        const old = next.get(key);
        const value = formatValue(r.value, types.get(r.name));
        next.set(key, fresh || !old
          ? { name: r.name, owner: r.owner, ownerLabel: r.ownerLabel, value, previous: null, changes: 0, at: 0 }
          : { ...old, value, previous: old.value, changes: old.changes + 1, at: now });
      }
      return next;
    });
  }, [types]);

  const handle = useCallback((m: PreviewMessage) => {
    switch (m.type) {
      case 'ready':
        setReady(true);
        apply(m.readings, true);
        setDiagnostics(m.diagnostics);
        return;
      case 'diagnostics':
        setDiagnostics((d) => [...new Set([...d, ...m.messages])]);
        return;
      case 'event': {
        if (pending.current) clearTimeout(pending.current.timer);
        const ev = { id: m.id, event: m.event, type: m.event, target: m.target, key: m.key, triggers: m.triggers };
        const what = `${m.event}${m.key ? ' ' + m.key : ''} ${m.target}`;
        if (m.event === 'reset') { push(`reset ${m.target} → native form reset`, 'native'); opts.current.onNative?.({ type: 'reset', detail: m.target }); }
        // No state change within a few frames: show the reaction that did run, or nothing.
        const timer = setTimeout(() => {
          if (pending.current?.id !== m.id) return;
          pending.current = null;
          if (m.triggers.length) { trace([m.triggers]); push(`${what} → no change`, 'none'); opts.current.onTransition?.({ event: ev, changes: [] }); }
        }, 250);
        pending.current = { ...ev, timer };
        return;
      }
      case 'values': {
        const cause = pending.current && m.cause === pending.current.id ? pending.current : null;
        if (cause) { clearTimeout(cause.timer); pending.current = null; }
        const changed = [...new Set(m.readings.map((r) => r.name))];
        apply(m.readings, false);
        opts.current.onTransition?.({
          event: cause ? { id: cause.id, type: cause.event, target: cause.target, key: cause.key, triggers: cause.triggers } : null,
          changes: m.readings.map((r) => ({ name: r.name, owner: r.owner, from: values.get(r.name + '@' + r.owner)?.value ?? null, to: formatValue(r.value, types.get(r.name)) })),
        });
        const decl = changed.map((n) => declLine.get(n)).filter((l): l is number => l !== undefined);
        const reads = changed.flatMap((n) => analysis.reads[n] ?? []);
        trace([cause?.triggers ?? [], decl, reads]);
        if (cause) {
          const first = m.readings.find((r) => analysis.states.some((s) => s.name === r.name)) ?? m.readings[0]!;
          const v = formatValue(first.value, types.get(first.name));
          const was = values.get(first.name + '@' + first.owner)?.value;
          push(`${cause.event}${cause.key ? ' ' + cause.key : ''} ${cause.target} → ${first.name} ${was !== undefined ? was + ' → ' : ''}${v}`, 'state');
        }
        return;
      }
      case 'submit':
        setSubmission({ method: m.method, action: m.action, fields: m.fields, omitted: m.omitted });
        setInvalid(null);
        push(`submit form → ${m.method} ${m.action || '(no action)'} · not sent`, 'native');
        opts.current.onNative?.({ type: 'submit', detail: `${m.method} ${m.action}` });
        return;
      case 'invalid':
        setInvalid({ field: m.field, reason: m.reason });
        push(`invalid ${m.field} → ${m.reason} · submit stopped by the browser`, 'native');
        opts.current.onNative?.({ type: 'invalid', detail: `${m.field} · ${m.reason}` });
        return;
      case 'size':
        return;
    }
  }, [apply, analysis, declLine, push, trace, types, values]);

  const reset = useCallback(() => {
    timers.current.forEach(clearTimeout);
    setFlash([]); setLog([]); setValues(new Map()); setReady(false); setSubmission(null); setInvalid(null); setDiagnostics([]);
    setLastEvent('waiting for interaction');
  }, []);

  /** One row per watched property: the most recently changed owner. */
  const current = useMemo(() => {
    const byName = new Map<string, ObservedValue>();
    for (const v of values.values()) {
      const cur = byName.get(v.name);
      if (!cur || v.at > cur.at) byName.set(v.name, v);
    }
    return byName;
  }, [values]);

  const chips = useMemo(() => {
    const out: Record<number, string> = {};
    for (const [name, v] of current) {
      const line = declLine.get(name);
      if (line !== undefined) out[line] = v.value;
    }
    return out;
  }, [current, declLine]);

  return { handle, reset, ready, values, current, chips, flash, log, lastEvent, diagnostics, submission, setSubmission, invalid };
}

export type PreviewSession = ReturnType<typeof usePreviewSession>;
