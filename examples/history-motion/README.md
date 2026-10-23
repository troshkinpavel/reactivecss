# History and motion

A level from 0 to 20 with Up, Down, +5 and Reset. The previous value and the direction of the last change are shown as text; the bar width transitions natively; the value pulses (or dips) on every change via `:changed()`. Reduced motion turns both off.

Run: `npm run serve`, then open `http://localhost:8080/examples/history-motion/` or the demo lab (`/examples/lab/`). Tests: `tests/browser/examples-071.spec.ts` (Chromium and WebKit, strict CSP). Validation guide: `docs/browser-validation-0.7.1.md`.

## 1. What it demonstrates

`previous()`, `direction()`, `:changed()` with native transitions and keyframes, rapid repeated actions and bounds.

## 2. Reactive CSS features

| Feature | Use |
|---|---|
| `state()`, `increment()`, `decrement()`, `set()` | the level |
| `previous()`, `direction()` | history text |
| `:changed()` | restarts the pulse/dip on each change |
| `attr:` | `disabled` on Up/+5/Down at the bounds |
| `text:` | value, previous, direction, words |

## 3. What native HTML/CSS does

`transition`, `@keyframes`, `@media (prefers-reduced-motion: reduce)`.

## 4. What would normally need JavaScript

A counter with history and restartable animations.

## 5. Limitations found

- `previous()` is the value before the **last** change; intermediate values of a burst are not kept.
- Reset to the same value (5 → 5) is not a change: nothing animates.
- No JavaScript animation runtime: motion is CSS only.

## 6. Accessibility

The value is in a polite live region. Motion is off under reduced motion. Not verified with screen readers.

## 7. Production use

Counters, steppers, scoreboards.

## 8. Manual test checklist

| Action | Expected |
|---|---|
| Click Up | 6; previous 5; direction 1; "went up"; the value pulses; the bar grows smoothly |
| Click Down | 5; previous 6; direction -1; "went down"; the value dips |
| Click +5 rapidly (6×) | Stops at 20; Up and +5 disabled |
| Turn on Reduce motion (OS setting), click Down | 19; no pulse, no bar transition |
| Click "Reset to 5" twice | First: change (animates); second: no change |
| Keyboard: Tab to the buttons, Enter/Space | Same as clicks |
| DevTools console | No errors; `ReactiveCSS.diagnostics` empty |

## 9. Browser notes

| Browser | What to watch for |
|---|---|
| Chrome | Clicking a button focuses it. Arrow keys scroll a scrollable page natively. |
| Safari | Clicking a button does **not** focus it, so focus results after a click can differ from Chrome; keyboard (Tab, then Enter/Space) gives the comparable result. Full keyboard access (System Settings → Keyboard) is needed for Tab to reach buttons. |
| Firefox | Not verified by automated tests (Playwright's Firefox does not start on the development machine). Every row of the checklist is open. |
