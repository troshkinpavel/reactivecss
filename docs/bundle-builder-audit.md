# Bundle Builder audit and experiment lab (0.8.0)

**Date:** 2026-10-21. Follow-up: the runtime and analyzer defects in § 5 and § 11 were investigated in [prebeta-runtime-stabilization.md](prebeta-runtime-stabilization.md); the sizes below are from before those fixes. **Scope:**
- the Bundle Builder page (`site/src/pages/bundle-builder.astro`, `/docs/custom-bundles/`);
- the library's bundle tooling (`tools/bundle.mjs`, `tools/reactive-css.mjs`);
- six internal experiments in `experiments/` (gitignored, local only).

The runtime source did not change. The public version stays 0.8.0, local and unpublished.

## 1. Architecture

| Layer | File | Role |
|---|---|---|
| Catalog | `src/features/catalog.ts` → `dist/catalog.json` | 12 features, their modules, `requires`, `optional`, and 5 profiles |
| Library API | `tools/bundle.mjs` | `catalog()`, `resolve()`, `analyze()`, `build()` (esbuild), `sizes()` |
| CLI | `tools/reactive-css.mjs` | `features`, `resolve`, `build`, `analyze`; `--json`; exit codes 0/1/2 |
| Site data | `site/scripts/sync-runtime.mjs` → `site/src/generated/bundles.json` | catalog, package metadata, the library's measured sizes, demo feature lists |
| Site resolver | `site/src/lib/bundles/catalog.ts` | `resolve()` ported from `tools/bundle.mjs` (that file imports esbuild and `node:fs`, so it cannot run in a page) |
| Site analyzer | `site/src/lib/bundles/analyzer.ts` | runs the library's real compiler (ESM build) in the page and maps `CompiledSheet.uses` to features |
| Commands | `site/src/lib/bundles/command.ts` | CLI command, API script, HTML/ESM snippet, output-path validation |
| UI | `site/src/components/builder/BundleBuilder.tsx` | presets, feature selector, summary, sizes, output, analyzer panel |

**The site does not resolve dependencies on its own terms.** Its resolver is a port, kept equal to
the library's: `tests/unit/bundles.test.ts` compares the two on all 2,048 subsets of the 11
optional features. No new resolver was added in this audit.

**Sizes come from measurement only.** The page shows exact bytes only for a selection equal to a
measured configuration: core, the five profiles and the two dist bundles. For any other selection
it shows a range between measured neighbours, labelled as an estimate. This audit re-measured every
configuration the page shows exactly (§ 6).

## 2. Features and presets tested

| What | How | Result |
|---|---|---|
| Each of the 12 features alone (with its requirements) | `bundle-builder.spec.ts` "each feature alone": UI resolution vs `tools.resolve()` | equal for all 12 |
| Each feature alone, built | `build()` through the CLI; checks for `describe().bundle` | 12 builds, each runs |
| Profiles basic, forms, stateful-ui, dynamic, full | `bundle-cli.spec.ts`: the page's command → the real CLI → the bundle in Chromium and WebKit, with a profile-specific rule | all 5 work; a feature outside the profile reports "is not included in this bundle" |
| Preset buttons | `aria-pressed` follows the selection; a manual change that equals a profile highlights it | correct |
| Reset | returns to core only | correct |
| URL state `?features=` | unknown ids reported, the rest kept | correct |

## 3. Resolver results

- **Parity:** the site's resolver equals `tools/bundle.mjs` `resolve()` on all 2,048 subsets, both
  for `features` and for `added`/`optionalMissing` (unit test).
- **Requirements:** `focus` adds `events`. Every other feature needs only `core`. Locked rows say
  "Included automatically: required by Focus & Accessibility".
- **Optional:** `focus` lists `forms` as useful. The summary shows "Optional, not included" and
  never adds it.
- **Errors:** an unknown feature or profile is an error (CLI exit 1); the page shows it and keeps
  the rest of the selection.
- **Order:** core first, then catalog order, as the CLI prints it.

## 4. CLI verification

Every command the page or the guide shows is executed by `site/tests/e2e/bundle-cli.spec.ts`
with the real CLI, and its output runs in a browser.

