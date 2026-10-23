# Browser validation guide, 0.7.1

A manual test plan for Chrome, Safari and Firefox, and its result.

> **Manual result (user-reported): all 20 examples passed in Google Chrome, Safari and Firefox.** Section 5 records this as the user reported it.
> - No per-step logs, timestamps or browser versions were provided, and none are invented here.
> - The checklist page (`examples/lab/checklist.html`) does not store results, so it holds no record of this pass.
> - Automated results (Playwright Chromium and WebKit) are separate and unchanged: [release-0.7.1.md](release-0.7.1.md). Playwright's Firefox still cannot run on the development machine, so Firefox has manual coverage only.
> - Screen readers remain **unverified**.

## 1. Start the local server

```bash
npm install
```

```bash
npm run serve
```

The server builds `dist/` and serves the repository on `http://localhost:8080/`. Use one of:
- **The demo lab:** `http://localhost:8080/examples/lab/`, with a live preview, sources, README and diagnostics.
- **The cross-browser checklist:** `http://localhost:8080/examples/lab/checklist.html`. Set pass/fail per browser, then copy the results as Markdown or print them.
- **Each example on its own**, at the URL in section 3. Open it standalone for keyboard and focus checks, not inside the lab's iframe.

Write down the exact browser versions (About Chrome, About Safari, Help → About Firefox) and the operating system.

## 2. Before you start, in each browser

| Step | Chrome | Safari | Firefox |
|---|---|---|---|
| Open the developer console | View → Developer → JavaScript Console | Settings → Advanced → "Show features for web developers", then Develop → Show JavaScript Console | Tools → Browser Tools → Web Developer Tools → Console |
| Keyboard: Tab reaches buttons | yes, by default | **only with** Safari → Settings → Advanced → "Press Tab to highlight each item on a webpage", or System Settings → Keyboard → "Keyboard navigation" (otherwise Option+Tab). By default Tab skips buttons, radio buttons and checkboxes, which looks like a failure but is browser behavior | yes, by default (macOS: also needs the system setting) |
| Reduced motion | Rendering panel → "prefers-reduced-motion: reduce", or the OS setting | OS: Accessibility → Display → Reduce motion | OS setting, or `ui.prefersReducedMotion` = 1 in about:config |
| Narrow viewport | Device toolbar (320 px wide) | Develop → Enter Responsive Design Mode | Responsive Design Mode (Ctrl/Cmd+Shift+M) |

**Capturing console errors.** Keep the console open while testing. For each example, after the checklist, type `ReactiveCSS.diagnostics` and press Enter. Copy any red error or the diagnostics array into the results:
- right-click → "Copy" / "Save as…" in Chrome;
- select and copy in Safari and Firefox.

The examples load the production bundle, which logs one summary line instead of each warning. For details, change `reactive-css.min.js` to `reactive-css.js` in the example's `index.html`, locally.

## 3. Tests per example

The exact actions and expected results are each example's README, section 8, also shown in the checklist page. The README's section 9 lists the browser notes. URLs and the points most likely to differ between browsers:

| Example | URL | Watch especially |
|---|---|---|
| A. Focus transitions | `/examples/focus-transitions/` | Focus after clicks (Safari focuses nothing on click: compare with keyboard activation). The popover must keep focus. Locked Confirm: focus deliberately unchanged |
| B. Keyboard navigation | `/examples/keyboard-navigation/` | **Arrow keys must not scroll the page while unlocked, and must scroll while locked.** Automated WebKit cannot check arrow scrolling at all (headless WebKit never scrolls on arrows). Home/End inside the filter (macOS: no caret move, native) |
| C. Attribute playground | `/examples/attribute-playground/` | The live table (native `:has()` in all three). The `aria-disabled` button stays focusable and clickable but inactive |
| D. Dynamic components | `/examples/dynamic-components/` | No console errors on "Click + and remove in one task". The stats line after each step |
| E. Nested state & cascade | `/examples/nested-cascade/` | Which owner each button changes. `@layer` and `!important` chips |
| F. Form interactions | `/examples/form-interactions/` | `:user-invalid` timing differs by browser (after blur or after submit). Submit never navigates |
| G. History & motion | `/examples/history-motion/` | Pulse/dip animation and bar transition, both off under reduced motion |
| H. Stylesheet lab | `/examples/stylesheet-lab/` | Disable/re-enable `extra.css` (a 0.7.1 fix). The `media` toggle. Swapping the state sheet resets n (expected) |

