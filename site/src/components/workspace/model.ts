// Workspace model: framework-free, unit tested in tests/unit/workspace-model.test.ts.
import type { Transition } from '~/components/examples/usePreviewSession';
import type { WorkspaceDef, WorkspaceEntry } from '~/lib/content/workspaces';

export type FileLang = 'css' | 'html' | 'js';
export interface SourceFile { name: string; lang: FileLang; code: string }
export interface Section { label: string; line: number; end: number }

/** Sections from `/* ── Name ──… *\/`, `// ── Name ──…` or `<!-- Name -->` comment lines. */
export function sectionsOf(file: SourceFile): Section[] {
  const lines = file.code.split('\n');
  const re = file.lang === 'css' ? /^\/\* ── (.+?) ─/ : file.lang === 'js' ? /^\/\/ ── (.+?) ─/ : /^\s*<!-- (.+?) -->/;
  const out: Section[] = [];
  lines.forEach((l, i) => { const m = re.exec(l); if (m) out.push({ label: m[1]!.replace(/:.*/, '').trim(), line: i, end: i }); });
  out.forEach((s, k) => {
    let end = k < out.length - 1 ? out[k + 1]!.line - 1 : lines.length - 1;
    while (end > s.line && !lines[end]!.trim()) end--;
    s.end = end;
  });
  return out;
}

export const linesOfCode = (code: string) => code.split('\n').filter((l) => l.trim() && !/^\s*(\/\/|\/\*|<!--)/.test(l)).length;

/** Which entry each line of style.css belongs to (first match wins), and each entry's lines. */
export function mapEntries(css: string, entries: WorkspaceEntry[]) {
  const lines = css.split('\n');
  const lineEntry: (string | null)[] = lines.map(() => null);
  const entryLines: Record<string, number[]> = {};
  for (const e of entries) {
    entryLines[e.id] = [];
    if (!e.re) continue;
    const re = new RegExp(e.re);
    lines.forEach((l, i) => { if (!lineEntry[i] && re.test(l)) { lineEntry[i] = e.id; entryLines[e.id]!.push(i); } });
  }
  return { lineEntry, entryLines };
}

export type StepKind = 'native' | 'bind' | 'state' | 'cond' | 'result';
export interface TraceStep { k: string; t: string; entry: string | null; kind: StepKind }
export interface TraceRecord { n: number; key: string | null; steps: TraceStep[] }

const LABEL: Record<string, string> = { state: 'var()', when: 'when()', ':when': ':when()', previous: 'previous()', direction: 'direction()', ':changed': ':changed()' };

/**
 * Builds the trace for one observed transition: native event → the on:/bind: line it reached →
 * the state that changed (observed from → to) → the expressions that read it → the regions those
 * expressions change. Values are observed; the line-to-expression map is static.
 */
export function traceFor(t: Transition, ws: WorkspaceDef, map: ReturnType<typeof mapEntries>, n: number): TraceRecord | null {
  const states = t.changes.filter((c) => ws.entries.some((e) => e.own === c.name.slice(2)));
  const trigEntries = (t.event?.triggers ?? []).map((l) => map.lineEntry[l]).filter((x): x is string => !!x);
  const trig = ws.entries.find((e) => e.id === trigEntries[0]);
  if (!t.event && !states.length) return null;
  const steps: TraceStep[] = [];
  if (t.event) steps.push({ k: 'native event', t: `${t.event.type}${t.event.key ? ' ' + t.event.key : ''} · ${t.event.target}`, entry: null, kind: 'native' });
  if (trig) steps.push({ k: trig.kind === 'Binding' ? 'binding' : 'action', t: trig.expr, entry: trig.id, kind: 'bind' });
  if (!states.length) {
    steps.push({ k: 'state', t: 'no change', entry: null, kind: 'state' });
    return { n, key: null, steps };
  }
  const keys = states.map((c) => c.name.slice(2));
  steps.push(states.length === 1
    ? { k: `state · ${states[0]!.name}`, t: `${states[0]!.from ?? '?'} → ${states[0]!.to}`, entry: 'd-' + keys[0], kind: 'state' }
    : { k: 'state', t: states.map((c) => `${c.name} → ${c.to}`).join(' · '), entry: 'd-' + keys[0], kind: 'state' });
  const deps = ws.entries.filter((e) => (e.r ?? []).some((k) => keys.includes(k)) && (map.entryLines[e.id]?.length ?? 0) > 0);
  const counts: Record<string, number> = {};
  for (const d of deps) { const l = LABEL[d.fn] ?? d.fn; counts[l] = (counts[l] ?? 0) + 1; }
  const summary = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l, c]) => (c > 1 ? `${l} ×${c}` : l)).join(' · ');
  steps.push({ k: 'condition', t: summary || 'nothing reads it', entry: deps[0]?.id ?? null, kind: 'cond' });
  const regions = [...new Set(keys.flatMap((k) => ws.entries.find((e) => e.own === k)?.aff ?? []))].map((r) => ws.regions[r]?.label ?? r);
  steps.push({ k: 'result', t: regions.slice(0, 3).join(', ') + (regions.length > 3 ? ' …' : ''), entry: null, kind: 'result' });
  return { n, key: keys[0] ?? null, steps };
}

/** A native form event: submit, reset or invalid. */
export function nativeTrace(type: 'submit' | 'reset' | 'invalid', detail: string, n: number): TraceRecord {
  const entry = type === 'submit' ? 'n-submit' : type === 'reset' ? 'n-reset' : 'n-invalid';
  const result = type === 'submit' ? 'submission preview · nothing sent' : type === 'reset' ? 'HTML defaults restored' : 'submit stopped by the browser';
  return { n, key: null, steps: [
    { k: 'native event', t: type === 'invalid' ? `invalid · ${detail}` : `${type} · form`, entry: null, kind: 'native' },
    { k: 'native form', t: type === 'submit' ? detail : type === 'reset' ? '<button type="reset">' : 'required maxlength="40"', entry, kind: 'native' },
    { k: 'result', t: result, entry: type === 'submit' ? 'p-inspect' : null, kind: 'result' },
  ] };
}
