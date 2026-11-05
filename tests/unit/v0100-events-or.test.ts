// 0.10 step 2 (events): `a | b` in :on(), one rule for several DOM events. Each member gets its
// own slot properties, so the cascade picks a winner per event; single-event rules are unchanged.
import { describe, it, expect, beforeEach } from 'vitest';
import { compile, diagnostics } from '../../src/index';
import { compileTrigger, compileMutation, type Trigger } from '../../src/state/on';

const err = (fn: () => unknown) => { try { fn(); return ''; } catch (e) { return (e as Error).message; } };
const trig = (t: string) => compileTrigger(t).trigger;
const triggerKeys = (t: Trigger) => t.members?.map((m) => m.key) ?? [t.key];

beforeEach(() => { diagnostics.length = 0; });

describe('compileTrigger: groups', () => {
  it('members, key, category and cancelable', () => {
    const t = trig('pointerup | pointerleave | pointercancel');
    expect(t.key).toBe('pointerup|pointerleave|pointercancel');
    expect(triggerKeys(t)).toEqual(['pointerup', 'pointerleave', 'pointercancel']);
    expect(t.category).toBe('pointer'); // shared category: its event() fields
    expect(t.cancelable).toBe(false);
    const m = trig('click | keydown(Enter)');
    expect(m.members!.map((x) => [x.key, x.dom, x.category])).toEqual([['click', 'click', 'pointer'], ['keydown(enter)', 'keydown', 'keyboard']]);
    expect(m.category).toBe('other'); // mixed categories: only the common fields
    expect(m.cancelable).toBe(true);
  });
  it('spacing does not matter; a single event is not a group', () => {
    for (const s of ['click|keydown', 'click |keydown', 'click\n|\tkeydown']) expect(trig(s).key).toBe('click|keydown');
    const one = trig('click');
    expect(one.members).toBeUndefined();
    expect(triggerKeys(one)).toEqual(['click']);
    expect(Object.keys(one)).toEqual(Object.keys(compileTrigger('click').trigger)); // same object shape as 0.9.1
  });
  it('a key filter keeps its parentheses; same DOM event with two filters', () => {
    const t = trig('keydown(Enter) | keydown(Space)');
    expect(t.key).toBe('keydown(enter)|keydown(space)');
    expect(t.category).toBe('keyboard');
  });
  it('modifiers apply to the whole group', () => {
    expect(compileTrigger('click | keydown(Enter), prevent(), stop()').mods).toEqual({ prevent: true, stop: true });
  });
  it('invalid groups', () => {
    expect(err(() => trig('click |'))).toBe('an event is missing around "|" in "click |"');
    expect(err(() => trig('| click'))).toBe('an event is missing around "|" in "| click"');
    expect(err(() => trig('click || keydown'))).toBe('an event is missing around "|" in "click || keydown"');
    expect(err(() => trig('click | tap'))).toMatch(/^unknown event "tap"; supported: click, /);
    expect(err(() => trig('click | click'))).toBe('click is listed twice in :on(click | click)');
    expect(err(() => trig('keydown(Enter) | keydown(enter)'))).toBe('keydown(enter) is listed twice in :on(keydown(Enter) | keydown(enter))');
    expect(err(() => trig('outside(click) | keydown'))).toBe('outside(click) cannot be combined with other events in one :on(); write one rule for it');
    expect(err(() => trig('click | drag(end)'))).toBe('drag(end) cannot be combined with other events in one :on(); write one rule for it');
    expect(err(() => trig('click | input(x)'))).toBe('input takes no argument (key filters are for keydown(Key) and keyup(Key))');
    // prevent() names the member that cannot be cancelled.
    expect(err(() => compileTrigger('click | pointermove, prevent()'))).toBe('prevent() needs a cancelable event (click, dblclick, contextmenu, mousedown, pointerdown, keydown, keyup, submit, drag); pointermove is not');
  });
  it('0.9.1 single-trigger messages are unchanged', () => {
    expect(err(() => trig('tap'))).toMatch(/^unknown event "tap"; supported: /);
    expect(err(() => trig('click('))).toBe('cannot read the trigger "click("');
    expect(err(() => compileTrigger('pointermove, prevent()'))).toMatch(/; pointermove is not$/);
    expect(err(() => compileTrigger(''))).toBe(':on() needs an event, e.g. :on(click)');
  });
});

describe('actions in a group', () => {
  it('event() fields follow the group category', () => {
    expect(() => compileMutation('--x', 'set(event(client-x))', trig('pointerup | pointerleave'))).not.toThrow();
    expect(() => compileMutation('--x', 'set(event(type))', trig('click | keydown'))).not.toThrow();
    expect(err(() => compileMutation('--x', 'set(event(client-x))', trig('pointermove | keydown'))))
      .toMatch(/^set\(\) for --x in :on\(pointermove\|keydown\): event\(client-x\) is not available/);
  });
});

describe('compile(): one slot per member', () => {
  it('each member has its own slot properties, valued with the same mutation', () => {
    const c = compile('.b { --n: state(0) } .b:on(pointerup | pointerleave) { --n: increment(1) } .b:on(pointerup) { --n: increment(10) }');
    expect(diagnostics).toEqual([]);
    const [group, one] = c.rules.filter((r) => r.onSpec).map((r) => r.onSpec!);
    expect(group.slots.map((s) => s.key)).toEqual(['pointerup', 'pointerleave']);
    expect(new Set(group.slots.map((s) => s.m.id)).size).toBe(1);
    // The pointerup member shares its slot property with the single-event pointerup rule: one cascade per event.
    expect(group.slots[0].prop).toBe(one.slots[0].prop);
    expect(group.slots[1].prop).not.toBe(one.slots[0].prop);
    expect(one.slots.map((s) => s.key)).toEqual(['pointerup']);
    for (const s of group.slots) expect(c.css).toContain(`${s.prop}: ${s.m.id}`);
  });
  it('!important and the last declaration per state, per member', () => {
    const c = compile('.b { --n: state(0) } .b:on(click | keyup) { --n: increment(1); --n: increment(2) !important }');
    const spec = c.rules.find((r) => r.onSpec)!.onSpec!;
    expect(spec.slots).toHaveLength(2);
    expect(spec.slots.every((s) => s.m === spec.slots[0].m && s.m.expr)).toBe(true);
    for (const s of spec.slots) expect(c.css).toContain(`${s.prop}: ${s.m.id} !important`);
  });
  it('records every member event in uses (bundle analysis)', () => {
    const c = compile('.b { --n: state(0) } .b:on(input | change, stop()) { --n: increment(1) }');
    expect([...c.uses].filter((u) => /^(trigger|mod):/.test(u)).sort()).toEqual(['mod:stop', 'trigger:change', 'trigger:input']);
  });
  it('a selector list must use the same group', () => {
    compile('.b { --n: state(0) } .b:on(click | keyup), .c:on(keyup | click) { --n: increment(1) }');
    expect(diagnostics.join('\n')).toMatch(/every selector of an :on\(\) rule must use the same trigger and modifiers/);
  });
  it('invalid groups are reported on the rule; the rest of the sheet compiles', () => {
    const c = compile('.b { --n: state(0) } .b:on(click | click) { --n: increment(1) } .b:on(keyup) { --n: increment(1) }');
    expect(diagnostics.join('\n')).toMatch(/click is listed twice in :on\(click \| click\)/);
    expect(c.rules.filter((r) => r.onSpec).map((r) => r.onSpec!.trigger.key)).toEqual(['keyup']);
  });
});
