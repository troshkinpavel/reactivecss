# Focus management

API example 12. Open `index.html` through a local server (`npm run serve`, then `http://localhost:8080/examples/api/focus-management/`). Tests: `tests/browser/api-examples.spec.ts`.

## What it demonstrates
`focus:` moves keyboard focus to an element when its value turns from false to true because of a user action. Here, the heading of the panel that becomes visible receives focus.

## APIs used
- `focus: false` / `focus: true` *(experimental)*: the heading of the current panel is true.
- `:nth-var(--step)`: selects the current panel.
- `state(1)`, `cycle(--step, 1, 2, 3)`: the step, wrapping from 3 back to 1.
- `text:` *(experimental)*: the step number, and "Start over" on the last step.

## How to interact
Click **Next step**, or Tab to it and press Enter. Repeat.

## Expected result
- The next panel appears, and focus moves to its heading, which gets an orange outline. Screen readers read the heading.
- Pressing Tab from there reaches the button again.
- On step 3 the button says "Start over" and goes back to step 1.
- Loading the page does not move focus.

## Native CSS alternative
None: CSS cannot move focus. Native elements manage their own focus (`<dialog>`, `popover`, `autofocus`), and they stay preferred where they fit.

## Limitations
- **Focusable targets only:** the headings need `tabindex="-1"` in the HTML. The library never adds `tabindex`, and an element that cannot take focus is reported and skipped.
- **User actions only:** clicks, keys, `input` and `change`. Script calls, timers and page load never move focus.
- **Focus moved by the user** before the update is applied is respected.
- Not verified with real screen readers.
