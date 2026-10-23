// Lifecycle and memory: removed elements must not stay reachable from the runtime.
import { test, expect } from '@playwright/test';
import { open, frames, stats } from './helpers';
import type { Page } from '@playwright/test';

/** Heap snapshot after GC: detached DOM elements, and objects counted by constructor name. */
async function heap(page: Page, names: string[] = []) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.enable');
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.collectGarbage');
  let chunks = '';
  cdp.on('HeapProfiler.addHeapSnapshotChunk', (e) => { chunks += e.chunk; });
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  await cdp.detach();
  const snap = JSON.parse(chunks);
  const f: string[] = snap.snapshot.meta.node_fields;
  const W = f.length, iN = f.indexOf('name'), iD = f.indexOf('detachedness');
  expect(iD).toBeGreaterThan(-1); // detached DOM nodes: detachedness 2, named like <div class="x">
  let detached = 0;
  const counts: Record<string, number> = Object.fromEntries(names.map((n) => [n, 0]));
  for (let i = 0; i < snap.nodes.length; i += W) {
    const name: string = snap.strings[snap.nodes[i + iN]];
    if (snap.nodes[i + iD] === 2 && /^<[a-z]/.test(name)) detached++;
    if (name in counts) counts[name]++;
  }
  return { detached, counts };
}

const COMPONENT = `<div class="cmp"><button class="t">t</button><input class="in"><i class="o"></i>
  <div class="tabs"><b>1</b><b>2</b></div><span class="dd"><button>m</button></span><b class="label">x</b></div>`;

test('mount/unmount of components using every feature leaves no retained detached elements (heap snapshot)', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'heap snapshots need the Chrome DevTools Protocol');
  await open(page, {
    native: false, // exercise the runtime path of when()
    head: `<style>
      .cmp { --on: state(false); --n: state(0); --txt: state(""); --a: state(1); opacity: when(--on, 1, 0.5) }
      .cmp .t { on: click(toggle(--on), increment(--n)), key(Escape, set(--on, false)); rotate: on(click, random(1deg, 2deg)) }
      .cmp .in { bind: --txt }
      .cmp .o { --l: live(pick(1px), 50ms); --v: visible(); --mx: mouse(x, local); --p: previous(--n) }
      .cmp:when(--on) .o { color: red }
      .cmp:changed(--n) .o { animation: f 100ms } @keyframes f { from { opacity: 0 } }
      .tabs > b:nth-var(--a) { font-weight: bold }
      .dd { on: outside(click, set(--on, false)) }
      .cmp .label { text: when(--on, "on", "off") }
      .cmp .t { --p: state(false, bind(aria-pressed)) } .cmp { --s: state("idle", bind(data-status)) }
      .cmp .t { on: click(toggle(--on), increment(--n), toggle(--p)), key(Escape, set(--on, false)) } .cmp:when(--on) .label { text: var(--n) }
      .cmp .in { attr: disabled when(--n >= 3) } .cmp .o { attr: data-n var(--n); attr: hidden when(--on, false, true) }
      .cmp .label { focus: var(--on) } .cmp .t { attr: aria-disabled when(--n >= 5); attr: tabindex "0" }
      .cmp .tabs { on: key(ArrowRight, prevent(), set(--a, 2)), click(prevent(), set(--a, 1)) }
    </style>`,
    body: '<div id="host"></div>',
  });
  const cycle = () => page.evaluate((html) => {
    const host = document.getElementById('host')!;
    host.innerHTML = html.repeat(200);
    host.querySelectorAll<HTMLElement>('.t').forEach((b, i) => { if (i % 3 === 0) b.click(); });
    return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => { host.replaceChildren(); requestAnimationFrame(() => res(null)); })));
  }, COMPONENT);
  for (let k = 0; k < 3; k++) await cycle();
  await frames(page, 3);
  const s = await stats(page);
  expect([s.bindings, s.states, s.scheduled, s.sources]).toEqual([0, 0, 0, 0]);

  const { detached } = await heap(page);
  // 3 cycles x 200 components x 8 elements were created and removed; none may be retained.
  expect(detached).toBe(0);
});

