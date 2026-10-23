# Changelog

All notable changes. This project is not published; versions are local builds.

## 0.9.0 — The 0.9 language (local, unpublished)

A new way to write behavior, built on the 0.8 runtimes. **The 0.8 syntax keeps working.**
- **Design:** `docs/rfc-v0.9.0-language.md`.
- **Migration:** `docs/migration-0.9.md`.
- **Engineering report:** `docs/release-0.9.0-preparation.md`.
- **Measurements:** `benchmarks/v090/results.md`.

### Added
- **Event rules: `:on()`.** `.b:on(click) { --count: increment(1); }`.
  - **Mutations** go on the state's own custom property: `set(expr)`, `toggle()`, `increment(n?)`, `decrement(n?)`, `cycle(a, b, …)`.
  - **Triggers:**
    - 32 DOM events, among them pointer, mouse, form, `submit`, keyboard, focus, animation, transition, `scroll` and `scrollend`;
    - key filters with `keydown(Key)` and `keyup(Key)`;
    - `outside(click | pointerdown | focusin)`.
  - **Modifiers (functions, each optional):**
    - `prevent()` calls `preventDefault()` synchronously, for cancelable events only;
    - `stop()` calls `stopPropagation()` (not `stopImmediatePropagation()`) when the event reaches the element, so ancestors' rules and listeners do not see it.
  - **Cascade.** The cascade picks one winning mutation per state, trigger and element, using origin, `!important`, layers, specificity, order, media and `:when()`.
  - **Transactions.** Each event is one transaction: all values are read before any write.
- **Event-time expressions** in mutations:
  - arithmetic: typed `calc()`, `min()`, `max()`, `clamp()`, `round()`, `abs()`, `var()`;
  - event data: `event(field)`, a closed catalog checked against the trigger;
  - snapshots read once: `mouse()`, `element()`, `viewport()`, `random()`, `pick()`, `attr()`, `sibling-index()`, `sibling-count()`.
- **Drag gestures** (feature `gestures`): `:on(drag)` and `:on(drag(start | move | end | cancel))`.
  - `event(x)` and `event(y)` give the mutated state at drag start plus the pointer distance, so positions continue across drags.
  - `event(delta-x)`, `event(movement-x)` and `event(start-x)` give the raw distances (and the same for `y`).
  - Pointer capture, a 3 px threshold and `pointercancel` handling.
  - At idle there is one `pointerdown` listener and nothing else.
- **Persistence** (feature `persist`): `state(v, persist("key" [, session]))`.
  - Initial value: storage, then the DOM source, then the declared value.
  - Stored values are validated by type.
  - Writes are coalesced (at most 4 per second per key).
  - Keys are shared between widgets and across tabs.
  - When storage is unavailable, the page gets one note and keeps working.
- **`state(v, bind(value | checked))`:** two-way binding of a control with its own state.
- **`--attr-<attribute>`:** the reserved custom-property namespace for attributes, with the `attr:` semantics.
  - The allowlist adds `aria-hidden`, `aria-busy`, `aria-checked`, `aria-invalid`, `aria-label`, `aria-valuenow` and `aria-valuetext`.
- **`content: var(--x)` as DOM text** on elements: the native declaration is kept, and only state-reading values count.
- **Focus requests use `focus: when(condition)`**, the 0.6 declaration. It is now also armed by `:on(pointerup)`, `:on(submit)` and drag end. Plain `:focus` stays native.
- **`:blur`** (feature `blur`): matches from a real focus loss until the next focus.
- **`attr(name, typed fallback)` in `state()`:** reads the attribute once, as that type.
- **Analyzer:**
  - `files[].legacy` lists 0.8 declarations with their 0.9 form;
  - every new construct maps to its feature;
  - exact usage keys now win over wildcards.
- **Catalog:** the features `gestures`, `persist` and `blur`, and the profile `interactive`.
- **`describe()`:** adds `actionExpressions` and `onEvents`. Registry entries of kind `rule` cover `:on()` and `drag`.

### API cleanup (before publication)
Reports: `docs/release-0.9.0-preparation.md` and `docs/release-0.9.0-hardening.md` (section J).

