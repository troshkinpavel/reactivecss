# API documentation coverage audit

Audit of the website's API documentation against the library as installed. Local only: no Git, no publishing. The changes are inside `site/`. Library-side corrections are listed in section 12, not made.

The canonical sources are the library's own data and code, not its docs:
- `describe()`, synced to `src/generated/registry.json`;
- `dist/catalog.json` (the 0.8.0 bundle catalog);
- `dist/index.d.ts` (the JavaScript exports);
- `src/core/config.ts` (configuration);
- `tools/reactive-css.mjs` and `tools/bundle.mjs` (CLI and build API);
- the parser and actions source, for `prevent()`.

The machine-readable matrix is `docs/api-coverage.json`, written by `npm run api-coverage`.

## 1. Library version

| Source | Value |
|---|---|
| `package.json` | 0.8.0 |
| `describe().version`, bundle, `dist/catalog.json` | 0.8.0 (checked by `version.test.ts` and `api-coverage.test.ts`) |
| Latest CHANGELOG entry | `## 0.8.0 — Modular runtime and custom bundle builder (local, unpublished)` |
| Site banner and footer | v0.8.0, from the registry |

**Release state:**
- Implemented locally: 0.8.0.
- Prepared as a release: 0.8.0, a beta candidate in the README.
- Published on npm: none. The npm name `reactive-css` belongs to an unrelated package.
- Verified on a CDN: none.

The site says this on Installation. Its CDN URLs are shown under "Illustrative until published", and no npm or CDN URL is presented as working.

## 2. Public API inventory

There are 48 shipped features in the registry: 32 stable and 16 experimental. They are grouped into 12 bundle features: `core`, `events`, `conditions`, `nth-var`, `history`, `forms`, `text`, `attributes`, `focus`, `values`, `dynamic` and `geometry`. Outside the registry, the library also exposes the JavaScript API, the configuration and the CLI listed under the table.

Not shipped, from the registry: `wave()` (removed in 0.5); `history()`, `element(other element)`, `spring()`, `throttle()` and `debounce()` (planned or deferred); and 12 rejected proposals. None is presented as available.

