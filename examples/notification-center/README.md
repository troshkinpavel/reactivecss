# Notification center

A collapsible list of three sample notifications. Each can be marked read (a toggle with `aria-pressed`) or dismissed. "Undo dismiss" restores the last dismissed one, "Dismiss all" clears the list, and the unread count updates as real text.

Run: `npm run serve`, then open `http://localhost:8080/examples/notification-center/` (or the demo lab, `examples/lab/`). Tests: `tests/browser/examples.spec.ts`.

## 1. What it demonstrates

A disclosure (`aria-expanded` + `hidden`), per-item ARIA toggle state and visibility derived from container-owned state, a **one-step history** (Undo) without arrays, and a count computed by native math from boolean states.

## 2. Reactive CSS features

| Feature | Use |
|---|---|
| `state()` | `--open`, `--r1`…`--r3` (read), `--d1`…`--d3` (dismissed), `--last` (last dismissed, 0 = none), owned by the center |
| `toggle()`, `set()` | open/close, read/unread, dismiss, undo, dismiss all |
| `:when()` | which notification Undo restores |
| `attr:` *(0.5.3)* | `aria-expanded` on the toggle, `hidden` on the list and on dismissed items, `aria-pressed` on "Mark as read", `data-read` on items, `disabled` on Undo and "Dismiss all", `hidden` on the empty message |
| `text:` *(0.5.1)* | the unread count |

## 3. What native HTML/CSS does

- `hidden`, `[data-read]` styling, `:disabled`.
- **The count:** a boolean state is `1`/`0` in CSS, so `calc((1 - read) * (1 - dismissed) + …)` counts unread items; a registered `@property` integer makes the browser compute it.

## 4. What would normally need JavaScript

Everything: dismissing, undo, read state, the count and the disclosure. `<details>` could replace the disclosure natively, but not the rest.

## 5. Limitations found

- **A fixed list.** Three notifications, one state pair each, owned by the center (the count and "Dismiss all" need them all). Real notifications arrive dynamically: that needs script.
- **One-step history.** `--last` remembers only the last dismissal; Undo twice restores one item. A full history needs a list, and persistent arrays are out of scope.
- **"Dismiss all" clears the history** (`--last` = 0): Undo cannot restore a bulk dismissal.
- **Focus.** Dismissing hides the focused Dismiss button, and focus returns to the page. `focus:` (0.6.0) cannot fix this: it reacts to a condition becoming true, and "the last dismissed item changed" stays true from the second dismissal on. It is left as a documented limitation rather than forcing a rule that works only for the first dismissal.
- **Rules repeat per item.**

## 6. Accessibility

- Disclosure with real `aria-expanded` and `aria-controls`; the collapsed list is `hidden` (tested).
- "Mark as read" is a toggle button with real `aria-pressed` (tested); the unread count is DOM text in a polite live region (announcements not verified).
- Dismissed items are `hidden`: removed from the accessibility tree.
- This is not the ARIA `feed` or `log` pattern, and new notifications are not announced (there are none: the list is static).

## 7. Production use

Suitable as a client-side layer over a small, server-rendered set of notices (banners, onboarding tips). A real notification center needs script for arrival, persistence of read/dismissed state, and server sync.

## 8. Manual test checklist

| Scenario | Expected |
|---|---|
| Load | List open, `aria-expanded="true"`; 3 unread; Undo disabled |
| Single click "Mark as read" | Item greyed, `aria-pressed="true"`, 2 unread |
| Double click "Mark as read" | Back to unread |
| Rapid clicks on several Dismiss buttons | Each item hidden once; Undo restores only the last |
| Tab | Toggle, then each item's buttons, then Undo / Dismiss all (disabled ones skipped) |
| Enter / Space | Same as clicks |
| Collapse | List `hidden`, `aria-expanded="false"`; count still visible |
| Dismiss all | "No notifications."; Dismiss all and Undo disabled; 0 unread |
| Narrow viewport (320 px) | Header wraps |
| Strict CSP | No violations, no console errors |
| Browser differences | WebKit does not focus buttons on click |
