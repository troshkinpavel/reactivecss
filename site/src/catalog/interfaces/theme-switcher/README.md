# Theme switcher

## What it demonstrates
A keyword state with more than two values. `cycle()` moves to the next keyword and wraps at the end; `:when()` rules pick the colors, and `content` writes the theme's name into the button.

## APIs used
- `state(light)` on `.themes`: a keyword state.
- `:on(click)` with `cycle(light, dark, sepia)`: the next theme.
- `:when(--theme == dark)`: one rule per theme.
- `content: var(--theme)`: the button's label, as DOM text that screen readers read *(experimental)*.

## How to interact
Click the Theme button several times.

## Expected result
The section turns dark, then sepia, then light again, and the button names the current theme.

## Native CSS alternative
`prefers-color-scheme` follows the system setting, and `color-scheme` with `light-dark()` picks colors from it. CSS alone cannot let the reader choose a theme on the page.

## Limitations
- The choice is not kept after a reload. Add `persist("theme")` to the state for that; it cannot store anything inside this sandboxed preview.