These changes only affect syntax that existed in unpublished 0.9 candidates; 0.8 syntax is unchanged.
- **`focus:` is the one focus API.** `:focus(when(...))` was removed, together with its duplicate runtime. A functional `:focus(...)` now gets one diagnostic that says to write `focus: when(...)`.
- **`:on()` modifiers are functions:** `prevent()` and `stop()`. The bare `prevent` and `stop` forms are compile errors that say what to write.
- **`once` was removed from `:on()`,** with its per-element registration records. `once` and `once()` are compile errors that suggest a `:when()` guard. Legacy `on:` is unchanged.

### Hardening (before publication)
Report: `docs/release-0.9.0-hardening.md`.

- **Production diagnostic codes.** Production bundles replace message text with stable codes, `RCSS-<area><nnn>⟦values⟧`; development bundles keep the text.
  - **Registry:** `src/core/diagnostics.json`, append-only.
  - **Lookup:** `dist/diagnostics.json` and `reactive-css explain`, which works offline and without esbuild.
- **Native `random()`, aligned with the 2026 draft** that Chromium and WebKit implement:
  - native-only keys (`--name`, `element-scoped`, `property-scoped`, `fixed`) are left to the browser;
  - supported calls stay native whatever their units or step;
  - the plain third-argument step is accepted, natively or polyfilled; `by <step>` and `element-shared` stay;
  - valid native CSS no longer gets a warning.
- **Drag:** a press in an input, textarea, select or editable element inside a draggable never starts a drag.
- **`:blur` without a compound** (`.form:has(:blur)`) works, as the RFC described.
- **Fixed: elements moved in the DOM kept rules they no longer matched** (0.8 as well). A subtree moved within the document is now re-matched both ways.
- **Fixed: two places read or sliced diagnostic text**: a custom element's `disabled` wait and the native-function note. Found by the codes.
- **Types:** the `.d.ts` files get explicit `.js` extensions (`tools/fix-dts.mjs`) and now resolve under `moduleResolution` `node16` and `nodenext` too. This was a 0.8.1 blocker.
- **Smaller code:** one parser path for `focus:`, `text:`, `attr:` and `--attr-*`.

### Changed
- **`--attr-*` custom properties with an allowlisted suffix now write that attribute** (the one possibly breaking change: rename such properties if they were plain CSS).
- `state()` takes up to two modifiers (`bind()`, `persist()`) in any order. The message for a third argument that is neither is new.
- **`attr()` fallbacks:** in `state()` and `set()` the fallback may be any value (`attr(data-n, 0)`); in 0.8 it had to be a quoted string.
- **`prevent()` and `:on(…, prevent)`** keep form-control keys for `keyup` too.
- **Focus requests** are also armed by `pointerup` and `submit`, which only 0.9 triggers produce.
- **Sizes:** `reactive-css.min.js` grew from 117,830 B to 151,472 B after hardening (gzip from 39,715 to 49,936, brotli from 34,983 to 43,811); the pre-hardening candidate was 162,675 B. The `events` feature grew from +11.3 KB to +32.5 KB. The new features add +2.2 KB (`gestures`), +3.8 KB (`persist`) and +0.9 KB (`blur`). Measured; see `docs/release-0.9.0-preparation.md`, section 4. After the API cleanup, the final 0.9.0 build is 149,039 B (gzip level 9: 49,253 B), and the compact bundle 128,495 B (42,516 B).

### Fixed
- Nothing user-visible: 0.8.1 behavior is unchanged. The 0.8.1 browser suite passes on 0.9.0. Assertions were updated only for the additive changes: the feature count, the `rule` kind, the `describe()` keys, the two message changes above, and `aria-label` and `aria-hidden` becoming writable.

## 0.8.1 — Pre-beta stabilization (local, unpublished)

A patch release: fixes found by the internal experiments and the visual lab. No new public API. Report: `docs/prebeta-runtime-stabilization.md`. Release preparation: `docs/release-0.8.1-preparation.md`.

