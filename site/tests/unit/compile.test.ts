// Every Reactive CSS snippet the site presents as working code must compile with the installed
// runtime (../dist, the same build the previews run) without a diagnostic.
import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '~/content/api/entries.json';
import { DEMOS } from '~/lib/content/demos';
import { STAGES } from '~/lib/content/vision';
import { INSTALL } from '~/lib/content/home';
import { highlightCss } from '~/lib/code/css';

const { compile } = await import(new URL('../../../dist/index.js', import.meta.url).href);
const reactive = (css: string) => highlightCss(css).flat().some((t) => t.k === 'rx');
let warnings: string[] = [];
beforeEach(() => { warnings = []; vi.spyOn(console, 'warn').mockImplementation((...a) => { warnings.push(a.join(' ')); }); });
afterEach(() => vi.restoreAllMocks());
const check = (label: string, css: string) => it(label, () => { compile(css); expect(warnings).toEqual([]); });

const docsDir = new URL('../../src/content/docs/', import.meta.url);
const mdx = readdirSync(docsDir, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.mdx'));
// Fenced CSS blocks.
const blocks = mdx.flatMap((f) => [...readFileSync(new URL(f, docsDir), 'utf8').matchAll(/```css[^\n]*\n([\s\S]*?)```/g)].map((m, i) => [`${f} #${i + 1}`, m[1]!] as const));

describe('the check itself', () => {
  it('sees a diagnostic for invalid syntax', () => { compile('.a { on: click(nope(--x)); }'); expect(warnings.length).toBe(1); });
  it('finds reactive CSS blocks in the docs', () => expect(blocks.filter(([, c]) => reactive(c)).length).toBeGreaterThan(10));
});

describe('API reference examples compile', () => {
  for (const e of api) {
    const code = 'code' in e.example ? e.example.code : undefined;
    if (code && reactive(code) && !('removal' in e)) check(e.id, code);
  }
});
describe('API usage examples: correct ones compile, incorrect ones give their documented diagnostic', () => {
  for (const e of api) for (const u of (('usage' in e ? e.usage : undefined) ?? []) as { title: string; verdict: string; code: string; diagnostic?: string }[]) {
    it(`${e.id}: ${u.title}`, () => {
      compile(u.code);
      if (u.diagnostic) expect(warnings.join('\n')).toContain(u.diagnostic);
      else expect(warnings).toEqual([]);
      if (u.verdict === 'correct') expect(u.diagnostic).toBeUndefined();
    });
  }
});

describe('example and demo stylesheets compile', () => {
  const dir = new URL('../../src/examples/', import.meta.url);
  for (const id of readdirSync(dir).filter((d) => !d.includes('.') && d !== '_shared')) check(id, readFileSync(new URL(`${id}/style.css`, dir), 'utf8'));
  for (const d of DEMOS) check(`demo ${d.id}`, d.files.base + d.files.css);
  for (const s of STAGES.filter((x) => x.rx)) check(`vision ${s.file}`, s.code);
  check('homepage install step 2', INSTALL.css);
  check('homepage install step 3 (fallback)', INSTALL.fallback);
});
describe('CSS blocks in the docs compile', () => {
  for (const [label, css] of blocks) if (reactive(css)) check(label, css);
});
