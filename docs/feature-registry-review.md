# Feature registry review (0.5.0)

> **0.5.1 update.**
> - An optional `dist/reactive-css.compact.min.js` is generated from the same registry source with only name, kind, status, since and syntax.
> - The default bundle and its `describe()` are unchanged.
> - Measured sizes: `docs/release-0.5.1.md`.

Source: `src/core/features.ts` (`FEATURES`, `KEEP_NATIVE`), exposed by `ReactiveCSS.describe()` together with the runtime registries (`functions`, `selectors`, `actions`, `expressions`, `events`, `outsideEvents`). Unit tests keep the registry and the runtime in sync in both directions. The dist smoke test does the same for the minified bundle.

## What exists

| Field | Present | Notes |
|---|---|---|
| `name` | yes | **Not unique on its own**: `when` (function and selector), `on` (function and declaration), `pick` (function and expression), `cycle` (action, and a rejected function). `kind:name` is unique; a unit test now enforces it. |
| `kind` | yes | `function`, `expression`, `selector`, `declaration`, `action`, `trigger` |
| `category` | yes | Policy class: `native`, `simplify`, `extend`, `evaluate` |
| `status` | yes | `stable`, `experimental`, `planned`, `rejected`, `removed` (+ `removedIn`) |
| `since` | yes | |
| `syntax` | yes | Prose for humans, not a grammar |
| `parameters`, `returns` | partly | Types as prose (`'<number> \| <dimension>'`) |
| `requiresRuntime`, `evaluation` | yes | |
| `nativeEquivalent`, `dependsOn`, `support`, `cleanup`, `reason`, `examples`, `description` | yes | `support` is prose |

## Gaps by planned consumer

| Consumer | Needs | Status | Recommendation |
|---|---|---|---|
| Astro docs | Stable ids, slugs, grouping, examples | Usable today with `kind:name` | Read `dist/features.json` (added in 0.5, see below); derive the slug from `kind` and `name` |
| Syntax highlighting | Which names are functions, selectors, triggers, actions, expressions, and in which **context** each is valid | Names yes; context no | Add `context`: `value` (any declaration value), `state-initial` (inside `state()`), `action-argument` (inside `set()`), `on-trigger`, `on-action`, `selector`, `whole-declaration` (`state()`, `typed()`, `bind:`). This is what makes `attr()` highlighting correct: native everywhere except two contexts. |
| Autocomplete | Parameter names, allowed keywords and value types per position | Prose types only | Add structured parameters: `{ name, type: 'number' \| 'dimension' \| 'state-name' \| 'keyword' \| 'string' \| 'selector' \| 'time', keywords?: string[], optional, default }`. Keep `syntax` for humans. |
| Diagnostics (editor, CI) | Stable error codes, positions | Messages are free text, prefixed with the stylesheet | Add a code to each `warn()` (e.g. `RCSS-SPLIT-CONTEXT`) and a `diagnostics` catalog (`code`, `message`, `fix`). Messages stay as they are. |
| Tailwind compatibility | Whether a feature can appear in an arbitrary property (`[--x:state(false)]`), whether it needs the whole declaration, whether the output depends on rule identity | Not recorded | Derivable from `context` and `requiresRuntime`. Note: Tailwind arbitrary values are compiled into a stylesheet the library reads, so they work when that sheet is same-origin. Not tested here. |
| Modular bundles | Which source module implements a feature and what it depends on | `dependsOn` lists features; modules unknown | Add `module` (`functions/values`, `state/expr`, `functions/geometry`, …) and fill `dependsOn` consistently. A bundle configurator can then choose entry points. Today `src/index.ts` imports everything for its side effects (registration). |
| Deprecation | `deprecated` status | Not present (nothing deprecated) | Add when first needed (`status: 'deprecated'`, `deprecatedIn`, `replacement`). Do not add it ahead of time. |

The conceptual `FeatureMetadata` shape (`id`, `category`, `status`, `syntax`, `description`, `dependencies`, `module`, `nativeEquivalent`) maps onto the existing schema:
- `id` → `kind:name`
- `dependencies` → `dependsOn`
- `module` → missing

There is no reason to replace the schema; extend it with `context`, structured parameter types, `module` and diagnostic codes.

## Bundle cost (measured)

| `dist/reactive-css.min.js` | minified | gzip -9 | brotli |
|---|---:|---:|---:|
| as built (0.5.0) | 86,125 B | 29,735 B | 26,520 B |
| same build with empty `FEATURES`/`KEEP_NATIVE` | 69,071 B | 24,801 B | 22,385 B |
| registry share | **17,054 B (20 %)** | 4,934 B | 4,135 B |

The registry is documentation data carried by every production page. Adding the fields above directly to `FEATURES` would grow it further. Recommendation:
1. **Done in 0.5 (additive):** `npm run build` writes `dist/features.json` (the output of `describe()`), so documentation and editor tools can read the metadata without loading or running the library. A dist test checks it is identical to `describe()`.
2. **Next (changes `describe()` in production, needs a decision):** split the registry into a small runtime part (names, kinds, status, used by validation) and a documentation part (descriptions, examples, reasons, native equivalents, the new tooling fields). Ship the documentation part only in `dist/features.json` and the ESM build. In the minified bundle, `describe()` would then return the runtime part plus a pointer to the JSON. Expected saving: most of the 17 KB.
3. New tooling fields should go into the documentation part only.

Not done here, as requested: IDE extensions, Tailwind plugin, bundle configurator.