### Fixed
- **Analyzer: root-relative stylesheets.** `href="/x.css"` was resolved against the filesystem root, a guessed location. It now resolves only against an explicit site root: CLI `--root <dir>`, API `analyze(inputs, { root })`. Paths that leave the root are refused. Without a root, a `root-relative-link` note explains why the analysis is incomplete and the full runtime is recommended.
- **Analyzer: query strings.** `style.css?v=2` (and `#hash`, percent-encoding) now finds `style.css`.
- **Keyboard focus.** An Enter or printable-key action that moved focus with `focus:` also activated the newly focused button, kept Enter from submitting its form, and typed a shortcut letter into a newly focused field. Focus after those keys now moves in the next frame. Arrow keys, Home, End, Escape, Tab and prevented keys keep the same-task timing (roving tabindex is unchanged).
- **`:changed()` held by unrelated animations.** Only animations and transitions that `:changed()` rules can start now keep the marker, as documented. When those rules set custom properties or use `var()`, every animation in the subtree still counts (conservative fallback). Several `:changed()` rules on one state still clear together.
- **`bind:` lost a fast second choice** on pages with an `on: click` rule. Two radio choices in one task (what arrow keys do), two clicks on a checkbox, or two arrow-key moves in one frame left the control and the state on the first choice. Native updates are no longer overwritten by queued writes. `input`/`change` read the new value, and a cancelled click leaves both the control and the state unchanged.

### Changed
- `analyze --build` with an incomplete analysis now says that the build is the full runtime and why.
- Focus requests after Enter and printable keys move one frame later on pages with `attr:` bindings (as on pages without them).
- `bind:` adds one capture `click` listener on `window` while any bound control exists. It is removed with the last one.
- Sizes: `reactive-css.min.js` grew from 116,319 B to 117,830 B (measured; `docs/release-0.8.1-preparation.md`).

### Documentation
- `live()` (and other sources) keep running while a `:when()` merely selects a different value. To stop a source, remove its element or gate it with a native attribute such as `details[open]`.
- `element()` has no value for one frame after the first measurement, so the `var()` fallback applies first.
- WebKit engine limitations, reproduced without Reactive CSS:
  - a `text:` inside a section hidden by CSS can show a stale value when the section is shown by something other than a state change;
  - `:has(:invalid)` does not update after a required, empty `<select>` is enabled.

  Both have documented state-driven workarounds. They are not library fixes.
- Version: one source in the runtime (`src/core/version.ts`), checked against `package.json`. The lockfile metadata (stale since 0.1.0) was resynchronized.

## 0.8.0 — Modular runtime and custom bundle builder (local, unpublished)

Report: `docs/release-0.8.0.md`. Decision record: `docs/rfc-modular-runtime-0.8.md`. Tooling: `docs/bundle-builder-0.8.md`.

### Added
- **Custom bundles.** The runtime is split into a core and 11 features: `events`, `conditions`, `nth-var`, `history`, `forms`, `text`, `attributes`, `focus`, `values`, `dynamic`, `geometry`.
  - One catalog (`src/features/catalog.ts`, also `dist/catalog.json`) lists their syntax, requirements and status.
  - Dependencies come from the code, and a test builds each feature alone to check them.
- **Missing-feature diagnostics.** A custom bundle still recognizes all syntax. A declaration, function or selector whose feature is not included is reported once with the feature ID ("text: is not included in this bundle (feature "text"); …"), and left to the browser as before. `random()` and `element()`, which native CSS also defines, get a note.
- **`describe().bundle`:** the included feature IDs (`null` when imported from source).
- **`reactive-css` CLI and `reactive-css/bundle` API:**
  - `features`, `resolve`, `build` and `analyze`;
  - profiles (`basic`, `forms`, `stateful-ui`, `dynamic`, `full`);
  - requirements added automatically and explained;
  - error codes with suggestions;
  - a manifest with minified, gzip and brotli sizes.
- **Analyzer:** uses the real compiler on CSS, HTML and directories. When the analysis is incomplete (other scripts, remote sheets, `@import`, unreadable files), it recommends the full runtime.
- **Benchmarks:** `benchmarks/bundle-sizes.mjs` (sizes, per-feature overhead, startup). `benchmarks/audit/memory.mjs --bundle=custom/<file>.js` runs on custom bundles.

### Fixed
- **A `<link>` whose `href` changed could keep its old sheet unprocessed.** `link.sheet` can briefly still be the previous sheet. Found by running the examples on custom bundles in WebKit; regression test in `tests/browser/v071.spec.ts`.

### Changed
- `reactive-css.min.js` is 1.9 KB larger (116,319 B): it now carries the missing-feature diagnostics and runtime registration. Behavior is unchanged: all earlier tests pass.
- `package.json` (local):
  - a `bin` entry, plus `exports` for `./bundle` and `./catalog.json`;
  - `files` now include `src` and `tools`;
  - esbuild is an optional peer dependency, needed only by the builder.

