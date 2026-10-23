# Visual review

`npm run build && npm run visual-review` writes, for each page:

- `<page>-<width>.png`: the built site at 1440, 1280, 1024 and 390 px;
- `compare-<page>-<width>.png`: the Claude Design reference (left) next to the implementation
  (right), at 1440 and 390 px, the widths the references were captured at
  (`design-source/reference/`, `node scripts/capture-design.mjs`).

Screenshot regression tests (`npm run test:visual`) keep the reviewed result: baselines in
`tests/e2e/visual.spec.ts-snapshots/`, Chromium, previews and live chips masked.

## Findings (2026-10-19)

Checked against the references for typography (measured with `getComputedStyle`: h1 34–50 px,
h2 26 px, lede 19 px, body 17 px match), alignment, navigation widths (264 / 960 / 220 px),
code line height (font × 1.72), borders, surfaces, accent use and component heights.

| Area | Result |
|---|---|
| Homepage | Matches section by section. The hero button reads "Next greeting" (see example-authoring.md). The before/after note no longer claims shared state between two previews. |
| Docs pages | Match. The banner text reflects the real runtime and the 0.5.0 registry. |
| API pages | Match. A "registry syntax" line appears under Syntax when the registry spells it differently. |
| Simplify CSS | Comparisons match; the result pane runs the real example. |
| Control Center | Matches the layout: toolbar, preview with trace below, code with outline, inspector and state dock. Trace steps and values are observed. |
| Playground | Matches; the "Simulated preview" badge became "runtime preview" and the status line reports runtime diagnostics. |
| Design System | Matches; the trace specimen is labelled "specimen · no runtime". |
| 390 px | Typography identical. The design itself overflows horizontally on Getting Started (a long inline code); the implementation wraps it. |
| Line height | Body text uses `normal` as the design does (Tailwind's default 1.5 made lists and nav looser). |
| Contrast | `--color-mute` is a little darker (lightness 0.53 instead of 0.56) to pass WCAG AA. |

In full-page captures, previews sometimes show an empty stage: Chromium does not paint
off-screen cross-origin frames for the screenshot. Element screenshots and the e2e tests show
them running.
