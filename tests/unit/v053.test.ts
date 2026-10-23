// 0.5.3: attr: <attribute> <value>.
import { describe, it, expect, beforeEach } from 'vitest';
import { compile, diagnostics, describe as info } from '../../src/index';

beforeEach(() => { diagnostics.length = 0; });

describe('attr: declaration', () => {
  it('compiles to one property per attribute, in place, keeping !important and the value', () => {
    const c = compile(`.a { attr: disabled when(--n >= 4); attr: aria-expanded var(--open); color: red } .b { ATTR: Data-State "x" !important }`);
    expect(c.css).toMatch(/\.a \{ --rcss-attr-disabled: var\(--rcss-[0-9a-z]+\); --rcss-attr-aria-expanded: var\(--open\); color: red \}/);
    expect(c.css).toContain(`.b { --rcss-attr-data-state: "x" !important }`);
    expect(c.rules.map((r) => r.attrs)).toEqual([['disabled', 'aria-expanded'], ['data-state']]);
    expect(c.rules[0].decls).toHaveLength(1); // when() is a binding like anywhere else
    expect(diagnostics).toEqual([]);
  });

  it('the same attribute twice in a rule is listed once (CSS keeps the last declaration)', () => {
    const c = compile(`.a { attr: data-x "1"; attr: data-x "2" }`);
    expect(c.rules[0].attrs).toEqual(['data-x']);
  });

  it('rejects unknown and unsafe attributes, missing values, other functions, untrusted sheets', () => {
    compile(`.a { attr: onclick "x" } .b { attr: href "x" } .c { attr: disabled } .d { attr: "disabled" true } .e { attr: data-u url(x) } .f { attr: hidden calc(1) }`);
    const d = diagnostics.join('\n');
    expect(d).toMatch(/"onclick" is not one of them/);
    expect(d).toMatch(/"href" is not one of them/);
    expect(d).toMatch(/attr: disabled needs a value/);
    expect(d).toMatch(/attr: starts with the attribute to write/);
    expect(d).toMatch(/calc\(\) is not supported/);
    diagnostics.length = 0;
    const u = compile(`.a { attr: disabled true }`, { trusted: false });
    expect(u.rules).toEqual([]);
    expect(diagnostics.join('\n')).toMatch(/attr: is ignored in untrusted stylesheets/);
  });

  it('when(condition) without branches is a boolean', () => {
    const c = compile(`.a { --x: when(--n > 1) }`);
    expect(c.rules[0].decls).toHaveLength(1);
    expect(diagnostics).toEqual([]);
  });

  it('is in the feature registry as an experimental declaration', () => {
    const f = info().features.find((x: any) => x.name === 'attr' && x.kind === 'declaration')!;
    expect([f.status, f.since]).toEqual(['experimental', '0.5.3']);
  });
});

describe('0.6.0: focus: and new attributes', () => {
  it('focus: compiles to --rcss-focus; when() becomes a binding; untrusted sheets refuse it', () => {
    const c = compile(`.a h2 { focus: when(--step == 2) } .b { focus: true !important }`);
    expect(c.css).toMatch(/\.a h2 \{ --rcss-focus: var\(--rcss-[0-9a-z]+\) \}/);
    expect(c.css).toContain('.b { --rcss-focus: true !important }');
    expect(c.rules.map((r) => r.focus)).toEqual([true, true]);
    expect(diagnostics).toEqual([]);
    compile(`.c { focus: calc(1) }`);
    expect(diagnostics.join('\n')).toMatch(/calc\(\) is not supported/);
    diagnostics.length = 0;
    expect(compile(`.d { focus: true }`, { trusted: false }).rules).toEqual([]);
    expect(diagnostics.join('\n')).toMatch(/focus: is ignored in untrusted stylesheets/);
  });

  it('aria-disabled and tabindex are allowlisted; tabindex binds only number states', () => {
    expect(compile(`.a { attr: aria-disabled var(--x); attr: tabindex "-1" }`).rules[0].attrs).toEqual(['aria-disabled', 'tabindex']);
    expect(diagnostics).toEqual([]);
    compile(`.b { --t: state(0, bind(tabindex)) } .c { --t: state(false, bind(tabindex)) } .d { --o: state(false, bind(aria-disabled)) }`);
    expect(diagnostics.join('\n')).toMatch(/bind\(tabindex\) needs a number state/);
    expect(diagnostics).toHaveLength(1);
  });

  it('focus is an experimental declaration since 0.6.0', () => {
    const f = info().features.find((x: any) => x.name === 'focus' && x.kind === 'declaration')!;
    expect([f.status, f.since]).toEqual(['experimental', '0.6.0']);
  });
});

describe('0.7.0: prevent()', () => {
  it('compiles in click() and key(); marks the handler set as cancelling', () => {
    const c = compile(`.t { on: key(ArrowRight, prevent(), toggle(--x)), click(prevent()) }`);
    expect(diagnostics).toEqual([]);
    const set = c.handlers.get(c.rules[0].handler!)!;
    expect(set.get('keydown')![0].actions.map((a) => a.def.name)).toEqual(['prevent', 'toggle']);
    expect(set.get('click')![0].actions[0].def.cancels).toBe(true);
  });

  it('rejects other triggers, outside(), reset and arguments; the whole declaration is left unchanged', () => {
    for (const [css, msg] of [
      ['.a { on: input(prevent()) }', /input events are not cancelable/],
      ['.a { on: pointerenter(prevent()) }', /pointerenter events are not cancelable/],
      ['.a { on: animationend(prevent()) }', /animationend events are not cancelable/],
      ['.a { on: reset(prevent()) }', /restored by bind: after a reset/],
      ['.a { on: outside(click, prevent()) }', /not allowed in outside\(\)/],
      ['.a { on: click(prevent(now)) }', /takes no arguments/],
    ] as const) {
      diagnostics.length = 0;
      const c = compile(css);
      expect(diagnostics.join('\n'), css).toMatch(msg);
      expect(c.rules, css).toEqual([]);
    }
  });

  it('is an experimental action since 0.7.0', () => {
    const f = info().features.find((x: any) => x.name === 'prevent' && x.kind === 'action')!;
    expect([f.status, f.since, f.syntax]).toEqual(['experimental', '0.7.0', 'prevent()']);
  });
});
