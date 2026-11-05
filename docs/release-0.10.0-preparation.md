# Reactive CSS 0.10.0: engineering report

**Status:** prepared. **Not published:** no npm, CDN, tag, deployment or website change. **Date:** 2026-11-06.

Related: [CHANGELOG](../CHANGELOG.md) (0.10.0), [library reference](library-reference.md), [releasing](releasing.md). Measurements and tools: `benchmarks/v0100/` (`bench.mjs`, `sizes.mjs`, `modmap.mjs`, `bench-run1.json`, `bench-run2.json`, `sizes.json`).

## What 0.10.0 contains

| Step | Feature |
|---|---|
| 1 | Whitespace in comparison operators (`> =`); `hypot()`, `sqrt()`, `pow()` in actions |
| 2 | Several events in one `:on()` rule (`a \| b`) |
| 3 | `debounce()` and `throttle()` |
| 4 | Value functions: `length()`, `includes()`, `lower()`, `trim()` |
| 5 | `format()` for numbers; numeric strings |
| 6 | `time()`, `timezone()`, the datetime type, date patterns in `format()` |
| 7 | Timers: `:on(after())`, `:on(every())` |
| 8 | Computed custom properties; moved consumers follow the nearest owner |
| — | Bundle optimization (10 commits) |

## Design decisions

- **Value functions** have one definition, evaluated by the action expression language, so typing, units and errors are the same in actions, conditions and declarations.
- **Timers are active while the element matches the rule's full selector,** `:when()` included. The element watcher follows `:when()` markers for these rules only.
- **Computed values are written inline on each owner,** as the custom property itself. In the prototype they went through a generated `var()` in the cascade, so a more specific rule in any stylesheet could make CSS and the state disagree without any report. This is deliberately not a general CSS cascade.
- **Computed values settle in depth order** after all subscribers are notified. Recomputing at once stored an intermediate value in diamonds, which `previous()` then showed.
- **`format` is also a CSS name.** Which calls are claimed is decided in core, so a bundle without the feature leaves `@font-face` alone too.
- **Moves.** The nearest-owner rule now also holds after a move. It is the only behavior change that also affects `state()`; no existing test changed status.

## Limits of computed values

CSS shows the state on the owner unless `!important` or `@property` overrides it, and inside the owner unless another declaration of the name applies there.

| A declaration of the name | Reported |
|---|---|
| In a processed stylesheet (with reactive syntax), any rule, `!important`, `@property`, `state()`, also added later | Every build: the name is not computed while it exists |
| An inline `style` value on an owner | Every build: not computed on that element |
| In a same-origin or constructed stylesheet without reactive syntax; an inline `style` value inside an owner | Development builds only |
| In a cross-origin stylesheet without CORS | Cannot be checked. Development builds say so |
| In a shadow root; written later by a script | Not checked |

## Tests

| Suite | 0.9.1 | 0.10.0 |
|---|---|---|
| Unit | 196 | 376 passed |
| Chromium + WebKit | 944 passed, 6 skipped | 1106 passed, 6 skipped, 0 failed |
| Firefox (Docker, Playwright v1.64.1-noble) | 468 passed, 7 skipped | 549 passed, 7 skipped, 0 failed |

These are automated engine runs. Real Safari, physical phones and tablets, touch and pen hardware, screen readers and codepen.io were not tested for this version.

### iOS Simulator smoke

Mobile Safari on an iPhone 17 Pro simulator (iOS 26.4), production bundle, simulated touch input. This is a smoke test by hand, not the full suite.

| Area | Result |
|---|---|
| Tap, `prevent()`, `stop()`, `a \| b`, `outside()` | Pass |
| Press and hold with `:when()` and `every()`; a quick tap adds nothing | Pass: 22 ticks in 2 s, the timer stops on release |
| `drag`, with and without `touch-action: none` | Pass |
| `debounce()` and `throttle()` | Pass: one run for a typed burst, 10 runs for 21 moves in 1 s |
| `after()`, `every()`, a clock in another time zone | Pass |
| Chains, diamonds, `previous()`, the read-only diagnostic, locale formats, grapheme length | Pass |
| Mount, unmount, 20 cycles of 200 owners | Pass: states, timers and bindings return to 0 |
| Moved consumers (`text:`, `attr:`, `when()`, `:when()`, `var()`) | Pass |

