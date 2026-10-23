// Memory and leak investigation (0.4 audit).
//   node benchmarks/audit/memory.mjs mount --n=1000 --cycles=100
//   node benchmarks/audit/memory.mjs risks | forms | sheets | mount
//   --page-leak   the page keeps one removed component per cycle (validates the detector)
//   --bundle=min  production bundle (no class names, no stats().internal)
//   --bundle=custom/x.js  a custom bundle under dist/ (tools/reactive-css.mjs build --no-minify keeps class names)
// Writes benchmarks/audit/results/memory-<scenario>-<n>x<cycles>.json and prints a verdict.
//
// A leak is reported when, after the last unmount and a full GC:
// - detached DOM elements remain in the heap snapshot, or
// - library objects (by class name) or library counters stay above the baseline, or
// - global listeners differ from the baseline, or
// - the heap grows steadily between checkpoints (bytes per cycle above noise).
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, open, frames, measure, heapSnapshot, globalListeners } from './lib.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const which = process.argv[2] ?? 'mount';
const N = +arg('n', 100), CYCLES = +arg('cycles', 10), BUNDLE = arg('bundle', 'dev');
const PAGE_LEAK = process.argv.includes('--page-leak');

export const COMPONENT = `<div class="cmp" data-m="init"><button class="t" data-o="a|b|c">t</button><input class="in"><input class="cb" type="checkbox"><i class="o"></i>`
  + `<div class="tabs"><b>1</b><b>2</b></div><span class="dd"><button>m</button></span><b class="label">x</b></div>`;
// Every runtime feature: state, actions, key(), outside(), bind:, when() (runtime path),
// :when(), :changed(), :nth-var(), :just-checked, previous(), direction(), live(), on(),
// random(), pick(), visible(), mouse(local), element(), attr(), pick(split()).
export const FULL_CSS = `
.cmp { --on: state(false); --n: state(0); --txt: state(""); --a: state(1); --m: state(attr(data-m, "none")); opacity: when(--on, 1, 0.5) }
.cmp .t { on: click(toggle(--on), increment(--n), set(--m, pick(split(attr(data-o), "|")))), key(Escape, set(--on, false)); rotate: on(click, random(1deg, 2deg)) }
.cmp .in { bind: --txt }
.cmp .cb { bind: --on }
.cmp .cb:just-checked + .o { outline: 1px solid }
.cmp .o { display: block; width: 10px; height: 2px; --l: live(pick(1px), 50ms); --v: visible(); --mx: mouse(x, local);
  --p: previous(--n); --d: direction(--n); --w: element(width) }
.cmp:when(--on) .o { color: red }
.cmp:changed(--n) .o { animation: f 100ms } @keyframes f { from { opacity: 0 } }
.tabs > b { on: click(set(--a, sibling-index())) }
.tabs > b:nth-var(--a) { font-weight: bold }
.dd { on: outside(click, set(--on, false)) }
.cmp .label { text: when(--on, "on", "off") }
.cmp .t { --p: state(false, bind(aria-pressed)); on: click(toggle(--on), increment(--n), set(--m, pick(split(attr(data-o), "|"))), toggle(--p)), key(Escape, set(--on, false)) }
.cmp { --s: state("idle", bind(data-status)) } .cmp:when(--on) .label { text: var(--m) }
.cmp .in { attr: disabled when(--n >= 3) } .cmp .o { attr: data-n var(--n); attr: hidden when(--on, false, true) }
.cmp .label { focus: var(--on) } .cmp .t { attr: aria-disabled when(--n >= 5); attr: tabindex "0" }
.cmp .tabs { on: key(ArrowRight, prevent(), set(--a, 2)), click(prevent(), set(--a, 1)) }`;

export const HELPERS = `<script>
  window.ReactiveCSSConfig = { native: false };
  const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
  window.__keep = [];
  window.__interact = async (host) => {
    host.querySelectorAll('.t').forEach((b, i) => { if (i % 3 === 0) b.click(); });
    host.querySelectorAll('.tabs > b:last-child').forEach((b, i) => { if (i % 5 === 0) b.click(); });
    const ins = host.querySelectorAll('.in');
    for (let i = 0; i < ins.length; i += 7) { ins[i].value = 'x' + i; ins[i].dispatchEvent(new InputEvent('input', { bubbles: true })); }
    document.body.click(); // outside() for every dropdown
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 5, clientY: 5 }));
    await raf();
  };
  window.__cycle = async (html, n, keep) => {
    const host = document.getElementById('host');
    host.innerHTML = html.repeat(n);
    await raf(); await raf();
    await __interact(host);
    if (keep) __keep.push(host.firstElementChild);
    host.replaceChildren();
    await raf();
  };
</script>`;

