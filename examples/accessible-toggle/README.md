# Accessible toggle button

A pressed-state toggle button and a disclosure button. Their `aria-pressed` and `aria-expanded` attributes are **real DOM attributes**, kept in sync with Reactive CSS state.

Run: `npm run serve`, then open `http://localhost:8080/examples/accessible-toggle/`. Tests: `tests/browser/examples.spec.ts` (Chromium and WebKit, strict CSP).

## 1. What it demonstrates

`state(initial, bind(attribute))` (0.5.2):
- the button's own attribute initializes the state (`aria-pressed="true"` starts pressed);
- every state change writes the attribute, synchronously;
- the styles use plain attribute selectors.

```css
.toggle { --pressed: state(false, bind(aria-pressed)); on: click(toggle(--pressed)); }
.toggle[aria-pressed="true"] { background: #1d4ed8; color: #fff; }
```

## 2. Reactive CSS features

| Feature | Use |
|---|---|
| `state(false, bind(aria-pressed))` | the toggle state, mirrored to `aria-pressed="true"`/`"false"` |
| `state(false, bind(aria-expanded))` | the disclosure state, mirrored to `aria-expanded` |
| `on: click(toggle(…))` | mouse, Enter and Space (native button activation) |

## 3. What native HTML/CSS does

- **The buttons:** focus, keyboard activation (Enter, Space) and the accessible role come from native `<button>`.
- **The styling:** the pressed look, the panel and the arrows all use attribute selectors on the real attributes (`[aria-pressed="true"]`, `[aria-expanded="true"] + .panel`).
- **Native alternatives:**
  - for a disclosure, `<details>`/`<summary>` needs no script and no library: prefer it when its look fits;
  - for a pressed toggle, no native element exists (a checkbox is a different control).

## 4. What would normally need JavaScript

Keeping `aria-pressed` and `aria-expanded` in sync with the visual state: one click listener per button that flips the attribute.

## 5. Limitations

- **The attribute belongs to the state's owner.** `bind()` only writes the owner's own attribute: here, the button. The panel's visibility follows from CSS, not from its own `hidden` attribute. Binding `hidden` on the panel would need the panel to own a state that the button's click changes, and an action reaches only the clicking element and its ancestors.
- **One direction after start.** A script that changes `aria-expanded` later is not read back; the next click overwrites it (reported once).
- **Not verified with real screen readers.** The attributes are correct in the DOM and the accessibility tree (tested), but no VoiceOver or NVDA testing was done.

## 6. Accessibility

- Native buttons with visible labels and visible focus.
- Pressed and expanded states are exposed through ARIA attributes, the purpose of this example.
- The ✓ and arrows are decorative (`content: … / ""` gives them empty alternative text).
- `aria-controls` links the disclosure to its panel.

## 7. Production use

The pattern is suitable: native buttons, real attributes, no script of your own. It is experimental in 0.5.2, so keep the usual caveat: test with your screen readers before relying on it.

## 8. Manual test checklist

| Scenario | Expected |
|---|---|
| Load | "Notifications" `aria-pressed="false"`, "Dark mode" `aria-pressed="true"` (from the markup); disclosure `aria-expanded="false"`, panel hidden |
| Single click | The button's attribute flips; style follows |
| Double click | Back to the original value |
| Rapid clicks | Ends on the value matching the number of clicks |
| Tab | Each button in order |
| Enter / Space | Same as a click |
| Removal and reinsertion | The original attribute comes back on removal; a new state starts from it |
| Narrow viewport (320 px) | Buttons wrap |
| Strict CSP | No violations, no console errors |
| Browser differences | WebKit does not focus buttons on click |
