# Reactive CSS 0.9.0: engineering report

> **API cleanup (final syntax):** `:focus(when())` is replaced by the 0.6 `focus: when()` declaration; `:on()` modifiers are functions (`prevent()`, `stop()`); `once` is removed. Results: [release-0.9.0-hardening.md](release-0.9.0-hardening.md), section J. The mentions of the removed syntax below describe the rc1 candidate.
>
> **Superseded in part by the hardening pass:** [release-0.9.0-hardening.md](release-0.9.0-hardening.md). Its sizes, tests, compatibility findings and stability recommendations are current. This report describes the candidate before that pass (rc1, frozen in `benchmarks/baseline/v0.9.0-rc1/`).

**Status:** local release candidate. **Not published:** no npm, CDN, Git, deployment or website change. **Date:** 2026-10-22.

Related documents:
- design: [rfc-v0.9.0-language.md](rfc-v0.9.0-language.md);
- migration: [migration-0.9.md](migration-0.9.md);
- performance: `benchmarks/v090/results.json` (raw) and [results.md](../benchmarks/v090/results.md);
- sizes: `benchmarks/audit/results/v090/bundle-sizes.{json,md}`.

**Baseline.** The baseline is the 0.8.1 release candidate. Its production bundle was copied before any change to `benchmarks/baseline/v0.8.1/`. Every comparison below runs that file and the 0.9.0 build in the same browser, with the same pages and method.

**The pointer-snapshot patch** (`docs/patches/pointer-snapshot/`) was **not applied**. Its RFC was used as reference. Pointer snapshots exist in 0.9 as `event(client-x)`, `event(local-x)` and event-time `mouse()` inside `:on()` mutations, so the patch is superseded.

## 1. Implementation status

**Implemented** (each item is tested in Chromium and WebKit):

| Area | What |
|---|---|
| Event rules | `:on(event [, prevent] [, stop] [, once])` with 32 DOM events, `keydown(Key)` and `keyup(Key)`, `outside(click \| pointerdown \| focusin)`. One winning mutation per (state, trigger, element) through the cascade. One transaction per event. |
| Mutations | `set(expr)`, `toggle()`, `increment(n?)`, `decrement(n?)`, `cycle(…)` on the state's own property |
| Event-time expressions | Typed `calc()`, `min()`, `max()`, `clamp()`, `round()`, `abs()` and `var()`. `event(field)` with a closed catalog of 32 fields, checked against the trigger at compile time. One-time readings of `mouse()`, `element()`, `viewport()`, `random()`, `pick()`, `attr()`, `sibling-index()` and `sibling-count()`. |
| Drag | `:on(drag)` and `drag(start \| move \| end \| cancel)`, through one gesture engine. `event(x)` and `event(y)` are the state at drag start plus the distance. Also deltas, movement, start point, pointer capture, a 3 px threshold, cancel, and removal during a drag. |
| Persistence | `persist("key" [, local \| session])` with typed validation, coalesced writes, shared keys, cross-tab sync and failure handling |
| Binding | `state(v, bind(value \| checked))`, two-way with the owner control. `state(v, bind(attribute))` is unchanged. |
| Attributes | `--attr-*` reserved namespace. The allowlist adds `aria-hidden`, `aria-busy`, `aria-invalid`, `aria-checked` (tristate), `aria-valuenow`, `aria-label` and `aria-valuetext`. |
| Text | `content` on elements becomes DOM text when it reads state; the native declaration is kept |
| Focus | `:focus(when(condition))` requests, with the 0.6 guarantees. `:blur` transition selector. |
| Initialization | `state(attr(name, typed fallback))`, read once |
| Bundles | New features `gestures`, `persist` and `blur`. The analyzer detects all new syntax and reports legacy declarations. Missing-feature diagnostics work. |

**Partially implemented, or narrower than the brief:**
- **`content`** is reactive only when its value reads state, the rule has no pseudo-element, and the value has no image or `attr()` (RFC §8). This is the documented eligibility model. A `var()` that resolves to an image at runtime is left to the browser silently.
- **`stop`** stops our ancestor rules synchronously. For native listeners it stops propagation when the event reaches the element, never in the capture phase.
- **Explicit owners (`closest()`)** have no 0.9 form. `on:` keeps them.

