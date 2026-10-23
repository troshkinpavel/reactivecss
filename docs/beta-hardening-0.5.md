# Reactive CSS 0.5.0: beta hardening and real-world examples

Date: 2026-10-19. Local only: no Git, no publishing, the Astro site untouched. Engines: Playwright Chromium 156.0.8078.4 and WebKit 27.2 (headless). Firefox: **unverified** (Playwright's Firefox still does not start: "Could not find profile folder").

## 1. State cascade correctness: fixed

**Before.** With several `state()` declarations for one name on one owner, a literal winner was found by parsing the owner's computed value, and an evaluated initializer (`attr()`, `pick()`) came from whichever declaration attached first. Booleans only worked because of a 0.5 patch.

**Now.** Each `state()` declaration also emits `--rcss-sN-w: <declaration id>` **in the same rule, with the same `!important`**. The marker therefore takes part in exactly the same cascade as the state declaration: specificity, stylesheet order, layers, media and supports conditions, importance. The rules:
- When a declaration attaches to a state that has **not changed yet** (`version == 0`), the state reads the computed marker on the owner. If the attaching declaration is the winner, its initializer runs once.
- Declarations attach in any order and stylesheets may load later; the winner initializes when it arrives.
- A state that has changed is **never** re-initialized: not by a new stylesheet, not by attribute changes.
- The marker is not registered, so recompiles add no registrations (tested), and the stable property names from 0.5 are unchanged.
- Cost: the single-declaration case reads nothing. Two declarations per owner cost about 1.4 µs per owner at start (10,000 owners: +14 ms).

**Not part of it:**
- Inline `style` declarations of the state's own property are not `state()` declarations and do not take part, as before. They override the visible value only.
- An owner whose winning rule changes later through a media query does not re-initialize (documented since 0.2).

**Tests** (`tests/browser/v05.spec.ts`, Chromium + WebKit):

| # | Case | Result |
|---|---|---|
| 1 | Specificity, both source orders, `attr()` winner | pass |
| 2 | Two stylesheets; `!important`; a non-matching `@media` rule | pass |
| 3 | Cascade layers: a later layer beats higher specificity in an earlier layer | pass |
| 4 | `state(attr())` winning over a literal | pass (in 1 and 5) |
| 5 | `state(pick())` winning over a literal | pass |
| 6 | Nested owners each use their own winner | pass |
| 7 | Remove and reinsert an owner: new lifecycle from the winner, cleanup to 0 | pass |
| 8 | Recompile its stylesheet: winner kept | pass |
| 9 | A changed state survives an unrelated stylesheet update, and a later winner does not reset it, while an unchanged state on the same page takes the late winner | pass |
| 10 | Ten recompiles: registration count constant | pass |

With the winner lookup disabled, 8 of these tests fail; the layer case passes by coincidence of source order.

Also fixed: a custom pseudo-class directly inside a functional selector (`.q:has(.opt.correct:nth-var(--a))`) was reported as unsupported. The compound scan crossed the `:has(` boundary. Found by the quiz example; unit test added.

## 2. Event support matrix

Full matrix and analysis: [event-support-0.5.md](event-support-0.5.md) (`tests/browser/events.spec.ts`: 16 passed).

| Event | `on:` | Observed |
|---|---|---|
| `click`, `change`, `input` | yes | Target and ancestors, innermost first. A checkbox click fires `click`, `input` and `change`. |
| `focus`, `blur` | yes | Target only, including keyboard focus |
| `pointerenter`, `pointerleave` | yes | Target only |
| `keydown` via `key()` | yes | Focus scope with pointer fallback |
| `click`, `pointerdown`, `focusin` via `outside()` | yes | |
| `focusin`, `focusout` | **no** | Compile error; the `on()` *value function* accepts them |
| `animationstart/iteration/end/cancel` | **no** | Compile error; the `on()` value function re-evaluates on `animationend`/`animationiteration` (tested) but cannot change state |
| `transitionrun/start/end/cancel` | **no** | Compile error; the `on()` value function accepts `transitionend` |
| `submit`, `reset` | **no** | Compile error |

Delegation: one passive capture listener on `document` per used type. Actions run before the target's own listeners, are unaffected by their `stopPropagation()`, are skipped if a `window` capture listener stops the event, never prevent the default (a link still navigates), and run for synthetic events. Recommendation: add `focusin`/`focusout`, `reset`, and the animation/transition events (target-only) to the trigger allowlist in a later iteration. That is small, with no per-element work.

## 3. `.prevent` and `.stop`: recommendation (not implemented)

- **`prevent()` as an action** (`on: submit(prevent(), set(--sent, true))`), not a `.prevent` suffix: the tokenizer splits `click.prevent(`, and actions already have a grammar.
  - It needs the listener for that type to be non-passive while such a handler set is registered. That is cheap for `click`, `submit`, `keydown` and `pointerdown`; never for `touch*` or `wheel`.
  - It must be rejected at compile time on non-cancelable events.
  - The decision is synchronous: the cascade is resolved during dispatch.
- **`stop()` only for Reactive CSS handlers** ("do not run ancestors' `on:` actions"). A faithful native `stopPropagation()` is impossible from a document capture listener: there it would stop everything, including the target's own handlers. It would need per-element bubble listeners, which is an architecture change.
- `stopImmediatePropagation()`: not recommended.

## 4. Feature registry readiness

Details: [feature-registry-review.md](feature-registry-review.md).
- **Usable today for docs:** names, kinds, status, syntax, parameters (prose), native equivalents, examples. `kind:name` is a unique id (now tested).
- **Missing for editors and tooling:**
  - `context` (where a name is valid, e.g. `attr()` only in `state()`/`set()`);
  - structured parameter types;
  - `module` (for modular bundles);
  - diagnostic codes.
- **Added:** `dist/features.json`, the `describe()` metadata written at build time, so tools need not run the library. A dist test checks it equals `describe()`.
- **Bundle cost:** the registry is **17 KB of the 86 KB** minified bundle (20 %; ~4.9 KB gzip). Recommendation: keep only runtime names and status in the production bundle, and the documentation fields in `features.json` and the ESM build. This changes `describe()` in production, so it needs a decision first.

## 5. The five examples

All under `examples/<name>/` (`index.html`, `style.css`, `README.md`). **No JavaScript of their own**: all behavior is Reactive CSS and native HTML/CSS. Served with a strict CSP in the tests (`script-src 'self'; style-src 'self'`).

| Example | Works | Key features | Main limitation found |
|---|---|---|---|
| Product configurator | yes | `state`, `bind:` (number, radio, checkbox, reset), `increment`/`decrement`/`set`, `:when` bounds, `when()`, native `calc`/`clamp`/`round`/`mod` + counters for the total | Total is generated text (Chromium exposes it as `$`,`49`,`.`,`00`); bounds are frame-lagged for same-task bursts; no `disabled` |
| Multi-step wizard | yes | `state`, `increment`/`decrement`/`set`, `:nth-var` (also inside `:has()`), `:when`, `var()` in `calc` and counters, native `:invalid` gate | No focus management (focus falls to `<body>` when Next disappears), no `aria-current` |
| Interactive quiz | yes | `state` ×6, `set(sibling-index())`, `increment`, `:when` (with `and`/`or`), `:nth-var`, `:has()` + `:nth-var` verdict | Rules repeat per question (restart needs owner-level states); same-task double clicks score twice |
| Live form preview | yes | `state`, `bind:` (text, select, radio, checkbox, reset), `:when`, `content: var()` | Generated text; defaults written twice; a WebKit-internal CSP message for `<select>` (not the library) |
| Score history | yes | `state`, `increment`/`decrement`/`set`, `previous()`, `direction()`, `:changed()` with native keyframes, reduced motion | `previous()` is the value before the last effective change (no full history); reset counts as a change |

## 6. Tests and results

| Check | Result |
|---|---|
| TypeScript | pass |
| Unit (vitest, library directories) | 62 / 62 |
| Distribution (Node ESM, TypeScript consumer, `features.json`, minified bundle page) | pass |
| Browser, Chromium + WebKit (`npm run verify`) | **266 passed**, 4 skipped (Chromium-only heap/listener tests on WebKit) |
| Of these, new: cascade winner (8 tests), events (8), examples (8 tests × 2 engines) | pass |
| Chromium with the CPU throttled 4× (whole suite) | 135 / 135 (the examples spec does not use the throttled helper) |
| CSP, security, cascade, lifecycle (audit leak regressions) | pass |
| Firefox | **unverified**: does not start |

Example tests use real mouse and keyboard input, check form values, navigation, reset, nested and parallel instance isolation, repeated and rapid interaction, reduced motion, no console errors or warnings, no diagnostics, and cleanup to 0 bindings, states and sources.

## 7. Native vs Reactive CSS vs plain JS

Details, with plain-JS sketches: [example-comparison.md](example-comparison.md).
- **Plain JavaScript is not longer.** For these examples it is about the same size, and shorter for the quiz and the form (≈ 10–25 lines each). Reactive CSS used 13–36 behavior lines.
- **Native CSS alone** handles more than expected: radio/checkbox/select-driven styling everywhere, and the quiz score through CSS counters. It cannot read typed values or remember clicks.
- **What Reactive CSS gives:** no script and no event wiring, behavior next to its styles, isolation through the cascade, and strict-CSP compatibility without nonces.
- **What it cannot give:** DOM text, attributes (`disabled`, `aria-*`) and focus. Plain JS gives each in one line.

## 8. Real API limitations

From [example-capability-gaps.md](example-capability-gaps.md), in priority order:
1. **Generated text is not DOM text** (all five examples).
2. **No attribute synchronization** (`disabled`, `aria-current`, `aria-pressed`; three examples).
3. **No focus management** (wizard, quiz).
4. **Frame lag of `:when()`-gated actions** for several events in one task. This one is a correctness gap in existing behavior and the best candidate for a 0.5.x fix.
5. **No bounded `increment()`/`decrement()`.**
6. **No reset of states owned by other elements.**
7. **Defaults written twice for `bind:`.**
8. **Integer-only numeric output.**
9. **No arithmetic in conditions.**
10. **No event cancellation.**

None of `derive()`, `sum()`, `count()`, `format()`, `drag()`, `persist()`, `wave()`, new selectors or event modifiers were added.

## 9. Performance and bundle

Production bundle, corrected harness.

**Startup** (median of 5, +task over the same page without the library):

| Case | +task |
|---|---|
| components at 1k / 10k | 38.7 / 89.2 ms (0.4 audit: 41.2 / 92.8: unchanged within noise) |
| one `state()` declaration per owner, 1k / 10k | 8.4 / 20.2 ms |
| two declarations per owner, 1k / 10k | 12.6 / 34.2 ms |

**Other checks:**
- **Memory:** 1,000 full-feature components × 100 mount/unmount cycles: clean (0 detached, nothing above baseline, listeners constant). The stylesheet lifecycle (9 operations × 100) is clean, with `registeredStateVars` at 1.
- **Idle CPU:** state, forms and history pages: 0 library flushes, ticks, jobs and script.
- **Latency** (toggle, counter, tabs; idle and busy; 40 inputs each): Reactive CSS equals plain JS within the run spread (p50 11–14 ms), 0 incorrect.

**Bundle sizes:**

| File | Minified / raw | gzip -9 | brotli |
|---|---:|---:|---:|
| `dist/reactive-css.min.js` | 86,275 B | 29,801 B | 26,554 B |
| `dist/reactive-css.js` (development) | 147,642 B | 38,618 B | 33,090 B |
| `dist/index.js` (ESM, development) | 138,718 B | 38,008 B | 32,633 B |
| `dist/features.json` (not loaded by pages) | 27,060 B | 5,826 B | 4,892 B |

The minified bundle grew by 170 B in this pass (0.5 report: 86,105 B): the marker emission, the cascade lookup and the selector fix.

## 10. Remaining beta blockers

1. **Firefox unverified:** run `npm run test:firefox` where Playwright's Firefox starts.
2. **No real browsers or screen readers:**
   - not measured in real Chrome or Safari, with GPU raster, or on a phone;
   - screen-reader announcement of generated text **unverified**.
3. **Frame lag of `:when()`-gated actions (gap 4).** Decide whether to fix it before beta; it affects bounds and "first answer counts" patterns under synthetic bursts.
4. **Decisions pending:**
   - the production-bundle registry split (17 KB);
   - promoting `attr()`/`split()`/expression `pick()`;
   - keeping `typed()`.
5. **Accessibility gaps (generated text, attributes, focus)** limit the examples to non-critical UI. Document this prominently before beta, or design `text:` and allowlisted attribute synchronization.
6. **npm package name** still to choose.
