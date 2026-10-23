# Reactive CSS 0.4.0: memory and leak audit

Date: 2026-10-18. Apple M4 Max, macOS 27.0, Playwright Chromium 156.0.8078.4 (headless shell). Development bundle (`dist/reactive-css.js`: readable class names and `stats().internal`) unless marked *production*. Raw data: `benchmarks/audit/results/memory-*.json` (final build) and `benchmarks/audit/results/pre-fix/` (before the fixes).

## Executive summary

- **3 leaks found and fixed, each with a regression test that fails without the fix:**
  1. `:nth-var()` kept one state subscription per reinsertion of a state owner (unbounded while the owner lived).
  2. A disabled `<link>` accumulated two event listeners (and the fetched stylesheet text) per `href` change; the `error` listeners stayed forever.
  3. `element()` and `:just-checked` never deleted from their `WeakMap`s, so the V8 tables kept their peak capacity (+384 KB after 500 cycles of 1,000 components; +913 KB in the regression test).
- **After the fixes, every scenario is clean:** 0 retained detached elements, every library object count and counter back to baseline, global listeners unchanged, heap flat. Largest run: 10,000 full-feature components mounted and unmounted 100 times (1,000,000 component lifecycles, about 9 million elements) — heap 2.17 MB after cycle 1, 2.17 MB after cycle 100.
- **Long-running:** 1, 5 and 15 minutes of a continuously changing application: see section 6.
- **Explained, bounded growth (not a leak):** each *recompile* of a stylesheet with `state()` registers one new custom property in Blink (about 130 B; `CSS.registerProperty` cannot be undone). Measured: no effect on style recalculation even with 10,000 extra registrations. Identical `wave()`s no longer register anything on recompile.
- **The leak detector itself was validated** with a controlled artificial leak in the library (caught: 19,607 detached elements, 18,000 `Binding` objects, retainer path naming the planted array) and with a page-side leak (caught, and correctly attributed to the page, not the library). The artificial leak was removed.

## 1. Tools

