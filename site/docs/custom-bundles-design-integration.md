# Custom Bundles design integration

`/docs/custom-bundles/` now follows `Custom Bundles.dc.html`, inside the existing docs shell.
- **Presentation** comes from the design.
- **Technical content** comes from the 0.8.0 library: the catalog, the size report, the CLI and
  the runtime.

Where the design held a placeholder (marked «…») or an assumption, the library's real value
replaced it. Nothing outside `site/` was changed. No runtime source, no library API, no second
builder, no Git, no publishing.

## 1. Imported design

- **Source.** `design-source/Custom Bundles.dc.html`, read from the same Claude Design project with
  the design MCP.
- **Reference screenshots.** `design-source/reference/custom-bundles-{1440,390}.png`.
- **Design sections:** overview, how it works, quick start, feature selection, features and
  dependencies, missing feature, analyzer, bundle sizes, advanced configuration, hosting, FAQ and
  next steps.

## 2. Implemented sections

All of them, in the design's order. Each `h2` is the design's short label, so the right-hand and
inline tables of contents stay scannable. The design's sentence follows it as a lead line (`Lead`).

| Section | Built with |
|---|---|
| Overview | `BundleIntro`: the two ways (analyze, select), "Open Bundle Builder →" and "Quick start ↓", the release facts, and the "start with the standard bundle" note |
| How it works | `Flow` (existing), four steps; a real `styles.css` and the analyzer's real output |
| Quick start | `QuickStart` / `QuickStep`: numbered steps; the path switch "Analyze my CSS / Choose features" is native radios, so both versions of step 2 are in the page and CSS shows the chosen one |
| Feature selection | `SelectionResolver` (the page's one island, `client:visible`) |
| Features and dependencies | `FeatureList`: one native `<details>` per catalog feature; the full table (`<Bundles part="catalog" />`) in a `Disclosure` |
| Missing feature | `Flow` (three cells), the real diagnostic, the fix command |
| Analyzer | Real CLI input and output, including an incomplete analysis; the caution `Callout`; the link to the Bundle Builder's real in-page analysis |
| Bundle sizes | `SizeBars` (minified, gzip and brotli switch, native radios); the report's tables in a `Disclosure` |
| Advanced configuration | Five `Disclosure`s: CLI, Node API, dependency resolution, manifest, security and determinism |
| Hosting | `Facts` (npm, CDN, custom bundle), the script tag, rebuild rules, a link to Installation |
| FAQ | `Faq` / `FaqItem` (`dl`) |
| Next steps | `Cards` (existing) |

## 3. Reused components

- The docs shell (`DocsLayout`): sidebar, breadcrumb "Docs / Start" (ancestors only), header and
  tags, inline and right-hand table of contents, previous and next, search indexing, heading
  anchors and mobile navigation.
- Fenced code (`CodeBlock`, with Copy).
- `Bundles` (catalog, sizes, overhead and install, all rendered from `src/generated/bundles.json`).
- `Flow`, `Facts`, `Cards`, `Callout` and `CopyButton`.
- `resolve()` and `buildCommand()` from `src/lib/bundles/`, the same code the Bundle Builder uses.

The new parts are in `src/components/docs/CustomBundles.tsx`. Their stories are in
`CustomBundles.stories.tsx`: Intro, QuickStartSteps, Resolver, Features, Sizes, ReferenceBlocks
and Narrow, with play tests.

## 4. Placeholders replaced, and design facts corrected

| Design | On the site (source) |
|---|---|
| «install command from the Installation guide» | `installCommand()`: 0.8.0 is unpublished, so the local `npm pack` install (`package.json` `published: false`) |
| Feature groups Interaction / Logic / Output / Values | Not used: the catalog has its own categories, shown per feature. The filter tabs were left out (12 rows) |
| Descriptions and syntax «from catalog», «confirm» | Each feature's catalog `title`, `syntax`, `requires`, `optional`, `status` and `category` |
| Status «from catalog» | `stable` or `experimental` from the catalog; experimental features are tagged |
| Requirements «catalog» | `requires` from the catalog; only `focus` requires another feature (`events`) and lists `forms` as optional |
| Benchmark gzip and brotli «report» | `sizes.measured` (`benchmarks/audit/results/v080/bundle-sizes.json`, `docs/release-0.8.0.md` §4) |
| Per-feature overhead «table from the report» | `sizes.overhead`, the same report |
| Manifest «example from a real build» | The manifest the CLI wrote for `--features events,conditions,focus`, without its `provides` and `modules` lists (said on the page) |
| CDN «URL after publication» | No URL: "There is no working CDN URL yet". The Installation page shows the planned URLs as text, never as links |
| FAQ «compact: confirm its contents» | Compact is the same full runtime with a shorter `describe()` registry; it is not a feature selection (README, Installation) |
| Illustrative analyzer textarea ("pattern match, not the real compiler") | Replaced by verified CLI input and output, and the link to the Bundle Builder, which runs the real compiler on pasted CSS. A regex imitation would have taught wrong results |
| Diagnostic text | The entry the bundle really reports, with its source prefix (`inline <style> #1: …`) |
| `--exclude` | Corrected from my first draft: it names features that must never be included; a requirement on one, or a feature both requested and excluded, is a `conflict` (exit 1) |
| "Open Bundle Builder" → `Vision.dc.html#bundle` | `/bundle-builder/`, the real builder |

## 5. CLI verification

The library was packed (`npm pack`) and installed from the tarball into a temporary project, as a
user would install it before publication. esbuild came from the library's own `node_modules`, with
no network. Then every documented command ran with `npx reactive-css`:

- **Commands:** `features`, `resolve --features focus`, `resolve --profile basic`,
  `build --features events,conditions,focus`, `build --profile basic` (53,209 B, as in the report),
  `build --features core`, `build --format esm` (it exports `start`), `analyze` (a folder, a file,
  an `@import`, and `--build`), the typo error and the `--exclude` conflict.
- **Node API:** the `build()` script, which wrote a byte-identical bundle.
- **In Chromium:** the built bundle ran. The events and conditions in the stylesheet worked,
  `text:` was left unchanged, and `ReactiveCSS.diagnostics` held the documented entry.

The temporary project lives under the session scratchpad. No project benchmarks or artifacts were
touched.

The same check now runs on every test run (`tests/e2e/bundle-cli.spec.ts`):

1. It reads every fenced block of the MDX.
2. It writes the stylesheets the guide shows to a scratch project (the library linked as an
   installed package).
3. It runs each command shown with an output and requires exactly that output (absolute paths
   normalised to `…/`).
4. It runs every other command shown and requires exit 0.
5. It compares the shown manifest with the written one, and runs the Node script and compares
   bytes.
6. A second test loads the bundle in the browser and compares `ReactiveCSS.diagnostics` with the
   guide.

## 6. Bundle Builder integration

`/bundle-builder/` is linked from:
- the hero (Open Bundle Builder);
- the features introduction;
- the selection illustration (Configure a real bundle);
- the analyzer (paste your CSS);
- the CLI reference (it writes these commands);
- the next-steps cards.

The guide does not embed a builder. The selection illustration resolves with the library's catalog
and writes the real command. It says "illustration · the library's catalog, nothing is built", and
it loads neither the compiler nor esbuild (`bundle-builder.spec.ts` checks that no builder or
compiler script loads on this page).

## 7. Responsive behavior

- **Desktop.** At 1440 px the docs shell shows the sidebar, the content and the right-hand table
  of contents.
- **Phones.**
  - The sidebar is behind Menu and the table of contents is inline.
  - The intro buttons go full width.
  - Feature rows drop their requirement column.
  - Size bars move under their labels.
- **Code.** Long commands and outputs scroll inside their block.
- **Checks.** There is no page-level overflow at 320, 375, 390, 768, 1024 and 1440 px
  (`custom-bundles.spec.ts`). I compared screenshots with the design at 1440 and 390 px.

## 8. Accessibility

- **Native semantics.** The path switch and the size metric are native radio groups in a
  `fieldset` with a `legend` and a visible focus ring. Feature rows and advanced blocks are native
  `<details>`/`<summary>`, and the FAQ is a `dl`. No custom ARIA replaces native behavior.
- **Selection illustration.** The feature buttons use `aria-pressed`; the selected and required
  lists are `aria-live`; the generated command is focusable for scrolling.
- **Copy buttons.** Each one announces "Copied" through `aria-live` (`CopyButton`).
- **axe.** The axe scan in `site.spec.ts` covers this page and finds no serious or critical issues.
- **Screen readers.** No screen-reader testing was performed.

## 9. Performance

- **Measured** with the production build at 1440 px, after scrolling: HTML 242 KB (the catalog,
  the tables and the highlighted code are static), JavaScript 345 KB uncompressed. Most of that is
  shared with other docs pages (React, code panels, search). Four islands.
- **Layout shift.** CLS is 0.079. It occurs at about 300 ms, when the web fonts replace the
  fallback in the text-heavy intro (the Installation page shows the same effect at 0.005). It is
  under 0.1, but it is a candidate for font metric overrides.
- **No bundler in the browser.** The selection illustration imports the catalog data, not the
  compiler or esbuild.

## 10. Tests

- **`tests/e2e/custom-bundles.spec.ts`** (new), in Chromium and WebKit. It checks:
  - the docs shell: breadcrumb, header, release version, section order, no CDN links;
  - five or more Builder links, and that the hero link reaches `/bundle-builder/`;
  - the path switch;
  - copying a command (Chromium);
  - the selection illustration against the catalog;
  - feature rows equal to the catalog (ids, requirements, status, reference links);
  - sizes equal to the report, with the metric switch;
  - the analyzer's limits and the diagnostic;
  - search for "custom bundles", "modular runtime", "css analyzer", "feature dependencies" and
    "cli build";
  - no overflow at six widths.
- **`tests/e2e/bundle-cli.spec.ts`** gained the two guide tests of § 5.
- **Storybook.** 7 new stories.
- **Unchanged checks.** The api-coverage unit test still finds `<Bundles part="catalog" />` and the
  four commands.
- **Full suite.** Typecheck, unit (261), Storybook (99) and Playwright (341 passed, 41 skipped).

## 11. Known limitations

- **Interactions left out.** The design's filter tabs, its "Expand all" button and its tabbed
  pipeline were not built. The rows and the advanced blocks are native disclosures, and the
  pipeline is a static four-step flow with a real example below it.
- **Sizes.** Only the report's builds have exact sizes. The page says so, and it never sums the
  per-feature numbers.
- **Publication.** Until the package is published, `npx reactive-css` works only after the local
  `npm pack` install. The install step says so.
