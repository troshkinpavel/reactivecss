// 0.9.0 language (docs/rfc-v0.9.0-language.md): grammar and validation tables, the event-time
// evaluator, persistence decoding, slot compilation and feature analysis. Pure: no DOM.
import { describe, it, expect, beforeEach } from 'vitest';
import { compile, diagnostics } from '../../src/index';
import { compileTrigger, compileMutation } from '../../src/state/on';
import { parseAction, value, EvalError, type EvalCtx } from '../../src/state/actexpr';
import { decode } from '../../src/state/persist';
import { hasReactiveSyntax } from '../../src/core/parser';
import type { Typed } from '../../src/state/values';
// @ts-expect-error: plain ESM tooling, no type declarations
import { analyze, featureOfKey, resolve } from '../../tools/bundle.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

beforeEach(() => { diagnostics.length = 0; });
const err = (fn: () => unknown) => { try { fn(); return ''; } catch (e) { return (e as Error).message; } };

describe(':on() triggers and modifiers', () => {
  const ok: [string, string, string, Partial<Record<'prevent' | 'stop', boolean>>][] = [
    ['click', 'click', 'click', {}],
    ['click, prevent()', 'click', 'click', { prevent: true }],
    ['click, stop()', 'click', 'click', { stop: true }],
    ['click, prevent(), stop()', 'click', 'click', { prevent: true, stop: true }],
    ['click, stop(), prevent()', 'click', 'click', { prevent: true, stop: true }],
    ['keydown(Escape)', 'keydown(escape)', 'keydown', {}],
    ['keyup(ctrl+k)', 'keyup(ctrl+k)', 'keyup', {}],
    ['outside(click)', 'outside:click', 'click', {}],
    ['pointermove', 'pointermove', 'pointermove', {}],
    ['submit, prevent()', 'submit', 'submit', { prevent: true }],
    ['scrollend', 'scrollend', 'scrollend', {}],
  ];
  for (const [text, key, dom, mods] of ok) {
    it(`accepts :on(${text})`, () => {
      const { trigger, mods: m } = compileTrigger(text);
      expect(trigger.key).toBe(key);
      expect(trigger.dom).toBe(dom);
      expect(m).toEqual({ prevent: false, stop: false, ...mods });
    });
  }
  const bad: [string, RegExp][] = [
    ['', /needs an event/],
    ['tap', /unknown event "tap"; supported: click/],
    ['input, prevent()', /prevent\(\) needs a cancelable event/],
    ['outside(click), prevent()', /not allowed with outside\(\)/],
    ['click, prevent', /write the modifier as a function: prevent\(\)/],
    ['click, stop', /write the modifier as a function: stop\(\)/],
    ['click, once', /once is not supported in :on\(\)/],
    ['click, once()', /once is not supported in :on\(\)/],
    ['click, prevent(1)', /unknown modifier "prevent\(1\)"; use prevent\(\) or stop\(\)/],
    ['drag, stop()', /stop\(\) has no meaning for drag/],
    ['outside(keydown)', /outside\(\) takes one of/],
    ['click(Enter)', /click takes no argument/],
    ['keydown(hyper+x)', /unknown modifier "hyper"/],
    ['click, now', /unknown modifier "now"/],
    ['click, stop(), stop()', /stop\(\) is given twice/],
    ['drag(sideways)', /drag\(\) takes start, move, end or cancel/],
  ];
  for (const [text, re] of bad) it(`rejects :on(${text})`, () => expect(err(() => compileTrigger(text))).toMatch(re));
});

