# API examples (0.8.0)

Sixteen small, interactive pages in `examples/api/`. Each shows one Reactive CSS capability, with the real runtime and no application JavaScript. They are meant to become the website's Examples gallery later.

- **Version:** checked against the repository, which is at 0.8.0 (`package.json`, `CHANGELOG.md`, `describe()`).
- **Runtime:** unchanged. No API, feature, `site/` file or existing demo was modified.
- **Not done:** publishing, deployment and Git operations.

## 1. The examples

Each folder has three files:

- `index.html`;
- `style.css`: layout first, then the Reactive CSS after a `/* ---- Reactive CSS ---- */` divider, the same convention the site already uses for library demos;
- `README.md`: what it demonstrates, APIs used, how to interact, expected result, native alternative, limitations.

The shared look lives in `examples/api/api.css`: plain CSS with neutral paper, dark text, vermilion accents and visible focus rings. `examples/api/index.html` lists all sixteen. "Rules" counts the rules in the Reactive CSS part.

| # | Folder | Shows | Rules |
|---|---|---|---:|
| 01 | `counter` | − / value / +; the value is DOM text | 4 |
| 02 | `state-history` | current, previous, direction (word and arrow) | 9 |
| 03 | `random-colors` | a swatch with a new random hue per click, and the hue number | 3 |
| 04 | `pick-value` | a random fruit from five, and a pick counter | 4 |
| 05 | `live-values` | a meter that gets a new level every 2 s | 3 |
| 06 | `mouse-tracker` | a dot that follows the pointer, with x/y | 3 |
| 07 | `element-size` | a card's measured width scales its letters; set vs measured | 6 |
| 08 | `input-binding` | a field mirrored as DOM text, next to generated content | 5 |
| 09 | `conditional-styles` | three wind levels change color, rotation, animation, label | 10 |
| 10 | `dynamic-attributes` | 1–5 quantity; real `disabled` at both ends | 4 |
| 11 | `keyboard-controls` | arrow keys move a token on a 5×5 board; the page does not scroll | 5 |
| 12 | `focus-management` | Next shows the next panel and focuses its heading | 8 |
| 13 | `state-selection` | four cards, one selected by click or Previous/Next | 6 |
| 14 | `change-animation` | a number that pops on every change | 6 |
| 15 | `viewport` | the viewport size as numbers and a bar | 4 |
| 16 | `visibility` | a target in a scroll box fades in when 60 % visible | 4 |

## 2. Coverage matrix

The version and status columns come from the feature registry (`describe()`). Reference pages exist on the local site at `/docs/reference/<id>/`. Modules are the 0.8.0 bundle features the analyzer found. Each feature also requires `core`.

| # | Primary | Supporting | Since | Status | Bundle features | Reference |
|---|---|---|---|---|---|---|
| 01 | `state()`, `increment()`, `decrement()` | `on: click()`, `text:` | 0.2 (`text:` 0.5.1) | stable (`text:` exp) | core, events, text | `state`, `increment`, `decrement`, `text` |
| 02 | `previous()`, `direction()` | `:when()`, `text:` | 0.3 | stable | core, events, conditions, history, text | `previous`, `direction` |
| 03 | `random()` | `on(click, …)` | 0.1 | stable | core, values, dynamic | `random`, `on-value` |
| 04 | `pick()` (in `set()`) | `set()`, `increment()`, `text:` | 0.1 (in `set()`: 0.5) | stable (expression exp) | core, events, text | `pick`, `pick-expression`, `set` |
| 05 | `live()` | `random()` | 0.1 | stable | core, values, dynamic | `live` |
| 06 | `mouse()` | — | 0.1 | stable | core, dynamic | `mouse` |
| 07 | `element()` | `bind:`, `text:` | 0.4 | **experimental** | core, forms, text, geometry | `element`, `bind` |
| 08 | `bind:`, `text:` | `:when()` | 0.3, 0.5.1 | stable, exp | core, conditions, forms, text | `bind`, `text` |
| 09 | `when()`, `:when()` | `set()`, `attr:`, `text:` | 0.2 | stable | core, events, conditions, text, attributes | `when`, `when-selector` |
| 10 | `attr:` | `when()`, `text:` | 0.5.3 | **experimental** | core, events, conditions, text, attributes | `attr-declaration` |
| 11 | `key()`, `prevent()` | `cycle()`, `text:` | 0.3, 0.7.0 | stable, **exp** | core, events, text | `key`, `prevent`, `cycle` |
| 12 | `focus:` | `:nth-var()`, `cycle()`, `:when()`, `text:` | 0.6.0 | **experimental** | core, events, conditions, nth-var, text, focus | `focus-declaration` |
| 13 | `:nth-var()` | `set(…, sibling-index())`, `cycle()`, `attr:`, `text:` | 0.1 | stable | core, events, nth-var, text, attributes | `nth-var` |
| 14 | `:changed()` | `increment()`, `set()`, `text:` | 0.3 | stable | core, events, history, text | `changed` |
| 15 | `viewport()` | — | 0.1 | stable (compiles to `100dvw`/`100dvh`) | core, dynamic | `viewport` |
| 16 | `visible()` | — | 0.1 | stable | core, dynamic | `visible` |