| Output | Checked |
|---|---|
| Script tag (IIFE, minified) | `<script src defer>` snippet loads; `ReactiveCSS` starts itself |
| ESM (`--format esm`) | `export {` present; the page's module snippet imports and calls `start()` |
| Development build (`--no-minify`) | not named `.min.js`; > 500 lines; logs warnings; runs |
| API script (`build-reactive-css.mjs`) | runs with Node; same manifest as the CLI |
| Output paths | absolute paths, `..`, spaces and non-`.js` names are refused, and the last valid command stays; `assets/js/rcss.min.js` builds there |
| Manifest | written next to the bundle; features and sizes equal the CLI output |
| Exit codes | 0 success, 1 invalid input, 2 internal error or missing esbuild. An incomplete analysis is not an error: it exits 0 and recommends (or, with `--build`, builds) the full runtime. |

## 5. Analyzer results

The page analyzer and the library's `analyze()` give the same features for:
- every library demo stylesheet;
- fixtures for CSS nesting, a single rule, two stylesheets, a script-generated stylesheet and empty
  input.

Findings:

| # | Finding | Severity | Status |
|---|---|---|---|
| A-1 | The CLI cannot follow a root-absolute `<link href="/x.css">`: it has no web root, so it reports `missing-file`, marks the analysis incomplete and recommends the full runtime. `--assume-complete` covers only `scripts-present`. Found by the experiments. | P2 (safe: it falls back to full) | Fixed 2026-10-21: `--root <dir>` (`root` option) resolves root-relative links; without it the note `root-relative-link` says why the analysis is incomplete. See `prebeta-runtime-stabilization.md`. |
| A-2 | Empty input: the page reports "incomplete" (nothing to analyze); the library reports complete with no features. | P3 | Intentional; documented in the unit test. |
| A-3 | `@import` is not followed in either; both say so. | — | As designed. |
| A-4 | A page with any other `<script>` is incomplete unless `--assume-complete` is given. The experiments load a harness script, so they use the flag. | — | As designed. |

## 6. Size methodology

- **Source:** `node benchmarks/bundle-sizes.mjs` in the library builds each configuration with
  esbuild (minified IIFE). It measures raw bytes, gzip (level 9) and brotli (quality 11) with
  `sizes()` in `tools/bundle.mjs`, and writes `benchmarks/audit/results/v080/bundle-sizes.json`.
  `sync-runtime.mjs` copies the report into the site, and refuses one measured for another version.
  The site never computes a size itself.
- **Re-measured in this audit:** each configuration was rebuilt with `reactive-css build` and
  measured. The result is byte-identical to `bundles.json`:

  | Configuration | Minified | gzip | brotli |
  |---|---:|---:|---:|
  | core | 41,876 | 15,532 | 14,092 |
  | basic | 53,209 | 18,846 | 17,067 |
  | forms | 71,731 | 24,610 | 21,991 |
  | stateful-ui | 74,901 | 25,862 | 23,037 |
  | dynamic | 54,543 | 19,834 | 17,962 |
  | full (12 features, custom build) | 98,605 | 33,455 | 29,635 |
  | `dist/reactive-css.min.js` | 116,319 | 39,136 | 34,379 |
  | `dist/reactive-css.compact.min.js` | 100,133 | 33,787 | 29,869 |

  The custom full build is smaller than the dist bundle because the dist bundle also carries the
  feature registry for `describe()`.
- **Arbitrary selections:** the page shows a range between measured neighbours, marked as an
  estimate, and never an exact byte count. The CLI prints the exact size after a real build.
- **Experiment bundles:** measured from the built file by `experiments/tools/build-bundles.mjs`,
  with the same method (§ 13).

## 7. Demo compatibility

"Compatible demos" lists the published demos whose `features` are all included.

- **Bug fixed (B-1):** `dynamic-components` was listed but has no page; its link was a 404. The list
  now uses only the 18 published demos (`DEMO_ORDER`, moved to `src/lib/content/demo-order.ts`
  so the builder can import it).
- **Verified:** with the full selection, 18 links, all 200.
- **Verified end to end:** each of the 18 demos runs with a bundle built from only its listed
  features, in Chromium, with no "is not included in this bundle" diagnostics
  (`bundle-cli.spec.ts`). The feature lists in the demo registry are therefore complete.

## 8. UX findings

| # | Finding | Status |
|---|---|---|
| U-1 | Feature rows were dense: syntax, notes, requirements and up to 7 reference links per row; up to 9 tab stops per row. | Fixed (B-3): syntax and reference links are in one "Syntax and reference" disclosure per row; requirements and notes stay visible. One tab stop per row when closed. |
| U-2 | The development-build checkbox kept the `.min.js` name. | Fixed (B-2): the default name swaps to `public/reactive-css.js`; a custom name is kept. |
| U-3 | Exact sizes appear only for measured configurations; others show a labelled estimate. | Correct as is. |
| U-4 | The analyzer panel accepts one pasted stylesheet; multi-file projects need the CLI. The panel says so. | As designed. |
| U-5 | The install command assumes `npm pack` until the package is published (F-01/F-02 in the pre-launch audit). | Open: waits on the package name. |
| U-6 | At 390 px the "Or don't build anything" size table ran its numbers together ("116,31939,136"). | Fixed (B-4): column padding, and the file name may wrap anywhere. The 320 px overflow test caught the first attempt in WebKit. |

