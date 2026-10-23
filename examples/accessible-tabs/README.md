# Accessible tabs

Two independent tab sets. Each tab reports a real `aria-selected`, inactive panels are `hidden`, one tab is disabled in the HTML, and the "Billing" tab is disabled until a checkbox in the first panel is checked.

Run: `npm run serve`, then open `http://localhost:8080/examples/accessible-tabs/` (or the demo lab, `examples/lab/`). Tests: `tests/browser/examples.spec.ts`.

## 1. What it demonstrates

Selection state owned by the tab set and **derived onto many elements**: `aria-selected` on every tab, `hidden` on every panel, `disabled` on one tab. In 0.5.2 this was impossible: a state could only bind an attribute of its owner.

## 2. Reactive CSS features

| Feature | Use |
|---|---|
| `state()` | `--active` (position of the active tab), `--billing`, owned by each `.tabs` |
| `set(--active, sibling-index())` | a tab click selects that tab |
| `:nth-var()` | picks the active tab and panel in the selectors |
| `attr: tabindex` *(0.6.0)* | roving `tabindex`: `0` on the selected tab, `-1` on the others |
| `prevent()` *(0.7.0)* | ArrowLeft/Right, Home and End do not also scroll the page; other keys (PageDown, Space) still do |
| `key()` + `focus:` *(0.6.0)* | ArrowLeft/Right (`cycle()` lists that skip disabled tabs), Home, End; focus follows the selected tab |
| `attr:` *(0.5.3)* | `aria-selected` "false" on every tab and "true" on the active one; `hidden` on every panel but the active one; `disabled` on Billing until `--billing` |
| `bind:` | the "I have a billing account" checkbox ↔ `--billing` |

## 3. What native HTML/CSS does

- `role="tab"`, `role="tabpanel"`, `aria-controls`, `aria-labelledby` are static markup.
- `hidden` hides panels natively; `[aria-selected="true"]` and `:disabled` style the tabs.
- Buttons give Enter and Space.

## 4. What would normally need JavaScript

Setting `aria-selected` on the tabs and `hidden` on the panels for every selection change, and enabling the Billing tab. A radio-button CSS trick can show one panel, but it cannot expose tab semantics.

## 5. Limitations found

- **The ARIA Tabs keyboard pattern, automatic activation (0.6.0).** Roving `tabindex` (`attr: tabindex "0"` on the selected tab, `"-1"` on the others): only the selected tab is in the Tab order, and Tab moves on to its panel. ArrowLeft/ArrowRight (wrapping), Home and End select a tab and move focus to it (`key()` + `focus:`). The disabled tabs are skipped; Billing joins the arrow order when enabled. Tested in Chromium and WebKit, except Tab itself, which is checked in Chromium only: WebKit's default Tab order skips buttons (macOS setting). Not verified with screen readers, so compliance is not claimed beyond the tested keyboard behavior. Manual activation (arrows move focus without selecting) is not expressible: focus follows selection here.
- **Scrolling (0.7.0).** The handled keys use `prevent()`, so a scrollable page does not jump when you move between tabs. Tested with real keys on a scrollable page: Home/End in both engines, arrows in Chromium. Headless WebKit does not scroll on arrow keys at all, so there only `defaultPrevented` is checked.
- **Positions, not names.** `--active` is a position (`sibling-index()`). Reordering tabs in the HTML without reordering the panels breaks the pairing.
- **Disabling the active tab.** If Billing were active and `--billing` became false, the active tab would be disabled. Here the checkbox lives in the Profile panel, so that cannot happen. A general fix needs a rule that resets `--active`.
- **Progressive enhancement:** without the script all panels are visible and no tab is marked selected.

## 6. Accessibility

- Real `aria-selected` on every tab, real `hidden` on inactive panels: hidden panels are out of the tab order and the accessibility tree (tested).
- Native `disabled` on Team (static) and Billing (derived): announced as unavailable, skipped by Tab.
- Arrow keys, Home/End and roving `tabindex` are implemented and tested (0.6.0). Missing: Delete (closable tabs, not applicable), screen-reader verification.

## 7. Production use

Suitable for content tabs. The keyboard behavior follows the ARIA Tabs pattern with automatic activation and is browser-tested; verify with screen readers before claiming conformance.

## 8. Manual test checklist

| Scenario | Expected |
|---|---|
| Load | Profile selected (`aria-selected="true"`), other panels `hidden`; Billing and Team disabled |
| Single click on Security | Security selected and shown; Profile panel hidden |
| Double click on a tab | Same as one click |
| Rapid clicks across tabs | The last clicked tab is selected; exactly one panel visible |
| Tab | Enabled tabs in order, then the visible panel's controls; disabled tabs skipped |
| Enter / Space on a tab | Selects it |
| Check "I have a billing account" | Billing enabled; clicking it shows the Billing panel |
| Two tab sets | Independent |
| Narrow viewport (320 px) | Tabs wrap |
| Strict CSP | No violations, no console errors |
| Browser differences | WebKit does not focus buttons on click |