describe('mutations', () => {
  const click = compileTrigger('click').trigger;
  const drag = compileTrigger('drag').trigger;
  const input = compileTrigger('input').trigger;
  it('compiles every operation', () => {
    expect(compileMutation('--o', 'toggle()', click).op).toBe('toggle');
    expect(compileMutation('--n', 'increment(1)', click).op).toBe('increment');
    expect(compileMutation('--n', 'decrement()', click).expr).toBeUndefined();
    expect(compileMutation('--m', 'cycle(light, dark, system)', click).values).toHaveLength(3);
    expect(compileMutation('--n', 'set(calc(var(--n) + 1))', click).expr).toBeTruthy();
  });
  const bad: [string, string, typeof click, RegExp][] = [
    ['--n', '5', click, /expected set\(value\), toggle\(\)/],
    ['--n', 'add(1)', click, /expected set\(value\)/],
    ['--o', 'toggle(--o)', click, /toggle\(\) takes no arguments/],
    ['--m', 'cycle(a)', click, /at least two values/],
    ['--n', 'set()', click, /set\(\) needs a value/],
    ['--x', 'set(event(x))', click, /event\(x\) is not available for click/],
    ['--x', 'set(event(value))', click, /not available for click/],
    ['--x', 'set(event(nope))', input, /unknown field; input provides type, value, value-as-number, checked/],
    ['--x', 'set(mouse(x))', input, /needs a pointer or drag trigger/],
    ['--x', 'set(--y)', click, /write var\(--y\)/],
    ['--x', 'set(eval(1))', click, /eval\(\) is not available in actions/],
    ['--x', 'set(1 +)', click, /ends too early/],
    ['--x', 'set(split("a|b", "|"))', click, /use it inside pick\(\)/],
  ];
  for (const [name, text, trig, re] of bad) it(`rejects ${name}: ${text}`, () => expect(err(() => compileMutation(name, text, trig))).toMatch(re));
  it('accepts drag fields for drag triggers', () => {
    for (const f of ['x', 'y', 'delta-x', 'movement-y', 'start-x', 'client-x', 'local-y', 'pointer-type'])
      expect(err(() => compileMutation('--x', `set(event(${f}))`, drag)), f).toBe('');
  });
});

describe('event-time evaluation (snapshot values)', () => {
  const ev = (text: string, ctx: Partial<EvalCtx> = {}) => value(parseAction(text, 'pointer', 'click'), { e: {} as Event, el: {} as Element, ...ctx });
  const n = (v: number): Typed => ({ type: 'number', v, unit: '' });
  const px = (v: number): Typed => ({ type: 'dimension', v, unit: 'px' });
  it('typed arithmetic with CSS precedence and units', () => {
    expect(ev('1 + 2 * 3')).toEqual(n(7));
    expect(ev('(1 + 2) * 3')).toEqual(n(9));
    expect(ev('calc(10px + 1in)')).toEqual(px(106));
    expect(ev('10px * 2')).toEqual(px(20));
    expect(ev('10px / 4px')).toEqual(n(2.5));
    expect(ev('0 + 5px')).toEqual(px(5));
    expect(ev('-5px')).toEqual(px(-5));
    expect(ev('1turn - 90deg')).toEqual({ type: 'dimension', v: 0.75, unit: 'turn' });
    expect(ev('0.1 + 0.2')).toEqual(n(0.3));
  });
  it('min, max, clamp, round, abs', () => {
    expect(ev('min(3, 1, 2)')).toEqual(n(1));
    expect(ev('max(1px, 2px)')).toEqual(px(2));
    expect(ev('clamp(0px, 150px, 100px)')).toEqual(px(100));
    expect(ev('clamp(0, -3, 10)')).toEqual(n(0));
    expect(ev('round(7px, 5px)')).toEqual(px(5));
    expect(ev('round(up, 6px, 5px)')).toEqual(px(10));
    expect(ev('round(2.5)')).toEqual(n(3));
    expect(ev('abs(-4)')).toEqual(n(4));
  });
  it('literals of every state type', () => {
    expect(ev('"hi"')).toEqual({ type: 'string', v: 'hi' });
    expect(ev('true')).toEqual({ type: 'boolean', v: true });
    expect(ev('dark')).toEqual({ type: 'value', v: 'dark' });
    expect(ev('#ff0')).toEqual({ type: 'value', v: '#ff0' });
  });
  it('incompatible units, division by zero and strings are evaluation errors', () => {
    for (const t of ['1px + 1%', '1px + 1em', '1px + 2', '1px * 2px', '1 / 0', '"a" + 1', '2 / 1px'])
      expect(() => ev(t), t).toThrow(EvalError);
  });
  it('event fields read the event; drag x / y start from the mutated state', () => {
    const e = { clientX: 30, clientY: 40, type: 'pointerdown', pointerId: 7, pointerType: 'pen', pressure: 0.5, key: 'a' } as unknown as Event;
    expect(ev('event(client-x) + 10px', { e })).toEqual(px(40));
    expect(ev('event(pointer-type)', { e })).toEqual({ type: 'string', v: 'pen' });
    expect(ev('event(pressure) * 2', { e })).toEqual(n(1));
    expect(ev('mouse(y)', { e })).toEqual(px(40));
    const cell = { name: '--x', value: px(100) } as never;
    const drag = { startX: 10, startY: 10, x: 35, y: 15, lastX: 30, lastY: 15, rect: { left: 0, top: 0 } as DOMRect, starts: new Map() };
    const d = (t: string) => value(parseAction(t, 'drag', 'drag:move'), { e, el: {} as Element, target: cell, drag });
    expect(d('event(x)')).toEqual(px(125));
    expect(d('event(delta-x)')).toEqual(px(25));
    expect(d('event(movement-x)')).toEqual(px(5));
    expect(d('clamp(0px, event(x), 120px)')).toEqual(px(120));
  });
});