**Deferred or not done:**
- radio groups in the 0.9 form: `bind:` remains the way to bind a control to an ancestor state, by decision (RFC §14);
- sortable lists and HTML drag and drop (out of scope);
- shadow-root stylesheets (as in 0.8);
- named and `fixed` `random()` caching options (diagnostic, unchanged).

**Intentional behavioral changes:**
- `--attr-<allowlisted>` custom properties now write attributes. This is the only possible break.
- `attr()` fallbacks may be typed.
- `state()` accepts two modifiers.
- Focus requests are also armed by `pointerup` and `submit`.
- `aria-label` and `aria-hidden` are now writable.
- In 0.9 rules, two writes to one cell in one event apply once, the outer one; legacy `on:` keeps its sequential semantics.

## 2. Compatibility

| Target | Result |
|---|---|
| Chromium 156 (Playwright) | All suites pass (section 3) |
| WebKit 27.2 (Playwright) | All suites pass |
| Firefox | **Not run.** Playwright's Firefox (Nightly 1555) fails to launch here: "Could not find profile folder". No Firefox claim is made. |
| Native CSS | Sheets without reactive syntax are not tokenized. `:focus`, `:focus-visible`, `::before { content }`, literal and image `content`, `calc()`, `:has()` and `if()` are untouched (unit tests). Native `random()` keeps the 0.8.1 per-element detection. |
| Strict CSP | `default-src 'self'; style-src 'self'; script-src 'self'`: `:on()`, `--attr-*`, `content` and drag work with no violation. Custom bundles pass under `default-src 'none'`. |
| CodePen-style pages | An injected `<style>` replaced 20 times, with the script loaded after the CSS: one sheet record, no accumulated watchers or listeners |
| 0.8 syntax | The 0.8.1 browser suite passes unchanged except 6 assertions. They cover additive changes: the feature count, the `rule` kind, `describe()` keys, and the `attr()` fallback and `state()` arity messages. Also the allowlist: `aria-label` and `aria-hidden` are now allowed. |

## 3. Testing

| Suite | 0.8.1 | 0.9.0 |
|---|---|---|
| Library unit (vitest) | 103 | **166 passed** |
| Library browser, Chromium + WebKit | 628 passed, 6 skipped | **702 passed, 6 skipped, 0 failed** |
| …of which new 0.9 integration (`tests/browser/v090.spec.ts`) | — | 70 (35 × 2) |
| Chromium at 4× CPU throttle | 317 | **354 passed** |
| Examples on analyzer bundles (`RCSS_CUSTOM=1`), Chromium + WebKit | 134 | **134 passed** |
| Dist (ESM, types consumer, browser) | 3 + 4 | **3 + 4 passed** |
| Experiments (functional, both runtimes) | 480 | **765 passed, 8 skipped** on Chromium + WebKit. The suite grew with Visual Lab Wave 2. Correction (hardening pass): that run also had a Firefox project whose launch failures were not reported here; see [release-0.9.0-hardening.md](release-0.9.0-hardening.md), section F. |

**What the 0.9 suites cover:**

| Kind | Coverage |
|---|---|
| Unit | Grammar and validation tables: triggers, modifiers, mutations, placement, `state()` modifiers, `--attr-*`, `content` eligibility, `:focus(when())`, `:blur`. Typed arithmetic and unit errors. Event fields and drag fields. Persistence decoding (types, injection attempts). Slot compilation and the last declaration winning. The pre-filter. Analyzer feature mapping and legacy listing. Physical absence of left-out features from custom bundles. |
| Browser | The integration components in `tests/fixtures/v090/` (9 HTML/CSS pages, no application JavaScript): counter, toggle, tabs (keyboard with prevent), accordion, dropdown (outside and Escape), dialog (focus request and return), text preview, checkbox, radio group, select, range, form reset, attribute reflection, persisted theme across reloads, persisted shared counter, storage failure, pointer and element-size snapshots, random and viewport snapshots, a swap transaction, `:blur`, focus requests, nested events with stop, once and prevent, `:when()`-conditional rules, submit with prevent, scroll events, and ARIA tristate, number and text. |
| Drag | Card across drags, threshold, sliders, split panel, 300 inserted draggables, cancel, touch and pen, 20 rapid drags with click suppression, removal during a drag, stop and start |
| Lifecycle | CodePen-style replacement, 20 × stop/start, 10 × mount/unmount of 200 components (bindings, states, persistence groups, attribute and text bindings back to zero), strict CSP |

