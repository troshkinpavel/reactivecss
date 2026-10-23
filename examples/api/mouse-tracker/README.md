# Mouse tracker

API example 06. Open `index.html` through a local server (`npm run serve`, then `http://localhost:8080/examples/api/mouse-tracker/`). Tests: `tests/browser/api-examples.spec.ts`.

## What it demonstrates
`mouse(x, local)` and `mouse(y, local)` give the pointer position relative to an element. Here they move a dot and show the coordinates.

## APIs used
- `mouse(x, local)`, `mouse(y, local)`: lengths in px from the top-left corner of `.pad`'s border box.

Native CSS does the rest:
- `translate` moves the dot, so no layout runs;
- `:hover` limits the effect to while the pointer is over the area;
- `round(tan(atan2(var(--x), 1000px)) * 1000)` and counters print the numbers (px → number in every engine).

## How to interact
Move the mouse over the grid, or drag a finger on a touch screen.

## Expected result
The dot follows the pointer and the corner shows `x … y …` in px. When the pointer leaves, the dot glides back to the middle.

## Native CSS alternative
None. CSS has `:hover`, but it cannot read the pointer position. Without Reactive CSS this is a `pointermove` listener.

## Limitations
- **Pointer only.** There is no keyboard equivalent; the dot rests in the middle. Use pointer effects for decoration, never for content or controls.
- **One listener:** one `pointermove` listener for the whole page, updated at most once per frame. In `local` mode, scrolling alone does not update the value.
- **Readout:** `tan(atan2(length, 1000px)) * 1000` turns the px length into a number. The shorter `round(var(--x) / 1px)` needs CSS typed arithmetic, which Firefox does not have.
