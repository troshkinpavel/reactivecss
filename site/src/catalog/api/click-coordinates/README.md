# Click coordinates

## What it demonstrates
Event-time values. `event(local-x)` and `event(local-y)` are read once, when the click happens, and stored. The marker stays where you clicked until the next click.

`mouse(x, local)` outside a mutation follows the pointer continuously (see the mouse tracker example). Here the value is a snapshot taken by the event.

## APIs used
- `.pad:on(click)`: the rule runs on each click on the pad.
- `event(local-x)`, `event(local-y)`: the click position relative to the pad's border box, in px. `event()` exists only inside mutations of an `:on()` rule.
- `round(…, 1px)` and `set()`: whole pixels, stored in the section's states.
- `increment(1)`: counts the clicks.

## How to interact
Click anywhere on the grid.

## Expected result
The marker jumps to the click and stays there; the readout shows the position in px and the number of clicks.

## Native CSS alternative
None. `:active` matches while the pointer is down, but CSS cannot record where.

## Limitations
- A tap counts as a click on touch screens. Keyboard users cannot click a position, so this is a pointer-only demonstration.
