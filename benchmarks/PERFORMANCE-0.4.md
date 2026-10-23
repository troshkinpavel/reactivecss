# Reactive CSS 0.4.0: runtime performance audit

Date: 2026-10-18. Machine: Apple M4 Max (14 cores, 36 GB), macOS 27.0. Browser: Playwright's Chromium 156.0.8078.4 (headless shell, software raster). Bundle: **`dist/reactive-css.min.js` (production)** unless stated. Raw data: `benchmarks/audit/results/` and `benchmarks/results.json` (every run kept, under `raw`).

## Executive summary

- **Idle pages cost nothing.** On seven idle page types (static values, state, forms, history, geometry, pointer/visibility sources), the library did **zero** work over 10 s: no timer ticks, no frame flushes, no jobs, no script time. Task time was 0.1–0.2 ms/s, the same as the page without the library within 0.1 ms/s.
- **Input latency equals plain JavaScript.** 9 widgets × 60 real (CDP) mouse and keyboard inputs, idle and under background load: the median from input to the first correct frame was 14 ms for both (one frame at 60 Hz), p95 within a frame of plain JavaScript in both directions, and **0 incorrect results out of 2,160**.
- **Startup** costs 6.5 ms of main-thread work for the bundle and an empty page, +41 ms at 1,000 components (5,000 elements) and +93 ms at 10,000 components (50,000 elements). First paint moves only at 10,000 components (120 → 184 ms).
- **One large cost was found and documented:** a stylesheet that mixes thousands of ordinary rules with one reactive rule is tokenized and rewritten whole (+64 ms for 5,000 rules; +11 ms when the reactive rule is in its own sheet).
- **`wave()` costs main-thread style every frame**, unlike a plain `@keyframes` animation of `translate`, which Chromium composites (171 ms/s vs 0 ms/s of main-thread style at 1,000 elements, measured with CDP metrics). This is inherent to animating a registered custom property and is the documented price of composability.
- **Fixed:** redundant `wave()` animations when several rules use the same wave (style −23 %, start −42 % in that case). Memory fixes are in [MEMORY-0.4.md](MEMORY-0.4.md).

## 1. Measurement infrastructure

### Audit of the existing harness (`benchmarks/run.mjs`, `bench.html`)

| Check | Before the audit | Now |
|---|---|---|
| Build measured | **Development ESM build** (`dist/index.js`, development checks) | **Production bundle** `dist/reactive-css.min.js` (`--build=dev` for the old behaviour) |
| Randomness | `Math.random` unseeded: random positions differed between runs and implementations | Seeded PRNG (mulberry32) installed before any script, same sequence for every implementation (`&seed=`) |
| Warm-up | Window started together with the workload | 0.5 s of workload, then a forced GC, then the 3 s window (steady state separated from startup) |
| Repetitions | One run | `--runs=N` (default 3), interleaved across scenarios, implementation order rotated each run; median reported, min–max range in `…Range` fields |
| Raw data | Only the single row | `raw` array in `results.json` keeps every run |
| Startup vs steady state | `initMs` mixed module evaluation in for the baseline only | `initMs` includes evaluating the bundle and `start()`; startup is measured separately (section 2) |
| Phases | script (CDP), style/layout/paint/composite/raster (trace) | unchanged; tracing overhead measured below |
| Browser version, machine | recorded | recorded, plus build, runs, warm-up, statistic |
| Cleanup | checked | unchanged (bindings and subscriptions after `clear()`) |

**Tracing overhead.** See section 7 (measured with `--no-trace`).

**Noise.** Every comparison below gives the median and the range of the runs. Differences inside the overlapping ranges are reported as "no change". Some later runs overlapped with the memory tests in another browser process (noted where it applies); the machine has 14 cores and each benchmark uses one renderer.

New tools (all in `benchmarks/audit/`):

| Tool | Measures |
|---|---|
| `runtime.mjs startup` | Main-thread task, script, style and layout time and first contentful paint, from navigation until the library has processed the page; the same page without the library as reference. 5 runs, median. |
| `runtime.mjs idle` | CPU over 10 s after a 2 s settle, per page type, vs the same page without the library; plus the library's own counters (ticks, flushes, jobs). |
| `runtime.mjs latency` | Real CDP mouse/keyboard input → first frame whose computed style is correct, vs a plain-JavaScript implementation of the same widget, idle and under background load. |
| `runtime.mjs scheduler` | Starvation, removal with a full queue, visibility. |
| `wave-sharing.mjs` | Platform experiment: one animation per element vs one inherited animation on an ancestor vs `@keyframes`. |
| `memory.mjs`, `soak.mjs`, `heapdiff.mjs` | Memory and long-running stability: see [MEMORY-0.4.md](MEMORY-0.4.md). |

