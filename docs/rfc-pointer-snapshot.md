# RFC: `set(--x, mouse(x))`, the pointer position of an event (unreleased)

Status: **decided, implemented (unreleased, after 0.8.0).** Feature: `events` (usage key `expr:mouse`).

## 1. Problem

A context menu, a marker or a ripple must appear where the user clicked. In 0.8.0 nothing can store that position:
- `set(--x, mouse(x))` and `set(--x, var(--y))` are compile errors: `set()` takes a literal, `attr()`, `pick()`, `sibling-index()` or `sibling-count()`.
- `--x: on(click, mouse(x))` re-evaluates on the click, but `mouse()` stays a live source: the value keeps following the pointer after the click.

## 2. Syntax

`mouse()` with the same arguments as the live source, as the value of `set()`:

```css
.area {
  --menu-x: state(0px); --menu-y: state(0px);
  on: click(set(--menu-x, mouse(x, local)), set(--menu-y, mouse(y, local)));
}
```

- `mouse(x)` / `mouse(y)`: the event's `clientX` / `clientY` (viewport coordinates).
- `mouse(x, local)` / `mouse(y, local)`: the same point measured from the top-left corner of the border box of **the element with the `on:` declaration**. This is the definition the live `mouse(…, local)` uses (`src/functions/sources.ts`), so a value stored on click and a value that follows the pointer agree. The box is read once, at event time.
- `viewport` may be written explicitly, as for the live source.

It is a one-time snapshot of **the triggering event**: it does not subscribe to `pointermove`, it does not follow the pointer, and it does not need the `dynamic` feature. The live `mouse()` and the snapshot share only the name and the coordinate definition.

## 3. Triggers

Allowed where the event carries a pointer position: `click(…)`, `pointerenter(…)`, `pointerleave(…)`, `outside(click, …)` and `outside(pointerdown, …)`. Everywhere else (`key()`, `change`, `input`, focus, animation, transition, `reset`, `outside(focusin)`) it is a compile error, so the declaration is reported and dropped like any other invalid `on:`.

`pointerdown`, `pointerup` and `contextmenu` are not `on:` triggers in 0.8.0. Adding `contextmenu` is a separate decision: a custom context menu also needs `prevent()` for `contextmenu`, which `rfc-prevent-action-0.7.md` does not allow today.

**Keyboard-activated clicks.** Enter or Space on a button and `element.click()` have `event.detail === 0` and no pointer position (`clientX`/`clientY` are 0 or meaningless). For a `click` with `detail === 0`, the value is **the center of the element with the `on:` declaration** (in viewport or local coordinates). Reasons:
- a keyboard user gets the same result in a sensible place (a menu opens over the control they activated), instead of a menu at the page corner or at the last mouse position;
- the rest of the declaration (`set(--open, true)`) runs either way, so skipping only the position would leave the menu at a stale place;
- it needs no warning: it is the documented behavior, not an error.

## 4. Unit and type

- The value is a dimension in `px`, unrounded (the cascade formats it).
- It goes through the normal `set()` type check. The state must be a length state: `state(0px)` stores it as is; another absolute length (`state(0in)`) gets the converted value; a number, a string, a keyword or a relative unit (`state(0rem)`, `state(0%)`) gets the usual warning ("`--x` holds a number; the value is ignored") and does not change.

## 5. What stays an error

`set(--x, var(--y))` stays an error. Copying a state into another one is a different feature (which value: the owner's state or the computed custom property? when is it read? what about cycles?) and does not follow from this one. `mouse()` inside `pick()`, in `state(…)`, or with other arguments (`mouse(z)`, `mouse(x, page)`) is an error too.

## 6. Trust model

Nothing new is evaluated: the grammar is fixed (`mouse`, an axis, an optional mode), and the value is a number read from the event and the element's box. `on:` still exists only in trusted stylesheets.

## 7. Tests

- Unit (`tests/unit/pointer-snapshot.test.ts`): accepted forms and triggers, rejected forms and triggers, the `expr:mouse` usage key and its catalog feature.
- Browser (`tests/browser/pointer-snapshot.spec.ts`, Chromium and WebKit, strict CSP): real mouse clicks in viewport and local mode, the value stays after the pointer moves, a keyboard-activated click gives the center, `outside(pointerdown)`, a mismatched state is reported and unchanged.
- API example 17, `examples/api/context-menu/`, in `tests/browser/api-examples.spec.ts` (full runtime and analyzer-chosen bundle).
