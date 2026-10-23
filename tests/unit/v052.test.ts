// 0.5.2: state(initial, bind(attribute)).
import { describe, it, expect, beforeEach } from 'vitest';
import { compile, diagnostics } from '../../src/index';
import { parseBind } from '../../src/state/bindattr';

beforeEach(() => { diagnostics.length = 0; });
const err = (text: string, type: any = 'boolean') => { try { parseBind(text, type); return ''; } catch (e) { return (e as Error).message; } };

describe('bind() in state()', () => {
  it('accepts the allowlist with the right kinds', () => {
    expect(parseBind('bind(aria-expanded)', 'boolean')).toEqual({ name: 'aria-expanded', kind: 'aria-boolean' });
    expect(parseBind('bind( ARIA-PRESSED )', 'boolean')).toEqual({ name: 'aria-pressed', kind: 'aria-boolean' });
    expect(parseBind('bind(aria-current)', 'value')).toEqual({ name: 'aria-current', kind: 'aria-current' });
    expect(parseBind('bind(disabled)', 'boolean')).toEqual({ name: 'disabled', kind: 'boolean' });
    expect(parseBind('bind(data-status)', 'string')).toEqual({ name: 'data-status', kind: 'data' });
    expect(parseBind('bind(data-count)', 'number')).toEqual({ name: 'data-count', kind: 'data' });
    expect(parseBind('bind(data-X)', 'string').name).toBe('data-x'); // HTML lower-cases attribute names
  });

  it('rejects everything else: handlers, URLs, style, free text, other ARIA, malformed', () => {
    // 0.9.0 allows aria-hidden (true/false) and aria-label (text, like data-*); other ARIA stays out.
    for (const a of ['onclick', 'href', 'src', 'srcdoc', 'style', 'class', 'id', 'role', 'aria-describedby', 'aria-owns', 'value', 'checked', 'data-', 'data-a b', 'xlink:href', 'formaction'])
      expect(err(`bind(${a})`), a).toMatch(/only .* can be bound|expected bind/);
    expect(err('bind()')).toMatch(/only .* can be bound/);
    expect(err('bind(aria-expanded) x')).toMatch(/expected bind\(attribute\)/);
    expect(err('attr(aria-expanded)')).toMatch(/expected bind\(attribute\)/);
  });

  it('checks the state type against the attribute', () => {
    expect(err('bind(aria-expanded)', 'string')).toMatch(/needs a boolean state/);
    expect(err('bind(disabled)', 'number')).toMatch(/needs a boolean state/);
    expect(err('bind(aria-current)', 'number')).toMatch(/needs a boolean or a token/);
    expect(err('bind(data-n)', 'number')).toBe('');
  });

  it('compiles with the binding on the state declaration; plain state() and state(attr()) are unchanged', () => {
    const c = compile(`.m { --open: state(false, bind(aria-expanded)) } .n { --count: state(0) } .o { --name: state(attr(data-name)) }`);
    expect(diagnostics).toEqual([]);
    expect(c.rules[0].states[0].bind).toEqual({ name: 'aria-expanded', kind: 'aria-boolean' });
    expect(c.rules[1].states[0].bind).toBeUndefined();
    expect(c.rules[2].states[0].bind).toBeUndefined();
    expect(c.css).toMatch(/\.m \{ --open: var\(--rcss-s\w+, 0\)/);
  });

  it('reports bad bindings and leaves the declaration unchanged; untrusted sheets cannot bind', () => {
    compile(`.m { --open: state(false, bind(onclick)) } .p { --x: state(1, 2, 3) }`);
    const d = diagnostics.join('\n');
    expect(d).toMatch(/bind\(onclick\): only/);
    // 0.9.0: state() takes up to two modifiers, bind() and persist().
    expect(d).toMatch(/"2" is neither bind\(\) nor persist\(\)/);
    diagnostics.length = 0;
    compile(`.m { --open: state(false, bind(aria-expanded)) } .n { --n: state(1) }`, { trusted: false });
    expect(diagnostics.join('\n')).toMatch(/bind\(\) in state\(\) is ignored in untrusted stylesheets/);
    expect(diagnostics.length).toBe(1);
  });
});
