# RFC: modular runtime (0.8)

Status: **decided and implemented in 0.8.0.** Tooling: [bundle-builder-0.8.md](bundle-builder-0.8.md). Release: [release-0.8.0.md](release-0.8.0.md).

## 1. Audit of 0.7.1

### Structure (measured, not assumed)

Bytes each source file contributes to `reactive-css.min.js` (esbuild metafile, 114,258 B before the wrapper):

| Bytes | File | Role |
|---:|---|---|
| 23,484 | `core/features.ts` | Feature registry with descriptions, examples and reasons: metadata, not runtime |
| 14,838 | `core/parser.ts` | Compiler: tokens → rewritten CSS + manifest; recognizes all syntax |
| 7,538 | `state/actions.ts` | `on:` dispatcher, triggers, `key()`, `outside()`, all actions, `prevent()` |
| 7,253 | `core/engine.ts` | Stylesheet lifecycle, CSSOM rewrite, bindings for reactive values |
| 5,473 | `state/attrdecl.ts` | `attr:` |
| 4,771 | `state/values.ts` | Typed values, conditions grammar, serialization (shared by everything) |
| 4,352 | `state/bindattr.ts` | Attribute allowlist (compile time) **and** the `state(…, bind())` runtime |
| 4,158 | `state/bind.ts` | `bind:` form controls |
| 3,793 | `state/state.ts` | State cells, ownership, cascade winner, `StateRef` |
| 3,612 | `functions/sources.ts` | `mouse()`, `viewport()`, `visible()`, `on(event, expr)` |
| 3,258 | `functions/values.ts` | `random()`, `pick()` |
| 3,132 | `state/conditions.ts` | `when()`, `:when()`, `previous()`, `direction()` |
| 2,965 | `core/elements.ts` | Element lifecycle (one MutationObserver) |
| 2,796 | `state/expr.ts` | `attr()`/`pick()`/`split()` in `state()`/`set()` |
| 2,737 | `state/focusdecl.ts` | `focus:` |
| 2,701 | `selectors/nth-var.ts` | `:nth-var()` |
| 2,677 | `core/scheduler.ts` | Frame flush, urgent lane, late phase, activation |
| 2,585 | `state/text.ts` | `text:` |
| 1,959 | `functions/geometry.ts` | `element(width/height)` |
| 1,956 | `state/typed.ts` | `typed()` |
| 1,736 | `state/changed.ts` | `:changed()` |
| 1,702 | `core/tokenizer.ts` | Tokenizer |
| 1,337 | `selectors/just-checked.ts` | `:just-checked` |
| 1,106 | `core/registry.ts` | Registries, `describe()` |
| 799 | `functions/live.ts` | `live()` |
| 734 | `state/keys.ts` | Key specs for `key()` |
| <700 | `log`, `config`, `format`, `index`, `auto` | |

### What was already modular

Functions, selectors and actions register themselves (`defineFunction`, `defineSelector`, `defineAction`) as module side effects imported by `index.ts`. Dropping such an import removes the feature. However:
- **No diagnostic.** An unregistered `live()` is passed through as an unknown CSS function, which the browser drops silently.
- **`hasReactiveSyntax()`**, the pre-filter that decides whether a sheet is compiled at all, is built from the registered names. A sheet using only missing features would never be compiled, so it would get no diagnostic either.

### What was not modular

- **Declarations** (`on:`, `bind:`, `text:`, `attr:`, `focus:`, `typed()`, `state(…, bind())`) are recognized by branches of `parser.ts`. Their runtimes are imported directly by `engine.ts` (all six watchers), `parser.ts` (`registerTyped`) and `state.ts` (`AttrBinding`). Nothing could be left out.
- **Hidden cross-feature imports:**
  - `attr:` and `focus:` import `textOf` from `text.ts`;
  - `sources.ts` imports `fmt` from `functions/values.ts` (a re-export of `core/format`);
  - `conditions.ts` mixes conditions and history.
- **`features.ts`** (23 KB) is in every bundle except the compact one.

### Feasibility

**Feature-level tree shaking is feasible without changing runtime semantics,** with three kinds of change:

1. The declaration runtimes register themselves in a `runtimes` table in `registry.ts`. The engine, parser and state engine look them up there instead of importing them.
2. Each optional capability gets one entry module (`src/features/<id>.ts`) that imports its implementation. `src/index.ts` (the full build) imports all of them.
3. Shared helpers move to the core: `textOf`, and the compile-time half of the attribute allowlist.

The parser stays whole: it keeps **recognizing** every Reactive CSS syntax, so a missing feature is reported, not silently passed to the browser. Splitting the parser per feature would save a few kilobytes at the cost of a fragile, pluggable grammar, so it was rejected (section 5).

## 2. Feature modules (bundle units)

User-facing categories, each backed by real code. Dependencies are derived from the imports and the runtime calls, and verified by a test that builds each module alone (`tests/unit/catalog.test.ts`).

