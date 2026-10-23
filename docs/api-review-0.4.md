# API review (0.4)

> Historical record of the 0.4 decisions. 0.5 changes: `wave()` was removed, and `attr()`, `pick()` and `split()` became expressions in `state()` and `set()`. See `docs/beta-prep-0.5.md`.

A review of the public API shipped through 0.3.1, and the decisions for 0.4. Nothing was renamed or removed in 0.4: no stable syntax changed. The machine-readable source of truth is the feature registry (`src/core/features.ts`, `ReactiveCSS.describe()`).

## Feature selection policy

| Category | Rule | In this project |
|---|---|---|
| **Keep native** | Never reimplemented or reinterpreted | `calc()`, `min()`/`max()`/`clamp()`, `round()`, `mod()`, `rem()`, `pow()`, `sqrt()`, `hypot()`, trigonometry, `log()`/`exp()`, `progress()`, color functions incl. `color-mix()`, `var()`, `attr()`, `if()`, `:has()`/`:not()`/`:is()`/`:where()`, `sibling-index()`/`sibling-count()`, `anchor()`/`anchor-size()`, `linear()` easing, `@media`/`@supports`/`@layer`/`@scope`/`@container`/`@property`, `element(#id)`, `toggle()` (CSS Values 5 value function), nesting, scroll-driven animations, `popover`, `<details>`, `<dialog>` |
| **Simplify** | Optional shorter syntax; equivalent where equivalence is claimed | `when()` (→ native `if()` when provably equivalent), `viewport()` (→ `dvw`/`dvh`), `typed()` (→ registration) |
| **Extend** | Capabilities CSS lacks | state, actions, `bind:`, history, stateful selectors, reactive sources, `element()`, `wave()` |
| **Evaluate** | Not built without a concrete case and a native gap | gestures, physics, scripting, network, storage, DOM mutation |

## Inventory (shipped)

| Group | Features | Status |
|---|---|---|
| Values | `random()`, `pick()`, `live()`, `on()`, `mouse()`, `viewport()`, `visible()` | stable |
| Values (0.4) | `element(width\|height)`, `wave()` | experimental |
| State | `state()`, `when()`, `previous()`, `direction()` | stable |
| Typed | `typed()` | experimental |
| Selectors | `:just-checked`, `:just-unchecked`, `:nth-var()`, `:when()`, `:changed()` | stable |
| Declarations | `on:`, `bind:` | stable |
| Triggers (in `on:`) | `click`, `change`, `input`, `pointerenter`, `pointerleave`, `focus`, `blur`, `key()`, `outside()` | stable |
| Actions (in `on:`) | `set()`, `toggle()`, `increment()`, `decrement()`, `cycle()`, optional `closest()` scope | stable |

## Naming and grammar review

| Item | Finding | Decision |
|---|---|---|
| `on()` value function vs `on:` declaration | Same word, different jobs: `on(event, expr)` re-evaluates a *value*; `on:` runs *actions*. Each is unambiguous in its context, and both are documented side by side. | Keep. Renaming `on()` would break 0.1 syntax for little gain. |
| `toggle()` action vs CSS Values 5 `toggle()` | The standard is a value function (`font-style: toggle(italic, normal)`). Ours exists only inside `on:` and is never registered as a value function, so the parser cannot intercept the standard one. | Keep, context-separated. Never register `toggle` as a value function. |
| `cycle()` action vs a value `cycle()` | A value form would collide with the action name and duplicate `@keyframes` with `steps()`. | Rejected the value form. |
| `random()` vs CSS Values 5 `random()` | Already aligned: same argument order, `by` step, per-element default. Delegated to native when the engine's semantics match (probe). | Keep. |
| `when()` vs `if()` | `when()` is a state-aware simplification. Boolean conditions compile to native `if()`. | Keep. |
| **`element()` vs CSS Images 4 `element(#id)`** | **Conflict.** `element()` is a specified image function (Firefox ships `-moz-element()`). | Use context-aware claiming: only `element(width)`/`element(height)` belong to Reactive CSS (`matches()` hook). `element(#id)` is left to the browser silently. If a spec ever gives `element()` keyword arguments, rename ours; it is experimental for that reason too. |
| `wave()` | No standard function with this name. | Keep. |
| `state()` vs `:state()` | Different contexts: a value function vs a pseudo-class (custom element states). | Keep. |
| Parameter order | Range functions use `(min, max, …)` everywhere (`random`, `wave`). Actions put the target first (`set(--x, value)`) and the scope last (`closest()`). | Consistent. |
| Defaults | `live()` 1s, `visible()` 0, `mouse()` viewport, `increment()` 1. | Documented in the registry. |
| Error handling | Every compile error leaves the declaration unchanged and names the stylesheet, construct and fix. Runtime unknowns ("missing state", type errors) give no value, never a guess. | Keep. |

## Simplification check

The canonical example stays three declarations, and nothing more is needed:

```css
.card { --active: state(false); on: click(toggle(--active)); opacity: when(--active, 1, 0.5); }
```

No shorthand was added: a combined "state + toggle" declaration would save one line, but it would hide the state name that conditions need.

## 0.4 proposals: accepted and rejected

| Proposal | Decision | Reason |
|---|---|---|
| `element(width\|height)` | **Accepted** (experimental) | CSS has no way to read an element's *own* size into a value. Container units measure a container for its descendants, and `anchor-size()` measures an anchor. |
| `element(selector, width)` | Deferred | `anchor-size()` and container units cover the common cross-element cases natively. A scoped, nearest-owner lookup needs its own design. |
| `wave()` | **Accepted** (experimental) | Expressing a sine oscillation on one value (inside `calc()`, on any property, beside the author's animations) takes a registered property plus keyframes plus an animation. `wave()` is one function, and the browser still interpolates. |
| `map()` | Rejected | Native `progress()` (clamped, reversed ranges included) does it in Chromium and WebKit: `calc(outMin + (outMax - outMin) * progress(v, inMin, inMax))`. |
| `distance()` | Rejected | Native `hypot()`. |
| `spring()` | Planned (evaluate) | A duration does not define a spring. Following a continuously changing source needs per-frame physics in JavaScript. For discrete changes, a `transition` with a `linear()` spring curve works natively. |
| value `cycle()` | Rejected | `@keyframes` + `steps()`; name collision with the action. |
| `smooth()` | Rejected | A `transition` on the consuming property. |
| `throttle()`, `debounce()` | Planned (evaluate) | No concrete UI case found that frame-coalesced sources plus transitions do not cover. |

## Deprecations

None. Nothing in 0.3.1 met the bar for a breaking change.
