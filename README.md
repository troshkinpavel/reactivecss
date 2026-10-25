<h1 align="center">Reactive CSS</h1>

<p align="center"><strong>Make CSS reactive.</strong></p>

<p align="center">
An exploration of what CSS could become.<br>
State, events, conditions and DOM bindings in the CSS you already write.<br>
One small runtime reads your stylesheets and wires them up.
</p>

<p align="center">
  <a href="https://github.com/troshkinpavel/reactivecss/actions/workflows/test.yml"><img alt="CI" src="https://github.com/troshkinpavel/reactivecss/actions/workflows/test.yml/badge.svg"></a>
  <a href="https://www.npmjs.com/package/@reactivecss/core"><img alt="npm @reactivecss/core" src="https://img.shields.io/npm/v/@reactivecss/core?label=%40reactivecss%2Fcore"></a>
  <a href="https://www.npmjs.com/package/@reactivecss/mcp"><img alt="npm @reactivecss/mcp" src="https://img.shields.io/npm/v/@reactivecss/mcp?label=%40reactivecss%2Fmcp"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/github/license/troshkinpavel/reactivecss"></a>
  <img alt="Status: experimental" src="https://img.shields.io/badge/status-experimental-d9481e">
</p>

<p align="center">
  <a href="https://reactivecss.com/docs/">Documentation</a> ·
  <a href="https://reactivecss.com/examples/">Examples</a> ·
  <a href="https://reactivecss.com/playground/">Playground</a> ·
  <a href="https://reactivecss.com/experiments/">Experiments</a> ·
  <a href="packages/mcp/README.md">MCP server</a>
</p>

---

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

The button owns the state, each click increments it, and the span shows it as text. No application JavaScript is involved, but the Reactive CSS runtime has to be loaded.

