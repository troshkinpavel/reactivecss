# State selection

API example 13. Open `index.html` through a local server (`npm run serve`, then `http://localhost:8080/examples/api/state-selection/`). Tests: `tests/browser/api-examples.spec.ts`.

## What it demonstrates
`:nth-var(--choice)` matches the element whose position among its siblings equals a state's value. One number selects one card, whichever control changed it.

## APIs used
- `:nth-var(--choice)`: the selected card, counted like `:nth-child()`.
- `set(--choice, sibling-index())`: a card sets the state to its own position.
- `cycle(--choice, 1, 2, 3, 4)` and the reversed list: **Next** and **Previous**, wrapping around.
- `attr: aria-pressed` *(experimental)*: the selected card is pressed, as a real attribute that native CSS styles.
- `state(1)`, `text:` *(experimental)*.

## How to interact
Click a card, or use **Previous** and **Next**.

## Expected result
Exactly one card is selected at a time: dark border, "Selected" label, `aria-pressed="true"`. The readout shows its position (1–4), and Next wraps from 4 to 1.

## Native CSS alternative
For picking one of several options in a form, native radio buttons with `:checked` (and `:has()` for the card style) do this without a library, and they bring arrow-key navigation: prefer them there. `:nth-var()` is for when the index comes from state, as with the Previous and Next buttons, a timer or keyboard rules.

## Limitations
- The state's value must be an integer.
- The cards are toggle buttons in a labelled group, not a radio group, so there is no arrow-key navigation between them.
