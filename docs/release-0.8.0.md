# Reactive CSS 0.8.0: modular runtime and custom bundle builder

Local build, not published.

- **Design:** [rfc-modular-runtime-0.8.md](rfc-modular-runtime-0.8.md).
- **Tooling reference:** [bundle-builder-0.8.md](bundle-builder-0.8.md).

## Summary

- **Feature-level bundles.**
  - The runtime is split into a core and 11 optional features. Each is a real module with dependencies taken from the code.
  - A custom bundle contains only the selected features and what they require. Nothing is loaded lazily.
  - The full and compact bundles are built as before and behave the same.
- **Missing features are reported, not silently ignored.** The parser still recognizes every Reactive CSS syntax. A declaration, function or selector whose feature is not in the bundle gets one diagnostic that names the feature. Names native CSS also has (`random()`, `element()`) get a note.
- **Builder.**
  - `tools/bundle.mjs` (API) and the `reactive-css` CLI select features or profiles, add requirements and explain them, and reject unknown or conflicting selections with codes and suggestions.
  - They build real iife or esm bundles and write a manifest with minified, gzip and brotli sizes.
- **Analyzer.**
  - `reactive-css analyze` uses the real compiler on CSS, HTML and directories and recommends a feature set.
  - When it cannot see everything (other scripts, remote sheets, `@import`, unreadable files), it recommends the full runtime.
- **Verified by running, not only by building.**
  - Each feature builds alone with only its declared requirements, and nothing else ends up in its bundle.
  - The five profiles run real interfaces under a strict CSP and clean up on unmount. They do not leak over 300 mount/unmount cycles.
  - **All 20 examples (30 example tests) pass on the minimal bundle the analyzer picks for them**, in Chromium and WebKit, also at 4× CPU.
- **One bug fixed:** a `<link>` stylesheet race, found by running the examples on custom bundles (section 5).
- **Website:** unchanged. The integration pieces (catalog JSON, configuration schema, manifest, error format) are prepared and documented, not implemented.

## 1. What changed in the runtime

| Change | Why |
|---|---|
| Declaration runtimes (`on:`, `bind:`, `text:`, `attr:`, `focus:`, `typed()`, `state(…, bind())`) register in a `runtimes` table in `registry.ts`. Engine, parser and state engine look them up there | They were imported directly, so nothing could be left out |
| One entry module per feature (`src/features/<id>.ts`). `src/index.ts` imports all of them, then `src/api.ts` | The full build is the sum of the features |
| `textOf` → `state/textof.ts`. The attribute allowlist (compile time) stays in `state/bindattr.ts`; the binding runtime moved to `state/bindattr-runtime.ts`. `previous()`/`direction()` values → `state/history.ts`. `sources.ts` imports `fmt` from `core/format` | Hidden cross-feature imports |
| Excluded `fn:`/`sel:` names compiled into a custom bundle (`__RCSS_EXCLUDED__`), with a pre-filter that triggers on them | A sheet using only missing features is still compiled, so it is reported |
| `CompiledSheet.uses`: the syntax keys a sheet used | The analyzer reads the real compiler's result |
| `describe().bundle`: the included feature IDs (`null` from source). Custom bundles carry a compact `describe().features` | Identify a bundle at runtime. The full metadata is in `dist/features.json` |

No public API changed or was removed. `describe()` gained the `bundle` key and keeps every other key in the same order.

## 2. Features and profiles