## 2. Startup

A component = owner with `state()` ×2, an `on:` action, `when()`, `:when()` and `:nth-var()` (5 elements). "+task" is main-thread task time above the same page without the library (median of 5).

| Page | +task ms | script ms | style ms (none) | layout ms (none) | FCP ms (none) | compile ms |
|---|---:|---:|---:|---:|---:|---:|
| empty (bundle + `start()`) | 6.5 | 3.1 | 0.1 (0.1) | 0 (0) | – | 1.2 |
| 10 components | 7.5 | 3.6 | 0.3 (0.1) | 3.0 (2.9) | 8 (8) | 1.2 |
| 100 components | 9.5 | 4.3 | 0.8 (0.3) | 3.6 (3.1) | 12 (12) | 1.1 |
| 1,000 components | 41.2 | 10.7 | 16.6 (2.0) | 9.3 (6.3) | 28 (28) | 1.2 |
| 10,000 components | 92.8 | 48.8 | 18.4 (18.0) | 38.1 (37.9) | **184 (120)** | 1.2 |
| 1,000 components, linked sheet (fetched) | 37.2 | 3.8 | 15.9 (2.0) | 9.1 (6.5) | 28 (28) | 1.2 |
| 5,000 ordinary rules only | 2.3 | 1.9 | 1.9 (1.8) | 3.4 (3.3) | 20 (20) | 0 |
| 5,000 ordinary rules + reactive rules, **same sheet** | **64.5** | 56.7 | 4.9 (1.9) | 3.5 (3.1) | 20 (20) | **32.2** |
| 5,000 ordinary rules + reactive rules, separate sheet | 10.6 | 4.8 | 2.6 (1.8) | 3.4 (3.1) | 20 (20) | 1.1 |

Findings:
- A sheet without reactive syntax is skipped by one regular-expression test (+2.3 ms for 5,000 rules).
- A sheet *with* reactive syntax is tokenized and rewritten whole through the CSSOM. For 5,000 rules that is 32 ms of compile plus about 24 ms of rule replacement. **Recommendation (documented): keep reactive rules in their own stylesheet.** A partial rewrite (replace only changed rules) is possible but needs a reliable mapping between source chunks and CSSOM rules (the browser drops invalid rules and comments); deferred.
- At 1,000 components the library runs after the first paint (FCP unchanged) and costs one extra full style recalculation (the rewritten sheet and the registered properties invalidate all styles). At 10,000 components its work lands before the first paint and delays it by 64 ms.

## 3. Idle CPU

1,000 elements per page, production bundle, 10 s window after a 2 s settle, median of 3. "none" = same DOM and CSS without the library (for `wave`, a plain `@keyframes` animation of `translate`).

| Page | task ms/s (none) | script ms/s | style ms/s (none) | style recalcs / 10 s | library ticks / flushes / jobs |
|---|---:|---:|---:|---:|---|
| static values (`random()`, `pick()`) | 0.17 (0.05) | 0 | 0 (0) | 0 | 0 / 0 / 0 |
| state + actions + `when()` + `:when()` + `:nth-var()` | 0.20 (0.12) | 0 | 0 (0) | 0 | 0 / 0 / 0 |
| forms with `bind:` | 0.17 (0.10) | 0 | 0 (0) | 0 | 0 / 0 / 0 |
| history: `previous()`, `direction()`, `:changed()` | 0.15 (0.11) | 0 | 0 (0) | 0 | 0 / 0 / 0 |
| `element()` (static layout) | 0.19 (0.11) | 0 | 0 (0) | 0 | 0 / 0 / 0 |
| `visible()` + `mouse(x, local)`, no input | 0.11 (0.08) | 0 | 0 (0) | 0 | 0 / 0 / 0 |
| `wave()` (animating by design) | **280.9 (0.08)** | 0 | **170.8 (0)** | 600 (0) | 0 / 0 / 0 |
| `live(1s)` (updates by design) | 9.25 (0.10) | 2.12 | 4.73 (0) | 10 (0) | 10 / 10 / 10,000 |