## 0.7.1 — Cross-browser validation and advanced examples (local, unpublished)

Report: `docs/release-0.7.1.md`. Manual test guide: `docs/browser-validation-0.7.1.md`. No new public API.

### Fixed (found by the new examples, each with a regression test in `tests/browser/v071.spec.ts`)
- **A disabled and re-enabled `<link>` stylesheet lost its Reactive CSS.** The browser drops the sheet when the link is disabled and loads a fresh, unprocessed copy when it is re-enabled, but only `href` changes were observed. The `disabled` and `media` attributes of stylesheet links are now observed too: disabling releases the sheet's rules at once, re-enabling processes the fresh sheet, and a `media` change re-reads.
- **`text:`, `attr:` and `focus:` reading a state declared in a later-loading stylesheet showed nothing**, and reported a false "needs one value" warning. They now read again after every stylesheet is compiled or dropped. A value that still contains uncompiled Reactive CSS syntax (another sheet not yet processed) is skipped silently instead of reported.
- **`focus:` could move focus out of an open popover in WebKit.** The rule only checked where focus was, and a click inside the popover does not focus a button in WebKit. The target of the activating event is now checked too (`rfc-focus-declaration-0.6.md`, rule 8).

### Examples
- Eight validation examples: focus transitions, keyboard navigation, attribute playground, dynamic components, nested state and cascade, form interactions, history and motion, stylesheet lifecycle lab.
  - The two lifecycle labs use a clearly marked JavaScript test harness.
  - Every README has a manual checklist and browser notes.
- Demo lab: the eight examples, a `harness.js` source tab, and a cross-browser checklist page (`examples/lab/checklist.html`) built from the READMEs. Every cell starts as "not tested"; results copy as Markdown.

### Unchanged
- Every 0.7.0 API and behavior. All earlier tests pass unchanged.

## 0.7.0 — Native event control (local, unpublished)

Report: `docs/release-0.7.0.md`. Decision record: `docs/rfc-prevent-action-0.7.md`.

### Added (experimental)
- **`prevent()`**: an action that calls `event.preventDefault()` synchronously during dispatch, in `click(…)` and `key(…)` only.
  - It cancels only events that happened inside the element with the declaration.
  - It never cancels keys in a form control or editable element that does not carry the rule.
  - Non-cancelable events are reported, and the result is checked.
  - It never stops propagation, and runs only when its (possibly conditional) declaration is the one that applies.
- The document listener for an event type is non-passive only while a rule uses `prevent()` for it; otherwise it stays passive.

### Examples
- **Tabs:** arrow keys, Home and End no longer scroll the page.
- **Keyboard playground:** the pad's arrow keys no longer scroll.

### Not added
- `stop()`: misleading with a delegated listener; `handled()` is described as future research.
- A `submit` trigger: assessed and deferred.
- `prevent()` in `reset`, `outside()` and non-cancelable events: compile errors.

### Unchanged
- Every action and trigger without `prevent()` behaves as in 0.6.0 (all earlier tests pass).
- `ActionDef.run(el, data)` gains an optional third `event` argument; the internal extension point stays compatible.

## 0.6.0 — Accessible reactive interfaces (local, unpublished)

Report: `docs/release-0.6.0.md`. Decision record: `docs/rfc-focus-declaration-0.6.md`.

### Added (experimental)
- **`focus: <value>`**: moves focus to the matched element when its value goes false → true because of a trusted user `click`, `keydown`, `input` or `change`.
  - Never on load, insertion, scripts, timers, form reset or focus events.
  - Never over focus the user moved, focus inside the target, or an open dialog or popover.
  - Resolved after the state's CSS and `attr:`/`text:` writes. The first eligible target in document order wins.
  - Targets that cannot take focus are reported; `tabindex` is never added.
  - Trusted stylesheets only.
- **`aria-disabled`** in the `attr:`/`bind()` allowlist (`"true"`/`"false"`, also from `1`/`0`). It does not block events: make actions inactive with conditional `on:` rules.
- **`tabindex`** in the allowlist, restricted to `0` and `-1` (roving `tabindex`).

### Changed
- **Performance (from the post-0.5.3 experiment, `docs/attr-performance-optimization.md`).** Same-task `attr:` passes no longer re-read the bindings of earlier events in the same frame (21 → 2 computed-style reads per click in a 20-event burst).

