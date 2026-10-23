# Design inventory

Source: Claude Design project `2d981aaa-2377-4041-b285-7110658450e0`, read through the
Claude Design MCP (`DesignSync.list_files` / `get_file`) on 2026-10-19. Every file below was
downloaded verbatim into [`design-source/`](../design-source/). Reference screenshots of each
page at 1440 px and 390 px are in [`design-source/reference/`](../design-source/reference/)
(`node scripts/capture-design.mjs` regenerates them).

## 1. Files

| File | Kind | What it is |
|---|---|---|
| `Home.dc.html` | page | Marketing homepage: hero, before/after, capability tabs, install, native-first, docs links, footer. Re-imported on 2026-10-20 (cycling headline, joined code + result cards, part highlighter, Like button example, redesigned footer); deviations below |
| `Docs.dc.html` | page | Whole documentation app (hash routed): header + banner, sidebar, article renderer, TOC, prev/next, search dialog |
| `docs-content-1.js` | data | Pages: Introduction, Getting Started, Installation |
| `docs-content-1b.js` | data | Pages: Core Concepts, Reactive Values, State, Events & Actions |
| `docs-content-1c.js` | data | Pages: Conditions, Dynamic Selectors, Data Binding, State History, Geometry & Animation |
| `docs-content-2.js` | data | API entries: `on:`, `bind:`, `state()`, `typed()`, actions, `closest()`, triggers, `key()`, `outside()` |
| `docs-content-2b.js` | data | API entries: conditions, history, selectors, values, `element()`, `wave()` |
| `docs-content-3.js` | data | Pages: API index, Examples index, 11 example pages, Advanced Examples, Compatibility, Limitations, Troubleshooting, Changelog |
| `docs-content-4.js` | data | Page: Simplify CSS |
| `Code.dc.html` | component | Code panel: tokenizer, line gutter, value chips, trace flash, dimmed branch, explanation rail, copy |
| `Example.dc.html` | component | Interactive example: file tabs, Explain toggle, code + preview, state foot, expanded inspector (state table + events). 16 demos |
| `Compare.dc.html` | component | Native vs Reactive comparison: relation + status badges, two code panes, live result, notes, links; narrow tabs |
| `Control Center.dc.html` | page | Advanced workspace (basic form version) |
| `Control Center Deep Dive.dc.html` | page | Same workspace, full 8-state version |
| `control-center-basic-src.js` | data | Control Center sources (Reactive + vanilla), expression registry |
| `control-center-src.js` | data | Deep Dive sources, expression registry, tokenizers |
| `Playground.dc.html` | page | Example picker, editable CSS over highlighted code, preview, state + events |
| `Design System.dc.html` | page | Concept, color, type, code highlighting, space/grid/shape, components, motion |
| `Vision.dc.html` | page | Vision page: editorial hero, evolution timeline, principles, JS vs Reactive comparison, five example showcase, engineering metrics, native vs extension, `wave()` story, bundle builder concept (implemented as `/bundle-builder/` in the 0.8.0 pass, see `bundle-builder-integration.md`), messaging alternatives. Imported after the first build; placement and corrections in `vision-integration.md`. **Superseded by Vision v2**; kept as a historical reference |
| `Vision v2.dc.html` | page | The current Vision page: the question, the evolution (calculate → relate → decide → react?), native first, the experiment, the direction. See `vision-v2-integration.md` |
| `Custom Bundles.dc.html` | page | The Custom Bundles guide in the docs shell: overview, how it works, quick start, features and dependencies, missing feature, analyzer, sizes, advanced configuration, hosting, FAQ. Its «…» placeholders were filled from the 0.8.0 library. See `custom-bundles-design-integration.md` |
| `Examples.dc.html` | page | Examples gallery and detail view: category tabs, live-preview cards, detail page with Reset / Inspect / Playground, implementation tabs, next and related. Imported for the Examples redesign; see `examples-design-integration.md` |
| `Control Center Admin.dc.html` | app | Local administration tool (dashboard, releases, changelog, links, announcements, feature visibility, SEO, site health, settings, Prepare Release). Imported on 2026-10-20. Not a public route: implemented as the local server in `admin/`; see `admin-control-center.md` |
| `Mobile Views.dc.html` | canvas | Four iframes of other pages at 390 × 844. Not a route; covered by responsive tests |
| `support.js` | runtime | Claude Design runtime (React UMD + template engine). Not used by the site |
| `uploads/*`, `screenshots/*` | assets | Library docs and audit screenshots from the design session. Not downloaded; not referenced by any page |

