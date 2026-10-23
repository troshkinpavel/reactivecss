# Reactive CSS 0.5.3: derived HTML attributes

Local build, not published. Companion report: [demo-validation-0.5.3.md](demo-validation-0.5.3.md).

## Summary

- **New, experimental:** `attr: <attribute> <value>`. It writes one allowlisted HTML attribute on the element a rule matches, from a reactive value. That value is usually state owned by an ancestor, which is what 0.5.2's owner-only `state(…, bind())` could not do.
- **Grammar:** no new grammar beyond the declaration itself. Repeated `attr:` declarations are resolved by compiling each attribute to its own property. One small extension: `when(condition)` without branches gives `true`/`false`.
- **Timing:** derived attributes are written in the same task as the action that changed the state, so a derived `disabled` stops the next click (tested with same-task clicks, rapid real clicks and Enter, also at 4× CPU throttling).
- **HTML applicability:** checked on write. `disabled`/`required` are never written where HTML gives them no meaning.
- **Validation:** 11 examples (5 updated, 6 new) and a demo lab, tested in Chromium and WebKit.

**Phase 1 gate: passed.**
- All suites pass.
- Behavior and grammar are deterministic.
- No memory regression.
- Performance cost: one forced style recalculation per event that changes a derived attribute. It is measured, bounded, and invisible in input-to-frame latency.
- Limitations are documented below.

No serious design ambiguity remained, so Phase 2 went ahead.

## 1. API decisions

### Syntax

```css
selector { attr: <attribute> <value>; }

.next   { attr: disabled when(--step >= 4); }
.toggle { attr: aria-expanded var(--open); }
.step   { attr: aria-current when(--active, "step", "false"); }
.card   { attr: data-state var(--status); }
```

- `<attribute>`: one of `aria-expanded`, `aria-pressed`, `aria-selected`, `aria-current`, `disabled`, `hidden`, `required`, `data-*` (lower case: names are case-insensitive and normalized, as HTML does).
- `<value>`: one string, number or keyword: a literal, `var(--x)`, `previous(--x)`, `direction(--x)`, `when(…)`, with `!important` allowed. Other functions (`calc()`, `attr()`, `url()`…) are compile errors. Register a property with `@property` for math and use `var()`, as for `text:`.
- `when(condition)` without branches is `true`/`false` (0.5.3; also valid elsewhere).

### Several `attr:` declarations: resolved with one property per attribute

The question: `attr: disabled var(--a); attr: aria-busy var(--b);` in one rule. In plain CSS the second declaration of the same property replaces the first, and across rules only one `attr` declaration would win per element.

| Option | Cascade | Verdict |
|---|---|---|
| One `attr` property, last one wins | One attribute per element in total | Rejected: a button could not have both `disabled` and `aria-pressed` |
| A list (`attr: disabled …, aria-busy …`) | The whole list is replaced by the winning rule (like `transition`) | Rejected: a more specific rule for one attribute would silently drop the others |
| `attr-<name>: value` properties (RFC design A) | Independent per attribute | Equivalent cascade, but a new property family to document and search |
| **`attr: <name> value`, compiled to `--rcss-attr-<name>: value` (chosen)** | **Independent per attribute** | One declaration name, reads as what it does, needs no list grammar |

The compiler rewrites the declaration *name* in place: `attr: disabled X` becomes `--rcss-attr-disabled: X`, in the same rule with the same importance. The browser's own cascade then decides each attribute separately:

- **Different attributes** in one rule or in several rules always combine.
- **The same attribute twice** follows normal CSS: specificity, then source order; `@layer`, `!important`, `@media`, `:when()` and other conditional selectors apply as for any property.
- **No winner** (no rule matches, or the winning value is a `when()` with no value): the attribute returns to what it was before the first write.

Each `--rcss-attr-<name>` is registered once per page as `syntax: '*', inherits: false`, so an `attr:` on a parent never reaches a child. Names are bounded by the stylesheets' content.

### Values (reusing the 0.5.2 semantics)

| Attribute | Accepted values | Written |
|---|---|---|
| `disabled`, `hidden`, `required` | `true`/`false`, `1`/`0`, or the same as strings | present (`""`) / **removed**; never `disabled="false"`; an existing value such as `hidden="until-found"` is kept while true |
| `aria-expanded`, `aria-pressed`, `aria-selected` | `true`/`false`, `1`/`0` | `"true"` / `"false"` (an explicit false) |
| `aria-current` | `page`, `step`, `location`, `date`, `time`, `true`, `false` (or `1`/`0`) | the token |
| `data-*` | any one value | as text: strings unquoted, numbers as CSS prints them, `""` gives an empty attribute |

