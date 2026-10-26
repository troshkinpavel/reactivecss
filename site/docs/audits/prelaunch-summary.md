# Pre-launch audit: executive summary

**Date:** 2026-10-20. **Subject:** the Reactive CSS website (`site/`), library 0.8.0 (local,
unpublished), and local maintainer tooling (since moved out of the repository).

**Documents:**
- [prelaunch-audit.md](prelaunch-audit.md): findings, evidence, the route inventory and the
  16-example matrix;
- [design-parity.md](design-parity.md);
- [launch-checklist.md](launch-checklist.md);
- [prelaunch-backlog.md](prelaunch-backlog.md);
- screenshots in [screens/](screens/).

## Update, 2026-10-21

WP-2 (production SEO) and WP-3 (documentation accuracy) are done; see the resolution log at the top of `prelaunch-audit.md`.
- **Fixed:** 14 findings, including F-03 (canonical `https://reactivecss.com`).
- **False positive:** F-20.
- **New:** F-33, visual baseline drift (P2).
- **Still open from P0/P1:**
  - F-01 and F-02: the package name and the distribution channel, your decision;
  - F-06: the skip link (WP-4).

## Verdict

**Not ready for a public beta yet. The cause is distribution and configuration, not the site's
quality.** The website itself is in good shape:
- all checks pass;
- no page overflows;
- every example runs the real runtime;
- the docs match the API, with a few exceptions.

The blockers:
1. There is no way for a public visitor to obtain Reactive CSS.
2. The npm name the docs rely on belongs to someone else.
3. The build still points search engines at `localhost`.

## Findings by severity

| Severity | Count | IDs |
|---|---|---|
| P0 launch blocker | 3 | F-01 npm name taken, F-02 no public distribution channel, F-03 canonical/sitemap = localhost |
| P1 fix before beta | 3 | F-04 `when()` reference, F-05 Getting Started accessibility tip, F-06 no skip link |
| P2 soon after | 13 | F-07 to F-19 |
| P3 backlog | 13 | F-20 to F-32 |

**Must verify before beta:** screen readers (never tested) and Firefox (never automated).

## Main blockers

- **F-01 · The npm name belongs to someone else.**
  - `reactive-css` on npm is another project (0.1.0, 2017–2022).
  - `npx reactive-css`, the CDN URLs and the package name in the docs all assume this name.
  - An unpinned jsDelivr URL already serves the other project's code.
- **F-02 · No public channel.** Installation means "a library checkout plus `npm pack`", but:
  - no repository is public;
  - no package is published;
  - no download is offered, although the file is served at `/runtime/reactive-css.min.js` for the
    previews.
- **F-03 · Localhost metadata.** `config/seo.json` `canonical` is `http://localhost:4321`. All 141
  canonicals, `og:url` values and sitemap entries point there.

## Already complete and verified in this audit

- **Build and tests:**
  - typecheck 0 errors;
  - unit 311;
  - Storybook 99;
  - Playwright 347 passed and 0 failed (Chromium + WebKit);
  - build 141 pages, 110 indexed.
- **Every route:**
  - 141 routes return 200, with 0 console errors and 0 failed requests;
  - no horizontal overflow at 320, 375, 390, 768, 1024 or 1440 px;
  - axe: only deliberate dimming and the `/docs/` redirect stub.
- **The 16 API examples:**
  - each has library source, a gallery card and a route;
  - each runs the real 0.8.0 runtime in a sandboxed, opaque-origin frame, with 0 diagnostics;
  - the displayed source is byte-identical to the library's;
  - tags and experimental status match the registry, reference links resolve, and Reset works.
- **Docs and API:** every registry feature has a reference page with the correct status and
  version; nothing unshipped is presented as available.
- **Custom Bundles:** every command shown is executed by the test suite. The adoption test
  (pack → install → analyze → build → run) worked.
- **Vision:** v2 implemented; v1 content removed or relocated.
- **Release metadata:** 0.8.0 is consistent everywhere, no publication is claimed, and no dates
  are invented.
- **Security:**
  - previews sandboxed, with strict CSP and validated messages;
  - local maintainer tooling is absent from the public build.
- **Performance:**
  - no long tasks;
  - idle CPU ≤ 23 ms per 5 s;
  - no Playground memory growth;
  - CLS ≤ 0.013, except Custom Bundles (0.079) and Control Center (0.029).

## Areas still to verify

- **Assistive technology:** screen readers. Firefox; real Chrome and Safari; real devices.
- **Not re-run here:** the library's own test suites. Visual parity of the Control Center, Design
  system and reference pages, (earlier reviews only).
- **Hosting:** headers, compression and redirects on the real host.

## Launch readiness

| Area | Status | Blocking |
|---|---|---|
| Homepage | Needs work | F-02 (script tag without a source), F-05 |
| Vision v2 | Ready | GitHub button waits on F-02 |
| Examples | Ready | — |
| Advanced Examples | Ready (behaviour tested; visual not re-compared) | — |
| Documentation | Needs work | F-04, F-05 |
| API Reference | Needs work (minor) | F-04 |
| Playground | Ready | — |
| Custom Bundles | Ready, apart from the package name (F-01) | F-01 |
| Bundle Builder | Ready, apart from the package name (F-01) | F-01 |
| Installation | **Not ready** | F-01, F-02 |
| npm / CDN | **Not ready**: unavailable | F-01, F-02 |
| Search | Ready (ranking improvements later) | — |
| SEO | **Not ready** | F-03 |
| Accessibility | Needs work and verification | F-06; screen readers unverified |
| Performance | Ready | — |
| Security | Ready for a static site; headers advised | — |

## Recommended launch sequence

1. **Decide** the package name, the repository and the distribution channel (WP-1 decisions).
2. **In parallel:**
   - WP-1: rename, links and installation path;
   - WP-2: production SEO config, robots, 404, legacy `noindex`;
   - WP-3: doc corrections;
   - WP-4: skip link.
3. **Verify:** a screen-reader pass and a Firefox pass (WP-4).
4. **Publish:** the repository, release and package, then the CDN checks (checklist § Publication
   day).
5. **Rebuild** with the published status, and deploy.
6. **Soon after launch:** search relevance, self-hosted fonts and headers, performance, and
   internal-doc hygiene.

## To disclose publicly at beta

- Experimental status: syntax may change. Experimental features are marked.
- Tested automatically in Chromium and WebKit only. Firefox status, as found by the Firefox pass.
- Not tested with screen readers, unless WP-4 does it.
- Reactive CSS needs its JavaScript runtime. It is not a CSS standard or a proposal.
