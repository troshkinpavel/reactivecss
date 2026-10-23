# Form validation

A sign-up form using native constraint validation: required fields, `type="email"`, `minlength`. A company field appears and becomes `required` only for business accounts. Submit is disabled until the terms are accepted, and error messages appear after the first submit attempt. Nothing is sent.

Run: `npm run serve`, then open `http://localhost:8080/examples/form-validation/` (or the demo lab, `examples/lab/`). Tests: `tests/browser/examples.spec.ts`.

## 1. What it demonstrates

The browser does the validation. Reactive CSS only changes **which constraints apply**: a derived `required` and `hidden` on the conditional field, and a derived `disabled` on submit. Messages are native `:invalid` styling.

## 2. Reactive CSS features

| Feature | Use |
|---|---|
| `state()` | `--type`, `--terms`, `--tried`, owned by the form |
| `bind:` | radio group ↔ `--type`, checkbox ↔ `--terms` |
| `attr:` *(0.5.3)* | `hidden` on the company field and `required` on its input (business only); `disabled` on submit until `--terms` |
| `set()` | `--tried` on the first submit click |
| `:when()` + `:has(:invalid)` | show the messages after a submit attempt |
| `text:` *(0.5.1)* | the account type in words |

## 3. What native HTML/CSS does

- **Validation:** `required`, `type="email"`, `minlength`, `:invalid`, `:valid`, the browser's own validation bubble and focus on the first invalid field.
- **No submission:** `method="dialog"` on a form outside a `<dialog>` does nothing on a valid submit (HTML spec), so the example sends nothing without script.

## 4. What would normally need JavaScript

Making a field conditionally required, and disabling submit until the terms are accepted. CSS can style `:invalid`, but it cannot change which constraints apply.

## 5. Limitations found

- **Messages are static text.** CSS cannot read `validationMessage`; each field has one fixed message. Fields with several failure reasons (too short and wrong format) get one message.
- **When messages appear.** After the first submit click (`--tried`). Native `:user-invalid` is an alternative where supported; it is not used, so both engines behave the same.
- **Disabled submit hides the reason.** A disabled button cannot be clicked, so the browser never shows its validation bubble until the terms are accepted. This is a design choice of the example, not a requirement.
- **Hidden fields keep their value.** Switching to Personal hides the company field but keeps its text, which is still form data. `disabled` on the field would drop it from submission; hiding was chosen so switching back keeps the value.
- **No server.** Client-side validation is a convenience; the server must validate again.

## 6. Accessibility

- Labels, `aria-describedby` on every field, visible focus, native error bubbles.
- `required` is real, so assistive technology announces it, including on the company field when it appears (tested).
- Static messages are not live regions; the success message is `role="status"`. Not tested with screen readers.
- `attr:` does not make the form accessible by itself: the labels, descriptions and native validation do.

## 7. Production use

Suitable for real forms submitted to a backend: replace `method="dialog"` with a real `action`. The pattern (derived `required`/`disabled`, native validation) degrades well: without the script, the company field is visible and optional, and submit is enabled.

## 8. Manual test checklist

| Scenario | Expected |
|---|---|
| Load | Company field hidden, not required; submit disabled |
| Check the terms | Submit enabled |
| Single click Submit (empty) | Native bubble on Name; messages shown for invalid fields |
| Double click Submit | Same, no navigation |
| Choose Business | Company field visible and `required`; summary "Business" |
| Choose Personal | Company field hidden and not required |
| Tab | Fields in order; hidden company field skipped |
| Enter in a field | Submits (native implicit submission) and validates |
| All fields valid + Submit | "All fields are valid"; page does not navigate |
| Narrow viewport (320 px) | Single column |
| Strict CSP | No violations, no console errors |
| Browser differences | Bubble styling differs between engines |
