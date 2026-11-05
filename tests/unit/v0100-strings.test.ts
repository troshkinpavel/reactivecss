// 0.10 step 4 (strings): length(), includes(), lower(), trim(), through the expression hook, in
// :on() actions, conditions and declarations. Conditions and actions without them are unchanged.
import { describe, it, expect, beforeEach } from 'vitest';
import { compile, diagnostics } from '../../src/index';
import { parseCondition, evaluate, conditionCalls, serialize, type Typed, type Lookup } from '../../src/state/values';
import { parseAction, value, type Category } from '../../src/state/actexpr';
import { graphemes } from '../../src/functions/strings';

const err = (fn: () => unknown) => { try { fn(); return ''; } catch (e) { return (e as Error).message; } };
const run = (expr: string, category: Category = 'other') => value(parseAction(expr, category, ':on(click)'), { e: new Event('click'), el: {} as Element });
const out = (expr: string) => serialize(run(expr)!);
/** A condition with literal operands only (no element or state needed). */
const cond = (text: string) => {
  const c = parseCondition(text);
  const lookup: Lookup = () => undefined;
  lookup.fn = (node) => conditionCalls.evaluate!(node, {} as Element);
  return evaluate(c.ast, lookup);
};

beforeEach(() => { diagnostics.length = 0; });

describe('Unicode rules', () => {
  it('length() counts grapheme clusters', () => {
    expect(graphemes('')).toBe(0);
    expect(graphemes('abc')).toBe(3);
    expect(graphemes('é')).toBe(1); // é, one code point
    expect(graphemes('é')).toBe(1); // e + combining acute
    expect(graphemes('👍🏽')).toBe(1); // emoji + skin tone
    expect(graphemes('👨‍👩‍👧')).toBe(1); // ZWJ family
    expect(graphemes('🇯🇵a')).toBe(2); // flag + letter
    expect(out('length("héllo 👍🏽")')).toBe('7');
  });
  it('includes(): NFC-normalized, case-sensitive, no accent folding, empty part found', () => {
    expect(out('includes("café", "fé")')).toBe('1'); // composed vs decomposed é
    expect(out('includes("Hello", "hello")')).toBe('0');
    expect(out('includes("âne", "ane")')).toBe('0');
    expect(out('includes("abc", "")')).toBe('1');
    expect(out('includes(abc, b)')).toBe('1'); // keywords are text
  });
  it('lower(): default Unicode lower-casing; trim(): Unicode white space', () => {
    expect(out('lower("ÀÉÎ ΣΑ Straße")')).toBe('"àéî σα straße"');
    expect(out('lower("İ")')).toBe('"i̇"'); // no Turkish rules: i + combining dot
    expect(out('trim("   a b \t　")')).toBe('"a b"'); // NBSP, em space, tab, ideographic space
    expect(out('trim("")')).toBe('""');
  });
});

describe('actions', () => {
  it('compose with each other and with the 0.9 expression language', () => {
    expect(out('length(trim("  ab  ")) * 2px')).toBe('4px');
    expect(out('lower(trim(" X "))')).toBe('"x"');
    expect(out('includes(lower("ABC"), lower("b")) + 1')).toBe('2');
  });
  it('arguments must be text; never converted', () => {
    expect(err(() => run('length(42)'))).toBe('length() takes text, not 42 (number)');
    expect(err(() => run('lower(3px)'))).toBe('lower() takes text, not 3px (dimension)');
    expect(err(() => run('includes("a", true)'))).toBe('includes() takes text, not 1 (boolean)'); // booleans serialize as 1 / 0, as in 0.9
  });
  it('arity', () => {
    const parse = (t: string) => err(() => parseAction(t, 'other', ':on(click)'));
    expect(parse('length()')).toBe('length() takes 1 argument, got 0');
    expect(parse('trim("a", "b")')).toBe('trim() takes 1 argument, got 2');
    expect(parse('includes("a")')).toBe('includes() takes 2 arguments, got 1');
  });
  it('--name reads a state inside a value function; elsewhere the 0.9 var() rule is unchanged', () => {
    const parse = (t: string) => err(() => parseAction(t, 'form', ':on(input)'));
    expect(parse('length(--value)')).toBe('');
    expect(parse('length(var(--value))')).toBe('');
    expect(parse('includes(lower(attr(data-name)), lower(--q))')).toBe('');
    expect(parse('min(--a, 3)')).toBe('write var(--a) to read a state');
    expect(parse('length(--v) + --w')).toBe('write var(--w) to read a state');
    expect(parse('trim(event(value))')).toBe('');
  });
});

