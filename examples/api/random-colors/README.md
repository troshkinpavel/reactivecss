# Random colors

API example 03. Open `index.html` through a local server (`npm run serve`, then `http://localhost:8080/examples/api/random-colors/`). Tests: `tests/browser/api-examples.spec.ts`.

## What it demonstrates
`random(min, max, by step)` gives a random number. Wrapped in `on(click, …)`, it is evaluated again on each click, so the swatch gets a new hue.

## APIs used
- `random(0, 359, by 1)`: a whole number from 0 to 359.
- `on(click, expression)`: evaluates the expression once when bound, then again on every click on the element with the declaration (`.random`).

The number is printed with native CSS counters (`counter-reset` and `counter()`). `text:` only displays states, and this value is not a state.

## How to interact
Click **New color** (or press Enter or Space on it).

## Expected result
The swatch and the hue number change on every click. The hue is a whole number from 0 to 359. Two clicks can give the same hue by chance.

## Native CSS alternative
CSS Values 5 defines a native `random()`. Reactive CSS uses it for a plain `random(min, max)` when the browser supports per-element values, but a native value never changes after the page loads. Re-rolling on a click has no native equivalent.

## Limitations
- A click anywhere inside `.random` re-rolls, because `on()` listens on that element and clicks bubble. Put the declaration on the button if only the button should count. Its children then inherit the value, but its siblings do not.
- The number is generated content, not DOM text: it cannot be selected, and screen readers may not announce it.