**Not covered.** These public features are not in the sixteen. I'm reporting them rather than adding more examples:

- `toggle()`;
- `closest()` scoping;
- `outside()`;
- the other triggers: `input`, `change`, pointer and focus triggers, and the 0.5.1 lifecycle triggers (`focusin`, `reset`, `animationend`…);
- `:just-checked` and `:just-unchecked`;
- `typed()`;
- `state(…, bind(attribute))`;
- `attr()` and `split()` expressions;
- `sibling-count()`;
- the other `attr:` targets (`aria-disabled`, `tabindex`, `hidden`, `required`, `aria-current`).

Most of these appear in the application demos (`accessible-toggle`, `product-configurator`, `accessible-tabs`, `form-interactions`…). `:just-checked`, `toggle()` and `outside()` would be the next small examples.

## 3. Native CSS alternatives

Each README has a "Native CSS alternative" section. The short version:

| Example | Native alternative |
|---|---|
| Counter, state history, pick value | None: CSS has no writable values or value history |
| Random colors | Native `random()` (CSS Values 5) gives a fixed value per load; re-rolling on a click has no native form |
| Live values | Animations follow a fixed timeline. Neither CSS nor Reactive CSS has a wall clock, so the example is "Live values", not a clock |
| Mouse tracker | None: CSS cannot read the pointer position |
| Element size | **Container units** (`cqw`) and container queries do the scaling natively and are preferred. `element()` adds the measured number |
| Input binding | None for copying a value into the page (`:placeholder-shown` only tells empty from not empty) |
| Conditional styles | **Radio buttons with `:checked` + `:has()`** do this in a form. `when()` becomes native `if()` for boolean conditions |
| Dynamic attributes | None for changing attributes. `<input type="number" min max>` enforces a range by itself |
| Keyboard controls | None. Native widgets (radios, sliders) have their own arrow keys |
| Focus management | None. `<dialog>`, `popover` and `autofocus` manage their own focus and stay preferred |
| State selection | **Radio buttons with `:checked` + `:has()`** in forms (they also bring arrow keys). `:nth-var()` is for indexes that come from state |
| Change animation | None for "after a change". Restarting an animation otherwise needs a script |
| Viewport | **It is native:** `viewport()` compiles to `100dvw`/`100dvh` |
| Visibility | **Scroll-driven animations** (`animation-timeline: view()`) for purely visual effects. `visible()` adds a 0/1 value to compute with |

## 4. Adapted to the real API

