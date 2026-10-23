# Content, UX and integration QA

A quality pass before the first public beta. Polishing and verification only: no new product
features, no redesign, no changes outside `site/`, no Git, no publishing.

**Library version checked:** 0.7.0, still the latest at the time of this pass (the site has since moved to 0.8.0: see section 15). `../package.json`, `describe()`, the bundle in `../dist`, the CHANGELOG's top entry and the site banner agree (`tests/unit/version.test.ts`). There is no newer release report, so every figure on the site is from `docs/release-0.7.0.md`.

## 1. Pages reviewed

All 118 built pages:
- automated checks on every page: overflow at six widths, an axe scan, and a heading check;
- read by hand: the homepage, `/vision/`, `/docs/examples/`, the 12 library demo pages, `/playground/`, `/docs/performance/`, `/docs/reference/` and the 0.5.1–0.7.0 entries, `/docs/introduction/`, `/docs/limitations/`, `/docs/compat/`, `/docs/examples/advanced/`, `/examples/control-center/` and `/design-system/`.

## 2. Copy corrections

| Where | Was | Now |
|---|---|---|
| `/docs/examples/advanced/` | Callout "Simulated previews: the preview is a simulation written for this documentation, not the runtime" | False: the workspace runs the real runtime through `PreviewFrame`. It now says so, and that the source mapping is static analysis |
| Advanced Examples "upcoming" cards | "Multi-Step Wizard", not built yet | Removed. The library's multi-step wizard runs on the site, and the page links to it |
| `/docs/examples/counter/` | "render the number as real text when it matters" (with no way to do it in Reactive CSS) | Points to `text:` (0.5.1, experimental) and the score-history demo |
| `/docs/geometry/` | Planned features "are not part of 0.5.0" | 0.7.0 (checked against the registry: `history()`, `spring()`, `throttle()`, `debounce()`, `element(selector)` are still planned) |
| Homepage hero subline | "No JavaScript to write." | "A runtime script does the JavaScript, so you don’t write any." The first screen now says there is a runtime. The headline is unchanged |
| Homepage "Where this fits" | Evolution strip and the three principles | Strip and links only. The principles duplicated the existing "Native first" section, and they remain on `/vision/` |
| `/vision/` Engineering lede | Repeated "not claimed to be faster" from the caveats below it | Removed from the lede |
| Vision and homepage metrics | "479 browser tests"; "14.0 ms … Chromium" | "479 browser test results, Chromium and WebKit combined"; each metric names the report section and "headless Chromium 156". New caveat: similar input-to-frame latency is not similar CPU cost, with the measured script cost per event |
| `srcdoc.ts` comment | "Example HTML cannot run its own scripts" | States what may run: the bridge, and either the runtime or the site's vanilla comparison file |

Searched and not found anywhere public: claims that Reactive CSS cannot write DOM text, set ARIA attributes or move focus (fixed in the Vision pass); `wave()` presented as available (it appears only as removed, with the measured reason); "requires a framework"; "JavaScript-free internally". The independent-project disclaimer appears once on `/vision/`. The footer's existing line ("Not an official CSS standard") is unchanged.

**Every presented snippet compiles.** `tests/unit/compile.test.ts` runs the installed runtime's own `compile()` (`../dist`, the build the previews use) over:
- every API reference example;
- every site example stylesheet;
- all 12 library demos;
- the Vision stage 04 code;
- every Reactive CSS block in the MDX docs (17).

A negative control makes sure the test does catch diagnostics. Result: 0 diagnostics. Status and "since" on reference pages come from the registry, not from copy.

## 3. The vanilla JavaScript comparison

Before: the Reactive CSS side ran the library demo; the JavaScript side was a sketch, labelled "not run".

Now both run, independently:

