# Interactive quiz

Three questions with three options each. The first answer counts. After answering, the quiz shows whether it was right, marks the correct option, shows an explanation and enables Next. At the end it shows the score and a message, and "Try again" starts a fresh session. Question data and the answer key are static HTML (`class="correct"`).

Run: `npm run serve`, then open `http://localhost:8080/examples/interactive-quiz/`. Tests: `tests/browser/examples.spec.ts`.

## 1. What it demonstrates

Several scalar states working together (current card, three answers, score) without arrays or objects. The first answer counts because answered options are natively `disabled` (0.5.3), derived from the quiz's state.

## 2. Reactive CSS features

| Feature | Use |
|---|---|
| `state()` | `--q`, `--score`, `--a1`, `--a2`, `--a3` (chosen option position, 0 = unanswered), `--nudge` |
| `set(--aN, sibling-index())` | records which option was chosen |
| `increment(--score)` | in the rule for the correct option only |
| `focus:` *(0.6.0)* | Next after an answer; the new card's heading after Next and "Try again" |
| `attr:` *(0.5.3)* | `disabled` on a question's options once it is answered; `aria-pressed` "true" on the chosen option and "false" on the others |
| `:when()` | Next advances only when the current question is answered (`(--q == 1 and --a1 > 0) or …`); result messages |
| `:nth-var()` | the visible card, and the chosen option (`.opt:nth-var(--a1)`) |
| `:has()` + `:nth-var()` | "Correct!" when the chosen option is the one with `.correct` |
| `text:` *(0.5.1)* | the score, question number, verdicts and result message, as real DOM text |

## 3. What native HTML/CSS does

- `:has()`, `::before` text and counters.
- `display: none` for the other cards.
- Native buttons, so Enter and Space work.

A fully native quiz is possible with radio buttons, `:has(:checked)` and CSS counters (counters can even count checked correct answers). It cannot lock the first answer, though, and paging needs radio-button tricks.

## 4. What would normally need JavaScript

Locking the first answer, the score, paging with a single Next button, and restarting.

## 5. Limitations found

- **Rules repeat per question.** CSS has no parameterized rules, and each question needs its own state name, because "Try again" must reset all answers from one place. No action can reset states owned by descendants.
- **First answer counts (0.5.3).** The options of an answered question are `disabled` in the same task as the answer, so a second click is never dispatched (tested: three clicks in one task, real double click). The 0.5.1 conditional `on:` rules are gone.
- **Generated marker.** The verdict, score and messages are real DOM text since 0.5.1. The "✓ (correct answer)" marker is still generated `content` with alternative text.
- **Single choice only.** No aggregation for multiple-answer questions.
- **Reset that cannot be expressed per option.** The answers live on the quiz (`--a1`…`--a3`) because "Try again" can only reset states on its own ancestors. With `attr:`, options derive `aria-pressed` and `disabled` from those quiz states, so restart clears them too (tested). What still cannot be expressed: a reset of states owned by the options themselves, and returning focus to the first question.
- **Focus (0.6.0, `focus:`).** Answering disables the focused option, and focus moves to Next. Next and "Try again" move focus to the new card's heading (`tabindex="-1"`). There is no focus trap: Tab and Shift+Tab work normally.
- **Next is not disabled on purpose.** A `disabled` Next would drop focus after every question, so Next stays focusable and shows a nudge ("Choose an answer first") instead.

## 6. Accessibility

- Buttons and visible focus.
- Verdicts are DOM text in polite live regions (announcements not verified with screen readers).
- One persistent Next button; after an answer focus moves to it, and after Next to the new question's heading (0.6.0, tested).
- Answered options are `disabled` and the chosen one has `aria-pressed="true"` (0.5.3). `aria-pressed` marks the choice, not a toggle; a radio group would be the stricter pattern.
- Announcements of the new question and the verdict live region are **not verified** with a screen reader.

## 7. Production use

Suitable for informal self-checks. Not for assessments: the answer key is in the page, and scoring is client-side.

## 8. Manual test checklist

| Scenario | Expected |
|---|---|
| Load | Question 1; options enabled with `aria-pressed="false"`; score 0 |
| Single click on an option | Verdict, explanation, correct option marked; options disabled; chosen `aria-pressed="true"` |
| Double click on the correct option | Score 1, not 2 |
| Rapid clicks on several options | Only the first counts |
| Next before answering | Stays; "Choose an answer first" |
| Tab | Options, then Next; answered options are skipped |
| Enter / Space on an option | Answers; focus moves to Next; Enter on Next focuses the next question's heading |
| Try again | Question 1, score 0, options enabled and `aria-pressed="false"` again |
| Narrow viewport (320 px) | Options wrap |
| Strict CSP | No violations, no console errors |
| Browser differences | WebKit does not focus buttons on click |