Idle pages: the scheduler arms no timer and requests no frame when nothing is dirty, and the shared observers deliver nothing. The `live(1s)` row shows the expected cost of one update per second for 1,000 values: 10 ticks, 10 flushes, 1,000 jobs each.

`wave()`: its animations run without JavaScript (0 script, 0 library jobs), but every frame recalculates the style of every animated element on the main thread. The plain `@keyframes` animation of `translate` runs on the compositor in this setup, with no main-thread style work at all. The steady-state Chromium trace agrees (181 ms/s vs 0, section 8). See section 5.

## 4. Interaction latency

Input = real mouse or keyboard events through the DevTools protocol. Latency = from the input event's timestamp to the end of the first frame whose computed style matches the expected result (checked after rendering, every frame, up to 8 frames). 100 widget instances on the page, 60 inputs per row, median of each distribution. **Busy** = 1,000 elements animated by `@keyframes`, 1,000 elements updated by a JavaScript interval every 100 ms, and 8 ms of application work every 32 ms (identical for both implementations, no library involved).

| Widget | idle p50 / p95 / max, Reactive CSS | idle, plain JS | busy, Reactive CSS | busy, plain JS |
|---|---|---|---|---|
| toggle (`state`, `toggle()`, `when()`) | 14.1 / 15.9 / 22.1 | 14.1 / 14.8 / 21.3 | 14.1 / 20.2 / 28.1 | 12.8 / 20.5 / 33.1 |
| counter (`increment()`) | 13.9 / 15.6 / 31.2 | 13.8 / 15.1 / 27.0 | 13.0 / 20.8 / 26.6 | 12.0 / 22.7 / 23.2 |
| tabs (`set(sibling-index())`, `:nth-var()`) | 14.0 / 15.8 / 36.1 | 13.9 / 15.0 / 24.8 | 11.6 / 18.0 / 22.1 | 12.8 / 19.8 / 27.7 |
| accordion (`when()` → `display`) | 14.1 / 15.7 / 22.7 | 13.9 / 16.0 / 20.2 | 11.9 / 18.9 / 36.4 | 13.0 / 22.1 / 41.1 |
| dropdown closed by `outside()` | 14.6 / 16.7 / 27.5 | 14.8 / 16.2 / 17.8 | 10.0 / 20.1 / 35.1 | 8.5 / 17.1 / 22.2 |
| keyboard (`key(ArrowRight)`) | 13.9 / 15.6 / 16.2 | 13.9 / 15.2 / 15.8 | 12.6 / 16.0 / 20.1 | 12.7 / 17.9 / 21.2 |
| text input with `bind:` | 13.9 / 15.6 / 15.8 | 13.9 / 15.1 / 15.8 | 12.4 / 16.9 / 18.9 | 13.1 / 21.0 / 21.8 |
| history (`previous()`, `direction()`) | 14.0 / 15.4 / 30.5 | 14.0 / 14.8 / 25.3 | 12.3 / 20.0 / 36.6 | 12.5 / 18.1 / 29.7 |
| conditional (`:when()`) | 14.0 / 15.5 / 15.8 | 14.1 / 15.7 / 16.2 | 11.3 / 15.9 / 24.7 | 9.5 / 17.9 / 23.2 |

All 2,160 inputs produced the correct style (0 incorrect; the limit was 8 frames). Idle p95 values of 15–17 ms mean the correct style was in the first frame after the input for at least 95 % of inputs in every row, with both implementations. The differences between the implementations are within one frame in both directions and within the run-to-run spread; no widget is slower with Reactive CSS beyond noise. (Busy-load medians below one frame happen when the input arrives late in a frame.)

Two harness problems were found and fixed while building this test: the probe must be installed *before* the input is sent (Chromium prioritizes input over script tasks, so a concurrent install lost clicks), and the first version of the tabs widget used one row for tabs and panels, which `:nth-var()` (positional, like `:nth-child()`) does not support.

## 5. `element()` and `wave()`

### `element()`

CPU profile (`benchmarks/profile.mjs geometry 1000 rcss`, container resized every frame, 3 s): besides `setProperty` (28 ms, the write itself, also paid by the hand-written version), the library's own time was in the resize callback (`onResize` 32 ms self) and GC (41 ms): per entry and frame it read and wrote two `WeakMap`s, allocated a size object, and called `forEach` with a new closure. **Fixed:** one record per observed element in the existing `Map` (size fields updated in place, the instance keeps a direct reference, no per-entry allocation). Measured against a hand-written `ResizeObserver` writing the same property **in the same run** (absolute numbers differ between sessions, so the ratio is the fair comparison; 3 runs, median):