describe('persist() storage values', () => {
  const like = (t: Typed) => t;
  it('accepts only values that fit the declared type', () => {
    expect(decode('{"t":"boolean","v":true}', like({ type: 'boolean', v: false }))).toEqual({ type: 'boolean', v: true });
    expect(decode('{"t":"dimension","v":2,"u":"in"}', like({ type: 'dimension', v: 0, unit: 'px' }))).toEqual({ type: 'dimension', v: 192, unit: 'px' });
    expect(decode('{"t":"number","v":3}', like({ type: 'boolean', v: false }))).toBeUndefined();
    expect(decode('not json', like({ type: 'number', v: 0, unit: '' }))).toBeUndefined();
    expect(decode('{"t":"number","v":null}', like({ type: 'number', v: 0, unit: '' }))).toBeUndefined();
  });
  it('never turns stored text into CSS syntax', () => {
    const kw: Typed = { type: 'value', v: 'light' };
    expect(decode('{"t":"value","v":"dark"}', kw)).toEqual({ type: 'value', v: 'dark' });
    expect(decode('{"t":"value","v":"url(https://x.test/a)"}', kw)).toBeUndefined();
    expect(decode('{"t":"value","v":"red; background: red"}', kw)).toBeUndefined();
    expect(decode('{"t":"dimension","v":1,"u":"px;x"}', { type: 'dimension', v: 0, unit: 'px' })).toBeUndefined();
  });
});

