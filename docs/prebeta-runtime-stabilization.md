# Pre-beta runtime stabilization

**Date:** 2026-10-21. **Version:** 0.8.0 (local, unpublished; no version bump).

**Release:** these fixes became 0.8.1 (prepared locally, unpublished): [release-0.8.1-preparation.md](release-0.8.1-preparation.md). The sizes below were measured before the version bump; the 0.8.1 measurements are in that report.

**Evidence:** [bundle-builder-audit.md](bundle-builder-audit.md) and the `NOTES.md` of the six
internal experiments (`experiments/`, gitignored).

**Regression tests:** [tests/browser/prebeta.spec.ts](../tests/browser/prebeta.spec.ts), and one
analyzer test in [tests/unit/catalog.test.ts](../tests/unit/catalog.test.ts).

**Browsers:** Playwright Chromium and Playwright WebKit (build 2370, Playwright 1.64.1). Firefox was
not run: Playwright's Firefox does not launch on this machine ("Could not find profile folder").
Screen readers were not tested.

## Summary

| # | Issue | Verdict | Change |
|---|---|---|---|
| 1 | Analyzer and `href="/x.css"` | Defect: the location was guessed, and the fallback to full was not explained | **Fixed:** `--root <dir>` / `root` option and a `root-relative-link` note |
| 2 | WebKit: `text:` in a hidden section | WebKit engine bug (reproduced with no library) | Not changed; documented; engine-tracking test |
| 3 | WebKit: `attr:` with `:has(:invalid)` | WebKit engine bug (reproduced with no library) | Not changed; documented; state-based alternative tested |
| 4 | Enter moves focus, then clicks the button | Runtime defect (timing) | **Fixed** |
| 5 | `:changed()` held by an unrelated animation | Runtime defect: violates its documented clearing rule | **Fixed** |
| 6 | `live()` keeps running under a false `:when()` | Documented behavior (superset binding) | Not changed; documentation made explicit |
| 7 | `element()` is empty at first | Documented behavior, but the docs said "before the first paint", which was wrong | Docs corrected; not changed |
| 8 | Bound radio/checkbox loses a fast second choice when the page has `on: click` (found later, by the visual lab) | Runtime defect | **Fixed** |

No public runtime API was added. The analyzer gained one option (`root`, CLI `--root`), which the
analyzer requirements in the brief asked for. The bundle catalog, the features and the profiles are
unchanged.

**Size:** `reactive-css.min.js` grew by 1,516 B, from 116,319 B to 117,835 B (§ Sizes): 1,143 B for issues 1–7 and 373 B for issue 8.

---

## 1. CSS analyzer: root-relative stylesheet links

**Reproduction.** A page in `experiments/wizard/` links `<link rel="stylesheet" href="/shared/lab.css">`,
served from `experiments/` as `/`. Run `reactive-css analyze experiments/wizard/ --assume-complete --build out.js`.

**Before:**
- `complete: false`, with the note `missing-file`: "Linked stylesheet /shared/lab.css was not found";
- the build was the full runtime (98,605 B for that page instead of 83,462 B);
- the build output named no reason next to the bundle.

**Root cause.** `sheetsOfHtml()` in `tools/bundle.mjs` resolved every href with
`resolvePath(dirname(page), href)`. For `/shared/lab.css`, that is `/shared/lab.css` on the
**filesystem root**: a guessed location. If such a file had existed, the analyzer would have read an
unrelated file. Query strings (`style.css?v=2`) were also treated as part of the file name.

**Expected behavior.**
- A root-relative reference resolves only against an explicitly given site root.
- Without a root, the analyzer reports the unresolved reference. The analysis is incomplete, and the
  safe recommendation is the full runtime. This was already the outcome, but it must say why.
- No network access.

**Fix** (`tools/bundle.mjs`, `tools/reactive-css.mjs`):
- New option `analyze(inputs, { root })`, CLI `--root <dir>`: the folder the site serves as `/`.
- `href="/x.css"`:
  - without a root, a `root-relative-link` note names the link and the option, and the analysis is
    incomplete;
  - with a root, the file is resolved under it;
  - a path that leaves the root (`/../../x.css`) is refused (`missing-file`);
  - a root that is not a folder is reported (`missing-file`).
- `?query` and `#hash` are removed from hrefs, and percent-encoding is decoded, so
  `style.css?v=2` is found.