## 9. Bugs found

| ID | Bug | Where |
|---|---|---|
| B-1 | `dynamic-components` listed as a compatible demo, link 404 | `catalog.ts` `demosFor` |
| B-2 | Development build named `.min.js` | `BundleBuilder.tsx` ConfigOutput |
| B-3 | Feature rows: too much secondary detail, too many tab stops | `BundleBuilder.tsx` FeatureSelector |
| B-4 | Standard-bundle size table cramped at 390 px | `bundle-builder.astro` |
| A-1 | Analyzer cannot follow root-absolute links (library) | `tools/bundle.mjs` |

Runtime bugs found by the experiments are in § 11. None was fixed: the runtime source is out of
scope.

## 10. Bugs fixed

B-1 to B-4, each with a test:
- B-1: "compatible demos are published links" (`bundle-builder.spec.ts`);
- B-2: "ESM + development build" (`bundle-cli.spec.ts`);
- B-3: the keyboard test now goes Reset → a row's disclosure → its link → the next checkbox within
  8 tab stops (`bundle-builder.spec.ts`);
- B-4: the existing 320 px overflow test, and the reviewed visual baselines.

**Visual baselines:** the four `bundle-builder` baselines (1440, 1280, 1024 and 390 px) were
updated after review. The diff shows only the collapsed feature rows (the page is 249 px shorter at
1440 px) and the table spacing. No other baseline changed.

A-1 is in the library's tooling, outside this audit's allowed changes. See R-2.

## 11. Remaining limitations

Found by building the experiments. These are runtime capability boundaries, not Builder bugs.
Each experiment's `NOTES.md` has the details.
- Only one `on:` declaration applies per element: the cascade winner. Two triggers on one element
  must be in one declaration.
- `focus:` acts on a false → true change only. Focusing the same element twice in a row needs the
  value to go false first.
- Conditions read states only, not computed `@property` values or other custom properties.
- A popover's `toggle` is not an `on:` trigger. State cannot follow a light-dismissed popover.
- An ancestor cannot read or set a descendant's state; states flow down only.
- `viewport()` compiles to a length (`100dvw`), not a number. Use it with `calc()` as a length.
- `when()` is in `conditions`. A forms-only profile cannot use it.
- Application data (lists, records, async work) cannot be expressed. The experiments use fixed
  markup, and per-item state is repeated by hand (notifications: 12 states for 6 items).
- String conditions are exact. A palette can filter by whole keyword, not by substring.
- `on:` rules do not merge, so a field with several key actions needs their cross product
  (command-palette: 18 rules).
- No declarative way to open a native `<dialog>` or popover, or to set `aria-activedescendant`.
- `live()` produces random values only. A deterministic sequence needs the animation clock.

**Runtime bugs** found by the experiments, each with a minimal repro in its `NOTES.md`. None is a
Builder bug, and the custom bundles behave exactly as the full runtime in each case.

| # | Bug | Engines | Experiment |
|---|---|---|---|
| R-B1 | `text:` goes stale inside a `display:none` subtree that was shown once; it updates when shown again | WebKit | wizard |
| R-B2 | An `attr:` that depends on `:has(:invalid)` lags when another `attr:` enables a required `<select>`; corrects on the next change | WebKit | wizard |
| R-B3 | `:when()` hides a `live()` value but does not stop its timer: elements are not re-bound when the runtime's own `data-rcss-*` markers change (`src/core/elements.ts:159`) | both | dashboard |
| R-B4 | `:changed()` never clears on an ancestor of an animation that restarts in the same frame | both | dashboard |
| R-B5 | Enter in a field whose action moves focus (`focus:`) to a button then activates that button; `prevent()` on the field's rule avoids it | both | command-palette |
| R-B6 | `element()` is 0 until the first measurement: one frame of `0`, a small layout shift with right-aligned numbers | both | motion |

## 12. Test results

