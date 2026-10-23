# Native vs Reactive CSS vs plain JavaScript (the five original examples, as of 0.7.0)

How to read this:
- **Native** means current HTML and CSS only: `:has()`, `:checked`, `<details>`, form controls, CSS math, counters and animations.
- **Reactive CSS** is the example as built and tested in 0.7.0 (`tests/browser/examples.spec.ts`). Its "behavior lines" are the non-blank lines of `style.css`, outside comments, that declare or read state: `state()`, `on:`, `bind:`, `attr:`, `text:`, `focus:`, `when()`, `:when()`, `:nth-var()`, `previous()`, `direction()`, `:changed()`, and `var()` of a state or of a property computed from states. `@property` registrations are not counted. The counts come from the current files, not estimates.
- **Plain JS** is the shortest script I would write for the same behavior, on the same HTML, with CSS hooks (attributes or custom properties) instead of reactive syntax. **Four of them are sketches, not executed**; their line counts are non-blank lines and estimates of what a working version needs. The score history version is executed and parity-tested on the site (section 5).

## Summary

| Example | Native only | Reactive CSS behavior lines | Plain JS | What still needs script with Reactive CSS |
|---|---|---|---|---|
| Product configurator | Color and gift styling yes; **total no** (CSS cannot read a number field) | 14 | ≈ 18 (sketch) | Number formatting (`Intl.NumberFormat`) for prices with cents |
| Multi-step wizard | Partly (radio-button tricks: no button semantics, no validation gate) | 26 | ≈ 31 (sketch) | The native validation bubble (`reportValidity()`) |
| Interactive quiz | Mostly (radios + `:has(:checked)` + counters count the score); **cannot lock the first answer** or page with one button | 39 | ≈ 36 (sketch) | Nothing for this scope |
| Live form preview | Select, radio and checkbox yes; **typed text no** | 12 | ≈ 12 (sketch) | Nothing for this scope |
| Score history | No (no memory of clicks) | 19 | 28 (executed) | Nothing for this scope |

**Plain JavaScript is not meaningfully longer.** In total it is about the same size (≈ 125 vs 110 lines): shorter for the quiz, equal for the form, longer for the configurator, the wizard and score history. The JS versions now also write `aria-*`, `disabled`, DOM text and focus, like the demos. What Reactive CSS changes is where the code lives and what it needs:
- No script file or event wiring; behavior sits next to the styles it changes.
- It works under a strict CSP without nonces (tested).
- Each component instance is isolated by the cascade, not by query code.

What it can do since 0.5.1–0.6.0 (all **experimental**):
- write real DOM text: `text:` (0.5.1), one unformatted value per element;
- write allowlisted attributes: `attr:` (0.5.3) for `disabled`, `hidden`, `required`, `aria-expanded`, `aria-pressed`, `aria-selected`, `aria-current` and `data-*`, plus `aria-disabled` and `tabindex` 0/-1 (0.6.0);
- move focus: `focus:` (0.6.0), only after a user click, key, input or change.

What it still cannot do:
- other attributes: no `aria-checked`, `aria-invalid`, `role`, free-text ARIA or URLs;
- announce anything by itself: changed DOM text is announced only inside a live region, as with any script;
- restore focus, or move it from scripts, timers or page load;
- format numbers.

Plain JS does the first, third and fourth in a line each; announcements need a live region in both. Nothing in either version has been verified with a screen reader.

## 1. Product configurator

**Native.**
- `:has(input[value=silver]:checked)` can recolor the swatch and change displayed labels.
- Native CSS **cannot compute the total**. It cannot read a number field's value (`attr(value)` is the initial attribute), and counters cannot multiply.

**Reactive CSS (tested).**
- 14 lines: three states, three `bind:`, two `on:` rules with `attr: aria-disabled`, two conditional `on:` clamps at the bounds, two lines of `when()`/`calc()` total, one `calc()` to dollars, one `text:` total, two lines of swatch styling.
- The total is real DOM text (`text:`); the buttons report `aria-disabled` at a bound and stay focusable; conditions are current for every click, also several in one task (0.5.1 `sync()`).
- Limitations: no number formatting (whole-dollar prices, ".00" fixed in the HTML), defaults written twice (`state()` and the HTML).

**Plain JS (sketch, ≈ 18 lines):**

```js
for (const form of document.querySelectorAll('.product')) {
  const qty = form.quantity, dollars = form.querySelector('.dollars');
  const plus = form.querySelector('.plus'), minus = form.querySelector('.minus');
  const update = () => {
    const q = Math.min(10, Math.max(1, qty.valueAsNumber || 1));
    const cents = (4900 + (form.color.value === 'silver' ? 1000 : 0)) * q + (form.gift.checked ? 500 : 0);
    dollars.textContent = cents / 100;                               // or Intl.NumberFormat for real cents
    plus.setAttribute('aria-disabled', q >= 10);                     // stays focusable at the bound
    minus.setAttribute('aria-disabled', q <= 1);
    form.style.setProperty('--color', form.color.value);            // CSS: swatch background
    form.toggleAttribute('data-gift', form.gift.checked);
  };
  form.addEventListener('input', update);
  form.addEventListener('reset', () => setTimeout(update));        // values reset after the event
  plus.addEventListener('click', () => { qty.stepUp(); update(); });
  minus.addEventListener('click', () => { qty.stepDown(); update(); });
  update();
}
```