| Example | What the brief asked | What the API allows | What I did |
|---|---|---|---|
| 03 Random colors | Show the value "if the runtime supports it" | `text:` displays states only. `random()` cannot go into a state (`set()` accepts `pick()`, not `random()`) | The hue is printed with a native counter (`counter-reset: hue var(--hue)`), as generated content. The README says it is not DOM text |
| 03 Random colors | Re-roll on interaction | `on(click, …)` listens on the element with the declaration | The declaration is on the card, so a click anywhere in it re-rolls. The README notes this |
| 05 Live clock | A clock "only if real time is available" | No function returns the time of day | Titled "Live values": a meter with a new random level every 2 s |
| 06, 07, 15 | Coordinate, size and viewport readouts | Values are px lengths, and `text:` cannot show them | `round(tan(atan2(var(--x), 1000px)) * 1000)` with counters: px → number in Chromium, WebKit and Firefox (Firefox has no typed arithmetic, so `round(var(--x) / 1px)` printed nothing there). Exact for -500 to 4000 px; the 1000px scale keeps Firefox's single-precision angle exact |
| 07 Element size | "Resizable" card | `resize: horizontal` is mouse-only | A native range input bound with `bind:`, which works with the keyboard. The card is `content-box`, so "measured" (border box) visibly differs from "set" |
| 09 Conditional styles | Two or three states, not a boolean | — | Three levels of a number state. `when()` for one value, `:when()` for whole rules including `text:` |
| 11 Keyboard controls | Bounded movement | Bounds need conditional rules per edge | `cycle()` with the list forwards and backwards: the token wraps around the edges, and the README says so |
| 13 State selection | A selection readout | A name readout would need a second state that Previous/Next cannot update | The readout shows the position, "Selected: 3 of 4" |
| 16 Visibility | Visible state feedback | `visible()` measures the element with the declaration, and only its descendants inherit the value | The status line is the target's child, absolutely positioned against a wrapper outside the scroll box, so it stays visible. A native style query `@container style(--seen: 1)` switches its text |

## 5. Custom bundles

For every example, `tests/browser/api-examples.spec.ts`:

1. runs the library's analyzer on the folder;
2. builds the smallest bundle with `tools/bundle.mjs`;
3. checks that the manifest equals the analyzer's resolved features, and that `focus` brings `events`;
4. runs the same behavior test with that bundle served in place of `reactive-css.min.js`.

All 16 report the analysis as complete. Sizes are measured on 0.8.1.

| Example | Bundle features | Minified | gzip |
|---|---|---:|---:|
| mouse-tracker, viewport, visibility | core, dynamic | 46,895 | 17,167 |
| random-colors, live-values | core, values, dynamic | 52,385 | 19,119 |
| element-size | core, forms, text, geometry | 55,112 | 19,992 |
| counter, pick-value, keyboard-controls | core, events, text | 56,177 | 19,765 |
| input-binding | core, conditions, forms, text | 59,030 | 21,320 |
| change-animation | core, events, history, text | 60,947 | 21,314 |
| state-history | core, events, conditions, history, text | 66,603 | 23,313 |
| focus-management | core, events, conditions, nth-var, text, focus | 68,915 | 24,058 |
| state-selection | core, events, nth-var, text, attributes | 68,765 | 23,705 |
| conditional-styles, dynamic-attributes | core, events, conditions, text, attributes | 71,889 | 24,777 |
| *(full custom bundle, for comparison)* | every feature | 100,112 | 34,023 |

The behavior is identical with the full and the custom bundle: the same assertions pass for both, in both engines. The viewport example still needs the `dynamic` feature: `viewport()` compiles to native units, but the function belongs to that feature.

## 6. Browser tests

All run with `npx playwright test`, against `node build.mjs --serve`.

| Run | Result |
|---|---|
| `tests/browser/api-examples.spec.ts`, Chromium + WebKit | 74 passed: 16 examples × 2 bundles, plus the bundle check, idle activity, repeated mounting and 2 lab tests, in each engine. With `--repeat-each=2`: 148 passed |
| Same spec at 4× CPU (Chromium) | 37 passed |
| Whole browser suite, Chromium + WebKit | 595 passed, 5 skipped (the existing WebKit skips), twice in a row |
| `RCSS_CUSTOM=1`: application demos plus API examples on analyzer bundles | 134 passed |
| Unit (`npm test`), typecheck, dist (`npm run test:dist`) | 102 passed; 0 errors; passed |
| Firefox | **Not run:** Playwright's Firefox still does not start on this machine ("Could not find profile folder"). Firefox is unverified |

Every example runs under a strict CSP (`default-src 'none'; script-src 'self'; style-src 'self'`). The checks use real mouse and keyboard input, and assert DOM text, attributes, `document.activeElement`, computed styles, `defaultPrevented` and `getAnimations()`. A few examples:

- the previous value matches the state before the last change;
- the random hue is an integer from 0 to 359, and the swatch reaches its color;
- picks stay in the list;
- `disabled` is a real boolean attribute, and rapid clicks stop at the limit;
- focus moves on click and on Enter, never on load;
- arrow keys are cancelled while Page Down scrolls, and the caret moves in a text field;
- `:changed()` restarts on every change, not on a no-op, and switches to the color-only animation under reduced motion;
- the measured width is the set width plus 34 px, capped by the available width;
- `visible()` goes 0 → 1 → 0 with wheel scrolling.

