# Element size

## What it demonstrates
`element(width)` gives an element its own measured width as a CSS length. The text inside the card is sized from that measurement, not from the slider value, so it also follows when the card is limited by the available space.

## APIs used
- `element(width)` *(experimental)*: the card's border-box width in px, updated when it resizes, from one shared `ResizeObserver`.
- `:on(input) { --width: set(event(value-as-number)) }`: the slider's value, copied into the section's state.
- `content: var(--width)`: the slider readout.

## How to interact
Drag the slider, or focus it and use the arrow keys. Narrow the window to see the measured width differ from the slider value.

## Expected result
The card gets wider or narrower, the "Aa" grows and shrinks with it, and the readout shows the measured width.

## Native CSS alternative
Container queries and container units (`cqw`) size content from a container and are usually the better tool. `element()` measures the element itself, which container units cannot.

## Limitations
- There is no value before the first measurement, so `var(--w, 300px)` gives a fallback for that first frame.
- Do not size the element from its own measurement (`width: calc(element(width) + 10px)`): the runtime detects that loop and freezes the value.
