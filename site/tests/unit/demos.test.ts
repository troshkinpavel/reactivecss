// The library demos are run unchanged; the split must keep every reactive declaration visible.
import { describe, expect, it } from 'vitest';
import { DEMOS, DEMO_ORDER, section } from '~/lib/content/demos';
import { highlightCss } from '~/lib/code/css';

describe('library demos', () => {
  it('syncs every demo in the order list', () => {
    expect(DEMOS.map((d) => d.id)).toEqual([...DEMO_ORDER]);
  });
  for (const d of DEMOS) {
    it(`${d.id}: layout part has no reactive syntax, behavior part has some, notes parse`, () => {
      const rx = (css: string) => highlightCss(css).flat().filter((t) => t.k === 'rx');
      expect(rx(d.files.base)).toEqual([]);
      expect(rx(d.files.css).length).toBeGreaterThan(0);
      expect(d.files.html).not.toMatch(/<script/i);
      expect(d.title).toBeTruthy();
      expect(d.description.length).toBeGreaterThan(20);
      expect(section(d, 'Limitations found', 'Limitations')).toBeTruthy();
      expect(section(d, 'What would normally need JavaScript')).toBeTruthy();
      expect(section(d, 'What native HTML/CSS does')).toBeTruthy();
    });
  }
});

describe('vanilla JavaScript comparison (Vision)', async () => {
  const js = (await import('~/content/vanilla/score-history.js?raw')).default as string;
  const css = (await import('~/content/vanilla/score-history.css?raw')).default as string;
  const demo = DEMOS.find((d) => d.id === 'score-history')!;
  it('uses no Reactive CSS', () => {
    expect(highlightCss(css).flat().filter((t) => t.k === 'rx')).toEqual([]);
    expect(js).not.toMatch(/ReactiveCSS|reactive-css/);
  });
  it('only looks up classes that exist in the shared demo markup', () => {
    const classes = [...js.matchAll(/\$\('\.([\w-]+)'\)|querySelectorAll\('\.([\w-]+)'\)/g)].map((m) => m[1] ?? m[2]);
    expect(classes.length).toBeGreaterThan(5);
    for (const c of classes) expect(demo.files.html, c).toMatch(new RegExp(`class="[^"]*\\b${c}\\b`));
  });
});
