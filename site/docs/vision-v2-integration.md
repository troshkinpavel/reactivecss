# Vision v2 integration

`/vision/` now implements `Vision v2.dc.html`. It explains why Reactive CSS exists. What the library
does is on the homepage, and how it works is in the docs. The examples, the measurements and the
bundle builder each have their own page, and Vision links to them.

Nothing outside `site/` was changed: no runtime source, no library API, no Git, no publishing.

## 1. Imported design

- **Source.** `design-source/Vision v2.dc.html`, read from Claude Design project
  `2d981aaa-2377-4041-b285-7110658450e0` with the design MCP. It uses the project's existing
  `support.js`.
- **History.** `Vision.dc.html` (v1) is kept unchanged as a historical reference.
- **Reference screenshots.** `design-source/reference/vision-v2-{1440,390}.png`, from
  `PAGES=vision-v2 node scripts/capture-design.mjs`.

## 2. Implemented sections

The design's order and headings:

| # | id | Heading | Implementation |
|---|---|---|---|
| 01 | `question` | CSS is evolving. We're exploring what comes next. | Static. The tagline, the color → layout → logic → behavior? line and two paragraphs |
| 02 | `evolution` | Calculate → Relate → Decide → React? | `EvolutionSteps` island (`client:visible`), see § 4 |
| 03 | `native` | If the browser already does it well, use the browser. | Static. Three principles and the `wave()` story |
| 04 | `experiment` | The interaction doesn't disappear. The imperative glue does. | `ExperimentDemo` island (`client:visible`), see § 4 |
| 05 | `direction` | An experiment, not a standard. | Static. Four open questions and the closing actions |

## 3. Reused components

- `SectionKicker` (`/* 01 The question */`).
- `buttonClass`.
- `SiteHeader`, `SiteMenu` and `SiteFooter` (the site's own, not the design's minimal ones).
- `SearchDialog`.
- `PreviewFrame` and `analyze`.
- The colour tokens.

The two new components are in `src/components/vision/VisionV2.tsx`. Their stories are in
`Vision.stories.tsx`: Evolution, Experiment and Narrow, each with play tests.

## 4. Interactions: real or native, never simulated

The design simulates all four step cards and the article result in React state. On the site, each
demo runs the real thing:

- **i · calculate.** The slider computes `clamp(16px, 4vw, 40px)` for the chosen width. It is
  local React state, because a range input cannot feed CSS on its own.
- **ii · relate.** This is real `:has()`. The checkbox adds an image to the card, and the card's
  style and the "matches" label follow from `:has(...)`. No script is involved.
- **iii · decide.** The card shows `if()` as code. The switch is native radios plus `:has()`,
  because `if()` support is still arriving, as the card's text says.
- **iv · react?** The counter runs the Reactive CSS runtime in a sandboxed frame. The card shows
  the three lines it runs, and every reactive line in the frame is on the card. The design's
  "simulated here" label became "runs the Reactive CSS runtime".
- **04 · result.** The reading-list article runs the runtime with the stylesheet shown beside it.
  - The code shown runs as is. Two lines were added to the design's code, both visible:
    - `attr: aria-pressed when(--saved);` gives the button a real pressed state.
    - `.note::after { content: when(--saved, …) }` makes the note follow the state. The design
      did that in React.
  - Hovering or focusing a role ("declaration · state", "event · on:", "result · condition")
    highlights its lines.
  - A click in the preview lights the event, then the state, then the result, driven by the
    bridge's `event` message. With reduced motion, all three light at once and then clear.
  - The label reads "real runtime", not "simulated".

## 5. Removed or relocated Vision v1 content

