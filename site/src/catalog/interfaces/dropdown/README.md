# Dropdown menu

## What it demonstrates
Three ways to close one menu, and focus that goes where the user expects. `outside(click)` closes the menu on a click anywhere else on the page, Escape closes it, and a choice closes it and records which item was chosen.

## APIs used
- `state(false)` on `.dropdown`: the open state, read by the button and the list.
- `:on(outside(click))`: runs when a click happens outside `.menu`.
- `:on(keydown(Escape))`: keys are heard on the focused element and its ancestors, so Escape works from the button and from the items.
- `attr(data-choice)` in `set()`: the clicked item's `data-choice` attribute, read once at the click.
- `--attr-aria-expanded`: the button reports the state *(experimental)*.
- `focus: when(--open)` and `focus: when(--back)`: focus moves into the menu when it opens and back to the button after Escape or a choice *(experimental)*.

## How to interact
Open the menu, choose an item, open it again and press Escape, then open it and click outside.

## Expected result
The menu closes in all three cases. After Escape or a choice the focus is back on the Options button; after a click outside it stays where you clicked.

## Native CSS alternative
The `popover` attribute with `popovertarget` gives light dismiss and Escape without a script. Prefer it for a plain menu; this version also records the choice and manages focus.

## Limitations
- Arrow keys do not move between items: Tab and Shift+Tab do.
