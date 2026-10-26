# Launch checklist: public experimental beta

From the pre-launch audit of 2026-10-20. IDs refer to findings in `prelaunch-audit.md`.

## Must fix before beta

These cannot be shipped as they are.

- [ ] **F-01 Distribution name.** The npm name `reactive-css` belongs to an unrelated package
      (0.1.0, maintainer `itsjonq`, 2017). Choose the published name, or obtain a transfer. Then
      update:
      - `package.json`;
      - every `npx reactive-css …`;
      - the CDN URLs (`src/components/mdx/Bundles.astro`);
      - `config/links.json`;
      - the docs that name the package.
- [ ] **F-02 A public way to get the runtime.** Today the only documented path is a library
      checkout plus `npm pack`, and no public repository exists. Before beta, at least one of these
      must be live and linked:
      - the npm package;
      - a public repository with a release;
      - a documented download of `reactive-css.min.js`.
- [x] **F-03 Canonical URL.** Set to `https://reactivecss.com` on 2026-10-21. The build warns if it is ever localhost again; robots.txt, `og:url` and the sitemap follow it. `config/seo.json` `canonical` is `http://localhost:4321`. Every page's
      `<link rel="canonical">`, `og:url` and the sitemap point at localhost. Set the production
      `https://` origin and rebuild.
- [x] **F-04 `when()` reference.** (fixed 2026-10-21) The page says `if-true` is required. The runtime accepts
      `when(condition)`, and other pages say so.
- [x] **F-05 Getting Started accessibility tip.** (fixed 2026-10-21) It says `aria-pressed` can't follow state, which
      has been untrue since `attr:` (0.5.3). Teach `attr: aria-pressed when(--liked)` or the
      checkbox pattern.
- [ ] **F-06 Skip link.** Docs pages put the header and about 40 sidebar links before the
      content, and no page has a skip link.

## Must verify before beta

These were not verified, or only partly verified.

- [ ] **Screen readers.** Never tested by anyone (every report says so). Test at least VoiceOver
      with Safari and NVDA with Firefox on:
      - the homepage demos;
      - one API example (`text:` / `focus:` announcements);
      - search, the docs navigation and the Bundle Builder.
- [ ] **Firefox.** Automated Firefox has never run (Playwright's Firefox does not start on this
      machine). Run the e2e suite or a manual pass in Firefox, and record its version. Then make
      the wording consistent (F-08).
- [ ] **Real Chrome and Safari.** The automated runs use Playwright's Chromium and WebKit builds,
      not the shipped browsers.
- [ ] **Hosting.** Confirm the chosen host:
      - serves `trailingSlash: 'always'` routes;
      - can return HTTP redirects instead of the 2-second meta refresh on `/docs/` (F-12);
      - can send security headers (F-15).
- [ ] **After F-01 and F-02:** repeat the adoption test from the published channel, with no
      local pack:
      1. Install.
      2. Run `npx <name> analyze`, then build.
      3. Load the built file and check `ReactiveCSS.diagnostics`.

## Can defer until after beta

- [x] F-07 Legacy example pages (28) noindex and out of the sitemap (fixed 2026-10-21).
- [x] F-08 Firefox wording consistency (fixed 2026-10-21).
- [ ] F-09 ES-module example imports `./dist/index.js`, not the package name.
- [x] F-10 `on:` reference trigger and action lists (fixed 2026-10-21).
- [ ] F-11 Search ranking: "Reactive CSS", "Examples" and "state".
- [x] F-12 `/docs/` redirect, `robots.txt`, 404 page (fixed 2026-10-21; a host-level redirect is still preferable).
- [x] F-13 `og:image` (fixed 2026-10-21).
- [ ] F-14 Google Fonts requested from Google on every page and in every preview (privacy).
- [ ] F-15 No site-wide CSP or security headers.
- [ ] F-16 Dimmed `when()` branches fail contrast (by design, excluded from the site's scan).
- [ ] F-17 Layout shift: Custom Bundles 0.079 (font swap), Control Center 0.029.
- [ ] F-18 Each preview inlines the 116 KB runtime; the full gallery loads about 2 MB of preview documents.
- [x] F-19 Local tooling dependencies: no longer applies (the tool is not in this repository).
- [ ] F-20 to F-32: P3 backlog (see `prelaunch-backlog.md`). Fixed on 2026-10-21: F-21, F-22, F-23, F-32; F-20 was a false positive.
- [ ] F-33 Visual baselines can drift under the 1% tolerance: review and refresh them.

## Publication-day checks

Run these in order on the day.

1. [ ] Rebuild with the final `config/seo.json`. In `dist/`:
       - `grep -r localhost dist/` finds no canonical, `og:url` or sitemap entries;
       - `dist/sitemap-0.xml` lists `https://…`.
2. [ ] Publish the package. Confirm it with a read-only check:
       - `npm view <name>@0.8.0 version bin exports`;
       - the files are present: `dist/reactive-css.min.js`, `dist/reactive-css.compact.min.js`,
         `dist/index.js`, `dist/catalog.json`, `tools/reactive-css.mjs`.
3. [ ] Check the CDN: these return 200 with the expected bytes (SHA-256 equal to the local
       `dist/`):
       - `https://cdn.jsdelivr.net/npm/<name>@0.8.0/dist/reactive-css.min.js`;
       - the matching unpkg URL.
4. [ ] Only then:
       - set `published: true` in the package metadata the site reads;
       - make the npm, jsDelivr and unpkg links visible in `config/links.json`;
       - fill `config/releases.json` (date, URLs);
       - rebuild the site, so the "not published yet" notices and illustrative-URL callouts go.
5. [ ] Update the homepage notice (`config/announcements.json`). It currently says "not published
       yet".
6. [ ] Enable the GitHub link on Vision once the repository is public.
7. [ ] Run `npm run verify` on the final build.
8. [ ] Smoke test the deployed site: home, `/docs/getting-started/`, one example, search, the
       Bundle Builder copy buttons, and `/playground/`.
9. [ ] Confirm that `/api/*` returns 404 on the deployment.
