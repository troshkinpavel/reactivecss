# Form interactions

An order form: a bound name with live text, pickup or shipping (the address field appears and becomes `required` for shipping), a quantity with native min/max validity, a terms checkbox that enables submit, native `:valid`/`:invalid`/`:user-invalid` styling and native reset. `method="dialog"`: nothing is sent or stored.

Run: `npm run serve`, then open `http://localhost:8080/examples/form-interactions/` or the demo lab (`/examples/lab/`). Tests: `tests/browser/examples-071.spec.ts` (Chromium and WebKit, strict CSP). Validation guide: `docs/browser-validation-0.7.1.md`.

## 1. What it demonstrates

Native form semantics driven by state: bindings, real text, conditional `required`, derived `disabled`, validity and reset.

## 2. Reactive CSS features

| Feature | Use |
|---|---|
| `bind:` | name, delivery radios, quantity, terms |
| `text:` | greeting, delivery mode, quantity |
| `attr:` | `hidden` and `required` on the address, `disabled` on submit |
| `:when()` | the guest greeting |

## 3. What native HTML/CSS does

Constraint validation (`required`, `min`/`max`), `:valid`, `:invalid`, `:user-invalid`, form reset, Enter submits, Space toggles checkboxes, `method="dialog"`.

## 4. What would normally need JavaScript

Conditional required fields and enabling submit.

## 5. Limitations found

- One fixed message per state; `validationMessage` is not readable from CSS.
- A hidden address keeps its value (it stays form data).
- Reset restores the HTML defaults; the states follow after the reset event.

## 6. Accessibility

Labels on every control, native validation bubbles, `required` exposed natively. Not verified with screen readers.

## 7. Production use

Replace `method="dialog"` with a real `action`; validate again on the server.

## 8. Manual test checklist

| Action | Expected |
|---|---|
| Load | "Hello, guest!"; address hidden; submit disabled; summary "not ready yet" |
| Type a name | The greeting follows every keystroke |
| Choose "Ship to an address" | Address field appears and is required; summary "Ship" |
| Type 9 in Quantity | The field shows invalid after you leave it; summary "not ready yet" |
| Quantity 3, fill the address, Space on the terms checkbox | Submit enabled; summary "ready" |
| Press Enter in a field / click "Place order" | Nothing navigates; the URL is unchanged |
| Click Reset | Everything back to the defaults (guest, Pick up, 1, submit disabled) |
| Reload | Defaults again: nothing persisted |
| DevTools console | No errors; `ReactiveCSS.diagnostics` empty |

## 9. Browser notes

| Browser | What to watch for |
|---|---|
| Chrome | Clicking a button focuses it. Arrow keys scroll a scrollable page natively. |
| Safari | Clicking a button does **not** focus it, so focus results after a click can differ from Chrome; keyboard (Tab, then Enter/Space) gives the comparable result. Full keyboard access (System Settings → Keyboard) is needed for Tab to reach buttons. |
| Firefox | Not verified by automated tests (Playwright's Firefox does not start on the development machine). Every row of the checklist is open. |
