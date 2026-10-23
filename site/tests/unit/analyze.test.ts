import { describe, expect, it } from 'vitest';
import { analyze, declarations, querySelectorFor } from '~/lib/examples/analyze';

const counter = `.counter {
  --count: state(0);
  --last: previous(--count);
}

.plus  { on: click(increment(--count)); }
.minus { on: click(decrement(--count)); }

.counter:changed(--count) output {
  animation-name: when(
    direction(--count) > 0,
    slide-up,
    slide-down
  );
}`;

describe('analyze', () => {
  it('finds states, derived values, triggers and readers', () => {
    const a = analyze(counter);
    expect(a.states).toEqual([{ name: '--count', line: 1, selector: '.counter', initial: '0', type: 'number' }]);
    expect(a.derived).toEqual([{ name: '--last', line: 2, selector: '.counter', fn: 'previous', type: 'number' }]);
    expect(a.triggers.map((t) => [t.line, t.selector, t.kind, t.writes])).toEqual([
      [5, '.plus', 'on', ['--count']],
      [6, '.minus', 'on', ['--count']],
    ]);
    expect(a.reads['--count']).toEqual([2, 8, 10]);
    expect(analyze('.m { --open: state(false); on: outside(click, set(--open, false)), key(Escape, set(--open, false)); }').triggers[0]!.events).toEqual(['outside:click', 'key:Escape']);
    expect(a.features).toEqual(['function:state', 'function:previous', 'declaration:on', 'trigger:click', 'action:increment', 'action:decrement', 'selector:changed', 'function:when', 'function:direction']);
  });

  it('resolves nesting and media groups', () => {
    const d = declarations('.a { --x: state(true); & .b { on: click(toggle(--x)); } }\n@media (min-width: 1px) { .c:when(--x) { color: red; } }');
    expect(d.map((x) => [x.selector, x.prop, x.conditional])).toEqual([
      ['.a', '--x', false],
      ['.a .b', 'on', false],
      ['.c:when(--x)', 'color', true],
    ]);
  });

  it('reads bind: targets and string states', () => {
    const a = analyze('form { --name: state(""); }\nform input { bind: --name closest(form); }\n.g::after { content: var(--name); }');
    expect(a.states[0]).toMatchObject({ name: '--name', type: 'string', initial: '""' });
    expect(a.triggers[0]).toMatchObject({ kind: 'bind', writes: ['--name'], selector: 'form input' });
    expect(a.reads['--name']).toEqual([2]);
  });

  it('builds queryable selectors', () => {
    expect(querySelectorFor('.theme-option.light:when(--theme == light), .x:nth-var(--a)::after')).toBe('.theme-option.light, .x');
    expect(querySelectorFor('input:just-checked + span')).toBe('input + span');
  });
});