**Coverage gaps:**
- Firefox;
- real touch and pen hardware (pointer events are synthesized);
- screen readers;
- real Safari (WebKit only);
- heap snapshots per class: the lifecycle tests use the development probes and `stats()`, and the benchmark measures retained heap;
- shadow DOM.

## 4. Performance

Chromium 156, Apple M4 Max. Five runs per cell, interleaved, median (min–max) in `results.md`.

The startup, idle, memory, `live()` and compile sections were measured on the build before the dispatch optimization (below). That change touches only per-event code. The click, pointer and drag sections were measured again after it.

**Startup (task ms, 3 elements per component):**

| Components | v0.8.1 | v0.9.0, 0.8 syntax | v0.9.0, 0.9 syntax | Δ (0.9 syntax) |
|---|---|---|---|---|
| 100 | 17.1 | 17.4 | 17.7 | +3.5% |
| 1,000 | 34.8 | 34.6 | 35.2 | +1.1% |
| 5,000 | 95.7 | 97.2 | 95.1 | −0.6% |
| 10,000 | 172.6 | 172.9 | 176.5 | +2.3% |

- **One-feature 0.9 bundles, 1,000 components:** core + events 26.7 ms, + forms 26.8, + focus 26.4, + persist 27.8, + events + gestures 26.9.
- **Compile time:** the per-sheet compile on these pages is 1.2 ms (0.8.1) and 1.8 ms (0.9 syntax).

**Events (script per click, CDP totals; `performance.now()` is coarsened to 0.1 ms here):**

| 1,000 components, 150 clicks | Script ms per click | Event → DOM text |
|---|---|---|
| v0.8.1 (0.8 syntax) | 0.0320 | 0 ms median, 0.1 p95 |
| v0.9.0 (0.8 syntax) | 0.0362 (+13%) | same |
| v0.9.0 (0.9 syntax) | 0.0364 (+14%) | same |
| plain JavaScript | 0.0104 | same |

- **Noise.** The +13% is about 4 µs per click. The 0.8.1 baseline itself varied between 0.032 and 0.038 ms across our runs: in the first full run, 0.8.1 measured 0.0377 against 0.0362 for 0.9. This is within run-to-run variance, but it is flagged.
- **Event-to-DOM latency is unchanged.** On these pages it is the same task, because the attribute writes run promptly. On a text-only page it is the next frame, about 13 ms.
- **Cascade reads:** one rule 0.0273 ms per click; five competing rules (one style read) 0.0323 ms.
- **Four mutations in one transaction:** 0.0388 ms.

**High-frequency input:**

| Scenario | v0.8.1 | v0.9.0 | Plain JS |
|---|---|---|---|
| `mouse(x)` live on 1,000 elements, script ms/s | 3.65 | 3.64 | — |
| `:on(pointermove)` snapshot, one element, script ms/s | — | 6.81 | 1.81 |
| Drag, 1 candidate, script ms per move | — | 0.103 (0.137 before the fix) | 0.026 |
| Drag, 1 among 1,000 candidates, ms per move | — | 0.117 (0.147 before) | 0.026 |
| Forced layouts during a 300-move drag | — | 0 | 1 |
| Long tasks | — | 0 | 0 |

- **Drag cost.** A drag costs about 4× the script of a hand-written handler, about 6 ms per second at 60 moves per second (under 1% of a core). It forces no layout.
- **Persistence.** A persisted position performed 21 `setItem` calls during a 300-move drag of about 5 s, about 4 per second, as designed.