- `1`/`0` are accepted because a boolean state *is* `1`/`0` in CSS (`var(--open)`); without them `attr: aria-expanded var(--open)` could not work. `"false"` is never truthy.
- A wrong value (`attr: required 2`, `aria-current: maybe`) is reported and leaves the attribute unchanged.

### Interaction with `state(…, bind(attribute))`

- **Policy:** the state binding owns its attribute. An `attr:` for the same attribute on the same element is ignored, with a diagnostic, whatever the order of creation. Other `attr:` attributes on that element are unaffected.
- **Why:** `bind()` is two-way at initialization (the markup initializes the state). Letting a derived value overwrite it would make the state and its attribute disagree.
- `state(…, bind())`, `bind:`, `text:` and `attr()` are unchanged.

## 2. Runtime

- **Compile (`parser.ts`).**
  - The name is checked against the allowlist, and the value must be present, using only the `text:` functions.
  - The edit renames the property and removes the attribute token.
  - Reactive functions in the value (`when()`, `previous()`…) become per-element bindings, as anywhere else.
  - Untrusted stylesheets refuse `attr:`.
- **Watch (`attrdecl.ts`).**
  - Every element matching a rule's selector gets one `AttrSet` job, with one slot per attribute and a count of the rules naming it.
  - Element starts or stops matching: queue / drop the slot (the last rule restores).
- **Invalidation.** A state change queues the bindings inside its owner, using the same owner-subtree lookup as `text:` (`within()`, extracted from `text.ts`). `ReactiveCSS.refresh()` queues all.
- **Read and write.**
  - `compute()` makes one `getComputedStyle()` per element and reads each `--rcss-attr-*`.
  - `write()` then applies the changes with `toggleAttribute()`/`setAttribute()`/`removeAttribute()`.
