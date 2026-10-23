# Attribute sync

## What it demonstrates
Real DOM attributes driven by a state. `--attr-aria-expanded` writes the button's `aria-expanded`, and `--attr-hidden` adds or removes the panel's `hidden` attribute. The line under the button is native CSS `attr()`, which prints the attribute as it is in the DOM.

## APIs used
- `state(false)` and `.toggle:on(click) { --open: toggle() }`: the disclosure's state.
- `--attr-aria-expanded: var(--open)` *(experimental)*: `"true"` or `"false"`, as ARIA requires.
- `--attr-hidden: when(not --open)`: a boolean attribute, present when true and removed when false.

## How to interact
Click the button, or Tab to it and press Enter or Space.

## Expected result
The panel opens and closes, and the text under the button switches between `aria-expanded="false"` and `aria-expanded="true"`.

## Native CSS alternative
`<details>` and `<summary>` give a disclosure with no script at all, and are usually the better choice. Reactive CSS is useful when a custom button must report its state through ARIA attributes that styles cannot write.

## Limitations
- `--attr-*` is a reserved namespace: a custom property named like an allowlisted attribute writes that attribute. Rename existing `--attr-*` properties that are not meant as attributes.
- Only an allowlist of attributes can be written (ARIA states, `data-*`, `disabled`, `hidden`, `required`, `tabindex`).
