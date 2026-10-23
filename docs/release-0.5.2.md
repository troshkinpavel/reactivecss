# Reactive CSS 0.5.2: reactive HTML attribute binding

Date: 2026-10-19. Local only: no Git, no publishing or tagging, the Astro site untouched. Engines: Playwright Chromium 156.0.8078.4 and WebKit 27.2 (headless). Firefox: **unverified** (Playwright's Firefox still does not start: "Could not find profile folder").

```css
.menu { --open: state(false, bind(aria-expanded)); on: click(toggle(--open)); }
```

The real `aria-expanded` attribute of the button follows the state (tested with mouse and keyboard, in the DOM and in the accessibility snapshot).

## Implementation in one paragraph

- **Parser.** `state()` takes an optional second argument `bind(name)`. The parser checks the name against an allowlist and the initial value's type at compile time; errors leave the declaration unchanged with a diagnostic.
- **Binding.** The state cell gets an `AttrBinding` from the declaration that wins the cascade (the 0.5 cascade-marker mechanism; no new cascade code). It captures the original attribute, initializes the state from it once, writes the attribute on every state change, and restores it on cleanup when it still holds what was written.
- **Loops.** Bound attributes are registered as owned, and the element manager ignores their mutations.
- **Code.** New module `src/state/bindattr.ts`; hooks in `state.ts` (create, change, re-initialize, dispose), `parser.ts` and `elements.ts`.

## Initialization semantics (exact)

1. The **owner** is the element the winning `state()` declaration matches. `bind()` never touches any other element.
2. The attribute value read is the one **before Reactive CSS wrote anything**. A later winning declaration with the same attribute sees the original too.
3. **Present and valid:** it initializes the state.
   - boolean HTML attributes: presence is `true`, whatever the value;
   - ARIA booleans: `"true"`/`"false"`;
   - `aria-current`: `"true"`/`"false"` for a boolean state, a token for a token state;
   - `data-*`: parsed by the state's declared type.
4. **Missing:** the `state()` initial value (for boolean HTML attributes, absence also means "use the initial value"; `state(true, bind(required))` adds `required`).
5. **Invalid:** a diagnostic names the element and value, and the `state()` initial value is used. Invalid means:
   - `aria-expanded="maybe"`;
   - `"mixed"` for `aria-pressed` (only boolean states are supported);
   - `data-n="12px"` for a number;
   - a `data-*` value that is not an identifier, for a keyword state.
6. The effective value is **written back immediately**: the DOM and the state agree from the start (an invalid attribute is overwritten).
7. `state(attr(x), bind(y))`: `attr()` provides the fallback; the bound attribute wins when valid. Without `bind()`, `attr()` is still an initializer only (tested).

## Supported attributes and serialization

| Attribute | State type | Written |
|---|---|---|
| `aria-expanded`, `aria-pressed`, `aria-selected` | boolean | `"true"`/`"false"` (false is explicit, never removed) |
| `aria-current` | boolean, or a token state (`page`, `step`, `location`, `date`, `time`) | `"true"`/`"false"` or the token; a value outside the list is not written (diagnostic) |
| `disabled`, `hidden`, `required` | boolean | `true`: present (`""`, or the existing value is kept: `hidden="until-found"` stays); `false`: **removed**. Never `disabled="false"` (tested). |
| `data-*` (lower-case `[a-z0-9_.-]`) | string, number, dimension, boolean, keyword | the value as text: `"loading"`, `"3"`, `"-2.5"`, `"24px"`, `"true"`/`"false"`, `"dark"` |

Native behavior audited and reported:
- `disabled` only affects form controls (button, input, select, textarea, fieldset, optgroup, option). Elsewhere the attribute is set but does nothing, with a diagnostic.
- `required` only affects input, select and textarea, with a diagnostic.
- Disabling a focused button moves focus to `<body>` (browser behavior; the RFC discusses `aria-disabled`).

## State → attribute timing

**Synchronous.** The attribute is written inside `Cell.set()`, during the action, only when its text changes.
- A `disabled` set by a click is in the DOM before the next event is dispatched, so the **browser itself** refuses further clicks. Tested: three synchronous `click()` calls on a "submit once" button run the action once.
- CSS custom properties and `text:` still update in the frame. The attribute is the one output that is immediate.
- **What cannot be guaranteed:** an attribute cannot affect the event that changed it. A `disabled` set during a click does not stop that click's own default action (e.g. a form submission started by a submit button). That needs `prevent()` (`docs/rfc-event-control.md`, not implemented).

## External mutations

- Changes made by other scripts after initialization are **not read back** and are not state changes (tested: the state stays as it was).
- The next state change overwrites the attribute; a diagnostic says so once per element.
- At cleanup, an attribute that no longer holds what Reactive CSS wrote is **left alone**: the other code owns it.
- **Two-way sync was not implemented.** It would need a `MutationObserver` per bound attribute, a rule for conflicting writers (who wins in a frame), and loop protection on both sides. Recommended future policy: an explicit `bind(aria-expanded, two-way)` that treats an external change as a `set()` (subject to the same validation), and never re-reads attributes written by Reactive CSS itself.

## Cascade precedence

- The winning `state()` declaration (specificity, stylesheet order, layers, media, `!important`; tested) chooses the attribute.
- Example: `.button { --open: state(false, bind(aria-expanded)) }` and `.dialog .button { --open: state(true, bind(data-open)) }`. A button in the dialog binds `data-open="true"` and leaves `aria-expanded` untouched.
- **A later winner** (a stylesheet loaded later) can switch the binding only **before the state has changed**: the old attribute is restored, and the new one is read and written. After a change, the binding stays.
- One state is bound to at most one attribute at a time.

**Pre-existing bug found and fixed.** A `@layer a, b;` statement after the first rule of a reactive stylesheet was dropped when the sheet was rewritten, so the layer order fell back to first appearance. Both the new cascade test and a new `cascade.spec.ts` test fail with the old code.

## Lifecycle and cleanup

| Event | Attribute |
|---|---|
| Owner removed | restored to the original (or removed if absent), if unchanged by others; the element leaves with its markup state |
| Owner reinserted | a new state, initialized from the (restored) original markup, consistent with "reinsertion starts a new state" |
| Rule stops matching, stylesheet removed or recompiled | restored as above; a recompiled sheet starts the state again from the markup (the existing rule that a sheet's own recompile resets its states) |
| Another sheet's declaration stays | the state survives; its binding stays as initialized |
| Nested owners, dynamic insertion, many components | each owner binds its own attribute (tested) |

Memory: a full-feature component, now also with `bind(aria-pressed)` and `bind(data-status)`, at 1,000 components × 150 mount/unmount cycles: 0 detached elements, no library class above baseline. The heap was at 2.49–2.52 MB from cycle 5 to 150, except two transient checkpoints (3.00 and 7.33 MB) that were gone by the next checkpoint. The heap-snapshot lifecycle test includes bound states.

## Security boundaries

- **Trusted stylesheets only.** `bind()` in an untrusted sheet (cross-origin, or inline with `trustInlineStyles: false`) is a compile error (tested).
- **Allowlist.** Never event handlers (`onclick`), URL-bearing attributes (`href`, `src`, `action`, `formaction`, `xlink:href`), `style`, `class`, `id`, `role`, `value`, `checked`, free-text ARIA (`aria-label`) or `aria-hidden` (unit-tested list).
- **Values.** Set with `setAttribute()`/`toggleAttribute()` as text, never parsed. Tested: a `"><img src=x onerror=…>` value stays attribute text; no element is created, no dialog opens.
- **Values entering CSS.** A keyword state initialized from a `data-*` attribute must be an identifier: `data-k="url(https://…)"` is rejected (tested), so an attribute cannot inject `url()` or `;` into a custom property.
- **No loops.** Mutations of bound attributes never re-match reactive rules. A selector that depends on the bound attribute itself (`.m[aria-expanded] { --open: state(…, bind(aria-expanded)) }`) ran 5 toggles with exactly 5 state changes and one state (tested).
- **CSP.** No change: attributes are DOM writes, not style injection (tested with `text:` and `bind:` under `style-src 'self'`).
- **Owner only:** no selector, no lookup, no attribute on another element.

## Performance and bundle size

Production bundle, corrected harness, median of 3 runs (clicks: about 3,600 per run; per-click p95 is not measurable with the page's 100 µs timer resolution).

| Measurement | Result |
|---|---|
| Startup, 1,000 / 10,000 owners, bound vs unbound state | +10.5 / +30.1 ms vs +9.4 / +22.3 ms main-thread task: binding costs **≈ 0.8 µs per owner** (attribute read and write) |
| Click: toggle bound to `aria-pressed` (state + attribute write), 20 per frame | 1k: 11.7–13.7 µs · 10k: 8.0–9.1 µs |
| Same state unbound (`:when()` styling) | 1k: 4.9–12.3 µs · 10k: 6.0–12.8 µs: the binding's cost is inside this run-to-run spread |
| Plain JS flipping `aria-pressed` | 1k: 5.8–8.3 µs · 10k: 3.3–4.8 µs |
| Style recalculation (ms/s) | bound 13.2 / 10.6 vs unbound 10.1 / 12.2 vs plain 5.9 / 8.4 (1k / 10k) |
| Input latency (real input → attribute and its native style correct), 40 inputs × 100 widgets | idle p50 14.3 vs 14.3 ms (plain JS); busy p50 12.2 vs 11.7 ms, p95 20.5 vs 17.6; 0 incorrect |
| Idle CPU, 1,000 bound buttons | 0 library flushes, ticks, jobs, script and style recalcs |
| Existing scenarios (components, 10,000) | click 5.5–5.6 µs (0.5.1: 5.4–5.6), unchanged |

**Style work.**
- Writes are skipped when the attribute text is unchanged.
- A write invalidates styles that use the attribute (e.g. `[aria-pressed="true"]`). It is recalculated once in the frame, not forced, except when a conditional `on:` rule is resolved at the next event, as before.
- No unnecessary recalculations were found; no optimization was justified by the numbers.

**Bundle size:**

| File | 0.5.1 | 0.5.2 | gzip | brotli |
|---|---:|---:|---:|---:|
| `dist/reactive-css.min.js` | 92,037 B | **97,431 B** (+5,394) | 33,251 B (+1,828) | 29,447 B (+1,496) |
| `dist/reactive-css.compact.min.js` | 80,092 B | **84,757 B** (+4,665) | 28,990 B (+1,527) | 25,930 B (+1,248) |

The new module `state/bindattr.ts` is 3,897 B minified, mostly diagnostic messages. The rest comes from the parser and state hooks, and the longer `state()` registry entry.

## Accessibility improvements

- **New example `examples/accessible-toggle`:** a toggle with `aria-pressed` and a disclosure with `aria-expanded`. The initial state comes from the markup, the attributes change with mouse, Enter and Space, and the accessibility snapshot shows `[pressed]` and `[expanded]` (tested in Chromium and WebKit, strict CSP).
- **Live form preview:** the accent is mirrored to `data-accent`, so plain attribute selectors replace two `:when()` rules.
- **Not applied, by ownership** (`bind()` writes only the owner's attribute, and an action reaches only the clicked element and its ancestors). Each case is documented in its example README:
  - **Wizard:** `aria-current` belongs on each step `<li>`, but the step state is one state on the wizard.
  - **Configurator:** `disabled` on +/−. The − button must re-enable +, and a form-owned state would bind the form's attribute.
  - **Quiz:** `aria-pressed` on options. "Try again" cannot reset option-owned states.
  
  These need a *derived* attribute (`docs/rfc-attribute-binding.md`, the `attr-*` design), which is not implemented.

**No claim of accessibility compliance:** nothing was tested with a real screen reader.

## Tests

| Check | Result |
|---|---|
| TypeScript strict | pass |
| Unit (vitest) | 67 / 67 (new: allowlist, rejected names, type checks, compile output, trust) |
| Distribution (ESM, TypeScript consumer, `features.json`, both bundles on a plain page in both engines) | pass |
| Browser, Chromium + WebKit (`npm run verify`) | **353 passed**, 5 skipped (Chromium-only heap/listener/raw-input tests on WebKit) |
| New: `v052.spec.ts` (18 tests × 2 engines), the toggle example, the layer-order regression | pass |
| Whole Chromium suite with the CPU throttled 4× | 179 / 179 |
| Memory, 1,000 × 150 cycles with bound states | clean |
| Firefox | **unverified** |

## Remaining limitations

1. **Owner-only binding:** the most needed accessibility attributes (`aria-current` on steps, `disabled` on sibling buttons, pressed options) belong to elements that do not own the state. That needs a derived-attribute design.
2. **No two-way sync:** external attribute changes are not read back.
3. **No `"mixed"`** for `aria-pressed` (boolean states only).
4. **The triggering event is not blocked:** an attribute cannot affect the event that changes it (no `prevent()`).
5. **Recompile resets bound states:** recompiling a stylesheet resets its bound states to the markup (the existing rule), which may surprise during development hot reload.
6. Firefox, real browsers and screen readers are unverified. Experimental status for `bind()`, `text:` and the 0.5 expressions still needs a promotion decision.
