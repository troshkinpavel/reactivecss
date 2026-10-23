// 0.5: value expressions in state() and set(): attr(), pick(), split().
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { compile, diagnostics } from '../../src/index';
import { parseExpr, evaluate } from '../../src/state/expr';
import { serialize } from '../../src/state/values';

/** Stand-in element: only what the evaluator reads. */
const el = (attrs: Record<string, string> = {}, tagName = 'DIV', type = '') =>
  ({ tagName, type, autocomplete: '', getAttribute: (n: string) => attrs[n] ?? null }) as unknown as Element;
const val = (text: string, e = el()) => evaluate(parseExpr(text), e);

beforeEach(() => { diagnostics.length = 0; });

describe('expressions', () => {
  it('literals are unchanged', () => {
    expect(val('false')).toEqual({ type: 'boolean', v: false });
    expect(val('"Hello!"')).toEqual({ type: 'string', v: 'Hello!' });
    expect(val('rgb(1 2 3)')).toEqual({ type: 'value', v: 'rgb(1 2 3)' }); // other functions stay values
  });

  it('attr() reads the element, always as a string; missing gives the fallback or ""', () => {
    const e = el({ 'data-message': 'Bonjour 👋 "quoted" \\ back', 'data-n': '3', 'data-empty': '' });
    expect(val('attr(data-message)', e)).toEqual({ type: 'string', v: 'Bonjour 👋 "quoted" \\ back' });
    expect(val('attr(data-n)', e)).toEqual({ type: 'string', v: '3' });
    expect(val('attr(data-empty, "x")', e)).toEqual({ type: 'string', v: '' }); // present but empty: not the fallback
    expect(val('attr(data-missing)', e)).toEqual({ type: 'string', v: '' });
    expect(val('attr(data-missing, "Hi")', e)).toEqual({ type: 'string', v: 'Hi' });
    expect(val('attr(DATA-N)', e)).toEqual({ type: 'string', v: '3' }); // HTML names are case-insensitive
  });

  it('attr() never reads password or payment fields', () => {
    expect(val('attr(value, "no")', el({ value: 'secret' }, 'INPUT', 'password'))).toEqual({ type: 'string', v: 'no' });
  });

  it('split() inside pick(): trimmed entries, empty entries dropped, Unicode and multi-character delimiters', () => {
    const pickAll = (text: string, e = el()) => {
      const seen = new Set<string>();
      for (let i = 0; i < 200; i++) { const v = val(text, e); if (v) seen.add(v.v as string); }
      return [...seen].sort();
    };
    expect(pickAll('pick(split("Hello!|Bonjour!|Hola!", "|"))')).toEqual(['Bonjour!', 'Hello!', 'Hola!']);
    expect(pickAll('pick(split(" a || b |", "|"))')).toEqual(['a', 'b']);
    expect(pickAll('pick(split("こんにちは→안녕→👋", "→"))')).toEqual(['こんにちは', '안녕', '👋']);
    expect(pickAll('pick(split("a::b", "::"))')).toEqual(['a', 'b']);
    expect(pickAll('pick(split("no delimiter here", "|"))')).toEqual(['no delimiter here']);
    expect(pickAll('pick(split("a\\"b|c", "|"))')).toEqual(['a"b', 'c']); // CSS string escapes
    expect(pickAll('pick(split(attr(data-o), ","))', el({ 'data-o': 'x, y' }))).toEqual(['x', 'y']);
    expect(val('pick(split("", "|"))')).toBeUndefined(); // nothing to pick: no value
    expect(val('pick(split(attr(data-missing), "|"))')).toBeUndefined();
    expect(val('pick(split(" | ", "|"))')).toBeUndefined();
  });

  it('pick() of values', () => {
    const v = val('pick(1, 2, 3)')!;
    expect([1, 2, 3]).toContain(v.v);
    expect(val('pick("only")')).toEqual({ type: 'string', v: 'only' });
  });

  it('invalid expressions are compile errors with a fix', () => {
    const err = (text: string) => { try { parseExpr(text); return ''; } catch (e) { return (e as Error).message; } };
    expect(err('split("a|b", "|")')).toMatch(/use it inside pick\(\)/); // a list is never a state value
    expect(err('pick(split("a|b", ""))')).toMatch(/must not be empty/);
    expect(err('pick(split("a|b"))')).toMatch(/expected split\(text, "delimiter"\)/);
    expect(err('pick(split("a|b", |))')).toMatch(/quoted string/);
    expect(err('pick(split(3, "|"))')).toMatch(/splits a quoted string or attr\(\)/);
    expect(err('pick(split(pick("a"), "|"))')).toMatch(/splits a quoted string or attr\(\)/);
    expect(err('pick(split("a", "|"), "b")')).toMatch(/only argument of pick\(\)/);
    expect(err('pick(1, "a")')).toMatch(/same type/);
    expect(err('pick(pick(1))')).toMatch(/cannot be nested/);
    expect(err('pick()')).toMatch(/at least one value/);
    expect(err('attr()')).toMatch(/attr\(name\)/);
    expect(err('attr(data-n type(<number>))')).toMatch(/expected an attribute name/);
    expect(err('attr([title])')).toMatch(/expected an attribute name/);
    // 0.9.0: a typed fallback (the attribute is read as that type); a list is still an error.
    expect(err('attr(data-x, fallback)')).toBe('');
    expect(err('attr(data-x, a, b)')).toMatch(/attr\(name\) or attr\(name, "fallback"\)/);
    expect(err('attr(data-x, pick(1))')).toMatch(/fallback must be one value/);
  });

  it('strings serialize to one CSS string token, whatever they contain', () => {
    const s = (v: string) => serialize({ type: 'string', v });
    expect(s('a"b\\c')).toBe('"a\\"b\\\\c"');
    expect(s('line\nbreak\r\f\0x')).toBe('"line\\a break\\d \\c \\0 x"');
    expect(s('}; color: red; --x: "')).toBe('"}; color: red; --x: \\""');
  });
});