| Feature ID | Category | Provides | Source modules | Requires | Optional |
|---|---|---|---|---|---|
| `core` | Core & State | `--x: state(…)`, `attr()`/`pick()`/`split()` in `state()` and `set()`, the cascade-winner initializer, `ReactiveCSS` API (`start`, `stop`, `refresh`, `stats`, `compile`, `describe`, `diagnostics`) | `core/*`, `state/state`, `state/values`, `state/expr`, `state/bindattr` (allowlist only), `state/textof`, `state/keys` | — | — |
| `events` | Events & Actions | `on:`, all triggers, `key()`, `outside()`, `set`, `toggle`, `increment`, `decrement`, `cycle`, `prevent()` | `state/actions` | `core` | — |
| `conditions` | Conditions & Selectors | `when()`, `:when()` | `state/conditions` | `core` | — |
| `nth-var` | Conditions & Selectors | `:nth-var()` | `selectors/nth-var` | `core` | — |
| `history` | History | `previous()`, `direction()` (as values), `:changed()` | `state/history`, `state/changed` | `core` | — |
| `forms` | Forms & DOM Bindings | `bind:`, `:just-checked` | `state/bind`, `selectors/just-checked` | `core` | — |
| `text` | Forms & DOM Bindings | `text:` | `state/text` | `core` | — |
| `attributes` | Forms & DOM Bindings | `attr:`, `state(…, bind(attribute))` | `state/attrdecl`, `state/bindattr-runtime` | `core` | — |
| `focus` | Focus & Accessibility | `focus:` | `state/focusdecl` | `core`, `events` | `forms` |
| `values` | Values & Strings | `random()`, `pick()`, `typed()` | `functions/values`, `state/typed` | `core` | — |
| `dynamic` | Geometry & Observers | `live()`, `on(event, expr)`, `mouse()`, `viewport()`, `visible()` | `functions/live`, `functions/sources` | `core` | — |
| `geometry` | Geometry & Observers | `element(width)`, `element(height)` | `functions/geometry` | `core` | — |

Notes on the dependencies:

- **`focus` requires `events`.** `focus:` moves focus only for state changes made during a trusted user event. The activation record is set by the `on:` dispatcher (`events`) and by bound controls (`forms`). Without `events` or `forms`, `focus:` would compile but never act, so `events` is required and `forms` optional.
- **History in conditions needs only `core`.** `previous(--x)` and `direction(--x)` as **condition operands** (`:when(direction(--n) > 0)`) are part of the core condition grammar. The `history` feature adds them as **values** (`text: previous(--n)`) and `:changed()`.
- **`attributes` includes `state(…, bind(attribute))`.** Both write allowlisted attributes with the same runtime.

## 3. One catalog

`src/features/catalog.ts` is the single source for bundle units: ID, category, provided syntax (as keys like `fn:live`, `sel:when`, `decl:text`, `act:prevent`, `trigger:key`), entry module, requirements, optional dependencies and status.

- **Consistency with the API registry is tested.** Every `FEATURES` entry (the API registry behind `describe()`) belongs to exactly one catalog unit, every registered function, selector, action and declaration runtime is provided by exactly one unit, and each unit's entry builds with only its declared requirements. There is no second, hand-maintained list.
- **Tooling reads the catalog directly**: `tools/bundle.mjs`, the analyzer, and later the website.

## 4. Runtime behavior of a custom bundle

- Only the selected units and their requirements are imported. Nothing is loaded lazily.
- **A missing feature is reported** (development and production `diagnostics`), and the declaration or function is left to the browser, which ignores it:
  - declarations (`text:`, `attr:`, `focus:`, `bind:`, `on:`, `typed()`, `state(…, bind())`): the parser knows them; the runtime is absent;
  - functions and selectors of excluded units: their names are compiled into the bundle (`__RCSS_EXCLUDED__`, a few hundred bytes), and the pre-filter also triggers on them;
  - **names shared with native CSS** are reported as a note, since they may be meant natively: `random()` (CSS Values 5) and `element()` (only the `element(width|height)` form is ours).
- **`describe()`** keeps its shape. `features` lists the included units' API entries (compact form: name, kind, status, since, syntax), and a new `bundle` field gives the included unit IDs.
- **CSP, CSSOM rewrite, trust model, scheduling, lifecycle:** unchanged; they are all core.

## 5. Decisions

| Option | Decision | Why |
|---|---|---|
| Split the parser per feature | **No** | Recognition must stay complete for diagnostics, and a pluggable grammar is fragile. Measured cost: the declaration branches are about 4 KB of the 14.8 KB parser |
| Split the scheduler, state engine or element lifecycle | **No** | Every feature uses them |
| Split `events` (dispatcher vs actions) | **No** | An `on:` without actions is useless, and actions need the dispatcher |
| Runtime lazy loading | **No** | Not asked for; it would need a loader and break CSP-only deployments |
| Drop `features.ts` metadata from custom bundles | **Yes** | 23 KB of descriptions, also available as `dist/features.json` |
| Keep the full and compact bundles | **Yes** | Built from `src/index.ts` as before. Their behavior is unchanged (all earlier tests) |

## 6. Static analysis

`reactive-css analyze` compiles real CSS with the real compiler and records which syntax keys each sheet used (`CompiledSheet.uses`). This covers nested calls, `@media`, `@layer`, comments, escaped strings and native look-alikes (`element(#id)`, native `attr()`), because the tokenizer and claims are the same as at runtime.

- **Limitation:** stylesheets created or changed at runtime, inline `style` attributes, and sheets not given to the analyzer are not seen.
- **Fallback:** a bundle recommended from an incomplete analysis must keep the safe option, the full runtime. The analyzer reports `complete: false` whenever it found syntax it cannot place, or when input files could not be read.
