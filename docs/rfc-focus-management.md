# RFC: declarative focus management

> **0.6.0 decision: superseded.** The `focus(selector)` action below is **not** implemented. 0.6.0 ships the declaration `focus: <value>` instead: the matched element is the target, and focus follows a user-initiated state transition. See [rfc-focus-declaration-0.6.md](rfc-focus-declaration-0.6.md). Ideas kept from this RFC:
> - focus only after the state's styles apply;
> - only for user-initiated events;
> - `tabindex="-1"` is the author's job;
> - no restoration API (use `<dialog>`/`popover`).

Status: **proposal, not implemented** (0.5.1). Motivation: `docs/example-capability-gaps.md`, gap 3.

## The problem, observed in the examples

- **Wizard.** After Next, focus stays on the Next button. At step 4 that button becomes `display: none`, and focus falls back to `<body>` (observed in Chromium). Keyboard users must tab from the top again, and screen-reader users get no cue that the panel changed.
- **Quiz.** The single Next button keeps focus (by design), but the new question's heading is neither focused nor announced. After "Try again", focus is on the now-hidden result card's button, and falls back to `<body>`.

## Prefer native behavior first

| Need | Native answer |
|---|---|
| Modal content | `<dialog>` with `showModal()` moves focus in and restores it on close; `autofocus` inside the dialog |
| Light-dismiss popups | `popover` (focus stays sensible; `popovertarget` buttons need no script) |
| Disclosure | `<details>`/`<summary>` keep focus on the summary |
| Linear steps | No native element; this RFC |

`autofocus` only works on load and in dialogs and popovers, so it does not help a wizard step.

## Grammar: does the action list allow a `focus()` action?

Yes: `on: click(increment(--step), focus(...))` is already a list of actions, executed in order. The only parsing question is the argument:
- a selector can contain commas (`h2, h3`), and actions already use a trailing `closest(selector)` scope argument;
- proposal: **one selector without top-level commas** (use `:is(h2, h3)`), optionally followed by `closest(scope)`, the same convention as the other actions;
- unambiguous with the existing splitter, which splits at depth-0 commas.

```css
/* Proposal only */
.wizard > .nav > .next { on: click(increment(--step), focus(.panel:nth-var(--step) h2, closest(.wizard))); }
.quiz > .nav > .next   { on: click(increment(--q), focus(.card:nth-var(--q) h2, closest(.quiz))); }
.quiz .restart         { on: click(set(--q, 1), …, focus(.q1 h2, closest(.quiz))); }
```

## Semantics

1. **Search scope.** With `closest(scope)`, the search runs inside the element `el.closest(scope)`. Without it, inside the element that has the `on:` declaration. No document-wide queries: no DOM query language.
2. **Timing.** State changes are synchronous, but the target is usually made visible by CSS that depends on the new state, in the next frame. `focus()` therefore runs **after** the state is applied and styles are updated: in the late phase of the next frame flush (the phase `text:` uses), with a forced style read at that point.
   - Focusing synchronously during the click would target the still-hidden element and fail.
   - The 0.5.1 `sync()` makes the logical state current, but not the styles.
3. **Target choice.** The first element in the scope that matches the selector **and** can receive focus: rendered (not `display: none`, `visibility: hidden` or `inert`), and either focusable, or having `tabindex="-1"` (headings must be given `tabindex="-1"` by the author; the library does not add it). No match: a diagnostic, focus unchanged.
4. **Only for user-initiated events** (`isTrusted`, and click, keydown, change, input, submit, reset). Never on focus/blur events, animation events or state changes alone, to prevent loops and focus stealing.
5. **`focusVisible`.** Call `focus({ focusVisible: true })` when the triggering event was a keyboard event, and the default otherwise, so the focus ring follows the browser's heuristic.
6. **No restoration API in the first version.** Restoring focus after hiding a region is solved natively by `<dialog>`/`popover`. A `focus()` back to the opener covers the rest explicitly.
7. **Reduced motion.** Focus does not scroll smoothly: use `focus({ preventScroll: false })` with the browser's default scrolling. Smooth scrolling stays the author's `scroll-behavior`, which already respects `prefers-reduced-motion` if written so.
8. **Removed or hidden targets.** If the element is removed before the frame, the action does nothing (no diagnostic: a removal is intentional).

## Risks

- **Focus stealing.** Limited by rule 4, and by scope (only inside the owner).
- **Screen readers announce the newly focused heading.** This is the goal, but it must be tested with real screen readers before claiming accessibility.
- **Multiple `focus()` actions in one event:** the last one wins (document it).

## Estimate

~1 KB minified: one action, the late-phase hook (exists), a visibility check, and tests for the wizard and quiz flows with keyboard. Requires an accessibility review and real screen-reader testing (VoiceOver, NVDA) before shipping. Until then, the examples document the limitation.
