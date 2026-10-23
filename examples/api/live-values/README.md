# Live values

API example 05. Open `index.html` through a local server (`npm run serve`, then `http://localhost:8080/examples/api/live-values/`). Tests: `tests/browser/api-examples.spec.ts`.

## What it demonstrates
`live(expression, interval)` evaluates its expression again at a fixed interval. With `random()` inside, the meter gets a new level every two seconds.

## APIs used
- `live(…, 2s)`: one shared timer per interval for the whole page. The minimum interval is 50 ms.
- `random(0, 100, by 1)`: a whole number from 0 to 100.

The number is printed with native CSS counters, because `text:` displays states only.

## How to interact
Watch. Nothing to click.

## Expected result
The bar and the number change every two seconds to a level from 0 to 100. The bar moves with a native transition (instantly under reduced motion).

## Native CSS alternative
CSS animations can change values over time, but along a fixed timeline, not to a new random value. A wall clock is not possible in either: `live()` repeats an expression, and no Reactive CSS function returns the time of day. That is why this example is "Live values" and not a clock.

## Limitations
- The timer runs while the element exists and the tab is visible. In a hidden tab it pauses, and missed ticks are skipped, not replayed.
- When the element is removed, its timer subscription ends, and the last subscriber of an interval stops the timer (tested).
