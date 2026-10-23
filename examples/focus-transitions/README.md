# Focus transitions

Three panels switched by buttons, Previous/Next and a native popover menu. Focus follows user-initiated panel changes to the new panel's heading (or to Confirm on panel 3); a hidden section is revealed and focused in one action; a locked (disabled) Confirm and the open popover deliberately keep focus where it is.

Run: `npm run serve`, then open `http://localhost:8080/examples/focus-transitions/` or the demo lab (`/examples/lab/`). Tests: `tests/browser/examples-071.spec.ts` (Chromium and WebKit, strict CSP). Validation guide: `docs/browser-validation-0.7.1.md`.

## 1. What it demonstrates

Every rule of `focus:` (0.6.0) in one interface: transitions only, user activation only, eligibility, document order, and the cases where focus must **not** move (no transition, a disabled target, focus or the click inside an open popover).

## 2. Reactive CSS features

| Feature | Use |
|---|---|
| `state()` | `--panel` (1–3), `--more`, `--locked`, owned by the section |
| `set()`, `increment()`, `decrement()`, `toggle()` | panel buttons, Previous/Next, Show extra details |
| `:nth-var()` | the visible panel |
| `focus:` *(0.6.0)* | panel 1 and 2 headings, Confirm on panel 3, the extra-details heading |
| `attr:` | `disabled` on Previous/Next at the ends, on Confirm while locked; `aria-expanded`; `hidden` on the extra details |
| `bind:` | the Lock checkbox |
| `text:` | "Panel N of 3" |

## 3. What native HTML/CSS does

The `popover` attribute and `popovertarget` (open, light dismiss, Escape), `tabindex="-1"` on the headings, `:focus-visible`.

## 4. What would normally need JavaScript

Moving focus after a state change (`element.focus()` in each click handler), and keeping it inside an open popover.

## 5. Limitations found

- **Disabled targets are skipped, not retried.** Locking Confirm and then going to panel 3 leaves focus where it was. Unlocking later does not move focus.
- **Focus after a click differs by browser** (see section 9), but never lands behind an open popover.
- **No focus restoration** when the popover closes: the browser decides (native behavior).

## 6. Accessibility

- Headings are made focusable by the author (`tabindex="-1"`), never by the library.
- Moving focus to a heading after a step change is a common pattern, but whether screen readers announce it well is **not verified**.

## 7. Production use

Suitable for step and panel interfaces where a user action changes the visible section.

## 8. Manual test checklist

| Action | Expected |
|---|---|
| Load the page | Focus is on the page (`<body>`); nothing is focused automatically |
| Click "Panel 2" | Panel 2 is shown; focus on the "Panel 2: Details" heading |
| Click "Show extra details" | Extra details appear (`hidden` removed), `aria-expanded="true"`, focus on "Extra details" |
| Click "Panel 1", then Next twice quickly | Panel 3; focus on Confirm (never on panel 2's heading at the end) |
| Check "Lock the Confirm button", go to panel 1, then panel 3 | Confirm is disabled; focus stays on the panel 3 button (Chrome) or `<body>` (Safari): **deliberately unchanged** |
| Uncheck Lock; open "Jump menu"; click "Go to panel 1" | Panel 1 shown behind the popover; focus stays in the popover (Chrome: the button; Safari: `<body>`), not on the panel 1 heading |
| Escape, then Tab to Next and press Enter | Popover closes; panel 2; focus on its heading, focus ring visible |
| Type in the panel 1 field, then click "Panel 1" | No change of panel, so focus is not moved to the heading |
| Narrow viewport (320 px) | Buttons wrap; nothing overflows |
| DevTools console | No errors. `ReactiveCSS.diagnostics` may contain one note about the disabled Confirm (by design) |

## 9. Browser notes

| Browser | What to watch for |
|---|---|
| Chrome | Clicking a button focuses it. Arrow keys scroll a scrollable page natively. |
| Safari | Clicking a button does **not** focus it, so focus results after a click can differ from Chrome; keyboard (Tab, then Enter/Space) gives the comparable result. Full keyboard access (System Settings → Keyboard) is needed for Tab to reach buttons. |
| Firefox | Not verified by automated tests (Playwright's Firefox does not start on the development machine). Every row of the checklist is open. |
