# Reactive CSS 0.9.0: optimization and release hardening

**Status:** local. Nothing was committed, published or deployed, and the website was not touched. **Date:** 2026-10-22.

> **API cleanup (after this pass): section J.** `focus: when()` replaced `:focus(when())`, the `:on()` modifiers became `prevent()` and `stop()`, and `once` was removed. The sections below describe the hardened build before that cleanup; where they mention the removed syntax, section J says what changed.

- **Starting point:** the 0.9.0 candidate described in [release-0.9.0-preparation.md](release-0.9.0-preparation.md), called **rc1** below. It is frozen in `benchmarks/baseline/v0.9.0-rc1/`: built bundles, source and bundle builder.
- **Environment:**
  - Apple M4 Max (14 cores, 36 GB), macOS 27.0.1, Node 26.8.2;
  - Playwright 1.64.1, Chromium 156.0.8078.4, WebKit 27.2;
  - Firefox: see section E.
- **Public API:** no public API or syntax was added or changed. The pointer-snapshot patch was not applied.

## A. Executive summary

**Outcome.** The 0.9.0 candidate is smaller, a few real bugs are fixed, and every check passes in Chromium and WebKit. Performance matches rc1, and 0.8.1 where both can run the same workload. The remaining work is outside this machine: Firefox, real devices, screen readers. Two product decisions are also open: the default bundle's `describe()` metadata, and the stability labels.

**Highest-impact changes:**
1. **Production diagnostic codes** (`tools/diagnostics.mjs`):
   - −10.4 KB minified and −4.1 KB gzip on the full bundle;
   - −8 to −11% on every custom bundle;
   - full development messages kept, with an offline decoder.
2. **Native-first `random()`, aligned with the 2026 CSS Values 5 draft** that Chromium and WebKit implement. Before, valid native CSS got warnings, and calls the browser handles were taken over by the runtime.
3. **Fixed: moved elements kept rules they no longer matched.** A pre-existing element-manager bug, also in 0.8.
4. **Fixed: two places read or sliced diagnostic text.** One would have broken the `disabled` wait for custom elements in production. Both were found because codes made them fail.
5. **Types resolve under `node16` and `nodenext`.** This was an open 0.8.1 blocker.
6. **Drag:** a press in a field inside a draggable no longer starts a drag.
7. **`:blur` with no compound** (`.form:has(:blur)`) works, as the RFC said.

**Unresolved:**
- **Empty-rule removal.** Minifiers delete empty `:focus(when())` and modifier-only `:on()` rules. (After the API cleanup only modifier-only `:on()` rules remain: section J.) This is a documented integration requirement; there is no in-language fix without new API.
- **The 45–48 KB gzip target.** It is met by the compact bundle (43.1 KB), not by the full default bundle (49.9 KB), whose `describe()` registry is public data.
- **Firefox** could not run on this machine.

**Readiness:** ready for the website and documentation migration phase, with the conditions in section I.

## B. Bundle optimization

Measured with the same settings for both columns: minified IIFE, gzip level 9, brotli quality 11. Sources:
- `benchmarks/v090/matrix.{json,md}`;
- `benchmarks/v090/composition-hardened.{json,md}`;
- module sizes for rc1 come from an esbuild metafile of the rc1 source.

| Metric | Before hardening (rc1) | After hardening | Difference |
|---|---:|---:|---:|
| Full minified (`reactive-css.min.js`) | 162,675 B | 151,472 B | −11,203 B (−6.9%) |
| Full gzip | 54,074 B | 49,936 B | −4,138 B (−7.7%) |
| Full brotli | 47,147 B | 43,811 B | −3,336 B (−7.1%) |
| Compact bundle gzip | 47,274 B | 43,054 B | −4,220 B (−8.9%) |
| Parser and tokenizer (minified, in bundle) | 26,800 B | 22,168 B | −4,632 B (−17.3%) |
| Event runtime (`actions.ts` + `on.ts` + `actexpr.ts`) | 28,423 B | 26,598 B | −1,825 B (−6.4%) |
| 0.8.1 for reference: full minified / gzip | 117,830 / 39,715 | | +28.6% / +25.7% over 0.8.1 |

**Where the full bundle's bytes are** (minified, additive; standalone compressed sizes per module are in `composition-hardened.md` and are not additive):

| Area | Bytes | Share |
|---|---:|---:|
| `describe()` registry (`core/features.ts`): descriptions and examples of every API entry | 29,583 | 19.5% |
| Parser and tokenizer | 22,168 | 14.6% |
| Engine, element manager, scheduler, registry, log | 14,482 | 9.6% |
| State engine and values | 12,338 | 8.1% |
| Event-time evaluator | 11,145 | 7.4% |
| Values, sources, `live()`, geometry | 10,897 | 7.2% |
| Attributes | 9,481 | 6.3% |
| `:on()` runtime | 8,361 | 5.5% |
| Conditions, history, `:nth-var()` | 8,127 | 5.4% |
| Legacy `on:` and the shared dispatcher | 7,092 | 4.7% |
| Forms | 5,713 | 3.8% |
| Focus and blur | 4,289 | 2.8% |
| Persistence | 3,034 | 2.0% |
| Gestures | 2,137 | 1.4% |
| Text | 1,962 | 1.3% |