## 2. Routes

| Design | Route |
|---|---|
| `Home.dc.html` | `/` |
| `Docs.dc.html#<page>` | `/docs/<page>/` (MDX in `src/content/docs/`) |
| `Docs.dc.html#api-<name>` | `/docs/reference/<name>/` (generated from `src/content/api/` + the feature registry) |
| `Docs.dc.html#<page>--<section>` | `/docs/<page>/#<section>` |
| `Docs.dc.html#search` | search dialog, ⌘K / Ctrl+K on any page |
| `Control Center.dc.html` | `/examples/control-center/` |
| `Control Center Deep Dive.dc.html` | `/examples/control-center-deep-dive/` |
| `Examples.dc.html` | `/examples/` (gallery) and `/examples/<id>/` (detail, one per catalog entry) |
| `Playground.dc.html` | `/playground/` |
| `Design System.dc.html` | `/design-system/` |
| `Vision.dc.html` (v1) | No longer a route. Its stages remain on `/` (`#direction`), its JavaScript comparison on `/examples/score-history/#vanilla`, its metrics on `/docs/performance/`, its bundle builder at `/bundle-builder/` |
| `Vision v2.dc.html` | `/vision/` |
| `Custom Bundles.dc.html` | `/docs/custom-bundles/` |
| `Control Center Admin.dc.html` | none in the public build; `npm run admin` → `http://127.0.0.1:4323/#<screen>` |

## 3. Shared UI patterns

- **Header**: logo mark `{•}` + wordmark; context label in mono (`docs`, `playground`, `design system`); search button with `⌘K`; site nav. Home variant adds an `experimental` tag and a centered 1280 px container. Below 960 / 900 px a Menu button opens a full-width nav.
- **Docs banner**: mono strip under the header with version and status.
- **Section kicker**: mono `01  Before / after` above marketing headings.
- **Code panel** (`Code`): header (file label, badge, `● reactive` legend, Copy), numbered lines (line height = font × 1.72), outlined vermilion **value chips** at line end, **trace flash** (vermilion tint + gutter bar, instant on, 500 ms off), **dimmed inactive branch** (30 % opacity), **explanation rail** (72 px foot: name, kind, description, Reference →, pin/×).
- **Preview panel**: 38 px mono header (`<div class="greeting">` · `preview`), centered stage, 72 px mono foot with `--state  value` rows and the last event.
- **Interactive example**: the above two side by side with file tabs (`*.css Reactive CSS`, `*.js vanilla JS`, `index.html HTML`), `Explain ✓` toggle, Reset (expanded), Copy; expanded size adds a state table (name, value, previous, writes) and an event log.
- **Callouts**: note / tip (tinted), caution (ink border), warning (1.5 px ink, `!`), experimental (dashed vermilion), provisional (dashed grey), outcome (`✓ Expected result`).
- **Facts** (`dl` row with ink top rule), **Flow** (numbered steps with arrows), **Cards** (bordered links), **Related** chips (mono vermilion for APIs), **tables** (tinted head, hairlines, horizontal scroll), **param list**, **API index table**, **example list**.
- **Tags / status labels**: mono 11.5 px, 2 px radius, hairline border (`tutorial`, `exp`, `since 0.2.0`, `requires runtime`). Experimental uses a dashed vermilion border.
- **Segmented controls**: joined buttons, selected = ink fill (Playground examples, Compare registration, Like transition, Control Center modes).
- **Tabs**: underline 2 px ink (mobile pane tabs, preview tabs).
- **Prev / next** cards, **breadcrumbs** (mono, `/` separators).
- **Search dialog**: dimmed backdrop, 680 px panel with ink border and the one allowed shadow, 56 px input, `esc` key, suggested list, results with context, footer hints.
- **Footer**: logo, disclaimer, links.

## 4. Unique page components

