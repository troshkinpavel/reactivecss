# Context menu

API example 17. Open `index.html` through a local server (`npm run serve`, then `http://localhost:8080/examples/api/context-menu/`). Tests: `tests/browser/api-examples.spec.ts`. Design: [docs/rfc-pointer-snapshot.md](../../../docs/rfc-pointer-snapshot.md).

## What it demonstrates
`mouse(x, local)` and `mouse(y, local)` inside `set()` store where a click happened, once. A menu then opens at that point and stays there when the pointer moves on.

## APIs used
- `set(--menu-x, mouse(x, local))`, `set(--menu-y, mouse(y, local))` *(experimental)*: the click position in px, from the top-left corner of `.area`'s border box. The states must be length states (`state(0px)`).
- `:when(--open)` shows the menu; `key(Escape, …)` and the menu buttons close it.
- `set(--choice, attr(data-label))` and `text:` show the chosen action.
- `focus:` *(experimental)* moves focus into the menu when it opens, and back to the area when it closes.

Native CSS does the rest:
- `left` / `top` with `min()` place the menu and keep it inside the area;
- `round(var(--menu-x) / 1px)` and counters print the numbers.

## How to interact
Click anywhere in the dashed area. Choose an action, press Escape, or click somewhere else in the area to move the menu. With the keyboard: Tab to the area, press Enter or Space.

## Expected result
The menu's top-left corner is at the click point (or moved left or up to stay inside the area). The readout shows `x … y …` of the click. When the pointer moves, the menu stays. Enter or Space opens the menu at the center of the area, because a keyboard click has no pointer position. A chosen action shows in the readout, and focus returns to the area.

## Native CSS alternative
None for the position. Native popovers and anchor positioning place a menu next to an element, not at a point inside it. `on(click, mouse(x))` is not a substitute: `mouse()` stays a live source and follows the pointer after the click. Without Reactive CSS this is a `click` listener that copies `offsetX` / `offsetY` into custom properties.

## Limitations
- **`click` only, not `contextmenu`.** `contextmenu` is not an `on:` trigger, and `prevent()` cannot cancel it, so a right-click still opens the browser's menu.
- **Not an ARIA menu.** The menu is a list of buttons: no arrow-key navigation and no `role="menu"`. Use it for actions that are also available elsewhere.
- **Clicking outside the area does not close the menu.** `outside(click, set(--open, false))` on the menu would also run for the click on the area that opens it, after the area's own actions, so the menu would never open.
- **Readout support:** printing the numbers needs CSS typed arithmetic (`length / length`), as in [Mouse tracker](../mouse-tracker/).
