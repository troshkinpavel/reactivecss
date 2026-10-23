# State engine: design

This document records the semantics decisions behind `state()`, `on:`, the actions, `when()`, `:when()` and state-driven `:nth-var()`. User-facing syntax is in the [README](../README.md#state-actions-and-conditions).

## Pipeline

```
event ──► delegated listener (document, capture) ──► cascade picks the on: declaration (--rcss-on)
      ──► action (set / toggle / increment / decrement) ──► nearest state cell ──► value changed?
      ──► notify that cell's subscribers only (urgent lane) ──► next frame: evaluate, write changed
          custom properties / marker attributes ──► native CSS (cascade, transitions, animations)
```

No DOM nodes are created, and no stylesheet is rewritten after start. Nothing polls.

## 1. State cells and ownership

`--name: state(value)` inside a rule makes every element that matches the rule an **owner**. Each owner gets one cell per name, so cells are never shared between elements. A cell holds the owner, the name, the typed value, the previous value, a version counter (0 = still at the initial value), the list of generated properties it writes, and its subscribers.

Cells are stored in a `WeakMap<Element, Cell[]>` keyed by owner (usually 1–2 cells per owner). The compiled rule (selector, initial value, generated property name) is shared by all owners.

## 2. Types

| Written as | Type | Serialized for CSS | Notes |
|---|---|---|---|
| `true`, `false` | boolean | `1`, `0` | So `var(--open)` works in `calc()`, `opacity`, `@container style(--open: 1)` |
| `3`, `-0.5` | number | the number | |
| `10px`, `50%`, `45deg`, `2s` | dimension | the value | Absolute lengths, angles, times and frequencies convert to each other in comparisons and assignments. Other units (`em`, `%`, `vw`...) only match the same unit. |
| `red`, `#fff`, `critical` | value | as written | Equality (`==`, `!=`) only, ASCII case-insensitive |

Values are never coerced through JavaScript truthiness or string ordering.

## 3. CSS representation and cascade

```css
.card { --active: state(false); }
/* compiles to */
.card { --active: var(--rcss-s1, 0); }
```

- The author's custom property still takes part in the cascade and inherits as usual. The generated `--rcss-s1` is only written inline on the owner, and only after the state differs from its initial value (so no writes at start).
- Runtime state takes precedence over the initial value of the *same* declaration, because the inline generated property replaces the fallback.
- If a different, non-state declaration of `--active` wins the cascade, `var(--active)` shows that value. `when()`, `:when()`, actions and state-driven `:nth-var()` still use the state cell. Keep one `state()` declaration per name and component.
- The author's property (`--active`) is not registered: it must inherit so descendants can read it, and a registration is document-global. The generated `--rcss-sN` *is* registered, with `syntax: "*"` and `inherits: false`. Two nested owners can match the same `state()` rule and so share one generated property. Without this registration, the outer owner's written value would be inherited by the inner owner and leak into its CSS (found and fixed in 0.3, covered by a test). `--rcss-on` is registered the same way.

## 4. Initialization and lifetime decisions

| Situation | Behavior |
|---|---|
| A class change makes an element match a `state()` rule | A new cell with the rule's initial value. |
| The element stops matching every `state()` declaration of that name | The cell is disposed and its generated properties removed. Consumers re-resolve: they move to an outer owner or become "unknown". State is **not** kept forever. |
| A media query or class change makes another `state()` declaration of the same name win | Same cell, value unchanged. State is not reset by CSS recalculation. |
| Two `state()` declarations for one name match the same element | One cell. While unchanged (version 0), it takes the initial value of the cascade winner (one `getComputedStyle` read when the second declaration attaches). The current value is written to both generated properties, so either declaration shows it. |
| Owner removed and re-inserted | Removal disposes the cell. Re-insertion creates a fresh cell at the initial value (like re-mounting a component). Moving an element within one mutation batch keeps it. |
| A nested component declares the same name | The inner cell shadows the outer one for everything inside it, including when the inner owner appears later: consumers inside it re-resolve. |
| The stylesheet is edited or replaced | The sheet is compiled again, and all its cells are disposed and recreated (state resets). |
| Media-query-only changes of an initial value | Not detected for existing cells (no polling). New cells use the current winner. |

## 5. Resolution

A consumer element looks for the nearest cell named `--x` on itself, then on its ancestors (`parentElement` walk, O(depth)). References are lazy:
- They resolve on first use, which is in the batched settle step after a stylesheet or a DOM mutation batch has been fully applied, so declaration order between rules does not matter.
- They re-resolve when an enclosing owner's subtree gets a new owner of that name, and when their cell is disposed.
- A reference that stays unresolved for 1 s produces a warning. The delay covers owners in a stylesheet that is still loading.

Actions resolve at event time from the element that carries the `on:` declaration.

Explicit scopes (for example `set(--x, 2, closest(.tabs))`) would fit as an optional third action argument. They are not implemented.

## 6. Actions and `on:`

- `on: event(action, ...), event(...)` compiles to `--rcss-on: <id>`. On an event, the runtime reads the computed `--rcss-on` of each candidate element, so the cascade decides which `on:` declaration applies, exactly as for any property. Candidates are elements matching an `on:` rule with state pseudo-classes removed. Specificity, source order, layers, media queries and `:hover` all apply. Several behaviors on one element go into one declaration.
- Events: `click change input pointerenter pointerleave focus blur`. There is one capturing listener per event type on the document, installed while any rule uses that event. Bubbling events (`click`, `change`, `input`) run the handlers of the target and its ancestors, innermost first. The others run only on their target.
- Actions in one handler run in order, synchronously, in the event task. Each effective change notifies each subscriber once.
- Cycles cannot happen. Actions run only in response to browser events, conditions are pure, and a state change never dispatches an event.

| Action | Target type | Notes |
|---|---|---|
| `set(--x, value)` | any | `value` is a literal of a compatible type, `sibling-index()` (one-based index of the element carrying `on:` among its siblings) or `sibling-count()` |
| `toggle(--x)` | boolean | |
| `increment(--x, step = 1)`, `decrement(...)` | number or dimension | A unitless step uses the state's unit. Results are rounded to 6 decimals, so `0.1 + 0.2 == 0.3`. |

The ambiguous `set(--count, add(1))` was not adopted: `increment()` says what it does.

Invalid assignments warn and leave the state unchanged. Identical values neither notify nor write.

## 7. Conditions

Grammar (no JavaScript is evaluated):

```
or      := and ('or' and)*
and     := not ('and' not)*
not     := 'not' not | cmp
cmp     := operand (('==' | '!=' | '>' | '<' | '>=' | '<=') operand)?
operand := --state | number | dimension | true | false | keyword | #hex | '(' or ')'
```

- A bare `--x` must be a boolean state. A number is an error: write `--x != 0`.
- Ordered comparisons need numbers or convertible dimensions. A unitless `0` compares with any unit.
- **Unknown, not false.** A missing state or a type error makes the condition *unknown* (three-valued logic: `unknown and false = false`, `unknown or true = true`). Then `when()` gives no value: its property behaves as if the declaration were invalid at computed-value time (`unset`). `:when()` does not match. A warning is logged once.

`when(c, a, b)` compiles like any reactive function: a generated custom property per element. Only that element's referenced cells notify it. `:when(c)` becomes a private marker attribute `[data-rcss-when-N]`, which has the specificity of one pseudo-class (the same as `:when()` would have). Its declarations stay in the stylesheet, so the cascade, layers and transitions work natively.

## 8. `:nth-var()` and state

For each sibling group, `:nth-var(--x)` first looks for a state cell `--x` on the parent or its ancestors. If it finds one, it reads the cell directly and subscribes to it: no `getComputedStyle`, no reliance on the `MutationObserver`, and a value change touches only the previous and the new active element. If there is no state, the Phase 4 behavior applies (computed value, refreshed on attribute and child-list mutations). Tab buttons and panels are two groups that resolve the same `.tabs` cell independently.

## 9. Scheduling

Work triggered inside an event handler (actions → cells → subscribers) goes to an **urgent lane**. It is processed first in the next frame and never deferred by the frame budget, so a click is not stuck behind thousands of `live()` updates (test: the click is visible within 2 frames behind 6,000 values updating every 50 ms). New elements are settled in the same task (all reads, then all writes).

## 10. Trust model

`on:` is the only construct with side effects, and its side effects are limited to declared state cells of the page:
- no DOM access beyond the generated properties and attributes;
- no network, storage, cookies, script or arbitrary method calls;
- explicit event and action registries;
- no `eval` or `new Function`.

Actions are accepted only from **inline `<style>` and same-origin stylesheets** (inline only while `ReactiveCSSConfig.trustInlineStyles` is not `false`). Origin is not trust: see [security.md](security.md). In a cross-origin stylesheet (readable through CORS) `on:` is ignored with a diagnostic, while its other reactive CSS still works.

## 11. Extensibility

- Actions are registered with `defineAction({ name, syntax, compile, run })`. Functions and selectors carry a `syntax` string.
- `describe()` returns the registered functions, selectors, actions and events as data. This is the hook for future tooling such as an MCP server.
- `Cell.previous` and `Cell.version` are the history: `previous()`, `direction()` and `:changed()` (0.3) read them; `Cell.initial` serves form reset of `bind:`.
- 0.3 additions (`bind:`, `key()`, `outside()`, `cycle()`, `closest()`, native `if()`, `typed()`) are specified in [api-0.3.md](api-0.3.md).
