# Reactive CSS 0.3: API design

Decisions made before implementation. User-facing reference: [README](../README.md). State engine internals: [state-engine.md](state-engine.md).

## Feature selection policy

Every construct is classified before it is added. The classification is stored in the machine-readable registry (`src/core/features.ts`, exposed as `ReactiveCSS.describe()`).

| Category | Rule | In 0.3 |
|---|---|---|
| **Keep native** | Never duplicated or reinterpreted: math (`calc()`, `round()`, `mod()`...), colors (`oklch()`, `color-mix()`, `light-dark()`...), selectors (`:has()`, `:nth-child()`, `:checked`...), `var()`, `attr()`, `sibling-index()`, `@media`, `@layer`, `@scope`, nesting, scroll-driven animations. | Untouched. Reactive CSS has no math engine. |
| **Simplify** | Optional shorter syntax for a native feature, with equivalent behavior where equivalence is claimed. | `when()` (compiles to native `if()` where provably equivalent), `typed()` (a native property registration, experimental) |
| **Extend** | Capabilities CSS does not have. | `state()`, actions, `bind:`, `previous()`, `direction()`, `:changed()`, `key()`, `outside()`, `cycle()`, `closest()`, `:nth-var()`... |
| **Evaluate (not built)** | Duplicates the platform or needs broad permissions. | Drag and drop, physics, routing, storage, network, clipboard, DOM mutation actions, animation DSLs. |

Core rule: reduce the JavaScript developers write, not increase the functions they must learn.

## 1. State history

- `previous(--x)` is the value before the last *effective* change. On creation it equals the initial value. A no-op assignment (typed equality: same type, same value, same unit; strings case-sensitive, keywords and colors case-insensitive) changes nothing, including history. It reuses `Cell.previous`, so no separate history engine and no unbounded history exist.
- `direction(--x)` is `1`, `0` or `-1` (current compared with previous) for number and dimension states. For other types it is *unknown* (with a warning), never a guess.
- Both work as condition operands (`:when(--n > previous(--n))`, `when(direction(--n) < 0, …)`) and as value functions (`--last: previous(--n)`). A consumer of either subscribes to the cell like any other consumer, so history needs no opt-in.
- These functions work only for `state()` values. For other custom properties they are *unknown*, with a warning.

## 2. `:changed(--x)`

- The trigger is the cell's version counter. A consumer remembers the version it last saw, so nothing matches on load or after a no-op.
- On a change, a private marker attribute is set in the next frame.
- It stays until every CSS animation and transition that started in the element's subtree after the marker was set has finished. This uses the animations' `finished` promises, and a cancelled animation counts as finished. When no animation or transition started, it is removed one frame later. There are no fixed timers.
- A change while the marker is set removes it and sets it again one frame later, so animations restart.
- Removal of the element or of the state cell clears it.
- `:just-checked` / `:just-unchecked` are unchanged (persistent direction markers). They describe a form control, `:changed()` describes a state.

## 3. `bind: --x`

- `bind:` is a declaration on a form control. It connects the control two-way with the nearest `--x` state, or with the owner given by `closest()`: `bind: --x closest(.form)`.
- It must be in an unconditional rule (no `@media`/`:hover`), because the binding exists for as long as the element matches. When two `bind:` rules match one control, the first one wins and a warning is logged.

