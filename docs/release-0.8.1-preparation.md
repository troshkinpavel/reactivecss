# Reactive CSS 0.8.1: release preparation

**Date:** 2026-10-21.

**Status:** **Prepared locally. Not published.** The local release tool's preparation saved `prepared` with 0 blockers and 2 warnings, and the CHANGELOG heading still says "(local, unpublished)".

- **Not done:** Git commit, tag or push; GitHub release; `npm publish`; CDN upload; website deployment; DNS change.
- **What "prepared" means:** the local requirements of that workflow pass. It is not publication evidence.

The fixes: [prebeta-runtime-stabilization.md](prebeta-runtime-stabilization.md).

## 1. Scope

A patch release: the pre-beta stabilization fixes, and no new public API. The analyzer gained the `root` option (CLI `--root`), which the stabilization required. The catalog, features and profiles are unchanged.

| Area | Included | Evidence |
|---|---|---|
| A. Analyzer | `--root <dir>` / `root`; refusal of paths that leave the root; `root-relative-link` note; `?query` and `#hash` stripped; incomplete analysis → full runtime, and `--build` says so | Unit test in `tests/unit/catalog.test.ts`; re-checked from the installed package (§5) |
| B. Keyboard focus | Enter and printable keys that move focus defer to the frame; Arrows, Home, End, Escape, Tab and prevented keys keep same-task focus | `tests/browser/prebeta.spec.ts` (3 tests, which fail without the fix); accessible-tabs keyboard tests |
| C. `:changed()` | Only animations and transitions its rules can start hold the marker; conservative fallback for custom properties and `var()`; several rules on one state clear together | `prebeta.spec.ts` (2 tests); v0.3 lifecycle tests; `change-animation` API example |
| D. `bind:` race | Writes to a just-toggled bound control and its radio group wait for `input`/`change`, or for the next frame if the click was cancelled | `prebeta.spec.ts` (4 tests), plus **a new listener-lifecycle test** (below); experiments and the visual-lab equalizer |
| E. Docs | `live()` under `:when()`; `element()` before its first value; the two WebKit engine limitations, with state-driven workarounds | README (Limitations), site Browser Compatibility, CHANGELOG |

**`bind:` listener review (D).**
- The capture `click` listener on `window` is added together with the `input`/`change`/`reset` listeners when the first bound control appears. It is removed with the last one (`listen()` in `src/state/bind.ts`).
- New test, "the window click listener exists only while bound controls do, across stop() and start()" (Chromium, CDP):
  - three `stop()`/`start()` cycles leave exactly one listener while running and none while stopped;
  - removing the last bound control removes it, and re-inserting one adds it back once;
  - the race fix still works afterwards.
- The test counts relative to the stopped state, because Playwright's own injected script also has a capture click listener on `window`.
- The fix was not changed.

## 2. Version

| File | Change |
|---|---|
| `package.json` | 0.8.1; `files` now also excludes `docs/patches` and `docs/rfc-pointer-snapshot.md` (§9) |
| `package-lock.json` | Resynchronized offline: the root entry had said 0.1.0 since long before 0.8.0, and lacked `bin` and the optional esbuild peer. Metadata only; no dependency changed |
| `src/core/version.ts` (new) | `VERSION = '0.8.1'`, the only version literal in `src/` |
| `src/api.ts`, `src/core/registry.ts` | Use `VERSION` (were two separate `'0.8.0'` literals) |
| `tests/unit/v05.test.ts`, `tests/dist/esm.test.ts`, `tests/browser/dist.spec.ts` | Compare with `package.json` instead of a literal |
| `examples/lab/index.html`, `examples/lab/checklist.{html,js}`, `examples/api/index.html` | Current-version labels |
| Site | Synced from the library (`runtime.json`, `registry.json`, `bundles.json`). The banner and footer read it; `src/lib/content/engineering.ts` (`LATEST`) updated by hand, as the site's version test requires |

These all report 0.8.1:
- the bundles, which contain `"0.8.1"`;
- `describe().version`;
- `dist/catalog.json`, `dist/features.json` and the CLI's manifest.

