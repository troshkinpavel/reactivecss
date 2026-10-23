# Pre-launch audit: detailed findings

**Date:** 2026-10-20. **Scope:** the public website (`site/`), the library it documents (0.8.0,
local), and the local admin app.

**Method:**
- An independent re-check of the current repository and of a fresh build. Earlier reports were
  used only as a list of claims to verify.
- No product code, content or configuration was changed.
- No Git commands, no publishing, no deployment. The only external calls were read-only HTTP
  requests to npm, jsDelivr and unpkg, and reads of the Claude Design project.

## Resolution log, 2026-10-21 (WP-2 and WP-3)

| Finding | Status | Change |
|---|---|---|
| F-03 canonical = localhost | Fixed | `config/seo.json` `canonical` is `https://reactivecss.com`. The build warns if it is ever localhost again. Built output: no `localhost` anywhere in `dist/`; canonicals, `og:url`, `og:image`, `robots.txt` and all 112 sitemap URLs use the domain. The admin E2E test that hard-coded the old value now checks that an invalid value leaves the saved one unchanged |
| F-04 `when()` reference | Fixed | `if-true` is optional; the page documents `when(condition)` → `true`/`false` and an empty value when `if-false` is missing (matches `src/state/conditions.ts`) |
| F-05 Getting Started accessibility tip | Fixed | The tip shows the full rule with `attr: aria-pressed when(--liked);` (experimental, 0.5.3). The Deep Dive's identical claim was corrected too |
| F-07 legacy example pages | Fixed | `noindex, follow`, and left out of the sitemap (`astro.config.mjs`); 112 sitemap URLs instead of 141 |
| F-08 Firefox wording | Fixed | One wording on introduction, Simplify CSS, Troubleshooting and the `prevent()` page, linking Browser compatibility |
| F-09 ES-module import path | Open | Waits on the package name (WP-1) |
| F-10 `on:` reference | Fixed | All 14 triggers plus `key()` and `outside()`; `prevent()` in the action list |
| F-12 redirect, robots, 404 | Fixed | `src/layouts/Redirect.astro` (immediate, `lang`, heading, link) for `/docs/` and hidden features; `src/pages/robots.txt.ts`; `src/pages/404.astro` (`noindex`) |
| F-13 `og:image` | Fixed | `public/og/default.png` (1200 × 630, made by `scripts/og-image.mjs`) set in `config/seo.json` |
| F-20 two `h1` on the changelog | False positive | CHANGELOG.md's `# Changelog` is hidden by `.prose-md h1 { display: none }`, so it is not in the accessibility tree |
| F-21 « » marks | Fixed | Code formatting |
| F-22 `closest()` version | Fixed | `since: "0.3"` in its entry (CHANGELOG 0.3.0); `entryStatus` uses it when the registry has no entry |
| F-23 machine details, benchmarks claim | Fixed | They now cite `benchmarks/AUDIT-0.4.md`; the Limitations text says where results actually are |
| F-32 homepage count | Fixed | "16 API examples and 18 library demos", computed from the catalog |
| **F-33** (new) Visual baselines drift unseen | Open, P2 | `visual.spec.ts` uses `maxDiffPixelRatio: 0.01`: on a 1440 × 7456 page that allows about 107,000 changed pixels. The Simplify CSS baseline still showed the v0.5.2 banner and an old sidebar until it was refreshed on 2026-10-21. Others from 2026-10-19 (`api-state` 1024–1440, `control-center`, `design-system`) may hold similar drift. Fix: review and refresh them, and lower the tolerance or mask only the dynamic regions |

**Tests added** (`tests/e2e/site.spec.ts`):
- `robots.txt` names the sitemap on the canonical origin;
- every sitemap URL is indexable, and legacy and redirect pages are left out;
- the `/docs/` redirect is immediate and accessible, and the 404 page is `noindex`;
- `og:image` is on every page;
- the reference corrections (`when()`, `on:`, `closest()`).

**Results after the changes:**
- typecheck 0 errors;
- unit 312;
- Storybook 99;
- Playwright full suite: 357 passed, 41 skipped, 0 failed (Chromium + WebKit, visual included).
- Baselines updated after review: `getting-started` (the new tip code block) and `simplify-css` (banner, nav and sidebar changes from earlier sessions, plus the Firefox sentence).

## 0. How the evidence was produced

- **Isolated copy.** The repository was copied to the session scratchpad (`scratchpad/audit/repo`),
  sharing `node_modules` by symlink. The library and the site were built there, so the working
  tree's `dist/`, `src/generated/` and `test-results/` were not touched.
- **Checks run in the copy:**
  - `npm run typecheck`;
  - `npm test`;
  - `npm run build` (the sync, Astro and Pagefind);
  - the full Playwright suite;
  - the admin E2E suite (`-c playwright.admin.config.ts`).
- **Storybook** could not run in the copy: Vite refuses test files reached through a symlinked
  `node_modules` (`Failed to fetch dynamically imported module … setup-file.js`). It was run in the
  real repository instead. It writes only Vite's cache in `node_modules/.cache`.
- **Audit scripts** in `scratchpad/audit/tools/` (not in the repo) were run against the copy's
  production build, served by `astro preview`:
  - `routes.py`: inventory, titles, canonicals and robots;
  - `sweep.mjs`: every route; console errors, failed requests, overflow at six widths, axe;
  - `examples.mjs` and `srcdiff.mjs`: the 16-example matrix;
  - `search.mjs`: search queries;
  - `keys.mjs` and `menu.mjs`: keyboard flows;
  - `perf.mjs`: performance;
  - `adopt.mjs`: the adoption test;
  - `shots.mjs`: screenshots, saved in [`screens/`](screens/).
- **Three read-only sub-audits** were delegated and their claims spot-checked:
  - admin security;
  - documentation against the real API;
  - the history of earlier reports.
- **Browsers.** Automated runs used Playwright's **Chromium and WebKit** builds. **Firefox was not
  run** (it does not start on this machine). **No screen-reader testing was performed.**

## 1. Test results

