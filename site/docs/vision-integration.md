# Vision integration

> **Superseded.** `/vision/` now implements Vision v2 (`vision-v2-integration.md`). This report describes Vision v1, kept as history.

Integrates the Claude Design file `Vision.dc.html` (saved as `design-source/Vision.dc.html`,
references in `design-source/reference/vision-{1440,390}.png`) into the site, against the library
as it is today: **0.7.0** (local, unpublished; `package.json`, `describe()`, the bundle and the
CHANGELOG agree, checked by `tests/unit/version.test.ts`).

Nothing outside `site/` was changed. No runtime source, no library API, no Git, no publishing.

## 1. Audit

### What the design got wrong for 0.7.0

| Design | Problem | On the site |
|---|---|---|
| 01 Evolution, stage 04 code | `--was: previous(--open)` on a boolean that is never used, and `.panel input { bind: --name }` with nothing reading it. Not verified as working code | Replaced by `src/examples/vision-panel/`: `state()`, `on:`, `attr: aria-expanded`, `bind:`, `text:` and `:when()`. It runs at `/examples/vision-panel/` and is tested (`tests/e2e/vision.spec.ts`) |
| 03 Comparison | Invented Reactive CSS (`--before: previous(--score)`, numbers through `counter()`), a simulated preview, and the note "the CSS version prints numbers as generated content, not HTML text", false since `text:` (0.5.1) | The library's own `examples/score-history/` stylesheet, unchanged, running with the real runtime, with chips and trace. The JavaScript side was first a sketch; since the content and UX QA pass it is a real, executed vanilla version (`src/content/vision/score-history.{js,css}`), tested for parity: see `content-ux-qa.md` |
| 04 Examples | Five React prototypes labelled "simulated", with code that differs from the library's demos (for example a quiz whose answer key sits in the stylesheet) | The library's five matching demos (`product-configurator`, `multi-step-wizard`, `interactive-quiz`, `live-form-preview`, `score-history`), run unchanged. "Why Reactive CSS?" is rendered from each demo's README |
| 05 Engineering | 0.4.0 audit numbers: "~14 ms", "Zero", "1 million lifecycles", "None detached", "218 tests", and "Full performance report · in preparation" | 0.7.0 figures from `docs/release-0.7.0.md`, each with its section: 14.0 ms p50 idle (plain JS 13.6), 150,000 component lifecycles, 0 detached, 479 browser tests (5 skipped), no timers added by `prevent()`. The report link goes to the new `/docs/performance/` |
| 06 Native vs extension | Missing everything since 0.5.1 | Adds "Attributes and text from state · `attr:` · `text:` · exp"; every extension row links to its reference page |
| 07 `wave()` story | "removed before beta" with no figure | "Removed in 0.5.0", with the CHANGELOG's measured cost (171–181 ms/s of style work per 1,000 elements) and links to the migration and the native replacement |
| 08 Bundle builder | Eight modules with kB sizes ("illustrative"), an estimated total, and an "Analyze my CSS" regex matcher | Until 0.8.0: a static concept. Since 0.8.0: a real tool at `/bundle-builder/` on the library's catalog, resolver semantics, CLI and compiler, and on `/vision/#bundle` a preview with the measured profile sizes and a link. Still no estimator: unmeasured combinations show no size. See `bundle-builder-integration.md` |
| 09 Messaging | Three headline alternatives that rewrite the hero | Storybook only (Vision › Messaging Directions), not on public pages. The homepage keeps "CSS that reacts." |
| Hero and footer | The disclaimer twice | Once, under the hero (`[data-disclaimer]`, tested) |

### What the site itself had wrong for 0.7.0

The site documented 0.5.0. Fixed in this pass:

- `introduction.mdx`, `limitations.mdx` and `examples.mdx` said Reactive CSS "cannot set ARIA attributes or move focus". Since 0.5.3 (`attr:`) and 0.6.0 (`focus:`) it can, experimentally. They now say what it can and what stays with HTML and JavaScript.
- Status notes said 0.5.0 (`introduction`, `installation`, `reference`, `limitations`, `compat`).
- `compat.mdx` showed 0.5.0 test counts (106 / 102). It now shows the 0.7.0 report's counts, and the 0.5.1–0.7.0 coverage.
- The API reference had no pages for `text:`, `attr:`, `focus:`, `prevent()`, the seven 0.5.1 triggers, or `state(…, bind())`. Added from the release notes (`src/content/api/entries.json`: `text`, `attr-declaration`, `focus-declaration`, `prevent`, `lifecycle-triggers`, and a `bind()` parameter on `state`). `tests/unit/registry.test.ts` passes again, and the highlighter treats the new syntax as Reactive CSS without catching `text-align:` (tested).

