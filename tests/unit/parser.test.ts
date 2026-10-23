import { describe, it, expect, beforeEach } from 'vitest';
import { compile, diagnostics } from '../../src/index';
import { tokenize } from '../../src/core/tokenizer';
import { hasReactiveSyntax, resolveNesting } from '../../src/core/parser';

const vars = (css: string) => [...css.matchAll(/var\((--rcss-[a-z0-9]+)\)/g)].map((m) => m[1]);

beforeEach(() => { diagnostics.length = 0; });

describe('tokenizer', () => {
  it('keeps strings, comments, url() and escapes as single tokens', () => {
    const t = tokenize(`a{content:"random(1,2)";/* live( */background:url(a(b).png);--\\31x:1}`);
    expect(t.filter((x) => x.type === 'string')[0].value).toBe('random(1,2)');
    expect(t.some((x) => x.type === 'comment')).toBe(true);
    expect(t.find((x) => x.type === 'url')!.value).toBe('a(b');
    expect(t.find((x) => x.type === 'ident' && x.value.startsWith('--'))!.value).toBe('--1x');
  });
  it('round-trips the source exactly', () => {
    const src = `@media (x){.a:hover>b::before{c:"d\\"e" /*f*/ !important}}`;
    expect(tokenize(src).map((t) => src.slice(t.start, t.end)).join('')).toBe(src);
  });
});

describe('compile', () => {
  it('leaves CSS without reactive syntax byte-for-byte unchanged', () => {
    const src = `/* c */ @layer x { .a { color: red !important; content: "random(1, 2)" } }\n@media (min-width: 1px) { b { margin: calc(1px + 2px) } }`;
    const c = compile(src);
    expect(c.changed).toBe(false);
    expect(c.css).toBe(src);
    expect(hasReactiveSyntax('.a{color:red}')).toBe(false);
  });

  it('replaces only the reactive call and keeps the rest of the declaration', () => {
    const c = compile(`.box { width: random(100px, 300px) !important; color: red }`);
    const [v] = vars(c.css);
    expect(c.css).toBe(`.box { width: var(${v}) !important; color: red }`);
    expect(c.rules).toHaveLength(1);
    expect(c.rules[0].match).toBe('.box');
    expect(c.rules[0].decls[0].call.name).toBe('random');
  });

  it('tracks several expressions in one declaration independently, across newlines and comments', () => {
    const c = compile(`.card {
      transform: translate(
        live(random(0px, 100px), 200ms), /* x */
        live(random(0px, 100px), 500ms)
      );
    }`);
    const v = vars(c.css);
    expect(v).toHaveLength(2);
    expect(new Set(v).size).toBe(2);
    const [a, b] = c.rules[0].decls;
    expect(a.call.data).toBe(200);
    expect(b.call.data).toBe(500);
    const inner = a.call.args[0].parts[0] as any;
    expect(inner.name).toBe('random');
    expect(inner.args.map((x: any) => x.text)).toEqual(['0px', '100px']);
  });

  it('handles nested native functions inside arguments', () => {
    const c = compile(`.a { left: random(calc(1px + 2px), var(--max, 10px)) }`);
    expect(c.rules[0].decls[0].call.args.map((a) => a.text)).toEqual(['calc(1px + 2px)', 'var(--max, 10px)']);
  });

  it('supports reactive values in custom properties and in var() fallbacks', () => {
    const c = compile(`.a { --x: mouse(x); color: var(--c, pick(red, blue)) }`);
    expect(vars(c.css)).toHaveLength(2);
  });

  it('compiles native-only functions to plain CSS without bindings', () => {
    const c = compile(`.a { width: viewport(width); height: calc(viewport(height) - 10px) }`);
    expect(c.css).toBe(`.a { width: 100dvw; height: calc(100dvh - 10px) }`);
    expect(c.rules).toHaveLength(0);
  });

  it('inlines native functions nested in runtime functions', () => {
    const c = compile(`.a { left: random(0px, viewport(width)) }`);
    expect(c.rules[0].decls[0].call.args[1].parts).toEqual(['100dvw']);
  });

  it('keeps reactive rules inside @media/@supports/@layer and resolves nesting', () => {
    const c = compile(`@media (min-width: 1px) { @layer a { .p { left: random(1px, 2px); .c:hover & > i::before { top: random(1px, 2px) } } } }`);
    expect(c.css).toContain('@media (min-width: 1px) { @layer a { .p { left: var(');
    expect(c.rules.map((r) => r.match)).toEqual(['.p', '.c:is(*) :is(.p) > i:is(*)']);
  });

  it('prefixes relative nested selectors with the parent', () => {
    expect(resolveNesting('.a, .b', '> .c, .d')).toBe(':is(.a, .b) > .c, :is(.a, .b) .d');
  });

  it('rejects invalid arguments with a diagnostic and leaves the declaration alone', () => {
    const src = `.a { left: random(1px, 2px, 3s); top: live(random(1px, 2px), soon); rotate: on(scroll, 1deg) }`;
    const c = compile(src);
    expect(c.css).toBe(src);
    expect(diagnostics.join('\n')).toMatch(/a third argument is a step, never an update interval/);
    expect(diagnostics.join('\n')).toMatch(/interval "soon"/);
    expect(diagnostics.join('\n')).toMatch(/unsupported event "scroll"/);
  });

  it('does not process reactive syntax inside @keyframes', () => {
    const src = `@keyframes k { to { left: random(1px, 2px) } }`;
    expect(compile(src).css).toBe(src);
    expect(diagnostics[0]).toMatch(/@keyframes/);
  });

  it('rewrites relative URLs of linked sheets, except fragments', () => {
    const c = compile(`@import "base.css"; .a { background: url(img/a.png), image-set("b.png" 1x); filter: url(#f); left: random(1px, 2px) }`, 'https://x.test/css/site.css');
    expect(c.css).toContain('@import "https://x.test/css/base.css"');
    expect(c.css).toContain('url("https://x.test/css/img/a.png")');
    expect(c.css).toContain('image-set("https://x.test/css/b.png" 1x)');
    expect(c.css).toContain('url(#f)');
  });
});

describe('selectors', () => {
  it('replaces state pseudo-classes with marker attributes of equal specificity', () => {
    const c = compile(`input:just-checked + .icon { animation: a 1s } input:not(:just-unchecked) { color: red }`);
    expect(c.css).toBe(`input[data-rcss-just-checked] + .icon { animation: a 1s } input:not([data-rcss-just-unchecked]) { color: red }`);
    expect(c.runtime.setup.length).toBe(2);
  });

  it('does not touch standard selectors or pseudo-elements with similar names', () => {
    const src = `input:checked, li:nth-child(2), a::just-checked { color: red }`;
    expect(compile(src).css).toBe(src);
  });

  it('compiles :nth-var() and rejects it without a compound selector', () => {
    const c = compile(`.carousel .slide.big:nth-var(--active) { opacity: 1 }`);
    expect(c.css).toMatch(/^\.carousel \.slide\.big\[data-rcss-nth-\d+\] \{ opacity: 1 \}$/);
    const bad = `:nth-var(--active) { opacity: 1 }`;
    expect(compile(bad).css).toBe(bad);
    expect(diagnostics[0]).toMatch(/needs a type, class or attribute selector/);
  });

  it('binds rules with stateful selectors to a superset of elements', () => {
    const c = compile(`input:just-checked + .icon { rotate: random(1deg, 2deg) }`);
    expect(c.rules[0].match).toBe('input:is(*) + .icon');
  });
});
