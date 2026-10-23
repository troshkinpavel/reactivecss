# Accordion

## What it demonstrates
State ownership. `--open` is declared on `.item`, so every item has its own copy: a click on one button toggles only the state of the item around it.

## APIs used
- `state(false)` on `.item`: one boolean per item.
- `:on(click)` with `toggle()`: flips the item's state.
- `--attr-aria-expanded: var(--open)`: the button reports the state to assistive technology *(experimental)*.
- `:when(--open)` and `when(--open, 180deg, 0deg)`: the body and the chevron read it.

## How to interact
Click a question, or focus it with Tab and press Enter or Space.

## Expected result
The answer opens under its question and the chevron turns. Other items keep their own state.

## Native CSS alternative
`<details>` and `<summary>` give an accordion with no script and the right semantics, and `<details name="faq">` makes it exclusive. Prefer them when nothing else on the page needs to know which item is open; this version shows how state stays per item.

## Limitations
- The answers are hidden with `display: none`, so the browser's find-in-page does not open them, unlike `<details>`.