**Diagnostics, quantified.**
- The earlier report's "diagnostic text is about 44% of the parser" was an over-estimate. It counted every string literal, including CSS and code strings.
- Replacing the 247 message sites (235 distinct messages) by codes saved 10.4 KB minified and 4.1 KB gzip. That is the real size of the diagnostic text.
- 18.7 KB of the 26.4 KB of long strings that remain are the `describe()` registry's descriptions.

**Production diagnostics design.**
- **Codes:** `RCSS-<area><nnn>`, followed by the interpolated values: `RCSS-P031⟦:on()⟧⟦events⟧`. The area letter names the subsystem:

  | Letter | Area | Letter | Area |
  |---|---|---|---|
  | P | compiler | F | forms |
  | R | runtime | A | attributes |
  | S | state | T | text |
  | E | events | C | focus |
  | G | gestures | W | conditions |
  | K | persistence | V | values and sources |

- **Registry:** `src/core/diagnostics.json`, append-only and checked in. A unit test fails when a message has no code.
- **Lookup:** `dist/diagnostics.json` and `reactive-css explain`, offline, needing no esbuild. The production console summary says how to decode.
- **Development builds** keep the full text. The values in production messages give the same context as before.
- **Errors are not swallowed.** Errors are classified as before; only the text changes.
- **Tests:**
  - every production diagnostic of a test page decodes to exactly the development message;
  - the browser test helpers decode, so every existing assertion now also checks the production path.

**Other size work:**
- `focus:`, `text:`, `attr:` and `--attr-*` share one parser path: −572 B.
- The rest of the parser and evaluator is code. Further cuts would trade robustness, which section 2.3 of the brief rules out.

**The 45–48 KB gzip target.**
- **Compact bundle:** 43.1 KB gzip. It is the same runtime, and its `describe()` lists name, kind, status, since and syntax.
- **Full default bundle:** 49.9 KB. The difference (6.9 KB gzip) is the `describe()` registry's prose, which is public API data.

**Decision for the maintainer:** keep the full registry in the default bundle, or make the compact registry the default production bundle and point to `dist/features.json` for prose. Either way the runtime is the same.

**Feature coupling (checked by building each feature alone and by the matrix):**
- Drag reuses the event dispatcher and evaluator.
- Focus does not require forms.
- Persistence needs neither DOM nor event modules.
- Sensors install observers only when used.
- No module is duplicated.

**Remaining coupling:** the 0.9 rule-level compile paths (`:on()`, `:focus(when())`, `content`, `--attr-*`) live in the core parser. A core-only bundle is still 13% larger than 0.8.1's core (47.4 KB against 41.9 KB). Moving them into their features would need parser plugins; this is listed as future work.

## C. Modular build matrix

All bundles are minified IIFEs that start automatically. Results come from:
- unit tests (`tests/unit/matrix.test.ts`): exact feature set, omitted features physically absent by code markers, analysis equals the explicit selection;
- browser tests (`tests/browser/matrix.spec.ts`): each bundle under a strict CSP, running its interaction;
- the ESM build (exports checked);
- the packed tarball, type-checked as a consumer.

| Bundle | Features (automatic) | Min | gzip | brotli | Init and interaction | Omitted features absent |
|---|---|---:|---:|---:|---|---|
| Minimal state | core | 47,418 | 17,668 | 16,097 | ✓ (and `:on()` reported) | ✓ |
| Counter | core, events, text | 80,788 | 27,648 | 24,908 | ✓ | ✓ |
| Forms | core, events, forms | 85,056 | 28,848 | 26,105 | ✓ | ✓ |
| Focus | core, events, focus (events added) | 85,020 | 29,010 | 26,073 | ✓ | ✓ |
| Persistence | core, persist | 51,068 | 18,957 | 17,224 | ✓ (restored after reload) | ✓ |
| Drag | core, events, gestures (events added) | 80,397 | 27,649 | 24,955 | ✓ | ✓ |
| Sensors | core, dynamic, geometry | 54,199 | 19,837 | 18,030 | ✓ | ✓ |
| `interactive` profile | 7 features | 100,181 | 33,717 | 30,070 | ✓ (examples) | ✓ |
| Full (custom, compact registry) | all 15 | 128,941 | 42,705 | 37,667 | ✓ | n/a |
| `dist/reactive-css.min.js` | all, full registry | 151,472 | 49,936 | 43,811 | ✓ | n/a |
| `dist/reactive-css.compact.min.js` | all, compact registry | 130,469 | 43,054 | 37,982 | ✓ | n/a |

