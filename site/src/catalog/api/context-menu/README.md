# Context menu

## What it demonstrates
A custom context menu with no script. A `contextmenu` rule cancels the browser's own menu with `prevent()`, stores where the right-click happened, and opens the menu there. Clicks, Escape and a press outside close it.

The position is an event-time value: `event(local-x)` and `event(local-y)` are read once, at the right-click, and clamped with `element(width)` and `element(height)` so the menu stays inside the desk.

## APIs used
- `.desk:on(contextmenu, prevent())`: runs on a right-click, a long press on touch screens, or the Menu key and Shift+F10, and cancels the native menu.
- `event(local-x)`, `event(local-y)`, `element(width)`, `element(height)`: the position, read at the event and clamped inside the desk.
- `.desk:on(click)`, an item's `:on(click)`, `.stage:on(keydown(Escape))` and `.ctx:on(outside(pointerdown))`: the ways to close.
- `attr(data-action)` in `set()`: the clicked item's action, shown as DOM text with `content`.
- `focus: when(--restore)` on the desk: focus returns to the desk after Escape or a choice *(experimental)*. The menu is a sibling of the desk, not inside it: a focus request is dropped when focus is already inside its target.

## How to interact
Right-click anywhere on the desk, then pick an item. From the keyboard, focus the desk with Tab and press Shift+F10 or the Menu key, then Tab into the items; Escape closes the menu.

## Expected result
The menu opens at the pointer, never past the desk's edges, and the browser's menu does not appear. Choosing an item closes the menu and shows the action under the desk.

## Native CSS alternative
None. CSS cannot cancel the native menu or open an element at a position. The `popover` attribute gives light dismiss, but not a position or a right-click trigger.

## Limitations
- Focus does not move into the menu when it opens. Focus requests are armed only by click, keydown, input, change, pointerup and submit, and a right-click is a `contextmenu` event. Tab moves into the items.
- Arrow keys do not move between items: there is no action that moves focus to a selector. Use Tab and Shift+Tab.
- A menu opened from the keyboard appears where the browser reports the event, usually the desk's top-left corner.