The first run found one defect: removing an owner reported `RCSS-V047` for a computed value whose state left with it. The state goes first, so the computed value saw its input missing for a moment. It also happened in Chromium and WebKit, with a class change and with a stylesheet removal. The diagnostic now waits for the batch to finish. It is still reported when an input goes and its reader stays. All sections were repeated on the fixed bundle.

**Platform behavior, not library behavior:**

- A vertical swipe on an element without `touch-action: none` scrolls the page: the browser sends `pointercancel`, and `drag(cancel)` then `drag(end)` run, as documented. A horizontal drag on the same element completes, because this page cannot scroll sideways.
- While Safari is in the background, `every()` does not tick and does not catch up on return. `after()` that came due in the background had fired by the return.
- Rapid taps can merge into the double-tap gesture.
- The keyboard can change typed text: two spaces became a period, with `autocorrect="off"`.
- The user agent says iOS 18.7 on iOS 26.4.

**Not covered by a simulator:** physical touch hardware, pen, multi-touch gestures, Low Power Mode timer throttling, memory pressure and VoiceOver.

### Bundle Builder selections

All 2^20 selections are too many to compare, so `site/tests/unit/bundles.test.ts` compares the page's resolver with the library's on 4,702:

- All 1,351 selections of up to three features.
- Their 1,351 complements.
- 2,000 from a seeded generator (MINSTD, seed 1). The test pins the generator's first values and checks that every feature appears in and out.

The same file checks dependency closure on all 4,702 selections, invalid combinations, and that each feature can be left out with what needs it. `tests/unit/v0100-bundles.test.ts` covers `exclude` in the library: the core, unknown names, conflicts, and that a build without a feature does not contain its own modules. Five deliberate faults in the two resolvers were each caught by these tests.

`tests/unit/matrix.test.ts` and `tests/browser/matrix.spec.ts` add six production bundles with 0.10 features to the existing seven, under a strict CSP.

## All bundle variants

Each cell: minified / gzip / brotli, in bytes. The 0.10.0 column was measured after the `RCSS-V047` fix.

| Bundle | 0.9.1 (e35d91f) | Steps 1–8, before optimization | 0.10.0 |
|---|---|---|---|
| Full `reactive-css.min.js` | 150,368 / 49,716 / 43,662 | 183,243 / 61,122 / 53,176 | 181,808 / 60,828 / 52,871 |
| Compact `reactive-css.compact.min.js` | 129,824 / 42,940 / 37,970 | 156,258 / 52,229 / 45,761 | 155,385 / 52,149 / 45,545 |
| Core-only | 46,286 / 17,256 / 15,669 | 50,262 / 18,722 / 17,023 | 49,000 / 18,310 / 16,645 |
| Events | 76,771 / 26,488 / 23,851 | 86,497 / 30,239 / 26,771 | 83,191 / 29,216 / 25,968 |
| Events + conditions | 83,424 / 28,604 / 25,792 | 94,975 / 33,181 / 29,419 | 90,634 / 31,783 / 28,269 |
| Events + conditions + text | 86,195 / 29,413 / 26,451 | 97,752 / 33,966 / 30,093 | 93,414 / 32,584 / 28,951 |
| Events + forms + text + attributes | 95,064 / 31,742 / 28,409 | 104,980 / 35,579 / 31,505 | 101,674 / 34,541 / 30,656 |
| Strings | — | 89,527 / 31,261 / 27,702 | 66,206 / 24,055 / 21,631 |
| Format | — | 93,775 / 32,793 / 29,076 | 67,220 / 24,474 / 21,909 |
| Datetime (with format) | — | 94,669 / 33,029 / 29,248 | 71,247 / 25,926 / 23,137 |
| Timers (with events) | — | 88,287 / 30,870 / 27,328 | 85,989 / 30,168 / 26,768 |
| Derived (with strings) | — | 95,334 / 33,133 / 29,447 | 71,155 / 25,733 / 23,015 |
| Strings + text | — | 92,307 / 32,057 / 28,423 | 68,985 / 24,974 / 22,347 |
| Format + text | — | 96,555 / 33,568 / 29,721 | 69,999 / 25,425 / 22,642 |
| Datetime + text | — | 97,449 / 33,836 / 29,954 | 74,026 / 26,801 / 23,919 |
| Derived + text | — | 98,110 / 33,932 / 30,096 | 73,934 / 26,620 / 23,808 |
| Events + format + text | — | 96,555 / 33,568 / 29,721 | 90,991 / 31,806 / 28,151 |

