# Reactive CSS 0.7.0: native event control

Local build, not published. Decision record: [rfc-prevent-action-0.7.md](rfc-prevent-action-0.7.md).

> **Baseline.** The brief names a 0.6.1 release (`docs/release-0.6.1.md`), which does not exist; the latest release is 0.6.0. The baseline is therefore the 0.6.0 runtime. Its comparison bundle (`dist/rcss-060.min.js`, not part of the distribution) was rebuilt from a copy of the 0.7.0 source with every 0.7.0 change reversed. That build:
> - is within 58 bytes of the 0.6.0 build measured in its release report;
> - rejects `prevent()`.

## Summary

- **`prevent()` (experimental):** one new action in the existing `on:` grammar. It cancels a native default synchronously, in `click(…)` and `key(…)` only.
- **Demos:** handled keys no longer scroll the page in the tabs and keyboard-playground demos; unhandled keys still do. This is tested with real keys on scrollable pages.
- **Listeners:** the document listener is non-passive only for event types that a live rule cancels.
- **Not shipped:** `stop()` (misleading with a delegated listener) and a `submit` trigger.
- **Tests:** all earlier tests pass.
- **Verification gaps:** Firefox is unverified. WebKit's arrow keys don't scroll in headless Playwright, so arrow-key cancellation in WebKit is verified through `defaultPrevented` only.

## 1. Final syntax

```css
selector { on: key(Key, prevent(), …actions); }
selector { on: click(prevent(), …actions); }
```

- No arguments.
- Its position in the action list does not change the result, since the default action runs after dispatch. Placing it first is the documented convention.
- No new trigger, property or modifier syntax.

## 2. Event types supported

| Trigger | `prevent()` |
|---|---|
| `key(…)` (`keydown`) | yes: scrolling, caret movement, typing, shortcuts for that key |
| `click` | yes: link navigation, checkbox/radio toggling, submit-button submission, `<summary>` toggling |
| `change`, `input`, `focus`, `blur`, `focusin`, `focusout`, `pointerenter`, `pointerleave`, `animation*`, `transition*` | compile error: not cancelable |
| `reset` | compile error: `bind:` restores states after a reset, so a cancelled reset would desynchronize them |
| `outside(…)` | compile error: would cancel clicks on unrelated elements |
| `submit` | not a trigger (assessed and deferred: RFC section 8) |

## 3. Native cancellation semantics

When `prevent()` runs, in order:

1. **Target inside the element.** The event's target must be the element carrying the `on:` declaration or a descendant. A `key()` fallback with nothing focused (target `<body>`) cancels nothing.
2. **Keys in form controls.** For `keydown`, a target that is an `input`, `textarea`, `select` or contenteditable element, and does not carry the rule itself, is not cancelled. The other actions still run.
3. **Cancelable only.** If `event.cancelable` is false, a deduplicated warning is issued and nothing is claimed.
4. **`event.preventDefault()`**, synchronously during dispatch, then `event.defaultPrevented` is read back. If it is still false, a warning is issued.
5. **No `stopPropagation()`.** Nothing is retained after the event.

Trusted and synthetic events behave the same. A cancelable synthetic event (`el.click()`) is cancelled; a non-cancelable `new KeyboardEvent()` is reported.

## 4. Passive listener strategy

- **One listener per event type** on `document`, capture phase, as before. A count of live handler sets that use `prevent()` is kept per type.
- **The switch.** When the count goes 0 → 1 or 1 → 0, the listener is removed and re-added with `passive: false` or `passive: true`. The same function and capture flag mean it is never installed twice: tested by counting dispatches across a passive → non-passive → passive cycle.
- **Timing.** Switching happens only when rules register or release (sheet compile, recompile, removal), never while an event is dispatched. A late sheet switches the listener when it is compiled.
- **Default unchanged.** Pages without `prevent()` keep only passive listeners. No per-element listeners were added.

## 5. Conditional rules

- `prevent()` runs only inside the `on:` declaration the cascade chose. `sync()` makes conditions current before every dispatch.
- Tested: `.r { on: key(PageDown, toggle(--cap)) }` + `.r:when(--cap) { on: key(PageDown, prevent(), toggle(--cap)) }`. Three cancelable events dispatched in **one task** give `defaultPrevented` = false, true, false; real key presses then scroll only when the condition is false.
- No stale conditions.

## 6. Nested events

- Every matching `on:` on the event path runs, innermost first, for the bubbling triggers (`click`, `keydown`). Any of them may cancel; none stops the others. Tested: inner and outer handlers both increment their state, and the page does not scroll.
- Page listeners on the bubble path still receive the event and see `defaultPrevented: true` (tested).
- **A container rule also cancels clicks on links and buttons inside it.** The rule says so, so it is allowed, and development builds note the inner element (tested).

