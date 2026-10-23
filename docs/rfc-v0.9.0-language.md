# RFC: the Reactive CSS 0.9.0 language

**Status:** implemented locally (0.9.0 candidate, unpublished). **Date:** 2026-10-22.

Principle: **selectors say when, declarations say what, state remembers, native CSS renders.**

Related documents:
- the migration map: [migration-0.9.md](migration-0.9.md);
- the engineering report: [release-0.9.0-preparation.md](release-0.9.0-preparation.md).

The 0.8.1 contracts this RFC builds on are unchanged unless a section says otherwise:
- the state engine: [state-engine.md](state-engine.md);
- `prevent()`: [rfc-prevent-action-0.7.md](rfc-prevent-action-0.7.md);
- `focus:`: [rfc-focus-declaration-0.6.md](rfc-focus-declaration-0.6.md);
- attribute binding: [rfc-attribute-binding.md](rfc-attribute-binding.md);
- the modular runtime: [rfc-modular-runtime-0.8.md](rfc-modular-runtime-0.8.md).

## 0. Audit findings that shape the design

| Finding | Consequence |
|---|---|
| The engine compiles from the **stylesheet source text** (a `<style>`'s text, or a same-origin `<link>` fetched again), then rewrites the same `CSSStyleSheet` through the CSSOM. | Selectors the browser rejects, such as `:on(click)`, are seen by the compiler. Empty rules survive, because the browser's CSSOM is never the input. Verified: Chromium 156 and WebKit 27.2 drop `.x:on(click){}` from `cssRules`. |
| Every behavior that must follow the cascade is a registered, non-inherited generated property. The runtime reads it (`--rcss-on`, `--rcss-text`, `--rcss-attr-*`, `--rcss-focus`). | The new syntax compiles to the same mechanism. The browser's cascade (origin, `!important`, layers, specificity, order, media, `:hover`, `:when()`) keeps choosing winners. No second cascade implementation. |
| Event handling is one capturing document listener per event type, installed only while a rule uses it. Candidate elements are tracked by selector watchers. | `:on()` reuses it: the same listener, candidate tracking and cleanup. |
| `content: "x"` on an element (not a pseudo-element) computes but renders nothing in Chromium 156 and WebKit 27.2. `content: 5` is invalid at computed-value time. | The native `content` declaration can be kept as written while Reactive CSS also writes the DOM text. See §8. |
| Native `random()` is supported in Chromium 156 and WebKit 27.2. 0.8.1 already uses it natively when the browser gives per-element values (two-element probe). | The policy stays; §11 adds the event-time contract. |
| The 0.8.1 syntax (`on:`, `bind:`, `text:`, `attr:`, `focus:`) has 628 browser tests and many fixes behind it. | The old syntax stays as a supported legacy form that compiles to the same runtimes, so nothing is implemented twice. See §13. |

## 1. Grammar

### 1.1 Selectors

```
event-rule    = <complex-selector-list> where each subject compound contains exactly one :on()
:on()         = ':on(' trigger [ ',' modifier ]* ')'
trigger       = event-name                       e.g. click, pointerdown, input, scrollend
              | key-event '(' key-spec ')'       keydown(Escape), keyup(ctrl+k)
              | 'outside(' outside-event ')'     outside(click), outside(pointerdown), outside(focusin)
              | 'drag' | 'drag(' phase ')'       phase = start | move | end | cancel
modifier      = prevent() | stop()                 (functions; bare names and once are rejected)
blur          = <compound>:blur                          (transition marker)
focus request = focus: when(<condition>) | var(--boolean) | true | false   (the 0.6 declaration)
```

Existing selectors are unchanged: `:when()`, `:changed()`, `:nth-var()`, `:just-checked`, `:just-unchecked`. Native `:focus`, `:focus-visible` and `:focus-within` stay native. A functional `:focus(…)` is not CSS; it gets one diagnostic pointing to `focus: when(…)`. Candidates before the API cleanup had `:focus(when())`; it was removed.

**Placement rules (compile errors, reported per rule):**
- `:on()` and `:blur` must be in the **subject** (last) compound. They may not appear inside `:not()`, `:is()`, `:where()` or `:has()`.
- At most one `:on()` per complex selector.
- In a selector list, every item of an event rule must use `:on()`. Mixing `.a:on(click), .b` is an error: the second item would be an ordinary rule with mutation declarations.

**Event names.** The registry is data (`EVENT_INFO` in `src/state/on.ts`): name, whether it bubbles, whether it is cancelable, and its field category. Supported:
- pointer: `click`, `dblclick`, `contextmenu`, `pointerdown`, `pointerup`, `pointermove`, `pointerenter`, `pointerleave`, `pointercancel`;
- mouse: `mousedown`, `mouseup`, `mousemove`, `mouseenter`, `mouseleave`;
- forms: `input`, `change`, `submit`, `reset`;
- keyboard: `keydown`, `keyup`;
- focus: `focus`, `blur`, `focusin`, `focusout`;
- animation: `animationstart`, `animationend`, `animationcancel`, `transitionend`, `transitioncancel`;
- scrolling: `scroll`, `scrollend` (where supported);
- `toggle`.

An unknown name is a compile error that lists the supported names. Adding an event is one table row.

### 1.2 Declarations inside an `:on()` rule

```
mutation  = <custom-property-name> ':' action [ '!important' ]
action    = set( expr ) | toggle() | increment( expr? ) | decrement( expr? ) | cycle( value# )
```

- Any other declaration in an `:on()` rule is a compile warning and is dropped. This includes plain values (`--x: 5`), native properties and `--attr-*`. An `:on()` rule describes a moment, so `color: red` there has no meaning.
- Nested rules and at-rules inside an `:on()` rule are rejected for the same reason.
- An `:on()` rule with no declarations is valid: it may carry only modifiers (`a:on(click, prevent()) {}`).

### 1.3 State declarations

```
--name: state( initial [ ',' bind(target) ] [ ',' persist(key [ ',' local | session ]) ] )
```

- The modifiers may come in either order, each at most once.
- **`bind(value)` and `bind(checked)`:** two-way binding with the owner, which must be a form control.
- **`bind(<attribute>)`:** reflects the state into an allowlisted attribute (0.5.2), with attribute-first initialization.
- **`persist("key")`:** stores the state in localStorage (§9). `persist("key", session)` uses sessionStorage.
- **`state(attr(name, <fallback>))`:** read-only initialization from an attribute. It reads the attribute once, then never synchronizes. With a non-string fallback (`attr(aria-expanded, false)`), the attribute is parsed as that type. An invalid value falls back to the fallback. This extends 0.8.1, where the fallback had to be a string.
- **`state(bind(x))`** (a bind as the initial value) is **rejected**. "Attribute first, otherwise what?" has no deterministic answer. Write `state(false, bind(aria-expanded))`.

### 1.4 Reserved namespaces

- `--attr-<attribute>: <value>`: the attribute of the matched element, from a value (§7). It is the only custom-property namespace with DOM semantics.
- `--rcss-*`: generated by the library, never authored.

Other custom properties are plain CSS. `--disabled`, `--hidden` and `--aria-expanded` have no effect on the DOM, whatever their names.

### 1.5 Expressions (in `set()`, `increment()` and `decrement()`)

```
expr     = sum
sum      = product ( ('+' | '-') product )*      (CSS rule: + and - need whitespace around them)
product  = unary ( ('*' | '/') unary )*
unary    = '-'? primary
primary  = number | dimension | percentage | string | true | false | keyword
         | calc(expr) | min(expr#) | max(expr#) | clamp(expr, expr, expr) | round(expr [, expr]) | abs(expr)
         | var(--name [, expr]) | event(field) | mouse(x|y [, local]) | element(width|height)
         | viewport(width|height) | attr(name [, fallback]) | pick(…) | random(min, max [, by step])
         | sibling-index() | sibling-count() | '(' expr ')'
```

- **Types.** The 0.8.1 typed values: boolean, number, dimension, string and keyword. In arithmetic a boolean counts as 1 or 0, as `var(--open)` does in CSS. Dimensions convert within a unit family (`px`/`in`/`cm`…, `deg`/`turn`…, `s`/`ms`). Percentages are a separate unit.
- **Errors.** Mixing incompatible units (`px + %`, `px + em`) is an event-time error: one diagnostic and no write. The same applies to dividing by zero or comparing strings with numbers. Units that need layout (`em`, `vw`) are not resolved. Write `element()` or `viewport()` instead.
- **Validation.** Each function is checked at compile time: arity, field names, and `event()` fields against the trigger (§5).

## 2. Runtime execution model

1. **Compile (per stylesheet, once per source change).**
   - Each `:on()` rule becomes one ordinary rule per distinct (trigger, modifiers) group of its selector list. Its selector is the original with `:on(...)` replaced by `:is(*)`.
   - Each mutation becomes a declaration of a generated **slot property**, whose value is an action id. Each modifier becomes a modifier slot (§4).
   - Slot names are stable per (trigger, state) pair for the page's lifetime. A recompile reuses them, so `CSS.registerProperty` is never repeated.
2. **Watch.** One selector watcher per rule tracks candidate elements, as in 0.8.1. Membership changes come from the shared MutationObserver; there is no global rescan.
3. **Listen.** One capturing document listener per DOM event type exists while at least one rule uses that type. It is passive unless a live rule uses `prevent` for that type. Drag uses a single `pointerdown` listener while drag rules exist (§6).
4. **Dispatch (per event).**
   1. `sync()`: earlier mutations in the same frame are applied to the CSS first, so the cascade sees the latest state.
   2. Path: bubbling events use the target and its ancestors (innermost first); the others use the target only. Keyboard events use the focus path, as in 0.8.1.
   3. For each candidate element, resolve the winning action per slot (§4). With one unconditional candidate rule there is no style read; otherwise there is one `getComputedStyle` read per element.
   4. **Evaluate** every winning action against one pre-mutation snapshot, then **commit** all writes (§3).
5. **Render.** Cells write their generated property in the scheduler's next frame flush (or in `sync()` before the next event).
   - `--attr-*` and `content` bindings read in the late phase.
   - After user activation, attribute writes happen in the same task, as in 0.8.1.

There is no work at idle: no timers and no animation frames. Listeners exist only while rules need them.

## 3. State and event semantics

- **Ownership (unchanged from 0.8.1).**
  - Every element matching a `state()` declaration owns its own cell.
  - A consumer uses the nearest owner on itself or an ancestor.
  - Siblings and unrelated elements never share a cell.
- **Mutation target.** A mutation `--count: increment(1)` in a rule matched by element E changes the nearest `--count` cell on E or its ancestors. No owner means one diagnostic and no change.
- **Atomic evaluation, one transaction per DOM event.**
  1. **Evaluate.** Every winning action on the event path is evaluated against the values before the event: state values, attributes and geometry. Declaration order cannot change another declaration's input. `--a: set(var(--b)); --b: set(var(--a))` swaps the two.
  2. **Commit.** Writes apply in path order (innermost element first), and in source order within an element.
- **Same cell written twice.** If two winning actions on the path write the same cell, the later commit (the outer element) wins and is applied once. An inner and an outer `increment(1)` on one shared cell therefore give +1, not +2, and no write is ever doubled. This is a deliberate change from legacy `on:` (+2), which runs its actions one after another; legacy rules keep their old behavior.
- **Type checks.** A value that cannot be stored in the cell's type is reported once and ignored (`assignable()`, as in 0.8.1). Additions:
  - a unitless `0` can be stored in a dimension state;
  - `0` and `1` can be stored in a boolean state.
- **`toggle()`** needs a boolean cell. **`increment()` and `decrement()`** need a number or dimension; the step defaults to 1 in the cell's unit. **`cycle(a, b, …)`** moves to the next listed value, or the first when the current value is not listed.
- **Elements removed during an event.** The commit skips cells that are already disposed.

## 4. Cascade and ownership rules for events

Each (trigger, state) pair has a **slot property**, for example `--rcss-o3` for `click | --count`. Each (trigger, modifier) pair has a modifier slot, for example `--rcss-o4` for `click | prevent`. All of them are registered with `inherits: false`.

- **One winner per state, per trigger, per element.** `.button:on(click) { --count: increment(1) }` and `.primary.button:on(click) { --count: increment(2) }` set the same slot. On `.primary.button` only `increment(2)` runs, chosen by the browser's cascade: origin, importance, layers, specificity, then order. Different states never conflict: one rule's `--a` and another's `--b` both run.
- **Conditions.** `@media`, `@supports`, `@container`, `:hover` and `:when()` in the selector make a rule apply only while they hold. The runtime asks the cascade (computed slot value) whenever a candidate rule is conditional, or when several candidate rules exist for the element. With exactly one unconditional rule it skips the read; this is the 0.8.1 fast path.
- **Modifiers** (functions, API cleanup: `prevent()` and `stop()`; bare `prevent`, `stop` and `once` are compile errors with a message saying what to write).
  - `prevent()` and `stop()` are per rule. Each is optional and independent. A modifier slot is set by every rule that has the modifier. Since no rule sets it to "off", the element gets the modifier if **any** applicable rule for that trigger has it.
  - `prevent()`: calls `preventDefault()` synchronously in the capturing listener. It is allowed only for cancelable triggers: `click`, `dblclick`, `contextmenu`, `mousedown`, `pointerdown`, `keydown`, `keyup`, `submit`, and `drag` (it cancels the `pointerdown`). Otherwise it is a compile error. The 0.7 contract carries over: a form control keeps its own keys unless it carries the rule itself, and a non-cancelable event gives one diagnostic.
  - `stop()`: Reactive CSS rules on the element's ancestors do not run for this event. The event's native propagation also stops at that element: a one-shot listener on the element calls `stopPropagation()` (never `stopImmediatePropagation()`) when the event reaches it. The event still reaches the element itself and its descendants' listeners, as `stopPropagation()` in an element listener would allow. It never stops the event in the capture phase.
  - **No `once`.** Removed in the API cleanup, with its per-element registration records. For a one-time change, guard the rule with a state: `.b:when(not --done):on(click) { --done: set(true); … }`. Legacy `on:` keeps its 0.8 behavior.
- **Dynamic selector matches.** Candidate membership follows class, id and attribute changes through the element manager, as for every other rule.

## 5. `event()`: field catalog

`event(field)` is valid only inside an action of an `:on()` rule. Anywhere else it is a compile error: there is no event there. Each field belongs to a category, and the trigger decides which categories are available. A field outside them is a compile error that names the fields allowed for that trigger.

| Field | Type | Categories | Meaning |
|---|---|---|---|
| `type` | string | all | DOM event type (`drag` for drag phases) |
| `client-x`, `client-y` | px | pointer, drag | Viewport coordinates |
| `page-x`, `page-y` | px | pointer, drag | Document coordinates |
| `local-x`, `local-y` | px | pointer, drag | Relative to the border box of the **element matched by the rule**. For drag, its box at drag start (no layout read per move). |
| `button`, `buttons` | number | pointer, drag | As in MouseEvent |
| `pointer-id`, `pressure` | number | pointer events, drag | As in PointerEvent. Mouse events have neither. |
| `pointer-type` | string | pointer events, drag | `mouse`, `pen` or `touch` |
| `alt-key`, `ctrl-key`, `shift-key`, `meta-key` | boolean | pointer, keyboard, drag | Modifier keys |
| `key`, `code` | string | keyboard | As in KeyboardEvent |
| `repeat` | boolean | keyboard | Auto-repeat |
| `value` | string | form (`input`, `change`) | The value of `event.target`, which must be an input, select or textarea. Password, one-time-code and payment fields give `""`. |
| `value-as-number` | number | form | No value (no write) when it is not a number |
| `checked` | boolean | form | Of `event.target` |
| `x`, `y` | like the target state | drag | **Proposed position:** the value of the **mutated state** at drag start, plus the total pointer distance on that axis |
| `delta-x`, `delta-y` | px | drag | Total distance since the drag start |
| `movement-x`, `movement-y` | px | drag | Distance since the previous drag event |
| `start-x`, `start-y` | px | drag | Viewport coordinates of the `pointerdown` |
| `scroll-top`, `scroll-left` | px | scroll | Scroll offset of the element matched by the rule |

**Elements involved, defined once:**
- `event.target`: where the event happened (`value` and `checked` read it);
- **the rule element**: the element on the path matched by the `:on()` rule (local coordinates, `attr()`, `sibling-index()`, `element()`);
- **the state owner**: the nearest owner of the mutated state;
- `event.currentTarget` is not exposed: it is always the document.

**Existing functions at event time.** Inside an action, `mouse()`, `element()`, `viewport()`, `attr()`, `pick()` and `random()` are **evaluated once, at the event**: they are snapshots, not subscriptions.
- `mouse(x|y)` is the event's client coordinate. `mouse(x, local)` is `event(local-x)`. It is allowed only with pointer and drag triggers.
- `element(width|height)` is the rule element's border-box size (`offsetWidth`/`offsetHeight` for HTML elements, `getBBox()` for SVG).
- `viewport(width|height)` is `innerWidth`/`innerHeight` in px.
- `random(min, max [, by step])` is rolled per evaluation.

Outside actions these functions keep their 0.8.1 live behavior.

## 6. Drag gestures

`:on(drag)` is the same as `:on(drag(move))`. The phases are `start`, `move`, `end` and `cancel`. One engine (`src/state/gesture.ts`) drives every form.

- **Arming.**
  - One capturing, passive `pointerdown` listener exists while drag rules exist. It is non-passive if any live drag rule has `prevent()`.
  - A pointerdown arms a gesture on the innermost candidate element on the path where a drag rule applies.
  - It must be the primary button (mouse button 0). The element must not be `:disabled` or inside `[inert]`, and must not already be dragged.
  - The engine records the start point and the element's border box.
- **Start threshold.** 3 CSS px of movement. Below it, the pointerdown and click behave natively and no drag phase fires.
- **Active gesture.**
  - Listeners for `pointermove`, `pointerup`, `pointercancel` and `lostpointercapture` are added on the document for the gesture's pointer only. Other pointers' events are ignored.
  - `setPointerCapture()` keeps moves arriving outside the element.
  - Each move fires `drag(move)` synchronously. State changes are coalesced into one style write per frame by the scheduler, and the final position is never dropped.
- **End.** `pointerup` fires `end`. `pointercancel` or a lost capture fires `cancel`, then `end`, so `--dragging: set(false)` in `drag(end)` always runs.
- **Cleanup.**
  - Capture is released and listeners are removed when the last gesture ends.
  - Gesture state is per pointer. Concurrent pointers drag different elements independently. A second pointer on an element that is already dragged is ignored.
- **Presses in fields** (hardening): a `pointerdown` on an `input`, `textarea`, `select` or editable element *inside* the drag element never starts a drag, so selecting text and moving sliders keep working. Buttons and links inside may start a drag; after one, pointer capture keeps their native click from firing.
- **Reparenting** (hardening, measured): moving the element to another parent during a drag removes it from the document for a moment. The browser releases pointer capture, so the gesture is cancelled: `cancel`, then `end`.
- **Element removed or no longer matching.** The gesture stops without firing any phase. The element's rules are gone, so there is nothing to run. An ancestor state set in `drag(start)` keeps its value; this is documented.
- **Click after a drag.** The click that follows a drag of more than the threshold does not run `:on(click)` rules on that element or its ancestors. The native click is untouched.
- **`stop()`** ends every gesture and removes every listener.

**Stable positioning.** `event(x)` is "the mutated state at drag start plus the drag distance". `.card:on(drag) { --x: set(event(x)) }` therefore continues from where the card was, over any number of drags. It never jumps back to the pointer's start coordinates. Use `event(delta-x)` for raw displacement.

**Not included:** native HTML Drag and Drop (`dragstart`/`drop`), sortable lists and drop targets.

**Accessibility:** a drag has no keyboard equivalent by itself. Every drag fixture pairs it with `:on(keydown(ArrowRight))` or a native range input.

## 7. DOM integration

| Construct | Direction | Initialization | Owner |
|---|---|---|---|
| `state(v, bind(value))`, `state(v, bind(checked))` | two-way (control ⇄ state) | persisted value, else the control when the user or the browser edited it (autofill, restored form), else `v` | the control is the state owner |
| `bind: --x` (kept) | two-way, control ⇄ **ancestor** state | state first, as in 0.3 | for radio groups and shared state |
| `state(v, bind(attr))` | one-way state → attribute, attribute-first initialization | persisted value, else a valid attribute value, else `v` | the state's owner |
| `state(attr(name, fallback))` | read once | the attribute, else the fallback | none: no synchronization |
| `--attr-<name>: <value>` | one-way value → attribute of the matched element | the attribute before the first write is restored when no declaration applies | the matched element. A `state(…, bind(name))` on the same element owns that attribute, and `--attr-name` is ignored with a diagnostic. |

**`--attr-*`.**
- **Name mapping.** `--attr-aria-expanded` writes `aria-expanded`. Custom property names are case-sensitive, so the suffix must be lower-case. An upper-case suffix is a diagnostic and nothing is written.
- **Allowlist.** It extends 0.8.1's with `aria-hidden`, `aria-busy`, `aria-checked` (`true`/`false`/`mixed`), `aria-invalid`, `aria-label`, `aria-valuenow` and `aria-valuetext`. Event handlers (`on*`), URL attributes (`href`, `src`, `action`, `formaction`, `srcset`, `xlink:href`), `style`, `id`, `class`, `name` and `value` are never writable.
- **Values.**
  - HTML boolean attributes: `true` sets the attribute, `false` removes it.
  - ARIA booleans: `"true"` or `"false"`.
  - `data-*`, `aria-label` and `aria-valuetext`: any text.
  - A missing or empty winning value restores the original attribute.
- **Writes.** They are batched in the late phase and skipped when the attribute already holds the value. No other attribute is touched.

**Loops are impossible:**
- written attributes never re-match watchers (`ownedAttributes`);
- attributes never feed state, except once at initialization.

## 8. DOM text through `content`

A `content` declaration is reactive only if all of these hold:
1. the rule targets elements: no selector in its list has a pseudo-element;
2. its value reads state: it contains `var()`, `when()`, `previous()` or `direction()`;
3. its value contains no image: no `url()`, `image-set()`, gradient or `attr()`;
4. the stylesheet is trusted, as for `text:`.

Every other `content` declaration is plain CSS and is left alone: `::before { content: var(--n) }`, `content: "x"`, and `content: url(a.png)` on an element.

**Compilation.** The declaration is **kept as written**, and `--rcss-text: <same value>` is added next to it. The native property keeps its native meaning. On elements, string and number values render nothing in Chromium 156 and WebKit 27.2: measured, see §0. The text binding is the 0.5.1 `text:` runtime:
- it writes one Text node, never markup;
- it writes only into an element that is empty or holds one text node; an element with children is never emptied, and a diagnostic is given instead;
- it yields to foreign changes;
- it restores the original text when no declaration applies;
- a value that computes to an image (`var()` resolving to `url()`) is silently left to the browser.

## 9. Persistence: `persist()`

- **Syntax.** `persist("key")` uses localStorage; `persist("key", session)` uses sessionStorage. The key is a quoted string, 1 to 64 characters from `[A-Za-z0-9_.:-]`. The stored key is `rcss:<key>`.
- **Initialization precedence:**
  1. a valid persisted value;
  2. the DOM source (`bind()`: a valid attribute, or an edited control);
  3. the declared initial value.

  The persisted value is then written to a bound attribute or control.
- **Validation.** The stored format is `{"t":type,"v":value,"u":unit}`. A stored value is used only if it can be stored in the declared type (`assignable()`). Keyword values must be identifiers or `#hex` colors, so stored text can never become `url()` or extra declarations. Anything else is ignored, with one note.
- **Writes.**
  - Each change schedules a write. Writes are coalesced per key: at most one `setItem` every 250 ms, and the last value always wins.
  - Pending writes are flushed on `visibilitychange` to hidden and on `pagehide`.
  - A drag that updates a persisted position performs about 4 writes per second, not 60.
- **Shared keys.**
  - All cells with the same key and storage share one value: a change in one is applied to the others in the same page.
  - localStorage keys also follow other tabs through the `storage` event. The event's value is validated as above, and applying it does not write back.
- **Failures.** Storage that is unavailable (sandboxed iframe, privacy mode), quota errors and parse errors give one note. The state keeps working as a non-persisted state.
- **Never stored automatically:**
  - only declared states are persisted; there is no DOM scraping;
  - a state bound to a password, one-time-code or payment field is never persisted (one diagnostic).
- **Lifecycle.** A cell leaves the key's group when it is disposed. Storage is never cleared by the library.

## 10. Focus and blur

- **`focus: when(<condition>)`** (the 0.6 declaration, the only focus request in 0.9) moves focus to the element when its value goes from false to true. The API cleanup removed the candidate's `:focus(when())`; it duplicated this runtime.
  - The 0.6 guarantees apply unchanged:
    - the first evaluation never focuses;
    - requests are armed only by state changes made during trusted user activation (`click`, `keydown`, `input`, `change`, and in 0.9 also `pointerup`, `submit` and drag `end`);
    - targets must be focusable, rendered, not disabled and not inert;
    - an open dialog or popover keeps its own focus;
    - the deferral after Enter and printable keys carries over;
    - the library never adds `tabindex`.
  - `when()` comes from the `conditions` feature (the analyzer adds it); `focus: var(--open)` needs only `focus`.
  - It is a declaration, so it is not an empty rule and survives minifiers (§11b).
- **`<compound>:blur`** matches an element from a genuine focus loss (its own `blur` event) until it is focused again. It never matches an element that has never been focused.
  - **Retrigger:** focus removes the marker and the next blur sets it again, so `animation: shake 250ms` plays once per blur.
  - **Rapid focus and blur:** each pair toggles the marker; the last event wins.
  - **Nested elements:** only the element that lost focus matches; use `:has(:blur)` for containers. A bare `:blur` (no type, class or attribute, as inside `:has()`) is supported since the hardening pass: any element that loses focus gets the marker while such a rule exists.
  - **Removal:** the marker goes with the element.
  - **Cleanup:** the marker attribute is removed when the last `:blur` rule goes away.
  - `:blur(when(...))`, `:just-focused` and `:just-blurred` do not exist.

## 11. Native CSS compatibility

- **Additive by construction.** A sheet without Reactive syntax is never tokenized (the pre-filter). Reactive sheets are rewritten with splices around the reactive parts only. Every other token passes through byte for byte.
- **Native `random()`** (revised in the hardening pass, against the CSS Values 5 Editor's Draft of 4 September 2026 and Chromium 156 / WebKit 27.2, which implement it):
  - **Native syntax** is `random(<random-key>?, min, max, step?)`. The step is a plain third value. Keys are `auto`, `--name`, `element-scoped`, `property-scoped` and `fixed <n>`. Both engines also reject the earlier draft's `by <step>` and `element-shared`.
  - **Left to the browser:**
    - a top-level call the browser supports as written, when it gives per-element values (the two-element probe), whatever its units or step;
    - any call with a native-only key (`--name`, `element-scoped`, `property-scoped`, `fixed`) that the browser supports. These are not claimed at all: no diagnostic, no binding.
  - **Reactive CSS runtime:**
    - `by <step>` and `element-shared`, its own syntax kept from the earlier draft;
    - calls nested in `live()` or `on()`;
    - calls inside mutations, rolled at each event; `random(min, max, step)` and `random(min, max, by step)` both work there;
    - any call the browser cannot evaluate: the polyfill, which follows the 2026 draft for the plain step, ignoring a zero or negative step and giving min when max < min.
  - **Native-only keys without native support** get one diagnostic. They are never guessed.
  - **Known semantic difference:** a custom property `--r: random(...)` handled natively keeps the call as token text. Each `var(--r)` user rolls its own value. The polyfill gives one value per declaring element, which descendants inherit. This is the same choice as 0.8.1.
- **Native `if()`:** the 0.8.0 rules apply.
- **Untouched:** `calc()`, `clamp()`, `min()`, `max()`, `:has()`, `:is()`, `:not()`, `:checked`, `:focus`, `:focus-visible`, transitions, `@starting-style`, `<dialog>`, `popover` and form behavior. These names are evaluated by Reactive CSS only inside an action expression.

## 11b. Build pipelines and minifiers (hardening finding)

An `:on()` rule with only modifiers (`a:on(click, prevent()) {}`) is an empty rule. (`focus: when()` is a declaration, so focus requests are not affected.) Minifiers that remove empty rules delete them silently. Measured:
- esbuild with `minify` or `minifySyntax`;
- csso;
- lightningcss.

Rules with declarations survive all three, and whitespace-only minification (esbuild `minifyWhitespace`) keeps everything. **Integration requirement:** stylesheets with Reactive CSS must not go through empty-rule removal; minify them for whitespace only. There is no in-language workaround in 0.9, and none is added: a new construct would be a new API. The runtime cannot detect a rule that was removed before it loads.

## 11c. Production diagnostics (hardening)

- **Production bundles** (`reactive-css.min.js`, the compact bundle, minified custom bundles) carry stable codes instead of message text: `RCSS-<area><nnn>⟦value⟧…`. The values interpolated into the message stay.
- **Development bundles** keep the full text.
- **Codes** are append-only, in `src/core/diagnostics.json`.
- **Lookup:** `dist/diagnostics.json`, and `reactive-css explain "<message>"` (offline, no esbuild needed).
- **Size:** about 10 KB minified and 4 KB gzip of the full bundle.
- **Code may not read or slice diagnostic text.** The pass found and fixed two places that did.

## 12. Module dependency graph

| Feature | Provides (new in 0.9 in bold) | Requires |
|---|---|---|
| core | `state()`; **`state(attr(name, typed fallback))`**; the action evaluator's literal and `var()` core; **`--attr-*` and `content` recognition (compile time)** | none |
| events | `on:`, **`:on()`, every trigger and modifier, `set/toggle/increment/decrement/cycle` as mutations, `event()`, event-time `mouse/element/viewport/random/pick/attr`** | core |
| gestures (**new**) | **`:on(drag…)`, drag fields of `event()`** | core, events |
| persist (**new**) | **`persist()`** | core |
| forms | `bind:`, **`state(…, bind(value/checked))`**, `:just-checked`, `:just-unchecked` | core |
| attributes | `attr:`, **`--attr-*`**, `state(…, bind(attribute))` | core |
| text | `text:`, **reactive `content`** | core |
| focus | `focus:` (0.6, the 0.9 focus API) | core, events (conditions for `when()`) |
| blur (**new**) | **`:blur`** | core |
| conditions, nth-var, history, values, dynamic, geometry | unchanged | core |

- `blur` needs no form code, and `focus` needs no form code.
- `persist` needs neither forms nor events.
- `gestures` is the only module that contains pointer-gesture code.

The parser reports syntax whose feature is left out of a custom bundle ("… is not included in this bundle (feature "gestures") …"), as in 0.8.0.

## 13. Migration strategy (summary; full map in migration-0.9.md)

| 0.8.1 | 0.9.0 | Equivalent? |
|---|---|---|
| `.b { on: click(toggle(--open)) }` | `.b:on(click) { --open: toggle() }` | Yes, except that several actions on one shared cell per event are now a transaction (§3) |
| `on: key(Escape, set(--open, false))` | `:on(keydown(Escape)) { --open: set(false) }` | Yes |
| `on: outside(click, set(--open, false))` | `:on(outside(click)) { --open: set(false) }` | Yes |
| `on: click(prevent(), …)` | `:on(click, prevent()) { … }` | Yes, plus more cancelable triggers |
| `set(--x, v, closest(.scope))` | none (the nearest owner is used) | **No.** Keep `on:` for explicit scopes |
| `input { --name: state(""); bind: --name }` | `input { --name: state("", bind(value)) }` | Yes |
| radio group: `fieldset { --size: state("m") } input { bind: --size }` | unchanged: `bind:` stays the way to bind controls to an **ancestor's** state | `bind:` is not deprecated |
| `text: var(--n)` | `content: var(--n)` | Yes, under the eligibility rules (§8) |
| `attr: aria-expanded var(--open)` | `--attr-aria-expanded: var(--open)` | Yes |
| `.x:when(--open) { focus: true }` | `.x { focus: when(--open) }` (unchanged API) | Yes |

**Decision.** In 0.9.0 the legacy declarations `on:`, `text:` and `attr:` keep working, and `focus:` is the current focus API (API cleanup). They compile to the same runtimes, so there are **no duplicate implementations**: the legacy path is about 2 KB of parser branches. The analyzer (`reactive-css analyze`) lists legacy syntax per file with its 0.9 form, so a project can migrate before a future major version removes them. The runtime prints nothing about them, because pages that work must not get console noise.

## 14. Known constraints and rejected alternatives

- **Rejected: a native implementation of `--count: calc(var(--count) + 1)`.** It is a cyclic custom property, invalid at computed-value time in every browser. Self-reference is evaluated by the action evaluator against a snapshot.
- **Rejected: running every matching `:on()` rule** (the event-listener model). It would contradict CSS reading and double-run overrides. One winner per (trigger, state, element) is the cascade's answer.
- **Rejected: `drag(x)`.** `event(x)` already covers it.
- **Rejected: treating every `content:` as text.** It would break images, pseudo-elements and native generated content.
- **Rejected: `state(bind(attr))` without an initial value** (§1.3).
- **Rejected: deprecating `bind:`.** Radio groups need a control bound to an ancestor's state; `state(…, bind(value))` binds the owner itself.
- **Constraint: units that need layout** (`em`, `vw`, `%` of something) are not resolved in expressions.
- **Constraint: `@container` conditions** are evaluated by the cascade read, so a conditional rule costs one computed-style read per event on its element.
- **Constraint: events in shadow roots.** The engine processes document stylesheets only, so shadow-root rules are not compiled. `composedPath()` gives the correct order where shadow hosts take part.

## 15. Performance risks and test plan

| Risk | Mitigation | Measured by |
|---|---|---|
| Cascade reads on each event | Fast path without a read for a single unconditional candidate; one read per element otherwise | event latency benchmark: 1 vs 5 competing rules |
| `pointermove` at 120 Hz | No layout read per event (local coordinates from the cached drag-start box); writes coalesced per frame | drag benchmark: scripting ms/s, long tasks |
| Many draggable candidates | One `pointerdown` listener; nothing per element; move listeners only during a gesture | 1 drag among 1,000 candidates |
| Storage writes | Coalesced to at most 4 per second per key | persistence benchmark: `setItem` count over a 2-second drag |
| Startup with many rules | One compile per sheet; slot names reused | startup at 100, 1,000, 5,000 and 10,000 elements, v0.8.1 vs v0.9.0 |
| Idle | No timers or frames when quiet | 10-second idle trace |
| Leaks | WeakMaps keyed by element; explicit cleanup on stop | mount/unmount × N heap, drag × N, stop/start × N |

Tests:
- **Unit:** grammar tables and validation messages for every construct, the evaluator, persistence serialization, slot naming, and the analyzer.
- **Browser:** the 25 integration components in Chromium and WebKit, plus lifecycle, CSP, CodePen-style and storage-failure cases. Firefox is reported separately: this Playwright Firefox does not launch here.
- **Benchmarks:** `benchmarks/v090/compare.mjs` runs both frozen bundles, `benchmarks/baseline/v0.8.1/` and `dist/`, with the same pages, browser and method.
