# Custom bundles and the bundle builder (0.8)

Since 0.8.0 you can build a Reactive CSS bundle that contains only the features a site uses. The full bundles (`reactive-css.min.js`, `reactive-css.compact.min.js`) are unchanged.

- **Design:** [rfc-modular-runtime-0.8.md](rfc-modular-runtime-0.8.md).
- **Release report:** [release-0.8.0.md](release-0.8.0.md).

The tooling is Node-only:

- `tools/bundle.mjs` is the programmatic API.
- `tools/reactive-css.mjs` is the CLI, installed as the `reactive-css` bin.

It needs Node.js (tested with Node 26) and esbuild, an optional peer dependency that library users do not need. Nothing is loaded lazily: a bundle contains its features, and nothing else is ever fetched.

## Features

`reactive-css features` lists the catalog (`src/features/catalog.ts`). The same data is in `dist/catalog.json`.

| ID | Provides | Requires |
|---|---|---|
| `core` (always) | `state()`, `attr()`/`pick()`/`split()` in `state()`/`set()`, `previous()`/`direction()` as condition operands, the JS API | — |
| `events` | `on:`, every trigger, `key()`, `outside()`, every action, `prevent()` | core |
| `conditions` | `when()`, `:when()` | core |
| `nth-var` | `:nth-var()` | core |
| `history` | `previous()`/`direction()` as values, `:changed()` | core |
| `forms` | `bind:`, `:just-checked`, `:just-unchecked` | core |
| `text` | `text:` | core |
| `attributes` | `attr:`, `state(…, bind(attribute))` | core |
| `focus` | `focus:` | core, events (forms is optional) |
| `values` | `random()`, `pick()`, `typed()` | core |
| `dynamic` | `live()`, `on(event, expr)`, `mouse()`, `viewport()`, `visible()` | core |
| `geometry` | `element(width/height)` | core |

Profiles are example configurations, not separate builds.

| Profile | Features |
|---|---|
| `basic` | events |
| `forms` | events, forms, text, attributes |
| `stateful-ui` | events, conditions, history, attributes, focus |
| `dynamic` | values, dynamic, geometry |
| `full` | every feature |

## CLI

```bash
reactive-css build --features events,conditions,focus --out public/reactive-css.min.js
```

Output:

```
Built public/reactive-css.min.js
Features: core, events, conditions, focus
Optional, not included: forms (useful for focus)
Excluded: nth-var, history, forms, text, attributes, values, dynamic, geometry
Size: 63533 B minified (62.0 KB), 22344 B gzip, 20211 B brotli
Manifest: public/reactive-css.min.manifest.json
```

| Command | Options |
|---|---|
| `features` | `--json` |
| `resolve` | `--features a,b` · `--profile name` · `--exclude a,b` · `--json` |
| `build` | `--features a,b` or `--profile name` · `--exclude a,b` · `--format iife\|esm` (default `iife`) · `--no-minify` · `--out file` (default `dist/custom/reactive-css.custom.min.js`) · `--json` |
| `analyze` | `<file.css\|page.html\|dir>…` · `--root dir` · `--assume-complete` · `--build file` · `--json` |

The two formats behave differently:

- **`iife` bundle:** loads like `reactive-css.min.js`. It sets `window.ReactiveCSS` and starts itself.
- **`esm` bundle:** exports the same API as `dist/index.js`. You call `start()` yourself.

`--no-minify` builds the development variant, which logs each warning and keeps class names.

Exit codes:

| Code | Meaning |
|---:|---|
| 0 | Success |
| 1 | Invalid input: unknown feature or profile, a conflict, no input |
| 2 | Internal error, or esbuild is missing |

## Programmatic API

```js
import { catalog, resolve, build, analyze, sizes } from '@reactivecss/core/bundle';
```

