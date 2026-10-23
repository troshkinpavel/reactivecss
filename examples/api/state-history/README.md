# State history

API example 02. Open `index.html` through a local server (`npm run serve`, then `http://localhost:8080/examples/api/state-history/`). Tests: `tests/browser/api-examples.spec.ts`.

## What it demonstrates
`previous()` reads the value a state had before its last change, and `direction()` says whether that change went up or down. No extra state is declared for either.

## APIs used
- `state(0)`, `increment()`, `decrement()`: the score.
- `previous(--score)`: shown with `text:`.
- `direction(--score)`: used as a condition operand in `:when()`, which picks the direction word and the arrow style.
- `text:` *(experimental)*: DOM text for all three values.

## How to interact
Click +1 and −1 in any order.

## Expected result
- **Current** shows the score.
- **Previous** shows the score before the last click (0 at the start).
- **Direction** shows "none yet", then "up" with a green arrow after +1, or "down" with the arrow turned and orange after −1.

The arrow turns with a native CSS transition.

## Native CSS alternative
None: CSS keeps no history of values. In JavaScript you would store the old value next to the new one.

## Limitations
- One step of history only. Longer histories (`history(--x, n)`) are not implemented.
- `direction()` works for number and dimension states only.