Known gap, not fixed here: the library's own `docs/example-comparison.md` still says Reactive CSS
cannot produce DOM text or set attributes. It is a library file, so the site doesn't quote it.

## 2. Placement

| Vision section | Where it went | Why |
|---|---|---|
| Hero | `/vision/` | Its own page; the homepage hero stays |
| 01 Evolution | `/vision/#evolution` (interactive), and a static four-stage strip on `/` (`#direction`) | The homepage gets the idea in one glance; the page gets the code |
| 02 Principles | `/vision/#principles` and `/` (`#direction`) | Short and central to the positioning |
| 03 Comparison | `/vision/#compare` | Real demo; it needs space |
| 04 Examples | `/vision/#build` (5 demos), `/examples/<name>/` (all 12), `/docs/examples/#library-demos` (index) | Demos belong under Examples; Vision shows a curated five |
| 05 Engineering | `/vision/#engineering` (summary) and `/docs/performance/` (full tables) | The design's "full report" link needed a target; the docs page is searchable |
| 06 Native vs extension | `/vision/#native` | |
| 07 `wave()` story | `/vision/#story` | |
| 08 Bundle builder | `/vision/#bundle` (preview) and `/bundle-builder/` (the tool, since 0.8.0) | One full builder, on its own page |
| 09 Messaging | Storybook only | Non-prominent, as asked |

Navigation: "Vision" in the home and app headers and the footer; "Performance" in the footer.
The homepage numbering moved from 01–05 to 01–06 for the one new section; nothing else on the
homepage changed.

## 3. What runs, what doesn't

| Thing | Runs the real runtime? |
|---|---|
| Evolution stage 04 code | Yes, at `/examples/vision-panel/` (the timeline links to it) |
| Stages 01–03 | Native CSS, shown, not run |
| Score comparison, Reactive CSS side | Yes, the library demo unchanged |
| Score comparison, JavaScript side | Yes, its own frame with no Reactive CSS loaded (since the QA pass) |
| Showcase, 12 demo pages | Yes, the library demos unchanged. Only the selected showcase demo is mounted |
| Engineering numbers | Copied from the library's report, with the source shown. The site measures nothing about the runtime |
| Bundle builder | Since 0.8.0, `/bundle-builder/` generates commands for the library's CLI (tested by running them). Sizes only for bundles the library measured |

## 4. Implementation

- `scripts/sync-runtime.mjs` also copies `../examples/<name>/` into `src/generated/demos/` and writes `src/generated/runtime.json` (it fails when `package.json` and `describe()` disagree).
- `src/lib/content/demos.ts`: reads the demos, splits `style.css` at its first `/* ---- ` comment (layout runs, behavior is shown; a unit test guarantees the hidden part has no reactive syntax), and parses the README sections. `getExample()` falls back to it, so every existing example component works with a library demo.
- `src/lib/content/vision.ts`, `engineering.ts`: page copy and the figures, each with its report and section (0.8.0 where it re-measured, 0.7.1 or 0.7.0 otherwise).
- Components (`src/components/vision/`), Storybook first (`Vision.stories.tsx`, 11 stories):
  - islands: `EvolutionTimeline`, `ScoreComparison`, `DemoShowcase`;
  - static, never hydrated: `VisionHero`, `Principles`, `EngineeringMetrics`, `NativeVsReactive`, `WaveStory`, `BundlePreview`, `MessagingOptions`, `VSection`.
