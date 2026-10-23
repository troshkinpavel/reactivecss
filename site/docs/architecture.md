# Architecture

The documentation site for Reactive CSS. It lives in `site/`, inside the library repository,
as a separate npm project. The library's `package.json` publishes only `dist` (without `dist/custom`),
`src`, `tools`, `README.md`, `CHANGELOG.md` and `docs`, so nothing in `site/` ships with it.

## Integration boundary with the library

The site never contains its own copy of the runtime, and never imports library source files.
It reads these from the library, all through `scripts/sync-runtime.mjs`, which
runs before `dev` and `build`:

| What | From | To | Used for |
|---|---|---|---|
| Browser bundle | `../dist/reactive-css.min.js` | `public/runtime/reactive-css.min.js` | Runs inside every preview |
| Feature registry | `describe()` from `../dist/index.js` | `src/generated/registry.json` | Status, versions, syntax, vocabulary for highlighting |
| Changelog | `../CHANGELOG.md` | content collection `changelog` | `/docs/changelog/` |
| Library demos | `../examples/<name>/{index.html,style.css,README.md}` (not `lab/`) | `src/generated/demos/` | `/examples/<name>/` and the score-history JavaScript comparison (`src/lib/content/demos.ts`) |
| Library API examples | `../examples/api/<name>/{index.html,style.css,README.md}` and `api.css` | `src/generated/api-examples/` | The Examples gallery and `/examples/<name>/` (`src/lib/content/catalog.ts`), Playground presets via `?example=` |
| Bundle catalog and package (0.8.0) | `../dist/catalog.json`, `../package.json`, the CHANGELOG heading, `benchmarks/audit/results/v080/bundle-sizes.json`, the library's `featureOfKey()` and `analyze()` (`../tools/bundle.mjs`) per demo | `src/generated/bundles.json` | `/bundle-builder/`, `/docs/custom-bundles/` (its feature rows, sizes and selection illustration), `/docs/installation/` (`src/lib/bundles/`). The sync stops if the catalog or the size report is not for the package's version |
| ESM build | `../dist/index.js` | `src/generated/reactive-css.esm.js` | "Analyze my CSS": the real `compile()`, loaded only on first use |

The script also writes `src/generated/runtime.json` and stops with an error when `../package.json`
and `describe()` disagree. `tests/unit/version.test.ts` then checks the bundle, the registry, the
site banner and the latest CHANGELOG entry against the same version.

Demos run unchanged. `demos.ts` splits each `style.css` at its first `/* ---- ` section comment:
the layout above it runs as the preview's base styles, the behavior below it is shown. A unit test
(`tests/unit/demos.test.ts`) fails if the layout part contains reactive syntax, so nothing
reactive is ever hidden.

Rebuild the library (`npm run build` in the repository root) to pick up runtime changes. Both
generated files are git-ignored. This boundary was tested in practice: the library moved from
0.4.0 to 0.5.0 while the site was being built (`wave()` removed, `attr()` / `pick()` / `split()`
added). The banner, status tags, sidebar and reference index followed the registry
automatically; prose that made version claims was updated by hand (see
`tests/unit/registry.test.ts`, which fails when a shipped feature has no reference page or a
removed one has no removal note).

## Stack

| Area | Choice | Notes |
|---|---|---|
| Framework | Astro 7, `output: 'static'` | Pages, layouts, MDX, routing |
| Components | React 19 | Presentational components render to static HTML at build time; only interactive ones hydrate |
| Styling | Tailwind CSS 4 | Tokens in `src/styles/tokens.css` (`@theme`), utilities in markup |
| Content | MDX + content collections | `src/content.config.ts` |
| Highlighting | Shiki 4 for HTML/JS/TS/JSON/shell, own tokenizer for CSS | See "Code" below |
| Search | Pagefind 1.5 | Built after `astro build`; not available in `astro dev` |
| Workshop | Storybook 10 (`@storybook/react-vite`) | Every React component has stories |
| Tests | Vitest 5 (unit + Storybook browser tests), Playwright 1.64 (e2e, visual), axe | |
| TypeScript | 6.0, Astro `strict` preset + `noUncheckedIndexedAccess` | `@astrojs/check` does not support TypeScript 7 yet |

### Why React components even for static parts

Storybook cannot render Astro components, and the brief asks for every meaningful component to
be inspectable in Storybook. So presentational components (callouts, tables, sidebar, header,
code panel, …) are React components. Astro renders them to HTML at build time **without**
hydration, so they cost no JavaScript. Only these hydrate:

| Island | Directive | Why |
|---|---|---|
| `InteractiveExample`, `CodeComparison`, `LiveExample` (capabilities) | `client:visible` | Previews, chips, trace |
| `LiveExample` (homepage hero), `Playground`, `ControlCenterWorkspace` | `client:load` | Above the fold, must work at once |
| `CodePanel` for CSS with reactive syntax | `client:visible` | Explanation rail |
| `SearchDialog` | `client:idle` | ⌘K anywhere |
| `BundleBuilder` | `client:load` | `/bundle-builder/` only: the page is the tool. Its compiler chunk loads on the first analysis |