| Tool | What it does |
|---|---|
| `benchmarks/audit/memory.mjs <scenario> --n= --cycles=` | Runs a scenario repeatedly. Baseline after one warm-up cycle. At checkpoints (cycles 1, 2, 5, 10, 20, 50, 100, …): full GC, then JS heap, DOM node count, JS event listeners (`Memory.getDOMCounters`), `stats()` and `stats().internal`, running animations. At the end (after a 1.1 s wait for the library's own timers): a heap snapshot. |
| Verdict | A leak is reported for: any retained detached DOM element; any library class (`Binding`, `Cell`, `StateRef`, `WaveInstance`, … read from `src/`) above its baseline count; any library counter above baseline (bindings, states, sources, observers, scheduled, queues, element-keyed maps, global listeners); global listeners on `document`/`window` different from baseline. Heap growth per cycle is reported separately (second checkpoint to end). |
| Retainer paths | For detached elements (or any class, `pathClass`), the shortest strong path from a GC root, printed as `owner -edge-> owner …`. |
| `heapdiff.mjs` | Heap snapshot diff by object type between two cycles, plus the retainer paths of the largest arrays (found the `WeakMap` table growth). |
| `stats().internal` | New, **development builds only** (stripped from the production bundle, verified by search): queue lengths (`queued`, `fresh`, `frameTasks`), pending timer/frame, element-keyed collections (`bindControls`, `outsiders`, `sizeSubjects`, `nthGroups`, `nthIndexed`, `changedChecking`, `waves`, `sheetRecords`, `watchers`, …), waiting state references, registered properties, diagnostics count. Plain counters and `size` reads: no element is retained, no cost in production. |
| Regression tests | `tests/browser/lifecycle.spec.ts` (heap snapshot and listener checks, Chromium) and `tests/browser/v04.spec.ts` (wave sharing, Chromium and WebKit). |

### Validation of the detector

| Run | Result |
|---|---|
| Library leak planted in `unbind()` (every unbound `Binding` pushed to a module array), 100 components × 20 cycles | **LEAK**: 19,607 detached elements; 18,000 `Binding`, 6,000 `StateRef`, 4,000 `Composite`, 2,000 each of 8 instance classes above baseline; +131 KB/cycle. Path: `… scope -ARTIFICIAL_LEAK-> Array -[12602]-> Binding -el-> <i class="o">`. |
| Same, after removing the planted leak | clean: 0 detached, nothing above baseline |
| Page keeps one removed component per cycle (`window.__keep`) | **LEAK** reported as 194 detached elements with path `Window -__keep-> Array -> <div class="cmp">`, and **no** library object above baseline: correctly attributed to the page |

(The snapshot labels showed `style="--rcss-6: …"` on the removed elements; that is Blink's lazily synchronized `style` attribute in the snapshot label. The real attribute was empty: verified in the page.)

## 2. Mount / unmount stress

Component = every runtime feature: 4 `state()`s, `on:` with `click`, `key(Escape)` and `outside(click)`, `bind:` on a text field and a checkbox, `when()` (runtime path), `:when()`, `:changed()`, `:nth-var()`, `:just-checked`, `previous()`, `direction()`, `live(50ms)`, `on(click, random())`, `pick()`, `visible()`, `mouse(x, local)`, `element(width)`, `wave()` — 9 elements. Each cycle: mount N, wait two frames, click a third of the toggles and a fifth of the tabs, type into every seventh field, click outside, move the pointer, wait a frame, remove everything.

Final build:

| N × cycles | heap after cycle 1 → end | detached | library objects / counters above baseline | listeners | time |
|---|---|---:|---|---|---:|
| 100 × 1,000 | 1.99 → 2.17 MB (flat from cycle 10: 2.12–2.17) | 0 | none | 20 → 20 | 67 s |
| 1,000 × 100 | 2.17 → 2.21 MB | 0 | none | 20 → 20 | 21 s |
| 1,000 × 1,000 | 2.17 → 2.25 MB (cycles 10–1,000: 2.21–2.25) | 0 | none | 20 → 20 | 197 s |
| 10,000 × 10 | 2.17 → 2.19 MB | 0 | none | 20 → 20 | 145 s |
| 10,000 × 100 | 2.17 → 2.17 MB (one transient checkpoint: 3.96 MB at cycle 20, back to 2.16 at cycle 50) | 0 | none | 20 → 20 | 1,323 s |
| 1,000 × 50, *production bundle* | 2.14 → 2.20 MB | 0 | (no class names in production) | 20 → 20 | – |

Before the `WeakMap` fix (same harness): 1,000 × 1,000 grew 2.40 MB (cycle 200) → 2.62 (500) → 3.01 MB (1,000); 10,000 × 100 ended at 3.67 MB.

Not run: 10,000 × 1,000 (about 3.7 hours at the measured 13 s per cycle; the 100-cycle run already covers 1 million component lifecycles and is flat).

## 3. State engine: high-risk cases

50 components, 100 repetitions each, final build. All clean: 0 detached elements, nothing above baseline.

| Case | What happens | heap start → end | B/cycle |
|---|---|---|---:|
| clickThenRemove | actions queue urgent work; the component is removed in the same task | 1.53 → 1.64 | 445 |
| removeInFrame | removal inside a frame callback that runs before the library's flush of that frame | 1.97 → 2.13 | 2,720 * |
| removeWhileAnimating | `:changed()` animations (2 s) and waves running at removal | 2.12 → 2.16 | 331 |
| insertRemoveSameTask | inserted and removed before the mutation observer runs | 2.16 → 2.16 | 20 |
| reinsert | the same nodes moved out (fragment) and back, with clicks | 2.43 → 2.61 | 1,566 * |
| unmatchWhilePending | class removed (rules stop matching) with state work pending | 2.14 → 2.20 | 418 |

\* "B/cycle" is the heap difference between the second checkpoint and the end divided by the cycles; with 100 cycles it is within GC noise (≤ 0.2 MB total) and no object class or counter grew. The `reinsert` case is the one that found the `:nth-var()` leak (below); before the fix it grew by one `StateRef` per component per cycle.

## 4. Forms (`bind:`)

100 forms × 100 cycles with text, number, checkbox, radio (unique group names), select and textarea; each cycle focuses, types, leaves an IME composition open (`compositionstart` without end), changes every control, resets half the forms, and removes everything with focus inside. Clean: 1.64 → 1.76 MB, 0 detached, `bindControls` 0 at the end, listeners 15 → 15.

## 5. Observers, listeners and stylesheets

**Observers and listeners.** In every scenario above, `stats().observers` (shared `ResizeObserver`, `IntersectionObserver`s, delegated listeners), `pointerListeners`, `intersectionObservers`, `actionListeners`, `waves`, running animations and the global listeners on `document` and `window` returned to their baseline. The library's `MutationObserver`s are permanent by design (one for elements, one for stylesheet sources, one for `:nth-var()` groups) and are disconnected by `stop()`.

**Stylesheet lifecycle** (50 elements, 200 operations each, final build):

| Operation | heap start → end (MB) | listeners | registered state / wave properties at the end | notes |
|---|---|---|---|---|
| add + remove `<style>` in one task | 1.29 → 1.40 | 15 → 15 | 0 / 0 | never compiled (removed before processing) |
| add, wait a frame, remove | 1.61 → 1.98 | 15 → 15 | 201 / 1 | one registration per compile (see below) |
| toggle `disabled` | 2.05 → 2.03 | 16 → 16 | 202 / 1 | no recompile |
| toggle `media` | 2.04 → 2.07 | 16 → 16 | 203 / 1 | no recompile |
| replace the text (recompile) | 2.00 → 2.21 | 16 → 16 | 404 / 1 | |
| replace a subtree containing a `<style>` | 2.05 → 2.14 | 15 → 15 | 605 / 1 | |
| switch alternate stylesheet sets | 2.14 → 2.15 | 15 → 15 | 605 / 1 | |
| change a `<link>` `href` (link left disabled by the previous step) | 2.14 → 2.18 | 15 → **17**, constant | 605 / 1 | one pending wait for the disabled link (2 listeners), by design; before the fix: +2 per change |
| `<link>` removed while loading | 2.16 → 2.16 | 17 → 17 | 605 / 1 | |

**Registered properties per compile.** `CSS.registerProperty` has no inverse. Each compile of a sheet with `state()` registers one property per `state()` declaration (inherits: false, so nested owners do not see each other's values). A heap diff over 400 recompiles shows exactly 400 `blink::PropertyRegistration` (+ 2 interpolation types each): about 130 B each on the Blink heap. Measured impact of 10,000 extra registrations: style recalculation of 5,000 elements 3.5 ms vs 3.5 ms; one further typed registration 3.2 ms vs 1.8 ms. Pages that do not rewrite their stylesheets are not affected. `wave()` properties are now shared by identical waves, so recompiling identical text adds none (it added one per wave per compile before).

## 6. Long-running stability

`benchmarks/audit/soak.mjs`: 200 full-feature components, 10 replaced every 500 ms, clicks/typing/keys/outside clicks/pointer moves every 100 ms, the container resized every 100 ms (`element()`), a second reactive stylesheet disabled/enabled every 10 s. Samples after a full GC. Pass = no counter or heap trend over the second half of the run larger than 3× the sample noise and 1 % of the mean.

| Duration | samples | heap first → last sample | heap trend (2nd half) | noise | counters | long tasks | frame p95 / worst |
|---|---:|---|---|---|---|---:|---|
| 1 min | 12 × 5 s | 3.19 → 3.45 MB | +66 KB/min (warm-up; within the pass threshold) | 9 KB | constant | 0 | 16.7 / 16.8 ms |
| 5 min | 30 × 10 s | 3.26 → 3.47 MB | −8 KB/min | 31 KB | constant | 0 | 16.7 / 16.8 ms |
| 15 min | 30 × 30 s | 3.39 → 3.57 MB (min 3.71, max 3.77 MB over the second half) | +3.4 KB/min | 9 KB | constant | 0 | 16.7 / 16.8 ms |

Counters over the 15-minute run (min = max for all of them): 2,000 bindings, 800 states, 1,400 sources, 201 animations, 225 JS event listeners, 400 bound controls, 200 `:nth-var()` groups, 200 `outside()` owners, 200 measured elements, 200 waves, 0 waiting references, 0 diagnostics. The scheduler queue varied between 0 and 302 with no trend. DOM nodes varied with the churn (3,262–3,427), no trend. **Result: pass, no unexplained monotonic growth.**

Not run: the optional 60-minute run (the 15-minute run has 30 samples, flat counters and a heap trend below the noise).

## 7. Leaks fixed

| # | Leak | Cause | Fix | Regression test | Before → after |
|---|---|---|---|---|---|
| M1 | `:nth-var()` state subscription per reinsertion (P0) | Removing a state owner removes its inline values: an attribute mutation on an ancestor of a `:nth-var()` group. The `:nth-var()` observer looked the group up in its ancestor index, which still listed the group just deleted, and queued it; the next run gave that orphan group a new `StateRef`, subscribed to the live cell and never disposed. Also redundant work on every later state change. | `run()` processes only groups still registered (`groups.get(parent) === g`), one line. | `lifecycle.spec.ts` "reinserting the same elements does not accumulate :nth-var() state subscriptions" | 20 reinsertions: 25 → 5 `StateRef`s (constant) |
| M2 | Event listeners on a disabled `<link>` (P0) | `linkSheet()` added `load` and `error` listeners with `once`. A disabled link fires neither until enabled; then only `load` fires and the `error` listeners stay. Each pending wait also kept the fetched text. | One pending wait per link; a newer load releases the older wait; whichever event fires removes both listeners. | `lifecycle.spec.ts` "href changes on a disabled <link> do not accumulate event listeners" | 6 changes: 12 listeners → ≤ 2, and 0 after enabling |
| M3 | Peak-size `WeakMap` tables (P1) | `element()` (`sizes`, `vertical`) and `:just-checked` (`known`) relied on GC to clear entries; dead keys pile up between full GCs and V8 keeps the grown table. | Explicit deletes on removal, then (performance fix P2) `element()` keeps one record per observed element in its existing `Map` instead of two `WeakMap`s. | `lifecycle.spec.ts` "element() and :just-checked release their per-element entries on removal" | 3 × 20,000 elements: +913 KB retained → < 150 KB; 1,000 × 1,000 cycles: 3.01 → 2.25 MB |

## 8. Recommendations

| | |
|---|---|
| **Fixed now** | M1, M2, M3 above. |
| **Before beta** | Deterministic generated names for `state()` properties (e.g. derived from the state name), so recompiles reuse registrations. Needs care: two sheets declaring the same state on one owner must not remove each other's inline value (`detach()` would remove a property another declaration still uses). |
| **Defer** | Hidden tabs: frame callbacks do not run, so jobs queued for elements removed while hidden stay queued until the tab is visible again (at most one per binding; released on the first frame). |
| **Accept** | One pending wait per disabled `<link>` (2 listeners) until it is enabled or removed. Permanent `MutationObserver`s while started. |