- `--build` with an incomplete analysis prints "Built out.js (the full runtime: the analysis is
  incomplete, so this is not a minimal selection)".
- Docs: [bundle-builder-0.8.md](bundle-builder-0.8.md) (CLI table, API table, notes table) and the
  site's Custom Bundles guide (CLI table).

**Tests.**
- Unit test "root-relative links resolve against an explicit root only, never a guessed location":
  - without a root: one `root-relative-link` note, incomplete, full;
  - with a root: complete, `conditions` and `events` found through a `?v=2` link;
  - a missing file under the root, a path escaping it, and a root that is not a folder.
- The experiments now link `/shared/lab.css` (root-relative, as served).
  `experiments/tools/build-bundles.mjs` passes `--root experiments`. All six analyses are complete,
  and the bundles have the same features as before.

**Browser results.** Not browser-dependent (Node).

**Compatibility risks.**
- The new option is optional; without it, results are the same or more explicit.
- Pages whose links carry a query string (`?v=2`) can now get a complete analysis and a smaller
  recommendation, where they used to get the full runtime. This is the intended result. The browser
  still reports a missing feature in `ReactiveCSS.diagnostics`.
- JSON consumers that matched `missing-file` for root-relative links now see `root-relative-link`.

## 2. WebKit: `text:` in a section hidden by CSS

**Reproduction** (wizard NOTES):

```css
.c { --v: state(""); --show: state(true); }
.c .i { bind: --v; }
.c .t { on: click(toggle(--show)); }
.c:when(not --show) .box { display: none; }
.c .o { text: var(--v); }
```

Type "a", click the toggle, then type "ab". `.o` shows "a" in WebKit and "ab" in Chromium.

**Root cause: WebKit, not the runtime.** The runtime re-reads the binding on each state change, as
documented, and WebKit's `getComputedStyle()` returns a stale value. The same happens with no
Reactive CSS on the page:

```html
<style>.c[data-h] .box { display: none }</style>
<div class="c" style="--v: a"><p class="box"><span class="o">x</span></p></div>
<script>
  getComputedStyle(o).getPropertyValue('--v');   // "a"; the element is rendered
  // next frame:
  c.setAttribute('data-h', '');                   // hide the ancestor
  getComputedStyle(o).getPropertyValue('--v');
  c.style.setProperty('--v', 'b');
  getComputedStyle(o).getPropertyValue('--v');   // WebKit: "a" (stale) · Chromium: "b"
</script>
```

Observed behavior:
- An element that was rendered once, and is then under a `display: none` ancestor, keeps the
  inherited values it had when it was hidden. They stay stale in later frames, for plain and
  registered custom properties, and through Typed OM (`computedStyleMap()`).
- An element never read while hidden gets fresh values.
- A write to the element's own inline style refreshes it.

**Consequences.**
- The hidden `textContent` is stale in WebKit. It is not rendered and not in the accessibility tree.
- If the section is then shown **by a state change**, the state change re-reads the binding: correct.
- If it is shown by something that is not a state change (`:has(:checked)`, `details[open]`, a media
  query, a script class change), WebKit shows the stale text until the next state change in the
  owner. This was confirmed: "ab" shown instead of "abc".

**Expected behavior.** `text:` writes the computed value at each documented trigger (README:
"Updates…"). The runtime does that. The value WebKit computes is wrong.

**Decision: no runtime change.** Every workaround found has a cost that is worse than the defect:
- Refreshing WebKit's cache needs a write to the page's elements, an inline-style toggle on each
  hidden binding before each read. That creates `style` mutation records for the page's own
  observers, can leave `style=""` in the serialized DOM, and frameworks that own `style` would see
  foreign changes.
- Re-reading when a hidden element becomes rendered needs an observer that sees the change.
  `ResizeObserver` reports inline elements (the usual `text:` target) as 0×0, and
  `IntersectionObserver` does not fire for an element that becomes rendered off-screen.

Author guidance (in the reference and this report): show a section that contains `text:` with a
state-driven rule (`:when()`, or `attr: hidden`), so the reveal re-reads it.

**Tests.**
- "a section shown again by a state change shows the current value": passes in both engines.
- "engine: an element rendered once keeps its computed style current while an ancestor is
  display: none": no library. It is `test.fail` in WebKit, so it reports when WebKit fixes the bug,
  and the guidance can then be removed.

**Browser results.**
- Chromium: correct.
- WebKit: stale, as described; the state-driven reveal is correct.

