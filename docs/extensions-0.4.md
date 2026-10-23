# Extensions in 0.4: architecture and new functions

## Extension contracts

A new reactive function is **one definition object, one evaluator or native transformer, optional subscriptions, tests, and one registry entry**. The parser, scheduler and element manager do not change. All examples below are real implementations in `src/`.

### What an extension registers

| Contract | Where | Used by |
|---|---|---|
| `defineFunction(FunctionDef)` | `src/core/registry.ts` | every value function |
| `defineSelector(SelectorDef)` | same | `:nth-var()`, `:when()`, `:changed()`, `:just-*` |
| `defineAction(ActionDef)` | same | `set()`, `toggle()`, `increment()`, `decrement()`, `cycle()` |
| Registry entry (`Feature`) | `src/core/features.ts` | `describe()`, docs, validation, future MCP tools. A unit test fails if a shipped definition has no entry, or an entry claims a feature that is not registered. |

`FunctionDef` fields (all optional except `name` and `kind`):

| Field | Purpose | Example |
|---|---|---|
| `matches(argText)` | **Context-aware claim** (0.4): return `false` to leave a call to the browser | `element()` declines `element(#id)` |
| `rawArgs` | Argument positions kept as text (own grammar) | `when()` condition |
| `compile(args)` | Validate and pre-parse **once per call site**; throw to reject (the declaration stays unchanged, and the warning names the stylesheet) | `wave()` builds its shared keyframes here |
| `native(args, data, nested)` | Return plain CSS to skip the runtime entirely | `viewport()`, `random()`, `when()` → `if()` |
| `shared(data)` | Return a `SharedSource` when the value is the same for every element | `mouse(x)` |
| `create(ctx, args, data)` | Per-element `Instance` `{ get, reset?, dispose? }` | everything with runtime state |

Runtime services an extension may depend on:

| Service | Contract |
|---|---|
| `ctx.notify()` | Re-evaluate this binding; the scheduler coalesces it into one read/write pass per frame |
| `every(ms, sub)` / `unevery()` | Shared interval groups |
| `frame(fn)` | Run at the start of the next frame flush |
| `dirty(job)` / `settleLater(job)` / `urgently(fn)` | Custom jobs (selectors), first-value settling, the user-input lane |
| `StateRef` | Lazy, re-resolving link to the nearest state cell |
| `warn(msg)` | Diagnostics (prefixed with the stylesheet while compiling) |
| `runtimeStats` | Count subscriptions and observers so tests can prove cleanup |

**Releasing resources.** `Instance.dispose()` runs when the element stops matching, when it is removed, or when the stylesheet goes away. Shared resources are reference-counted by the extension: the last `dispose()` disconnects the shared `ResizeObserver` or `IntersectionObserver`, or removes the listener. The lifecycle tests check that `stats()` returns to zero, and a heap-snapshot test checks that no detached elements are retained.

**Declaring native fallbacks.** Detect behavior once at compile time (not per element), return CSS from `native()` when the engine is equivalent, and otherwise return `undefined` to use `create()`. Examples: `random()` confirms per-element semantics with a probe, and `when()` feature-tests a compound `if()`.

**Metadata.** The registry entry gives name, kind, category (native / simplify / extend / evaluate), status (stable / experimental / planned / rejected), syntax, parameters (type, default), return type, evaluation strategy, native equivalent, required browser support, cleanup behavior, description, examples, and for non-shipped entries a reason. `ReactiveCSS.describe()` returns all of it as data.

**Not built:** a third-party plugin loader. The `define*` functions are exported from the ESM build as internal extension points; they are not a stable public plugin API yet.

## `element(width | height)` (experimental)

| | |
|---|---|
| Purpose | Read an element's own measured size into CSS |
| Syntax | `element(width)`, `element(height)` |
| Returns | `<length>` in px: the **border-box** size, physical width and height (correct in vertical writing modes). No value (`unset`) until the first measurement, which the browser delivers before the first paint. `display: none` measures `0px`. |
| Updates | When the size changes (`ResizeObserver`), at most once per frame |
| Native | None for an element's own size. Container query units (`cqw`) measure a *container* for its descendants, and `anchor-size()` measures an anchor. Prefer those when they fit. |
| Cleanup | Unobserved on removal; the shared observer disconnects when unused |
| Limitations | Context-aware: `element(#id)` (CSS Images 4) is left to the browser. Writes happen in the next frame (one frame of lag; less layout than writing inside the observer callback). |

```css
.card { --w: element(width); }
.card .title { font-size: clamp(14px, calc(var(--w) / 18), 32px); }
.card .meter { counter-reset: w calc(var(--w) / 1px); }  /* print it */
```

**Feedback loops.** `width: calc(element(width) + 10px)` would grow forever. When a size changes in the same direction for 30 consecutive frames, each right after its own value was written, writes pause for two frames. If the size keeps changing anyway, something else drives it (a transition, a drag) and updates resume. If it stops, it was a loop: the value is frozen and a warning names the element. Tested both ways: a loop is stopped, and a 1.5 s width transition is not.

