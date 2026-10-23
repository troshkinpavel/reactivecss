# Dynamic components

Counter cards with Reactive CSS behavior, and a clearly marked **test harness** (`harness.js`, plain JavaScript) that mounts, removes, moves and reinserts cards and inserts, removes and recompiles stylesheets. The cards need no script; the harness only exercises the library's lifecycle.

Run: `npm run serve`, then open `http://localhost:8080/examples/dynamic-components/` or the demo lab (`/examples/lab/`). Tests: `tests/browser/examples-071.spec.ts` (Chromium and WebKit, strict CSP). Validation guide: `docs/browser-validation-0.7.1.md`.

## 1. What it demonstrates

Lifecycle: insertion after start, removal with same-task pending work, moves, reinsertion (a fresh state), a stylesheet added and removed, recompilation (by swapping a `<link>`'s `href`), cleanup (the harness shows `ReactiveCSS.stats()`).

## 2. Reactive CSS features

| Feature | Use |
|---|---|
| `state()`, `increment()`, `decrement()` | each card's count |
| `attr:` | `disabled` on − at 0 |
| `text:` | the count and the label |
| `:when()` | outline at 5 or more |

## 3. What native HTML/CSS does

The harness uses DOM methods and `<link>` elements (CSP-friendly: no inline styles).

## 4. What would normally need JavaScript

Everything, in a component framework: mount/unmount hooks, cleanup.

## 5. Limitations found

- **Reinsertion starts over:** a removed card's state is disposed; reinserting it starts from 0 (by design).
- **Recompiling a sheet that only uses the state keeps it**; replacing the sheet that declares it restarts it (see the stylesheet lab).
- The harness is JavaScript and **not** a Reactive CSS API.

## 6. Accessibility

Cards are plain buttons with text; the stats line is a polite live region. Not verified with screen readers.

## 7. Production use

A test bench, not a component.

## 8. Manual test checklist

| Action | Expected |
|---|---|
| Click + on card 1 twice | Card 1 shows 2; − enabled |
| "Mount a card" | Card 3 appears and works (+ / −) |
| "Click + and remove in one task" | The first card is removed; no console error; stats states/bindings drop |
| "Move the last card to the top" | That card moves and keeps its count |
| "Reinsert the removed card" | It comes back at the end with 0 (fresh state) |
| "Add / remove the step 2 stylesheet" (on); click + | +2 per click; label "count (step 2)" |
| Same button again (off); click + | +1; label "count" |
| "Recompile the label stylesheet" twice | Labels "count", then "tally"; counts unchanged |
| Read the stats line after each step | No diagnostics; states/bindings follow the number of cards |
| DevTools console | No errors |

## 9. Browser notes

| Browser | What to watch for |
|---|---|
| Chrome | Clicking a button focuses it. Arrow keys scroll a scrollable page natively. |
| Safari | Clicking a button does **not** focus it, so focus results after a click can differ from Chrome; keyboard (Tab, then Enter/Space) gives the comparable result. Full keyboard access (System Settings → Keyboard) is needed for Tab to reach buttons. |
| Firefox | Not verified by automated tests (Playwright's Firefox does not start on the development machine). Every row of the checklist is open. |