**Compatibility risks.** None: nothing changed.

## 3. WebKit: `attr:` that depends on `:has(:invalid)`

**Reproduction** (wizard NOTES): selecting `b` enables a required, empty `<select>` through
`attr: disabled when(--on != b)`, so `.f:has(:invalid)` matches. `.f:has(:invalid) .b { attr:
aria-disabled true }` still leaves `aria-disabled="false"` in WebKit.

**Root cause: WebKit, not the runtime.** With no Reactive CSS on the page:
- removing `disabled` from a required, empty `<select>` makes `form.matches(':has(:invalid)')`
  true;
- the rule `.f:has(:invalid) .b { color: red }` still does not apply, in that task or in later
  frames;
- the same change on an `<input>` works.

WebKit does not invalidate `:has(:invalid)` for that `<select>` change. The runtime reads the
cascade correctly, and the cascade itself is wrong.

**Expected behavior.** `attr:` writes the winning cascade value. It cannot correct the browser's
selector matching.

**Decision: no runtime change.** Author guidance: derive the gate from state rather than from
`:has(:invalid)`, for example `attr: aria-disabled when(--on == b and --size == "", true, false)`.
The wizard's `on:` gate was never affected, because the `on:` rule is chosen at event time.

**Tests.**
- "a condition on state gives the same gate in both engines": passes in both.
- "engine: :has(:invalid) applies after a required <select> is enabled": no library; `test.fail`
  in WebKit.

**Browser results.**
- Chromium: correct.
- WebKit: native selector bug; the state-based form is correct.

**Compatibility risks.** None.

## 4. Enter that moves focus also activated the newly focused button

**Reproduction** (command-palette NOTES):

```css
.box { --open: state(true); }
.box .open { on: click(set(--open, true)); attr: aria-expanded var(--open); }
.box:when(not --open) .open { focus: true; }
.box .field { on: key(Enter, set(--open, false)); }
```

Press Enter in `.field`: focus moves to `.open`, which is then **clicked**, and `aria-expanded`
returns to "true". This happens in both engines.

**Root cause.** RFC rule 5 resolves `focus:` in the event's own task when the page has affected
`attr:` bindings. `urgently()` → same-task late pass → `afterLate` → `focus()`, all inside the
`keydown` listener. A key press continues after `keydown`:
- the `keypress` and the text input go to the element focused at that moment;
- Enter's activation of a focused button or link runs on that `keypress`.

So the Enter pressed in the field activated the button. A page without `attr:` resolves focus in
the next frame and never had the bug: the timing depended on unrelated declarations. Two more
effects, confirmed by tests that fail on the old code:
- Enter in a form field **did not submit the form**: the `keypress` went to the button;
- a shortcut letter that focuses a text field was typed into it.

**Expected behavior.**
- Enter keeps its native meaning in the element where it was pressed: it submits that element's
  form.
- The focus move happens after that press. It must not cause a second, unintended activation.
- Native activation of a focused button by the keyboard is unchanged.

**Fix** (`src/state/focusdecl.ts`, `src/core/scheduler.ts`):
- `focus:` remembers the `keydown` that armed a request.
- When that key press continues (Enter or a printable key, and the `keydown` was not prevented),
  the same-task resolution is skipped. The frame's late phase, which `urgently()` already
  requests, resolves it.
- Arrow keys, Home, End, Escape and Tab have no `keypress`. They keep the same-task path, so
  roving-tabindex keyboard navigation is unchanged.
- A prevented `keydown` has no `keypress`, so it also stays same-task.
- Candidates are filtered by their current value at resolution time. On the frame path, a later
  event can turn an earlier candidate false again.
- `onAfterLate` hooks receive `sameTask: boolean`; this is internal.
- Docs: README (Focus, "When"), RFC rule 5, and the reference's behavior list.

**Tests** (`prebeta.spec.ts`; all fail with the deferral disabled, checked by disabling it):
- "Enter in a field whose action moves focus to a button does not also click that button". It also
  checks that pressing Enter on the focused button still activates it natively.
- "Enter still submits the form it was pressed in".
- "a shortcut key that moves focus into a text field is not typed into it".
- Existing: "accessible tabs … arrows, Home, End move selection and focus". It reads focus right
  after each arrow key and caught the first version of the fix, which deferred every key.

**Browser results.** Chromium and WebKit: fixed, and existing focus tests pass.

