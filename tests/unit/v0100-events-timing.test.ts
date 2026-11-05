// 0.10 step 3 (events): debounce(time) and throttle(time) modifiers of :on().
import { describe, it, expect, beforeEach } from 'vitest';
import { compile, diagnostics } from '../../src/index';
import { compileTrigger } from '../../src/state/on';

const err = (fn: () => unknown) => { try { fn(); return ''; } catch (e) { return (e as Error).message; } };
const mods = (t: string) => compileTrigger(t).mods;

beforeEach(() => { diagnostics.length = 0; });

describe('compileTrigger: debounce() and throttle()', () => {
  it('times in ms and s, with other modifiers and groups', () => {
    expect(mods('input, debounce(300ms)')).toEqual({ prevent: false, stop: false, debounce: 300 });
    expect(mods('pointermove, throttle(.5s)')).toEqual({ prevent: false, stop: false, throttle: 500 });
    expect(mods('keydown(Enter), prevent(), DEBOUNCE( 2S ), stop()')).toEqual({ prevent: true, stop: true, debounce: 2000 });
    expect(mods('input | change, debounce(250ms)').debounce).toBe(250);
    expect(mods('scroll, throttle(16.5ms)').throttle).toBe(16.5);
  });
  it('without them, the 0.9.1 modifier object is unchanged', () => {
    expect(Object.keys(mods('click, prevent()'))).toEqual(['prevent', 'stop']);
  });
  it('invalid forms', () => {
    expect(err(() => mods('input, debounce(fast)'))).toBe('debounce() takes a time like 300ms or 2s, got "fast"');
    expect(err(() => mods('input, debounce(300)'))).toBe('debounce() takes a time like 300ms or 2s, got "300"');
    expect(err(() => mods('input, throttle()'))).toBe('throttle() takes a time like 300ms or 2s, got ""');
    expect(err(() => mods('input, throttle(-5ms)'))).toBe('throttle() takes a time like 300ms or 2s, got "-5ms"');
    expect(err(() => mods('input, debounce(0ms)'))).toBe('debounce() needs a time above 0');
    expect(err(() => mods('input, debounce(1s), debounce(2s)'))).toBe('debounce() is given twice');
    expect(err(() => mods('input, debounce(1s), throttle(1s)'))).toBe('use debounce() or throttle(), not both');
    expect(err(() => mods('outside(click), debounce(1s)'))).toBe('debounce() is for DOM events, not outside()');
    expect(err(() => mods('drag(move), throttle(50ms)'))).toBe('throttle() is for DOM events, not drag');
  });
  it('a bare debounce / throttle asks for a time; the 0.9.1 messages are unchanged', () => {
    expect(err(() => mods('click, debounce'))).toBe('debounce needs a time: debounce(300ms)');
    expect(err(() => mods('click, Throttle'))).toBe('throttle needs a time: throttle(300ms)');
    expect(err(() => mods('click, delay(1s)'))).toBe('unknown modifier "delay(1s)"; use prevent() or stop()');
    expect(err(() => mods('click, prevent'))).toBe('write the modifier as a function: prevent()');
    expect(err(() => mods('click, once'))).toMatch(/^once is not supported in :on\(\)/);
    expect(err(() => mods('click, stop(), stop()'))).toBe('stop() is given twice');
  });
});

describe('compile()', () => {
  it('records the modifier in uses', () => {
    const c = compile('.s { --q: state("") } .s input:on(input, debounce(300ms)) { --q: set(event(value)) }');
    expect(diagnostics).toEqual([]);
    expect([...c.uses].filter((u) => u.startsWith('mod:'))).toEqual(['mod:debounce']);
  });
  it('every selector of a rule must use the same delay', () => {
    compile('.s { --n: state(0) } .a:on(input, debounce(300ms)), .b:on(input, debounce(200ms)) { --n: increment(1) }');
    expect(diagnostics.join('\n')).toMatch(/every selector of an :on\(\) rule must use the same trigger and modifiers/);
    diagnostics.length = 0;
    compile('.s { --n: state(0) } .a:on(input, debounce(300ms)), .b:on(input, debounce(.3s)) { --n: increment(1) }');
    expect(diagnostics).toEqual([]); // the same time, written differently
  });
  it('an invalid modifier drops the rule; the rest of the sheet compiles', () => {
    const c = compile('.s { --n: state(0) } .s:on(input, debounce(soon)) { --n: increment(1) } .s:on(change) { --n: increment(1) }');
    expect(diagnostics.join('\n')).toMatch(/debounce\(\) takes a time like 300ms or 2s, got "soon"/);
    expect(c.rules.filter((r) => r.onSpec).map((r) => r.onSpec!.trigger.key)).toEqual(['change']);
  });
});
