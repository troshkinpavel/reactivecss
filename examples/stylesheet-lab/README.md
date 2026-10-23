# Stylesheet lifecycle lab

The lab's behavior is spread over several linked stylesheets. A clearly marked **test harness** (`harness.js`, plain JavaScript) disables and re-enables a sheet, changes its `media` attribute, inserts and removes another, swaps sheets (recompilation) and calls `ReactiveCSS.refresh()`.

Run: `npm run serve`, then open `http://localhost:8080/examples/stylesheet-lab/` or the demo lab (`/examples/lab/`). Tests: `tests/browser/examples-071.spec.ts` (Chromium and WebKit, strict CSP). Validation guide: `docs/browser-validation-0.7.1.md`.

## 1. What it demonstrates

Multiple stylesheets, cascade layers, media queries, disabled sheets, sheet insertion and removal, recompilation, and state across recompilation.

## 2. Reactive CSS features

| Feature | Use |
|---|---|
| `state()` | `--n`, declared in its own sheet (`state-v1.css`) |
| `on:` | +1 (base.css) and +10 (extra.css, more specific) |
| `text:` | every table cell |
| `:when()` | a condition in `labels-v2.css` |

## 3. What native HTML/CSS does

`@layer` order, `@media`, `<link disabled>`, `<link media>`.

## 4. What would normally need JavaScript

Nothing: this is a lifecycle test bench.

## 5. Limitations found

- **Fixed in 0.7.1:** a sheet whose `<link>` is disabled and re-enabled was not processed again (its Reactive CSS was lost); a `media` change was not seen; a `text:`/`attr:`/`focus:` that read a state declared in a later-loading sheet showed nothing. See `docs/release-0.7.1.md`.
- **Replacing the sheet that declares a state restarts the state** (40 → 0): a state lives while a `state()` declaration matches its owner, and the old declaration is gone before the new sheet is loaded. Recompiling sheets that only *use* the state keeps it.
- **Media query changes from resizing** are picked up by `text:` on the next state change or `ReactiveCSS.refresh()` ("Refresh" button).
- **CSSOM edits** (`sheet.insertRule`, `sheet.disabled`) are not observed; use the elements (`<link>`, `<style>`) or `refresh()`.
- The harness is JavaScript and **not** a Reactive CSS API.

## 6. Accessibility

A test bench. Not verified with screen readers.

## 7. Production use

A test bench.

## 8. Manual test checklist

| Action | Expected |
|---|---|
| Load | Layer "high layer wins"; media "wide…" (or "narrow…" below 600px); extra "on"; inserted "no inserted sheet"; labels "labels v1"; step 10 |
| Click +1 | n increases by 10 (extra.css's rule wins) |
| "Toggle extra.css (disabled)"; click +1 | extra "off", step 1; n +1 |
| Toggle again; click +1 | extra "on", step 10; n +10 |
| "Toggle the media attribute"; click +1 | extra "off"; n +1. Toggle back: "on" |
| "Insert / remove inserted.css" twice | "inserted.css is live", then "no inserted sheet" |
| "Swap labels…" with n ≥ 3 | "labels v2, n ≥ 3"; n unchanged |
| "Swap state-v1 ↔ state-v2" | n restarts at 0 (documented); the count text becomes bold |
| Resize below 600px, then "ReactiveCSS.refresh()" | media "narrow (600px or less)" |
| DevTools console | No errors; the harness log shows "diagnostics: none" |

## 9. Browser notes

| Browser | What to watch for |
|---|---|
| Chrome | Clicking a button focuses it. Arrow keys scroll a scrollable page natively. |
| Safari | Clicking a button does **not** focus it, so focus results after a click can differ from Chrome; keyboard (Tab, then Enter/Space) gives the comparable result. Full keyboard access (System Settings → Keyboard) is needed for Tab to reach buttons. |
| Firefox | Not verified by automated tests (Playwright's Firefox does not start on the development machine). Every row of the checklist is open. |
