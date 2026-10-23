# @reactivecss/mcp 0.1.0: release preparation

**Status:** built and tested locally. **Not published:** no npm publish, no Git commit, no website or Cloudflare change, no npm org change. **Date:** 2026-10-23. **Package:** `packages/mcp/`.

The Reactive CSS MCP server gives AI coding agents offline, read-only knowledge of the Reactive CSS **0.9.0** API, the maintained examples, and tools that validate, analyze and migrate Reactive CSS with the library's own compiler. The browser runtime (`@reactivecss/core`) does not depend on it and did not change.

## 1. Architecture

| Part | What it is |
|---|---|
| `src/index.ts` → `dist/index.js` | The `reactivecss-mcp` bin: `serveStdio()` from the SDK, shutdown on stdin end, SIGINT and SIGTERM |
| `src/server.ts` → `dist/server.js` | `createServer()`: 7 tools, 8 resources, 4 prompts; every handler runs through one error wrapper |
| `src/engine.ts` | Validation, analysis, bundle resolution and migration, on top of the compiler |
| `src/reference.ts` | API lookup (aliases, legacy labels, version filter) and examples |
| `src/search-index.mjs` | BM25 index: built at build time, queried at run time |
| `dist/compiler.js` | The library's compiler: `src/index.ts` with every feature, bundled by esbuild for Node (149,756 B) |
| `dist/knowledge.json` | The knowledge snapshot and the prebuilt index (318,514 B) |
| `knowledge/overlay.mjs` | The curated layer: the 0.9 mutations and modifiers, aliases, legacy labels, mistakes, native-first notes, doc pages |
| `knowledge/agents.mjs` | Generates `AGENTS.md` and `skills/reactive-css/SKILL.md` from the knowledge |
| `scripts/build.mjs` | Builds all of the above from the monorepo |

**Shared components (reused, not rewritten):**
- **Compiler and tokenizer:** `compile()`, `tokenize()`, `matching()`, `assignable()` and `convert()` from `src/`, bundled unchanged. Validation reads the compiler's own structured output: state declarations, `:on()` mutations with their parsed expressions, and usage keys. No second CSS parser exists. The engine only splits rules and declarations on the library's tokens, to place diagnostics and edits.
- **Two build-time shims, in the MCP bundle only** (the library source is not edited). The build fails if their anchor text changes:
  - `src/core/log.ts` also records which messages are notes (severity `info`);
  - `src/core/parser.ts` exports `resetNames()`, which clears the page-lifetime maps of generated property names before each compile. Without it the heap grew about 300 B per distinct state name across calls.
- **API registry:** `describe()` (`src/core/features.ts`): 74 entries.
- **Feature catalog and profiles:** `tools/bundle.mjs` `catalog()` (`src/features/catalog.ts`).
- **Diagnostic codes:** `src/core/diagnostics.json`, the production code registry. Each library message gets its `RCSS-*` code by template matching.
- **Examples:** the 21 maintained examples in `site/src/catalog/{api,interfaces}`. The build compiles each one and fails on any diagnostic.
- **Migration guide:** `docs/migration-0.9.md`, served as a resource.
- **Bundle sizes:** measured at build time with `tools/bundle.mjs` `build()` (each profile and each feature alone), plus the prebuilt `dist/` bundles when they are built from 0.9.0.
- **Ported, not imported:** `featureOfKey()` and `resolve()` from `tools/bundle.mjs`, which imports esbuild when it loads and so cannot run in the server. A unit test checks parity with the original on every profile, every feature, conflict cases and every example.

**Not loaded:** the Astro site, browser-only modules, esbuild, or any network resource. Importing `dist/compiler.js` touches no DOM. It contains the runtime code of the features, because the parser recognizes only registered syntax; only `compile()` runs.

