# RFC: `prevent()`, cancelling a native default action (0.7)

Status: **decided, implemented as experimental in 0.7.0.** Supersedes the `prevent()` section of [rfc-event-control.md](rfc-event-control.md).

## 1. Problem

Observed in the 0.6.0 examples:
- The tabs' ArrowLeft/ArrowRight and the keyboard playground's arrow keys run their actions, then also **scroll the page**.
- `key()` runs in a passive listener, so nothing can cancel that default.

## 2. The current event model (verified in code and tests)

- **Listeners.** There is one capture-phase listener per event type on `document`, installed only while some `on:` rule uses that type. It is registered `passive: true`. In a passive listener `preventDefault()` is ignored for **every** event type, not only scroll-blocking ones.
- **Dispatch.** Before dispatch, `sync()` makes conditions current. The event path is then walked: target and ancestors for `click`, `change`, `input`, `keydown`, `focusin`, `focusout` and `reset`, otherwise the target only.
  - For each element, the cascade chooses its `on:` declaration, and its actions run **synchronously**, in order.
  - This happens before any target or bubbling listener, and before the browser's default action.
- **`key()`** is a `keydown` on the focused element and its ancestors. When nothing is focused, the element last pressed with the pointer stands in.
  - Printable keys are skipped while typing in an editable control.
  - Modifiers must match exactly.
- **`outside()`** runs for elements the event happened outside of.
- **Trust.** `on:` only exists in trusted stylesheets.

## 3. Syntax

`prevent()` is one more action in the existing action list. There is no new trigger, no new property and no event modifier syntax.

```css
.tabs [role=tablist] { on: key(ArrowRight, prevent(), cycle(--active, 1, 2, 3)); }
a.external          { on: click(prevent(), set(--confirming, true)); }
```

- No arguments.
- The position in the list does not matter for the native result, because the default action runs after dispatch; place it first by convention.

## 4. Where it is allowed

| Context | `prevent()` | Reason |
|---|---|---|
| `key(…)` (`keydown`) | **yes** | Cancelable; stops scrolling, caret movement, text input and browser shortcuts for that key |
| `click` | **yes** | Cancelable; stops link navigation, checkbox/radio toggling, submit-button submission, `<summary>` toggling |
| `change`, `input` | compile error | Not cancelable (`beforeinput` is not a trigger) |
| `focus`, `blur`, `focusin`, `focusout` | compile error | Not cancelable |
| `pointerenter`, `pointerleave` | compile error | Not cancelable |
| `animation*`, `transition*` | compile error | Not cancelable |
| `reset` | compile error | Cancelable natively, but `bind:` restores states after a reset regardless, so a cancelled reset would desynchronize controls and states. Needs its own change |
| `outside(…)` | compile error | Would cancel clicks on unrelated elements (links, buttons) anywhere on the page |
| `submit` | not a trigger | See section 8 |

## 5. Native contract

When the action runs, in this order:

1. **Only inside the element.** The event's target must be the element carrying the `on:` declaration, or inside it. When `key()` falls back to the last-pressed element because nothing is focused, the target is `<body>`, so nothing is cancelled.
2. **Never in a form control it does not own (keys).** For `keydown`, if the target is a native form control or editable element (any `input`, `textarea`, `select`, `contenteditable`) and is not itself the element carrying the declaration, nothing is cancelled. Arrow keys keep moving the caret, changing radio selections and adjusting sliders; the other actions still run.
3. **Only if cancelable.** If `event.cancelable` is false (for example a script-created `new KeyboardEvent('keydown')`), nothing is cancelled and a deduplicated warning says so.
4. Otherwise it calls `event.preventDefault()` synchronously, during dispatch.
5. **Checks the result.** `event.defaultPrevented` is read back. If it is still false, a warning says the cancellation did not take effect. The runtime never reports a cancellation it did not observe.
6. **No propagation change.** It never calls `stopPropagation()`: other listeners, including page scripts, still receive the event, and nested Reactive CSS handlers still run.
7. **Affects only this event.** No state is kept, and the next event starts fresh.

- **Trusted and synthetic events** behave the same: a cancelable synthetic event (`el.click()`) is cancelled like a real one.
- **Nested handlers.** Every matching `on:` on the path runs, innermost first. Any one of them may cancel; the others are unaffected.
- **Links inside a cancelling ancestor.** `.card { on: click(prevent(), …) }` also cancels clicks on links and buttons inside the card. This is what the rule says, so it is allowed, but it is reported in development as a note naming the inner interactive element.

## 6. Conditional cancellation

`prevent()` runs only when the declaration that contains it is the one the cascade chose for that element, for that event. Conditions are current (`sync()` before each dispatch, 0.5.1), so:

```css
.region { on: key(ArrowDown, increment(--y)); }                            /* scrolls */
.region:when(--captured) { on: key(ArrowDown, prevent(), increment(--y)); } /* does not */
```

The page scrolls while `--captured` is false and stops scrolling from the first event after it becomes true, including two events in one task.

## 7. Listener strategy

- The document listener for an event type is **non-passive only while at least one live `on:` rule uses `prevent()` for that type**. Otherwise it stays passive, as before.
- Switching happens when rules are registered or released: stylesheet compile, recompilation, removal. It never happens during the event being cancelled.
- The listener is removed and re-added with the new option. The same function and capture flag mean it is never installed twice.
- Late stylesheets switch the listener when they are compiled, before their elements can receive events.

Per-element listeners are not used: the single delegated listener keeps the existing cost model.

## 8. `submit`: assessed, not added

`submit` is now technically possible: the event is cancelable, and a non-passive capture listener could cancel it. It is not added in 0.7.0, because:

- every use would have to cancel navigation in order to do anything else, and a mistaken rule silently breaks the form's real submission;
- `method="dialog"` and native validation already cover the examples.

It needs its own acceptance test (implicit submission by Enter, `requestSubmit()`, `formnovalidate`, `form` attribute owners) and documented navigation behavior.

## 9. `stop()`: not implemented (research)

Native `stopPropagation()` in a capture listener on `document` would stop the event before it reaches the target, which is far more than authors expect. Calling it after the fact cannot stop listeners that already ran. A `stop()` named like the native method would therefore be misleading.

A Reactive-CSS-only alternative was considered for a future RFC: `handled()`, meaning "do not run `on:` handlers of ancestors for this event". It would affect only Reactive CSS handlers, never native listeners. It is **not shipped**: no example needs it (nested regions are expected to all react), and its name must make the scope unmistakable.

## 10. Rejected alternatives

- **Event modifiers** (`key(ArrowDown.prevent, …)`): a second syntax for the same thing.
- **Always non-passive listeners:** would give up the passive guarantee on every page, even without `prevent()`.
- **Implicit cancellation when a `key()` handler runs:** would change existing behavior and block native keys silently.
