# Reactive CSS 0.7.1: cross-browser validation and advanced examples

Local build, not published. A validation release: **no new public API**. Manual test plan: [browser-validation-0.7.1.md](browser-validation-0.7.1.md).

## Summary

- **Examples.** Eight new examples exercise the newer APIs in realistic interfaces. Every example works without application JavaScript; the two lifecycle labs add a clearly marked JavaScript test harness. The demo lab lists all 20 examples and adds a cross-browser checklist page.
- **Bugs.** The examples found **three runtime bugs**, fixed with focused regression tests (section 3).
- **Automated tests:** all pass in Chromium and WebKit, also at 4× CPU (unchanged, section 4).
- **Manual cross-browser validation: complete (user-reported).** All 20 examples passed manual testing in Google Chrome, Safari and Firefox, with no outstanding functional failures. See section 6 and [browser-validation-0.7.1.md](browser-validation-0.7.1.md).
- **Playwright's Firefox** still cannot run in the development environment, so Firefox coverage is manual only.
- **Screen readers** remain unverified.

## 1. Syntax audit (implemented forms used by the examples)

All expressions were compiled against the current parser before use, with no diagnostics:

```css
attr: aria-expanded var(--open);  attr: disabled when(--locked);  attr: aria-disabled when(--busy);
attr: data-state var(--status);   attr: tabindex when(--selected, 0, -1);
--open: state(false, bind(aria-expanded));
focus: when(--panel == 2);  focus: var(--more);
on: key(ArrowDown, prevent(), cycle(--i, 1, 2, 3)), key(Home, prevent(), set(--i, 1));
.x:changed(--v) .y { … }  text: previous(--v);  text: direction(--v);  increment(--n, 1, closest(#outer));
```

No experimental syntax was added for the examples.

## 2. The eight examples

| | Example | Exercises | Tests |
|---|---|---|---|
| A | `focus-transitions` | `focus:` transitions, `tabindex="-1"`, rapid changes, a hidden target revealed in the same action, a disabled target (focus deliberately unchanged), a native popover keeping focus, no transition = no focus | 2 |
| B | `keyboard-navigation` | Arrows/Home/End with `prevent()` on a really scrollable page, roving `tabindex`, conditional key rules (lock), a nested key region, a text field inside the keyboard-controlled section | 2 |
| C | `attribute-playground` | The five requested `attr:` expressions, `state(false, bind(aria-expanded))`, `disabled` vs `aria-disabled`, a live attribute table with CSS only (`:has()`) | 1 |
| D | `dynamic-components` | Insertion after start, removal with same-task pending work, moves, reinsertion, sheet insertion/removal, recompilation, cleanup (JS harness) | 1 |
| E | `nested-cascade` | Nested owners, an explicit owner (`closest()`), inherited values, specificity, `:when()`, `@layer`, `!important`, ancestor state → descendant attribute | 1 |
| F | `form-interactions` | `bind:`, `text:`, conditional `required`/`hidden`, `disabled` submit, `:valid`/`:user-invalid`, keyboard, reset, nothing sent or stored | 1 |
| G | `history-motion` | `previous()`, `direction()`, `:changed()`, native transition and keyframes, rapid actions, bounds, reduced motion | 1 |
| H | `stylesheet-lab` | Several linked sheets, `@layer`, `@media`, a `<link>` disabled/enabled, its `media` attribute, insertion/removal, recompilation, state across recompilation, `refresh()` (JS harness) | 1 |

- **README.** Every example has the usual 1–7 sections, plus a manual checklist (section 8: exact action and expected result) and browser notes (section 9: Chrome, Safari, Firefox).
- **Demo lab.** It lists the new examples, has a `harness.js` source tab and links to `checklist.html`.
  - The checklist builds a table from every README (section 8 rows, section 9 notes) with a per-browser `not tested / pass / fail / n/a` selector, defaulting to **not tested**.
  - It copies the results as Markdown or prints them. Nothing is stored.

## 3. Bugs found and fixed

Each was reproduced in a focused test first (`tests/browser/v071.spec.ts`). The fix is the smallest found, and existing behavior is unchanged: all earlier tests pass.