| Check | Where | Result |
|---|---|---|
| `astro check` | copy | 0 errors, 0 warnings, 58 hints (219 files) |
| Unit (Vitest) | copy | 311 passed, 12 files |
| Build | copy | 141 pages; Pagefind indexed 110 pages, 4,232 words; synced 19 library demos and 16 API examples |
| Storybook | real repo | 99 passed, 14 files |
| Playwright, site | copy | **347 passed, 41 skipped, 0 failed, 0 flaky** (Chromium + WebKit). The skips are the WebKit visual baselines and a few Chromium-only checks (clipboard, keyboard Tab) |
| Playwright, admin | copy | **32 passed** (Chromium + WebKit, fixture config in a temp dir) |
| Admin unit | sub-audit | 50 passed (included in the 311) |
| Library tests | not run | Out of scope; the reports say 102 unit and 521 browser results. **Unverified here** |
| Firefox (automated) | — | **Not run.** Unavailable on this machine |
| Screen readers | — | **Not performed** |

The site's own checks already cover:
- links and anchors;
- the snippets compiling with the runtime (`compile.test.ts`, `api-coverage.test.ts`);
- version consistency (`version.test.ts`);
- documentation coverage (`api-coverage.test.ts`);
- every command shown on Custom Bundles (`bundle-cli.spec.ts`).

All of them passed above.

## 2. Findings

Severity: **P0** launch blocker, **P1** fix before public beta, **P2** soon after launch,
**P3** backlog. Effort: S (under 2 h), M (half a day), L (a day or more).

### P0 — launch blockers

**F-01 · The npm name belongs to someone else.**
- **Category:** distribution. **Routes:** `/docs/installation/`, `/docs/custom-bundles/`,
  `/bundle-builder/`, `/docs/getting-started/`.
- **Evidence.** `curl https://registry.npmjs.org/reactive-css` returns another project's package:
  - latest 0.1.0, "Super fast dynamic CSS rules";
  - repository `github.com/ItsJonQ/reactive-css`, last modified 2022-06-26.

  Meanwhile:
  - the library's `package.json` uses `"name": "reactive-css"`;
  - the docs give `npx reactive-css …`;
  - the site shows the CDN URLs `cdn.jsdelivr.net/npm/reactive-css@0.8.0/…` and
    `unpkg.com/reactive-css@0.8.0/…` as text, with "Illustrative until published";
  - `https://cdn.jsdelivr.net/npm/reactive-css/` returns **200 today**, serving the other
    package.
- **Expected:** a name the project controls. **Actual:** the project cannot publish 0.8.0 under
  this name.
- **Risks:**
  - Without a local install, `npx reactive-css` downloads the unrelated package.
  - An unpinned CDN URL already serves the wrong code.
- **Reproduce:** `curl -s https://registry.npmjs.org/reactive-css | head -c 300`.
- **Fix:** choose the published name, or obtain a transfer. Then replace it in:
  - `package.json`;
  - `src/components/mdx/Bundles.astro` and `src/lib/bundles/command.ts`, which derive from the
    package name;
  - the MDX text with `npx reactive-css`;
  - `config/links.json`.
- **Effort:** S once the name is decided (most text derives from `package.json`). **Launch:**
  blocks any public install.

**F-02 · No public way to obtain the runtime.**
- **Category:** installation.
- **Evidence:**
  - Installation and Getting Started say to install "from a local pack of the library: in a
    library checkout `npm install && npm run build && npm pack`".
  - There is no public repository:
    - `config/links.json` has no repository link;
    - Vision's "View source on GitHub" is disabled;
    - `config/releases.json` has an empty `urls.github`.
  - There is no npm package (F-01) and no download link.
  - The file *is* served at `/runtime/reactive-css.min.js`, for the previews, but no page offers
    it.
- **Expected:** a visitor can get the file. **Actual:** a public visitor has no route to the
  runtime.
- **Reproduce:** follow `/docs/getting-started/` → Installation from a fresh machine.
- **Fix:** before beta, make at least one channel live and linked: a public repository with a
  release asset, the npm package (after F-01), or a documented download of the served file.
- **Effort:** S–M plus the publication itself. **Launch:** blocks beta.

**F-03 · Canonical, `og:url` and sitemap point to localhost.**
- **Category:** SEO. **Routes:** all 141.
- **Evidence:**
  - `config/seo.json`: `"canonical": "http://localhost:4321"`;
  - the build: `<link rel="canonical" href="http://localhost:4321/…">` on 141 of 141 pages;
  - `og:url` is localhost on 140 pages;
  - `dist/sitemap-0.xml` lists 141 `http://localhost:4321/…` URLs.
- **Reproduce:** `grep -o 'rel="canonical" href="[^"]*"' dist/index.html`.
- **Fix:** set the production `https://` origin in `config/seo.json` (the admin's SEO screen or the
  file), then rebuild.
- **Effort:** S. **Launch:** blocks deployment (search engines would index localhost).

### P1 — fix before public beta

**F-04 · The `when()` reference says the second argument is required.**
- **Category:** API docs. **Route:** `/docs/reference/when/`.
- **Evidence:**
  - `src/content/api/entries.json` (the `when` entry) has the signature
    `when(<condition>, <if-true>, <if-false>?)` with `if-true` "required".
  - The same page shows the registry syntax `when(condition [, if-true [, if-false]])`.
  - CHANGELOG 0.5.3 and the `attr:` page say a bare `when(condition)` yields true or false.
  - `compile('.a{--on:state(true);--x: when(--on)}')` compiles with no diagnostics (sub-audit,
    re-read here).
- **Fix:** mark `if-true` optional and describe the boolean form. **Effort:** S.

**F-05 · Getting Started teaches a pattern with a stale accessibility note.**
- **Category:** docs, accessibility. **Route:** `/docs/getting-started/`, Accessibility tip.
- **Evidence.** The tip says: "Reactive CSS changes styles, not attributes, so `aria-pressed` stays
  `false`." In the adoption test the button stayed `aria-pressed="false"` after clicking, as the
  tip says. But `attr:` (experimental, since 0.5.3) can set it, as Vision v2's article demo does
  with `attr: aria-pressed when(--saved)`.
- **Expected:** the first tutorial shows the accessible version, or names `attr:`.
- **Fix:** add `attr: aria-pressed when(--liked);`, marked experimental, or keep the checkbox
  alternative and correct the sentence. The example lives in `src/examples/like/`, which the
  homepage also uses. **Effort:** S.

**F-06 · No skip link.**
- **Category:** accessibility. **Routes:** every page, worst on `/docs/**`.
- **Evidence.** `keys.mjs` on `/docs/getting-started/`: Tab goes logo → "docs" → Search →
  Examples …, then through about 40 sidebar links before the article. No page has a skip link
  (`a[href="#main"]` and similar: 0).
