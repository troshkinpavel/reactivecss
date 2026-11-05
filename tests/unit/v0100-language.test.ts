// 0.10 step 1 (language): whitespace inside comparison operators; hypot(), sqrt(), pow() in
// :on() actions. The 0.9.1 grammar, diagnostics and CSS output are otherwise unchanged.
import { describe, it, expect, beforeEach } from 'vitest';
import { compile, diagnostics } from '../../src/index';
import { parseCondition, evaluate, serialize, type Typed, type Lookup } from '../../src/state/values';
import { parseAction, value, EvalError, type Category } from '../../src/state/actexpr';

const num = (v: number): Typed => ({ type: 'number', v, unit: '' });
const dim = (v: number, unit: string): Typed => ({ type: 'dimension', v, unit });
const err = (fn: () => unknown) => { try { fn(); return ''; } catch (e) { return (e as Error).message; } };
const cond = (text: string, states: Record<string, Typed>) => {
  const lookup: Lookup = (n) => (states[n] ? { value: states[n], previous: states[n] } : undefined);
  return evaluate(parseCondition(text).ast, lookup);
};
/** Evaluates an action expression with no DOM access (literals and math only). */
const run = (expr: string, category: Category = 'other') => value(parseAction(expr, category, ':on(click)'), { e: new Event('click'), el: {} as Element });

beforeEach(() => { diagnostics.length = 0; });

describe('comparisons: whitespace inside two-character operators', () => {
  const forms: [string, string[]][] = [
    ['>=', ['> =', '>  =', '>\t=', '>\n=']],
    ['<=', ['< =', '<\t =']],
    ['==', ['= =']],
    ['!=', ['! =']],
  ];
  for (const [op, spaced] of forms) for (const s of spaced)
    it(`${JSON.stringify(s)} is ${op}`, () => {
      for (const v of [num(9), num(10), num(11), dim(10, 'px'), dim(1, 'cm')]) {
        const states = { '--count': v };
        const rhs = v.type === 'dimension' ? '10px' : '10';
        expect(cond(`--count ${s} ${rhs}`, states)).toBe(cond(`--count ${op} ${rhs}`, states));
      }
    });
  it('every spacing gives the same tokens', () => {
    const asts = ['--count>=10', '--count >= 10', '--count > = 10', '--count>= 10', '--count > =10', '--count\n>\n=\n10'].map((t) => JSON.stringify(parseCondition(t).ast));
    expect(new Set(asts).size).toBe(1);
  });
  it('works with and / or / not, parentheses, previous() and strings', () => {
    const states = { '--a': num(1), '--b': num(2), '--s': { type: 'string', v: 'a > = b' } as Typed };
    expect(cond('--a > = 1 and (--b < = 2 or not --a = = 0)', states)).toBe(true);
    expect(cond('previous(--a) ! = 2', states)).toBe(true);
    // Inside a string, "> =" is text, not an operator.
    expect(cond('--s == "a > = b"', states)).toBe(true);
    expect(cond('--s == "a >= b"', states)).toBe(false);
  });
  it('invalid comparisons keep their 0.9.1 diagnostics', () => {
    expect(err(() => parseCondition('--a = 10'))).toBe('cannot read condition "--a = 10" near "= 10"');
    expect(err(() => parseCondition('--a ! 10'))).toBe('cannot read condition "--a ! 10" near "! 10"');
    expect(err(() => parseCondition('--a >== 10'))).toBe('cannot read condition "--a >== 10" near "= 10"');
    expect(err(() => parseCondition('--a => 10'))).toBe('cannot read condition "--a => 10" near "=> 10"');
    expect(err(() => parseCondition('--a >> 10'))).toBe('condition "--a >> 10": unexpected ">"');
    expect(err(() => parseCondition('--a > = = 10'))).toBe('cannot read condition "--a > = = 10" near "= 10"');
  });
  it('compiles in :when() and when() without diagnostics; the CSS output keeps the author text elsewhere', () => {
    const c = compile(`.i { --count: state(0) } .i:when(--count > = 10) { color: red }
      .i { width: when(--count < = 3, 10px, 20px) } .j { content: "a > = b" }`);
    expect(diagnostics).toEqual([]);
    expect(c.css).toContain('content: "a > = b"');
  });
});

describe('hypot() in actions: values of one unit family, like min()', () => {
  it('numbers, dimensions and unit conversion', () => {
    expect(run('hypot(3px, 4px)')).toEqual(dim(5, 'px'));
    expect(run('hypot(3, 4)')).toEqual(num(5));
    expect(run('hypot(-3px)')).toEqual(dim(3, 'px'));
    expect(run('hypot(1in, 0px)')).toEqual(dim(1, 'in')); // the first dimension's unit
    expect(run('hypot(30px, 1in)')).toEqual(dim(100.578328, 'px')); // 1in = 96px; 6 decimals
    expect(run('hypot(1s, 500ms)')).toEqual(dim(1.118034, 's'));
    expect(run('hypot(0, 3px)')).toEqual(dim(3, 'px')); // a unitless 0 combines with any unit, as in CSS
    expect(run('hypot(3px, 4px, 12px)')).toEqual(dim(13, 'px'));
  });
  it('rejects mixed types, like CSS', () => {
    expect(() => run('hypot(3px, 4)')).toThrow(EvalError);
    expect(err(() => run('hypot(3px, 4)'))).toBe('cannot combine 3px and 4: a dimension and a number');
    expect(err(() => run('hypot(3px, 4%)'))).toBe('cannot combine 3px and 4%: incompatible units');
    expect(err(() => run('hypot(3px, 1s)'))).toBe('cannot combine 3px and 1s: incompatible units');
    expect(err(() => run('hypot("a")'))).toBe('"a" is not a number');
  });
});