### 3.1 A disabled and re-enabled `<link>` lost its Reactive CSS

- **Found by:** the stylesheet lab. After "Toggle extra.css" twice, the sheet's `on:` and `text:` rules no longer applied.
- **Root cause:** setting `link.disabled = true` makes the browser drop the sheet (`link.sheet` becomes `null`, checked in Chromium and WebKit). Re-enabling loads a **fresh, unprocessed** sheet. The engine observed only `href` on links, so it never reprocessed it. A `media` attribute change was not observed either.
- **Fix** (`engine.ts`): observe `disabled` and `media` too. A disabled link releases its rules at once (bindings restore their originals). Re-enabling and `media` changes reprocess the sheet like an `href` change.
- **Test:** disable → rules released; enable → fresh sheet processed; `media` → applies or not; no diagnostics.

### 3.2 `text:`/`attr:`/`focus:` reading a state declared in a later-loading sheet

- **Found by:** the stylesheet lab: the counter showed nothing, and a false warning was logged ("text: on span.n needs one value; "state(0)" is not shown").
- **Root cause:** linked sheets compile in load order. A binding in an earlier sheet read the raw, still-uncompiled `state(0)` of a later sheet through `var()`. It reported it, and nothing made it read again once that sheet was compiled.
- **Fix** (`registry.ts`, `engine.ts`, `text.ts`, `attrdecl.ts`, `focusdecl.ts`):
  - `text:`, `attr:` and `focus:` bindings read again after every stylesheet is compiled or dropped. Reads are deduplicated per frame.
  - A computed value that still contains uncompiled Reactive CSS syntax is skipped silently. For `focus:` it also records no transition.
- **Test:** the declaring sheet delayed by 300 ms → value shown, attribute written, no diagnostics.

### 3.3 `focus:` moved focus out of an open popover in WebKit

- **Found by:** the focus-transitions example (WebKit only). "Go to panel 1" inside the popover moved focus to the panel heading behind it.
- **Root cause:** rule 8 ("never take focus from an open dialog or popover") checked only `document.activeElement`. WebKit does not focus a button on click, so focus was on `<body>`, not in the popover.
- **Fix** (`focusdecl.ts`): also check the activating event's target. A change made by a click inside an open dialog or popover does not move focus out of it, in any browser. Rule 8 is updated in `rfc-focus-declaration-0.6.md`.
- **Test:** a non-focusable element inside a popover reproduces WebKit's behavior in Chromium too.

### Found, but expected behavior (documented, not changed)

- **Replacing the sheet that *declares* a state restarts the state** (40 → 0): a state lives while a `state()` declaration matches its owner. Recompiling sheets that only use it keeps it (tested).
- **Media query changes from resizing** reach `text:` on the next state change or `ReactiveCSS.refresh()`. CSSOM edits (`insertRule`, `sheet.disabled`) are not observed.
- **Playwright's `click()` treats `aria-disabled="true"` as disabled.** That is a test-tool rule, not a browser one. The tests use a forced (still trusted) click.
- **Home/End do not move a text field's caret on macOS** (platform behavior). Headless WebKit never scrolls on arrow keys (0.7.0 finding).

## 4. Test counts

| Suite | Result |
|---|---|
| Typecheck | clean |
| Unit (`npm test`) | **78 passed** |
| Distribution (`npm run test:dist`) | passed: ESM + types (2), both bundles in Chromium and WebKit (4); `features.json` version 0.7.1 |
| Browser, Chromium + WebKit | **507 passed, 5 skipped** (the Chromium-only heap tests in WebKit, as before) |
| Browser, Chromium at 4× CPU | **256 passed** |
| Firefox | **not run**: Playwright's Firefox fails to launch here ("Could not find profile folder") |
| Strict CSP | every example test runs under `default-src 'none'; script-src 'self'; style-src 'self'` (the harnesses use `<link>` files, not inline styles) |
| Memory (`memory.mjs mount`, 1,000 × 150) | clean: 0 detached elements, 0 bindings left, growth −10 KB/cycle, end heap 3.55 MB (same range as 0.7.0) |

