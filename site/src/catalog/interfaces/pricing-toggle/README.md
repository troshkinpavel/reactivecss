# Pricing toggle

## What it demonstrates
A switch with the right semantics. The button has `role="switch"`, and `--attr-aria-checked` keeps its `aria-checked` equal to the state, so assistive technology announces "on" and "off". The price is DOM text picked with `when()`.

## APIs used
- `state(false)` on `.billing`: the billing period.
- `:on(click)` with `toggle()`: flips it.
- `--attr-aria-checked: var(--annual)`: the switch's ARIA state *(experimental)*.
- `content: when(--annual, "$96 / year", "$10 / month")`: the price, as real DOM text *(experimental)*.
- `:when(--annual)`: shows the saving.

## How to interact
Click the switch, or focus it and press Space.

## Expected result
The track turns orange, the price changes to $96 / year and the saving appears; the button's `aria-checked` is `true`.

## Native CSS alternative
A checkbox styled as a switch: `:checked ~ .price` can show the other price if both are in the HTML. Reactive CSS keeps one price element and the ARIA state in sync.

## Limitations
- The track's knob is drawn in base styles; only its color reads the state here.
