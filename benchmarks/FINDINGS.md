# Performance audit: findings (v0.1.0 → current)

Measured on an Apple M4 Max with Playwright's Chromium 156 (headless). Tools: `benchmarks/profile.mjs` (V8 heap snapshot grouped by constructor, CPU sampling profile), `benchmarks/quick.mjs` (one scenario, CDP metrics), `benchmarks/run.mjs` (full matrix, Chromium trace). The v0.1.0 build is kept in `benchmarks/baseline/` so every before/after number comes from the same harness.

## What the profiles showed

| # | Finding | Evidence (10,000 elements, v0.1.0) | Fix |
|---|---|---|---|
| 1 | **Closures per element.** Every binding built about 8 closures (`get`, `reset`, `dispose` wrappers per call and per argument, a `notify` closure, the `every()` callback). | Heap snapshot, `live(random(), 200ms)`: 160,009 `get`, 140,000 `reset`, 120,002 `dispose` closures, 180k closure scopes, 200k plain objects. 32.6 MB JS heap. GC: 79 ms per 3 s. | Expression instances are small classes. The `Binding` is the context. Static arguments (and all-static argument arrays) are shared by every element. `live()` subscribes the instance object itself, and `on()` uses `handleEvent`. **6.0 MB** (heap; profile run: GC 27 ms per 3 s). |
| 2 | **Same value computed per element.** `mouse(x)` formatted the same pointer value 20,000 times per frame (`toFixed`), and queued 20,000 jobs in a `Set`. | CPU profile, mouse: `fmt` 173 ms and `dirty` 136 ms per 3 s; script 288 ms/s; p95 frame 33 ms. | `mouse()` in viewport mode is a shared source: one listener, one value per axis per change, one subscription per declaration. Its value is written on a common ancestor when the matching elements are dense, otherwise per element. **Script 3.3 ms/s, p95 16.7 ms.** |
| 3 | **Root write vs per-element writes.** Not decided in advance: measured with plain JS. | 2 custom properties per frame, 10k bound elements: per element 538 ms/s style, root 275 ms/s. 1 bound element in a 10k page: per element 6 ms/s, root 232 ms/s. | The common-ancestor rule above (≥16 elements that make up ≥50 % of the subtree). |
| 4 | **Literal ranges parsed on every roll.** | `random()`'s regex parse dominated `live()` script time. | Parsed once at compile time. `toFixed` replaced with `Math.round` (`fmt`). |
| 5 | **Per-flush allocations.** One write closure per changed value per frame, a `Set` for the queue, and a copied array of interval subscribers on every tick. | GC pressure in the profiles. | A job queue deduplicated by a flag on the job, write list reusing the queue array, no copy on tick. |
| 6 | **Frame drops even when JS is equivalent.** Writing 20,000 custom properties in one frame costs more than a frame, whoever does it. | `live(…, 200ms)`, 10k: p95 33 ms for v0.1.0 *and* for the equivalent plain-JS implementation. | A frame budget (about 4 ms of script, using an adaptive cost per job). Large batches continue in the next frame. p95 **16.8 ms**. Trade-off: total style and composite time per second goes up (more frames with work), and some elements update 1–2 frames later. |
| 7 | **Attribute changes re-matched every rule.** Any `class`/`id`/`[attr]` change re-matched all watchers, and the check for elements that left scanned all members (O(members)) for each change. | Code audit. | Each watcher has its own attribute dependencies. The removal check walks the smaller of the subtree and the member set. Membership is stored in arrays instead of a `Set` per element. |
| 8 | **`:nth-var()` rewrote every sibling and scanned every group.** Each update touched all children, and each ancestor attribute change tested `contains()` against all groups. | Code audit; nthvar script 16.9 → 7.8 ms/s. | The active element is tracked per group. A value change touches only the old and new element (a test checks: exactly 2 attribute mutations). An ancestor index finds affected groups directly. A full pass runs only after structural changes. |
| 9 | **Read/write interleaving on bind.** Each new binding computed (read) and wrote its first value immediately. For `mouse(x, local)` this forced a layout per element. | `mouselocal` init, 10k: 68 ms (v0.1.0: 82 ms). | New bindings are settled together at the end of the batch (all reads, then all writes), still in the same task. 28 ms. |
| 10 | **Native random() exists now.** Chromium 156 and WebKit 27.2 support `random(min, max)` with per-element values. They do not support `by` steps or `element-shared`. | `CSS.supports` and a probe with two elements. | A top-level static `random(min, max)` compiles to native `random()` when the probe confirms per-element values: zero bindings and zero JS after start. The probe uses a `display:none` host (half the cost of a hidden box). |