`finish()` then removes the page content and checks that bindings, states and sources are back to 0.

## 7. Performance and cleanup

- **Idle:** 1.2 s with no input causes no flushes on any page, except `live-values`, which is allowed at most one (its 2 s interval). `viewport()` has no runtime part (0 sources).
- **Cleanup:** after the content is removed, timers (`intervals`) and scheduled callbacks are 0 on every page. On the five pages built on `live()`, `mouse()`, `element()`, `visible()` and `viewport()`, shared observers and listeners are 0 too. The one listener left on `on:` pages is the stylesheet-level document listener, by design.
- **Repeated mounting** (live, mouse, element, visibility, keyboard, focus): after 20 remounts, bindings, states, sources, observers, timers and (in Chromium) JS event listeners equal the first mount.
- **Memory** (Chromium, heap after GC, a scratch measurement, not a test):
  - over 1,000 remounts of `focus-management`, the heap grows by about 230 KB in the first 600, then is flat (1,944 → 1,948 → 1,950 KB);
  - `counter` levels off the same way (1,727 → 1,729 → 1,729 KB);
  - DOM nodes and listeners stay constant.

  That is warm-up, not retention.
- **Rendering:** the pointer and meter effects use `translate` and `scale`, never layout properties. `mouse()` updates at most once per frame, and `live()` uses one shared timer per interval.

## 8. Experimental status and limitations

- **Experimental here:**
  - `text:` (in 11 of the 16 examples), `attr:`, `focus:`, `prevent()`, `element()`;
  - `pick()` in `set()`.
- **Generated-content readouts** (03, 05, 06, 07, 15, 16) are not DOM text: not selectable and not reliably announced.
- **Typed arithmetic:** the numeric readouts need CSS typed arithmetic, and the visibility status needs style queries. Both work in the tested engines and degrade to a fallback text elsewhere.
- **Pointer-only:** `mouse()` has no keyboard equivalent. The dot rests in the middle, and the README says the effect is decorative.
- **Screen readers:** none were tested. The READMEs claim no screen-reader behavior beyond what the DOM shows.

## 9. Accessibility

- **Native controls:** buttons, a text field and a range input, with visible labels or `aria-label`s, and visible focus (`api.css`).
- **Focusable areas:**
  - the keyboard board is a focusable, labelled `role="group"`, with instructions linked through `aria-describedby`;
  - the scroll box in the visibility example is focusable for keyboard scrolling.
- **Live regions:** values that change (counter, quantity, pick, positions) are in `aria-live="polite"` regions or `<output>`.
- **Reduced motion:** transitions shrink to near zero under `prefers-reduced-motion`. The flag animation stops, and the change animation becomes a color flash.
- **Keyboard traps:** none. The board handles only the four arrows; Tab leaves it.
- **Focus targets:** the focus headings have `tabindex="-1"` in the HTML, and the library adds none.

## 10. Discovery and the website

- **Demo lab:** `examples/lab/` has a second group, "API examples — small interactions", that opens each example with its README and source. The 20 application demos, their group and the cross-browser checklist are unchanged (the checklist reads `.examples` only).
- **Index and README:** `examples/api/index.html` and `examples/api/README.md` list them. The library README points to both.
- **Why `examples/api/`:** the site's sync copies every top-level `examples/<name>/` that has `index.html`, `style.css` and `README.md`. Putting the API examples one level down keeps the website exactly as it is until it is integrated on purpose. `api/` itself has no `style.css`, so it is never mistaken for a demo.

**Suggestions for the gallery:**

- One card per example: the title, the primary API in mono, a live preview (the site's sandboxed `PreviewFrame` already runs library demos), and only the Reactive CSS part of `style.css`, which the divider makes easy to split.
- Show each README's "Native CSS alternative" on the card as a short note: it is the honest answer to "why would I use this?".
- Group by capability, as in the matrix: state and actions, history, values over time, pointer and geometry, forms and text, conditions and selection, accessibility (attributes, keys, focus).
- Show the custom bundle features and size per card from the table in section 5. The bundle builder can link "build only what this example needs" to `?features=…`.
- Label the generated-content readouts as such in the gallery, so nobody mistakes them for `text:`.
