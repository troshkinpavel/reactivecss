# State history

## What it demonstrates
Every state remembers its value before the last change. `previous()` reads it, `direction()` tells whether the last change went up or down, and `:changed()` matches briefly after each change.

## APIs used
- `previous(--score)`: the value before the last change, shown as DOM text.
- `direction(--score)`: `1`, `-1`, or `0` before any change, used in conditions.
- `:changed(--score)`: applies the bump animation after each change; it stays until that animation ends.
- `:on(click)` with `increment(1)` and `decrement(1)`: the changes.

## How to interact
Press + and − in any order.

## Expected result
The score changes, "before" shows the previous score, the arrow points up in green or down in the accent color, and the number bumps on every change.

## Native CSS alternative
None: CSS keeps no history of values.

## Limitations
- History is one step deep.
- The bump does not play under `prefers-reduced-motion` in the site previews.
