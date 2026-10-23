# Settings panel

A notifications section whose channel options are disabled while notifications are off, a theme and text-size preview, an "Advanced settings" disclosure, and a native reset. Nothing is saved.

Run: `npm run serve`, then open `http://localhost:8080/examples/settings-panel/` (or the demo lab, `examples/lab/`). Tests: `tests/browser/examples.spec.ts` (Chromium and WebKit, strict CSP).

## 1. What it demonstrates

One form-owned state disabling a **whole group of controls** natively (`disabled` on a `<fieldset>`), a disclosure with real `aria-expanded` and `hidden`, and a preview styled through a derived `data-theme` attribute.

## 2. Reactive CSS features

| Feature | Use |
|---|---|
| `state()` | `--notify`, `--theme`, `--size`, `--more`, owned by the `<form>` |
| `bind:` | checkbox ↔ `--notify`, select ↔ `--theme`, range ↔ `--size`, including native reset |
| `attr:` *(0.5.3)* | `disabled` on the channels `<fieldset>`; `aria-expanded` on the disclosure button; `hidden` on its region; `data-theme` on the preview |
| `toggle()`, `set()` | the disclosure; closing it on reset |
| `text:` *(0.5.1)* | the text-size label |

## 3. What native HTML/CSS does

- **`<fieldset disabled>`:** disables every control inside, removes them from the tab order and from form data, and matches `:disabled`.
- **Everything else native:** `hidden`, `[data-theme]` selectors, the range input, the select, and form reset.

## 4. What would normally need JavaScript

Toggling `disabled` on the fieldset when the master checkbox changes, `aria-expanded` and `hidden` for the disclosure, and copying the theme to the preview. Without script, CSS can only *look* disabled (`:has(:not(:checked))` + opacity): the controls would still be focusable and submitted.

## 5. Limitations found

- **Defaults written twice:** `state(true)` and `checked`, `state(light)` and `selected`, `state(16)` and `value="16"`.
- **Reset and the disclosure.** `--more` is not form data, so form reset does not restore it. The reset button's own `on:` closes the disclosure. A disclosure outside the form would need its own reset.
- **Progressive enhancement.** Without the script, the advanced region is visible and the channels stay enabled (nothing is hidden or disabled by markup).
- **Nothing persists.** Reload restores the HTML defaults; there is no `persist()`.

## 6. Accessibility

- Native controls, fieldsets and legends, visible focus.
- The disabled fieldset is announced as unavailable, and its controls are skipped by Tab (tested).
- The disclosure button has real `aria-expanded` and `aria-controls`, and the region is `hidden` while closed (tested). This is the disclosure pattern, not a full settings-dialog pattern.
- `attr:` writes attributes; it does not make a component accessible by itself. Not tested with screen readers.

## 7. Production use

Suitable for client-side preferences whose saving is done by the native form submission to a backend (not shown). The dependent-group pattern (`disabled` on a fieldset) is the most robust part: it is pure HTML semantics.

## 8. Manual test checklist

| Scenario | Expected |
|---|---|
| Load | Notifications on; channels enabled; preview light, 16 px; advanced region hidden, `aria-expanded="false"` |
| Single click on "Enable notifications" | Channels fieldset `disabled`; its controls greyed and skipped by Tab |
| Double click | Back to enabled |
| Rapid clicks | Ends in the state matching the checkbox |
| Tab | Master checkbox → channel controls (only when enabled) → theme → size → Advanced → Reset |
| Enter / Space on Advanced | Opens and closes; `aria-expanded` follows |
| Theme / size | Preview colors and font size follow; label shows the size |
| Reset | All controls, the preview and the disclosure back to the defaults |
| Narrow viewport (320 px) | Single column, no overflow |
| Strict CSP | No violations (WebKit's own `<select>` message aside) |
| Browser differences | WebKit logs a CSP message for its internal `<select>` stylesheet |