- **Fix:** a "Skip to content" link as the first element in `BaseLayout`, targeting `main`.
  **Effort:** S.

### P2 — soon after launch

**F-07 · 28 legacy example pages are indexable and in the sitemap.**
- **Routes:** `/examples/dice/`, `/examples/pg-counter/`, `/examples/switch/` and 25 others; the full
  list is in § 9.
- **Evidence:**
  - These pages are not in the gallery or in search (no `data-pagefind-body`).
  - They are `index, follow` and in `sitemap-0.xml`.
  - The titles repeat: "Counter" ×3, "Tabs" ×3, "Toggle" ×3, "Accordion" ×2, "Input binding" ×2.
- **Fix:** `noindex` and sitemap exclusion for pages the docs only embed; or redirect them to
  their docs walkthrough. **Effort:** S.

**F-08 · The site disagrees with itself about Firefox.**
- **Evidence:**
  - "Firefox is not verified yet" in `introduction.mdx`, `simplify-css.mdx`, `troubleshooting.mdx`
    and the `prevent()` entry;
  - against "a manual Firefox pass for 0.7.1 was user-reported" in `compat.mdx`, `performance.mdx`
    and the library README.
  - Both positions agree that no automated Firefox run exists.
- **Fix:** one sentence everywhere, linking `/docs/compat/`. **Effort:** S.

**F-09 · The ES-module example imports a checkout path.**
- **Route:** `/docs/installation/#es-module`.
- **Evidence:** `import { start, refresh, stop } from './dist/index.js'`, while the same page lists
  the import `reactive-css` (the package's `.` export).
- **Fix:** import from the package name (after F-01). **Effort:** S.

**F-10 · The `on:` reference lists too few triggers and actions.**
- **Route:** `/docs/reference/on/`.
- **Evidence:**
  - `entries.json` (the `on` entry) lists 9 triggers. `describe().events` has 14; the seven 0.5.1
    triggers are missing.
  - `prevent()` is not in the action list; it appears only in the behaviour text.
- **Fix:** list all triggers, or link the two trigger pages; add `prevent()`. **Effort:** S.

**F-11 · Search ranking for broad queries.**
- **Evidence** (`search.mjs`, top six options in the dialog):
  - "Reactive CSS" → `/docs/examples/pointer/` first. The homepage is not indexed, and the
    introduction is not in the top six.
  - "Examples" → `/docs/examples/advanced/` first, the gallery `/examples/` third.
  - "state" → `/docs/examples/history/` first, `/docs/state/` second; `/docs/reference/state/` is
    not in the top six.
  - Canonical pages rank first for "Getting Started", "Installation", "prevent()", "attr:",
    "Custom Bundles", "Bundle Builder", "Browser compatibility", "npm", "CDN", "wave" and "Firefox".
  - "focus:" ranks the focus *trigger* page above the `focus:` declaration.
  - No duplicate results were seen.
- **Fix:** index the introduction more strongly, for example with a short summary on the
  introduction page that names the project (not keyword stuffing). Pagefind's page weight
  (`data-pagefind-weight`) on the gallery and the reference pages for the bare names.
  **Effort:** M.

**F-12 · Redirect stub, robots.txt and 404 page.**
- **Evidence:**
  - `/docs/` is an Astro redirect stub with `<meta http-equiv="refresh" content="2;…">`. axe flags
    it `critical meta-refresh`, `serious html-has-lang`, `moderate landmark-one-main` and
    `page-has-heading-one`.
  - There is no `dist/robots.txt` and no `dist/404.html`.
- **Fix:**
  - a host redirect, or `redirectToDefaultLocale`-style instant redirects;
  - a `robots.txt` with the sitemap URL (after F-03);
  - a designed 404 page.
- **Effort:** S–M.

**F-13 · No social preview image.**
- **Evidence:** `og:image` is missing on all 141 pages (`config/seo.json` `"ogImage": ""`).
- **Effort:** S (needs an image).

**F-14 · Google Fonts on every page and in every preview.**
- **Category:** privacy.
- **Evidence:**
  - all 140 HTML pages link `fonts.googleapis.com` and preconnect to `fonts.gstatic.com`;
  - the preview CSP (`src/lib/examples/srcdoc.ts`) allows both.
  - Each visit therefore sends the visitor's IP address to Google. This can matter under EU law.
- **Fix:** self-host Instrument Sans and Red Hat Mono, then drop the two origins from the preview
  CSP. **Effort:** M.

**F-15 · No site-wide CSP or security headers.**
- **Evidence:**
  - the public pages have no CSP `<meta>`, and there is no host header file (`_headers`,
    `vercel.json`, …);
  - the previews do have a strict per-document CSP (`default-src 'none'`, `script-src 'nonce-…'`).
- **Fix:** host headers: a CSP that allows `'self'` and, if kept, the font origins;
  `X-Content-Type-Options`; `Referrer-Policy`; `frame-ancestors`. **Effort:** S–M, host-dependent.

**F-16 · Dimmed `when()` branches fail contrast.**
- **Routes:** 12, including `/docs/introduction/`, `/docs/conditions/` and `/examples/like/`.
- **Evidence:**
  - axe `serious color-contrast` on `.opacity-30[data-dim]` (the inactive branch of a `when()` in
    code panels);
  - this is deliberate (Design System · 03), and the site's own axe scan excludes `[data-dim]`;
  - it is still text that some users must read.
- **Fix:** raise the opacity to about 0.55, or dim with a strike or underline as well.
  **Effort:** S.

**F-17 · Layout shift on two pages.**
- **Evidence** (`perf.mjs`):
  - `/docs/custom-bundles/` CLS **0.079**: the web-font swap in its text-heavy intro;
  - `/examples/control-center/` **0.029**: the preview grows after load;
  - every other page measured is ≤ 0.013.
- **Fix:** font metric overrides (`size-adjust`), and a reserved preview height. **Effort:** M.

**F-18 · Cost of the previews.**
- **Category:** performance.
- **Evidence:**
  - each preview is a `srcdoc` with the 116 KB runtime inlined. In `perf.mjs` the "Other" bytes
    are about 124 KB per preview;
  - scrolling the whole gallery loads about 2 MB of preview documents. Each card unmounts off
    screen, so CPU stays near idle: 1 ms per 5 s.
  - **Not a blocker** (no long tasks; heap 20 MB on the gallery).
- **Fix later:** load the runtime once per frame from `/runtime/` (same-origin cache) instead of
  inlining it. This needs CSP and sandbox design work. **Effort:** L.

**F-19 · Admin app: undeclared dependencies.**
- **Category:** admin (local only).
- **Evidence.** `vite` and `@vitejs/plugin-react` are used by `admin/server.ts` but are not in
  `site/package.json`; they come from Astro's dependency tree (sub-audit, and
  `admin-control-center.md` § 18).