## Not changed, on purpose

- **`:just-checked` semantics** stay persistent (see README). A transient state would need animation tracking with many timing races.
- **Per-element custom property writes** stay the model for element-dependent values. Writing the target property inline would override the author's cascade.
- **No object pooling or typed arrays.** After fixes 1 and 5, the JS heap per element is 0.3–0.5 KB and GC is no longer a significant cost.
- **No Web Workers or WASM.** The remaining cost is the browser's style recalc, which no worker can do.

## Remaining bottlenecks

1. **Style recalc for custom property writes.** It is the largest cost when many element-dependent values change. It belongs to the browser, and plain JS that writes the same custom properties pays it too.
2. **`mouse(x, local)` at 10k elements** needs one `getBoundingClientRect` per element per frame. It does not hold 60 fps at 10k in either implementation (Reactive CSS or plain JS).
3. **Sibling-sensitive selectors** (`+`, `~`, `:nth-*`) still use the parent-subtree fallback on DOM mutations.

## Phase 5 (state engine): measurements and fixes

| # | Finding | Evidence | Fix |
|---|---|---|---|
| 11 | **Event dispatch forced style recalculation.** Every `on:` event read the computed `--rcss-on` to let the cascade choose the handler. If styles were dirty (for example right after a frame wrote values), that read recalculated style synchronously inside the click. | `fanout`, 10,000 subscribers: 89.8 ms per click. | The cascade read now happens only when it can change the answer: more than one `on:` rule matches the element, or the rule is conditional (`@media`/`@supports`/`@container`, stripped pseudo-classes such as `:hover`, an `on:` nested in an at-rule). Otherwise the single rule's handler runs directly. Now 0.15 ms per click; tests cover both paths. |
| 12 | **Settling in the middle of a stylesheet.** Adding a watcher flushed pending mutation records and ran the end-of-batch settle before the state owners of the same sheet existed: wrong "missing state" warnings. | Browser test output. | Only a real `MutationObserver` callback ends a batch. Watchers start before selector setups. Missing-state warnings wait 1 s (an owner may be in a sheet still loading). |
| 13 | **User input behind background work.** With the frame budget, a click could wait behind thousands of queued `live()` values. | Design review. | An urgent lane for work started inside event handlers, processed first and never deferred. Test: visible within 2 frames behind 6,000 values updating every 50 ms. |

Memory: a toggle component (one state, one `on:` candidate, one `when()` binding, one `:when()` marker) retains about 0.9 KB at 10,000 components. Remaining cost: large fan-outs are bound by style recalculation (see README).

## 0.3: measurements and fixes

| # | Finding | Evidence | Fix |
|---|---|---|---|
| 14 | **State leaked between nested owners in CSS.** Two nested elements matched by the same `state()` rule share one generated property. The outer owner's written value was inherited by the inner owner's `var(--x, initial)`. The JS cells were separate, so the bug was only visible in CSS. | Browser test (`closest()` scope): the inner owner showed the outer value. | Generated state properties are registered with `inherits: false`. |
| 15 | **`:changed()` called `getAnimations({ subtree: true })` once per change** to find the animations it started. | CPU profile, 10,000 counters: `getAnimations` 2,788 ms of 3,000 ms; p95 frame 133 ms. | First tried lifecycle events (`animationstart`…). Rejected: with real input, headless Chromium runs the next frame about 1 ms after the marker, before `animationstart`, so the marker was cleared and the animation cut off (found in the playground, not by the synthetic test). Final: **one** `document.getAnimations()` per frame for all new markers (it flushes style, so pending animations are visible), then their `finished` promises. Script 985 → 417 ms/s at 10k (49 ms/s at 1k), p95 16.7 ms. Possible next step: skip the scan for markers whose start event has already arrived. |
| 16 | **Native `if()` beats per-element bindings for boolean `when()`.** | One state with 1,000 subscribers: script 26.7 → 3.8 ms/s (plain JS 2.4). 10,000 components: start 26 → 21 ms, heap 10.1 → 7.9 MB. | `when()` compiles to `if()` with separate truth and falsity queries (three-valued) when the condition is boolean-only and the branches are static. Equivalence is tested against the runtime path. |
| 17 | **Safari does not focus a clicked `<button>`**, so `key()` scoped to focus never fired for mouse users there. | WebKit run of the playground. | When nothing is focused, the element last pressed with the pointer is the interaction scope. |
| 18 | **A select without a `selected` attribute looked "edited"** (the browser shows the first option), so `bind:` let the control win over the state. | Browser test. | Default selectedness is computed like the browser does. |