**SDK and transport:**
- `@modelcontextprotocol/server` **2.3.1**, the official TypeScript SDK v2 and its stable line, which implements the 2026-07-28 specification. It was checked on the registry on 2026-10-23; v1 `@modelcontextprotocol/sdk` 1.32.1 is the older single package.
- `zod` ^4.2 for the input schemas.
- Transport: stdio only, through `serveStdio()`. It serves both protocol eras.
- Node.js 22 or later.

**Package names.**
- The brief said `@reactivecss/core`. The repository already uses that name: `package.json` 0.9.0. The 0.8 package was `reactive-css`.
- The CLI is still `reactive-css`, and custom bundle manifests still say `name: "reactive-css"`. The server's knowledge says `@reactivecss/core`.

## 2. Tools

All tools have `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true` and `openWorldHint: false`. They return JSON in `structuredContent` and the same JSON as text. Bad input returns `isError: true` with `{ error: { code, message, … } }`; invalid arguments are rejected by the SDK's schema validation as a tool error.

| Tool | Arguments | Output | Limits |
|---|---|---|---|
| `get_api_reference` | `name`; `kind?` (rule, mutation, modifier, function, selector, declaration, expression, trigger, action); `version?`; `includeLegacy?` | `entry`: key, name, kind, status, since, removedIn, legacy, syntax, syntax09, description, parameters, returns, constraints, notes, examples, related, commonMistakes, replacement, legacyForm, bundleFeature, docUrl. Also `alternatives` and `legacyAlternatives`. Errors: `not-found` (with suggestions and search hits), `invalid-version`, `unsupported-version`. | name ≤ 120 |
| `search_docs` | `query`, `limit?`, `types?` | Ranked `results`: id, type, title, snippet (≤ 240 characters), score, `ref` (the tool or resource with details). 164 documents. | query ≤ 300; limit ≤ 10 (default 5) |
| `get_example` | `id?`, `topic?`, `include?` | css, html, the README sections, features, usage keys, source path; or the list | — |
| `validate_css` | `css`; `features?` or `profile?` | `valid`, `reactive`, `summary`, `diagnostics` (severity, code, message, 1-based range, feature, causes, tags, fix with optional edits), `truncated?`, `scope` | css ≤ 262,144 characters and ≤ 128 nesting levels; ≤ 100 diagnostics |
| `analyze_features` | `css` | uses, features (closure), used, usage per feature, added, optionalMissing, legacy, notes, scope | as above |
| `suggest_bundle` | `css?`, `features?`, `profile?`, `exclude?` | features, added, optionalMissing, recommendation, build command, `sizes` (measured or `null`), `sizesNote`, prebuilt reference sizes, caveat. Errors: `no-input`, `invalid-selection`. | lists ≤ 32 |
| `migrate_css` | `css` | css (proposed), changed, changes, manual (line, kind, reason, suggestion), diagnostics of the result, notes, `wrote: false` | as above |

**`validate_css` checks.**
- **From the compiler, with its `RCSS-*` codes:** syntax, unknown events and functions, modifiers, placement, selector lists, removed syntax (tagged `removed-syntax`), event fields against triggers, the attribute allowlist, `state()` and `persist()` arguments.
  - Severity: `error` when the library drops the rule or declaration, `warning` otherwise, `info` for notes.
  - When the library wraps a coded message in a short uncoded one, `code` is the cause and `causes` lists the chain.
- **Added by the server (`MCP-*`), all provable from the CSS alone:**
  - types a state can never store, using the compiler's `assignable()` plus the 0.9 exceptions for `0` and `0`/`1`;
  - unit families that do not convert;
  - mutations outside `:on()`;
  - `event()` outside a mutation;
  - mutated states that nothing declares;
  - legacy `on:`, `text:`, `attr:` and `bind:`;
  - `content` in pseudo-elements;
  - modifier-only empty rules (minifier risk);
  - `@import`;
  - with `features` or `profile`: syntax missing from that bundle.
- **Scope** (stated in every answer): the CSS given. The HTML, other stylesheets, focusability and DOM-dependent ownership are not checked.

