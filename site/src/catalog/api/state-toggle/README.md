# State toggle

## What it demonstrates
A boolean state flipped by `toggle()`. `:when(--on)` turns whole rules on and off, `when()` picks the label, and `--attr-aria-pressed` keeps the button's `aria-pressed` attribute in sync.

## APIs used
- `state(false)`: a boolean owned by `.toggle`.
- `.switch:on(click) { --on: toggle() }`: flips it on every click.
- `:when(--on)`: the track and knob rules apply only while `--on` is true.
- `when(--on, "On", "Off")` with `content`: the label text.
- `--attr-aria-pressed: var(--on)` *(experimental)*: writes `aria-pressed="true"` or `"false"` on the button.

## How to interact
Click the switch, or Tab to it and press Enter or Space.

## Expected result
The knob slides, the track takes the accent color, the label reads On or Off, and the button's `aria-pressed` follows.

## Native CSS alternative
A checkbox and `:checked` style a two-state control without any script, and are the right choice inside a form. A button with `aria-pressed` is the pattern for a toggle that is not a form value; keeping that attribute in sync is what needs a script without Reactive CSS.

## Limitations
- The state is not stored: a reload turns the switch off again.
