import { describe, it, expect, beforeEach } from 'vitest';
import { compile, diagnostics } from '../../src/index';
import { parseTyped, serialize, parseCondition, evaluate, ConditionError, assignable, coerce, type Typed } from '../../src/state/values';
import { inferSyntax } from '../../src/state/typed';
import { parseKey } from '../../src/state/keys';

beforeEach(() => { diagnostics.length = 0; });

/** vals: "--x": "current" or "--x": ["current", "previous"]. */
const env = (vals: Record<string, string | [string, string]>) => (name: string) => {
  if (!(name in vals)) return undefined;
  const [cur, prev] = typeof vals[name] === 'string' ? [vals[name], vals[name]] as [string, string] : vals[name] as [string, string];
  return { value: parseTyped(cur), previous: parseTyped(prev) };
};
const run = (cond: string, vals: Record<string, string | [string, string]>) => evaluate(parseCondition(cond).ast, env(vals));

describe('state values', () => {
  it('types values explicitly and serializes booleans as 1 / 0', () => {
    expect(parseTyped('false')).toEqual({ type: 'boolean', v: false });
    expect(parseTyped('12')).toEqual({ type: 'number', v: 12, unit: '' });
    expect(parseTyped('-1.5REM')).toEqual({ type: 'dimension', v: -1.5, unit: 'rem' });
    expect(parseTyped('#fff')).toEqual({ type: 'value', v: '#fff' });
    expect(serialize(parseTyped('true'))).toBe('1');
    expect(serialize(parseTyped('0.1px'))).toBe('0.1px');
    expect(() => parseTyped('')).toThrow();
    expect(() => parseTyped('a, b')).toThrow();
  });

  it('assigns only compatible types, converting compatible units', () => {
    const px = parseTyped('10px');
    expect(assignable(px, parseTyped('1in'))).toBe(true);
    expect(coerce(px, parseTyped('1in'))).toEqual({ type: 'dimension', v: 96, unit: 'px' });
    expect(assignable(px, parseTyped('1em'))).toBe(false);
    expect(assignable(parseTyped('1'), parseTyped('true'))).toBe(false);
    expect(assignable(parseTyped('red'), parseTyped('blue'))).toBe(true);
    expect(assignable(parseTyped('red'), parseTyped('3'))).toBe(false);
  });
});

describe('conditions', () => {
  it('parses the documented grammar with precedence: not > and > or', () => {
    expect(parseCondition('--a or --b and not --c').names).toEqual(['--a', '--b', '--c']);
    expect(run('--a or --b and not --c', { '--a': 'false', '--b': 'true', '--c': 'true' })).toBe(false);
    expect(run('(--a or --b) and not --c', { '--a': 'true', '--b': 'false', '--c': 'false' })).toBe(true);
    expect(() => parseCondition('--a &&& --b')).toThrow(/cannot read/);
    expect(() => parseCondition('--a ==')).toThrow(/ends too early/);
    expect(() => parseCondition('(--a')).toThrow(/missing "\)"/);
  });

  it('compares numbers and convertible units, never strings', () => {
    expect(run('--v >= 80', { '--v': '80' })).toBe(true);
    expect(run('--w == 7.5pt', { '--w': '10px' })).toBe(true);
    expect(run('--r > 0.25turn', { '--r': '100deg' })).toBe(true);
    expect(run('--t < 1s', { '--t': '900ms' })).toBe(true);
    expect(run('--v != 0', { '--v': '0px' })).toBe(false); // a unitless 0 compares with any unit
    expect(run('--c == RED', { '--c': 'red' })).toBe(true);
    expect(() => run('--v > 10px', { '--v': '5' })).toThrow(ConditionError);
    expect(() => run('--w > 1em', { '--w': '5px' })).toThrow(/incompatible units/);
    expect(() => run('--c > blue', { '--c': 'red' })).toThrow(/needs numbers/);
    expect(() => run('--v', { '--v': '3' })).toThrow(/not a boolean/);
  });

  it('reads history: previous() and direction()', () => {
    expect(parseCondition('--n > previous(--n)').names).toEqual(['--n']);
    expect(run('--n > previous(--n)', { '--n': ['20', '10'] })).toBe(true);
    expect(run('--n > previous(--n)', { '--n': '0' })).toBe(false); // initial: previous == initial
    expect(run('direction(--n) < 0', { '--n': ['15', '20'] })).toBe(true);
    expect(run('direction(--w) == 0', { '--w': ['3px', '3px'] })).toBe(true);
    expect(() => run('direction(--c) > 0', { '--c': ['red', 'blue'] })).toThrow(/needs a number or dimension/);
    expect(() => run('direction(--b) > 0', { '--b': ['true', 'false'] })).toThrow(ConditionError);
    expect(run('previous(--missing) == 1', {})).toBeUndefined();
  });

  it('compares quoted strings exactly and keywords case-insensitively', () => {
    expect(parseTyped('"a \\"b\\""')).toEqual({ type: 'string', v: 'a "b"' });
    expect(serialize(parseTyped("'it\\'s'"))).toBe('"it\'s"');
    expect(serialize({ type: 'string', v: 'say "hi"\n' })).toBe('"say \\"hi\\"\\a "');
    expect(run('--s == "Ada"', { '--s': '"Ada"' })).toBe(true);
    expect(run('--s == "ada"', { '--s': '"Ada"' })).toBe(false);
    expect(run('--s == ""', { '--s': '""' })).toBe(true);
    expect(() => run('--s == ada', { '--s': '"ada"' })).toThrow(/cannot compare/);
    expect(assignable(parseTyped('""'), parseTyped('"x"'))).toBe(true);
    expect(assignable(parseTyped('""'), parseTyped('x'))).toBe(false);
  });

  it('treats missing state as unknown (three-valued), not as false', () => {
    expect(run('--missing', {})).toBeUndefined();
    expect(run('not --missing', {})).toBeUndefined();
    expect(run('--missing and --f', { '--f': 'false' })).toBe(false);
    expect(run('--missing or --t', { '--t': 'true' })).toBe(true);
    expect(run('--missing or --f', { '--f': 'false' })).toBeUndefined();
  });
});

