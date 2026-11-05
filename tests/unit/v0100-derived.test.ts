// 0.10 step 8 (experiment): which declarations are computed custom properties, what the compiler
// emits for them, and the counts of declared names used to find conflicts.
import { describe, it, expect, beforeEach } from 'vitest';
import { compile, diagnostics } from '../../src/index';
import type { ReactiveRule } from '../../src/core/parser';

const derived = (css: string) => (compile(css).rules as ReactiveRule[]).flatMap((r) => (r.derived ?? []).map((d) => d.name));
const decls = (css: string) => (compile(css).rules as ReactiveRule[]).reduce((n, r) => n + r.decls.length, 0);

beforeEach(() => { diagnostics.length = 0; });

describe('which declarations are computed', () => {
  it('a value function, or live() around one, as the whole value', () => {
    expect(derived('.f { --v: state(""); --c: trim(--v); --n: length(--c); --l: live(lower(--v), 500ms); --t: live(time()); --z: timezone(--t, "UTC") }'))
      .toEqual(['--c', '--n', '--l', '--t', '--z']);
    expect(diagnostics).toEqual([]);
  });
  it('anything else stays an ordinary reactive declaration, as in step 7', () => {
    const css = '.f { --v: state(""); --a: trim(--v) 1px; --b: random(1, 9); --c: live(random(1, 9)); --d: calc(length(--v) * 1px) }';
    expect(derived(css)).toEqual([]);
    expect(decls(css)).toBeGreaterThan(0);
    expect(diagnostics).toEqual([]);
  });
  it('the declaration is removed from the stylesheet (the runtime writes it on each owner)', () => {
    const c = compile('.f { --v: state(""); --c: trim(--v); color: red }');
    expect(c.css).not.toContain('--c');
    expect(c.css).toContain('color: red');
    expect(c.uses.has('decl:derived')).toBe(true);
  });
  it('@layer and nesting in an unconditional parent are fine', () => {
    expect(derived('@layer ui { .f { --v: state(""); --c: trim(--v) } } .p { .f { --d: lower(--v) } }')).toEqual(['--c', '--d']);
    expect(diagnostics).toEqual([]);
  });
});

describe('not computed, with one diagnostic, and kept as CSS', () => {
  const cases: [string, RegExp][] = [
    ['.f:when(--on) { --c: trim(--v) }', /--c is not a computed state: it is in a conditional rule/],
    ['.f:hover { --c: trim(--v) }', /conditional rule/],
    ['.f::before { --c: trim(--v) }', /conditional rule/],
    ['@media (min-width: 1px) { .f { --c: trim(--v) } }', /conditional rule/],
    ['@supports (display: grid) { .f { --c: trim(--v) } }', /conditional rule/],
    ['.p:when(--on) { .f { --c: trim(--v) } }', /conditional rule/],
    ['.f { --c: trim(--v) !important }', /!important is not supported on it/],
    ['.f { --c: lower(attr(data-x)) }', /it reads attr\(data-x\), which can change without a state change/],
    ['.f { --c: format(element(width), "integer") }', /it reads element\(\)/],
    ['.f { --c: format(random(1, 9), "integer") }', /it reads random\(\)/],
    ['.f { --c: format(sibling-index(), "integer") }', /it reads sibling-index\(\)/],
    ['.f { --c: time() }', /it reads time\(\) outside live\(\), which gives one instant; write live\(time\(\), 1s\) for a clock/],
  ];
  for (const [css, re] of cases) it(css, () => {
    expect(derived('.f { --v: state(""); --on: state(true) } ' + css)).toEqual([]);
    expect(diagnostics.join('\n')).toMatch(re);
    expect(diagnostics).toHaveLength(1);
  });
});

describe('declared names (conflicts are decided across the processed stylesheets)', () => {
  it('every declaration of a custom property counts: plain, state(), reactive, computed, @property', () => {
    const c = compile(`@property --a { syntax: "*"; inherits: true }
      .x { --a: 1; --b: state(0); --c: trim(--b) } .y:when(--b) { --a: 2 !important; --c: "x" } @media print { .z { --b: 3 } }`);
    expect(Object.fromEntries(c.declared)).toEqual({ '--a': 3, '--b': 2, '--c': 2 });
  });
  it(':on() mutations are not declarations of the state', () => {
    const c = compile('.x { --n: state(0) } .x:on(click) { --n: increment(1) }');
    expect(c.declared.get('--n')).toBe(1);
  });
});
