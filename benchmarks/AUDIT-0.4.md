# Reactive CSS 0.4.0: performance, memory and runtime audit

Date: 2026-10-18. Scope: the 0.4.0 runtime (`src/`), its production bundle and the benchmark harness. Machine: Apple M4 Max (14 cores, 36 GB), macOS 27.0. Engines: Playwright Chromium 156.0.8078.4 (headless shell) and WebKit 27.2; Firefox could not be started (see Verification). Details: [MEMORY-0.4.md](MEMORY-0.4.md), [PERFORMANCE-0.4.md](PERFORMANCE-0.4.md). Raw data: `benchmarks/audit/results/`.

## Executive summary

**Runtime health: good.** The library does no work on idle pages, matches hand-written JavaScript on input latency, and returns every object, listener, observer and animation it creates. The audit found **3 leaks**, **1 redundant-work problem** and **2 harness errors**, all fixed with regression tests and before/after measurements. No public API changed, no CSS function was added, and stylesheets are still rewritten through the CSSOM (no generated `<style>`), so the CSP behavior is unchanged.

| Area | Result |
|---|---|
| Leaks | 3 found, 3 fixed (`:nth-var()` subscriptions on reinsertion; listeners on disabled `<link>`s; peak-size `WeakMap` tables). After the fixes: 0 retained detached elements and no growth in any of 22 scenario runs, up to 10,000 components × 100 mount/unmount cycles. |
| Long-running | 1, 5 and 15 minutes of continuous churn and interaction: every library counter constant, heap trend +3.4 KB/min against 9 KB noise (15 min), 0 long tasks, no frame over 16.8 ms. Pass. |
| Idle CPU | Zero library work on 7 idle page types (no timers, frames, jobs or script). |
| Input latency | Same as plain JavaScript (p50 14 ms = next frame, idle and under load), 0 wrong results in 2,160 real inputs. |
| Startup | +6.5 ms empty, +41 ms at 1,000 components, +93 ms at 10,000 (first paint +64 ms only at 10,000). |
| Main bottlenecks | `wave()` style recalculation (registered property animations are not composited); stylesheets mixing thousands of ordinary rules with reactive ones (+64 ms per 5,000 rules); `element()` and `live()` per-element custom property writes (browser style cost, also paid by equivalent JavaScript). |

## Findings

Priority as defined for this audit: P0 = leaks, unbounded growth, wrong cleanup; P1 = redundant work, excessive initialization; P2 = micro-optimizations.

| # | Pri | Finding | Status | Evidence → result |
|---|---|---|---|---|
| M1 | P0 | `:nth-var()`: removing and reinserting a state owner left one state subscription (and redundant work on every state change) per reinsertion | **Fixed** | 20 reinsertions: 25 → 5 `StateRef`s. Test fails without the fix. |
| M2 | P0 | `<link>`: each `href` change while disabled added 2 listeners and kept the fetched text; `error` listeners stayed after enabling | **Fixed** | 6 changes: 12 listeners → ≤ 2, 0 after enabling. Test fails without the fix. |
| M3 | P1 | `element()` / `:just-checked` `WeakMap`s were never deleted from; V8 kept the peak table size | **Fixed** | 1,000 components × 1,000 cycles: 3.01 → 2.25 MB; test: +913 KB → < 150 KB. |
| P1 | P1 | Several rules with the same `wave()` ran one animation each on the same element (only one visible) | **Fixed**: identical waves share property, keyframes and one animation per element | 1,000 elements, two rules: style 177 → 135 ms/s, start 20 → 12 ms; recompiles register no new wave property. Test fails without the fix. |
| P2 | P2 | `element()` resize handling: three `WeakMap` operations, an object and a closure per entry per frame | **Fixed**: one record per observed element, no per-entry allocation | Script vs a hand-written `ResizeObserver` (same run): 1,000: 1.35× → 1.17×; 10,000: 1.52× → 1.20× (192 → 151 ms/s). |
| H1 | – | Benchmarks measured the development ESM build, one unseeded run, no warm-up | **Fixed** | Production bundle by default; seeded `Math.random`; 0.5 s warm-up + GC; 3 interleaved runs, median and range; raw runs kept. |
| H2 | – | With Chromium tracing on, CDP `ScriptDuration` missed most timer-driven script in some runs (the "`live()` variance" reported in 0.4: 7–36 ms/s) | **Fixed** | Script, frames and clicks now come from an untraced window, phases from a separate traced window. `live200` at 1,000: 21.4 ms/s (range 21.2–22.1) untraced vs 4.4 (4.4–20.5) traced. |
| R1 | P1 | One reactive rule in a large stylesheet makes the whole sheet compile and rewrite (5,000 rules: +64 ms vs +11 ms in a separate sheet) | Documented; partial rewrite deferred | Needs a reliable source-chunk ↔ CSSOM-rule mapping. |
| R2 | P1 | `wave()` animates a registered custom property: main-thread style every frame, where `@keyframes translate` is composited | Accepted, documented | 1,000 elements: 171 ms/s main-thread style vs 0. Sharing one inherited animation on an ancestor would cut it 38–71 % but changes semantics (one phase for the group, value visible to descendants): design decision, deferred. |
| R3 | P2 | Each stylesheet recompile registers one new property per `state()` (about 130 B in Blink, permanent) | Deferred (before beta) | No measurable style cost up to 10,000 extra registrations. |
| R4 | P2 | Hidden tab: queued jobs of removed elements wait for the next frame | Accepted | Bounded: one per binding; released on the first visible frame. |
| R5 | – | A programmatic `el.click()` in the same task that inserted `el` is ignored (behavior is attached when the mutation observer delivers) | Accepted, documented | Real input cannot arrive in that task. |