describe('compile: state(), on:, when()', () => {
  it('compiles state() to the author property with a generated variable and the initial fallback', () => {
    const c = compile(`.c { --open: state(false) !important; --n: state(3) }`);
    // each state() also gets a cascade marker in the same rule, with the same importance
    expect(c.css).toMatch(/^\.c \{ --open: var\((--rcss-s\w+), 0\) !important; \1-w: \d+ !important; --n: var\((--rcss-s\w+), 3\) ; \2-w: \d+\}$/);
    expect(c.rules[0].states.map((s) => [s.name, serialize((s.init as { t: Typed }).t)])).toEqual([['--open', '0'], ['--n', '3']]);
  });

  it('rejects state() that is not the whole custom property value', () => {
    const src = `.c { width: state(1px); --a: calc(state(1) + 1) }`;
    expect(compile(src).css).toBe(src);
    expect(diagnostics.join('\n')).toMatch(/state\(\) must be the whole value/);
  });

  it('compiles on: to a cascade-able property and validates events and actions', () => {
    const c = compile(`.t { on: click(set(--active, sibling-index()), toggle(--x)), pointerenter(increment(--n, 2)) !important }`);
    expect(c.css).toMatch(/^\.t \{ --rcss-on: \d+ !important \}$/);
    const set = c.handlers.get(c.rules[0].handler!)!;
    expect([...set.keys()]).toEqual(['click', 'pointerenter']);
    expect(set.get('click')![0].actions.map((a) => a.def.name)).toEqual(['set', 'toggle']);

    for (const bad of [`.a { on: scroll(toggle(--x)) }`, `.a { on: click(alert(1)) }`, `.a { on: click(set(x, 1)) }`, `.a { on: click(toggle(--x, 2)) }`]) {
      expect(compile(bad).css).toBe(bad);
    }
    const d = diagnostics.join('\n');
    expect(d).toMatch(/one of: click, change/);
    expect(d).toMatch(/unknown action "alert\(1\)"/);
    expect(d).toMatch(/expected a state name like --open/);
    expect(d).toMatch(/expected toggle\(--state\)/);
  });

  it('compiles key(), outside(), cycle() and closest() scopes', () => {
    const c = compile(`.m { on: key(Escape, set(--open, false)), key(ctrl+k, toggle(--open)), outside(click, set(--open, false, closest(.menu))), click(cycle(--mode, light, dark, system)) }`);
    const set = c.handlers.get(c.rules[0].handler!)!;
    expect([...set.keys()]).toEqual(['keydown', 'outside:click', 'click']);
    expect(set.get('keydown')!.map((h) => [h.key!.key, h.key!.ctrl])).toEqual([['escape', false], ['k', true]]);
    expect(set.get('outside:click')![0].actions[0].data).toMatchObject({ name: '--open', scope: '.menu' });
    expect((set.get('click')![0].actions[0].data as any).values.map((v: any) => v.v)).toEqual(['light', 'dark', 'system']);
    for (const bad of [`.a { on: key(hyper+x, toggle(--a)) }`, `.a { on: outside(scroll, toggle(--a)) }`, `.a { on: key(Escape) }`, `.a { on: click(cycle(--a, x)) }`])
      expect(compile(bad).css).toBe(bad);
    const d = diagnostics.join('\n');
    expect(d).toMatch(/unknown modifier "hyper"/);
    expect(d).toMatch(/outside\(\) takes one of: click, pointerdown, focusin/);
    expect(d).toMatch(/key\(\) needs at least one action/);
    expect(d).toMatch(/at least two values/);
  });

  it('compiles bind: only in unconditional rules', () => {
    const c = compile(`.f input { bind: --name } .f .x { bind: --v closest(.f) }`);
    expect(c.rules.map((r) => r.bind)).toEqual([{ name: '--name', scope: undefined }, { name: '--v', scope: '.f' }]);
    for (const bad of [`@media (min-width: 1px) { input { bind: --a } }`, `input:focus { bind: --a }`, `input { bind: a b }`])
      expect(compile(bad).css).toBe(bad);
    expect(diagnostics.join('\n')).toMatch(/bind: must be in an unconditional rule/);
  });

  it('ignores on: in untrusted (cross-origin) stylesheets but keeps the rest', () => {
    const c = compile(`.a { on: click(toggle(--x)); --x: state(false) }`, { baseURL: 'https://cdn.example/x.css', trusted: false });
    expect(c.css).toContain('on: click(toggle(--x))');
    expect(c.css).toContain('--x: var(--rcss-s');
    expect(diagnostics.join('\n')).toMatch(/ignored in untrusted stylesheets/);
  });

  it('compiles when() with a pre-parsed condition and :when() to a marker attribute', () => {
    const c = compile(`.p { color: when(--v >= 80 and not --off, green, orange) } .p:when(--v < 10) { color: red }`);
    expect(c.rules[0].decls[0].call.name).toBe('when');
    expect((c.rules[0].decls[0].call.data as any).names).toEqual(['--v', '--off']);
    expect(c.css).toMatch(/\.p\[data-rcss-when-\d+\] \{ color: red \}/);
    const bad = `.p { color: when(--v >>= 1, a, b) }`;
    expect(compile(bad).css).toBe(bad);
  });
});