| n | script before (plain) | script after (plain) | ratio before → after | layout after (plain) | p95 |
|---:|---|---|---|---|---|
| 1,000 | 30.0 (22.2) | 37.0 (31.7) | 1.35× → **1.17×** | 50.5 (80.3) | 16.7 ms (16.7) |
| 10,000 | 192.4 (126.3) | 151.0 (125.5) | 1.52× → **1.20×** | 210.3 (308.9) | 33.4 ms (33.4) |

No duplicate observer work: one shared `ResizeObserver`; an element read by `element(width)` and `element(height)`, or by several rules, is observed once. Layout stays 35–40 % below the hand-written version because values are written in the next frame, not inside the observer callback (which forces a second layout pass).

### `wave()`

**Several rules with the same wave on one element** (`wave2` scenario: `.e` and `#root > .e` both use `wave(-10px, 10px, 2s)`), 1,000 elements, 3 runs:

| | style ms/s (range) | start ms | heap MB |
|---|---|---|---|
| before: one animation per rule | 176.8 (173.9–178.9) | 20.0 | 1.92 |
| **after: one shared animation** | **135.4 (133.0–137.0)** | **11.6** | 1.89 |
| single rule (reference), after | 123.8 (121.2–128.8) | 9.8 | 1.68 |

The single-rule case did not change beyond noise (130.8 → 123.8, overlapping ranges): no gain claimed for it. Waves with *different* arguments still run one animation each, because the winning declaration can change at runtime (`:hover`, classes). A rule that starts matching later joins the running animation (same phase).

**Cost vs `@keyframes`** (kept visible on purpose): animating a registered custom property recalculates style on the main thread every frame; a `@keyframes` animation of `translate` is composited. Two independent measurements, 1,000 elements:
- Chromium trace, steady state (section 8): `wave()` 181 ms/s of style vs **0** for `@keyframes`.
- CDP main-thread metrics (idle test, section 3): 171 ms/s vs **0**.

The pre-audit trace showed 83–66 ms/s for `@keyframes` because its window started right after the page started; in steady state the plain animation runs entirely on the compositor. Frame p95 was equal (16.7 ms at 1,000; 50 ms for both at 10,000, where the software rasterizer of the headless shell is the limit). Use `wave()` when the value must feed `calc()`, several properties, or coexist with the author's animations; otherwise prefer `@keyframes`.

**Sharing across dense groups (experiment, platform code only, `wave-sharing.mjs`):**

| n | one animation per element (what `wave()` does) | one inherited animation on the container | `@keyframes translate` |
|---:|---|---|---|
| 100 | style 82.8 ms/s, task 128.9 | 23.8, 54.9 | 0, 0.6 |
| 1,000 | 163.3, 260.8 | 100.9, 205.4 | 0, 0.6 |
| 10,000 | 538.0, 1,004.7 (30 style recalcs/s: frames dropped) | 256.5, 520.7 (60/s) | 0, 0.2 |

Sharing would cut style time by 38–71 %. It is **not** implemented: it needs an `inherits: true` property on an ancestor (visible to every descendant, not only the bound elements) and one phase for the whole group (today each element starts its wave when it starts matching). That is a semantic change and a design decision for a later version.

**Reduced motion:** `prefers-reduced-motion: reduce` gives the midpoint with no animation and no per-frame work; changes apply live (tested in Chromium and WebKit).

## 6. Scheduler

`runtime.mjs scheduler` (development build for queue sizes):

| Test | Result |
|---|---|
| Starvation: 20,000 `live(random(), 50ms)` values (far beyond the 4 ms frame budget) + a toggle clicked 30 times | toggle p50 25.2 ms, p95 35.8 ms, 0 lost; background: 405,668 jobs/s, 40 flushes/s, **100 % of the 20,000 values updated** within 2 s; queue at most 20,001 (one entry per job: deduplicated) |
| Removal with a full queue: 10,000 `on(click, random())` jobs queued, everything removed in the same task | next frame: 8,000 dead jobs skipped in 0.2 ms (frame budget), the remaining 2,000 in the frame after; then bindings 0, sources 0, queue 0 |
| Visibility (emulated: the headless shell keeps background pages visible) | timer ticks 10/s → 0/s while hidden → 11/s after |
| Microtasks | Code review: no promise chains in the scheduler; `:changed()` waits with one `Promise.allSettled` per change. |

