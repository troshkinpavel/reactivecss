# `attr:` performance optimization (experiment after 0.5.3)

Scope: the synchronous derived-attribute path of `attr:` (and the late phase it shares with `text:`). No public API change, no version change. Runtime report for the feature: [release-0.5.3.md](release-0.5.3.md).

**Verdict: keep.** One change, in `scheduler.ts`. It removes redundant `getComputedStyle()` calls that grew with the number of events before a frame. Forced style recalculations, semantics and the WebKit workaround are unchanged. The time saving is real but modest: it shows only when several events arrive before a frame, and single clicks are unchanged within noise.

## 1. Baseline (0.5.3 as shipped)

### Method

`benchmarks/audit/attr-perf.mjs`, production bundle, Chromium 156.

- **Page:** n components `<span class="dv"><b></b><button></button><i></i></span>` with a state `--on` on `.dv`, toggled by a click on `<b>`.
- **Group:** k clicks on different components **in one task** (so every style recalculation measured is a forced one), then two frames.
  - k = 1 is a person clicking.
  - k = 20 is a burst: several events before a frame, like `benchmarks/run.mjs` and under jank.
- **Counters:**
  - `getComputedStyle()` calls, through a wrapper installed before the library: in the click task, and in the following frames.
  - CDP `RecalcStyleCount` / `RecalcStyleDuration` for the forced recalculations.
  - Per-click time with `performance.now()`, summed over the group.
- **Repetitions:** 3 page loads × 5 samples × 10 groups; medians, with min–max ranges across samples. Correctness is checked on the DOM after every load (all rows: correct).

### Scenarios

| Scenario | CSS |
|---|---|
| `control` | the same click and state change, no `attr:` |
| `plain` | one derived `data-on`, read by no selector |
| `selector` | one derived `data-on`, read by a plain CSS rule `[data-on="1"]` |
| `disabled` | `attr: disabled` + `:disabled` styling |
| `multi` | three derived attributes on one element |
| `chained` | a derived attribute on `.dv` that an attribute selector of another `attr:` rule reads (`.dv[data-on="1"] i { attr: … }`) |

### Baseline numbers

Per click, medians:

| k | n | scenario | getComputedStyle (click task) | in the frame | forced recalcs | recalc time | click time |
|---:|---:|---|---:|---:|---:|---:|---:|
| 1 | 1k / 10k | control | 0 | 0 | 0 | 0 | 110 / 90 µs ¹ |
| 1 | 1k / 10k | plain | 2 | 1 | **1** | 92 / 56 µs | 250 / 210 µs ¹ |
| 1 | 1k / 10k | selector | 2 | 1 | 2 | 92 / 35 µs | 230 / 100 µs ¹ |
| 1 | 1k / 10k | disabled | 2 | 1 | 2 | 101 / 35 µs | 270 / 120 µs ¹ |
| 1 | 1k / 10k | multi | 2 | 1 | 2 | 99 / 41 µs | 270 / 130 µs ¹ |
| 1 | 1k / 10k | chained | 4 | 2 | 2 | 115 / 79 µs | 330 / 290 µs ¹ |
| 20 | 1k / 10k | control | 0 | 0 | 0 | 0 | 15 / 17.5 µs |
| 20 | 1k / 10k | plain | **21** | 1 | 1 | 12.1 / 10.3 µs | 44.5 / 46 µs |
| 20 | 1k / 10k | selector | **21** | 1 | 2 | 9.3 / 5.9 µs | 33 / 23.5 µs |
| 20 | 1k / 10k | disabled | **21** | 1 | 2 | 9.9 / 6.1 µs | 33.5 / 24.5 µs |
| 20 | 1k / 10k | multi | **21** | 1 | 2 | 10.9 / 6.7 µs | 51.5 / 34.5 µs |
| 20 | 1k / 10k | chained | **42** | 2 | 2 | 18.5 / 12.3 µs | 77 / 68.5 µs |

¹ k = 1 click times are dominated by `performance.now()` clamping (100 µs steps here) and by the Playwright evaluation around one click. The control alone ranges 60–160 µs. Only the counters and the recalculation times are reliable at k = 1.

Input to correct frame (`runtime.mjs latency`, `derivedDisabled`, 100 widgets, 40 real clicks):

| | idle p50 / p95 | under load p50 / p95 |
|---|---:|---:|
| Reactive CSS | 13.9 / 15.2 ms | 13.4 / 19.1 ms |
| plain JS | 14.2 / 15.1 ms | 9.8 / 18.3 ms |