| Control | Property | State type | Event |
|---|---|---|---|
| text, search, email, url, tel, password, `<textarea>` | `.value` | string `state("")` | `input` (not while an IME composition is in progress; then on `compositionend`) |
| number, range | `.valueAsNumber` | number (or a dimension: the number in the state's unit) | `input`. An empty or invalid field leaves the state unchanged. |
| checkbox | `.checked` | boolean | `change` |
| radio | checked when `state == radio.value` | string or keyword (number allowed) | `change` |
| single `<select>` | `.value` | string or keyword (number allowed) | `change` |

- **Initial value:** state first, so the control shows the CSS initial value. The exception is a control whose current value already differs from its HTML default (`defaultValue`, `defaultChecked`, `defaultSelected`), for example from autofill or a restored form. Then the control wins and sets the state. Autofill that arrives later fires `input`/`change` and is taken like typing.
- **State → control:** a control is written only when it does not already show the state. Typing therefore never rewrites the field and the caret stays put. A programmatic change to a focused text field keeps its selection, clamped to the new length.
- **Form reset** restores the CSS initial value (the state's initial value), consistent with state-first.
- Multiple-select, file, date/time and color inputs are not supported in 0.3 (a diagnostic is logged).
- Password, one-time-code and payment fields (`autocomplete` `current-password`, `new-password`, `one-time-code`, `cc-*`, `webauthn`) are refused (0.3.1): CSS must never see their live value.

## 4. Actions

- `key(Key, action, …)` handles `keydown` while focus is on or inside the element carrying the `on:`. When nothing is focused (the target is `<body>`; Safari does not focus buttons on click), the element last pressed with the pointer stands in for focus. It matches `event.key` case-insensitively. Modifiers are written `ctrl+k`, `shift+Tab`, `alt+…`, `meta+…`; all listed modifiers are required and unlisted ones must not be pressed. Printable single-character keys without `ctrl`/`alt`/`meta` do not fire while the focus is in an editable field. Reactive CSS never calls `preventDefault()`.
- `outside(event, action, …)` runs when `click`, `pointerdown` or `focusin` happens outside the element. The check uses `event.composedPath()`, so shadow DOM retargeting is handled. One document listener per event type serves all components. Elements that use `outside()` are kept in a set; nothing else is checked. For popups, the native Popover API (`popover`) already provides light dismiss: prefer it.
- `cycle(--x, a, b, c)` moves to the next value and wraps around. If the current value is not in the list, it goes to the first value. Values must be assignable to the state, and this is checked at runtime. Comma-separated literals only.
- `closest(selector)` is an optional last argument of every action (and of `bind:`). The state must be owned by exactly `element.closest(selector)`; there is no search beyond that element. It is not a global selector: only ancestors of the acting element can be targeted. The default remains the nearest owner.
- Trust: unchanged. Actions and `bind:` are accepted only from inline and same-origin stylesheets. They change declared state (and, for `bind:`, the bound control's own value), nothing else.

## 5. Native `if()` for `when()`

`when()` compiles to native `if()` only if **all** of these hold:
- the browser supports `if(style(--x: 1): …)` (feature-tested once);
- the condition uses only bare state references with `and`, `or`, `not` and parentheses;
- both branches are static;
- `window.ReactiveCSSConfig.native` is not `false`.

Three-valued logic is kept by compiling separate truth and falsity tests:

```
T(--x) = style(--x: 1)          F(--x) = style(--x: 0)
T(a and b) = T(a) and T(b)      F(a and b) = F(a) or F(b)
T(not a) = F(a)                 F(not a) = T(a)
when(c, A, B)  →  if(T(c): A; F(c): B)        /* neither: no value, like "unknown" */
```

This is equivalent because a boolean state serializes to `1`/`0` on its owner and the custom property inherits, which makes the nearest owner's value the element's value.

Differences, documented:
- A missing state gives the same "no value" result but no warning.
- A number state of exactly `1`/`0`, or a non-state declaration of the same property, is read as a boolean.
- Comparisons and `previous()`/`direction()` always use the runtime.

## 6. `typed()`

- `--x: typed(value)` or `--x: typed(value, "<syntax>")` registers `--x` as a typed custom property and compiles the declaration to plain `--x: value`.
- The syntax is inferred from the value: `<number>`, `<integer>` (not inferred: write it), `<length>`, `<percentage>`, `<angle>`, `<time>`, `<resolution>`, `<color>` (hex, color functions, or names the browser accepts as colors). Anything ambiguous needs an explicit syntax.
- `inherits: true`: the same as an unregistered custom property, so adding `typed()` only adds a type and an initial value.
- Registration uses `CSS.registerProperty()`. It is skipped, with a warning, when a native `@property` rule for the name exists in a readable stylesheet (explicit native registrations win), when the name was already registered with another syntax, or when the browser rejects the initial value (for example `1em`, which is not computationally independent). In those cases the declaration stays a plain custom property.
- Registrations are document-wide and permanent (the platform cannot unregister). `typed()` is **experimental**.
- `typed()` and `state()` stay separate: a typed property is a CSS value, not an event-driven state.
