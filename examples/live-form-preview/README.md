# Live form preview

A profile form (display name, role, accent, email notifications) and a preview card that follows every change immediately. Native reset restores everything. There is no backend: the Save button is disabled, so neither the button nor Enter submits, and nothing is stored (the test checks storage and cookies).

Run: `npm run serve`, then open `http://localhost:8080/examples/live-form-preview/`. Tests: `tests/browser/examples.spec.ts`.

## 1. What it demonstrates

Two-way binding of native controls (text, `<select>`, radio group, checkbox) to state, and a styled preview, without script.

## 2. Reactive CSS features

| Feature | Use |
|---|---|
| `state()` | `--name`, `--role` (strings), `--accent` (string), `--notify` (boolean) |
| `bind:` | each control ↔ its state: `input` for text, `change` for select, radio and checkbox, and native `reset` |
| `state("teal", bind(data-accent))` *(0.5.2)* | the accent, mirrored to the form's `data-accent` attribute; plain `[data-accent="violet"]` selectors color the preview |
| `:when()` | the empty-name placeholder |
| `attr:` *(0.5.3)* | `data-name`, `data-role`, `data-notify` on the preview card, derived from the form's states; an empty name gives `data-name=""` |
| `text:` *(0.5.1)* | the name, role, accent and notification status, as real DOM text (the HTML holds the initial preview) |

## 3. What native HTML/CSS does

- **Without Reactive CSS:** the radio group, checkbox and select can drive the preview natively with `:has(input[value=violet]:checked)` and `:has(option:checked)`.
- **What the library adds:** the typed **name**. CSS cannot read a text field's current value: `attr(value)` reads the initial attribute, not what the user types.
- Also native: form reset, keyboard behavior, `maxlength`, and implicit submission blocked by the disabled submit button.

## 4. What would normally need JavaScript

Copying the typed name into the preview (one `input` listener). Everything else in this example has a native CSS alternative.

## 5. Limitations found

- **Real DOM text since 0.5.1:** the preview is selectable and copyable. It is still not part of the form data; do not present it as saved data.
- **Defaults written three times:** the control's HTML default (`value`, `selected`, `checked`), the `state()` initial value, and the preview's initial text. They must match:
  - `bind:` starts from the state;
  - form reset uses the HTML defaults;
  - the preview text is shown before the script runs.
- **One rule per accent.** Each accent color still needs its own rule; since 0.5.2 it is a native attribute selector on `data-accent` instead of `:when()`.
- **Data attributes are a copy, not storage (0.5.3).** The card's `data-*` attributes follow the states and are restored when the card stops matching. Nothing is saved: reload restores the HTML defaults, and nothing goes to `localStorage` or cookies (tested).
- **A WebKit quirk.** Playwright's WebKit build logs a CSP message for its own internal `<select>` stylesheet under `style-src 'self'`. It happens with a bare `<select>` and no script, so it is not caused by the library.

## 6. Accessibility

- Every control is native, with a visible label; the radio group has a fieldset and legend.
- Keyboard: typing, arrow keys in the radio group, Space for the checkbox, select with the keyboard (tested).
- The preview is a labelled region. It has no live announcements: screen-reader users already hear their own input.

## 7. Production use

Suitable for previews (themes, profile cards, email templates) where the preview is decorative and the form is submitted by native HTML to a real backend. The preview must not be the source of truth.

## 8. Manual test checklist

| Scenario | Expected |
|---|---|
| Load | Preview "Ada · Developer · teal · on"; card `data-name="Ada"`, `data-notify="on"` |
| Typing | Name and `data-name` follow every keystroke |
| Empty name | "(no name yet)"; `data-name=""` |
| Select / radio / checkbox | Role, accent color, notifications follow; `data-role`, `data-notify` too |
| Tab | Every control in order, visible focus |
| Enter in the text field | Nothing is submitted |
| Reset | Controls, states, text and data attributes back to the defaults |
| Reload | Defaults again: nothing persisted |
| Narrow viewport (320 px) | Form and preview stack |
| Strict CSP | No violations (WebKit's own `<select>` message aside) |
| Browser differences | See the WebKit quirk above |