| Suite | Result |
|---|---|
| Site typecheck (`astro check`) | 0 errors, 0 warnings |
| Site unit (Vitest) | 317 passed |
| Site Storybook (Vitest) | 99 passed |
| Site Playwright (Chromium + WebKit), full suite | 371 passed, 41 skipped. The 4 `bundle-builder` visual baselines failed as expected and were updated after review (§ 10). |
| Re-run after the baseline update and B-4: builder + visual specs | 71 passed |
| `bundle-builder.spec.ts` + `bundle-cli.spec.ts` | 59 passed, 1 skipped |
| Experiments: 6 specs + integration (Chromium + WebKit) | 236 passed, 14 skipped (CDP-only checks in WebKit), 0 failed |
| Experiments in Firefox | **Not run:** Playwright's Firefox fails to launch on this machine ("Could not find profile folder") |
| Screen readers | Not tested |

The site run used the production build (`astro preview`). The 41 skipped site tests are WebKit only:
- 36 visual baselines (recorded in Chromium);
- 3 clipboard tests (clipboard permissions are Chromium-only in Playwright);
- 2 Tab-order tests (WebKit does not Tab to buttons by default).

## 13. Experiment coverage matrix

Each custom bundle was built by the real CLI from a complete analysis of the experiment's own
files (`experiments/tools/build-bundles.mjs`), then measured. In `integration.spec.ts`, each
bundle:
- loads and lists exactly the analyzed features in `describe().bundle`;
- runs with no diagnostics and no console errors;
- compiles the same number of sheets, bindings, sources and observers as the full runtime.

| Feature | configurator | wizard | notifications | command-palette | dashboard | motion |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| events | ● | ● | ● | ● | ● | |
| conditions | ● | ● | ● | ● | ● | ● |
| nth-var | | ● | | ● | | |
| history | | | | | ● | |
| forms | ● | ● | ● | ● | ● | ● |
| text | ● | ● | ● | ● | ● | ● |
| attributes | ● | ● | ● | ● | ● | |
| focus | | ● | ● | ● | | |
| values | | | | | ● | |
| dynamic | | | | | ● | ● |
| geometry | | | | | | ● |
| **Features (with core)** | 6 | 8 | 7 | 8 | 9 | 6 |
| **Minified (B)** | 77,693 | 83,462 | 80,624 | 83,462 | 90,814 | 65,700 |
| **gzip (B)** | 26,698 | 28,468 | 27,555 | 28,468 | 31,007 | 23,549 |
| **brotli (B)** | 23,805 | 25,326 | 24,497 | 25,326 | 27,451 | 21,109 |
| **vs dist full, minified** | −33 % | −28 % | −31 % | −28 % | −22 % | −44 % |
| **Tests (both browsers, both runtimes)** | 28 | 32 | 48 | 40 | 44 | 32 |
| **Start at 4× CPU throttle (Chromium)** | 162 ms | 199 ms | 168 ms | 159 ms | 168 ms | 137 ms |

Every feature in the catalog is used by at least one experiment. `nth-var`, `history`, `values` and
`geometry` are each used by only one or two.

**Leaks:** in Chromium, 20 `stop()`/`start()` cycles leave bindings, sources, observers, scheduled
work and DOM listener counts unchanged in all six experiments. Heap after GC (CDP
`Runtime.getHeapUsage`) grows 0.3–0.5 MB over the first 20 cycles. For configurator, the heap was
2.08 MB at the start, then 2.47 MB (20 cycles), 2.70 MB (100), 2.85 MB (300) and 2.91 MB (1,000).
It levels off, so this is warm-up, not a leak. The first version of the check used
`performance.memory`, which Chromium rounds to 10 MB steps; it was replaced.

**Idle and motion performance** (dashboard and motion NOTES): idle main-thread time 0.3–8 ms/s.
200 pointer moves have no long tasks and a p95 frame gap of 16.7 ms (Chromium) and 18–25 ms
(WebKit).

## 14. Recommendations

- **R-1 (P1):** decide the package name (F-01). The install command, CLI name and API import all
  follow it.
- **R-2 (P2, library):** add a `--root <dir>` option to `analyze`, so root-absolute links resolve.
  *Done 2026-10-21 (pre-beta stabilization).*
- **R-3 (P2, library):** let `--assume-complete` also report which notes it ignored, in the JSON.
- **R-4 (P3):** a multi-file analyzer on the page (drop a folder), using the same compiler.
- **R-5 (P3):** keep the site resolver a port, tested on every subset. If the library ever ships a
  browser-safe resolver (no esbuild import), import it instead.
- **R-6 (P3):** consider a second `on:` channel per element, or document the cascade rule in the
  `on:` reference: it cost the most time in the experiments.