"Steps 1–8" Strings to Derived included the event runtime, because those features required it.
"Events + format + text" there equals "Format + text" for the same reason.

## Performance

Production Full bundles, Chromium. "—" means the workload does not exist in 0.9.1. Measured before the `RCSS-V047` fix, which changes only the branch for a missing input.

- **Update** is script time: the synchronous work plus the frame flush it causes. It excludes
  idle frame waiting, and it excludes the browser's own style and layout work outside script.
- **Start** is `ReactiveCSS.start()` on a page that already has its elements.
- Medians of 9 runs (5 at 10,000). Each range spans two complete runs.

**Compilation** (`compile()`, alternating rounds, median ms, run 1 / run 2):

| Sheet | 0.9.1 | Steps 1–8 | Optimized |
|---|---|---|---|
| 1,000 conditions | 3.58 / 3.60 | 3.72 / 3.61 | 3.69 / 3.64 |
| 1,000 `:on()` actions | 3.93 / 3.85 | 4.04 / 3.89 | 4.00 / 3.79 |
| 1,000 plain rules with a state | 2.12 / 2.14 | 2.17 / 2.13 | 2.14 / 2.12 |
| 500 `text: format()` | — | 2.54 / 2.43 | 2.30 / 2.44 |
| 1,000 computed declarations | — | 2.70 / 2.62 | 2.63 / 2.72 |
| 1,000 timer rules | — | 6.35 / 6.31 | 6.36 / 6.17 |

**1,000 elements** (start ms / heap MB / update ms):

| Workload | 0.9.1 | Steps 1–8 | Optimized |
|---|---|---|---|
| Event dispatch: 500 clicks on cards | 2.4 / 0.57–0.58 / 2.6–2.7 | 2.5 / 0.58 / 2.8–2.9 | 2.5 / 0.58 / 2.8 |
| State update: 1 state, N readers, 20 changes | 2.4 / 0.27 / 4.1–4.2 | 2.5 / 0.29 / 4.2–4.3 | 2.4 / 0.28 / 4.3 |
| State update: `text:`, 200 clicks | 4.4–4.5 / 0.66 / 2.3–2.4 | 4.4–4.8 / 0.66 / 2.4 | 4.6–4.8 / 0.66 / 2.4–2.5 |
| Moves: 100 subtrees in one task | 1.3 / 0.14 / 0.6 | 1.3–1.4 / 0.14 / 2.9 | 1.3–1.4 / 0.14 / **0.9** |
| Value functions inline, 200 inputs | — | 9.4–10.6 / 0.93 / 4.4–4.8 | 9.4 / 0.92 / 4.5 |
| Derived chain: form, 200 inputs | — | 10.6–10.7 / 1.71–1.82 / 4.4–4.5 | 10.5–10.8 / 1.71 / 4.5 |
| Derived fan-out: filter, 1 change | — | 4.6–4.7 / 1.16 / 1.9 | 4.7 / 1.16 / 1.8–2.0 |
| Timers: `every(1s)`, one tick | — | 2.0 / 0.71 / 6.0–6.2 | 2.0 / 0.71 / 5.6–6.2 |
| Clocks: `live(time())` derived, one tick | — | 7.2 / 1.55 / 24.0–26.9 | 7.1–7.2 / 1.54 / 24.4–25.6 |
| `throttle()`, 200 inputs | — | 1.7 / 0.50 / 2.2–2.3 | 1.7 / 0.50 / 2.2 |

**10,000 elements** (start ms / heap MB / update ms):