**Consumer checks** (a tarball from `npm pack`, installed offline in a scratch project):
- **Package contents:** 166 files. It includes the code registry and the decoder. It excludes patches, the pointer-snapshot RFC, tests, fixtures and baselines.
- **Types:**
  - `tsc --strict` passes under `bundler`, `node16` and `nodenext`; before, `node16` and `nodenext` failed with TS2834;
  - the `.d.ts` exports match the runtime: the in-repo `tests/dist` consumer compiles.
- **Bundlers:** esbuild bundles an app that imports the ESM entry, and the app runs 0.9 syntax in the browser (`tests/browser/production.spec.ts`).
- **CLI:** `reactive-css build` and `reactive-css explain` work from the installed package. `build` needs esbuild, which is an optional peer; `explain` does not.

## D. Performance comparison

**Method:**
- `benchmarks/v090/compare.mjs` runs v0.8.1, rc1 and the hardened build on the same pages in one Chromium process, interleaved per run (ABAB…).
- Five runs per cell, median (min–max).
- Results: `benchmarks/v090/results-hardened.{json,md}`; 4× CPU throttling: `results-throttle4*.{json,md}`; the earlier rc1 report run: `results-rc1*.json`.
- **Variance:** absolute numbers move between sessions. This session's run is 30–60% slower in every column than the rc1 report's run, plain JavaScript included, so only compare within a run.

| Scenario | v0.8.1 | rc1 | Hardened | Reading |
|---|---:|---:|---:|---|
| Startup, 10,000 components (task ms) | 169.7 | 169.8 | 169.3 (0.9 syntax) / 169.7 (0.8 syntax) | No change |
| Startup, 1,000 components | 32.9 | 33.1 | 33.6 / 32.8 | Within noise (±2%) |
| Mounted memory, 10,000 components (MB) | 16.7 | 16.9 | 16.9 | +1% |
| Retained after 10 × 1,000 mount/unmount (MB) | 1.22 | 1.23 | 1.23 | No change |
| Retained after 100 × 500 mount/unmount (MB) | 0.456 | 0.445 | 0.444 | No growth |
| Retained after 100 drags (MB) | — | 0.521 | 0.521 | Plateaus: 0.36 → 0.45 MB from 100 to 400 drags |
| Retained after 100 stylesheet replacements (MB) | 0.48 | 0.61 | 0.62 | Plateaus in both versions. A slow drift under 0.5 KB per replacement exists in 0.8.1 too. 0.9 sheets have twice the bindings (800 against 400). |
| Idle, 10 s (script ms, flushes, timer ticks) | 0, 0, 0 | 0, 0, 0 | 0, 0, 0 | No idle work |
| Click, script per click (ms) | 0.0349 | 0.0388 | 0.0393 (0.9) / 0.0378 (0.8) | About +4 µs. The ranges overlap; 4 µs is below 1% of a frame |
| Click → DOM text / attribute / focus (ms) | 0.4 / 0.4 / 0.5 | 0.4 / 0.4 / 0.5 | 0.3 / 0.3 / 0.5 | Same task as the click in all versions |
| Click → computed style (ms) | 15.6 | 15.5 | 15.7 | Next frame, all versions |
| Form input, script per keystroke (ms), `bind:` + `text:` | 0.0078 | — | 0.0080 | Same workload: +2% |
| Form input, 0.9 form (`:on(input)` + `event(value)` + `bind(value)` + `content`) | — | 0.0261 | 0.0259 | More work per key (two bindings); plain JS 0.0056 |
| `mouse(x)` live on 1,000 elements (script ms/s) | 5.37 | 5.25 | 5.51 | No change (optimized 0.8 path intact) |
| `live(random(), 200ms)` on 10,000 elements, frame p95 | 16.8 | 16.7 | 16.8 | No change |
| `:on(pointermove)` (script ms/s at 60 events/s) | — | 12.0 | 12.2 | Plain JS 3.3 |
| `:on(mousemove)` | — | 10.2 | 8.5 | Plain JS 2.0 |
| `:on(scroll)`, 200 wheel steps | — | 5.3 | 5.9 | Plain JS 1.1 |
| Drag, script per move (ms), 1 / 1,000 candidates | — | 0.165 / 0.180 | 0.178 / 0.171 | Plain JS 0.038. No forced layout (plain JS: 1). No long tasks. |
| Persisted drag, storage writes per 300 moves (about 5 s) | — | 21 | 21 | About 4 per second; the last value is kept |
| Compile, 5,000 native rules + 1 reactive (ms) | 24.5 | 26.5 | 26.1 | +6.5% over 0.8.1 (1.6 ms). Investigated in rc1; this is the remaining cost of the 0.9 selector checks. |
| Compile, 5,000 native rules only | 0 (pre-filter) | 0 | 0 | The pre-filter skips them: task 15.6 ms in all versions |
| Compile, 500 event rules: `on:` / `:on()` | 4.6 / — | — / 6.3 | 4.8 / 6.2 | `:on()` costs 1.4 ms more per 500 rules |