| Function | Returns |
|---|---|
| `catalog()` | `{ version, features: CatalogFeature[], profiles }` |
| `resolve(config)` | `{ features, requested, added: [{ id, requiredBy }], optionalMissing: [{ id, usefulFor }], errors }` |
| `build(config)` | `{ ok, code, manifest, errors }`. Writes `outfile` and `<outfile without .js>.manifest.json` when `config.outfile` is set |
| `analyze(inputs, { assumeComplete, root })` | See [Analyzer](#analyzer) |
| `sizes(code)` | `{ minified, gzip, brotli }`: byte lengths, with gzip level 9 and brotli quality 11 |

Invalid user input is never thrown: it comes back as `errors`. Only internal failures throw.

### Configuration

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Reactive CSS bundle configuration",
  "type": "object",
  "properties": {
    "features": { "type": "array", "items": { "enum": ["core", "events", "conditions", "nth-var", "history", "forms", "text", "attributes", "focus", "values", "dynamic", "geometry"] }, "uniqueItems": true },
    "profile": { "enum": ["basic", "forms", "stateful-ui", "dynamic", "full"], "description": "Added to features" },
    "exclude": { "type": "array", "items": { "type": "string" }, "description": "Features that must not be included; a requirement on one is a conflict" },
    "format": { "enum": ["iife", "esm"], "default": "iife" },
    "minify": { "type": "boolean", "default": true },
    "outfile": { "type": "string" }
  },
  "additionalProperties": false
}
```

Resolution rules:

- `core` is always included. Each feature's `requires` are added recursively and reported in `added`. `optional` features that are not selected are reported in `optionalMissing`, and never added.
- Features are emitted in catalog order, so equal selections give byte-identical bundles.

### Errors

Every error has the shape `{ code, message, feature? }`. The message is written for people and can be shown as is.

| Code | When |
|---|---|
| `unknown-feature` | An ID is not in the catalog. The message suggests the closest ID ("Did you mean "events"?") |
| `unknown-profile` | A profile name is not defined |
| `core-required` | `core` is in `exclude` |
| `conflict` | An excluded feature is required by a selected one, or a feature is both requested and excluded |
| `no-features`, `no-input` | (CLI) Nothing to build or analyze |

### Manifest

```json
{
  "name": "reactive-css", "version": "0.8.0", "format": "iife", "minify": true,
  "features": ["core", "events", "focus"],
  "requested": ["focus"],
  "added": [{ "id": "events", "requiredBy": "focus" }],
  "excluded": ["conditions", "nth-var", "history", "forms", "text", "attributes", "values", "dynamic", "geometry"],
  "optionalMissing": [{ "id": "forms", "usefulFor": "focus" }],
  "provides": ["decl:state", "expr:attr", "…", "decl:on", "trigger:*", "act:*", "decl:focus"],
  "sizes": { "minified": 63533, "gzip": 22344, "brotli": 20211 },
  "modules": ["src/api.ts", "src/core/engine.ts", "…"]
}
```

The manifest fields:

- **`modules`:** the source files esbuild actually included. Use it to check that a feature brought nothing else in.
- **`provides`:** usage keys:
  - `decl:<declaration>`, `fn:<function>`, `sel:<selector>`, `expr:<expression>`;
  - `trigger:<event>` and `act:<action>`, where `trigger:*` and `act:*` mean all of them.

## In the browser: missing features are reported

A custom bundle still recognizes every Reactive CSS syntax. If a stylesheet uses a feature the bundle lacks, the browser ignores that declaration, function or selector, as before. In addition, one diagnostic says which feature it needs. The message goes to `ReactiveCSS.diagnostics`, and in the development build also to the console.

```
text: is not included in this bundle (feature "text"); build a bundle with it (reactive-css build --features text) or use the full bundle in "text: var(--n)". Declaration left unchanged.
:when() is not included in this bundle (feature "conditions"); build a bundle with it (reactive-css build --features conditions) or use the full bundle in selector ".c:when(--n > 1)". Rule left unchanged.
live() is not included in this bundle (feature "dynamic"); build a bundle with it (reactive-css build --features dynamic) or use the full bundle
```

- **Names native CSS also defines:** `random()` (CSS Values 5) and `element()` get a note, not a warning ("random() may be the native CSS function; …"). Native `element(#id)` is never reported.
- **Identifying the bundle:** `ReactiveCSS.describe().bundle` lists the included feature IDs. It is `null` when the library is imported from source.
- **`describe().features` in a custom bundle:** it lists only the included features, in compact form (name, kind, status, since, syntax). The full descriptions are in `dist/features.json`.

## Analyzer

```bash
reactive-css analyze site/ --build public/reactive-css.min.js
```

The analyzer compiles each stylesheet with the real compiler (the same tokenizer and parser as at runtime) and collects the syntax each one uses. It reads:

- `.css` files;
- in `.html` files, inline `<style>` blocks and local `<link rel="stylesheet">` files;
- directories, recursively.

It handles:

- nested calls (`calc(live(random(…), 1s) * 2)`), `@media`, `@layer`, comments and strings;
- native look-alikes: `element(#id)`, native `attr()`, and `random()`/`:nth-var(` inside strings or comments.

Result:

```json
{
  "complete": true,
  "sheets": 1,
  "features": ["core", "events", "conditions", "nth-var", "forms", "attributes", "focus"],
  "used": ["events", "attributes", "forms", "focus", "conditions", "nth-var"],
  "added": [],
  "optionalMissing": [],
  "uses": ["act:cycle", "act:prevent", "act:set", "decl:attr", "…"],
  "recommended": { "features": ["events", "attributes", "forms", "focus", "conditions", "nth-var"] },
  "files": [{ "path": "…/style.css", "uses": ["…"], "features": ["…"], "diagnostics": [] }],
  "notes": []
}
```

### When the analysis is incomplete, use the full runtime

A static analysis sees only the stylesheets it is given. `complete` is `false`, and `recommended` is `{ "profile": "full", "reason": "…" }`, whenever one of these notes is reported:

| Note | Meaning |
|---|---|
| `scripts-present` | The HTML page has scripts other than Reactive CSS. They may create or change stylesheets at runtime. Pass `--assume-complete` (`assumeComplete: true`) if you know they do not. |
| `remote-stylesheet` | A linked stylesheet is not local |
| `missing-file` | An input or linked file was not found, or a root-relative link points outside `--root` |
| `root-relative-link` | An HTML page links a stylesheet with a root-relative URL (`/x.css`) and no root was given. Pass `--root dir` (`root: 'dir'`): the folder your site serves as `/`. The analyzer never guesses that folder. |
| `import-not-followed` | `@import` is not followed: analyze the imported files too |
| `compile-error` | A stylesheet could not be compiled |
| `unknown-syntax` | A usage key belongs to no catalog feature (a catalog bug; please report it) |

The analyzer never sees:

- inline `style` attributes;
- stylesheets added or edited by scripts, `adoptedStyleSheets`, or CSS-in-JS;
- stylesheets served by a backend that are not in the input.

The browser reports a missing feature (see above). Check `ReactiveCSS.diagnostics` on the real pages after switching to a custom bundle.

## Website integration (prepared, not implemented)

A future bundle builder on the website can use these pieces unchanged:

| Need | Use |
|---|---|
| Feature list, categories, dependencies, syntax summaries | `dist/catalog.json` (`@reactivecss/core/catalog.json`), or `catalog()` |
| Live dependency resolution in the UI | `resolve({ features, exclude })` is pure and synchronous over the catalog. The module imports esbuild and `node:fs`, so a browser UI ports the function (about 40 lines) or calls a server |
| Building | `build(config)` on a server (esbuild), or esbuild-wasm in a worker with the same stdin entry and registry plugin |
| Size report | `manifest.sizes`, plus `benchmarks/audit/results/v080/bundle-sizes.json` for per-feature overhead |
| "Paste your CSS" | `analyze([{ path: 'input.css', text }])`. The result's `recommended`, `notes` and `files[].diagnostics` are ready to display |
| Error display | `errors[].message` (human-readable) and `errors[].code` (stable, for UI logic) |

The configuration schema, the manifest and the error format above are what such a website would read and write.

## Sizes (0.8.0, measured)

Measured with `node benchmarks/bundle-sizes.mjs`, which writes `benchmarks/audit/results/v080/bundle-sizes.{json,md}`.

| Bundle | Minified (B) | gzip (B) | brotli (B) |
|---|---:|---:|---:|
| core only | 41,873 | 15,530 | 14,102 |
| basic | 53,208 | 18,844 | 17,049 |
| forms | 72,134 | 24,758 | 22,127 |
| stateful-ui | 76,037 | 26,317 | 23,450 |
| dynamic | 54,540 | 19,833 | 17,962 |
| full (custom) | 100,112 | 34,023 | 30,110 |
| `reactive-css.min.js` | 117,830 | 39,715 | 34,983 |
| `reactive-css.compact.min.js` | 101,644 | 34,357 | 30,418 |

A full custom bundle is smaller than `reactive-css.min.js` because its `describe()` registry is compact, without descriptions or examples (like `reactive-css.compact.min.js`). Startup and memory hardly depend on the bundle: on 1,000 components, script time was 4.8 ms (core) to 6.3 ms (full). Heap after GC was 1.7 to 2.1 MB. None of the five profile bundles leaked over 300 mount/unmount cycles (`benchmarks/audit/results/v080/`).

The core is most of a small bundle. It contains:

- the compiler: tokenizer, parser and every syntax recognizer;
- the CSSOM rewrite;
- the state engine, scheduler and element lifecycle.

The core cannot be split further without making builds fragile (RFC section 5). What each feature adds over its requirements is in the size report: from +2,188 B (`geometry`) to +11,333 B (`events`) minified.