Code blocks without reactive syntax stay static; their Copy button works through a small
delegated script in `BaseLayout.astro`. The mobile menus are native `popover` elements, the API
categories and the inline table of contents are native `<details>`, and the table of contents
highlight is a 15-line inline script.

## Directory map

```text
site/
├── design-source/        Claude Design files as downloaded (local only, not in the repository)
├── docs/                 This documentation, visual review, performance results
├── public/
│   ├── preview/bridge.js  Observer that runs inside each preview (site code)
│   └── runtime/           Synced library bundle (generated)
├── admin/                Local Control Center server and UI (local only, not in the repository)
├── config/               Website configuration JSON, read at build time by src/lib/config/
├── scripts/              sync-runtime, design conversion, visual review, performance, dev helpers
├── src/
│   ├── components/
│   │   ├── ui/            Primitives: Button, Tag, SegmentedControl, TabList, Switch, CopyButton …
│   │   ├── navigation/    SiteHeader, DocsSidebar, PageNav (breadcrumbs, TOC, prev/next), SearchDialog, SiteFooter
│   │   ├── docs/          Callout, Facts, Flow, Cards, tables, InlineCode, InlineMarkdown, AdvancedIndex, CustomBundles (guide parts)
│   │   ├── code/          CodePanel, CodeBlock.astro
│   │   ├── examples/      PreviewFrame, usePreviewSession, InteractiveExample, LiveExample, CodeComparison, Playground, ScoreComparison
│   │   ├── gallery/       GalleryCard, CardPreview (lazy live card preview), ExampleDetail (detail-page island)
│   │   ├── workspace/     Control Center workspace: model, SourceViewer, Panels, ControlCenterWorkspace
│   │   ├── home/          Capabilities
│   │   ├── vision/        VisionV2: EvolutionSteps and ExperimentDemo (the page's two islands)
│   │   ├── design/        Foundations views, TraceSpecimen
│   │   └── mdx/           Astro wrappers mapped into MDX (headings, code, Example, Compare, …)
│   ├── content/
│   │   ├── docs/          MDX pages, one per URL under /docs/
│   │   ├── api/           entries.json: API reference prose
│   │   ├── comparisons/   Native vs Reactive comparisons (meta.json + native source files)
│   │   ├── vanilla/       The plain JavaScript score-history, run beside the library demo on /examples/score-history/
│   │   └── workspaces/    Expression registries for the Control Center pages
│   ├── examples/          Every runnable example, one folder each, plus manifest.ts
│   ├── generated/         registry.json (generated)
│   ├── layouts/           BaseLayout, AppShell, DocsLayout
│   ├── lib/               code (highlighting), examples (analysis, protocol, srcdoc), content, design
│   ├── pages/             Routes
│   └── styles/            tokens.css, global.css
├── tests/unit, tests/e2e
└── .storybook/
```

## Code rendering

`src/lib/code/highlight.ts` is the single entry point: `highlight(code, lang)` returns lines of
tokens `{ t, k, start, feature? }`.

- **CSS** goes through `src/lib/code/css.ts`: a CSS Syntax Level 3 style tokenizer, a structural
  pass (selector, at-rule prelude, property, value, function arguments, nesting) and an annotation
  layer that tags Reactive CSS constructs with a registry key (`function:state`,
  `selector:when`, `declaration:on`, `action:set`, `trigger:click`, `expression:attr`,
  `scope:closest`). The vocabulary comes from the registry, so planned, rejected and removed
  features are never highlighted. Context rules: actions and triggers only inside `on:`,
  `element()` only with `width`/`height`, `attr()`/`pick()`/`split()` as expressions only inside
  `state()`/`set()`. Shiki is not used for CSS because its grammar does not know the syntax
  (`state(false)` becomes one token; the whole `on:` value parses as property names).
- **Other languages** use Shiki with the JavaScript regex engine and a theme whose colors are
  sentinels that map back to token kinds.

Tokens keep source offsets, so expressions are addressable for selection, hover explanations,
chips and source locations. Explanations come from `GLOSSARY` in `src/lib/content/reference.ts`,
built from the API entries. Highlighting runs at build time in Astro; CSS is also highlighted on
the client (editable playground, source controls), which is cheap.

## Example execution

```text
src/examples/<id>/style.css ─┐
src/examples/<id>/index.html ├─ buildSrcdoc() ─► <iframe sandbox="allow-scripts allow-forms" srcdoc=…>
base.css + _shared/preview.css┘                     │  real runtime + bridge, inlined under a CSP nonce
                                                    ▼
analyze(style.css) ─ watch spec ─────────► bridge.js observes: getComputedStyle, MutationObserver,
                                                    native events, form submit / invalid
                                                    │ postMessage (validated, versioned)
                                                    ▼
                           usePreviewSession: values, previous values, change counts, event log,
                           trace (trigger line → state line → reading lines), diagnostics
```

