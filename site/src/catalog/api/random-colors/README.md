# Random colors

## What it demonstrates
Random values at event time. Inside an `:on()` mutation, `random()` and `pick()` are evaluated at each event, so every click gives a new hue and a new word.

## APIs used
- `random(0, 359, 1)`: a whole number from 0 to 359 (the third value is the step, as in native CSS).
- `pick("calm", "bold", "bright", "soft")`: one value from the list.
- `.roll:on(click)` with `set()`: stores both in the section's states.

## How to interact
Press New color, or Tab to it and press Enter or Space.

## Expected result
The swatch changes color, and the readout shows the hue and a word. A roll can repeat a previous value.

## Native CSS alternative
Native `random()` (where the browser supports it) gives each element a random value when styles are computed, and Reactive CSS leaves such calls to the browser. Rolling a new value on a click is what needs the runtime, or JavaScript.

## Limitations
- `random()` and `pick()` outside a mutation are rolled once, not on every event.
