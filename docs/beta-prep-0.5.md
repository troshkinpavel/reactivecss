# Reactive CSS 0.5.0: API finalization and beta preparation

Date: 2026-10-19. Local, unpublished; nothing committed or deployed. Engines: Playwright Chromium 156.0.8078.4 and WebKit 27.2 (headless). Firefox: **not verified** (Playwright's Firefox still does not start on this machine: "Could not find profile folder").

## Summary

| Feature | Previous status | New status | Tests | Notes |
|---|---|---|---|---|
| `attr()` | Native only; not usable in `state()` or actions (`set()` rejected any function) | **Experimental** expression in `state()` and `set()`; native everywhere else | `v05.test.ts` (parsing, errors, missing/empty/case, password fields), `v05.spec.ts` (owner at init, `on:` element at event time, no reset on attribute change, nested owners, missing/empty/Unicode/quotes/backslash/newline/CSS-syntax values, password field, native `attr()` untouched, strict CSP) | Always a string; `attr(name, "fallback")`; no ancestor lookup; trusted sheets only |
| `split()` | Missing | **Experimental**, only as the single argument of `pick()` | `v05.test.ts` (empty input, empty/missing/unquoted delimiter, adjacent delimiters, empty entries, whitespace, Unicode, multi-character delimiter, CSS string escapes, attr() input, wrong argument types, nesting), `v05.spec.ts` (per owner, per event, empty list, invalid use reported) | Transient list; entries trimmed, empty entries dropped; state stays scalar; no `slice()` |
| `pick()` | Stable value function in declarations | Unchanged there; also an **experimental** expression in `state()`/`set()` | as above | One type per `pick()`; empty: `set()` changes nothing, `state()` starts as `""` |
| `wave()` | Experimental (0.4) | **Removed** | `v05.test.ts` (left to the browser, registry `removed`), dist smoke (not registered) | Decision below |
| `state()` registrations | One `CSS.registerProperty` per declaration per compile (permanent) | **One per state name per page** | `v05.spec.ts`: 10 recompiles, content change, remove + reinsert, two sheets on one element, nested owners, cascade-chosen initial values, cleanup, strict CSP | Measured: 1 registration across 1,800 recompiles (0.4: 605) |
| `typed()` | Experimental | **Experimental** (unchanged) | existing `v03.spec.ts` | Documentation now lists every difference from `@property` |
| `element()` | Experimental | **Experimental** (unchanged) | existing `v04.spec.ts` (box model, resize, hidden/vertical, shared observer, cleanup, feedback loop both ways), `lifecycle.spec.ts` | Semantics re-verified after the 0.4 audit refactor |

Also fixed (found by the new tests): moved `<style>`/`<link>` elements lost their reactive rules; boolean states ignored cascade-chosen initial values.

## 1. API inventory (before the changes)

| Feature | Kind | Status in 0.4.0 | Notes from the code |
|---|---|---|---|
| `state()` | declaration-level function | stable | Literal initial values only (`parseTyped`); one generated property per declaration per compile |
| `set()`, `toggle()`, `increment()`, `decrement()`, `cycle()` | actions | stable | `set()` accepted literals, `sibling-index()`, `sibling-count()`; any other function was an error |
| `pick()` | value function | stable | Declarations only; inside `state()`/`on:` it was not evaluated (those declarations are handled before the function scan) |
| `random()` | value function | stable | Native `random()` when per-element semantics are confirmed |
| `when()` | value function | stable | Native `if()` for boolean conditions |
| `:when()`, `:changed()`, `:nth-var()`, `:just-checked`, `:just-unchecked` | selectors | stable | |
| `on:`, `bind:` | declarations | stable | Trusted stylesheets only |
| `previous()`, `direction()` | value functions | stable | |
| `typed()` | declaration-level function | experimental | Document-wide, permanent `CSS.registerProperty`, `inherits: true` |
| `element()` | value function | experimental | Shared `ResizeObserver`, border box |
| `wave()` | value function | experimental | Web Animations on a registered property |
| `attr()` | — | **not implemented** (native only) | Listed in `KEEP_NATIVE`; README listed "`attr()` values in `set()`" as proposed |
| `split()` | — | **not implemented** | Not mentioned in code or docs |

## 2. `attr()`

**Context rule.** Reactive CSS evaluates `attr()`, `pick()` and `split()` only in two positions: the initial value of `--x: state(…)` and the value of `set(--x, …)`. These declarations were already handled by the parser before the generic reactive-function scan, so no other position is affected. Everywhere else `attr()` is the browser's function. Verified in Chromium and WebKit: `content: attr(data-label)` renders `"native"`, and `--x: attr(data-x)` computes to the browser's substituted `"1"`. The unit compile output keeps `attr(data-w type(<length>), 10px)` unchanged.

**Semantics.**
- `state(attr(name))` reads the **state owner's** attribute once, when the cell is created (each owner separately). Changing the attribute later does not reset the state. The state stays writable by actions.
- `set(--x, attr(name))` reads the attribute of the **element that has the `on:` declaration**, at event time. The target state is resolved by the existing rules (nearest owner, or `closest()`).
- Value: always a string. Empty attribute: `""`. Missing: the fallback (`attr(name, "fallback")`), else `""`.
- No ancestor traversal, no selector lookup, no typed `attr(name type(…))`: these are documented as future extensions.
- Compiled CSS: a literal initial value stays the `var()` fallback (works before the script runs). An evaluated one compiles to `var(--rcss-s…)` without a fallback and is written per owner in the same task, before paint.

**Security.**
- Attribute values become one CSS string token: quotes and backslashes are escaped, and every control character is a hex escape (0.4 escaped only `\n`). Tested in Chromium and WebKit with `"; color: red; --x: "`, `}</style><script>alert(1)</script>` and newlines: the content shows the exact text, no style changed, no script element appeared. NUL, CR and form feed are covered in unit tests.
- Values are never parsed as CSS or as actions.
- `attr()` in `state()` is refused in untrusted stylesheets (`set()` already is, as part of `on:`). Literal `state()` is still allowed there.
- Password, one-time-code and payment fields are never read (the fallback is returned), with the same check as `bind:`, now shared in `src/state/expr.ts`.
- CSP: no change; tested under `style-src 'self'` with a linked sheet.

## 3. `split()`

`pick(split(text, "delimiter"))`, where `text` is a quoted string or `attr()`:

| Input | Result |
|---|---|
| `"a|b|c"`, `"|"` | `a`, `b`, `c` |
| `" a \|\| b \|"` | `a`, `b` (trimmed, empty entries dropped) |
| `"no delimiter"` | one entry |
| `""`, missing attribute, `" \| "` | empty list: `pick()` has no value; `set()` changes nothing, `state()` starts as `""` |
| `"a::b"`, `"::"` | multi-character delimiters work |
| Unicode text or delimiter (`"こんにちは→안녕→👋"`, `"→"`) | split by string, entries intact |
| `"a\"b|c"` | CSS string escapes are decoded first: `a"b`, `c` |
| delimiter `""` | compile error: must not be empty |
| delimiter missing or unquoted | compile error |
| `split(3, "|")`, `split(pick(…), "|")`, `split(split(…))` | compile error: splits a quoted string or `attr()` |
| `split()` outside `pick()`, or next to other `pick()` values | compile error |

A compile error is reported in `ReactiveCSS.diagnostics` with the stylesheet name, and the declaration is left unchanged. The delimiter has no escape inside values (documented). State remains scalar: lists exist only during evaluation. No `slice()`, list or object states.

The task's parent-attribute example (`.shuffle` reading `.greeting`'s attribute) is **not** supported, by design: it would need ancestor access. The documented examples put the list on the button, or the state on the owner.