**4× CPU throttling** (slow devices; 3 runs, click and input confirmed with 7):
- **Click:** script 0.208 ms (0.8.1), 0.147 ms (rc1), 0.160 ms (hardened). The ranges overlap widely (0.08–0.30), so no regression is measurable.
- **Event-to-DOM latency:** p95 0.7–0.8 ms in every version.
- **Drag:** 0.157–0.196 ms per move. No long task and no forced layout.
- **`live()` frame p95:** 33.3 ms in every version, including 0.8.1: two frames on a throttled CPU.
- **Legacy-syntax input:** 0.0332 (0.8.1) against 0.0373 ms (hardened), +12% with overlapping ranges; not confirmed.

**Investigation thresholds** (more than 10% time, more than 15% memory, long tasks over 50 ms):
- **Time:** no confirmed breach. The +13% click figure in the rc1 report and the throttled click and input numbers were re-measured with more runs; they fall within run-to-run variance.
- **Memory:** within 15%, apart from the sheet-replacement figure explained above.
- **Long tasks:** none in any scenario.

**What the hardening changed in performance:** nothing measurable, positive or negative. The codes shrink the bundle, and no hot path was slowed.

## E. Compatibility

**Native CSS `random()`** (`tests/browser/random.spec.ts`, 8 tests × 2 engines). Based on the CSS Values 5 Editor's Draft of 4 September 2026 and the engines' actual behavior:
- **What the engines implement.** Both implement the 2026 draft: a plain step argument, `random(0px, 100px, 10px)`; the keys `auto`, `--name`, `element-scoped`, `property-scoped` and `fixed 0.5`; per-element values; and values that stay stable across style recalculation.
- **What they reject.** Neither accepts the earlier draft's `by <step>` or `element-shared`, which Reactive CSS uses.
- **Bugs fixed:**
  - Reactive CSS warned on `random(a, b, step)` and on native keys, which are valid native CSS.
  - It ran its own runtime for mixed units that the browser supports.
  - Supported native calls now stay native and draw no diagnostic, and the runtime polyfills only what the browser lacks.
- **Scenarios covered:**
  - no native support (simulated through the same capability test the runtime uses);
  - full and partial support;
  - ranges, units, integers and decimals, max < min, a zero step, both step forms;
  - native keys;
  - event-time snapshots, several per element, repeated events;
  - stylesheet replacement;
  - native and Reactive rules on one page.
- **Documented semantic difference:** a native `--r: random()` custom property keeps the call as token text, and each `var(--r)` user rolls its own value. The polyfill gives one inherited value. 0.8.1 made the same choice.
- **Other overlapping names:**
  - `element()` (native image function) keeps its context check;
  - `attr()`, `if()`, `min()`, `max()`, `clamp()` and `round()` are evaluated by Reactive CSS only inside `state()` and mutations;
  - `pick()` has no native counterpart; native `random-item()` is unrelated and untouched.

**Compiler and CSSOM** (`tests/browser/cssom-090.spec.ts`, 12 tests × 2):
- **Conditional at-rules and nesting:** `@media` and `@supports` decide the winning mutation, re-evaluated at each event. `@container` too, as the container resizes. `@layer` ordering is respected. Nesting works for `&:on()`, a nested `:focus(when())`, and nested `--attr-*` and `content`.
- **Linked sheets:**
  - same-origin linked sheets work;
  - cross-origin sheets with CORS are compiled (states work), but their event and focus rules are dropped as untrusted;
  - cross-origin sheets without CORS are skipped with a note.
- **Disabled and alternate sheets:** event rules apply only while the sheet is enabled. With alternate sheets they follow what the browser actually applies; Chromium does not apply an enabled alternate stylesheet.
- **Insertion and removal:** 30 insertions and replacements leave one listener per event type, and removing the sheet removes all of them.
- **Large sheets:** a 3,000-rule native sheet keeps every rule.
- **Selector lists** that mix an `:on()` item with a plain selector are rejected like any invalid selector list. The browser drops the whole rule, as native CSS does with an invalid selector.
- **`@import`ed sheets** are not processed. Their native rules apply; their reactive rules do not. This is documented and unchanged since 0.8.

**Empty functional rules.**

| Pipeline | `.x:focus(when(--o)) {}` / `a:on(click, prevent) {}` |
|---|---|
| Browser CSSOM parse | Dropped (invalid selector). Irrelevant: Reactive CSS compiles from the source text, and the rules work (tested) |
| Reactive CSS compile and CSSOM rewrite | Kept, as `x:is(*) {}` and `a:is(*) { --rcss-o…: id }` |
| Inline and dynamically injected `<style>` | Work (CodePen harness, CSSOM tests) |
| esbuild `minifyWhitespace` | Kept |
| esbuild `minify` / `minifySyntax`, csso, lightningcss | **Removed silently.** Rules with declarations survive. |

