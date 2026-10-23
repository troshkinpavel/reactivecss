# Demo validation 0.5.3

Phase 2 of 0.5.3: prove `attr:` (and `state(…, bind())`, `text:`) with real interfaces. Runtime report: [release-0.5.3.md](release-0.5.3.md).

Every example is a standalone page: its own `index.html` and `style.css`, the production bundle, **no JavaScript of its own**, and no framework. A README in each folder has 8 sections:
1. what it demonstrates;
2. features;
3. what is native;
4. what would need JavaScript;
5. limitations;
6. accessibility;
7. production use;
8. a manual test checklist.

The demo lab (`examples/lab/`, `npm run serve` → `/examples/lab/`) shows each example with:
- its HTML, CSS and README;
- a width switch (320 / 375 px);
- optional diagnostics: runtime stats, an attribute-write log, `ReactiveCSS.diagnostics`.

The lab's script (`lab.js`) is lab tooling only: the examples never load it and work without it (tested).

## 1. Status of all examples

| # | Example | Status | 0.5.3 changes / what it proves | Automated test |
|---|---|---|---|---|
| 1 | Product configurator | **Updated, passing** | − / + natively `disabled` at 1 and 10 (the 0.5.1 clamp rules are gone); 12 rapid real clicks and 12 same-task clicks stop at 10 | `examples.spec.ts` |
| 2 | Multi-step wizard | **Updated, passing** | `aria-current="step"` on the current step; Back disabled at 1, Next at 4, Finish outside 4; the validation gate stays an `on:` rule | `examples.spec.ts` (3 tests) |
| 3 | Interactive quiz | **Updated, passing** | Answered options `disabled` (no repeat scoring by construction: 3 same-task clicks and a real double click score once); chosen option `aria-pressed="true"`; Try again clears both | `examples.spec.ts` |
| 4 | Live form preview | **Updated, passing** | Card `data-name`/`data-role`/`data-notify` derived from the form; an empty name gives `data-name=""`; nothing persisted | `examples.spec.ts` |
| 5 | Score history | **Updated, passing** | Reset disabled at 0; `data-direction` (`none`/`up`/`down`) by cascade; 20 same-task clicks all counted | `examples.spec.ts` (2 tests) |
| A | Settings panel | **New, passing** | Master switch disables a whole `<fieldset>` (controls inherit `:disabled`, leave the tab order); disclosure `aria-expanded` + `hidden`; `data-theme` preview; reset | `examples.spec.ts` |
| B | Accessible tabs | **New, passing** | `aria-selected` on every tab, `hidden` on every inactive panel, static and derived `disabled` tabs, two independent sets. **Not** full ARIA Tabs (no arrow keys / roving tabindex) | `examples.spec.ts` |
| C | Shopping cart | **New, passing** | Three quantities with derived `disabled` at 0/9, Remove, Checkout and Empty cart disabled for an empty cart; subtotals and totals by `calc()` (no aggregate functions) | `examples.spec.ts` |
| D | Notification center | **New, passing** | Disclosure; `aria-pressed` read toggles; dismissed items `hidden`; one-step Undo (no arrays); unread count from boolean math | `examples.spec.ts` |
| E | Form validation | **New, passing** | `required` and `hidden` derived for business accounts; submit disabled until the terms; native `:invalid` messages; `method="dialog"`: nothing sent | `examples.spec.ts` |
| F | Keyboard playground | **New, passing** | `key()` movement, `focusin`/`focusout` focus state, nested regions (propagation to every matching ancestor), reset; no new triggers | `examples.spec.ts` |
| — | Accessible toggle (0.5.2) | Unchanged, passing; README gained a checklist | `examples.spec.ts` |
| — | Demo lab | **New, passing** | All 12 load with zero diagnostics; sources render as text; the diagnostics log shows a derived write | `examples.spec.ts` |

Every example test runs under a strict CSP (`default-src 'none'; script-src 'self'; style-src 'self'`). It uses real mouse and keyboard input and asserts on the real DOM: `textContent`, `hasAttribute`/`getAttribute`, native `.disabled`/`.hidden`/`.required`, `checkValidity()`, `document.activeElement`. It ends with `finish()`: no console errors, no diagnostics, and removing the page content releases every state and binding.

## 2. QA scenarios

The per-example checklists (README section 8) cover the requested scenarios. How each is covered:

