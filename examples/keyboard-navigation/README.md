# Keyboard navigation

A listbox-like list on a deliberately tall page. Arrow keys, Home and End move the selection and focus (roving `tabindex`) and are cancelled with `prevent()`, so the page does not scroll; a lock makes the list's key rule inactive, and the keys scroll the page again. A nested region inside one item has its own keys, and a filter field in the same section keeps its native keys.

Run: `npm run serve`, then open `http://localhost:8080/examples/keyboard-navigation/` or the demo lab (`/examples/lab/`). Tests: `tests/browser/examples-071.spec.ts` (Chromium and WebKit, strict CSP). Validation guide: `docs/browser-validation-0.7.1.md`.

## 1. What it demonstrates

`key()` + `prevent()` (0.7.0) + `focus:` (0.6.0) on a page that really scrolls, conditional event rules, nested key regions and text fields inside a keyboard-controlled section.

## 2. Reactive CSS features

| Feature | Use |
|---|---|
| `state()` | `--i` (selected item), `--locked`, `--q` |
| `key()` + `prevent()` *(0.7.0)* | ArrowUp/Down, Home, End on the list; ArrowLeft/Right on the inner region |
| `:when()` | the list's key rule applies only while `--locked == false` |
| `cycle()`, `set()` | wrapping navigation, Home/End |
| `attr:` | `aria-selected`, roving `tabindex` (`0`/`-1`) |
| `focus:` *(0.6.0)* | the selected item |
| `bind:`, `text:` | the lock checkbox; selected number and quantity |

## 3. What native HTML/CSS does

Page scrolling (PageDown, Space, End when not handled), the text field's caret keys, `role="listbox"`/`role="option"` semantics as markup.

## 4. What would normally need JavaScript

Keydown handlers with `preventDefault()`, roving tabindex bookkeeping and focus calls.

## 5. Limitations found

- **Only for focus inside the list.** If nothing is focused, `key()` falls back to the last-clicked element: actions run, but nothing is cancelled, so the page may scroll.
- **Keys typed in the filter:** the filter is not inside the list, so arrows and Home/End stay with the field. Escape (the section's rule) still runs there: it unlocks the list, without moving focus.
- **The nested region inside an option** is a test fixture: interactive content inside `role="option"` is not a recommended pattern.
- **macOS:** Home/End do not move a text field's caret (platform behavior).

## 6. Accessibility

Roving `tabindex` means one Tab stop for the list. ARIA listbox semantics (`aria-selected`) are real attributes; `aria-activedescendant` is not used (focus moves to the options). Not verified with screen readers.

## 7. Production use

The pattern (roving tabindex + `prevent()` on handled keys) suits lists, toolbars and grids with a fixed number of items.

## 8. Manual test checklist

| Action | Expected |
|---|---|
| Load; click "Apple" | Apple selected (blue), focused |
| Press ArrowDown ×2, End, Home, ArrowUp | Selection and focus: Banana, Cherry, Fig, Apple, then Fig (wraps); the **page does not scroll** |
| Press PageDown (or Space) on an item | The page scrolls (not handled) |
| Check "Lock the list"; focus an item; press End | Selection does not change; the page scrolls to the bottom (native) |
| Uncheck Lock; Tab to the item "Elderberry"'s qty; ArrowRight ×2, ArrowLeft | qty 2; the selection does not change; no scroll |
| Same region: ArrowDown | The list handles it: next item selected and focused |
| Click the filter; ArrowLeft/ArrowRight | The caret moves; selection unchanged |
| Lock the list; in the filter press Escape | The list is unlocked; focus stays in the filter |
| Narrow viewport (320 px) | Still usable; the page still scrolls only for unhandled keys |
| DevTools console | No errors; `ReactiveCSS.diagnostics` empty |

## 9. Browser notes

| Browser | What to watch for |
|---|---|
| Chrome | Clicking a button focuses it. Arrow keys scroll a scrollable page natively. |
| Safari | Clicking a button does **not** focus it, so focus results after a click can differ from Chrome; keyboard (Tab, then Enter/Space) gives the comparable result. Full keyboard access (System Settings → Keyboard) is needed for Tab to reach buttons. |
| Firefox | Not verified by automated tests (Playwright's Firefox does not start on the development machine). Every row of the checklist is open. |

**Safari specifically:** headless WebKit does not scroll on arrow keys at all, so automated tests check arrow cancellation through `defaultPrevented`. In real Safari, check by hand that ArrowDown on a focused item does not scroll the page while unlocked, and does scroll while locked.
