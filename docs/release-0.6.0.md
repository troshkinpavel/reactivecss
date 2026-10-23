# Reactive CSS 0.6.0: accessible reactive interfaces

Local build, not published. Decision record: [rfc-focus-declaration-0.6.md](rfc-focus-declaration-0.6.md).

> **Baseline.** The brief names `docs/release-0.5.4.md`, which does not exist. The post-0.5.3 performance experiment ([attr-performance-optimization.md](attr-performance-optimization.md)) was not versioned. "0.5.4" here means that tree: 0.5.3 plus the scheduler change.
>
> The 0.5.4 comparison bundle (`dist/rcss-054.min.js`, not part of the distribution) was rebuilt from a copy of the 0.6.0 source with every 0.6.0 change reversed. That build:
> - matches the earlier 0.5.4 size within 14 bytes;
> - fails to compile `focus:`.

## Summary

- **`focus:` (experimental):** focus follows user-initiated state transitions, declared in CSS. The selector is the target. The semantics are specified in 11 rules and covered by 19 browser tests per engine.
- **`aria-disabled`** and **`tabindex` (0/-1 only)** join the attribute allowlist. Four other candidates were assessed and deferred.
- **Examples:**
  - wizard and quiz move focus to the right heading or control;
  - tabs implement the ARIA Tabs keyboard pattern with automatic activation;
  - the configurator keeps focus at its bounds with `aria-disabled`.
