# Attribute playground

State controls on one side, targets with derived attributes on the other, and a live table that shows the real DOM attribute values (read with CSS `:has()` selectors, no script).

Run: `npm run serve`, then open `http://localhost:8080/examples/attribute-playground/` or the demo lab (`/examples/lab/`). Tests: `tests/browser/examples-071.spec.ts` (Chromium and WebKit, strict CSP). Validation guide: `docs/browser-validation-0.7.1.md`.

## 1. What it demonstrates

Every allowlisted attribute kind in one place, with the exact expressions: `attr: aria-expanded var(--open)`, `attr: disabled when(--locked)`, `attr: aria-disabled when(--busy)`, `attr: data-state var(--status)`, `attr: tabindex when(--selected, 0, -1)`, and `--open2: state(false, bind(aria-expanded))`. The difference between native `disabled` and `aria-disabled`.

## 2. Reactive CSS features

| Feature | Use |
|---|---|
| `attr:` | `aria-expanded`, `hidden`, `disabled`, `aria-disabled`, `data-state`, `tabindex` |
| `state(…, bind(aria-expanded))` | the second disclosure button owns its attribute |
| `bind:` | the state checkboxes and select |
| `on:` + `:when()` | the aria-disabled Save button is inactive while `--busy` |
| `text:` | click counters |

## 3. What native HTML/CSS does

`:has()` + attribute selectors for the live table; `disabled` blocking clicks and removing the button from the Tab order; `hidden`.

## 4. What would normally need JavaScript

Setting every attribute by hand in event handlers, keeping them consistent.

## 5. Limitations found

- `when(--selected, 0, -1)` gives the number tokens `0`/`-1`, which `tabindex` accepts; other values are refused.
- The aria-disabled button needs the extra `:when()` rule: the attribute itself blocks nothing.
- The live table shows absent attributes as "(absent)"/"absent".

## 6. Accessibility

- `disabled`: announced as unavailable, skipped by Tab, clicks blocked natively.
- `aria-disabled="true"`: announced as unavailable, still focusable and clickable; the action is made inactive by CSS.
Not verified with screen readers.

## 7. Production use

A reference page; the patterns themselves are production patterns (disclosures, busy buttons).

## 8. Manual test checklist

| Action | Expected |
|---|---|
| Load | Table: disclosure "false", region hidden present, submit disabled absent, save "false", card "idle", item "-1", bound "false" |
| Click "Toggle --open" (or the Disclosure button) | aria-expanded "true"; region visible; table updates |
| Check --locked; click "Native disabled" | disabled present; the click does nothing (count stays) |
| Check --busy; click and Tab to "aria-disabled" | aria-disabled "true"; it still receives focus and clicks, but the count does not change |
| Uncheck --busy; click it | Count +1 |
| Choose --status "loading" | card data-state "loading", orange border |
| Check --selected; Tab through the page | item tabindex "0": it is now a Tab stop |
| Click "Bound to its own aria-expanded" | Its own attribute "true" (table: bound "true") |
| Narrow viewport (320 px) | Columns stack |
| DevTools console | No errors; `ReactiveCSS.diagnostics` empty |

## 9. Browser notes

| Browser | What to watch for |
|---|---|
| Chrome | Clicking a button focuses it. Arrow keys scroll a scrollable page natively. |
| Safari | Clicking a button does **not** focus it, so focus results after a click can differ from Chrome; keyboard (Tab, then Enter/Space) gives the comparable result. Full keyboard access (System Settings → Keyboard) is needed for Tab to reach buttons. |
| Firefox | Not verified by automated tests (Playwright's Firefox does not start on the development machine). Every row of the checklist is open. |