- **Vanilla:** `src/content/vision/score-history.js` (34 lines) and `score-history.css` (18 lines). Plain DOM APIs and listeners on the library demo's own `index.html`. Its frame is the same sandbox with the same CSP, and `PreviewSources.script` runs this file **in place of** the runtime, so Reactive CSS is never loaded there.
- **Reactive CSS:** the library's `examples/score-history/style.css` (39 lines), unchanged, with the production runtime 0.7.0.
- **Shared, not counted:** `index.html` and the 10 layout lines at the top of `style.css`, shown in a "Shared by both" disclosure. The line counts include comments and setup.
- **UI:** the side-by-side code stays. The preview slot has a "Reactive CSS | Vanilla JS" switch, and its header names what is running ("Reactive CSS runtime 0.7.0" or "no Reactive CSS loaded"). Both documents stay mounted; the inactive one is collapsed, invisible and `inert`, so it keeps its state and its height.
- **Copy:** neither version is described as shorter. The stated advantage is that state, events and presentation are declared together in the stylesheet, without application-specific JavaScript. Each needs a script; the runtime's size is quoted from the report.

**Semantics, matched on purpose:**
- an unchanged value is not a change;
- Reset counts as a change, and is disabled at 0;
- `data-direction` is `none`, then `up` or `down`;
- the history line is hidden until the first change;
- direction colors;
- the `bump`/`dip` keyframes restart on every change and are off under reduced motion;
- the same native buttons and the same live region.

**Known difference:** Reactive CSS's `:changed()` clears when the animation ends; the vanilla class stays until the next change. Nothing visible depends on it.

**Tests** (`tests/e2e/score-parity.spec.ts`, Chromium and WebKit):
1. Both frames start, and only the Reactive CSS frame has `window.ReactiveCSS`.
2. Seven interactions on both boards (up, up, down, down, reset, up, up). After each one, every board's visible text, values, direction text and color, history/no-change visibility, Reset `disabled` and `data-direction` are equal.
3. Both start the same `bump` and `dip` animations.
4. Keyboard: the same Tab order and Enter/Space behavior (Chromium; WebKit does not Tab to buttons by default).

Unit tests check that the vanilla files contain no Reactive CSS, and that every class the script looks up exists in the shared markup.

## 4. Runtime and version consistency

| Check | Result |
|---|---|
| `package.json` = `describe()` (build stops otherwise) | 0.7.0 = 0.7.0 |
| Bundle contains the version, site banner, latest CHANGELOG entry | 0.7.0 (unit test) |
| Every shipped registry feature has a reference entry | yes (66 features; `registry.test.ts`) |
| Reference examples compile with the installed runtime | yes, 0 diagnostics |
| Removed features | `wave()` only, shown as removed in 0.5.0 with the reason |

No new gaps found; no extra version tests added.

## 5. Interactive examples

`tests/e2e/demos.spec.ts` (Chromium and WebKit), on the library demos as the site runs them:
- **Product configurator:** the total is real DOM text (49 → 490). Pressing Enter past the bound sets `aria-disabled="true"`, and focus stays on +. Native Reset restores both the field and the total.
- **Multi-step wizard:** after Next, `focus:` moves focus to the new step's heading, and the status reads "Step 2 of 4".
- **Accessible tabs:** ArrowRight sets `aria-selected`, moves `tabindex` and moves focus to the next tab. `prevent()` cancels the key: `defaultPrevented` is true for the page's own listener. The disabled tab is natively disabled.
- **Form validation:** Submit is natively `disabled` until the terms are accepted, and `required` is derived for business accounts.
- **All 12 demo pages:** each runs without runtime diagnostics or console errors (`vision.spec.ts`).
- **Showcase:** only one demo runtime runs at a time.

**Error states (new):** `PreviewFrame` now shows:
- the runtime's diagnostics under any preview, where the parent didn't already show them;
- an alert when the runtime cannot be fetched (tested by blocking it);
- an alert when a preview document never reports back within 8 s.

The demos are unchanged. The site splits `style.css` only for display, and a unit test guarantees that the hidden layout part has no reactive syntax.

## 6. Playground