## 4. `wave()`: removed

| | A. Remove (chosen) | B. Keep as experimental | C. Redesign later |
|---|---|---|---|
| Runtime | −1 module (registered properties, per-signature sharing, per-element animation refcount, reduced-motion listener) | all of it stays | stays until redesigned |
| Cost | none | 171–181 ms/s main-thread style per 1,000 elements (0 for composited `@keyframes translate`) | sharing on an ancestor measured −38–71 %, still main-thread, with changed semantics |
| Native coverage | `@property` + `@keyframes` on the custom property composes the same way (animation lists, `calc()`, several properties) | | |
| Semantics | — | registration permanent; one animation per distinct wave; reduced-motion midpoint | phase and visibility changes |
| Maintenance | 7 browser + 2 unit tests, a demo and 2 benchmark scenarios removed | all kept | a design doc |

No use case was found that native CSS cannot express; the convenience did not justify the cost or the API surface. The library is unpublished, so removing an experimental feature follows project policy.

**Compatibility.**
- `wave()` declarations are now left to the browser, which drops them as invalid, so motion disappears.
- The changelog and the registry entry (`status: 'removed'`, `removedIn: '0.5'`, `nativeEquivalent`) give the migration.
- Verified: no `wave` code is left in the bundles (the only match is the registry text). `functions/wave.ts` and its stale `.d.ts` were deleted, and `describe().functions` no longer lists it.