Remaining costs: a large `outside()` population is linear per outside event (about 0.35 µs per component), and large fan-outs are bound by the browser's style recalculation (native `if()` and plain JS cost the same there).

## 0.3.1: hardening

| # | Finding | Evidence | Fix |
|---|---|---|---|
| 19 | **Strict CSP made pages lose whole stylesheets.** The generated `<style>` copy was blocked, while the original was already disabled. | Chromium and WebKit with `style-src 'self'`: a plain `.plain { color }` rule from the same sheet stopped applying, with no diagnostic. | In-place CSSOM rewrite (`deleteRule`/`insertRule`). CSP tests in five modes. Startup is unchanged within variance (table in README). |
| 20 | **`:changed()` cost is `getAnimations()`, and in Chromium it grows with running animations × page size.** | `document.getAnimations()`: 0.1 ms with 3 running animations in a 10k-element page; 29.8 ms with 300; 1.1 ms with 300 in a 1k page. Element-level calls cost the same in Chromium (26 ms), but are cheap in WebKit (0.05 ms). | Kept one call per frame, now after rendering. Start events cannot replace it: delayed animations start late, and in Chromium even undelayed ones can start after the next frame. Documented. 10k stress: 437 ms/s (0.3.0: 417, within variance); 1k: 41.5 (0.3.0: 49.3). |
| 21 | **The lifecycle test was vacuous at first.** The heap filter looked for `HTML…Element` names, but V8 names detached nodes like `<div class="x">`. | A deliberate leak passed the first version of the test. | Filter fixed. The deliberate leak is now caught (1,800 retained) and the real run retains 0. |

## 0.4.0: new functions

| # | Finding | Evidence | Decision |
|---|---|---|---|
| 22 | `element()` name conflicts with CSS Images 4 `element(#id)`. | Spec review; neither tested engine implements it, Firefox has `-moz-element()`. | Context-aware `matches()` claim: only `element(width\|height)`. |
| 23 | `element()` costs about 1.4× the script of a hand-written `ResizeObserver`, but about 40 % less layout (writes in the next frame instead of inside the callback). | `geometry`, n = 1,000: script 43.4 vs 31.2 ms/s, layout 48.9 vs 78.9 ms/s, p95 equal. | Accepted. |
| 24 | `wave()` runs no JavaScript per frame, but a registered custom property animation costs about 2× the style recalc of a `translate` keyframe animation. | `wave`, n = 1,000: style 181 vs 83 ms/s, script 0.4 ms/s, p95 equal at every size. | Accepted for composability, documented. Possible later: one shared animation on a common ancestor (like shared sources) to cut start-up cost (5.7 µs per element). |
| 25 | `progress()`, `hypot()`, `anchor-size()`, `linear()` and typed `calc(length / length)` are native in both engines. | Probes. | `map()`, `distance()`, cross-element geometry and `spring()` not built. |

## 0.4.0 runtime audit

Full report: [AUDIT-0.4.md](AUDIT-0.4.md) ([memory](MEMORY-0.4.md), [performance](PERFORMANCE-0.4.md)).

| # | Finding | Evidence | Decision |
|---|---|---|---|
| 26 | `:nth-var()` gave a deleted group a new state subscription when an owner was removed and reinserted. | Heap snapshot: one `StateRef` per reinsertion, retained by the live cell. | Fixed (skip unregistered groups). |
| 27 | A disabled `<link>` collected 2 listeners per `href` change; `error` listeners outlived the load. | `DOMDebugger.getEventListeners`: 12 after 6 changes. | Fixed (one pending wait per link). |
| 28 | `WeakMap`s that are never deleted from keep their peak V8 table size. | Heap diff: +384 KB of table backing after 500 cycles. | Fixed (explicit deletes; `element()` uses one `Map` record). |
| 29 | Identical `wave()`s in several rules ran one animation per rule. | `wave2`, n = 1,000: style 177 vs 131 ms/s. | Fixed (shared per signature): 135 ms/s. |
| 30 | Benchmarks measured the development build; with tracing on, CDP script time missed most timer-driven script in some runs (this was the `live()` script variance noted in 0.4). | `live200`, n = 1,000: 4.4 (4.4–20.5) traced vs 21.4 (21.2–22.1) untraced. | Fixed: production bundle, seeded, warm-up, 3 runs, separate untraced window for script. |
| 31 | One shared inherited animation on a dense group's ancestor would cut `wave()` style time by 38–71 %. | Platform experiment, `wave-sharing.mjs`. | Deferred: changes phase and visibility semantics. |