### Examples
- **Wizard:** focus moves to the new step's heading.
- **Quiz:** answering moves focus to Next; Next and Try again move it to the card heading.
- **Tabs:** ArrowLeft/Right, Home and End, a roving `tabindex`, and focus that follows the selection (ARIA Tabs, automatic activation; keyboard behavior tested, screen readers not).
- **Configurator:** `aria-disabled` with clamp rules, so focus stays on a button at its bound.

### Unchanged
- `state()`, `on:`, `bind:`, `text:`, `attr:` and `state(…, bind())` behave as in 0.5.3 (all earlier tests pass).

## 0.5.3 — Derived HTML attributes and demo validation (local, unpublished)

Reports: `docs/release-0.5.3.md`, `docs/demo-validation-0.5.3.md`.

### Added (experimental)
- **`attr: <attribute> <value>`**: one allowlisted HTML attribute of the matched element, derived from a reactive value (usually state owned by an ancestor).
  - Allowlist and value semantics as `state(…, bind())`. Boolean states (`1`/`0` in CSS) are accepted for the true/false attributes.
  - Each attribute compiles to its own registered, non-inherited property (`--rcss-attr-<name>`). Declarations for different attributes combine; the cascade picks the winner for the same attribute. The original attribute is restored when none applies, unless something else changed it (the binding then yields).
  - Written in the same task as the action or bound control that changed the state, so a derived `disabled` stops the next click.
  - HTML applicability, checked on write:
    - `disabled` only on native controls, fieldsets and form-associated custom elements;
    - `required` only on applicable controls;
    - `hidden` only on HTML elements.
    
    Otherwise the attribute is skipped with one warning per element type. Obvious ARIA misuse (`aria-pressed` outside a button, `aria-selected` without a supporting role) gets a warning.
  - A `state(…, bind())` of the same attribute on the same element wins, with a diagnostic. Trusted stylesheets only.
- **`when(condition)`** without branches gives `true`/`false`.

### Changed
- After event-driven work (actions, bound controls) that affects a derived attribute, the late phase (`attr:` and `text:` reads) runs in the same task instead of the next frame. It runs once more if it wrote anything, and again in the frame.

### Examples
- Updated:
  - configurator: derived `disabled` at the bounds;
  - wizard: `aria-current="step"`, disabled Back/Next/Finish;
  - quiz: answered options `disabled`, the chosen one `aria-pressed`;
  - form preview: derived `data-*` on the card;
  - score history: Reset disabled at 0, `data-direction`.
  
  The 0.5.1 clamp rules are gone.
- New: settings panel, accessible tabs, shopping cart, notification center, form validation, keyboard playground.
- New demo lab `examples/lab/`: all examples with their source, README and optional diagnostics (lab tooling only). Every example README has a manual test checklist.

### Found and fixed during validation
- **WebKit stale computed values.** WebKit can return a stale computed value, in the same task, for an element under `display: none` (quiz options in hidden cards; a field inside a just-unhidden wrapper). Fixed by a second same-task read after writes, plus a frame re-read.
- **The wizard's Finish guard.** Removing the 0.5.1 clamp rules would have let a script click the hidden Finish button outside step 4. Finish is now derived-`disabled` outside step 4.

### Unchanged
- `state(…, bind())`, `bind:`, `text:`, `attr()` and every action behave as in 0.5.2 (all earlier tests pass).

## 0.5.2 — Reactive HTML attribute binding (local, unpublished)

Report: `docs/release-0.5.2.md`.

### Added (experimental)
- **`state(initial, bind(attribute))`**: a state mirrored to one allowlisted HTML attribute of its owner: `aria-expanded`, `aria-pressed`, `aria-selected`, `aria-current`, `disabled`, `hidden`, `required`, `data-*`.
  - The attribute initializes the state once (invalid values are reported and ignored); every state change then writes it synchronously, with HTML/ARIA semantics.
  - The cascade winner chooses the attribute. The original value is restored on cleanup unless something else changed it.
  - Trusted stylesheets only. Bound attributes never re-match reactive rules.
- Example: `examples/accessible-toggle` (`aria-pressed`, `aria-expanded`). The live form preview mirrors its accent to `data-accent` and styles it with attribute selectors.

### Fixed
- **A `@layer a, b;` statement after the first rule of a reactive stylesheet was dropped** when the sheet was rewritten, so the layer order fell back to first appearance and the wrong layer could win. Only the leading statements are skipped now.

