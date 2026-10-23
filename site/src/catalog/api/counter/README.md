# Counter

## What it demonstrates
A mutable number. `state()` declares it on `.counter`, an `:on(click)` rule on each button changes it with `increment()` or `decrement()`, and `content` writes it into the `<output>` as real text.

## APIs used
- `state(0)`: a number owned by each `.counter`. Every counter on a page has its own.
- `.inc:on(click) { --count: increment(1) }`: the mutation names the state on the left. The button has no state of its own, so it changes the nearest owner, the `.counter` around it.
- `content: var(--count)` *(experimental)*: on an element, a `content` value that reads state becomes the element's DOM text.

## How to interact
Click − or +, or Tab to a button and press Enter or Space.

## Expected result
The number goes down or up by 1 per click, with no limit. Before the script runs, the `<output>` shows its own `0`.

## Native CSS alternative
None for a number that changes on click: CSS has no writable values. Without Reactive CSS this needs a few lines of JavaScript.

## Limitations
- The value lives in the page only: a reload starts at 0 again (see the persistent preference example).
- `<output aria-live="polite">` asks screen readers to announce changes; not verified with a screen reader.
