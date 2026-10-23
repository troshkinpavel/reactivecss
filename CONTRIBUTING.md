# Contributing to Reactive CSS

Thank you for your interest. Reactive CSS is experimental (0.9), so the language can still change. Please open an issue to discuss a new feature or a syntax change before you write code for it.

## Reporting a bug

Open an issue with:

- the smallest HTML and CSS that shows the problem;
- what you expected, and what happened;
- the browser and its version;
- the output of `ReactiveCSS.diagnostics` in the console. Production bundles report codes such as `RCSS-P001⟦…⟧`: decode them with `npx -p @reactivecss/core reactive-css explain "<code>"`, or use the development build `reactive-css.js`.

Report security problems privately, as described in [SECURITY.md](SECURITY.md), not in a public issue.

## Development setup

Node.js 22 or later.

```bash
npm ci
npm run build
```

| Command | Checks |
|---|---|
| `npm run typecheck` | TypeScript, strict |
| `npm test` | Unit tests |
| `npm run test:browser` | Browser tests in Chromium and WebKit (`npx playwright install chromium webkit` first) |
| `npm run test:dist` | The built files: a plain page, a Node import and a TypeScript consumer |
| `npm run test:firefox` | Browser tests in Firefox, where Playwright's Firefox starts |
| `npm run verify` | All of the above |

The website is a separate npm project in `site/`. See [site/README.md](site/README.md) for its commands and tests.

## Pull requests

- Keep a pull request to one change, with tests for new behavior and for fixed bugs.
- Run `npm run typecheck`, `npm test` and `npm run test:browser` before you open it. Run the site's tests too when you change `site/` or anything the site shows.
- Add an entry to [CHANGELOG.md](CHANGELOG.md) for a change that users can see.
- A new feature needs an entry in the feature registry (`src/core/features.ts`) with its status, and in the bundle catalog (`src/features/catalog.ts`).
- Do not change benchmark thresholds to make a test pass. Explain a regression instead.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE) of this project.