### Unchanged
- `state()` without `bind()`, `state(attr(…))` (an initializer only), `bind:` on form controls, `text:` and all actions behave as in 0.5.1 (tested).

## 0.5.1 — Correctness, DOM text binding (local, unpublished)

Report: `docs/release-0.5.1.md`. RFCs (not implemented): `docs/rfc-attribute-binding.md`, `docs/rfc-focus-management.md`, `docs/rfc-event-control.md`.

### Fixed
- **Conditional actions saw last frame's conditions.** `:when()` and `:nth-var()` are applied as marker attributes in the frame flush, and the cascade that picks an `on:` declaration reads them. A second event before the next frame therefore used stale conditions: bounds could be exceeded (12 clicks → 13), a quiz answer scored twice, real rapid clicks were affected too. Now, before each event is dispatched, the logical consequences of earlier actions in the same frame (state values, `:when()` and `:nth-var()` markers) are applied (`scheduler.sync()`). It costs nothing when nothing is pending; visual updates still happen in the frame.

### Added (experimental)
- **`text:`**: writes one scalar value (`var(--x)`, `previous()`, `direction()`, `when()`, a literal) into the element's own DOM text, through the `Text` node API. Only for elements that are empty or hold one text node. The cascade picks the winning declaration; the original text is restored when none applies; the binding yields if something else changes the text. Trusted stylesheets only.
- **Triggers:** `focusin`, `focusout`, `reset` (bubbling), and `animationend`, `animationcancel`, `transitionend`, `transitioncancel` (the element's own animations and transitions only).
- **`dist/reactive-css.compact.min.js`**: optional bundle with a reduced registry (80,092 B vs 92,037 B minified; 27,463 vs 31,423 B gzip). The default bundle and its `describe()` are unchanged.

### Verified, unchanged
- State actions are sequential within a task: each reads the value the previous wrote (50 synchronous increments give 50).

### Examples
- The five examples show real DOM text instead of generated content where possible, and gained bound-safe rules (wizard: Next, Back and Finish cannot leave steps 1–4 under rapid clicks). The configurator's total moved out of `<output>`, whose form reset (in WebKit) replaces its children.

### Compatibility
- `stats()` has a new `syncs` counter.
- Each `text:` rule compiles to a registered, non-inherited `--rcss-text` property.

## 0.5.0 — API finalization, beta candidate (local, unpublished)

Reports: `docs/beta-prep-0.5.md`, `docs/beta-hardening-0.5.md`.

### Beta hardening
- **Fixed: the cascade winner initializes a state.** With several `state()` declarations for one name on one owner, the initializer of the declaration that wins the cascade (specificity, stylesheet order, layers, media, `!important`) now sets the initial value, including `attr()` and `pick()`. Before, an evaluated initializer came from whichever declaration attached first. Each declaration emits a small unregistered marker property in its rule; the browser's cascade picks the winner. No new registrations.
- **Fixed: `:nth-var()` (and other custom pseudo-classes) directly inside a functional selector** such as `:has(.opt:nth-var(--a))` was reported as an unsupported selector.
- `dist/features.json`: the `describe()` metadata as a file, for tools that do not run the library.
- Examples: `examples/product-configurator`, `multi-step-wizard`, `interactive-quiz`, `live-form-preview`, `score-history`, with READMEs and browser tests.
- Audits: `docs/event-support-0.5.md` (event matrix, `prevent()`/`stop()` proposal), `docs/feature-registry-review.md`, `docs/example-comparison.md`, `docs/example-capability-gaps.md`.

### Added (experimental)
- **Expressions in `state()` and `set()`:** `attr(name [, "fallback"])`, `pick(a, b, …)` and `pick(split(text, "delimiter"))`. In `state()` they are evaluated once per owner, when the state is created; in `set()` on every event, on the element with the `on:` declaration. `attr()` always gives a string and reads only that element (no ancestor lookup). `split()` is only allowed as the single argument of `pick()`, so state stays one scalar value. Outside these two positions `attr()` keeps its native meaning (`content: attr(data-label)` is untouched).
- `describe()` lists them as kind `expression` (and `expressions` in its result).

### Removed
- **`wave()`** (experimental since 0.4). It was a convenience over native `@property` + `@keyframes`, at a measured main-thread style cost of 171–181 ms/s per 1,000 animated elements, where a composited `@keyframes translate` costs nothing. `wave()` declarations are now left to the browser (which drops them as invalid). Migration: `@property --y { syntax: "<length>"; inherits: false; initial-value: 0px } @keyframes y { from { --y: -8px } to { --y: 8px } } .floating { translate: 0 var(--y); animation: y 1.5s ease-in-out infinite alternate }`, or animate `translate` directly. The registry keeps it with status `removed`.

### Changed
- **`state()` registers one generated property per state name** for the page, instead of one per declaration per compile. Recompiling or editing a stylesheet no longer registers new properties for names already seen. Removing one of two sheets that declare the same state on one element keeps the value for the other declaration.
- String values are serialized with every control character escaped (not only newlines), so any text is one CSS string.
- Feature registry: status `removed` and field `removedIn`; kind `expression`; `typed()` documents its differences from `@property`.
- Version metadata: 0.5.0.

### Fixed
- A `<style>` or `<link>` element that was **moved** (removed and re-inserted in one task) lost its reactive rules: the browser builds a new stylesheet from the original source, and it was not processed again.
- **Cascade-chosen initial values of boolean states** (`.a { --on: state(false) } .a.preset { --on: state(true) }`) were ignored: the computed `1` was read as a number.
- `npm test` and `npm run test:dist` run only the library's own test directories (a nested `site/` project's tests were picked up by the path filter).

