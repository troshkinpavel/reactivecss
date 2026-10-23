# Browser compatibility (0.7.0)

Test date: 2026-10-18. Machine: Apple M4 Max, macOS 27.0 (arm64). Harness: Playwright 1.64.1 driving the engines below. These are **engine** tests: WebKit here is Playwright's WebKit build, not a shipped Safari release, and Chromium is the headless shell. Results for real Safari, Chrome or Edge releases are not verified.

| | Chromium | WebKit | Firefox |
|---|---|---|---|
| Version tested | 156.0.8078.4 (headless shell) | 27.2 (Playwright build) | 157.0 (Playwright build, Linux CI) |
| Unit tests (engine-independent, Node) | 49/49 | — | — |
| Browser tests | 106 / 106; also 106 / 106 with the CPU throttled 4× (`RCSS_CPU_THROTTLE=4`) | 102 / 102 (4 heap snapshot and listener tests are Chromium-only: they need the DevTools protocol) | 423 / 430, 7 skipped (0.9.0 suite, 2026-10-23; see [Firefox](#firefox)) |
| Status | Verified | Verified (engine) | Verified (engine, CI) |

## What the browser tests verify

Every row below passes in Chromium and WebKit.

| Area | Test file |
|---|---|
| Values: `random()` (JS and native paths), `pick()`, `live()`, `on()`, `mouse()`, `visible()`, `viewport()` | `reactive.spec.ts`, `runtime.spec.ts` |
| Stylesheets: inline, linked, dynamic insertion/editing/removal, relative URLs, `media`, `disabled`, alternate sets, cross-origin handling | `reactive.spec.ts`, `cascade.spec.ts` |
| Cascade: layers across sheets, nested layers, `!important`, source order, `@media`/`@supports`/`@container`, nesting, `:is()`/`:where()`/`:has()`, pseudo-elements, custom property inheritance, `@import`, shadow DOM boundary, running animations | `cascade.spec.ts` |
| Selectors: `:just-checked`, `:just-unchecked`, `:nth-var()`, `:when()`, `:changed()` (including delays, multiple animations, zero duration, restart, cancellation) | `reactive.spec.ts`, `state.spec.ts`, `v03.spec.ts` |
| State, actions, conditions, `previous()`, `direction()`, `cycle()`, `closest()`, `key()`, `outside()`, native `if()` vs runtime | `state.spec.ts`, `v03.spec.ts` |
| `bind:` on text, number, checkbox, radio, select and textarea, including IME, caret, reset and autofill | `v03.spec.ts` |
| `typed()` | `v03.spec.ts` |
| CSP: five policies with real headers | `csp.spec.ts` |
| Security regressions | `security.spec.ts` |
| Lifecycle: no retained detached elements after mount/unmount (heap snapshot) | `lifecycle.spec.ts` (Chromium) |
| Leak regressions from the 0.4 runtime audit: `:nth-var()` subscriptions on reinsertion, listeners on disabled `<link>`s, per-element tables of `element()` and `:just-checked`; shared identical `wave()`s | `lifecycle.spec.ts` (Chromium), `v04.spec.ts` |
| `element()`: box model, resize, hidden/empty/nested/vertical, shared observer and cleanup, native `element(#id)` untouched, feedback-loop guard (both directions) | `v04.spec.ts` |
| 0.5.2 attribute binding: initialization (present, missing, invalid, every value type), ARIA, boolean and `data-*` semantics, every action, synchronous `disabled` stopping a second click, cascade (specificity, layers, order, media, `!important`, late winner), lifecycle (restore, reinsertion, sheet removal, external changes, nested, dynamic), injection and keyword safety, untrusted sheets, strict CSP with `text:` and `bind:`, no loop through attribute selectors; `@layer` statement after the first rule kept | `v052.spec.ts`, `cascade.spec.ts` |
| 0.5.3 derived attributes (`attr:`): ancestor state to descendant `disabled`/ARIA/`data-*`; repeated same-task clicks, rapid real clicks and Enter stop at bounds; bound controls update in the same task; per-attribute cascade (specificity, order, `@layer`, `!important`, media, `:when()`), restore when no rule applies; value checks; ownership against `state(…, bind())` and external writers; no loops with a page `MutationObserver`; HTML applicability (`disabled`, `required`, `hidden`; form-associated and undefined custom elements; ARIA warnings); dynamic elements, reinsertion, nested owners, recompilation, sheet removal; 1,000 rows; unsafe names and markup values; untrusted sheets; strict CSP. Eleven examples plus the demo lab with real input under a strict CSP | `v053.spec.ts`, `examples.spec.ts` |
| 0.6.0 `focus:`: no focus on load or insertion; user click and Enter move focus; scripted clicks, focusin-driven state and timers do not; rapid clicks focus the final step; focus moved by the page before resolution wins; un-hidden ancestor (`attr: hidden`) then focus; not focusable (warning), `display: none`, disabled, `inert` (notes); first eligible in document order; focus inside the target or in an open dialog kept; cascade (`focus: false` wins), removed target, inserted true target, nested owners, recompilation, untrusted sheets, invalid values; same-task and frame paths. `aria-disabled` (does not block; clamp rule does; stays focusable), `tabindex` 0/-1 only. Examples: wizard heading focus, quiz Next/heading focus and restart, tabs arrows/Home/End/roving tabindex (Tab checked in Chromium only: WebKit's default Tab order skips buttons), configurator focus kept at bounds | `v060.spec.ts`, `examples.spec.ts` |
| 0.7.0 `prevent()`: handled keys do not scroll (PageDown/End/Home in both engines, arrow keys in Chromium; headless WebKit does not scroll on arrow keys natively, so there only `defaultPrevented` is checked); unhandled keys and handled keys without `prevent()` still scroll; page listeners still receive the event; passive → non-passive → passive with a late sheet, no duplicate dispatch; conditional cancellation within one task; form controls keep their keys (textarea caret, range slider), unless they carry the rule; nested handlers; no cancellation without focus (fallback); non-cancelable events reported; link navigation and checkbox toggling cancelled only where a rule says so; compile errors for other triggers, `outside()`, `reset`, arguments; untrusted sheets. Demos: tabs and keyboard playground on scrollable pages | `v070.spec.ts`, `examples.spec.ts` |
| 0.5.1: conditional actions see the current state within a frame (same-task bursts, raw rapid input in Chromium, nested owners, several `:when()` rules, `:nth-var()` gates, removal); sequential mutations; `text:` (real text node, cascade, `:when()`, media, special characters and markup as literal text, nested-content protection, original text restored, reinsertion, recompile, yield to external changes, untrusted sheets, strict CSP); `focusin`/`focusout`/`reset`/animation and transition end and cancel triggers | `v051.spec.ts`, `events.spec.ts` |
| The five examples (strict CSP, real input, isolation, cleanup) | `examples.spec.ts` |
| 0.5 expressions: `state(attr())` on the owner, `set(--x, attr())` at event time, nested owners, missing/empty/Unicode/quoted/control-character values kept as one string, password fields refused, native `attr()` untouched, `pick(split())` per owner and per event, empty lists, invalid `split()`; stable `state()` registrations across recompiles, edits, moves and two sheets; boolean cascade initial values; strict CSP | `v05.spec.ts` |
| The minified bundle alone on a plain HTML page | `dist.spec.ts` |

## Feature detection (behavior, not API presence)

| Feature | Detection | Fallback |
|---|---|---|
| Native `random()` | `CSS.supports()` **and** two probe elements must get different values (per-element semantics). | JS path |
| Native `if()` for `when()` | `CSS.supports()` of a compound `if((style(...) and not style(...)): …)` | runtime `when()` |
| `CSS.registerProperty` (needed by `on:` and `state()` isolation, and by `typed()`) | try/catch | `on:` warns once; `typed()` leaves a plain property |
| `ResizeObserver` with `borderBoxSize` (`element()`) | used directly; `contentRect` fallback | content box when `borderBoxSize` is missing |
| Native `progress()`, `hypot()`, `anchor-size()`, `linear()` | probed in Chromium 156 and WebKit 27.2 (all supported) | not used by the runtime; recommended instead of `map()`, `distance()`, cross-element geometry and `spring()` |

## Firefox

Since 0.9.0 the full browser suite runs in Firefox on every pull request and push to `main`: the `library-firefox` job in `.github/workflows/test.yml`, in the `mcr.microsoft.com/playwright:v1.64.1-noble` image. A Firefox failure fails the run, as a Chromium or WebKit failure does. The 7 skipped tests are 6 Chromium-only tests (they use the DevTools protocol for heap snapshots, listeners or raw input) and the native-only `random()` sharing keys: Firefox has no native `random()`, so the runtime polyfills it, and the tests check that path instead.

Playwright's Firefox does not start on the macOS development machine ("Could not find profile folder"), so run it locally in the same image:

```bash
docker run --rm --ipc=host -e HOME=/root -v "$PWD":/w -v rcss_ff_nm:/w/node_modules -w /w mcr.microsoft.com/playwright:v1.64.1-noble sh -c "npm ci && npm run build && npx playwright test --project=firefox"
```

Firefox has no CSS typed arithmetic (`round(var(--x) / 1px)` is invalid there), so the examples print px values as numbers with `round(tan(atan2(var(--x), 1000px)) * 1000)`, which works in all three engines. **Manual:** all 20 examples passed user-reported manual testing in Firefox, as well as in Chrome and Safari, for 0.7.1 (`docs/browser-validation-0.7.1.md`). The build targets Firefox 128+, the version that added `CSS.registerProperty`.
