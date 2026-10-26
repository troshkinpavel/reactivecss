# Pre-launch backlog

These are work packages from the 2026-10-20 audit. Each one is sized for one agent and lists the
findings it closes (see `prelaunch-audit.md`). Packages that touch different files can run at the
same time.

## The smallest set for a public beta

**WP-1**, **WP-2** and **WP-3** below, plus the two verifications in WP-4. Everything else can follow
the launch.

---

## WP-1 · Distribution and release readiness (blocks launch)

- **Closes:** F-01, F-02, F-28; prepares F-09.
- **Decisions first (the user's):**
  - the published package name;
  - the public repository URL;
  - whether the beta ships through npm, a GitHub release, or a direct download.
- **Scope:**
  - Rename the package in the library's `package.json`. The site's install command, CDN URLs and
    CLI name derive from it: `src/lib/bundles/command.ts` (`BIN`) and
    `src/components/mdx/Bundles.astro`. Check that `npx <bin>` matches the new `bin` key.
  - Replace the hand-written `npx reactive-css` and `reactive-css/bundle` text in the MDX:
    `custom-bundles.mdx`, `installation.mdx`, `getting-started.mdx` and the Vision copy, if it
    names the package.
  - Add the repository and download links:
    - `config/links.json` (a Repository link; npm, jsDelivr and unpkg stay hidden until they are
      live);
    - `config/releases.json` (the 0.8.0 date and URLs);
    - Vision's GitHub button (`src/pages/vision.astro`).
  - Make Installation's first section a path a stranger can follow, and update Getting Started's
    "Where to get it".
- **Then the publication itself.** It is outside the site, and the user does it: publish,
  release, then the CDN checks in `launch-checklist.md` § Publication day.
- **Files:**
  - in the library: `package.json`;
  - in the site: `config/*.json`, `src/content/docs/{installation,getting-started,custom-bundles}.mdx`,
    `src/pages/vision.astro`, `tests/e2e/bundle-cli.spec.ts` (it runs the commands it reads from
    the MDX).
- **Dependencies:** the decisions above. It conflicts with WP-3 only in `installation.mdx` and
  `getting-started.mdx`, so sequence WP-3's edits to those files after WP-1, or have one agent own
  both files.
- **Effort:** M (excluding publication).

## WP-2 · Production SEO configuration (blocks deployment) — done 2026-10-21

**Status:** done, including the canonical origin `https://reactivecss.com`.

- **Closes:** F-03, F-12 (robots, 404, redirect), F-13, F-07.
- **Scope:**
  - Set `config/seo.json` `canonical` to the production `https://` origin. Add `ogImage`, which
    needs an image asset.
  - Add `public/robots.txt` pointing at `sitemap-index.xml`.
  - Add a `src/pages/404.astro` in the site's style.
  - Replace the `/docs/` meta-refresh stub: a host redirect, or a zero-delay redirect with `lang`
    and a heading.
  - Mark the 28 legacy example pages `noindex` and exclude them from the sitemap, or redirect each
    to its docs walkthrough. They are produced by `src/pages/examples/[id].astro`'s legacy branch.
- **Files:** `config/seo.json`, `astro.config.mjs` (the sitemap filter), `public/`,
  `src/pages/404.astro`, `src/pages/examples/[id].astro`, `src/layouts/BaseLayout.astro` (the
  `robots` meta per page).
- **Tests:** a site.spec check that no `localhost` appears in canonical, `og:url` or the sitemap
  of a production build.
- **Effort:** S–M. Runs alongside WP-1 and WP-3.

## WP-3 · Documentation accuracy (fix before beta) — done 2026-10-21, except F-09

**Status:** done except F-09 (it waits on the package name). F-20 was a false positive: the extra `h1` is hidden from the accessibility tree.

- **Closes:** F-04, F-05, F-08, F-09 (after WP-1 names the package), F-10, F-20, F-21, F-22, F-23,
  F-32.
- **Scope:**
  - `when()`: mark `if-true` optional and document `when(condition)` → true/false.
  - Getting Started: correct the accessibility tip.
    - Option one: add `attr: aria-pressed when(--liked);` to `src/examples/like/style.css`,
      marked experimental. That file is shared with the homepage demo; update its README note and
      the tests that assert `aria-pressed` stays false.
    - Option two: keep the code and correct the sentence to point at `attr:`.
  - One consistent Firefox sentence that links `/docs/compat/`.
  - `on:`: the full trigger list, or links to both trigger pages; add `prevent()` to the actions.
  - The changelog page: render CHANGELOG.md's `# Changelog` as a non-`h1`, or drop it.
  - `limitations.mdx`: replace the « » marks with code formatting.
  - `closest()`: give it a version and status (the registry has no `scope:closest`; add a manual
    `since`, or a site-side mapping).
  - Correct the machine-details source, and the "benchmarks for every release" claim.
  - Homepage count: "12 complete interfaces and 6 test cases", or count the Interfaces group only.
- **Files:** `src/content/api/entries.json`, `src/content/docs/*.mdx`, `src/examples/like/`,
  `src/pages/index.astro`, `src/lib/content/engineering.ts`, `src/pages/docs/[...slug].astro` (the
  changelog).
- **Tests:** api-coverage and compile tests still pass; add a check that `when(--x)` with one
  argument is documented as valid.
- **Effort:** M.

## WP-4 · Accessibility (part fix, part verification before beta)

- **Closes:** F-06; verifies the screen-reader and Firefox gaps; optionally F-16 and F-27.
- **Scope:**
  - **Fix:** a "Skip to content" link as the first focusable element in `BaseLayout`/`AppShell`,
    targeting `main` (all pages). Add an e2e check.
  - **Verify (manual, recorded in a report with versions):**
    - VoiceOver with Safari, and NVDA or JAWS with Firefox;
    - flows: home (the hero demo and the before/after tabs), one API example (`input-binding`,
      `focus-management`), search, the docs sidebar on mobile, and the Bundle Builder;
    - a Firefox run of the e2e suite, or a manual pass, with the browser version.
  - **Optional:**
    - raise the contrast of the dimmed `when()` branches (F-16);
    - a subtle focus indication on the Playground editor (F-27).
- **Files:** `src/layouts/*.astro`, `src/components/code/CodePanel.tsx` (the dimming),
  `src/components/examples/Playground.tsx`.
- **Effort:** S for the fixes. Verification: M, human time.

## WP-5 · Search relevance (after launch)

- **Closes:** F-11.
- **Scope:**
  - Make the introduction answer "Reactive CSS". Consider indexing the homepage hero text.
  - Weight the gallery for "examples", and the reference pages for bare API names.
  - Re-run the queries in `prelaunch-audit.md` § F-11.
- **Files:** `src/pages/index.astro`, `src/content/docs/introduction.mdx`,
  `src/pages/examples/index.astro`, `src/pages/docs/reference/[id].astro`.
- **Effort:** M.

## WP-6 · Privacy and headers (soon after launch, or before for an EU audience)

- **Closes:** F-14, F-15.
- **Scope:**
  - Self-host the two font families (WOFF2 subsets) and remove the Google origins from
    `BaseLayout` and from the preview CSP (`src/lib/examples/srcdoc.ts`).
  - Add the host's security headers: CSP with `'self'`, `X-Content-Type-Options`,
    `Referrer-Policy` and `frame-ancestors`.
- **Dependencies:** the hosting choice.
- **Effort:** M.

## WP-7 · Performance (after launch)

- **Closes:** F-17, F-18.
- **Scope:**
  - Font metric overrides to remove the swap shift (works best with WP-6's self-hosted fonts).
  - Reserve the Control Center preview's height.
  - Evaluate loading the runtime once per frame instead of inlining 116 KB in each `srcdoc`. This
    needs CSP and sandbox design work.
  - Optionally, hydrate search on first use (the React floor of about 72 KB).
- **Effort:** M–L.

## WP-8 · Internal documentation and backlog hygiene (any time)

- **Closes:** F-24, F-25 (the library-side text, for the library owner), F-26, F-29, F-30, F-31,
  F-19.
- **Scope:**
  - Update `site/README.md`'s report list, `component-guide.md` and `storybook-guide.md`.
  - Fix the stale paths in the older reports.
  - Refresh `docs/visual-review` with a Vision v2 comparison.
  - Add visual baselines where the pages are stable.
  - Declare `vite` and `@vitejs/plugin-react` in `site/package.json`.
  - Confirm the package contents are intended.
- **Effort:** M.