## 5. Stable `state()` property registrations

**Design.** The parser keeps one generated property name per state name for the page's lifetime (`stateVars`), instead of a new one per declaration per compile. This is safe for these reasons:
- A state cell was already one per (owner, name). Several declarations of a name on one owner shared one cell and wrote the same value to every alias. Merging the aliases changes nothing observable.
- The property is registered `inherits: false`, so nested owners (each writing its own inline value) stay isolated, as before.
- **Cleanup is reference-counted:** `detach()` removes the inline property only when no other declaration of the cell still uses it. This is the two-stylesheet case: removing one sheet no longer clears the value that the other sheet's declaration reads.
- Literal initial values remain the `var()` fallbacks of each rule, so cascade-sensitive initialization still works. It is tested with `.s.preset { --on: state(true) }` inside an outer `.s { --on: state(false) }`.
- Unrelated states have different names, hence different properties. Names never collide, because they come from a counter, not a hash.

**Pre-existing bugs found by the new tests (fixed):**
1. A `<style>` removed and re-inserted (a move) gets a new `CSSStyleSheet` from its original source. The library treated it as moved and never processed it again, so the rules were lost. The stylesheet watcher now reloads on move.
2. A boolean state's cascade-chosen initial value was ignored, because the computed `1`/`0` was parsed as a number.

**Measured** (development build, `benchmarks/audit/memory.mjs sheets`, 9 lifecycle operations × 200, 1,800 compiles in one page):

| | 0.4.0 (audit) | 0.5.0 |
|---|---|---|
| Registered `state()` properties at the end | 605 (one per compile) | **1** |
| `replaceText` heap growth over 200 recompiles | 876 B/cycle | 575 B/cycle (no Blink registrations left; the remainder is V8 noise at this run length) |
| Detached elements, library objects, counters after each operation | clean | clean |

## 6. Native-first review

| Feature | Native alternative | Kept? | Why |
|---|---|---|---|
| `attr()` in `state()`/`set()` | Native `attr()` cannot initialize or assign state, and cannot be read at event time | yes (experimental) | Moves data from HTML into state without JavaScript |
| `split()` | None in CSS | yes, only inside `pick()` | Smallest form that covers the list-in-an-attribute case; no list language |
| `pick()` expression | — | yes | Reuses the existing name and meaning |
| `wave()` | `@property` + `@keyframes` | **no** | Convenience only, measurable cost |
| `typed()` | `@property` | yes, experimental | Shorter, but permanent and always inherited; documented to prefer `@property` |
| `element()` | Container units, `anchor-size()` | yes, experimental | An element's own size has no native value |

No wrappers for `calc()`, `clamp()`, `color-mix()`, `:has()` or `if()` were added.

## 7. Experimental classification

- **`typed()`: experimental.** The documentation now states every difference from `@property` (README Limitations, registry `description`/`cleanup`):
  - always `inherits: true`;
  - the syntax is inferred;
  - the first compiled declaration wins, and another type is skipped with a warning;
  - document-wide and permanent even after its stylesheet is removed;
  - a native `@property` is kept.
  
  Promoting it is not justified, because `@property` covers it. Whether to remove it before 1.0 is a question for the beta.
- **`element()`: experimental.** Re-verified after the 0.4 audit refactor (one record per observed element). The `v04.spec.ts` tests pass in both engines: border box, physical axes in vertical writing modes, `display: none` = 0px, one shared observer released on removal, feedback loop frozen, a long transition not mistaken for a loop. The heap test confirms no per-element retention.
- **`attr()`, `split()`, expression `pick()`: experimental** (new in 0.5; to be promoted after beta feedback).

## 8. Tests

| Check | Result |
|---|---|
| TypeScript | pass |
| Unit (vitest, library directories only) | 60 / 60 |
| Distribution (Node ESM import, TypeScript consumer, minified bundle on a plain page) | pass |
| Browser, Chromium + WebKit (`npm run verify`) | 218 passed, 4 skipped (Chromium-only heap and listener tests on WebKit) |
| Of these: CSP, security, cascade, lifecycle (audit leak regressions), 0.4, 0.5 | all pass |
| Firefox | **not verified** (does not start) |
| Playground | headless check of the new demo T: initial value from the owner, set from the clicked button, shuffle; no diagnostics on the whole page |

`npm test` and `npm run test:dist` now pass `--dir`: the old path filter `tests/unit` also matched the separate website's `site/tests/unit`.

## 9. Targeted performance (production bundle, corrected harness, median of 3)

