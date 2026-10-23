# Design parity: pre-launch audit

**Date:** 2026-10-20. **Design project:** Claude Design `2d981aaa-2377-4041-b285-7110658450e0`,
read with the design MCP during this audit.

## How this was checked

- **Freshness of the local design sources.** I fetched these files from the project and compared
  them with `site/design-source/`:
  - byte-identical: `Home.dc.html`, `Examples.dc.html`, `Docs.dc.html`,
    `Control Center Admin.dc.html` and `support.js`;
  - fetched the same day by the integration session: `Vision v2.dc.html` and
    `Custom Bundles.dc.html`;
  - `Playground.dc.html` was read and matches in content, but was not byte-compared.
- **Design captures.** The reference renderings are in `design-source/reference/<page>-{1440,390}.png`.
  Each is newer than its design file.
- **Site captures.** The current site was captured for this audit in [`screens/`](screens/) at
  1440 and 390 px. Each is a full-page production build, scrolled through once so lazy previews
  mount.
- **Transparent backgrounds** in earlier exports are not dark sections. The site is light
  everywhere except the homepage's "Native first" band, which is dark by design (`--color-night`).

Classification key: **A** intentional adaptation, **F** functional improvement, **M** missing
implementation, **R** visual regression, **O** outdated design, **U** unexplained difference.

## Summary by page

| Page | Approved design | Route | Status | Material deviations |
|---|---|---|---|---|
| Homepage | `Home.dc.html` (re-imported 2026-10-20) | `/` | Implemented | A, F only (below) |
| Vision | `Vision v2.dc.html` | `/vision/` | Implemented (v2 replaced v1 on 2026-10-20) | A, F; one layout difference (U, minor) |
| Examples gallery | `Examples.dc.html` (catalog view) | `/examples/` | Implemented | A, F; M (levels, two categories, three examples) |
| Example detail | `Examples.dc.html` (detail view) | `/examples/<id>/` | Implemented | A, F; M (filter-free "How it works" rows for native APIs) |
| Custom Bundles | `Custom Bundles.dc.html` | `/docs/custom-bundles/` | Implemented in the docs shell | A, F; M (filter tabs, Expand all, tabbed pipeline) |
| Docs shell, reference | `Docs.dc.html` | `/docs/**` | Implemented (earlier sessions) | A (contrast token), see `design-inventory.md` § 8 |
| Playground | `Playground.dc.html` | `/playground/` | Implemented | F: real runtime instead of the design's "Simulated preview"; A: header tab, taller panes |
| Control Center, Deep Dive | `Control Center*.dc.html` | `/examples/control-center*/` | Implemented (earlier sessions) | not re-compared in this audit |
| Design system | `Design System.dc.html` | `/design-system/` | Implemented (earlier sessions) | not re-compared in this audit |
| Bundle Builder | Vision v1 § 08 concept (no dedicated design) | `/bundle-builder/` | Implemented | O: its only design is the superseded Vision v1 section |
| Admin | `Control Center Admin.dc.html` | local only (`npm run admin`, 127.0.0.1) | Implemented (other session) | screens not compared here; see its own report |
| Mobile Views | `Mobile Views.dc.html` | none (a canvas of other pages) | n/a | — |

## Homepage (`/`)

Compared: `design-source/reference/home-1440.png` and `screens/home-1440.jpg`; the same at 390.

- **Matches:**
  - section order, with "Before / after" first;
  - the hero headline and its cycling verb (the 390 capture caught it on "recalls");
  - the install snippet, the capability demos, "Native first", "Where this fits", the
    documentation cards and the footer.
- **A:** the demo-version notice above the header. It was added by request and is not in the
  design.
- **F:** the hero, the "Same result" strip and the capability demos run the real runtime. The design
  shares React state between them; the site cannot, so the strip runs its own copy (recorded in
  `design-inventory.md`).
- **A:** the hero uses `cycle()` rather than the design's `set(pick())`, to stay with stable
  features.
- **No regression found.**