- **Isolation.** No `allow-same-origin`, so the preview has an opaque origin: no access to the
  site's DOM, cookies or storage. CSP inside the document: `default-src 'none'`, scripts only by
  nonce, `form-action 'none'`, `base-uri 'none'`. Example HTML cannot run scripts or inline
  handlers. The runtime and the bridge are fetched once from the site and inlined, because dev
  servers (Vite) reject script requests from opaque-origin frames.
- **Vanilla comparisons.** `PreviewSources.script` runs the site's own plain-JavaScript file in
  place of the runtime (same sandbox, same CSP, same bridge). The runtime is then not loaded at
  all; the score-history comparison test checks `window.ReactiveCSS` is undefined in that frame.
- **Failure states.** `PreviewFrame` shows the runtime's diagnostics under the frame (unless the
  parent shows them itself), an alert when the runtime cannot be fetched, and an alert when the
  document never reports `ready` within 8 s. A preview never silently passes for a working demo.
- **Messages.** `src/lib/examples/protocol.ts` defines every message and validates each one on
  arrival; the host also checks `event.source` against its own iframe. The host only sends
  `highlight` (selectors to outline). Nothing is forwarded.
- **What is observed and what is static.** Values, previous values, change counts, native events
  and form data are observed in the running preview. Which source line declares a state, which
  `on:`/`bind:` rule an event reached (matched with the rule's own selector, minus reactive
  pseudo-classes) and which lines read a state come from static analysis
  (`src/lib/examples/analyze.ts`). The Control Center's expression descriptions and "changes"
  regions are documentation from `src/content/workspaces/`; the inspector says "static
  annotation" where it cannot observe a value. The design's simulated `out()` values were
  dropped.
- **Off-screen frames.** Browsers pause animation frames in off-screen cross-origin frames, so the
  bridge waits for two frames *or* 120 ms, whichever comes first.
- **Not used:** no `eval`, no runtime introspection API, no change to the library.

## Examples catalog

`src/lib/content/catalog.ts` is the one list behind `/examples/`, the detail routes
(`pages/examples/[id].astro`), related and prev/next links, and the Playground's extra presets.
It is built from the synced library files (API examples, demos) and the Control Center
workspaces; nothing is written by hand. Gallery cards mount a preview frame only while on screen
(`CardPreview`), so off-screen timers and observers stop. See `examples-design-integration.md`.

## Content

- Pages: `src/content/docs/**/*.mdx`, schema in `src/content.config.ts` (title, description,
  navLabel, group, type, order, status, uses, seo). URL = `/docs/<id>/`.
- API reference: `src/content/api/entries.json` (prose) joined with the registry (status, since,
  syntax, native equivalent). URL = `/docs/reference/<id>/`. Removed features keep a page with a
  removal note but leave the navigation.
- Navigation, breadcrumbs and prev/next are derived from content metadata in
  `src/lib/content/docs.ts`.
- Fenced code in MDX becomes `<CodeBlock>` (`remark-code-blocks.mjs`); `## [1] Title` becomes a
  numbered step heading (`rehype-step-headings.mjs`).

## Search

Pagefind indexes `[data-pagefind-body]` (docs, reference, examples, playground) after the build.
`data-pagefind-meta` adds the section shown on the right of each result and marks API names as
mono. The dialog (`SearchDialog`) is a native modal `<dialog>` with a combobox and listbox,
⌘K / Ctrl+K, arrows, Enter and Escape. In `astro dev` it says the index is built by
`npm run build`.

## Design decisions that differ from the design files

See `design-inventory.md` § 8 for the full list. Summary: previews run the real runtime instead
of the simulation; examples changed only where the design's code is invalid for the runtime
(listed per example in `example-authoring.md`); `--color-mute` is 0.53 instead of 0.56 lightness
for WCAG AA contrast; body line height is `normal` as in the design (Tailwind's default is 1.5);
long inline code may wrap on phones (the design overflows horizontally at 390 px).

## Known limitations

- Firefox is not verified (the library's own Firefox runs do not start on this machine either).
- Dimmed `when()` branches are intentionally low contrast (30 % opacity, Design System · 03) and
  are excluded from the axe scan.
- Clicks inside previews cannot be driven by Storybook's synthetic test events (opaque origin);
  Playwright covers them.
- The `CodePanel` chunk includes the full API glossary (≈ 18 KB gzipped). A slimmer generated
  glossary would save about 12 KB on pages with reactive code.
- Search does not work in `astro dev`.
- The Control Center's "changes" regions and expression texts are hand-written documentation; if
  the example markup changes, update `src/lib/content/workspaces.ts` (unit tests check that every
  expression still matches a line).