Earlier examples (still part of the lab and the checklist): product configurator, wizard, quiz, live form preview, score history, settings panel, accessible tabs, shopping cart, notification center, form validation, keyboard playground, accessible toggle.

## 4. Expected DOM, keyboard and focus behavior (common to all)

- **DOM.** Inspect elements in the Elements/Inspector panel: derived attributes (`disabled`, `hidden`, `aria-*`, `tabindex`, `data-*`) are real attributes and change as described. `disabled` is present or absent, never `disabled="false"`.
- **Keyboard.** Handled keys (listed per example) do not scroll the page; all other keys keep their browser behavior. Keys typed in text fields stay with the field.
- **Focus.**
  - It never moves on page load.
  - It moves only after a click or key press that changes the relevant state.
  - It never moves out of an open popover or dialog.
  - It never moves when the target is hidden or disabled.
- **Known browser differences:**

| Difference | Chrome | Safari | Firefox |
|---|---|---|---|
| A click focuses a `<button>` | yes | **no** | yes (but not on macOS buttons by default) |
| Tab reaches buttons | yes | only with keyboard navigation turned on | yes (macOS: system setting) |
| Arrow keys scroll the page natively | yes | yes in the browser (headless automation: no) | yes |
| Home/End move a text field's caret | Windows/Linux yes, macOS no | no (macOS) | Windows/Linux yes, macOS no |
| `:user-invalid` | shown after the field loses focus | same | same |

## 5. Results matrix

**User-reported manual results.** All 20 examples passed in all three browsers. These are not automated results and were not observed by the development tooling.

| Example | Chrome | Safari | Firefox |
|---|---|---|---|
| A. Focus transitions | pass | pass | pass |
| B. Keyboard navigation | pass | pass | pass |
| C. Attribute playground | pass | pass | pass |
| D. Dynamic components | pass | pass | pass |
| E. Nested state & cascade | pass | pass | pass |
| F. Form interactions | pass | pass | pass |
| G. History & motion | pass | pass | pass |
| H. Stylesheet lab | pass | pass | pass |
| Product configurator | pass | pass | pass |
| Multi-step wizard | pass | pass | pass |
| Interactive quiz | pass | pass | pass |
| Live form preview | pass | pass | pass |
| Score history | pass | pass | pass |
| Settings panel | pass | pass | pass |
| Accessible tabs | pass | pass | pass |
| Shopping cart | pass | pass | pass |
| Notification center | pass | pass | pass |
| Form validation | pass | pass | pass |
| Keyboard playground | pass | pass | pass |
| Accessible toggle | pass | pass | pass |

Browser versions and OS: not reported. Tester: the user. Date: not recorded.

**Safari Tab navigation: corrected from fail to pass.**
- **First result:** Tab skipped buttons, radio buttons and checkboxes, while still focusing text inputs and selects.
- **Cause:** Safari's default keyboard navigation on macOS reaches only text fields and lists. This is browser behavior, not a Reactive CSS bug.
- **Corrected result:** with full keyboard navigation turned on, Tab navigation worked correctly and every affected example passed. The setting is either Safari → Settings → Advanced → "Press Tab to highlight each item on a webpage", or the macOS setting System Settings → Keyboard → "Keyboard navigation".
- **The same applies to any manual Safari keyboard test:** turn that setting on first (section 2).

| Coverage | Chrome | Safari | Firefox |
|---|---|---|---|
| Manual, all 20 examples (user-reported) | pass | pass | pass |
| Automated (Playwright) | Chromium: pass | WebKit: pass | not run: Playwright's Firefox does not start here |
| Screen readers | unverified | unverified (VoiceOver not tested) | unverified |

## 6. Reporting a failure

For each failure, record:
- the example, the checklist row and the browser version;
- the expected and the observed result;
- console errors and `ReactiveCSS.diagnostics`;
- the attribute values from the Elements panel, and `document.activeElement` (type it in the console) for focus rows.

A failure in Safari or Firefox that the automated Chromium/WebKit tests do not show is the most valuable result of this plan.