Urgent (input) jobs always run in the next frame regardless of the budget; background jobs continue oldest first, so no job waits more than a few frames.

## 7. Tracing overhead

With Chromium tracing on, the CDP `ScriptDuration` metric missed most timer-driven script time in some runs (bimodal). Same 4 scenarios, 1,000 elements, 3 runs each:

| Scenario | impl | script ms/s, untraced (range) | script ms/s, traced (range) |
|---|---|---|---|
| live200 | rcss | 21.4 (21.2–22.1) | 4.4 (4.4–20.5) |
| live200 | plain JS | 12.8 (12.4–13.3) | 2.6 (2.5–12.8) |
| live200 | plain JS, same vars | 17.8 (16.8–19.7) | 3.6 (3.5–17.7) |
| components (rAF-driven clicks) | rcss | 6.8 (6.7–7.0) | 6.7 (6.7–8.8) |
| geometry | rcss | 43.7 (43.6–43.7) | 42.0 (29.0–43.6) |

This was the source of the large `live()` script variance reported in 0.4. **Fixed in `run.mjs`:** script time, frames, clicks and library counters come from an untraced 3 s window; the rendering phases from a second, traced 3 s window of the same workload.

## 8. Fair baselines (1 to 10,000 elements)

`node benchmarks/run.mjs 1 10 100 1000 10000 --only=… --runs=3`, production bundle, corrected harness (script from the untraced window, phases from the traced one). Median of 3 runs; every run and its range are in `benchmarks/audit/results/baselines.json`. "plain JS" writes the target property directly (or toggles an attribute with one delegated listener, or uses one `ResizeObserver`, or `@keyframes`); "same custom properties" writes exactly what Reactive CSS writes, which is the fair comparison for rendering cost.