`stepUp()` and `stepDown()` respect `min`/`max` natively, so no clamp rule is needed. Both versions now write DOM text and `aria-disabled`. The JS version is still the one to pick when prices have cents: `Intl.NumberFormat` formats them, `text:` cannot.

## 2. Multi-step wizard

**Native.** Hidden radios with `:has(#s2:checked)` can show one panel, but "Next" is then a `<label>` (not a button; keyboard and semantics suffer), and `:invalid` cannot stop a label from checking its radio. `<details>` has no linear order.

**Reactive CSS (tested).**
- 26 lines.
- Real buttons, natively `disabled` at the bounds (`attr:`), a native-validation gate through `:has()` with a hint, indicator with `aria-current="step"` (`attr:`), progress, status as DOM text (`text:`), focus on the new step's heading (`focus:`), two independent instances, and a nested instance.

**Plain JS (sketch, ≈ 31 lines):**

```js
for (const w of document.querySelectorAll('.wizard')) {
  const $ = (s) => w.querySelector(`:scope > ${s}`);
  const panels = [...$('.panels').children], items = [...$('.steps').children];
  let step = 0;
  const show = (focus) => {
    panels.forEach((p, i) => (p.hidden = i !== step));
    items.forEach((li, i) => (i === step ? li.setAttribute('aria-current', 'step') : li.removeAttribute('aria-current')));
    w.style.setProperty('--step', step + 1);                        // progress bar and completed steps in CSS
    $('.status > .n').textContent = step + 1;
    $('.status').hidden = step === 4;
    $('.done').hidden = step !== 4;
    $('.nav > .back').disabled = step === 0;
    $('.nav > .next').disabled = step >= 3;
    $('.nav > .finish').hidden = step !== 3;
    $('.nav').hidden = step === 4;
    if (focus) panels[step].querySelector('h2').focus();          // needs tabindex="-1" on headings
  };
  w.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.closest('.wizard') !== w) return;                    // ignore a nested wizard's buttons
    const invalid = panels[step].querySelector(':invalid');
    if (b.matches('.next') && invalid) return invalid.reportValidity();
    if (b.matches('.next')) step++;
    else if (b.matches('.back')) step--;
    else if (b.matches('.finish')) step = 4;
    else if (b.matches('.restart')) step = 0;
    else return;
    show(true);
  });
  show(false);
}
```

Focus on the new heading, `aria-current` and `disabled` are now in both versions. Plain JS still adds the native validation bubble (`reportValidity()`); the Reactive CSS version shows its own hint instead.

## 3. Interactive quiz

**Native.**
- Fieldsets of radios: `.q:has(.correct:checked) .verdict::before { content: "Correct!" }`.
- Explanations shown with `:has(:checked)`.
- **The score with CSS counters**: `input.correct:checked { counter-increment: score }`. Native counters *can* aggregate checked answers.

Native **cannot**:
- lock the first answer (a radio can be changed, also by keyboard);
- page with one Next button;
- restart without a form reset.

A `<form>` with `type="reset"` restarts natively. A native, non-locking version is a fair choice for practice quizzes.

**Reactive CSS (tested).**
- 39 lines, the most of the five: rules repeat per question, because each question needs its own state name for the restart.
- First answer locked by natively `disabled` options (`attr:`), the choice marked with `aria-pressed`, verdict, score and messages as DOM text (`text:`), focus to Next after an answer and to the new card's heading after Next (`focus:`).

**Plain JS (sketch, ≈ 36 lines):**

```js
const quiz = document.querySelector('.quiz');
const cards = [...quiz.querySelectorAll('.card')], next = quiz.querySelector('.next');
let q = 0, score = 0;
const clear = (card) => {
  delete card.dataset.answered;
  card.querySelector('.verdict').textContent = '';
  card.querySelectorAll('.opt').forEach((o) => { o.disabled = false; o.setAttribute('aria-pressed', 'false'); });
};
const show = () => {
  cards.forEach((c, i) => (c.hidden = i !== q));
  quiz.querySelector('.qn').textContent = q + 1;
  quiz.querySelectorAll('.sc').forEach((s) => (s.textContent = score));
  quiz.querySelector('.praise').textContent = score === 3 ? 'Perfect score!' : 'Review the explanations and try again.';
  quiz.querySelector('.progress-text').hidden = quiz.querySelector('.nav').hidden = q === 3;
};
quiz.addEventListener('click', (e) => {
  const opt = e.target.closest('.opt'), isNext = e.target.closest('.next'), isRestart = e.target.closest('.restart');
  let target = null;
  quiz.querySelector('.nudge').hidden = !(isNext && !cards[q].dataset.answered);
  if (opt) {                                                         // disabled options get no clicks
    const card = opt.closest('.question'), right = opt.classList.contains('correct');
    card.dataset.answered = right ? 'right' : 'wrong';                 // CSS shows the explanation and marker
    card.querySelector('.verdict').textContent = right ? 'Correct!' : 'Not quite.';
    card.querySelectorAll('.opt').forEach((o) => { o.disabled = true; o.setAttribute('aria-pressed', o === opt); });
    if (right) score++;
    target = next;                                                   // the focused option is now disabled
  } else if ((isNext && cards[q].dataset.answered) || isRestart) {
    if (isRestart) { score = 0; cards.slice(0, 3).forEach(clear); }
    q = isRestart ? 0 : q + 1;
    target = cards[q].querySelector('h2');                           // needs tabindex="-1" on headings
  }
  show();
  target?.focus();
});
cards.slice(0, 3).forEach(clear);
show();
```

