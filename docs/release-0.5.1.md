# Reactive CSS 0.5.1: correctness, DOM text binding, accessible-HTML path

Date: 2026-10-19. Local only: no Git, no publishing or tagging, the Astro site and Storybook untouched. Engines: Playwright Chromium 156.0.8078.4 and WebKit 27.2 (headless). Firefox: **unverified** (Playwright's Firefox still does not start: "Could not find profile folder").

## 1. Root cause of the `:when()` frame lag

An `on:` declaration in a conditional rule (`.c:when(--n >= 10) .plus { on: … }`) is picked by the browser's cascade: at event time, the dispatcher reads the computed `--rcss-on` of the element. `:when()` and `:nth-var()` take part in that cascade as **marker attributes** (`[data-rcss-when-N]`, `[data-rcss-nth-N]`):
- `:when()` markers are written by `WhenMatch` jobs in the scheduler's next frame flush (urgent lane, but still `requestAnimationFrame`);
- `:nth-var()` markers are written in a frame task.

The state itself changed synchronously; only the markers lagged. So a second event before the next frame resolved the cascade against last frame's markers. Observed:
- 12 synchronous clicks took a 1–10 quantity to 13;
- a double click scored a quiz answer twice;
- **real rapid input sent before a frame (Chromium raw input) did the same.**

## 2. Correctness changes

- **`scheduler.sync()`.** Called at the start of every delegated event dispatch (actions only). If an earlier action left urgent work, it applies that work now: state cells, `:when()` markers, `:changed()` bookkeeping, and pending `:nth-var()` groups (through an `onSync` hook). Then the cascade sees the current logical state.
  - Background work, the frame budget and rendering stay in the frame.
  - With nothing pending it is two checks.
  - The new `stats().syncs` counter shows how often it applied work.
- **Mutation consistency: already correct, now tested.** Actions read and write cells synchronously, in order: 50 synchronous increments give 50; `set` then `increment` gives 101; toggles and cycles step correctly.
- **Not changed:** the shared scheduler, the frame budget, visual timing (CSS values are still written in the frame), and cleanup.
- **Bounded updates.** `set(--count, min(10, --count + 1))` is not supported (`set()` takes literals, `attr()`, `pick()`, `sibling-*`). The examples use conditional clamp rules, which are now correct under bursts. A bounded `increment()` (or arithmetic in `set()`) is recorded as a **future API decision**, not added.

## 3. Same-task and rapid interaction tests

`tests/browser/v051.spec.ts` and `examples.spec.ts`, Chromium + WebKit:

| # | Test | Result |
|---|---|---|
| 1 | 12 clicks in one task on a bounded + and −: stop at 3 and 0 | pass |
| 2 | Rapid real clicks through the DevTools protocol before the next frame (Chromium): first answer scores once | pass |
| 3–4 | Several actions on one state; different buttons on the same state, interleaved, with clamps | pass |
| 5 | Nested owners keep separate bounds | pass |
| 6–7 | Three conditional `on:` rules with overlapping `:when()` conditions: the current winner applies after each click | pass |
| 8 | A component removed with pending work in the same task; others keep working; cleanup to zero | pass |
| — | `:nth-var()` gate: a second Next in one task meets the next step's validation | pass |
| 9 | Whole Chromium suite with the CPU throttled 4× | 159 / 159 |
| — | Examples: configurator (12 clicks → 10), quiz (double answer → 1), wizard (9×Next + Finish, 9×Back + Finish: never outside 1–4 or 5) | pass |

Without `sync()`, 6 of these tests fail, including the raw-input test.

## 4. `text:` semantics (experimental)

```css
.profile .name   { text: var(--name); }
.score .prev     { text: previous(--score); }
.status          { text: when(--online, "Online", "Offline"); }
```

- **Compilation.** `text: <value>` compiles to `--rcss-text: <value>` in the same rule, with the same importance. `--rcss-text` is registered `inherits: false` (one registration), so the browser's cascade picks the winning `text:` declaration per element. Reactive functions in the value are ordinary bindings.
- **Values.** One string, number or keyword. Allowed functions: `var()`, `previous()`, `direction()`, `when()` (and a native `if()`); others are compile errors.
  - A computed value that is not one scalar (two strings, an unresolved `calc()`) is reported and not shown.
  - Numbers from math: register the property (`@property … "<integer>"`) so the browser computes it.
  - No template language.
- **Writing.** The value is written into the element's text node with `Text.data` (`textContent` semantics): selectable, copyable, in the accessibility tree.
- **Ownership:**
  - Only for elements that are empty or hold exactly one text node: the node is reused (or one created).
  - Elements with child elements are **never** touched (diagnostic).
  - **No applicable declaration** (rule unmatched, condition false, sheet removed): the **original text is restored**, so the HTML text is the fallback before the script runs and after.
  - **Someone else changed** the text or children: the binding **yields** (diagnostic) and never writes or restores again.
- **When it updates.** It is read in a new **late phase** of the frame flush (after that frame's writes, so `previous()`/`when()` bindings and `:when()` markers are current), when:
  - a state changes in an owner of the element (ancestor or self);
  - the element starts or stops matching a `text:` rule;
  - `ReactiveCSS.refresh()` runs.
  
  A cascade change from anything else (a class that swaps which rule wins without changing membership, a media query) shows on the next of these.
- **Native `content` is untouched** (tested: `::after { content: var(--name) }` in the same sheet).

## 5. Security model for text binding

- **Never HTML.** `Text.data` only: no `innerHTML`, no parsing. `<img src=x onerror=alert(1)>` stays literal text; tested: no element created, no dialog.
- **Trusted stylesheets only**, like `on:` and `bind:`. In an untrusted sheet (cross-origin, or inline with `trustInlineStyles: false`) the declaration is a compile error, and the original text stays.
- **No new reach.** It writes only the bound element's own text node, and only when that is the element's whole content. It never removes or replaces child elements (tested with an SVG + span button).
- **CSP.** No style injection; works from a linked sheet under `default-src 'none'; style-src 'self'` (tested).
- **Values tested:** Unicode, quotes, backslashes, newlines, 20,000-character strings, markup, empty strings (an empty text node, distinct from "no value").

## 6. Cascade and lifecycle behavior (tested)

- **Cascade:** specificity in both source orders, `:when()`-gated rules falling back to the original text, a non-matching `@media` rule.
- **Lifecycle:**
  - rule unmatch restores the original;
  - re-matching binds again;
  - removal and reinsertion of the owner;
  - 5 recompiles keep one text node;
  - removing the sheet restores the original;
  - `stats().bindings` returns to 0.
- **Nested owners:** each text reads its nearest owner.
- **External change:** "framework" text is left alone after a later state change (yield).
- **Many bindings:** above 64 bindings, a state change dirties only bindings in the owner's subtree (was all bindings: 141 µs per change at 10,000). A test covers per-component and page-level owners.
- **Memory:** a full-feature component with `text:` (conditional and value rules), 1,000 components × 300 mount/unmount cycles: heap 2.28–2.36 MB from cycle 5 on (one transient 2.88 MB checkpoint), 0 detached elements, no library class above baseline. The heap-snapshot lifecycle test now includes `text:`.

## 7. Event support changes

Added as experimental triggers (no syntax change):

| Trigger | Runs on | Notes |
|---|---|---|
| `focusin`, `focusout` | target and ancestors | tested: a wrapper sees focus enter and leave |
| `reset` | target and ancestors | after the native reset |
| `animationend`, `animationcancel` | **target only** | a child's animation does not trigger the parent (tested). No name filter. Cancel fires only for animations that had started (native). |
| `transitionend`, `transitioncancel` | **target only** | one `transitionend` per property (tested: two properties → two runs) |

- **Still rejected:** `submit` (useful only with `prevent()`, see the RFC), `animationstart`, `animationiteration`, `transitionrun`, `transitionstart`, `dblclick`, `keyup`.
- **Cost:** one more delegated listener per used type.

## 8–10. Proposals (not implemented)

- **Attribute binding:** [rfc-attribute-binding.md](rfc-attribute-binding.md).
  - Recommends one property per attribute (`attr-disabled: …`, `attr-aria-current: …`) with an allowlist.
  - Booleans are removed when false (never `disabled="false"`); ARIA gets explicit `"true"`/`"false"`, and `none` removes.
  - Same ownership and yield policy as `text:`, a feedback guard against observer loops, trusted sheets only.
- **Focus management:** [rfc-focus-management.md](rfc-focus-management.md).
  - `focus(selector, closest(scope))` as an action, which the current action grammar supports unambiguously.
  - It runs in the late phase of the next frame, when the target is visible.
  - User-initiated events only; native `<dialog>` and `popover` first.
  - Needs screen-reader testing before shipping.
- **Event control:** [rfc-event-control.md](rfc-event-control.md).
  - `prevent()` as an action, with non-passive listeners only where used, compile errors for non-cancelable events, and `submit` alongside.
  - No `stop()`: a native stop is impossible from the delegated listener.
  - A Reactive CSS-only scope could be offered as `local()`, but only if an example needs it.

## 11. Bundle size

| File | 0.5.0 | 0.5.1 | gzip | brotli |
|---|---:|---:|---:|---:|
| `dist/reactive-css.min.js` (default) | 86,275 B | **92,037 B** (+5,762) | 31,423 B (+1,622) | 27,951 B |
| `dist/reactive-css.compact.min.js` (new, optional) | — | **80,092 B** | 27,463 B | 24,682 B |
| `dist/features.json` (not loaded by pages) | 27,060 B | 30,944 B | 6,345 B | 5,333 B |

- **Default bundle growth:** `text:`, `sync()`, the late phase, the seven triggers, and their registry entries.
- **Compact bundle:** the same runtime; its registry is generated at build time from the same `FEATURES` source and keeps name, kind, status, since and syntax. `describe()` in the default bundle is unchanged. Both bundles pass the same distribution test.

## 12. Performance

Production bundle, corrected harness, median of 3 runs. Click times are averages of about 3,600 clicks per run. Per-click p95 cannot be measured on this page: `performance.now()` is coarsened to 100 µs.

| Scenario | n | Reactive CSS | plain JS |
|---|---:|---|---|
| `text:` counter (state + `increment()` + `text: var(--n)`), 20 clicks/frame | 1,000 | start 10.8 ms · click 5.3–6.8 µs · script 12.8 ms/s · p95 16.7 ms | click 3.1–4.0 µs (textContent in the listener) · 7.0 ms/s · 16.7 ms |
| | 10,000 | start 39.6 ms · click 6.4–6.6 µs · script 20.3 ms/s · p95 16.8 ms | click 3.2–3.4 µs · 13.4 ms/s · 16.7 ms |
| Before the owner-subtree fix | 10,000 | click 139–142 µs · script 182 ms/s | |
| Toggle components (existing) | 10,000 | click 5.4–5.6 µs (0.5.0: 3.9–4.9) · script 15.9 ms/s (0.5.0: 16.8) · p95 16.8 | 2.0–2.3 µs |

- **Why clicks got slower but total script did not.** The extra ~1 µs per click on existing scenarios is `sync()`: the 2nd–20th click in a frame now applies the previous click's state work inside the click, instead of in the frame. Total script time per second is unchanged within noise, so the work moved rather than grew.
- **Input latency** (real CDP input → first correct frame, 40 inputs, 100 widgets): Reactive CSS equals plain JS within the spread, idle and under background load, 0 incorrect.
  - toggle p50 14.1 vs 14.2 ms;
  - `text:` counter 14.3 vs 14.2 ms (busy: 13.9 vs 12.0, p95 27.9 vs 23.2).
- **Idle CPU** (10 s, 1,000 elements): state, forms and `text:` pages: 0 library flushes, ticks, jobs and script.
- **Startup:** components 1k / 10k: +38.8 / +90.2 ms (0.5.0: 38.7 / 89.2); no change.

## 13. Regression test results

| Check | Result |
|---|---|
| TypeScript strict (`tsc --noEmit`) | pass |
| Unit (vitest) | 62 / 62 |
| Distribution (Node ESM import, TypeScript consumer, `features.json`, **both** bundles on a plain page in Chromium and WebKit) | pass |
| Browser, Chromium + WebKit (`npm run verify`) | **313 passed**, 5 skipped (4 Chromium-only heap/listener tests and the raw-input test on WebKit) |
| Of these: CSP, security, cascade, lifecycle and memory regressions, examples (strict CSP), events, 0.5.1 | pass |
| Whole Chromium suite with the CPU throttled 4× | 159 / 159 |
| Heap: 1,000 full-feature components × 300 cycles | clean |
| Firefox | **unverified** |

Problems found and fixed during this release:
- **`text:` invalidation scaled with the total number of bindings.** Fixed; a test covers both lookup paths.
- **WebKit's form reset replaces the children of an `<output>` element.** The configurator's bound span was destroyed and the total froze. The example now uses a `<span aria-live>`; documented in the README and here.
- **Cancel events fire only for started animations.** The tests now wait for `animationstart` (native behavior, not a library bug).

## 14. Remaining accessibility limitations

1. **No attribute binding.** Buttons at bounds and answered options cannot become `disabled`/`aria-disabled`/`aria-pressed`; the step indicator cannot get `aria-current` (RFC only).
2. **No focus management.** The wizard drops focus to `<body>` at step 4; new steps and questions are not announced (RFC only).
3. **`text:` produces real DOM text, but live-region announcements are unverified.** Nothing was tested with VoiceOver, NVDA or JAWS. Do not claim screen-reader support.
4. **No number formatting**, which limits real prices (the configurator relies on whole-dollar prices).
5. **Remaining generated text:** the quiz's "✓ (correct answer)" and the wizard's "✓ completed:" markers are still generated `content` (with alternative text).

**Accessibility is not production-grade yet.**

## 15. Remaining public beta blockers

1. Firefox unverified.
2. No real-browser (Chrome/Safari releases, GPU) or screen-reader testing.
3. Decisions on the three RFCs: attribute binding and focus management are the two that block accessible production use.
4. Promotion decisions: `attr()`/`split()`/expression `pick()`, `text:`, the new triggers, `typed()`; and whether the compact bundle should become the default.
5. Number formatting (with `text:`) and a bounded `increment()`: open API questions.
6. npm package name.
