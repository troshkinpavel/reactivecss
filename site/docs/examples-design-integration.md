# Examples gallery: design integration

The Examples redesign (`Examples.dc.html`) as implemented at `/examples/`. Rule for the whole
page: one example, one capability, one visible result, and every preview runs the real
runtime.

## 1. Design source

- `design-source/Examples.dc.html` is imported from Claude Design project
  `2d981aaa-2377-4041-b285-7110658450e0`.
- The reference screenshots are `design-source/reference/examples-1440.png` and `examples-390.png`
  (`PAGES=examples node scripts/capture-design.mjs`).
- The design's catalog has 18 examples in five groups: Basics, Components, Interfaces, Advanced
  and Experimental. Each card has a preview, title, level, description, tech line and API tags.
- The design's detail view has these parts, in order: a breadcrumb with a category chip and
  prev/next, the header, a live preview panel (Reset, View source, Open in Playground, Inspect),
  How it works, the implementation in file tabs with a fade and "Show all", then Next and Related.
- The design simulates its previews in React state, and its footer says so. The site does not
  simulate them.

## 2. Components

| Component | File | Role |
|---|---|---|
| `GalleryCard` | `src/components/gallery/GalleryCard.tsx` | Static card, as in the design: a solid preview panel (`paper-2`) over a white body (`paper-result`). Everything below the preview is one link to the example (the title's link stretched over the body); the preview stays interactive. Title (21 px on a wide card in four columns), description (Markdown, clamped to 4 lines), tech line, API tags (vermilion when reactive, neutral otherwise; the experimental tag joins them so it never covers the preview). No code or "Open" text on the card: the source is on the detail page |
| `CardPreview` | `src/components/gallery/CardPreview.tsx` | Live card preview. Mounts a `PreviewFrame` only while on screen and scales it once to fit a 240 px box |
| `ExampleDetail` | `src/components/gallery/ExampleDetail.tsx` | Detail-page island, laid out as in the design: the live preview stage (Reset / View source / Open in Playground ↗ / Inspect, the example centered in a tall area, the README's "How to interact" as a hint under it), then Implementation ("2 files · N lines", file tabs with a kind label, "Show all N lines") beside How it works from 1024 px; on narrower screens How it works comes first |
| `PreviewFrame` | `src/components/examples/PreviewFrame.tsx` | Existing sandboxed frame. Two props were added: `maxHeight` and `onHeight` |
| Catalog | `src/lib/content/catalog.ts` | The single list behind the gallery, the detail routes, related links, the Playground's extra presets and search |

Stories are in `src/components/gallery/Gallery.stories.tsx`: Default, CardLink,
Wide, ExperimentalApi, PreviewProblem, AdvancedCard, NarrowViewport and Detail. All have play tests
where there is something to check.

## 3. Gallery structure

The site's categories differ from the design's, because they follow what the library ships:

| Site category | Contents | Card preview |
|---|---|---|
| API examples (16) | `examples/api/*`: one capability each | Live, real runtime |
| Interfaces (12) | The library demos (product configurator … keyboard playground) | None; a technical line ("11 Reactive CSS features") instead |
| Advanced (2) | Control Center and Control Center · Deep Dive (workspace pages) | None; the workspace description |
| Test lab (6) | The library's 0.7.1 validation demos (focus transitions, keyboard navigation, attribute playground, nested cascade, form interactions, history motion) | None |

- **Tabs.** "All" shows every group: all 16 API examples, and 3 cards for each other group with a
  "View all N →" link. Groups shown whole get "View <group> →", as in the design. Either opens
  that group's tab. A category tab shows that group in full, with its introduction.
- **Keyboard and URL.** The tabs support the arrow keys. The choice is kept in the URL hash
  (`#api`, `#interfaces`, `#advanced`, `#lab`), and changing the hash later also changes the tab.
- **Design categories not used.** Basics and Components are not used: the library does not sort
  its examples that way. Experimental is a dashed tag, not a category. That status comes from the
  registry and applies to individual APIs inside many examples.
- **Levels not shipped.** The design's levels (Beginner, Intermediate, Advanced) and its "try it"
  labels are left out. The library does not define levels, and inventing them would be made-up
  metadata.

## 4. Available examples

What each of the design's 18 examples maps to:

| Design example | Site |
|---|---|
| Counter | API example `counter` |
| Element Geometry | API example `element-size` |
| Pointer Spotlight | API example `mouse-tracker` |
| Keyboard Navigation | API example `keyboard-controls`, and Test lab `keyboard-navigation` |
| Toggle | Interfaces `accessible-toggle` |
| Tabs | Interfaces `accessible-tabs` |
| Form Preview | Interfaces `live-form-preview` |
| Product Configurator, Multi-step Wizard, Interactive Quiz | Interfaces, same names |
| Control Center, Control Center Deep Dive | Advanced (existing workspace pages, unchanged) |
| Focus Transitions, Attribute Playground, Nested State & Cascade | Test lab |

The other 13 API examples are not in the design and come from the library. They are state
history, random colors, pick a value, live values, input binding, conditional styles, dynamic
attributes, focus management, state selection, change animation, viewport and visibility.

## 5. Missing examples

None of these were fabricated:

- **Accordion.** The library has no accordion example or demo. Native `<details name>` already
  does one-open-at-a-time, as the design itself notes.
- **Dynamic Components** and **Stylesheet Lifecycle** (`dynamic-components`, `stylesheet-lab`).
  The library runs these with a JavaScript harness and extra stylesheets, and the site's sandbox
  runs neither. They are left out of `DEMO_ORDER` with a comment.

## 6. Routes

- `/examples/` is the gallery.
- `/examples/<id>/` is the one canonical detail page for each catalog entry with runnable
  sources: 16 API examples, 12 interfaces and 6 test-lab cases.
- `/examples/control-center/` and `/examples/control-center-deep-dive/` are the existing
  workspace pages. The gallery links to them.
- **Route clash.** The site's own `counter` example also wanted `/examples/counter/`; the API
  example `counter` keeps that route. The site's version stays embedded on
  `/docs/examples/counter/`.
- **Older site examples** (for example `/examples/dice/`) keep their plain pages, because docs
  embed them. They are not in the gallery and not indexed (no `data-pagefind-body`).
- **`/docs/examples/`** is now "Example walkthroughs", with a callout to the gallery. Its old list
  of library demos (`LibraryDemos.astro`) was removed, so there is one list, not two.
- **Links.** Every link to the examples (header, footer, home, Vision, docs cards, Bundle
  Builder, workspace "next") now points at `/examples/` or one of its hashes.

## 6a. Detail page layout

As in the design's detail view:

- **Breadcrumb:** "Examples / Title", the category chip, and "‹ Category · i / n ›" (the category name is hidden on phones).
- **Header:** title, description, API tags and the experimental tag. The design's level is left out (§ 3); the library path moved to the note under the source.
- **How it works:** one row per primary API, with the lines of the shown stylesheet that use it and its reference summary (`howRows()` in `catalog.ts`, unit-tested; the name links to the reference). Below the rows, in the design's small note style (`.prose-note`): the README's explanation, the native CSS alternative, what would normally need JavaScript, limitations and accessibility. These stay so the page says where native HTML and CSS already cover the case.
- **Next recommended** and **Related** follow, then the site footer.

## 7. Breadcrumb fix

- **The bug.** Docs pages under Examples read "Docs / Examples / Examples" because
  `pages/docs/[...slug].astro` pushed a second "Examples" crumb.
- **The fix.** That push is gone, and the crumb list now drops any crumb that links to the
  current page.
- **`aria-current`.** Breadcrumbs now hold ancestors only, so `PageNav` no longer marks any of
  them `aria-current`. The detail pages build their own trail, where the current title is plain
  text with `aria-current="page"`.
- **Gallery detail pages.** The trail reads "Examples / Title", followed by a category chip
  linking to `/examples/#<category>` and "‹ i / n ›" within the category.
- **Workspace pages.** These read "Examples / Advanced" (`/examples/#advanced`).
- **Tests.** A browser test checks four docs pages for repeated labels and self-links.

## 8. Advanced examples

The Control Center and Deep Dive pages are unchanged. They appear as the Advanced group, with
their workspace description as the tech line. The design's Advanced group had 7 entries. Here,
5 of them (Focus Transitions, Attribute Playground, Nested State & Cascade, and the two
JS-harness cases) are library validation cases, so 3 sit in Test lab and 2 are missing (§ 5).

## 9. Runtime loading strategy

The site uses the shared full runtime (`public/runtime/reactive-css.min.js`, 116 KB, 39 KB
gzipped), inlined in each sandboxed `srcdoc` like every other preview. It does not use custom
bundles.

- **One frame per visible card.** Each frame is an opaque-origin `sandbox="allow-scripts
  allow-forms"` document with a per-document CSP nonce and the validated message bridge.
  Nothing about the isolation changed.
- **Lazy mount.** An IntersectionObserver (120 px margin) mounts a card's frame when it comes
  near the viewport.
- **Unmount on exit.** Leaving the viewport unmounts the frame, which stops `live()`, `mouse()`,
  `visible()` and every other timer or observer. Coming back starts it fresh.
- **Measured** (Chromium, production build): 4 live frames at 1440 px on load, 1 at 390 px, and
  0 after scrolling to the bottom of the page. A browser test asserts fewer than 16 at load and
  none for the first card once it is far off screen.
- **Detail pages** run one frame, `client:load`, auto-height between 120 and 720 px, centered in a stage at least 440 px tall (300 px on phones). The cap
  exists because `keyboard-controls` has a `120vh` filler, which made the auto-height frame
  grow without limit (19,780 px).

## 10. Source synchronization

- **Copy.** `scripts/sync-runtime.mjs` copies `../examples/api/<id>/{index.html,style.css,README.md}`
  and `api.css` to `src/generated/api-examples/`, before `dev` and `build`.
- **Parse.** `catalog.ts` reads each folder:
  - the title, the lede and the primary APIs (the `<code>` items in `p.kicker`), from
    `index.html`;
  - the layout and the behavior, from `style.css`, split at the `/* ---- Reactive CSS ---- */`
    divider;
  - the How it works sections, from `README.md`.
- **Previews.** Cards run only the `section.demo` markup. Detail pages run the whole `<main>`.
- **Tests.** `tests/unit/catalog.test.ts` checks that:
  - every library API folder is present, in library order;
  - the hrefs are unique;
  - every primary API has a docs link;
  - the card and detail CSS compile;
  - related examples stay in their own category.

A new library example appears automatically, and the browser test that loops over the generated
folder covers it.

## 11. Playground

- **API examples.** "Open in Playground" is offered for the 16 API examples:
  `/playground/?example=<id>` adds the example as an extra preset and selects it. Only the
  stylesheet is editable, as for the other presets.
- **Interfaces and Test lab.** Not offered: their stylesheets are long, and the Playground's
  editor is meant for short ones. Their detail page shows the full source.
- **Test.** A browser test opens `?example=counter` and checks that the preset is selected and
  the runtime reports no diagnostics.

## 12. Accessibility

- **Category tabs.** They follow the tabs pattern: `role="tablist"` named "Categories",
  `aria-selected`, roving `tabindex`, and arrow keys.
- **Inspect.** A toggle button with `aria-pressed` and `aria-controls`. The panel is `hidden`
  until it is opened.
- **"Show all N lines".** It moves focus to the code it reveals, so focus is not lost when the
  button disappears.
- **Names and landmarks.** Each preview iframe has a title ("Counter: live preview"). The
  breadcrumb is a `nav` named "Breadcrumb", with `aria-current` on the current page only.
- **Contrast.** The vermilion tags and the "experimental" tag use the existing tokens, which
  already meet AA.
- **axe.** The axe scan in `site.spec.ts` now includes `/examples/`, `/examples/counter/` and
  `/examples/keyboard-controls/`. It finds no serious or critical violations. As on other pages,
  the iframes are excluded, because they are separate sandboxed documents.
- **Screen readers.** No screen-reader testing was performed.

## 13. Responsive behavior

- **Grid.** Every group uses the design's grid: four columns from 1100 px, two from 640 px, one
  below. No card ever spans the whole content width on desktop or tablet: wide cards span two
  columns only in the four-column layout. Cards come in rows of three where one card spans two columns, first in one row and
  last in the next (`gallerySpans()` in `catalog.ts`, unit-tested). A last row of one card joins
  the row before as four plain cards (the 16 API examples end that way); a last row of two spans
  two each (Advanced).
- **Tab bar.** It scrolls sideways on phones, and the page itself does not.
- **Card previews.** They keep a 240 px box and are scaled to fit, never cropped.
- **Overflow.** A browser test checks for no horizontal overflow on the gallery, an API detail
  page and an interface detail page, at 320, 375, 390, 768, 1024 and 1440 px.
- **Screenshots.** Reviewed at 1440 and 390/375 against the design reference.

## 14. Browser tests

`tests/e2e/gallery.spec.ts`, run in Chromium and WebKit, covers:

- **Gallery:** category filtering, the hash, arrow keys and "View all"; and the lazy lifecycle
  (a limited number of live frames, and frames removed when far off screen).
- **Cards:** the body below the preview opens the example while the preview stays interactive;
  group links ("View all 12 →") and the footer on the gallery and detail pages.
- **Copy** of a detail page's source, in Chromium (clipboard permission).
- **Every API example route** (generated from the synced folder): it renders, the runtime runs
  with no diagnostics, and the breadcrumb is right.
- **Detail pages:**
  - counter: DOM text, Reset, and the inspector collapsed by default;
  - dynamic attributes: real `disabled` at both bounds;
  - keyboard controls: the arrow key is `defaultPrevented` on the board, but not in the text
    field;
  - focus management: `document.activeElement` moves to the new step heading;
  - source tabs, and focus after "Show all".
- **Playground:** `?example=counter`.
- **Breadcrumbs:** no repeated labels or self-links; the Advanced trail.
- **Search:** one result per page, no generated anchors, and `keyboard controls` finds its
  example.
- **Overflow** at six widths.

Existing specs were updated for the new selectors and routes: `demos`, `examples`, `vision` and
`site`. Firefox was not run.

## 15. Performance

- No card preview runs off screen, and the gallery loads with 4 live frames on desktop and 1 on
  phones.
- Interfaces, Advanced and Test lab cards are static HTML with no island, so the page hydrates
  only the visible API-card previews.
- **Search.** Source panels and previews carry `data-pagefind-ignore`, and How it works has
  weight 0.5, so reference pages outrank example code for API names. Before this, the detail
  pages produced `useId` anchors and code matches in results.

## 16. Limitations

- **Preview start-up.** A card preview is blank for about a second after it scrolls in, while
  the runtime starts, and it starts fresh each time it comes back.
- **Missing examples.** There is no accordion, and two library validation cases are not run
  (§ 5).
- **No visual baseline for `/examples/`.** Live values, random colors and timers make it
  unstable. The existing baselines passed unchanged.
- **Bundle Builder search (fixed).** "bundle builder" did not find `/bundle-builder/` in the top
  five. Pagefind took the page's title from its `h1` ("Build only what you need."), so the words
  were never indexed as its title. Its `main` now sets `data-pagefind-meta="title:Bundle
  Builder, …"`. Nothing visible changed, and the visual baselines pass.
- **One WebKit failure.** In one full-suite WebKit run, the focus-management route test failed
  once. It passed 90 of 90 times when the gallery spec was rerun on its own.
- **Dice flake.** `examples.spec.ts` "dice" was flaky in WebKit because a re-roll can repeat the
  value, and an unchanged value logs nothing. The test now rolls until the log shows a change.