**Compatibility risks.**
- On pages with `attr:`, focus after an Enter or printable-key action moves one frame later than
  before (as on pages without `attr:`). A script that reads `document.activeElement` synchronously
  in a later handler of the same Enter key press sees the old element.
- Space is a printable key (`" "`), so focus moved by a Space action is also deferred. This is
  intended: it stops Space from activating the newly focused button on `keyup`.
- `focus:` is experimental.

## 5. `:changed()` held by an unrelated animation

**Reproduction** (dashboard NOTES): a clock in the subtree restarts its animation, through
`animation-name` swapped by `:when()`, in the same frame as the change.

```css
.box { --n: state(0); --p: state(false); }
.clock { animation: a 2s; on: animationend(increment(--n), toggle(--p)); }
.box:when(--p) .clock { animation-name: b; }
.box:changed(--n) .num { animation: bump 400ms; }
```

In Chromium the marker stayed on for the clock's whole period, long after `bump` ended.

**Root cause.** `checkAll()` in `src/state/changed.ts` counted every CSS animation and transition
that started in the element's subtree after the marker was set. The documented rule is "until the
animations and transitions **it started** have finished" (README, reference, selectors guide).
The clock was not started by the marker.

**Expected behavior.** Only animations and transitions that `:changed()` rules can start hold the
marker.

**Fix.**
- Once per sheet change, the runtime reads the CSSOM of the processed sheets. For each state name,
  it collects:
  - the `animation-name` values of every rule whose selector contains that state's `:changed()`
    marker, including nested rules and rules in `@media`, `@layer` and similar;
  - the longhand properties those rules set.
- A started CSS animation counts if its name is in that set. A CSS transition counts if its
  property is.
- **Conservative fallback.** If those rules set a custom property, or use `var()` or a value only a
  shorthand can give, they can start anything indirectly. Then every animation that started in the
  subtree counts, as before.
- Effects are grouped by **state name**, not by marker. Two `:changed(--n)` selectors on one
  element are two private markers, but authors write them as one condition, and they clear
  together, as before. The existing test "waits for the longest of several animations on several
  descendants" caught a first per-marker version.

**Tests.**
- "an unrelated animation restarting in the same frame does not hold the marker": fails with the
  old counting.
- "a marker rule that sets a custom property still waits for every transition it may start": fails
  without the fallback.
- Existing: the `:changed()` lifecycle tests (v0.3), `change-animation` (API examples, full and
  custom bundle) and examples-071 G (history and motion).

**Browser results.** Chromium and WebKit: fixed; the existing lifecycle tests pass.

**Compatibility risks.**
- `:changed()` can now clear earlier when unrelated animations start in the same frame. This is
  the documented behavior.
- An animation started through an indirection that the scan cannot see (a name only given in
  another rule, keyed off the marker through a custom property) falls back to the old rule.
- A same-named animation elsewhere in the subtree still counts. This is conservative: the marker
  never clears too early.
- Size: `history` (which contains `:changed()`) grew by 979 B.

## 6. `live()` under `:when()`

**Reproduction** (dashboard NOTES): `.box:when(--on) .dot { --x: live(random(0, 100), 1s); }`.
After `--on` becomes false, `stats().scheduled` stays 1 and the timer keeps ticking. It also ticks
from load while `--on` is false.

