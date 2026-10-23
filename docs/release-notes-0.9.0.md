<!-- Draft text for the future v0.9.0 GitHub Release. Not published. Replace the "after publication" lines once npm publication is verified. -->

# Reactive CSS 0.9.0

The first public release of Reactive CSS: state, events, conditions and DOM bindings for plain CSS, in one script.

```css
.counter { --count: state(0); }
.counter:on(click) { --count: increment(1); }
.counter .value { content: var(--count); }
```

**This is an experimental release.** The syntax can change before 1.0. Most of the 0.9 language is marked experimental in the feature registry (`ReactiveCSS.describe()`).

## Install

```bash
npm install @reactivecss/core
```

Or load `dist/reactive-css.min.js` with `<script defer>`. npm CDNs (jsDelivr, unpkg) serve the files of the package; pin an exact version.

## What is in 0.9.0

- **Event rules:** `:on(click)`, `:on(keydown(Enter))`, `:on(outside(click))`, with the modifiers `prevent()` and `stop()`.
- **Mutations on the state's own property:** `set()`, `toggle()`, `increment()`, `decrement()`, `cycle()`, with event-time expressions (`event()`, `clamp()`, `round()`, `element()`, `mouse()`…).
- **Drag gestures:** `:on(drag(start | move | end | cancel))`, where `event(x)` and `event(y)` continue from the previous position.
- **State modifiers:** `persist("key")` and `bind(value | checked)`.
- **DOM integration:** `content: var(--x)` as element text, `--attr-*` for an allowlist of attributes, `focus: when(…)`, and the `:blur` selector.
- **Production diagnostic codes** (`RCSS-…`), decoded offline with `npx -p @reactivecss/core reactive-css explain`.
- **Custom bundles:** the `reactive-css` CLI and `@reactivecss/core/bundle` build bundles with only the features a site uses.
- The 0.8 declarations (`on:`, `text:`, `attr:`, `bind:`) keep working. See `docs/migration-0.9.md`.

Full list: `CHANGELOG.md`.

## Bundles

| File | Minified | gzip (level 9) |
|---|---:|---:|
| `reactive-css.min.js` (full) | 149,139 B | 49,281 B |
| `reactive-css.compact.min.js` (same runtime, shorter registry) | 128,595 B | 42,545 B |
| `reactive-css.js` (development) | 266,288 B | 69,484 B |

## Tested and not tested

- **Tested:** automated suites in Chromium and WebKit (Playwright engine builds, macOS). These are engines, not Chrome or Safari releases.
- **Not verified:** Firefox (manual results from 0.7.1 only; Playwright's Firefox does not start on the development machine), real touch and pen devices, Windows and Linux desktop browsers, and screen readers beyond automated axe checks.

## Known limitations

- **CSS minifiers remove empty rules.** A modifier-only rule such as `a:on(click, prevent()) {}` is deleted by esbuild (`minify`, `minifySyntax`), csso and Lightning CSS. Use whitespace-only minification for these stylesheets.
- Reactive `content` text updates when a state changes, not when a live value (`mouse()`, `element()`, `visible()`, `live()`) changes by itself.
- The runtime trusts same-origin stylesheets like scripts. Keep user-provided CSS off your origin, or set `trustInlineStyles: false`. See `SECURITY.md` and `docs/security.md`.
- More: the Limitations page of the documentation.