- Home: hero greeting demo, capability list (vertical tabs on desktop, horizontal chips below 960 px) with five demos (greeting, wizard, score history, profile binding, pointer spotlight), install steps, dark “Native first” band, documentation link list.
- Docs: sidebar with collapsible API categories and counts, sticky TOC (≥ 1300 px) or inline collapsible TOC, API page template (Syntax, Parameters, Return value/Effect, Example, Behavior, Supported contexts, Limitations, Related).
- Compare: three comparisons (`typed`, `when`, `whensel`).
- Advanced Examples index: featured card with a trace chain, deep-dive row, four dashed “upcoming” cards.
- Control Center workspace: mode switch (Explore / Guided), source switch (Reactive CSS / Vanilla JS), Follow interactions switch, Restart; guided bar (5 steps, dots, Back / Next / Skip); preview with real `<form>`; submission preview; trace chain + history; code viewer with outline (sections + expression counts), folding, chips; expression inspector; state panel grouped by section; S / M / L layouts (pane tabs below 760 px).
- Playground: example segmented picker, editable textarea over highlighted code, sync status (`✓` / `!`), feature chips, preview, state + events, CSS / Preview / State tabs below 860 px.
- Design System: specimen code with trace button, color swatches, type scale, code token table, spacing bars, grid, radii, components, motion table.

## 5. Interactions in the design

Hover / focus / tap on a vermilion token explains it; click or Enter pins; Escape clears. Copy
buttons show `Copied` for 1.4 s. Trace runs event line → state line → dependents, 120 ms apart,
then a 500 ms fade; with reduced motion all lines mark at once. Search: ⌘K, arrows, Enter, Escape.
Docs TOC follows scroll. Mobile menus. Playground Tab key indents. Control Center: selecting
an expression outlines the preview regions it affects; Follow interactions scrolls the source to
the expression behind the last interaction and pauses while the reader scrolls.

## 6. Component candidates

See [`component-guide.md`](component-guide.md) for the final list and contracts. Summary:

- Foundations: tokens (`src/styles/tokens.css`), Logo mark.
- Primitives: Button (primary / secondary / quiet), Tag, Kbd, SegmentedControl, Tabs, Switch, Field.
- Navigation: SiteHeader, DocsBanner, DocsSidebar, Breadcrumbs, TableOfContents, PrevNext, SearchDialog, MobileMenu, SiteFooter.
- Docs: Callout, Facts, Flow, Cards, RelatedLinks, DataTable, ParamList, ApiIndexTable, ExampleList, InlineCode, SectionKicker.
- Code: CodePanel, ExplainRail, CopyButton.
- Examples: PreviewFrame, InteractiveExample, StateFoot, StateTable, EventLog, CodeComparison.
- Workspace: WorkspaceToolbar, GuidedBar, TraceChain, CodeOutline, ExpressionInspector, StatePanel, SubmissionPreview.

## 7. Design dependencies

Fonts: Instrument Sans (400–700) and Red Hat Mono (400–600), Google Fonts. Colors are OKLCH.
No icon set: the design uses text glyphs (`→ ← × ⌄ ✓ ! ▲ ▼ − +`). No images.

## 8. Missing information, conflicts and decisions

| Issue | Decision |
|---|---|
| Every preview in the design is a React simulation (“preview · simulated”), with traces derived from hand-written rules. | Previews run the real `dist/reactive-css.min.js` in a sandboxed iframe. Values and events come from an observer bridge; line positions come from static source analysis. Labels say `preview · runtime`. See [`architecture.md`](architecture.md). |
| The homepage greeting uses `set(--message, pick(…))`. Runtime 0.4.0 rejected calls as action values. | Replaced with `cycle(--message, "Hello!", "Bonjour!", "Hola!", "Ciao!")`, a stable action with literals. The button reads “Next greeting”. Same for install step 2. (0.5.0, released during the build, accepts `pick()` in `set()` as an experimental expression; the hero keeps to stable features.) |
| Wave demo “Simulate reduced motion” and pointer demo arrow keys only exist in the simulation. | Removed. The wave page says how to test with the OS setting. The pointer pad is pointer-only, as its accessibility note already said. |
| Example HTML tabs show abbreviated markup (`…`). | The HTML tab shows the complete markup that actually runs. |
| Preview visuals were inline React styles. | Each example has a `base.css` (layout and look only, no reactive syntax) next to the reactive `style.css` that is shown. |
| Control Center inspector `out()` functions compute simulated results. | The inspector shows observed values for states and custom properties the bridge can read; other expressions are labelled “static annotation”. |
| Mobile Views is a canvas of iframes. | No route; Playwright screenshots at 390 px cover the same pages. |
| The design documents runtime 0.4.0; the library became 0.5.0 during the build (`wave()` removed; `attr()`, `pick()`, `split()` expressions added). | Status and versions come from the registry. Prose was updated: the wave example shows the native replacement, `wave()` keeps a reference page with a removal note, three Expressions pages were added from the registry, the changelog renders the library's CHANGELOG.md. |
| Dark mode is “proposed” only. | Tokens are structured for it, but the site ships light only, as designed. |
| `uploads/` and `screenshots/` in the project. | Not part of any page; not imported. |

