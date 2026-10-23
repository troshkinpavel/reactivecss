<!-- The full library reference, formerly the repository README (moved for the 0.9.0 public release; the short README is at ../README.md). -->
# Reactive CSS

**Declarative behavior for native CSS. CSS that reacts.** Less JavaScript for simple interactions: add one script tag and write CSS like this:

```css
.counter { --count: state(0); }
.counter .add:on(click) { --count: increment(1); }       /* selectors say when, declarations say what */
.counter .value { content: var(--count); }               /* the element's DOM text */
.counter:changed(--count) .value { animation: flash 300ms; }

.menu { --open: state(false); }
.menu > button { --attr-aria-expanded: var(--open); }    /* the reserved --attr-* namespace */
.menu > button:on(click) { --open: toggle(); }
.menu:on(outside(click)) { --open: set(false); }
.menu:on(keydown(Escape)) { --open: set(false); }          /* one trigger per rule */
.menu:when(--open) > ul { display: block; }

.theme { --dark: state(false, persist("theme")); }        /* kept across reloads */
input[name=q] { --q: state("", bind(value)); }            /* two-way with the control */
.dialog input { focus: when(--open); }                    /* focus request on open */
input:blur:invalid { animation: shake 250ms; }            /* after a real focus loss */

.card { --x: state(0px); --y: state(0px); translate: var(--x) var(--y); touch-action: none; }
.card:on(drag) { --x: set(event(x)); --y: set(event(y)); }  /* continues from where it was */
.pad:on(pointerdown) { --hit: set(event(local-x)); }        /* a snapshot, read once */
.stepper .double:on(click) { --n: set(clamp(0, var(--n) * 2, 100)); }

.tabs { --active: state(1); }
.tab:on(click) { --active: set(sibling-index()); }
.panel:nth-var(--active) { display: block; }

.particle { translate: live(random(0px, 500px), 2s) 0; transition: translate 1s ease; }
```

