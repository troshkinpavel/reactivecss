// Library-free search for the WebKit stale getComputedStyle() read seen in 0.5.3 (quiz, form).
//   node benchmarks/audit/webkit-stale.mjs
// Each variant: a target element inside a card. The target is read while the card is shown,
// then the card is hidden (display: none), two frames pass, and then, in ONE task, the target's
// inline custom property changes (and optionally a marker attribute) and its computed value is read.
// "stale" = the read returns the old value although the inline style already has the new one.
import { webkit, chromium } from '@playwright/test';

const base = { has: true, registered: true, marker: true, readVisible: true, hideBy: 'attribute', reread: false, sibling: '' };
const variants = [
  ['all factors (quiz-like)', {}],
  ['no :has() rule', { has: false }],
  ['unregistered property', { registered: false }],
  ['no marker attribute change', { marker: false }],
  ['never read while visible', { readVisible: false }],
  ['hidden by class', { hideBy: 'class' }],
  ['hidden by hidden attribute', { hideBy: 'hidden' }],
  [':has() only, nothing else', { registered: false, marker: false, readVisible: false }],
  ['marker on a sibling, not the target', { marker: 'sibling' }],
  ['read twice (second read)', { reread: true }],
  ['a sibling card is shown in the same task', { sibling: 'show' }],
  ['a sibling card is hidden in the same task', { sibling: 'hide' }],
  ['sibling shown, nothing else', { sibling: 'show', has: false, registered: false, marker: false }],
  ['sibling shown, registered only', { sibling: 'show', has: false, marker: false }],
  ['sibling shown after the inline write', { sibling: 'show-after', has: false, marker: false }],
  ['in a setTimeout task', { ctx: 'timeout' }],
  ['in a click listener', { ctx: 'click' }],
  ['in a click listener, sibling shown', { ctx: 'click', sibling: 'show' }],
  ['in a click listener, nothing else', { ctx: 'click', has: false, registered: false, marker: false }],
];

function page(o) {
  const hide = o.hideBy === 'class' ? '.card.off { display: none }' : o.hideBy === 'hidden' ? '' : '.card:not([data-show]) { display: none }';
  return `<!doctype html><style>
    ${hide}
    .o { --p: var(--b) }
    ${o.has ? '.card:has(.o[data-m]) .v { color: red }' : ''}
  </style>
  <div class="card" id="c" data-show><button class="o" id="t" data-m style="--b: one">t</button><button class="o" id="s" data-m>s</button><p class="v">v</p></div>
  <div class="card" id="c2" ${o.sibling === 'hide' ? 'data-show' : ''}>other card</div>`;
}

async function run(browserType) {
  const browser = await browserType.launch();
  const out = [];
  for (const [name, v] of variants) {
    const o = { ...base, ...v };
    const p = await browser.newPage();
    await p.setContent(page(o));
    const r = await p.evaluate(async (o) => {
      if (o.registered) CSS.registerProperty({ name: '--p', syntax: '*', inherits: false });
      const raf = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      const c = document.getElementById('c'), t = document.getElementById('t'), s = document.getElementById('s');
      await raf();
      if (o.readVisible) getComputedStyle(t).getPropertyValue('--p');
      if (o.hideBy === 'class') c.classList.add('off'); else if (o.hideBy === 'hidden') c.hidden = true; else c.removeAttribute('data-show');
      await raf();
      getComputedStyle(t).getPropertyValue('--p'); // a read while hidden (the library's frame read)
      await raf();
      if (o.ctx === 'timeout') await new Promise((res) => setTimeout(res));
      const update = () => {
      // the same-task update
      const c2 = document.getElementById('c2');
      const flip = () => { if (o.sibling === 'hide') c2.removeAttribute('data-show'); else if (o.sibling) c2.setAttribute('data-show', ''); };
      if (o.sibling && o.sibling !== 'show-after') flip();
      t.style.setProperty('--b', 'two');
      if (o.sibling === 'show-after') flip();
      if (o.marker === true) t.removeAttribute('data-m');
      if (o.marker === 'sibling') s.removeAttribute('data-m');
      let v = getComputedStyle(t).getPropertyValue('--p').trim();
      if (o.reread) v = getComputedStyle(t).getPropertyValue('--p').trim();
      return v;
      };
      if (o.ctx !== 'click') return update();
      let v = '';
      const b = document.createElement('button'); document.body.append(b);
      document.addEventListener('click', () => { v = update(); }, { capture: true, once: true });
      b.click();
      return v;
    }, o);
    out.push({ variant: name, result: r === 'two' ? 'fresh' : `STALE (${r})` });
    await p.close();
  }
  await browser.close();
  return out;
}

for (const bt of [webkit, chromium]) {
  console.log(`== ${bt.name()}`);
  for (const r of await run(bt)) console.log(`${r.result.padEnd(14)} ${r.variant}`);
}