describe('compilation', () => {
  it('one slot property per (trigger, state): the cascade picks the winner', () => {
    const c = compile('.b:on(click) { --count: increment(1) } .p.b:on(click) { --count: increment(2) } .b:on(click) { --other: toggle() }');
    const slots = [...c.css.matchAll(/(--rcss-o\w+): (\d+)/g)].map((m) => m[1]);
    expect(slots[0]).toBe(slots[1]);
    expect(slots[2]).not.toBe(slots[0]);
    expect(c.rules.map((r) => r.onSpec!.slots[0].m.op)).toEqual(['increment', 'increment', 'toggle']);
    expect(diagnostics).toEqual([]);
  });
  it('modifier-only rules keep their (empty) block meaning', () => {
    const c = compile('a.x:on(click, prevent()) {}');
    expect(c.css).toMatch(/^a\.x:is\(\*\) \{ --rcss-o\w+: \d+;\}$/);
    expect(c.rules[0].onSpec!.mods).toEqual({ prevent: true, stop: false });
  });
  it('the last declaration of a state in one rule wins, as in CSS', () => {
    const c = compile('.b:on(click) { --n: set(1); --n: set(2) }');
    expect(c.rules[0].onSpec!.slots).toHaveLength(1);
    expect(c.rules[0].onSpec!.slots[0].m.expr).toEqual({ k: 'lit', t: { type: 'number', v: 2, unit: '' } });
  });
  it('rejects misplaced and mixed event rules, leaving them for the browser to drop', () => {
    for (const [css, re] of [
      ['.a:on(click), .b { --x: toggle() }', /every selector of the rule must use :on\(\)/],
      ['.a:on(click) .b { --x: toggle() }', /subject of the selector/],
      [':not(.a:on(click)) { --x: toggle() }', /cannot be inside :not\(\)/],
      ['.a:on(click):on(input) { --x: toggle() }', /one :on\(\) per selector/],
      ['.a:on(click), .b:on(input) { --x: toggle() }', /same trigger and modifiers/],
      ['.a:on(click, prevent()), .b:on(click) { --x: toggle() }', /same trigger and modifiers/],
    ] as const) {
      diagnostics.length = 0;
      expect(compile(css).css, css).toBe(css);
      expect(diagnostics.join('\n'), css).toMatch(re);
    }
  });
  it('drops style declarations, --attr-* and nested rules inside :on() with a reason', () => {
    const c = compile('.a:on(click) { color: red; --attr-hidden: true; --x: toggle(); @media (x) { --y: toggle() } & .b { --z: toggle() } }');
    expect(c.css).not.toMatch(/color|attr-hidden|@media|\.b/);
    expect(diagnostics.join('\n')).toMatch(/"color" is not one/);
    expect(diagnostics.join('\n')).toMatch(/nested rules and at-rules are not supported/);
  });
  it('untrusted sheets: event rules are dropped, never compiled', () => {
    const c = compile('.a:on(click) { --x: toggle() } .c { --n: state(0) }', { trusted: false });
    expect(c.css).not.toMatch(/:on|rcss-o/);
    expect(c.rules.some((r) => r.onSpec)).toBe(false);
  });
  it('focus: when() is the focus request; :focus stays native; a functional :focus() is reported', () => {
    const c = compile('.dialog input { focus: when(--open and not --busy) } .x:focus { color: red } .y:focus-visible { color: blue }');
    expect(c.rules[0].focus).toBe(true);
    expect(c.css).toMatch(/^\.dialog input \{ --rcss-focus: /);
    expect(c.css).toContain('.x:focus { color: red } .y:focus-visible { color: blue }');
    expect(diagnostics).toEqual([]);
    expect(compile('.x:focus(when(--open)) {}').css).toBe('.x:focus(when(--open)) {}');
    expect(diagnostics.join('\n')).toMatch(/:focus\(\) takes no arguments; to move focus when a condition becomes true, write focus: when\(condition\)/);
  });
  it(':blur compiles to its marker; :blur(when()) does not exist', () => {
    expect(compile('input:blur { animation: shake 1s }').css).toBe('input[data-rcss-blur] { animation: shake 1s }');
    compile('input:blur(when(--x)) {}');
    expect(diagnostics.join('\n')).toMatch(/:blur takes no arguments/);
  });
  it('--attr-* is the only custom-property namespace with DOM semantics', () => {
    const c = compile('.b { --attr-aria-expanded: var(--open); --aria-expanded: true; --disabled: true; --hidden: false }');
    expect(c.css).toBe('.b { --rcss-attr-aria-expanded: var(--open); --aria-expanded: true; --disabled: true; --hidden: false }');
    expect(c.rules[0].attrs).toEqual(['aria-expanded']);
    for (const [decl, re] of [['--attr-onclick: "x"', /only aria-expanded/], ['--attr-href: "x"', /only aria-expanded/], ['--attr-style: "x"', /only/],
      ['--attr-Data-x: 1', /lower case/], ['--attr-data-x: url(a)', /url\(\) is not supported/], ['--attr-x: state(1)', /reserved namespace/]] as const) {
      diagnostics.length = 0;
      compile(`.b { ${decl} }`);
      expect(diagnostics.join('\n'), decl).toMatch(re);
    }
  });
  it('the 0.9 allowlist additions: ARIA states, tristate, numbers and text', () => {
    const c = compile('.b { --attr-aria-hidden: true; --attr-aria-busy: var(--b); --attr-aria-checked: mixed; --attr-aria-valuenow: var(--n); --attr-aria-label: "Close"; --attr-aria-valuetext: "3 of 5"; --attr-aria-invalid: false }');
    expect(c.rules[0].attrs).toEqual(['aria-hidden', 'aria-busy', 'aria-checked', 'aria-valuenow', 'aria-label', 'aria-valuetext', 'aria-invalid']);
    expect(diagnostics).toEqual([]);
    compile('.b { --v: state(0, bind(aria-valuenow)); --c: state(false, bind(aria-checked)) } .x { --v: state("a", bind(aria-valuenow)) }');
    expect(diagnostics.join('\n')).toMatch(/bind\(aria-valuenow\) needs a number state/);
    for (const name of ['aria-describedby', 'aria-owns', 'aria-controls', 'role', 'onclick', 'srcdoc']) {
      diagnostics.length = 0;
      compile(`.b { --attr-${name}: "x" }`);
      expect(diagnostics.join('\n'), name).toMatch(/can be written/);
    }
  });
  it('content: only state-reading values on elements become DOM text; everything else stays native', () => {
    const c = compile('.v { content: var(--n) } .w { content: when(--on, "On", "Off") !important }');
    expect(c.css).toMatch(/^\.v \{ content: var\(--n\) ; --rcss-text: var\(--n\)\}/);
    expect(c.css).toMatch(/--rcss-text: .+ !important/);
    for (const css of ['.a::before { content: var(--n) }', '.a { content: "x" }', '.a { content: url(a.png) }', '.a { content: var(--img), url(b.png) }',
      '.a { content: attr(title) var(--n) }', 'li::marker { content: var(--n) }', '.a { content: counter(x) }'])
      expect(compile(css).css, css).toBe(css);
  });
  it('state() modifiers: bind(value | checked), persist(), in any order, once each', () => {
    const c = compile('input { --q: state("", persist("q", session), bind(value)) } .t { --on: state(false, bind(aria-pressed), persist("t")) }');
    expect(c.rules[0].forms).toEqual(['--q']);
    expect(c.rules[0].states[0].persist).toEqual({ key: 'q', session: true });
    expect(c.rules[1].states[0].bind).toEqual({ name: 'aria-pressed', kind: 'aria-boolean' });
    expect(c.rules[1].states[0].persist).toEqual({ key: 't', session: false });
    for (const [decl, re] of [
      ['state(bind(aria-expanded))', /needs an initial value first/],
      ['state(1, persist(theme))', /expected persist\("key"\)/],
      ['state(1, persist("a b"))', /expected persist\("key"\)/],
      ['state(1, persist("a"), persist("b"))', /given twice/],
      ['state(1, bind(value), bind(hidden))', /given twice/],
      ['state(1, bind(checked))', /bind\(checked\) needs a boolean/],
      ['state(true, bind(value))', /bind\(value\) needs a string or number/],
      ['state(1, other(2))', /neither bind\(\) nor persist\(\)/],
    ] as const) {
      diagnostics.length = 0;
      compile(`input { --x: ${decl} }`);
      expect(diagnostics.join('\n'), decl).toMatch(re);
    }
    diagnostics.length = 0;
    compile('input:hover { --x: state("", bind(value)) }');
    expect(diagnostics.join('\n')).toMatch(/must be in an unconditional rule/);
  });
  it('typed attr() fallbacks initialize from attributes once', () => {
    const c = compile('.b { --open: state(attr(aria-expanded, false)) }');
    expect(c.rules[0].states[0].init).toEqual({ k: 'attr', name: 'aria-expanded', fallback: { type: 'boolean', v: false } });
  });
  it('the pre-filter sees the new syntax and nothing else', () => {
    for (const css of ['.a:on(click){}', '.a:focus(when(--x)){}', '.a{--attr-hidden:1}', '.a{content: var(--x)}', 'a:blur{}', '.a{focus: when(--x)}'])
      expect(hasReactiveSyntax(css), css).toBe(true);
    for (const css of ['.a::before{content:"x"}', '.a:focus{color:red}', '.a{--attribute:1}', '.a{content: counter(x)}'])
      expect(hasReactiveSyntax(css), css).toBe(false);
  });
});

describe('feature analysis', () => {
  it('maps the new usage keys to their features (exact keys before wildcards)', () => {
    expect(featureOfKey('sel:on')).toBe('events');
    expect(featureOfKey('trigger:pointermove')).toBe('events');
    expect(featureOfKey('mod:stop')).toBe('events');
    expect(featureOfKey('gesture:drag')).toBe('gestures');
    expect(featureOfKey('decl:state-persist')).toBe('persist');
    expect(featureOfKey('decl:state-form')).toBe('forms');
    expect(featureOfKey('decl:attr-ns')).toBe('attributes');
    expect(featureOfKey('decl:content')).toBe('text');
    expect(featureOfKey('decl:focus')).toBe('focus');
    expect(featureOfKey('sel:blur')).toBe('blur');
  });
  it('analyze() finds the minimal feature set of 0.9 CSS', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rcss-v090-'));
    const cases: [string, string[]][] = [
      ['.b { --n: state(0) } .b:on(click) { --n: increment(1) }', ['events']],
      ['input { --name: state("", bind(value)) }', ['forms']],
      ['.c { --x: state(0px) } .c:on(drag) { --x: set(event(x)) }', ['events', 'gestures']],
      ['.t { --dark: state(false, persist("theme")) }', ['persist']],
      ['input:blur { animation: shake 250ms }', ['blur']],
      ['.d input { focus: when(--open) }', ['conditions', 'events', 'focus']],
      ['.v { content: var(--n) } .b { --attr-hidden: var(--h) }', ['attributes', 'text']],
    ];
    for (const [css, features] of cases) {
      writeFileSync(join(dir, 'a.css'), css);
      const r = await analyze([join(dir, 'a.css')]);
      expect(r.features.filter((f: string) => f !== 'core').sort(), css).toEqual(features);
    }
  });
  it('analyze() lists legacy 0.8 declarations with their 0.9 form (info, not an error)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rcss-v090-'));
    writeFileSync(join(dir, 'a.css'), '.b { --n: state(0); on: click(increment(--n)); text: var(--n); attr: hidden var(--n); }');
    const r = await analyze([join(dir, 'a.css')]);
    expect(r.files[0].legacy.map((l: { syntax: string }) => l.syntax)).toEqual(['attr:', 'on:', 'text:']);
    expect(r.files[0].legacy[1].use).toBe('.x:on(event) { --state: action() }');
    expect(r.complete).toBe(true);
  });
  it('left-out features are physically absent from custom bundles', async () => {
    // @ts-expect-error: plain ESM tooling, no type declarations
    const { build } = await import('../../tools/bundle.mjs');
    const code = async (features: string[]) => (await build({ features, minify: true })).code as string;
    const events = await code(['events']);
    expect(events).not.toMatch(/setPointerCapture|lostpointercapture/); // gestures
    expect(events).not.toMatch(/localStorage|sessionStorage|rcss:/); // persist
    expect(events).not.toMatch(/data-rcss-blur/); // blur
    expect(events).toMatch(/registerProperty/);
    const all = await code(['gestures', 'persist', 'blur']);
    expect(all).toMatch(/setPointerCapture/);
    expect(all).toMatch(/localStorage/);
    expect(all).toMatch(/data-rcss-blur/);
    const core = await code([]);
    expect(core).not.toMatch(/composedPath|setPointerCapture|localStorage/); // no event dispatcher without events
  });
  it('profiles resolve, and gestures pulls events', () => {
    expect(resolve({ features: ['gestures'] }).features).toEqual(['core', 'events', 'gestures']);
    expect(resolve('interactive').errors).toEqual([]);
  });
});
