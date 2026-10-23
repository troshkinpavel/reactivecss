# Performance

Measured with `npm run build && npm run measure` (`scripts/measure-performance.mjs`) on 2026-10-18, Chromium 156.0.8078.4 (headless, Playwright), 1440 × 900, local static server, no throttling. Raw data: [performance-results.json](performance-results.json). These are local lab numbers on one machine; no Lighthouse score or field data was collected.

## Per page

| Page | JS requests | JS kB | JS kB gzip | Islands hydrated at load / total | Previews | CLS | Long tasks |
|---|---|---|---|---|---|---|---|
| `/` | 11 | 310.3 | 97.7 | 2 / 6 | 2 | 0.006 | 0 |
| `/docs/introduction/` | 11 | 312.5 | 98.5 | 2 / 3 | 1 | 0.0088 | 0 |
| `/docs/troubleshooting/` | 6 | 286.2 | 87.9 | 1 / 2 | 0 | 0.004 | 0 |
| `/docs/reference/state/` | 10 | 312.5 | 98.5 | 1 / 2 | 1 | 0.0042 | 0 |
| `/docs/examples/tabs/` | 10 | 312.5 | 98.5 | 2 / 2 | 1 | 0.0047 | 0 |
| `/examples/control-center/` | 11 | 337.6 | 105.6 | 2 / 2 | 1 | 0.0035 | 0 |
| `/playground/` | 12 | 314.6 | 99.6 | 2 / 2 | 1 | 0.0007 | 0 |
| `/design-system/` | 7 | 287.2 | 88.2 | 1 / 1 | 0 | 0.0017 | 0 |
| `/vision/` (added with the Vision integration) | 12 | 335.4 | 105.6 | 1 / 4 | 2 (one per live section, only after scrolling) | 0.0015 | 0 |
| `/examples/score-history/` (library demo) | 11 | 330 | 103.3 | 2 / 2 | 1 | 0.0031 | 0 |
| `/docs/performance/` | 4 | 222.2 | 70.3 | 1 / 1 | 0 | 0.0063 | 0 |

The three rows above come from a later run (same machine, after the Vision integration); `/` measured 102.6 kB gzip in that run, including the new static section. The other rows are from the first run.

**Content and UX QA pass** (same machine, production build; before → after):

| Page | JS kB gzip | Previews | CLS |
|---|---|---|---|
| `/vision/` | 105.6 → 106.7 | 2 → 3 (the third is the vanilla JS comparison frame, which loads no Reactive CSS) | 0.0015 → 0.0015 |
| every other page | +0.0 to +0.5 (the preview failure states in the shared `PreviewFrame` chunk) | unchanged | unchanged |

The second comparison frame first pushed `/vision/` CLS to 0.0296: the showcase preview grew from its minimum height to its content (320 → 794 px) while on screen. Hydrating the two live sections 800 px before they scroll into view (`client:visible={{ rootMargin: "800px" }}`) gives the frames their height first; three runs measured 0.0012–0.0013 with the measurement script's scroll. Long tasks: none. CSS: one file, 62,220 B, 12,380 B gzip.

React (`client.*.js`, 64.3 kB gzip) still loads on every page, at idle, for the search dialog. It is not render-blocking and causes no long task; on pages with no other island (for example `/docs/performance/`, 70.3 kB in total) it is most of the JavaScript. Hydrating search on first use would save it there; not done, as the search architecture is out of scope for this pass.

- *Islands hydrated at load* counts `client:load` and `client:idle` islands after 1.5 s; the rest hydrate when scrolled into view (all did).
- *Long tasks*: tasks over 50 ms during load and a full scroll. None were recorded.
- CLS stays under 0.01 on every page.

## Bundles

| File | kB | kB gzip |
|---|---|---|
| `client.C7WjD2Pw.js` | 207.9 | 64.3 |
| `CodePanel.DJqR__2j.js` | 63.9 | 17.6 |
| `ControlCenterWorkspace.B87ExYes.js` | 32.5 | 9.6 |
| `usePreviewSession.D9j7YUVq.js` | 11.3 | 4.7 |
| `CodeComparison.Dhuy_n_G.js` | 8.3 | 3.1 |
| `react.CvnImTBr.js` | 7.7 | 3 |
| `Playground.R_wbNFeh.js` | 6.3 | 2.4 |
| `SearchDialog.BDw7lfrS.js` | 6.2 | 2.8 |

Inside every preview document (inlined, not part of the page's own JavaScript):

| File | kB | kB gzip |
|---|---|---|
| `runtime/reactive-css.min.js (inlined into each preview document)` | 84.3 | 29.1 |
| `preview/bridge.js (inlined into each preview document)` | 7 | 2.8 |

## Memory and navigation

JS heap of the top-level page after GC. Sandboxed previews may run in their own process and are not included. Baseline (a page without previews): 1.2 MB. Control Center with its preview running: 3.3 MB. After navigating away: 1.2 MB, so nothing from the workspace is retained.

## What keeps it small

- Pages are static HTML. Presentational React components render at build time with no JavaScript.
- Code without reactive syntax is never hydrated; Copy uses one delegated listener.
- Previews mount only when their island hydrates (`client:visible`), and the homepage capability list mounts only the selected preview.
- Mobile menus, API categories and the inline table of contents are native `popover` and `<details>`.
- Highlighting runs at build time; only CSS that the reader can edit is tokenized in the browser.
- The search index loads on the first query.

## Known costs

- React's client runtime (≈ 64 kB gzip) loads on every page, because the search dialog is a React island. A vanilla search dialog would remove it from pages without examples (Troubleshooting, Design System).
- The `CodePanel` chunk includes the full API glossary (≈ 18 kB gzip). A generated glossary with only labels and one-line summaries would save about 12 kB.
- Each preview parses its own copy of the runtime (≈ 25 kB gzip), because inlining is what lets an opaque-origin frame run it on every dev server. Pages show one to three previews.
