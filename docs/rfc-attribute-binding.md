# RFC: attribute binding (state → selected HTML attributes)

> **0.6.0 status.** Added: `aria-disabled` (`"true"`/`"false"`), and `tabindex` restricted to `0`/`-1` (roving `tabindex`). Open question 1 is decided: both `disabled` and `aria-disabled` are available. `aria-disabled` does not block events, and the docs show the conditional `on:` rule that does. Still not added: `inert`, `aria-checked`, `aria-busy`, `aria-invalid` (assessment: `docs/rfc-focus-declaration-0.6.md`, section 5).

> **0.5.3 status: the derived form is implemented as `attr: <attribute> <value>`.**
> - It follows design A below (one registered, non-inherited property per attribute, `--rcss-attr-<name>`), but with one declaration name and the attribute as the first token. Reason: `attr: disabled when(…)` reads as what it does, and it compiles to the same per-attribute properties, so the cascade is still independent per attribute.
> - First allowlist: the 0.5.2 one (`aria-expanded`, `aria-pressed`, `aria-selected`, `aria-current`, `disabled`, `hidden`, `required`, `data-*`). Not included: `inert`, `aria-disabled`, `aria-checked`, `aria-busy`, `aria-invalid`. Each needs its own review; no example needed them.
> - Timing differs from the proposal: after event-driven changes, attributes are written in the same task, not in the frame, so `disabled` stops the next click.
> - Open question 1 (`aria-disabled` vs `disabled`) is still open.
> - Report: `docs/release-0.5.3.md`.

> **0.5.2 status.**
> - Implemented: the **owner-only** variant `state(initial, bind(attribute))`, with this RFC's allowlist semantics: boolean attributes present or removed, explicit ARIA `"true"`/`"false"`, `aria-current` tokens, plus `data-*`.
> - Also from this RFC: original value restored only if unchanged, trusted sheets only, no re-matching on bound attributes.
> - **Not** implemented: the `attr-*:` properties recommended below.
> - The examples show why a derived form is still needed: `aria-current` on the wizard's steps, `disabled` on the configurator's buttons, `aria-pressed` on quiz options. In each, the attribute belongs to an element that does not own the state. Report: `docs/release-0.5.2.md`.

Status: **proposal, not implemented** (0.5.1). Motivation: `docs/example-capability-gaps.md`, gap 2. All five examples show visual state that assistive technology cannot see:

| Example | Visible state | Attribute that should follow |
|---|---|---|
| Configurator | − / + inactive at a bound | `disabled` or `aria-disabled` |
| Wizard | current step in the indicator; panels | `aria-current="step"`; (panels already use `display: none`) |
| Quiz | answered options; chosen option | `aria-disabled`, `aria-pressed` |
| Accordion and dropdown demos | open / closed | `aria-expanded` |

## Requirements

- **One direction only: state → attribute.** Controls already have `bind:`. Two-way attribute sync would create loops and ownership fights.
- **A small allowlist.** No generic `setAttribute()`.
- **Correct attribute types.**
  - Boolean attributes are present or absent: `disabled=""` and even `disabled="false"` both disable.
  - ARIA attributes are tokens: `aria-pressed="false"` is meaningful and different from absent.
- **Cascade semantics like every other Reactive CSS declaration:** specificity, `:when()`, media, layers.
- **Ownership and cleanup.** The original attribute value is restored when no declaration applies. Yield (stop writing) when another script changes the attribute.
- **No `MutationObserver` loops.**
- **Trusted stylesheets only** (like `on:`, `bind:` and `text:`).

## Designs compared

