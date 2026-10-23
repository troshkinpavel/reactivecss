# Visibility detection

API example 16. Open `index.html` through a local server (`npm run serve`, then `http://localhost:8080/examples/api/visibility/`). Tests: `tests/browser/api-examples.spec.ts`.

## What it demonstrates
`visible(threshold)` is `1` while at least that share of an element is visible, otherwise `0`. Reactive CSS keeps it current with one shared `IntersectionObserver` per threshold. There is no scroll listener.

## APIs used
- `visible(0.6)`: on the target.

Native CSS does the rest:
- `calc()` turns the 0/1 value into opacity and scale;
- a style query (`@container style(--seen: 1)`) switches the status text.

## How to interact
Scroll inside the box, with the mouse or touch, or focus the box and use the arrow keys. Then scroll back up.

## Expected result
- While less than 60 % of the target is visible, it is faded and slightly smaller, and the status line says "target: out of view".
- When it scrolls into view, it fades in, grows to full size, and the status says "target: in view ✓".
- Scrolling it out again reverses this.

## Native CSS alternative
- **Partly native:** scroll-driven animations (`animation-timeline: view()`) can fade an element as it scrolls through a scroller, with no script. Prefer them for purely visual effects.
- **What `visible()` adds:** a 0/1 value that other CSS can compute with, as here with the style query.

## Limitations
- The status line is generated content: not selectable, and not reliably announced.
- `visible()` is `0` until the first observation, so the target starts faded for a frame.
- Style queries on custom properties need a recent browser. They work in the tested Chromium and WebKit; elsewhere the status stays "out of view", but the target still fades.
