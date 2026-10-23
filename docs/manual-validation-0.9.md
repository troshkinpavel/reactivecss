# 0.9.0 manual validation checklist

These checks could not run automatically on the development machine. Record every result as **pass**, **fail** (with what happened) or **not run**. Leave a check unmarked until it has been done.

**Pages:**
- **Fixtures:** `tests/fixtures/v090/*.html`. Serve the repository with `npm run serve`, then open `http://localhost:8080/tests/fixtures/v090/<name>.html`.
- **Build:** run `npm run build` first. The fixtures load the development bundle (`/dist/reactive-css.js`), whose diagnostics are full text.

## 1. Firefox (automated run)

Playwright's Firefox fails to start inside the agent's command sandbox ("Could not find profile folder"), so the automated suite never ran in Firefox. On a normal terminal:

```bash
npm run build
```

```bash
npx playwright test --project=firefox
```

**Pass:**
- every test passes or is skipped;
- known WebKit-only skips do not apply.

Report failures with the test title and the error.

If Firefox does not start there either:

```bash
npx playwright install firefox
```

Then run the suite again.

## 2. Real Safari (macOS and iOS)

Playwright WebKit is not Safari. Open each fixture in Safari 18 or later.

| Fixture | Steps | Pass when |
|---|---|---|
| `counter.html` | +, +, ×2, +10, Reset | The text shows 2, 4, 14, 0. − is disabled at 0. |
| `disclosure.html` | Click the toggle; Tab to the tabs; ArrowRight × 4; ArrowLeft × 5 | `aria-pressed` flips. The selection stops at Three and at One, and the page never scrolls. |
| `overlays.html` | Open the menu, click outside; open, press Escape; open the dialog, Escape, Enter | The menu closes both times. The field takes focus on open. Focus returns to "Open dialog" on Escape. |
| `forms.html` | Type in Name; check News; choose red; move the range with the keys; choose L; Reset | The previews follow. Reset restores M, blue, unchecked, 5. |
| `persist.html` | Switch the theme to dark, reload; + twice in one widget | Dark survives the reload. Both counters show 2. |
| `drag.html` | Drag the card twice; drag both sliders past their ends; drag the split divider | The card continues from where it was. Sliders stop at their ends. The left pane is 50–350 px wide. |
| `focus.html` | Click a, then b; click Search | a gets the orange outline and shakes once; b does not. Find takes focus. |
| `events.html` | inner, stop, plain × 2, link, submit | outer 3, inner 101. The link does not navigate. "Send" counts. |

iOS Safari: repeat `drag.html` with a finger (section 3).

## 3. Touch and pen hardware

Use a phone or tablet: iOS Safari and Android Chrome. Use a pen if available: iPad with Apple Pencil, or a Windows pen.

| Check | Fixture | Pass when |
|---|---|---|
| Drag with a finger | `drag.html` card (`touch-action: none`) | The card follows the finger. The page does not scroll while dragging. |
| Scrolling is not hijacked | `drag.html`: start a vertical swipe outside the card | The page scrolls normally. |
| Pen pressure and type | A test page with `.c:on(drag) { --p: set(event(pressure)); --t: set(event(pointer-type)) }` (see note 1) | `--p` changes with pressure; `--t` is `pen`. |
| Cancel by the system | Start a drag, then open the system gesture: notification shade, or home swipe on iOS | `drag(cancel)` runs. The `--dragging` state returns to false. Counter 0 in `drag.html`'s cancels display goes up by one. |
| Two fingers on two cards | A page with two `.card` elements (copy of `drag.html` with a second card) | Both move independently. A second finger on the same card does nothing. |
| Small targets | `drag.html` vertical slider thumb (20 × 16 px) | It can be grabbed. Report if it cannot; that is a fixture issue, not the runtime. |

**Note 1:** the pen test page is a plain HTML file with that CSS and one `<div class="c">`, and the script tag of the fixtures.

## 4. Screen readers

VoiceOver (macOS and iOS), NVDA or JAWS (Windows), TalkBack (Android).

| Check | Fixture | Pass when |
|---|---|---|
| Toggle state | `disclosure.html` toggle | It is announced as a toggle button with pressed or not pressed, and the state changes are announced. |
| Tabs | `disclosure.html` tabs | It is announced as a tab list with a selected tab. The arrow keys move the selection. Only the selected tab is in the Tab order. |
| Accordion | `disclosure.html` accordion | It is announced as collapsed or expanded. |
| Dropdown | `overlays.html` | The menu button announces expanded or collapsed. Escape closes the menu and focus stays on the button. |
| Dialog focus | `overlays.html` dialog | Opening moves the screen-reader cursor to the Name field. Closing returns it to "Open dialog". Focus is never moved when nothing was activated. |
| Live text | `counter.html` | The value changes are readable. They are **not** announced automatically, because the output has no `aria-live`; that is the fixture's choice. |
| `:blur` animation | `focus.html` | Shaking does not move focus or re-announce the field. With "Reduce motion" on, add a `prefers-reduced-motion` rule in a copy and check that it is respected. |
| Drag alternatives | `drag.html` card | The card is reachable with Tab. ArrowRight moves it by 10 px; a drag must have a keyboard path. |

## 5. Reduced motion and forced colors

| Check | How | Pass when |
|---|---|---|
| Reduced motion | System setting on; `focus.html` and `drag.html` | Animations are only those the CSS allows. Drag still works. |
| Forced colors / high contrast | Windows contrast theme; `disclosure.html` | Selected tab and pressed toggle remain visible: they come from native outlines and states, not only colors. |

## 6. Real CodePen (optional, before announcing CodePen support)

Local tests used a CodePen-like harness (`tests/browser/codepen.spec.ts`), not codepen.io.

To verify on the real service:
1. Make a **private** pen: HTML and CSS from one fixture, with the external script set to the built `reactive-css.min.js` served from a URL you control.
2. Run the fixture steps from section 2.
3. Edit the CSS live, then reload the preview.

**Pass:** behavior matches section 2 after both actions.

Do not publish the pen as part of validation.
