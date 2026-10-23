# Conditional state

## What it demonstrates
The difference between a stored state and conditional styling. `--phase` stores one keyword; `cycle()` moves it through idle, loading and done. Everything else is derived from it: `when()` chooses single values, and `:when()` applies whole rules.

## APIs used
- `state(idle)`: a keyword state on `.status`.
- `:on(click) { --phase: cycle(idle, loading, done) }`: the next value in the list, wrapping around.
- `when(--phase == done, #1a7f37, #b8b2a8)`: a value chosen by a condition.
- `:when(--phase == loading)`: a rule that applies only while the condition holds (the pulsing dot).
- `content`: the label and the button text.

## How to interact
Press the button repeatedly, or Tab to it and press Enter.

## Expected result
The badge reads idle, loading, done and idle again. The dot is grey, pulses in the accent color while loading, and turns green when done. The button reads Start, Next or Reset.

## Native CSS alternative
None for the stored value. Native `if()` (where supported) chooses values from conditions, but CSS cannot store which step the widget is on.

## Limitations
- A demonstration of state only: nothing actually loads.
- The pulse animation stops under `prefers-reduced-motion` in the site previews.