`attrsplit` scenario: n components, each owner with `state(attr(data-m))`, and a button doing `set(--m, pick(split(attr(data-o), "|")))`, 20 clicks per frame. Plain JS: copy the attribute at start, and on click set a random entry through a delegated listener (displayed with native `attr()`). `components` (literal `state()` + `toggle()` + `when()` + `:when()`) is the existing reference.

| Scenario | n | start ms | click (avg, µs) | script ms/s | style ms/s | p95 frame | heap → after cleanup (MB) |
|---|---:|---:|---:|---:|---:|---:|---|
| attrsplit, Reactive CSS | 1,000 | 6.4 | 4.3 | 9.7 | 7.2 | 16.7 | 2.06 → 1.76 (0 bindings, 0 subscriptions) |
| attrsplit, plain JS | 1,000 | 0.5 | 3.8 | 6.4 | 5.6 | 16.7 | 1.30 |
| attrsplit, Reactive CSS | 10,000 | 29.2 | 4.9 | 16.4 | 18.4 | 16.7 | 6.65 → 1.77 (0, 0) |
| attrsplit, plain JS | 10,000 | 4.8 | 3.3 | 11.8 | 14.9 | 16.8 | 1.24 |
| components (reference), Reactive CSS | 10,000 | 24.3 | 4.3 | 16.8 | 11.9 | 16.7 | 7.90 → 1.73 |

- **Start-up:** reading an attribute per owner costs about 0.5 µs per component over literal state at 10,000 (29.2 vs 24.3 ms; that includes writing each owner's value, since there is no CSS fallback).
- **Event-time evaluation** (`attr()` + `split()` + `pick()` + state change) costs 0.5–1.6 µs more per click than the hand-written listener (1,000: 4.3 vs 3.8 µs; 10,000: 4.9 vs 3.3 µs).
- **Frames and cleanup:** frame p95 is unchanged, and cleanup returns to 0 bindings and 0 subscriptions.
- **Measurement limit:** per-click p95 cannot be measured on this page, because `performance.now()` is coarsened to 100 µs.
- **Memory:** a full-feature component that now also has `state(attr())` and `set(pick(split(attr())))` stays clean over 1,000 components × 100 mount/unmount cycles: heap 2.19 → 2.26 MB, 0 detached elements, nothing above baseline.
- **Bundle:** `dist/reactive-css.min.js` is 86,105 bytes (0.4.0 after the audit: 82,384). Removing `wave()`'s code was outweighed by the expression module and the longer registry texts (descriptions, removal reason, migration), which ship in the bundle for `describe()`.

Not repeated: the 15-minute soak and the full benchmark matrix. The changes are confined to the state engine's initial value, `set()`, name allocation and the stylesheet watcher; the lifecycle, memory and cascade suites cover them.

## 10. Documentation and metadata updated

- README:
  - status;
  - functions table;
  - the new section "Expressions in `state()` and `set()`";
  - the actions table;
  - limitations (`typed()` vs `@property`, several declarations with evaluated initial values, registrations per name);
  - `wave()` removed;
  - the proposed list (ancestor attributes and typed `attr()` are future work; `slice()` and list states are not planned).
- CHANGELOG 0.5.0.
- `src/core/features.ts`:
  - kind `expression`;
  - status `removed` with `removedIn`;
  - `attr`, `pick`, `split` entries;
  - `state()`, `set()` and `typed()` metadata.
- `describe()`: version 0.5.0 and an `expressions` list. A unit test and the dist smoke test keep the registry in sync.
- Other docs:
  - `docs/compatibility.md` (0.5.0 matrix);
  - `docs/security.md` (attribute expressions);
  - historical notes in `docs/extensions-0.4.md` and `docs/api-review-0.4.md`.
- Playground: demo T (greetings) replaces the wave demo.
- Version metadata: `package.json`, `src/index.ts`, `describe()` → 0.5.0. Nothing tagged or published.

## 11. Remaining beta blockers

1. **Firefox is unverified.** Run `npm run test:firefox` on a machine where Playwright's Firefox starts.
2. **No real-browser measurements.** Only headless engines were measured; real Chrome and Safari releases, GPU raster and a mid-range phone are not.
3. **Experimental features need a decision.** Decide after beta feedback whether `attr()`, `split()` and expression `pick()` become stable. Decide whether `typed()` stays at all, since `@property` covers it.
4. ~~Known limitation of evaluated initial values~~: fixed in the beta hardening pass (`docs/beta-hardening-0.5.md`): the cascade winner initializes the state.
5. **Package name.** The npm name `reactive-css` is taken: choose one before publishing.
