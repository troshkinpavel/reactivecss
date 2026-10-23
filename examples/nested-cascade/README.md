# Nested state and cascade

Three nested boxes, each owning `--n`. Buttons change the nearest owner (or an explicit owner with `closest()`); a paragraph without its own state reads the nearest owner's value. Labels, chips and markers show which declaration the cascade chose: specificity, a `:when()` condition, `@layer` order and `!important`.

Run: `npm run serve`, then open `http://localhost:8080/examples/nested-cascade/` or the demo lab (`/examples/lab/`). Tests: `tests/browser/examples-071.spec.ts` (Chromium and WebKit, strict CSP). Validation guide: `docs/browser-validation-0.7.1.md`.

## 1. What it demonstrates

The difference between **runtime state ownership** (which cell an action changes, nearest owner, shadowing) and the **CSS cascade** (which declaration applies to an element), both visible at once.

## 2. Reactive CSS features

| Feature | Use |
|---|---|
| `state()` | `--n` on every `.box` (nested owners) |
| `increment(…, closest(#outer))` | an explicit owner |
| `var(--n)` + `text:` | inherited value in a box's descendants |
| `attr:` | `disabled` on − (ancestor state), `data-layer`, `data-imp` |
| `:when()` | "three or more" |
| `@layer`, `!important` | cascade winners for `attr:` |

## 3. What native HTML/CSS does

The cascade itself: specificity, layers, importance, inheritance of custom properties.

## 4. What would normally need JavaScript

Per-component state containers and prop drilling.

## 5. Limitations found

- `:when()` has the specificity of one pseudo-class, so equal-specificity ties are decided by source order (as here).
- Child combinators keep a rule from reaching nested boxes; without them, a rule for the outer box would also match inner boxes.

## 6. Accessibility

Plain buttons and text. Not verified with screen readers.

## 7. Production use

A teaching page.

## 8. Manual test checklist

| Action | Expected |
|---|---|
| Click + in Inner | Inner n = 1; Outer and Middle unchanged |
| Click "+ outer (closest(#outer))" | Outer n = 1 (the explicit owner), Inner unchanged; the paragraph shows 1 |
| Look at the − buttons | Disabled where that box's n is 0 |
| Labels | Outer and Inner "base", Middle "specific" |
| Click + in Middle 3 times | Middle label "three or more" (the condition wins on source order) |
| Chips | Every chip `data-layer="override"` (green): the later layer wins over higher specificity |
| "imp" markers | Every marker `data-imp="important"` (red) |
| DevTools console | No errors; `ReactiveCSS.diagnostics` empty |

## 9. Browser notes

| Browser | What to watch for |
|---|---|
| Chrome | Clicking a button focuses it. Arrow keys scroll a scrollable page natively. |
| Safari | Clicking a button does **not** focus it, so focus results after a click can differ from Chrome; keyboard (Tab, then Enter/Space) gives the comparable result. Full keyboard access (System Settings → Keyboard) is needed for Tab to reach buttons. |
| Firefox | Not verified by automated tests (Playwright's Firefox does not start on the development machine). Every row of the checklist is open. |