The CLI has no `--version` flag, and none was added. Historical references to 0.8.0 (release reports, `since` values, CHANGELOG sections, test titles) were kept.

## 3. Changelog

`CHANGELOG.md`, `## 0.8.1 — Pre-beta stabilization (local, unpublished)`: Fixed (5), Changed (4), Documentation (3 items). No date: the project's headings have none, and nothing was published.

## 4. Distribution and sizes

`npm run build` rebuilt:
- `dist/reactive-css.js` (development);
- `reactive-css.min.js`;
- `reactive-css.compact.min.js`;
- `index.js` (ESM) with `.d.ts`;
- `features.json` and `catalog.json`.

Custom bundles come from `tools/bundle.mjs` and the `reactive-css` CLI. Every `package.json` entry point exists (6/6).

`node benchmarks/bundle-sizes.mjs --runs=7` now writes one folder per version: `benchmarks/audit/results/v081/`. Gzip is level 9 and brotli quality 11.

| Bundle | Minified | gzip | brotli |
|---|---:|---:|---:|
| core only | 41,873 | 15,530 | 14,102 |
| basic | 53,208 | 18,844 | 17,049 |
| forms | 72,134 | 24,758 | 22,127 |
| stateful-ui | 76,037 | 26,317 | 23,450 |
| dynamic | 54,540 | 19,833 | 17,962 |
| full (custom) | 100,112 | 34,023 | 30,110 |
| `reactive-css.min.js` | **117,830** | 39,715 | 34,983 |
| `reactive-css.compact.min.js` | 101,644 | 34,357 | 30,418 |

The baseline in the brief was 117,835 B, measured after the stabilization but before the bump. The 5-byte difference comes from the version consolidation: the version string is in the bundle once instead of twice. Against 0.8.0 (116,319 B), 0.8.1 is +1,511 B minified and +579 B gzip.

What each feature adds over its requirements (minified):

| Feature | 0.8.1 (B) | Change from 0.8.0 |
|---|---:|---:|
| geometry | +2,188 | 0 |
| text | +3,078 | 0 |
| focus | +3,504 | +156 |
| nth-var | +4,107 | 0 |
| dynamic | +5,022 | 0 |
| history | +5,175 | +979 (`:changed()` ownership) |
| values | +5,490 | 0 |
| conditions | +7,342 | 0 |
| forms | +8,219 | +406 (`bind:` fix) |
| attributes | +9,427 | 0 |
| events | +11,335 | +2 |

**Startup** on 1,000 components (median of 7): 4.5 ms (core) to 5.9 ms (full custom); heap after GC 1.68–2.14 MB.

**Where the current sizes are used:**
- the site, through `npm run sync-runtime` (Bundle Builder, Custom Bundles, the Vision preview);
- `docs/bundle-builder-0.8.md`;
- `docs/api-examples-0.8.md` (all 16 example bundles rebuilt and re-measured);
- the README;
- the site's Performance page (0.8.0 → 0.8.1 columns);
- `experiments/README.md`;
- three site test files with size literals.

**Historical record corrected.** The stabilization had rewritten `docs/release-0.8.0.md` § 4 with its post-fix sizes. That section again shows the 0.8.0 measurements (116,319 B …), with a note. `docs/prebeta-runtime-stabilization.md` keeps its own before/after table, with a pointer here. No page mixes metrics: each column says minified, gzip or brotli.

## 5. Package

`npm pack` gives `reactive-css-0.8.1.tgz`: 143 files, 911 KB (packed). It contains `dist` (no `dist/custom`), `src`, `tools`, `docs` (no `docs/patches`, no `rfc-pointer-snapshot.md`), README, CHANGELOG and `package.json`. There are no experiments, site or tests.

Isolated install into an empty project: `npm install --save-dev --offline <tgz> esbuild`, from the npm cache.

