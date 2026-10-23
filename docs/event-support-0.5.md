# Event support audit (0.5.0)

> **0.7.0 note.** `prevent()` can now cancel the default of `click` and `key()` (`keydown`) events, with a non-passive listener installed only while a rule uses it. Every other trigger stays passive and non-cancellable from CSS. See `docs/rfc-prevent-action-0.7.md`.

> **0.5.1 update.**
> - `focusin`, `focusout` and `reset` are now `on:` triggers (bubbling).
> - `animationend`, `animationcancel`, `transitionend` and `transitioncancel` are now triggers too, running on the target only.
> - Before each dispatch, `sync()` applies pending state from earlier actions in the same frame.
> - Still compile errors: `submit`, `animationstart`, `animationiteration`, `transitionrun`, `transitionstart`, `dblclick`, `keyup`.
> - The matrix below is the 0.5.0 audit; tests: `tests/browser/events.spec.ts`. Event control: `docs/rfc-event-control.md`.

Date: 2026-10-19. Code inspected: `src/state/actions.ts` (delegation, dispatch, `key()`, `outside()`, cleanup), `src/core/parser.ts` (`onDeclaration`), `src/core/registry.ts` (`ACTION_EVENTS`, `OUTSIDE_EVENTS`), and `src/functions/sources.ts` (the separate `on(event, value)` value function). Observed behavior: `tests/browser/events.spec.ts` (Chromium 156 and WebKit 27.2: 16 passed), plus the existing `key()`/`outside()` tests in `v03.spec.ts`.

## How `on:` works today

- **Compile time.** A trigger must be one of `click`, `change`, `input`, `pointerenter`, `pointerleave`, `focus`, `blur`, `key(…)` (keydown) or `outside(click | pointerdown | focusin, …)`. Any other name is a compile error: the declaration is left unchanged, and the diagnostic names it (`expected event(action, ...) with one of …; got "submit(…)"`).
- **Delegation.** There is one listener per event type, on `document`, **capture phase, passive**. It is reference-counted per compiled handler set and removed when the last stylesheet that uses that type goes away (`listen(type, ±1)`).
- **Dispatch.** The listener reads `composedPath()`. For `click`, `change`, `input` and `keydown` it walks the path innermost first (the target, then its ancestors). For the other types it uses the target only. For each element with candidate `on:` rules, the cascade decides which declaration applies: directly when there is one unconditional rule, otherwise from the computed `--rcss-on`. Then the actions run.
- **`outside()`.** Every element whose rules use `outside()` is checked against `composedPath()`, so it is shadow-DOM aware.
- **`key()`.** The path is the focused element and its ancestors. When nothing has focus, the element last pressed with the pointer stands in (Safari does not focus buttons). Printable keys never fire while the user types in an editable field.
- **Scheduling.** Actions run synchronously inside the event. State changes go to the scheduler's urgent lane and are written in the next frame, never deferred by the frame budget.
- **Consequences, observed.**
  - Actions run **before** the target's own listeners. A target handler sees the old CSS value until the next frame.
  - A handler that calls `stopPropagation()` on the target or an ancestor does **not** stop Reactive CSS, which already ran.
  - A `window` capture listener that stops the event **does** prevent the actions.
  - Synthetic events (`el.click()`, `dispatchEvent`) behave like real input.

## Matrix

"Code change" means what supporting the event in `on:` would take. Nothing was changed in 0.5: adding triggers is API expansion, and this task is an audit.

| Event | `on:` today | Observed | Delegation | Limitations | Code change |
|---|---|---|---|---|---|
| `click` | yes | Runs on target and ancestors, innermost first (tested: button before form) | document capture, passive | Cannot prevent the default (a link still navigates: tested) | no |
| `change` | yes | Runs on target and ancestors | same | A checkbox click fires `click`, `input` **and** `change` natively (tested: all three actions run) | no |
| `input` | yes | Runs on target and ancestors | same | | no |
| `focus` | yes | Target only, also for keyboard focus (tested) | capture sees non-bubbling focus | No ancestor (use `focusin` semantics, unsupported) | no |
| `blur` | yes | Target only (tested) | same | | no |
| `pointerenter`, `pointerleave` | yes | Target only; entering a child does not re-enter the parent (tested) | same | | no |
| `keydown` via `key()` | yes | Focus scope with pointer fallback; modifiers exact; no character keys while typing | same | Cannot prevent the default (e.g. Space scrolling) | no |
| `click`, `pointerdown`, `focusin` via `outside()` | yes | Elements the event was outside of | same | | no |
| `focusin`, `focusout` | **no** (compile error, tested) | — | would bubble to ancestors | Available in `outside(focusin)` and in the `on()` value function | allowlist + bubbling set (small) |
| `animationstart`, `animationiteration`, `animationend`, `animationcancel` | **no** (compile error, tested) | The `on(event, value)` *value function* re-evaluates on `animationend` and `animationiteration` (tested), but cannot change state | would bubble: a child's animation reaches the owner | `animationcancel` is not even in the value function's list | allowlist + bubbling set (small); decide target-only vs bubbling |
| `transitionrun`, `transitionstart`, `transitionend`, `transitioncancel` | **no** (compile error, tested) | `on()` value function: `transitionend` only (tested) | same | One `transitionend` per property: several transitions fire several events | same |
| `submit` | **no** (compile error, tested) | — | bubbles | Without preventing the default, the page navigates and memory state is lost: only useful with `prevent` (below) or `method="dialog"` | allowlist; useful only with `prevent` |
| `reset` | **no** (compile error, tested) | — | bubbles | `bind:` already follows native reset | allowlist (small) |
| `dblclick`, `keyup` | **no** (compile error, tested) | In the `on()` value function only | | | allowlist |