describe('typed() and key()', () => {
  it('infers only unambiguous syntaxes', () => {
    expect(['0', '0px', '2rem', '0deg', '0.5turn', '50%', '1s', '2dppx', '#fff', 'oklch(70% 0.1 200)'].map(inferSyntax))
      .toEqual(['<number>', '<length>', '<length>', '<angle>', '<angle>', '<percentage>', '<time>', '<resolution>', '<color>', '<color>']);
    expect(inferSyntax('10px 20px')).toBeUndefined();
    expect(inferSyntax('auto')).toBeUndefined(); // named colors need the browser (CSS.supports)
  });

  it('compiles typed() to a plain declaration and rejects bad syntax arguments', () => {
    expect(compile(`.c { --a: typed(0deg); --b: typed(0, "<length>") !important }`).css).toBe(`.c { --a: 0deg; --b: 0 !important }`);
    const bad = `.c { --a: typed(0, length); width: typed(1px) }`;
    expect(compile(bad).css).toBe(bad);
    expect(diagnostics.join('\n')).toMatch(/not a supported syntax/);
  });

  it('parses key specs with aliases and modifiers', () => {
    expect(parseKey('Esc')).toMatchObject({ key: 'escape', printable: false });
    expect(parseKey('ctrl+shift+K')).toMatchObject({ key: 'k', ctrl: true, shift: true, printable: true });
    expect(parseKey('Space').key).toBe(' ');
  });
});

describe('feature registry', () => {
  it('lists every shipped function, selector, action and trigger, and nothing shipped that does not exist', async () => {
    const { describe: info } = await import('../../src/index');
    const d = info();
    const shipped = (kind: string) => d.features.filter((f) => f.kind === kind && (f.status === 'stable' || f.status === 'experimental')).map((f) => f.name).sort();
    // state() and typed() are declaration-level functions handled by the parser, not the function registry
    expect(shipped('function').filter((n) => n !== 'state' && n !== 'typed')).toEqual(d.functions.map((f) => f.name).sort());
    expect(shipped('selector')).toEqual(d.selectors.map((s) => s.name).sort());
    expect(shipped('action')).toEqual(d.actions.map((a) => a.name).sort());
    expect(shipped('trigger')).toEqual([...d.events, 'key', 'outside'].sort());
    expect(shipped('expression')).toEqual([...d.expressions, ...d.actionExpressions].sort());
    for (const f of d.features) {
      expect(['native', 'simplify', 'extend', 'evaluate']).toContain(f.category);
      if (f.status === 'stable') expect(f.examples.length).toBeGreaterThan(0);
    }
    expect(d.keepNative).toContain('if()');
  });
});