The table is in [bundle-builder-0.8.md](bundle-builder-0.8.md#features); the catalog is `src/features/catalog.ts`, also emitted as `dist/catalog.json`.

- The only real cross-feature dependency is `focus` → `events`. `focus:` acts only on state changes from a trusted user event, which the `on:` dispatcher records.
- `forms` is optional for `focus`: bound controls record the activation too.

The profiles are `basic`, `forms`, `stateful-ui`, `dynamic` and `full`.

## 3. Verification

| Check | Result |
|---|---|
| Typecheck | Pass |
| Unit tests (`npm test`) | 102 pass. New: catalog consistency, 11 per-feature isolation builds plus core alone, resolver, analyzer |
| Dist tests (`npm run test:dist`) | Pass: ESM import, types, `features.json`, new `catalog.json`, the minified bundle on a plain page |
| Browser, Chromium + WebKit | **521 passed**, 5 skipped (the same skips as 0.7.1) |
| Browser at 4× CPU (Chromium) | 263 passed |
| Custom bundles (`tests/browser/bundles.spec.ts`) | A missing-feature test plus five profiles, in Chromium and WebKit, also at 4× CPU |
| Every example on its analyzer-chosen bundle (`RCSS_CUSTOM=1`) | 60/60 (30 example tests × Chromium + WebKit), and 30/30 at 4× CPU |
| Firefox (Playwright) | **Not run:** Firefox 1555 still does not start on this machine ("Could not find profile folder"). Unverified, as in 0.7.1 |
| Packed package | `npm pack` installed into a scratch `node_modules`: the `reactive-css` bin, the `reactive-css/bundle` and `reactive-css/catalog.json` imports, and `analyze --build` all work |

What the custom-bundle tests check:

- **Missing features:** an events-only bundle reports each of 10 missing features with its ID. It reports `random()` as a note and ignores native `element(#id)`. What it includes still works.
- **Profiles:** `basic`, `forms`, `stateful-ui`, `dynamic` and `full` each run an interface built only from that profile's features. Each test checks:
  - no diagnostics;
  - `stats()` back to zero after removing the content;
  - a strict CSP (`script-src 'self'; style-src 'self'`).

How `RCSS_CUSTOM=1` works:

- For each example, the test analyzes the example's folder, builds the recommended bundle and serves it in place of `reactive-css.min.js`.
- It uses `assumeComplete`: the two harness examples create sheets from their CSS files, which are in the folder.

## 4. Sizes, startup and memory

`node benchmarks/bundle-sizes.mjs` wrote `benchmarks/audit/results/v080/bundle-sizes.{json,md}`. These are the 0.8.0 measurements as released. (On 2026-10-21 that folder was re-measured with the pre-beta stabilization code before the version bump; those fixes and their sizes belong to 0.8.1, see [release-0.8.1-preparation.md](release-0.8.1-preparation.md).)

| Bundle | Minified | gzip | brotli |
|---|---:|---:|---:|
| core only | 41,876 | 15,532 | 14,092 |
| basic | 53,209 | 18,846 | 17,067 |
| forms | 71,731 | 24,610 | 21,991 |
| stateful-ui | 74,901 | 25,862 | 23,037 |
| dynamic | 54,543 | 19,834 | 17,962 |
| full (custom) | 98,605 | 33,455 | 29,635 |
| `reactive-css.min.js` | 116,319 | 39,136 | 34,379 |
| `reactive-css.compact.min.js` | 100,133 | 33,787 | 29,869 |

- **What each feature adds** over its requirements, minified: `geometry` +2,188 B, `text` +3,078, `focus` +3,348, `nth-var` +4,107, `history` +4,196, `dynamic` +5,022, `values` +5,490, `conditions` +7,342, `forms` +7,813, `attributes` +9,427, `events` +11,333.
- **The cost of modularity.** `reactive-css.min.js` grew from 114,421 B (0.7.1) to 116,319 B, +1.9 KB. That pays for the missing-feature diagnostics, the `uses` record and the runtime table.
- **The core is the floor.** At about 42 KB it holds the whole compiler, which still recognizes every syntax, plus the CSSOM rewrite, the state engine and the scheduler. Splitting it further was rejected (RFC section 5).
- **Startup.** Measured on 1,000 components (state + `on:` + `text:`) as CDP script time until the second frame, median of 7 loads. It was 4.7 ms (core) to 6.2 ms (full). Heap after GC was 1.68 MB to 2.14 MB. Bundle size hardly matters for startup at this scale.
- **Leaks.** `benchmarks/audit/memory.mjs mount` was run on unminified profile bundles. It now accepts `--bundle=custom/<file>.js`. Results are in `benchmarks/audit/results/v080/`:
  - 100 components × 50 cycles for all five profiles: no detached elements, counters back to baseline, no listener changes, no page errors.
  - 300 cycles for `basic` and `full`: heap flat (1.76→1.82 MB and 2.32→2.51 MB, plateau after about 20 cycles).

## 5. Bug fixed: `<link>` href swap race

- **Found by:** the stylesheet lab on a custom bundle in WebKit, intermittently.
- **Root cause:** after `link.href` changes, `link.sheet` can still be the **old** sheet for a moment. `linkSheet()` returned it as if loaded, so the new sheet was never processed.
- **Fix** (`engine.ts`): use `link.sheet` only when its `href` (without the fragment) matches the link's.
- **Test:** `tests/browser/v071.spec.ts` › "href swap race" reproduces it by delaying stylesheet responses.

The bug was in every bundle; custom bundles only changed the timing enough to show it.

## 6. Tooling

- **CLI:** `reactive-css features | resolve | build | analyze`, each with `--json`. Exit code 0 on success, 1 for invalid input, 2 for an internal error or missing esbuild.
- **API:** `catalog()`, `resolve()`, `build()`, `analyze()`, `sizes()` (`reactive-css/bundle`).
- **Package (local):**
  - a `bin` entry;
  - `exports` for `./bundle` and `./catalog.json`;
  - `files` now include `src` and `tools`, and exclude `dist/custom`;
  - esbuild is an optional peer dependency.
- The tools load the TypeScript catalog through esbuild, so they also work from `node_modules`, where Node does not strip types.

## 7. Limits and what was not done

- **Static analysis** cannot see:
  - stylesheets created by scripts, `adoptedStyleSheets` or CSS-in-JS;
  - inline `style` attributes;
  - sheets that are not given to it.

  In those cases it says the analysis is incomplete and recommends the full runtime. The browser reports any feature that is still missing.
- **Not done, as requested:**
  - no website builder;
  - no change to `site/`;
  - no lazy loading;
  - no VS Code extension;
  - no Git operations, publishing or deployment.
- **Not done, by decision:** the parser, scheduler and state engine are not split (RFC section 5).
- **Firefox and screen readers:** unverified.