## 7. Demo improvements

| Example | Change | Tested |
|---|---|---|
| Accessible tabs | `prevent()` on ArrowLeft/Right, Home, End | On a scrollable page (360 × 260 viewport): Home/End/arrows select and focus without scrolling; PageDown still scrolls |
| Keyboard playground | `prevent()` on the pad's arrow keys | On a scrollable page: the dot moves and `defaultPrevented` is true; Space (unhandled) still scrolls |
| Others | none | Reviewed: no example cancels link navigation or form submission. Form validation submits nowhere by design (`method="dialog"`); the notification center, settings, cart and others have no native default to fight |

## 8. Browser-specific results

| Browser | Result |
|---|---|
| Chromium 156 | all tests pass, also at 4× CPU. Arrow keys scroll natively, and `prevent()` stops it (tested) |
| WebKit 27.2 (Playwright, headless) | all tests pass. **Arrow keys do not scroll the page at all in this build**, with or without the library (probed on `<body>` and on a focused element; PageDown, Space and End do scroll). Arrow-key cancellation is therefore verified through `defaultPrevented`, and scroll cancellation with PageDown/Home/End. The tests note this; it is not presented as a scroll result |
| Firefox | **unverified**: Playwright's Firefox does not start on this machine ("Could not find profile folder") |

## 9. Security considerations

