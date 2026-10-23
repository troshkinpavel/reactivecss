# Tabs

## What it demonstrates
A complete tab set from one number state. A click writes the tab's position, arrow keys cycle it, and every visible and accessible detail reads it: the selected tab, its `aria-selected` and `tabindex`, the panel, and the focus.

## APIs used
- `state(1)` on `.tabs`: the tab set owns the selection, so the tabs and the panels inside it can read it.
- `:on(click)` with `set(sibling-index())`: the clicked tab's position.
- `:on(keydown(ArrowRight), prevent())` with `cycle(1, 2, 3)`: the next tab, wrapping at the end; `prevent()` stops the arrow key from scrolling the page.
- `:nth-var(--active)`: the tab and the panel at that position.
- `--attr-aria-selected` and `--attr-tabindex`: the ARIA tab pattern, written as real attributes *(experimental)*.
- `focus: when(--active == 2)`: focus follows the selection after a key press *(experimental)*.

## How to interact
Click a tab. Or press Tab to reach the selected tab and use the left and right arrow keys.

## Expected result
The selected tab is underlined, its panel is shown, and focus moves with the arrow keys. Tab leaves the tab list in one step, because only the selected tab has `tabindex="0"`.

## Native CSS alternative
None for the selection itself. Native HTML has no tab element; `<details name>` gives an exclusive accordion, not tabs.

## Limitations
- The number of tabs is written in the stylesheet (`cycle(1, 2, 3)` and one focus rule per tab).
- Home and End are not handled.