The fix is a **documented integration requirement**: whitespace-only minification for Reactive stylesheets. It is in the RFC §11b and the migration guide. No 0.9 syntax can keep an empty rule alive without new API, and the runtime cannot see a rule that was removed before it loaded.

**CodePen-style environment** (`tests/browser/codepen.spec.ts`, 15 tests × 2). This is a local simulation, not codepen.io:
- an editor page rebuilds a `srcdoc` preview from HTML and CSS with only the external production script;
- 10 pens: counter, toggle, tabs, form binding, persistence (survives a preview rebuild), drag, focus, blur, text and attributes;
- the script placed before or after the CSS, 25 fast live CSS edits, 15 preview rebuilds, 10 stop/start cycles, and a strict CSP preview without eval.

No pen contains JavaScript. Verifying on the real service is in the manual checklist.

**CSP:**
- every 0.9 construct works under `default-src 'self'` with no inline scripts and no eval (`v090.spec`, `matrix.spec`, `codepen.spec`);
- custom bundles work under `default-src 'none'`;
- no violations were recorded.

**Legacy 0.8 syntax:**
- **Suites:** all 0.8.1 browser suites pass. `compat-090.spec.ts` runs 0.8 and 0.9 syntax on one page, with the full bundle and with the analyzer's trimmed bundle. The 0.8 constructs on that page are `on:` with `key()`, `text:`, `attr:`, `bind:` on radios, `focus:`, `:changed()`, `:nth-var()`, `:just-checked`, `mouse()`, `viewport()`, `element()`, `visible()`, `live()`, `random()` and `pick()`.
- **Assertions changed during 0.9 development and this pass** (each is intentional and additive, or the contract changed on purpose):

| File | Change | Why |
|---|---|---|
| `tests/unit/catalog.test.ts` | `runtimes` lists `onRules`, `gestures`, `persist`, `focusWhen`; `describe()` keys add `actionExpressions`, `onEvents` | Additive API |
| `tests/unit/state.test.ts`, `tests/browser/dist.spec.ts` | shipped expressions include `event` | Additive |
| `tests/browser/bundles.spec.ts` | 15 features (was 12); a `rule` kind; diagnostics decoded | Additive; production codes |
| `tests/unit/v05.test.ts` | `attr(name, fallback)` accepts a typed fallback; lists still error | Intended 0.9 extension |
| `tests/unit/v052.test.ts` | `state(1, 2, 3)` message names bind() and persist(); `aria-label` and `aria-hidden` allowed | Two modifiers in 0.9; intended allowlist extension |
| `tests/browser/v053.spec.ts` | `aria-label` replaced by `aria-describedby` as the rejected example | Intended allowlist extension (ID references stay forbidden) |
| `tests/unit/parser.test.ts` | `random(1px, 2px, 3s)`: a step-unit error with the interval hint, instead of "must be by <step>" | Aligned with the native syntax (plain step); the hint keeps the original intent |
| `tests/browser/helpers.ts`, `example-helpers.ts` | `diagnostics()` decodes production codes | Production codes; development text is unchanged by decoding |

None of them weakens a check. The decoding helper makes more of them strict, because production messages must now decode to the exact development text.

**Browsers:**
- **Chromium and WebKit:** every suite passes (section F).
- **Firefox: not verified.**
  - Playwright's Firefox (Nightly, build 1555) exits with "Could not find profile folder". That happens with Playwright's temporary profile, an explicit profile in the session scratch folder, and an isolated `HOME`.
  - It never writes to the profile folder, which points to the session's command sandbox blocking its macOS application-support lookup.
  - The sandbox was not bypassed.
  - The command to run on a normal terminal is in [manual-validation-0.9.md](manual-validation-0.9.md) §1.
- **Real Safari, touch and pen hardware, and screen readers:** manual (same checklist).

## F. Lifecycle and correctness