| | A. One property per attribute | B. One `bind-attr:` property | C. A list in one property | D. The attribute name as the property |
|---|---|---|---|---|
| Syntax | `attr-disabled: when(--qty >= 10, true, false)` | `bind-attr: disabled, when(...)` | `attrs: disabled when(...), aria-current when(...)` | `disabled: when(...)` |
| Cascade | **Independent per attribute** | **Broken**: one element can bind one attribute; a second rule for another attribute replaces the first | Whole list replaced by the winning rule (like `transition`) | Independent |
| Parsing | Name prefix, one value | Two-part value | List grammar | Collides with possible future CSS properties and confuses readers |
| Implementation | Same as `text:`: compile to a registered, non-inherited marker property per attribute and read it in the late phase | — | — | — |

**Recommendation: A.** It follows the cascade per attribute, reuses the `text:` machinery (compile to a registered, non-inherited custom property; read the computed value after the frame's writes), and is explicit about what it touches. The `attr-` prefix cannot collide with CSS and is easy to search for.

## Proposed semantics (A)

```css
/* Proposal only */
.product:when(--qty >= 10) .plus { attr-aria-disabled: true; }
.wizard > .steps > li:nth-var(--step) { attr-aria-current: step; }
.quiz:when(--a1 > 0) .q1 .opt { attr-disabled: true; }
.menu { attr-aria-expanded: when(--open, true, false); }
```

- **Allowlist (first version):**
  - boolean: `disabled`, `hidden`, `inert`;
  - token: `aria-current`, `aria-pressed`, `aria-expanded`, `aria-selected`, `aria-checked`, `aria-disabled`, `aria-busy`, `aria-invalid`.
  - **Never** `href`, `src`, `action`, `formaction`, `style`, `class`, `id`, `role`, `on*`, `aria-label`/`aria-describedby` (free text: use `text:`), `aria-hidden` (too easy to hide focusable content).
- **Boolean attributes:**
  - `true`/`1` sets the attribute to `""`;
  - `false`/`0` **removes** it;
  - anything else is a diagnostic.
  
  The library never writes `disabled="false"`.
- **Token attributes:**
  - a keyword or string is written as the value (`aria-current: step` → `aria-current="step"`);
  - booleans are written as `"true"`/`"false"`, because ARIA needs the explicit `"false"`;
  - the keyword `none` removes the attribute.
- **No applicable declaration** (no rule matches, or the winning rule's condition is false): the original attribute, or its absence, is restored.
- **Ownership:**
  - The original value is saved when the element starts matching.
  - Before every write, the attribute must still have the value the library last wrote. Otherwise another script owns it now: yield, with a diagnostic, and never restore.
  - Same policy as `text:` (tested there).
- **Loops:**
  - The library's own attribute writes can change selector matching, e.g. a rule `[disabled] …`.
  - The element manager re-matches watchers on attribute changes, so writes could feed back.
  - Mitigations:
    - writes happen once per element per frame, in the late phase;
    - an attribute-binding change never re-queues the same element in the same frame;
    - a feedback guard like `element()`'s (same value oscillating for N frames) freezes the binding with a warning.
  - Owned attribute names are not added to the element manager's attribute filter unless a selector mentions them.
- **Native control behavior** (to document):
  - `disabled` on a focused button moves focus to `<body>`, and disabled controls are skipped in form data.
  - For buttons that should stay focusable and announced, `aria-disabled="true"` plus an inactive action (as the examples do today) is often better than `disabled`.
- **External frameworks:** they keep ownership of attributes they write; the yield rule prevents fights. A framework that re-renders and restores the original value makes the binding yield.

## Cost and size

About the same as `text:`: one registered property per allowlisted attribute (11), one late-phase read per bound element after state changes in its owner, plus ~1.5 KB minified.

## Open questions

1. `aria-disabled` vs `disabled` defaults in the docs (accessibility review).
2. Should `hidden`/`inert` be in the first version? `display: none` already covers visual hiding; `inert` is valuable for modal-like panels.
3. Diagnostics when a binding targets a native control whose state CSS already reflects (e.g. `attr-checked`): disallow (`checked` is not in the list; use `bind:`).

Decision needed before implementing; nothing in 0.5.1 exposes this.