| v1 section | Now |
|---|---|
| Evolution timeline (tabs, `EvolutionTimeline`) | Replaced by section 02. The stages (`STAGES`) stay on the homepage's "Where this fits" |
| Principles (`Principles`) | Replaced by section 03 |
| Vanilla JS comparison (`ScoreComparison`) | **Moved** to `/examples/score-history/#vanilla`. The component is now in `components/examples/` and its JavaScript in `content/vanilla/`. `score-parity.spec.ts` runs it there |
| Five-demo showcase (`DemoShowcase`) | Removed; the demos are in Examples |
| Engineering metrics | Removed; the numbers are on `/docs/performance/`, which section 05 links |
| Native vs Reactive table, `wave()` story | The story is in section 03; the table is removed (the docs' Simplify CSS covers it) |
| Bundle builder preview | Removed; `/bundle-builder/` is linked from the header, footer, home, docs |
| Messaging options (Storybook only) | Removed (`MESSAGES`), as "marketing headline experiments" |

**Deleted:** `DemoShowcase.tsx`, `EvolutionTimeline.tsx` and `VisionSections.tsx`, and the unused
exports `PRINCIPLES`, `DISCLAIMER`, `NATIVE_ROWS`, `RX_ROWS`, `MESSAGES` (`lib/content/vision.ts`)
and `SHOWCASE` (`lib/content/demos.ts`). Before each deletion I checked with a search that nothing
else used it.

## 6. Technical corrections against the design

- **Removal of `wave()`.** The design says `wave()` was removed "before the beta". The CHANGELOG
  says it was removed in 0.5.0, so the page says that and links `/docs/geometry/#wave-was-removed`.
- **Performance report.** The design calls it "in preparation". It exists (`/docs/performance/`)
  and is linked.
- **JavaScript comparisons.** The design says they are "in Examples". The one comparison is on the
  score-history example page, and the link goes there.
- **Version.** The design's footer says v0.5.0. The site footer shows the registry version (0.8.0).
- **Unchanged claims.** These are true and stay: "not part of any specification or browser
  roadmap", "JavaScript is still involved", and "not a proposal".

## 7. Responsive behavior

- **Layout.** Every grid is `auto-fit`, as in the design. At 1440 px the steps use four columns,
  the questions four (the design shows three, because its gutter is 48 px and the site's is 40 px),
  and the article code sits beside its result. At phone widths everything stacks.
- **Code.** Long code lines scroll inside their own box.
- **Checks.** A browser test checks for no horizontal overflow at 320, 375, 390, 768, 1024 and
  1440 px (on `/vision/` and `/examples/score-history/`). I compared screenshots at 1440 and 390
  with the design.

## 8. Accessibility

- **Headings.** One `h1`, four `h2`s in order. Each section is a `section` labelled by its
  heading.
- **Controls.**
  - The slider has a label ("Viewport width").
  - The checkbox and the radios are native, inside a `fieldset` with a `legend`, with a visible
    focus ring on their labels.
  - The role legend is made of buttons with `aria-pressed`.
  - The arrows in the evolution heading are `aria-hidden`.
- **Scrollable code.** The two code boxes that scroll are focusable (`tabIndex=0`); axe's
  `scrollable-region-focusable` found them, and they are fixed.
- **Previews.** The iframes have titles ("Counter, run by the Reactive CSS runtime"). The article's
  button label is generated content, and the test reads it as its accessible name.
- **axe.** The scan in `site.spec.ts` covers `/vision/` and finds no serious or critical issues.
  No screen-reader testing was performed.
- **Reduced motion.** The site's global rule removes transitions, and the code pulse lights all
  roles at once instead of in sequence.

## 9. Performance

- **Islands.** v1 hydrated a timeline, a comparison of two frames, a five-demo showcase and a
  metrics block. v2 has three islands: the two demos (`client:visible`) and the search dialog
  (`client:idle`).
- **Measured** with the production build at 1440 px, after scrolling the whole page: HTML
  45.7 KB, JavaScript 285 KB uncompressed (most of it React and the search dialog, shared with
  other pages), CLS 0.002.
- **Not measured.** v1 was not measured with this script before it was replaced, so there is no
  exact before-and-after.
- **Background work.** There is no continuous animation. The two runtime frames start only when
  they scroll into view.

## 10. Tests

- **`tests/e2e/vision.spec.ts`** (rewritten), in Chromium and WebKit. It checks:
  - the five sections in order, the headings and one disclaimer;
  - that no v1 section remains;
  - that the native steps work without the runtime;
  - the counter running the runtime;
  - the article saving through the runtime (accessible name, `aria-pressed`, the note);
  - the code highlighting by role;
  - that every internal link resolves and the moved comparison exists;
  - no overflow at six widths.
- **Moved or updated tests.**
  - `score-parity.spec.ts` now runs on `/examples/score-history/`.
  - The "every library demo page runs" test moved to `gallery.spec.ts`.
  - `bundle-builder.spec.ts` reaches the builder from Vision's footer link.
  - The `site.spec.ts` anchor check uses `#experiment`.
- **Visual baselines.** The four Vision baselines were replaced after I reviewed the new captures
  (the whole page changed by design).
- **Full suite.** Typecheck, unit (261), Storybook (99) and Playwright (341 passed, 41 skipped),
  run after both stages.

## 11. Known limitations

- **Live runtime cards.** In a full-page screenshot the two runtime cards may look empty: Chromium
  pauses animation frames in off-screen sandboxed frames. In view, they render.
- **`if()`.** The card describes `if()`; it does not run it.
- **GitHub button.** "View source on GitHub" stays disabled ("when available"), as in the design:
  no repository link is published.