- **Timing (`scheduler.ts`).** Event-driven work runs inside `urgently()` (actions, bound controls, form reset). When it queued a derived attribute, the end of that work, still in the same task:
  1. applies the pending state CSS (`sync()`: cells, `when()` values, `:when()`/`:nth-var()` markers);
  2. runs the late phase (one style read for all queued `attr:`/`text:` jobs, then their writes);
  3. **if that wrote anything, reads once more**: a written attribute can change what applies to another binding (an ancestor's `hidden`, attribute selectors), and WebKit can return a stale value for an element under `display: none` (see section 5);
  4. queues the same jobs again for the frame (writes happen only on change).

  Other triggers (an element starting to match, `refresh()`) use the frame's late phase. `stats()` counts the same-task runs (`prompt`).
- **Ownership.**
  - The original value is saved before the first write.
  - Before every write, the attribute must still hold what was written last. Otherwise the binding **yields** (diagnostic): no more writes, no restore.
  - Restoring happens only if the attribute still holds our value.
  - `ownedAttributes` now maps attribute → writer, so `attr:` and `bind()` can tell each other apart. Changes to owned attributes never re-match reactive rules (no loops).
- **Lifecycle.** A disposed binding restores and is marked dead, so a queued job does nothing (no stale writes after removal). Recompiling or removing a sheet disposes its watchers. Reinsertion starts from the original markup.

## 3. Element/attribute compatibility (two layers)

1. **Compile time:**
   - the attribute name against the allowlist (handlers, URLs, `style`, `class`, `id`, `role` and free-text ARIA are rejected);
   - the value's functions;
   - trust.
2. **Runtime,** once per write that would *set* the attribute (removing never hurts), not per update:

| Attribute | Applies to | Otherwise |
|---|---|---|
| `disabled` | `button`, `input`, `select`, `textarea`, `option`, `optgroup`, `fieldset` (by interface, not tag name), form-associated custom elements (`static formAssociated = true`) | skipped, one warning per element type |
| `disabled` on a custom element not defined yet | written once it is defined and form-associated (`customElements.whenDefined`, held by a `WeakRef`) | skipped until then |
| `required` | `select`, `textarea`, `input` except `hidden`, `range`, `color`, `submit`, `reset`, `image`, `button` (checked on each write, so a later `type` change is honored) | skipped, warning |
| `hidden` | HTML elements | skipped on SVG/MathML, warning |
| `data-*` | any element | — |
| `aria-pressed` | `<button>`, `<summary>`, `input[type=button]`, or `role="button"` | **written**, warning (obvious misuse) |
| `aria-selected` | roles `option`, `tab`, `row`, `gridcell`, `columnheader`, `rowheader`, `treeitem`, or native `option`/`tr`/`td`/`th` | **written**, warning |

- Warnings are deduplicated by message, and the messages name the element *type* (`<a>`, `<input[type=range]>`). So 1,000 links give one warning, not 1,000.
- Nothing pretends to disable an element that HTML cannot disable.
- ARIA is not validated beyond values and these two obvious cases. **Writing an attribute does not make a component accessible** (README, Accessibility).
- `state(…, bind(disabled))` keeps its 0.5.2 behavior (it writes, and warns on a non-control) so as not to change an existing API.

## 4. Security

- Trusted stylesheets only.
- Values are text, set with `setAttribute()`; no `innerHTML`. A value like `"<img src=x onerror=alert(1)>"` stays a string, and no children are created.
- Unsafe or unknown names are compile errors. `attr()` and `url()` in the value are compile errors.
- No loops: owned attributes do not re-match watchers. Self-referencing attribute selectors are read at most twice per event plus once per frame, and a page `MutationObserver` sees a bounded, finite number of records (tested).
- No stale writes after removal (dead flag); no fights (yield on external writes; `bind()` wins).
- Strict CSP (`style-src 'self'`): works; it uses only CSSOM.

## 5. Bugs found and fixed

1. **WebKit stale computed values (found by the quiz and form-validation examples).** In WebKit 27.2 (Playwright), a `getComputedStyle()` read in the same task can return the *previous* value for an element under a `display: none` ancestor, even right after its own inline custom property changed. It happened on the quiz page (options in hidden cards; `:has()` rules present) and with a field inside a wrapper un-hidden in the same pass. A minimal page did not reproduce it. A listener running right after ours already reads the fresh value. **Fix:** a second same-task read when the first wrote anything, plus a frame re-read. The quiz and form tests pass 20/20 in WebKit after the fix (5/8 failed before).
2. **Wizard Finish.** Replacing the 0.5.1 clamp rules with derived `disabled` would have let a script click the hidden Finish button outside step 4 (display: none does not stop `el.click()`). Finish is now derived-disabled outside step 4.
3. **Boolean states are `1`/`0` in CSS.** The first implementation accepted only `true`/`false`, so `attr: aria-expanded var(--open)` was rejected. Now accepted for the true/false attributes (not for `data-*`, which shows `1`).

## 6. Tests

| Suite | Result |
|---|---|
| Unit (`npm test`) | 72 passed (5 new: compile output, rejections, `when(condition)`, registry) |
| Browser, Chromium + WebKit | 411 passed, 5 skipped (Chromium-only heap tests in WebKit) |
| Browser, Chromium at 4× CPU | 208 (every Chromium test, examples included) passed |
| Distribution (`test:dist`) | passed: ESM import and type declarations (2 unit tests, `tsc`), minified and compact bundles on plain pages in Chromium and WebKit (4) |
| Firefox | **unverified**: Playwright's Firefox does not start here ("Could not find profile folder") |

New: `v053.spec.ts` (22 tests: acceptance, timing, grammar and cascade, ownership, compatibility, lifecycle, security) and 7 example tests plus the lab test in `examples.spec.ts`.

Coverage of the request's list:
- ancestor state → descendant attributes; ARIA, boolean, data;
- same-task repeated clicks; rapid real clicks; keyboard;
- cascade conflicts; state ownership; attribute ownership;
- MutationObserver recursion; recompilation; mount/unmount;
- strict CSP; malicious values; 1,000-row DOM; CPU ×4.

The heap mount/unmount test now includes `attr:` declarations.

## 7. Performance

Production bundle, Chromium 156, medians.

**Per click** (`benchmarks/run.mjs`, 20 clicks per frame, 5 runs; results in `benchmarks/audit/results/v053/`):

| Workload | n | Reactive CSS: click · script · style | Plain JS: click · script · style |
|---|---:|---:|---:|
| Ancestor state, `attr: disabled` on a sibling button (final build) | 1,000 | 32.0 µs · 32.1 ms/s · 11.7 ms/s | 4.0 µs · 7.1 ms/s · 4.4 ms/s |
| | 10,000 | 29.3 µs · 38.7 ms/s · 11.9 ms/s | 3.2 µs · 15.2 ms/s · 20.0 ms/s |
| same, first run (before the second same-task pass) | 1,000 | 28.0 µs · 15.0 ms/s · 22.4 ms/s | 3.5 µs |
| | 10,000 | 95.4 µs · 25.0 ms/s · 99.7 ms/s | 3.4 µs |
| 0.5.2 `state(…, bind(aria-pressed))` on the clicked button (reference) | 1,000 / 10,000 | 13.5 / 12.2 µs | 7.6 / 5.0 µs |

At 10,000 elements the two runs differ by 3× (29 vs 95 µs). The forced recalculation's cost depends on what else is dirty in the tree, so treat **30–95 µs per click** as the range. Frame p95 was 16.7–16.8 ms in every row: no dropped frames.

- The cost of `attr:` is the **forced style recalculation** in the click's task: the price of "disabled before the next click". It grows with document size, since style is recalculated for what changed, in a larger tree.
- At 20 clicks per frame (1,200 clicks/s, far beyond human input) that is the style time above. At human rates it is well under 1 ms per click.
- Events that change no derived attribute pay nothing: no job is queued.

**Input to correct frame** (`benchmarks/audit/runtime.mjs latency`, real mouse clicks, 100 widgets, 40 samples):

| Widget | Reactive CSS p50 / p95 | Plain JS p50 / p95 |
|---|---:|---:|
| Derived `disabled` (ancestor state → sibling button), idle | 13.9 / 16.1 ms | 13.8 / 15.8 ms |
| same, under background load | 12.7 / 19.9 ms | 12.8 / 18.3 ms |
| 0.5.2 bound `aria-pressed`, idle | 14.0 / 14.6 ms | 13.8 / 14.6 ms |

No incorrect frames.

**Startup and memory:**
- An element with `attr:` costs one `AttrSet` (one Map), about the same as a `text:` binding.
- Mount/unmount: 1,000 components using every feature (now including `attr:` on an input and an `<i>`) × 150 cycles (`memory.mjs mount`, Chromium): **clean**. 0 detached elements, 0 bindings left, listeners stable at 19, heap 2.34 → 2.74 MB (4.3 KB/cycle, within noise, no steady growth). 0.5.2 was also clean on the same scenario.
- Per example: [demo-validation-0.5.3.md](demo-validation-0.5.3.md).

**Bundle sizes** (bytes):

| Bundle | Minified | Gzip | Brotli |
|---|---:|---:|---:|
| `reactive-css.min.js` 0.5.2 | 97,431 | 33,251 | 29,447 |
| `reactive-css.min.js` 0.5.3 | 105,753 | 35,660 | 31,572 |
| `reactive-css.compact.min.js` 0.5.2 | 84,757 | 28,990 | 25,930 |
| `reactive-css.compact.min.js` 0.5.3 | 91,712 | 31,028 | 27,699 |

`attrdecl.ts` is 5.7 KB minified, mostly diagnostic text. `describe()` and `dist/features.json` list `attr` as an experimental declaration since 0.5.3; the compact registry keeps name, kind, status, since and syntax.

## 8. Known limitations

- **Re-read triggers.** Derived attributes are re-read on state changes in an owner, on match changes and on `refresh()`. A cascade change from anything else (`:hover`, a class toggled by script, a media query, `:invalid` while typing) shows on the next of these. Validation-dependent `disabled` therefore needs a state (the wizard keeps its `on:` gate).
- **Focus.** A focused control that becomes `disabled` loses focus to the page. CSS cannot move focus (`rfc-focus-management.md`).
- **Allowlist only.** No `inert`, `aria-disabled`, `aria-checked`, `aria-invalid`, `tabindex`, `role`. Each needs its own review. In particular `aria-disabled`, often the better choice for focusable buttons, is not available yet.
- **Attribute selectors on written attributes** do not create or remove bindings (no re-matching), and they are re-read at most twice per event. Contradictory rules settle without looping but can flip a few times.
- **One forced style recalculation per event** that changes a derived attribute (section 7).
- **WebKit stale reads** are worked around (section 5), not understood. If an element stays under `display: none`, its attribute may be correct only from the next frame in WebKit.
- **Firefox unverified.**

## 9. Beta blockers

1. **Firefox verification** (environment: run `npm run test:firefox` where Playwright's Firefox starts).
2. **Screen-reader testing** of the examples that rely on `aria-*`, `disabled` and live regions (not done; no claims made).
3. **A decision on `aria-disabled`** (RFC open question 1): several examples would prefer focusable disabled buttons.
4. **The WebKit stale-read behavior** should be reduced to a minimal case and checked against Safari releases. The workaround costs one extra read per event that writes an attribute.

Not blockers, but recommended: focus management (`rfc-focus-management.md`) and event control (`rfc-event-control.md`), both still proposals.
