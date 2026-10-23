# Content authoring

## Create an article

Add `src/content/docs/<path>.mdx`. The URL is `/docs/<path>/`.

```mdx
---
title: State
description: Store local reactive values directly in CSS.
group: Concepts          # Start | Concepts | Reference | Examples | Project
type: Concept            # Guide | Tutorial | Concept | Reference | Index | Example | Project
order: 5                 # sidebar position and previous / next order
status: experimental     # optional: experimental | new
navLabel: State          # optional sidebar label
uses: ["reference/state"]  # example pages: APIs shown on the examples index
---

Reactive CSS lets each component own its own state.

<Example id="counter" />

<Callout kind="note" title="In memory only">

State resets on reload.

</Callout>

<Related ids={["reference/state", "conditions"]} />
```

The page title, lede, breadcrumbs, sidebar entry, table of contents and previous / next links
are generated from the frontmatter and headings. Do not repeat the title as `#`.

## Markdown that works

- `## Heading` and `### Heading` (in the table of contents). `## [1] Add the library` makes a
  numbered tutorial step.
- Inline code: Reactive CSS syntax (`state()`, `:when()`, `on:`) is styled vermilion
  automatically; native code gets a tinted box.
- Fenced code: ```` ```css like.css ```` — the language and an optional file label. CSS with
  reactive syntax gets hover explanations; every block has Copy.
- Tables (GFM), lists, links, **bold**.
- MDX treats `{`, `}` and `<` in prose as code: write `\{`, or put the text in inline code.

## Components

| Component | Use |
|---|---|
| `<Example id size? controls? />` | A runnable example from `src/examples/` |
| `<Compare id />` | A native vs Reactive comparison from `src/content/comparisons/<id>/` |
| `<CodePair>` + two fences | Two code blocks side by side |
| `<Callout kind title?>` | `note`, `tip`, `caution`, `warning`, `experimental`, `provisional`, `outcome` |
| `<Facts>` + `<Fact label>` | The facts row of a tutorial |
| `<Flow>` + `<FlowStep title>` | Numbered steps with arrows |
| `<Cards>` + `<Card href title>` | Next-step cards |
| `<Related ids={[…]} />` | Related pages by content id (`state`, `reference/when`, `examples/tabs`) |
| `<ApiIndex />`, `<ExampleIndex />`, `<AdvancedIndex />` | Generated indexes |

Links between pages use real URLs: `/docs/state/`, `/docs/reference/when/`,
`/docs/binding/#initialization`. The e2e link check fails on broken links and anchors.

## Add an API reference page

API pages are generated from `src/content/api/entries.json`, one object per page:

```json
{
  "id": "attr",
  "name": "attr()",
  "category": "Expressions",
  "features": ["expression:attr"],
  "summary": "One sentence. Inline `code` and [links](/docs/x/) are allowed.",
  "signature": "attr(<attribute-name>, \"<fallback>\"?)",
  "params": [{ "name": "name", "type": "HTML attribute name", "required": "required", "description": "…" }],
  "returns": "…",
  "example": { "id": "an-example-id", "size": "compact" },
  "behavior": ["…"], "contexts": ["…"], "limits": ["…"],
  "related": ["reference/state"]
}
```

`features` must name registry features (`kind:name`, as `describe()` reports them). Status,
"since", experimental and removed tags, and the native equivalent come from the registry, never
from this file. `example` is either an example id or `{ "label", "code" }` for a static block.
A removed feature keeps its entry with a `removal` note. `tests/unit/registry.test.ts` checks
that every shipped feature has an entry and that removed ones explain the removal.

Two optional fields:
- `usage`: correct and incorrect examples (`title`, `verdict`, `label`, `code`, `note`). An incorrect one that does not compile names the expected diagnostic in `diagnostic`. `tests/unit/compile.test.ts` requires correct ones to compile cleanly, and incorrect ones with a `diagnostic` to produce it.
- `demos`: IDs of library demos that use the feature, listed as "Live demos".

Never write a version or a stable/experimental label into an entry: both come from the registry. `tests/unit/api-coverage.test.ts` fails when a shipped feature has no entry, no bundle feature, a status that differs from the registry, its name missing from its page, or an example that does not compile. `npm run api-coverage` writes the matrix to `docs/api-coverage.json`; the audit is `docs/api-coverage-audit.md`. Behavior that matters (events, DOM writes, focus, `prevent()`) gets a test in `tests/e2e/api-examples.spec.ts`, which runs the reference snippet as shown.

## Comparisons

`src/content/comparisons/<id>/meta.json` holds the title, relation (`same`, `approx`,
`overlap`, `only`), the registry features (for the status badge), notes, differences and links.
The native files sit next to it; the Reactive side is the runnable example named in `example`.

## The changelog

`/docs/changelog/` renders the library's `../CHANGELOG.md`. Edit that file, not the site.

## After changing content

`npm run dev` picks up MDX changes live. Run `npm run build` to rebuild the search index, and
`npm run test:e2e` to check links.