| Check | Result |
|---|---|
| Version, bin | 0.8.1; `node_modules/.bin/reactive-css` |
| ESM `import('reactive-css')` | `version` and `describe().version` are 0.8.1; `compile` exists |
| `reactive-css/bundle`, `reactive-css/catalog.json`, `reactive-css/auto` | 0.8.1, 12 features; `./dist/reactive-css.min.js` exists |
| CLI | `analyze` without `--root`: a `root-relative-link` warning and the full runtime. With `--root`: complete, `events, text`, found through `/css/app.css?v=2`. A link escaping the root is refused (`missing-file`). `--build`: 56,177 B; manifest 0.8.1 |
| Script tag, strict CSP | The installed `reactive-css.min.js` and the custom bundle: 0.8.1, the interaction works, 0 diagnostics, 0 errors (Chromium and WebKit) |
| Types | `tsc --strict` passes with `moduleResolution: bundler`. **Fails with `node16`/`nodenext`** (§11) |

## 6. Tests

All of these ran today, on the 0.8.1 build.

| Suite | Result |
|---|---|
| Library typecheck | 0 errors |
| Library unit | 103 passed |
| Library dist (`npm run test:dist`) | 3 + 4 passed, types included |
| Library browser, Chromium + WebKit | **628 passed, 6 skipped** (634). The skips are Chromium-only DevTools tests, now including the new listener test. The 2 WebKit engine-tracking tests are `test.fail` and count as passed |
| Library browser, Chromium at 4× CPU | 317 passed |
| Application demos + API examples on analyzer bundles (`RCSS_CUSTOM=1`) | 134 passed (3 more runs: 134 each) |
| Experiments + visual lab, full and custom runtime, Chromium + WebKit | Functional run: 480 passed, 8 skipped. `@perf` run (serial): 39 passed, 35 skipped. Total 519 passed, 43 skipped, 0 failed: the same tests as the combined run (§7) |
| Site typecheck · unit · Storybook | 0 errors · 322 passed · 99 passed |
| Site Playwright, Chromium + WebKit, production build | 375 passed, 41 skipped (existing browser-specific skips), 0 failed |
| Local release tool E2E (temporary config copy) | 32 passed |
| Site production build + Pagefind | Passes; 110 pages indexed; canonical `https://reactivecss.com`; no localhost in the sitemap |

**Fixed during preparation (test defects, not runtime defects):**
- **live-values (API examples).** Under parallel load it failed once. It read the level, then polled the bar toward that value; a tick during the 700 ms transition made it wait for a stale value. Bar, readout and value are now compared in one read. 40 repeats, plus 10 at 4× CPU, pass. The runtime was not changed.
- **CDN URL (site).** A hard-coded `0.8.0` CDN URL in `bundle-builder.spec.ts` now reads the version from `package.json`.
- **API coverage report.** It was stale (generated for 0.8.0). Regenerated with `npm run api-coverage` (52 tests pass).

## 7. Performance tests

**The observation.** Two visual-lab or experiment tests failed only when all 562 experiment tests ran in parallel:
- living-typography's pointer cost, in the stabilization run;
- the motion pointer test (custom bundle), with one 61 ms long task, in today's second parallel run.

In that run, living typography also reached a frame-gap p95 of 33.3 ms (two frames) in three cases, just under its 34 ms limit.

**Method.** Each test sends 200 pointer moves through Playwright and records `requestAnimationFrame` gaps and `longtask` entries. Headless Chromium, CDP `Emulation.setCPUThrottlingRate` 1× or 4×. Thresholds: p95 gap under 34 ms (70 ms at 4×), and at 1× no long task over 50 ms. The 1-minute load average was sampled every 5 s.

| Run | Living typography p95 (ms) | Motion pointer | Long tasks | Load average |
|---|---|---|---|---|
| Isolated, 1 worker, 5 × 4 variants | 16.7–16.8 (all 60 values) | — | none | 5.3–36.1 |
| Isolated, 1 worker, motion × 10 × 2 | — | p95 16.7–16.8; max up to 33.4 | none | — |
| Parallel run 1 (562 tests) | 16.7–16.8 | passed | none | — |
| Parallel run 2 (562 tests) | 16.7–33.3 | **one 61 ms long task (failed)** | one | 6.4–34.6 |
| `@perf` alone, serial (39 tests) | 16.7–16.8 | passed | none | 3.9–22.0 |