describe('compiling state() and set() with expressions', () => {
  it('a literal state keeps its var() fallback; an evaluated one has none', () => {
    const c = compile(`.a { --m: state("Hi") } .b { --m: state(attr(data-m)) } .c { on: click(set(--m, pick(split(attr(data-o), "|")))) }`);
    expect(c.css).toMatch(/\.a \{ --m: var\((--rcss-s\w+), "Hi"\) ; \1-w: \d+\}/);
    expect(c.css).toMatch(/\.b \{ --m: var\(--rcss-s\w+\) ; --rcss-s\w+-w: \d+\}/);
    expect(diagnostics).toEqual([]);
  });

  it('the same state name gets the same generated property in every compile and every rule', () => {
    const name = (css: string) => /var\((--rcss-s\w+)/.exec(compile(css).css)![1];
    const a = name(`.x { --stable-open: state(false) }`);
    expect(name(`.x { --stable-open: state(false) }`)).toBe(a);
    expect(name(`.y { --stable-open: state(true) }`)).toBe(a);
    expect(name(`.y { --stable-other: state(true) }`)).not.toBe(a);
  });

  it('native attr() outside state() and set() is left to the browser', () => {
    const css = `.l::before { content: attr(data-label) } .t { --x: attr(data-x); width: attr(data-w type(<length>), 10px) } .s { --on: state(false) }`;
    const c = compile(css);
    expect(c.css).toContain('content: attr(data-label)');
    expect(c.css).toContain('--x: attr(data-x)');
    expect(c.css).toContain('width: attr(data-w type(<length>), 10px)');
    expect(c.rules.filter((r) => r.decls.length)).toEqual([]); // nothing bound
  });

  it('attr() in state() needs a trusted stylesheet; literal state() does not', () => {
    compile(`.a { --m: state(attr(data-m)) } .b { --n: state(1) }`, { trusted: false });
    expect(diagnostics.join('\n')).toMatch(/attr\(\) in state\(\) is ignored in untrusted stylesheets/);
    expect(diagnostics.length).toBe(1);
  });

  it('set() still rejects other functions', () => {
    compile(`.c { on: click(set(--m, calc(1 + 2))) }`);
    expect(diagnostics.join('\n')).toMatch(/use a value, attr\(\), pick\(\)/);
  });
});


describe('wave() removal (0.5)', () => {
  it('is no longer processed: the declaration is left to the browser, and the registry says why', async () => {
    const c = compile(`.f { translate: 0 wave(-8px, 8px, 3s); --o: state(false) }`);
    expect(c.css).toContain('translate: 0 wave(-8px, 8px, 3s)');
    expect(c.rules.flatMap((r) => r.decls)).toEqual([]);
    const { describe: info, version } = await import('../../src/index');
    expect(version).toBe(JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version);
    const w = info().features.find((f) => f.name === 'wave')!;
    expect(w).toMatchObject({ status: 'removed', removedIn: '0.5' });
    expect(w.nativeEquivalent).toMatch(/@keyframes/);
    expect(info().functions.map((f) => f.name)).not.toContain('wave');
  });
});

describe('feature registry for tooling', () => {
  it('kind + name identifies every entry (a stable id for docs and editors)', async () => {
    const { describe: info } = await import('../../src/index');
    const ids = info().features.map((f) => `${f.kind}:${f.name}`);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('custom pseudo-classes inside functional selectors', () => {
  it(':nth-var() directly inside :has() gets its own compound (0.5 fix)', () => {
    const c = compile(`.q:has(.opt.correct:nth-var(--a)) .v { color: green } .w:not(.x:when(--on)) { color: red }`);
    expect(diagnostics).toEqual([]);
    expect(c.css).toMatch(/\.q:has\(\.opt\.correct\[data-rcss-nth-\d+\]\) \.v/);
  });
});
