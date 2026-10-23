# Reactive CSS 0.9.0 — website readiness

Local stabilization pass, 2026-10-22. Library: the final local 0.9.0 build (`../dist`, built 04:21; no source change after it). Nothing was committed, pushed, published or deployed; no git command was run. The Control Center release record for 0.9.0 is still **prepared / unpublished**, with no npm, CDN or GitHub URL.

## A. Completion summary

**Examples catalog**
- **API examples (15):** the 14 from the brief, plus Context menu (added earlier at the user's request).
  - Form mirror now shows `state("", bind(value))` on the field, as well as the `:on(input)` copy and `:on(reset)`. It is wrapped in a `section.demo` again.
  - Counter's tags now include `decrement()` and `content`.
- **Interfaces: replaced.** The 12 library demos written in 0.8 syntax were swapped for 8 site-authored 0.9 components in `src/catalog/interfaces/`: Tabs, Accordion, Dropdown menu, Theme switcher, Signup form, Step wizard, Task list and Pricing toggle.
  - Each has HTML, CSS, a README (what it shows, APIs used, how to interact, expected result, native alternative, limitations), API tags, reference links and "Open in Playground".
  - Each adds the accessibility wiring a full component needs: `aria-selected`/`tabindex`, `aria-expanded`, `aria-checked`, `aria-current`, `disabled`, and focus requests.
- **The 12 library demos moved to Test lab.** They are 0.8-syntax compatibility cases (18 lab cases in all), they keep their URLs, and they carry the "0.8 syntax" tag. The library's files were not edited.
- **Advanced:** unchanged (Control Center, Deep Dive).
- **Redirects:** the old walkthrough URLs (`/docs/examples/{accordion,tabs,form,theme,dropdown}/`) and the retired examples `state-selection` and `keyboard-controls` now point to the 0.9 Interfaces instead of 0.8 demos. Each is still one hop.

**Context menu / event coordinates investigation (§5)**
- **Root cause:** a type mismatch in the reported CSS, not a runtime bug. `state(0)` is a **number** state and `event(client-x)` is a **length**. The runtime refuses the write and says so: *"300px cannot be stored in --x, which holds 0"*. So `--x` stays 0 and the menu sits at the top-left. `calc(var(--x) * 1px)` cannot help, because nothing was ever stored.
- **Fix:** declare `state(0px)` and use `left: var(--x)`. Verified in Chromium and WebKit, and kept as a regression test in `tests/e2e/interfaces.spec.ts`.
- `position: fixed` inside the preview iframe is relative to the iframe's viewport, which is the same frame `client-x` is measured in, so it is consistent.
- **Library finding (not changed, report only):** focus requests are armed only by `click`, `keydown`, `input`, `change`, `pointerup` and `submit` (`src/state/focusdecl.ts:23`). So `focus: when(--open)` cannot move focus into a menu opened by `contextmenu`. This is documented behavior. The library could consider adding `contextmenu` to the arming events.
- The example now positions with `event(local-x/y)` clamped by `element(width/height)`. The menu sits next to the desk instead of inside it, because a focus request is dropped when focus is already inside its target (RFC rule 8). Its README states both limits.

**Documentation and reference**
- Legacy reference pages (`on:`, `bind:`, `text:`, `attr:`, `closest()`, the 0.8 triggers): kept at their URLs, listed only on the migration page. They are now also left out of the **search index** and the **sitemap**, and their tag again shows the version they shipped in.
- **Reference text:** `prevent()` and `stop()` gained a 0.9 "Cancel only while a condition holds" example. The `--attr-*` summary names the common attributes, so "aria-disabled" finds it. One stale "Legacy `on:`" sentence was removed from `:on()`.
- **Code highlighting:**
  - `content` on `::before`/`::after` is native CSS again, as the runtime treats it.
  - `prevent()` and `outside()` inside `:on()` link to their reference pages.
  - Code-token buttons include their visible text in their accessible name (an axe `label-content-name-mismatch` fix, WCAG 2.5.3).

**Playground**
- `?example=<id>` gives an example a key of its own when a preset already has that id, so `?example=counter` opens the API example instead of the Counter preset.
- The preview runs the development bundle (`/runtime/reactive-css.js`, byte-identical to `../dist/reactive-css.js`), so diagnostics are full sentences instead of codes. Other previews run `reactive-css.min.js`.
- `persist()`'s sandbox storage note is translated in every preview (`explainSandbox()` in `src/lib/examples/protocol.ts`).

**Bundle Builder**
- **No feature definitions changed.** The builder reads the library's `catalog.json` and analyzes pasted CSS with the library's own compiler.
- **Verified:**
  - `focus: var()` needs no `conditions`, and `focus: when()` adds it.
  - `prevent()` and `stop()` are detected.
  - `once` and `:focus(when())` produce the library's diagnostics.
  - Legacy `bind:` and `on:` are detected and their missing features reported.
  - Drag, persist, forms, text and attributes keep their dependencies.

**Performance fix**
- Pages shipped the entire API reference and the full `describe()` registry to the browser for code-token tooltips (+27 kB gzip on most pages).
- `scripts/sync-runtime.mjs` now writes a small `src/generated/glossary.json`, which client islands import through `src/lib/content/glossary.ts`. `tests/unit/glossary.test.ts` keeps it identical to the server's `GLOSSARY`.

**Tests updated to the 0.9 site (no threshold lowered, nothing skipped to pass)**
- Rewritten: `playground.spec.ts` for the redesigned Playground, and the gallery, examples, API discovery, API examples, Bundle Builder and bundle CLI specs, which asserted retired examples, 0.8 text, hard-coded 0.8 sizes and old line numbers.
- **Measured values are now read from the library's own data** (`bundles.json`, `explain()` for minified diagnostics), never copied by hand.
- New: `interfaces.spec.ts` and `glossary.test.ts`.
- Visual baselines re-recorded for 7 pages after reviewing the diffs. All changes were intended: 0.9 code samples, the sidebar order, the Playground redesign and Bundle Builder sizes.

## B. Examples inventory

Every preview runs in a sandboxed iframe with `/runtime/reactive-css.min.js` (149,039 B, the final full bundle), except the Playground, which uses `/runtime/reactive-css.js`, the same build with full messages. "Interaction" means a test drives the example and checks its result; "loads" means the page runs with zero runtime diagnostics in both engines.

| Example | Category | Main capability | URL | Tests (Chromium + WebKit) |
|---|---|---|---|---|
| Counter | API | `state()`, `:on()`, `increment()`, `decrement()`, `content` | /examples/counter/ | interaction (card and page), loads |
| State toggle | API | `toggle()`, `:when()`, `--attr-aria-pressed` | /examples/state-toggle/ | loads |
| Form mirror | API | `bind(value)`, `event(value)`, `:on(reset)` | /examples/form-mirror/ | loads |
| Persistent preference | API | `persist()` | /examples/persistent-preference/ | loads (storage note expected in the sandbox) |
| Click coordinates | API | `event(local-x/y)` | /examples/click-coordinates/ | loads |
| Draggable card | API | `:on(drag)`, `event(x/y)` | /examples/draggable-card/ | loads; drag interaction is in the Playground Drag preset |
| Attribute sync | API | `--attr-*` | /examples/attribute-sync/ | interaction |
| Focus & blur | API | `focus: when()`, `:blur` | /examples/focus-blur/ | interaction |
| Live values | API | `live()` | /examples/live-values/ | loads |
| Mouse tracker | API | `mouse()` | /examples/mouse-tracker/ | loads |
| Element size | API | `element()` | /examples/element-size/ | loads |
| Conditional state | API | `cycle()`, `when()`, `:when()` | /examples/conditional-state/ | loads |
| State history | API | `previous()`, `direction()` | /examples/state-history/ | loads |
| Random colors | API | `random()`, `pick()` | /examples/random-colors/ | loads |
| Context menu | API | `:on(contextmenu, prevent())`, `event()`, `element()` | /examples/context-menu/ | interaction (position, clamp, cancel, focus return) |
| Tabs | Interfaces | `cycle()`, `:nth-var()`, `--attr-*`, `focus:` | /examples/tabs/ | interaction (arrows, `prevent()`, roving tab stop) |
| Accordion | Interfaces | per-item state, `aria-expanded` | /examples/accordion/ | interaction |
| Dropdown menu | Interfaces | `outside()`, Escape, `focus:` | /examples/dropdown/ | interaction |
| Theme switcher | Interfaces | `cycle()`, `content` | /examples/theme-switcher/ | interaction |
| Signup form | Interfaces | `event(value/checked)`, `:on(reset)` | /examples/signup-form/ | interaction |
| Step wizard | Interfaces | `set(min/max)`, `aria-current`, `disabled` | /examples/step-wizard/ | interaction |
| Task list | Interfaces | `event(checked)`, `:just-checked` | /examples/task-list/ | interaction |
| Pricing toggle | Interfaces | `aria-checked`, `content: when()` | /examples/pricing-toggle/ | interaction |
| Control Center | Advanced | forms → states → preview | /examples/control-center/ | interaction |
| Control Center · Deep Dive | Advanced | actions, bindings, history | /examples/control-center-deep-dive/ | interaction |
| 18 library demos (product-configurator … history-motion) | Test lab, 0.8 syntax | compatibility | /examples/<id>/ | each loads with no diagnostics; several have interaction tests (demos.spec, bundle-cli) |

**Playground presets:** Blank, Toggle, Counter, Tabs, Input binding and Drag. All are covered by `playground.spec.ts` and `examples.spec.ts`: real typing, drafts, Reset/Clear, Copy, Split, form binding, drag (twice in a row, and by keyboard), sandboxing, blocked user scripts, and one runtime per preview.

## C. Website QA

| Suite | Browser | Passed | Failed | Skipped | Notes |
|---|---|---:|---:|---:|---|
| `astro check` (types) | — | 0 errors, 0 warnings | 0 | — | 27 errors fixed: typing of redirect tuples and an optional test field |
| Unit (vitest) | Node | 417 | 0 | 0 | 13 failures at the start, all fixed (11 stale tests, 2 real site bugs) |
| Storybook (vitest) | Chromium | 99 | 0 | 0 | 6 failures at the start: stale ids and sizes, one assertion form |
| End-to-end (Playwright) | Chromium + WebKit | 418 | 0 | 42 | 127 failures at the start; skips: 36 WebKit visual (baselines are Chromium), 4 clipboard (Chromium-only API), 2 WebKit Tab order |
| Visual regression | Chromium | 36 | 0 | — | 28 baselines re-recorded after review |
| Accessibility (axe, serious/critical) | Chromium + WebKit | 21 pages clean | 0 | — | includes Interfaces, Context menu, Playground, Bundle Builder |
| **Firefox** | — | — | — | — | **Unverified.** Playwright's Firefox 1555 is installed but fails to launch in this sandbox ("Failed to launch the browser process"), as during library testing. |

Desktop and narrow widths covered: 320, 375, 390, 768, 1024 and 1440 px (no horizontal overflow), plus the Playground's mobile panes.

## D. Performance (headless Chromium 156, production build, local server, no throttling)

| Measure | Result |
|---|---|
| JS per page, gzip | `/` 99.4 kB, docs 98.5 kB, Examples 87.1 kB, Playground 102.3 kB, Bundle Builder 82.1 kB. Before the glossary fix: 126.1 / 125.3 / 87.3 / 129.0 / 82.1. The last recorded run (2026-10-18) had 97.7–102.6 for `/`. |
| Long tasks (> 50 ms), load + full scroll | 0 on all 14 measured pages |
| CLS | ≤ 0.079 (`/docs/custom-bundles/`); all others ≤ 0.029 |
| Heap, top-level page | baseline 1.2 MB; Control Center 3.7 MB; after leaving it 1.2 MB |
| Playground lifecycle | 80 rebuilds: heap 3.62 → 4.38 (first 20, warm-up) → 4.49 → 4.61 → 4.67 MB; one preview frame alive throughout; ≈ 0.8 s per rebuild including the 400 ms debounce |
| Playground idle (5 s) | 5.5 ms of tasks, 0 ms script, 0 layouts; preview runtime: 0 timers, 0 rAF pending |
| Examples gallery | 3 live card previews at the top; idle 1.8 ms / 5 s; scrolled away: 0 previews, 0.3 ms / 5 s; scrolled back: 3 again |
| Drag (Playground, 120 moves) | runtime in the preview: 0.048 ms per flush; site page (inspector updates): 3.2 ms per move |
| `live()` example page idle | 258 ms of tasks per 5 s, 239 style recalcs: the 20 ms `live()` timers it demonstrates |
| Bundle Builder | hydrated in 869 ms; first Analyze (loads the compiler) 132 ms |
| Search | first results in 11 ms |

No regression remains against the last recorded run. `docs/performance-results.json` was rewritten by `npm run measure`; the previous file was overwritten, and the comparison above uses `docs/performance.md`.

## E. Build and SEO

| Check | Result |
|---|---|
| Production build | 172 pages, 0 errors; Pagefind indexed 110 pages |
| Broken internal links | none (`site.spec` crawls every internal link; the Vision page too) |
| Sitemap | 112 URLs (118 before the fix). The fix adds `/examples/tabs/`, `/accordion/` and `/dropdown/`, which `astro.config.mjs` had excluded as old docs-example URLs, and removes the 8 legacy reference pages. Redirect pages stay out. |
| Canonical | every page has one (`https://reactivecss.com/…`, from `config/seo.json`), except `/examples/persistent-preference/standalone/`, which is `noindex` |
| Redirects | all 22 targets exist; one hop each |
| `localhost` in output | none |
| Missing assets | none reported; runtime files byte-identical to `../dist` |
| Download links | none: CDN URLs are shown as text, marked "Illustrative until published" (tested) |

## F. Known limitations

- **Browsers and devices:** Firefox unverified (cannot launch here). Real Safari, iOS, Android, touch and pen hardware were not tested: drag is tested with mouse events only.
- **Accessibility:** axe and keyboard tests only. No screen reader was used.
- **Experimental APIs:** `persist()`, `content` as DOM text, drag and its `event()` fields, the `--attr-*` namespace, `focus:`, `typed()`, `element()`, the `attr()`/`pick()`/`split()` expressions, and `bind(<attribute>)`.
- **Minifiers:** esbuild `minify`/`minifySyntax`, csso and Lightning CSS delete empty modifier-only rules such as `a:on(click, prevent()) {}`. Use whitespace-only minification.
- **Sandbox:** `persist()` cannot store anything in previews; the note under them says so. A link or `<meta http-equiv="refresh">` in Playground HTML can still navigate the preview frame, but it cannot reach the site.
- **Runtime:** `contextmenu` does not arm focus requests (see A).
- **Remaining client weight:**
  - The `vocabulary` chunk still includes the full `describe()` registry (9.6 kB gzip) for the CSS highlighter.
  - React (64 kB gzip) loads on every page for the search dialog.
  - The Playground inspector costs ~3 ms per pointer move while dragging.
- **Housekeeping:** `src/examples/{counter,accordion,dropdown}/` now get no page of their own. Their ids belong to catalog entries. `counter` is still used by Storybook stories.

## G. Release readiness

**Blockers for a public launch**
1. The package is not published, and its npm name and repository are still open (Control Center notes: "reactive-css" is taken on npm). Installation documents `npm pack` and shows illustrative CDN URLs. The site can only launch as a preview until a real install path exists.

**Important, nonblocking**
1. Run the Firefox and real-device pass (Safari macOS/iOS, Android Chrome, touch drag).
2. Run a screen-reader pass (below).
3. Decide on the `contextmenu` focus-arming gap in the library.

**Minor**
1. The `vocabulary`/registry client chunk could be slimmed.
2. Search could hydrate on first use.
3. Remove the three unused docs-example folders once the stories move to other ids.
4. `docs/performance.md` still shows the 2026-10-18 table.

**Manual verification required**
- **VoiceOver** (macOS Safari) and **NVDA** (Firefox/Chrome):
  - the Tabs interface (role and selected-state announcements, arrow keys);
  - Dropdown (expanded state, focus moving into the menu and back);
  - Pricing toggle (switch on/off);
  - Step wizard ("current step");
  - live regions in Signup form and Step wizard;
  - code-token buttons;
  - Playground editor labels and diagnostics announcements.
- **Visual and motion:** reduced-motion behavior of the Task list animations, and contrast in the Theme switcher's dark and sepia themes.
- **Touch:** touch targets on a phone for Interfaces and the Playground preset row.
- **Real pointers:** the Context menu on a trackpad (two-finger click) and with the Menu key / Shift+F10.

**Is the Reactive CSS 0.9.0 website ready for a public launch?** Not yet. The website itself is stable:
- every automated suite passes;
- the content teaches only the 0.9 API;
- the examples run on the real runtime;
- the build, links, sitemap and redirects are correct.

What is missing is outside the build:
1. a published package, or a final install path, to replace the illustrative CDN text;
2. the manual Firefox, real-device and screen-reader passes above.

With those done, it can be published through its normal workflow after approval.