| Area | Evidence (Chromium + WebKit unless noted) | Result |
|---|---|---|
| Events | 500 rules on 500 elements; dynamic class changes; nested bubbling with `stop`, `once`, `prevent`; `submit`; keyboard activation (Enter, Space, key filters); rapid clicks; cascade order through `@media`, `@supports`, `@container`, `@layer`, `:when()` | Pass |
| State transactions | Swap through `var()`; inner and outer writes to one cell give one write (0.9) and two (legacy `on:`); type mismatches are reported, never stored; a missing event field writes nothing, never NaN | Pass |
| Event-time values | `var()` of plain custom properties with fallbacks, `calc()`, `clamp()`, `mouse()`, `element()`, `viewport()`, typed `attr()`, `random()` with both step forms, `event()` (32 fields; compile-time category checks) | Pass |
| Drag | 1, 100, 300 and 1,000 draggables; two concurrent pointers; a second pointer ignored; `pointercancel`; `lostpointercapture`; release far outside; removal, class change and rule removal mid-drag (silent end); reparenting mid-drag (cancelled, because the browser releases capture); `stop()` mid-drag; restart; a press in a field (no drag); 120 fast moves (last move kept); reduced motion; touch and pen via synthetic events | Pass |
| Persistence | First load; valid, invalid and type-changed stored values; lengths, percentages, strings; `bind(value)` + `persist` (storage wins); a shared key; local and session storage; storage that throws; quota errors (one note, last good value kept); reload 250 ms after a change (flushed on `pagehide`); unchanged values not rewritten; no writes after `stop()`; restart reads back; other tabs via the storage event, with no write-back | Pass |
| Form binding | 0.8.1 fast-choice fix (rapid checkbox clicks); radio groups with `bind:`; select, range, reset | Pass |
| Attributes | No redundant writes; restore when the rule stops matching; external changes win (the binding yields, with a note); `bind()` owns its attribute; unsafe names rejected; new ARIA kinds | Pass |
| Text | Empty element, one text node, nested HTML (never touched), several nodes, markup kept as text, native `::before` content, insertion, source replacement and restore | Pass |
| Focus | Never on load; no refocus while true; disabled, non-focusable and removed targets skipped with a note; the first eligible target wins; dialog open and close by click and keyboard; rule removal stops requests | Pass |
| Blur | Nothing at load; 20 fast cycles; nested fields with `:has(:blur)`; animation end (the marker stays until the next focus); a rule without animation; removal; stop/start | Pass |
| Runtime stop/start, dynamic DOM and sheets | 20 stop/start cycles; 10 × 200 mounts; CodePen rebuilds and edits; moved subtrees re-matched (bug fixed) | Pass |

**Bugs found and fixed in this pass:**
1. **Moved elements kept rules they no longer matched** (also in 0.8). A subtree moved within the document was only re-matched for additions. States, bindings and candidates of rules it left stayed attached. Fixed in `core/elements.ts`; covered by the drag reparenting test.
2. **Message text used as logic:**
   - the custom-element `disabled` wait checked `message.includes('not defined yet')`;
   - the native-function note sliced a message.

   Both broke with production codes. They now use an explicit kind and their own template.
3. **`random()` took over valid native CSS:** warnings, and mixed units run by the runtime. Fixed (section E).
4. **Drag started from fields inside a draggable**, so selecting text moved the card. Fixed.
5. **Bare `:blur` rejected**, although the RFC recommends `:has(:blur)`. Fixed.
6. **`.d.ts` failed under `node16` and `nodenext`.** Fixed with `tools/fix-dts.mjs`.
7. **`reactive-css explain` would have needed esbuild.** The CLI decodes before loading the bundler.

**Test totals (final runs on the finished code):**

| Suite | Before hardening | After |
|---|---:|---:|
| Library unit (vitest) | 166 | **188 passed** |
| Library browser, Chromium + WebKit | 702 passed, 6 skipped | **848 passed, 6 skipped, 0 failed** |
| Chromium at 4× CPU throttle | 354 | **427 passed** |
| Examples on analyzer bundles (`RCSS_CUSTOM=1`), 2 engines | 134 | **134 passed** |
| Dist (ESM, types consumer, browser) | 3 + 4 | **3 + 4 passed** |
| Experiments (functional), Chromium + WebKit | 765 passed, 8 skipped (see note) | **768 passed, 8 skipped, 0 failed** |
| Experiments (`@perf`, serial) | 53 | **53 passed** |

**Note on the experiments.** Their Playwright config also has a Firefox project. Run without `--project`, the suite reports 387 Firefox failures: every one is a browser-launch failure, and the counts fit exactly (1,164 = 3 × 388). The earlier "765 passed" figure in the preparation report came from the same kind of run. Its summary line hid those launch failures, because only its last lines were read. The figures above are from explicit Chromium + WebKit runs.

**New suites:**
- unit: `diagnostics.test.ts`, `matrix.test.ts`;
- browser: `production`, `matrix`, `random`, `cssom-090`, `codepen`, `hardening`, `compat-090`.

## G. Unresolved risks

| Class | Risk |
|---|---|
| **Release blocker** | None found in behavior. Before publication the pre-existing blockers remain: the npm name `reactive-css` is taken, and `repository`, `homepage` and `bugs` are missing from `package.json`. |
| **Important, not blocking** | Minifiers delete empty event and focus rules (section E); the requirement must be in the user documentation. |
| | `--attr-*` claims a namespace. Allowlisted names (`aria-*` states, `data-*`, `disabled`, `hidden`, `required`, `tabindex`) in any trusted stylesheet now write attributes. A plain sheet whose only reactive token is `--attr-data-x` is now compiled. No such name exists in this repository's examples, experiments or site (zero matches), so the risk is low but real for third-party CSS. **Recommendation:** accept; keep the migration note and add a "reserved namespace" note to the website docs. |
| | Default bundle size: 49.9 KB gzip, +26% over 0.8.1. It is at its practical minimum while the full `describe()` registry stays in it. |
| | Core-only bundles carry the 0.9 compile paths: 47.4 KB against 41.9 KB in 0.8.1. |
| **Browser-specific** | Firefox is unverified (environment). Chromium does not apply enabled alternate stylesheets, and event rules follow the browser. WebKit does not focus buttons on click (Safari behavior); the tests account for it. |
| **Manual validation required** | Real Safari, touch and pen hardware (drag, `touch-action`, system cancels), screen readers (ARIA states, focus requests, drag keyboard paths), real CodePen: [manual-validation-0.9.md](manual-validation-0.9.md). |
| **Future optimization** | Parser plugins so core bundles do not carry 0.9 compile code; a choice about the default registry. `:on(pointermove)`, `:on(scroll)` and drag cost 4–5× a hand-written handler: 0.1–0.2 ms per event, under 1% of a core at 60 events per second. |

