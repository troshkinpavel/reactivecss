# Capability gaps found while building the five examples (0.5.0)

> **0.5.3 status.** Gap 2 (attributes) is addressed by the experimental `attr:` declaration (derived attributes on any matched element), used by all five examples and six new ones (`docs/demo-validation-0.5.3.md`). Gaps 3 (focus) and 10 (event control) remain RFCs. The new examples found no new gap beyond the documented ones: aggregates, arrays, focus and event control.

> **0.5.1 status.**
> - Gap 1 (generated text) is addressed by the experimental `text:` declaration: real DOM text for one value per element. Formatting (gap 8) remains.
> - Gap 4 (frame lag of conditional actions) is **fixed** (`scheduler.sync()` before each dispatch).
> - Gaps 2 (attributes), 3 (focus) and 10 (event control) have RFCs: `docs/rfc-attribute-binding.md`, `docs/rfc-focus-management.md`, `docs/rfc-event-control.md`.
> - Gaps 5, 6, 7 and 9 are unchanged.

Each gap below occurred in a real example; nothing was added to the API to work around it. They are ordered by how many examples hit them and how much they limit production use. "Possible solution" is a direction, not a decision; changes to existing functions come first.

| # | Gap | Examples | Severity |
|---|---|---|---|
| 1 | Generated text is not DOM text | all 5 | high for accessibility-critical values |
| 2 | Cannot set attributes (`disabled`, `aria-*`) | configurator, wizard, quiz | high |
| 3 | Cannot move focus | wizard, quiz | high for multi-step flows |
| 4 | `:when()`-gated actions use the last rendered condition (frame lag) | configurator, quiz | medium |
| 5 | No bounded increment / clamp | configurator | medium |
| 6 | No reset of states owned by other elements | quiz | medium |
| 7 | Defaults written twice for `bind:` | configurator, form preview | low |
| 8 | Numeric output only as integer counters | configurator, score history | low/medium |
| 9 | Conditions cannot do arithmetic | score history | low |
| 10 | Event cancellation | form preview (worked around) | low here |

Not hit by any example: event propagation control, animation lifecycle events (`:changed()` covered the visuals), DOM aggregation (the quiz score worked with `increment()`), derived values beyond `calc()` (the configurator total is native math).

## 1. Generated text is not DOM text

- **Problem.** Every displayed value comes from `content: var(--x)` or `counter()`. It cannot be selected, copied or found with find-in-page. Chromium exposes it to the accessibility tree, but counters arrive in pieces (`$`, `49`, `.`, `00`). Whether `aria-live` announces changes to generated text was not verified with a screen reader. Playwright's ARIA snapshot does not see counter text at all.
- **Where.** Configurator total, wizard status, quiz score and verdicts, form preview, scoreboard.
- **Native alternative.** None for dynamic values.
- **JS workaround.** `el.textContent = …` (one line).
- **Possible solution.** A `text:` declaration (`.total { text: var(--total-text) }`) that writes `textContent` of the element from a string state or expression, like `bind:` writes a control's value. It must:
  - write plain text only (never HTML);
  - be limited to trusted sheets, like `bind:`;
  - number-format integers, which leads to gap 8.
- **Complexity.** Low: a watcher plus a subscribed write, like `bind:` output.

## 2. Cannot set attributes

- **Problem.** At bounds or after answering, buttons cannot become `disabled` or `aria-disabled`. The current step cannot get `aria-current`, and options cannot get `aria-pressed`. Visual state and accessible state diverge.
- **Where.** Configurator (+/− at bounds), wizard (indicator), quiz (answered options).
- **Native alternative.** None. `:disabled` is read-only from CSS, and `pointer-events: none` does not stop the keyboard.
- **JS workaround.** `el.disabled = …`, `el.toggleAttribute('aria-current', …)`.
- **Possible solution.** A narrow attribute synchronization, `attr-sync: aria-current when(--step == 2, "step", none)` or `disabled: when(--qty >= 10)`, restricted to an allowlist: `disabled`, `aria-current`, `aria-pressed`, `aria-expanded`, `aria-disabled`, `hidden`.
  - **Security.** Never `href`, `src`, `on*` or `style`, and trusted sheets only.
  - **Interaction with `:when()` markers.** The library already writes marker attributes, so the mechanism exists.
- **Complexity.** Medium: attribute ownership conflicts with page scripts, and restoring on cleanup.

## 3. Cannot move focus