| Scenario | n | Reactive CSS: script / style / layout ms/s · p95 ms · heap MB | plain JS | plain JS, same custom properties |
|---|---:|---|---|---|
| random() static | 1 | 1.2 / 0 / 0 · 16.7 · 1.39 | 1.1 / 0 / 0 · 16.7 · 1.15 | – |
|  | 10 | 1.1 / 0 / 0 · 16.7 · 1.39 | 1.2 / 0 / 0 · 16.7 · 1.2 | – |
|  | 100 | 1 / 0 / 0 · 16.7 · 1.39 | 1.1 / 0 / 0 · 16.7 · 1.2 | – |
|  | 1,000 | 1 / 0 / 0 · 16.7 · 1.42 | 1.2 / 0 / 0 · 16.7 · 1.24 | – |
|  | 10,000 | 1.1 / 0 / 0 · 16.7 · 1.55 | 1.1 / 0 / 0 · 16.8 · 1.21 | – |
| live(random(), 200ms) | 1 | 2.2 / 0.6 / 0 · 16.8 · 1.39 | 1.4 / 0.4 / 0 · 16.7 · 1.15 | 1.5 / 0.7 / 0 · 16.7 · 1.15 |
|  | 10 | 2.4 / 1.4 / 0 · 16.8 · 1.46 | 1.7 / 0.6 / 0 · 16.8 · 1.2 | 1.7 / 1.4 / 0 · 16.7 · 1.2 |
|  | 100 | 4.6 / 5.8 / 0 · 16.7 · 1.51 | 3.1 / 2.4 / 0 · 16.7 · 1.2 | 3.6 / 5.8 / 0 · 16.8 · 1.21 |
|  | 1,000 | 20.6 / 25.8 / 0 · 16.7 · 1.95 | 12.2 / 12.7 / 0 · 16.7 · 1.25 | 18.4 / 29.2 / 0 · 16.7 · 1.25 |
|  | 10,000 | 66.6 / 102.7 / 0 · 16.8 · 6 | 61.3 / 46.2 / 0 · 16.8 · 1.44 | 80.5 / 112.4 / 0 · 33.3 · 1.42 |
| mouse(x) per frame | 1 | 6 / 4 / 0 · 16.7 · 1.37 | 3.9 / 2 / 0 · 16.7 · 1.15 | 4.2 / 3.8 / 0 · 16.8 · 1.15 |
|  | 10 | 7.3 / 9.1 / 0 · 16.7 · 1.38 | 4.3 / 4.1 / 0 · 16.7 · 1.15 | 5.4 / 9.3 / 0 · 16.8 · 1.15 |
|  | 100 | 5.9 / 17 / 0 · 16.7 · 1.4 | 8.8 / 17.1 / 0 · 16.7 · 1.15 | 15.5 / 49.8 / 0 · 16.7 · 1.15 |
|  | 1,000 | 4.4 / 95.6 / 0 · 16.7 · 1.51 | 27.5 / 73.4 / 0 · 16.7 · 1.18 | 39.9 / 139.7 / 0 · 16.8 · 1.18 |
|  | 10,000 | 2.2 / 271.1 / 0 · 16.7 · 2.42 | 82 / 213.8 / 0 · 16.7 · 1.35 | 163.1 / 535.6 / 0 · 33.4 · 1.35 |
| toggle components, 20 clicks/frame | 1 | 16.1 / 0 / 0 · 16.8 · 1.46 | 11.1 / 1.6 / 0 · 16.7 · 1.15 | – |
|  | 10 | 18.4 / 8.1 / 6.8 · 16.8 · 1.49 | 11.6 / 4.7 / 6.7 · 16.8 · 1.15 | – |
|  | 100 | 15.8 / 8.4 / 14.2 · 16.7 · 1.56 | 11.4 / 5.1 / 13.8 · 16.7 · 1.15 | – |
|  | 1,000 | 7 / 5.4 / 24.6 · 16.7 · 2.16 | 4.2 / 4.2 / 25.1 · 16.7 · 1.17 | – |
|  | 10,000 | 15.7 / 10.1 / 159.2 · 16.8 · 7.89 | 11 / 14.2 / 156.7 · 16.8 · 1.31 | – |
| one state → n when() | 1 | 6.7 / 5.4 / 4.2 · 16.8 · 1.44 | 4.3 / 2.7 / 3.8 · 16.8 · 1.15 | – |
|  | 10 | 5.9 / 6.5 / 4.9 · 16.8 · 1.44 | 3.8 / 4.8 / 5.1 · 16.7 · 1.15 | – |
|  | 100 | 6.2 / 22.6 / 14.6 · 16.7 · 1.44 | 4 / 19.9 / 14.2 · 16.7 · 1.15 | – |
|  | 1,000 | 2.1 / 137.7 / 41.7 · 16.7 · 1.44 | 1.1 / 148.4 / 42 · 16.8 · 1.15 | – |
|  | 10,000 | 0.8 / 832.1 / 50 · 116.7 · 1.44 | 0.3 / 870.3 / 45.4 · 133.4 · 1.15 | – |
| bind: text, 20 inputs/frame | 1 | 18.2 / 7.8 / 7.6 · 16.7 · 1.45 | 16.8 / 4.8 / 6.8 · 16.8 · 1.15 | – |
|  | 10 | 18.1 / 12.3 / 12.8 · 16.8 · 1.49 | 17.2 / 7.3 / 13.1 · 16.7 · 1.15 | – |
|  | 100 | 18.6 / 11.8 / 19.3 · 16.7 · 1.54 | 16.3 / 7.5 / 20.4 · 16.8 · 1.15 | – |
|  | 1,000 | 12.2 / 18.7 / 55.2 · 16.7 · 2.04 | 10.9 / 10 / 60.4 · 16.8 · 1.17 | – |
|  | 10,000 | 15.3 / 20.8 / 181 · 16.8 · 6.71 | 13.5 / 16.8 / 190.6 · 16.7 · 1.31 | – |
| element(width), resize every frame | 1 | 4.6 / 4.2 / 3.1 · 16.7 · 1.41 | 3.1 / 4.7 / 4.2 · 16.7 · 1.16 | – |
|  | 10 | 6 / 8.6 / 5 · 16.7 · 1.43 | 4.1 / 8.3 / 8 · 16.7 · 1.16 | – |
|  | 100 | 15.5 / 33.9 / 17.8 · 16.7 · 1.47 | 13.1 / 32.3 / 31 · 16.7 · 1.16 | – |
|  | 1,000 | 36.8 / 106.5 / 51 · 16.7 · 1.78 | 30.4 / 86.3 / 78.4 · 16.7 · 1.21 | – |
|  | 10,000 | 153.1 / 415.7 / 206.3 · 33.4 · 4.69 | 122.9 / 322.3 / 305.1 · 33.4 · 1.26 | – |
| wave() vs @keyframes | 1 | 1.2 / 5 / 0 · 16.8 · 1.41 | 1.2 / 0 / 0 · 16.7 · 1.15 | – |
|  | 10 | 1.2 / 14.1 / 0 · 16.8 · 1.42 | 1.2 / 0 / 0 · 16.7 · 1.15 | – |
|  | 100 | 1.2 / 77.8 / 0 · 16.7 · 1.46 | 1.2 / 0 / 0 · 16.7 · 1.15 | – |
|  | 1,000 | 0.3 / 180.8 / 0 · 16.7 · 1.68 | 0.3 / 0 / 0 · 16.8 · 1.17 | – |
|  | 10,000 | 3.1 / 554.1 / 0 · 50.1 · 4.22 | 0.2 / 0 / 0 · 50.1 · 1.31 | – |
| two rules, same wave() | 1 | 1.2 / 5 / 0 · 16.7 · 1.42 | 1.3 / 0 / 0 · 16.8 · 1.15 | – |
|  | 10 | 1.1 / 14.8 / 0 · 16.7 · 1.44 | 1.1 / 0 / 0 · 16.8 · 1.15 | – |
|  | 100 | 1.2 / 83.2 / 0 · 16.7 · 1.5 | 1.3 / 0 / 0 · 16.7 · 1.15 | – |
|  | 1,000 | 0.3 / 193.4 / 0 · 16.8 · 1.89 | 0.4 / 0 / 0 · 16.7 · 1.17 | – |
|  | 10,000 | 2.3 / 584.9 / 0 · 50.1 · 6.22 | 0.2 / 0 / 0 · 50.1 · 1.31 | – |

