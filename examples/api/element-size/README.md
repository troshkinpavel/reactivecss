# Element size

API example 07. Open `index.html` through a local server (`npm run serve`, then `http://localhost:8080/examples/api/element-size/`). Tests: `tests/browser/api-examples.spec.ts`.

## What it demonstrates
`element(width)` is an element's own border-box width, measured by the browser through a shared `ResizeObserver`. The card uses it to size its letters and to print its width.

## APIs used
- `element(width)` *(experimental)*: the measured width of `.card`, in px.
- `state(300)` with `bind:` on a native range input: the width you ask for.
- `text: var(--width)`: the requested width as text.

## How to interact
Move the slider with the mouse, or focus it and use the arrow keys.

## Expected result
- **set** follows the slider.
- **measured** is the card's real border box: the set width plus 34 px of padding and border. On a narrow screen it is less, because the card is limited to the space available.
- The "Aa" grows and shrinks with the measured width.

## Native CSS alternative
Often enough, and preferred:
- **Container queries and container units** (`cqw`) size content by an ancestor container. With `container-type: inline-size` on the card, `font-size: 16cqw` does the same scaling with no script.
- **What `element()` adds** is the element's own measured size as a value, here printed as a number.

## Limitations
- **Before the first measurement**, the value is empty: the readout is blank for one frame.
- **Feedback loops:** a rule that sets the card's width from its own measured width is detected and frozen with a warning. Here only the height changes with `--w`, and only the width is measured.
- **Readout support:** the readout needs CSS typed arithmetic (`length / length`), which the tested Chromium and WebKit support.
