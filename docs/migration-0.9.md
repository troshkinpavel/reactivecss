# Migrating to the 0.9 syntax

0.9.0 adds a new way to write behavior: event rules with `:on()`, mutations on the state's own custom property, `--attr-*` and `content`. Focus requests keep the 0.6 declaration `focus: when(…)`.

**The 0.8 syntax keeps working in 0.9.** It compiles to the same runtimes, so a page that works on 0.8.1 works on 0.9.0 unchanged. There is one exception, listed below: custom properties named `--attr-*`.

Migrate when convenient. `reactive-css analyze <files>` lists the 0.8 declarations in each file, with their 0.9 form.

The design and the exact semantics are in [rfc-v0.9.0-language.md](rfc-v0.9.0-language.md).

## Quick map

| 0.8 | 0.9 |
|---|---|
| `.b { on: click(toggle(--open)) }` | `.b:on(click) { --open: toggle(); }` |
| `.b { on: click(increment(--n, 2)) }` | `.b:on(click) { --n: increment(2); }` |
| `.b { on: click(set(--x, 5)) }` | `.b:on(click) { --x: set(5); }` |
| `.b { on: click(cycle(--m, a, b, c)) }` | `.b:on(click) { --m: cycle(a, b, c); }` |
| `.d { on: key(Escape, set(--open, false)) }` | `.d:on(keydown(Escape)) { --open: set(false); }` |
| `.m { on: outside(click, set(--open, false)) }` | `.m:on(outside(click)) { --open: set(false); }` |
| `a { on: click(prevent(), set(--asked, true)) }` | `a:on(click, prevent()) { --asked: set(true); }` |
| `.b { on: click(a(), b()), key(Enter, c()) }` | one `:on()` rule per trigger |
| `input { --q: state(""); bind: --q; }` | `input { --q: state("", bind(value)); }` |
| `input[type=checkbox] { --on: state(false); bind: --on; }` | `input[type=checkbox] { --on: state(false, bind(checked)); }` |
| `.v { text: var(--n); }` | `.v { content: var(--n); }` |
| `.b { attr: aria-expanded var(--open); }` | `.b { --attr-aria-expanded: var(--open); }` |
| `.x:when(--open) { focus: true; } .x { focus: false; }` | `.x { focus: when(--open); }` (`focus:` is the 0.9 focus API) |

## Differences to know

**Several mutations of one state in one event are one transaction.**
- **Before:** in 0.8, `on:` runs each action in turn. An inner and an outer `increment(--n)` for the same cell gave +2.
- **Now:** in 0.9 every mutation reads the values before the event, and the outermost write wins. The same two rules give +1, and `--a: set(var(--b)); --b: set(var(--a))` swaps.
- **Legacy rules:** `on:` rules keep the 0.8 behavior.

**One mutation per state per element.**
- **Before:** in 0.8 the cascade picked one `on:` declaration per element, so different actions in different rules replaced each other.
- **Now:** in 0.9 it picks one mutation **per state**. `.b:on(click) { --a: … }` and `.b.x:on(click) { --b: … }` both run, and two rules for `--a` give one winner.

**Explicit owners (`closest()`) have no 0.9 form.**
- `set(--x, v, closest(.scope))` stays in `on:`. In 0.9 a mutation changes the nearest owner of the state.

**`bind:` is not replaced for ancestor state.**
- `state(…, bind(value))` binds the control to its **own** state.
- A radio group, or any control that writes an ancestor's state, keeps `bind: --state`.
- A one-way alternative: `input:on(input) { --q: set(event(value)); }` with the state on an ancestor.

**`content` is DOM text only under conditions.**
- The value must read state (`var()`, `when()`, `previous()`, `direction()`).
- The rule must target elements, not `::before` or `::after`.
- The value must contain no image or `attr()`.
- Everything else stays native `content`. `text:` accepts literal strings; `content: "x"` stays native.

**`--attr-*` is reserved (the one possible break).**
- A custom property named `--attr-<name>` now writes that attribute when `<name>` is allowlisted (`aria-*` states, `disabled`, `hidden`, `required`, `tabindex`, `data-*`).
- Other `--attr-*` names give a diagnostic and stay plain custom properties.
- Rename any existing `--attr-*` custom property that is not meant as an attribute.

**`focus:` is the focus API.**
- `focus: when(--open)` requests focus when the condition becomes true. `:focus(when(…))`, which appeared only in unpublished 0.9 candidates, was removed and is reported.
- `:focus`, `:focus-visible` and `:focus-within` are untouched.

**Event-time values.**
- Inside a mutation, `mouse()`, `element()`, `viewport()`, `random()`, `pick()` and `attr()` are read once, at the event.
- Outside mutations they keep their 0.8 live behavior.
- `event(field)` exists only inside mutations.

**Also new in 0.9 (no 0.8 equivalent):**
- `:on(drag)`, with the phases `drag(start)`, `drag(move)`, `drag(end)` and `drag(cancel)`;
- `persist("key" [, session])` in `state()`;
- `:blur`;
- `:on(…, stop())`;
- `:on(submit, prevent())`;
- `keyup(Key)`;
- `pointerdown`, `pointermove`, `scroll` and more events;
- `calc()`, `min()`, `max()`, `clamp()`, `round()` and `var()` in mutations;
- typed `attr(name, fallback)` in `state()`.

## Production builds and tools

- **Diagnostics in production bundles are codes:** `RCSS-P012⟦…⟧`. Decode them offline with `npx -p @reactivecss/core reactive-css explain "<message>"`, or load `reactive-css.js` for full text.
- **Do not remove empty rules** from stylesheets with Reactive CSS. `a:on(click, prevent()) {}` (an event rule with only modifiers) is empty on purpose. esbuild (`minify`), csso and lightningcss delete such rules. Use whitespace-only minification for these sheets.
- **Native `random()`:** the current draft writes the step as a plain third value, `random(0px, 100px, 10px)`. Browsers that support it handle it natively; others get the Reactive CSS polyfill. `by 10px` keeps working.

## Bundles

| Construct | Feature |
|---|---|
| `:on()`, `event()`, mutations | `events` |
| drag | `gestures` (pulls `events`) |
| `persist()` | `persist` |
| `:blur` | `blur` |
| `bind(value \| checked)` | `forms` |
| `--attr-*` | `attributes` |
| `content` | `text` |
| `focus: when()` | `focus` (and `conditions` for `when()`) |

`reactive-css analyze` detects all of them. A custom bundle without the needed feature reports the syntax once ("… is not included in this bundle (feature "gestures")").