**Idle (10 s after start, 1,000 components with every new feature):**
- 0 ms script, 0 flushes and 0 timer ticks, as in 0.8.1.
- This section ran 3 runs, not 5.

**Memory:**
- 10,000 components mounted: 16.8 MB (0.8.1), 16.9 MB (both 0.9 syntaxes), +0.6%.
- After 10 × 1,000 mount/unmount and GC: 1.22 MB retained (0.8.1) against 1.23 MB.
- Bindings and states return to 0.

**`live(random(), 200ms)` on 10,000 elements:** frame p95 16.8 ms in both versions.

**Compile:**

| Sheet | v0.8.1 | v0.9.0 |
|---|---|---|
| 500 `on:` rules | 4.8 ms | 5.1 ms |
| 500 `:on()` rules | — | 6.5 ms |
| 2,000 `:when()` selectors | 11.2 ms | 11.6 ms (+3.6%) |
| 5,000 native rules + 1 reactive rule | 26.7 ms | 28.5 ms (+6.7%) |

Investigated regressions (all fixed except where stated):
1. **Compile overhead on large native sheets: +26%.** Cause: the new selector code split every selector list and built a second "certain" string per rule. Both now run only for `:on()` and `:focus(when())` rules. After the fix: +9% in the trial run, +6.7% in the full run.
2. **Per-event cost of `:on()`: +25% over legacy `on:`.** Profiling by elimination found the cause: a diagnostic string with `describeElement()`, which joins the class list, was built on every event. It is now built only when a warning is emitted. A single-rule fast path and fewer allocations were added. After the fix the new path costs the same as legacy `on:` on 0.9.0, and drag moves are 25% cheaper.
3. **Remaining:** click script +13% over 0.8.1, which is within baseline variance (see above).

**Bundle sizes:**

| Bundle | v0.8.1 min / gzip / brotli | v0.9.0 min / gzip / brotli | Δ min |
|---|---|---|---|
| `dist/reactive-css.min.js` (full) | 117,830 / 39,715 / 34,983 | **162,675 / 54,074 / 47,147** | **+38.1%** |
| `dist/reactive-css.compact.min.js` | 101,644 / 34,357 / 30,418 | 141,672 / 47,274 / 41,449 | +39.4% |
| custom `core` | 41,873 / 15,530 / 14,102 | 53,449 / 19,277 / 17,474 | +27.6% |
| custom `basic` (events) | 53,208 / 18,844 / 17,049 | 85,926 / 29,461 / 26,488 | +61.5% |
| custom full | 100,112 / 34,023 / 30,110 | 140,148 / 46,856 / 41,135 | +40.0% |

**What each feature adds over its requirements** (minified; compressed sizes are not additive):

| Feature | v0.8.1 | v0.9.0 |
|---|---|---|
| `events` | +11,335 | +32,477 (the evaluator 11.8 KB, the `:on()` runtime 8.9 KB) |
| `focus` | +3,504 | +7,350 |
| `gestures` | — | +2,209 |
| `persist` | — | +3,831 |
| `blur` | — | +927 |

Other features are within about 1 KB of 0.8.1.

**Core** grew 11.6 KB:
- the parser for the new constructs;
- the registry entries;
- the persistence and binding hooks.

**Diagnostic message strings** are 44% of the minified parser and 31% of the evaluator. They are the main lever if size must come down: for example, message codes in production builds with the texts in the development build. That was not done, because 0.8 ships full messages in production and changing it is a product decision.

**Thresholds** (10% latency, 15% memory):
- Memory: within.
- Event latency: within.
- Script per click: +13 to 14%, within noise, flagged.
- Bundle size: +38%. This is the cost of the new features, measured and broken down above, and is not hidden.

## 5. Architecture