| Feature | Status | Since | Bundle feature | Reference page | Example compiles | Site browser coverage |
|---|---|---|---|---|---|---|
| `function:random` | stable | 0.1 | values | [random](/docs/reference/random/) | yes | 1 (example dice) |
| `function:pick` | stable | 0.1 | values | [pick](/docs/reference/pick/) | yes | 1 (example dice) |
| `function:live` | stable | 0.1 | dynamic | [live](/docs/reference/live/) | yes | library tests only |
| `function:on` | stable | 0.1 | dynamic | [on-value](/docs/reference/on-value/) | yes | 1 (example dice) |
| `function:mouse` | stable | 0.1 | dynamic | [mouse](/docs/reference/mouse/) | yes | 2 (example pointer, example spotlight) |
| `function:visible` | stable | 0.1 | dynamic | [visible](/docs/reference/visible/) | yes | library tests only |
| `function:viewport` | stable | 0.1 | dynamic | [viewport](/docs/reference/viewport/) | yes | library tests only |
| `function:element` | experimental | 0.4 | geometry | [element](/docs/reference/element/) | yes | 1 (example geometry) |
| `function:state` | stable | 0.2 | core | [state](/docs/reference/state/) | yes | 44 (demo product-configurator, demo multi-step-wizard, …) |
| `expression:attr` | experimental | 0.5 | core | [attr](/docs/reference/attr/) | yes | library tests only |
| `expression:pick` | experimental | 0.5 | core | [pick-expression](/docs/reference/pick-expression/) | yes | 1 (example greeting) |
| `expression:split` | experimental | 0.5 | core | [split](/docs/reference/split/) | yes | library tests only |
| `function:when` | stable | 0.2 | conditions | [when](/docs/reference/when/) | yes | 26 (demo product-configurator, demo multi-step-wizard, …) |
| `function:previous` | stable | 0.3 | history | [previous](/docs/reference/previous/) | yes | 6 (demo score-history, demo history-motion, …) |
| `function:direction` | stable | 0.3 | history | [direction](/docs/reference/direction/) | yes | 5 (demo score-history, demo history-motion, …) |
| `function:typed` | experimental | 0.3 | values | [typed](/docs/reference/typed/) | yes | 1 (example compare-typed) |
| `selector:just-checked` | stable | 0.1 | forms | [just-checked](/docs/reference/just-checked/) | yes | 1 (example check) |
| `selector:just-unchecked` | stable | 0.1 | forms | [just-unchecked](/docs/reference/just-unchecked/) | yes | 1 (example check) |
| `selector:nth-var` | stable | 0.1 | nth-var | [nth-var](/docs/reference/nth-var/) | yes | 8 (demo multi-step-wizard, demo interactive-quiz, …) |
| `selector:when` | stable | 0.2 | conditions | [when-selector](/docs/reference/when-selector/) | yes | 26 (demo product-configurator, demo multi-step-wizard, …) |
| `selector:changed` | stable | 0.3 | history | [changed](/docs/reference/changed/) | yes | 5 (demo score-history, demo history-motion, …) |
| `declaration:on` | stable | 0.2 | events | [on](/docs/reference/on/) | yes | 37 (demo product-configurator, demo multi-step-wizard, …) |
| `declaration:text` | experimental | 0.5.1 | text | [text](/docs/reference/text/) | yes | 17 (demo product-configurator, demo multi-step-wizard, …) |
| `declaration:attr` | experimental | 0.5.3 | attributes | [attr-declaration](/docs/reference/attr-declaration/) | yes | 18 (demo product-configurator, demo multi-step-wizard, …) |
| `declaration:focus` | experimental | 0.6.0 | focus | [focus-declaration](/docs/reference/focus-declaration/) | yes | 5 (demo multi-step-wizard, demo interactive-quiz, …) |
| `declaration:bind` | stable | 0.3 | forms | [bind](/docs/reference/bind/) | yes | 16 (demo product-configurator, demo live-form-preview, …) |
| `trigger:click` | stable | 0.2 | events | [triggers](/docs/reference/triggers/) | yes | 37 (demo product-configurator, demo multi-step-wizard, …) |
| `trigger:change` | stable | 0.2 | events | [triggers](/docs/reference/triggers/) | yes | library tests only |
| `trigger:input` | stable | 0.2 | events | [triggers](/docs/reference/triggers/) | yes | library tests only |
| `trigger:pointerenter` | stable | 0.2 | events | [triggers](/docs/reference/triggers/) | yes | library tests only |
| `trigger:pointerleave` | stable | 0.2 | events | [triggers](/docs/reference/triggers/) | yes | library tests only |
| `trigger:focus` | stable | 0.2 | events | [triggers](/docs/reference/triggers/) | yes | library tests only |
| `trigger:blur` | stable | 0.2 | events | [triggers](/docs/reference/triggers/) | yes | library tests only |
| `trigger:focusin` | experimental | 0.5.1 | events | [lifecycle-triggers](/docs/reference/lifecycle-triggers/) | yes | 1 (demo keyboard-playground) |
| `trigger:focusout` | experimental | 0.5.1 | events | [lifecycle-triggers](/docs/reference/lifecycle-triggers/) | yes | 1 (demo keyboard-playground) |
| `trigger:reset` | experimental | 0.5.1 | events | [lifecycle-triggers](/docs/reference/lifecycle-triggers/) | yes | library tests only |
| `trigger:animationend` | experimental | 0.5.1 | events | [lifecycle-triggers](/docs/reference/lifecycle-triggers/) | yes | library tests only |
| `trigger:animationcancel` | experimental | 0.5.1 | events | [lifecycle-triggers](/docs/reference/lifecycle-triggers/) | yes | library tests only |
| `trigger:transitionend` | experimental | 0.5.1 | events | [lifecycle-triggers](/docs/reference/lifecycle-triggers/) | yes | library tests only |
| `trigger:transitioncancel` | experimental | 0.5.1 | events | [lifecycle-triggers](/docs/reference/lifecycle-triggers/) | yes | library tests only |
| `trigger:key` | stable | 0.3 | events | [key](/docs/reference/key/) | yes | 4 (demo accessible-tabs, demo keyboard-playground, …) |
| `trigger:outside` | stable | 0.3 | events | [outside](/docs/reference/outside/) | yes | 1 (example dropdown) |
| `action:set` | stable | 0.2 | events | [set](/docs/reference/set/) | yes | 21 (demo product-configurator, demo multi-step-wizard, …) |
| `action:prevent` | experimental | 0.7.0 | events | [prevent](/docs/reference/prevent/) | yes | 3 (demo accessible-tabs, demo keyboard-playground, …) |
| `action:toggle` | stable | 0.2 | events | [toggle](/docs/reference/toggle/) | yes | 13 (demo accessible-toggle, demo settings-panel, …) |
| `action:increment` | stable | 0.2 | events | [increment](/docs/reference/increment/) | yes | 19 (demo product-configurator, demo multi-step-wizard, …) |
| `action:decrement` | stable | 0.2 | events | [decrement](/docs/reference/decrement/) | yes | 15 (demo product-configurator, demo multi-step-wizard, …) |
| `action:cycle` | stable | 0.3 | events | [cycle](/docs/reference/cycle/) | yes | 5 (demo accessible-tabs, demo keyboard-navigation, …) |