### Compatibility
- Pages using `wave()` lose that motion (the declaration becomes invalid and is dropped): see the migration above.
- `set(--x, …)` now accepts `attr()` and `pick()`; other functions are still rejected with the same message, extended.

## 0.4.0 — CSS extensions & extensible architecture (local, unpublished)

### Added (experimental)
- **`element(width | height)`**: the element's own border-box size in px, through one shared `ResizeObserver` (no layout reads). It is context-aware: the standard `element(#id)` image function is left to the browser. Self-feedback loops are detected causally and frozen with a warning.
- **`wave(min, max, duration)`**: sine-shaped periodic motion for numbers, lengths, percentages, angles and times. It is a native Web Animations animation of a registered per-call-site property, with one shared keyframe list and no JavaScript per frame. The author's `animation`/`transition`/`transform` are left untouched, and `prefers-reduced-motion` gives the midpoint.

### Architecture
- Extension contract: `FunctionDef.matches()` for context-aware claiming. The contracts are documented in `docs/extensions-0.4.md`.
- Feature registry: `description`, `parameters` (with defaults), `evaluation`, `support`, `cleanup`, and `reason` for planned and rejected entries. Every 0.4 proposal is recorded with its decision.

### Decided against (see `docs/api-review-0.4.md`)
- `map()` → native `progress()`; `distance()` → `hypot()`; value `cycle()` → `@keyframes` + `steps()`; `smooth()` → `transition`.
- Deferred: cross-element `element()` (→ `anchor-size()`, container units), `spring()`, `throttle()`, `debounce()`, `history()`.

### Fixed (runtime audit, see `benchmarks/AUDIT-0.4.md`)
- **`:nth-var()` subscription leak.** When a state owner was removed and reinserted (a list re-sorted, a component moved through a fragment), a stale `:nth-var()` group got a new state subscription that was never released: one per reinsertion, plus redundant work on every state change, for as long as the owner lived.
- **Listener leak on `<link>` elements.** Every `href` change while the link was disabled added two event listeners and kept the fetched stylesheet text alive; after enabling, the `error` listeners stayed. Now at most one pending wait per link.
- **`element()` and `:just-checked` per-element tables** are cleared on removal. They relied on garbage collection, and the V8 tables kept their peak size (+384 KB after 500 mount/unmount cycles of 1,000 components).
- **Identical `wave()` calls are shared.** Rules with the same `wave()` arguments share one registered property, one keyframe list and one animation per element. Two such rules on 1,000 elements: style time 177 → 135 ms/s, start 20 → 12 ms. Recompiling a stylesheet no longer registers new properties for them.

### Tooling (development only)
- `stats().internal` in the development builds: queue lengths and the sizes of internal element-keyed collections, for leak tests. Removed from the production bundle.
- Benchmarks measure the production bundle by default, with a seeded `Math.random`, a warm-up, repeated runs and medians with ranges.
- `benchmarks/audit/`: leak detector (heap snapshots, retainer paths), long-running test, startup/idle/latency/scheduler measurements.