**`migrate_css` rewrites:**
- `on:` → one `:on()` rule per trigger. `key()` becomes `keydown()`, `outside()` is kept, and a `prevent()` action becomes the modifier.
- `text:` → `content`, when the value reads state.
- `attr:` → `--attr-*`.
- `bind:` on a control that declares its own state → `state(…, bind(value | checked))`.
- `:focus(when(X)) {}` → `focus: when(X)`.
- Bare `prevent`/`stop` → `prevent()`/`stop()`.

**Listed for manual review:**
- `closest()` owners (no 0.9 form);
- two actions on one state in one trigger (the semantics differ);
- `prevent()` on non-cancelable events;
- literal `text:`;
- radio buttons and controls whose type the selector does not show;
- `once`;
- `focus: true` in a `:when()` rule.

Comments and native CSS are kept byte for byte. New rules go right after the original rule, in the same at-rule block. The tool never writes files. Migration is idempotent (tested).

## 3. Resources and prompts

| URI | Contents |
|---|---|
| `reactivecss://version` | server and library versions, status, `published: false`, supported range |
| `reactivecss://api` | 81 entries (74 registry + 5 mutations + 2 modifiers), legacy entries with their replacement |
| `reactivecss://features` | 15 features, 6 profiles |
| `reactivecss://dependency-graph` | nodes and `requires`/`optional` edges |
| `reactivecss://migration/0.9` | `docs/migration-0.9.md` (Markdown) |
| `reactivecss://compatibility` | targets, verification status, native CSS, minifiers, CSP, processed sheets, native-first list |
| `reactivecss://experimental` | experimental APIs and features (from the registry and catalog statuses) |
| `reactivecss://mistakes` | 22 mistakes: wrong and corrected CSS, explanation, the codes that catch them |

Every JSON resource carries `reactivecssVersion`. No internal report, security report, RFC, benchmark or other private file is served. The served documents are the public migration guide, the registry, the catalog and the public example catalog.

**Prompts.** Each has one string argument and tells the agent which tools to call and to validate:
- `create_reactive_component` (`description`);
- `migrate_to_v09` (`css`);
- `review_reactive_css` (`css`);
- `optimize_reactive_bundle` (`css`).

## 4. AGENTS.md, Skill, client configurations

- `packages/mcp/AGENTS.md` and `packages/mcp/skills/reactive-css/SKILL.md` are generated at build time from the knowledge object:
  - the counter example from the catalog;
  - 12 rules;
  - the mistakes table, with the full wrong and right CSS.
- The Skill has `name` and `description` front matter and a 6-step workflow (native first → state → `:on()` → validate → bundle → migrate).
- A unit test compiles every row of their syntax table with the real compiler.
- **Client configurations** in the README are labelled illustrative and use the local `dist/index.js` path:
  - generic `mcpServers` JSON (Claude Desktop, Cursor);
  - VS Code `.vscode/mcp.json`;
  - Claude Code `claude mcp add`.

  `npx -y @reactivecss/mcp` is shown only as planned.

## 5. Knowledge correctness: the brief against the source

Each item was verified with the real compiler and is covered by tests.

| Brief | Source (authority) | Result |
|---|---|---|
| `:on(click)` + `--open: toggle()`, `increment(1)`, `set(event(client-x))` | compiles; `event(client-x)` is a px length | as briefed; `state(0)` + `event(client-x)` → `MCP-type-mismatch` with a fix to `state(0px)` |
| `prevent()` / `stop()` | bare forms → `RCSS-E067` | as briefed |
| `state("light", persist("theme"))`, `state("", bind(value))` | compile | as briefed |
| `--attr-aria-expanded`, `content: var(--count)`, `focus: when(--open)`, `:blur`, `:on(drag(move))` | compile | as briefed |
| removed `:focus(when())`, `once()` in `:on()`, `drag(x)`, `:blur(when())` | `RCSS-P074`, `RCSS-E068`, `RCSS-E022`, `RCSS-P065` | never promoted; listed as mistakes |
| legacy `on:` labelled legacy | still supported in 0.9 | `legacy: true` with replacement; hidden unless asked for |

