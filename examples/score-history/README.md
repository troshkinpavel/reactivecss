# Score history

Two independent scoreboards. Each shows the current score, the previous score, the last change (signed), the direction (up or down) and a short visual bump or dip on every change. +1, −1 and Reset.

Run: `npm run serve`, then open `http://localhost:8080/examples/score-history/`. Tests: `tests/browser/examples.spec.ts`.

## 1. What it demonstrates

Reactive CSS tracks *transitions*, not only current values: `previous()` and `direction()` come from the state engine, and `:changed()` restarts native keyframes on every change. No timers.

## 2. Reactive CSS features

| Feature | Use |
|---|---|
| `state()` | `--points` per board |
| `increment()`, `decrement()`, `set()` | +1, −1, Reset |
| `previous()` | `--prev: previous(--points)`, and the "No changes yet" condition |
| `direction()` | ▲ up / ▼ down |
| `:changed()` | starts the `bump` or `dip` keyframes on each change, restarted for repeated changes |
| `:when()` | direction text and color, "No changes yet" |
| `attr:` *(0.5.3)* | `disabled` on Reset while the score is 0; `data-direction` (`none`/`up`/`down`) on the board, chosen by the cascade |
| `text:` *(0.5.1)* | current, previous, change and direction, as real DOM text |

## 3. What native HTML/CSS does

- **Keyframes and reduced motion:** the `@keyframes` animations, and `@media (prefers-reduced-motion: reduce)`, which turns them off (`:changed()` then clears at once).
- **Numbers:** a registered `@property --delta { syntax: "<integer>" }` makes the browser compute the signed change; `text:` writes it.

## 4. What would normally need JavaScript

All of it. CSS has no memory of clicks: a counter, its previous value and a restartable "just changed" animation need script. A plain-JavaScript version is short (see `docs/example-comparison.md`).

## 5. Limitations found

- **Semantics of `previous()`.** It is the value before the last *effective* change. Tested: 20 clicks in one task give 20 and previous 19, and 15 rapid real clicks are all counted. Intermediate values are not kept: there is no `history()`.
- **Reset counts as a change, intentionally.** "Previous" then shows the score before the reset, and the direction is "down". There is no way to clear the history.
- **Reset is disabled at 0 (0.5.3).** A reset at 0 changes nothing, because an unchanged value is not a change. Disabling it says so natively. A focused Reset that disables itself drops focus to the page.
- **`data-direction` keeps the last direction.** It stays "down" after a reset to 0 until the next change, like the text.
- **No delta-dependent styles.** Conditions compare operands but do not do arithmetic.

## 6. Accessibility

- Buttons with accessible names, visible focus, and keyboard operation (tested).
- The current score is DOM text in a polite live region (announcement not verified with screen readers).
- The direction is DOM text ("▲ up"); screen readers may read the arrow symbol.
- Motion is off under reduced motion (tested).

## 7. Production use

Suitable for scoreboards, counters and steppers where the state is visual and short-lived. Not for values that must be persisted or audited.

## 8. Manual test checklist

| Scenario | Expected |
|---|---|
| Load | 0, "No changes yet", Reset disabled, `data-direction="none"` |
| Single click +1 | 1, previous 0, change 1, "▲ up", bump animation, Reset enabled |
| Double click −1 | Two changes; previous is the value before the second |
| Rapid clicks (15+) | Every click counted |
| Tab | −1, +1, Reset (skipped while disabled) |
| Enter / Space | Same as a click |
| Reset | 0; previous shows the old score; "▼ down"; Reset disabled again |
| Two boards | Independent |
| Reduced motion | No animation; values still change |
| Narrow viewport (320 px) | Boards stack |
| Strict CSP | No violations, no console errors |
| Browser differences | WebKit does not focus buttons on click |