**Expected behavior (documented before any change).** Binding uses a superset of elements:
- State-dependent parts of a selector, `:when()` included, are not used to decide which elements
  get bindings (README, "Bindings": "the candidate set is a superset. Binding an extra element is
  harmless").
- `:when()` decides where a value **applies**, not whether its source runs.
- A source runs while its element matches the rest of the selector.

Separately, attributes written by `attr:` never re-match reactive rules (README, Attributes: "no
feedback loops"). So an `attr:`-written attribute is not a gate either. This was verified:
`.box[data-on="1"] .dot { --x: live(…) }`, with `data-on` written by `attr:`, never binds.

**Decision: no runtime change.** Making `:when()` start and stop sources would change API
semantics:
- every `:when()` toggle would re-create its sources, so `live(random())` would jump to a new value
  and `on(event, …)` sources would reset;
- every marker change would cost a re-match for every reactive rule under it.

Documentation was made explicit (README limitations). To stop a source, gate it with the DOM:
remove the element, or use an attribute that the browser or a script changes, such as
`details[open]`. The dashboard does this with its region panel.

**Tests.**
- ":when() decides where the value applies; the source runs while its element is bound": the value
  applies only while `--on` is true. The test also pins `scheduled` to 1, so any future change to
  this behavior has to be deliberate.
- "a native attribute (details[open]) starts and releases the source": `scheduled` goes 0 → 1 → 0.

**Browser results.** Chromium and WebKit: as documented.

**Compatibility risks.** None: nothing changed.

## 7. `element()` before the first measurement

**Expected behavior (documented before any change).**
- An element that uses `element()` has no value (`unset`) until its first `ResizeObserver`
  measurement, so `var(--w, fallback)` uses the fallback, never `0px`.
- `display: none` measures `0px`.
- Before the sheet is compiled, the raw `element(width)` text makes a `var()` that reads it invalid
  at computed-value time. The property then gets its initial value, not the fallback. This is
  native CSS behavior.

The docs said the value arrives "before the first paint". Measured:
- the browser delivers the first measurement before the element's first paint;
- the runtime writes the value in the **next** frame's flush;
- so one frame renders with the fallback, in both engines: the measurement arrives in frame N,
  and the value is set from frame N+1.

This explains the motion experiment's one frame of "0" from a counter and its 0.00014 layout
shift.

**Decision: docs corrected; runtime not changed.**
- Writing the value inside the `ResizeObserver` callback would remove that frame. But a value that
  changes the size of an observed element at the same or a shallower depth would then raise
  "ResizeObserver loop completed with undelivered notifications". Example: a measured child that
  sizes its parent, or the self-feedback case that the feedback guard handles across frames.
- That error reaches `window.onerror` and error trackers, which is worse than one frame of
  fallback.

Updated: README (`element()` row), the reference (`returns`), the geometry guide, and the comment in
`src/functions/geometry.ts`. Guidance: give `var()` a fallback the size of the expected value, or
reserve the space (the motion experiment reserves fixed-width slots).

**Tests.** "a new element has no value until measured, so var() fallbacks apply; the value arrives
within a few frames":
- the first read is the fallback (`77px`);
- the value is set within 4 frames and stays;
- no page errors and no diagnostics.

**Browser results.** Chromium and WebKit: as documented; value from the frame after the measurement.

**Compatibility risks.** None: nothing changed.

---

## 8. A bound radio or checkbox lost a fast second choice when the page had `on: click`

Found by the visual lab's equalizer, after issues 1–7, and fixed the same day.

**Reproduction.**

```css
.g { --p: state(a); --n: state(0); }
.g input { bind: --p; }                         /* three radios a, b, c */
.g button { on: click(increment(--n)); }        /* any click action on the page */
```

Focus radio `a` and press ArrowRight twice before the next frame. Focus ends on `c`, but `b` stays
checked, `--p` is `b`, and the second `change` never fires. A checkbox clicked twice in one task
also stays checked. Both engines; fine without the `on: click` rule.

**Root cause.**
- For a click on a checkbox or radio, the browser first changes the control, then dispatches
  `click`, then `input` and `change`. Arrow keys in a radio group do the same: check, then `click`.
- With an `on: click` rule, the library's click `dispatch()` (`src/state/actions.ts`) first calls
  `sync()`, which applies the urgent work of earlier events in the same frame.
- That includes the bind writes queued by the first choice. They wrote the previous state back into
  the radios and unchecked the one the browser had just checked, so the following `change` read an
  unchecked control.

**Expected behavior.** Every user choice on a bound control reaches the state, however fast. A
cancelled click leaves both the control and the state unchanged.

**Fix** (`src/state/bind.ts`):
- A capture listener on `window` marks the bound checkbox or radio the browser has just toggled for
  a click. It runs before the document listener that dispatches `on:` actions.
- While it is marked, writes to it and to its radio group (same `name`, form and root) wait.
- The mark is cleared by that control's `input`/`change`, which then reads the new choice into the
  state as usual. It is also cleared by the next frame when the click was cancelled: the browser
  then reverts the control itself, and no `change` follows. The waiting writes run in that frame.
- The control is not read at `click` time, because a cancelled click is only reverted after
  dispatch, and reading early would leave the state out of sync.

**Tests** (`prebeta.spec.ts`):
- "two radio choices in one task (what arrow keys do: check, then click) both land": fails in both
  engines without the fix.
- "two clicks on a bound checkbox in one task leave it unchecked, and the state follows": fails in
  both engines without the fix.
- "two arrow-key moves in one frame both land on the radio group": real keys. Playwright does not
  always deliver two presses inside one frame, so this one caught the bug in WebKit only; the
  one-task test is the deterministic one.
- "a cancelled click changes neither the control nor the state": guards the fix's cancel path.

**Browser results.** Chromium and WebKit: fixed.

**Compatibility risks.**
- One more capture listener (`click` on `window`) while any `bind:` exists. It does no work for
  clicks on other elements.
- While a click is being dispatched, writes to that radio group wait until its `change`, which comes
  in the same task, or until the next frame for a cancelled click.
- Size: +373 B in `reactive-css.min.js` (+404 B in the `forms` overhead).

## Related finding (unchanged, documented)

Attributes written by `attr:` or `state(…, bind(attribute))` are skipped by the element observer
(`ownedAttributes` in `src/core/elements.ts`), so reactive rules never re-match on them. This is
documented (README, Attributes) and prevents feedback loops. It is mentioned in § 6 because it rules
out an `attr:`-based gate for sources.

## Sizes

Measured with `node benchmarks/bundle-sizes.mjs --runs=7` (minified IIFE; gzip level 9, brotli
quality 11) after the final change. The site's data was re-synced (`npm --prefix site run
sync-runtime`), and the size tables in `bundle-builder-0.8.md`, `release-0.8.0.md` and
`api-examples-0.8.md` were rewritten from the report.

| Bundle | Before (B) | After (B) | Δ | gzip after | brotli after |
|---|---:|---:|---:|---:|---:|
| core | 41,876 | 41,878 | +2 | 15,535 | 14,088 |
| basic | 53,209 | 53,213 | +4 | 18,851 | 17,079 |
| forms | 71,731 | 72,139 | +408 | 24,748 | 22,140 |
| stateful-ui | 74,901 | 76,042 | +1,141 | 26,326 | 23,457 |
| dynamic | 54,543 | 54,545 | +2 | 19,838 | 17,967 |
| full (custom) | 98,605 | 100,117 | +1,512 | 34,026 | 30,081 |
| `reactive-css.min.js` | 116,319 | 117,835 | +1,516 | 39,712 | 34,927 |
| `reactive-css.compact.min.js` | 100,133 | 101,649 | +1,516 | 34,350 | 30,429 |

Per feature, minified, over its requirements: `history` (which contains `:changed()`) +979 B, `forms` (issue 8)
+404 B, `focus` +156 B, and the scheduler 2 B in `core`.

Startup on 1,000 components: 4.7 ms (core) to 6.3 ms (full), against 4.7 to 6.2 ms before. Heap
after GC: 1.68 to 2.14 MB, unchanged.

The experiments' custom bundles were rebuilt: see `experiments/README.md`.

## Test results

| Suite | Before | After |
|---|---|---|
| Library typecheck | 0 errors | 0 errors |
| Library unit (Vitest) | 102 passed | 103 passed |
| Library browser (Chromium + WebKit) | 595 passed, 5 skipped | 627 passed, 5 skipped, 0 failed (632 tests). 32 new: 16 tests × 2 engines. The 2 WebKit engine-tracking tests are expected failures (`test.fail`) and count as passed. |
| Library dist (`npm run test:dist`) | — | 3 + 4 passed |
| Experiments, 6 specs + integration, full and custom runtime (Chromium + WebKit) | 236 passed, 14 skipped | 236 passed, 14 skipped |
| Experiments + visual lab (13 specs + integration), after issue 8 | — | 518 passed, 43 skipped, 1 failed. The failure was a pointer-cost threshold (living-typography, 1× CDP), exceeded while 562 tests ran in parallel; it passes when re-run alone. |
| Site typecheck · unit · Storybook | 0 errors · 317 · 99 | 0 errors · 317 passed · 99 passed (the measured-size literals in 3 test files updated to the new measurements) |
| Site Playwright (Chromium + WebKit, production build) | 371 passed, 41 skipped | 375 passed, 41 skipped, 0 failed. Same after issue 8 (Storybook 99 passed). Visual baselines unchanged: the new size digits are under the 1% tolerance. |

## Not done

- Firefox: not run (launch failure).
- Screen readers: not tested.
- `CHANGELOG.md`: not updated. The fixes change 0.8.0's behavior, and the version decision is
  yours. Suggested entry: the four fixed items above (1, 4, 5 and the corrected `element()` docs).
- WebKit bugs (§ 2, § 3): not reported upstream from here. Each section has a no-library repro to
  file.
