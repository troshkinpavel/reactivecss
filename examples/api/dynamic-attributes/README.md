# Dynamic attributes

API example 10. Open `index.html` through a local server (`npm run serve`, then `http://localhost:8080/examples/api/dynamic-attributes/`). Tests: `tests/browser/api-examples.spec.ts`.

## What it demonstrates
`attr: disabled when(…)` adds or removes the real HTML `disabled` attribute when a condition changes. The browser then blocks the button itself: there is no fake disabled look.

## APIs used
- `state(1)`, `increment()`, `decrement()`: the quantity.
- `attr: disabled when(--qty <= 1)` and `when(--qty >= 5)` *(experimental)*: present when true, removed when false (never `disabled="false"`).
- `text: var(--qty)` *(experimental)*.

The readout under the buttons is native CSS: `:has(.plus[disabled])` reads the attribute from the DOM.

## How to interact
Click + until 5, then − until 1. Check the buttons in the developer tools' Elements panel.

## Expected result
- At 1, − has `disabled`; at 5, + has `disabled`.
- Disabled buttons ignore clicks, so the value stays between 1 and 5, even for fast repeated clicks: the attribute is set during the click that reaches the limit.
- The readout says which button has the attribute.

## Native CSS alternative
None for changing an attribute. CSS can only style attributes that are already there. A native `<input type="number" min="1" max="5">` enforces a range by itself; prefer it when a number field fits the design.

## Limitations
- **`disabled` removes the button from the Tab order.** A focused button that becomes disabled loses focus. If focus must stay, use `attr: aria-disabled when(…)` instead: the button stays focusable and is announced as unavailable. But `aria-disabled` does not block clicks, so you must also make the action inactive with a conditional `on:` rule. The library's `product-configurator` example shows that pattern.
- Only allowlisted attributes can be written (`disabled`, `hidden`, `required`, some ARIA, `tabindex` 0/−1, `data-*`).
