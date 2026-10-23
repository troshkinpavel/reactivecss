# Reactive CSS 0.9.0 vs vanilla JavaScript

**Date:** 2026-10-23. **Environment:** Chromium 156.0.8078.4 (Playwright 1.64.1, headless), Apple M4 Max, macOS 27. **Runtime:** `dist/reactive-css.min.js`, the final 0.9.0 production bundle: 149,039 B, 49,233 B gzip.

**Method:**
- `node benchmarks/vs-vanilla/run.mjs` runs each scenario in `scenarios/`, both implementations, in the same browser.
- Per scenario and implementation: one warm-up load (discarded), then 5 measured loads, interleaved (A B, B A…).
- Per load: 5 warm-up interactions, then 40 measured ones, two frames apart.
- Values are medians over the 5 loads, with min–max. Raw data: `results.json`.

**Fairness:** each scenario uses identical HTML and the same visual CSS. The Reactive CSS page adds `reactive.css` and the runtime. The vanilla page adds `vanilla.js`, minimal and framework-free (event delegation for 1,000 elements). Both pages carry the same measurement probe, a frame counter and a MutationObserver. Its cost is included equally in both columns of *script per interaction*, so the **difference** between the columns is what matters there.

**Equivalence:** both implementations end every load in the same DOM state:
- counter and 1,000 counters: text 45;
- toggle: `aria-pressed` false after 45 clicks;
- form: 45 × "x";
- drag: same `translate`.

## Summary

