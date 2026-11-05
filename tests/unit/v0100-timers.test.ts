// 0.10 step 7 (timers): :on(after(delay)) and :on(every(interval [, first delay])): trigger
// parsing, the rule's exact selector, and the rules the runtime cannot follow.
import { describe, it, expect, beforeEach } from 'vitest';
import { compile, diagnostics } from '../../src/index';
import { compileTrigger } from '../../src/state/on';
import type { ReactiveRule } from '../../src/core/parser';

const err = (fn: () => unknown) => { try { fn(); return ''; } catch (e) { return (e as Error).message; } };
const trig = (t: string) => compileTrigger(t).trigger;
const onRules = (css: string) => (compile(css).rules as ReactiveRule[]).filter((r) => r.onSpec);

beforeEach(() => { diagnostics.length = 0; });

describe('compileTrigger: after() and every()', () => {
  it('times in ms and s; every() defaults its first delay to one interval', () => {
    expect(trig('after(3s)')).toEqual({ key: 'after(3000ms)', dom: 'after', category: 'none', cancelable: false, timer: { first: 3000 } });
    expect(trig('every(1s)').timer).toEqual({ first: 1000, every: 1000 });
    expect(trig('EVERY( 80ms , .4s )')).toMatchObject({ key: 'every(80ms, 400ms)', timer: { first: 400, every: 80 } });
    expect(trig('every(80ms, 0ms)').timer).toEqual({ first: 0, every: 80 });
  });
  it('every() below 20ms is raised, with one diagnostic', () => {
    expect(trig('every(5ms)').timer).toEqual({ first: 20, every: 20 });
    expect(diagnostics.join('\n')).toMatch(/every\(5ms\) is below the 20ms minimum; using 20ms/);
  });
  it('mistakes', () => {
    expect(err(() => trig('after(3)'))).toBe('after() takes a time like 300ms or 2s, got "3"');
    expect(err(() => trig('after()'))).toBe('expected after(delay), e.g. after(3s)');
    expect(err(() => trig('after(1s, 2s)'))).toBe('expected after(delay), e.g. after(3s)');
    expect(err(() => trig('every(1s, 2s, 3s)'))).toBe('expected every(interval) or every(interval, first delay), e.g. every(80ms, 400ms)');
    expect(err(() => trig('every(fast)'))).toBe('every() takes a time like 300ms or 2s, got "fast"');
    expect(err(() => trig('every(1s, soon)'))).toBe('the first delay of every() takes a time like 300ms or 2s, got "soon"');
    expect(err(() => compileTrigger('after(1s), prevent()'))).toBe('after(1000ms) takes no modifiers (prevent(), stop(), debounce() and throttle() are for DOM events)');
    expect(err(() => compileTrigger('every(1s), debounce(1s)'))).toBe('every(1000ms, 1000ms) takes no modifiers (prevent(), stop(), debounce() and throttle() are for DOM events)');
    expect(err(() => trig('click | after(1s)'))).toBe('after(1000ms) cannot be combined with other events in one :on(); write one rule for it');
    expect(err(() => trig('after'))).toMatch(/^unknown event "after"/); // without a time: not a timer
  });
});

describe('the exact selector: the rule is active while its element matches all of it', () => {
  it(':when() becomes its marker, :on() becomes :is(*), nesting is resolved', () => {
    const [r] = onRules('.t { --v: state(false) } .t:when(--v):on(after(3s)) { --v: set(false) }');
    expect(r.onSpec!.exact).toMatch(/^\.t\[data-rcss-[\w-]+\]:is\(\*\)$/);
    const [n] = onRules('.w { --n: state(0); .tick.on[data-run]:on(every(100ms)) { --n: increment(1) } }');
    expect(n.onSpec!.exact).toBe(':is(.w) .tick.on[data-run]:is(*)');
    expect(diagnostics).toEqual([]);
  });
  it('event rules have no exact selector', () => {
    const [r] = onRules('.t { --n: state(0) } .t:when(--n > 1):on(click) { --n: set(0) }');
    expect(r.onSpec!.exact).toBeUndefined();
  });
  it('usage keys for the bundle analysis', () => {
    const c = compile('.t { --n: state(0) } .t:on(after(1s)) { --n: set(1) } .t:on(every(1s)) { --n: increment(1) }');
    expect([...c.uses].filter((u) => u.startsWith('trigger:')).sort()).toEqual(['trigger:after', 'trigger:every']);
  });
});

describe('rules the runtime cannot follow are dropped with a reason', () => {
  it('stateful pseudo-classes', () => {
    const c = compile('.a { --n: state(0) } .a:hover:on(after(1s)) { --n: increment(1) } .a input:checked:on(every(1s)) { --n: increment(1) }');
    const d = diagnostics.join('\n');
    expect(d).toMatch(/not on :hover; use a state, e\.g\. :when\(--open\) in "\.a:hover:on\(after\(1s\)\)"\. Rule dropped\./);
    expect(d).toMatch(/not on :checked; use a state/);
    expect(c.css).not.toContain('hover');
    expect(c.css).not.toContain('checked');
  });
  it('nested inside a rule with a state condition', () => {
    compile('.a { --n: state(0); --x: state(false) } .a:when(--x) { .b:on(every(1s)) { --n: increment(1) } }');
    expect(diagnostics.join('\n')).toMatch(/cannot be nested inside a rule with a state condition; write the full selector/);
  });
  it('event() has no event in a timer run', () => {
    compile('.a { --n: state("") } .a:on(after(1s)) { --n: set(event(type)) }');
    expect(diagnostics.join('\n')).toMatch(/event\(type\) is only available in :on\(\) actions; after\(1000ms\) has no event/);
  });
  it('a dropped rule leaves the rest of the sheet intact (its selector edits are removed too)', () => {
    const c = compile('.a { --n: state(0); --x: state(true) } .a:when(--x):hover:on(after(1s)) { --n: increment(1) } .a b { text: var(--n) } .a:when(--x) i { color: red }');
    expect(diagnostics).toHaveLength(1);
    expect(c.css).toContain('--rcss-text');
    expect(c.css).toMatch(/\.a\[data-rcss-[\w-]+\] i \{ color: red \}/);
    expect(c.css).not.toContain(':when(');
  });
});