| Scenario | Automated (Chromium + WebKit) | Manual checklist |
|---|---|---|
| Load | every example: initial attributes and text | ✓ |
| Single click | every example | ✓ |
| Double click | quiz (`dblclick`), notification center, configurator/cart (same-task) | ✓ |
| Rapid interaction | configurator and cart (12 real pointer clicks), score history (15 real, 20 same-task), wizard (9 same-task), tabs (same-task), `v053` stepper | ✓ |
| Tab | settings (disabled fieldset skipped), tabs (disabled tabs skipped, Chromium), wizard (hidden panels not focusable) | ✓ |
| Enter / Space | configurator, wizard, quiz, tabs, cart, notification center, keyboard playground | ✓ |
| Reset | configurator, settings, live preview (native form reset), quiz/wizard restart, score history, cart, keyboard playground | ✓ |
| Dynamic changes | live preview typing, form validation type switch, input type change (`v053`), late custom element definition (`v053`) | ✓ |
| Removal / reinsertion | `finish()` on every example; nested wizard move; `v053` lifecycle | ✓ |
| Narrow viewport | lab width switch (320/375 px); not asserted automatically | ✓ |
| Strict CSP | every example test | ✓ |
| Browser differences | WebKit: no button focus on click, Tab skips buttons by default (macOS setting), `<select>` CSP message, stale computed reads (fixed) | ✓ |
| CPU ×4 | the whole Chromium suite, examples included, at 4× throttling | — |

**Manual pass:** the lab was opened in the in-app browser (Chromium). The configurator, cart and tabs were checked visually: disabled styling, struck-through empty lines, selected tab and disabled tabs. A full manual pass of every checklist row in Safari and Firefox has **not** been done.

## 3. Measurements per example

`benchmarks/audit/examples.mjs`, production bundle, Chromium, 5 runs, medians.
- **ready:** navigation to the second frame after the library is ready.
- **compile:** stylesheet compile time.
- **heap:** used JS heap after GC.
- **event:** one dispatched event, including the action, the state change and the derived attribute written in the same task (verified on the DOM in every run).

| Example | ready (ms) | compile (ms) | heap (KB) | event (ms, median; range) | attribute in same task | diagnostics |
|---|---:|---:|---:|---:|---|---:|
| product-configurator | 55.9 | 2 | 1,631 | 0.7 (0.600-0.700) | yes | 0 |
| multi-step-wizard | 53.7 | 2.3 | 1,727 | 0.8 (0.800-1.000) | yes | 0 |
| interactive-quiz | 53.8 | 2.5 | 1,829 | 0.9 (0.800-0.900) | yes | 0 |
| live-form-preview | 54 | 1.8 | 1,616 | 0.5 (0.500-0.700) | yes | 0 |
| score-history | 54.1 | 2 | 1,652 | 0.8 (0.700-2.500) | yes | 0 |
| settings-panel | 53.4 | 1.9 | 1,598 | 0.8 (0.700-1.100) | yes | 0 |
| accessible-tabs | 54.5 | 1.6 | 1,613 | 0.6 (0.500-0.700) | yes | 0 |
| shopping-cart | 53.5 | 2.3 | 1,770 | 0.7 (0.700-0.800) | yes | 0 |
| notification-center | 53.7 | 2.3 | 1,723 | 0.6 (0.500-0.700) | yes | 0 |
| form-validation | 55.7 | 2 | 1,694 | 0.7 (0.600-0.700) | yes | 0 |
| keyboard-playground | 54.8 | 2.3 | 1,659 | 0.3 (0.300-0.400) | yes | 0 |
| accessible-toggle | 55.3 | 1.2 | 1,485 | 0.3 (0.200-0.400) | yes | 0 |

"event" is the first event on a fresh page, so it includes cold code paths. `performance.now()` resolution in the page is 0.1 ms. Steady-state per-event costs are in the release report (29–32 µs per click with 1,000–10,000 elements).

At 4× CPU throttling:

| Example | ready (ms) | compile (ms) | heap (KB) | event (ms, median; range) | attribute in same task | diagnostics |
|---|---:|---:|---:|---:|---|---:|
| product-configurator | 142.3 | 8.2 | 1,631 | 2.9 (2.100-3.400) | yes | 0 |
| multi-step-wizard | 113.1 | 9.6 | 1,726 | 2.9 (2.700-3.400) | yes | 0 |
| interactive-quiz | 126.3 | 10.4 | 1,827 | 3.5 (3.200-3.800) | yes | 0 |
| live-form-preview | 112.5 | 7.5 | 1,616 | 2.1 (1.800-2.900) | yes | 0 |
| score-history | 111.6 | 7.9 | 1,652 | 3.1 (2.500-3.300) | yes | 0 |
| settings-panel | 112.7 | 7.4 | 1,598 | 3.1 (2.700-3.700) | yes | 0 |
| accessible-tabs | 110 | 6.9 | 1,613 | 2.7 (2.200-3.100) | yes | 0 |
| shopping-cart | 113.5 | 8.9 | 1,770 | 2.8 (2.600-3.000) | yes | 0 |
| notification-center | 109.2 | 9.2 | 1,723 | 2 (1.800-2.700) | yes | 0 |
| form-validation | 112.9 | 7.6 | 1,694 | 2.7 (2.200-3.400) | yes | 0 |
| keyboard-playground | 109.5 | 9.1 | 1,659 | 1 (0.800-1.700) | yes | 0 |
| accessible-toggle | 108.9 | 4.7 | 1,485 | 1.3 (0.700-1.500) | yes | 0 |

**Comparisons with plain JavaScript** are in [release-0.5.3.md](release-0.5.3.md) section 7, for equivalent widgets: per-click cost and input-to-frame latency. No untested code sketch is used as evidence. In short, input-to-frame latency is the same as hand-written JavaScript; the per-event script cost is higher (a forced style read).

**Bundle:** the examples load `reactive-css.min.js`, 105,753 B minified / 35,660 B gzip / 31,572 B brotli.

## 4. Bugs found by the demos

1. **WebKit stale computed values** under `display: none`, found by the quiz (Try again left hidden questions disabled) and by the form validation (company field `required` lagged). Fixed in the scheduler (release report, section 5).
2. **The wizard's Finish guard** would have been lost with the clamp rules; replaced by a derived `disabled`.
3. **Boolean states are `1`/`0`:** `attr: aria-expanded var(--open)` was rejected by the first implementation; fixed before the examples shipped.
4. **Test harness:** example pages were not CPU-throttled by `RCSS_CPU_THROTTLE` (only `helpers.open()` pages were). Fixed, so the 4× run now covers the examples.

## 5. Accessibility gaps (not solved by `attr:`)

- **Focus management:** a control that becomes `disabled` while focused (configurator bounds, wizard Next at step 4, answered quiz option, Reset at 0, dismissed notification) drops focus to the page. Tab continues from that spot in Chromium and WebKit, but nothing is announced and the focus ring disappears.
- **`aria-disabled` is not available:** focusable-but-disabled buttons (often preferred) cannot be expressed.
- **ARIA patterns:** tabs without arrow-key focus movement, a quiz using `aria-pressed` for a single choice (a radio group is stricter), and a keyboard pad that is not an `application`/`slider`.
- **Announcements:** live regions are in place (totals, counts, verdicts) but were **not tested with any screen reader**.
- **Progressive enhancement:** without the script, derived attributes are absent (panels visible, nothing disabled). Every example remains readable, but not every one is operable.

## 6. Capability limits met (documented, not worked around)

| Need | Example | Why not expressible |
|---|---|---|
| A total over a dynamic number of items | cart, notifications | No aggregate functions; states owned by different elements cannot be summed. Fixed item counts with container-owned states instead |
| More than one undo step | notifications | Needs a list; persistent arrays are out of scope |
| Reset of states owned by descendants | quiz | Actions reach the clicked element and its ancestors; answers live on the quiz |
| `disabled` that follows `:invalid` while typing | wizard | `attr:` re-reads on state changes, and validity is not state |
| Moving focus to the new step/question | wizard, quiz, tabs | No `focus()` (out of scope) |
| `preventDefault()` for arrow keys | keyboard playground | Event control is an RFC |
| Bounded `increment()` for keys | keyboard playground | `disabled` cannot block keys on a `div`; would need conditional `on:` per key |

## 7. Beta readiness from the demos

The demos validate `attr:` for the cases it was designed for: bounds, ARIA state on related elements, group disabling, and conditional constraints. No feature was added for a demo. Remaining before beta: see the beta blockers in [release-0.5.3.md](release-0.5.3.md) section 9 (Firefox, screen readers, `aria-disabled`, the WebKit stale-read minimal case).