## H. Stability recommendation

| Feature | Recommendation | Reason |
|---|---|---|
| `:on()` | **Stable** | Broadest coverage: cascade, modifiers, transactions, keyboard, CSP, bundles, legacy coexistence, both engines. The semantics are fully specified, and the only open item (empty modifier-only rules under minifiers) is an integration rule. |
| `event()` | **Stable** for the pointer, keyboard and form fields; **experimental** for the drag fields | The fields are checked at compile time. Drag fields depend on gesture semantics still waiting for hardware validation. |
| `bind(value)` / `bind(checked)` in `state()` | **Stable** | Reuses the 0.3 binder (8 releases of fixes), plus reset and persistence tests. |
| `persist()` | **Experimental** | Correct in every automated case, but it touches real storage policies: Safari private mode, partitioned storage in iframes. Those need manual runs. |
| `--attr-*` | **Stable semantics, experimental namespace** | Same runtime as `attr:`. Keep it experimental until the website documents the reserved namespace. |
| `content` DOM binding | **Experimental** | Narrow eligibility by design. The interaction with native `content` across engines (strings on elements render nothing in Chromium and WebKit) needs Firefox. |
| `focus: when()` (replaces `:focus(when())`, section J) | **Experimental** (as in 0.8) | The 0.6 runtime with its accessibility safeguards; a declaration, so no minifier risk. Screen-reader validation is pending. |
| `:blur` | **Stable** | A small marker with clear semantics, fully covered. |
| Drag gestures | **Experimental** | No real touch or pen hardware yet. Reparenting cancels the drag (browser capture semantics). |

## I. Release readiness

1. **Ready for the website and documentation migration phase?** Yes. The language, runtime, builds and diagnostics are complete and verified in Chromium and WebKit. The migration needs to document:
   - the empty-rule minifier requirement;
   - production diagnostic codes and `reactive-css explain`;
   - the `--attr-*` reserved namespace;
   - the stability labels above.
2. **Is the bundle size acceptable?**
   - The compact bundle (43.1 KB gzip) meets the target, and every custom bundle is 8–11% smaller than rc1.
   - The full default bundle (49.9 KB gzip) is acceptable only if the full `describe()` metadata is wanted in production. The maintainer decides (section B).
3. **Unresolved native CSS compatibility issues?** Only the documented ones:
   - minifiers drop empty functional rules;
   - native `random()` in a custom property is resolved where it is used.

   No runtime interception of valid native CSS remains that I know of.
4. **Measurable performance regressions?** None confirmed against rc1 or 0.8.1. Startup, memory, idle work, click latency, `live()`, `mouse()` and plain-CSS compile are within noise. The largest measured difference is compiling a large mixed stylesheet: +6.5% (1.6 ms).
5. **Which features stay experimental?** `persist()`, `content`, `focus:` (experimental since 0.6), drag and its `event()` fields, and the `--attr-*` namespace. `:on()`, `bind()` in `state()` and `:blur` can be stable.
6. **What still needs real-device or manual testing?**
   - Firefox;
   - real Safari, macOS and iOS;
   - touch and pen drag;
   - screen readers;
   - reduced motion and forced colors;
   - a real CodePen run.

   All are in the checklist.
7. **What must be fixed before publication?** No code issue is known.
   - **Publishing prerequisites:** the npm name, and the package metadata fields `repository`, `homepage` and `bugs`.
   - **Before calling Firefox supported:** run the Firefox suite.

## J. API cleanup: final syntax decisions

**Changes:**
- **Focus requests:** `focus: when(condition)`, the 0.6 declaration, is the only focus request.
  - `:focus(when(...))` was removed from the compiler, the runtime (`FocusWhen` and `runtimes.focusWhen`), the API registry, the catalog (`sel:focus-when`), the analyzer and the internal docs.
  - A functional `:focus(...)` gets one diagnostic that says to write `focus: when(...)`.
  - Native `:focus` is unchanged.
  - The focus lifecycle and safeguards are the 0.6 ones. `:blur` is unchanged.