`tests/e2e/playground.spec.ts` (Chromium and WebKit):
- **Editing:** a CSS edit restarts the preview with the new color.
- **Invalid input:** invalid Reactive CSS shows the runtime's own diagnostic ("unknown action …"). Broken CSS doesn't crash the page, Reset restores the starter, and no page errors occur.
- **Keyboard:** Tab indents. **New: Esc, then Tab, leaves the editor.** Before, only Shift+Tab could leave it, so forward navigation was stuck; the hint now says so.
- **Sandbox:** `sandbox="allow-scripts allow-forms"`, a CSP with `default-src 'none'` and a per-document script nonce, `origin` is `null`, and `parent.document` is blocked.
- **320 px:** no horizontal scroll, and the editor stays usable.

Copy CSS was not tested on its own; the copy mechanism is covered by the site's copy-button test (Chromium only, since Playwright grants clipboard permission only there). The previews load the same runtime version that the docs show.

Not supported: **editing the HTML**. The Playground edits CSS only, by design, so this was not added (no new features in this pass).

Fixed: the page had no `<main>` landmark. It now does, and the component's wrapper became a `div`, so there is exactly one main landmark.

## 7. Navigation and search

- **Links:** the link crawler (every internal link from `/`) and the anchor checks pass. New checks: `/docs/examples/#library-demos` and `/vision/#evolution`.
- **Search:** Pagefind indexes 115 pages, and new tests check that search finds `prevent()`, `focus:`, `animationend`, `/vision/`, `/docs/performance/` and a library demo.
- No duplicate routes: library demos live under `/examples/<name>/`, docs examples under `/docs/examples/<name>/`.
- Headers, footer, breadcrumbs and the sidebar were reviewed; the only change was the narrow-screen header fix below.

## 8. Responsive fixes

Every built page was checked at 320, 375, 390, 768, 1024 and 1440 px. Before this pass, three overflowed:

| Page | Cause | Fix |
|---|---|---|
| `/docs/changelog/` (up to +90 px at 320) | long inline code in rendered Markdown | `.prose-md code { overflow-wrap: anywhere }` |
| `/examples/live-form-preview/` (+19) | same, in the README notes | same |
| `/design-system/` (+29 at 320) | the type scale's fixed label column next to display-size samples | stacks below 640 px, as the motion table already did |

After: 0 of 708 page/width combinations overflow. Code panels still scroll horizontally inside their containers; code was not globally wrapped.

## 9. Accessibility

An axe scan of all 118 pages (previews excluded, as before; `[data-dim]` excluded by design):

| Finding | Pages | Fix |
|---|---|---|
| **serious** color-contrast (down to 1.16:1) | `/examples/accessible-toggle/` | README code blocks were highlighted by Astro's default Shiki theme (github-dark colors on paper). README notes now render code plainly with the site's styles |
| **serious** scrollable region not focusable | same | rendered README `<pre>` gets `tabindex="0"` |
| moderate region (content outside landmarks) | 115 pages | the docs version banner is a labelled `<section>` ("Documentation status") |
| moderate region | `/playground/` | `<main>` landmark (see 6) |
| moderate heading-order (h1 → h3) | `/design-system/` | the three signature cards use h2 |

After the fixes, axe reports **0 violations at any impact** on all 118 pages.

Headings: one h1 per page. The exception is `/docs/changelog/`, where the CHANGELOG's own `# Changelog` is hidden with `display: none`, so assistive technology never sees it.

Also checked:
- **Keyboard:** tabs, radio groups, the Playground editor exit, and the score comparison's buttons in both implementations.
- **Focus:** visible focus rings, and the `focus:` demos.
- **Reduced motion:** a global rule on the site; the demos handle it themselves.
- **Live regions:** copy feedback, the state readout, and the score.
- **Search dialog:** existing tests (open with ⌘K, focus in the input, arrow keys, Enter navigates, Escape closes).

**Not done:** screen-reader testing. No screen reader was available here. Keyboard and axe results do not prove screen-reader compatibility, and announcements of DOM text written by `text:`, focus moves by `focus:`, and the live regions are **unverified**.

## 10. Performance

These are site measurements (`scripts/measure-performance.mjs`, headless Chromium, production build), not runtime claims. Before → after:

