# Multi-step wizard

Four steps (Introduction, Preferences, Configuration, Review) plus a completion panel, with Back, Next and Finish, a step indicator, a progress bar and a "Step N of 4" status. Two independent instances. Nothing is submitted.

Run: `npm run serve`, then open `http://localhost:8080/examples/multi-step-wizard/`. Tests: `tests/browser/examples.spec.ts`.

## 1. What it demonstrates

State-driven navigation through sibling panels. Native constraint validation (`required`, `:invalid`) gates the Next button, without a validation engine.

## 2. Reactive CSS features

| Feature | Use |
|---|---|
| `state()` | `--step` (1–4, 5 = done), `--tried` (Next was pressed on an invalid step) |
| `focus:` *(0.6.0)* | the current step's `<h2 tabindex="-1">` gets focus when a user action changes the step |
| `attr:` *(0.5.3)* | `aria-current="step"` on the current `<li>`; native `disabled` on Back at step 1, on Next at step 4, and on Finish outside step 4 |
| `increment()`, `decrement()`, `set()` | Next, Back, Finish, Start again |
| `:nth-var()` | the visible panel, the current step in the indicator, and inside `:has()` for the gate |
| `:when()` | whether Finish and the nav are rendered, the completed steps, the hint, the "Completed" status |
| `var(--step)` | the progress width (`calc()`) |
| `text:` *(0.5.1)* | the step number in "Step N of 4", as real DOM text |

## 3. What native HTML/CSS does

- **Validation:** `required`, `minlength` and `:invalid`. `:has()` checks the current panel for invalid fields; the browser's cascade picks the blocking `on:` rule at click time.
- **Display and motion:** `display: none` for hidden panels (removing them from the tab order and the accessibility tree), the progress transition, `prefers-reduced-motion`, and counters for the status text.

## 4. What would normally need JavaScript

Tracking the current step, showing one panel, and the Next/Back logic. Native alternatives exist only partly:
- Radio-button tricks (`:has(#step2:checked)`) can show one panel, but the controls are then labels pretending to be buttons, and validation cannot block them.
- `<details>` is not linear.

## 5. Limitations found

- **Focus (0.6.0, `focus:`).** When a click or key press changes the step, focus moves to the new step's heading (`tabindex="-1"` in the HTML; the library never adds it). This covers Next, Back, Finish and Start again. Page load, scripts and native form reset never move focus. Reaching step 4 still disables the clicked Next, but focus is already on the step 4 heading. Rapid navigation focuses only the final step (tested).
- **`aria-current="step"` (0.5.3).** Set on the current step's `<li>` only; the other steps have no attribute. Completed steps still get a "completed" alternative text from generated `content`.
- **Rapid clicks.** Back and Next are natively disabled at the bounds, written in the same task as the click. 9 synchronous Next clicks stop at step 4 (tested). The 0.5.1 clamp rules are gone. Finish is disabled outside step 4, which also stops a scripted click on the hidden button.
- **Validation reaches into nested wizards.** `:has(… :invalid)` sees invalid fields in a wizard nested inside the current panel, as native constraint validation would.
- **No generic per-step validation.** The gate covers what native validation expresses.
- Child combinators (`>`) are needed everywhere, so rules do not reach into a nested wizard.
- **The validation gate is still an action.** A rule like `.wizard:has(… :invalid) .next { attr: disabled true }` is valid, but `attr:` re-reads only on state changes. Typing that makes a field valid changes no state, so the button would stay disabled. The gate keeps the conditional `on:` rule and the hint.

## 6. Accessibility

- Real buttons, labels and visible focus.
- The status ("Step N of 4" / "Completed") is DOM text.
- Hidden panels and Finish (outside step 4) are `display: none`: neither focusable nor announced (tested). Back and Next at a bound are `disabled`: announced as unavailable, not focusable.
- `aria-current="step"` on the current step (0.5.3, tested).
- Focus moves to the new step's heading on every user-initiated step change (0.6.0, tested in Chromium and WebKit). Whether screen readers announce it well is **not verified** (no screen-reader testing).
- Missing:
  - the progress bar is `aria-hidden`.
- Not tested with screen readers.

## 7. Production use

Suitable for short, **non-critical** flows: onboarding tips, a settings tour. For forms with data entry, keep server-side validation.

## 8. Manual test checklist

| Scenario | Expected |
|---|---|
| Load | Step 1 shown; "Step 1 of 4"; first `<li>` has `aria-current="step"`; Back disabled |
| Single click Next | Step 2; `aria-current` moves to the second `<li>`; Back enabled |
| Double click Next on step 1 | Step 2, then blocked by the required field on step 2 (hint shown) |
| Rapid clicks on Next (fields filled) | Stops at step 4; Next disabled; Finish visible |
| Tab | Fields of the current panel, then Back/Next/Finish; disabled buttons are skipped |
| Enter / Space on Next | Advances; focus moves to the new step's heading (Tab then continues inside that step) |
| Finish → Start again | "Completed" status, then step 1 again |
| Nested wizard | Its own step, buttons and `aria-current` |
| Narrow viewport (320 px) | Steps wrap; nav stays usable |
| Strict CSP | No violations, no console errors |
| Browser differences | WebKit does not focus buttons on click |