- **`:on()` modifiers are functions:** `prevent()` and `stop()`, each optional and independent.
  - `stop()` calls `stopPropagation()`, never `stopImmediatePropagation()`.
  - Bare `prevent` and `stop` are compile errors ("write the modifier as a function: prevent()").
- **`once` / `once()` were removed** from `:on()`, with the per-element registration records (`fired`, rule signatures, the `specs` map). They are compile errors that suggest a `:when()` guard. Legacy `on:` is unchanged.
- **Benchmark pages** for 0.9 syntax now write the focus request in each build's own syntax: `compare.mjs`, `focusReq()`.

**Sizes** (same settings as section B; before = the hardened build, frozen in `benchmarks/baseline/v0.9.0-hardened/`):

| Bundle | Before (min / gzip / brotli) | After | Δ min / gzip |
|---|---|---|---|
| `reactive-css.min.js` | 151,472 / 49,936 / 43,811 | **149,039 / 49,233 / 43,272** | −2,433 / −703 |
| `reactive-css.compact.min.js` | 130,469 / 43,054 / 37,982 | **128,495 / 42,488 / 37,584** | −1,974 / −566 |
| Minimal state (core) | 47,418 / 17,668 | 45,330 / 16,890 | −2,088 / −778 |
| Counter (events, text) | 80,788 / 27,648 | 78,484 / 26,834 | −2,304 / −814 |
| Forms (events, forms) | 85,056 / 28,848 | 82,752 / 28,060 | −2,304 / −788 |
| Persistence | 51,068 / 18,957 | 48,975 / 18,184 | −2,093 / −773 |
| Drag (events, gestures) | 80,397 / 27,649 | 78,093 / 26,847 | −2,304 / −802 |
| Sensors (dynamic, geometry) | 54,199 / 19,837 | 52,103 / 19,060 | −2,096 / −777 |
| Focus (events, focus) | 85,020 / 29,010 | 78,907 / 27,145 | −6,113 / −1,865 |
| Focus with `when()` (+ conditions) | — | 85,503 / 29,351 | +483 / +341 against the old focus bundle |
| Full custom (compact registry) | 128,941 / 42,705 | 126,967 / 42,129 | −1,974 / −576 |

- **Parser and tokenizer:** 22,168 → 21,404 B.
- **`:on()` runtime:** 8,361 → 8,162 B.
- **Focus and blur:** 4,289 → 3,461 B.
- **Trade-off:** `focus: when()` needs `when()` from `conditions`, which the analyzer adds. A page whose only reactive condition is a focus request carries `conditions` (+6.6 KB minified). `focus: var(--open)` needs no `conditions`.
- **Minifier risk is smaller:** focus requests are declarations, so only modifier-only `:on()` rules are empty rules now.

**Performance** (`benchmarks/v090/results-cleanup.{json,md}`; before = hardened; 5 interleaved runs; same session):

| Scenario | Before | After |
|---|---:|---:|
| Startup, 10,000 components, 0.9 syntax (task ms) | 179.1 | 179.4 |
| Mounted memory / retained after 10 × 1,000 mounts (MB) | 16.9 / 1.23 | 16.9 / 1.23 |
| Idle 10 s: script ms, flushes, ticks | 0, 0, 0 | 0, 0, 0 |
| Click, script ms per click (0.9 syntax) | 0.0423 | 0.0412 |
| Click → focus (ms) / focus moves out of 40 clicks | 0.7 / 20 | 0.5 / 20 |
| Drag, ms per move (1 / 1,000 candidates) | 0.138 / 0.164 | 0.138 / 0.103 (noisy) |
| Compile 500 `:on()` rules / 5,000 native + 1 reactive (ms) | 6.4 / 28.1 | 6.1 / 27.5 |

No change exceeds run-to-run variation, so there is no regression.

**Tests (final, after the cleanup):**

| Suite | Result |
|---|---|
| Unit | **196 passed** |
| Browser, Chromium + WebKit | **848 passed, 6 skipped** (two full runs). One run had a load-sensitive failure in `api-examples` "live-values" on a custom bundle, which passed 3 of 3 times alone and in both later full runs. |
| 4× CPU (Chromium) | **427 passed** |
| `RCSS_CUSTOM=1` examples | **134 passed** |
| Dist | **3 + 4 passed** |
| Experiments, Chromium + WebKit | **768 passed, 8 skipped** |
| README introduction | Compiles with no diagnostics |

**Tests changed for the new contract:**
- the trigger and modifier tables: `prevent()` and `stop()` accepted in either order; bare names, `once`, `once()`, `prevent(1)` and a repeated `stop()` rejected with their messages;
- the focus request tests, now `focus: when()`, plus the diagnostic for `:focus(when())`;
- the fixtures `overlays`, `focus`, `events`, `disclosure` and `drag`;
- the matrix (focus bundles add `conditions`), the CodePen pens, the CSSOM nesting, hardening and compatibility tests;
- the untrusted-sheet message.

No assertion was relaxed.

