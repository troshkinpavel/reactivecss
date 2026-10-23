// 0.9.0 hardening: production diagnostic codes (tools/diagnostics.mjs).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error: plain ESM tooling, no type declarations
import { transform, explain, loadRegistry } from '../../tools/diagnostics.mjs';

const fresh = () => ({ version: 1, codes: {} as Record<string, { template: string; module: string }> });
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : []; });

describe('transform', () => {
  it('codes whole-argument messages and ternary branches; keeps values as arguments', () => {
    const reg = fresh();
    const src = 'warn(`${a} uses ${b}, but no element declares it`); throw new Error(x ? "this one is long enough" : `and so is ${y} this other one`);';
    const r = transform(src, 'state/state.ts', reg, { assign: true });
    expect(r.code).toBe('warn(`RCSS-S001⟦${a}⟧⟦${b}⟧`); throw new Error(x ? `RCSS-S002` : `RCSS-S003⟦${y}⟧`);');
    expect(reg.codes['RCSS-S001'].template).toBe('{0} uses {1}, but no element declares it');
  });
  it('leaves short keys, concatenations, other callees and non-message strings alone', () => {
    const src = [
      "throw new Error('feature:gestures');",
      "warn('first part of a message ' + name + ' second part of it');",
      "console.warn('a long console message that is not ours');",
      "const s = `${a} is a long template that is not a message`;",
      "x.warn('a method call with a long string inside');",
      "el.setAttribute('data-x', 'value with spaces that is long');",
    ].join('\n');
    const r = transform(src, 'core/parser.ts', fresh(), { assign: true });
    expect(r.code).toBe(src);
  });
  it('survives regular expressions, comments and nested templates that look like strings', () => {
    const src = [
      'const re = /`["\']/g; // warn(`not code in a comment`)',
      "/* warn('not code in a block comment either') */",
      'warn(`outer ${inner ? `nested ${deep} part` : "x"} message with spaces`);',
      'const d = a / b / c; warn("a message after a division operator");',
    ].join('\n');
    const reg = fresh();
    const r = transform(src, 'core/engine.ts', reg, { assign: true });
    expect(r.replaced).toBe(2);
    expect(r.code).toContain('/`["\']/g; // warn(`not code in a comment`)');
    expect(r.code).toContain('warn(`RCSS-R001⟦${inner ? `nested ${deep} part` : "x"}⟧`)');
    expect(r.code).toContain('warn(`RCSS-R002`)');
  });
  it('codes are stable: the same template keeps its code, new ones are appended per area', () => {
    const reg = fresh();
    transform('warn(`first message with ${x} inside`)', 'core/parser.ts', reg, { assign: true });
    transform('warn(`second message with ${y} inside`)', 'core/parser.ts', reg, { assign: true });
    const again = transform('note(`first message with ${z} inside`)', 'core/parser.ts', reg, { assign: false });
    expect(again.code).toBe('note(`RCSS-P001⟦${z}⟧`)');
    expect(Object.keys(reg.codes)).toEqual(['RCSS-P001', 'RCSS-P002']);
  });
  it('the checked-in registry is complete and its codes are unique', () => {
    const reg = loadRegistry();
    let unknown = 0, replaced = 0;
    for (const f of files('src')) {
      const rel = f.slice(4);
      if (rel === 'core/features.ts') continue;
      const r = transform(readFileSync(f, 'utf8'), rel, reg, { assign: false });
      unknown += r.unknown; replaced += r.replaced;
    }
    expect(unknown).toBe(0);
    expect(replaced).toBeGreaterThan(200);
    const templates = Object.values(reg.codes).map((e: any) => e.template);
    expect(new Set(templates).size).toBe(templates.length);
    for (const c of Object.keys(reg.codes)) expect(c).toMatch(/^RCSS-[PRSEGKFATCWVX]\d{3}$/);
  });
});

describe('explain', () => {
  const reg = { version: 1, codes: { 'RCSS-P001': { template: '{0} in "{1}". Declaration left unchanged.', module: 'core/parser.ts' }, 'RCSS-E001': { template: 'unknown event "{0}"; supported: {1}', module: 'state/on.ts' } } };
  it('expands codes, nested ones included, and keeps the rest of the text', () => {
    expect(explain('sheet.css: RCSS-P001⟦RCSS-E001⟦tap⟧⟦click, input⟧⟧⟦.a:on(tap)⟧', reg))
      .toBe('sheet.css: unknown event "tap"; supported: click, input in ".a:on(tap)". Declaration left unchanged.');
  });
  it('an unknown code stays visible with its values', () => {
    expect(explain('RCSS-Z999⟦x⟧', reg)).toBe('RCSS-Z999 (unknown code) [x]');
  });
});