- Pages: `src/pages/vision.astro`; `src/pages/examples/[id].astro` now also builds the 12 demo pages, with their README notes, inside the app shell; `src/content/docs/performance.mdx` with `mdx/EngineeringReport.astro`; `mdx/LibraryDemos.astro` on the Examples index.
- `PreviewFrame` has a `growToContent` option: an example block grows to its preview's content height instead of scrolling inside the frame.
- Header, found while testing at 320 px: the home header overflowed by 37 px at 320, and the app header by up to 16 px. That bug was already there; earlier tests only checked 390. Below 420 px the "experimental" tag and the context label are hidden, and the gaps are smaller. The wordmark no longer wraps onto two lines.
- SEO and search: title and description on every new page; the sitemap includes them; Pagefind indexes `/vision/` (section "Vision"), the demo pages ("Library demos") and `/docs/performance/`. That is 115 pages indexed.

## 5. Verification

| Check | Result |
|---|---|
| `astro check` | 0 errors |
| Unit (`npm test`) | 36 / 36 (20 before): registry (5), version (2), demos (13), plus the existing suites |
| Storybook interaction tests | 81 / 81 (71 before) |
| End-to-end, Chromium + WebKit | 139 passed, 33 skipped (visual tests are Chromium-only by design) |
| New e2e (`tests/e2e/vision.spec.ts`) | one disclaimer, no "simulated", no `previous(--open)`, no messaging section; timeline keyboard (Home/End, focus); stage 04 runs (`aria-expanded`, `text:` and restore); score comparison runs (text, `data-direction`, `disabled`, chip); showcase mounts one iframe; metrics match `engineering.ts` and name the 0.7.0 report; all 12 demo pages run without runtime diagnostics or console errors; no horizontal scroll at 320, 375 and 390 px on `/vision/`, `/`, a demo page, `/docs/performance/`, `/docs/examples/` and `/docs/getting-started/` |
| Existing e2e extended | `/vision/`, `/docs/performance/` and `/examples/score-history/` added to the link crawl, mobile overflow, console-error and axe scans |
| Accessibility | Automated axe scan: no serious or critical violations on the new pages (previews excluded, as before). Keyboard: tabs and radio groups tested. **Not done:** screen-reader testing, manual contrast review of the latency chart labels, and accessibility review of the library demos beyond what their READMEs report |
| CSP | Previews use the existing strict per-document CSP; the demos run under it with no diagnostics |

### Visual QA

- New baselines: `vision-{1440,1280,1024,390}.png` (Chromium), compared with the design in `docs/visual-review/compare-vision-{1440,390}.png`.
- Changed baselines, each reviewed against its diff before updating:
  - `home-*`: the header "Vision" link, the new `#direction` section, kicker numbers 03→04 to 05→06, and the footer links. The sections below it are identical, shifted 1–2 px by sub-pixel rounding.
  - `api-state-*`: the app header "Vision" link, the banner (the old baseline still showed v0.5.0), and the `state()` registry syntax plus the new `bind()` parameter row.
- Intentional differences from the design:
  - real demos replace the prototypes, and their own styling shows (system font, white cards);
  - the comparison code panels are taller, because they hold the real files;
  - in the showcase, the live demo gets the full width and `style.css` is its own view, because the demos lay out two columns only when wide;
  - there is no section nav in the header; it is an "On this page" row under the hero instead;
  - the hero has no headline toggle;
  - the bundle section has no checkboxes, sizes or analyzer.

### Performance

From `scripts/measure-performance.mjs` (headless Chromium, production build): `/vision/` loads 105.6 kB of gzipped JS (the other pages: 70–110 kB), with CLS 0.0015 and no long tasks. Four islands: one at load (search), three when scrolled into view. At most two previews run at once (comparison and showcase), never twelve. See `docs/performance.md`.

## 6. Keeping it current

On a new library release:
1. Rebuild the library and run `npm run sync-runtime`. A version mismatch stops it.
2. Run `npm test`:
   - `registry.test.ts` fails for every shipped feature without a reference entry;
   - `version.test.ts` fails if the CHANGELOG, the bundle and `describe()` disagree;
   - `demos.test.ts` fails if a demo's layout part gains reactive syntax or its README loses a section.
3. Update `src/lib/content/engineering.ts` from the new release report. The e2e test checks that the Vision page shows exactly those values and names the report.

## 7. Open points

- Firefox and real devices remain unmeasured; the page says so.
- The demos' "why" notes come straight from the READMEs. When a README is wrong, the site is wrong with it.
- Messaging: the alternatives are kept in Storybook for a decision; nothing on the public site uses them.