**Disagreements and gaps found** (reported here, not fixed in the library):
1. **`event()` outside a mutation.** RFC §5 calls it a compile error. The compiler accepts `--y: calc(event(client-y) * 1)` and `state(event(client-x))` without a diagnostic. The server reports `MCP-event-outside-mutation`.
2. **Type errors appear only at runtime.** `toggle()` on a number state, `increment()` on a string, and `set()` of a length into a number are silent at compile time. The runtime rejects every write. The server reports these statically.
3. **Registry `random` syntax** is still `random([element-shared,] min, max [, by step])`. The hardening pass made the native plain step (`random(min, max, step)`) native-first. The overlay adds a native-first constraint; the registry was not edited.
4. **Registry `state` syntax** lists only `bind(attribute)`. `persist()` and `bind(value | checked)` are separate entries. The overlay adds `syntax09` with all modifiers.
5. **Statuses.** The registry marks `:on()` (and therefore the 0.9 mutations) as experimental. The hardening report recommends stable. The server reports the registry status and does not change any release status.
6. **Native `random()` in Node.** It counts as the `values` feature, because native support is decided in the browser. `tools/bundle.mjs` analyze gives the same result (parity test).
7. **Stale sizes file.** `benchmarks/audit/results/v090/bundle-sizes.md` has rc1 sizes (162,675 B full). The server measures at build time. Its numbers match the hardening report section J: full 149,039 / 49,233 gzip; custom full 126,967 / 42,129.

## 6. Tests

| Suite | Command | Result |
|---|---|---|
| Unit (node:test, in process) | `npm test` | **26 passed** |
| Protocol (real stdio process) | `npm test` | **5 passed** |
| Consumer (`npm pack`, clean install, stdio) | `npm run test:consumer` | **pass** |
| Typecheck (TypeScript 7.0.2, strict) | `npm run typecheck` | **pass** |
| MCP Inspector 2.12.0, CLI mode | manual | **pass**: `tools/list`, `tools/call validate_css`, `resources/read`, `prompts/list` |

**Unit tests:**
- **Lookup:** 26 names and aliases; "never 0.8 as default" over every alias and mutation; legacy labels and replacements; constraints; doc pages; bundle features; kind filter; version filter (0.8.1, 0.9, 2.0, invalid); `not-found` suggestions.
- **Search:** ranking, determinism, limits, types, "0.9 above legacy", tokenization of CSS identifiers.
- **Examples:** every topic of the brief resolves to a real example that validates cleanly; all 21 examples compile with zero diagnostics.
- **Curated knowledge:** every curated example compiles; registry examples have no compiler errors; all 22 mistakes give their exact codes, and their corrections are clean; the AGENTS.md/Skill syntax compiles.
- **Validation:**
  - a native CSS corpus gives zero diagnostics (`@layer`, `:has()`, nesting, `@container`, `@property`, `@starting-style`, `if()`, native `random()`, `::before` content, custom properties named `--set` and `--toggle-size`, reactive-looking text in comments and strings);
  - codes, ranges and tags;
  - 14 type cases (8 valid, 6 invalid);
  - ownership, placement and legacy checks;
  - missing features for a given bundle.
- **Analysis parity** with `tools/bundle.mjs` (`analyze`, `resolve`, `featureOfKey`).
- **`suggest_bundle`:** measured sizes only for measured sets; structured errors.
- **Migration:** rewrites, preservation, the `@media` block, idempotence, manual cases, never-shipped syntax.
- **Limits:** oversized CSS, 300 diagnostics capped at 100, near-limit CSS answered in under 5 s, schema violations, hostile text, unbalanced and pathological CSS, nesting depth.