**Performance** (Chromium 156, container resized every frame, every element re-measured, compared with one hand-written `ResizeObserver` writing the same property):

| n | script ms/s (vs plain) | layout ms/s (vs plain) | p95 frame | start |
|---:|---|---|---|---|
| 10 | 7.2 (5.1) | 4.7 (7.7) | 16.7 ms | 1.5 ms |
| 100 | 18.5 (12.9) | 19.2 (31.8) | 16.7 ms | 1.8 ms |
| 1,000 | 43.4 (31.2) | 48.9 (78.9) | 16.8 ms | 3.7 ms |
| 10,000 | 190 (120) | 201 (312) | 33.4 ms (plain 33.4) | 23.3 ms |

## `wave(min, max, duration)` (experimental in 0.4, **removed in 0.5**)

> Removed before beta: a convenience over native `@property` + `@keyframes` at a measured main-thread style cost (171–181 ms/s per 1,000 animated elements, where a composited `@keyframes translate` costs 0). The section below documents the 0.4 design. Native replacement: `@property --y { syntax: "<length>"; inherits: false; initial-value: 0px } @keyframes y { from { --y: -8px } to { --y: 8px } } .floating { translate: 0 var(--y); animation: y 1.5s ease-in-out infinite alternate }`, or animate `translate` directly. See `docs/beta-prep-0.5.md`.

| | |
|---|---|
| Purpose | Smooth periodic motion of any animatable value |
| Syntax | `wave(min, max, duration)`. `min` and `max` are numbers, lengths, percentages (mixable with lengths), angles or times, of the same type (a unitless `0` adopts the other type). `duration` is one full cycle. |
| Returns | The same type as min/max |
| Behavior | `min` at the start, `max` at half the duration, back to `min`, forever. Sine-shaped (easeInOutSine between the extremes). Elements bound together share the phase. |
| Native | Each distinct wave (call sites with the same arguments are shared) registers one typed custom property and **one** immutable keyframe list. Each element gets a Web Animations animation of that property, and the browser interpolates it with **no JavaScript per frame**. It does not use the `animation` property, so the author's `animation`, `transition`, `transform` and `translate` are untouched and keep working. |
| Reduced motion | `prefers-reduced-motion: reduce` gives the static midpoint `calc((min + max) / 2)` and no animation. Preference changes apply live. |
| Fallback | Without `CSS.registerProperty` (custom properties would animate discretely): the midpoint, with one warning |
| Cleanup | The animation is cancelled when the element is removed |
| Limitations | Arguments must be plain values (no nested reactive functions). It cannot be nested inside `live()` and similar functions, but it works inside `calc()`. Identical waves (same arguments) share one property, one keyframe list and one animation per element, whichever rules use them; a rule that starts matching later joins the running animation (same phase). An element matched by several rules with *different* waves runs one animation per distinct wave, although only the winning declaration is visible (it binds every matching rule, like all reactive values). |

```css
.floating { translate: 0 wave(-8px, 8px, 3s); }
.badge    { rotate: wave(-4deg, 4deg, 2s); }
.pulse    { opacity: wave(0.4, 1, 1.5s); }
```

**Performance** (Chromium 156, all elements animating, compared with a plain `@keyframes` animation of `translate` itself):

| n | script ms/s | style ms/s (vs plain) | p95 frame (vs plain) | start |
|---:|---|---|---|---|
| 10 | 1.4 | 14 (6) | 16.7 (16.8) | 1.9 ms |
| 100 | 1.4 | 84 (35) | 16.8 (16.8) | 2.4 ms |
| 1,000 | 0.4 | 181 (83) | 16.7 (16.7) | 7.1 ms |
| 10,000 | 2.7 | 573 (359) | 50.1 (50.1) | 56.6 ms |

The cost of composability: animating a registered custom property recalculates style every frame, roughly 2× a plain `translate` animation, which can be composited. Frame times are the same as plain CSS in this test. For a single property where you control the whole `animation` declaration, a plain `@keyframes` animation is cheaper. Use `wave()` when you need the value inside `calc()`, on several properties, or next to existing animations.

## Evaluated, not built

See [api-review-0.4.md](api-review-0.4.md). In short:
- `map()`: use `progress()`.
- `distance()`: use `hypot()`.
- Value `cycle()`: use `@keyframes` + `steps()`.
- `smooth()`: use `transition`.
- `spring()`, `throttle()`, `debounce()`: planned and need a concrete case. For discrete changes, `transition` + `linear()` gives a native spring.
- Cross-element `element()`: deferred in favour of `anchor-size()` and container units.

Recipe, native-only, for a pointer-driven spotlight (what `map()` would have done):

```css
.stage { --mx: mouse(x, local); }
.stage .spot { opacity: progress(var(--mx), 0px, 600px); }
```
