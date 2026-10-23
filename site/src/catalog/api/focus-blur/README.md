# Focus & blur

## What it demonstrates
Two focus behaviors. `focus: when(--open)` moves focus to the field when the user opens it, and `:blur` matches the field after it loses focus, here to play a short animation.

## APIs used
- `focus: when(--open)` *(experimental)*: a focus request. It runs only when the value becomes true because of a user action, never on page load, and never takes focus from an open dialog.
- `:blur`: matches from a genuine focus loss until the next focus. It never matches an element that was never focused.
- `--attr-aria-expanded`: the button reports whether the field is shown.

## How to interact
Press Search: the field appears and receives focus. Type, then press Tab or click elsewhere: the field nudges once. Press Search again to hide it.

## Expected result
Focus lands in the field right after it appears. Each time the field loses focus it plays the nudge animation once.

## Native CSS alternative
`:focus`, `:focus-visible` and `:focus-within` style focus natively and stay the right tool for focus styling; `:blur` is only for reacting to the moment focus leaves. Moving focus has no CSS equivalent (`autofocus` works only on load).

## Limitations
- Focus requests need a focusable element: the field here is a native input.
- Not verified with screen readers.
- The nudge respects reduced-motion settings only if your stylesheet does; the site previews disable animations under `prefers-reduced-motion`.