**Protocol tests:**
- raw JSON-RPC with the 2025-06-18 handshake: listings, all 8 resources read, prompt arguments, tool errors, unknown tool and method (-32601), garbage lines (the server keeps answering), every stdout line valid JSON-RPC, empty stderr, exit code 0 when stdin closes;
- SIGTERM;
- the official SDK client, which negotiates 2025-11-25;
- SDK version negotiation `auto`, which negotiates **2026-07-28**;
- a message over the SDK's 10 MB stdio buffer: the transport closes, the server exits 0 with one stderr line.

**Consumer test:**
- The tarball holds 9 files: `package.json`, `README.md`, `LICENSE`, `AGENTS.md`, the Skill, and `dist/{index,server,compiler}.js` and `knowledge.json`.
- It is installed with `npm install <tarball>` in a fresh temporary project. Only `@reactivecss/mcp`, `@modelcontextprotocol/server`, `@modelcontextprotocol/core` and `zod` are installed (16.7 MB). No esbuild, TypeScript or client SDK.
- The installed bin, started from another folder, answers `initialize`, `tools/list`, `get_example`, `validate_css` (clean and with an error), `analyze_features`, `migrate_css`, `get_api_reference` and `resources/read`. Stdout is clean and stderr is empty.

**Client verification and protocol verification are different things:**
- **Verified at protocol level:** the raw JSON-RPC tests and the official SDK client.
- **Verified with an independent client:** MCP Inspector, in CLI mode only (not its web UI).
- **Not verified:** Claude Desktop, Claude Code, Cursor and VS Code. None was configured: that would change user configuration outside this repository.

## 7. Performance

Apple M4 Max, Node 26.8.2. Source: `npm run bench` (`test/bench.mjs`).

| Measure | Result |
|---|---|
| Tarball / unpacked | 154,485 B / 567,834 B (9 files) |
| Installed with dependencies | 16.7 MB (mostly `zod` and the SDK) |
| Cold start: spawn → `initialize` answered | median 89 ms, max 96 ms (7 runs) |
| First `validate_css` (lazy compiler load included) | median 13.8 ms |
| Idle memory (RSS after `initialize`) | 68.2 MB; 71.0 MB after the first validation |
| `get_api_reference` | median 0.037 ms, p95 0.080 ms |
| `search_docs` | median 0.003 ms, p95 0.006 ms |
| `get_example` | median < 0.001 ms |
| `validate_css`, counter example (673 B) | median 0.040 ms, p95 0.107 ms |
| `validate_css`, all 21 examples (24.8 KB) | median 1.60 ms, p95 2.41 ms |
| `analyze_features`, all examples | median 1.38 ms |
| `migrate_css`, legacy rule | median 0.052 ms |
| Largest accepted input (262 KB), reactive | validate 81 ms; migrate 137 ms |
| Largest accepted input, native only | validate 27 ms |
| Heap after 2,000 calls with distinct state names | +150 KB in the bench; plateaus at about +0.5 MB (2k: 485 KB, 16k: 516 KB) |

**Lazy loading:**
- `knowledge.json` (with the prebuilt index) is read once, when the server is created;
- the compiler is imported on the first CSS tool call;
- no index is built at run time.

## 8. Security

| Area | Measure |
|---|---|
| Input | User CSS is untrusted text: it is only tokenized, compiled and searched, never evaluated. Zod schemas validate every argument (types, lengths, enums, list sizes). |
| Bounds | CSS ≤ 262,144 characters and ≤ 128 nesting levels: the library compiler recursed out of stack at about 3,000 levels, so deep inputs get `input-too-complex`. Query ≤ 300, names ≤ 120, lists ≤ 32. ≤ 100 diagnostics (`truncated` gives the total). ≤ 10 search results; snippets ≤ 240 characters. SDK transport: 10 MB per message, then the connection closes cleanly. |
| Errors | One wrapper turns every failure into a tool error. Unexpected errors are logged to stderr with a stack, and the client gets a generic `internal-error`. |
| Filesystem | Reads only `dist/knowledge.json` and `dist/compiler.js`, through `import.meta.url`. Writes nothing. A scan of `dist/` finds no `child_process`, `http`, `net`, `fetch`, `eval`, `new Function`, `writeFile` or `process.env`. |
| Network | None. No telemetry. |
| Environment | No variables read; no secrets. |
| Output | stdout carries only MCP messages: tested on every line. The compiler's console calls are removed at build time. |