## Vision v2 (`/vision/`)

Compared: `reference/vision-v2-1440.png` and `screens/vision-1440.jpg`; the same at 390.

- **Matches:** the five sections, their order, headings, copy, grids and closing call to action.
- **F:** the Reactive CSS demos run the runtime. The design labels them "simulated".
- **A:** the `:has()` card is real native CSS. The `if()` card shows the code but switches with
  radios and `:has()`, because `if()` support is still arriving.
- **A:** the site header and footer replace the design's minimal ones.
- **A:** the copy was corrected:
  - `wave()` was "removed in 0.5.0", not "before the beta";
  - the performance report exists and is linked;
  - the JavaScript comparison is on `/examples/score-history/#vanilla`.
- **U (minor):** at 1440 px the four questions sit in one row where the design shows three plus
  one. The cause is the site's 40 px gutter against the design's 48 px.
- **A:** the GitHub button is disabled ("when available"), as in the design, because no
  repository link exists.
- **Outdated evidence:** `docs/visual-review/compare-vision-*.png` (Oct 20, 00:02) still compares
  against the v1 reference. The visual-review set has no v2 comparison.

## Examples (`/examples/`, `/examples/<id>/`)

Compared: `reference/examples-1440.png` with `screens/examples-1440.jpg` and
`screens/example-counter-1440.jpg`.

- **Matches:**
  - **gallery:** the hero, the category tabs, cards with a tinted preview over a white body, and a
    four-column grid in which one card per row of three spans two columns;
  - **links:** "View all N →" group links, and the whole card body opening the example;
  - **detail page:** the breadcrumb with its category chip and position, the preview stage with
    Reset, View source, Open in Playground ↗ and Inspect, Implementation beside "How it works",
    and the next and related examples.
- **F:** every API card and every detail preview runs the runtime. The design simulates them.
- **A:** the categories are the library's (API examples, Interfaces, Advanced, Test lab) instead of
  Basics, Components, Interfaces, Advanced and Experimental. "Experimental" is a tag.
- **M:** the design's levels (Beginner, Intermediate, Advanced) are not shipped, because the library
  defines none.
- **M:** three design examples have no implementation:
  - Accordion: the library has no example;
  - Dynamic Components and Stylesheet Lifecycle: they need a JavaScript harness.
- **A:** "How it works" lists only Reactive CSS APIs, not native ones such as `calc()`. The site has
  no summaries for native features.
- **A:** Interfaces, Advanced and Test lab cards have no live preview. Their technical line takes
  its place.

## Custom Bundles (`/docs/custom-bundles/`)

Compared: `reference/custom-bundles-1440.png` and `screens/custom-bundles-1440.jpg`.

- **Matches:** every section, in order: overview, how it works, quick start, the selection
  illustration, features, missing feature, analyzer, sizes, advanced, hosting, FAQ and next steps.
- **A:** the page keeps the docs shell (sidebar, breadcrumb, table of contents). Section headings
  are the design's short labels, with its sentence as a lead line.
- **F:** every «…» placeholder was replaced by the library's real value. The design's
  pattern-matching analyzer was replaced by real CLI output and a link to the Builder's real
  analysis.
- **M:** the filter tabs on the feature list, "Expand all" and the tabbed pipeline. The page uses
  native disclosures and a static four-step flow instead.

## Playground (`/playground/`)

- **F:** it runs the real runtime with debounced restarts. The design says "Simulated preview".
- **A** (changed on request on 2026-10-20):
  - the editor has a header with its file as the active tab;
  - the editor and the preview have equal 440 px bodies;
  - the editor shows no focus outline; the caret is its only focus indicator. See the
    accessibility finding in `prelaunch-audit.md`.

## Pages not re-compared in this audit

These were integrated and visually reviewed by earlier sessions (`docs/visual-review/README.md`,
dated 2026-10-19). This audit did not repeat the comparison, so it relies on those reports:
- Control Center and Deep Dive;
- Design system;
- the docs reference pages.