/** Library state that must return to its baseline after everything is removed. */
const SETTLED = ['bindings', 'states', 'sources', 'observers', 'scheduled', 'intervals', 'animations', 'jsEventListeners',
  'i.queued', 'i.fresh', 'i.frameTasks', 'i.waitingRefs', 'i.outsiders', 'i.bindControls', 'i.sizeSubjects', 'i.nthGroups', 'i.nthIndexed',
  'i.nthPending', 'i.changedChecking', 'i.pointerListeners', 'i.intersectionObservers', 'i.sheetRecords', 'i.watchers', 'i.handlerSets', 'i.actionListeners'];

async function checkpoints(env, p, run, total, label) {
  await run(0); // warm-up: lazily created shared objects (compiled argument caches, observers) exist from here on
  await frames(p.page, 3);
  const base = await measure(p);
  const baseHeap = await heapSnapshot(p.cdp);
  const baseListeners = await globalListeners(p.cdp);
  const points = [];
  const marks = new Set([1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, total]);
  const t0 = Date.now();
  for (let c = 1; c <= total; c++) {
    await run(c);
    if (marks.has(c)) {
      const m = await measure(p);
      points.push({ cycle: c, seconds: (Date.now() - t0) / 1000, ...m });
      console.error(`${label} cycle ${c}: heap ${(m.heapBytes / 1048576).toFixed(2)} MB, nodes ${m.nodes}, listeners ${m.jsEventListeners}, bindings ${m.bindings}`);
    }
  }
  await frames(p.page, 3);
  await p.page.waitForTimeout(1100); // the 1 s missing-state check and :changed() timers
  const end = await measure(p);
  const heap = await heapSnapshot(p.cdp, { paths: 5, aggregate: !!arg('aggregate') }); // --aggregate=1: self size per type:name, for heap diffs
  const listeners = await globalListeners(p.cdp);
  return verdict({ label, base, baseHeap, baseListeners, points, end, heap, listeners, errors: p.errors });
}

function verdict(r) {
  const problems = [];
  if (r.heap.detachedElements) problems.push(`${r.heap.detachedElements} detached elements retained`);
  for (const [k, v] of Object.entries(r.heap.byClass)) if (v > r.baseHeap.byClass[k]) problems.push(`${v - r.baseHeap.byClass[k]} ${k} objects above baseline`);
  for (const k of SETTLED) if (r.end[k] !== undefined && r.base[k] !== undefined && r.end[k] > r.base[k]) problems.push(`${k}: ${r.base[k]} -> ${r.end[k]}`);
  if (JSON.stringify(r.listeners) !== JSON.stringify(r.baseListeners)) problems.push(`global listeners changed: ${JSON.stringify(r.baseListeners)} -> ${JSON.stringify(r.listeners)}`);
  // Heap growth between the second checkpoint and the end, per cycle (the first cycles warm caches up).
  const pts = r.points;
  if (pts.length >= 3) {
    const a = pts[1], b = pts[pts.length - 1];
    r.growthBytesPerCycle = Math.round((b.heapBytes - a.heapBytes) / (b.cycle - a.cycle));
  }
  r.problems = problems;
  r.leak = problems.length > 0;
  return r;
}