Reading the table:
- **Static values** cost nothing after start (native `random()`); start 7 ms at 10,000 elements (plain JS 5.3 ms).
- **`live()`** at 10,000: script 66.6 vs 80.5 ms/s for JavaScript writing the same custom properties (and p95 16.8 vs 33.3 ms, thanks to the frame budget). Plain JS writing `translate` directly is cheaper in style (46 vs 103 ms/s): custom-property indirection is the price of keeping values in CSS.
- **`mouse()`**: script 2.2 vs 163 ms/s for per-element custom properties at 10,000 (one shared value, written on a common ancestor).
- **Components, fan-out, `bind:`**: script within 1–7 ms/s of the delegated-listener JavaScript; style and layout equal within noise; p95 equal. Memory: about 0.6–0.7 KB per bound component (10,000: 7.9 MB vs 1.3 MB).
- **`element()`**: script 1.2–1.5× a hand-written `ResizeObserver`, layout 35–40 % lower, p95 equal.
- **`wave()`**: see section 5.
- Small sizes (1–100): absolute differences are a few ms/s and within the run ranges; the fixed costs are the bundle's start (about 4 ms) and its heap (about 0.25 MB).

## 9. Full benchmark (production bundle)

`node benchmarks/run.mjs 1000 10000 --runs=3` regenerated `benchmarks/results.{json,md}` with the corrected harness: 106 rows (median of 3 runs; 318 raw runs kept). Every row returns to 0 bindings and 0 subscriptions after cleanup, with no diagnostics. Compared with the 0.3.1 record (`benchmarks/baseline/results-v0.3.1.json`, older harness: development build, one run), frame p95 is equal or better in every scenario at 1,000 and 10,000 elements, and the JS heap is within ±0.03 MB (except `mouse`/`mouselocal` at 10,000, 0.13–0.14 MB lower). Script columns are not compared with 0.3.1: the old harness under-counted timer-driven script (section 7). The fan-out p95 at 10,000 (116.7 vs 216.7 ms) improved, but it is dominated by the browser's style recalculation (865 ms/s) and is not claimed as a library gain.

## 10. Recommendations

| | |
|---|---|
| **Fixed now** | Duplicate `wave()` animations; `element()` per-entry overhead; benchmark harness (production bundle, seeds, warm-up, repetitions, untraced script time). |
| **Before beta** | Decide on group-shared `wave()` animations (38–71 % less style time, semantic change). Run the latency and idle tests on a real (non-headless, GPU) Chrome and Safari. |
| **Defer** | Partial stylesheet rewrite for very large mixed sheets (document: keep reactive rules in their own sheet). |
| **Accept** | `wave()`'s main-thread style cost; one extra full style recalculation at start; custom-property indirection cost vs direct property writes. |
