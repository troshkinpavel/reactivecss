import { describe, expect, it } from 'vitest';
import { mapEntries, nativeTrace, sectionsOf, traceFor } from '~/components/workspace/model';
import { getExample } from '~/examples/manifest';
import { WORKSPACES } from '~/lib/content/workspaces';

const ws = WORKSPACES['control-center']!;
const css = getExample('control-center').files.css;
const map = mapEntries(css, ws.entries);

describe('workspace model', () => {
  it('maps every style.css expression of the registry to a line', () => {
    const missing = ws.entries.filter((e) => e.re && !map.entryLines[e.id]!.length).map((e) => e.id);
    expect(missing).toEqual([]);
  });

  it('reads sections from the comment rulers', () => {
    expect(sectionsOf({ name: 'style.css', lang: 'css', code: css }).map((s) => s.label)).toContain('Controls → state');
  });

  it('builds a trace from an observed transition', () => {
    const line = map.entryLines['b-notify']![0]!;
    const t = traceFor({ event: { id: 1, type: 'change', target: 'input', key: null, triggers: [line] }, changes: [{ name: '--notify', owner: 0, from: 'true', to: 'false' }] }, ws, map, 1)!;
    expect(t.steps.map((s) => s.kind)).toEqual(['native', 'bind', 'state', 'cond', 'result']);
    expect(t.steps[1]).toMatchObject({ t: '--notify: set(event(checked))', entry: 'b-notify' });
    expect(t.steps[2]).toMatchObject({ k: 'state · --notify', t: 'true → false' });
  });

  it('reports a native submit without inventing state', () => {
    expect(nativeTrace('submit', 'POST /settings', 2).steps.map((s) => s.t)).toEqual(['submit · form', 'POST /settings', 'submission preview · nothing sent']);
  });
});

describe('deep dive workspace', () => {
  it('maps every expression to its stylesheet', () => {
    const w = WORKSPACES['control-center-deep']!;
    const m = mapEntries(getExample('control-center-deep').files.css, w.entries);
    expect(w.entries.filter((e) => e.re && !m.entryLines[e.id]!.length).map((e) => e.id)).toEqual([]);
  });
});
