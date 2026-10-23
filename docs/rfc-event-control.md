# RFC: event cancellation and propagation

> **0.7.0 decision.**
> - `prevent()` is implemented, as experimental, with a narrower scope than proposed below: `click` and `key()` only; not in `reset` or `outside()`; never for keys in form controls it does not own; only for events inside the element. The listener is non-passive per event type only while used. See [rfc-prevent-action-0.7.md](rfc-prevent-action-0.7.md).
> - `stop()` is **not** implemented.
> - `submit` is assessed and deferred.

> **0.6.0 note.** Still a proposal; nothing here is implemented. `focus:` interacts with events only by reading which trusted event caused a state change. `focus`/`blur`/`focusin`/`focusout` never arm it, so programmatic focus cannot cycle. No propagation control was added.

Status: **proposal, not implemented** (0.5.1). Background: `docs/event-support-0.5.md`.

## How `on:` dispatches today (verified)

- One listener per event type on `document`, **capture phase, passive**.
- Before dispatch, `sync()` (0.5.1) applies pending state from earlier actions in the same frame.
- Then the path from `composedPath()` is walked:
  - target and ancestors for `click`, `change`, `input`, `keydown`, `focusin`, `focusout`, `reset`;
  - the target only for the others.
- For each element, the cascade picks its `on:` declaration, and the actions run synchronously.

**Consequences** (tested in `events.spec.ts`):
- Actions run **before** listeners on the target and its ancestors (bubbling) and before the default action. Only `window` capture listeners run earlier.
- Passive: `preventDefault()` from our listener would be ignored.

## `prevent()`: recommended for 0.6

```css
/* Proposal only */
.link        { on: click(prevent(), set(--opened, true)); }
.dialog-form { on: submit(prevent(), set(--submitted, true)); }
.shortcut    { on: key(ctrl+k, prevent(), toggle(--palette)); }
```

**What it does:** calls `event.preventDefault()` on the original event, synchronously, during our capture listener. It is early enough: the default action runs after dispatch completes.

**What it affects** (native, per event):

| Event | Default prevented |
|---|---|
| `click` on a link | navigation |
| `click` on a submit button | form submission |
| `click` on a checkbox or radio | the toggle (and its `input`/`change`) |
| `submit` | submission/navigation (makes a `submit` trigger useful) |
| `keydown` | the key's effect: typing, scrolling with Space/arrows, browser shortcuts |
| `pointerdown` | text selection start and focus |

It does **not** stop other listeners, and it does not stop propagation.

**Architecture changes:**
1. A handler set that contains `prevent()` registers its event types with **`passive: false`**. Reference-count passive and non-passive uses separately; the listener is re-registered when the mode changes.
2. Never non-passive for `touchstart`, `touchmove` or `wheel`: they are not on the trigger list, and must stay off it for `prevent()`.
3. **Compile-time errors:**
   - `prevent()` with non-cancelable events (`input`, `change`, `focus`, `blur`, `focusin`, `focusout`, the animation and transition events);
   - inside `outside()` (preventing an event that happened elsewhere is surprising);
   - in untrusted stylesheets (same trust rule as `on:`).
4. **Conditional rules.** `prevent()` applies only when its rule wins the cascade for that element at event time (with 0.5.1, against the current state). That is consistent with every other action, but must be documented: `.link:when(--locked) { on: click(prevent()) }` is a valid "locked link" pattern.
5. `isTrusted` is not required. Synthetic `click()` calls are prevented as well, which matches native behavior.

**Accessibility:**
- Preventing default actions on links and submit buttons removes behavior that keyboard and assistive-technology users expect.
- Documentation should prefer `<button type="button">` over a prevented link, and `<form method="dialog">` over a prevented submit.

## `stop()`: not as a native stop

**Native `stopPropagation()` cannot be offered honestly by the delegated design.**
- At document capture, the event has not reached the target or any bubbling listener.
- Calling `stopPropagation()` there stops **everything** after the document: the target's own listeners, the page's handlers, frameworks. That is not "stop after this element".
- A correct "stop at this element" needs a bubble-phase listener **on each element** with such a rule. That means per-element listeners, cleanup per element, and an order relative to other listeners on the same element: an architecture change.

**What could be offered: a Reactive CSS-only scope.**
- "Do not run `on:` actions of this element's ancestors for this event."
- Implementation: stop walking the path in `dispatch`. Trivial, no native effect.
- To avoid confusion with the DOM method, it must **not** be called `stop()`. Name it for what it does, for example `local()`.
- Example: `.card .menu { on: click(toggle(--menu), local()) }` keeps the card's own `on: click(...)` from running when the menu is clicked. The page's listeners still see the click.
- Recommended only if a real example needs it. None of the five examples did.

`stopImmediatePropagation()`: **not recommended** in any form; its effect depends on listener registration order.

## Decision

Implement `prevent()` in a later release, with the compile-time checks above, and `submit` as a trigger in the same change. Do not ship anything named `stop()`. Nothing in 0.5.1 changes event cancellation or propagation.