describe('sqrt() and pow() in actions: numbers only, like CSS', () => {
  it('values', () => {
    expect(run('sqrt(16)')).toEqual(num(4));
    expect(run('sqrt(2)')).toEqual(num(1.414214));
    expect(run('sqrt(0)')).toEqual(num(0));
    expect(run('pow(2, 10)')).toEqual(num(1024));
    expect(run('pow(10, -2)')).toEqual(num(0.01));
    expect(run('pow(-2, 3)')).toEqual(num(-8));
    expect(run('pow(2, 0.5)')).toEqual(num(1.414214));
    expect(run('pow(sqrt(9), 2) + hypot(6, 8)')).toEqual(num(19)); // composes with the other operators
    expect(run('round(down, sqrt(10))')).toEqual(num(3));
  });
  it('rejects dimensions and results without a finite value', () => {
    expect(err(() => run('sqrt(4px)'))).toBe('sqrt() takes numbers, not 4px');
    expect(err(() => run('pow(2px, 2)'))).toBe('pow() takes numbers, not 2px');
    expect(err(() => run('pow(2, 1px)'))).toBe('pow() takes numbers, not 1px');
    expect(err(() => run('sqrt(-1)'))).toBe('sqrt(-1) has no finite value');
    expect(err(() => run('pow(-8, 0.5)'))).toBe('pow(-8, 0.5) has no finite value');
    expect(err(() => run('pow(0, -1)'))).toBe('pow(0, -1) has no finite value');
    expect(err(() => run('pow(10, 400)'))).toBe('pow(10, 400) has no finite value');
  });
  it('booleans count as 1 / 0, as everywhere in action arithmetic', () => {
    expect(run('sqrt(true)')).toEqual(num(1));
    expect(run('pow(false, 2)')).toEqual(num(0));
  });
});

describe('parse-time errors', () => {
  const parse = (t: string, c: Category = 'other') => err(() => parseAction(t, c, ':on(click)'));
  it('arity', () => {
    expect(parse('hypot()')).toBe('hypot() needs at least one value');
    expect(parse('sqrt()')).toBe('expected sqrt(number)');
    expect(parse('sqrt(1, 2)')).toBe('expected sqrt(number)');
    expect(parse('pow(2)')).toBe('expected pow(number, number)');
    expect(parse('pow(1, 2, 3)')).toBe('expected pow(number, number)');
  });
  it('the 0.9 var() rule is unchanged: a bare --name is not a value', () => {
    expect(parse('hypot(--dx, --dy)', 'pointer')).toBe('write var(--dx) to read a state');
    expect(parse('hypot(var(--dx), var(--dy))', 'pointer')).toBe('');
    expect(parse('hypot(event(client-x), event(client-y))', 'pointer')).toBe('');
  });
  it('other unknown functions still name the available ones', () => {
    expect(parse('log(2)')).toBe('log() is not available in actions; use calc(), min(), max(), clamp(), round(), abs(), hypot(), sqrt(), pow(), var(), event(), mouse(), element(), viewport(), attr(), pick(), random(), sibling-index(), sibling-count(), length(), includes(), lower() or trim()'); // step 4 adds the value functions
  });
  it('compile() reports them on the declaration and keeps the rest of the rule', () => {
    compile('.p { --d: state(0) } .p:on(click) { --d: set(sqrt()); } .p:on(dblclick) { --d: set(pow(2, 3)) }');
    // The declaration is dropped; the emptied rule gets the 0.9.1 "does nothing" note; dblclick is fine.
    expect(diagnostics).toEqual([
      'set() for --d in :on(click): expected sqrt(number): "--d: set(sqrt())" is dropped.',
      'the :on(click) rule ".p:on(click)" changes no state and has no modifier; it does nothing.',
    ]);
  });
});

describe('CSS output of results (formatting)', () => {
  it('values are kept to 6 decimals and written with at most 4, never in a form CSS cannot read', () => {
    expect(serialize(run('sqrt(2)')!)).toBe('1.4142');
    expect(serialize(run('pow(10, -5)')!)).toBe('0'); // below the written precision
    expect(serialize(run('pow(-1, 3) * 0')!)).toBe('0'); // no "-0"
    expect(serialize(run('hypot(30px, 1in)')!)).toBe('100.5783px');
    expect(serialize(run('pow(10, 20)')!)).toBe('100000000000000000000');
  });
  it('declarations: hypot(), sqrt(), pow() stay native CSS, untouched', () => {
    const c = compile('.n { width: calc(hypot(3px, 4px) * pow(2, 2) + sqrt(4) * 1px) }');
    expect(c.changed).toBe(false);
    expect(diagnostics).toEqual([]);
  });
});
