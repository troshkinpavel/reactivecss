import { describe, expect, it } from 'vitest';
import { highlightCss } from '~/lib/code/css';

const rx = (code: string) => highlightCss(code).flat().filter((t) => t.k === 'rx').map((t) => `${t.t}=${t.feature}`);
const kinds = (code: string) => highlightCss(code).flat().filter((t) => t.k !== 'ws').map((t) => `${t.k}:${t.t}`);

describe('highlightCss', () => {
  it('marks state, on:, triggers, actions and when()', () => {
    expect(rx('.switch {\n  --on: state(false);\n  on: click(toggle(--on));\n  background: when(--on, #f2542d, #d9d5cf);\n}')).toEqual([
      'state=function:state', 'on=declaration:on', 'click=trigger:click', 'toggle=action:toggle', 'when=function:when',
    ]);
  });

  it('0.9: content is DOM text on elements and native on pseudo-elements; modifiers and outside() link to their pages', () => {
    expect(rx('.v { content: var(--n); }')).toEqual(['content=declaration:content']);
    expect(rx('.v::before { content: var(--n); }')).toEqual([]);
    expect(rx('.a:on(click, prevent(), stop()) {}')).toEqual([':on=rule:on', 'prevent=action:prevent', 'stop=action:prevent']);
    expect(rx('.m:on(drag(move)) {}')).toEqual([':on=rule:drag', 'drag=rule:drag']);
    expect(rx('.m:on(outside(click)) {}')).toEqual([':on=rule:on', 'outside=trigger:outside']);
  });

  it('keeps native CSS ink and classifies structure', () => {
    expect(kinds('.a::after { content: var(--x, "y"); }')).toEqual([
      'sel:.a', 'sel:::after', 'pun:{', 'prop:content', 'pun::', 'fn:var', 'pun:(', 'var:--x', 'pun:,', 'str:"y"', 'pun:)', 'pun:;', 'pun:}',
    ]);
  });

  it('marks reactive selectors, including their condition syntax', () => {
    const t = kinds('.cart:when(--items >= 3 and not --open) .banner { opacity: 1; }');
    expect(t.slice(0, 9)).toEqual(['sel:.cart', 'rx::when', 'pun:(', 'var:--items', 'pun:>', 'pun:=', 'val:3', 'kw:and', 'kw:not']);
    expect(rx('input:just-checked + span {}')).toEqual([':just-checked=selector:just-checked']);
    expect(rx('.panel:nth-var(--active) {}')).toEqual([':nth-var=selector:nth-var']);
  });

  it('only treats actions and triggers as reactive inside on:', () => {
    expect(rx('.a { transform: toggle(1, 2); }')).toEqual([]);
    expect(rx('.m { on: outside(click, set(--open, false)), key(Escape, set(--open, false)); }')).toEqual([
      'on=declaration:on', 'outside=trigger:outside', 'set=action:set', 'key=trigger:key', 'set=action:set',
    ]);
    expect(rx('.f input { bind: --name closest(.form); }')).toEqual(['bind=declaration:bind', 'closest=scope:closest']);
  });

  it('is context aware for element() and on()', () => {
    expect(rx('.c { --w: element(width); background: element(#hero); }')).toEqual(['element=function:element']);
    expect(rx('.d { --roll: on(click, random(1, 6, by 1)); }')).toEqual(['on=function:on', 'random=function:random']);
  });

  it('handles nesting, at-rules and multi-line comments', () => {
    const lines = highlightCss('/* a\n b */\n@media (prefers-color-scheme: dark) {\n  .x:when(--theme == system) { --bg: #000; }\n}\n.y { &:hover { color: red; } }');
    expect(lines).toHaveLength(6);
    expect(lines[0]!.map((t) => t.k)).toEqual(['com']);
    expect(lines[2]![0]).toMatchObject({ t: '@media', k: 'at' });
    expect(lines[3]!.find((t) => t.k === 'rx')).toMatchObject({ t: ':when', feature: 'selector:when' });
    expect(lines[5]!.filter((t) => t.k === 'prop').map((t) => t.t)).toEqual(['color']);
  });

  it('keeps source offsets', () => {
    const src = '.a {\n  --n: state(1);\n}';
    for (const t of highlightCss(src).flat()) expect(src.slice(t.start, t.start + t.t.length)).toBe(t.t);
  });
});