- `prevent()` lives in `on:`, which untrusted stylesheets cannot use (tested: a link in an untrusted sheet's rule still navigates).
- It affects only the current event's default, never propagation. Page scripts still get every event.
- Navigation and form safety:
  - it cannot be used in `outside()`, so no page-wide click blocking;
  - it never cancels events outside the element, nor keys in form controls the rule does not own;
  - submission is cancelled only by an explicit click rule on the submit control or its container, and the container case is reported in development builds.
- No script execution, no selector strings, no new DOM access. Strict CSP unchanged.

## 10. Performance before / after

Method: both bundles built from the same tree (see the baseline note), interleaved, 2 runs × 3 page loads × 5 samples each, Chromium 156, production bundles.

**Event dispatch** (`benchmarks/audit/event-perf.mjs`): µs per dispatched event, 200 cancelable events per task on focused elements, through the library's real document listener. Median per run, both runs shown.

| Scenario | n | 0.6.0 | 0.7.0 | `defaultPrevented` (of 200) |
|---|---:|---:|---:|---:|
| `key()`, no `prevent()` | 1,000 | 5 / 4.5 | 4.5 / 5.5 | 0 |
| | 10,000 | 5 / 4.5 | 5.5 / 5.5 | 0 |
| `click`, no `prevent()` | 1,000 | 4 / 5 | 4.5 / 4.5 | 0 |
| | 10,000 | 4.5 / 4.5 | 4 / 4.5 | 0 |
| `key()`, `prevent()` | 1,000 / 10,000 | — (not supported) | 5 / 5 · 7 / 5 | 200 |
| conditional `prevent()`, condition false | 1,000 / 10,000 | — | 9.5 / 10.5 · 11 / 10.5 | 0 |
| conditional `prevent()`, condition true | 1,000 / 10,000 | — | 9.5 / 10.5 · 10.5 / 10.5 | 200 |
| 3 nested handlers, no `prevent()` | 1,000 | 7 / 7 | 6 / 6 | 0 |
| | 10,000 | 6.5 / 6 | 5.5 / 6 | 0 |
| 3 nested handlers, all `prevent()` | 1,000 / 10,000 | — | 7 / 8.5 · 9 / 7.5 | 200 |

- **No overhead for handlers without `prevent()`:** all differences are within the per-sample ranges (about ±4 µs).
- **`prevent()` itself** costs nothing measurable over the same handler without it.
- **Conditional rules** cost about 5 µs more per event because the element has two candidate `on:` rules, so the cascade is read (`getComputedStyle`) to pick one. This is the existing conditional-rule cost, not new in 0.7.0.

**Listener setup and teardown** (a sheet with 200 `on:` rules using `key()` and `click`, inserted until its listeners are live, then removed):

| | 0.6.0 | 0.7.0 |
|---|---:|---:|
| without `prevent()` | insert 4.8 / 4.6 ms, remove 0.2 / 0.2 ms | 5.1 / 4.8, 0.2 / 0.2 |
| with `prevent()` (listener switches to non-passive and back) | — | 5.4 / 5.4, 0.5 / 0.4 |

(Timings poll with `setTimeout`, so values are ±4 ms granular at insertion.)

**Existing paths:** `attr-perf.mjs`, `control` (plain `on: click`) and `disabled`, interleaved. Computed-style reads and forced recalculations are identical (0 / 0 and 2 / 2 per click). Times overlap, for example k = 20 at 10,000: `control` 17 / 17 µs (0.6.0) vs 17.5 / 16.5 µs (0.7.0); `disabled` 17 / 18.5 vs 17.5 / 18. All attributes correct.

**Input to correct frame** (`runtime.mjs latency`, derived `disabled`, 100 widgets, 40 real clicks), 0.7.0: idle p50 / p95 14.0 / 15.7 ms (plain JS 13.6 / 16.0); under load 12.2 / 20.9 ms (plain JS 12.7 / 23.0). This is the same as 0.6.0 (14.1 / 15.8 idle).

**Memory and idle:**
- `memory.mjs mount`, 1,000 × 150, now including `prevent()` rules: clean (0 detached elements, 0 bindings left, listeners stable).
  - Heap growth +5.6 KB and −9.2 KB per cycle in two runs (end 3.55 / 3.51 MB), within the range of earlier builds.
  - A first run reported +121 KB/cycle (end 4.56 MB), with no detached elements or leftover library objects; the two repeats did not reproduce it. Checkpoint heaps swing widely within a run with GC timing: in one repeat, 26 MB at cycle 10, 47 MB at cycle 20 and 9.8 MB at cycle 50, before ending at 3.5 MB. The growth figure is fitted to these checkpoints, so one run is not conclusive. It is reported, not explained away.
- Idle: `prevent()` adds no timers or loops. A listener is only re-added when rules change.

**Bundle sizes** (bytes):

| Bundle | 0.6.0 min / gzip / brotli | 0.7.0 min / gzip / brotli | Δ gzip |
|---|---|---|---:|
| `reactive-css.min.js` | 110,831 / 37,203 / 32,739 | 113,971 / 38,284 / 33,598 | +1,081 |
| `reactive-css.compact.min.js` | 95,847 / 32,211 / 28,641 | 97,785 / 32,831 / 29,130 | +620 |

Most of the growth is diagnostic text and the registry entry (the compact bundle drops the description).

## 11. Test counts and skips

| Suite | Result |
|---|---|
| Typecheck | clean |
| Unit (`npm test`) | **78 passed** (3 new: `prevent()` compilation, rejected contexts, registry) |
| Distribution (`npm run test:dist`) | passed: ESM import, types (2), both bundles in Chromium and WebKit (4); `features.json` lists `prevent` as an experimental action since 0.7.0 |
| Browser, Chromium + WebKit | **479 passed, 5 skipped** (the Chromium-only heap tests in WebKit, as before) |
| Browser, Chromium at 4× CPU | **242 passed** |
| Strict CSP | included: every example test runs under `style-src 'self'` |
| Lifecycle and memory | included: the heap mount/unmount test uses `prevent()` rules (0 detached) |
| Firefox | **not run**: Playwright's Firefox fails to launch ("Could not find profile folder") |

New: `v070.spec.ts`, 10 tests per engine. They cover:
- scrolling with handled, unhandled and handled-without-`prevent()` keys;
- the passive/non-passive switch with late insertion and removal, with no duplicate dispatch;
- conditional cancellation within one task;
- form controls and contenteditable, a control carrying its own rule;
- nested handlers and page listeners;
- the focus fallback;
- non-cancelable events;
- links and checkboxes, a container note;
- compile errors and untrusted sheets.

Two demo tests run on scrollable pages (tabs, keyboard playground).

## 12. Remaining limitations

- **Firefox unverified.** WebKit arrow-key scrolling cannot be observed in headless Playwright.
- **No `stop()` and no Reactive-CSS-only `handled()`**: nested regions all react (research note in the RFC).
- **No `submit` trigger, and no `prevent()` in `reset`.**
- **Cancelling container rules also cancel inner links and buttons.** They are reported in development builds, not blocked.
- **Key lists stay per tab set** (no parameterized rules).
- **`key()` covers `keydown` only.** There is no `keyup`/`beforeinput` cancellation.

## 13. Recommendations

1. **Firefox run** where Playwright's Firefox starts, and a manual Safari check of arrow-key scrolling (outside headless) for the tabs and playground. Promote `prevent()` from experimental only after both.
2. **Screen-reader verification** of the 0.6 focus work (still the first beta blocker).
3. **`submit`**, only with the acceptance tests listed in the RFC (implicit submission, `requestSubmit()`, `formnovalidate`, form owners) and an explicit navigation story.
4. **`handled()`**, only if a real example needs ancestors not to react.