Memory (`memory.mjs mount`, 1,000 × 150): clean, 0 detached, heap 2.34 → 2.74 MB. Bundle: 105,814 B min, 35,666 B gzip.

## 2. Root cause of the overhead

The 0.5.3 path, at the end of each event's urgent work (`urgently()`):

1. `sync()`: state CSS (cells, `when()` values, `:when()`/`:nth-var()` markers).
2. Read: one `getComputedStyle()` per queued binding, which forces a style recalculation.
3. Write the attributes that changed.
4. If anything was written: read every binding of step 2 again (a second recalculation, when a selector depends on a written attribute).
5. Re-queue every binding for one more read in the next frame (the WebKit safety net).

**Step 5 was the defect.** It pushed the bindings back into the *same* late queue that step 2 drains. The next event before a frame therefore re-read, in its own steps 2 and 4, every binding of every earlier event. The reads grew linearly with each event: (k + 1) / 2 per pass on average, so 21 per click at k = 20 instead of 2.

The cost was in the `getComputedStyle()` calls and their compute work, not in recalculations: Blink resolves the extra reads from clean style. That is why the effect on time is modest.

The remaining costs are inherent to the semantics:

| Cost | Why it stays |
|---|---|
| Forced recalculation in step 2 | This is what puts `disabled` in place before the next click |
| Second recalculation in step 4 | Happens only when some selector depends on a written attribute (Blink skips it otherwise: `plain` has 1 recalc). Removing it would need a guarantee that no selector in any stylesheet, including author CSS that sets custom properties used in `attr:` values, depends on the written attribute. That is the kind of independence assumption the experiment forbids, and in WebKit the second read is also part of the stale-read workaround (section 7) |
| Frame re-read in step 5 | One read per binding per frame; WebKit safety net (section 7). In Chromium it is not forced: style is recalculated for rendering anyway |

## 3. Optimizations considered

| Hypothesis | Result |
|---|---|
| **Separate the frame re-read from the same-task queue** | **Implemented.** Safe: changes no read that matters; removes the quadratic reads |
| Skip the second read when no selector can be affected | Rejected: needs a guarantee about every selector, plus custom properties set by author CSS. Blink already makes the second read nearly free when nothing depends on the attribute (`plain`: 1 recalc) |
| Narrow the second read to affected elements | Rejected for the same reason: attribute selectors reach siblings, ancestors (`:has()`) and descendants |
| Reuse computed values within one update | Not possible: the second read exists precisely because values may have changed |
| Keep the WebKit workaround only where needed | Not done: the cause is still unknown (section 7). Browser detection would be fragile, and Firefox is unverified |
| Leave `text:` out of the same-task pass | Not done: it would change when `text:` updates after an action (now in the same task since 0.5.3), and the experiment must not change semantics |

## 4. Implementation

`src/core/scheduler.ts` only:

```ts
/** Jobs read in the same task by urgently(), to read once more in the next frame (see there). */
const recheck = new Set<Job>();

// urgently(), after the same-task passes (was: `for (const j of done) late(j);`)
for (const j of done) recheck.add(j);
request();

// flush(), before the late phase
for (const j of recheck) late(j);
recheck.clear();
```

- The dev probe `queued` includes `recheck.size`.
- A `Set` deduplicates a binding hit by several events in one frame. It is read once in the frame, as before. The frame read still covers every binding of every event; only the redundant same-task re-reads are gone.
- Benchmark tooling:
  - `benchmarks/audit/attr-perf.mjs`, with `--lib` for interleaved A/B runs;
  - `webkit-stale.mjs` and `webkit-stale-quiz.mjs`, the WebKit investigation;
  - `memory.mjs --aggregate=1`, a per-type heap breakdown.

## 5. Before / after

### Same methodology

Interleaved A/B runs: baseline, optimized, baseline, … three times each, 2 loads × 5 samples × 10 groups per run, both bundles built from the same tree. Per click, k = 20 (median of the three run medians; range across runs):