| Workload | 0.9.1 | Steps 1–8 | Optimized |
|---|---|---|---|
| Event dispatch: 500 clicks on cards | 13.0–13.3 / 6.26 / 3.1–3.3 | 13.0–14.6 / 5.20–6.28 / 3.4–3.5 | 13.1–13.2 / 5.20–6.28 / 3.2–3.3 |
| State update: 1 state, N readers, 20 changes | 11.6–11.8 / 2.99 / 18.8–19.6 | 11.3–11.7 / 3.00 / 19.3–20.3 | 11.5–11.6 / 2.99 / 19.2–20.1 |
| State update: `text:`, 200 clicks | 32.7–33.4 / 5.94 / 2.9–3.0 | 32.3–32.7 / 5.95 / 3.1 | 32.3–32.4 / 5.95 / 3.0–3.1 |
| Moves: 100 subtrees in one task | 5.5–5.7 / 0.84–0.85 / 0.7–0.8 | 5.5 / 0.84–0.85 / 13.9 | 5.6 / 0.84–0.85 / **1.6–1.7** |
| Value functions inline, 200 inputs | — | 77.3–78.1 / 10.23 / 6.1 | 78.5–79.0 / 10.22–10.23 / 6.1–6.2 |
| Derived chain: form, 200 inputs | — | 96.7–97.1 / 17.09 / 6.4 | 96.2–96.6 / 17.09 / 6.3–6.4 |
| Derived fan-out: filter, 1 change | — | 28.9–29.0 / 11.60 / 8.8–8.9 | 29.0–29.1 / 11.59 / 8.9–9.2 |
| Timers: `every(1s)`, one tick | — | 9.1 / 6.67 / 24.2–25.2 | 8.9–9.2 / 6.67 / 24.2–24.6 |
| Clocks: `live(time())` derived, one tick | — | 58.5–58.6 / 14.35–14.36 / 74.6–76.1 | 59.6–60.1 / 14.36 / 74.0–75.4 |
| `throttle()`, 200 inputs | — | 9.3–9.5 / 4.43 / 2.5–2.6 | 9.5–10.1 / 4.43 / 2.6–2.9 |

**Memory retention.** After removing every element while the runtime runs, then a forced collection,
heap against the page before `start()`, in MB (negative: less than before, because the DOM is gone):

| Workload | 0.9.1 | Steps 1–8 | Optimized |
|---|---|---|---|
| Cards, 10,000 | −0.25 | −1.32 to −0.23 | −1.32 to −0.23 |
| Moves, 10,000 | −1.17 to −1.15 | −1.14 to −1.13 | −1.14 to −1.12 |
| Derived chain, 10,000 | — | −0.59 | −0.59 |
| Derived fan-out, 10,000 | — | 0.03 | 0.02 |
| Timers, 10,000 | — | −0.09 | −0.10 |
| Clocks, 10,000 | — | −0.70 | −0.70 |

No retention difference between Steps 1–8 and Optimized. The suites' lifecycle tests also pass
(for example, 200 components mounted and unmounted 10 times).

**Reading these numbers:**
- **Optimized vs Steps 1–8:** no slower workload beyond noise. `throttle()` at 10,000 reads
  2.6–2.9 against 2.5–2.6 ms for 200 inputs, in the one workload that now crosses the new hook
  and a module boundary. That is at most about 2 µs per input. It is not material.
- **Faster:** batched moves, 13.9 → 1.6–1.7 ms at 10,000.
- **Against 0.9.1:** common paths are within about 3–8 % at 1,000 and within noise at 10,000 (the
  largest is event dispatch, 2.6–2.7 → 2.8 ms per 500 clicks). Moves cost 0.3–0.9 ms more per
  batch, for the re-resolution that 0.9.1 did not do.

## Investigated and rejected

| Experiment | Measured | Why rejected |
|---|---|---|
| Make `a \| b` optional | At most −190 B on Events, with all of it removed | It is woven through the matcher, the slots and the parser. Real extraction needs hooks in the event hot path, which takes back part of a small gain |
| Remove the settle counter from `Cell.set` (wrap it from `derived.ts`) | −38 B on Core | Too small to justify patching a prototype |
| Make `hypot()`, `sqrt()`, `pow()` optional | At most −148 B | Approved language would then depend on the bundle |
| Value-function parse paths out of `actexpr.ts` | At most −148 B, before hooks | Same reason: too small, and hooks take part of it back |
| Remove the move fix | −111 B | Measured for the record. It fixes correctness |
| Remove 0.10 registry text from Full | −1,494 B upper bound | It removes `describe()` data. Compact already exists for this. Tightening the text (kept) gave −152 B |
| `derived` without requiring `strings` | Not built: `strings.ts` is 638 B minified | A `derived` selection that has no functions would be a trap for a few hundred bytes |
| Numeric strings out of Core | Not attempted | `"09" >= 9` would then depend on the bundle: a semantic change |

## Corrections found during the work

- Step 5 made the condition call list lazy, which crashed a `:when()` call that read no state; the hook's name `call` hid it behind `Function.prototype.call`. Fixed in step 6.
- Step 4 rejected ordinary functions nested in a value function in `text:`, and `compile().uses` missed value functions in actions and conditions. Fixed in step 6.
- The computed value's first move hook cost about 140 µs per move in a batch of 100, at 10,000 subscribers. Now one scan per batch.
- The development-only checks of computed values did not run in production, but their code shipped. They are now removed from production builds.
