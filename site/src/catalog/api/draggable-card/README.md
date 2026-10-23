# Draggable card

## What it demonstrates
A drag gesture. `:on(drag)` runs on every pointer move of a drag, and `event(x)` / `event(y)` give the card's new position: its state when the drag started plus the distance moved. A second drag continues from where the card is.

## APIs used
- `:on(drag(start))`, `:on(drag)` (the move phase), `:on(drag(end))` *(experimental)*: the phases of one gesture.
- `event(x)`, `event(y)`: the proposed position for the state being set: its value when the drag started, plus the distance moved.
- The states live on the section, the shared owner of the card and the readout. For several independent cards, give each card its own wrapper that owns its position.
- `clamp()` in `set()`: keeps the card inside the area.
- `element(width)` / `element(height)` on `:on(pointerenter)` and `:on(focusin)` of the area: the limits follow the area's real size, so the card reaches every edge at any width.
- `:on(keydown(Arrow…), prevent())`: the same states from the keyboard; `prevent()` keeps the page from scrolling.
- `touch-action: none`: needed on anything draggable by touch.

## How to interact
Drag the card with the mouse, a pen or a finger. Release anywhere, even outside the area. Or Tab to the card and use the arrow keys.

## Expected result
The card follows the pointer, stays inside the area, and keeps its position between drags. While dragging it lifts slightly.

## Native CSS alternative
None. HTML drag and drop (`draggable`) moves data, not elements, and needs JavaScript.

## Limitations
- The drag starts after 3 px of movement; a press without movement does nothing.
- Experimental: real touch and pen hardware have not been verified.
