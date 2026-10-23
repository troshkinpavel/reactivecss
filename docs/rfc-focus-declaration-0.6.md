# RFC: declarative focus (`focus:`) and accessibility attributes, 0.6

Status: **decided, implemented as experimental in 0.6.0** (see section 8 for the gate). Replaces the action-based proposal in [rfc-focus-management.md](rfc-focus-management.md).

## 1. Problem

Observed in the 0.5.3 examples (`docs/demo-validation-0.5.3.md`, section 5):

- A wizard moves to the next step, but focus stays on Next, or falls to `<body>` when Next becomes `disabled` at step 4. The new step's heading is neither focused nor announced.
- A quiz answer disables the focused option, and focus falls to `<body>`.
- Tabs cannot implement arrow-key navigation, because focus cannot move.

CSS can describe *which* element is the right focus target in a given state. It cannot move focus there.

## 2. Options evaluated

| | A. `focus: when(condition)` (declaration) | B. `focus(selector)` action | C. No focus API (native HTML only) |
|---|---|---|---|
| Example | `.step:nth-var(--step) h2 { focus: true }` | `on: click(increment(--step), focus(.panel:nth-var(--step) h2, closest(.wizard)))` | `<dialog>`, `popover`, `autofocus`, `<details>` |
| Target | the element the rule matches: no selector strings at runtime | a selector evaluated at runtime inside a scope | — |
| Follows state | **yes**: any action, key or bound control that makes the condition true moves focus; no per-transition scripting | only where the author adds `focus()` to every action list that changes the state (Next, Back, Restart, keys…) | — |
| Timing | after the state's CSS is applied (late phase, same task as `attr:` or next frame) | must also wait for CSS, but runs as part of an action: an imperative sequence inside CSS | native |
| Cascade | like any property: specificity, `:when()`, `:nth-var()`, media | n/a | — |
| Risk | focus stealing on incidental true values → needs precise transition rules (section 3) | focus stealing on every listed action; runtime selector evaluation | none |
| Covers | wizard, quiz, tabs (with roving `tabindex`), any state-driven "move focus here" | same, but repeated per action | modals, popovers, disclosures, page-load `autofocus` only |

- **C is not enough.** No native element moves focus for a step change or a tab selection: `autofocus` only works on load and in dialogs and popovers. Native solutions remain the first choice where they exist, and section 4 defers to them.
- **B was rejected.** It needs runtime selector evaluation, and it duplicates focus logic per action.
- **A was chosen.** The selector that already identifies the element *is* the target, and the condition is the existing reactive value engine.

## 3. Semantics of `focus:` (exact)

```css
selector { focus: <value>; }   /* value: true/false, 1/0, var(--bool), when(…) */
```

1. **Compilation.** `focus: X` compiles to `--rcss-focus: X`: a registered, non-inherited property in the same rule, with the same importance. The cascade picks the winning declaration per element.
   - The value must be one boolean token: `true`/`false`, `1`/`0` (a boolean state is `1`/`0` in CSS), or the same as strings.
   - No value (no rule applies, or `when()` without a value) counts as false.
   - Anything else is a diagnostic, and the value counts as false.
2. **Transition, not level.** Each matched element keeps the last value read.
   - Focus is requested only on a read that goes from **false to true**.
   - Re-reading a true value does nothing: unrelated state changes, repeated reads and frame re-reads never refocus.
   - Reads happen in each event's same-task pass when the page has affected `attr:` bindings, otherwise once per frame. A value that goes true → false → true between two reads is no transition. On the frame path this means several events before one frame are judged by the final value only, so rapid navigation focuses the final target, never an intermediate one.
3. **Initial value.** The first read of an element (page load, insertion, the element starting to match a `focus:` rule, recompilation) records the value **without focusing**. A page never moves focus on load. Use native `autofocus` for that.
4. **User activation only.** A transition requests focus only if it was caused by a state change made during a **trusted** user event of these types:
   - `click`, `keydown` (including `key()`), `input` and `change` (actions, and `bind:` controls).
   
   The arming rules:
   - It is armed when the state changes during such an event, inside an owner of the element.
   - Not armed: scripts (`el.click()` is untrusted), timers, native form reset (applied after the event), `focus`/`blur`/`focusin`/`focusout`, pointer enter/leave, animation and transition events, and `outside()` dismissals.
   - An unarmed false → true read is recorded silently.
   - This also breaks focus cycles: focus → `focusin` → state change → no focus.
5. **When.** In the late phase, after the transition's state CSS (cells, `when()`, `:when()`/`:nth-var()` markers) and its `attr:`/`text:` writes:
   - in the same task as the event when the page has `attr:` bindings affected by it (their same-task pass);
   - otherwise in the next frame's late phase;
   - *(pre-beta stabilization)* in the next frame's late phase when the arming event is a `keydown` of Enter or a printable key that was not prevented. The rest of such a key press (`keypress`, text input, Enter's activation of a button or link) goes to the focused element. Focusing in the keydown's task made Enter in a field also click the button that received focus, and typed a shortcut letter into the field it focused. Arrow keys, Home, End, Escape and Tab have no such continuation and keep the same-task path.
   
   There are no timeouts and no polling. The focus call itself happens **after** the pass, outside the scheduler's queues, so the `focusin` it causes is dispatched normally.