| n | scenario | baseline: µs (3 runs) | optimized: µs (3 runs) | same-task reads | change |
|---:|---|---:|---:|---:|---|
| 1,000 | control | 13.5 (11.5–15.5) | 13.5 (10.5–15.5) | 0 → 0 | — |
| 1,000 | plain | 55 (49.5–62.5) | 45 (39.5–50) | 21 → 2 | within noise (ranges overlap) |
| 1,000 | selector | 33 (32.5–37) | 26 (21–26.5) | 21 → 2 | **21 % faster** |
| 1,000 | disabled | 35.5 (35–36.5) | 26.5 (23–29) | 21 → 2 | **25 % faster** |
| 1,000 | multi | 48 (42.5–54) | 30.5 (27–32.5) | 21 → 2 | **36 % faster** |
| 1,000 | chained | 50 (45–86.5) | 59.5 (43–60.5) | 42 → 4 | within noise (ranges overlap) |
| 10,000 | control | 15 (14.5–16) | 14 (9–14.5) | 0 → 0 | — |
| 10,000 | plain | 60.5 (57.5–60.5) | 29.5 (26–35) | 21 → 2 | **51 % faster** |
| 10,000 | selector | 25.5 (24–26) | 20 (19.5–20.5) | 21 → 2 | **22 % faster** |
| 10,000 | disabled | 27 (25.5–27) | 21 (20–22) | 21 → 2 | **22 % faster** |
| 10,000 | multi | 35.5 (35.5–35.5) | 24 (23.5–25) | 21 → 2 | **32 % faster** |
| 10,000 | chained | 84.5 (68–88) | 54 (53–59.5) | 42 → 4 | **36 % faster** |

k = 1 (single clicks), same runs: every scenario is within noise (`performance.now()` clamping; ranges of baseline and optimized overlap everywhere). Same-task reads are 2 (chained 4) in both, so no change is expected there.

### Summary

| Metric | Baseline | Optimized |
|---|---|---|
| Click cost, 1k elements (k = 20, `disabled`) | 35.5 µs (35–36.5) | 26.5 µs (23–29) |
| Click cost, 10k elements (k = 20, `disabled`) | 27 µs (25.5–27) | 21 µs (20–22) |
| Click cost, single click (k = 1) | within noise (see note ¹) | within noise, unchanged |
| Forced style recalculations per click | 1 (no selector depends) / 2 | 1 / 2 (unchanged) |
| `getComputedStyle()` per click, same task | k = 1: 2 (chained 4); k = 20: 21 (chained 42) | k = 1: 2 (4); k = 20: **2 (4)** |
| `getComputedStyle()` per click, frame | 1 (chained 2) | 1 (2) |
| Input to correct frame, idle p50 / p95 | 13.9 / 15.2 ms (plain JS 14.2 / 15.1) | 13.7 / 14.9 ms (plain JS 13.9 / 15.6) |
| same, under load p50 / p95 | 13.4 / 19.1 ms (plain JS 9.8 / 18.3) | 11.8 / 23.6 ms (plain JS 11.2 / 19.1) |
| Memory after lifecycle test (1,000 × 150) | clean, end heap 2.74 / 3.00 MB in two runs | clean, end heap 3.00–3.51 MB in four runs; per-type diff against the baseline in the same session: < 20 KB |
| Bundle (min / gzip / brotli) | 105,814 / 35,666 / 31,507 B | 105,867 / 35,706 / 31,576 B (+53 / +40 / +69) |

**Latency:** the input-to-frame differences are within the noise of plain JS itself, whose p50 under load moved from 9.8 to 11.2 ms between the two runs. No improvement is claimed.

**Memory:** end-heap figures vary by about 0.8 MB between runs of the *same* build (2.74 and 3.00 MB for the baseline). A heap-snapshot diff by type, with both builds in one session, shows no difference above 20 KB, and no library object or queue entry is left. No memory change is claimed.

## 6. Correctness

- **New focused tests** in `v053.spec.ts`, "update path":
  - every same-task pass reads only its own event's bindings: 6 reads per click for 20 clicks in one task, where the baseline read 6, 12, 18…; this test **fails on the baseline scheduler**, checked by swapping it back;
  - every binding is re-read exactly once in the next frame;
  - a chained attribute (an attribute selector on a written attribute) still settles in the same task;
  - a 45-event burst leaves `disabled`, chained `data-*` and other attributes correct both in the same task and after the frame.
- **Full suites:**
  - Chromium + WebKit: 415 passed, 5 skipped (the Chromium-only heap tests in WebKit; same skips as 0.5.3);
  - Chromium at 4× CPU: 210 passed;
  - unit tests: 72 passed; typecheck clean.
  
  They include the examples (quiz and form validation exercise the WebKit hidden-element cases), rapid real clicks, same-task clicks, repeated Enter, every attribute kind, multiple attributes, cascade, ancestor state, lifecycle, recompilation and loop tests.