- **Effort:** S.

### P3 — backlog

- **F-20 · Changelog headings.** `/docs/changelog/` has two `<h1>`: the page title, plus
  CHANGELOG.md's own `# Changelog`.
- **F-21 · Stray « » marks.** `limitations.mdx` writes `**«on:»**`, `**«bind:»**` and
  `**«:changed()»**` (5×), rendered with the marks.
- **F-22 · `closest()` has no version or status.** Its entry key `scope:closest` is not in the
  registry, so `/docs/reference/closest/` shows no "since 0.3".
- **F-23 · Wrong sources cited.**
  - `compat.mdx`, `performance.mdx` and `src/lib/content/engineering.ts` cite "Apple M4 Max,
    macOS 27.0, per the 0.7.0 report". `docs/release-0.7.0.md` has no machine details.
  - `limitations.mdx` says benchmarks "for every release" are in `benchmarks/results.md`, which
    holds one run.
- **F-24 · Stale internal documentation.**
  - `site/README.md` does not link the three newest integration reports, and still links the
    superseded Vision report.
  - `component-guide.md` and `storybook-guide.md` list Vision v1 components and stories.
  - `content-ux-qa.md` and `vision-integration.md` cite `src/content/vision/`, which is now
    `src/content/vanilla/`.
  - `performance.md`'s `/vision/` row is v1.
  - `docs/visual-review/compare-vision-*` compares against the v1 reference.
- **F-25 · Library-side text (outside the site).**
  - `describe()` lists an old attribute set for `state(…, bind())` (`src/core/features.ts`);
    `aria-disabled` and `tabindex` are missing.
  - The library README says "Only the seven listed events are supported" (there are 14) and
    carries a "Status (0.5.0)" header.
- **F-26 · Package size.** The packed tarball is 876 KB with 139 files, including about 1.6 MB of
  source maps, `src/` and `docs/`. Not wrong; confirm it is intended.
- **F-27 · Playground focus indicator.** The editor has no focus indicator besides the caret
  (outline removed on request, 2026-10-20). Keyboard users still see the caret. Consider a subtle
  border change on `:focus-within`.
- **F-28 · No release dates.** `config/releases.json` has 0.8.0 with an empty date and empty URLs,
  and no entries for 0.6.0–0.7.1. CHANGELOG.md has no dates either. The site shows none, and
  invents none: correct, but a public beta would normally date its release.
- **F-29 · The Bundle Builder has no design of its own.** Its only design is Vision v1 § 08, which
  is superseded. The page follows the site's system, and its behaviour is well tested.
- **F-30 · Gaps in visual baselines.** There are none for `/examples/`, `/bundle-builder/`,
  `/docs/custom-bundles/` or `/docs/installation/`. The live values make some of these unstable.
- **F-32 · Homepage count.** The homepage link reads "16 API examples and 18 complete interfaces" (`src/pages/index.astro`, `DEMOS.length`). The gallery shows 12 Interfaces plus 6 Test lab demos.
- **F-31 · Admin minor items** (sub-audit):
  - Vite UI files are served without the token: localhost only, nothing secret;
  - there is a race window between the version check and the rename;
  - every health call loads a fresh copy of the library module (a slow memory growth);
  - a missing config file turns `/api/state` into a 500;
  - the admin's `<title>` equals the public demo's ("Control Center").

## 3. Area findings and verified behaviour

### Homepage (`/`)

