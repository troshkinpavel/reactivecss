// Unreleased: set(--x, mouse(x | y [, local])), the pointer position of the triggering event.
// Contract: docs/rfc-pointer-snapshot.md.
import { describe, it, expect, beforeEach } from 'vitest';
import { compile, diagnostics, describe as info } from '../../src/index';
// @ts-expect-error: plain ESM tooling, no type declarations
import { featureOfKey } from '../../tools/bundle.mjs';

beforeEach(() => { diagnostics.length = 0; });

const sources = (css: string) => [...compile(css).handlers.values()].flatMap((set) => [...set.values()].flat().flatMap((h) => h.actions.map((a) => (a.data as any).src)));

describe('set(--x, mouse(…))', () => {
  it('compiles in pointer triggers, in both modes, case-insensitively', () => {
    const c = compile(`.a { on: click(set(--x, mouse(x)), set(--y, MOUSE( y , local )), set(--z, mouse(x, viewport))), pointerenter(set(--x, mouse(y))),
      pointerleave(set(--x, mouse(x))), outside(click, set(--x, mouse(x, local))), outside(pointerdown, set(--y, mouse(y))) }`);
    expect(diagnostics).toEqual([]);
    expect(c.uses).toContain('expr:mouse');
    expect(sources('.a { on: click(set(--x, mouse(x)), set(--y, mouse(y, local))) }')).toEqual([
      { kind: 'mouse', axis: 'x', local: false }, { kind: 'mouse', axis: 'y', local: true }]);
  });

  it('is rejected where the event has no pointer position', () => {
    for (const [css, where] of [
      ['.a { on: key(Enter, set(--x, mouse(x))) }', 'not key(…)'],
      ['.a { on: change(set(--x, mouse(x))) }', 'not change'],
      ['.a { on: focus(set(--x, mouse(x))) }', 'not focus'],
      ['.a { on: outside(focusin, set(--x, mouse(x))) }', 'not outside(focusin, …)'],
    ]) {
      diagnostics.length = 0;
      const c = compile(css);
      expect(c.handlers.size, css).toBe(0);
      expect(diagnostics.join('\n'), css).toContain(`mouse() needs an event with a pointer position: click(…), pointerenter(…), pointerleave(…) or outside(click | pointerdown, …); ${where}`);
    }
  });

  it('rejects other mouse() forms; var() and nested mouse() stay errors', () => {
    for (const v of ['mouse(z)', 'mouse(x, page)', 'mouse()', 'mouse(x, local, 1)']) {
      diagnostics.length = 0;
      compile(`.a { on: click(set(--x, ${v})) }`);
      expect(diagnostics.join('\n'), v).toContain('expected mouse(x) or mouse(y), optionally with viewport or local');
    }
    diagnostics.length = 0;
    compile('.a { on: click(set(--x, var(--y))) }');
    expect(diagnostics.join('\n')).toContain('"var(--y)" is not supported; use a value, attr(), pick(), sibling-index(), sibling-count() or mouse()');
    diagnostics.length = 0;
    compile('.a { on: click(set(--x, pick(mouse(x), 1px))) }');
    expect(diagnostics.join('\n')).toMatch(/not a single value|not supported|same type/);
  });

  it('belongs to the events feature and is listed by describe()', () => {
    expect(featureOfKey('expr:mouse')).toBe('events');
    const d = info();
    expect(d.expressions).toContain('mouse');
    expect(d.features.find((f) => f.kind === 'expression' && f.name === 'mouse')?.status).toBe('experimental');
  });
});