## Home page revision (2026-10-20)

Implemented from the re-imported `Home.dc.html`. Where the site deviates, and why:

- **Previews stay real.** The hero, the "Same result" strip and the capability demos run the real runtime in sandboxed frames, not the design's React state. So the strip cannot share state with the hero: it runs `greeting.css` itself, and its copy says so. Its chips and trace show in the CSS card above it.
- **Greeting markup.** The design's `index.html` puts "Hello!" in `.message` for the JavaScript version. The Reactive CSS version prints it with `::after`, so it uses an empty `.message` (`src/examples/greeting/index.html`). The JavaScript card shows `vanilla.html`, and the CSS column header reads "stylesheet + markup".
- **Like button.** The demo runs the design's `like.css` exactly, so the label stays "Like" and `aria-pressed` stays false. The accessibility note says so, and names `attr: aria-pressed` (experimental) as the fix. The design's "has to be kept in sync separately" is no longer true.
- **Status line and footer version** come from the library: `LATEST` in `engineering.ts` (0.8.0, 521 browser test results, `docs/release-0.8.0.md` §3; a unit test fails when the library is newer) and the registry. The design's "v0.5.0 · 218 browser tests" is from an older release.
- **Hero subline** keeps the QA wording, "A runtime script does the JavaScript, so you don’t write any", rather than "No JavaScript to write."
- **Section order.** 01 Before / after, 02 Examples, 03 Install, 04 Native first, as designed. The Vision teaser ("Where this fits") is 05 and Documentation is 06.
- **Footer links.** The design's Learn / Build / Project groups, plus Vision and Performance under Project.
- **Not shipped:** the test-only `heroEffect`, `heroLink` and `codeAccent` controls, and the Code card's `accent` prop.
- **The hero word** cycles via a small inline script, not a React island.

## Examples redesign (2026-10-20)

Implemented from `Examples.dc.html`; full notes in `examples-design-integration.md`. Deviations:

- **Previews are real.** Each card runs the runtime in a sandboxed frame while on screen; the design's simulated previews and its "previews on this page are simulated" footer are not used.
- **Categories follow the library:** API examples, Interfaces, Advanced, Test lab. The design's Basics / Components / Experimental groups and its levels are not shipped; experimental is a tag from the registry.
- **No accordion, no Dynamic Components or Stylesheet Lifecycle**: the library has no accordion, and the other two need a JavaScript harness the sandbox does not run.
- **"All" shows three cards** for each non-API group, as in the design, plus every API example.

## Vision v2 and Custom Bundles (2026-10-20)

- **Vision v2** replaced v1 at `/vision/`. Deviations from the design: the Reactive CSS demos run the runtime ("real runtime", not "simulated"); the native demos use native CSS (`:has()`, radios; `if()` is described, not run, as support is still arriving); the site header and footer replace the design's minimal ones; the closing note links the performance report, which exists. Details in `vision-v2-integration.md`.
- **Custom Bundles** keeps the docs shell (sidebar, breadcrumb, right-hand table of contents). Section headings are the design's short labels (for the table of contents) with its sentence below; the illustrative pattern-matching analyzer became a verified CLI example plus a link to the Bundle Builder's real analysis; filter tabs and "Expand all" were left out. Details in `custom-bundles-design-integration.md`.