- **WebKit hidden-element scenarios:** the quiz "Try again" and form-validation tests pass 20/20 (10 repetitions each) in WebKit.

## 7. WebKit workaround status

**Kept unchanged** (the second same-task read when something was written, and the frame re-read).

Investigation:
- `benchmarks/audit/webkit-stale-quiz.mjs` records every `getComputedStyle()` read made during the quiz's "Try again" click, then reads the same elements again right after the click (same task).
  - On the real quiz, WebKit 27.2 returns **6 stale values out of 18 reads**: exactly the first-pass reads of the six options in the two hidden cards. Their second-pass reads, after the first pass's writes, are fresh.
  - Chromium: 0 stale.
- Bisecting the stylesheet:

| Variant | WebKit |
|---|---|
| Full quiz stylesheet | stale 6/18 |
| Without `:has()` rules | stale 6/18 |
| Without `text:` rules | stale 6/18 |
| Without the option `:nth-var()` rules (feedback, `aria-pressed`) | stale 6/18 |
| Without the cards' `display` rules (nothing hidden) | fresh |
| Minimal: cards shown by `:nth-var(--q)`, options `attr: disabled when(--aN > 0)`, Next and Try again | **stale 6/18** |

- So the conditions are: an element under a `display: none` ancestor; its value changes through an inline custom property (the `when()` binding) in the same task in which `:nth-var()` markers move between sibling cards; then a read.
- `:has()`, `text:` and attribute selectors on the element itself are **not** required.
- A **library-free** reproduction (`benchmarks/audit/webkit-stale.mjs`) did not reproduce it in 19 variants. The variants covered:
  - hidden ancestors (by attribute, class or `hidden`);
  - `:has()`;
  - registered or unregistered properties;
  - marker changes on the element or a sibling;
  - a sibling card shown or hidden in the same task, before or after the write;
  - reads in a frame callback, a `setTimeout` task and a click listener.

**Conclusion:** the trigger needs something else the library does in that task, still unidentified. The cause is uncertain, so the workaround stays in all engines, as the experiment requires. Its cost in Chromium:
- one extra read per event, and a recalculation only if a selector depends on a written attribute;
- one frame read per binding.

## 8. Memory and bundle size

- **Memory:** no change measured (section 5). The `recheck` set holds bindings only until the next frame, as the late queue did before. Disposed bindings in it do nothing (dead flag), and the heap test (0 detached elements, 0 `AttrSet` after unmount) passes.
- **Bundle:** +53 B minified, +40 B gzip.

## 9. Keep or revert

**Keep.**
- Correctness and semantics are unchanged.
- Chromium and WebKit suites pass, including CPU ×4 and the WebKit hidden-element cases.
- The read-count reduction is exact and repeatable: 21 → 2 per click at k = 20.
- The time improvement at k = 20 is repeatable where shown in section 5. It is not claimed for single clicks.
- The change is a few lines and removes a quadratic behavior.

## 10. Remaining opportunities

Ranked by expected benefit and risk.

1. **Identify the WebKit stale-read trigger** (benefit: medium; risk: none, investigation only). With a known cause, the frame re-read, and in WebKit possibly the second pass, could be limited to elements that can be affected. Next step: instrument the library's same-task sequence step by step in the minimal quiz (sync hooks, marker writes, the inline var writes, their order) to find the operation the library-free repro lacks.
2. **Second read only when a selector could depend on a written attribute** (benefit: low in Blink, which already skips the recalculation when nothing depends; risk: high). It needs an index of attribute names in every stylesheet's selectors, including author CSS and dynamic sheets, plus custom-property dependencies of `attr:` values. Not recommended until a profile shows the second read mattering.
3. **Leave `text:` out of the same-task pass** (benefit: fewer reads on pages with many `text:` bindings in the same owner; risk: medium). It is a semantic change for `text:` timing (same task → next frame), so it needs an explicit decision.
4. **Batch the first read across events in one task** (benefit: only for synthetic same-task bursts; risk: high). It would conflict with "disabled before the next event"; not recommended.

The dominant remaining cost per human click is the **first forced style recalculation**: 35–100 µs right after a frame, about 5–10 µs inside a burst. It is the price of the guarantee, not a defect.