6. **Eligibility, decided once.** At resolution the target must be connected and rendered (`checkVisibility()`: no `display: none`, `content-visibility: hidden`, `visibility: hidden`), not `inert`, and must actually take focus.
   - Not natively focusable and without `tabindex`: a warning. The library never adds `tabindex`.
   - Disabled, `inert` or not rendered: a development note.
   - In every failing case, focus is unchanged. The request is not retried later: CSS that hides an element after the state's own styles (a delayed transition) is out of scope.
7. **One focus per resolution.** If several elements transition in the same pass, the **first eligible one in document order** gets focus; the others are recorded as true and never focused later.
8. **Do not override the user or native components.** The request is dropped if:
   - focus moved since the activating event, to an element other than `<body>` (the user tabbed or clicked elsewhere before the frame);
   - focus is already on the target or inside it;
   - focus is inside an open `<dialog>` or an open popover that does not contain the target (the native component manages focus; a modal dialog also makes the target `inert`);
   - *(0.7.1)* the activating event's target is inside such a dialog or popover. A click does not always move focus: WebKit does not focus buttons on click. Without this rule, a click inside an open popover could move focus out of it in WebKit only.
9. **Focus options.** `focus()` with the browser defaults: scrolling into view, and the native `:focus-visible` heuristic, which shows the ring after keyboard use.
10. **Lifecycle.** An element that stops matching, is removed, or whose sheet is removed, drops its record and any pending request. Nothing is retained after removal (weak per-element map, dead flag).
11. **Trust.** Trusted stylesheets only, like `on:`, `bind:`, `text:` and `attr:`. A cross-origin or untrusted inline sheet cannot move focus.

### Can it distinguish meaningful transitions from incidental rendering?

Yes, by rules 2 to 4:
- only a value change false → true counts (not a re-render, not a re-read);
- only after the first read (not on load or insertion);
- only when a trusted user event changed a state in one of the element's owners.

Incidental changes, such as a class toggled by a script, a media query, or a CSS transition, can change the value, but they are not armed. The remaining ambiguity is the *first eligible in document order* tie-break (rule 7). It is deterministic and documented, but an author can create two simultaneous targets. The wizard and tabs avoid this by having exactly one true target per state.

## 4. Native-first rules

- `autofocus`, `<dialog>` (`showModal()` focus, restore on close), `popover` and form-control focus are not duplicated. Rule 3 means `focus:` never acts on load, and rule 8 means it never fights a dialog or popover.
- Focus navigation (Tab order) is the browser's. `focus:` does not change it.

## 5. Accessibility attributes (Phase 2 assessment)

| Attribute | Decision | Semantics | Why |
|---|---|---|---|
| `aria-disabled` | **added** (`attr:` and `state(…, bind())`) | `"true"`/`"false"` (also from `1`/`0`) | Keeps a control focusable and discoverable while announced as unavailable. It does **not** block clicks, keys or submission: authors must make the actions inactive (conditional `on:` rules; tested free of stale state since 0.5.1). Event dispatch is not changed by its presence |
| `tabindex` | **added, restricted to `0` and `-1`** | the number; other values are rejected | Needed for the roving `tabindex` of the ARIA Tabs pattern, the only way to keep one tab in the Tab order. Positive values (which reorder the page's Tab order) are refused. Never added automatically: only where an author writes `attr: tabindex …` |
| `aria-checked` | not added | tri-state (`true`/`false`/`mixed`) | Native checkboxes with `bind:` cover the need; a custom checkbox role is a separate review |
| `aria-invalid` | not added | `true`/`false`/`grammar`/`spelling` | Native `:invalid`/`:user-invalid` and constraint validation are exposed natively; a duplicate risks contradicting them |
| `aria-busy` | not added | boolean | No example needs it; announcing behavior varies widely across screen readers |
| `inert` | not added | boolean, makes a subtree unfocusable and hidden from assistive technology | High impact: an `inert` on the wrong element hides content. It needs its own review with focus restoration (moving focus out of a subtree that becomes inert) |

## 6. Interaction with existing features

- **`attr: disabled` / `hidden`** on the target or its ancestors are written before focus resolution (rule 5), so a heading inside a just-unhidden panel is eligible.
- **`focus`/`blur`/`focusin`/`focusout` triggers** see programmatic focus like any focus. Their state changes are never armed (rule 4), so there is no cycle.
- **`key()`** is a `keydown`, so arrow-key navigation can move focus through a `focus:` rule, as in the tabs example.

## 7. Cost

- **Non-qualifying update:** one `getComputedStyle()` read per `focus:` element inside the changed owner, in an existing late phase. No extra forced recalculation: in the same-task pass the recalculation is already paid by `attr:`; otherwise the read is in the frame.
- **Qualifying transition:** the eligibility check and `focus()`, which updates style and layout as any focus does.
- **Idle:** none (no loop, no polling).

## 8. Decision gate

- **`focus:` is specified precisely** (rules 1–11) and every rule has a deterministic browser test (`tests/browser/v060.spec.ts`). It ships **experimental**.
- **Open questions,** reported rather than invented:
  - whether screen readers announce focused headings well in practice (not tested here; section 9 of the release report);
  - whether a target that becomes eligible only after a CSS transition should be retried. Decided: no, in this version.
- **Not shipped:** a `focus(selector)` action and focus restoration. Native `<dialog>`/`popover` cover restoration.
