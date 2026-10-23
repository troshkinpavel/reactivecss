# Keyboard playground

A focusable pad moved with the arrow keys (Escape centers it), focus tracking with `focusin`/`focusout`, nested regions that show how one key press reaches several handlers, and a Reset button that is disabled while there is nothing to reset.

Run: `npm run serve`, then open `http://localhost:8080/examples/keyboard-playground/` (or the demo lab, `examples/lab/`). Tests: `tests/browser/examples.spec.ts`.

## 1. What it demonstrates

The existing keyboard triggers: `key()`, `focusin()`, `focusout()`. It shows their scope (the focused element and its ancestors), the propagation model (every matching ancestor runs), and derived attributes reporting focus and position. No new triggers.

## 2. Reactive CSS features

| Feature | Use |
|---|---|
| `state()` | `--x`, `--y`, `--last` (string), `--focused`, `--outer`, `--inner`, owned by the playground |
| `key(…)` | arrows and Escape on the pad; Enter on the nested regions |
| `focusin()`, `focusout()` *(0.5.1)* | `--focused` |
| `prevent()` *(0.7.0)* | arrow keys on the pad: cancels page scrolling for the handled keys only |
| `attr:` *(0.5.3)* | `data-focused`, `data-x`, `data-y` on the pad; `disabled` on Reset |
| `text:` *(0.5.1)* | coordinates, last key, focus text, counters |

## 3. What native HTML/CSS does

- `tabindex="0"` makes the pad focusable; `:focus-visible` shows it.
- `clamp()` bounds the dot's visual position; `translate` moves it with a transition (off under reduced motion).

## 4. What would normally need JavaScript

Key handling, focus tracking and counting. CSS has `:focus-within` for styling, but no memory of key presses.

## 5. Limitations found

- **Scrolling (0.7.0).** The pad's arrow keys use `prevent()`, so they no longer scroll the page while the pad has focus (tested on a scrollable page). Other keys keep their native behavior. Escape has no default to cancel. Space on the pad is not handled and still scrolls.
- **No stopping propagation.** Enter inside the inner region increments both counters, by design: `key()` runs on the focused element and every ancestor with a matching handler. There is no `.stop`.
- **Enter on a button is also a click.** The target button has no click handler, so only the `key()` handlers run.
- **Unbounded state, bounded view.** `--x`/`--y` keep counting past the clamped position. A bound would need conditional `on:` rules for every key. `attr:` cannot help: keys are not blocked by `disabled` on a `div`.
- **Focus.** Reactive CSS cannot move focus; Reset disables itself after use, and focus then returns to the page.
- **WebKit** does not focus buttons on click; `key()` falls back to the element last pressed with the pointer.

## 6. Accessibility

- The pad is a focusable group with a label that explains the keys, and a described status line (real DOM text).
- It is not an ARIA `application` or `slider`: do not rely on it for real controls. Screen readers in browse mode may intercept arrow keys. Not tested with screen readers.

## 7. Production use

A teaching and test page for keyboard triggers, not a production widget. Use the patterns (scoped `key()`, focus tracking) for shortcuts and small enhancements.

## 8. Manual test checklist

| Scenario | Expected |
|---|---|
| Load | x 0, y 0, last key none; Reset disabled |
| Tab to the pad | "pad focused"; `data-focused="1"`; border highlighted |
| Arrow keys | Dot moves; x/y and last key update; `data-x`/`data-y` follow |
| Rapid arrow presses (key repeat) | Every press counted |
| Escape | Dot centered; last key "Escape" |
| Tab away | "pad not focused" |
| Enter on the inner button | Inner and outer counters +1 |
| Enter on the outer button | Outer +1 only |
| Reset | Everything back to 0 / none; Reset disabled |
| Narrow viewport (320 px) | Pad shrinks; dot stays inside |
| Strict CSP | No violations, no console errors |
| Browser differences | WebKit does not focus buttons on click |
