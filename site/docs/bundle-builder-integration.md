# Bundle builder, npm and CDN integration

Turns the Vision design's "Custom Bundle Builder" concept (`design-source/Vision.dc.html`, section 08) into a working configurator for the library's 0.8.0 modular runtime. It also prepares the site for npm and CDN distribution.

Everything stays local:

- **Not published or deployed:** no package publication, CDN setup, DNS change, deployment or Git operation.
- **No backend:** no service, build API or storage. The site is still a static Astro site.
- **Library untouched:** no runtime source, builder or API changed. The only library files touched are documentation: the size tables in `docs/bundle-builder-0.8.md` and `docs/release-0.8.0.md` now use the 0.8.0 measurement (see section 10).

## 1. Route and placement

| Where | What | Why |
|---|---|---|
| `/bundle-builder/` | The whole configurator: presets, features, summary, commands, analyzer, then the prebuilt distributions and links | A top-level tool page, like `/playground/`. The site has no `/tools/` section, and one page for one tool needs none |
| `/vision/#bundle` | A preview: the profiles with their measured sizes, and "Open the bundle builder" | The concept label is gone, and the builder is not embedded a second time |
| `/` (install section) | One sentence linking to the builder and to Installation | No redesign; the headline is unchanged |
| `/docs/installation/` | Rewritten head: choosing a distribution, npm, CDN, production advice | One place for "how to get it" |
| `/docs/custom-bundles/` (new, Start group, `new` tag) | Reference: features, dependencies, CLI and API, missing-feature diagnostics, analyzer and its limits, size method, self-hosting | Detailed reference without repeating the builder page |
| `/docs/getting-started/` | One paragraph in step 1: the tutorial uses the standard bundle; links to Installation and the builder | |
| Footer, "Build" group | "Bundle builder" | |

Content is not duplicated:

- Installation says **where to get** each distribution.
- Custom bundles says **how building works**.
- The builder page **does it**.
- Vision **shows that it exists**.

## 2. Design reuse

- **From the design:** the warm paper background and hairlines; vermilion for requirements and the `experimental` tag; mono labels; a capability list with native checkboxes, one row per feature with its syntax line and requirement line; a compact size table; copyable code; an "Analyze my CSS" panel in a dashed box. The section heading "Ship only the parts you use." stays on Vision; the page heading is the brief's "Build only what you need."
- **Reused site components:** `SiteHeader`, `SiteFooter`, `SearchDialog`, `Tag` (experimental), `CopyButton` (and its accessible "Copied" feedback), `SegmentedControl` (format), `ButtonLink`, `CodeBlock`, `Callout`, `DataTable`, the tokens.
- **New:**
  - `src/components/builder/BundleBuilder.tsx`: one island, with `PresetPicker`, `FeatureSelector`, `BundleSummary`, `ConfigOutput` and `AnalyzerPanel` exported for Storybook.
  - `src/components/mdx/Bundles.astro`: static tables and code for the docs.
  - `BundlePreview`, which replaces `BundleConcept` on Vision.
- **Dropped from the design:**
  - per-module "≈ kB" sizes and the "Estimated breakdown" bar: they would be invented numbers (section 10);
  - the `reactive-css.config.js` file: the CLI has no config file, so the page generates the CLI command and an API script instead;
  - the regex "pattern match": the analyzer uses the real compiler (section 6).

## 3. Feature catalog

There is no second list of features. `scripts/sync-runtime.mjs` writes `src/generated/bundles.json` from the library:

| Data | Source |
|---|---|
| Features, categories, `requires`, `optional`, status, `provides`, syntax summaries, profiles | `../dist/catalog.json` (the builder's own catalog) |
| Which API reference pages belong to a feature | The library's `keyOfApiEntry()` and `featureOfKey()` applied to `describe()`; the page joins them with `src/content/api/entries.json` at build time |
| Measured sizes | `benchmarks/audit/results/v080/bundle-sizes.json`. The sync stops if it was measured for another version |
| Which library demos run on which features | The library's `analyze()` on each demo folder: the same analysis the library's `RCSS_CUSTOM=1` suite builds and runs every demo with |
| Package name, version, `bin`, `exports`, `files`, peer dependencies, CDN fields | `../package.json` |
| Published or not | The CHANGELOG's latest heading ("(local, unpublished)"), the only publication record the project keeps |

Each feature row shows its title, ID, category, `experimental` tag, syntax, requirements, optional companions and reference links. There are no prose descriptions, because the catalog has none: the syntax line is the description.

## 4. Dependency resolution

`resolve()` in `../tools/bundle.mjs` imports esbuild and `node:fs`, so it cannot run in a page. `src/lib/bundles/catalog.ts` ports it in 25 lines over the generated catalog: recursive `requires`, catalog order, `added` with `requiredBy`, `optionalMissing`, unknown IDs rejected.

`tests/unit/bundles.test.ts` compares it with the library's resolver:

- on **all 2,048 possible selections**;
- on unordered and duplicated selections;
- on every profile;
- on error codes;
- on the key→feature mapping for every registry entry.

In the UI:

- **Core:** checked and disabled ("Always included…").
- **A required feature:** checked and disabled, with "Included automatically: required by Declarative focus." in red-orange text, linked as the checkbox's description.
- **Unselecting:** removing the feature that required it releases the requirement.
- **Optional companions** are named and never added.
- **No exclusion:** the UI offers none, so it never implies that a required feature can be removed.

## 5. Presets

The five buttons are the library's real profiles:

| Button | Profile | Features |
|---|---|---|
| Basic interactions | `basic` | events |
| Forms | `forms` | events, forms, text, attributes |
| Stateful interfaces | `stateful-ui` | events, conditions, history, attributes, focus |
| Dynamic values | `dynamic` | values, dynamic, geometry |
| Full runtime | `full` | every feature |

How presets behave:

- **Pressed state:** a preset shows as pressed while the selection equals it exactly. Changing one feature releases it.
- **Command:** an exact profile builds with `--profile <name>`, anything else with `--features`.
- **Examples:** "Library demos that need only these features" links to every demo the library's analyzer places within the selection. For `forms`, that is only `accessible-toggle`: every other demo also uses `when()`.
- **Sharing:** the selection is kept in the URL (`?profile=forms`, `?features=text,focus`). Unknown names in a shared link are reported in an alert and ignored.

## 6. CSS analyzer

The analyzer runs in the page, with the library's real compiler:

- **How:** `src/lib/bundles/analyzer.ts` loads the library's ESM build (`compile()`, copied by sync) with a dynamic `import()` on the first click.
- **What it reports:** the compiler records the syntax keys a stylesheet used (`CompiledSheet.uses`). The page maps them to features, resolves requirements, and lists the compiler's diagnostics (unknown actions, invalid arguments) and notes (`@import` not followed, unknown syntax, compile error).
- **Output:** a recommended selection with "Use these features", or, when incomplete, "Use the full runtime".
- **Privacy:** nothing is sent anywhere.
- **Parity:** `tests/unit/bundles.test.ts` checks it against the library's `analyze()` on all 22 library demo stylesheets and five edge cases (nested calls in `@layer`/`@media`, look-alikes in strings and comments, `@import`, plain CSS, invalid CSS). The fields compared are uses, features, added features, completeness and diagnostics.
- **Cost:** 37.6 KB gzipped, only on the builder page and only once used (section 14). There is no esbuild and no Node polyfill: the compiler is the library's plain ESM build.
- **Limits, stated under the panel:**
  - only the pasted text is analyzed;
  - sheets loaded or created at runtime, inline styles and sheets that were not pasted are not seen;
  - a missing feature then shows in `ReactiveCSS.diagnostics`;
  - when unsure, use the full runtime.

## 7. Generated configuration

The page outputs four blocks. Each has its own Copy button, which turns to "Copied" in an `aria-live` region:

1. **Install:**
   - while unpublished: `npm install && npm run build && npm pack` in a library checkout, then `npm install --save-dev path/to/reactive-css-0.8.0.tgz esbuild`;
   - once published: `npm install --save-dev <name>@<version> esbuild`.
2. **Build:** `npx reactive-css build --features … | --profile … --out <file> [--format esm] [--no-minify]`. The arguments are the CLI's own. An empty selection builds `--features core`, because the CLI rejects an empty `--features`.
3. **Load it:** the iife bundle's `<script src="…" defer>`, where `public/x.js` is served as `/x.js`. For an ESM bundle, the `import { start } …` lines instead.
4. **The same build through the API**, collapsed: a `build-reactive-css.mjs` script using `reactive-css/bundle`.

The output path is validated as a relative `.js` path of shell-safe characters:

- an invalid path is marked `aria-invalid` on its field, and its message is that field's description;
- the commands keep the last valid path.

Nothing claims a build happened: the summary says "Not built yet: the page generates the command, the CLI builds".

## 8. npm

Checked against `../package.json` and an `npm pack` of the library, installed offline from the npm cache into a scratch project with the exact documented command. `npx reactive-css build …` then built a bundle.

| Item | Value |
|---|---|
| Name / version | `reactive-css` 0.8.0, MIT |
| Exports | `.` (ESM API, types), `./auto` (standard bundle), `./bundle` (`tools/bundle.mjs`), `./catalog.json` |
| CLI | `reactive-css` → `tools/reactive-css.mjs` |
| Files | `dist` (not `dist/custom`), `src`, `tools`, README, CHANGELOG, docs |
| esbuild | Optional peer dependency (`>=0.28`). The docs say to install it explicitly, and only for building. npm on this machine also held back esbuild's install script until approved, and the CLI still worked; the docs say so |
| CDN fields | `unpkg` and `jsdelivr` → `./dist/reactive-css.min.js` |

Documented on `/docs/installation/#npm`:

- the standard and compact files (copied from `node_modules/…/dist/`);
- the four imports;
- when esbuild is needed;
- the local-pack install while unpublished.

The package table and the install command are rendered from the data, not typed in.

**Name conflict, unchanged from before:** the npm name `reactive-css` belongs to an unrelated package. The docs say the final name is chosen before publication and that the URLs change with it.

## 9. CDN

- **Provider:** jsDelivr preferred, unpkg as the alternative, both version-pinned and built from `package.json`, for example `https://cdn.jsdelivr.net/npm/reactive-css@0.8.0/dist/reactive-css.min.js`. The path `dist/reactive-css.min.js` is checked in the packed archive.
- **While `published` is false:**
  - the URLs are shown in code blocks under an "Illustrative until published" callout;
  - they are never links (e2e-tested);
  - the builder page shows "not published yet".
- **Production advice:** pin an exact version, never `latest` or ranges, rely on version-pinned caching, upgrade deliberately, self-host as the alternative.
- **SRI:** no hashes are given, because there is no published file to compute them from.
- **What exists:** no custom CDN and no `cdn.reactive-css.dev` (section 16).

Distribution strategy as the site now states it:

- **Standard full bundle:** npm, then CDN after publication; recommended to start.
- **Compact bundle:** the same full runtime with a shorter `describe()` registry. It is explicitly not a feature selection.
- **Custom bundle:** built locally with the CLI and self-hosted.
- **Not distributed:** prebuilt profiles and online builds. The site promises neither.

## 10. Bundle sizes

The library report was measured before the 0.8.0 version bump, so it said `0.7.1`. I re-ran `node benchmarks/bundle-sizes.mjs` at 0.8.0:

- **Minified sizes:** unchanged.
- **gzip and brotli:** moved by 1–39 bytes, because the version string compresses differently.
- **Library docs:** the tables in `docs/bundle-builder-0.8.md` and `docs/release-0.8.0.md`, and the CLI example in the former, now use the 0.8.0 numbers.

The brief's reference values all match:

| Bundle | Minified |
|---|---:|
| Core | 41,876 |
| Basic | 53,209 |
| Full custom | 98,605 |
| Standard full | 116,319 |

How sizes are presented:

- **Exact sizes only for measured bundles:**
  - the core alone, the five profiles and the two prebuilt bundles;
  - minified, gzip and brotli each compared with `reactive-css.min.js` in the same metric, as the byte difference and percent.
- **Any other combination:** "Exact size available after building", with no estimate and no sum. The per-feature table on `/docs/custom-bundles/` says it does not add up.
- **Re-measured in a test:** `tests/unit/bundles.test.ts` rebuilds every measured custom bundle with the library's `build()` and compares all three numbers. It measures `../dist/reactive-css{,.compact}.min.js` the same way. Any drift fails the test.

## 11. Responsive and accessibility

- **No horizontal overflow** on `/bundle-builder/` at 320, 375, 390, 768, 1024 and 1440 px, with the longest selection. The new pages are also in the site-wide 390 px overflow check.
- **Layout:** features beside the summary, commands and analyzer from 1024 px; one column below.
- **Long commands** scroll inside a focusable `<pre tabindex="0">` with a label, and can be copied.
- **Native controls only:** checkboxes, text input, textarea and buttons.
- **Labels and descriptions:**
  - each checkbox's label is just the feature name;
  - its syntax, requirement and "required by" text is the checkbox's accessible description (`aria-describedby`);
  - `experimental` is a word, not a color.
- **Keyboard, checked in Chromium:**
  - presets, then Reset, then each feature, each followed by its reference links;
  - the disabled core is skipped;
  - Space toggles;
  - WebKit's Tab skips buttons and links unless the macOS setting is on, so that order is tested in Chromium only.
- **Feedback and errors:** copy feedback is `aria-live`; errors are `role="alert"`; analyzer results are `aria-live="polite"`.
- **Motion:** none is added; global reduced-motion rules apply.
- **axe:** no serious or critical violations on `/bundle-builder/`, `/docs/custom-bundles/` and `/docs/installation/`.
- **Not done:** screen-reader testing.

## 12. Test results

| Suite | Result |
|---|---|
| `astro check` | 0 errors |
| Unit (`npm test`) | 190 passed (120 before; this pass added 58, a concurrent site session added more). New: `bundles.test.ts`, 57 tests. The compile test also covers the new MDX pages |
| Storybook interaction tests | 91 passed (81 before): 9 builder stories plus the Vision preview story |
| E2E, Chromium + WebKit (`npm run verify`) | 215 passed, 39 skipped (visual tests are Chromium-only), 0 failed. A first run had 6 failures while a concurrent session was mid-edit on the Vision engineering figures; the re-run after it finished is clean |
| Visual (Chromium) | 36 passed (4 new `bundle-builder-*` baselines) |
| Production build + Pagefind | 122 pages indexed (including the concurrent session's new demo pages); search finds `/bundle-builder/`, `/docs/custom-bundles/` and `/docs/installation/` (e2e) |

Visual baselines updated after inspecting each diff, cropped to the changed band:

- **`home-*`:** the new sentence in the install section, and "Bundle builder" in the footer.
- **`getting-started-*`:** the new paragraph and the "Custom bundles" sidebar entry. The old baseline was already stale: it still showed the v0.5.0 banner and no Vision link.
- **`vision-*`:** the TOC label "Bundle builder", and the preview replacing the concept, which is shorter.

The new `bundle-builder-*` baselines were reviewed at 1440 and 390 px.

New end-to-end specs:

- **`tests/e2e/bundle-builder.spec.ts`:**
  - navigation from five places;
  - selection, requirement locking and reset;
  - presets with measured sizes and matching demos;
  - shared links with unknown names;
  - output path, format and copy (clipboard read back in Chromium);
  - the analyzer: lazy load, apply, incomplete → full;
  - keyboard;
  - the island and compiler absent from other pages;
  - unpublished CDN URLs never linked;
  - six widths.
- **`tests/e2e/vision.spec.ts`:** now asserts that the concept label is gone and that the link goes to the builder.

## 13. Integration with the real CLI

`tests/e2e/bundle-cli.spec.ts` runs in both browsers.

The scratch project: the library is linked as `node_modules/reactive-css`, with `node_modules/.bin/reactive-css` and esbuild, as an installed package would be. For each case, the test:

1. selects features in the page;
2. reads the generated command, script and snippet from the DOM;
3. runs the command **as text** with the CLI;
4. checks the printed feature list and the manifest against the page's "Included";
5. runs the generated API script and checks it produces **byte-identical** output;
6. loads the bundle with **the generated script tag** on a page served under a strict CSP;
7. checks `describe().bundle` and a real interaction.

| Case | Interaction verified |
|---|---|
| Profile `basic` | Two clicks → state 2 → width 20px |
| Focus + text (events added automatically) | Click → `text:` shows 1, and `focus:` moves focus to the heading |
| Nothing selected (core only, `--features core`) | `state()` initial value applies; `on:` reports "not included … (feature "events")" |
| Analyzer on the `accessible-tabs` demo's stylesheet → "Use these features" | The library demo, unchanged, runs: selecting a tab sets `aria-selected` |

The same spec runs the build command shown in `/docs/custom-bundles/` and checks that the CLI prints exactly the output block shown there.

Result: 10/10 (5 × Chromium + WebKit).

## 14. Performance impact

Measured with `scripts/measure-builder.mjs` (median of 7 loads, headless Chromium, production build; `docs/bundle-builder-performance.json`) and `scripts/measure-performance.mjs` (`docs/performance-results.json`).

| Metric | Result |
|---|---|
| `/bundle-builder/` JS before interaction, gzipped | 80.5 KB (homepage 105.5, Vision 107.3), with 2 islands (builder, search) |
| Analyzer chunk, loaded on first "Analyze" | 37.6 KB gzipped |
| Checkbox click → command updated | 6.9 ms, including a frame |
| First analysis of the `accessible-tabs` stylesheet, compiler load included | 15.6 ms (14.5 ms after) |
| Catalog data in the island | 16.6 KB raw, 3.0 KB gzipped |
| CLS | 0.012 on load; 0.015 when a shared `?profile=` link restores a selection after hydration |
| Other pages | Unchanged: the builder island and the compiler are requested on no other page (e2e). `/docs/custom-bundles/` ships no builder code |

## 15. Known limitations

- **Sizes:** only bundles the library measured show a size. Other combinations show their size only once built.
- **Analyzer scope:** the analyzer on the page sees one pasted text. The CLI's `analyze` reads files, HTML pages and folders, and reports remote sheets and scripts.
- **No downloads or online builds:** the page generates commands only.
- **Not published:** npm and CDN instructions are prepared. The CDN URLs are illustrative, and the package name may change.
- **Engineering figures:** the homepage and Vision engineering figures are still the 0.7.0 report's latency and memory measurements. 0.8.0 did not re-measure them, and the site names their source.
- **Mobile layout:** on a phone the feature list comes before the summary and commands, so they are a long scroll away.
- **Firefox and screen readers:** unverified.

## 16. Future: building on the website

The options were evaluated on paper only; none is implemented.

| Option | Assessment |
|---|---|
| Browser-side build (esbuild-wasm in a worker) | No server needed, and the input never leaves the page. Costs several megabytes of wasm, loaded on demand, plus the library source in the page. Deterministic, since the CLI's output depends only on the selection and version. The most likely first step |
| Build API | A small function that runs `build()` and returns the file. Needs abuse protection: rate limits, a fixed input space, and no user code. Since the input is only a selection, every possible bundle is one of 2,048 per version |
| Precomputed bundles | 2,048 builds per version, format and minify setting (minutes, at the CLI's speed) could be generated at release time and served statically, keyed by the configuration hash. This needs no server logic: storage and a CDN only |
| Caching | Key: package version plus the sorted feature IDs plus format and minify. Bundles are byte-identical for equal keys (library-tested), so caching is safe forever per version |
| Artifact storage and CDN | Any static host or npm-backed CDN. Publishing prebuilt profiles in the package (`dist/profiles/…`) would make the common ones available at jsDelivr URLs with no new infrastructure |
| `cdn.reactive-css.dev` | A custom domain in front of an established CDN (for example jsDelivr or a static host), configured after publication. Not needed for the first release |