**Recommendation (next iteration, not done here).** Add `focusin`, `focusout`, `animationstart/end/iteration/cancel`, `transitionstart/end/cancel` and `reset` to `ACTION_EVENTS`.
- `focusin`/`focusout` and `reset` bubble, like `click`.
- For animation and transition events, run on the **target only** by default. A child's animation ending should not trigger the parent's actions, and `:changed()`-style uses expect the element's own animations.
- Cost: one more delegated listener per used type, no per-element work.
- `submit` should only arrive together with a way to prevent the default.

## `.prevent` and `.stop`: proposal only

### Constraints found in the implementation

1. **`preventDefault()` is possible but needs a non-passive listener.** It must be called synchronously during dispatch. Our listener runs synchronously, in the capture phase at `document`, before the target, which is early enough. But today it is registered `passive: true`, and a passive listener's `preventDefault()` is ignored. Making the listener non-passive only for event types that have a `prevent` handler is cheap for `click`, `submit`, `keydown` and `pointerdown` (not scroll-blocking). It must never be done for `touchstart`, `touchmove` or `wheel`. Non-cancelable events (`input`, `change`, `focus`, `blur`, the animation and transition events) cannot be prevented: reject `prevent` on them at compile time.
2. **The cascade decision is synchronous.** Whether `prevent` applies depends on which `on:` declaration wins, which `handlersOf()` already resolves synchronously, sometimes with a forced style read. So the decision can be made in time.
3. **`stopPropagation()` cannot be done faithfully from a delegated document listener.** At document capture, the event has not reached the target yet. Stopping it there would stop *everything*, including the target's own listeners and native behavior hooks, which is the opposite of "stop after this element". A faithful native stop needs a bubble-phase listener on each matching element. That means per-element listeners, ordering relative to third-party listeners on the same element (registration order), and cleanup per element: an architecture change.
4. **`stopImmediatePropagation()`** has the same problem, and its result depends on registration order. Not recommended.

### Recommended design

- **`prevent()` as an action**, not a `.prevent` suffix. The tokenizer reads `click.prevent(` as `click`, `.`, `prevent(`, which would need parser changes, and an action fits the existing grammar: `on: click(prevent(), set(--open, true))`, `on: submit(prevent(), set(--sent, true))`.
  - Compile-time errors when used with a non-cancelable event or with `outside()`.
  - The listener for that type becomes non-passive while such a handler set is registered.
  - Same trust policy as `on:` (trusted stylesheets only).
- **`stop()` limited to Reactive CSS handlers:** "do not run `on:` actions of ancestors for this event". This is easy (stop walking the path in `dispatch`) and honest, because it does not claim to stop native propagation. Name it so it cannot be confused with the DOM method, for example `click(…, local())` or documented as "Reactive CSS only".
- **Native `stopPropagation()`: not recommended** without per-element listeners. If needed later, it should be a separate, explicitly per-element mechanism.

```css
/* Proposal only — not implemented */
.dialog-form { on: submit(prevent(), set(--submitted, true)); }
.card        { on: click(set(--selected, true)); }
.card .menu  { on: click(toggle(--menu), stop()); }   /* the .card rule does not run for clicks in the menu */
```

Risks to document before shipping:
- Preventing the default on links and forms removes behavior that keyboard and assistive-technology users rely on. Prefer `<button type="button">` and `<form method="dialog">`.
- A `prevent()` in a conditional rule (`:hover`, `@media`) applies only when that rule wins. That is correct but surprising.
- Third-party listeners still see the event: `prevent()` only marks it.