**Modules added (`src/`):**
- `state/on.ts`: `:on()` compile helpers, candidate tracking, the cascade slots, modifiers and the transaction;
- `state/actexpr.ts`: the event-time expression parser and evaluator;
- `state/gesture.ts`: the drag engine;
- `state/persist.ts`: storage;
- `selectors/blur.ts`;
- `features/{gestures,persist,blur}.ts`.

**Modules changed:**
- the parser: rule-level pseudo-classes, `state()` modifiers, `--attr-*`, `content`;
- the engine: new watchers and cleanups;
- `actions.ts`: the shared dispatcher hook, `keyup` paths, `preventEvent()`;
- `state.ts`: the persistence hooks and the precedence rules;
- `focusdecl.ts`: `FocusWhen`;
- `bindattr*.ts`: new ARIA kinds;
- `expr.ts`: typed `attr()` fallback;
- the registry, the catalog and `features.ts`;
- `tools/bundle.mjs`: exact keys first, the legacy listing.

**Dependency graph:** in RFC §12, enforced by the "each feature builds alone" test, which now covers 14 features.

**Cleanup guarantees:**
- Listeners are reference-counted per event type.
- The pointerdown listener exists only while drag rules exist.
- Move listeners exist only during a gesture.
- Candidates and `once` records are WeakMap-keyed by element.
- Persistence groups are released with their last cell.
- `stop()` releases everything: tested with 20 cycles, drag stop/start, and 10 × mount/unmount.

**Parser and CSSOM:**
- **Unchanged in principle:** the engine compiles from the source text and rewrites the same `CSSStyleSheet` through the CSSOM.
- **Rule-level syntax:** `:on()` and `:focus(when())` become ordinary rules with generated slot properties. Selectors the browser cannot parse never reach the CSSOM, and empty rules survive because the source is the input.
- **Untrusted sheets:** event and focus rules are removed from untrusted sheets.

**Remaining risks:**
- The size increase.
- `once` registration identity is the rule text: editing a rule creates a new registration.
- Synthesized pointer events only, no real touch hardware.
- `stop` relies on a one-shot element listener for native propagation.
- `@container`-conditional event rules cost one style read per event on their elements.
- The website still documents and syncs 0.8.1.

## 6. Release readiness

- **Ready for a separate website and documentation migration?** Yes, for the language and runtime as specified. The website, Storybook, the Control Center and public examples were not touched. They still describe and bundle 0.8.1, and `site/` was not run against 0.9.0.
- **To decide or fix first:**
  1. Accept the bundle size, or decide on production message codes.
  2. Decide whether the 0.9 features stay "experimental" for the first public release.
  3. Settle the npm name, and the `repository`, `homepage` and `bugs` fields (pre-existing blockers from 0.8.1).
- **Still needs physical or manual validation:**
  - Firefox (not launchable here);
  - real touch and pen devices for drag (touch-action guidance, pointercancel by scrolling);
  - screen readers with `:focus(when())`, `aria-checked`, `aria-label`, and the keyboard alternatives in the drag fixtures;
  - real Safari.
- **Regressions against 0.8.1:**
  - none in behavior: the 0.8.1 suites pass;
  - performance within thresholds except the flagged +13% script per click, which is noise-level;
  - size +38%, measured and explained.

## 7. Files outside `src/` and tests

**Written:**
- `docs/rfc-v0.9.0-language.md`, `docs/migration-0.9.md` and this report;
- `CHANGELOG.md` (0.9.0 local entry) and `README.md` (introduction, status, features);
- `benchmarks/v090/` (`compare.mjs`, `results.*`);
- `benchmarks/baseline/v0.8.1/` (frozen bundles);
- `benchmarks/audit/results/v090/`;
- `tests/fixtures/v090/`.

**Version:** set to 0.9.0 in `package.json`, `src/core/version.ts` and the `package-lock.json` metadata, as in the 0.8.1 workflow.

**`experiments/.out/`:** these generated bundles were rebuilt by the experiments' own `build-bundles.mjs` for the regression run. Their sources were not edited.

**`npm pack --dry-run`:** 162 files. It excludes `docs/patches/` and the pointer-snapshot RFC. No tests, fixtures or benchmarks are included.