**Conclusion.** The failures are resource contention, not a runtime regression. In isolation every value is one frame (16.7 ms), with no long tasks.

**Change.** The 12 timing tests are tagged `@perf` in their titles. The default experiment run excludes them, and `LAB_PERF=1` runs only them, on one worker (`experiments/playwright.config.ts`; README and AUTHORING updated). **No threshold was changed.**

## 8. Local release tool and public site

The local run:
- **Detection:** the tool detected 0.8.1 from `package.json` and the CHANGELOG.
- **Editing:** the metadata was edited through the UI and persisted across a reload. Cancel and discard, validation, a conflict refusal and the API security checks were exercised.
- **Prepare Release:** all four steps ran (11/11 validation checks), and 0.8.1 was saved as `prepared`.

**Public pages.** Release metadata is now rendered on the changelog, under a visibility policy:
- only releases whose CHANGELOG heading no longer says "unpublished";
- a local preview build (`RCSS_PREVIEW_RELEASES=1`) also shows prepared ones, labelled "prepared · not published";
- never internal notes or workflow data.

The public build was checked: no card, and no 0.8.1 metadata anywhere in `site/dist`.

## 9. Concurrent work

A separate session, started while this preparation began, implemented a new API: `set(--x, mouse(x|y[, local]))`. Its runtime edits were in this working tree before the first 0.8.1 build, so that build was 119,868 B with the unfinished API.

As you decided:
- the feature session finished its work and moved it into `docs/patches/pointer-snapshot/` (a patch that reapplies byte for byte), then restored its files;
- I verified the restore: apart from the version consolidation, the rebuilt ESM bundle is identical to the stabilized build from 04:49;
- `docs/patches/` and the feature's RFC (`docs/rfc-pointer-snapshot.md`, which says "implemented") are excluded from the package;
- the feature targets the next minor version.

## 10. Browser limitations

- **Firefox:** not run. Playwright's Firefox 1555 does not launch on this machine ("Could not find profile folder").
- **Screen readers:** not tested.
- **WebKit engine bugs** (reproduced without Reactive CSS; tests with `test.fail` report when WebKit fixes them):
  - stale inherited values under a `display: none` ancestor;
  - `:has(:invalid)` after a required `<select>` is enabled.

  Both have state-driven workarounds, documented in the README, the site's Browser Compatibility page and the CHANGELOG.

## 11. Readiness and what publication needs

| | Status |
|---|---|
| Library 0.8.1 built, tested, measured, documented | **Completed** |
| Local package archive and isolated install | **Completed** |
| Local release status | **Prepared** (0 blockers, 2 warnings: no GitHub release URL, no CDN URLs in the metadata) |
| npm, GitHub release, CDN | **Not published, not verified** |

**Before publishing (prerequisites):**
1. **Package name.** `reactive-css` belongs to an unrelated package on npm (0.1.0). Choose the final name; the CDN URLs, the docs' install commands and `releases.json` follow it.
2. **Repository.** `package.json` has no `repository`, `homepage` or `bugs`, and there is no public repository yet. These are needed for the GitHub release URL and npm's page.
3. **TypeScript `node16`/`nodenext` consumers.** The `.d.ts` files use extensionless relative imports (as in every version so far), which these modes reject. The types work with `moduleResolution: bundler`, which the dist test uses. The fix is `.js` extensions on the relative imports in `src/`, or bundled declarations. It was not made here, because it is a refactor outside a patch release. Decide before publishing.
4. Firefox and screen-reader checks, if they are release criteria.

**Manual publication steps, in order** (from the local release checklist):
1. `npm run verify` in the library and in `site/`.
2. Change the CHANGELOG heading note from "local, unpublished".
3. `git tag v0.8.1` and push the tag.
4. Create the GitHub release `v0.8.1` with the CHANGELOG section, and put its URL in `site/config/releases.json`.
5. `npm publish`.
6. Verify the jsDelivr and unpkg URLs, and add them to `site/config/releases.json`.
7. Build and deploy the website. The changelog card then appears because the heading is no longer "unpublished".