New in 0.7.1:
- `examples-071.spec.ts`: 11 tests per engine (the eight examples, two second scenarios, the checklist page);
- `v071.spec.ts`: 3 regression tests per engine;
- an updated lab test (20 examples).

Existing tests were not weakened. Test changes elsewhere:
- the lab count went from 12 to 20;
- the shared example helpers moved into `example-helpers.ts`. `finish()` can expect a specific diagnostic, used once, for the documented "disabled target" note.

## 5. Performance

0.7.0 vs 0.7.1, both built from the same tree, interleaved, 2 runs each (`focus-perf`, `attr-perf`, `event-perf`, Chromium 156, production bundles):

| Measure | 0.7.0 | 0.7.1 |
|---|---|---|
| Startup to ready, 1,000 / 10,000 components (`focus:` page) | 71.3–71.4 / 195.2–197.3 ms | 72.1–72.4 / 195.3–212.1 ms |
| Pointer to `focusin`, same-task / frame path | 0.4–0.5 / 14.6–15 ms | 0.4–0.5 / 14.4–15 ms |
| `attr:` click, k = 20, 10,000: control / disabled / chained | 16.5–15.5 / 17.5–18 / 54–63.5 µs | 18 / 16–18 / 47.5–51.5 µs |
| Computed-style reads per click | 0 / 2 / 4 | 0 / 2 / 4 (identical) |
| Key / click dispatch, no `prevent()` | 4.5–5.5 / 4–7 µs | 4.5–5.5 / 4.5–6 µs |
| Sheet with 200 `on:` rules: insert | 5.2–5.7 ms | 5.0–5.6 ms |

All within run-to-run noise. The single 212 ms startup is one run; its pair is 195 ms. The re-read after a stylesheet compiles shares the frame's late phase, so several sheets compiling together cost one read per binding.

**Bundle sizes** (bytes):

| Bundle | 0.7.0 min / gzip / brotli | 0.7.1 min / gzip / brotli | Δ gzip |
|---|---|---|---:|
| `reactive-css.min.js` | 113,971 / 38,284 / 33,598 | 114,421 / 38,377 / 33,686 | +93 |
| `reactive-css.compact.min.js` | 97,785 / 32,831 / 29,130 | 98,235 / 32,950 / 29,210 | +119 |

## 6. Compatibility gaps

| Area | Status |
|---|---|
| Chromium (Playwright 156) | automated: all pass |
| WebKit (Playwright 27.2) | automated: all pass. Its differences from Chromium are handled per test: buttons are not focused on click, arrow keys never scroll in headless mode, the caret position on focus differs |
| Firefox, automated | **not run**: Playwright's Firefox does not start in the development environment ("Could not find profile folder"). Unchanged |
| Google Chrome, Safari, Firefox (real browsers, manual) | **pass, user-reported**: all 20 examples, following [browser-validation-0.7.1.md](browser-validation-0.7.1.md). No per-step logs, timestamps or browser versions were reported, and none are recorded |
| Screen readers | **unverified** (unchanged since 0.6.0) |

**Safari Tab navigation** was first reported as a failure: Tab skipped buttons, radio buttons and checkboxes. That is Safari's default keyboard navigation on macOS, not a Reactive CSS bug. With "Press Tab to highlight each item on a webpage" (Safari → Settings → Advanced) or the macOS "Keyboard navigation" setting turned on, Tab worked and every affected example passed. The result is **pass**.

The automated and manual results are independent. The automated counts in section 4 come from Playwright runs; the manual pass comes from the user's report. The checklist page does not store results, so nothing there was updated.

## 7. New blockers

None introduced, and no outstanding functional failures from the manual pass. Resolved by it, as user-reported:
- Firefox and Safari behavior in real browsers, including Safari arrow-key handling (headless WebKit cannot show arrow-key scrolling).

Still open:
1. Screen-reader verification of the `focus:` examples.
2. An automated Firefox run, on a machine where Playwright's Firefox starts.
3. The WebKit stale computed-style trigger (still worked around, not explained).