Plain JS is shorter here, because one loop replaces the per-question rules. Both versions now disable answered options, set `aria-pressed` and move focus.

## 4. Live form preview

**Native.** Role (`:has(option[value=Designer]:checked)`), accent and notifications can all be previewed natively. **The typed name cannot**: no CSS feature reads a text field's current value.

**Reactive CSS (tested).** 12 lines. `bind:` covers all four controls, including native reset; the accent is mirrored to `data-accent` (`state(…, bind())`, 0.5.2); the preview is DOM text (`text:`), and the card carries `data-*` copies of the values (`attr:`).

**Plain JS (sketch, ≈ 12 lines):**

```js
const form = document.getElementById('profile'), card = form.querySelector('.card');
const update = () => {
  card.querySelector('.name').textContent = form.display_name.value || '(no name yet)';
  card.querySelector('.role').textContent = form.role.value;
  card.querySelector('.accent-value').textContent = form.accent.value;
  card.querySelector('.notify-value').textContent = form.notifications.checked ? 'on' : 'off';
  form.dataset.accent = form.accent.value;                          // CSS colors by attribute
  Object.assign(card.dataset, { name: form.display_name.value, role: form.role.value, notify: form.notifications.checked ? 'on' : 'off' });
};
form.addEventListener('input', update);
form.addEventListener('reset', () => setTimeout(update));
update();
```

Both versions produce real DOM text. Plain JS reads the controls, so it needs no duplicated defaults (the Reactive CSS version writes each default in the HTML control, in `state()` and in the preview text). Reactive CSS needs no script, and works under strict CSP without a script file of your own.

## 5. Score history

**Native.** Not possible: CSS has no memory of clicks. Radio-button tricks can only cover a fixed, small range.

**Reactive CSS (tested).** 19 lines. `previous()`, `direction()` and `:changed()` restart animations on every change, with no timers. Current, previous, change and direction are DOM text (`text:`); Reset is natively `disabled` at 0 and the board carries `data-direction` (`attr:`).

**Plain JS (executed, 28 lines).** The site runs a vanilla version on the same markup: [`site/src/content/vision/score-history.js`](../site/src/content/vision/score-history.js), with the presentation it switches in [`score-history.css`](../site/src/content/vision/score-history.css). `site/tests/e2e/score-parity.spec.ts` runs the same interactions on both versions and expects the same visible state. It keeps the keyframes in CSS too, but restarts them by removing and re-adding a class with a forced reflow (`void current.offsetWidth`).

Equivalent size. The Reactive CSS version needs no animation restart code and no initial-state setup in script.

## Accessibility, compatibility and performance (all five)

| | Native | Reactive CSS | Plain JS |
|---|---|---|---|
| DOM text (copyable, findable) | yes for static text | yes, experimental (`text:`, 0.5.1): one value per element, no formatting | yes |
| Attributes (`disabled`, `aria-*`, `tabindex`) | native only | experimental `attr:` (0.5.3; `aria-disabled` and `tabindex` 0/-1 in 0.6.0): allowlisted attributes only, no `aria-checked`, `aria-invalid` or `role` | any |
| Focus | native only (`autofocus`, `<dialog>`, `popover`) | experimental `focus:` (0.6.0): after a user click, key, input or change only; no restoration | any time |
| Announcements | live regions | live regions only; not verified with a screen reader | live regions only; not verified here either |
| Strict CSP | yes | yes, no nonce (tested) | needs a same-origin script file |
| Browsers | `:has()` (2023+) | Chromium and WebKit tested; Firefox unverified; needs `CSS.registerProperty` | everywhere |
| Interaction cost | none | event-time evaluation +0.5–1.6 µs per click over a hand-written listener (`docs/beta-prep-0.5.md`); an event that changes a derived `attr:` forces one style recalculation (29–32 µs vs 3–4 µs per click, 0.5.3). Input to correct frame equals plain JS (0.7.0: p50 14.0 vs 13.6 ms) | none extra |
| Page cost | none | about 114 KB minified / 38 KB gzip (`reactive-css.min.js` 0.7.0; compact build 98 / 33 KB) | the script itself |