> 0.9.0 introduced this syntax (`:on()` with `prevent()` / `stop()`, mutations on the state's own property, `event()`, drag, `persist()`, `bind()` in `state()`, `--attr-*`, `content`, `:blur`); focus requests use the 0.6 `focus:` declaration. The 0.8 declarations (`on:`, `text:`, `attr:`, `bind:`) keep working. See [docs/migration-0.9.md](migration-0.9.md) and the design in [docs/rfc-v0.9.0-language.md](rfc-v0.9.0-language.md). The reference tables below still describe the 0.8 forms.

For many common interactions you do not need to write JavaScript. The library reads your stylesheets, compiles the reactive parts to standard CSS plus custom properties (or to native CSS such as `if()` where that is equivalent), and updates only the elements that use them. The browser still does all styling, transitions and animations.

**What it is not.**
- Not a framework, not a JavaScript replacement, and not a programming language inside CSS.
- It adds a small set of composable primitives: state, a handful of actions, conditions and bindings. They cover tabs, accordions, toggles, counters, live previews, dropdowns and simple settings forms. Many interactions still need JavaScript: data, routing, complex focus management, real accessibility semantics.
- It never duplicates native CSS. Math, colors, `:has()`, `@container`, `if()` and so on stay native ([feature policy](#feature-selection-policy)).

> **Status: 0.9.0 (local, unpublished; release candidate of the 0.9 language).** 0.9.0 features are experimental and tested automatically in Chromium and WebKit (no automated Firefox run: Playwright's Firefox does not launch on this machine). The features in the tables below are implemented and tested automatically in Chromium and WebKit. The 0.7.1 examples also passed user-reported manual testing in Chrome, Safari and Firefox; Firefox has no automated run. Experimental: `typed()`, `element()`, the 0.5 expressions `attr()`, `pick()` and `split()` in `state()` and `set()`, the 0.5.1 `text:` declaration and event triggers, 0.5.2 attribute binding (`state(…, bind(attribute))`), 0.5.3 derived attributes (`attr:`), 0.6.0 declarative focus (`focus:`) and the 0.7.0 `prevent()` action. 0.8.0 adds [custom bundles](#custom-bundles-080). `wave()` was removed in 0.5 (see [CHANGELOG](../CHANGELOG.md)). The features under [Proposed](#proposed-not-implemented) are not implemented. Changes: [CHANGELOG.md](../CHANGELOG.md).

## Install

```html
<link rel="stylesheet" href="style.css">
<script src="reactive-css.min.js" defer></script>
```

That is all: no setup code, no attributes, no build step. `dist/reactive-css.js` is the same file, not minified, with a warning in the console for each problem. `reactive-css.min.js` logs one summary line instead. `reactive-css.compact.min.js` (0.5.1, optional) is the same runtime with a smaller feature registry: `describe()` lists names, kinds, status and syntax only; the full metadata is in `dist/features.json`.

For programmatic use (ESM):

```js
import { start, refresh, stop, defineFunction } from './dist/index.js';
start();
```

### Custom bundles (0.8.0)

Build a bundle with only the features your stylesheets use:

```bash
reactive-css analyze public/ --build public/reactive-css.min.js
```

```bash
reactive-css build --features events,conditions,focus --out public/reactive-css.min.js
```

- **Features:** `core` (always), `events`, `gestures` (0.9), `persist` (0.9), `conditions`, `nth-var`, `history`, `forms`, `text`, `attributes`, `focus`, `blur` (0.9), `values`, `dynamic`, `geometry`.
- **Requirements** are added automatically (`focus` and `gestures` need `events`).
- **Sizes (0.9.0):** about 76 KB minified for `basic` (state, `:on()` and `on:`), against 148 KB (49.9 KB gzip) for the full bundle (0.8.1: 52 KB and 115 KB). Production bundles report diagnostics as codes; decode them with `npx reactive-css explain`. Details: [docs/release-0.9.0-hardening.md](release-0.9.0-hardening.md).
- **Missing features:** a feature left out is reported in `ReactiveCSS.diagnostics` with the feature it needs, never silently ignored.
- **Fallback:** the analyzer recommends the full runtime when it cannot see every stylesheet.

Full reference: [docs/bundle-builder-0.8.md](bundle-builder-0.8.md).

The package is prepared as `@reactivecss/core` (not published yet).

## Browser support

The build targets Chrome/Edge 111+, Firefox 128+ and Safari 16.4+ (`on:` needs `CSS.registerProperty`).

| Engine | Status (0.5.0, tested locally) |
|---|---|
| Chromium 156 (Playwright 1.64.1, headless shell) | All browser tests pass |
| WebKit 27.2 (Playwright 1.64.1) | All browser tests pass (the heap-snapshot test is Chromium-only). This is the WebKit engine, not a Safari release. |
| Firefox | **Manual only.** All 20 examples passed user-reported manual testing (0.7.1, `docs/browser-validation-0.7.1.md`). No automated run: Playwright's Firefox 1555 does not start on the development machine (macOS 27: "Could not find profile folder", also when started directly). Run `npm run test:firefox` on a machine where it starts. |

The full matrix, with what was verified, is in [docs/compatibility.md](compatibility.md).

## Functions

| Syntax | Parameters | Returns | Updates when | Native fallback | Runtime needs |
|---|---|---|---|---|---|
| `random(min, max)`<br>`random(min, max, by step)`<br>`random(element-shared, min, max)` | Numbers, dimensions or percentages. Same unit (a unitless `0` adopts the other unit). Mixed units, `var()` or `calc()` are allowed without `by`. | A value of the input type. With mixed units: `calc(min + (max - min) * r)`. | Never (static), unless it is inside `live()` or `on()` | **Native `random()`** for a top-level `random(min, max)` with literal same-unit bounds, when the browser's `random()` gives per-element values (checked once at start). Otherwise JS. | none when native |
| `pick(a, b, ...)` | One or more comma-free values. Values can contain reactive calls. | One of the values | Never, unless it is inside `live()` or `on()` | none | none |
| `live(expr, interval)` | Any expression. Interval: `ms` or `s`. Default `1s`, minimum `50ms` (smaller values are raised, with a warning). | The value of `expr` | Every interval. `random()` and `pick()` inside it re-roll. | none | Shared scheduler, one timer per distinct interval |
| `on(event, expr)` | An event from the allowlist: `click dblclick contextmenu pointerenter pointerleave pointerdown pointerup mouseenter mouseleave focus blur focusin focusout input change keydown keyup animationend animationiteration transitionend toggle` | The value of `expr` | Evaluated once when the element is bound, then again on each event on that element | none | One listener per bound element (the instance object itself, no closure) |
| `mouse(x)` `mouse(y)`<br>`mouse(x, local)` | Axis `x`/`y`. Mode `viewport` (default) or `local`. | Length in `px`. `viewport` = `clientX`/`clientY`. `local` = distance from the top-left corner of the border box of the element that has the declaration. `0px` before the first pointer move. | Pointer moves, at most once per frame, only for the axis that changed. `local` does not update on scroll alone. | none | One shared `pointermove` listener. `viewport` mode is a [shared source](#shared-sources): one computation and one write per declaration, not per element. |
| `visible()`<br>`visible(threshold)` | Threshold 0–1, default 0. | `1` when at least `threshold` of the element intersects the viewport, else `0`. `0` until the first observation. | Intersection changes | none | One shared `IntersectionObserver` per threshold |
| `viewport(width)` `viewport(height)` | — | `100dvw` / `100dvh` (same as `innerWidth` / `innerHeight`, scrollbars included) | Natively, by the browser | **Compiles to plain CSS. No runtime.** | none |
| `state(value)` | Only as the whole value of a custom property: `--open: state(false)`. Value: `true`/`false`, a number, a dimension, a string or a keyword/color, or an [expression](#expressions-in-state-and-set) (`attr()`, `pick()`). | The current state, always one value; booleans as `1`/`0` | By actions (`on:`) | A literal initial value works without JS, as the `var()` fallback | One state cell per owner element; one registered property per state name |
| `when(condition, a, b)` | A [condition](#conditions), then the values for true and false (`b` optional; both optional since 0.5.3) | `a` or `b`; `true`/`false` without branches. Nothing (`unset`) when the condition is unknown | When a state it reads changes | **Native `if()`** for conditions made of boolean states with `and`/`or`/`not` and static values, where supported (Chromium and WebKit tested) | Otherwise subscribes only to its own cells |
| `previous(--x)` | A state name | The value before the last effective change (the initial value until then) | When the state changes | none | Shares the state's history (no extra storage) |
| `direction(--x)` | A number or dimension state | `1`, `0` or `-1` (last change up, none, down). Unknown for other types. | When the state changes | none | Same |
| `element(width)` `element(height)` *(experimental)* | Axis keyword. Only these two forms are Reactive CSS: `element(#id)` stays the native image function. | The element's own **border-box** size in px. No value until first measured, so `var(--w, fallback)` uses the fallback: the browser measures before the element's first paint, and the value is written in the next frame, so one frame renders with the fallback. `display: none` is `0px`. | On resize, through one shared `ResizeObserver` | none for an element's own size (container units and `anchor-size()` cover containers and anchors) | Self-feedback (`width: calc(element(width) + 10px)`) is detected and frozen with a warning |
| `typed(value, "<syntax>"?)` *(experimental)* | Only as the whole value of a custom property: `--angle: typed(0deg)`. The syntax is inferred for numbers, lengths, percentages, angles, times, resolutions and colors. | The value | — | It *is* a native registration: `CSS.registerProperty({ syntax, inherits: true, initialValue })`. Prefer a native `@property` rule when you can write one (differences under [Limitations](#limitations)). | Never overrides a native `@property` |

You can nest functions: `live(pick(red, blue), 1s)`, `random(0px, viewport(width))`, `calc(0.2 + visible() * 0.8)`, `rgb(random(0, 255) 0 0)`.

### Expressions in `state()` and `set()`

*(experimental, 0.5)* The initial value of `state()` and the value of `set()` can be an expression. **Only these two positions are evaluated by Reactive CSS.** Everywhere else, `attr()` is the browser's own function and is never touched: `content: attr(data-label)`, `--x: attr(data-x)` and typed `attr(data-w type(<length>), 10px)` keep their native meaning.

| Expression | Value | Evaluated |
|---|---|---|
| `attr(name)`, `attr(name, "fallback")` | The attribute as a **string** (an empty attribute is `""`). Missing: the fallback, else `""`. | In `state()`: once, on the **state owner**, when the state is created. Changing the attribute later does not reset the state. In `set()`: at event time, on the **element with the `on:` declaration**. |
| `pick(a, b, …)` | One of the values at random (all of one type) | Once per owner in `state()`; on every event in `set()` |
| `pick(split(text, "delimiter"))` | One entry of `text` (a quoted string or `attr()`) split at every occurrence of the delimiter. Entries are trimmed; empty entries are dropped. | Same as `pick()` |

```html
<div class="greeting" data-message="Hello!">
  <output></output>
  <button class="choice" data-message="Bonjour!">French</button>
  <button class="shuffle" data-greetings="Hej!|Salut!|Hola!|Ciao!">Surprise me</button>
</div>
```

```css
.greeting { --message: state(attr(data-message, "Hello!")); }
.greeting output::after { content: var(--message); }
.choice  { on: click(set(--message, attr(data-message))); }
.shuffle { on: click(set(--message, pick(split(attr(data-greetings), "|")))); }
```

Rules:
- **State stays scalar.** `split()` makes a temporary list that only `pick()` consumes; it is an error anywhere else (`state(split(…))` is reported and left unchanged). There are no list or object states, and no `slice()`.
- **No ancestor lookup.** `attr()` reads exactly the element named above. To use a parent's attribute, put the state on the parent (`state(attr(…))`), or the attribute on the element with `on:`.
- **No value:** `pick()` with nothing to pick (an empty string, a missing attribute without fallback, only empty entries) has no value. `set()` then changes nothing; `state()` starts as `""`.
- **Invalid input** is a compile error with a message, and the declaration is left unchanged: an empty or unquoted delimiter, `split()` of a number, `split()` next to other `pick()` values, values of different types in one `pick()`, nested `pick()`, `attr()` with anything but a name and a quoted fallback. The delimiter has no escape: choose one that does not occur in the values.
- **Types.** `attr()` is always a string, so it initializes or sets string states (`state("")`); setting a number state from `attr()` is ignored with a warning. Typed `attr(name type(…))` is not supported here.
- **Safety.** Attribute values are data. They become one escaped CSS string (quotes, backslashes and every control character escaped), never CSS syntax, never an action. `attr()` in `state()` is refused in untrusted stylesheets (like `on:` and `bind:`), and it never reads password, one-time-code or payment fields (it returns the fallback).

## Selectors

| Selector | Matches | Generated CSS | Specificity |
|---|---|---|---|
| `:just-checked` | A checkbox or radio after an observed unchecked → checked transition, until its next observed transition. Never matches on page load. | `[data-rcss-just-checked]` | Same as one pseudo-class |
| `:just-unchecked` | A checkbox or radio after an observed checked → unchecked transition (this includes a radio that loses its state when another radio in its group is selected), until its next observed transition. | `[data-rcss-just-unchecked]` | Same as one pseudo-class |
| `:nth-var(--name)` | The element whose one-based index among its element siblings (as in `:nth-child`) equals the integer value of `--name`, read on the parent of the siblings. When `--name` is a `state()`, the cell is read directly and change notifications drive it. | `[data-rcss-nth-N]` | Same as `:nth-child()` |
| `:when(condition)` | Elements for which the [condition](#conditions) is true, with states resolved from that element. | `[data-rcss-when-N]` | Same as one pseudo-class |
| `:changed(--x)` | Briefly after an observed change of the nearest state `--x`: from the frame after the change until the CSS animations and transitions it started (in the element's subtree) have finished, or one frame if none started. "It started": animations named, and transitions of properties set, in the `:changed()` rules; other animations that start in the same frame do not hold it. If those rules set custom properties, every animation that started in the subtree counts. Never on load or after a no-op. A new change restarts it. | `[data-rcss-changed-N]` | Same as one pseudo-class |

**Transition lifecycle.** The marker attribute stays until the next observed transition of the same control. There are no timers, so an animation that is cancelled or interrupted cannot leave a stuck state. On each transition the markers swap, so the animation starts again. The `checked` property and the form semantics do not change. Keyboard (Space), label clicks and mouse clicks all fire `change`, so all of them work.

*Why persistent and not transient.* A transient state (match only while an animation runs) needs to know which animations the state started. With several animations, zero-duration animations, interrupted or cancelled animations, `fill-mode: forwards` (removing the marker would undo the end state) and rapid toggles, that becomes a set of timing races. The persistent state has none of these problems. The cost: declarations that are not animations, for example `input:just-checked + .icon { scale: 1.2 }`, stay applied until the next transition, so write those with `:checked`. This is the documented behavior and was not changed; tests cover rapid toggling, restarts and the initial state.

**What `:just-checked` can see:** every `change` event (all user interaction), radio-group siblings, and `form.reset()`. A script that sets `input.checked = true` directly fires no event, and there is no DOM notification for that property. After such a change, dispatch `new Event('change', { bubbles: true })` or call `ReactiveCSS.refresh()`. The library does not poll.

**What `:nth-var()` can see:** a sibling group is evaluated again when its children are added, removed or reordered, when an attribute (`style`, `class`, `data-*`...) changes on the parent or on an ancestor, or when `ReactiveCSS.refresh()` is called. This includes `el.style.setProperty('--active', 4)`, class toggles and values that Reactive CSS functions write (for example `--active: live(pick(1, 2, 3), 2s)`). **It does not see** changes that come only from media queries, container queries, animations or stylesheet edits. Call `ReactiveCSS.refresh()` after those. When only the value changed, just the old and the new active element are touched. After a structural change (children added, removed or reordered), the whole group is checked once. Ancestor changes find their groups through an index, not by scanning all groups. The value must compute to an integer literal. For `calc()`, register the property with `@property --active { syntax: "<integer>"; inherits: true; initial-value: 1; }`.

## State, actions and conditions

The full semantics (types, cascade, lifetime, resolution, trust model) are in [docs/state-engine.md](state-engine.md). The short version:

```css
.counter        { --count: state(0); }          /* every .counter owns its own --count */
.counter .inc   { on: click(increment(--count)); }
.counter .reset { on: click(set(--count, 0)); }
.counter output { counter-reset: n var(--count); }
.counter output::before { content: counter(n); } /* content: var() cannot print numbers */
.counter:when(--count >= 10) output { color: green; }
```

**State.** `--x: state(value)` makes each matching element the owner of an independent state. Consumers use the **nearest owner**: the element itself, then its ancestors. An inner component shadows an outer one with the same name. `var(--x)` always works, and booleans read as `1`/`0`. A state is created when its element starts to match a `state()` rule and is disposed when it stops matching or is removed. Re-inserting the element starts over at the initial value. CSS recalculation never resets a state.

**Actions.** `on:` is a declaration like any other: specificity, source order, `@media` and `:hover` decide which one applies to an element. Several events and actions go into one declaration: `on: click(increment(--n), toggle(--open)), pointerenter(set(--hot, true))`.

| Trigger | Runs on |
|---|---|
| `click`, `change`, `input` | the target and its ancestors (bubbling, innermost first) |
| `focusin`, `focusout`, `reset` *(0.5.1, experimental)* | the target and its ancestors (they bubble natively) |
| `pointerenter`, `pointerleave`, `focus`, `blur` | the target only |
| `animationend`, `animationcancel`, `transitionend`, `transitioncancel` *(0.5.1, experimental)* | the target only: the element's **own** animations and transitions, not its children's. No name filter: any animation of the element; `transitionend` fires once per transitioning property. Cancel events fire only for animations that had started (native behavior). |
| `key(Key, …)` | `keydown` while focus is on or inside the element (when nothing is focused: the element last pressed with the pointer). `Escape`, `ArrowRight`, `ctrl+k`, `shift+Tab`… Modifiers must match exactly. Character keys never fire while typing in a field. |
| `outside(click \| pointerdown \| focusin, …)` | elements the event happened *outside* of (shadow DOM aware). For popups, the native `popover` attribute already does light dismiss: prefer it. |

| Action | Does |
|---|---|
| `set(--x, value)` | Sets the nearest `--x` to a literal of a compatible type, to an [expression](#expressions-in-state-and-set) (`attr()`, `pick()`), to `sibling-index()` (the position of the element with the `on:` declaration among its siblings) or to `sibling-count()` |
| `toggle(--x)` | Flips a boolean state |
| `increment(--x, step)`, `decrement(--x, step)` | Adds or subtracts (default 1, in the state's unit) |
| `cycle(--x, a, b, c)` | Next value in the list, wrapping around (the first one if the current value is not listed) |
| `prevent()` *(experimental, 0.7.0)* | Cancels the event's native default action (see below). Only in `click(…)` and `key(…)` |

**Order and timing.** Actions run synchronously, in order, while the event is dispatched; each one reads the value the previous one wrote (50 synchronous increments give 50). Since 0.5.1, before an event is dispatched, the logical consequences of earlier actions in the same frame (state values, `:when()` and `:nth-var()` markers) are applied, so conditional `on:` rules always see the current state, even for several clicks before the next frame. Visual updates still happen in the next frame. Events not on the list above (`submit`, `animationstart`, `keyup`…) are compile errors. Actions never stop propagation.

<a id="prevent"></a>**Cancelling a default action: `prevent()`** *(experimental, 0.7.0)*. It calls the native `event.preventDefault()` synchronously, while the event is dispatched:

```css
.tabs [role=tablist] { on: key(ArrowRight, prevent(), cycle(--active, 1, 2, 3)); }  /* no page scroll */
a.confirm            { on: click(prevent(), set(--asking, true)); }               /* no navigation */
```

- **Where:** `click(…)` (link navigation, checkbox and radio toggling, submit-button submission, `<summary>` toggling) and `key(…)` (scrolling, caret movement, shortcuts). Anywhere else it is a compile error: `change`, `input`, focus and pointer events, animation and transition events are not cancelable; `reset` is not supported because `bind:` restores states after a reset; `outside()` would cancel clicks on unrelated elements.
- **Only when it runs:** only when its `on:` declaration is the one the cascade chose, with current conditions. A `:when()` rule that adds `prevent()` cancels only while its condition holds, even for several events in one task.
- **Only inside the element:** the event's target must be the element with the declaration or inside it. A `key()` that falls back to the last-pressed element because nothing is focused cancels nothing.
- **Native controls keep their keys:** for `key()`, a target that is a form control or editable element (`input`, `textarea`, `select`, `contenteditable`) is never cancelled unless it carries the rule itself. Arrow keys keep moving the caret, radio selections and sliders; the other actions still run.
- **Checked, never assumed:**
  - a non-cancelable event (for example a script-created `new KeyboardEvent()` without `cancelable: true`) is reported and not cancelled;
  - `defaultPrevented` is read back.
- **No propagation change:** no `stopPropagation()`. Page listeners and nested `on:` handlers still receive the event; any of them may cancel.
- **Clicks inside a cancelling element:** a rule on a container also cancels clicks on links and buttons inside it. This is reported in development builds.
- **Listeners:** the document listener for an event type is non-passive only while a live rule uses `prevent()` for that type. Otherwise it stays passive.
- **Not available:** `stop()` (native propagation control cannot work from a delegated document listener) and a `submit` trigger. Details: [docs/rfc-prevent-action-0.7.md](rfc-prevent-action-0.7.md).

Every action takes an optional last argument `closest(selector)`. The state must then be owned by exactly that ancestor of the element: `set(--active, sibling-index(), closest(.tabs))`. Without it, the nearest owner is used.

**Binding form controls.** `bind: --x` connects a native control two-way with the nearest state `--x` (or `bind: --x closest(.form)`).

| Control | State | Notes |
|---|---|---|
| text, search, email, url, tel, password, `<textarea>` | string: `state("")` | Updated on `input`; during IME composition only at the end. Typing never rewrites the field (caret and selection stay). Programmatic changes keep focus and clamp the selection. |
| number, range | number or dimension | An empty or invalid field leaves the state unchanged |
| checkbox | boolean | |
| radio group | string, keyword or number | The radio whose `value` equals the state is checked |
| single `<select>` | string, keyword or number | |

Initialization is state-first, with one exception: a control whose current value already differs from its HTML default (autofill, restored form state) wins and sets the state. Form reset restores the state's CSS initial value. `bind:` must be in an unconditional rule. Multiple selects, file, date and color inputs are not supported yet. Booleans read as `1`/`0`, strings as quoted CSS strings, so `content: var(--name)` prints them.

<a id="attribute-binding"></a>**Attribute binding** *(experimental, 0.5.2)*. `state(initial, bind(attribute))` mirrors a state to one HTML attribute **of the state's owner**:

```css
.menu { --open: state(false, bind(aria-expanded)); on: click(toggle(--open)); }
.menu[aria-expanded="true"] + .list { display: block; }
```

| Attribute | State | Attribute values |
|---|---|---|
| `aria-expanded`, `aria-pressed`, `aria-selected` | boolean | `"true"` / `"false"` (false stays explicit) |
| `aria-current` | boolean, or a token (`page`, `step`, `location`, `date`, `time`) | `"true"`/`"false"` or the token |
| `disabled`, `hidden`, `required` | boolean | present when true, **removed** when false (never `disabled="false"`, which still disables); an existing value such as `hidden="until-found"` is kept while true |
| `data-*` | string, number, dimension, boolean or keyword | the value as text (`data-status="loading"`, `data-count="3"`, `"true"`/`"false"`) |

- **Initialization (once):**
  - A valid attribute value on the owner initializes the state: `aria-expanded="true"` gives `true`, and for boolean attributes presence gives `true`.
  - A missing attribute leaves the `state()` initial value.
  - An invalid value (`aria-expanded="maybe"`, `data-count="12px"` for a number, a keyword that is not an identifier) is reported and ignored.
  - In every case, the effective value is written back right away.
- **Updates:** every state change writes the attribute **synchronously**, during the action, only when its text changes. A `disabled` set by one click is in place before the next event, so the browser itself stops a second click.
- **One direction after start:** later changes by other scripts are not read back as state changes; the next state change overwrites them (reported once).
- **Cascade:** the `state()` declaration that wins the cascade chooses the attribute. A later winner can switch it only before the state has changed: the old attribute is then restored.
- **Cleanup:** when the state goes away (the owner is removed, the rule stops matching, the sheet is removed or recompiled), the attribute is restored to its original value or absence, but only if it still holds what Reactive CSS wrote. So a removed and reinserted owner starts again from its original markup.
- **Safety:**
  - Only the attributes above, on the owner itself.
  - No event handlers, URLs, `style`, `class`, `role` or free-text ARIA.
  - Values are set with `setAttribute()`, never parsed.
  - Trusted stylesheets only.
  - Changes of a bound attribute never re-match reactive rules (no feedback loops); use `:when(--state)` in selectors that must follow the state.
- **Not** the same as `bind:` (a form control's value) or `attr()` (read once, never written).

<a id="derived-attributes"></a>**Derived attributes** *(experimental, 0.5.3)*. `attr: <attribute> <value>` writes one allowlisted attribute **of the matched element**. The value is usually derived from state owned by an ancestor:

```css
.stepper { --qty: state(1); }
.stepper .plus  { on: click(increment(--qty)); attr: disabled when(--qty >= 10); }
.stepper .minus { on: click(decrement(--qty)); attr: disabled when(--qty <= 1); }
.menu > button  { attr: aria-expanded var(--open); }
.steps > li:nth-var(--step) { attr: aria-current "step"; }
.card { attr: data-state var(--status); }
```

- **Attributes and values:** the same allowlist and semantics as `state(…, bind())`:
  - `disabled`, `hidden`, `required`: present for `true`, removed for `false`. A boolean state is `1`/`0` in CSS, and both forms are accepted. `"false"` is never truthy, and `disabled="false"` is never written. `hidden="until-found"` is kept while true.
  - `aria-expanded`, `aria-pressed`, `aria-selected`, `aria-disabled` *(0.6.0)*: `"true"`/`"false"`.
  - `tabindex` *(0.6.0)*: only `0` or `-1`, for a roving `tabindex` (positive values, which reorder the Tab order, are refused). It is never added automatically.
  - `aria-current`: a token (`page`, `step`, `location`, `date`, `time`, `true`, `false`).
  - `data-*`: the value as text (strings unquoted, numbers as written; an empty string gives an empty attribute).
  
  Anything else is a compile error (event handlers, URLs, `style`, `class`, `id`, `role`, free-text ARIA). A value of the wrong kind is reported and leaves the attribute unchanged.
- **Values:** one string, number or keyword: a literal, `var(--x)`, `previous(--x)`, `direction(--x)` or `when(…)`. `when(condition)` without branches gives `true`/`false`. Values are written with `setAttribute()`/`toggleAttribute()`, never parsed.
- **Cascade, one attribute at a time:** each `attr: name …` compiles to its own registered, non-inherited property (`--rcss-attr-name`). So attr: declarations for *different* attributes combine, in one rule or several. For the *same* attribute, the cascade decides: specificity, source order, `@layer`, `@media`, `!important`, `:when()`. When no declaration applies (no rule matches, or the winning `when()` has no value), the attribute **as it was before the first write** is restored.
- **Timing:** after an action or a bound control changes a state, the derived attributes are written **in the same task**, before the event finishes. A `disabled` set by one click is in place before the next click, so the browser stops it: tested with 12 synchronous clicks, rapid real clicks and repeated Enter. This costs one style recalculation per such event; see [Performance](#performance). Other changes (an element starting to match, `refresh()`) are written in the frame.
- **Ownership:**
  - If anything else changes the attribute after a write, the binding yields: no more writes, no restore (diagnostic).
  - A `state(…, bind(attribute))` on the same element always owns that attribute; an `attr:` for it is ignored with a diagnostic.
  - Attribute changes made by `attr:` never re-match reactive rules (no feedback loops). An attribute selector that reads a written attribute is re-read at most once more in the same task, and again in the frame.
- **HTML applicability, checked when the attribute would be set:**
  - `disabled` only on `button`, `input`, `select`, `textarea`, `option`, `optgroup`, `fieldset` and form-associated custom elements. A custom element that is not defined yet is written once it is.
  - `required` only on `select`, `textarea` and `input` types that support it (not `hidden`, `range`, `color` or the button types).
  - `hidden` on HTML elements only.
  - Anything else is skipped with one warning per element type, and never written: nothing pretends to be disabled. ARIA values are validated; ARIA patterns are not. `aria-pressed` outside a button and `aria-selected` without a supporting role get a warning but are written.
- **Not accessibility by itself:** `attr:` writes attributes. Labels, roles, focus order, keyboard behavior and announcements are still the page's job (see [Accessibility](#accessibility)).
- **Safety:** trusted stylesheets only (like `on:`, `bind:`, `text:`).
- **`aria-disabled` is not `disabled`** *(0.6.0)*. `aria-disabled="true"` keeps the control focusable and in the Tab order and announces it as unavailable, but it does **not** block clicks, keys or submission, and Reactive CSS does not change event dispatch because of it. Make the action inactive yourself with a more specific `on:` rule (conditions are current for every event):
  ```css
  .plus { on: click(increment(--qty)); attr: aria-disabled when(--qty >= 10); }
  .form:when(--qty >= 10) .plus { on: click(set(--qty, 10)); }   /* inactive at the bound */
  ```

<a id="focus"></a>**Focus** *(experimental, 0.6.0)*. `focus: <value>` moves focus to the matched element when its value **goes from false to true because of a user action**. The selector is the target; there is no selector string to evaluate.

```css
.wizard { --step: state(1); }
.wizard .panel > h2 { focus: false; }
.wizard .panel:nth-var(--step) > h2 { focus: true; }   /* <h2 tabindex="-1"> in the HTML */
```

- **Values:** `true`/`false`, `1`/`0`, `var(--boolean)` or `when(…)`. No value counts as false; anything else is a diagnostic.
- **Transition only:**
  - focus is requested when a read goes false → true;
  - the first read (page load, insertion, a new rule, recompilation) never focuses;
  - a value that stays true never refocuses.
- **User actions only:** the state change must happen during a trusted `click`, `keydown` (including `key()`), `input` or `change`. Scripts (`el.click()`), timers, native form reset, `focus`/`blur`/`focusin`/`focusout`, pointer enter/leave, animation events and `outside()` dismissals never move focus. So focus → `focusin` → state → focus cannot loop.
- **When:** after the state's CSS and its `attr:`/`text:` writes. In the same task when the page has affected `attr:` bindings, otherwise in the next frame (about one frame). One exception: when the action ran on the `keydown` of Enter or a printable key (and nothing called `prevent()`), focus moves in the next frame, after the key press has finished. Moving it during the keydown would send the rest of the press to the new element: Enter in a field would also click the button that received focus, and a shortcut letter would be typed into the field it focused. There are no timeouts and no polling.
- **Which element:** if several targets become true together, the first eligible one in document order. A target that is not rendered, disabled, `inert` or not focusable is skipped (diagnostic). The library never adds `tabindex`: give headings `tabindex="-1"`.
- **Never overrides:**
  - focus the user moved before the request resolved;
  - focus already on or inside the target;
  - focus inside an open `<dialog>` or popover that does not contain the target, or a user action made inside one *(0.7.1: a click need not move focus; WebKit does not focus buttons on click)*.
- **Native first:** `autofocus`, `<dialog>`, `popover` and `<details>` keep their own focus behavior.
- Trusted stylesheets only. Semantics and decisions: [docs/rfc-focus-declaration-0.6.md](rfc-focus-declaration-0.6.md).

<a id="text"></a>**Text output** *(experimental, 0.5.1)*. `text: <value>` writes one value into the element's own **DOM text**: a real text node you can select, copy and find, and that assistive technology reads as normal content.

```css
.profile { --name: state("Alex"); }
.profile .name { text: var(--name); }
.profile .status { text: when(--online, "Online", "Offline"); }
.score .prev { text: previous(--score); }
.change-name { on: click(set(--name, "John")); }
```

- **Values:** one string, number or keyword: a literal, `var(--x)`, `previous(--x)`, `direction(--x)` or `when(…)`. Other functions are compile errors (`calc()`: register the property with `@property … <integer>` or `<number>`, so the browser computes it, and use `var()`). There is no template language: put fixed words in the HTML around a `<span>` (`Step <span class="n">1</span> of 4`).
- **Safety:** the value is written with the `Text` node API, never parsed as HTML (`<img onerror>` stays text). Only in trusted stylesheets, like `on:` and `bind:`.
- **Ownership:** only elements that are empty or hold exactly one text node. An element with child elements (an icon and a label) is never changed: target the label element. The original text is restored when no `text:` declaration applies (the rule stops matching, its condition is false, or the sheet goes away), so the HTML text is the fallback before the script runs and after. If something else changes that text or adds children, the binding stops (diagnostic) and leaves it alone. Do not put a bound element inside an `<output>` that a form can reset: WebKit's reset replaces the output's children.
- **Cascade:** the winning `text:` declaration is chosen by the cascade like any property (specificity, `:when()`, media, layers). It is re-read after a state changes in an owner of the element, when the element starts or stops matching a `text:` rule, and on `ReactiveCSS.refresh()`. A cascade change from anything else (a class that changes which rule wins) shows on the next of these.
- **Not** `content`: `::before { content: var(--x) }` keeps working natively.
- No automatic announcements: changing DOM text is announced only inside a live region (`aria-live`), as with any script; not verified with screen readers.

<a id="conditions"></a>**Conditions** (in `when()` and `:when()`) use `==`, `!=`, `>`, `<`, `>=`, `<=`, `and`, `or`, `not` and parentheses. Operands are states, `previous(--x)`, `direction(--x)`, numbers, dimensions, `true`/`false`, keywords and quoted strings (compared exactly; keywords case-insensitively). Units convert where CSS can convert them (`10px == 7.5pt`). A bare `--x` must be a boolean. A missing state or an impossible comparison (`--count > 10px`, `--color > 3`) makes the condition *unknown*, not false: `when()` gives no value and `:when()` does not match, with a warning.

**Updates.** A state change re-evaluates only that cell's subscribers. It goes to an urgent lane that the frame budget never defers, and writes only the values that changed. `:nth-var()` reads state cells directly and touches only the old and the new active element.

**Trust.** `on:` actions can change only declared state cells. `bind:` changes only the bound control's own value. Nothing else is reachable: no other DOM, no network, storage, cookies, script, `eval` or arbitrary methods. Events, triggers and actions come from explicit registries. Behavior is accepted only from inline and same-origin stylesheets, never just because stylesheet text exists. In cross-origin stylesheets `on:` and `bind:` are ignored with a warning, and other reactive CSS still works.

## Feature selection policy

Every construct is classified before it ships. The classification is in the [feature registry](#feature-registry).

| Category | Meaning | Examples |
|---|---|---|
| Keep native | Never duplicated or reinterpreted | `calc()`, `round()`, `mod()`, color functions, `:has()`, `:nth-child()`, `var()`, `attr()`, `sibling-index()`, `if()`, `@media`, `@layer`, `@scope`, `@container`, nesting, scroll-driven animations, `popover`, `<details>`, `<dialog>` |
| Simplify | Optional shorter syntax with equivalent behavior where claimed | `when()` (→ native `if()` when equivalent), `viewport()` (→ `dvw`/`dvh`), `typed()` (→ registration, experimental) |
| Extend | What CSS cannot do | `state()`, actions, `bind:`, `previous()`, `direction()`, `:changed()`, `:when()`, `:nth-var()`, `key()`, `outside()`, `cycle()` |
| Evaluate (not built) | Duplicates the platform or needs broader permissions | drag and drop, physics, routing, storage, network, clipboard, DOM mutation actions, animation DSLs |

The rule: reduce the JavaScript people write, not increase the functions they must learn. The design decisions for 0.3 are in [docs/api-0.3.md](api-0.3.md).

<a id="feature-registry"></a>**Feature registry.** `ReactiveCSS.describe()` (and the `FEATURES` export) returns every feature as data: name, kind, category, status (stable, experimental, planned or rejected), syntax, arguments, return type, whether it needs the runtime, its native equivalent, dependencies and examples. It also returns the list of native features left alone. A test keeps it in sync with what is actually registered. It is meant for docs, validation, editor completion and a future MCP server.

**Accessibility.** These are visual behaviors. CSS cannot update ARIA attributes or move focus. The demo tabs are buttons, not an ARIA tabs widget. Prefer native elements (`<details>`, checkboxes with `:checked`, `<dialog>`) when they fit, and do not claim more accessibility than you test.

## How it works

```
<style> / <link>  →  read source text  →  tokenize (source-preserving)  →  compile
   →  the same stylesheet is rewritten in place through the CSSOM (deleteRule / insertRule)
   →  rule watchers bind matching elements  →  shared scheduler updates one custom property per binding
```

1. **Source acquisition.** The browser drops values it does not understand from the CSSOM, so the library reads the source text. Inline `<style>` uses `textContent`. Same-origin `<link rel="stylesheet">` uses `fetch()` (normally from the HTTP cache). A cheap text check skips sheets without reactive syntax. Those sheets are never tokenized or changed.
2. **Compile.** A small CSS tokenizer keeps every token's source range. It understands comments, strings, escapes, `url()`, nested blocks, `@media`/`@supports`/`@layer`/`@container`/`@scope`/`@starting-style` and CSS nesting. The output is the original text with targeted splices. Everything else stays byte-for-byte the same.
   ```css
   .particle { transform: translateX(live(random(0px, 500px), 200ms)) !important; }
   /* becomes */
   .particle { transform: translateX(var(--rcss-1)) !important; }
   ```
   The expression tree (`live → random`) is parsed and validated once. Literal ranges are pre-parsed.
3. **Cascade.** The compiled rules replace the original rules *inside the same `CSSStyleSheet`*, through the CSSOM. The sheet keeps its position, `media`, `disabled` state, alternate-set `title`, URL base and its entry in `document.styleSheets`. Leading `@import`, `@namespace` and `@layer` statements are left untouched. A rule the browser rejects in `insertRule` is one it would also have dropped when parsing the file. `stop()` restores the original rules. No `<style>` element is created, so this works under a strict Content-Security-Policy ([CSP](#content-security-policy)).
4. **Bindings.** Each reactive rule has a watcher that finds candidate elements. The selector is used with state pseudo-classes such as `:hover` replaced by `:is(*)`, so the candidate set is a superset. Binding an extra element is harmless: the `var()` only applies where the real selector matches. See [Runtime architecture](#runtime-architecture) for how bindings are stored and updated.
5. **Scheduler and lifecycle.** See below.

## Runtime architecture

**Native first.** Work the browser can do is compiled to plain CSS and costs nothing at runtime:

| Feature | Runs as |
|---|---|
| `viewport(width/height)` | Native `100dvw` / `100dvh` |
| `state()` initial values | Native `var()` fallback (no write until a state changes) |
| Top-level `random(min, max)` with literal same-unit bounds | Native `random()` when the browser has per-element `random()` (Chromium 156 and WebKit 27.2 do), else JS, evaluated once |
| `random(..., by step)`, `random(element-shared, ...)`, mixed units, `pick()` | JS, evaluated once per element, then idle |
| `live()`, `on()`, `mouse()`, `visible()`, `:just-checked`, `:just-unchecked`, `:nth-var()` | JS |
| `on:` actions, `when()`, `:when()`, state changes | JS (one delegated listener per event type; per-element work only for subscribers of the changed state) |

Investigated and not used: scroll-driven animations (`animation-timeline: view()`) for `visible()` give a scroll progress, not a visible/hidden state that ordinary transitions can follow. `sibling-index()` with `if()` can compute values from an index, but cannot make a selector match, so it cannot replace `:nth-var()` for all declarations, nested rules and specificity.

<a id="shared-sources"></a>**Shared sources.** A function whose value is the same for every element provides a `SharedSource` (`shared()` hook in the registry). Today this is `mouse(x)` / `mouse(y)` in viewport mode. The pointer listener is installed once for the page and reference-counted. Each axis formats its value once per change and notifies only its own subscribers. A declaration such as `.item { --mx: mouse(x) }` subscribes once, not once per element, and is written in one of two ways:

- **On the nearest common ancestor** of the matching elements, once, when there are at least 16 of them and they make up at least half of that ancestor's subtree. Descendants inherit the value.
- **On each element** otherwise.

This rule comes from measurements. An inherited write restyles the ancestor's whole subtree. With 10,000 tracked elements, one root write needed half the style time of 10,000 element writes. With 1 tracked element in a 10,000-element page, the root write needed 37 times more. `mouse(x, local)` stays per element, because each element measures its own box, but it reuses the shared pointer value.

**Element bindings.** The expression tree of a declaration is compiled once per rule and shared by every matching element. Static arguments, and the argument arrays of calls whose arguments are all static, are shared too. Per element there is one `Binding` object, which is also the function context (`el`, `notify()`), plus one small class instance per reactive call holding only its own state (for example the current random value). There are no per-element closures: `live()` instances subscribe themselves to the scheduler, and `on()` instances are their own event listener (`handleEvent`). Bindings are stored in a `WeakMap` keyed by element. In the `live()` benchmark this cut the JS heap for 10,000 elements from 32.6 MB to 6.3 MB.

**Scheduler.**
- `live()` subscriptions are grouped by interval. One `setTimeout` waits for the earliest group deadline, so a 2 s interval wakes 0.5 times per second, not 60. Elements in a group share the deadline but each rolls its own random value.
- Elapsed time comes from `performance.now()`. Missed ticks are skipped, not replayed, and periodic work stops while the tab is hidden.
- Updates go into one queue. A flag on each job deduplicates it, so a binding is evaluated at most once per frame.
- One `requestAnimationFrame` flush first evaluates every queued job (DOM reads such as `getBoundingClientRect` for `mouse(x, local)`), then writes only the values that changed.
- A frame flush aims for about 4 ms of script time. It estimates the cost per job from earlier flushes. Larger batches (for example 20,000 values ticking together) continue in the next frame, oldest first, instead of dropping a frame. Synchronous flushes (start, `refresh()`) are not limited.

**Cleanup.** One `MutationObserver` on the document looks only at mutated subtrees. It uses an `attributeFilter` built from the reactive selectors, and never `style`, so the library's own writes do not come back to it. A changed attribute only re-matches the watchers whose selectors mention that attribute (`class`, `id`, `[attr]`). For selectors with sibling combinators or structural pseudo-classes, the parent's subtree is re-matched: a bounded fallback whose cost is that subtree. Removed elements release their timers, listeners, observer entries and shared-source membership at once. A binding that is still queued is marked dead and skipped at the next flush. Moved elements keep their bindings. An element that is removed and later re-added gets a fresh context. Shared `IntersectionObserver`s (one per threshold) and the pointer listener are released when nothing uses them. `stats()` reports all of these counts, and the tests check that they return to zero.

**What stays element-scoped.** Every value that depends on the element: `random()`, `pick()`, `live()`, `on()`, `mouse(x, local)` and `visible()`. Their values are computed and written per element. Only element-independent values (viewport mouse coordinates) are shared.

Updating a custom property does not rebuild the DOM, but the browser still recalculates style, and may need layout and paint, depending on the property. Prefer `translate`, `scale`, `rotate` and `opacity` for things that update often. The library does not rewrite `left`/`top` into transforms, because that would change the layout semantics.

## Native CSS compatibility

- Standard syntax is never reinterpreted. `:checked` and `:nth-child()` are not touched, and the custom selectors use new names.
- `random()` follows the CSS Values 5 argument order: `random([element-shared,] min, max [, by step])`. The third argument is a step, never an update interval. Use `live()` for time. Values are per element and per call unless you write `element-shared` (one value for all elements, never re-rolled). Named sharing keys (`--name`) and `fixed` are rejected with a diagnostic.
- Native `random()` is used only when it behaves like Reactive CSS. At start the library checks `CSS.supports()`, and also renders two probe elements to confirm that the browser gives them different values. Earlier drafts shared one value across elements, and in such browsers the JS path is used. `by` steps and `element-shared` are not supported natively in the tested browsers, so they always use JS. Values inside `live()`/`on()` must re-roll, so they always use JS too.
- Generated custom properties of reactive values are not registered with `@property`. They must inherit so that pseudo-elements such as `.x::before { left: random(...) }` work, and transitions run on the target property, not on the variable. The generated properties behind `state()` are registered with `inherits: false`, so nested owners stay isolated.

## Limitations

- **The library must read the stylesheet source.** It cannot read cross-origin sheets without CORS. These sheets are skipped with a diagnostic unless the `<link>` has a `crossorigin` attribute (then the sheet is fetched, and a failure is reported). The library never tries to bypass CORS. Pages opened from `file://` cannot fetch linked sheets: use a local server or inline `<style>`. Under a CSP, `connect-src` must allow the stylesheet URL (it usually does through `'self'`).
- `@import`ed sheets, `style="..."` attributes and shadow DOM stylesheets are not processed.
- Reactive values inside `@keyframes`, `@font-face`, `@page`, `@property` and other non-grouping at-rules are left unchanged, with a diagnostic.
- `pick()` values cannot contain top-level commas.
- `:when()` and state pseudo-classes decide where a value applies, not whether its source runs. `.a:when(--on) .dot { --x: live(…) }` keeps its timer running while `--on` is false; the value just does not apply. To stop a source, gate it with the DOM: remove the element, or use an attribute that the browser or a script changes (`details[open]`). Attributes written by `attr:` do not re-match reactive rules (see Attributes).
- Selector matching for bindings ignores at-rule conditions and state pseudo-classes (superset matching). A rule such as `:is(.a:hover)` inside a functional pseudo-class other than `:not()` is stripped. `:not(:hover)` is kept, so elements that are hovered while they are discovered are not bound until the next relevant DOM change.
- A `<link>` whose `href` changes is processed again. `media`, `disabled` and alternate stylesheet sets keep working natively, because the same sheet is rewritten in place. A `<link disabled>` that is enabled later is processed when the browser loads it. Exception: `bind:` and state from a sheet that is disabled at runtime stay active until the sheet is removed. `on:` checks that its sheet is enabled when the event fires.
- The first paint can happen before the deferred script runs. Transitions on reactive properties can then play once on load (for example, particles move in from `0 0`). `:just-checked` is not affected.
- A processed sheet's CSSOM contains the compiled rules (`var(--rcss-…)`). Scripts that read or edit the CSSOM of that sheet see those rules.
- **State** lives in memory only. It resets on reload, when its owner is removed and re-inserted, and when its stylesheet is edited. Existing states do not pick up initial-value changes that come only from media queries. If a non-state declaration of the same custom property wins the cascade, `var(--x)` shows that value, while conditions and actions keep using the state.
- **`when()` compiled to native `if()`** gives the same result as the runtime (tested). When the state is missing, though, there is no warning, and a number state of exactly `1`/`0` (or a non-state declaration of the same property) is read as a boolean. Set `window.ReactiveCSSConfig = { native: false }` before the script to force the runtime path.
- **`:changed()`** clears when the animations and transitions it started finish. An infinite animation keeps it until the next change. To find what it started, it calls `document.getAnimations()` once per frame in which markers were set, after that frame has rendered. In Chromium that call costs roughly *running animations × page size*: 0.1 ms with 3 running animations in a 10,000-element page, 30 ms with 300 (measured). Typical pages are in the cheap range; the 10,000-counter stress benchmark is not.
- **`bind:`** never binds password, one-time-code or payment fields (`type="password"`, `autocomplete="current-password | new-password | one-time-code | cc-…"`).
- **`bind:`** supports the controls listed above. A range input clamps values, so a state outside its range is shown clamped.
- **`bind:` and fast choices** *(fixed in 0.8.1)*. Every choice on a bound checkbox or radio reaches the state, even several in one task, such as two arrow-key moves before the next frame on a page with `on: click` rules. While the browser has just toggled a bound control for a click, writes to it and to its radio group wait for its `input`/`change`, or for the next frame if the click was cancelled. A cancelled click leaves both the control and the state unchanged. This adds one capture `click` listener on `window` while any bound control exists.
- **WebKit engine limitations** (reproduced without Reactive CSS; not library bugs):
  - an element rendered once and then hidden by a `display: none` ancestor keeps stale inherited values. A `text:` inside such a section shows an old value if the section is shown by something other than a state change (`:has(:checked)`, `details[open]`, a media query). Show such sections with a state-driven rule, for example `.c:when(not --show) .box { display: none; }`, so the reveal re-reads them;
  - `:has(:invalid)` does not update after a required, empty `<select>` is enabled. Derive gates from state instead, for example `attr: aria-disabled when(--on == b and --size == "", true, false)`.
- **`element()`** measures the border box and updates one frame after a resize. A value that feeds back into the element's own size is frozen after about half a second, with a warning. A long monotonic resize driven by something else (for example a transition) pauses updates for two frames every half second while this is checked.
- **`typed()`** differs from a native `@property` rule: it always registers `inherits: true`; the syntax is inferred from the value; the first compiled `typed()` for a name wins (a later one with another type is skipped with a warning); and the registration is document-wide and permanent, even after its stylesheet is removed (a native `@property` goes away with its sheet). It is skipped when a readable stylesheet has a native `@property` for the name; native rules in cross-origin sheets cannot be seen.
- **Several `state()` declarations for one name on one owner** share one state, initialized by the declaration that wins the cascade (specificity, order, layers, media, `!important`), including evaluated initializers (`attr()`, `pick()`). A stylesheet that loads later can still initialize a state that has not changed yet; a state that changed is never re-initialized. Each `state()` declaration adds an unregistered marker property (`--rcss-s…-w`) to its rule for this; inline `style` declarations of the state's property are not `state()` declarations and do not take part.
- **`state()` generated properties** are registered once per state name for the lifetime of the page (the platform cannot unregister them): recompiling a stylesheet registers nothing new for names it has seen.
- **`on:`** reads the computed `--rcss-on` of the candidate elements when the event fires. If styles are dirty at that moment, the read forces a style recalculation. It needs `CSS.registerProperty()` (Firefox 128+, Safari 16.4+, Chrome 78+). Only the seven listed events are supported. State values cannot contain commas.
- When very many values change at once (thousands), the frame budget spreads the writes over a few frames, so some elements update one or two frames (16–33 ms) later than others.
- When a shared value is written on a common ancestor, the custom property is also visible to non-matching descendants of that ancestor. Only the generated `var()` reads it, so nothing visible changes, but `getComputedStyle()` on such an element shows the value.

## Content-Security-Policy

Reactive CSS needs **no** `'unsafe-inline'`, no hash and no nonce of its own. It rewrites existing stylesheets through the CSSOM and writes custom properties through `element.style`. CSP `style-src` does not govern either. It never injects `<style>` elements or `style=""` attributes. Tested with real response headers in Chromium and WebKit (`tests/browser/csp.spec.ts`), with zero violations caused by the library:

| Policy | Result |
|---|---|
| none | Works |
| `script-src 'self'` (external library allowed) | Works |
| `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'` (same-origin stylesheets, no inline styles) | Works |
| `script-src 'nonce-…'; style-src 'nonce-…'` with `<style nonce>` and `<script nonce>` | Works |
| as above plus `style-src-attr 'none'` | Works. An author `<style>` the policy blocks stays blocked, and the library reports it ("the browser did not apply this stylesheet"). It does not try to apply it. |

Requirements: the script must be allowed by `script-src`. Linked stylesheets must be readable with `fetch()`, so `connect-src` must allow their URL, which `'self'` or `default-src 'self'` covers. Not supported: making the browser apply a stylesheet the policy blocks.

## Security and trust

- **What CSS can do through Reactive CSS.** `on:` can change only declared state cells. `bind:` can change only the bound control's own value. Nothing reaches JavaScript, the network, storage, cookies or other DOM: there is no `eval`, no `new Function` and no dynamic property access. Events, triggers and actions come from fixed registries, and lookups go through `Map`s, so `constructor` or `__proto__` resolve to nothing. Action values are literals, never calls. User text that reaches CSS through `bind:` is always a quoted, escaped CSS string. Details and the audit are in [docs/security.md](security.md).
- **Origin is not trust.** Behavior (`on:`, `bind:`) is accepted from same-origin linked stylesheets and from inline `<style>`, and ignored in cross-origin sheets. A same-origin check alone is not a security boundary: if your site lets users add CSS (a `<style>` in user content, uploaded stylesheets), that CSS is "same-origin" too. CSS injection is already dangerous without Reactive CSS. Reactive CSS adds one capability: CSS can read the *live* value of a bound control. For that reason `bind:` refuses password, one-time-code and payment fields. If your pages render user-provided `<style>` elements, set `trustInlineStyles: false` (below) so behavior comes only from your own linked stylesheets. Do not serve user-uploaded CSS from your origin.

## Configuration (optional)

Zero configuration is the default. For the cases above, set `window.ReactiveCSSConfig` before the library script runs:

```html
<script>window.ReactiveCSSConfig = { trustInlineStyles: false };</script>
<script src="reactive-css.min.js" defer></script>
```

| Option | Default | Effect |
|---|---|---|
| `trustInlineStyles` | `true` | `false`: `on:` and `bind:` are accepted only from same-origin `<link>` stylesheets, not from `<style>` elements |
| `native` | `true` | `false`: `when()` always uses the runtime instead of native `if()` (for testing and comparison) |

Under a CSP without `'unsafe-inline'` scripts, put the configuration in a nonced or external script.

## Production deployment

- Use `reactive-css.min.js`. It logs one summary line instead of each warning; `ReactiveCSS.diagnostics` still lists everything. Source maps are next to the bundle.
- Serve stylesheets that use Reactive CSS from your own origin, or with CORS plus `crossorigin` on the `<link>`.
- Keep `defer` (or put the script at the end of `<body>`). The first paint may happen before the library runs, so reactive values appear one script execution later (see Limitations).
- Run `npm run verify` before shipping changes to the library: typecheck, unit tests, distribution tests (ESM import, type declarations, the minified bundle on a plain HTML page) and the Chromium and WebKit suites.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Nothing reactive happens on a page opened from disk | `file://` pages cannot fetch linked stylesheets. Serve the folder over http (`npx serve`, `python3 -m http.server`) or use an inline `<style>`. |
| "Skipped cross-origin stylesheet …" | The sheet is on another origin. Serve it from your origin, or with CORS and `<link crossorigin>`. |
| "… the browser did not apply this stylesheet" | The browser blocked the sheet (CSP, network error). Fix the policy or the URL; the library cannot apply blocked CSS. |
| "uses --x, but no element declares "--x: state(...)"" | The element is not inside an owner of `--x`. Add `--x: state(...)` to an ancestor, or check the selector of the state rule. |
| "on: is ignored in untrusted stylesheets" | `on:`/`bind:` in a cross-origin sheet, or in `<style>` with `trustInlineStyles: false`. Move it to a same-origin stylesheet. |
| "attr: disabled on <div>: disabled only works on button, input…" | `disabled`/`required` have no native effect on that element, so nothing is written. Use a native control, or `aria-disabled` plus an inactive action. |
| "attr: … is ignored: a state(…, bind(…)) on the same element owns that attribute" | Two features write the same attribute. Keep one. |
| "focus: h2 is not focusable. Give it tabindex=\"-1\"" | A `focus:` target that is not natively focusable. Add `tabindex="-1"` in the HTML. |
| "prevent() only works in click(…) and key(…)" | The event cannot be cancelled there (or, for `outside()`, must not be). Use `click` or `key()`. |
| "prevent() on … this keydown event is not cancelable" | A script dispatched the event without `cancelable: true`; real user events are cancelable. |
| `prevent()` does not stop arrow keys in a text field | By design: form controls keep their keys unless the rule is on the control itself. |
| `focus:` does nothing | It reacts only to a false → true change caused by a user click, key, input or change (not on load, not from scripts or timers), and never takes focus from a dialog, a popover or where the user moved it. |
| A derived attribute stopped updating ("… stopped: the attribute was changed by something else") | Another script wrote the attribute; Reactive CSS yields to it. Remove the other writer or the `attr:` rule. |
| `content: var(--n)` shows nothing for a number | CSS cannot print numbers with `content`. Use `counter-reset: n var(--n); content: counter(n)`, or a string state. |
| A `when()` property is "unset" | The condition is unknown: a missing state, or a comparison of incompatible types (`--n > 10px`). See `ReactiveCSS.diagnostics`. |
| Warnings name a stylesheet | Every compile-time warning starts with the stylesheet: its `href`, `<style id="…">` or `inline <style> #n`. |

## Accessibility

Writing the right attribute or moving focus does not make a component accessible by itself. What each layer does:

| | Provides |
|---|---|
| **Native HTML** | Roles, names and states of native elements; keyboard behavior of buttons, links, form controls, `<details>`, `<dialog>`, `popover`; Tab order; `autofocus`; constraint validation |
| **Reactive CSS** | Keeps a small set of attributes in sync with state (`aria-expanded`, `aria-pressed`, `aria-selected`, `aria-disabled`, `aria-current`, `disabled`, `hidden`, `required`, `tabindex` 0/-1, `data-*`); moves focus on user-initiated state transitions (`focus:`); real DOM text (`text:`) |
| **The author** | Choosing native elements first; roles and accessible names; making targets focusable (`tabindex="-1"`); making `aria-disabled` controls inactive; live regions; testing with screen readers |

**Known limitations:**
- No focus restoration. Use `<dialog>`/`popover`.
- No manual tab activation (arrow keys without selecting).
- `outside()` dismissals do not move focus.
- Nothing has been verified with a screen reader. The examples' READMEs list what is tested (keyboard, DOM state in Chromium and WebKit) and what is not.

Prefer native elements that already have the behavior: `<details>`/`<summary>` for disclosures, checkboxes (with `role="switch"` for switches) and radio groups for choices (with `bind:`), the `popover` attribute for popups and `<dialog>` for dialogs.

## Performance

Measured with `npm run bench` on an Apple M4 Max (36 GB, macOS 27), Playwright's Chromium 156 (headless shell). Each scenario runs at 100, 1,000, 5,000 and 10,000 elements. Every row in [benchmarks/results.md](../benchmarks/results.md) has the environment, frame sample counts and p50/p95/p99.

**Method.** Each scenario is measured over a 3-second window with its workload driver running, after a 0.5 s warm-up and a forced GC. Since the 0.4 audit, the harness loads the production bundle (`dist/reactive-css.min.js`), seeds `Math.random` for every implementation, and repeats each run (default 3, interleaved, implementation order rotated); tables show the median and `results.json` keeps every run with its min–max range. The runtime audit (startup, idle CPU, input latency, memory, long-running) is in [benchmarks/AUDIT-0.4.md](../benchmarks/AUDIT-0.4.md).
- Script time comes from the CDP `Performance.getMetrics` API.
- Style, layout, paint (`PrePaint` + `Paint`), composite (`Layerize`) and raster times are summed from a Chromium trace (`devtools.timeline`). The headless shell rasterizes in software, so the raster and composite numbers do not represent GPU devices.
- Memory is the JS heap after a forced GC. Per-element memory is measured against the same DOM with no script.
- **v0.1.0** is the previous build (kept in `benchmarks/baseline/`), run in the same harness.
- **plain JS** writes the target property directly.
- **plain JS (same vars)** writes the same custom properties as Reactive CSS. This is the fair comparison for the rendering work.

The tables below are the per-version records from before the 0.4 audit: development build, one run each, and script time taken while Chromium tracing was on, which under-counted timer-driven script in some runs (for example `live()`; see [PERFORMANCE-0.4.md](../benchmarks/PERFORMANCE-0.4.md#7-tracing-overhead)). Current production-bundle numbers, with medians of 3 runs: [benchmarks/results.md](../benchmarks/results.md) and [PERFORMANCE-0.4.md](../benchmarks/PERFORMANCE-0.4.md).

Results at 10,000 elements:

| Workload | Metric | v0.1.0 | **Now** | plain JS | plain JS (same vars) |
|---|---|---:|---:|---:|---:|
| Static `random()` | start (ms) | 22.4 | **17.0** (native `random()`) | 5.3 | — |
| | first frame (ms) | 58.5 | **44.1** | 34.2 | — |
| | JS heap per element | 1,775 B | **16 B** | — | — |
| Static `random(…, by 1px)` (JS path) | start (ms) | 22.7 | **12.7** | — | — |
| | JS heap per element | 2,102 B | **303 B** | — | — |
| `live(random(), 2s)` | JS heap | 32.7 MB | **6.0 MB** | 1.4 MB | 1.4 MB |
| | script (ms/s) | 14.9 | **4.1** | 6.5 | 5.0 |
| `live(random(), 200ms)` | script / style (ms/s) | 130 / 85 | **64 / 107** | 47 / 37 | 75 / 114 |
| | frame p95 / p99 (ms) | 33.3 / 33.5 | **16.8 / 16.8** | 16.8 / 33.4 | 33.3 / 33.4 |
| `mouse(x)` every frame | script / style (ms/s) | 295 / 435 | **3.3 / 276** | 90 / 226 | 169 / 519 |
| | frame p95 (ms) | 33.4 | **16.7** | 16.7 | 33.4 |
| `mouse(x, local)` every frame | start (ms) | 82 | **28** | — | 1.5 |
| | script (ms/s), frame p95 | 1,185, 50.1 | **670, 33.4** | — | 738, 50.0 |
| `:nth-var()`, 20 changes per frame | script (ms/s) | 16.9 | **7.8** | — | — |
| Insert 10,000 reactive elements | bind (ms) | 21.7 | **14.5** | — | — |
| Continuous churn (1 % per frame) | JS heap | 32.6 MB | **6.0 MB** | — | — |

At 100 and 1,000 elements every scenario holds 60 fps (p95 ≤ 16.8 ms), except `mouse(x, local)`, which holds p95 16.8 ms at 1,000. After cleanup, every run returns to zero bindings, zero subscriptions and the baseline heap.

**What these numbers mean:**
- The remaining cost of reactive updates is mostly the browser's style recalc for custom-property writes. Plain JS that writes the same custom properties pays the same cost.
- In `live(…, 200ms)`, total style and composite time per second is *higher* than in v0.1.0. The frame budget renders more frames with less work each, which keeps p95 at one frame. That trade-off is intentional.
- `mouse(x, local)` needs a `getBoundingClientRect()` per element per frame. At 10,000 elements it does not hold 60 fps, and neither does the equivalent plain JS.
- Not measured: GPU raster/compositing, Firefox, real devices. Before this pass there was no paint or composite measurement at all.

**State, actions and conditions (0.2.0).** The plain-JS reference uses the same DOM, one delegated listener that toggles an attribute, and native CSS selectors for the styles. A "click" is one `element.click()` dispatch: action, state change and notifications (the writes follow in the next frame).

| Workload | n | Reactive CSS | plain JS |
|---|---:|---:|---:|
| Independent toggle components (`state` + `on:` + `when()` + `:when()`), 20 clicks per frame | 1,000 | start 6.6 ms · 2.3 MB · click 4.9 µs avg · p95 frame 16.7 ms | 1.2 MB · click 4.2 µs · 16.7 ms |
| | 10,000 | start 27.4 ms · 9.9 MB (≈0.9 KB per component) · click 5.5 µs · 16.7 ms | 1.3 MB · click 3.5 µs · 16.8 ms |
| One state, n `when()` subscribers, toggled every frame | 1,000 | click 41 µs · script 28 ms/s · style 145 ms/s · 16.8 ms | click 28 µs · 3 ms/s · 131 ms/s · 16.7 ms |
| | 10,000 | click 0.15 ms · style 921 ms/s · p95 217 ms | click 20 µs · style 916 ms/s · p95 150 ms |
| Tabs (`state` + `set(sibling-index())` + `:nth-var()`), 20 clicks per frame | 10,000 elements | start 18.7 ms · script 50 ms/s · style 0.4 ms/s · 16.7 ms | — |
| Three nested scopes per group | 10,000 | start 23.9 ms · click 6.4 µs · 16.7 ms | — |
| Components mounted and removed continuously (1 % per frame) | 10,000 | script 204 ms/s · p95 33.3 ms · cleanup to 0 | — |

Phase 5 did not regress the earlier workloads. In the same run at 10,000 elements: `live(…, 200ms)` p95 16.7 ms, `mouse()` 2.4 ms/s of script, static JS-path start 11.7 ms, `live()` heap 6.1 MB. These are equal to or better than before.

**Fan-out.** A state with thousands of subscribers writes one custom property per subscriber, in one frame, because user input is never deferred. Its style cost then equals that of plain JS doing the same visual change, but the frame is longer. For large fan-outs, use the native cascade directly: `var(--open)` (`1`/`0`) inside `calc()`, or `@container style(--open: 1)`.

**0.3: binding, history, actions, native `if()`.** Same method. "Event" is one dispatched `input`/`click` event (binding or action, state change, notifications).

| Workload | n | Reactive CSS | plain JS |
|---|---:|---:|---:|
| Text inputs with `bind:` + preview, 20 input events per frame | 1,000 | event 4.9 µs · script 15 ms/s · style 19 ms/s · p95 16.8 ms | 5.4 µs · 14 ms/s · 11 ms/s · 16.8 ms |
| | 10,000 | start 15.8 ms · 6.7 MB · event 3.1 µs · p95 16.7 ms | 2.8 µs · 16.7 ms |
| Checkboxes with `bind:` + `when()`, 20 clicks per frame | 10,000 | start 15.5 ms · 6.5 MB · event 5.3 µs · p95 16.7 ms | 5.3 µs · 16.8 ms |
| Counters with `:changed()` + `previous()`, 20 changes per frame | 1,000 | start 5.6 ms · 2.3 MB · script 49 ms/s · p95 16.8 ms | — |
| | 10,000 | start 23.1 ms · 9.7 MB · script 417 ms/s (one `document.getAnimations()` per frame in a 10k-element page) · p95 16.7 ms | — |
| `outside()` + `key()` components, one outside click per frame | 1,000 / 10,000 | 0.57 ms / 3.4 ms per click (about 0.35 µs per component) | — |
| One state, n `when()` subscribers: **native `if()`** vs runtime | 1,000 | script 3.8 vs 26.7 ms/s · style 140 vs 160 ms/s (plain JS: 2.4 / 140) | |
| | 10,000 | start 2.0 vs 11.5 ms · heap 1.4 vs 3.9 MB | |
| Toggle components: native `if()` vs runtime | 10,000 | start 21.2 vs 26.4 ms · heap 7.9 vs 10.1 MB | |

**0.5.3: derived attributes.** One click on a button whose sibling derives `disabled` from the shared state costs 29–32 µs with 1,000–10,000 elements (plain JS: 3–4 µs). One earlier run measured 95 µs at 10,000. Most of it is the style recalculation forced in the click's task, which is what puts `disabled` in place before the next click. Input-to-frame latency equals plain JS: 13.9 vs 13.8 ms p50 idle, 12.7 vs 12.8 ms under load. Events that change no derived attribute pay nothing. Details: [docs/release-0.5.3.md](release-0.5.3.md).

All earlier scenarios were re-measured in the same run and are unchanged or better. At 10,000 elements: `live(…, 200ms)` p95 16.7 ms, `mouse()` 2.8 ms/s of script, static JS-path start 11.7 ms, nested scopes start 10.7 ms (was 23.9, now native `if()`). Two scenarios differ: `tabsstate` and `nthvar` vary by ±30 % between identical runs, so their difference is noise.

**0.4.0: new functions and regression check.** Full tables with methodology are in [docs/extensions-0.4.md](extensions-0.4.md).

| Workload (Chromium 156) | n | Reactive CSS | plain reference |
|---|---:|---|---|
| `element(width)`, container resized every frame | 100 | script 18.5 ms/s · layout 19.2 ms/s · p95 16.7 ms | one hand-written `ResizeObserver`: 12.9 · 31.8 · 16.8 |
| | 1,000 | 43.4 · 48.9 · 16.8 ms | 31.2 · 78.9 · 16.8 |
| | 1,000 | 0.4 · 181 · 16.7 ms | 0.4 · 83 · 16.7 |

All 0.3.1 workloads were re-measured in the same run (10 to 10,000 elements) and are unchanged within variance. Every run cleans up to zero bindings, states, subscriptions and observers. Previous results are kept in `benchmarks/baseline/`.

**0.3.1: typical sizes, before and after.** The same harness and machine as 0.3.0, comparing the 0.3.1 build with the saved 0.3.0 results (`benchmarks/baseline/results-v0.3.0.json`). The "event" column is one dispatched click or input event.

| Workload | n | start (ms) 0.3.0 → 0.3.1 | JS heap (MB) | p95 frame (ms) | event (µs) |
|---|---:|---|---|---|---|
| Stateful toggles (`state` + `on:` + `when()` + `:when()`) | 10 | — → 2.2 | 1.48 | 16.8 | 15.1 |
| | 100 | 2.4 → 2.6 | 1.55 | 16.7 | 12.8 → 12.4 |
| | 1,000 | 4.9 → 4.9 | 2.15 | 16.7 | 5.1 → 5.0 |
| `bind:` text input | 100 | 2.0 → 2.2 | 1.53 | 16.7 | 8.9 → 9.4 |
| | 1,000 | 3.6 → 3.8 | 2.03 | 16.7 | 4.9 → 4.9 |
| One state, n subscribers (native `if()`) | 1,000 | 1.8 → 1.8 | 1.43 | 16.7 | 31.6 → 21.4 |
| `:changed()` counters | 1,000 | 5.6 → 5.5 | 2.35 | 16.8 | 16.8 → 14.3 |
| `:nth-var()` | 1,000 | 2.4 → 2.7 | 1.55 | 16.7 | — |
| `live(…, 200ms)` | 1,000 | 4.2 → 4.2 | 1.94 | 16.8 | — |
| Mount/unmount of state components | 1,000 | 4.8 → 4.8 | 2.15 | 16.8 | 5.4 → 5.7 |

Every run, at every size, cleans up to zero bindings, states and subscriptions. A heap-snapshot test confirms no detached elements stay reachable. Run-to-run variance of the CDP script metric is large: `live(…, 200ms)` at 1,000 measured 7.0 ms/s in the 0.3.0 run and 17–21 ms/s in three 0.3.1 runs, and 36 ms/s in an earlier 0.1 run. A CPU profile of the 0.3.1 run shows about 4 ms/s of library JavaScript, so there is no new hot path. Stress sizes (10,000) are in [benchmarks/results.md](../benchmarks/results.md).

The audit behind these changes, with profiler evidence, is in [benchmarks/FINDINGS.md](../benchmarks/FINDINGS.md).

## Add a function

A function is one definition object. The parser, scheduler and element manager do not change.

```ts
import { defineFunction } from './core/registry';
import { every, unevery } from './core/scheduler';
import { parseTime } from './functions/live';

// cycle(a, b, c, 1s): steps through the values.
defineFunction({
  name: 'cycle',
  kind: 'operator',
  compile(args) {               // runs once per call site; throw to reject with a diagnostic
    if (args.length < 2) throw new Error('expected values and an interval');
    return parseTime(args[args.length - 1].text);
  },
  create: (ctx, args, ms) => new Cycle(ctx, args, ms), // runs once per element
  // native(args, data, nested) { return 'plain css' } — return a string to skip the runtime
  // shared(data) { return source }  — for values that are the same for every element
});

// Keep per-element state in a small class instance: no closures per element.
class Cycle {
  i = 0;
  constructor(ctx, args, ms) { this.ctx = ctx; this.args = args; this.ms = ms; every(ms, this); }
  tick() { this.i = (this.i + 1) % (this.args.length - 1); this.ctx.notify(); }
  get() { return this.args[this.i].get(); }
  dispose() { unevery(this.ms, this); }
}
```

`kind` documents the role: `generator`, `operator`, `event`, `source` or `native`. Selectors use `defineSelector` with a `compile(arg, compound, sheet)` that returns the replacement attribute selector and pushes runtime setup into `sheet.setup`. See `src/selectors/`.

## API

`window.ReactiveCSS` in the browser build, named exports in the ESM build:

| | |
|---|---|
| `start()` / `stop()` | Process the document / restore the original sheets and release everything. The browser build calls `start()` itself. |
| `refresh()` | Read state again that has no change event: programmatic `checked` changes, `:nth-var()` values that come from stylesheets. |
| `stats()` | Counters: sheets, bindings, scheduled callbacks, interval groups, event/source subscriptions, shared observers/listeners, parse time, and flush time split into source / evaluation / write phases. |
| `diagnostics` | Every problem found, also when the console is quiet. |
| `describe()` | The registered functions, selectors, actions and events with their syntax, as data (for tools). |
| `compile(css)` | The pure compiler, useful for tooling and tests. |
| `defineFunction`, `defineSelector`, `defineAction` | Internal extension points (not a stable plugin API yet). |

## Develop

```bash
npm install
```

```bash
npm run build
```

```bash
npm test
```

```bash
npx playwright install chromium firefox webkit
```

```bash
npm run test:browser
```

```bash
npm run test:dist
```

```bash
npm run verify
```

```bash
npm run serve
```

```bash
npm run bench
```

`npm ci` installs exactly the locked dependencies. `npm run test:browser` runs Chromium and WebKit; `npm run test:firefox` runs Firefox where Playwright's Firefox starts. `npm run test:dist` builds, then tests the generated files only: the minified bundle on a plain HTML page (`tests/dist-smoke/`), a Node import of `dist/index.js` and a TypeScript consumer of the declarations. `npm run verify` runs everything (typecheck, unit, dist, browser). Everything runs locally; no service or account is needed. `node benchmarks/quick.mjs <scenario> <n> <impl...>` measures one scenario, and `node benchmarks/profile.mjs <scenario> <n> <impl>` prints a heap snapshot summary and a CPU profile. `npm run serve` serves the playground at `http://localhost:8080/examples/` and rebuilds on change. Examples: `examples/api/` holds sixteen one-feature API examples (counter, `previous()`, `random()`, `focus:`, `visible()`…), and the application-sized demos are listed in the demo lab at `examples/lab/`; see [docs/api-examples-0.8.md](api-examples-0.8.md). Source layout: `src/core` (tokenizer, parser, registry, scheduler, elements, engine, config, features), `src/functions`, `src/selectors`, `src/state` (state, actions, conditions, bind, changed, keys, typed, values), `src/features` (bundle catalog and one entry per feature), `src/api.ts` (the API every bundle exports), `src/index.ts` (ESM entry, all features), `src/auto.ts` (browser build), `tools/` (bundle builder and analyzer). Docs: [docs/](./) (state engine, 0.3 API design, security, compatibility, release notes).

## Proposed (not implemented)

These have extension points but no implementation. Each needs defined trigger semantics and tests before it ships. `describe()` lists them with status `planned`.

- `history(--x, n)`: bounded history beyond `previous()`.
- `element(selector, width)`: measuring another element (deferred in favour of `anchor-size()` and container units).
- `spring()`, `throttle()`, `debounce()`: need a concrete UI case that native transitions (with `linear()` easing) do not cover.
- Rejected with reasons in [docs/api-review-0.4.md](api-review-0.4.md): `map()` (use `progress()`), `distance()` (use `hypot()`), a value `cycle()` (use `@keyframes` + `steps()`), `smooth()` (use `transition`).
- `:just-focused`, `:just-blurred`: same model as `:just-checked`, using `focusin`/`focusout`.
- Reading an *ancestor's* attribute in an expression (needs its own syntax, for example a `closest()` form), typed `attr(name type(…))` in expressions, multiple-select and date/color bindings, and native `if()` for comparisons (once range style queries are available everywhere). `slice()` and list states are not planned.
- `:before-var()`, `:after-var()`, `:sibling-range()`: the `:nth-var()` group tracking already gives the index.
- Native `random()` delegation, an optional build-time compiler (for example Lightning CSS) that emits the same binding manifest, and a public plugin API.