const scenarios = {
  /** Mount and unmount N full-feature components per cycle. */
  async mount(env) {
    const p = await open(env, { before: HELPERS, head: `<style>${FULL_CSS}</style>`, body: '<div id="host"></div>', bundle: BUNDLE });
    const r = await checkpoints(env, p, () => p.page.evaluate(([h, n, k]) => __cycle(h, n, k), [COMPONENT, N, PAGE_LEAK]), CYCLES, `mount ${N}`);
    await p.close();
    return r;
  },

  /** State-engine edge cases, each repeated: removal with pending work, running animations, reinsertion. */
  async risks(env) {
    const p = await open(env, { before: HELPERS, head: `<style>${FULL_CSS.replace('animation: f 100ms', 'animation: f 2s')}</style>`, body: '<div id="host"></div><div id="park"></div>', bundle: BUNDLE });
    const cases = {
      // An action queues urgent work, and the component is removed in the same task.
      clickThenRemove: (h, n) => { host.innerHTML = h.repeat(n); host.querySelectorAll('.t').forEach((b) => b.click()); host.replaceChildren(); },
      // Removal inside a frame callback that runs before the library's flush of the same frame.
      removeInFrame: async (h, n) => {
        host.innerHTML = h.repeat(n);
        await new Promise((r) => requestAnimationFrame(r));
        await new Promise((r) => { requestAnimationFrame(() => { host.replaceChildren(); r(); }); host.querySelectorAll('.t').forEach((b) => b.click()); });
      },
      // :changed() animations (2 s) running when the component goes away.
      removeWhileAnimating: async (h, n) => {
        host.innerHTML = h.repeat(n);
        await new Promise((r) => requestAnimationFrame(r));
        host.querySelectorAll('.t').forEach((b) => b.click());
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30))));
        host.replaceChildren();
      },
      // Inserted and removed in the same task: the observer sees both records together.
      insertRemoveSameTask: (h, n) => { host.innerHTML = h.repeat(n); host.replaceChildren(); },
      // The same nodes moved out and back in (reinsertion): bindings must not accumulate.
      reinsert: async (h, n) => {
        if (!host.children.length) host.innerHTML = h.repeat(n);
        const nodes = [...host.children];
        park.append(...nodes); // still connected: moved, not removed
        await new Promise((r) => requestAnimationFrame(r));
        const f = document.createDocumentFragment();
        f.append(...nodes); // disconnected
        await new Promise((r) => setTimeout(r));
        host.append(f);
        host.querySelectorAll('.t').forEach((b, i) => i % 2 || b.click());
        await new Promise((r) => requestAnimationFrame(r));
      },
      // An element changes so its rules stop matching (class removed) while state work is pending.
      unmatchWhilePending: async (h, n) => {
        host.innerHTML = h.repeat(n);
        await new Promise((r) => requestAnimationFrame(r));
        host.querySelectorAll('.t').forEach((b) => b.click());
        host.querySelectorAll('.cmp').forEach((c) => c.classList.remove('cmp'));
        await new Promise((r) => requestAnimationFrame(r));
        host.replaceChildren();
      },
    };
    const out = {};
    for (const [name, fn] of Object.entries(cases)) {
      await p.page.evaluate(`window.__case = ${fn.toString()}`);
      out[name] = await checkpoints(env, p, () => p.page.evaluate(([h, n]) => __case(h, n), [COMPONENT, N]), CYCLES, name);
      if (name === 'reinsert') {
        // After the reinsertion cycles the components are still mounted once: one set of bindings.
        await p.page.evaluate(() => { host.replaceChildren(); park.replaceChildren(); });
      }
    }
    await p.close();
    return out;
  },

  /** bind: on every control type, with typing, composition left open, focus, reset and removal. */
  async forms(env) {
    const css = `form { --t: state(""); --n: state(0); --c: state(false); --r: state("a"); --s: state("b"); --a: state("") }
      form .t { bind: --t } form .n { bind: --n } form .c { bind: --c } form .r { bind: --r } form .s { bind: --s } form .a { bind: --a }
      form output::after { content: var(--t) }`;
    const FORM = `<form><input class="t"><input class="n" type="number"><input class="c" type="checkbox">
      <input class="r" type="radio" name="r" value="a"><input class="r" type="radio" name="r" value="b">
      <select class="s"><option>a</option><option>b</option></select><textarea class="a"></textarea><output></output></form>`;
    const p = await open(env, { head: `<style>${css}</style>`, body: '<div id="host"></div>', bundle: BUNDLE });
    await p.page.evaluate(`window.__forms = async (h, n) => {
      host.innerHTML = h.repeat(n).replace(/name="r"/g, () => 'name="r' + Math.random() + '"');
      await new Promise((r) => requestAnimationFrame(r));
      const ev = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
      host.querySelectorAll('form').forEach((f, i) => {
        const t = f.querySelector('.t'); t.focus(); t.value = 'v' + i; ev(t, 'input');
        t.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })); t.value += 'あ'; ev(t, 'input'); // left composing
        f.querySelector('.n').value = String(i); ev(f.querySelector('.n'), 'input');
        f.querySelector('.c').click(); f.querySelectorAll('.r')[1].click();
        f.querySelector('.s').value = 'a'; ev(f.querySelector('.s'), 'change');
        f.querySelector('.a').value = 'x'; ev(f.querySelector('.a'), 'input');
        if (i % 2) f.reset();
      });
      await new Promise((r) => requestAnimationFrame(r));
      host.replaceChildren(); // removed with focus inside and a composition open
      await new Promise((r) => requestAnimationFrame(r));
    }`);
    const r = await checkpoints(env, p, () => p.page.evaluate(([h, n]) => __forms(h, n), [FORM, N]), CYCLES, `forms ${N}`);
    await p.close();
    return r;
  },

  /** Stylesheet lifecycle: add/remove, disable, alternate, media, text replacement, subtree replacement, href change. */
  async sheets(env) {
    const css = `.x { --on: state(false); --w: element(width); rotate: random(1deg, 2deg, by 1deg) } .x b { on: click(toggle(--on)) } .x i { opacity: when(--on, 1, 0.5) }`;
    const p = await open(env, {
      head: `<link rel="stylesheet" href="/a/l1.css" title="one"><link rel="alternate stylesheet" href="/a/l2.css" title="two">`,
      body: '<div id="host">' + '<div class="x"><b>b</b><i>i</i></div>'.repeat(N) + '</div><div id="sheets"></div>', bundle: BUNDLE,
    });
    await p.page.route('**/a/l*.css', (r) => r.fulfill({ contentType: 'text/css', body: css }));
    await p.page.evaluate((css) => { window.__css = css; }, css);
    const ops = {
      addRemove: () => { const s = document.createElement('style'); s.textContent = __css; document.head.append(s); s.remove(); },
      addWaitRemove: async () => { const s = document.createElement('style'); s.textContent = __css; document.head.append(s); await new Promise((r) => requestAnimationFrame(r)); s.remove(); },
      toggleDisabled: async () => { const s = document.head.querySelector('#d') ?? Object.assign(document.createElement('style'), { id: 'd', textContent: __css }); document.head.append(s); s.disabled = !s.disabled; await new Promise((r) => requestAnimationFrame(r)); },
      media: async () => { const s = document.head.querySelector('#m') ?? Object.assign(document.createElement('style'), { id: 'm', textContent: __css }); document.head.append(s); s.media = s.media ? '' : 'print'; await new Promise((r) => requestAnimationFrame(r)); },
      // Every edit recompiles: the same text produces new generated names each time.
      replaceText: async () => { const s = document.head.querySelector('#r') ?? document.head.appendChild(Object.assign(document.createElement('style'), { id: 'r' })); s.textContent = __css + `/* ${Math.random()} */`; await new Promise((r) => requestAnimationFrame(r)); },
      subtree: async () => { sheets.innerHTML = `<div><style>${__css}</style></div>`; await new Promise((r) => requestAnimationFrame(r)); sheets.replaceChildren(); },
      alternate: async () => { for (const l of document.querySelectorAll('link[title]')) l.disabled = !l.disabled; await new Promise((r) => requestAnimationFrame(r)); },
      href: async () => { const l = document.querySelector('link[title="one"]'); l.href = l.href.includes('l1') ? '/a/l2.css?' + Math.random() : '/a/l1.css'; await new Promise((r) => setTimeout(r, 20)); },
      linkRemovedWhileLoading: () => { const l = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: '/a/l1.css?' + Math.random() }); document.head.append(l); l.remove(); },
    };
    const out = {};
    for (const [name, fn] of Object.entries(ops)) {
      await p.page.evaluate(`window.__op = ${fn.toString()}`);
      const t = [];
      out[name] = await checkpoints(env, p, async () => { const s = Date.now(); await p.page.evaluate(() => __op()); t.push(Date.now() - s); }, CYCLES, name);
      out[name].msFirst10 = t.slice(0, 10).reduce((a, b) => a + b, 0) / Math.min(10, t.length);
      out[name].msLast10 = t.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, t.length);
      await p.page.evaluate(() => { for (const id of ['d', 'm', 'r']) document.getElementById(id)?.remove(); sheets.replaceChildren(); });
    }
    await p.close();
    return out;
  },
};