- **First screen** at 1440 and 390 (`screens/home-*.jpg`). It says what the project is ("CSS that
  reacts.", "Add state, events, and interactive behavior to familiar CSS"), that a runtime exists
  ("A runtime script does the JavaScript, so you don't write any"), and how to start ("Get
  started", "Open playground", the script tag with Copy). The demo-version notice links
  Installation.
- **Claims:**
  - "521 browser test results · Chromium & WebKit" matches `docs/release-0.8.0.md`; not re-run
    here.
  - "16 API examples and 18 complete interfaces" does **not** match the gallery: its Interfaces group has 12, and the other 6 demos are in Test lab (F-32).
- **Gaps:**
  - the script tag gives `src="reactive-css.min.js"` but no way to get the file (F-02);
  - the first demo teaches the stale `aria-pressed` note (F-05).
- **Not found:** no redundant or contradictory sections, and no unsupported marketing claim.

### Vision (`/vision/`)

- **Implementation:** v2 (the design's five sections). No v1 section remains: `vision.spec.ts`
  checks this, and so did the sweep.
- **Relocated content:**
  - the JavaScript comparison → `/examples/score-history/#vanilla`;
  - metrics → `/docs/performance/`;
  - the Builder → `/bundle-builder/`.
- **Runtime:** the counter and the article run the real runtime; native demos are native CSS.
- **Distinct** from the homepage (what) and the docs (how).
- **Open:** the GitHub button is disabled (F-02).

### Examples

**The 16 API examples.** I verified every row in the production build (`examples.mjs`,
`srcdiff.mjs`):

| # | Example | Library source | In gallery | Route | Real runtime (frame) | Diagnostics | Source = library | API tags = library | Experimental tag | Reference links | Reset | Focusable controls |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `counter` | yes | yes | 200 | 0.8.0, opaque origin, `allow-scripts allow-forms` | 0 | identical | yes: state(), increment(), decrement() | no | 3× 200 | yes | 2 |
| 2 | `state-history` | yes | yes | 200 | 0.8.0, opaque | 0 | identical | yes: previous(), direction() | no | 2× 200 | yes | 2 |
| 3 | `random-colors` | yes | yes | 200 | 0.8.0, opaque | 0 | identical | yes: random(), on() | no | 2× 200 | yes | 1 |
| 4 | `pick-value` | yes | yes | 200 | 0.8.0, opaque | 0 | identical | yes: pick(), set() | yes (`pick` expression, exp. 0.5) | 2× 200 | yes | 1 |
| 5 | `live-values` | yes | yes | 200 | 0.8.0, opaque | 0 | identical | yes: live(), random() | no | 2× 200 | yes | 0 (no interaction by design) |
| 6 | `mouse-tracker` | yes | yes | 200 | 0.8.0, opaque | 0 | identical | yes: mouse() | no | 1× 200 | yes | 0 (pointer only, stated in its README) |
| 7 | `element-size` | yes | yes | 200 | 0.8.0, opaque | 0 | identical | yes: element(), bind: | yes | 2× 200 | yes | 1 |
| 8 | `input-binding` | yes | yes | 200 | 0.8.0, opaque | 0 | identical | yes: bind:, text: | yes | 2× 200 | yes | 1 |
| 9 | `conditional-styles` | yes | yes | 200 | 0.8.0, opaque | 0 | identical | yes: when(), :when() | no | 2× 200 | yes | 3 |
| 10 | `dynamic-attributes` | yes | yes | 200 | 0.8.0, opaque | 0 | identical | yes: attr: | yes | 1× 200 | yes | 2 |
| 11 | `keyboard-controls` | yes | yes | 200 | 0.8.0, opaque | 0 | identical | yes: key(), prevent() | yes | 2× 200 | yes | 2 |
| 12 | `focus-management` | yes | yes | 200 | 0.8.0, opaque | 0 | identical | yes: focus: | yes | 1× 200 | yes | 1 |
| 13 | `state-selection` | yes | yes | 200 | 0.8.0, opaque | 0 | identical | yes: :nth-var() | no | 1× 200 | yes | 6 |
| 14 | `change-animation` | yes | yes | 200 | 0.8.0, opaque | 0 | identical | yes: :changed() | no | 1× 200 | yes | 2 |
| 15 | `viewport` | yes | yes | 200 | 0.8.0, opaque | 0 | identical | yes: viewport() | no | 1× 200 | yes | 0 (reacts to window size) |
| 16 | `visibility` | yes | yes | 200 | 0.8.0, opaque | 0 | identical | yes: visible() | no | 1× 200 | yes | 1 (the scroll box) |

How each column was checked:
- **Real runtime:** `window.ReactiveCSS.version` and `compile` were read inside each sandboxed
  frame (origin `null`).
- **Source = library:** the displayed `style.css` with the live value chips removed, compared with
  the library's file from its Reactive CSS divider: byte-identical for all 16.
- **Experimental tags:** they agree with the registry statuses (`element`, `text:`, `attr:`,
  `focus:`, `prevent()` and the `pick` expression are experimental).

**Behaviour.** The suite's `gallery.spec.ts` (passing) checks, in both engines:
- the counter's DOM text;
- `dynamic-attributes`' real `disabled`;
- `keyboard-controls`' `defaultPrevented`;
- `focus-management`'s `activeElement`;
- lazy mounting.

Every page says "real runtime"; none says "simulated".

**Advanced.**
- `/examples/control-center/` and `/examples/control-center-deep-dive/` render, and their workspace
  tests pass (`examples.spec.ts`, `demos.spec.ts`).
- There are no "Upcoming" cards.
- `wave()` appears only as removed: a reference page "removed in 0.5", and Vision's story.

**Test lab.** 6 library validation demos in their own category, labelled "Browser and runtime edge
cases", separate from the beginner API examples.

**Breadcrumbs.**
- No repeated labels or self-links on the docs pages tested (`gallery.spec.ts`).
- Example detail pages read "Examples / Title" with a category chip.

### Documentation and API

From the docs sub-audit, with spot-checks here:
- **Coverage.** Every registry feature has a reference page whose status and "since" match
  `describe()`, and every shipped feature is in the sidebar. `registry.json` is identical to
  `describe()`, and the "since" values match the CHANGELOG.
- **Unshipped features** are never presented as available: `history()`, `spring()`, `throttle()`,
  `debounce()`, `submit`, `focus(selector)` and the others are listed as not shipped.
- **Snippets** compile with the installed runtime (`compile.test.ts`, `api-coverage.test.ts`,
  passing). The key behaviours are tested in browsers (`api-examples.spec.ts`).
- **Discrepancies:** F-04, F-08, F-10, F-20 to F-23 and F-25.

### Custom Bundles (`/docs/custom-bundles/`)

- **Design:** the approved one, in the docs shell (see `design-parity.md`). No «…» placeholder
  remains: `grep -c "«" src/content/docs/custom-bundles.mdx` returns 0.
- **Commands:** every one shown with an output is run by `bundle-cli.spec.ts` on each test run, in
  a scratch project, and passed. This includes the manifest, the Node API bytes and the browser
  diagnostic.
- **Sizes:** the measured sizes come from the release report and are labelled as such. The
  selection illustration says "nothing is built".

### Bundle Builder (`/bundle-builder/`)

`bundle-builder.spec.ts` and `bundle-cli.spec.ts` (passing) cover:
- reachability from the homepage, footer, Installation and Getting Started;
- core locked, requirements added, reset;
- real profiles with measured sizes;
- shared links, with unknown names reported;
- the output path, format and copy;
- the analyzer, loaded only when used;
- keyboard;
- the builder island loading on its page only;
- CDN URLs shown as text, never as links;
- no overflow at six widths;
- generated builds run with the real CLI and API for representative selections.

What the page does **not** do: download, host or build anything. It says so.

### Installation, npm and CDN

| Destination | Status | Evidence |
|---|---|---|
| npm `reactive-css` | **Unavailable**: the name is taken by another project (F-01) | registry lookup |
| Local pack (`npm pack`) | **Verified** | packed 876 KB, 139 files; contains `dist/reactive-css.min.js`, `.compact.min.js`, `index.js`, `catalog.json`, `tools/reactive-css.mjs` |
| GitHub repository / release | **Unavailable**: no URL anywhere | `config/links.json`, `releases.json` |
| jsDelivr `@0.8.0` | **Unavailable** (404); unpinned path serves the other package | `curl` |
| unpkg `@0.8.0` | **Unavailable** (404) | `curl` |
| Custom bundles | **Verified** (built locally) | adoption test |

**Adoption test**, in isolated directories in the scratchpad:
1. In the copy, `npm run build && npm pack` → `reactive-css-0.8.0.tgz`.
2. In a new project: `npm init -y`, then
   `npm install --save-dev <tgz> <local esbuild> --offline`. esbuild came from the library's own
   `node_modules`, with no network.
3. Getting Started's `index.html` and the homepage like stylesheet were placed in a folder, with
   `reactive-css.min.js` copied from `node_modules/reactive-css/dist/`, and served with
   `python3 -m http.server`.
4. Result: clicking changed the colour (`rgb(87,83,78)` → `rgb(242,84,45)`), with 0 diagnostics,
   version 0.8.0 and 0 console errors. `aria-pressed` stayed `false` (F-05).
5. `npx reactive-css analyze site/ --build site/custom.min.js` printed "Features used: events,
   conditions" and built a 60,026 B bundle.
6. The same page with the custom bundle behaved identically (3 features, 0 diagnostics).

**Result:** the documented path works **for someone with the library checkout**. A public visitor
cannot start (F-02).

### Release information

- **Version 0.8.0 everywhere:** `package.json`, `describe()`, `dist/catalog.json`, the site banner
  and footer, the installation snippets and the CDN URLs (pinned `@0.8.0`).
- **Changelog:** rendered from CHANGELOG.md. The headings for 0.6.0, 0.7.0, 0.7.1 and 0.8.0 match
  word for word.
- **Dates:** none in CHANGELOG.md, the release reports or the site, and none invented (F-28).
  "Published" is never claimed. The demo notice says "not published yet".

### Search, navigation and SEO

- **Navigation:**
  - the header holds Docs, Examples, Vision, Playground and Changelog;
  - the footer has its Learn, Build and Project groups (from `config/links.json`);
  - the sidebar and breadcrumbs follow the content.
- **Internal links:** the link check in `site.spec.ts` passes. The sweep saw 0 failed requests and
  0 non-200 pages across 141 routes.
- **Search:** 110 pages indexed; results under F-11.
- **SEO:** F-03, F-07, F-12 and F-13. Every page has a title and a description, except the
  `/docs/` redirect stub. The only duplicate titles are on legacy pages (F-07). `/docs/changelog/`
  has two `h1` (F-20); every other page has exactly one.

### Responsive

- **Overflow:** `sweep.mjs` found no page-level horizontal overflow on any of the 141 routes at
  320, 375, 390, 768, 1024 or 1440 px.
- **Screenshots:** the captures in `screens/` at 1440 and 390 show no clipped controls or
  overlapping labels. Code scrolls inside its blocks.
- **Long mobile scroll:** the Bundle Builder's summary sits below a long feature list, as its
  report says.

### Accessibility

**Automated:**
- axe (all impacts) on all 141 routes at 1440, iframes excluded: only F-16 (12 pages, deliberate
  dimming) and the `/docs/` stub (F-12).
- The site's own axe test (serious and critical, `[data-dim]` excluded) passes.

**Keyboard** (`keys.mjs`):
- **Search:** ⌘K opens the dialog with focus in the input; ↓ and Enter navigate to the result; Escape
  returns focus to the Search button.
- **Gallery tabs:** they move with the arrow keys and update the hash.
- **Mobile menus:** they use the native Popover API (`popovertarget`), so the browser supplies the
  expanded state and Escape.
- **Missing:** a skip link (F-06).
- **Previews:** keyboard behaviour inside the previews is covered by the suite (`keyboard-controls`,
  `focus-management`, Playground Tab/Escape).

**Not verified:**
- **Screen readers:** never tested. `text:` and `aria-live` announcements, and the inspector's live
  regions, are unverified.
- **Previews:** iframes are excluded from axe, so preview content has only the library's own
  accessibility review.
- **WCAG:** compliance is **not** claimed on the basis of axe.

### Performance

Production build, `astro preview`, unthrottled MacBook. Bytes are as served by the local preview;
compression on a real host will differ.

| Page | JS at load (KB) | Font (KB) | Preview docs after scroll (KB) | CLS | Long tasks | Idle CPU (ms / 5 s) | Heap (MB) | Islands |
|---|---|---|---|---|---|---|---|---|
| `/` | 111.9 | 51.7 | 373 | 0.006 | 0 | 23 | 5.6 | 6 |
| `/vision/` | 72.4 | 51.7 | 247 | 0.002 | 0 | 1 | 4.5 | 3 |
| `/examples/` | 88.1 | 51.7 | 2,012 | 0.004 | 0 | 1 | 20.3 | 17 |
| `/examples/counter/` | 113.4 | 51.7 | 125 | 0.000 | 0 | 2 | 3.8 | 2 |
| `/examples/control-center/` | 121.9 | 51.7 | 133 | **0.029** | 0 | 1 | 5.7 | 2 |
| `/docs/getting-started/` | 72.4 | 51.7 | 124 | 0.004 | 0 | 0 | 3.3 | 4 |
| `/docs/reference/state/` | 72.4 | 51.7 | 124 | 0.006 | 0 | 1 | 3.8 | 2 |
| `/docs/custom-bundles/` | 72.4 | 51.7 | 0 | **0.079** | 0 | 0 | 2.1 | 4 |
| `/playground/` | 117.2 | 51.7 | 124 | 0.001 | 0 | 1 | 3.7 | 2 |
| `/bundle-builder/` | 85.1 | 51.7 | 0 | 0.013 | 0 | 1 | 2.4 | 2 |

- **Floor:** 72.4 KB of JavaScript on every page, mostly React for the search dialog and the code
  panels (the known concern, `performance.md`).
- **Memory:** the Playground heap was 9.54 MB before and 9.54 MB after 30 example switches, with
  one frame left: no leak seen.
- **Blockers:** none. Improvements: F-17 and F-18.

### Security

- **Previews:**
  - `sandbox="allow-scripts allow-forms"` and an opaque origin, verified in every API example;
  - a per-document CSP with `default-src 'none'`, `script-src 'nonce-…'`, `form-action 'none'` and
    `base-uri 'none'`.
- **Messages:**
  - the host accepts a message only when `e.source === iframe.contentWindow`, then validates its
    shape (`parsePreviewMessage`);
  - the bridge accepts only `e.source === parent` with the right source tag and version.
- **Playground:** user code runs only inside that sandbox.
- **Raw HTML insertion:**
  - `set:html` only for build-time Markdown from the library's READMEs and the site's own content;
  - `dangerouslySetInnerHTML` only for Pagefind excerpts, which come from the site's own index.
- **Build output:**
  - third-party requests: Google Fonts only (F-14);
  - no source maps in `dist/`, no secrets, no `target="_blank"` without `rel`.
- **No CSP on the site's own pages** (F-15).
- **Admin** (sub-audit, code read with `path:line` evidence, plus its tests):
  - binds `127.0.0.1` only, with Host checks against DNS rebinding;
  - a per-process 32-byte token with `timingSafeEqual`;
  - `Sec-Fetch-Site` and `Origin` checks, and JSON-only writes capped at 1 MB;
  - writes only six named config files, through an allowlist, a resolve-and-prefix check, and
    atomic temp + fsync + rename;
  - strict zod schemas;
  - no admin code, route, token or endpoint in `dist/` (`admin-exclusion.spec.ts` passes; grep
    confirmed).
  - The public website exposes no write capability.

## 4. Changes since earlier reports

There is no Git history in this audit (no Git commands), so the order below comes from report
dates and file timestamps.

| Area | Then | Now |
|---|---|---|
| Vision | v1 editorial page with comparison, showcase and metrics (2026-10-19) | v2 (2026-10-20); v1 content relocated |
| Examples | `/docs/examples/` list and per-example pages | `/examples/` gallery: 16 API examples, 12 interfaces, 2 advanced, 6 lab; detail pages redesigned twice on 2026-10-20 |
| Custom Bundles | a dense MDX page (0.8.0 pass) | the design layout; CLI outputs tested from the MDX |
| Breadcrumbs | "Docs / Examples / Examples" | fixed; ancestors only |
| Admin | absent | local app with config files; the site reads `config/*.json` at build |
| Tests | Playwright 139 → 168 → 215 → 230 → 341 | 347 passed, 0 failed, in this audit |

**Re-checked claims from earlier reports:**
- **Still true:**
  - "0 overflow at six widths" (now 141 routes);
  - "every snippet compiles";
  - "version agreement";
  - "the Bundle Builder never links CDN URLs";
  - "admin not in the public build".
- **Contradicted:**
  - `performance.md` "CLS under 0.01 on every page" (F-17);
  - `vision-integration.md`'s file paths (F-24).
- **Unresolved:**
  - screen readers;
  - Firefox;
  - the content-ux-qa "unidentified flake": none appeared in this run;
  - the React-on-every-page cost;
  - publication.

## 5. Not verified in this audit

- **Firefox**, real Chrome and Safari, and real devices.
- **Screen readers.**
- **The library's own suites** (102 unit, 521 browser results).
- **Visual parity** of the Control Center, Deep Dive, Design system, reference pages and the
  admin's screens (relied on earlier reviews).
- **Behaviour on the real host:** headers, compression, redirects.

## 6. Appendix: route inventory (141 routes)

"Not in search" means the page has no `data-pagefind-body`.

| URL | Title | Type | Source | Design | Audit notes |
|---|---|---|---|---|---|
| `/` | Reactive CSS · CSS that reacts. | Homepage | src/pages/index.astro | Home.dc.html | not in search |
| `/bundle-builder/` | Bundle Builder | Tool | src/pages/bundle-builder.astro | Vision v1 §08 (superseded) | — |
| `/design-system/` | Design system | Design system | src/pages/design-system.astro | Design System.dc.html | not in search; axe: color-contrast |
| `/docs/` | Redirecting to: /docs/introduction/ | Redirect to /docs/introduction/ | Astro redirect | — | 0 h1; axe: html-has-lang, landmark-one-main, meta-refresh, page-has-heading-one, region |
| `/docs/binding/` | Data Binding | Docs page | src/content/docs/ | Docs.dc.html | — |
| `/docs/changelog/` | Changelog | Docs page | src/content/docs/ | Docs.dc.html | 2 h1 |
| `/docs/compat/` | Browser Compatibility | Docs page | src/content/docs/ | Docs.dc.html | — |
| `/docs/conditions/` | Conditions | Docs page | src/content/docs/ | Docs.dc.html | axe: color-contrast |
| `/docs/core-concepts/` | Core Concepts | Docs page | src/content/docs/ | Docs.dc.html | — |
| `/docs/custom-bundles/` | Custom Bundles | Docs page | src/content/docs/ | Docs.dc.html | — |
| `/docs/events/` | Events & Actions | Docs page | src/content/docs/ | Docs.dc.html | — |
| `/docs/examples/` | Example walkthroughs | Docs walkthrough | src/content/docs/examples/ | Docs.dc.html | — |
| `/docs/examples/accordion/` | Accordion | Docs walkthrough | src/content/docs/examples/ | Docs.dc.html | axe: color-contrast |
| `/docs/examples/advanced/` | Advanced Examples | Docs walkthrough | src/content/docs/examples/ | Docs.dc.html | — |
| `/docs/examples/counter/` | Counter | Docs walkthrough | src/content/docs/examples/ | Docs.dc.html | — |
| `/docs/examples/dropdown/` | Dropdown | Docs walkthrough | src/content/docs/examples/ | Docs.dc.html | — |
| `/docs/examples/form/` | Live form preview | Docs walkthrough | src/content/docs/examples/ | Docs.dc.html | — |
| `/docs/examples/geometry/` | Element geometry | Docs walkthrough | src/content/docs/examples/ | Docs.dc.html | — |
| `/docs/examples/history/` | State-history animation | Docs walkthrough | src/content/docs/examples/ | Docs.dc.html | — |
| `/docs/examples/pointer/` | Reactive pointer | Docs walkthrough | src/content/docs/examples/ | Docs.dc.html | — |
| `/docs/examples/tabs/` | Tabs | Docs walkthrough | src/content/docs/examples/ | Docs.dc.html | — |
| `/docs/examples/theme/` | Theme switcher | Docs walkthrough | src/content/docs/examples/ | Docs.dc.html | — |
| `/docs/examples/toggle/` | Toggle | Docs walkthrough | src/content/docs/examples/ | Docs.dc.html | axe: color-contrast |
| `/docs/geometry/` | Geometry & Animation | Docs page | src/content/docs/ | Docs.dc.html | — |
| `/docs/getting-started/` | Getting Started | Docs page | src/content/docs/ | Docs.dc.html | — |
| `/docs/history/` | State History | Docs page | src/content/docs/ | Docs.dc.html | — |
| `/docs/installation/` | Installation | Docs page | src/content/docs/ | Docs.dc.html | — |
| `/docs/introduction/` | Introduction | Docs page | src/content/docs/ | Docs.dc.html | axe: color-contrast |
| `/docs/limitations/` | Limitations | Docs page | src/content/docs/ | Docs.dc.html | — |
| `/docs/performance/` | Performance and Tests | Docs page | src/content/docs/ | Docs.dc.html | — |
| `/docs/reactive-values/` | Reactive Values | Docs page | src/content/docs/ | Docs.dc.html | — |
| `/docs/reference/` | API Reference | Docs page | src/content/docs/ | Docs.dc.html | — |
| `/docs/reference/attr-declaration/` | attr: | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/attr/` | attr() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/bind/` | bind: | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/changed/` | :changed() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/closest/` | closest() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/cycle/` | cycle() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/decrement/` | decrement() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/direction/` | direction() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/element/` | element() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/focus-declaration/` | focus: | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/increment/` | increment() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/just-checked/` | :just-checked | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | axe: color-contrast |
| `/docs/reference/just-unchecked/` | :just-unchecked | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/key/` | key() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/lifecycle-triggers/` | Focus, reset, animation and transition triggers | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/live/` | live() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/mouse/` | mouse() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/nth-var/` | :nth-var() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/on-value/` | on() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/on/` | on: | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/outside/` | outside() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/pick-expression/` | pick() in state() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/pick/` | pick() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/prevent/` | prevent() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/previous/` | previous() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/random/` | random() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/set/` | set() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/split/` | split() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/state/` | state() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/text/` | text: | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/toggle/` | toggle() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/triggers/` | Triggers | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/typed/` | typed() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/viewport/` | viewport() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/visible/` | visible() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/wave/` | wave() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/when-selector/` | :when() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/reference/when/` | when() | API reference | src/pages/docs/reference/[id].astro | Docs.dc.html | — |
| `/docs/selectors/` | Dynamic Selectors | Docs page | src/content/docs/ | Docs.dc.html | — |
| `/docs/simplify-css/` | Simplify CSS | Docs page | src/content/docs/ | Docs.dc.html | — |
| `/docs/state/` | State | Docs page | src/content/docs/ | Docs.dc.html | — |
| `/docs/troubleshooting/` | Troubleshooting | Docs page | src/content/docs/ | Docs.dc.html | — |
| `/examples/` | Examples | Examples gallery | src/pages/examples/index.astro | Examples.dc.html | — |
| `/examples/accessible-tabs/` | Accessible tabs | Library demo detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/accessible-toggle/` | Accessible toggle button | Library demo detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/accordion/` | Accordion | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap; axe: color-contrast |
| `/examples/attribute-playground/` | Attribute playground | Library demo detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/change-animation/` | Change animation | API example detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/check/` | Task list | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap; axe: color-contrast |
| `/examples/compare-typed/` | Typed custom properties | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap |
| `/examples/compare-when/` | Conditional values | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap |
| `/examples/compare-whensel/` | Conditional style blocks | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap |
| `/examples/conditional-styles/` | Conditional styles | API example detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/control-center-deep-dive/` | Control Center · Deep Dive | Advanced workspace | src/pages/examples/control-center*.astro | Control Center*.dc.html | — |
| `/examples/control-center/` | Control Center | Advanced workspace | src/pages/examples/control-center*.astro | Control Center*.dc.html | — |
| `/examples/counter/` | Counter | API example detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/dice/` | Dice and random words | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap |
| `/examples/dropdown/` | Dropdown menu | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap |
| `/examples/dynamic-attributes/` | Dynamic attributes | API example detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/element-size/` | Element size | API example detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/focus-management/` | Focus management | API example detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/focus-transitions/` | Focus transitions | Library demo detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/form-interactions/` | Form interactions | Library demo detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/form-validation/` | Form validation | Library demo detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/form/` | Form binding | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap |
| `/examples/geometry/` | Element geometry | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap |
| `/examples/greeting/` | Greeting | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap |
| `/examples/history-motion/` | History and motion | Library demo detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/history/` | Counter with history | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap |
| `/examples/home-like/` | Like button | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap |
| `/examples/input-binding/` | Input binding | API example detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/interactive-quiz/` | Interactive quiz | Library demo detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/keyboard-controls/` | Keyboard controls | API example detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/keyboard-navigation/` | Keyboard navigation | Library demo detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/keyboard-playground/` | Keyboard playground | Library demo detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/like/` | Like button | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap; axe: color-contrast |
| `/examples/live-form-preview/` | Live form preview | Library demo detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/live-values/` | Live values | API example detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/mouse-tracker/` | Mouse tracker | API example detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/multi-step-wizard/` | Multi-step wizard | Library demo detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/nested-cascade/` | Nested state and cascade | Library demo detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/notification-center/` | Notification center | Library demo detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/pg-counter/` | Counter | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap |
| `/examples/pg-input/` | Input binding | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap |
| `/examples/pg-tabs/` | Tabs | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap |
| `/examples/pg-toggle/` | Toggle | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap; axe: color-contrast |
| `/examples/pick-value/` | Pick a value | API example detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/pointer/` | Pointer position | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap |
| `/examples/pricing/` | Pricing toggle | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap; axe: color-contrast |
| `/examples/product-configurator/` | Product configurator | Library demo detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/profile/` | Live profile | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap |
| `/examples/random-colors/` | Random colors | API example detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/score-history/` | Score history | Library demo detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/score/` | Score trend | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap |
| `/examples/settings-panel/` | Settings panel | Library demo detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/shopping-cart/` | Shopping cart | Library demo detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/size/` | Text size | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap |
| `/examples/spotlight/` | Pointer spotlight | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap |
| `/examples/state-history/` | State history | API example detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/state-selection/` | State selection | API example detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/switch/` | Toggle | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap; axe: color-contrast |
| `/examples/tabs/` | Tabs | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap |
| `/examples/theme/` | Theme switcher | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap |
| `/examples/viewport/` | Viewport tracking | API example detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/visibility/` | Visibility detection | API example detail | src/pages/examples/[id].astro | Examples.dc.html | — |
| `/examples/vision-panel/` | Panel with state, binding and DOM text | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap |
| `/examples/wizard/` | Step navigator | Legacy site example | src/pages/examples/[id].astro (ExampleBlock) | — | not in search; indexable, in sitemap |
| `/playground/` | Playground | Playground | src/pages/playground.astro | Playground.dc.html | — |
| `/vision/` | Vision | Vision | src/pages/vision.astro | Vision v2.dc.html | — |

