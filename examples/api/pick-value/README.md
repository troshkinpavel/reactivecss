# Pick a value

API example 04. Open `index.html` through a local server (`npm run serve`, then `http://localhost:8080/examples/api/pick-value/`). Tests: `tests/browser/api-examples.spec.ts`.

## What it demonstrates
`pick(a, b, …)` chooses one of its values at random. Inside `set()`, it chooses again on every click, and the result is an ordinary state that `text:` writes into the page.

## APIs used
- `state("Apple")`: a string state.
- `set(--fruit, pick("Apple", "Pear", "Lemon", "Plum", "Cherry"))`: a new random value from the list.
- `increment(--picks)`: counts the clicks, so a repeated value is still visible as a pick.
- `text:` *(experimental)*.

## How to interact
Click **Pick again**.

## Expected result
The word becomes one of the five fruits, and **picks** goes up by one per click. The same fruit can come up twice in a row, because every pick is independent.

## Native CSS alternative
None for choosing on a click. A native `random()` gives numbers once per page load. It cannot choose words and does not change later.

## Limitations
- All values in one `pick()` must have the same type (here, strings).
- The list can also come from the markup: `pick(split(attr(data-fruits), "|"))` reads a `data-fruits="Apple|Pear|…"` attribute of the clicked element. There are no list states.
