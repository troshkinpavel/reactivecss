# Viewport tracking

API example 15. Open `index.html` through a local server (`npm run serve`, then `http://localhost:8080/examples/api/viewport/`). Tests: `tests/browser/api-examples.spec.ts`.

## What it demonstrates
`viewport(width)` and `viewport(height)` are the viewport size. They compile to the native units `100dvw` and `100dvh`, so the browser keeps them current with no script work at all.

## APIs used
- `viewport(width)`, `viewport(height)`: replaced by `100dvw` and `100dvh` when the stylesheet is compiled.

Native CSS prints the numbers (`round(var(--vw) / 1px)` with counters) and scales the bar.

## How to interact
Resize the browser window, or rotate a phone.

## Expected result
The numbers show the window's inner width and height in px, scrollbars included (the same as `innerWidth` and `innerHeight`). They update while you resize, and the bar grows with the width up to 1600 px.

## Native CSS alternative
This *is* native CSS: write `100dvw` and `100dvh` directly if you prefer. `viewport()` is only a readable shorthand, in the "simplify" category of the feature policy. For layout changes at sizes, use media queries or container queries.

## Limitations
- The value is the dynamic viewport (`dv*` units). Mobile browsers change it when their toolbars show or hide; use `svh` or `lvh` units for the stable sizes.
- **Readout support:** the readout needs CSS typed arithmetic (`length / length`), which the tested Chromium and WebKit support.