- **Existing APIs** behave as in 0.5.x; all earlier tests pass.
- **Not verified:** screen readers (no testing possible here) and Firefox (Playwright's Firefox does not start).

## 1. Public API decisions

| API | Decision |
|---|---|
| `focus: <value>` | **added, experimental** (`--rcss-focus`, registered, non-inherited) |
| `focus(selector)` action | **not added**: needs runtime selector evaluation, and repeats focus logic in every action list (RFC section 2) |
| `attr:`/`bind()` `aria-disabled` | **added** |
| `attr:`/`bind()` `tabindex` | **added, `0` and `-1` only** |
| `aria-checked`, `aria-invalid`, `aria-busy`, `inert` | assessed, **not added** (RFC section 5) |
| `when(condition)` and every 0.5.x API | unchanged |

## 2. Focus declaration semantics

Full text in the RFC (rules 1–11). In short:

1. A false → true read of the element's `focus:` value requests focus. A value that stays true never refocuses.
2. The first read never focuses: page load, insertion, a new rule, recompilation.
3. Only state changes made during a **trusted** `click`, `keydown`, `input` or `change` arm a transition. Excluded: scripts, timers, native form reset (applied after the event), focus events, pointer enter/leave, animation and transition events, `outside()`.
4. Eligibility is decided once, after the state's CSS:
   - the target must be rendered, not disabled, not `inert`, and must take focus;
   - a non-focusable target is reported (add `tabindex="-1"`);
   - the library never adds `tabindex`.
5. If several targets become true together, the first eligible one in document order wins.
6. Never overrides:
   - focus the user (or page) moved since the activating event;
   - focus already on or inside the target;
   - focus inside an open `<dialog>` or popover that does not contain the target.

## 3. Scheduling and cancellation

- **Arming.** The state-change hook marks the `focus:` bindings inside the changed owner as *armed*, if the current event qualifies, and records `document.activeElement`. The event dispatcher (`actions.ts`) and bound controls (`bind.ts`) set `scheduler.activation.event` while their state changes run.
- **Reading.** Bindings are read in the late phase, like `attr:` and `text:`:
  - in the event's same-task pass when the page has affected `attr:` bindings;
  - otherwise in the next frame's late phase.
  
  A read only records values and candidates; it never writes.
- **Resolution.** A hook after the late phase (`scheduler.onAfterLate`) runs outside the queues, after both same-task passes or after the frame's late phase. It sorts the candidates by document order and calls `focus()` on the first eligible one. The `focusin` that `focus()` causes is dispatched normally and cannot re-arm.
- **Cancellation.**
  - Removal or unmatching disposes the binding (dead flag, removed from the armed set).
  - Candidates are filtered for liveness at resolution.
  - Armed flags are cleared after every resolution, so a later unarmed change cannot use an old activation.
- **Coalescing.** On the frame path several events before one frame are judged by the final value only: rapid navigation focuses the final step, never an intermediate one. On the same-task path every event resolves its own transition.

## 4. Attribute support changes

| Attribute | Values | Notes |
|---|---|---|
| `aria-disabled` | `"true"`/`"false"` (also `1`/`0`, `"true"`/`"false"` strings) | Does not block clicks, keys or submission. Event dispatch is not changed by its presence. The README and the configurator show the conditional `on:` rule that makes the action inactive. That rule is current for every event (0.5.1 `sync()`): tested with 5 same-task clicks and repeated Enter at the bound |
| `tabindex` | `0`, `-1` | For roving `tabindex`. Positive values are refused (diagnostic, attribute unchanged). `bind(tabindex)` needs a number state |

## 5. Accessibility improvements (in the examples)

| Example | Before (0.5.3) | 0.6.0 |
|---|---|---|
| Multi-step wizard | Focus stayed on Next, or fell to `<body>` at step 4 | Focus moves to the new step's heading on Next, Back, Finish and Start again; never to a hidden step; rapid navigation focuses only the final step |
| Interactive quiz | Answering disabled the focused option, and focus fell to `<body>` | Focus moves to Next after an answer, and to the new card's heading after Next and Try again; no trap |
| Accessible tabs | Tab + Enter only; every tab in the Tab order | ARIA Tabs keyboard pattern, automatic activation: roving `tabindex`, ArrowLeft/Right (wrapping, skipping disabled tabs), Home, End; focus follows the selection; Tab moves on to the panel (`tabindex="0"`) |
| Product configurator | Native `disabled` at the bounds dropped focus | `aria-disabled` + clamp rules: the button stays focused at the bound, and clicks there do nothing |
| Settings, form validation, keyboard playground | — | unchanged: no genuine focus need (native controls, the disclosure pattern keeps focus on its button) |
| Notification center | Focus lost after dismissing | **unchanged, documented.** `focus:` reacts to a condition becoming true, and "last dismissed changed" stays true from the second dismissal on; a rule that works only once was not forced |

## 6. Manual keyboard testing

Done by hand in the in-app browser (Chromium), with real key presses. `document.activeElement` and the DOM state were read after each step:

| Example | Steps | Observed |
|---|---|---|
| Tabs | click Profile, ArrowRight, ArrowRight, End, Tab, Shift+Tab | Security focused and selected (`aria-selected` true, `tabindex` 0 there and -1 elsewhere, only its panel visible). Second ArrowRight wrapped to Profile (Billing and Team skipped). End went to Security (Billing disabled). Tab went to the Security panel; Shift+Tab came back to the Security tab. Focus ring visible |
| Wizard | Enter on Next, Tab, type, Enter on Next, Enter on Back | The "Preferences" heading was focused, with `:focus-visible` true (ring shown). Tab went to the step's required field. Next focused "Configuration", with `aria-current` on step 3. Back focused "Preferences", with `aria-current` on step 2 |
| Quiz | Tab to an option, Space, Enter, Shift+Tab | The answer was disabled and focus moved to Next ("Correct!" shown). Enter focused the question-2 heading. Shift+Tab from the heading went to Next: nothing focusable precedes the heading, and the browser wrapped. No trap |

Not done by hand: WebKit/Safari (covered by the automated WebKit suite only), Firefox, any screen reader.

## 7. Screen-reader testing

**Not performed.** No screen reader could be driven in this environment (VoiceOver needs an interactive macOS session; NVDA and JAWS need Windows). Consequences:
- **Not verified:** focus announcements of the headings, `aria-selected`/`aria-disabled` exposure, live-region announcements (quiz verdicts, totals, counts) and navigation continuity.
- **Verified by automation:** DOM state, roles and attributes as markup, and `document.activeElement` after every interaction, in Chromium and WebKit.
- No accessibility claim beyond that is made. Screen-reader verification is the first beta blocker (section 16).

## 8. Example results

All 12 examples and the demo lab pass under a strict CSP in Chromium and WebKit (`examples.spec.ts`, 17 per engine tests). New assertions in 0.6.0:
- **Wizard:** the step-2 heading is `document.activeElement` after Enter on Next.
- **Quiz:** Next is focused after an answer, the q2 heading after Next, the q1 heading after Try again.
- **Tabs:**
  - arrows move focus and selection, wrapping and skipping disabled tabs;
  - Home and End;
  - `tabindex` is `0` on the selected tab and `-1` elsewhere;
  - Tab and Shift+Tab move between the tab and its panel (Chromium);
  - Billing joins the arrow order when enabled.
- **Configurator:** 12 rapid real clicks stop at 10 with `aria-disabled="true"`; Enter at 10 keeps focus on +.

## 9. Browser compatibility

| Browser | Status |
|---|---|
| Chromium 156 (Playwright) | all tests pass, also at 4× CPU |
| WebKit 27.2 (Playwright) | all tests pass. Differences, handled in the tests: buttons are not focused by a click (so focus lands on the target where Chromium already had the button focused), and the default Tab order skips buttons (macOS keyboard setting), so Tab assertions run in Chromium only |
| Firefox | **unverified**: Playwright's Firefox does not start on this machine ("Could not find profile folder") |

`focus:` uses `Element.checkVisibility()`, available in Chromium 105+, Safari 17.4+ and Firefox 106+; without it, the visibility check is skipped and the browser's `focus()` result decides.

## 10. Regression test results

| Suite | Result |
|---|---|
| Typecheck | clean |
| Unit (`npm test`) | 75 passed (3 new: `focus:` compilation and trust, new attributes, registry) |
| Distribution (`npm run test:dist`) | passed: ESM import, type declarations (2) and both bundles on plain pages in Chromium and WebKit (4); `features.json` lists `focus` as an experimental declaration since 0.6.0 |
| Browser, Chromium + WebKit | **455 passed**, 5 skipped (Chromium-only heap tests in WebKit, as before) |
| Browser, Chromium at 4× CPU | **230 passed** |
| Strict CSP | included: every example test and the CSP specs run under `style-src 'self'` |
| Lifecycle and memory | included: the heap mount/unmount test now uses `focus:`, `aria-disabled` and `tabindex` (0 detached elements) |
| Firefox | **not run**: Playwright's Firefox fails to launch here ("Could not find profile folder") |

New: `v060.spec.ts`, 19 tests per engine. They cover:
- transitions on both paths;
- keyboard and scripted activation;
- `focusin` cycles;
- rapid clicks, and focus moved before resolution;
- an un-hidden ancestor;
- non-focusable, hidden, disabled and inert targets;
- document-order priority;
- focus inside the target or in an open dialog;
- cascade, a removed target, an inserted target;
- nested owners, recompilation, untrusted sheets, invalid values;
- `aria-disabled` and `tabindex`.

Example tests were updated for focus, and a tabs keyboard test was added.

## 11. Performance against 0.5.4

Method: both bundles built from the same tree (section header), interleaved runs, Chromium 156, production bundles.

**`focus:` cost** (`benchmarks/audit/focus-perf.mjs`, n components with a state toggle, another state and an `h3 { focus: var(--on) }`, 2 × 3 page loads per bundle):

| | n | 0.5.4 | 0.6.0 |
|---|---:|---:|---:|
| Startup to second ready frame (ms) | 1,000 | 72.9 / 71.6 | 71.6 / 72.6 |
| | 10,000 | 195.8 / 195.7 | 196.5 / 194.8 |
| Startup task time (ms) | 1,000 / 10,000 | 6.3–6.6 / 16.0–16.2 | 6.1–6.1 / 15.7–15.8 |
| Non-qualifying update: script per click (µs, 20 clicks per task), same-task path | 1,000 / 10,000 | 55–60 / 55–70 | 65 / 65–75 |
| same: computed-style reads per click | | 2 | 4 (the `focus:` binding in the owner, read in both passes); forced recalculations unchanged |
| Non-qualifying update, frame path (no `attr:`) | 1,000 / 10,000 | 40 / 30 µs, 0 reads in the task | 45 / 40–45 µs, 0 reads in the task |
| Pointer press → `focusin` on the target, same-task path | 1,000 / 10,000 | — | 0.4 / 0.5–0.6 ms |
| same, frame path | 1,000 / 10,000 | — | 14.4–14.5 / 14.9–15.0 ms (one frame) |

- **Startup:** unchanged within noise. (One 10,000 frame-path run of 0.5.4 started at 179 ms; it has no bindings, since 0.5.4 ignores `focus:`.)
- **A non-qualifying update** costs one extra computed-style read per `focus:` element in the changed owner, with **no extra forced recalculation**. The script-time difference (+5–10 µs per click) is at the edge of noise.

**Existing `attr:` path** (`attr-perf.mjs`, both bundles interleaved, 2 runs each): computed-style reads and forced recalculations per click are **identical** in every scenario (2/4 reads, 1–2 recalculations), and every attribute is correct. Per-click times overlap in every scenario, for example `disabled` at 10,000 and k = 20: 17.5/16 µs (0.5.4) and 16.5/16 µs (0.6.0). No regression.

**Input to correct frame** (`runtime.mjs latency`, 100 widgets, 40 real clicks, 0.6.0):

| Widget | idle p50 / p95 | plain JS | under load p50 / p95 | plain JS |
|---|---:|---:|---:|---:|
| derived `disabled` | 14.1 / 15.8 ms | 13.9 / 15.9 | 10.9 / 16.9 | 10.5 / 17.7 |
| bound `aria-pressed` | 14.0 / 16.2 ms | 13.8 / 15.9 | 10.7 / 26.9 | 13.3 / 21.9 |

These match the 0.5.4 run (derived `disabled`: 13.7 / 14.9 ms idle) within noise. The `aria-pressed` p95 under load varies between runs of the same build (plain JS itself ranged 18–22 ms).

## 12. Memory and idle work

- **Memory** (`memory.mjs mount`, 1,000 components × 150 cycles, every feature including `focus:`, `aria-disabled` and `tabindex`): **clean**. 0 detached elements, 0 bindings and 0 `FocusBinding`/`AttrSet` objects after unmount, listeners stable, growth −1.4 KB/cycle. The end heap (3.57 MB) is within the 2.7–3.5 MB run-to-run range measured for 0.5.4.
- **Idle work:**
  - On the `focus:` page, both bundles idle at about 0.55 ms/s of task time with **0 library flushes and 0 timer ticks**, measured with no interaction, after a non-focusing click, after a focusing click, and with a heading focused by script. `focus:` adds no recurring work, loop or poll.
  - (An earlier idle window that started right after the focusing click measured 0.4–0.66 ms/s for 0.6.0. The direct probe shows this was the click and scroll settling, not the library: 0 flushes.)
  - The generic idle pages (`runtime.mjs idle`: state, bound, text) show 0 script, style and layout work per second, as before.

## 13. Security findings

- `focus:` is refused in untrusted stylesheets (tested).
- No runtime selector strings: the target is the matched element.
- No `tabindex` injection.
- Trusted events only (`isTrusted`): scripted `el.click()` does not move focus (tested).
- No cycles: focus events never arm (tested: a `focusin(set(…))` rule on another element does not pull focus back).
- No retention: removed targets drop their bindings (heap mount/unmount test includes `focus:`, 0 detached elements; `stats().bindings` returns to 0).
- Positive `tabindex` values are refused (tested).
- Strict CSP: unchanged, using only CSSOM and `focus()` (all example tests run under `style-src 'self'`).
- Frames: bindings exist only in the document whose stylesheet declared them; nothing crosses frames.

No vulnerabilities found. One theoretical caveat, documented: a trusted page author can create two simultaneous targets; the document-order rule then decides deterministically.

## 14. Bundle sizes

| Bundle | 0.5.4 min / gzip / brotli | 0.6.0 min / gzip / brotli | Δ gzip |
|---|---|---|---:|
| `reactive-css.min.js` | 105,853 / 35,691 / 31,536 | 110,831 / 37,203 / 32,739 | +1,512 |
| `reactive-css.compact.min.js` | 91,712 / 31,028 / 27,699 (0.5.3) | 95,847 / 32,211 / 28,641 | +1,183 |

Most of the growth is `focusdecl.ts` (about 3.5 KB minified, mostly diagnostic text) and the registry entry. The compact bundle keeps only name, kind, status, since and syntax.

## 15. Remaining limitations

- **Screen-reader behavior is unverified**, and Firefox is unverified.
- **No focus restoration** (returning focus to the opener). Use `<dialog>`/`popover`.
- **No manual tab activation** (arrows that move focus without selecting): focus follows selection.
- **No retry:** a target that becomes eligible only after a CSS transition or animation is not retried.
- **Value-change focus is not expressible:** `focus:` reacts to false → true, not to "a value changed". Notification dismissals would need it.
- **Arrow keys still scroll a scrollable page:** there is no `preventDefault()` (event-control RFC).
- **Native form reset never moves focus:** it is not a user activation by these rules.
- **The tab key lists are per tab set** (`cycle()` lists by id): no parameterized rules.

## 16. Recommendations for the next milestone

1. **Screen-reader verification** of the wizard, quiz, tabs and configurator with VoiceOver + Safari and NVDA + Firefox/Chromium, before any accessibility claim. Promote `focus:` from experimental only after that.
2. **Firefox** test run on a machine where Playwright's Firefox starts.
3. **`prevent()`** from the event-control RFC, so arrow keys in tabs and the keyboard playground do not scroll.
4. **The WebKit stale-read trigger** (still unidentified) to narrow the workaround.
5. **Focus restoration**, only if a real example needs more than `<dialog>`/`popover`.