**Not in the registry:**
- **JavaScript API** (`dist/index.d.ts`): `start`, `stop`, `refresh`, `stats`, `compile`, `diagnostics`, `describe`, `version`, `FEATURES`, `KEEP_NATIVE`, and the internal `defineFunction` / `defineSelector` / `defineAction`.
- **Configuration** (`window.ReactiveCSSConfig`): `native` and `trustInlineStyles`.
- **Package exports:** `.`, `./auto`, `./bundle` and `./catalog.json`, plus the `reactive-css` binary.
- **CLI commands:** `features`, `resolve`, `build` and `analyze`.
- **CLI options:** `--features`, `--profile`, `--exclude`, `--format`, `--no-minify`, `--out`, `--json`, `--assume-complete` and `--build` (`--save-dev` exists in the source but isn't documented on the site).
- **Profiles:** `basic`, `forms`, `stateful-ui`, `dynamic` and `full`.
- **Build API:** `catalog`, `resolve`, `build`, `analyze` and `sizes`.

## 3. Coverage matrix

Per feature in `docs/api-coverage.json`:
- registered;
- documented (the reference page);
- the status shown on the page, compared with the registry;
- the name appears on its page (searchable);
- `describe()`'s own examples compile;
- the page example compiles;
- the bundle feature;
- the site's browser coverage.

Result for all 48 features: registered, documented, bundle feature found, status and version shown from the registry, name on the page, and both kinds of example compile.

**Browser coverage on the site:** 32 of 48 features run in a stylesheet that the site's own Playwright tests load (the 18 published library demos, plus the site examples the specs open). The other 16 are covered only by the library's own browser suite (521 results in 0.8.0): `live()`, `visible()`, `viewport()`, the `attr()` and `split()` expressions, `change()`, `input()`, `pointerenter()`, `pointerleave()`, `focus()`, `blur()` and the five other 0.5.1 triggers. `animationend()` now also runs through its reference example (section 10).

**Navigation and search:** every shipped entry is linked from the reference index and from the docs sidebar (tested). Pagefind indexes 122 pages, every reference page among them.

**Problems found**, by class:
- **Undiscoverable feature:** `prevent()`. It had a page, but Events & Actions, `key()`, `on:` and the keyboard demos never linked to it (section 4).
- **Outdated text:**
  - Events & Actions listed only the 0.2 triggers.
  - The reference index's "Not shipped" table was hand-written and listed `:just-focused` and `:just-blurred`, which are a README proposal, not registry entries.
- **Missing documentation:** `compile()`, `version`, `FEATURES`, `KEEP_NATIVE` and the `define*` extension points.
- **Incomplete example:** the `animationend()` example used an animation named `fade` that it never defined, so it could not fire.
- **Wrong version or status:** none found. Both are derived from the registry, never written into entries, and the coverage test enforces it.
- **Broken links:** none (link crawl and anchor tests).

## 4. `prevent()`, fixed first

The page was always at `/docs/reference/prevent/` (since the Vision integration), but nothing pointed to it. It now explains, verified against `src/state/actions.ts` and `src/core/parser.ts`:
- why it exists;
- why it runs synchronously, with the passive/non-passive listener switch;
- that its position in the action list doesn't matter;
- why it isn't `stopPropagation()`;
- that it acts only inside the element (`composedPath()`);
- that form controls keep their keys unless they carry the rule;
- non-cancelable events, and the `defaultPrevented` read-back warnings;
- conditional rules;
- the exact contexts where it is a compile error;
- the container warning.

New sections:
- **Correct and incorrect usage:**
  - correct: tab-list arrow keys, a confirmation before a link navigates, and a conditional PageDown;
  - incorrect: a container `click(prevent())`, `prevent()` in `input()`, and `prevent()` in `outside()`.
- **Live demos:** Accessible tabs, Keyboard navigation and Keyboard playground, which are the three library demos that use it.

It is reachable from: the reference index and the sidebar (Actions); Events & Actions, which has a new `prevent()` section; `key()`, `on:`, the triggers page and `outside()` (behavior lines and Related); the three demo pages (their new "Uses" links); and search, for both `prevent` and `prevent()`.

## 5. Missing or repaired pages
- Events & Actions:
  - the trigger table now includes `focusin`, `focusout`, `reset`, `animationend`, `animationcancel`, `transitionend` and `transitioncancel`;
  - new `prevent()` section;
  - the `key()` section links it.
- Installation: added `compile(css)`, `version`, `FEATURES`, `KEEP_NATIVE` and the `define*` extension points (marked internal, not a stable plugin API).
- API Reference index: a new "Beyond CSS" section links the JavaScript API and the CLI. "Not shipped" is now generated from the registry (`mdx/NotShipped.astro`).
- `animationend()` and the other lifecycle triggers: the example now defines its keyframes and hides the toast with `:when(not --shown)`.
- Library demo pages: a "Uses" row links every Reactive CSS feature in the demo to its reference page.

No feature lacked a page; the registry test had already guaranteed that since the Vision pass. So no new one-paragraph pages were made. Grouped pages remain (Triggers; Focus, reset, animation and transition triggers).

## 6. Incorrect syntax corrected
- `animationend()` example: undefined `@keyframes fade`, so it could never run.
- A `:when(!--shown)` I tried while writing the fix doesn't compile; the parser accepts `not --shown`. This is now covered by the compile test.

## 7. Limitations now documented
- **`prevent()`:**
  - container cancellation;
  - no `submit` and no `stop()`;
  - non-cancelable events;
  - form controls;
  - headless WebKit arrow keys;
  - Firefox unverified.
- **`key()`:** a handled key keeps its native effect unless `prevent()` is in the list.
- **`outside()`:** `prevent()` is a compile error there.

## 8. Navigation and search
- No new sections: the existing groups (Start, Concepts, Reference by category, Examples, Project) already cover the suggested grouping. Custom bundles sit under Start, and the JavaScript API under Installation.
- Tested queries, each with the expected page in the top six results: `prevent`, `prevent()`, `focus`, `aria-disabled`, `attr`, `custom bundle`. Also, from the earlier QA: `focus declaration`, `animationend`, `evolving`, `latency` and `notification center`.

## 9. Snippet validation
`tests/unit/compile.test.ts` uses the installed `compile()`.
- **Where it looks:**
  - every API example and usage example;
  - every site example stylesheet, Playground presets included;
  - every published library demo;
  - the Vision stage 04 code;
  - the homepage install snippets;
  - every Reactive CSS block in the MDX docs.
- **Result:** zero unexpected diagnostics. Incorrect usage examples must produce their documented diagnostic, so a correct example can never be marked incorrect, and the reverse.
- **Not checked:** the bundle builder page and the Performance page show no Reactive CSS snippets. JS, HTML and shell snippets aren't compiled; the CLI commands were run by hand (section 11).

## 10. Behavioral tests
`tests/e2e/api-examples.spec.ts` runs the reference snippets exactly as shown, with the site's runtime bundle, in Chromium and WebKit. It adds only markup, and one trigger rule where the snippet has none.

| Snippet | Checked |
|---|---|
| `prevent()` example (tabs) | `defaultPrevented` true for ArrowRight, false for ArrowLeft; the state cycles |
| `prevent()` "Cancel only while a condition holds" | Real page scrolling: PageDown scrolls, is cancelled while locked, then scrolls again (both engines) |
| `prevent()` incorrect container rule | A link inside really stops navigating |
| `text:` | The text nodes read 1 / 0 / 1 / ▲ up after a click |
| `attr:` | Native `disabled` at both bounds |
| `focus:` | `document.activeElement` is the new heading after Next, and `<body>` on load |
| `animationend()` | `--shown` turns false and the toast is hidden when its own animation ends |

`tests/e2e/api-discovery.spec.ts` covers the index and sidebar links for every entry, the `prevent()` links and page content, and the six search queries. The library demos' real DOM text, `aria-disabled`, `focus:`, `prevent()` and native `disabled` were already tested by `demos.spec.ts`.

## 11. Synchronization checks (run on every `npm test`)
- **`version.test.ts`:**
  - the package, `describe()`, the bundle, the banner, the CHANGELOG and the homepage status line all agree.
- **`registry.test.ts`:**
  - every shipped feature has an entry;
  - every documented feature exists in the registry;
  - removed features carry a removal note.
- **`api-coverage.test.ts`:**
  - every shipped feature maps to a bundle feature;
  - the status label on each page matches the registry;
  - each feature's name appears on its page;
  - both `describe()`'s examples and the page example compile;
  - the catalog the site shows is the library's;
  - the JavaScript API, configuration, CLI commands and package exports are documented;
  - no unshipped feature is presented without a removal note.
- **`compile.test.ts`:** every presented snippet compiles.
- **CLI, run by hand against `tools/reactive-css.mjs`:**
  - `features` (exit 0);
  - `build --features events,conditions,focus` gives the exact output quoted on Custom bundles: 63,373 B minified, 22,268 B gzip, 20,134 B brotli;
  - `build --features evnts` gives the quoted `unknown-feature` error, exit 1;
  - `resolve --profile stateful-ui` and `analyze` on a sample stylesheet both work.

A new registry feature without a page, a status change, a renamed export or a non-compiling example now fails `npm test`.

**Registry metadata gaps** (proposed, not made; library-side): the registry has no category for the JavaScript API, and no `since` for the configuration options. Adding `since` to `Config` fields, and a list of public exports to `describe()`, would let these checks cover them without the hand-kept name list in `api-coverage.test.ts`.

## 12. Library-side documentation discrepancies (not edited)
- README §"Browser support": the table header still reads "Status (0.5.0, tested locally)"; the rows describe 0.7.1/0.8.0.
- README "Proposed" lists `:just-focused` and `:just-blurred`, which the registry does not record. Either add them to the registry as `planned`, or mark them as ideas.
- README JavaScript API table: `version`, `FEATURES` and `KEEP_NATIVE` are exported but not listed.
- `--save-dev` is accepted by the CLI but not described in `docs/bundle-builder-0.8.md`'s option list. It was not checked further.
- `docs/example-comparison.md` was updated by its own session earlier, and no further conflict was found.

## 13. Browser verification
- **Automated (site):** Chromium and WebKit, Playwright engine builds. Every API behavioral test passes in both.
- **Automated (library):** 521 browser results in Chromium and WebKit for 0.8.0 (`docs/release-0.8.0.md` §3).
- **Manual:** a user-reported pass of the 0.7.1 examples in Chrome, Safari and Firefox (`docs/release-0.7.1.md` §6), with no versions recorded.
- **Firefox (automated):** not run; Playwright's Firefox does not start on the development machine.
- **Screen readers:** not tested.

## Results (this pass)
- Typecheck: 0 errors.
- Unit: 251 passed.
- Storybook: 91 passed.
- Build: 125 pages, with Pagefind indexing 122.
- Playwright, Chromium + WebKit: 230 passed, 39 skipped:
  - the visual tests in WebKit (baselines are Chromium-only);
  - one WebKit keyboard Tab test;
  - one WebKit clipboard test;
  - other skips from earlier specs.
- Responsive: the API pages, Events, Installation and Custom bundles show no horizontal overflow at 320, 375, 390, 768, 1024 and 1440 px.
- **Screenshots:** five Chromium baselines (Getting Started at all widths, `state()` at 390 px) changed because the parallel 0.8.0 session restyled the example preview header ("● Result"); the 390 px `state()` baseline also still showed v0.7.0. That session reviewed and updated them. After that, the visual, API example and API discovery specs passed three runs in a row (56 passed each). An earlier run right after a fresh build had one unidentified failure that didn't recur.