- **`/vision/` JS:** 105.6 → 106.7 kB gzip, from the third frame and the parity UI.
- **Other pages:** +0.0 to +0.5 kB, from the shared failure states.
- **`/vision/` CLS:** 0.0015 → 0.0015. The vanilla frame first pushed it to 0.0296. Hydrating the live sections 800 px early (`rootMargin`) fixed it, and it measured 0.0012–0.0013 in three runs.
- **Long tasks:** none on any measured page.
- **Memory:** 1.2 MB baseline, 3.4 MB on the Control Center, 1.2 MB after leaving.
- **CSS:** 62,220 B (12,380 B gzip).

React (64.3 kB gzip) still loads on every page, at idle, for the search dialog. It measured as non-blocking with no long task, so the search architecture was not changed; recommendation in 14. The Control Center's CLS of 0.0288 is unchanged and below 0.1; its preview also grows to its content after load.

## 11. Automated test results (final run)

| Suite | Result |
|---|---|
| `astro check` (types and content collections) | 0 errors, 0 warnings |
| Unit (Vitest) | 119 / 119 (36 before this pass) |
| Storybook interaction tests | 81 / 81 |
| Production build | 118 pages; Pagefind indexed 115 |
| Playwright, Chromium + WebKit | 168 passed, 34 skipped, 0 flaky |
| Visual baselines (Chromium) | 32 / 32 |

Skipped tests, all intentional:
- the 32 visual tests in WebKit (baselines are recorded in Chromium);
- the parity keyboard test in WebKit (WebKit does not Tab to buttons by default);
- copy buttons in WebKit (existing; clipboard permissions are Chromium-only in Playwright).

**One open flake:** in one of six full runs, one test failed. Its name was not captured, and the five runs after it were fully green. Whichever test it was, it is intermittent and still unidentified.