describe('conditions: call operands', () => {
  it('parse: the call is one operand; its states are listed', () => {
    const c = parseCondition('includes(lower(attr(data-name)), lower(--q)) and length(var(--v)) > 3 or --open');
    expect(c.names.sort()).toEqual(['--open', '--q', '--v']);
    expect(c.calls!.sort()).toEqual(['--q', '--v']);
    expect(c.text).toBe('includes(lower(attr(data-name)), lower(--q)) and length(var(--v)) > 3 or --open');
  });
  it('evaluate', () => {
    expect(cond('length("abcd") > 3')).toBe(true);
    expect(cond('includes("abc", "z")')).toBe(false);
    expect(cond('not includes("abc", "z") and lower("A") == "a"')).toBe(true);
    expect(cond('length(trim("  a  ")) = = 1')).toBe(true); // with step 1's spaced operators
  });
  it('a type error inside a call: a ConditionError (the condition is unknown, one diagnostic)', () => {
    expect(err(() => cond('length(5) > 1'))).toBe('length() takes text, not 5 (number)');
    expect(err(() => cond('length("ab")'))).toBe('length("ab") is 2, not a boolean; compare it explicitly (for example length("ab") != 0)');
  });
  it('parse errors name the call and the whole condition', () => {
    expect(err(() => parseCondition('length(--a, --b) > 1'))).toBe('condition "length(--a, --b) > 1": length(--a, --b): length() takes 1 argument, got 2');
    expect(err(() => parseCondition('length(event(value)) > 1'))).toBe('condition "length(event(value)) > 1": length(event(value)): event(value) is only available in :on() actions; :when() has no event');
    expect(err(() => parseCondition('length(--a > 1'))).toBe('condition "length(--a > 1": missing ")"');
    expect(err(() => parseCondition('length(--a) ? 1'))).toBe('cannot read condition "length(--a) ? 1" near "? 1"');
  });
  it('names inside strings and longer words are not calls; 0.9.1 conditions keep their shape', () => {
    expect(cond('"length(x)" == "length(x)"')).toBe(true);
    expect(err(() => parseCondition('--a == xlength(1)'))).toBe('condition "--a == xlength(1)": unexpected "("'); // the 0.9.1 message
    expect(Object.keys(parseCondition('--a >= 1 and --b'))).toEqual(['ast', 'names', 'text']);
  });
});

describe('compile()', () => {
  it('declarations: text:, custom properties and attributes accept the value functions', () => {
    const c = compile(`.f { --value: state(""); --clean: trim(--value); --attr-aria-label: lower(--value) }
      .f .count { text: length(trim(--value)) }`);
    expect(diagnostics).toEqual([]);
    expect(c.changed).toBe(true);
    expect([...c.uses].filter((u) => u.startsWith('fn:')).sort()).toEqual(['fn:length', 'fn:lower', 'fn:trim']);
  });
  it('other functions in text: are still refused', () => {
    compile('.f { --v: state("") } .f .c { text: upper(--v) }');
    expect(diagnostics.join('\n')).toMatch(/upper\(\) is not supported/);
  });
  it('a when() with a call compiles to a runtime binding (native if() is checked in the browser)', () => {
    const c = compile('.f { --v: state(""); --open: state(true) } .f .a { width: when(length(--v) > 3, 10px, 20px) } .f .b { width: when(--open, 1px, 2px) }');
    expect(diagnostics).toEqual([]);
    expect(c.rules.length).toBeGreaterThan(0);
    expect(c.css).not.toMatch(/length\(/); // the call is compiled away into a binding
  });
  it('errors in declarations and conditions are reported; the rest compiles', () => {
    compile(`.f { --v: state("") } .f .a { --n: length(--v, 2) } .f:when(includes(--v)) .b { color: red }
      .f .c { --ok: lower(--v) }`);
    const d = diagnostics.join('\n');
    expect(d).toMatch(/length\(\) takes 1 argument, got 2/);
    expect(d).toMatch(/includes\(\) takes 2 arguments, got 1/);
    expect(diagnostics).toHaveLength(2);
  });
});
