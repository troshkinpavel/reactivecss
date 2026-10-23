# @reactivecss/mcp

The official [Model Context Protocol](https://modelcontextprotocol.io) server for [Reactive CSS](https://reactivecss.com). It gives AI coding agents accurate, offline knowledge of the Reactive CSS **0.9.0** API, real examples, and tools that validate, analyze and migrate Reactive CSS with the library's own compiler.

> **Status: prepared, not published.** Neither this package nor `@reactivecss/core` is on npm yet, and reactivecss.com is not live. Until publication, run the server from a local build ([Install](#install)). The commands that use `npx -y @reactivecss/mcp` are for after publication.

- **Supported Reactive CSS version:** 0.9.x (knowledge of 0.9.0). The server version is independent: `reactivecss.supports` in `package.json` says which library versions it describes.
- **Transport:** stdio only. Read-only: no file writes, no network, no shell, no JavaScript execution.
- **Runtime:** Node.js 22 or later. Dependencies: `@modelcontextprotocol/server` (the official TypeScript SDK, v2) and `zod`.

## Install

### From this repository (works now)

```bash
cd packages/mcp
npm install
npm run build
```

The server is `packages/mcp/dist/index.js`. To try it as an installed package, create a tarball and install it in your project:

```bash
npm pack
```

```bash
npm install --save-dev ./reactivecss-mcp-0.1.0.tgz
```

### From npm (planned, after publication)

```bash
npx -y @reactivecss/mcp
```

## Client configuration

These snippets are **illustrative**. Check your client's documentation for the exact file and format. Replace the path with the absolute path to `dist/index.js` on your machine.

Clients that use an `mcpServers` object (Claude Desktop, Cursor and others):

```json
{
  "mcpServers": {
    "reactivecss": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp/dist/index.js"]
    }
  }
}
```

VS Code (`.vscode/mcp.json`):

```json
{
  "servers": {
    "reactivecss": { "type": "stdio", "command": "node", "args": ["/absolute/path/to/packages/mcp/dist/index.js"] }
  }
}
```

Claude Code:

```bash
claude mcp add reactivecss -- node /absolute/path/to/packages/mcp/dist/index.js
```

After publication, replace `"command": "node", "args": [ … ]` with `"command": "npx", "args": ["-y", "@reactivecss/mcp"]`.

## Tools

All tools are read-only (`readOnlyHint`), return JSON in `structuredContent` (and the same JSON as text), and answer bad input with a tool error `{ "error": { "code", "message", … } }` instead of failing.

| Tool | Input | Returns |
|---|---|---|
| `get_api_reference` | `name` (e.g. `":on"`, `"toggle"`, `"prevent"`, `"state"`, `"--attr-aria-expanded"`, `"focus"`), optional `kind`, `version`, `includeLegacy` | Syntax, status, since, parameters, constraints, examples, related APIs, common mistakes, bundle feature, documentation page. The 0.9 form by default; legacy 0.8 forms only by exact name (`"on:"`) or with `includeLegacy`. |
| `search_docs` | `query` (≤ 300 characters), optional `limit` (≤ 10), `types` | Ranked results from a local BM25 index: API entries, examples, mistakes, migration guide, native-first guidance, compatibility. Each result names the tool or resource with the details. |
| `get_example` | `id` or `topic`, optional `include` (`css`, `html`, `readme`) | A complete example from the maintained catalog: counter, toggle, tabs, form binding, persistence, attributes, DOM text, click coordinates, drag, focus and blur, state history, random values and 9 more. No arguments: the list. |
| `validate_css` | `css` (≤ 262,144 characters), optional `features` or `profile` | `valid`, a summary, and diagnostics with `severity`, a stable `code`, `message`, 1-based `range`, `feature`, and a `fix` where one is safe. States its scope. |
| `analyze_features` | `css` | The syntax used (usage keys), the bundle features with dependencies, optional features, legacy declarations. |
| `suggest_bundle` | `css`, `features` or `profile`, optional `exclude` | The resolved feature set, what was added and why, the `reactive-css build` command, and sizes **only** when that exact set was measured. |
| `migrate_css` | `css` | The proposed 0.9 CSS, each change, the cases left for manual review, and the diagnostics of the result. Never writes files. |

### Diagnostic codes

- `RCSS-<area><nnn>`: the library's own diagnostic codes (the same codes as production bundles; `npx -p @reactivecss/core reactive-css explain` decodes them). `causes` lists nested codes.
- `MCP-*`: checks this server adds on top of the compiler's output:

| Code | Severity | Meaning |
|---|---|---|
| `MCP-type-mismatch` | error | A mutation stores a type the state can never hold, e.g. `event(client-x)` (px) into `state(0)`, or `toggle()` on a number |
| `MCP-incompatible-units` | error | A mutation combines units that do not convert (`px + %`) |
| `MCP-missing-feature` | error | With `features`/`profile`: syntax the bundle does not include |
| `MCP-mutation-outside-on` | warning | `--x: toggle()` outside an `:on()` rule does nothing |
| `MCP-event-outside-mutation` | warning | `event()` outside a mutation is never computed |
| `MCP-no-state-owner` | warning | A mutated state that no rule in the CSS declares |
| `MCP-legacy-on`, `MCP-legacy-text`, `MCP-legacy-attr` | warning | Legacy 0.8 syntax (still works) |
| `MCP-legacy-bind`, `MCP-content-pseudo-element`, `MCP-empty-rule-minifier`, `MCP-import-not-followed` | info | 0.9 form available; `content` in a pseudo-element stays native; minifiers delete modifier-only rules; `@import` is not followed |

**Scope.** `validate_css` checks the CSS it gets. It does not see the HTML, other stylesheets, or the browser: element focusability, the DOM structure that decides ownership, and values known only at the event are not checked. Ordinary CSS gives no diagnostics.

## Resources

| URI | Contents |
|---|---|
| `reactivecss://version` | Server version, Reactive CSS version and status |
| `reactivecss://api` | Every API entry: kind, status, since, syntax; legacy entries name their replacement |
| `reactivecss://features` | Bundle features and profiles |
| `reactivecss://dependency-graph` | Feature dependencies (requires, optional) |
| `reactivecss://migration/0.9` | The migration guide (Markdown) |
| `reactivecss://compatibility` | Browser targets and verification status, minifiers, CSP, processed stylesheets, native-first guidance |
| `reactivecss://experimental` | Experimental APIs and features |
| `reactivecss://mistakes` | Common mistakes with wrong and corrected CSS and the codes that catch them |

## Prompts

`create_reactive_component` (`description`), `migrate_to_v09` (`css`), `review_reactive_css` (`css`), `optimize_reactive_bundle` (`css`). Each tells the agent which tools to call and to validate the result.

## Agent instructions without MCP

- [`AGENTS.md`](AGENTS.md): concise rules for agents, to copy into a project's `AGENTS.md`.
- [`skills/reactive-css/SKILL.md`](skills/reactive-css/SKILL.md): an Agent Skill with the same rules and a workflow.

Both are generated from the same data the server answers from.

## Example

A validation request and its answer (abridged):

```json
{ "name": "validate_css", "arguments": { "css": ".pad { --x: state(0); }\n.pad:on(click) { --x: set(event(client-x)); }" } }
```

```json
{
  "valid": false,
  "summary": { "errors": 1, "warnings": 0, "info": 0 },
  "diagnostics": [{
    "severity": "error", "code": "MCP-type-mismatch", "feature": "events",
    "range": { "start": { "line": 2, "column": 18 }, "end": { "line": 2, "column": 43 } },
    "message": "--x: set() in :on(click) stores a px length, but --x is declared as a number; every write is rejected at runtime.",
    "fix": { "description": "Declare it as a length: --x: state(0px).", "edits": [{ "range": { "start": { "line": 1, "column": 19 }, "end": { "line": 1, "column": 20 } }, "newText": "0px" }] }
  }]
}
```

## Security

- **Untrusted input.** CSS and queries are only tokenized, compiled and searched. Nothing in them is executed.
- **Bounds.** CSS up to 262,144 characters and 128 levels of nesting; queries up to 300 characters; names up to 120; lists up to 32 items; up to 100 diagnostics and 10 search results per call. Larger inputs get a structured error.
- **Filesystem.** The server reads only its own `dist/knowledge.json` and `dist/compiler.js`. It writes nothing.
- **Network and processes.** None. No environment variables are read.
- **Errors.** A failure inside a tool becomes a tool error; the server keeps running. Logs go to stderr; stdout carries only MCP messages.

## Limitations

- Knowledge is a snapshot of Reactive CSS 0.9.0, taken at build time. Older versions are supported by availability filtering (`version`), not by their own descriptions.
- `validate_css` cannot see the DOM (see Scope). Native `random()` calls are reported as using the `values` feature, because native support is decided in the browser.
- `migrate_css` rewrites only the cases that have a safe 0.9 form; it lists the others for manual review.
- Sizes are given only for feature sets measured at build time (each profile and each feature alone); others are not estimated.
- Documentation links point to reactivecss.com, which is not live yet.

## Development

The package builds from the library source in this repository (`../../src`, `../../tools`, `../../site/src/catalog`):

```bash
npm run build          # dist/: compiler, knowledge, server; AGENTS.md and the Skill
npm run typecheck
npm test               # build, unit tests and protocol tests (a real stdio process)
npm run test:consumer  # npm pack, install in a clean temporary project, MCP requests
npm run bench          # package size, cold start, memory, latency
```

- `src/`: the server (`server.ts`), the engine (`engine.ts`: validation, analysis, migration), reference lookups and examples (`reference.ts`), search (`search-index.mjs`), limits.
- `knowledge/`: the curated layer (`overlay.mjs`) and the generators for `AGENTS.md` and the Skill (`agents.mjs`). The build fails when the curated layer names an API the library does not have; the tests compile every curated example and check every documented mistake.
- `scripts/build.mjs`: bundles the library's compiler, snapshots the knowledge, measures bundle sizes with the library's builder.

## License

[MIT](LICENSE)
