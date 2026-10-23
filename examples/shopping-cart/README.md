# Shopping cart

Three cart lines with − / + / Remove, a subtotal per line, the item count and total, an "empty cart" message, and Checkout and "Empty cart" buttons that are disabled while the cart is empty. Local only: Checkout does nothing.

Run: `npm run serve`, then open `http://localhost:8080/examples/shopping-cart/` (or the demo lab, `examples/lab/`). Tests: `tests/browser/examples.spec.ts`.

## 1. What it demonstrates

Several quantities with **derived native `disabled`** at each bound, cross-element dependencies (Checkout depends on every line), and totals computed by native `calc()` instead of aggregate functions.

## 2. Reactive CSS features

| Feature | Use |
|---|---|
| `state()` | `--q1`, `--q2`, `--q3`, owned by the cart |
| `increment()`, `decrement()`, `set()` | −, +, Remove, Empty cart |
| `attr:` *(0.5.3)* | `disabled` on − at 0, + at 9, Remove at 0, Checkout and Empty cart when every quantity is 0; `hidden` on the empty message; `data-empty` on each line |
| `text:` *(0.5.1)* | quantities, subtotals, item count and total, as real DOM text |

## 3. What native HTML/CSS does

- **Math:** `calc()` on integers, and registered `@property` integers so the browser computes each number before `text:` writes it.
- **Everything else:** `disabled` and `hidden` semantics, `:disabled` and `[data-empty]` styling, the responsive grid.

## 4. What would normally need JavaScript

All of it: quantities, subtotals, totals, enabling and disabling buttons. CSS alone cannot count clicks.

## 5. Limitations found

- **A fixed number of lines.** The cart owns one state per line (`--q1`…`--q3`) because the total needs them all, and CSS has no way to sum values owned by different elements. A cart with a dynamic number of lines needs script (or a server-rendered total). This is the "no aggregate functions" boundary.
- **Rules repeat per line.** No parameterized rules.
- **Whole-dollar prices.** `text:` prints one integer; cents would need formatting (no number formatting in CSS).
- **Prices live in CSS.** `--p1`…`--p3` are CSS numbers. Real prices must come from the server, and the server must compute the charged total.
- **Focus.** Reaching 0 or 9 disables the focused button, and focus returns to the page. CSS cannot move focus.

## 6. Accessibility

- Buttons with accessible names ("Add one notebook"), grouped per line, visible focus.
- Native `disabled` at bounds and on Checkout: announced as unavailable, skipped by Tab (tested).
- Totals are DOM text in a polite live region. Announcements not verified with screen readers.

## 7. Production use

Suitable for a client-side estimate of a small, fixed set of items (a configurator-like order form). Not for a real cart: line items are dynamic, and prices and totals must be computed by the server.

## 8. Manual test checklist

| Scenario | Expected |
|---|---|
| Load | Items 3, total $28; Backpack − and Remove disabled |
| Single click + on Backpack | Qty 1, subtotal $30, total $58; − and Remove enabled |
| Double click + | +2 |
| Rapid clicks on + | Stops at 9; + disabled |
| Tab | Enabled buttons only, line by line, then Checkout / Empty cart |
| Enter / Space | Same as clicks |
| Remove | Line qty 0, name struck through |
| Empty cart | All 0; "Your cart is empty."; Checkout and Empty cart disabled |
| Narrow viewport (320 px) | Lines wrap into two columns |
| Strict CSP | No violations, no console errors |
| Browser differences | WebKit does not focus buttons on click |