if (import.meta.url === `file://${process.argv[1]}`) {
const env = await launch();
try {
  const result = await scenarios[which](env);
  mkdirSync(new URL('./results/', import.meta.url), { recursive: true });
  const name = `memory-${which}-${N}x${CYCLES}${PAGE_LEAK ? '-pageleak' : ''}${BUNDLE === 'min' ? '-min' : ''}`;
  writeFileSync(new URL(`./results/${name}.json`, import.meta.url), JSON.stringify({ date: new Date().toISOString(), browser: env.browser.version(), n: N, cycles: CYCLES, bundle: BUNDLE, result }, null, 1));
  const rows = result.problems ? { [which]: result } : result;
  for (const [k, r] of Object.entries(rows)) {
    console.log(`${k}: ${r.leak ? 'LEAK' : 'clean'}; growth ${r.growthBytesPerCycle ?? '-'} B/cycle; detached ${r.heap.detachedElements}; heap ${(r.base.heapBytes / 1048576).toFixed(2)} -> ${(r.end.heapBytes / 1048576).toFixed(2)} MB${r.msFirst10 !== undefined ? `; op ms first10 ${r.msFirst10.toFixed(1)} last10 ${r.msLast10.toFixed(1)}` : ''}`);
    for (const pr of r.problems) console.log('   - ' + pr);
    for (const path of r.heap.retainerPaths ?? []) console.log('   path: ' + path);
    if (r.errors?.length) console.log('   page errors: ' + [...new Set(r.errors)].join(' | '));
  }
} finally {
  await env.close();
}
}
