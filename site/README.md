# Reactive CSS documentation site

Astro + MDX site for Reactive CSS, implemented from the project's Claude Design files (kept locally,
not in the repository). It is a separate, private npm project inside the library repository and is
never published to npm.

```bash
cd site
npm install
npm run dev              # http://localhost:4321 (syncs the runtime from ../dist first)
npm run storybook        # http://localhost:6006
npm run build            # static site in dist/, plus the Pagefind search index
npm run preview          # serve dist/
```

Site configuration (footer links, announcements, feature visibility, SEO defaults, release
metadata) lives in `config/*.json` and is validated at build time (`src/lib/config/schema.ts`).
The maintainers edit it with a local admin tool that is not part of the repository; editing the
JSON by hand works the same.

The site reads the library's built bundle and `describe()` registry from `../dist`. Build the
library first (`npm run build` in the repository root).

| Command | Checks |
|---|---|
| `npm run typecheck` | `astro check`, TypeScript strict |
| `npm test` | Unit tests: highlighter, analyzer, workspace model, registry consistency, API coverage against the registry and bundle catalog, runtime version consistency, library demos, every presented Reactive CSS snippet compiling with the installed runtime, vanilla comparison sources |
| `npm run api-coverage` | Writes the API coverage matrix to `docs/api-coverage.json` |
| `npm run test:stories` | Every Storybook story renders and every play function passes |
| `npm run test:e2e` | Playwright, Chromium and WebKit, against the production build: examples with the real runtime, library demos (DOM text, attributes, focus, `prevent()`), the vanilla/Reactive CSS parity comparison, Playground, links, search, navigation, mobile down to 320 px, axe, screenshots |
| `npm run test:visual` | Screenshot regression only |
| `npm run verify` | All of the above, in order |
| `npm run visual-review` | Design vs implementation captures in `docs/visual-review/` (needs the local design files) |
| `npm run measure` | Performance numbers in `docs/performance-results.json` (`node scripts/measure-builder.mjs`: bundle builder costs in `docs/bundle-builder-performance.json`) |

Documentation for developers:

- [Architecture](docs/architecture.md): structure, integration with the library, how examples run, decisions, limitations
- [Component guide](docs/component-guide.md): creating components, tokens, inventory
- [Storybook guide](docs/storybook-guide.md)
- [Content authoring](docs/content-authoring.md): MDX pages, API reference, comparisons
- [Example authoring](docs/example-authoring.md): runnable examples and their tests
- [Design inventory](docs/design-inventory.md), [visual review](docs/visual-review/README.md), [performance](docs/performance.md)
- [Vision integration](docs/vision-integration.md), [content and UX QA](docs/content-ux-qa.md), [API coverage audit](docs/api-coverage-audit.md), [bundle builder, npm and CDN](docs/bundle-builder-integration.md)

Browsers verified: Chromium and WebKit (Playwright engine builds). Firefox is not verified.
