// Bisects the WebKit stale computed read on the real quiz example (with the library).
//   node benchmarks/audit/webkit-stale-quiz.mjs   (needs `npm run serve` on :8080)
// Every getComputedStyle() read of --rcss-attr-* made inside the "Try again" click is recorded;
// right after the click returns (same task) the same elements are read again. A difference means
// the read inside the click was stale. Variants remove groups of rules from the quiz stylesheet.
import { readFileSync } from 'node:fs';
import { webkit, chromium } from '@playwright/test';

const CSS = readFileSync(new URL('../../examples/interactive-quiz/style.css', import.meta.url), 'utf8');
const drop = (re) => CSS.split('\n').filter((l) => !re.test(l)).join('\n');
const variants = [
  ['full quiz stylesheet', CSS],
  ['without :has() rules', drop(/:has\(/)],
  ['without text: rules', drop(/\btext:/)],
  ['without aria-pressed attr:', drop(/aria-pressed/)],
  ['without card display rules', drop(/\.card(:nth-var\(--q\))? \{ display/)],
  ['without :has() and text:', drop(/:has\(|\btext:/)],
  ['without option :nth-var() rules (feedback, pressed)', drop(/\.opt:nth-var|opt\.correct:nth-var/)],
  ['aria-pressed without :nth-var()', CSS.replace(/^\.q1 \.opt:nth-var\(--a1\), \.q2 \.opt:nth-var\(--a2\), \.q3 \.opt:nth-var\(--a3\) \{ attr: aria-pressed "true"; \}$/m, '.question .opt.correct { attr: aria-pressed "true"; }')],
  ['only display + disabled + pressed rules', [CSS.match(/^\.quiz \{ --q.*$/m)[0], '.quiz > .cards > .card { display: none; }', '.quiz > .cards > .card:nth-var(--q) { display: block; }',
    '.q1 .opt { on: click(set(--a1, sibling-index())); attr: disabled when(--a1 > 0); }', '.q2 .opt { on: click(set(--a2, sibling-index())); attr: disabled when(--a2 > 0); }', '.q3 .opt { on: click(set(--a3, sibling-index())); attr: disabled when(--a3 > 0); }',
    '.question .opt { attr: aria-pressed "false"; }', '.q1 .opt:nth-var(--a1), .q2 .opt:nth-var(--a2), .q3 .opt:nth-var(--a3) { attr: aria-pressed "true"; }',
    '.quiz > .nav > .next { on: click(increment(--q)); }', '.quiz > .cards > .result > .restart { on: click(set(--q, 1), set(--a1, 0), set(--a2, 0), set(--a3, 0)); }'].join('\n')],
  ['minimal without pressed', [CSS.match(/^\.quiz \{ --q.*$/m)[0], '.quiz > .cards > .card { display: none; }', '.quiz > .cards > .card:nth-var(--q) { display: block; }',
    '.q1 .opt { on: click(set(--a1, sibling-index())); attr: disabled when(--a1 > 0); }', '.q2 .opt { on: click(set(--a2, sibling-index())); attr: disabled when(--a2 > 0); }', '.q3 .opt { on: click(set(--a3, sibling-index())); attr: disabled when(--a3 > 0); }',
    '.quiz > .nav > .next { on: click(increment(--q)); }', '.quiz > .cards > .result > .restart { on: click(set(--q, 1), set(--a1, 0), set(--a2, 0), set(--a3, 0)); }'].join('\n')],
];

const RECORD = `<script>(() => {
  const g = window.getComputedStyle; window.__reads = null;
  window.getComputedStyle = function (el, p) {
    const cs = g.call(this, el, p);
    if (window.__reads) { const v = cs.getPropertyValue('--rcss-attr-disabled'); window.__reads.push([el, v]); }
    return cs;
  };
  window.__g = g;
})();</script>`;

async function run(bt) {
  const browser = await bt.launch();
  const out = [];
  for (const [name, css] of variants) {
    const page = await browser.newPage();
    await page.route('**/examples/interactive-quiz/style.css', (r) => r.fulfill({ contentType: 'text/css', body: css }));
    await page.route('**/examples/interactive-quiz/', async (r) => {
      const res = await r.fetch();
      r.fulfill({ response: res, body: (await res.text()).replace('<head>', '<head>' + RECORD) });
    });
    await page.goto('http://localhost:8080/examples/interactive-quiz/');
    await page.waitForFunction(() => window.ReactiveCSS?.stats().sheets >= 1);
    for (const sel of ['.q1 .opt.correct', '.quiz .next', '.q2 .opt', '.quiz .next', '.q3 .opt.correct', '.quiz .next'])
      await page.evaluate((sel) => new Promise((res) => { document.querySelector(sel).click(); requestAnimationFrame(() => requestAnimationFrame(res)); }), sel);
    const r = await page.evaluate(() => {
      window.__reads = [];
      document.querySelector('.quiz .restart').click();
      const reads = window.__reads; window.__reads = null;
      let stale = 0, total = 0;
      for (const [el, v] of reads) { if (!v) continue; total++; if (window.__g(el).getPropertyValue('--rcss-attr-disabled') !== v) stale++; }
      const attrs = [...document.querySelectorAll('.question .opt')].map((o) => (o.disabled ? 'D' : '-')).join('');
      return { stale, total, attrs };
    });
    out.push(`${(r.stale ? `STALE ${r.stale}/${r.total}` : `fresh ${r.total}`).padEnd(14)} ${r.attrs}  ${name}`);
    await page.close();
  }
  await browser.close();
  return out;
}
for (const bt of [webkit, chromium]) { console.log(`== ${bt.name()}`); for (const l of await run(bt)) console.log(l); }