## What was checked and found healthy

- **Scheduler.** No starvation: with 20,000 `live(50ms)` values (beyond the frame budget, 405,000 jobs/s, all values updating) a toggle still updated in the next frames (p50 25 ms, p95 36 ms, 0 lost). The queue is bounded by the number of jobs (deduplicated by a flag); 10,000 dead jobs after a mass removal cost 0.2 ms and drain within two frames; periodic work stops while the tab is hidden (10 → 0 ticks/s) and resumes. No microtask loops (no promise chains in the scheduler; `:changed()` waits with one `Promise.allSettled` over the `finished` promises of the animations a change started).
- **Cleanup paths.** Removal during pending urgent work, inside a frame before the flush, with `:changed()` animations and waves running, before the mutation observer ran, by losing the matching class, and by reinsertion; forms removed with focus inside and an IME composition open; nine stylesheet lifecycle operations. All return to baseline (MEMORY section 3–5).
- **Correctness under load.** All 2,160 latency inputs produced the right style, half of them under background load. The browser test suite was also run with Chromium's CPU throttled 4× (`RCSS_CPU_THROTTLE=4`, verified effective: a fixed loop took 10.8 → 46.0 ms): all 106 Chromium tests pass, including cascade, CSP, state, `bind:`, `:changed()` timing and 0.4 tests.
- **CSP and security.** The CSP (5 real policies) and security regression suites pass after the changes (Verification).

## Changes made

| File | Change |
|---|---|
| `src/selectors/nth-var.ts` | M1: skip groups no longer registered |
| `src/core/engine.ts` | M2: one pending `linkSheet()` wait per link, both listeners removed |
| `src/selectors/just-checked.ts` | M3: delete on removal |
| `src/functions/geometry.ts` | M3 + P2: one `Subject` record per observed element in the existing `Map` |
| `src/functions/wave.ts` | P1: identical call sites share data; one reference-counted animation per element per wave |
| `src/core/log.ts`, `scheduler.ts`, `engine.ts`, `elements.ts`, `state/*.ts`, `functions/sources.ts`, `wave.ts`, `geometry.ts`, `typed.ts`, `nth-var.ts`, `changed.ts` | Development-only probes for `stats().internal` (removed from the production bundle by the `__DEV__` define, verified by search). All audit changes together grew the minified bundle from 81,724 to 82,384 bytes |
| `benchmarks/bench.html`, `run.mjs`, `profile.mjs` | H1, H2; `wave2` scenario |
| `benchmarks/audit/*` | New audit tools |
| `tests/browser/lifecycle.spec.ts`, `v04.spec.ts`, `helpers.ts` | 4 regression tests; optional CPU throttling |
| `README.md`, `docs/extensions-0.4.md`, `CHANGELOG.md` | Wave sharing, harness method, audit fixes |

## Verification

Final build, 2026-10-18.

| Check | Result |
|---|---|
| TypeScript (`tsc --noEmit`, strict) | pass |
| Unit tests (vitest) | 49 / 49 |
| Distribution (`npm run test:dist`: bundle smoke, Node ESM import, TypeScript consumer) | pass |
| Browser tests, Chromium 156 | 106 / 106 (includes 3 new lifecycle tests and 1 new wave test) |
| Browser tests, WebKit 27.2 | 102 passed, 4 skipped (heap snapshot / listener inspection tests need the Chrome DevTools Protocol) |
| Browser tests, Chromium with 4× CPU throttling | 106 / 106 |
| CSP (5 policies, real headers), security, cascade | pass in Chromium and WebKit (part of the suites above) |
| Firefox (Playwright Firefox 1555) | **not verified**: the browser does not start on this machine ("Could not find profile folder"), as in 0.3.1 and 0.4.0 |
| Memory / leak scenarios (22 runs) | clean ([MEMORY-0.4.md](MEMORY-0.4.md)) |
| Long-running (1, 5, 15 min) | pass |
| Benchmarks (production bundle, 3 runs) | full matrix at 1,000 and 10,000 (106 rows) and fair baselines at 1–10,000 (9 scenarios): all clean after cleanup; frame p95 equal to or better than 0.3.1 in every scenario; no regression |
| Regression tests fail without their fix | checked for all 4 (fix reverted, test failed, fix restored) |

## Recommendations

| When | What |
|---|---|
| **Fixed now** | M1, M2, M3, P1, P2, H1, H2. |
| **Before beta** | Deterministic `state()` property names (R3). A decision on group-shared `wave()` animations (R2), which would need a semantic change. Verify Firefox on a machine where Playwright's Firefox starts. |
| **Defer** | Partial stylesheet rewrite (R1); recommend separate sheets for reactive rules meanwhile. |
| **Accept** | `wave()`'s main-thread style cost (R2, documented trade-off); hidden-tab queue retention (R4); programmatic events in the insertion task (R5). |

## Release readiness

**Ready to continue toward a public release, with the conditions already known.** After the fixes, no leak, unbounded queue, starvation or regression remains in the measured scope (Chromium and WebKit engines, headless, up to 10,000 components and 15 minutes). Before a public beta:
1. Verify Firefox (unverified here: the browser does not start on this machine).
2. Measure on real Chrome/Safari with GPU raster and on a mid-range phone (headless software raster only here).
3. Decide R2 (group-shared `wave()`) and R3 (deterministic `state()` names).

Nothing was published, committed or deployed; all work is local.
