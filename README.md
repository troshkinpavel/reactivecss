# Reactive CSS

Reactive CSS adds state, events, conditions and DOM bindings to the CSS you already write. You load one script, and your stylesheets can handle simple interactions without extra JavaScript.

```css
.counter {
  --count: state(0);
}

.counter:on(click) {
  --count: increment(1);
}

.counter .value {
  content: var(--count);
}
```

```html
<button class="counter">Clicked <span class="value">0</span> times</button>
<script src="reactive-css.min.js" defer></script>
```

> **Status: 0.9.0, experimental and not published yet.** The npm package `@reactivecss/core` and the website `reactivecss.com` are prepared but not live. The syntax can still change before 1.0. Until publication, install from a local build ([Installation](#installation)).

## What it does

The runtime reads your stylesheets and finds the reactive parts: `state()`, `:on()`, `:when()`, mutations such as `increment()`. It compiles them to standard CSS and custom properties, and then updates only the elements that use them. The browser still does all styling, transitions and animations. Rules without reactive syntax stay native CSS and are not changed.

It is not a framework, not a replacement for JavaScript, and not a programming language. It is for interface state that you would otherwise wire up with a few event listeners: menus, tabs, toggles, counters, form mirrors, drag handles, simple wizards.

## A second example

```css
.menu {
  --open: state(false);
}
.menu > button {
  --attr-aria-expanded: var(--open);   /* writes the real attribute */
}
.menu > button:on(click) {
  --open: toggle();
}
.menu:on(outside(click)) {
  --open: set(false);
}
.menu:on(keydown(Escape)) {
  --open: set(false);
}
.menu:when(--open) > ul {
  display: block;
}
```

A state belongs to the element that declares it. Its descendants read it and change it, so the button and the list both reach `--open` through `.menu`.

## Core features

| Area | Syntax |
|---|---|
| State | `state(value)`, with `persist("key")` (kept across reloads) and `bind(value)` (two-way with a form control) |
| Events | `:on(click)`, `:on(keydown(Enter))`, `:on(outside(click))`, `:on(drag(move))`, with the modifiers `prevent()` and `stop()` |
| Mutations | `set()`, `toggle()`, `increment()`, `decrement()`, `cycle()`, with `event(…)` fields such as `event(local-x)` |
| Conditions | `:when(--open)`, `when(--on, a, b)`, comparisons and `and` / `or` / `not` |
| DOM | `content: var(--x)` (element text), `--attr-*` (attributes), `focus: when(…)` (focus requests) |
| History | `previous()`, `direction()`, `:changed()` |
| Values | `mouse()`, `element()`, `viewport()`, `visible()`, `live()`, `random()`, `pick()` |

Every feature has a status in the registry: run `ReactiveCSS.describe()` in the browser, or read `dist/features.json`. The full language reference is in [docs/library-reference.md](docs/library-reference.md). The changes from 0.8 are in [docs/migration-0.9.md](docs/migration-0.9.md).

## Installation

### From a local build (works now)

```bash
npm install
npm run build
```

Copy `dist/reactive-css.min.js` to the folder your site serves, and load it with `defer`:

```html
<link rel="stylesheet" href="style.css">
<script src="reactive-css.min.js" defer></script>
```

The script starts by itself. To use it as an npm dependency before publication, create a tarball with `npm pack` and install that file:

```bash
npm pack
```

```bash
npm install path/to/reactivecss-core-0.9.0.tgz
```

### From npm (after publication)

```bash
npm install @reactivecss/core
```

| Import | Contents |
|---|---|
| `@reactivecss/core` | The ES module API: `start()`, `stop()`, `refresh()`, `compile()`, `describe()`, `diagnostics`… with TypeScript declarations |
| `@reactivecss/core/auto` | The full browser bundle, which starts itself |
| `@reactivecss/core/bundle` | The custom bundle builder API (Node.js, needs `esbuild`) |
| `@reactivecss/core/catalog.json` | The feature catalog |

```js
import { start } from '@reactivecss/core';

start();
```

After publication, npm CDNs such as jsDelivr and unpkg can serve the files of the package directly. Pin an exact version in production.

## Bundles

| File | Minified | gzip | What it is |
|---|---:|---:|---|
| `dist/reactive-css.min.js` | 149,039 B | 49,253 B | Full: every feature and the complete feature registry |
| `dist/reactive-css.compact.min.js` | 128,495 B | 42,516 B | Compact: the same runtime and features, with a shorter `describe()` registry |
| `dist/reactive-css.js` | 266,168 B | 69,461 B | Development build: not minified, full diagnostic messages |
| Custom | smaller | | Only the features you select, built with the `reactive-css` CLI |

Sizes are from the 0.9.0 build (gzip level 9). The minified bundles report problems as stable codes. Decode them offline:

```bash
npx reactive-css explain "RCSS-P001⟦:on()⟧⟦events⟧⟦events⟧"
```

Custom bundles need `esbuild` (an optional peer dependency):

```bash
npx reactive-css analyze public/ --build public/reactive-css.min.js
```

Reference: [docs/bundle-builder-0.8.md](docs/bundle-builder-0.8.md).

## AI coding agents (MCP)

`packages/mcp/` is `@reactivecss/mcp`, a Model Context Protocol server that gives coding agents the 0.9.0 reference, examples, and validation, feature analysis and migration with the library's own compiler. It is offline and read-only, and runs over stdio. It is not published yet. Build it from this repository (after `npm run build` in the root):

```bash
cd packages/mcp && npm install && npm run build
```

Then point your MCP client at `node /absolute/path/to/packages/mcp/dist/index.js`. Client configuration and the tool list: [packages/mcp/README.md](packages/mcp/README.md).

## Browser support and limitations

- **Build target:** Chrome and Edge 111+, Firefox 128+, Safari 16.4+. Details in [docs/compatibility.md](docs/compatibility.md).
- **Tested:** automated tests run in Chromium and WebKit (Playwright engine builds, not Chrome or Safari releases).
- **Not verified:** Firefox has manual results from 0.7.1 only, and no automated run on the development machine. Real touch and pen devices are not verified.
- **Experimental APIs:** most of the 0.9 language is marked experimental in the registry: `:on()` and `event()`, drag, `prevent()`, `persist()`, `bind()`, `--attr-*`, `content`, `focus:`, `:blur` and `element()`. `state()`, the mutations, `:when()` and the history and value functions are stable.
- **CSS minifiers remove empty rules.** A rule with only modifiers, such as `a:on(click, prevent()) {}`, is deleted by esbuild, csso and Lightning CSS. Use whitespace-only minification for these stylesheets.
- **Security:** the runtime only reads CSS that the page already trusts. See [docs/security.md](docs/security.md) and [SECURITY.md](SECURITY.md).

## Repository

| Path | Contents |
|---|---|
| `src/` | Library source (TypeScript) |
| `tools/` | The `reactive-css` CLI and the bundle builder |
| `tests/` | Unit, distribution and browser tests |
| `examples/` | Runnable examples and the demo lab |
| `docs/` | Language reference, design notes and release history |
| `benchmarks/` | Performance harness and recorded results |
| `packages/mcp/` | `@reactivecss/mcp`, the MCP server for coding agents |
| `site/` | The documentation website (Astro), a separate private npm project |
| `codepen/` | The demos packaged for CodePen, with a copy of the 0.9.0 runtime |

## Development

Node.js 22 or later.

```bash
npm ci
npm run build
npm run typecheck
npm test
```

Browser tests (Chromium and WebKit):

```bash
npx playwright install chromium webkit
npm run test:browser
```

`npm run test:dist` checks the built files: the bundle on a plain page, a Node import and a TypeScript consumer. `npm run verify` runs everything. `npm run serve` serves the examples at `http://localhost:8080/examples/`.

The website, with the Playground, the Examples and the Bundle Builder, is in [site/](site/README.md):

```bash
cd site && npm ci && npm run dev
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report security problems privately as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
