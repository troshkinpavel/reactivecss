# Change animation

API example 14. Open `index.html` through a local server (`npm run serve`, then `http://localhost:8080/examples/api/change-animation/`). Tests: `tests/browser/api-examples.spec.ts`.

## What it demonstrates
`:changed(--likes)` matches briefly after the state changes: from the next frame until the animations it started have finished. A native `@keyframes` animation therefore plays on every change.

## APIs used
- `:changed(--likes)`: restarts on each new change; never on load or after a no-op.
- `state(0)`, `increment()`, `set()`, `text:` *(experimental)*.

## How to interact
Click **Like** several times, quickly too. Click **Reset**, then **Reset** again.

## Expected result
- Every Like makes the number pop: it grows and turns orange, then settles. Fast clicks restart the pop each time.
- The first Reset animates (the value changed to 0). The second does nothing: it is not a change.
- No animation when the page loads.
- With reduced motion turned on, the number only flashes orange.

## Native CSS alternative
None for "after a change". CSS animations run on load or when a selector starts to match. Without Reactive CSS, restarting an animation on each change needs a script, usually removing and re-adding a class.

## Limitations
- The selector clears when the animations it started end, so use it for animations and transitions, not for lasting styles.
- An animation that is not started by the change (for example, one already running) does not keep the selector on.