**Remaining risks:**
- **Synchronous compilation.** A 262 KB sheet blocks the event loop for about 80–140 ms. Requests on the same connection queue. This is acceptable for a single-client stdio server.
- **Snapshot drift.** The knowledge is frozen at build time. A library change needs a rebuild. Curated-layer drift fails the build or the tests; new library behavior is not described until the overlay is updated.
- **Maintained copies:**
  - the ported `resolve()` and `featureOfKey()` (guarded by the parity test);
  - the build shims on `log.ts` and `parser.ts` (guarded by anchors);
  - the event-field type table in `engine.ts`, a copy of `field()` in `actexpr.ts` (guarded by the type tests).
- **Supply chain.** `@modelcontextprotocol/server` is pinned to 2.3.1. `zod` uses a caret range.
- **Validation is static.** A clean result does not prove that the page works: the HTML structure decides ownership, and focusability and runtime values are not checked.

## 9. Publication readiness

**Ready:**
- name `@reactivecss/mcp`, version 0.1.0 (independent);
- `reactivecss.supports: "0.9.x"`;
- MIT license (the bundled compiler is the same MIT project);
- `repository` with `directory: packages/mcp`, `homepage`, `bugs`;
- `bin: reactivecss-mcp`;
- `files` allowlist, `engines.node >=22`, `publishConfig.access: public`;
- `prepack` rebuilds from the monorepo;
- `npm pack --dry-run` and a real pack, install and run in a clean project.

**Blockers and decisions before publication:**
1. **`@reactivecss/core` is not published.** The knowledge and docs describe it as the runtime to install. Publish it first, or together.
2. **npm scope.** The `@reactivecss` npm organization must exist and allow publishing. This was not checked or changed.
3. **Repository.** Confirm that `github.com/troshkinpavel/reactivecss` is the public repository, and that `packages/mcp` will be in it.
4. **Website.** `docUrl` links point to `reactivecss.com/docs/…`, which is not live. Deploy the site first, or accept dead links for a time.
5. **Real-client check.** Configure the server once in Claude Desktop or Claude Code, VS Code and Cursor, and run the four prompts.
6. **Version policy.** Decide how the server version follows library releases. Proposal: a minor release per supported library minor; `reactivecss.supports` lists the range.
7. **Optional.** Pin `zod` exactly; add a CI job that runs `npm test` and `npm run test:consumer` in `packages/mcp`.

**Not done, by instruction:** publish, commit, tag, deploy, npm or Cloudflare changes, library API changes, website changes, release-status changes.

## 10. Files

**Added (all new):**
- `packages/mcp/`:
  - `package.json`, `package-lock.json`, `tsconfig.json`, `README.md`, `LICENSE` (a copy of the root license);
  - `AGENTS.md` and `skills/reactive-css/SKILL.md` (generated);
  - `src/`, `knowledge/`, `scripts/`, `test/`;
  - `dist/` (generated; ignored by the root `.gitignore`);
  - `node_modules/` (ignored).
- `docs/mcp-release-preparation.md` (this report).

**Not changed:**
- the library: `src/`, `tools/`, `dist/`, `package.json`;
- the site;
- the root configuration.

The `@reactivecss/core` tarball contains no `packages/` path, and the browser bundles are unchanged: `dist/reactive-css.min.js` is 149,039 B, 49,233 B gzip.