| Metric | Vanilla JS | Reactive CSS 0.9.0 | Difference |
|---|---|---|---|
| **Startup, one component**: script during load | 0.34–0.48 ms | 3.6–4.0 ms | **+3.3 to +3.6 ms** (runtime parse and compile) |
| Startup, one component: page ready (DOMContentLoaded handled) | 4.4–9.8 ms | 11.2–12.0 ms | +2 to +7 ms |
| **Startup, 1,000 counters**: script / ready | 0.20 ms / 6.3 ms | 7.9 ms / 26.0 ms | **+7.7 ms script, +19.7 ms to ready** |
| **Click latency**, frames until the update is painted | 1 | 1 | **None**: the same frame |
| Click latency, event → DOM mutation | 0.1 ms (during the event) | 15 ms for text (written in the next frame, before its paint); 0.2 ms for an attribute (`bind()` writes at once) | Text appears in the same painted frame as vanilla's |
| **Form input latency**, frames / event → DOM | 1 / 0.1 ms | 1 / 14.9 ms | Same painted frame |
| Script per interaction (click, counter) | 0.14 ms | 0.27 ms | +0.13 ms |
| Script per interaction (toggle / form / 1,000 counters) | 0.17 / 0.16 / 0.15 ms | 0.37 / 0.44 / 0.28 ms | +0.20 / +0.28 / +0.13 ms |
| **Drag movement**, script per pointer move | 0.19 ms | 0.28 ms | +0.09 ms |
| Drag, frames until painted / event → DOM | 1 / 0.1 ms | 1 / 0.3 ms | None |
| **Memory**, JS heap after GC, one component | 0.61 MB | 1.55–1.57 MB | +0.95 MB (the runtime's code and structures) |
| Memory, 1,000 counters | 0.54 MB | 2.29 MB | +1.75 MB |
| **Idle CPU**, 3 s after interaction: script time | 0 ms | 0 ms | None |
| Idle: task time (browser housekeeping) | 0.26–2.8 ms | 0.22–2.5 ms | None (within noise) |
| **JS bundle size**, full runtime + app | 0 + 139–245 B gzip | 49,233 B gzip runtime + 90–101 B gzip CSS | **+49 KB gzip** |
| JS bundle size, trimmed custom runtime + app | same | 26.8–28.8 KB gzip (`core, events` + `text`, `attributes` or `gestures`) | **+27 to +29 KB gzip** |

**Per scenario** (medians, min–max):

| Scenario | Implementation | Startup script (ms) | Startup task (ms) | Ready (ms) | Heap (MB) | Event → DOM (ms) | Frames to paint | Script per interaction (ms) |
|---|---|---|---|---|---|---|---|---|
| Counter | Vanilla | 0.44 (0.38–0.48) | 8.0 | 9.8 | 0.61 | 0.1 | 1 | 0.14 (0.06–0.17) |
| | Reactive CSS | 3.99 (3.67–4.30) | 14.8 | 11.7 | 1.57 | 15.2 | 1 | 0.27 (0.11–0.50) |
| Toggle | Vanilla | 0.36 | 7.5 | 7.7 | 0.61 | 0.1 | 1 | 0.17 (0.10–0.18) |
| | Reactive CSS | 3.59 | 14.4 | 11.3 | 1.54 | 0.2 | 1 | 0.37 (0.37–0.40) |
| Form mirror | Vanilla | 0.48 | 8.4 | 8.6 | 0.62 | 0.1 | 1 | 0.16 (0.12–0.19) |
| | Reactive CSS | 4.01 | 15.1 | 12.0 | 1.57 | 14.9 | 1 | 0.44 (0.23–0.47) |
| Drag | Vanilla | 0.34 | 4.1 | 4.4 | 0.60 | 0.1 | 1 | 0.19 (0.12–0.24) |
| | Reactive CSS | 3.72 | 11.1 | 11.2 | 1.55 | 0.3 | 1 | 0.28 (0.15–0.38) |
| 1,000 counters | Vanilla | 0.20 | 15.8 | 6.3 | 0.54 | 0.0 | 1 | 0.15 (0.07–0.17) |
| | Reactive CSS | 7.88 (7.70–9.49) | 28.7 | 26.0 | 2.29 | 14.7 | 1 | 0.28 (0.26–0.32) |

**Why "event → DOM" differs but "frames to paint" does not:**
- **Vanilla** writes the DOM inside the event handler; the browser paints it in the next frame.
- **Reactive CSS** changes the state during the event and writes text in its animation-frame flush. That runs at the start of the same next frame, before paint.
- **Attribute bindings** (`bind()`) are written during the event.
- **Drag:** Chromium delivers `pointermove` aligned to frames, just before rAF callbacks, so the gap there is 0.3 ms.

So users see the update in the same frame. The 15 ms is not extra visible delay; it is where in the frame the write happens. Code that reads the DOM text *synchronously right after the event* (a script, a test) would see the old value until the next frame. That is a real semantic difference for mixed JS and Reactive CSS pages.

## Equivalent code

**Counter.** Shared HTML: `<div class="c"><button class="inc">+</button><output class="v">0</output></div>`

```css
/* Reactive CSS */
.c { --n: state(0); }
.c .inc:on(click) { --n: increment(1); }
.c .v { content: var(--n); }
```

```js
// Vanilla JS
for (const c of document.querySelectorAll('.c')) {
  const v = c.querySelector('.v');
  let n = 0;
  c.querySelector('.inc').addEventListener('click', () => { v.textContent = ++n; });
}
```

**Drag:**

```css
/* Reactive CSS */
.k { --x: state(0px); --y: state(0px); translate: var(--x) var(--y); }
.k:on(drag) { --x: set(event(x)); --y: set(event(y)); }
```

```js
// Vanilla JS
for (const k of document.querySelectorAll('.k')) {
  let x = 0, y = 0, sx = 0, sy = 0, ox = 0, oy = 0, id = null;
  k.addEventListener('pointerdown', (e) => { id = e.pointerId; sx = e.clientX; sy = e.clientY; ox = x; oy = y; k.setPointerCapture(id); });
  k.addEventListener('pointermove', (e) => { if (e.pointerId !== id) return; x = ox + e.clientX - sx; y = oy + e.clientY - sy; k.style.translate = `${x}px ${y}px`; });
  k.addEventListener('pointerup', () => { id = null; });
  k.addEventListener('pointercancel', () => { id = null; });
}
```

The toggle, form mirror and 1,000-counter versions are in `scenarios/`. The Reactive CSS drag also has a 3 px start threshold, pointer-cancel handling and keyboard-safe field exclusion. The vanilla version has none of them, so it is a lower bound.

## Assessment

**Advantages of Reactive CSS** (measured):
- the same visible latency: the update is painted in the same frame for clicks, input and drag;
- no idle CPU;
- equal results;
- application code is CSS of about 0.1 KB, and in-page JavaScript is zero.

**Disadvantages** (measured):
- **Download size:** about 49 KB gzip for the full runtime, or about 27–29 KB gzip for a trimmed one, against about 0.2 KB of app-specific vanilla JS. This is the largest cost.
- **Startup:** about +3.5 ms of script per page for the runtime, and +8 ms script / +20 ms to ready with 1,000 interactive elements on this machine.
- **Memory:** about +1 MB baseline, and +1.75 MB with 1,000 elements.
- **Per interaction:** about 0.1–0.3 ms more script, roughly 2–3× vanilla's handler cost here.
- **DOM writes are frame-deferred for text**, which matters only to scripts reading the DOM synchronously.

**Where the overhead becomes noticeable:**
- **Network:** the 27–49 KB gzip runtime on slow connections. On a 1.6 Mbps link, 49 KB is roughly 0.25 s more to download, plus parse.
- **Large pages on slow CPUs:** 1,000 interactive elements cost about 20 ms more to become ready here, roughly 80 ms on a device 4× slower. That is a visible extra delay on low-end phones at load, not during interaction.
- **High-frequency work at scale:** 0.28 ms per drag move is under 2% of a 16.7 ms frame here, about 7% at 4× slower. Many simultaneous high-frequency rules would add up. These scenarios did not test that, and `benchmarks/v090/` has the larger runs.

**Perceptible to users?**
- **Interaction:** no. Updates are painted in the same frame, and the extra script per interaction is a fraction of a millisecond.
- **Load:** usually no for small interfaces. A few milliseconds of startup and tens of KB are within normal page budgets. Possibly yes on slow networks and low-end phones, especially with the full bundle or many hundreds of interactive elements.

**Conclusion.** For small interactive interfaces (counters, toggles, form mirrors, single drag handles), Reactive CSS 0.9.0 matches vanilla JavaScript in what users see: the same frame, the same final state, no idle cost. It pays for that with a fixed runtime cost: 27–49 KB gzip to download, about 3.5–8 ms of startup script on this machine, about 1–2 MB of heap, and 2–3× vanilla's (sub-millisecond) script per interaction.

It does not reach performance parity with hand-written JS, which is cheaper on every resource metric. It reaches **user-visible parity**. For a page that needs only one or two tiny interactions and nothing else, vanilla JS is the leaner choice. Reactive CSS pays off when the declarative CSS replaces enough script to justify a trimmed runtime of about 27 KB gzip, or where writing no JavaScript is itself the goal.

**Limits of this run:**
- one machine, headless Chromium only;
- no CPU throttling or network emulation;
- 5 short runs;
- `performance.now()` is coarsened to 0.1 ms;
- the drag comparison is against a vanilla version without a threshold or cancel handling.
