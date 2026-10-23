# Keyboard controls

API example 11. Open `index.html` through a local server (`npm run serve`, then `http://localhost:8080/examples/api/keyboard-controls/`). Tests: `tests/browser/api-examples.spec.ts`.

## What it demonstrates
`key(Key, …)` runs actions on a key press while the board is focused. `prevent()` cancels the key's native action, scrolling, so the arrow keys move the token instead of the page.

## APIs used
- `key(ArrowRight, …)` and the other three arrows: `keydown` while focus is on the board.
- `prevent()` *(experimental)*: `event.preventDefault()` for these keys only, during the event.
- `cycle(--col, 1, 2, 3, 4, 5)`: the next value in the list, wrapping around (the reversed list moves the other way).
- `state(3)`, `text:` *(experimental)*.

## How to interact
Tab to the board (or click it), then press the arrow keys. Also try Page Down, and the arrows in the text field.

## Expected result
- The token moves one cell per arrow press and wraps around at the edges. The column and row numbers follow.
- The page does not scroll on these arrow presses.
- Page Down and Space (not handled) still scroll the page.
- In the text field, the arrows move the caret as usual, and the token stays where it is.

## Native CSS alternative
None: CSS cannot react to keys. Native widgets (radio groups, sliders) have their own arrow-key behavior: prefer them when one fits.

## Limitations
- The board is a focusable `div` with a label. It is not a full ARIA grid, and screen readers hear only the announced position.
- `prevent()` cancels only events that happen on or inside the board.
- Form fields keep their own keys unless they carry the rule themselves.