Baselines were updated only after reviewing each diff:
- `home-*`: the hero subline and the shorter "Where this fits" section;
- `vision-*`: the new comparison (the visual test now masks only visible frames, so the collapsed vanilla frame doesn't hide the notes);
- `design-system-390`: the hidden header label below 420 px and the stacked type scale.

## 12. Browser limitations

- **Firefox:** not verified. Neither the site's suites nor the library's ran in Firefox.
- **Engines:** Chromium and WebKit are Playwright engine builds, not shipped Chrome or Safari.
- **Real devices:** not tested.
- **WebKit keyboard:** WebKit doesn't Tab to buttons by default, which limits the keyboard tests there. The library notes that headless WebKit doesn't scroll on arrow keys, so `prevent()` scroll cancellation is verified through `defaultPrevented`.

## 13. Outdated statements in the library's `docs/example-comparison.md`

Not edited, since the file is outside `site/`. For the library to fix:

| Line | Statement | Suggested correction |
|---|---|---|
| 12 | Product configurator, "What still needs script": "Disabling buttons at bounds (`disabled`), DOM text for the total" | Neither: `attr: aria-disabled` (0.6.0) or `attr: disabled` (0.5.3) handles bounds, and `text:` (0.5.1) writes the total. The demo itself does both |
| 13 | Wizard: "Focus management, `aria-current`" | `focus:` (0.6.0) and `attr: aria-current` (0.5.3); the demo uses both |
| 14 | Quiz: "`aria-disabled`/`aria-pressed`, focus on the next question" | All available: `attr:` with `aria-disabled`/`aria-pressed`, and `focus:` |
| 23–28 | "What it cannot do: set attributes (`disabled`, `aria-*`); move focus; produce DOM text. Plain JS does all three" | Since 0.5.1–0.6.0 it can, experimentally: `text:`, `attr:` (allowlist), `focus:` (user actions only). Keep the limits: allowlisted attributes, no `aria-checked`/`aria-invalid`, no announcements |
| 38 | Configurator limitations: "generated text, frame-lagged bounds, no `disabled`" | Superseded by `text:`, the 0.5.1 `sync()` fix, and `attr:` |
| 62, 104, 152, 176 | "The JS version is better for production: DOM text …", "Plain JS adds what CSS cannot: focus …, `aria-current`", "It also adds `aria-disabled`", "Plain JS produces real DOM text" | Rewrite the comparisons against the 0.7.0 demos |
| 214–215 | Table: DOM text "**no**: generated text"; `disabled`, `aria-*`, focus "**no**" | "yes, experimental (`text:` 0.5.1)"; "allowlisted attributes (`attr:` 0.5.3/0.6.0) and `focus:` (0.6.0)" |
| 6 | "Plain JS … These are sketches, not executed" | Still true there. The site now has one executed, parity-tested vanilla version (score history) that the library could reuse |

The line counts in that file's summary table predate the 0.5.1–0.7.0 demo changes and should be recounted from the current files.

## 14. Remaining beta-readiness blockers

1. **Screen-reader testing:** `text:`, `focus:`, the live regions, and the demos' ARIA patterns.
2. **Firefox:** for both the library and the site.
3. **The library's `docs/example-comparison.md`:** stale claims (section 13). The site doesn't quote it, but readers of the repository will find it.
4. **The intermittent e2e failure:** one in six runs, not yet identified.

Not blockers, but worth doing:
- **Search hydration:** hydrating search on first use would remove 64 kB of React from pages with no other island.
- **Control Center CLS:** 0.029 from its preview growing after load.
- **Playground:** HTML editing is not supported.

## 15. Update to 0.8.0 (after this pass)

The library moved 0.7.0 → 0.7.1 → 0.8.0 after this QA pass. Sources: `../CHANGELOG.md`, `docs/release-0.7.1.md`, `docs/release-0.8.0.md`, `docs/bundle-builder-0.8.md`. The bundle builder page, `/docs/custom-bundles/`, `/docs/installation/` and the Vision bundle section were done in the bundle-builder session (`docs/bundle-builder-integration.md`). This section covers the rest.

- **Engineering numbers** (`src/lib/content/engineering.ts`, `/docs/performance/`, Vision section 05). Each figure names its report and section:
  - tests: 0.8.0 §3 (521 browser results passed, 5 skipped; 102 unit; 263 at 4× CPU; custom bundles; every example on its analyzer-chosen bundle, 60/60);
  - startup (new) and custom-bundle leak runs: 0.8.0 §4;
  - memory 1,000 × 150 and event dispatch: 0.7.1 §4 and §5;
  - input-to-frame latency: still 0.7.0 §10, labelled as such. 0.7.1 and 0.8.0 did not re-measure it;
  - bundle sizes: 0.7.1 → 0.8.0 (standard 114,421 → 116,319 B minified). Custom bundle sizes are on `/docs/custom-bundles/`.
- **Caveats kept:** headless engines on one machine; no automated Firefox; screen readers and real devices unverified. Added: the manual Chrome/Safari/Firefox pass of the 20 examples is user-reported for 0.7.1, with no logs or versions (0.7.1 §6).
- **`/docs/compat/`:** 0.8.0 counts, a row for the manual pass, a screen-reader row, and 0.7.1/0.8.0 coverage.
- **Library demos:** six of the seven new 0.7.1 examples are now site pages (`focus-transitions`, `keyboard-navigation`, `attribute-playground`, `nested-cascade`, `form-interactions`, `history-motion`). There are 18 in total. `dynamic-components` (and `stylesheet-lab`, which is not synced) needs its JavaScript harness and extra stylesheets, which the site does not run, so it is left out and the Examples index says so.
- **API:** `/docs/installation/` documents `describe().bundle` and the missing-feature diagnostics.
- **Removed:** the unused `concept` flag ("concept · not implemented") from `VSection`.
- **Checks after the update:** `astro check` 0 errors; `npm test` 190 passed; `npm run test:stories` 91 passed; `npm run build` 125 pages; `npx playwright test` 215 passed, 39 skipped. Only the four `vision-*` screenshots changed: the engineering section is taller (new figures and caveats), "All 18 library demos", and the comparison's runtime size is now 39,136 B gzip (the old baseline showed 38,284, the 0.7.0 size, labelled 0.8.0). Reviewed, then updated.