- **Problem.** When content changes (next wizard step, next question), focus stays on the button or falls back to `<body>` when the button disappears (observed). Screen-reader users get no cue.
- **Where.** Wizard, quiz.
- **Native alternative.** `autofocus` only on load; `<dialog>`'s focus handling for dialogs.
- **JS workaround.** `heading.focus()` (with `tabindex="-1"`).
- **Possible solution.** A `focus()` action targeting a selector within the owner, `on: click(increment(--step), focus(closest(.wizard) h2:visible))`. Focus moves are easy to abuse, so restrict them to user-initiated events. **Not recommended before a design review**: focus management is where CSS-driven behavior is weakest.
- **Complexity.** Low to implement, high to get right.

## 4. Frame lag of `:when()`-gated actions

- **Problem.** `:when()` conditions are applied as marker attributes in the next frame. Several events in the **same task** see the old condition: 12 synchronous clicks took the quantity to 13, and two synchronous clicks scored twice in the quiz. One event per frame, which covers people and keyboard repeat, is correct (tested).
- **Where.** Configurator bounds, quiz "first answer counts".
- **Native alternative.** n/a.
- **JS workaround.** A plain `if` in the handler.
- **Possible solution (existing behavior, no new syntax).** When `on:` resolves which declaration applies, evaluate the `:when()` conditions of candidate rules from the current cell values instead of the marker attributes. Alternatively, apply `:when()` markers synchronously in the urgent lane right after an action. The second is simpler; its cost is attribute writes during input handling.
- **Complexity.** Medium. It touches the action dispatch path, so it is a candidate for a targeted 0.5.x fix with a regression test (12 synchronous clicks must stop at 10).

## 5. No bounded increment

- **Problem.** Bounds need two extra conditional rules per control, and they inherit gap 4.
- **Where.** Configurator.
- **Native alternative.** `<input type=number min max>` and `stepUp()`/`stepDown()` are bounded, but only from script.
- **JS workaround.** `Math.min`/`Math.max`.
- **Possible solution.** Extend the existing actions: `increment(--qty, 1, max 10)`, `decrement(--qty, 1, min 1)`. A small parser change, no new function, and it removes the frame lag for this case.
- **Complexity.** Low.

## 6. No reset of states owned by other elements

- **Problem.** An action reaches the nearest owner (or `closest()`) of a name. "Try again" cannot reset states owned by each question, so all answers had to live on the quiz, with rules repeated per question. Native form reset only resets `bind:` states.
- **Where.** Quiz.
- **JS workaround.** Loop over the elements.
- **Possible solution.** A `reset(--x)` action that returns the target state to its initial value. A variant could reset every owner of `--x` inside the action's owner: `reset(--answer, within(.quiz))`. Without "within", it is a small, safe addition; with it, it is a broadcast that needs design.
- **Complexity.** Low (single) / medium (scoped broadcast).

## 7. Defaults written twice for `bind:`

- **Problem.** `bind:` starts from the state, and native reset starts from the HTML default (`value`, `checked`, `selected`), so both must be written and kept equal.
- **Where.** Configurator, form preview.
- **Possible solution.** An improvement to existing behavior: when a `bind:` control's default differs from a state's *literal* initial value, warn in development builds. Alternatively, let a dedicated initializer take the control's default.
- **Complexity.** Low (warning).

## 8. Numeric output only as integer counters

- **Problem.** `content` cannot print numbers, so counters are needed. Counters print integers only: a price needs two counters and `decimal-leading-zero`. There is no locale formatting or grouping.
- **Where.** Configurator, score history.
- **Native alternative.** Counters (with `@counter-style` for symbols).
- **Possible solution.** Only together with gap 1 (`text:`): formatting belongs to text output, not to a general `format()`.
- **Complexity.** Low with `Intl.NumberFormat`.

## 9. Conditions cannot do arithmetic

- **Problem.** "Changed by more than 5" needs `--points - previous(--points) > 5`, but conditions compare operands only.
- **Where.** Score history (not implemented, documented).
- **Possible solution.** Allow `+` and `-` between number operands in the condition grammar. This extends an existing grammar, not a new function.
- **Complexity.** Low.

## 10. Event cancellation

- **Problem.** A form whose submission must not navigate cannot be handled with `on: submit(…)` (unsupported), and actions cannot call `preventDefault()`.
- **Where.** Form preview: worked around with a disabled submit button.
- **Possible solution.** `prevent()` as an action: see `docs/event-support-0.5.md`.
- **Complexity.** Medium (non-passive listeners per type).

## Recommendation

1. Fix gap 4 first: it is a correctness gap in existing behavior.
2. Add the bounded parameters to `increment()`/`decrement()` (5).
3. Design `text:` (1, with 8) and allowlisted attribute synchronization (2): the two mechanisms that most limit production use.
4. Keep focus movement (3) and broadcast resets (6, scoped) out until there is a clear design.
