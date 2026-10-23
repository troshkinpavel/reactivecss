# Product configurator

Two product cards. Each has a quantity (1–10, buttons and a number field), a color (radio group), gift wrapping (checkbox), a live total (real DOM text, 0.5.1) and a native reset. It is a local UI: no checkout, no network requests, nothing stored.

Run: `npm run serve`, then open `http://localhost:8080/examples/product-configurator/`. Tests: `tests/browser/examples.spec.ts` (Chromium and WebKit, strict CSP).

## 1. What it demonstrates

Form controls and buttons driving the same state, a total computed by **native CSS math** from that state, quantity buttons that are **natively disabled** at a bound (0.5.3), and independent component instances.

## 2. Reactive CSS features

| Feature | Use |
|---|---|
| `state()` | `--qty`, `--color` (a keyword state used directly as a color), `--gift`, owned by each `<form>` |
| `bind:` | number field ↔ `--qty`, radio group ↔ `--color`, checkbox ↔ `--gift`, including native form reset |
| `increment()`, `decrement()` | the − and + buttons |
| `attr:` *(0.6.0)* | `attr: aria-disabled when(--qty >= 10)` on +, `when(--qty <= 1)` on −, with clamp rules (`:when()` + `on:`) that make the action inactive |
| `:when()` | the gift ribbon |
| `when()` | `--extra: when(--color == silver, 1000, 0)` |
| `text:` *(0.5.1)* | the total's dollar amount, as real DOM text |

## 3. What native HTML/CSS does

- **The price math:** `calc()` and `clamp()` on integer cents. A native `@property --dollars { syntax: "<integer>" }` makes the browser compute the dollar amount, and `text:` writes it.
- **Everything else native:**
  - the number field's own arrows and keyboard;
  - `:invalid` for typed values outside 1–10;
  - radio group arrow keys;
  - the reset button;
  - the color swatch transition.

## 4. What would normally need JavaScript

Keeping the buttons and the field in sync, the bounded quantity, and the total: CSS cannot read a number field's value. Native CSS alone can style by `:checked` (color, gift) but cannot compute a total from a typed quantity.

## 5. Limitations found

- **Formatting.** The total is real DOM text since 0.5.1 (`$<span>595</span>.00`), so it can be selected, copied and found. But `text:` prints one value without formatting: every price is a whole dollar amount, which keeps ".00" fixed in the HTML. Prices with cents would need two values and zero padding, or script (`Intl.NumberFormat`).
- **`<output>` and reset.** The total is not in an `<output>` element. On form reset, WebKit replaces an output's children with its default text, which destroyed the bound span in testing.
- **Bounds (0.5.3).** The buttons are natively `disabled` at a bound, written in the same task as the click. 12 synchronous clicks, rapid real clicks and repeated Enter all stop at 10 (tested). The 0.5.2 clamp rules are gone.
- **Focus (0.6.0).** At a bound the button reports `aria-disabled="true"` and stays focusable. A keyboard user can press Enter at 10 without losing focus (tested). With native `disabled` (0.5.3), the focused button lost focus to the page.
- **Typed values outside 1–10** are kept in the state (`bind:` does not validate). The field shows native `:invalid`, and the total uses `clamp(1, qty, 10)`. At 50, + is disabled; − steps down from 50.
- **Defaults written twice:** `state(1)` and `value="1"`, `state(black)` and `checked`.

## 6. Accessibility

- Native controls: a fieldset and legend for each group, labels, real buttons with accessible names, and visible focus.
- The total is DOM text in a polite live region. Whether screen readers announce its changes was **not** verified with a real screen reader.
- **`aria-disabled` vs `disabled`.** At a bound the button is `aria-disabled="true"`: announced as unavailable, but still focusable and clickable. A more specific `on:` rule replaces the action with a clamp (`set(--qty, 10)`), so clicks at the bound do nothing, including 12 same-task clicks (tested). `aria-disabled` itself blocks nothing. The shopping cart keeps native `disabled`, which blocks clicks itself but drops focus.

## 7. Production use

Suitable for a visual price estimate next to a server-calculated total. Not the only place a price is shown: there is no number formatting, accessibility is unverified with screen readers, and prices must come from the server anyway.

## 8. Manual test checklist

| Scenario | Expected |
|---|---|
| Load | Total $49.00; − disabled; + enabled |
| Single click + | Quantity 2; total $98.00; − enabled |
| Double click + | Quantity +2 |
| Rapid clicks on + (10+) | Stops at exactly 10; + disabled |
| Tab | Moves through −/field/+/radios/checkbox/reset; disabled buttons are skipped |
| Enter / Space on + | Increments; at 10 the button stays focused and nothing changes |
| Reset | Quantity 1, black, no gift, $49.00; − disabled again |
| Typed value 50 | Field `:invalid`; + disabled; total uses 10 |
| Two cards | Changing one never changes the other |
| Narrow viewport (320 px) | Cards stack; nothing overflows |
| Strict CSP (`style-src 'self'`) | No violations, no console errors |
| Browser differences | WebKit does not focus a button on click; otherwise identical |