> [!NOTE]
> **0.9.1 is experimental.** [`@reactivecss/core`](https://www.npmjs.com/package/@reactivecss/core) 0.9.1 and the MCP server [`@reactivecss/mcp`](https://www.npmjs.com/package/@reactivecss/mcp) 0.1.0 are on npm. The website is [reactivecss.com](https://reactivecss.com). See [Installation](#installation).

## Why Reactive CSS?

What if CSS could describe not only how an interface looks, but also how it behaves?

A lot of interface behavior is small: a menu that opens, a tab that switches, a field that mirrors another, a card that follows the pointer. With plain HTML and CSS, each of these usually needs a few event listeners that set classes and attributes.

Reactive CSS lets the stylesheet say it directly. Selectors say *when* something happens, declarations say *what* changes, and the browser still does all styling, transitions and animations. Rules without reactive syntax stay native CSS.

It is not a new browser standard and not another UI framework. A JavaScript runtime implements these experimental CSS extensions in today's browsers, so the interactions it supports need no application JavaScript. It is not a build step or a replacement for JavaScript either: it is a CSS-first way to write the interactions that don't need one.

## What you can build

**State and mutations.** A state belongs to the element that declares it. Its descendants read it and change it.

```css
.stepper { --n: state(1); }
.stepper .more:on(click) { --n: increment(1); }
.stepper .double:on(click) { --n: set(clamp(1, var(--n) * 2, 64)); }

.palette { --tone: state(warm); }
.palette:on(click) { --tone: cycle(warm, cool, mono); }
```

**Events.** DOM events and keys, clicks outside an element, and the `prevent()` and `stop()` modifiers.

```css
.menu { --open: state(false); }
.menu > button:on(click) { --open: toggle(); }
.menu:on(keydown(Escape)) { --open: set(false); }
.menu:on(outside(click)) { --open: set(false); }

form { --sent: state(false); }
form:on(submit, prevent()) { --sent: set(true); }
```

**Conditions.** As a selector with `:when()`, or as a value with `when()`.

```css
.menu:when(--open) > ul { display: block; }
.cart:when(--items > 0) .badge { visibility: visible; }
.switch { background: when(--on, #f2542d, #d9d5cf); }
```

**DOM bindings.** Real attributes, element text and focus.

```css
.menu > button { --attr-aria-expanded: var(--open); }
.counter .value { content: var(--count); }
.dialog input { focus: when(--open); }
```

**Form inputs.** Two-way binding between a control and its own state.

```css
.signup input[name=name] { --name: state("", bind(value)); }
.signup input[name=name]:when(--name != "") { border-color: #15803d; }
```

**Persistence.** A state that survives reloads.

```css
:root { --dark: state(false, persist("theme")); }
```

**Pointer and drag.** Event data read at the moment of the event, and drags that continue from where they stopped.

```css
.card { --x: state(0px); --y: state(0px); translate: var(--x) var(--y); touch-action: none; }
.card:on(drag) { --x: set(event(x)); --y: set(event(y)); }
.pad { --hit: state(0px); }
.pad:on(pointerdown) { --hit: set(event(local-x)); }
```

**Geometry and motion.** Live values from the pointer and the element, and a selector that matches right after a change.

```css
.spotlight { --mx: mouse(x, local); --w: element(width); }
.counter:changed(--count) .value { animation: flash 300ms; }
```

**Native CSS, first.** Transitions, animations, `@media`, layers and custom properties work unchanged. Where native CSS such as `if()` does the same job, the runtime uses it.

Several of these APIs are experimental, among them `:on()`, drag, `persist()`, `bind()`, `--attr-*`, `content` and `focus:`. The status of every feature is in the [language reference](docs/library-reference.md) and in `ReactiveCSS.describe()`.

## Installation

The runtime is one script with no dependencies. Once it loads, it processes the document by itself.

**From a CDN.** Load the version-pinned bundle with `defer`:

```html
<link rel="stylesheet" href="style.css">
<script src="https://cdn.jsdelivr.net/npm/@reactivecss/core@0.9.1/dist/reactive-css.min.js" defer></script>
```

The same file is on unpkg: `https://unpkg.com/@reactivecss/core@0.9.1/dist/reactive-css.min.js`.

**From npm.**

```bash
npm install @reactivecss/core
```

```js
import { start } from '@reactivecss/core';

start();
```

The package also exports `@reactivecss/core/auto` (the self-starting bundle), `@reactivecss/core/bundle` (the custom bundle builder, for Node.js) and `@reactivecss/core/catalog.json`.

**From this repository.** It needs Node.js 22 or later:

```bash
npm ci
npm run build
```

Then load `dist/reactive-css.min.js` with `defer`. To try a local build as an npm dependency, run `npm pack`, then `npm install path/to/reactivecss-core-0.9.1.tgz` in your project.

**Bundles.** Measured from the 0.9.1 build:

| File | Minified | gzip |
|---|---:|---:|
| `reactive-css.min.js` | 150,368 B | 49,736 B |
| `reactive-css.compact.min.js` (same runtime, shorter `describe()` registry) | 129,824 B | 42,968 B |
| `reactive-css.js` (development build, full diagnostic messages) | 268,961 B | 70,254 B |

**Custom bundles** contain only the features your stylesheets use. The CLI builds them, with `esbuild`:

```bash
node tools/reactive-css.mjs analyze public/ --build public/reactive-css.min.js
```

With `@reactivecss/core` and `esbuild` installed in your project, the same command is `npx reactive-css`. Without a local install, name the package: `npx -p @reactivecss/core -p esbuild reactive-css …` (the unscoped npm package `reactive-css` is a different project). Details: [Installation](site/src/content/docs/installation.mdx) and [Custom bundles](docs/bundle-builder-0.8.md).

<a name="experiments"></a>

## Experiments: Perihelion

<table>
<tr>
<td>

**001 · Perihelion · motion card**

A foil collector card: 3D tilt, trailing specular light, parallax layers and a spring return. Three editions cycle on click, and a light sweep marks each change.

The interaction is Reactive CSS, and the rendering is native CSS: `mouse(local)` and `element()` for the pointer and the card's size, `:on(pointerenter)` for hover as a state, `cycle()` and `:changed()` for the editions. There is no application JavaScript.

[Source](site/experiments/perihelion/) · [How it works](site/experiments/perihelion/README.md)

On the website: [reactivecss.com/experiments/perihelion/](https://reactivecss.com/experiments/perihelion/).

</td>
</tr>
</table>

Experiments show what Reactive CSS can do beyond menus and counters: light, depth and motion. Each one is a stylesheet and the runtime.

## AI agents · Official MCP server

[`@reactivecss/mcp`](packages/mcp/README.md) is a Model Context Protocol server. It gives coding agents current knowledge of Reactive CSS 0.9.0, so the CSS they write uses the syntax that actually runs. It works offline and read-only, over stdio.

- **API reference:** syntax, status, parameters and common mistakes for every API.
- **Documentation search** across the reference, the examples and the migration guide.
- **CSS validation** with the library's own compiler: stable diagnostic codes, and fixes where they are safe.
- **Examples** from the maintained catalog.
- **Feature and bundle analysis:** which features a stylesheet uses, and the custom bundle it needs.
- **Migration** of 0.8 declarations (`on:`, `bind:`, `text:`, `attr:`) to their 0.9 forms.

It is on npm as [`@reactivecss/mcp`](https://www.npmjs.com/package/@reactivecss/mcp). Clients start it with `npx`:

```json
{ "mcpServers": { "reactivecss": { "command": "npx", "args": ["-y", "@reactivecss/mcp"] } } }
```

It has been verified with the MCP Inspector and the official MCP TypeScript SDK client. Claude Code, Cursor, VS Code and other clients are documented in the [package README](packages/mcp/README.md) and on [reactivecss.com/docs/mcp/](https://reactivecss.com/docs/mcp/), but not tested yet.

## Philosophy

- **Stay close to CSS.** Reactive rules look like the CSS around them: selectors, declarations and custom properties.
- **Native first.** When the platform already does something well, use it. Reactive CSS fills the gaps.
- **Declarative behavior.** Say what changes and when, not how to wire it up.
- **JavaScript stays available.** For logic, data and APIs, JavaScript is the better tool, and it works alongside the runtime.
- **No unnecessary abstraction.** No components, no virtual DOM, no build step.
- **One runtime for many interactions.** The script loads once, and every interactive pattern on the page shares it.

## Browser support

The build targets Chrome and Edge 111+, Firefox 128+ and Safari 16.4+. Automated tests run in Chromium, WebKit and Firefox (Playwright engine builds; Firefox in CI). Real touch devices are not verified yet. Details: [docs/compatibility.md](docs/compatibility.md).

CSS minifiers delete empty rules, so a modifier-only rule such as `a:on(click, prevent()) {}` disappears. Use whitespace-only minification for these stylesheets.

## Documentation and links

| | |
|---|---|
| [Documentation](https://reactivecss.com/docs/) ([source](site/src/content/docs/)) | Guides: getting started, state, events, conditions, binding, drag, persistence and more |
| [Language reference](docs/library-reference.md) | Every function, selector and declaration, with its status |
| [Migration from 0.8](docs/migration-0.9.md) | The 0.9 form of every 0.8 declaration |
| [Examples](site/src/catalog/) | One-feature API examples and complete interfaces, in 0.9 syntax |
| [Experiments](site/experiments/) | Perihelion, and more when they are finished |
| [MCP server](packages/mcp/README.md) | [`@reactivecss/mcp`](https://www.npmjs.com/package/@reactivecss/mcp), for coding agents |
| [Changelog](CHANGELOG.md) | Every release, with its reports |
| [Security](SECURITY.md) | The trust model, and how to report a vulnerability |

<a name="playground"></a>

The website, with the Playground, the live examples, the experiments and the bundle builder, is at **[reactivecss.com](https://reactivecss.com)**. To run it locally:

```bash
npm ci && npm run build
cd site && npm ci && npm run dev
```

Then open `http://localhost:4321/`. The Playground is at `/playground/`.

## Repository

| Path | Contents |
|---|---|
| [`src/`](src/) | The runtime (TypeScript) |
| [`tools/`](tools/) | The `reactive-css` CLI and the bundle builder |
| [`tests/`](tests/) | Unit, distribution and browser tests |
| [`packages/mcp/`](packages/mcp/) | The MCP server |
| [`site/`](site/README.md) | The website (Astro) |
| [`examples/`](examples/) | The library's demo lab and earlier examples, some in 0.8 syntax (which still works) |
| [`docs/`](docs/) | Reference, design notes and release history |
| [`benchmarks/`](benchmarks/) | Performance harness and results |
| [`codepen/`](codepen/) | The demos, packaged for CodePen |

## Contributing

Issues and pull requests are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) has the setup and the test commands. Report security problems privately, as [SECURITY.md](SECURITY.md) describes.

```bash
npm ci
npm run build
npm test
```

## License

[MIT](LICENSE) © 2026 Pavel Troshkin
