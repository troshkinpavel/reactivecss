# Conditional styles

API example 09. Open `index.html` through a local server (`npm run serve`, then `http://localhost:8080/examples/api/conditional-styles/`). Tests: `tests/browser/api-examples.spec.ts`.

## What it demonstrates
One number state with three values drives several styles:
- `when(condition, a, b)` picks a single value;
- `:when(condition)` turns whole rules on and off, including a different `text:`.

## APIs used
- `state(1)`, `set(--wind, n)`: the level, from the buttons.
- `when(--wind == 3, …, …)`: the card background.
- `:when(--wind >= 2)`, `:when(--wind == 3)`, `:when(--wind == 2)`: flag rotation and animation, border, label.
- `attr: aria-pressed when(--wind == n)` *(experimental)*: the pressed button, as a real attribute.
- `text:` *(experimental)*: the label.

## How to interact
Click **Calm**, **Breezy** or **Stormy** (Tab and Enter or Space work too).

## Expected result
| Level | Pressed button | Flag | Card | Label |
|---|---|---|---|---|
| Calm (start) | Calm | upright, dark | light blue | Calm |
| Breezy | Breezy | turned 90°, dark | light blue | Breezy |
| Stormy | Stormy | flapping, orange | light orange with an orange border | Stormy |

## Native CSS alternative
- **Partly native.** Three radio buttons with `:checked` and `:has()` can switch these styles with no library: `.weather:has(.stormy:checked) .card { … }`. Prefer that in a form.
- **Native `if()`:** where the browser has it, `when()` compiles to native `if()` for boolean conditions; number comparisons like these still use the runtime.
- **What a state adds:** the level is one value that other rules, actions and `text:` can compare and set.

## Limitations
- A condition on a missing state, or an impossible comparison, is *unknown*: `when()` gives no value and `:when()` does not match. A warning is logged.
- The flag animation stops under `prefers-reduced-motion: reduce`.