### Unchanged
- No stable syntax changed; nothing is deprecated. All 0.3.1 behavior and tests pass, including CSP and cascade tests.

### Playground
- Demos S (element geometry: state-driven width, readout, keyboard buttons) and T (wave motion: reduced motion respected).

## 0.3.1 — Stability & Compatibility (unreleased, local release candidate)

A maintenance release: browser compatibility, secure stylesheet handling, cascade correctness, `:changed()` reliability, and production verification. **No new public API features.** No public syntax was changed.

### Fixed
- **Strict Content-Security-Policy no longer breaks pages (high severity).** 0.3.0 inserted a generated inline `<style>` and disabled the original stylesheet. Under `style-src 'self'` the copy was blocked, and the page silently lost every rule of that stylesheet. Stylesheets are now rewritten in place through the CSSOM, which CSP does not govern. No `<style>` element is ever injected, and no nonce or `'unsafe-inline'` is needed.
- The in-place rewrite also fixes several cascade cases:
  - A processed sheet keeps its `media`, its `disabled` state (including toggling at runtime), its alternate-set `title`, its URL base and its single entry in `document.styleSheets`.
  - A `<link disabled>` enabled later is processed when the browser loads it.
  - Alternate stylesheets are processed instead of skipped.
- **`bind:` refuses password, one-time-code and payment fields.** Otherwise, injected CSS could read their live values through `bind:` and conditional URLs.
- **The native `random()` probe no longer uses `style=""` attributes**, so it causes no CSP violation under `style-src-attr` and no false negative.
- **`on:` fast path:** a single unconditional `on:` rule is checked against its sheet's `disabled` state and `media` before running.
- **Diagnostics name the stylesheet** (`/css/app.css: random(): …`, `<style id="theme">: …`, `inline <style> #2: …`), together with the construct and a fix. The "untrusted stylesheet" message now says why.

### Added (configuration, not API)
- Optional `window.ReactiveCSSConfig.trustInlineStyles = false`: `on:`/`bind:` only from same-origin `<link>` stylesheets, for sites that render user-provided `<style>`. The default is unchanged.

### Changed
- `:changed()` looks for the animations it started *after* the frame has rendered, instead of forcing a style update at the start of the next frame. Semantics are unchanged (tested: delays, several animations, zero duration, restart, cancellation, removal). The cost in large pages is dominated by Chromium's `getAnimations()` (≈ running animations × page size) and is documented.
- `npm run test:browser` and `npm run verify` run Chromium and WebKit. `npm run test:firefox` is separate.
- Playground accessibility:
  - the toggle switch is a native `<input type="checkbox" role="switch">` with `bind:`;
  - a native radio-group variant of the tabs demo was added;
  - icon-only buttons have accessible names, and clickable `div` tiles are buttons;
  - each demo notes what it does not provide (ARIA state, focus management).

### Verification added
- CSP tests with real headers (5 policies), security regression tests, cascade tests (layers across sheets, nested layers, `@media`/`@supports`/`@container`, nesting, `:is`/`:where`/`:has`, pseudo-elements, `@import`, shadow DOM, running animations), a heap-snapshot lifecycle test (0 retained detached elements; the test detects a deliberate leak), `:changed()` lifecycle tests, and distribution tests: the minified bundle alone on a plain HTML page, a Node ESM import and a TypeScript consumer of the `.d.ts` files.

### Known limitations
- Firefox is unverified: Playwright's Firefox does not start on the development machine.
- See README → Limitations.

## 0.3.0
`previous()`, `direction()`, `:changed()`, `bind:`, `key()`, `outside()`, `cycle()`, `closest()` scopes, native `if()` for boolean `when()`, experimental `typed()`, and the machine-readable feature registry (`describe()`). Fixed: state leaking between nested owners of the same rule in CSS.

## 0.2.0
State engine: `state()`, `on:`, `set()`, `toggle()`, `increment()`, `decrement()`, `when()`, `:when()`, state-driven `:nth-var()`.

## 0.1.x
Reactive values (`random()`, `pick()`, `live()`, `on()`, `mouse()`, `viewport()`, `visible()`), `:just-checked`, `:just-unchecked`, `:nth-var()`. Performance pass: shared sources, compact bindings, frame budget, native `random()`.