test('reinserting the same elements does not accumulate :nth-var() state subscriptions', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'heap snapshots need the Chrome DevTools Protocol');
  // 0.4 audit: inline style writes on an ancestor queued a :nth-var() group that had already been
  // deleted; it then got a new StateRef that nothing disposed (one per reinsertion).
  await open(page, {
    head: `<style>.cmp { --a: state(1); --l: pick(1px) } .cmp b { on: click(set(--a, sibling-index())) } .cmp b:nth-var(--a) { color: red }</style>`,
    body: '<div id="host"><div class="cmp"><p><b>1</b><b>2</b></p></div></div>',
  });
  const reinsert = (k: number) => page.evaluate(async (k) => {
    const host = document.getElementById('host')!;
    for (let i = 0; i < k; i++) {
      // The state owner leaves and comes back: unbinding removes its inline values (an attribute
      // mutation on an ancestor of the :nth-var() group, which had just been deleted).
      const f = document.createDocumentFragment();
      f.append(...host.children);
      await new Promise((r) => setTimeout(r));
      host.append(f);
      await new Promise((r) => requestAnimationFrame(r));
      host.querySelectorAll('b')[i % 2].click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
  }, k);
  await reinsert(2);
  const before = (await heap(page, ['StateRef'])).counts.StateRef;
  await reinsert(20);
  expect((await heap(page, ['StateRef'])).counts.StateRef).toBe(before);
  expect(await page.$eval('b:nth-child(2)', (b) => getComputedStyle(b).color)).toBe('rgb(255, 0, 0)'); // still correct: the last click selected tab 2
});

test('href changes on a disabled <link> do not accumulate event listeners', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'listener inspection needs the Chrome DevTools Protocol');
  // 0.4 audit: a disabled link fires neither load nor error, so each href change added two
  // listeners (and kept the fetched text alive); after enabling, the "error" ones stayed forever.
  await open(page, {
    head: '<link id="l" rel="stylesheet" href="/t/css/a.css">', body: '<div class="x">x</div>',
    css: { 'a.css': '.x { --w: pick(1px) }', 'b.css': '.x { --w: pick(2px) }' },
  });
  const listeners = async () => {
    const cdp = await page.context().newCDPSession(page);
    const { result } = await cdp.send('Runtime.evaluate', { expression: 'document.getElementById("l")' });
    const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId! });
    await cdp.detach();
    return listeners.length;
  };
  await page.evaluate(() => { (document.getElementById('l') as HTMLLinkElement).disabled = true; });
  for (let i = 0; i < 6; i++) {
    await page.evaluate((i) => { (document.getElementById('l') as HTMLLinkElement).href = `/t/css/${i % 2 ? 'a' : 'b'}.css`; }, i);
    await page.waitForTimeout(50);
  }
  expect(await listeners()).toBeLessThanOrEqual(2); // one pending wait
  await page.evaluate(() => { (document.getElementById('l') as HTMLLinkElement).disabled = false; });
  await expect.poll(() => page.$eval('.x', (e) => getComputedStyle(e).getPropertyValue('--w'))).toBe('1px'); // the last href (a.css) is processed
  expect(await listeners()).toBe(0);
});

test('element() and :just-checked release their per-element entries on removal', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'heap metrics need the Chrome DevTools Protocol');
  // 0.4 audit: their WeakMaps were never deleted from, so the V8 tables kept the capacity they grew
  // to between full GCs (+262 KB per map for 20,000 elements, never returned).
  await open(page, {
    head: `<style>.g { --w: element(width); display: block; height: 1px } .g:just-checked + i { color: red }</style>`,
    body: '<div id="host"></div>',
  });
  const cdp = await page.context().newCDPSession(page);
  const heap = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('Performance.enable');
    return (await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'JSHeapUsedSize')!.value;
  };
  const cycle = () => page.evaluate(async () => {
    const host = document.getElementById('host')!;
    for (let k = 0; k < 4; k++) {
      host.innerHTML = '<input type="checkbox" class="g"><i></i>'.repeat(5000);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      host.replaceChildren();
      await new Promise((r) => requestAnimationFrame(r));
    }
  });
  await cycle(); // warm-up
  const before = await heap();
  await cycle();
  await cycle();
  expect(await heap() - before).toBeLessThan(150_000);
  expect((await stats(page)).sources).toBe(0);
});
