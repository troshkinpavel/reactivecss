# Counter

API example 01. Open `index.html` through a local server (`npm run serve`, then `http://localhost:8080/examples/api/counter/`). Tests: `tests/browser/api-examples.spec.ts`.

## What it demonstrates
A mutable number: `state()` declares it, `increment()` and `decrement()` change it, and `text:` writes it into the page as real text.

## APIs used
- `state(0)`: a number owned by each `.counter`.
- `on: click(increment(--count))`, `on: click(decrement(--count))`: actions on the buttons.
- `text: var(--count)` *(experimental)*: the value as DOM text.

## How to interact
Click − or +, or Tab to a button and press Enter or Space.

## Expected result
The number goes down or up by 1 per click, without a limit (it can go negative). It starts at 0, and the `<output>`'s own text `0` is shown before the script runs.

## Native CSS alternative
None for a mutable number: CSS has no writable values. Counters (`counter-increment`) count elements, not clicks. Without Reactive CSS this is a few lines of JavaScript.

## Limitations
- The value lives in the page only: reloading starts at 0 again.
- `<output aria-live="polite">` makes screen readers announce changes; not verified with real screen readers.
