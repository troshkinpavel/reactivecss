"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __export = (target2, all) => {
    for (var name in all)
      __defProp(target2, name, { get: all[name], enumerable: true });
  };

  // <define:__RCSS_BUNDLE__>
  var define_RCSS_BUNDLE_default = ["core", "events", "gestures", "persist", "conditions", "nth-var", "history", "forms", "text", "attributes", "focus", "blur", "values", "dynamic", "geometry"];

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    FEATURES: () => FEATURES,
    KEEP_NATIVE: () => KEEP_NATIVE,
    compile: () => compile,
    defineAction: () => defineAction,
    defineFunction: () => defineFunction,
    defineSelector: () => defineSelector,
    describe: () => describe2,
    diagnostics: () => diagnostics,
    refresh: () => refresh2,
    start: () => start,
    stats: () => stats,
    stop: () => stop,
    version: () => VERSION
  });

  // src/core/version.ts
  var VERSION = "0.9.0";

  // src/core/features.ts
  var S = (name) => ({ name, type: "<state-name>" });
  var FEATURES = [
    // ---- values ------------------------------------------------------------------------
    {
      name: "random",
      kind: "function",
      category: "extend",
      status: "stable",
      since: "0.1",
      syntax: "random([element-shared,] min, max [, by step])",
      parameters: [{ name: "min", type: "<number> | <dimension>" }, { name: "max", type: "<number> | <dimension>" }, { name: "step", type: "by <number> | <dimension>", optional: true }],
      returns: "same type as min/max",
      requiresRuntime: "conditional",
      nativeEquivalent: "random() (CSS Values 5) when per-element semantics are confirmed",
      description: "A random value per element, fixed until re-rolled by live() or on().",
      examples: [".dot { opacity: random(0.3, 1); }"]
    },
    {
      name: "pick",
      kind: "function",
      category: "extend",
      status: "stable",
      since: "0.1",
      syntax: "pick(value, ...)",
      returns: "one of the values",
      requiresRuntime: true,
      description: "One of the listed values, per element.",
      examples: [".tag { background: pick(tomato, gold, teal); }"]
    },
    {
      name: "live",
      kind: "function",
      category: "extend",
      status: "stable",
      since: "0.1",
      syntax: "live(expression, interval = 1s)",
      returns: "the expression",
      requiresRuntime: true,
      description: "Re-evaluates an expression on a shared interval.",
      examples: [".p { translate: live(random(0px, 100px), 2s) 0; }"]
    },
    {
      name: "on",
      kind: "function",
      category: "extend",
      status: "stable",
      since: "0.1",
      syntax: "on(event, expression)",
      returns: "the expression",
      requiresRuntime: true,
      description: "Re-evaluates an expression when an event fires on the element.",
      examples: [".card { rotate: on(pointerenter, random(-5deg, 5deg)); }"]
    },
    {
      name: "mouse",
      kind: "function",
      category: "extend",
      status: "stable",
      since: "0.1",
      syntax: "mouse(x | y [, viewport | local])",
      returns: "<length>",
      requiresRuntime: true,
      description: "Pointer position; viewport mode is a shared source.",
      examples: [".pad { --mx: mouse(x, local); }"]
    },
    {
      name: "visible",
      kind: "function",
      category: "extend",
      status: "stable",
      since: "0.1",
      syntax: "visible([threshold])",
      returns: "0 | 1",
      requiresRuntime: true,
      description: "1 while at least `threshold` of the element is in the viewport.",
      examples: [".reveal { opacity: visible(0.5); }"]
    },
    {
      name: "viewport",
      kind: "function",
      category: "simplify",
      status: "stable",
      since: "0.1",
      syntax: "viewport(width | height)",
      returns: "<length>",
      requiresRuntime: false,
      nativeEquivalent: "100dvw / 100dvh",
      description: "Viewport size; compiles to dynamic viewport units.",
      examples: [".hero { height: viewport(height); }"]
    },
    {
      name: "element",
      kind: "function",
      category: "extend",
      status: "experimental",
      since: "0.4",
      syntax: "element(width | height)",
      parameters: [{ name: "axis", type: "width | height" }],
      returns: "<length> (px), the border-box size; no value until first measured",
      requiresRuntime: true,
      evaluation: "source",
      nativeEquivalent: "container query units (cqw/cqh) measure a container for its descendants; anchor-size() measures an anchor",
      support: "ResizeObserver with borderBoxSize",
      cleanup: "unobserved when the element is removed; the shared observer disconnects when unused",
      description: "The element's own measured size. Context-aware: element(#id) stays the native image function. A feedback loop (the value changing its own size) is detected and frozen with a warning.",
      examples: [".card { --w: element(width); } .card .label { font-size: clamp(12px, calc(var(--w) / 16), 32px); }"]
    },
    {
      name: "wave",
      kind: "function",
      category: "extend",
      status: "removed",
      since: "0.4",
      removedIn: "0.5",
      syntax: "wave(min, max, duration)",
      requiresRuntime: true,
      evaluation: "animation",
      nativeEquivalent: '@property --y { syntax: "<length>"; inherits: false; initial-value: 0px } @keyframes y { from { --y: -8px } to { --y: 8px } } .floating { translate: 0 var(--y); animation: y 1.5s ease-in-out infinite alternate }',
      description: "Was: smooth periodic motion of a registered custom property through the Web Animations API.",
      reason: "Removed before beta: a convenience over native @property + @keyframes (which compose the same way: animation lists, calc(), several properties), at a measured main-thread style cost of 171-181 ms/s per 1,000 animated elements where a composited @keyframes translate costs 0. Animate translate/opacity/transform directly when possible.",
      examples: []
    },
    // ---- state ---------------------------------------------------------------------------
    {
      name: "state",
      kind: "function",
      category: "extend",
      status: "stable",
      since: "0.2",
      syntax: "--name: state(initial [, bind(attribute)])",
      parameters: [
        { name: "initial", type: "true | false | <number> | <dimension> | <string> | <keyword> | <color> | attr() | pick() (evaluated once per owner)" },
        { name: "bind", type: "bind(aria-expanded | aria-pressed | aria-selected | aria-current | disabled | hidden | required | data-*), experimental since 0.5.2", optional: true }
      ],
      returns: "the current state (booleans as 1 / 0); always one scalar value",
      requiresRuntime: true,
      support: "bind(): trusted stylesheets only",
      cleanup: "the cell is disposed when no state() declaration matches the owner; the generated property is registered once per state name per page; a bound attribute is restored to its original value if it still holds what Reactive CSS wrote",
      description: `Mutable state owned by each matching element. The initial value may read the owner's attribute or pick at random (0.5). With bind(attribute) (experimental, 0.5.2) the owner's attribute initializes the state once and then follows every change synchronously, with HTML semantics: boolean attributes present or absent (never disabled="false"), ARIA states as "true"/"false" or aria-current tokens, data-* as text. External changes to the attribute are not read back.`,
      examples: [".accordion { --open: state(false); }", '.greeting { --message: state(attr(data-message, "Hello!")); }', ".menu { --open: state(false, bind(aria-expanded)); on: click(toggle(--open)); }"]
    },
    // ---- expressions (only inside state(...) and set(--x, ...); native everywhere else) ----------------------
    {
      name: "attr",
      kind: "expression",
      category: "extend",
      status: "experimental",
      since: "0.5",
      syntax: 'attr(name [, "fallback"])',
      parameters: [{ name: "name", type: "HTML attribute name" }, { name: "fallback", type: "<string>", optional: true, default: '""' }],
      returns: "<string>",
      requiresRuntime: true,
      evaluation: "static",
      nativeEquivalent: "attr() (CSS Values 5) everywhere else: content: attr(data-label) and typed attr(name type(...)) are left to the browser",
      support: "trusted stylesheets only (same as on: and bind:); never reads password, one-time-code or payment fields",
      description: "In state(): the state owner's attribute, read once when the state is created. In set(): the attribute of the element with the on: declaration, read at event time. Always a string, escaped into one CSS string; no ancestor lookup.",
      examples: [".greeting { --message: state(attr(data-message)); }", ".choice { on: click(set(--message, attr(data-message))); }"]
    },
    {
      name: "pick",
      kind: "expression",
      category: "extend",
      status: "experimental",
      since: "0.5",
      syntax: 'pick(value, ...) | pick(split(text, "delimiter"))',
      returns: "one of the values (all of one type)",
      requiresRuntime: true,
      evaluation: "static",
      description: 'One value at random, each time the expression is evaluated: once per owner in state(), on every event in set(). Nothing to pick: set() changes nothing and state() starts as "".',
      examples: [".d { on: click(set(--face, pick(1, 2, 3, 4, 5, 6))); }"]
    },
    {
      name: "split",
      kind: "expression",
      category: "extend",
      status: "experimental",
      since: "0.5",
      syntax: 'split(text, "delimiter")',
      parameters: [{ name: "text", type: "<string> | attr()" }, { name: "delimiter", type: "non-empty <string>" }],
      returns: "a transient list, only as the single argument of pick()",
      requiresRuntime: true,
      evaluation: "static",
      description: "Splits a string at every occurrence of the delimiter; entries are trimmed and empty entries dropped. The list is never stored: state stays scalar. No escape for the delimiter itself: choose one that does not occur in the values.",
      examples: ['.shuffle { on: click(set(--message, pick(split(attr(data-greetings), "|")))); }']
    },
    {
      name: "when",
      kind: "function",
      category: "simplify",
      status: "stable",
      since: "0.2",
      syntax: "when(condition [, if-true [, if-false]])",
      returns: "one of the branches (true or false without branches, 0.5.3), or no value when unknown",
      requiresRuntime: "conditional",
      nativeEquivalent: "if(style(...)) for boolean conditions with static branches",
      dependsOn: ["state"],
      description: "Chooses a value from state.",
      examples: [".content { opacity: when(--open, 1, 0); }"]
    },
    {
      name: "previous",
      kind: "function",
      category: "extend",
      status: "stable",
      since: "0.3",
      syntax: "previous(--state)",
      parameters: [S("state")],
      returns: "the value before the last effective change",
      requiresRuntime: true,
      dependsOn: ["state"],
      description: "State history (also a condition operand).",
      examples: [".c:when(--n > previous(--n)) { color: green; }"]
    },
    {
      name: "direction",
      kind: "function",
      category: "extend",
      status: "stable",
      since: "0.3",
      syntax: "direction(--state)",
      parameters: [S("state")],
      returns: "1 | 0 | -1",
      requiresRuntime: true,
      dependsOn: ["state"],
      description: "Whether a number or dimension state last went up or down.",
      examples: [".c { color: when(direction(--n) < 0, red, green); }"]
    },
    {
      name: "typed",
      kind: "function",
      category: "simplify",
      status: "experimental",
      since: "0.3",
      syntax: '--name: typed(initial [, "<syntax>"])',
      returns: "the value",
      requiresRuntime: true,
      nativeEquivalent: "@property { syntax; inherits: true; initial-value }",
      support: "CSS.registerProperty",
      cleanup: "none: registrations are permanent for the page (a native @property rule goes away with its stylesheet)",
      description: "Registers a typed custom property, e.g. to make it animatable. Differences from @property: always inherits: true; the syntax is inferred from the value; the first compiled typed() for a name wins (later ones with another type are skipped with a warning); the registration is document-wide and permanent, even if its stylesheet is removed; an existing native @property for the name is kept. Prefer @property when you can write it.",
      examples: [".card { --angle: typed(0deg); transition: --angle 300ms; }"]
    },
    // ---- selectors -------------------------------------------------------------------------
    {
      name: "just-checked",
      kind: "selector",
      category: "extend",
      status: "stable",
      since: "0.1",
      syntax: ":just-checked",
      requiresRuntime: true,
      description: "After an observed unchecked \u2192 checked transition (never on load).",
      examples: ["input:just-checked + .icon { animation: pop 300ms; }"]
    },
    {
      name: "just-unchecked",
      kind: "selector",
      category: "extend",
      status: "stable",
      since: "0.1",
      syntax: ":just-unchecked",
      requiresRuntime: true,
      description: "After an observed checked \u2192 unchecked transition.",
      examples: ["input:just-unchecked + .icon { animation: shrink 300ms; }"]
    },
    {
      name: "nth-var",
      kind: "selector",
      category: "extend",
      status: "stable",
      since: "0.1",
      syntax: ":nth-var(--name)",
      requiresRuntime: true,
      dependsOn: ["state"],
      description: "The sibling whose 1-based index equals the variable (state cells read directly).",
      examples: [".panel:nth-var(--active) { display: block; }"]
    },
    {
      name: "when",
      kind: "selector",
      category: "extend",
      status: "stable",
      since: "0.2",
      syntax: ":when(condition)",
      requiresRuntime: true,
      dependsOn: ["state"],
      description: "Matches while a state condition is true.",
      examples: [".meter:when(--value >= 80) { border-color: green; }"]
    },
    {
      name: "changed",
      kind: "selector",
      category: "extend",
      status: "stable",
      since: "0.3",
      syntax: ":changed(--state)",
      requiresRuntime: true,
      dependsOn: ["state"],
      description: "Briefly after an observed change, until the animations it started finish.",
      examples: [".c:changed(--n) .num { animation: flash 300ms; }"]
    },
    {
      name: "blur",
      kind: "selector",
      category: "extend",
      status: "experimental",
      since: "0.9.0",
      syntax: ":blur",
      requiresRuntime: true,
      cleanup: "the marker attribute is removed when the element is focused again, removed, or no :blur rule matches it any more",
      description: "From a genuine focus loss (the element's own blur event) until the element is focused again. Never matches an element that has not lost focus, unlike :not(:focus); an animation on it plays once per focus loss.",
      examples: ["input:blur:invalid { animation: shake 250ms; }"]
    },
    // ---- rules (0.9.0) -------------------------------------------------------------------------
    {
      name: "on",
      kind: "rule",
      category: "extend",
      status: "experimental",
      since: "0.9.0",
      syntax: ":on(event | keydown(Key) | keyup(Key) | outside(click | pointerdown | focusin) [, prevent] [, stop] [, once]) { --state: set(expr) | toggle() | increment(n?) | decrement(n?) | cycle(a, b, \u2026) }",
      requiresRuntime: true,
      evaluation: "event",
      dependsOn: ["state"],
      support: "CSS.registerProperty; trusted stylesheets only",
      cleanup: "listeners exist only while a rule uses their event type; once records go with their element",
      description: "An event rule: when the event happens on (or, for bubbling events, inside) the matched element, its state mutations run. The cascade picks one winning mutation per state, trigger and element. Each event is a transaction: values are read before any write. prevent cancels the default synchronously; stop keeps ancestors' :on() rules and listeners from seeing the event; once runs a rule once per element.",
      examples: [".counter:on(click) { --count: increment(1); }", ".dialog:on(keydown(Escape)) { --open: set(false); }", "a.confirm:on(click, prevent) { --asking: set(true); }"]
    },
    {
      name: "drag",
      kind: "rule",
      category: "extend",
      status: "experimental",
      since: "0.9.0",
      syntax: ":on(drag) | :on(drag(start | move | end | cancel))",
      requiresRuntime: true,
      evaluation: "event",
      dependsOn: ["state"],
      support: "Pointer Events and pointer capture",
      cleanup: "one pointerdown listener while drag rules exist; move listeners only during a gesture; capture released at the end",
      description: "Pointer drag gestures (not HTML drag and drop): starts after 3 px, with pointer capture; event(x) / event(y) are the mutated state at drag start plus the pointer distance, so positions continue across drags. pointercancel runs cancel, then end.",
      examples: [".card:on(drag) { --x: set(event(x)); --y: set(event(y)); }", ".thumb:on(drag) { --v: set(clamp(0px, event(x), 200px)); }"]
    },
    {
      name: "focus",
      kind: "rule",
      category: "extend",
      status: "experimental",
      since: "0.9.0",
      syntax: "<selector>:focus(when(condition)) {}",
      requiresRuntime: true,
      evaluation: "state",
      dependsOn: ["state"],
      support: "Element.focus(); trusted stylesheets only",
      description: "A focus request: the matched element is focused when the condition goes from false to true because of a user action. The same guarantees as focus: (never on load, never stealing focus the user moved, dialogs keep their focus). Plain :focus stays native.",
      examples: [".dialog input:focus(when(--open)) {}"]
    },
    // ---- declarations ----------------------------------------------------------------------
    {
      name: "--attr-*",
      kind: "declaration",
      category: "extend",
      status: "experimental",
      since: "0.9.0",
      syntax: "--attr-<attribute>: <string> | <number> | <keyword> | var(--state) | when(condition [, a, b])",
      requiresRuntime: true,
      evaluation: "state",
      dependsOn: ["state"],
      support: "CSS.registerProperty; trusted stylesheets only",
      description: "The reserved namespace for attributes: --attr-aria-expanded writes aria-expanded of the matched element, with the semantics of attr:. Lower-case allowlisted attributes only; every other custom property stays plain CSS.",
      examples: [".menu > button { --attr-aria-expanded: var(--open); }", '.panel { --attr-data-state: when(--open, "open", "closed"); }']
    },
    {
      name: "content",
      kind: "declaration",
      category: "extend",
      status: "experimental",
      since: "0.9.0",
      syntax: "content: var(--state) | when(condition, a, b) | previous(--state) | direction(--state)",
      requiresRuntime: true,
      evaluation: "state",
      dependsOn: ["state"],
      support: "trusted stylesheets only",
      description: "On elements (not pseudo-elements), a content value that reads state also becomes the element's DOM text, with the semantics of text:. The native declaration is kept; literals, images, counters and attr() stay native.",
      examples: [".counter .value { content: var(--count); }"]
    },
    {
      name: "persist",
      kind: "declaration",
      category: "extend",
      status: "experimental",
      since: "0.9.0",
      syntax: '--state: state(initial, persist("key" [, local | session]))',
      requiresRuntime: true,
      evaluation: "state",
      support: "localStorage / sessionStorage (works without them, not persisted)",
      cleanup: "pending writes are flushed when the page is hidden; storage is never cleared",
      description: "Keeps a state across reloads. Initial value: a valid stored value, then the DOM source of bind(), then the declared value. Writes are coalesced (at most 4 per second per key); cells with the same key share the value, also across tabs for localStorage.",
      examples: ['.theme { --dark: state(false, persist("theme")); }']
    },
    {
      name: "bind()",
      kind: "declaration",
      category: "extend",
      status: "experimental",
      since: "0.9.0",
      syntax: "--state: state(initial, bind(value | checked))",
      requiresRuntime: true,
      evaluation: "event",
      support: "trusted stylesheets only; unconditional rules",
      description: "Two-way binding of the matched form control and its own state. To bind controls to an ancestor's state (radio groups), use bind: --state.",
      examples: ['input[name=q] { --q: state("", bind(value)); }', "input[type=checkbox] { --on: state(false, bind(checked)); }"]
    },
    {
      name: "event",
      kind: "expression",
      category: "extend",
      status: "experimental",
      since: "0.9.0",
      syntax: "event(field)",
      returns: "a typed value",
      requiresRuntime: true,
      evaluation: "event",
      description: "A field of the current event, inside :on() mutations only: type, client-x/y, page-x/y, local-x/y, button(s), pointer-id, pointer-type, pressure, modifier keys, key, code, repeat, value, value-as-number, checked, scroll-top/left; for drag: x, y, delta-x/y, movement-x/y, start-x/y. Each field is checked against the trigger.",
      examples: [".canvas:on(pointerdown) { --x: set(event(local-x)); }", "input:on(input) { --len: set(event(value-as-number)); }"]
    },
    {
      name: "on",
      kind: "declaration",
      category: "extend",
      status: "stable",
      since: "0.2",
      syntax: "on: trigger(action, ...), ...",
      requiresRuntime: true,
      description: "Legacy (0.9.0: prefer :on() rules): runs actions on events; the cascade picks the declaration. Still the way to target an explicit owner with closest().",
      examples: [".tab { on: click(set(--active, sibling-index())); }"]
    },
    {
      name: "text",
      kind: "declaration",
      category: "extend",
      status: "experimental",
      since: "0.5.1",
      syntax: "text: <string> | <number> | var(--state) | previous(--state) | direction(--state) | when(condition, a, b)",
      requiresRuntime: true,
      evaluation: "state",
      dependsOn: ["state"],
      support: "CSS.registerProperty; trusted stylesheets only",
      cleanup: "the original text is restored when no text: declaration applies any more; the binding yields if something else changes the text",
      description: "Writes one scalar value into the element's own DOM text (a Text node, never HTML). Only for elements that are empty or hold one text node; the cascade picks the winning declaration. Not a template language: one value per element.",
      examples: [".profile-name { text: var(--name); }", '.status { text: when(--online, "Online", "Offline"); }']
    },
    {
      name: "attr",
      kind: "declaration",
      category: "extend",
      status: "experimental",
      since: "0.5.3",
      syntax: "attr: <attribute> <string> | <number> | <keyword> | var(--state) | previous(--state) | direction(--state) | when(condition [, a, b])",
      parameters: [{ name: "attribute", type: "aria-expanded | aria-pressed | aria-selected | aria-disabled (0.6) | aria-current | disabled | hidden | required | tabindex 0/-1 (0.6) | data-*" }],
      requiresRuntime: true,
      evaluation: "state",
      dependsOn: ["state"],
      support: "CSS.registerProperty; trusted stylesheets only",
      cleanup: "the original attribute is restored when no attr: declaration for it applies any more, unless something else changed it (the binding then yields)",
      description: 'Derives one allowlisted HTML attribute of the matched element from a reactive value, usually state owned by an ancestor. One property per attribute: attr: declarations for different attributes combine, the cascade picks the winner for each. Same value semantics as state(\u2026, bind()): boolean attributes present or removed (true/false or 1/0), ARIA "true"/"false" or aria-current tokens, data-* as text. Written in the same task as the action that changed the state. disabled and required are only written where HTML gives them a meaning (warning otherwise); a state(\u2026, bind()) of the same attribute on the same element wins. Does not make a component accessible by itself.',
      examples: [".stepper .plus { attr: disabled when(--qty >= 10); }", ".menu > button { attr: aria-expanded var(--open); }", '.steps li:nth-child(2) { attr: aria-current when(--step == 2, "step", "false"); }']
    },
    {
      name: "focus",
      kind: "declaration",
      category: "extend",
      status: "experimental",
      since: "0.6.0",
      syntax: "focus: true | false | var(--boolean) | when(condition [, a, b])",
      requiresRuntime: true,
      evaluation: "state",
      dependsOn: ["state"],
      support: "CSS.registerProperty, Element.focus(); trusted stylesheets only",
      cleanup: "a removed or unmatched element drops its record and any pending request",
      description: "Moves focus to the matched element when its value goes from false to true because of a user action (a trusted click, keydown, input or change that changed a state in one of its owners). Never on page load, insertion, scripts, timers, form reset or focus events; never over a focus the user moved, an open dialog or popover, or focus already inside the target. Resolved after the state's CSS and attr:/text: writes; the first eligible target in document order wins; non-focusable targets are reported (tabindex is never added).",
      examples: [".panel > h2 { focus: false; } .panel:nth-var(--step) > h2 { focus: true; }", ".details h3 { focus: var(--open); }"]
    },
    {
      name: "bind",
      kind: "declaration",
      category: "extend",
      status: "stable",
      since: "0.3",
      syntax: "bind: --state [closest(selector)]",
      requiresRuntime: true,
      dependsOn: ["state"],
      description: "Two-way binding of a native form control and a state.",
      examples: ["input[name=name] { bind: --name; }"]
    },
    // ---- triggers (inside on:) ----------------------------------------------------------------
    ...["click", "change", "input", "pointerenter", "pointerleave", "focus", "blur"].map((e) => ({
      name: e,
      kind: "trigger",
      category: "extend",
      status: "stable",
      since: "0.2",
      syntax: `${e}(action, ...)`,
      requiresRuntime: true,
      description: `Runs actions on the native ${e} event.`,
      examples: [`.x { on: ${e}(toggle(--open)); }`]
    })),
    ...["focusin", "focusout", "reset"].map((e) => ({
      name: e,
      kind: "trigger",
      category: "extend",
      status: "experimental",
      since: "0.5.1",
      syntax: `${e}(action, ...)`,
      requiresRuntime: true,
      description: `Runs actions on the native ${e} event, on the target and its ancestors (it bubbles).`,
      examples: [`.panel { on: ${e}(toggle(--active)); }`]
    })),
    ...["animationend", "animationcancel", "transitionend", "transitioncancel"].map((e) => ({
      name: e,
      kind: "trigger",
      category: "extend",
      status: "experimental",
      since: "0.5.1",
      syntax: `${e}(action, ...)`,
      requiresRuntime: true,
      description: `Runs actions when one of the element's own ${e.startsWith("animation") ? "animations" : "transitions"} ${e.endsWith("cancel") ? "is cancelled" : "ends"} (target only; any ${e.startsWith("animation") ? "animation name" : "property"}: ${e.startsWith("transition") ? "one event per transitioning property" : "no name filter"}).`,
      examples: [`.toast { on: ${e}(set(--shown, false)); }`]
    })),
    {
      name: "key",
      kind: "trigger",
      category: "extend",
      status: "stable",
      since: "0.3",
      syntax: "key([ctrl+|shift+|alt+|meta+]Key, action, ...)",
      requiresRuntime: true,
      description: "keydown while focus is on or inside the element; no character shortcuts while typing.",
      examples: [".dialog { on: key(Escape, set(--open, false)); }"]
    },
    {
      name: "outside",
      kind: "trigger",
      category: "extend",
      status: "stable",
      since: "0.3",
      syntax: "outside(click | pointerdown | focusin, action, ...)",
      requiresRuntime: true,
      description: "Runs when the event happens outside the element (consider the native popover attribute).",
      examples: [".dropdown { on: outside(click, set(--open, false)); }"]
    },
    // ---- actions --------------------------------------------------------------------------------
    {
      name: "set",
      kind: "action",
      category: "extend",
      status: "stable",
      since: "0.2",
      syntax: "set(--state, value | attr(name) | pick(...) | sibling-index() | sibling-count() [, closest(selector)])",
      requiresRuntime: true,
      description: "Assigns a typed value; attr() and pick() are evaluated at event time on the element with the on: declaration.",
      examples: ["set(--active, 2)", "set(--message, attr(data-message))"]
    },
    {
      name: "prevent",
      kind: "action",
      category: "extend",
      status: "experimental",
      since: "0.7.0",
      syntax: "prevent()",
      requiresRuntime: true,
      parameters: [{ name: "contexts", type: "click(\u2026) | key(\u2026) (keydown); not change, input, focus/blur, focusin/focusout, pointer enter/leave, animation/transition, reset, outside()" }],
      support: "Event.preventDefault() in a non-passive document capture listener, installed only while a rule uses prevent() for that event type",
      description: "Cancels the native default action (scrolling for arrow keys, link navigation, checkbox toggling, submit-button submission) of the current event, synchronously during dispatch. Never stops propagation. Only for events whose target is the element with the on: declaration or inside it; never for keys in a form control or editable element that does not carry the rule; only for cancelable events (otherwise a warning), and the result is checked. Runs only when its on: declaration is the one the cascade chose, with current conditions. Limitations: no submit trigger, no stop(); a cancelling ancestor also cancels clicks on links and buttons inside it (development note).",
      examples: [".tabs [role=tablist] { on: key(ArrowRight, prevent(), cycle(--active, 1, 2, 3)); }", "a.confirm { on: click(prevent(), set(--asking, true)); }"]
    },
    {
      name: "toggle",
      kind: "action",
      category: "extend",
      status: "stable",
      since: "0.2",
      syntax: "toggle(--state [, closest(selector)])",
      requiresRuntime: true,
      description: "Flips a boolean state.",
      examples: ["toggle(--open)"]
    },
    {
      name: "increment",
      kind: "action",
      category: "extend",
      status: "stable",
      since: "0.2",
      syntax: "increment(--state [, step] [, closest(selector)])",
      requiresRuntime: true,
      description: "Adds to a number or dimension state.",
      examples: ["increment(--count)"]
    },
    {
      name: "decrement",
      kind: "action",
      category: "extend",
      status: "stable",
      since: "0.2",
      syntax: "decrement(--state [, step] [, closest(selector)])",
      requiresRuntime: true,
      description: "Subtracts from a number or dimension state.",
      examples: ["decrement(--count, 5)"]
    },
    {
      name: "cycle",
      kind: "action",
      category: "extend",
      status: "stable",
      since: "0.3",
      syntax: "cycle(--state, value, value, ... [, closest(selector)])",
      requiresRuntime: true,
      description: "Next value in a list, wrapping around.",
      examples: ["cycle(--mode, light, dark, system)"]
    },
    // ---- planned / evaluated (not shipped) ------------------------------------------------------
    { name: "history", kind: "function", category: "extend", status: "planned", syntax: "history(--state, n)", requiresRuntime: true, description: "Bounded history beyond previous().", reason: "No UI case yet that previous() and direction() do not cover.", examples: [] },
    {
      name: "map",
      kind: "function",
      category: "simplify",
      status: "rejected",
      syntax: "map(value, inMin, inMax, outMin, outMax)",
      requiresRuntime: false,
      nativeEquivalent: "calc(outMin + (outMax - outMin) * progress(value, inMin, inMax))",
      description: "Range mapping.",
      reason: "Native progress() does it (clamped, reversed ranges included) in Chromium and WebKit; with --mx: mouse(x), write opacity: progress(var(--mx), 0px, 1000px).",
      examples: []
    },
    {
      name: "distance",
      kind: "function",
      category: "extend",
      status: "rejected",
      syntax: "distance(x1, y1, x2, y2)",
      requiresRuntime: false,
      nativeEquivalent: "hypot(calc(x1 - x2), calc(y1 - y2))",
      description: "Distance between two points.",
      reason: "Native hypot() computes it from any reactive inputs.",
      examples: []
    },
    {
      name: "element (other element)",
      kind: "function",
      category: "extend",
      status: "planned",
      syntax: "element(selector, width | height)",
      requiresRuntime: true,
      nativeEquivalent: "anchor-size(), container query units",
      description: "Measure another element.",
      reason: "Deferred: anchor-size() and container units cover the common cases natively; a scoped, nearest-owner lookup needs its own design.",
      examples: []
    },
    {
      name: "cycle",
      kind: "function",
      category: "extend",
      status: "rejected",
      syntax: "cycle(values..., interval)",
      requiresRuntime: true,
      nativeEquivalent: "@keyframes with steps()",
      description: "Time-based cycling through values.",
      reason: "Native keyframes with steps() do it without JavaScript, and the name would be confused with the cycle() action.",
      examples: []
    },
    {
      name: "spring",
      kind: "function",
      category: "evaluate",
      status: "planned",
      syntax: "spring(source, stiffness, damping)",
      requiresRuntime: true,
      nativeEquivalent: "transition with linear() easing",
      description: "Spring-like following of a changing value.",
      reason: "A duration does not define a spring, and following a continuously changing source needs per-frame physics in JavaScript. A transition with a linear() spring curve covers discrete changes natively.",
      examples: []
    },
    {
      name: "smooth",
      kind: "function",
      category: "evaluate",
      status: "rejected",
      syntax: "smooth(value, duration)",
      requiresRuntime: false,
      nativeEquivalent: "transition",
      description: "Smoothed value.",
      reason: "A transition on the consuming property does exactly this natively.",
      examples: []
    },
    {
      name: "throttle",
      kind: "function",
      category: "evaluate",
      status: "planned",
      syntax: "throttle(value, interval)",
      requiresRuntime: true,
      description: "Rate-limited updates.",
      reason: "No UI case found that a frame-coalesced source plus a transition does not cover; reconsider with a concrete case.",
      examples: []
    },
    {
      name: "debounce",
      kind: "function",
      category: "evaluate",
      status: "planned",
      syntax: "debounce(value, delay)",
      requiresRuntime: true,
      description: "Update after the input settles.",
      reason: "Same: no concrete case yet beyond transition-delay.",
      examples: []
    },
    ...["drag and drop", "physics", "routing", "storage", "network requests", "clipboard", "DOM mutation actions", "animation DSL"].map((name) => ({
      name,
      kind: "action",
      category: "evaluate",
      status: "rejected",
      syntax: "\u2014",
      requiresRuntime: true,
      description: "Not built.",
      reason: "Duplicates the platform or needs broader permissions than state changes.",
      examples: []
    }))
  ];
  var KEEP_NATIVE = [
    "calc()",
    "min()",
    "max()",
    "clamp()",
    "round()",
    "mod()",
    "rem()",
    "abs()",
    "sign()",
    "pow()",
    "sqrt()",
    "hypot()",
    "log()",
    "exp()",
    "sin()",
    "cos()",
    "tan()",
    "asin()",
    "acos()",
    "atan()",
    "atan2()",
    "rgb()",
    "hsl()",
    "hwb()",
    "lab()",
    "lch()",
    "oklab()",
    "oklch()",
    "color()",
    "color-mix()",
    "light-dark()",
    ":not()",
    ":is()",
    ":where()",
    ":has()",
    ":nth-child()",
    ":nth-of-type()",
    ":checked",
    ":hover",
    ":focus",
    ":focus-visible",
    "var()",
    "env()",
    "attr()",
    "sibling-index()",
    "sibling-count()",
    "if()",
    "@media",
    "@supports",
    "@layer",
    "@scope",
    "@property",
    "@container",
    "progress()",
    "anchor()",
    "anchor-size()",
    "linear()",
    "element(#id)",
    "toggle() (CSS Values 5 value function)",
    "CSS nesting",
    "scroll-driven animations",
    "popover",
    "<details>",
    "<dialog>"
  ];

  // src/core/tokenizer.ts
  var isWs = (c) => c === " " || c === "	" || c === "\n" || c === "\r" || c === "\f";
  var isNameStart = (c) => /[a-zA-Z_]/.test(c) || c.charCodeAt(0) >= 128;
  var isName = (c) => /[a-zA-Z0-9_-]/.test(c) || c.charCodeAt(0) >= 128;
  var isHex = (c) => /[0-9a-fA-F]/.test(c);
  var validEscape = (s, i) => s[i] === "\\" && i + 1 < s.length && s[i + 1] !== "\n";
  function escape(s, i) {
    if (isHex(s[i])) {
      let j = i;
      while (j < s.length && j - i < 6 && isHex(s[j])) j++;
      const cp = parseInt(s.slice(i, j), 16);
      if (isWs(s[j] ?? "")) j++;
      return [cp === 0 || cp > 1114111 ? "\uFFFD" : String.fromCodePoint(cp), j];
    }
    return [s[i], i + 1];
  }
  function startsIdent(s, i) {
    const c = s[i] ?? "";
    if (c === "-") return isNameStart(s[i + 1] ?? "") || s[i + 1] === "-" || validEscape(s, i + 1);
    return isNameStart(c) || validEscape(s, i);
  }
  function tokenize(s) {
    const out = [];
    let i = 0;
    const push = (type, start2, value3 = "") => out.push({ type, start: start2, end: i, value: value3 });
    while (i < s.length) {
      const start2 = i;
      const c = s[i];
      if (c === "/" && s[i + 1] === "*") {
        const close = s.indexOf("*/", i + 2);
        i = close < 0 ? s.length : close + 2;
        push("comment", start2);
      } else if (isWs(c)) {
        while (i < s.length && isWs(s[i])) i++;
        push("ws", start2);
      } else if (c === '"' || c === "'") {
        i++;
        let body = "";
        while (i < s.length && s[i] !== c && s[i] !== "\n") {
          if (s[i] === "\\") {
            if (s[i + 1] === "\n") {
              i += 2;
              continue;
            }
            if (i + 1 >= s.length) {
              i++;
              break;
            }
            const [ch, next] = escape(s, i + 1);
            body += ch;
            i = next;
          } else body += s[i++];
        }
        if (s[i] === c) i++;
        push("string", start2, body);
      } else if (startsIdent(s, i)) {
        let name = "";
        while (i < s.length) {
          if (validEscape(s, i)) {
            const [ch, next] = escape(s, i + 1);
            name += ch;
            i = next;
          } else if (isName(s[i])) name += s[i++];
          else break;
        }
        if (s[i] === "(") {
          i++;
          if (name.toLowerCase() === "url") {
            let j = i;
            while (isWs(s[j] ?? "")) j++;
            if (s[j] !== '"' && s[j] !== "'") {
              let body = "";
              while (i < s.length && s[i] !== ")") {
                if (validEscape(s, i)) {
                  const [ch, next] = escape(s, i + 1);
                  body += ch;
                  i = next;
                } else body += s[i++];
              }
              if (s[i] === ")") i++;
              push("url", start2, body.trim());
              continue;
            }
          }
          push("function", start2, name.toLowerCase());
        } else push("ident", start2, name);
      } else if ("()[]{};:,".includes(c)) {
        i++;
        push(c, start2, c);
      } else {
        i++;
        push("delim", start2, c);
      }
    }
    return out;
  }
  function matching(tokens, open) {
    let depth = 0;
    for (let i = open; i < tokens.length; i++) {
      const t = tokens[i].type;
      if (t === "(" || t === "[" || t === "{" || t === "function") depth++;
      else if (t === ")" || t === "]" || t === "}") {
        depth--;
        if (depth === 0) return i;
      }
    }
    return tokens.length;
  }

  // src/core/format.ts
  var fmt = (v) => String(Math.round(v * 1e4) / 1e4 + 0);

  // src/state/values.ts
  var NUMBER = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([a-z%]*)$/i;
  function parseTyped(text2) {
    const s = text2.trim();
    if (!s) throw new Error("a value is required");
    const q = /^(["'])((?:\\.|(?!\1)[^\\])*)\1$/s.exec(s);
    if (q) return { type: "string", v: q[2].replace(/\\(.)/gs, "$1") };
    if (/^(true|false)$/i.test(s)) return { type: "boolean", v: s.toLowerCase() === "true" };
    const m = NUMBER.exec(s);
    if (m) return m[2] ? { type: "dimension", v: +m[1], unit: m[2].toLowerCase() } : { type: "number", v: +m[1], unit: "" };
    if (/[,;{}]/.test(s)) throw new Error(`"${s}" is not a single value`);
    return { type: "value", v: s };
  }
  function serialize(t) {
    if (t.type === "boolean") return t.v ? "1" : "0";
    if (t.type === "value") return t.v;
    if (t.type === "string") return '"' + t.v.replace(/[\\"]/g, "\\$&").replace(/[\0-\x1f\x7f]/g, (c) => "\\" + c.charCodeAt(0).toString(16) + " ") + '"';
    return fmt(t.v) + (t.unit ?? "");
  }
  var UNITS = {
    px: ["length", 1],
    cm: ["length", 96 / 2.54],
    mm: ["length", 96 / 25.4],
    q: ["length", 96 / 101.6],
    in: ["length", 96],
    pt: ["length", 4 / 3],
    pc: ["length", 16],
    deg: ["angle", 1],
    grad: ["angle", 0.9],
    rad: ["angle", 180 / Math.PI],
    turn: ["angle", 360],
    s: ["time", 1e3],
    ms: ["time", 1],
    hz: ["frequency", 1],
    khz: ["frequency", 1e3]
  };
  function convert(a, b) {
    if (a.unit === b.unit) return b.v;
    const ua = UNITS[a.unit], ub = UNITS[b.unit];
    return ua && ub && ua[0] === ub[0] ? b.v * ub[1] / ua[1] : void 0;
  }
  function assignable(to, from) {
    if (to.type === "value" || to.type === "string") return from.type === to.type;
    if (to.type !== from.type) return false;
    return to.type !== "dimension" || convert(to, from) !== void 0;
  }
  function coerce(to, from) {
    return to.type === "dimension" ? { type: "dimension", v: convert(to, from), unit: to.unit } : from;
  }
  function equal(a, b) {
    return a.type === b.type && a.v === b.v && a.unit === b.unit;
  }
  var TOKEN = /\s*((?:previous|direction)\(\s*--[\w-]+\s*\)|--[\w-]+|>=|<=|==|!=|>|<|\(|\)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?[a-z%]*|#[0-9a-f]+|[a-z_][\w-]*)/iy;
  var OPS = /* @__PURE__ */ new Set(["==", "!=", ">", "<", ">=", "<="]);
  function parseCondition(text2) {
    const toks = [];
    let pos = 0;
    TOKEN.lastIndex = 0;
    let m;
    while (m = TOKEN.exec(text2)) {
      toks.push(m[1]);
      pos = TOKEN.lastIndex;
    }
    if (text2.slice(pos).trim()) throw new Error(`cannot read condition "${text2}" near "${text2.slice(pos).trim()}"`);
    let i = 0;
    const names = /* @__PURE__ */ new Set();
    const peek = () => toks[i]?.toLowerCase();
    const fail = (what) => {
      throw new Error(`condition "${text2}": ${what}`);
    };
    const operand = () => {
      const t = toks[i++];
      if (t === void 0) fail("expression ends too early");
      if (t === "(") {
        const e = or();
        if (toks[i++] !== ")") fail('missing ")"');
        return e;
      }
      if (t.startsWith("--")) {
        names.add(t);
        return { k: "ref", name: t };
      }
      const fn = /^(previous|direction)\(\s*(--[\w-]+)\s*\)$/i.exec(t);
      if (fn) {
        names.add(fn[2]);
        return { k: fn[1].toLowerCase() === "previous" ? "prev" : "dir", name: fn[2] };
      }
      if (t === ")" || OPS.has(t) || /^(and|or|not)$/i.test(t)) fail(`unexpected "${t}"`);
      return { k: "lit", t: parseTyped(t) };
    };
    const cmp = () => {
      const a = operand();
      if (!OPS.has(toks[i])) return a;
      const op = toks[i++];
      return { k: "cmp", op, a, b: operand() };
    };
    const not = () => peek() === "not" ? (i++, { k: "not", a: not() }) : cmp();
    const and = () => {
      let a = not();
      while (peek() === "and") {
        i++;
        a = { k: "and", a, b: not() };
      }
      return a;
    };
    const or = () => {
      let a = and();
      while (peek() === "or") {
        i++;
        a = { k: "or", a, b: and() };
      }
      return a;
    };
    const ast = or();
    if (i < toks.length) fail(`unexpected "${toks[i]}"`);
    return { ast, names: [...names], text: text2 };
  }
  var ConditionError = class extends Error {
  };
  function direction(s, name = "the state") {
    const { value: a, previous: b } = s;
    if (a.type !== "number" && a.type !== "dimension" || a.type !== b.type || a.unit !== b.unit)
      throw new ConditionError(`direction(${name}) needs a number or dimension state, not a ${a.type}`);
    const d = a.v - b.v;
    return { type: "number", v: d > 0 ? 1 : d < 0 ? -1 : 0, unit: "" };
  }
  function evaluate(c, lookup) {
    switch (c.k) {
      case "not": {
        const a = evaluate(c.a, lookup);
        return a === void 0 ? void 0 : !a;
      }
      // Three-valued: unknown and false = false, unknown or true = true.
      case "and": {
        const a = evaluate(c.a, lookup);
        if (a === false) return false;
        const b = evaluate(c.b, lookup);
        return b === false ? false : a === void 0 || b === void 0 ? void 0 : true;
      }
      case "or": {
        const a = evaluate(c.a, lookup);
        if (a === true) return true;
        const b = evaluate(c.b, lookup);
        return b === true ? true : a === void 0 || b === void 0 ? void 0 : false;
      }
      case "cmp": {
        const a = value(c.a, lookup), b = value(c.b, lookup);
        return a === void 0 || b === void 0 ? void 0 : compare(c.op, a, b);
      }
      default: {
        const t = value(c, lookup);
        if (t === void 0) return void 0;
        if (t.type !== "boolean") throw new ConditionError(`${describe(c)} is ${t.type === "value" ? `"${t.v}"` : serialize(t)}, not a boolean; compare it explicitly (for example ${describe(c)} != 0)`);
        return t.v;
      }
    }
  }
  function value(c, lookup) {
    if (c.k === "ref") return lookup(c.name)?.value;
    if (c.k === "prev") return lookup(c.name)?.previous;
    if (c.k === "dir") {
      const s = lookup(c.name);
      return s && direction(s, c.name);
    }
    if (c.k === "lit") return c.t;
    const r = evaluate(c, lookup);
    return r === void 0 ? void 0 : { type: "boolean", v: r };
  }
  var describe = (c) => c.k === "ref" ? c.name : c.k === "prev" ? `previous(${c.name})` : c.k === "dir" ? `direction(${c.name})` : c.k === "lit" ? serialize(c.t) : "expression";
  function compare(op, a, b) {
    const ordered = op !== "==" && op !== "!=";
    if (a.type === "boolean" || b.type === "boolean" || a.type === "value" || b.type === "value" || a.type === "string" || b.type === "string") {
      if (a.type !== b.type) throw new ConditionError(`cannot compare ${serialize(a)} (${a.type}) with ${serialize(b)} (${b.type})`);
      if (ordered) throw new ConditionError(`${op} needs numbers, got ${a.type} values`);
      const eq = a.type === "value" ? String(a.v).toLowerCase() === String(b.v).toLowerCase() : a.v === b.v;
      return op === "==" ? eq : !eq;
    }
    const zero = (t) => t.v === 0 && t.type === "number";
    const bv = a.unit === b.unit || zero(a) || zero(b) ? b.v : convert(a, b);
    if (bv === void 0 || a.type !== b.type && !zero(a) && !zero(b))
      throw new ConditionError(`cannot compare ${serialize(a)} with ${serialize(b)}: incompatible units`);
    const av = a.v;
    switch (op) {
      case "==":
        return av === bv;
      case "!=":
        return av !== bv;
      case ">":
        return av > bv;
      case "<":
        return av < bv;
      case ">=":
        return av >= bv;
      default:
        return av <= bv;
    }
  }

  // src/state/expr.ts
  var ATTR_NAME = /^[a-z_][\w.-]*$/i;
  function call(text2) {
    const toks = tokenize(text2);
    const first = toks.findIndex((t) => t.type !== "ws" && t.type !== "comment");
    const f = toks[first];
    if (f?.type !== "function") return void 0;
    const close = matching(toks, first);
    if (toks.slice(close + 1).some((t) => t.type !== "ws" && t.type !== "comment")) return void 0;
    const args = [];
    let from = f.end;
    for (let j = first + 1; j < close; j++) {
      const t = toks[j];
      if (t.type === "function" || t.type === "(" || t.type === "[") j = matching(toks, j);
      else if (t.type === ",") {
        args.push(text2.slice(from, t.start));
        from = t.end;
      }
    }
    args.push(text2.slice(from, toks[close].start));
    return { name: f.value, args: args.length === 1 && !args[0].trim() ? [] : args };
  }
  function stringLiteral(text2, what) {
    const t = parseTyped(text2);
    if (t.type !== "string") throw new Error(`${what} must be a quoted string, got ${text2.trim()}`);
    return t.v;
  }
  var EXPRESSIONS = ["attr", "pick", "split"];
  function parseExpr(text2, top = true) {
    const c = call(text2);
    if (!c || !EXPRESSIONS.includes(c.name)) return { k: "lit", t: parseTyped(text2) };
    if (c.name === "attr") {
      if (c.args.length < 1 || c.args.length > 2) throw new Error('expected attr(name) or attr(name, "fallback")');
      const name = c.args[0].trim();
      if (!ATTR_NAME.test(name))
        throw new Error(`attr(${name}): expected an attribute name like data-message (typed attr(name type(...)) is not supported in state() and set())`);
      if (c.args[1] !== void 0 && /[(,]/.test(c.args[1])) throw new Error("the attr() fallback must be one value, e.g. attr(data-n, 0)");
      return { k: "attr", name: name.toLowerCase(), fallback: c.args[1] === void 0 ? { type: "string", v: "" } : parseTyped(c.args[1]) };
    }
    if (c.name === "split") {
      if (top) throw new Error('split() makes a list; use it inside pick(), e.g. pick(split(attr(data-options), "|"))');
      if (c.args.length !== 2) throw new Error('expected split(text, "delimiter")');
      const of = parseExpr(c.args[0], false);
      if (of.k === "pick" || of.k === "split" || of.k === "lit" && of.t.type !== "string")
        throw new Error("split() splits a quoted string or attr()");
      const sep = stringLiteral(c.args[1], "the split() delimiter");
      if (!sep) throw new Error("the split() delimiter must not be empty");
      return { k: "split", of, sep };
    }
    if (!c.args.length) throw new Error("pick() needs at least one value");
    const items = c.args.map((a) => parseExpr(a, false));
    if (items.some((e) => e.k === "split") && items.length > 1) throw new Error("split() must be the only argument of pick()");
    if (items.some((e) => e.k === "pick")) throw new Error("pick() cannot be nested");
    const types = new Set(items.map((e) => e.k === "lit" ? e.t.type : e.k === "attr" ? e.fallback.type : "string"));
    if (types.size > 1) throw new Error("pick() values must all have the same type (attr() and split() give strings)");
    return { k: "pick", items };
  }
  var readsAttributes = (e) => e.k === "attr" || e.k === "pick" && e.items.some(readsAttributes) || e.k === "split" && readsAttributes(e.of);
  var SENSITIVE = /^(current-password|new-password|one-time-code|cc-|webauthn)/i;
  function sensitive(el) {
    return el.tagName === "INPUT" && el.type === "password" || el.autocomplete?.split(/\s+/).some((t) => SENSITIVE.test(t));
  }
  function attribute(e, el) {
    const raw = sensitive(el) ? null : el.getAttribute(e.name);
    if (raw === null) return e.fallback;
    if (e.fallback.type === "string") return str(raw);
    try {
      const t = parseTyped(raw);
      return t.type === e.fallback.type && (t.type !== "value" || /^-?[a-z_][\w-]*$/i.test(t.v)) ? t : e.fallback;
    } catch {
      return e.fallback;
    }
  }
  var str = (v) => ({ type: "string", v });
  function list(e, el) {
    if (e.k === "split") {
      const s = scalar(e.of, el);
      if (!s) return [];
      return s.v.split(e.sep).map((x) => x.trim()).filter(Boolean).map(str);
    }
    const v = scalar(e, el);
    return v ? [v] : [];
  }
  function scalar(e, el) {
    switch (e.k) {
      case "lit":
        return e.t;
      case "attr":
        return attribute(e, el);
      case "split":
        return void 0;
      // a list is never a value
      case "pick": {
        const all = e.items.flatMap((x) => list(x, el));
        return all.length ? all[Math.floor(Math.random() * all.length)] : void 0;
      }
    }
  }
  var evaluate2 = scalar;

  // src/core/registry.ts
  var functions = /* @__PURE__ */ new Map();
  var selectors = /* @__PURE__ */ new Map();
  var NAME = /^[a-z][a-z0-9-]*$/;
  function defineFunction(def) {
    if (!NAME.test(def.name)) throw new Error(`Invalid function name "${def.name}"`);
    functions.set(def.name.toLowerCase(), def);
  }
  function defineSelector(def) {
    if (!NAME.test(def.name)) throw new Error(`Invalid selector name "${def.name}"`);
    selectors.set(def.name.toLowerCase(), def);
  }
  var runtimeStats = {
    sheets: 0,
    /** Element-declaration pairs currently bound (shared declarations count each element). */
    bindings: 0,
    /** Event listeners and source subscriptions held by bindings. */
    sources: 0,
    /** Shared IntersectionObservers and the shared pointer listener currently alive. */
    observers: 0,
    parseMs: 0,
    /** State cells alive, and effective state changes so far. */
    states: 0,
    stateChanges: 0
  };
  var ACTION_EVENTS = /* @__PURE__ */ new Set([
    "click",
    "change",
    "input",
    "pointerenter",
    "pointerleave",
    "focus",
    "blur",
    // 0.5.1: focus moving in or out of a subtree, form reset, and the end or cancellation of the
    // element's own animations and transitions (target only: a child's animation does not count).
    "focusin",
    "focusout",
    "reset",
    "animationend",
    "animationcancel",
    "transitionend",
    "transitioncancel"
  ]);
  var OUTSIDE_EVENTS = /* @__PURE__ */ new Set(["click", "pointerdown", "focusin"]);
  var CANCELABLE_TRIGGERS = /* @__PURE__ */ new Set(["click", "keydown"]);
  var actions = /* @__PURE__ */ new Map();
  var runtimes = {};
  var onEventNames = [];
  var onEvents = () => [...onEventNames];
  function defineAction(def) {
    if (!NAME.test(def.name)) throw new Error(`Invalid action name "${def.name}"`);
    actions.set(def.name, def);
  }
  function describe2() {
    return {
      /** Feature IDs in this bundle (src/features/catalog.ts); null when built from source (all). */
      bundle: typeof define_RCSS_BUNDLE_default !== "undefined" ? define_RCSS_BUNDLE_default : null,
      version: VERSION,
      features: FEATURES,
      keepNative: KEEP_NATIVE,
      functions: [...functions.values()].map((f) => ({ name: f.name, kind: f.kind, syntax: f.syntax })),
      selectors: [...selectors.values()].map((s) => ({ name: s.name, kind: s.kind, syntax: s.syntax })),
      actions: [...actions.values()].map((a) => ({ name: a.name, syntax: a.syntax })),
      expressions: EXPRESSIONS,
      events: [...ACTION_EVENTS],
      outsideEvents: [...OUTSIDE_EVENTS],
      /** 0.9.0: functions that exist only inside :on() mutations. */
      actionExpressions: ["event"],
      /** 0.9.0: events :on() accepts in this bundle (empty without the events feature). */
      onEvents: onEvents()
    };
  }
  var refreshers = /* @__PURE__ */ new Set();
  var sheetChangeHooks = /* @__PURE__ */ new Set();

  // src/core/log.ts
  var dev = true;
  var probes = {};
  var msg = (s) => s;
  var diagnostics = [];
  if (dev) probes.diagnostics = () => diagnostics.length;
  var summarized = false;
  var source = "";
  function withSource(label, fn) {
    const prev = source;
    source = label;
    try {
      return fn();
    } finally {
      source = prev;
    }
  }
  function warn(message) {
    if (source) message = `${source}: ${message}`;
    if (diagnostics.includes(message)) return;
    diagnostics.push(message);
    if (dev) console.warn("[reactive-css] " + message);
    else if (!summarized) {
      summarized = true;
      setTimeout(() => console.warn(`[reactive-css] ${diagnostics.length} issue(s). See ReactiveCSS.diagnostics: codes such as RCSS-P001 are explained by \`npx reactive-css explain\` (dist/diagnostics.json), or load reactive-css.js for full messages.`));
    }
  }
  function note(message) {
    if (diagnostics.includes(message)) return;
    diagnostics.push(message);
    if (dev) console.info("[reactive-css] " + message);
  }

  // src/core/scheduler.ts
  var groups = /* @__PURE__ */ new Map();
  var queue = [];
  var urgent = [];
  var urgentDepth = 0;
  var fresh = [];
  var lateJobs = [];
  var recheck = /* @__PURE__ */ new Set();
  var frameTasks = /* @__PURE__ */ new Set();
  var timer;
  var raf = 0;
  if (dev) Object.assign(probes, {
    queued: () => queue.length + urgent.length + lateJobs.length + recheck.size,
    fresh: () => fresh.length,
    frameTasks: () => frameTasks.size,
    rafPending: () => +!!raf,
    timerPending: () => +(timer !== void 0)
  });
  var counters = {
    flushes: 0,
    lastFlushMs: 0,
    totalFlushMs: 0,
    ticks: 0,
    tickMs: 0,
    /** Flush phases: event sources, evaluation (reads), DOM writes. */
    sourceMs: 0,
    computeMs: 0,
    writeMs: 0,
    jobs: 0,
    writes: 0,
    /** sync() runs that applied pending urgent work before an event. */
    syncs: 0,
    /** Late phases run at the end of event-driven work instead of in the frame (attr:). */
    prompt: 0
  };
  var now = () => performance.now();
  var hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";
  function arm() {
    clearTimeout(timer);
    timer = void 0;
    if (hidden() || groups.size === 0) return;
    let next = Infinity;
    for (const g of groups.values()) next = Math.min(next, g.next);
    timer = setTimeout(tick, Math.max(0, next - now()));
  }
  function tick() {
    const t = now();
    for (const g of groups.values()) {
      if (g.next > t + 1) continue;
      counters.ticks++;
      for (const s of g.subs) s.tick();
      g.next += g.ms;
      if (g.next <= t) g.next = t + g.ms;
    }
    counters.tickMs += now() - t;
    arm();
  }
  function every(ms, sub) {
    let g = groups.get(ms);
    if (!g) {
      g = { ms, next: now() + ms, subs: /* @__PURE__ */ new Set() };
      groups.set(ms, g);
      arm();
    }
    g.subs.add(sub);
  }
  function unevery(ms, sub) {
    const g = groups.get(ms);
    if (!g || !g.subs.delete(sub) || g.subs.size) return;
    groups.delete(ms);
    arm();
  }
  var FRAME_BUDGET_MS = 4;
  var costPerJob = 5e-4;
  function request() {
    if (!raf) raf = requestAnimationFrame(frameFlush);
  }
  function frameFlush() {
    raf = 0;
    flush(Math.max(256, Math.floor(FRAME_BUDGET_MS / costPerJob)));
  }
  function dirty(job) {
    if (job.queued) return;
    job.queued = true;
    (urgentDepth ? urgent : queue).push(job);
    request();
  }
  var activation = { event: null };
  var afterLate = /* @__PURE__ */ new Set();
  function onAfterLate(fn) {
    afterLate.add(fn);
  }
  var soon = false;
  function late(job, promptly = false) {
    if (promptly && urgentDepth) soon = true;
    if (job.queued) return;
    job.queued = true;
    lateJobs.push(job);
    request();
  }
  function urgently(fn) {
    urgentDepth++;
    try {
      return fn();
    } finally {
      if (--urgentDepth === 0 && soon) {
        soon = false;
        sync();
        const done = lateJobs.slice();
        if (runLate()) {
          for (const j of done) late(j);
          runLate();
        }
        for (const j of done) recheck.add(j);
        request();
        counters.prompt++;
        for (const fn2 of afterLate) fn2(true);
      }
    }
  }
  function runLate() {
    if (!lateJobs.length) return 0;
    const list3 = lateJobs;
    lateJobs = [];
    let w = 0;
    for (let i = 0; i < list3.length; i++) {
      list3[i].queued = false;
      if (list3[i].compute()) list3[w++] = list3[i];
    }
    for (let i = 0; i < w; i++) list3[i].write();
    return w;
  }
  function settleLater(job) {
    fresh.push(job);
  }
  function settle() {
    const list3 = fresh;
    fresh = [];
    const writes = list3.filter((j) => j.compute());
    for (const j of writes) j.write();
  }
  var syncHooks = /* @__PURE__ */ new Set();
  function onSync(fn) {
    syncHooks.add(fn);
  }
  function sync() {
    if (!urgent.length) return;
    for (const fn of syncHooks) fn();
    const jobs = urgent;
    urgent = [];
    let w = 0;
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      job.queued = false;
      if (job.compute()) jobs[w++] = job;
    }
    for (let i = 0; i < w; i++) jobs[i].write();
    counters.syncs++;
  }
  function frame(fn) {
    frameTasks.add(fn);
    request();
  }
  function flush(limit = Infinity) {
    const t0 = now();
    const tasks = [...frameTasks];
    frameTasks.clear();
    for (const fn of tasks) fn();
    const t1 = now();
    const all = queue;
    const n0 = Math.min(all.length, limit);
    queue = n0 < all.length ? all.slice(n0) : [];
    if (queue.length) request();
    const jobs = urgent.length ? urgent.concat(n0 < all.length ? all.slice(0, n0) : all) : all;
    const n = urgent.length + n0;
    urgent = [];
    let w = 0;
    for (let i = 0; i < n; i++) {
      const job = jobs[i];
      job.queued = false;
      if (job.compute()) jobs[w++] = job;
    }
    const t2 = now();
    for (let i = 0; i < w; i++) jobs[i].write();
    for (const j of recheck) late(j);
    recheck.clear();
    runLate();
    for (const fn of afterLate) fn(false);
    const t3 = now();
    if (n >= 64) costPerJob = costPerJob * 0.7 + (t3 - t1) / n * 0.3;
    counters.flushes++;
    counters.jobs += n;
    counters.writes += w;
    counters.sourceMs += t1 - t0;
    counters.computeMs += t2 - t1;
    counters.writeMs += t3 - t2;
    counters.lastFlushMs = t3 - t0;
    counters.totalFlushMs += t3 - t0;
  }
  function subscriptionCount() {
    let n = 0;
    for (const g of groups.values()) n += g.subs.size;
    return n;
  }
  function groupCount() {
    return groups.size;
  }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (!hidden()) {
        const t = now();
        for (const g of groups.values()) if (g.next < t) g.next = t;
      }
      arm();
    });
  }

  // src/state/state.ts
  var cellsOf = /* @__PURE__ */ new WeakMap();
  var stateChangeHooks = /* @__PURE__ */ new Set();
  var waiting = /* @__PURE__ */ new Map();
  var Cell = class {
    constructor(owner, name, value3) {
      this.owner = owner;
      this.name = name;
      this.value = value3;
      this.previous = value3;
      this.initial = value3;
      this.shown = serialize(value3);
    }
    owner;
    name;
    value;
    queued;
    previous;
    /** Number of effective changes; 0 means still at the initial value. */
    version = 0;
    subs = /* @__PURE__ */ new Set();
    /** Generated properties of every state() declaration currently matching the owner. */
    vars = [];
    /** What CSS currently sees. Initially the var() fallback, so nothing is written at start. */
    shown;
    force = false;
    dead = false;
    /** The initial value (used by form reset of bound controls). */
    initial;
    /** The state() declaration whose initializer set the initial value. */
    initFrom;
    /** The owner's attribute bound by the winning declaration (bind()). */
    bound;
    /** Storage of a persist() state. */
    persisted;
    /** The initial value came from storage: it wins over an edited bound control (bind.ts). */
    restored = false;
    /** Applies a new value; returns false when nothing changed. Notifies each subscriber once. */
    set(next) {
      if (this.dead || equal(next, this.value)) return false;
      this.previous = this.value;
      this.value = next;
      this.version++;
      runtimeStats.stateChanges++;
      this.bound?.write(next);
      this.persisted?.changed();
      dirty(this);
      for (const s of this.subs) s.notify();
      for (const fn of stateChangeHooks) fn(this);
      return true;
    }
    /** Write the current value to every generated property (after a second declaration attached). */
    writeAll() {
      this.force = true;
      settleLater(this);
    }
    compute() {
      if (this.dead) return false;
      const s = serialize(this.value);
      if (s === this.shown && !this.force) return false;
      this.shown = s;
      return true;
    }
    write() {
      this.force = false;
      for (const v of this.vars) this.owner.style.setProperty(v, this.shown);
    }
  };
  function resolveCell(el, name, scope) {
    if (!scope) return findCell(el, name);
    let owner = null;
    try {
      owner = el.closest(scope);
    } catch {
      warn(`closest(${scope}): not a valid selector.`);
    }
    return owner ? cellsOf.get(owner)?.find((c) => c.name === name) : void 0;
  }
  function findCell(el, name) {
    for (let a = el; a; a = a.parentElement) {
      const list3 = cellsOf.get(a);
      if (list3) {
        for (const c of list3) if (c.name === name) return c;
      }
    }
    return void 0;
  }
  function within(bound, owner, fn) {
    if (bound.size <= 64) {
      for (const [el, b] of bound) if (owner === el || owner.contains(el)) fn(b);
      return;
    }
    const self = bound.get(owner);
    if (self) fn(self);
    for (const el of owner.getElementsByTagName("*")) {
      const b = bound.get(el);
      if (b) fn(b);
    }
  }
  var describeElement = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.classList.length ? "." + [...el.classList].join(".") : "");
  function warnMissing(name, el, user) {
    warn(`${user} uses ${name}, but no element declares "${name}: state(...)" on ${describeElement(el)} or its ancestors. Nothing is changed.`);
  }
  var StateRef = class {
    /** optional: an ordinary custom property is fine too (no warning when no state exists). */
    constructor(el, name, sub, optional = false, scope) {
      this.el = el;
      this.name = name;
      this.sub = sub;
      this.optional = optional;
      this.scope = scope;
    }
    el;
    name;
    sub;
    optional;
    scope;
    cell;
    resolved = false;
    /** Current value, or undefined when no state can be resolved. */
    get() {
      return this.state()?.value;
    }
    /** The resolved cell (current value, previous value, version), or undefined. */
    state() {
      if (!this.resolved) this.resolve();
      return this.cell;
    }
    resolve() {
      this.resolved = true;
      const c = resolveCell(this.el, this.name, this.scope);
      if (c !== this.cell) {
        this.cell?.subs.delete(this);
        this.cell = c;
        c?.subs.add(this);
      }
      if (c) {
        waiting.get(this.name)?.delete(this);
        return;
      }
      let set = waiting.get(this.name);
      if (!set) waiting.set(this.name, set = /* @__PURE__ */ new Set());
      set.add(this);
      if (!this.optional) suspect(this);
    }
    notify() {
      this.sub.notify();
    }
    /** Resolve again on the next get(), and tell the consumer to re-evaluate. */
    invalidate() {
      this.resolved = false;
      this.sub.notify();
    }
    dispose() {
      this.cell?.subs.delete(this);
      waiting.get(this.name)?.delete(this);
      this.cell = void 0;
    }
  };
  var suspects = /* @__PURE__ */ new Set();
  var registeredVars = 0;
  if (dev) Object.assign(probes, {
    waitingRefs: () => {
      let n = 0;
      for (const s of waiting.values()) n += s.size;
      return n;
    },
    waitingNames: () => waiting.size,
    suspects: () => suspects.size,
    registeredStateVars: () => registeredVars
  });
  var suspectTimer;
  function suspect(r) {
    suspects.add(r);
    suspectTimer ??= setTimeout(() => {
      suspectTimer = void 0;
      for (const s of suspects) if (!s.cell && s.el.isConnected && waiting.get(s.name)?.has(s)) warnMissing(s.name, s.el, "A condition");
      suspects.clear();
    }, 1e3);
  }
  function initialize(c, owner, d) {
    let v = evaluate2(d.init, owner) ?? EMPTY;
    let bound = c?.bound;
    if (bound && bound.name !== d.bind?.name) {
      bound.release();
      bound = void 0;
    }
    if (d.bind) {
      bound ??= runtimes.attrBinding(owner, d.bind);
      v = bound.initial(v);
    }
    const stored = d.persist && runtimes.persist.initial(d.persist, owner, v);
    return [stored ?? v, bound, !!stored];
  }
  function relink(c, d) {
    c.persisted?.release();
    c.persisted = d.persist ? runtimes.persist.link(d.persist, c) : void 0;
  }
  function createCell(owner, d) {
    const [v, bound, restored] = initialize(void 0, owner, d);
    const c = new Cell(owner, d.name, v);
    c.initFrom = d;
    c.bound = bound;
    c.restored = restored;
    relink(c, d);
    c.vars.push(d.varName);
    if (d.init.k !== "lit" || bound || restored) c.writeAll();
    bound?.write(v);
    const list3 = cellsOf.get(owner);
    if (list3) list3.push(c);
    else cellsOf.set(owner, [c]);
    runtimeStats.states++;
    const w = waiting.get(d.name);
    if (w) {
      for (const r of [...w]) if (owner.contains(r.el)) r.invalidate();
    }
    const outer = findCell(owner.parentElement, d.name);
    if (outer) {
      for (const r of [...outer.subs]) if (owner.contains(r.el)) r.invalidate();
    }
  }
  function disposeCell(c) {
    c.dead = true;
    c.bound?.release();
    c.persisted?.release();
    const list3 = cellsOf.get(c.owner);
    list3.splice(list3.indexOf(c), 1);
    if (!list3.length) cellsOf.delete(c.owner);
    runtimeStats.states--;
    for (const r of [...c.subs]) {
      c.subs.delete(r);
      r.invalidate();
    }
  }
  function attach(owner, d) {
    const c = cellsOf.get(owner)?.find((x) => x.name === d.name);
    if (!c) return createCell(owner, d);
    c.vars.push(d.varName);
    if (c.version === 0 && c.initFrom !== d && cascadeWinner(owner, d) === d.id) {
      c.initFrom = d;
      const [v, bound, restored] = initialize(c, owner, d);
      c.bound = bound;
      c.restored = restored;
      relink(c, d);
      if (!equal(v, c.value)) {
        c.value = c.previous = c.initial = v;
        for (const s of c.subs) s.notify();
      }
      bound?.write(v);
    }
    c.writeAll();
  }
  var EMPTY = { type: "string", v: "" };
  var cascadeWinner = (owner, d) => +getComputedStyle(owner).getPropertyValue(d.varName + "-w");
  function detach(owner, d) {
    const c = cellsOf.get(owner)?.find((x) => x.name === d.name);
    if (!c) return;
    c.vars.splice(c.vars.indexOf(d.varName), 1);
    if (!c.vars.includes(d.varName)) owner.style.removeProperty(d.varName);
    if (!c.vars.length) disposeCell(c);
  }
  function stateWatcher(match, decls) {
    for (const d of decls) {
      try {
        CSS.registerProperty({ name: d.varName, syntax: "*", inherits: false });
        registeredVars++;
      } catch {
      }
    }
    return {
      selector: match,
      add(el) {
        if ("style" in el) for (const d of decls) attach(el, d);
      },
      remove(el) {
        for (const d of decls) detach(el, d);
      }
    };
  }

  // src/state/keys.ts
  var ALIASES = { space: " ", esc: "escape", spacebar: " ", del: "delete", up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright" };
  function parseKey(text2) {
    const parts = text2.trim().split("+").map((p) => p.trim());
    let key = parts.pop().toLowerCase();
    if (!key) throw new Error(`"${text2}" is not a key; write for example Escape, ArrowRight or ctrl+k`);
    key = ALIASES[key] ?? key;
    const spec = { key, ctrl: false, shift: false, alt: false, meta: false, printable: [...key].length === 1 };
    for (const m of parts) {
      const k = m.toLowerCase();
      if (!["ctrl", "shift", "alt", "meta"].includes(k)) throw new Error(`unknown modifier "${m}" in "${text2}" (use ctrl, shift, alt, meta)`);
      spec[k] = true;
    }
    return spec;
  }
  function keyMatches(spec, e) {
    if (e.key.toLowerCase() !== spec.key) return false;
    if (e.ctrlKey !== spec.ctrl || e.altKey !== spec.alt || e.metaKey !== spec.meta) return false;
    return spec.printable ? !spec.shift || e.shiftKey : e.shiftKey === spec.shift;
  }

  // src/state/actions.ts
  var BUBBLES = /* @__PURE__ */ new Set(["click", "change", "input", "keydown", "focusin", "focusout", "reset"]);
  var handlerSets = /* @__PURE__ */ new Map();
  var candidates = /* @__PURE__ */ new WeakMap();
  var applies = (c) => c.certain && (!c.sheet || !c.sheet.disabled && (!c.sheet.media.length || matchMedia(c.sheet.media.mediaText).matches));
  var outsiders = /* @__PURE__ */ new Map();
  var EDITABLE = /* @__PURE__ */ new Set(["text", "search", "email", "url", "tel", "password", "number", "date", "time", "datetime-local", "month", "week"]);
  function editable(t) {
    return t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t instanceof HTMLElement && t.isContentEditable || t instanceof HTMLInputElement && EDITABLE.has(t.type);
  }
  function handlersOf(el) {
    const rules = candidates.get(el);
    if (!rules) return void 0;
    const id2 = rules.length === 1 && applies(rules[0]) ? rules[0].id : +getComputedStyle(el).getPropertyValue("--rcss-on").trim();
    return id2 ? handlerSets.get(id2) : void 0;
  }
  function run(el, list3, e) {
    if (!list3) return;
    for (const h of list3) {
      if (h.key) {
        const k = e;
        if (!keyMatches(h.key, k)) continue;
        if (h.key.printable && !h.key.ctrl && !h.key.alt && !h.key.meta && editable(e.target)) continue;
      }
      for (const a of h.actions) a.def.run(el, a.data, e);
    }
  }
  var listening = /* @__PURE__ */ new Map();
  if (dev) Object.assign(probes, { outsiders: () => outsiders.size, handlerSets: () => handlerSets.size, actionListeners: () => listening.size, cancelingTypes: () => cancelers.size });
  var registered = false;
  function register() {
    if (registered) return;
    registered = true;
    try {
      CSS.registerProperty({ name: "--rcss-on", syntax: "*", inherits: false });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "InvalidModificationError"))
        warn("on: needs CSS.registerProperty() (Chrome 78+, Safari 16.4+, Firefox 128+); event actions may also run on descendants.");
    }
  }
  var lastPressed;
  var onPress = (e) => {
    if (e.target instanceof Element) lastPressed = new WeakRef(e.target);
  };
  function keyPath(e) {
    const path = e.composedPath();
    const t = e.target;
    if (t !== document.body && t !== document.documentElement) return path;
    const pressed = lastPressed?.deref();
    if (!pressed?.isConnected) return path;
    const out = [];
    for (let a = pressed; a; a = a.parentElement) out.push(a);
    return out;
  }
  var extensions = {};
  function dispatch(e) {
    sync();
    const path = e.type === "keydown" || e.type === "keyup" ? keyPath(e) : e.composedPath();
    activation.event = e;
    try {
      urgently(() => {
        const own = BUBBLES.has(e.type) ? path : path.slice(0, 1);
        for (const node of own) if (node instanceof Element) run(node, handlersOf(node)?.get(e.type), e);
        activation.event = null;
        if (outsiders.size) {
          const trigger = "outside:" + e.type;
          for (const el of [...outsiders.keys()]) {
            if (path.includes(el)) continue;
            run(el, handlersOf(el)?.get(trigger), e);
          }
        }
        if (extensions.dispatch) {
          activation.event = e;
          extensions.dispatch(e, path);
        }
      });
    } finally {
      activation.event = null;
    }
  }
  var keyListeners = 0;
  function listen(type, delta) {
    if (type === "keydown" || type === "keyup") {
      keyListeners += delta;
      if (keyListeners > 0 && keyListeners === delta) document.addEventListener("pointerdown", onPress, { capture: true, passive: true });
      if (keyListeners === 0) document.removeEventListener("pointerdown", onPress, { capture: true });
    }
    const n = (listening.get(type) ?? 0) + delta;
    if (n > 0 && n === delta) {
      document.addEventListener(type, dispatch, { capture: true, passive: !cancelers.get(type) });
      runtimeStats.observers++;
    }
    if (n === 0) {
      document.removeEventListener(type, dispatch, { capture: true });
      runtimeStats.observers--;
      listening.delete(type);
    } else listening.set(type, n);
  }
  var cancelers = /* @__PURE__ */ new Map();
  function cancel(type, delta) {
    const before = !!cancelers.get(type);
    const n = (cancelers.get(type) ?? 0) + delta;
    if (n) cancelers.set(type, n);
    else cancelers.delete(type);
    if (before === !!n || !listening.get(type)) return;
    document.removeEventListener(type, dispatch, { capture: true });
    document.addEventListener(type, dispatch, { capture: true, passive: !n });
  }
  var domType = (trigger) => trigger.replace(/^outside:/, "");
  function registerHandlers(id2, set) {
    register();
    handlerSets.set(id2, set);
    const cancels = [...set].filter(([, hs]) => hs.some((h) => h.actions.some((a) => a.def.cancels))).map(([t]) => domType(t));
    for (const t of set.keys()) listen(domType(t), 1);
    for (const t of cancels) cancel(t, 1);
    return () => {
      handlerSets.delete(id2);
      for (const t of cancels) cancel(t, -1);
      for (const t of set.keys()) listen(domType(t), -1);
    };
  }
  function actionWatcher(match, id2, certain, set, sheet) {
    const entry = { id: id2, certain, sheet };
    const outside = [...set.keys()].some((t) => t.startsWith("outside:"));
    return {
      selector: match,
      add(el) {
        const list3 = candidates.get(el);
        if (list3) list3.push(entry);
        else candidates.set(el, [entry]);
        if (outside) outsiders.set(el, (outsiders.get(el) ?? 0) + 1);
      },
      remove(el) {
        const list3 = candidates.get(el);
        if (!list3) return;
        list3.splice(list3.indexOf(entry), 1);
        if (!list3.length) candidates.delete(el);
        if (outside) {
          const n = (outsiders.get(el) ?? 1) - 1;
          if (n) outsiders.set(el, n);
          else outsiders.delete(el);
        }
      }
    };
  }
  var stateName = (s) => {
    if (!s || !/^--[^\s,()]+$/.test(s)) throw new Error(`expected a state name like --open, got "${s ?? ""}"`);
    return s;
  };
  function source2(text2) {
    const s = text2.trim().toLowerCase();
    if (s === "sibling-index()") return { kind: "sibling-index" };
    if (s === "sibling-count()") return { kind: "sibling-count" };
    const e = parseExpr(text2);
    if (e.k === "lit" && s.includes("("))
      throw new Error(`"${text2}" is not supported; use a value, attr(), pick(), sibling-index() or sibling-count()`);
    return { kind: "expr", e };
  }
  function siblingIndex(el) {
    let i = 1;
    for (let s = el.previousElementSibling; s; s = s.previousElementSibling) i++;
    return i;
  }
  function scoped(args) {
    const m = /^closest\((.+)\)$/is.exec(args[args.length - 1]?.trim() ?? "");
    if (!m) return [args, void 0];
    if (!m[1].trim()) throw new Error("closest() needs a selector");
    return [args.slice(0, -1), m[1].trim()];
  }
  function target(el, name, action, scope) {
    const c = resolveCell(el, name, scope);
    if (!c) {
      if (scope) warnMissing(name, el, `${action}() with closest(${scope}) on ${describeElement(el)} (the owner must be exactly that ancestor)`);
      else warnMissing(name, el, `${action}() on ${describeElement(el)}`);
    }
    return c;
  }
  function apply(el, name, action, v, scope) {
    const c = target(el, name, action, scope);
    if (!c) return;
    if (!assignable(c.value, v)) {
      warn(`${action}(${name}, ${serialize(v)}): ${name} holds ${c.value.type === "dimension" ? `a ${c.value.unit} value` : `a ${c.value.type}`}; the value is ignored.`);
      return;
    }
    c.set(coerce(c.value, v));
  }
  defineAction({
    name: "set",
    syntax: "set(--state, value | attr(name) | pick(...) | sibling-index() | sibling-count(), closest(selector)?)",
    compile(all) {
      const [args, scope] = scoped(all);
      if (args.length !== 2) throw new Error("expected set(--state, value)");
      return { name: stateName(args[0]), src: source2(args[1]), scope };
    },
    run(el, d) {
      const s = d.src;
      const v = s.kind === "expr" ? evaluate2(s.e, el) : { type: "number", unit: "", v: s.kind === "sibling-index" ? siblingIndex(el) : el.parentElement?.childElementCount ?? 1 };
      if (v) apply(el, d.name, "set", v, d.scope);
    }
  });
  defineAction({
    name: "toggle",
    syntax: "toggle(--boolean-state, closest(selector)?)",
    compile(all) {
      const [args, scope] = scoped(all);
      if (args.length !== 1) throw new Error("expected toggle(--state)");
      return { name: stateName(args[0]), scope };
    },
    run(el, { name, scope }) {
      const c = target(el, name, "toggle", scope);
      if (!c) return;
      if (c.value.type !== "boolean") {
        warn(`toggle(${name}): ${name} is not a boolean state (state(true) or state(false)).`);
        return;
      }
      c.set({ type: "boolean", v: !c.value.v });
    }
  });
  for (const [name, sign] of [["increment", 1], ["decrement", -1]]) {
    defineAction({
      name,
      syntax: `${name}(--number-state, step = 1, closest(selector)?)`,
      compile(all) {
        const [args, scope] = scoped(all);
        if (args.length < 1 || args.length > 2) throw new Error(`expected ${name}(--state) or ${name}(--state, step)`);
        const step = args[1] === void 0 ? void 0 : parseTyped(args[1]);
        if (step && step.type !== "number" && step.type !== "dimension") throw new Error(`step "${args[1]}" must be a number or a dimension`);
        return { name: stateName(args[0]), step, scope };
      },
      run(el, d) {
        const c = target(el, d.name, name, d.scope);
        if (!c) return;
        const cur = c.value;
        if (cur.type !== "number" && cur.type !== "dimension") {
          warn(`${name}(${d.name}): ${d.name} is not a number or dimension state.`);
          return;
        }
        const step = d.step ?? { type: cur.type, v: 1, unit: cur.unit };
        if (!assignable(cur, step)) {
          warn(`${name}(${d.name}, ${serialize(step)}): the step does not match the unit of ${d.name}.`);
          return;
        }
        c.set({ ...cur, v: Math.round((cur.v + sign * coerce(cur, step).v) * 1e6) / 1e6 });
      }
    });
  }
  function preventEvent(el, e) {
    const t = e.target;
    if (!(t instanceof Node) || !e.composedPath().includes(el)) return;
    if ((e.type === "keydown" || e.type === "keyup") && t !== el && (t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement || t instanceof HTMLElement && t.isContentEditable)) return;
    if (!e.cancelable) {
      warn(`prevent() on ${describeElement(el)}: this ${e.type} event is not cancelable (script-created events need cancelable: true); its default action happens.`);
      return;
    }
    e.preventDefault();
    if (!e.defaultPrevented) {
      warn(`prevent() on ${describeElement(el)} did not cancel the ${e.type} event (a passive listener?); its default action happens.`);
      return;
    }
    if (dev && e.type === "click" && t instanceof Element) {
      const inner = t.closest(INTERACTIVE);
      if (inner && inner !== el && el.contains(inner))
        note(`prevent() on ${describeElement(el)} also cancelled the click on ${describeElement(inner)} inside it (link navigation, toggling or submission). Move the rule to a more specific element if that is not intended.`);
    }
  }
  var INTERACTIVE = "a[href], button, input, select, textarea, summary, label, [contenteditable]";
  defineAction({
    name: "prevent",
    syntax: "prevent()",
    cancels: true,
    compile(args) {
      if (args.length && args.some((a) => a.trim())) throw new Error("prevent() takes no arguments");
      return null;
    },
    run: (el, _d, e) => preventEvent(el, e)
  });
  defineAction({
    name: "cycle",
    syntax: "cycle(--state, value1, value2, ..., closest(selector)?)",
    compile(all) {
      const [args, scope] = scoped(all);
      if (args.length < 3) throw new Error("expected cycle(--state, value1, value2, ...) with at least two values");
      return { name: stateName(args[0]), values: args.slice(1).map((v) => parseTyped(v)), scope };
    },
    // Next value in the list, wrapping around; the first value when the current one is not listed.
    run(el, d) {
      const c = target(el, d.name, "cycle", d.scope);
      if (!c) return;
      const bad = d.values.find((v) => !assignable(c.value, v));
      if (bad) {
        warn(`cycle(${d.name}): ${serialize(bad)} cannot be stored in ${d.name} (${c.value.type}).`);
        return;
      }
      const values = d.values.map((v) => coerce(c.value, v));
      const i = values.findIndex((v) => equal(v, c.value));
      c.set(values[(i + 1) % values.length]);
    }
  });
  runtimes.on = { watcher: actionWatcher, register: registerHandlers };

  // src/state/actexpr.ts
  var EvalError = class extends Error {
  };
  var POINTERISH = ["pointer", "mouse", "drag"];
  var FIELDS = {
    type: "all",
    "client-x": POINTERISH,
    "client-y": POINTERISH,
    "page-x": POINTERISH,
    "page-y": POINTERISH,
    "local-x": POINTERISH,
    "local-y": POINTERISH,
    button: POINTERISH,
    buttons: POINTERISH,
    "pointer-id": ["pointer", "drag"],
    "pointer-type": ["pointer", "drag"],
    pressure: ["pointer", "drag"],
    "alt-key": [...POINTERISH, "keyboard"],
    "ctrl-key": [...POINTERISH, "keyboard"],
    "shift-key": [...POINTERISH, "keyboard"],
    "meta-key": [...POINTERISH, "keyboard"],
    key: ["keyboard"],
    code: ["keyboard"],
    repeat: ["keyboard"],
    value: ["form"],
    "value-as-number": ["form"],
    checked: ["form"],
    x: ["drag"],
    y: ["drag"],
    "delta-x": ["drag"],
    "delta-y": ["drag"],
    "movement-x": ["drag"],
    "movement-y": ["drag"],
    "start-x": ["drag"],
    "start-y": ["drag"],
    "scroll-top": ["scroll"],
    "scroll-left": ["scroll"]
  };
  var fieldsFor = (c) => Object.keys(FIELDS).filter((f) => FIELDS[f] === "all" || FIELDS[f].includes(c));
  var EVENT_FIELDS = Object.keys(FIELDS);
  var NUM = /[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(?:%|[a-z]+)?/iy;
  var IDENT = /-{0,2}[a-z_][\w-]*|#[0-9a-f]+/iy;
  function lex(s) {
    const out = [];
    let i = 0;
    const operand = () => {
      const p = out[out.length - 1];
      return !!p && (p.t === "num" || p.t === "str" || p.t === "id" || p.v === ")");
    };
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) {
        i++;
        continue;
      }
      if (c === '"' || c === "'") {
        let v = "";
        let j = i + 1;
        for (; j < s.length && s[j] !== c; j++) v += s[j] === "\\" && j + 1 < s.length ? s[++j] : s[j];
        if (j >= s.length) throw new Error("unterminated string");
        out.push({ t: "str", v });
        i = j + 1;
        continue;
      }
      if (/[\d.]/.test(c) || (c === "+" || c === "-") && /[\d.]/.test(s[i + 1] ?? "") && !operand()) {
        NUM.lastIndex = i;
        const m = NUM.exec(s);
        if (m) {
          const n = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(.*)$/i.exec(m[0]);
          out.push({ t: "num", v: +n[1], unit: n[2].toLowerCase(), text: m[0] });
          i += m[0].length;
          continue;
        }
      }
      IDENT.lastIndex = i;
      const id2 = c === "-" && s[i + 1] !== "-" && !/[a-z_]/i.test(s[i + 1] ?? "") ? null : IDENT.exec(s);
      if (id2) {
        i += id2[0].length;
        if (s[i] === "(") {
          out.push({ t: "fn", v: id2[0].toLowerCase() });
          i++;
        } else out.push({ t: "id", v: id2[0] });
        continue;
      }
      if ("(),+-*/".includes(c)) {
        out.push({ t: "p", v: c });
        i++;
        continue;
      }
      throw new Error(`unexpected "${c}"`);
    }
    return out;
  }
  var ATTR_NAME2 = /^[a-z_][\w.-]*$/i;
  function parseAction(text2, category, trigger) {
    const toks = lex(text2);
    let i = 0;
    const peek = () => toks[i];
    const fail = (m) => {
      throw new Error(m);
    };
    const expect = (v) => {
      const t = toks[i++];
      if (!t || t.t !== "p" || t.v !== v) fail(`expected "${v}" in "${text2}"`);
    };
    const args = () => {
      const list3 = [];
      if (peek()?.t === "p" && peek().v === ")") {
        i++;
        return list3;
      }
      for (; ; ) {
        list3.push(sum());
        const t = toks[i++];
        if (t?.t === "p" && t.v === ")") return list3;
        if (!(t?.t === "p" && t.v === ",")) fail(`expected "," or ")" in "${text2}"`);
      }
    };
    const word2 = () => {
      const t = peek();
      if (t?.t !== "id") return void 0;
      i++;
      return t.v.toLowerCase();
    };
    function primary() {
      const t = toks[i++];
      if (!t) return fail(`"${text2}" ends too early`);
      if (t.t === "num") return { k: "lit", t: t.unit ? { type: "dimension", v: t.v, unit: t.unit } : { type: "number", v: t.v, unit: "" } };
      if (t.t === "str") return { k: "lit", t: { type: "string", v: t.v } };
      if (t.t === "id") {
        if (t.v.startsWith("--")) fail(`write var(${t.v}) to read a state`);
        return { k: "lit", t: parseTyped(t.v) };
      }
      if (t.t === "p") {
        if (t.v === "(") {
          const e = sum();
          expect(")");
          return e;
        }
        return fail(`unexpected "${t.v}" in "${text2}"`);
      }
      switch (t.v) {
        case "calc": {
          const a = args();
          if (a.length !== 1) fail("calc() takes one expression");
          return a[0];
        }
        case "min":
        case "max": {
          const a = args();
          if (!a.length) fail(`${t.v}() needs at least one value`);
          return { k: "math", fn: t.v, args: a };
        }
        case "clamp": {
          const a = args();
          if (a.length !== 3) fail("expected clamp(min, value, max)");
          return { k: "math", fn: "clamp", args: a };
        }
        case "abs": {
          const a = args();
          if (a.length !== 1) fail("expected abs(value)");
          return { k: "math", fn: "abs", args: a };
        }
        case "round": {
          let mode = "nearest";
          const save = i;
          const w = word2();
          if (w && ["nearest", "up", "down", "to-zero"].includes(w) && peek()?.v === ",") {
            mode = w;
            i++;
          } else i = save;
          const a = args();
          if (a.length < 1 || a.length > 2) fail("expected round([nearest | up | down | to-zero,] value [, interval])");
          return { k: "round", mode, a: a[0], b: a[1] };
        }
        case "var": {
          const n2 = toks[i++];
          if (n2?.t !== "id" || !n2.v.startsWith("--")) fail("expected var(--name)");
          let fallback;
          if (peek()?.v === ",") {
            i++;
            fallback = sum();
          }
          expect(")");
          return { k: "var", name: n2.v, fallback };
        }
        case "event": {
          const f = word2();
          expect(")");
          if (!f || !(f in FIELDS)) fail(`event(${f ?? ""}): unknown field; ${trigger} provides ${fieldsFor(category).join(", ")}`);
          const cats = FIELDS[f];
          if (cats !== "all" && !cats.includes(category)) fail(`event(${f}) is not available for ${trigger}; it provides ${fieldsFor(category).join(", ")}`);
          return { k: "event", field: f };
        }
        case "mouse": {
          const axis = word2();
          let local = false;
          if (peek()?.v === ",") {
            i++;
            const m = word2();
            if (m !== "local" && m !== "viewport") fail("expected mouse(x | y [, viewport | local])");
            local = m === "local";
          }
          expect(")");
          if (axis !== "x" && axis !== "y") fail("expected mouse(x) or mouse(y)");
          if (!POINTERISH.includes(category)) fail(`mouse() in an action needs a pointer or drag trigger; ${trigger} has no pointer position`);
          return { k: "mouse", axis, local };
        }
        case "element":
        case "viewport": {
          const d = word2();
          expect(")");
          if (d !== "width" && d !== "height") fail(`expected ${t.v}(width) or ${t.v}(height)`);
          return { k: "size", of: t.v, dim: d };
        }
        case "attr": {
          const n2 = toks[i++];
          if (n2?.t !== "id" || !ATTR_NAME2.test(n2.v)) fail("expected attr(name) or attr(name, fallback)");
          let fallback;
          if (peek()?.v === ",") {
            i++;
            const f = primary();
            if (f.k !== "lit") fail("the attr() fallback must be a value");
            fallback = f.t;
          }
          expect(")");
          return { k: "attr", name: n2.v.toLowerCase(), fallback };
        }
        case "pick": {
          const a = args();
          if (!a.length) fail("pick() needs at least one value");
          if (a.some((x) => x.k === "split") && a.length > 1) fail("split() must be the only argument of pick()");
          return { k: "pick", items: a };
        }
        case "split": {
          const a = args();
          if (a.length !== 2 || a[1].k !== "lit" || a[1].t.type !== "string" || !a[1].t.v) fail('expected split(text, "delimiter")');
          return { k: "split", of: a[0], sep: a[1].t.v };
        }
        case "random": {
          const a = [];
          a.push(sum());
          expect(",");
          a.push(sum());
          let step;
          if (peek()?.v === ",") {
            i++;
            if (peek()?.t === "id" && peek().v.toLowerCase() === "by") i++;
            step = sum();
          }
          expect(")");
          return { k: "random", min: a[0], max: a[1], step };
        }
        case "sibling-index":
        case "sibling-count":
          expect(")");
          return { k: "sibling", count: t.v === "sibling-count" };
      }
      return fail(`${t.v}() is not available in actions; use calc(), min(), max(), clamp(), round(), abs(), var(), event(), mouse(), element(), viewport(), attr(), pick(), random(), sibling-index() or sibling-count()`);
    }
    function unary() {
      if (peek()?.t === "p" && peek().v === "-") {
        i++;
        return { k: "neg", a: unary() };
      }
      return primary();
    }
    function product() {
      let a = unary();
      while (peek()?.t === "p" && (peek().v === "*" || peek().v === "/")) {
        const op = toks[i++].v;
        a = { k: "op", op, a, b: unary() };
      }
      return a;
    }
    function sum() {
      let a = product();
      while (peek()?.t === "p" && (peek().v === "+" || peek().v === "-")) {
        const op = toks[i++].v;
        a = { k: "op", op, a, b: product() };
      }
      return a;
    }
    if (!toks.length) fail("a value is required");
    const n = sum();
    if (i < toks.length) fail(`unexpected "${toks[i].v}" in "${text2}"`);
    if (n.k === "split") fail("split() makes a list; use it inside pick()");
    return n;
  }
  var px = (v) => ({ type: "dimension", v, unit: "px" });
  var num = (v) => ({ type: "number", v, unit: "" });
  var bool = (v) => ({ type: "boolean", v });
  var str2 = (v) => ({ type: "string", v });
  function numeric(t) {
    if (t.type === "boolean") return num(t.v ? 1 : 0);
    if (t.type === "number" || t.type === "dimension") return t;
    throw new EvalError(`${serialize(t)} is not a number`);
  }
  var round6 = (v) => Math.round(v * 1e6) / 1e6;
  var like = (t, v) => t.type === "dimension" ? { type: "dimension", v: round6(v), unit: t.unit } : num(round6(v));
  function common(list3) {
    const ts = list3.map(numeric);
    const carrier = ts.find((t) => t.type === "dimension") ?? ts[0];
    return [carrier, ts.map((t) => {
      if (t.type === "number") {
        if (carrier.type === "dimension" && t.v !== 0) throw new EvalError(`cannot combine ${serialize(carrier)} and ${serialize(t)}: a dimension and a number`);
        return t.v;
      }
      const v = convert(carrier, t);
      if (v === void 0) throw new EvalError(`cannot combine ${serialize(carrier)} and ${serialize(t)}: incompatible units`);
      return v;
    })];
  }
  function arith(op, x, y) {
    const a = numeric(x), b = numeric(y);
    if (op === "+" || op === "-") {
      const [u, [av2, bv2]] = common([a, b]);
      return like(u, op === "+" ? av2 + bv2 : av2 - bv2);
    }
    if (op === "*") {
      if (a.type === "dimension" && b.type === "dimension") throw new EvalError(`cannot multiply ${serialize(a)} by ${serialize(b)}`);
      return like(a.type === "dimension" ? a : b, a.v * b.v);
    }
    if (b.v === 0) throw new EvalError("division by zero");
    if (b.type === "number") return like(a, a.v / b.v);
    if (a.type === "number") throw new EvalError(`cannot divide ${serialize(a)} by ${serialize(b)}`);
    const [, [av, bv]] = common([a, b]);
    return num(round6(av / bv));
  }
  function rect(ctx) {
    if (ctx.drag) return ctx.drag.rect;
    const cache = ctx.rects ??= /* @__PURE__ */ new Map();
    let r = cache.get(ctx.el);
    if (!r) cache.set(ctx.el, r = ctx.el.getBoundingClientRect());
    return r;
  }
  function field(f, ctx) {
    const e = ctx.e;
    const d = ctx.drag;
    switch (f) {
      case "type":
        return str2(d ? "drag" : e.type);
      case "client-x":
        return px(e.clientX);
      case "client-y":
        return px(e.clientY);
      case "page-x":
        return px(e.pageX);
      case "page-y":
        return px(e.pageY);
      case "local-x":
        return px(e.clientX - rect(ctx).left);
      case "local-y":
        return px(e.clientY - rect(ctx).top);
      case "button":
        return num(e.button);
      case "buttons":
        return num(e.buttons);
      case "pointer-id":
        return "pointerId" in e ? num(e.pointerId) : void 0;
      case "pressure":
        return "pressure" in e ? num(round6(e.pressure)) : void 0;
      case "pointer-type":
        return "pointerType" in e ? str2(e.pointerType) : void 0;
      case "alt-key":
        return bool(e.altKey);
      case "ctrl-key":
        return bool(e.ctrlKey);
      case "shift-key":
        return bool(e.shiftKey);
      case "meta-key":
        return bool(e.metaKey);
      case "key":
        return str2(e.key);
      case "code":
        return str2(e.code);
      case "repeat":
        return bool(e.repeat);
      case "value":
      case "value-as-number":
      case "checked": {
        const t = e.target;
        if (!(t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement)) return void 0;
        if (f === "checked") return t instanceof HTMLInputElement ? bool(t.checked) : void 0;
        if (sensitive(t)) return f === "value" ? str2("") : void 0;
        if (f === "value") return str2(t.value);
        const n = t instanceof HTMLInputElement ? t.valueAsNumber : parseFloat(t.value);
        return Number.isFinite(n) ? num(n) : void 0;
      }
      case "scroll-top":
        return px(ctx.el.scrollTop);
      case "scroll-left":
        return px(ctx.el.scrollLeft);
    }
    if (!d) return void 0;
    switch (f) {
      case "delta-x":
        return px(d.x - d.startX);
      case "delta-y":
        return px(d.y - d.startY);
      case "movement-x":
        return px(d.x - d.lastX);
      case "movement-y":
        return px(d.y - d.lastY);
      case "start-x":
        return px(d.startX);
      case "start-y":
        return px(d.startY);
      case "x":
      case "y": {
        const c = ctx.target;
        if (!c) return void 0;
        let s = d.starts.get(c);
        if (!s) d.starts.set(c, s = c.value);
        const delta = f === "x" ? d.x - d.startX : d.y - d.startY;
        if (s.type === "number") return num(round6(s.v + delta));
        if (s.type === "dimension" && s.unit === "px") return px(round6(s.v + delta));
        throw new EvalError(`event(${f}) moves a px or number state; ${c.name} holds ${serialize(s)}`);
      }
    }
    return void 0;
  }
  function siblingIndex2(el) {
    let n = 1;
    for (let s = el.previousElementSibling; s; s = s.previousElementSibling) n++;
    return n;
  }
  function list2(n, ctx) {
    if (n.k === "split") {
      const s = value2(n.of, ctx);
      if (!s) return [];
      if (s.type !== "string") throw new EvalError("split() splits a string");
      return s.v.split(n.sep).map((x) => x.trim()).filter(Boolean).map(str2);
    }
    const v = value2(n, ctx);
    return v ? [v] : [];
  }
  function size(n, el) {
    if (n.of === "viewport") return px(n.dim === "width" ? innerWidth : innerHeight);
    if (el instanceof HTMLElement) return px(n.dim === "width" ? el.offsetWidth : el.offsetHeight);
    const b = el.getBBox?.();
    return px(b ? n.dim === "width" ? b.width : b.height : 0);
  }
  function value2(n, ctx) {
    switch (n.k) {
      case "lit":
        return n.t;
      case "op": {
        const a = value2(n.a, ctx), b = value2(n.b, ctx);
        return a && b ? arith(n.op, a, b) : void 0;
      }
      case "neg": {
        const a = value2(n.a, ctx);
        return a && like(numeric(a), -numeric(a).v);
      }
      case "math": {
        const vals = n.args.map((a) => value2(a, ctx));
        if (vals.some((v2) => !v2)) return void 0;
        const all = vals;
        if (n.fn === "abs") {
          const a = numeric(all[0]);
          return like(a, Math.abs(a.v));
        }
        const [u, v] = common(all);
        if (n.fn === "clamp") return like(u, Math.max(v[0], Math.min(v[1], v[2])));
        return like(u, n.fn === "min" ? Math.min(...v) : Math.max(...v));
      }
      case "round": {
        const a = value2(n.a, ctx);
        if (!a) return void 0;
        const x = numeric(a);
        const b = n.b ? value2(n.b, ctx) : like(x, 1);
        if (!b) return void 0;
        const [u, [xv, step]] = common([x, b]);
        if (!step) throw new EvalError("round() needs a non-zero interval");
        const q = xv / step;
        const r = n.mode === "up" ? Math.ceil(q) : n.mode === "down" ? Math.floor(q) : n.mode === "to-zero" ? Math.trunc(q) : Math.round(q);
        return like(u, r * step);
      }
      case "var": {
        const c = resolveCell(ctx.el, n.name);
        if (c) return c.value;
        const raw = getComputedStyle(ctx.el).getPropertyValue(n.name).trim();
        if (raw) {
          try {
            return parseTyped(raw);
          } catch {
            throw new EvalError(`var(${n.name}) is "${raw.slice(0, 40)}", not a single value`);
          }
        }
        if (n.fallback) return value2(n.fallback, ctx);
        throw new EvalError(`var(${n.name}): no state or custom property named ${n.name} applies to the element`);
      }
      case "event":
        return field(n.field, ctx);
      case "mouse": {
        const e = ctx.e;
        const v = n.axis === "x" ? e.clientX : e.clientY;
        return px(n.local ? v - (n.axis === "x" ? rect(ctx).left : rect(ctx).top) : v);
      }
      case "size":
        return size(n, ctx.el);
      case "attr": {
        const raw = sensitive(ctx.el) ? null : ctx.el.getAttribute(n.name);
        const fb = n.fallback;
        if (raw === null) return fb ?? str2("");
        if (!fb || fb.type === "string") return str2(raw);
        try {
          const t = parseTyped(raw);
          return t.type === fb.type ? t : fb;
        } catch {
          return fb;
        }
      }
      case "pick": {
        const all = n.items.flatMap((x) => list2(x, ctx));
        if (new Set(all.map((t) => t.type)).size > 1) throw new EvalError("pick() values must all have the same type");
        return all.length ? all[Math.floor(Math.random() * all.length)] : void 0;
      }
      case "split":
        return void 0;
      case "random": {
        const a = value2(n.min, ctx), b = value2(n.max, ctx);
        if (!a || !b) return void 0;
        const s = n.step ? value2(n.step, ctx) : void 0;
        if (n.step && !s) return void 0;
        const [u, [min, max, step]] = common(s ? [a, b, s] : [a, b]);
        let v = min + Math.random() * Math.max(0, max - min);
        if (s) {
          if (!(step > 0)) return like(u, v);
          v = min + Math.floor(Math.random() * (Math.floor((max - min) / step + 1e-9) + 1)) * step;
        }
        return like(u, v);
      }
      case "sibling":
        return num(n.count ? ctx.el.parentElement?.childElementCount ?? 1 : siblingIndex2(ctx.el));
    }
  }
  function evaluateAction(n, ctx, where) {
    try {
      return value2(n, ctx);
    } catch (e) {
      if (!(e instanceof EvalError)) throw e;
      warn(`${where()}: ${e.message}. Nothing is changed.`);
      return void 0;
    }
  }

  // src/state/on.ts
  var EVENT_INFO = {
    click: [true, true, "pointer"],
    dblclick: [true, true, "mouse"],
    contextmenu: [true, true, "pointer"],
    pointerdown: [true, true, "pointer"],
    pointerup: [true, false, "pointer"],
    pointermove: [true, false, "pointer"],
    pointerenter: [false, false, "pointer"],
    pointerleave: [false, false, "pointer"],
    pointercancel: [true, false, "pointer"],
    mousedown: [true, true, "mouse"],
    mouseup: [true, false, "mouse"],
    mousemove: [true, false, "mouse"],
    mouseenter: [false, false, "mouse"],
    mouseleave: [false, false, "mouse"],
    input: [true, false, "form"],
    change: [true, false, "form"],
    submit: [true, true, "other"],
    reset: [true, false, "other"],
    keydown: [true, true, "keyboard"],
    keyup: [true, true, "keyboard"],
    focus: [false, false, "focus"],
    blur: [false, false, "focus"],
    focusin: [true, false, "focus"],
    focusout: [true, false, "focus"],
    // The element's own animations and transitions only (a child's does not count), as in 0.5.1.
    animationstart: [false, false, "other"],
    animationend: [false, false, "other"],
    animationcancel: [false, false, "other"],
    transitionend: [false, false, "other"],
    transitioncancel: [false, false, "other"],
    scroll: [false, false, "scroll"],
    scrollend: [false, false, "scroll"],
    toggle: [false, false, "other"]
  };
  var OUTSIDE = /* @__PURE__ */ new Set(["click", "pointerdown", "focusin"]);
  var PHASES = /* @__PURE__ */ new Set(["start", "move", "end", "cancel"]);
  function compileTrigger(text2) {
    const parts = splitTop(text2);
    if (!parts.length || !parts[0]) throw new Error(":on() needs an event, e.g. :on(click)");
    const m = /^([a-z-]+)(?:\(\s*(.*?)\s*\))?$/is.exec(parts[0]);
    if (!m) throw new Error(`cannot read the trigger "${parts[0]}"`);
    const name = m[1].toLowerCase(), arg = m[2];
    let trigger;
    if (name === "drag") {
      const phase = (arg ?? "move").toLowerCase();
      if (!PHASES.has(phase)) throw new Error(`drag() takes start, move, end or cancel; got "${arg}"`);
      if (!runtimes.gestures) throw new Error("feature:gestures");
      trigger = { key: "drag:" + phase, dom: "pointerdown", category: "drag", phase, cancelable: true };
    } else if (name === "outside") {
      const ev = (arg ?? "").toLowerCase();
      if (!OUTSIDE.has(ev)) throw new Error(`outside() takes one of: ${[...OUTSIDE].join(", ")}; got "${arg ?? ""}"`);
      trigger = { key: "outside:" + ev, dom: ev, category: EVENT_INFO[ev][2], outside: true, cancelable: false };
    } else {
      const info = EVENT_INFO[name];
      if (!info) throw new Error(`unknown event "${name}"; supported: ${Object.keys(EVENT_INFO).join(", ")}, outside(\u2026), drag`);
      if (arg !== void 0 && name !== "keydown" && name !== "keyup") throw new Error(`${name} takes no argument (key filters are for keydown(Key) and keyup(Key))`);
      const filter2 = arg === void 0 ? void 0 : parseKey(arg);
      trigger = { key: filter2 ? `${name}(${arg.toLowerCase()})` : name, dom: name, category: info[2], filter: filter2, cancelable: info[1] };
    }
    const mods = { prevent: false, stop: false, once: false };
    for (const p of parts.slice(1)) {
      const k = p.toLowerCase();
      if (!(k in mods)) throw new Error(`unknown modifier "${p}"; use prevent, stop or once`);
      if (mods[k]) throw new Error(`"${p}" is given twice`);
      mods[k] = true;
    }
    if (mods.prevent && !trigger.cancelable)
      throw new Error(trigger.outside ? "prevent is not allowed with outside(): it would cancel events on unrelated elements anywhere on the page" : `prevent needs a cancelable event (click, dblclick, contextmenu, mousedown, pointerdown, keydown, keyup, submit, drag); ${trigger.key} is not`);
    if (mods.stop && (trigger.outside || trigger.phase)) throw new Error(`stop has no meaning for ${trigger.outside ? "outside()" : "drag"}`);
    return { trigger, mods };
  }
  function compileMutation(name, text2, trigger) {
    const m = /^([a-z-]+)\(([\s\S]*)\)$/i.exec(text2.trim());
    const op = m?.[1].toLowerCase();
    if (!m || !["set", "toggle", "increment", "decrement", "cycle"].includes(op))
      throw new Error(`expected set(value), toggle(), increment(step?), decrement(step?) or cycle(a, b, \u2026), got "${text2.trim()}"`);
    const body = m[2].trim();
    const where = `${name} in :on(${trigger.key})`;
    try {
      if (op === "toggle") {
        if (body) throw new Error("toggle() takes no arguments");
        return { name, op };
      }
      if (op === "cycle") {
        const values = splitTop(body).map((v) => parseTyped(v));
        if (values.length < 2) throw new Error("cycle() needs at least two values");
        return { name, op, values };
      }
      if (op === "set" && !body) throw new Error("set() needs a value");
      return { name, op, expr: body ? parseAction(body, trigger.category, trigger.key) : void 0 };
    } catch (e) {
      throw new Error(`${op}() for ${where}: ${e.message}`);
    }
  }
  function splitTop(s) {
    const out = [];
    let depth = 0, q = "", cur = "";
    for (const c of s) {
      if (q) {
        if (c === q) q = "";
        cur += c;
        continue;
      }
      if (c === '"' || c === "'") q = c;
      else if (c === "(") depth++;
      else if (c === ")") depth--;
      else if (c === "," && !depth) {
        out.push(cur.trim());
        cur = "";
        continue;
      }
      cur += c;
    }
    if (cur.trim() || out.length) out.push(cur.trim());
    return out;
  }
  var candidates2 = /* @__PURE__ */ new WeakMap();
  var outsiders2 = /* @__PURE__ */ new Map();
  var mutations = /* @__PURE__ */ new Map();
  var specs = /* @__PURE__ */ new Map();
  var fired = /* @__PURE__ */ new WeakMap();
  var registeredProps = /* @__PURE__ */ new Set();
  var applies2 = (c) => c.spec.certain && (!c.sheet || !c.sheet.disabled && (!c.sheet.media.length || matchMedia(c.sheet.media.mediaText).matches));
  function registerProp(name) {
    if (registeredProps.has(name)) return;
    registeredProps.add(name);
    try {
      CSS.registerProperty({ name, syntax: "*", inherits: false });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "InvalidModificationError"))
        warn(":on() needs CSS.registerProperty() (Chrome 78+, Safari 16.4+, Firefox 128+); event rules may also apply to descendants.");
    }
  }
  function registerRule(spec) {
    specs.set(spec.id, spec);
    for (const s of spec.slots) {
      mutations.set(s.m.id, s.m);
      registerProp(s.prop);
    }
    if (spec.modSlots.prevent) registerProp(spec.modSlots.prevent);
    if (spec.modSlots.stop) registerProp(spec.modSlots.stop);
    const gesture = spec.trigger.phase !== void 0;
    const release = gesture ? runtimes.gestures.register(spec.mods.prevent) : void 0;
    if (!gesture) {
      listen(spec.trigger.dom, 1);
      if (spec.mods.prevent) cancel(spec.trigger.dom, 1);
    }
    return () => {
      specs.delete(spec.id);
      for (const s of spec.slots) mutations.delete(s.m.id);
      if (release) release();
      else {
        if (spec.mods.prevent) cancel(spec.trigger.dom, -1);
        listen(spec.trigger.dom, -1);
      }
    };
  }
  function ruleWatcher(match, spec, sheet) {
    const entry = { spec, sheet };
    return {
      selector: match,
      add(el) {
        const list3 = candidates2.get(el);
        if (list3) list3.push(entry);
        else candidates2.set(el, [entry]);
        if (spec.trigger.outside) outsiders2.set(el, (outsiders2.get(el) ?? 0) + 1);
        runtimeStats.bindings++;
      },
      remove(el) {
        const list3 = candidates2.get(el);
        const i = list3 ? list3.indexOf(entry) : -1;
        if (i < 0) return;
        list3.splice(i, 1);
        if (!list3.length) candidates2.delete(el);
        if (spec.trigger.outside) {
          const n = (outsiders2.get(el) ?? 1) - 1;
          if (n) outsiders2.set(el, n);
          else outsiders2.delete(el);
        }
        runtimeStats.bindings--;
      }
    };
  }
  var dragRules = (el) => candidates2.get(el)?.filter((c) => c.spec.trigger.phase !== void 0) ?? [];
  function dragApplies(el, prevent = false) {
    let cs;
    for (const c of dragRules(el)) {
      if (prevent && !c.spec.mods.prevent) continue;
      if (applies2(c)) return true;
      const props = prevent ? [c.spec.modSlots.prevent] : [...c.spec.slots.map((s) => s.prop), ...Object.values(c.spec.modSlots)];
      cs ??= getComputedStyle(el);
      if (props.some((p) => p && cs.getPropertyValue(p).trim())) return true;
    }
    return false;
  }
  var dragTarget = Object.assign(
    (path) => path.find((n) => n instanceof Element && dragRules(n).length > 0 && dragApplies(n)),
    { has: (el) => dragRules(el).length > 0, prevents: (el) => dragApplies(el, true) }
  );
  var consumed = (el, spec) => spec.mods.once && !!fired.get(el)?.has(spec.sig);
  function consume(el, spec) {
    if (!spec.mods.once) return;
    let set = fired.get(el);
    if (!set) fired.set(el, set = /* @__PURE__ */ new Set());
    set.add(spec.sig);
  }
  function fit(cur, v) {
    if (cur.type === "dimension" && v.type === "number" && v.v === 0) return { ...cur, v: 0 };
    if (cur.type === "boolean" && v.type === "number" && (v.v === 0 || v.v === 1)) return { type: "boolean", v: v.v === 1 };
    return assignable(cur, v) ? coerce(cur, v) : void 0;
  }
  function compute(m, cell, ctx, where) {
    const cur = cell.value;
    switch (m.op) {
      case "set":
        return evaluateAction(m.expr, ctx, where);
      case "toggle":
        if (cur.type !== "boolean") {
          warn(`${where()}: toggle() needs a boolean state; ${m.name} holds ${serialize(cur)}.`);
          return void 0;
        }
        return { type: "boolean", v: !cur.v };
      case "cycle": {
        const values = m.values.map((v) => fit(cur, v));
        if (values.some((v) => !v)) {
          warn(`${where()}: cycle() values cannot be stored in ${m.name} (${cur.type}).`);
          return void 0;
        }
        const i = values.findIndex((v) => equal(v, cur));
        return values[(i + 1) % values.length];
      }
      default: {
        if (cur.type !== "number" && cur.type !== "dimension") {
          warn(`${where()}: ${m.op}() needs a number or dimension state; ${m.name} holds ${serialize(cur)}.`);
          return void 0;
        }
        const step = m.expr ? evaluateAction(m.expr, ctx, where) : { ...cur, v: 1 };
        if (!step) return void 0;
        const s = fit(cur, step);
        if (!s || s.type === "boolean") {
          warn(`${where()}: the step ${serialize(step)} does not match the unit of ${m.name} (${serialize(cur)}).`);
          return void 0;
        }
        const sign = m.op === "increment" ? 1 : -1;
        return { ...cur, v: Math.round((cur.v + sign * s.v) * 1e6) / 1e6 };
      }
    }
  }
  function runElement(el, tx, match) {
    const all = candidates2.get(el);
    if (!all) return false;
    const cands = all.length === 1 ? match(all[0].spec.trigger) ? all : [] : all.filter((c) => match(c.spec.trigger));
    if (!cands.length) return false;
    const ran = /* @__PURE__ */ new Set();
    const run4 = (m) => {
      if (!m || !m.rule || consumed(el, m.rule)) return;
      ran.add(m.rule);
      const cell = resolveCell(el, m.name);
      const where = () => `${m.name}: ${m.op}() on ${describeElement(el)} for :on(${m.rule.trigger.key})`;
      if (!cell) {
        warnMissing(m.name, el, `:on(${m.rule.trigger.key}) on ${describeElement(el)}`);
        return;
      }
      const ctx = { e: tx.e, el, target: cell, drag: tx.drag, rects: tx.rects };
      const v = compute(m, cell, ctx, where);
      tx.rects ??= ctx.rects;
      if (v) tx.writes.push({ cell, v, where });
    };
    let cs;
    const style = () => cs ??= getComputedStyle(el);
    if (cands.length === 1 && applies2(cands[0])) {
      for (const s of cands[0].spec.slots) run4(s.m);
    } else {
      const props = /* @__PURE__ */ new Map();
      let read2 = false;
      for (const c of cands) {
        if (!applies2(c)) read2 = true;
        for (const s of c.spec.slots) {
          if (props.has(s.prop)) read2 = true;
          props.set(s.prop, s.m);
        }
      }
      for (const [prop, m] of props) {
        if (!read2) {
          run4(m);
          continue;
        }
        const id2 = +style().getPropertyValue(prop).trim();
        run4(id2 ? mutations.get(id2) : void 0);
      }
    }
    const modifier = (k) => {
      let on = false;
      for (const c of cands) {
        const prop = c.spec.modSlots[k];
        if (!prop || !c.spec.mods[k]) continue;
        const spec = applies2(c) ? c.spec : specs.get(+style().getPropertyValue(prop).trim());
        if (!spec || consumed(el, spec)) continue;
        ran.add(spec);
        on = true;
      }
      return on;
    };
    if (modifier("prevent") && tx.drag === void 0) preventEvent(el, tx.e);
    const stop2 = modifier("stop");
    if (stop2) {
      const e = tx.e, type = e.type;
      const f = (ev) => {
        el.removeEventListener(type, f);
        if (ev === e) ev.stopPropagation();
      };
      el.addEventListener(type, f);
      setTimeout(() => el.removeEventListener(type, f));
    }
    for (const s of ran) consume(el, s);
    return stop2;
  }
  function commit(tx) {
    const w0 = tx.writes;
    const list3 = w0.length < 2 ? w0 : w0.filter((w, i) => !w0.some((x, j) => j > i && x.cell === w.cell));
    for (const w of list3) {
      if (w.cell.dead) continue;
      const v = fit(w.cell.value, w.v);
      if (!v) {
        warn(`${w.where()}: ${serialize(w.v)} cannot be stored in ${w.cell.name}, which holds ${serialize(w.cell.value)}.`);
        continue;
      }
      w.cell.set(v);
    }
  }
  var afterDrag = { el: null };
  function dispatch2(e, path) {
    const type = e.type;
    const info = EVENT_INFO[type];
    if (type === "click" && afterDrag.el && path.includes(afterDrag.el)) return;
    const tx = { e, writes: [] };
    const key = type === "keydown" || type === "keyup";
    const match = (t) => t.dom === type && !t.outside && t.phase === void 0 && (!t.filter || keyAllowed(t.filter, e));
    const own = info?.[0] ? path : path.slice(0, 1);
    for (const node of own) if (node instanceof Element && runElement(node, tx, match)) break;
    commit(tx);
    if (outsiders2.size && OUTSIDE.has(type) && !key) {
      activation.event = null;
      const out = { e, writes: [], rects: tx.rects };
      const outside = (t) => t.outside === true && t.dom === type;
      for (const el of [...outsiders2.keys()]) if (!path.includes(el)) runElement(el, out, outside);
      commit(out);
    }
  }
  function keyAllowed(spec, e) {
    if (!keyMatches(spec, e)) return false;
    return !(spec.printable && !spec.ctrl && !spec.alt && !spec.meta && editable(e.target));
  }
  function fireDrag(el, phase, e, drag) {
    const tx = { e, writes: [], drag };
    runElement(el, tx, (t) => t.phase === phase);
    commit(tx);
  }
  extensions.dispatch = dispatch2;
  onEventNames.push(...Object.keys(EVENT_INFO));
  runtimes.onRules = { trigger: compileTrigger, mutation: compileMutation, watcher: ruleWatcher, register: registerRule };

  // src/core/elements.ts
  var entries = /* @__PURE__ */ new Map();
  var ownedAttributes = /* @__PURE__ */ new WeakMap();
  if (dev) probes.watchers = () => entries.size;
  var memberOf = /* @__PURE__ */ new WeakMap();
  var observer;
  var filter = /* @__PURE__ */ new Set();
  var subtree = (root) => [root, ...root.querySelectorAll("*")];
  function join(e, el) {
    if (e.members.has(el)) return;
    e.members.add(el);
    const list3 = memberOf.get(el);
    if (list3) list3.push(e);
    else memberOf.set(el, [e]);
    try {
      e.w.add(el);
    } catch (err) {
      warn(`Internal error while binding an element: ${err.message}`);
    }
  }
  function leave(e, el) {
    if (!e.members.delete(el)) return;
    const list3 = memberOf.get(el);
    if (list3) {
      list3.splice(list3.indexOf(e), 1);
      if (!list3.length) memberOf.delete(el);
    }
    try {
      e.w.remove(el);
    } catch (err) {
      warn(`Internal error while unbinding an element: ${err.message}`);
    }
  }
  function reconcile(e, root, removals) {
    const sel = e.w.selector;
    if (root.matches(sel)) join(e, root);
    for (const el of root.querySelectorAll(sel)) join(e, el);
    if (!removals) return;
    const below = root.getElementsByTagName("*");
    if (e.members.size < below.length) {
      for (const m of [...e.members]) if (root.contains(m) && !m.matches(sel)) leave(e, m);
    } else {
      for (const el of [root, ...below]) if (e.members.has(el) && !el.matches(sel)) leave(e, el);
    }
  }
  function siblingSensitive(sel) {
    return tokenize(sel).some((t) => t.type === "delim" && (t.value === "+" || t.value === "~") || (t.type === "ident" || t.type === "function") && /^(nth-|first-|last-|only-)/i.test(t.value));
  }
  function attributesOf(sel) {
    const t = tokenize(sel);
    const out = /* @__PURE__ */ new Set();
    t.forEach((tok, i) => {
      if (tok.type === "delim" && tok.value === "." && t[i + 1]?.type === "ident") out.add("class");
      if (tok.type === "delim" && tok.value === "#" && t[i + 1]?.type === "ident") out.add("id");
      if (tok.type !== "[") return;
      let j = i + 1;
      while (t[j]?.type === "ws") j++;
      if (t[j]?.type === "ident") out.add(t[j].value.toLowerCase());
    });
    return out;
  }
  function observe() {
    const next = /* @__PURE__ */ new Set();
    for (const e of entries.values()) for (const a of e.deps) next.add(a);
    if (observer && [...next].every((a) => filter.has(a))) return;
    filter = next;
    if (observer) {
      handle(observer.takeRecords(), false);
      observer.disconnect();
    }
    observer ??= new MutationObserver((records2) => handle(records2));
    observer.observe(document.documentElement, filter.size ? { childList: true, subtree: true, attributes: true, attributeFilter: [...filter] } : { childList: true, subtree: true });
  }
  var batchEnd;
  function afterMutations(fn) {
    batchEnd = fn;
  }
  function handle(records2, endOfBatch = true) {
    const added = /* @__PURE__ */ new Set();
    const moved = /* @__PURE__ */ new Set();
    const changed = /* @__PURE__ */ new Map();
    const parents = /* @__PURE__ */ new Set();
    for (const r of records2) {
      if (r.type === "attributes") {
        const el = r.target;
        if (ownedAttributes.get(el)?.has(r.attributeName)) continue;
        let names = changed.get(el);
        if (!names) changed.set(el, names = /* @__PURE__ */ new Set());
        names.add(r.attributeName);
        continue;
      }
      if (r.target instanceof Element) parents.add(r.target);
      for (const n of r.removedNodes) {
        if (!(n instanceof Element)) continue;
        const stays = n.isConnected;
        if (stays) moved.add(n);
        for (const el of subtree(n)) {
          for (const e of [...memberOf.get(el) ?? []]) {
            if (!stays) leave(e, el);
            else e.w.move?.(el);
          }
        }
      }
      for (const n of r.addedNodes) if (n instanceof Element && n.isConnected) added.add(n);
    }
    for (const e of entries.values()) {
      for (const el of added) reconcile(e, el, moved.has(el));
      for (const [el, names] of changed) {
        if (!el.isConnected || ![...names].some((n) => e.deps.has(n))) continue;
        reconcile(e, el, true);
        if (e.sibling && el.parentElement) parents.add(el.parentElement);
      }
      if (e.sibling) {
        for (const p of parents) if (p.isConnected) reconcile(e, p, true);
      }
    }
    if (endOfBatch) batchEnd?.();
  }
  function watch(w) {
    try {
      document.querySelector(w.selector);
    } catch {
      warn(`Unsupported selector "${w.selector}"; its reactive declarations are ignored.`);
      return;
    }
    const deps = attributesOf(w.selector);
    deps.delete("style");
    for (const a of deps) if (a.startsWith("data-rcss")) deps.delete(a);
    const e = { w, members: /* @__PURE__ */ new Set(), sibling: siblingSensitive(w.selector), deps };
    entries.set(w, e);
    observe();
    reconcile(e, document.documentElement, false);
  }
  function unwatch(w) {
    const e = entries.get(w);
    if (!e) return;
    entries.delete(w);
    for (const el of [...e.members]) leave(e, el);
  }
  function membersOf(w) {
    return entries.get(w)?.members ?? /* @__PURE__ */ new Set();
  }
  function stopObserving() {
    observer?.disconnect();
    observer = void 0;
    for (const w of [...entries.keys()]) unwatch(w);
  }

  // src/core/config.ts
  var config = () => typeof window !== "undefined" && window.ReactiveCSSConfig || {};

  // src/state/conditions.ts
  var nativeIf;
  function supportsNativeIf() {
    if (config().native === false) return false;
    return nativeIf ??= typeof CSS !== "undefined" && CSS.supports("width", "if((style(--a: 1) and not style(--b: 0)): 1px; style(--a: 0): 2px)");
  }
  var booleanOnly = (c) => c.k === "ref" || c.k === "not" && booleanOnly(c.a) || (c.k === "and" || c.k === "or") && booleanOnly(c.a) && booleanOnly(c.b);
  function query(c, want) {
    switch (c.k) {
      case "ref":
        return `style(${c.name}: ${want ? 1 : 0})`;
      case "not":
        return query(c.a, !want);
      case "and":
      case "or": {
        const both = c.k === "and" === want;
        return `(${query(c.a, want)} ${both ? "and" : "or"} ${query(c.b, want)})`;
      }
      default:
        throw new Error("not native");
    }
  }
  function nativeWhen(cond, branches) {
    if (!booleanOnly(cond.ast) || branches.some((b) => /[;{}]/.test(b)) || !supportsNativeIf()) return void 0;
    const t = `${query(cond.ast, true)}: ${branches[0]}`;
    return branches.length > 1 ? `if(${t}; ${query(cond.ast, false)}: ${branches[1]})` : `if(${t})`;
  }
  function check(cond, refs) {
    try {
      return evaluate(cond.ast, (name) => refs[cond.names.indexOf(name)].state());
    } catch (e) {
      if (!(e instanceof ConditionError)) throw e;
      warn(`${e.message} (in "${cond.text}"). The condition counts as unknown: when() gives no value, :when() does not match.`);
      return void 0;
    }
  }
  var refsFor = (cond, el, sub) => cond.names.map((n) => new StateRef(el, n, sub));
  defineFunction({
    name: "when",
    kind: "condition",
    syntax: "when(condition, value-if-true?, value-if-false?)",
    rawArgs: [0],
    // the condition has its own grammar (previous(), direction() are operands there)
    compile(args) {
      if (args.length > 3) throw new Error("expected when(condition, value-if-true, value-if-false)");
      return parseCondition(args[0].text);
    },
    native(args, cond, nested) {
      if (nested || args.slice(1).some((a) => a.parts.some((p) => typeof p !== "string"))) return void 0;
      return nativeWhen(cond, args.length > 1 ? args.slice(1).map((a) => a.text) : ["true", "false"]);
    },
    create: (ctx, args, cond) => new WhenValue(ctx, args, cond)
  });
  var WhenValue = class {
    constructor(ctx, args, cond) {
      this.args = args;
      this.cond = cond;
      this.refs = refsFor(cond, ctx.el, ctx);
    }
    args;
    cond;
    refs;
    get() {
      const r = check(this.cond, this.refs);
      if (r === void 0) return "";
      if (this.args.length === 1) return r ? "true" : "false";
      return r ? this.args[1].get() : this.args[2]?.get() ?? "";
    }
    dispose() {
      for (const r of this.refs) r.dispose();
    }
  };
  var WhenMatch = class {
    constructor(el, cond, attr) {
      this.el = el;
      this.cond = cond;
      this.attr = attr;
      this.refs = refsFor(cond, el, this);
      settleLater(this);
    }
    el;
    cond;
    attr;
    queued;
    on;
    dead = false;
    refs;
    notify() {
      if (!this.dead) dirty(this);
    }
    compute() {
      if (this.dead) return false;
      const on = check(this.cond, this.refs) === true;
      if (on === this.on) return false;
      this.on = on;
      return true;
    }
    write() {
      this.el.toggleAttribute(this.attr, this.on);
    }
    dispose() {
      this.dead = true;
      for (const r of this.refs) r.dispose();
      this.el.removeAttribute(this.attr);
    }
  };
  var counter = 0;
  defineSelector({
    name: "when",
    kind: "state",
    functional: true,
    syntax: ":when(condition)",
    compile(arg, compound, sheet) {
      const cond = parseCondition(arg);
      if (!compound.replace(/:is\(\*\)/g, "").trim())
        throw new Error(":when() needs a type, class or attribute selector on the same element, e.g. .card:when(--active)");
      const attr = `data-rcss-when-${counter++}`;
      sheet.setup.push(() => {
        const matches = /* @__PURE__ */ new WeakMap();
        const w = {
          selector: compound,
          add: (el) => {
            matches.set(el, new WhenMatch(el, cond, attr));
          },
          remove: (el) => {
            matches.get(el)?.dispose();
            matches.delete(el);
          }
        };
        watch(w);
        return () => unwatch(w);
      });
      return `[${attr}]`;
    }
  });

  // src/selectors/nth-var.ts
  var uses = /* @__PURE__ */ new Set();
  var groups2 = /* @__PURE__ */ new Map();
  var under = /* @__PURE__ */ new Map();
  var pending = /* @__PURE__ */ new Set();
  var rebuild = false;
  var observer2;
  if (dev) Object.assign(probes, { nthUses: () => uses.size, nthGroups: () => groups2.size, nthIndexed: () => under.size, nthPending: () => pending.size });
  function schedule(g) {
    if (g) pending.add(g);
    frame(run2);
  }
  function add(use, el) {
    const parent = el.parentElement;
    if (!parent) return;
    use.members.set(el, parent);
    let g = groups2.get(parent);
    if (!g) {
      groups2.set(parent, g = { parent, count: 0, structural: true, active: /* @__PURE__ */ new Map(), refs: /* @__PURE__ */ new Map() });
      rebuild = true;
    }
    g.count++;
    g.structural = true;
    schedule(g);
  }
  function remove(use, el) {
    const parent = use.members.get(el);
    if (!parent) return;
    use.members.delete(el);
    el.removeAttribute(use.attr);
    const g = groups2.get(parent);
    if (g && --g.count === 0) {
      groups2.delete(parent);
      pending.delete(g);
      g.refs.forEach((r) => r.dispose());
      rebuild = true;
      schedule();
    } else if (g) {
      g.structural = true;
      schedule(g);
    }
  }
  function onMutations(records2) {
    for (const r of records2) {
      if (r.type === "attributes" && r.attributeName?.startsWith("data-rcss")) continue;
      const t = r.target;
      if (r.type === "childList") {
        const g = groups2.get(t);
        if (g) {
          g.structural = true;
          pending.add(g);
        }
      } else under.get(t)?.forEach((g) => pending.add(g));
    }
    if (pending.size) schedule();
  }
  function observeGroups() {
    rebuild = false;
    if (observer2) {
      onMutations(observer2.takeRecords());
      observer2.disconnect();
    }
    observer2 ??= new MutationObserver(onMutations);
    under = /* @__PURE__ */ new Map();
    for (const g of groups2.values()) {
      for (let a = g.parent; a; a = a.parentElement) {
        const list3 = under.get(a);
        if (list3) list3.push(g);
        else under.set(a, [g]);
      }
    }
    under.forEach((_, el) => observer2.observe(el, { attributes: true, childList: groups2.has(el) }));
  }
  function run2() {
    if (rebuild) observeGroups();
    const reads = [...pending].filter((g) => groups2.get(g.parent) === g && g.parent.isConnected).map((g) => {
      let cs;
      const values = /* @__PURE__ */ new Map();
      for (const u of uses) {
        if (values.has(u.varName)) continue;
        let ref = g.refs.get(u.varName);
        if (!ref) g.refs.set(u.varName, ref = new StateRef(g.parent, u.varName, { notify: () => schedule(g) }, true));
        const t = ref.get();
        if (t) {
          values.set(u.varName, t.type === "number" ? t.v : NaN);
          continue;
        }
        cs ??= getComputedStyle(g.parent);
        values.set(u.varName, Number(cs.getPropertyValue(u.varName).trim() || NaN));
      }
      return [g, values];
    });
    pending.clear();
    for (const [g, values] of reads) {
      const children = g.parent.children;
      if (g.structural) {
        g.structural = false;
        g.active.clear();
        for (let i = 0; i < children.length; i++) {
          const c = children[i];
          for (const u of uses) {
            if (u.members.get(c) !== g.parent) continue;
            const want = values.get(u.varName) === i + 1;
            if (want) g.active.set(u, c);
            if (c.hasAttribute(u.attr) !== want) c.toggleAttribute(u.attr, want);
          }
        }
        continue;
      }
      for (const u of uses) {
        const n = values.get(u.varName);
        const c = Number.isInteger(n) && n >= 1 ? children[n - 1] : void 0;
        const next = c && u.members.get(c) === g.parent ? c : null;
        const prev = g.active.get(u) ?? null;
        if (next === prev) continue;
        prev?.removeAttribute(u.attr);
        next?.setAttribute(u.attr, "");
        g.active.set(u, next);
      }
    }
  }
  onSync(() => {
    if (pending.size) run2();
  });
  refreshers.add(() => {
    groups2.forEach((g) => {
      g.structural = true;
      pending.add(g);
    });
    schedule();
  });
  var counter2 = 0;
  defineSelector({
    name: "nth-var",
    kind: "structural",
    functional: true,
    compile(arg, compound, sheet) {
      if (!/^--[^\s,()]+$/.test(arg)) throw new Error(`:nth-var() expects a custom property name like --active, got "${arg}"`);
      if (!compound.replace(/:is\(\*\)/g, "").trim())
        throw new Error(":nth-var() needs a type, class or attribute selector on the same element, e.g. .slide:nth-var(--active)");
      const use = { varName: arg, attr: `data-rcss-nth-${counter2++}`, members: /* @__PURE__ */ new Map() };
      sheet.setup.push(() => {
        uses.add(use);
        const w = {
          selector: compound,
          add: (el) => add(use, el),
          remove: (el) => remove(use, el),
          move: (el) => {
            remove(use, el);
            add(use, el);
          }
        };
        watch(w);
        return () => {
          unwatch(w);
          uses.delete(use);
        };
      });
      return `[${use.attr}]`;
    }
  });

  // src/state/history.ts
  var stateArg = (fn) => (args) => {
    if (args.length !== 1 || !/^--[^\s,()]+$/.test(args[0].text)) throw new Error(`expected ${fn}(--state)`);
    return args[0].text;
  };
  defineFunction({
    name: "previous",
    kind: "source",
    syntax: "previous(--state)",
    compile: stateArg("previous"),
    create: (ctx, _args, name) => new HistoryValue(ctx, name, false)
  });
  defineFunction({
    name: "direction",
    kind: "source",
    syntax: "direction(--state)",
    compile: stateArg("direction"),
    create: (ctx, _args, name) => new HistoryValue(ctx, name, true)
  });
  var HistoryValue = class {
    constructor(ctx, name, dir) {
      this.name = name;
      this.dir = dir;
      this.ref = new StateRef(ctx.el, name, ctx);
    }
    name;
    dir;
    ref;
    get() {
      const s = this.ref.state();
      if (!s) return "";
      if (!this.dir) return serialize(s.previous);
      try {
        return serialize(direction(s, this.name));
      } catch (e) {
        if (!(e instanceof ConditionError)) throw e;
        warn(e.message);
        return "";
      }
    }
    dispose() {
      this.ref.dispose();
    }
  };

  // src/state/changed.ts
  var now2 = () => document.timeline?.currentTime ?? performance.now();
  var isStyleAnimation = (a) => "animationName" in a || "transitionProperty" in a;
  var checking = /* @__PURE__ */ new Map();
  if (dev) probes.changedChecking = () => checking.size;
  var effects;
  var stateOfMarker = /* @__PURE__ */ new Map();
  sheetChangeHooks.add(() => {
    effects = void 0;
  });
  var MARKER = /\[(data-rcss-changed-\d+)\]/g;
  function scan(rules, inherited, out) {
    for (const r of rules) {
      let attrs = inherited;
      if (r instanceof CSSStyleRule) {
        const own = [...r.selectorText.matchAll(MARKER)].map((m) => m[1]);
        if (own.length) attrs = [...inherited, ...own];
        for (const a of attrs) {
          const name = stateOfMarker.get(a);
          if (!name) continue;
          let e = out.get(name);
          if (!e) out.set(name, e = { names: /* @__PURE__ */ new Set(), props: /* @__PURE__ */ new Set(), indirect: false });
          for (let i = 0; i < r.style.length; i++) {
            const p = r.style[i], v = r.style.getPropertyValue(p);
            if (p.startsWith("--") && !p.startsWith("--rcss-") || v.includes("var(") || v === "") e.indirect = true;
            if (p === "animation-name") for (const n of v.split(",")) e.names.add(n.trim());
            e.props.add(p);
          }
        }
      }
      if ("cssRules" in r) scan(r.cssRules, attrs, out);
    }
  }
  function effectsOf(name) {
    if (!effects) {
      effects = /* @__PURE__ */ new Map();
      for (const sheet of [...document.styleSheets, ...document.adoptedStyleSheets ?? []]) {
        try {
          scan(sheet.cssRules, [], effects);
        } catch {
        }
      }
    }
    return effects.get(name);
  }
  function startedBy(e, a) {
    if (!e || e.indirect) return true;
    return "animationName" in a ? e.names.has(a.animationName) : e.props.has(a.transitionProperty);
  }
  function checkAll() {
    const anims = document.getAnimations().filter(isStyleAnimation);
    for (const [m, since] of checking) {
      const e = effectsOf(m.name);
      const started2 = anims.filter((a) => {
        const t = a.effect?.target;
        return !!t && m.el.contains(t) && (a.startTime === null || a.startTime >= since - 1) && startedBy(e, a);
      });
      m.watch(started2);
    }
    checking.clear();
  }
  var ChangedMatch = class {
    constructor(el, name, attr) {
      this.el = el;
      this.name = name;
      this.attr = attr;
      this.ref = new StateRef(el, name, this);
      settleLater(this);
    }
    el;
    name;
    attr;
    queued;
    dead = false;
    ref;
    cell;
    seen = 0;
    /** Increases with every observed change; stale callbacks compare against it. */
    epoch = 0;
    notify() {
      if (!this.dead) dirty(this);
    }
    compute() {
      if (this.dead) return false;
      const c = this.ref.state();
      if (c !== this.cell) {
        this.cell = c;
        this.seen = c?.version ?? 0;
        if (!c) this.clear();
        return false;
      }
      if (!c || c.version === this.seen) return false;
      this.seen = c.version;
      this.epoch++;
      return true;
    }
    write() {
      const epoch = this.epoch;
      if (this.el.hasAttribute(this.attr)) {
        this.clear();
        frame(() => this.mark(epoch));
      } else this.mark(epoch);
    }
    mark(epoch) {
      if (this.dead || epoch !== this.epoch) return;
      this.el.setAttribute(this.attr, "");
      if (!checking.size) setTimeout(checkAll);
      checking.set(this, now2());
    }
    /** Keeps the marker until the animations it started have settled. */
    watch(started2) {
      const epoch = this.epoch;
      if (!started2.length) return this.clear();
      Promise.allSettled(started2.map((a) => a.finished)).then(() => {
        if (epoch === this.epoch) this.clear();
      });
    }
    clear() {
      this.el.removeAttribute(this.attr);
      checking.delete(this);
    }
    dispose() {
      this.dead = true;
      this.ref.dispose();
      this.clear();
    }
  };
  var counter3 = 0;
  defineSelector({
    name: "changed",
    kind: "state",
    functional: true,
    syntax: ":changed(--state)",
    compile(arg, compound, sheet) {
      if (!/^--[^\s,()]+$/.test(arg)) throw new Error(`:changed() expects a state name like --count, got "${arg}"`);
      if (!compound.replace(/:is\(\*\)/g, "").trim())
        throw new Error(":changed() needs a type, class or attribute selector on the same element, e.g. .counter:changed(--count)");
      const attr = `data-rcss-changed-${counter3++}`;
      stateOfMarker.set(attr, arg);
      sheet.setup.push(() => {
        const matches = /* @__PURE__ */ new WeakMap();
        const w = {
          selector: compound,
          add: (el) => {
            matches.set(el, new ChangedMatch(el, arg, attr));
          },
          remove: (el) => {
            matches.get(el)?.dispose();
            matches.delete(el);
          }
        };
        watch(w);
        return () => unwatch(w);
      });
      return `[${attr}]`;
    }
  });

  // src/state/bind.ts
  var TEXT = /* @__PURE__ */ new Set(["text", "search", "email", "url", "tel", "password"]);
  var TYPES = {
    text: ["string"],
    number: ["number", "dimension"],
    checkbox: ["boolean"],
    radio: ["string", "value", "number"],
    select: ["string", "value", "number"]
  };
  function kindOf(el) {
    if (el instanceof HTMLTextAreaElement) return "text";
    if (el instanceof HTMLSelectElement) return el.multiple ? void 0 : "select";
    if (!(el instanceof HTMLInputElement)) return void 0;
    const t = el.type;
    if (TEXT.has(t)) return "text";
    if (t === "number" || t === "range") return "number";
    if (t === "checkbox" || t === "radio") return t;
    return void 0;
  }
  function optionValue(raw, like2) {
    if (like2.type === "string") return { type: "string", v: raw };
    if (!raw.trim()) return void 0;
    try {
      const t = parseTyped(raw);
      return assignable(like2, t) ? coerce(like2, t) : void 0;
    } catch {
      return void 0;
    }
  }
  var rawOf = (t) => t.type === "string" || t.type === "value" ? String(t.v) : fmt(t.v) + (t.unit ?? "");
  function edited(el, kind) {
    if (el instanceof HTMLSelectElement) {
      const def = [...el.options].findIndex((o) => o.defaultSelected);
      return el.selectedIndex !== (def === -1 ? 0 : def);
    }
    if (kind === "checkbox" || kind === "radio") return el.checked !== el.defaultChecked;
    return el.value !== el.defaultValue;
  }
  var controls = /* @__PURE__ */ new Map();
  if (dev) probes.bindControls = () => controls.size;
  var toggled = null;
  var sameGroup = (a, t) => a === t || a instanceof HTMLInputElement && a.type === "radio" && t.type === "radio" && !!a.name && a.name === t.name && a.form === t.form && a.getRootNode() === t.getRootNode();
  var Binder = class {
    constructor(el, kind, spec) {
      this.el = el;
      this.kind = kind;
      this.spec = spec;
      this.ref = new StateRef(el, spec.name, this, false, spec.scope);
      settleLater(this);
    }
    el;
    kind;
    spec;
    queued;
    dead = false;
    ref;
    cell;
    /** Set on the first resolution when the control, not the state, provides the value. */
    takeControl = false;
    forceWrite = false;
    notify() {
      if (!this.dead) dirty(this);
    }
    compatible(c) {
      if (TYPES[this.kind].includes(c.value.type)) return true;
      warn(`bind: ${this.spec.name} on ${describeElement(this.el)}: a ${this.kind} control cannot hold a ${c.value.type} state (use ${TYPES[this.kind].join(" or ")}). Not bound.`);
      return false;
    }
    compute() {
      if (this.dead) return false;
      const c = this.ref.state();
      if (c !== this.cell) {
        this.cell = c;
        if (!c || !this.compatible(c)) {
          this.cell = void 0;
          return false;
        }
        this.takeControl = !c.restored && edited(this.el, this.kind);
        return true;
      }
      if (!c) return false;
      if (toggled && sameGroup(this.el, toggled)) {
        frame(() => this.notify());
        return false;
      }
      return this.forceWrite || !this.shows(c.value);
    }
    write() {
      const c = this.cell;
      if (!c) return;
      if (this.takeControl) {
        this.takeControl = false;
        this.fromControl();
      }
      if (!this.forceWrite && this.shows(c.value)) return;
      this.forceWrite = false;
      this.toControl(c.value);
    }
    /** Does the control already show `v`? */
    shows(v) {
      const el = this.el;
      switch (this.kind) {
        case "text":
          return el.value === v.v;
        case "number":
          return el.valueAsNumber === v.v;
        case "checkbox":
          return el.checked === v.v;
        case "radio": {
          const o = optionValue(el.value, v);
          return el.checked === (!!o && o.v === v.v);
        }
        default:
          return el.value === rawOf(v);
      }
    }
    toControl(v) {
      const el = this.el;
      switch (this.kind) {
        case "text": {
          const focused = el.ownerDocument.activeElement === el;
          const t = el;
          const [a, b] = focused ? [t.selectionStart, t.selectionEnd] : [null, null];
          el.value = v.v;
          if (focused && a !== null && b !== null) {
            const n = el.value.length;
            try {
              t.setSelectionRange(Math.min(a, n), Math.min(b, n));
            } catch {
            }
          }
          break;
        }
        case "checkbox":
          el.checked = v.v;
          break;
        case "radio": {
          const o = optionValue(el.value, v);
          el.checked = !!o && o.v === v.v;
          break;
        }
        default:
          el.value = rawOf(v);
      }
    }
    /** Reads the control into the state (user input). Invalid input leaves the state alone. */
    fromControl() {
      const c = this.cell;
      if (!c || this.dead) return;
      const el = this.el;
      let next;
      switch (this.kind) {
        case "text":
          next = { type: "string", v: el.value };
          break;
        case "checkbox":
          next = { type: "boolean", v: el.checked };
          break;
        case "number": {
          const n = el.valueAsNumber;
          if (!Number.isFinite(n)) return;
          next = { type: c.value.type, v: n, unit: c.value.unit };
          break;
        }
        case "radio":
          if (!el.checked) return;
          next = optionValue(el.value, c.value);
          break;
        default:
          next = optionValue(el.value, c.value);
      }
      if (!next) {
        warn(`bind: ${this.spec.name}: "${el.value}" is not a valid ${c.value.type} value.`);
        return;
      }
      c.set(next);
    }
    dispose() {
      this.dead = true;
      this.ref.dispose();
    }
  };
  function onClick(e) {
    const b = controls.get(e.target);
    if (!b || b.kind !== "checkbox" && b.kind !== "radio") return;
    toggled = b.el;
    frame(() => {
      toggled = null;
    });
  }
  function onInput(e) {
    if (e.target === toggled) toggled = null;
    const b = controls.get(e.target);
    if (!b) return;
    if (e.type === "input" && e.isComposing) return;
    if (e.type === "change" && (b.kind === "text" || b.kind === "number")) return;
    activation.event = e;
    try {
      urgently(() => b.fromControl());
    } finally {
      activation.event = null;
    }
  }
  function onReset(e) {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    setTimeout(() => urgently(() => {
      for (const b of controls.values()) {
        if (b.el.form !== form) continue;
        const c = b.ref.state();
        if (!c) continue;
        c.set(c.initial);
        b.forceWrite = true;
        b.notify();
      }
    }));
  }
  var EVENTS = ["input", "change", "compositionend"];
  function listen2(on) {
    const m = on ? "addEventListener" : "removeEventListener";
    for (const t of EVENTS) document[m](t, onInput, true);
    window[m]("click", onClick, true);
    document[m]("reset", onReset, true);
    runtimeStats.observers += on ? 1 : -1;
  }
  function bindWatcher(match, spec) {
    return {
      selector: match,
      add(el) {
        if (sensitive(el)) {
          warn(`bind: is refused on ${describeElement(el)}: password, one-time-code and payment fields are never exposed to CSS.`);
          return;
        }
        const kind = kindOf(el);
        if (!kind) {
          warn(`bind: is not supported on ${describeElement(el)} (supported: text-like inputs, textarea, number, range, checkbox, radio, single select).`);
          return;
        }
        if (controls.has(el)) {
          warn(`bind: ${describeElement(el)} matches more than one bind: rule; the first one is used.`);
          return;
        }
        if (!controls.size) listen2(true);
        controls.set(el, new Binder(el, kind, spec));
        runtimeStats.sources++;
      },
      remove(el) {
        const b = controls.get(el);
        if (!b || b.spec !== spec) return;
        b.dispose();
        controls.delete(el);
        runtimeStats.sources--;
        if (!controls.size) listen2(false);
      }
    };
  }
  runtimes.bind = bindWatcher;

  // src/selectors/just-checked.ts
  var CHECKED = "data-rcss-just-checked";
  var UNCHECKED = "data-rcss-just-unchecked";
  var known = /* @__PURE__ */ new WeakMap();
  var controls2 = {
    selector: 'input[type="checkbox" i], input[type="radio" i]',
    add: (el) => known.set(el, el.checked),
    remove: (el) => known.delete(el)
    // explicit: keeps the WeakMap table small (see geometry.ts)
  };
  function check2(el, assumedPrevious) {
    const prev = known.get(el) ?? assumedPrevious;
    known.set(el, el.checked);
    if (prev === void 0 || prev === el.checked) return;
    el.toggleAttribute(CHECKED, el.checked);
    el.toggleAttribute(UNCHECKED, !el.checked);
  }
  function onChange(e) {
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || el.type !== "checkbox" && el.type !== "radio") return;
    if (el.type === "radio" && el.name) {
      const group = el.form ? [...el.form.elements] : [...el.getRootNode().querySelectorAll("input")];
      for (const r of group)
        if (r instanceof HTMLInputElement && r.type === "radio" && r.name === el.name && r.form === el.form && r !== el) check2(r);
    }
    check2(el, !el.checked);
  }
  function onReset2(e) {
    const form = e.target;
    if (form instanceof HTMLFormElement) setTimeout(() => {
      for (const c of form.elements) if (c instanceof HTMLInputElement) check2(c);
    });
  }
  var refresh = () => membersOf(controls2).forEach((el) => check2(el));
  var users = 0;
  function install() {
    if (users++ === 0) {
      watch(controls2);
      document.addEventListener("change", onChange, true);
      document.addEventListener("reset", onReset2, true);
      refreshers.add(refresh);
    }
    return () => {
      if (--users) return;
      membersOf(controls2).forEach((el) => {
        el.removeAttribute(CHECKED);
        el.removeAttribute(UNCHECKED);
      });
      unwatch(controls2);
      document.removeEventListener("change", onChange, true);
      document.removeEventListener("reset", onReset2, true);
      refreshers.delete(refresh);
    };
  }
  for (const [name, attr] of [["just-checked", CHECKED], ["just-unchecked", UNCHECKED]]) {
    defineSelector({
      name,
      kind: "state",
      functional: false,
      compile(_arg, _compound, sheet) {
        sheet.setup.push(install);
        return `[${attr}]`;
      }
    });
  }

  // src/state/bindattr.ts
  var ARIA_BOOLEAN = /* @__PURE__ */ new Set(["aria-expanded", "aria-pressed", "aria-selected", "aria-disabled", "aria-hidden", "aria-busy", "aria-invalid"]);
  var ARIA_TEXT = /* @__PURE__ */ new Set(["aria-label", "aria-valuetext"]);
  var TABINDEX = /* @__PURE__ */ new Set(["0", "-1"]);
  var HTML_BOOLEAN = /* @__PURE__ */ new Set(["disabled", "hidden", "required"]);
  var ARIA_CURRENT = /* @__PURE__ */ new Set(["page", "step", "location", "date", "time", "true", "false"]);
  var DATA = /^data-[a-z0-9_.-]+$/;
  var NUMBER2 = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
  var IDENT2 = /^-?[a-z_][\w-]*$/i;
  var BINDABLE = "aria-expanded, aria-pressed, aria-selected, aria-disabled, aria-hidden, aria-busy, aria-invalid, aria-checked, aria-current, aria-valuenow, aria-label, aria-valuetext, disabled, hidden, required, tabindex (0 or -1), data-*";
  var kindOf2 = (name) => ARIA_BOOLEAN.has(name) ? "aria-boolean" : name === "aria-current" ? "aria-current" : name === "aria-checked" ? "aria-tristate" : name === "aria-valuenow" ? "aria-number" : ARIA_TEXT.has(name) ? "text" : HTML_BOOLEAN.has(name) ? "boolean" : name === "tabindex" ? "tabindex" : DATA.test(name) ? "data" : void 0;
  function parseBind(text2, initType) {
    const m = /^bind\(\s*([^()\s]*)\s*\)$/i.exec(text2.trim());
    if (!m) throw new Error(`expected bind(attribute) as the second argument of state(), got "${text2.trim()}"`);
    const name = m[1].toLowerCase();
    const kind = kindOf2(name);
    if (!kind) throw new Error(`bind(${m[1]}): only ${BINDABLE} can be bound (no event handlers, URLs, style or free text)`);
    if ((kind === "aria-boolean" || kind === "boolean") && initType !== "boolean")
      throw new Error(`bind(${name}) needs a boolean state, e.g. state(false, bind(${name}))`);
    if (kind === "tabindex" && initType !== "number")
      throw new Error(`bind(tabindex) needs a number state (0 or -1), e.g. state(-1, bind(tabindex))`);
    if (kind === "aria-current" && initType !== "boolean" && initType !== "value" && initType !== "string")
      throw new Error(`bind(aria-current) needs a boolean or a token (page, step, location, date, time)`);
    if (kind === "aria-tristate" && initType !== "boolean" && initType !== "value" && initType !== "string")
      throw new Error(`bind(aria-checked) needs a boolean, or a keyword state that can hold mixed`);
    if (kind === "aria-number" && initType !== "number") throw new Error(`bind(aria-valuenow) needs a number state, e.g. state(0, bind(aria-valuenow))`);
    return { name, kind };
  }

  // src/core/parser.ts
  var EXCLUDED = typeof __RCSS_EXCLUDED__ !== "undefined" ? __RCSS_EXCLUDED__ : {};
  var DECLARATION_FEATURE = {
    on: "events",
    bind: "forms",
    text: "text",
    attr: "attributes",
    focus: "focus",
    typed: "values",
    "state-bind": "attributes",
    "on-rule": "events",
    drag: "gestures",
    "focus-when": "focus",
    persist: "persist",
    "state-form": "forms",
    "attr-ns": "attributes",
    content: "text"
  };
  var missing = (what, feature) => msg(`${what} is not included in this bundle (feature "${feature}"); build a bundle with it (reactive-css build --features ${feature}) or use the full bundle`);
  var NATIVE_TOO = /* @__PURE__ */ new Set(["random", "element"]);
  var VAR_PREFIX = "--rcss-";
  var ATTR_PREFIX = "--rcss-attr-";
  var varCounter = 0;
  var stateVars = /* @__PURE__ */ new Map();
  var declCounter = 0;
  var handlerCounter = 0;
  var slotVars = /* @__PURE__ */ new Map();
  var slot = (key) => {
    let v = slotVars.get(key);
    if (!v) slotVars.set(key, v = VAR_PREFIX + "o" + slotVars.size.toString(36));
    return v;
  };
  var UNTRUSTED = msg("is ignored in untrusted stylesheets (cross-origin, or inline <style> with trustInlineStyles: false); move it to a same-origin stylesheet");
  var CONTENT_STATE = /* @__PURE__ */ new Set(["var", "when", "previous", "direction"]);
  var CONTENT_NATIVE = /* @__PURE__ */ new Set([
    "url",
    "image-set",
    "-webkit-image-set",
    "image",
    "cross-fade",
    "element",
    "attr",
    "counter",
    "counters",
    "linear-gradient",
    "radial-gradient",
    "conic-gradient",
    "repeating-linear-gradient",
    "repeating-radial-gradient",
    "repeating-conic-gradient"
  ]);
  var GROUPING = /* @__PURE__ */ new Set(["media", "supports", "layer", "container", "scope", "starting-style", "document"]);
  var STATEFUL = /* @__PURE__ */ new Set([
    "hover",
    "active",
    "focus",
    "focus-visible",
    "focus-within",
    "target",
    "target-within",
    "visited",
    "link",
    "any-link",
    "checked",
    "indeterminate",
    "default",
    "disabled",
    "enabled",
    "valid",
    "invalid",
    "user-valid",
    "user-invalid",
    "in-range",
    "out-of-range",
    "required",
    "optional",
    "read-only",
    "read-write",
    "placeholder-shown",
    "autofill",
    "open",
    "closed",
    "popover-open",
    "modal",
    "fullscreen",
    "picture-in-picture",
    "playing",
    "paused",
    "seeking",
    "buffering",
    "stalled",
    "muted",
    "volume-locked",
    "has",
    "scope",
    "empty",
    "blank",
    "state",
    "before",
    "after",
    "first-line",
    "first-letter",
    "current",
    "past",
    "future"
  ]);
  function compile(source3, options = {}) {
    const { baseURL, trusted = true } = typeof options === "string" ? { baseURL: options } : options;
    const tokens = tokenize(source3);
    const handlers = /* @__PURE__ */ new Map();
    const repl = [];
    const edits = [];
    const rules = [];
    const runtime = { setup: [] };
    const uses2 = /* @__PURE__ */ new Set();
    const use = (k) => {
      uses2.add(k);
    };
    const raw = (i) => repl[i] ?? source3.slice(tokens[i].start, tokens[i].end);
    const text2 = (a, b) => {
      let s = "";
      for (let i = a; i < b; i++) s += tokens[i].type === "comment" ? " " : raw(i);
      return s.replace(/\s+/g, " ").trim();
    };
    const snippet = (a, b) => {
      const s = text2(a, b);
      return s.length > 90 ? s.slice(0, 87) + "..." : s;
    };
    const significant = (i, end2) => {
      while (i < end2 && (tokens[i].type === "ws" || tokens[i].type === "comment")) i++;
      return i;
    };
    const boundary = (i, end2) => {
      for (; i < end2; i++) {
        const t = tokens[i].type;
        if (t === "{" || t === ";") return i;
        if (t === "(" || t === "[" || t === "function") i = matching(tokens, i);
      }
      return end2;
    };
    if (baseURL) rewriteURLs(tokens, repl, baseURL);
    function claims(i) {
      const def = functions.get(tokens[i].value);
      return !!def && (!def.matches || def.matches(text2(i + 1, matching(tokens, i))));
    }
    function excludedFunction(i) {
      const name = tokens[i].value, feature = EXCLUDED["fn:" + name];
      const arg = text2(i + 1, matching(tokens, i)).trim();
      if (name === "element" && !/^(width|height)$/i.test(arg)) return;
      use("fn:" + name);
      if (NATIVE_TOO.has(name)) note(`${name}() may be the native CSS function; the Reactive CSS ${name}() is not included in this bundle (feature "${feature}"); build a bundle with it (reactive-css build --features ${feature}) or use the full bundle`);
      else warn(missing(`${name}()`, feature));
    }
    function parseCall(open, close, nested) {
      const name = tokens[open].value;
      const def = functions.get(name);
      use("fn:" + name);
      const args = [];
      let start2 = open + 1;
      const flush3 = (end2) => {
        const parts = [];
        let buf = "";
        const keepRaw = def.rawArgs?.includes(args.length);
        for (let i = start2; i < end2; i++) {
          const t = tokens[i];
          if (!keepRaw && t.type === "function" && claims(i)) {
            const c = matching(tokens, i);
            const node = parseCall(i, c, true);
            if (typeof node === "string") buf += node;
            else {
              if (buf) parts.push(buf);
              buf = "";
              parts.push(node);
            }
            i = c;
          } else buf += t.type === "comment" ? " " : raw(i);
        }
        if (buf) parts.push(buf);
        if (typeof parts[0] === "string") parts[0] = parts[0].trimStart();
        const last = parts.length - 1;
        if (typeof parts[last] === "string") parts[last] = parts[last].trimEnd();
        args.push({ parts: parts.filter((p) => p !== ""), text: text2(start2, end2) });
      };
      for (let i = start2; i < close; i++) {
        const t = tokens[i].type;
        if (t === ",") {
          flush3(i);
          start2 = i + 1;
        } else if (t === "(" || t === "[" || t === "{" || t === "function") i = matching(tokens, i);
      }
      flush3(close);
      if (args.length === 1 && args[0].parts.length === 0) args.length = 0;
      let data;
      try {
        data = def.compile?.(args);
      } catch (e) {
        throw new Error(`${name}(): ${e.message}`);
      }
      const native = def.native?.(args, data, nested);
      if (native !== void 0) return native;
      if (!def.create) throw new Error(`${name}() cannot be used here`);
      return { name, def, args, data };
    }
    function split(a, b) {
      const out = [];
      let start2 = a;
      for (let i = a; i < b; i++) {
        const t = tokens[i].type;
        if (t === ",") {
          out.push([start2, i]);
          start2 = i + 1;
        } else if (t === "(" || t === "[" || t === "{" || t === "function") i = matching(tokens, i);
      }
      out.push([start2, b]);
      return out.filter(([x, y]) => significant(x, y) < y);
    }
    function important(from, to) {
      let end2 = to;
      while (end2 > from && (tokens[end2 - 1].type === "ws" || tokens[end2 - 1].type === "comment")) end2--;
      const last = tokens[end2 - 1], bang = tokens[end2 - 2];
      if (last?.type === "ident" && last.value.toLowerCase() === "important" && bang?.value === "!") return [end2 - 2, true];
      return [to, false];
    }
    function stateDeclaration(name, colon, to, rule, conditional) {
      const i = significant(colon + 1, to);
      const [end2, imp] = important(colon + 1, to);
      const t = tokens[i];
      if (!rule) throw new Error("state() is only supported inside style rules");
      if (!name.startsWith("--") || t?.type !== "function" || t.value !== "state")
        throw new Error("state() must be the whole value of a custom property, e.g. --open: state(false)");
      if (name.startsWith("--attr-") || name.startsWith("--rcss-")) throw new Error(`${name.slice(0, 7)}* is a reserved namespace; name the state differently`);
      const close = matching(tokens, i);
      if (significant(close + 1, end2) < end2) throw new Error("state() must be the whole value of a custom property");
      const args = split(i + 1, close);
      if (args.length > 3) throw new Error('expected state(initial [, bind(\u2026)] [, persist("key")])');
      const first = text2(...args[0]);
      if (/^(bind|persist)\(/i.test(first)) throw new Error(`state() needs an initial value first, e.g. state(false, ${first})`);
      const init = parseExpr(first);
      const initType = init.k === "lit" ? init.t.type : init.k === "attr" ? init.fallback.type : init.k === "split" ? "string" : void 0;
      let bind2;
      let persist;
      let form = false;
      for (const a of args.slice(1)) {
        const m = text2(...a);
        if (/^persist\(/i.test(m)) {
          if (persist) throw new Error("persist() is given twice");
          const p = /^persist\(\s*(["'])([A-Za-z0-9_.:-]{1,64})\1\s*(?:,\s*(local|session)\s*)?\)$/i.exec(m);
          if (!p) throw new Error(`expected persist("key") or persist("key", local | session) with a key of letters, digits and _ . : -, got "${m}"`);
          use("decl:state-persist");
          if (!runtimes.persist) throw new Error(missing("persist()", DECLARATION_FEATURE.persist));
          persist = { key: p[2], session: p[3]?.toLowerCase() === "session" };
        } else if (/^bind\(\s*(value|checked)\s*\)$/i.test(m)) {
          if (bind2 || form) throw new Error("bind() is given twice");
          const target2 = /value/i.test(m) ? "value" : "checked";
          use("decl:state-form");
          if (!runtimes.bind) throw new Error(missing(`state(\u2026, bind(${target2}))`, DECLARATION_FEATURE["state-form"]));
          if (!trusted) throw new Error(`bind(${target2}) in state() ${UNTRUSTED}`);
          if (conditional || !rule.certain)
            throw new Error(`bind(${target2}) must be in an unconditional rule (no @media/@supports/@container, :hover, :focus...), because a binding lasts as long as the element matches`);
          if (target2 === "checked" && initType !== "boolean") throw new Error(`bind(checked) needs a boolean state, e.g. state(false, bind(checked))`);
          if (target2 === "value" && initType === "boolean") throw new Error("bind(value) needs a string or number state; use bind(checked) for a checkbox");
          form = true;
        } else if (/^bind\(/i.test(m)) {
          if (bind2 || form) throw new Error("bind() is given twice");
          bind2 = parseBind(m, initType);
        } else throw new Error(`expected state(initial [, bind(\u2026)] [, persist("key")]); "${m}" is neither bind() nor persist()`);
      }
      use("decl:state");
      if (bind2) {
        use("decl:state-bind");
        if (!runtimes.attrBinding) throw new Error(missing("state(\u2026, bind(attribute))", DECLARATION_FEATURE["state-bind"]));
      }
      if (bind2 && !trusted)
        throw new Error("bind() in state() is ignored in untrusted stylesheets (cross-origin, or inline <style> with trustInlineStyles: false): it writes HTML attributes");
      if (!trusted && readsAttributes(init))
        throw new Error("attr() in state() is ignored in untrusted stylesheets (cross-origin, or inline <style> with trustInlineStyles: false); move it to a same-origin stylesheet");
      let varName = stateVars.get(name);
      if (!varName) stateVars.set(name, varName = VAR_PREFIX + "s" + (++varCounter).toString(36));
      edits.push({ from: i, to: close + 1, text: init.k === "lit" ? `var(${varName}, ${serialize(init.t)})` : `var(${varName})` });
      const id2 = ++declCounter;
      edits.push({ from: to, to, text: `; ${varName}-w: ${id2}${imp ? " !important" : ""}` });
      rule.states.push({ name, varName, init, id: id2, bind: bind2, persist });
      if (form && !(rule.forms ??= []).includes(name)) rule.forms.push(name);
      if (!rules.includes(rule)) rules.push(rule);
    }
    function onDeclaration(from, colon, to, rule, conditional) {
      use("decl:on");
      if (!runtimes.on) throw new Error(missing("on:", DECLARATION_FEATURE.on));
      if (!rule) throw new Error("on: is only supported inside style rules");
      if (conditional) rule.certain = false;
      if (!trusted) throw new Error("on: is ignored in untrusted stylesheets (cross-origin, or inline <style> with trustInlineStyles: false); move it to a same-origin stylesheet");
      const [end2, imp] = important(colon + 1, to);
      const set = /* @__PURE__ */ new Map();
      for (const [a, b] of split(colon + 1, end2)) {
        const i = significant(a, b);
        const ev = tokens[i];
        const triggers = [...ACTION_EVENTS, "key", "outside"];
        if (ev.type !== "function" || !triggers.includes(ev.value) || significant(matching(tokens, i) + 1, b) < b)
          throw new Error(`expected event(action, ...) with one of: ${[...ACTION_EVENTS].join(", ")}, key(Key, ...), outside(event, ...); got "${text2(a, b)}"`);
        let parts = split(i + 1, matching(tokens, i));
        let trigger = ev.value;
        use("trigger:" + ev.value);
        let key;
        if (ev.value === "key") {
          key = parseKey(parts.length ? text2(...parts[0]) : "");
          trigger = "keydown";
          parts = parts.slice(1);
        } else if (ev.value === "outside") {
          const t = parts.length ? text2(...parts[0]).toLowerCase() : "";
          if (!OUTSIDE_EVENTS.has(t)) throw new Error(`outside() takes one of: ${[...OUTSIDE_EVENTS].join(", ")}; got "${t}"`);
          trigger = "outside:" + t;
          parts = parts.slice(1);
        }
        if (!parts.length) throw new Error(`${ev.value}() needs at least one action`);
        const handler = { key, actions: [] };
        const list3 = set.get(trigger) ?? [];
        list3.push(handler);
        for (const [c, d] of parts) {
          const j = significant(c, d);
          const act = tokens[j];
          const def = act.type === "function" ? actions.get(act.value) : void 0;
          if (!def || significant(matching(tokens, j) + 1, d) < d)
            throw new Error(`unknown action "${text2(c, d)}"; available: ${[...actions.keys()].map((n) => n + "()").join(", ")}`);
          const args = split(j + 1, matching(tokens, j)).map(([x, y]) => text2(x, y));
          if (def.cancels && !CANCELABLE_TRIGGERS.has(trigger))
            throw new Error(trigger.startsWith("outside:") ? "prevent() is not allowed in outside(): it would cancel clicks on unrelated elements anywhere on the page" : `prevent() only works in click(\u2026) and key(\u2026); ${ev.value === "key" ? "key" : trigger} events ${trigger === "reset" ? "are restored by bind: after a reset, so cancelling them is not supported" : "are not cancelable"}`);
          use("act:" + def.name);
          try {
            handler.actions.push({ def, data: def.compile(args) });
          } catch (e) {
            throw new Error(`${def.name}(): ${e.message}`);
          }
        }
        set.set(trigger, list3);
      }
      const id2 = ++handlerCounter;
      handlers.set(id2, set);
      let stop2 = to;
      while (stop2 > from && (tokens[stop2 - 1].type === "ws" || tokens[stop2 - 1].type === "comment")) stop2--;
      edits.push({ from, to: stop2, text: `--rcss-on: ${id2}${imp ? " !important" : ""}` });
      rule.handler = id2;
      if (!rules.includes(rule)) rules.push(rule);
    }
    function bindDeclaration(colon, to, rule, conditional) {
      use("decl:bind");
      if (!runtimes.bind) throw new Error(missing("bind:", DECLARATION_FEATURE.bind));
      if (!rule) throw new Error("bind: is only supported inside style rules");
      if (!trusted) throw new Error("bind: is ignored in untrusted stylesheets (cross-origin, or inline <style> with trustInlineStyles: false); move it to a same-origin stylesheet");
      if (conditional || !rule.certain)
        throw new Error("bind: must be in an unconditional rule (no @media/@supports/@container, :hover, :focus...), because a binding lasts as long as the element matches");
      const m = /^(--[^\s,()]+)(?:\s+closest\((.+)\))?$/.exec(text2(colon + 1, to));
      if (!m) throw new Error("expected bind: --state or bind: --state closest(selector)");
      rule.bind = { name: m[1], scope: m[2]?.trim() };
      edits.push({ from: colon + 1, to, text: ` ${m[1]}` });
      if (!rules.includes(rule)) rules.push(rule);
    }
    function typedDeclaration(name, colon, to) {
      use("fn:typed");
      const register5 = runtimes.typed;
      if (!register5) throw new Error(missing("typed()", DECLARATION_FEATURE.typed));
      const i = significant(colon + 1, to);
      const [end2] = important(colon + 1, to);
      const t = tokens[i];
      if (!name.startsWith("--") || t?.type !== "function" || t.value !== "typed")
        throw new Error("typed() must be the whole value of a custom property, e.g. --angle: typed(0deg)");
      const close = matching(tokens, i);
      if (significant(close + 1, end2) < end2) throw new Error("typed() must be the whole value of a custom property");
      const args = split(i + 1, close).map(([a, b]) => text2(a, b));
      if (args.length < 1 || args.length > 2) throw new Error('expected typed(value) or typed(value, "<syntax>")');
      const syntax = args[1]?.replace(/^["']|["']$/g, "");
      if (syntax !== void 0 && !/^<[a-z-]+>$/.test(syntax)) throw new Error(`typed(): "${args[1]}" is not a supported syntax like "<length>" or "<color>"`);
      edits.push({ from: i, to: close + 1, text: args[0] });
      runtime.setup.push(() => {
        register5(name, args[0], syntax);
        return () => {
        };
      });
    }
    const TAKES = {
      focus: "one boolean value: true, false, var(--x) or when(...)",
      text: "one value: a string, a number, var(--x), previous(--x), direction(--x) or when(...)",
      attr: "one value: a string, a number, a keyword, var(--x), previous(--x), direction(--x) or when(...)"
    };
    function valueDeclaration(kind, name, from, colon, to, rule) {
      const ns = kind === "attr-ns";
      const label = ns ? "--attr-*" : kind + ":";
      try {
        use("decl:" + kind);
        if (!(kind === "focus" ? runtimes.focus : kind === "text" ? runtimes.text : runtimes.attrs)) throw new Error(missing(label, DECLARATION_FEATURE[kind]));
        if (!rule) throw new Error(`${label} is only supported inside style rules`);
        if (!trusted) throw new Error(ns ? `--attr-* ${UNTRUSTED}; it writes HTML attributes` : `${label} is ignored in untrusted stylesheets (cross-origin, or inline <style> with trustInlineStyles: false); ${kind === "focus" ? "it moves focus" : kind === "text" ? "move it to a same-origin stylesheet" : "it writes HTML attributes"}`);
        let attr = "", value3 = colon + 1, subject = label;
        if (kind === "attr") {
          while (value3 < to && tokens[value3].type === "ws") value3++;
          attr = tokens[value3]?.type === "ident" ? tokens[value3].value.toLowerCase() : "";
          if (!kindOf2(attr)) throw new Error(`attr: starts with the attribute to write: ${BINDABLE} (no event handlers, URLs, style or free text)${attr ? `; "${attr}" is not one of them` : ""}`);
          value3++;
        } else if (ns) {
          attr = subject = name.slice(7);
          if (attr !== attr.toLowerCase()) throw new Error(`write the attribute in lower case: --attr-${attr.toLowerCase()} (custom property names are case-sensitive, HTML attribute names are not)`);
          if (!kindOf2(attr)) throw new Error(`--attr-${attr}: only ${BINDABLE} can be written (no event handlers, URLs, style, id, class or value)`);
          subject = name;
        }
        if (attr && !tokens.slice(value3, to).some((t) => t.type !== "ws" && t.type !== "comment"))
          throw new Error(ns ? `${name} needs a value, e.g. ${name}: var(--state)` : `attr: ${attr} needs a value, e.g. attr: ${attr} var(--state)`);
        const bad = tokens.slice(value3, to).find((t) => ns && t.type === "url" || t.type === "function" && !TEXT_FUNCTIONS.has(t.value));
        if (bad) throw new Error(`${subject} takes ${TAKES[ns ? "attr" : kind]}; ${bad.type === "url" ? "url" : bad.value}() is not supported`);
        if (kind === "focus") {
          edits.push({ from, to: colon, text: "--rcss-focus" });
          rule.focus = true;
        } else if (kind === "text") {
          edits.push({ from, to: colon, text: "--rcss-text" });
          rule.text = true;
        } else {
          edits.push({ from, to: colon, text: ATTR_PREFIX + attr });
          if (kind === "attr") edits.push({ from: value3 - 1, to: tokens[value3].type === "ws" ? value3 + 1 : value3, text: "" });
          if (!(rule.attrs ??= []).includes(attr)) rule.attrs.push(attr);
        }
        if (!rules.includes(rule)) rules.push(rule);
        return true;
      } catch (e) {
        warn(`${e.message} in "${snippet(from, to)}". Declaration left unchanged.`);
        return false;
      }
    }
    function declaration(from, to, rule, conditional = false) {
      let colon = from;
      while (colon < to && tokens[colon].type !== ":") colon++;
      const name = text2(from, colon);
      if (rule?.onSpec) {
        mutation(from, colon, to, rule.onSpec);
        return;
      }
      if (rule?.focusWhen) {
        dropDeclaration(from, to, "a :focus(when()) rule only requests focus; its declarations would apply all the time");
        return;
      }
      if (tokens.slice(colon + 1, to).some((t) => t.type === "function" && t.value === "typed")) {
        try {
          typedDeclaration(name, colon, to);
        } catch (e) {
          warn(`${e.message} in "${snippet(from, to)}". Declaration left unchanged.`);
        }
        return;
      }
      if (name.toLowerCase() === "bind") {
        try {
          bindDeclaration(colon, to, rule, conditional);
        } catch (e) {
          warn(`${e.message} in "${snippet(from, to)}". Declaration left unchanged.`);
        }
        return;
      }
      const lower = name.trim().toLowerCase();
      if ((lower === "focus" || lower === "text" || lower === "attr") && !valueDeclaration(lower, name, from, colon, to, rule)) return;
      const hasState = tokens.slice(colon + 1, to).some((t) => t.type === "function" && t.value === "state");
      if (name.startsWith("--attr-") && !hasState && !valueDeclaration("attr-ns", name, from, colon, to, rule)) return;
      if (name.toLowerCase() === "on" || hasState) {
        try {
          if (hasState) stateDeclaration(name, colon, to, rule, conditional);
          else onDeclaration(from, colon, to, rule, conditional);
        } catch (e) {
          warn(`${e.message} in "${snippet(from, to)}". Declaration left unchanged.`);
        }
        return;
      }
      const local = [];
      const decls = [];
      try {
        for (let i = colon + 1; i < to; i++) {
          const t = tokens[i];
          if (t.type !== "function") continue;
          if (!claims(i)) {
            if (EXCLUDED["fn:" + t.value]) excludedFunction(i);
            continue;
          }
          if (!rule) throw new Error("reactive functions are only supported inside style rules");
          const close = matching(tokens, i);
          const node = parseCall(i, close, false);
          if (typeof node === "string") local.push({ from: i, to: close + 1, text: node });
          else {
            const varName = VAR_PREFIX + (++varCounter).toString(36);
            local.push({ from: i, to: close + 1, text: `var(${varName})` });
            decls.push({ varName, call: node });
          }
          i = close;
        }
      } catch (e) {
        warn(`${e.message} in "${snippet(from, to)}". Declaration left unchanged.`);
        return;
      }
      edits.push(...local);
      if (decls.length) {
        if (!rules.includes(rule)) rules.push(rule);
        rule.decls.push(...decls);
      }
      if (name.toLowerCase() === "content" && rule && !pseudo(rule)) contentDeclaration(colon, to, rule, local);
    }
    function pseudo(rule) {
      for (let r = rule; r; r = r.parent)
        if (r.prelude && /::|:(before|after|first-line|first-letter|marker|placeholder|backdrop)\b/i.test(text2(...r.prelude))) return true;
      return false;
    }
    function contentDeclaration(colon, to, rule, local) {
      const fns = tokens.slice(colon + 1, to).filter((t) => t.type === "function" || t.type === "url");
      if (!fns.some((t) => CONTENT_STATE.has(t.value)) || fns.some((t) => t.type === "url" || CONTENT_NATIVE.has(t.value))) return;
      use("decl:content");
      if (!trusted) return;
      if (!runtimes.text) {
        warn(missing("content: var(\u2026) as DOM text", DECLARATION_FEATURE.content));
        return;
      }
      const [end2, imp] = important(colon + 1, to);
      let value3 = "";
      for (let k = colon + 1; k < end2; ) {
        const ed = local.find((x) => x.from === k);
        if (ed) {
          value3 += ed.text;
          k = ed.to;
        } else {
          value3 += tokens[k].type === "comment" ? " " : raw(k);
          k++;
        }
      }
      edits.push({ from: to, to, text: `; --rcss-text: ${value3.trim()}${imp ? " !important" : ""}` });
      rule.text = true;
      if (!rules.includes(rule)) rules.push(rule);
    }
    const trimEnd = (from, to) => {
      while (to > from && (tokens[to - 1].type === "ws" || tokens[to - 1].type === "comment")) to--;
      return to;
    };
    function dropDeclaration(from, to, why) {
      warn(`${why}: "${snippet(from, to)}" is dropped.`);
      edits.push({ from, to: trimEnd(from, to), text: "" });
    }
    function dropNested(from, to, rule) {
      warn(`nested rules and at-rules are not supported inside ${rule.onSpec ? "an :on()" : "a :focus(when())"} rule; "${snippet(from, to)}" is dropped.`);
      edits.push({ from, to, text: "" });
    }
    function onRule(r, on, from, b, close) {
      const spec = { id: ++handlerCounter, sig: text2(from, close + 1), trigger: on.trigger, mods: on.mods, slots: [], modSlots: {}, certain: r.certain === true };
      r.onSpec = spec;
      let head = "";
      for (const k of ["prevent", "stop"]) {
        if (!on.mods[k]) continue;
        const prop = spec.modSlots[k] = slot(`${on.trigger.key}|${k}`);
        head += ` ${prop}: ${spec.id};`;
      }
      if (head) edits.push({ from: b + 1, to: b + 1, text: head });
      block(b + 1, close, r);
      if (!spec.slots.length && !head) warn(`the :on(${on.trigger.key}) rule "${snippet(from, b)}" changes no state and has no modifier; it does nothing.`);
      rules.push(r);
    }
    function mutation(from, colon, to, spec) {
      const name = text2(from, colon);
      const [end2, imp] = important(colon + 1, to);
      if (!name.startsWith("--") || name.startsWith("--attr-") || name.startsWith("--rcss-"))
        return dropDeclaration(from, to, `an :on() rule contains only state changes like --open: toggle(); "${name}" is not one (a rule describes either an event or a style)`);
      let m;
      try {
        m = runtimes.onRules.mutation(name, text2(colon + 1, end2), spec.trigger);
      } catch (e) {
        return dropDeclaration(from, to, e.message);
      }
      const mut = { ...m, id: ++handlerCounter, rule: spec };
      use("mut:" + mut.op);
      if (/\bevent\(/i.test(text2(colon + 1, end2))) use("expr:event");
      const prop = slot(`${spec.trigger.key}|${name}`);
      spec.slots = spec.slots.filter((x) => x.prop !== prop);
      spec.slots.push({ prop, m: mut });
      edits.push({ from, to: trimEnd(from, to), text: `${prop}: ${mut.id}${imp ? " !important" : ""}` });
    }
    function focusRule(r, conds, from, b, close) {
      r.focusWhen = conds;
      block(b + 1, close, r);
      rules.push(r);
    }
    function selector(from, to, parent, pre) {
      const local = [];
      try {
        let items;
        const itemEnd = (at) => (items ??= split(from, to)).find(([a, b]) => at >= a && at < b)?.[1] ?? to;
        const special = /* @__PURE__ */ new Set();
        let depth = 0;
        for (let i = from; i < to; i++) {
          const tt = tokens[i].type;
          if (tt === "function" || tt === "(" || tt === "[") {
            depth++;
            continue;
          }
          if (tt === ")" || tt === "]") {
            depth--;
            continue;
          }
          if (tt !== ":" || tokens[i - 1]?.type === ":") continue;
          const t = tokens[i + 1];
          if (t?.type === "function" && (t.value === "on" || t.value === "focus")) {
            const what = t.value === "on" ? ":on()" : ":focus(when())";
            const end3 = matching(tokens, i + 1) + 1;
            if (!pre) throw new Error(`${what} is not supported in this position`);
            if (depth > 0) throw new Error(`${what} cannot be inside :not(), :is(), :where() or :has()`);
            const [, cTo2] = compound(from, to, i);
            const stop2 = itemEnd(i);
            if (significant(cTo2, stop2) < stop2) throw new Error(`${what} must be on the subject of the selector (its last compound)`);
            if (t.value === "on" && pre.focus.length || t.value === "focus" && pre.on) throw new Error("a rule cannot combine :on() and :focus(when())");
            if (special.has(stop2)) throw new Error(`one ${what} per selector`);
            special.add(stop2);
            const arg2 = text2(i + 2, end3 - 1);
            if (t.value === "on") {
              use("sel:on");
              if (!runtimes.onRules) throw new Error(missing(":on()", DECLARATION_FEATURE["on-rule"]));
              let c;
              try {
                c = runtimes.onRules.trigger(arg2);
              } catch (e) {
                throw e.message === "feature:gestures" ? new Error(missing(":on(drag)", DECLARATION_FEATURE.drag)) : e;
              }
              use(c.trigger.phase !== void 0 ? "gesture:drag" : "trigger:" + (c.trigger.outside ? "outside" : c.trigger.dom));
              for (const [k, v] of Object.entries(c.mods)) if (v) use("mod:" + k);
              const same = (a) => a.trigger.key === c.trigger.key && JSON.stringify(a.mods) === JSON.stringify(c.mods);
              if (pre.focus.length || pre.on && !same(pre.on)) throw new Error("every selector of an :on() rule must use the same trigger and modifiers; write one rule per trigger");
              pre.on = c;
            } else {
              const m = /^when\(([\s\S]*)\)$/i.exec(arg2.trim());
              if (!m) throw new Error(":focus() takes when(condition), e.g. input:focus(when(--open)); plain :focus is native CSS");
              use("sel:focus-when");
              if (!runtimes.focusWhen) throw new Error(missing(":focus(when())", DECLARATION_FEATURE["focus-when"]));
              if (pre.on) throw new Error("a rule cannot combine :on() and :focus(when())");
              pre.focus.push(parseCondition(m[1]));
            }
            pre.special.push([i, end3]);
            local.push({ from: i, to: end3, text: ":is(*)" });
            i = end3 - 1;
            continue;
          }
          const def = t && (t.type === "ident" || t.type === "function") ? selectors.get(t.value.toLowerCase()) : void 0;
          if (!def) {
            const feature = t && EXCLUDED["sel:" + t.value.toLowerCase()];
            if (feature) throw new Error(missing(`:${t.value.toLowerCase()}${t.type === "function" ? "()" : ""}`, feature));
            continue;
          }
          use("sel:" + def.name);
          if (def.functional !== (t.type === "function")) throw new Error(`:${def.name} ${def.functional ? "needs" : "takes no"} arguments`);
          const end2 = def.functional ? matching(tokens, i + 1) + 1 : i + 2;
          const arg = def.functional ? text2(i + 2, end2 - 1) : "";
          const [cFrom, cTo] = compound(from, to, i);
          const candidate = resolveNesting(parent, strip(cFrom, i) + strip(end2, cTo));
          local.push({ from: i, to: end2, text: def.compile(arg, candidate, runtime) });
          i = end2 - 1;
        }
        if (special.size && special.size !== items.length)
          throw new Error(`every selector of the rule must use ${pre?.on ? ":on()" : ":focus(when())"} (a rule describes either an event or a style)`);
      } catch (e) {
        warn(`${e.message} in selector "${snippet(from, to)}". Rule left unchanged.`);
        return null;
      }
      edits.push(...local);
      return resolveNesting(parent, strip(from, to));
    }
    function compound(from, to, at) {
      const isCombinator = (i) => {
        const t = tokens[i];
        return t.type === "ws" || t.type === "," || t.type === "delim" && ">+~".includes(t.value);
      };
      const opener = (i) => tokens[i].type === "function" || tokens[i].type === "(" || tokens[i].type === "[";
      let a = at;
      while (a > from && !isCombinator(a - 1) && !opener(a - 1)) {
        a--;
        if (tokens[a].type === ")" || tokens[a].type === "]") a = openerOf(a, from);
      }
      let b = at;
      while (b < to && !isCombinator(b) && tokens[b].type !== ")" && tokens[b].type !== "]") {
        if (tokens[b].type === "(" || tokens[b].type === "[" || tokens[b].type === "function") b = matching(tokens, b);
        b++;
      }
      return [a, b];
    }
    function openerOf(close, from) {
      let depth = 0;
      for (let i = close; i >= from; i--) {
        const t = tokens[i].type;
        if (t === ")" || t === "]") depth++;
        else if (t === "(" || t === "[" || t === "function") {
          if (--depth === 0) return i;
        }
      }
      return from;
    }
    function strip(a, b) {
      let s = "";
      let negated = 0;
      const closers = [];
      for (let i = a; i < b; i++) {
        const t = tokens[i];
        if (t.type === ":" && negated === 0) {
          const pe = tokens[i + 1]?.type === ":";
          const n = tokens[i + (pe ? 2 : 1)];
          if (n && (n.type === "ident" || n.type === "function")) {
            const name = n.value.toLowerCase();
            if (pe || STATEFUL.has(name) || selectors.has(name) || name === "on" && n.type === "function") {
              const nameIdx = i + (pe ? 2 : 1);
              i = n.type === "function" ? matching(tokens, nameIdx) : nameIdx;
              s += ":is(*)";
              continue;
            }
          }
        }
        if (t.type === "function" || t.type === "(") {
          const isNot = t.type === "function" && t.value === "not";
          closers.push(isNot);
          if (isNot) negated++;
        } else if (t.type === ")" && closers.pop()) negated--;
        s += t.type === "comment" ? " " : raw(i);
      }
      return s.replace(/\s+/g, " ").trim();
    }
    function block(from, to, rule, conditional = false) {
      let i = from;
      while (i < to) {
        i = significant(i, to);
        if (i >= to) break;
        const t = tokens[i];
        if (t.type === ";") {
          i++;
          continue;
        }
        if (t.type === "delim" && t.value === "@" && tokens[i + 1]?.type === "ident") {
          const name = tokens[i + 1].value.toLowerCase();
          const b2 = boundary(i + 2, to);
          if (rule?.onSpec || rule?.focusWhen) {
            const end2 = b2 >= to || tokens[b2].type === ";" ? b2 + 1 : matching(tokens, b2) + 1;
            dropNested(i, end2, rule);
            i = end2;
            continue;
          }
          if (b2 >= to || tokens[b2].type === ";") {
            i = b2 + 1;
            continue;
          }
          const close = matching(tokens, b2);
          if (GROUPING.has(name)) block(b2 + 1, close, rule, conditional || name !== "layer");
          else if (hasReactiveSyntax(source3.slice(t.start, tokens[close]?.end ?? source3.length)))
            warn(`Reactive syntax inside @${name} is not supported; that block is left unchanged.`);
          i = close + 1;
          continue;
        }
        const b = boundary(i, to);
        if (b < to && tokens[b].type === "{") {
          const close = matching(tokens, b);
          if (rule?.onSpec || rule?.focusWhen) {
            dropNested(i, close + 1, rule);
            i = close + 1;
            continue;
          }
          if (!trusted && tokens.slice(i, b).some((x, k) => x.type === "function" && (x.value === "on" || x.value === "focus") && tokens[i + k - 1]?.type === ":")) {
            warn(`:on() and :focus(when()) are ignored in untrusted stylesheets (cross-origin, or inline <style> with trustInlineStyles: false); "${snippet(i, b)}" is dropped.`);
            edits.push({ from: i, to: close + 1, text: "" });
            i = close + 1;
            continue;
          }
          const pre = { focus: [], special: [] };
          const match = selector(i, b, rule?.match ?? null, pre);
          let plain;
          if (!pre.special.length) plain = text2(i, b);
          else {
            plain = "";
            for (let k = i; k < b; k++) {
              const sp = pre.special.find(([x]) => x === k);
              if (sp) {
                plain += ":is(*)";
                k = sp[1] - 1;
              } else plain += tokens[k].type === "comment" ? " " : raw(k);
            }
            plain = plain.replace(/\s+/g, " ").trim();
          }
          const certain = !conditional && (rule ? rule.certain === true : true) && strip(i, b) === plain;
          if (match !== null) {
            const r = { match, decls: [], states: [], certain, prelude: [i, b], parent: rule ?? void 0 };
            if (pre.on) onRule(r, pre.on, i, b, close);
            else if (pre.focus.length) focusRule(r, pre.focus, i, b, close);
            else block(b + 1, close, r, conditional);
          }
          i = close + 1;
        } else {
          declaration(i, b, rule, conditional);
          i = b + 1;
        }
      }
    }
    block(0, tokens.length, null);
    edits.sort((a, b) => a.from - b.from);
    let css = "";
    for (let i = 0, e = 0; i < tokens.length; ) {
      if (edits[e]?.from === i) {
        css += edits[e].text;
        i = edits[e++].to;
      } else css += raw(i++);
    }
    return { css, rules, runtime, handlers, uses: uses2, changed: edits.length > 0 || runtime.setup.length > 0 };
  }
  function resolveNesting(parent, sel) {
    if (!parent) return sel;
    const tokens = tokenize(sel);
    const parts = [];
    let start2 = 0;
    const push = (end2) => {
      let s = "";
      let amp = false;
      for (let i = start2; i < end2; i++) {
        const t = tokens[i];
        if (t.type === "delim" && t.value === "&") {
          s += `:is(${parent})`;
          amp = true;
        } else s += sel.slice(t.start, t.end);
      }
      s = s.trim();
      if (s) parts.push(amp ? s : `:is(${parent}) ${s}`);
    };
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type === ",") {
        push(i);
        start2 = i + 1;
      } else if (tokens[i].type === "(" || tokens[i].type === "function" || tokens[i].type === "[") i = matching(tokens, i);
    }
    push(tokens.length);
    return parts.join(", ");
  }
  function splitRules(css) {
    const t = tokenize(css);
    const out = [];
    let i = 0;
    while (i < t.length) {
      if (t[i].type === "ws" || t[i].type === "comment" || t[i].type === ";") {
        i++;
        continue;
      }
      let j = i;
      for (; j < t.length; j++) {
        const k = t[j].type;
        if (k === ";") break;
        if (k === "{") {
          j = matching(t, j);
          break;
        }
        if (k === "(" || k === "[" || k === "function") j = matching(t, j);
      }
      const end2 = Math.min(j, t.length - 1);
      out.push(css.slice(t[i].start, t[end2].end));
      i = end2 + 1;
    }
    return out;
  }
  var excludedNames = (kind) => Object.keys(EXCLUDED).filter((k) => k.startsWith(kind)).map((k) => k.slice(kind.length));
  var quick;
  var quickKey = -1;
  function hasReactiveSyntax(css) {
    if (quickKey !== functions.size * 1e3 + selectors.size) {
      quickKey = functions.size * 1e3 + selectors.size;
      quick = new RegExp(
        `(?:^|[^\\w-])(?:state|typed|${[...functions.keys(), ...excludedNames("fn:")].join("|")})\\(|:(?:${[...selectors.keys(), ...excludedNames("sel:")].join("|")})(?![\\w-])|(?:^|[;{\\s])(?:on|bind|text|attr|focus)\\s*:|:(?:on|focus)\\(|--attr-[a-z]|(?:^|[;{\\s])content\\s*:[^;}]*\\b(?:var|when|previous|direction)\\(`,
        "i"
      );
    }
    return quick.test(css);
  }
  var URL_FUNCTIONS = /* @__PURE__ */ new Set(["url", "src", "image-set", "-webkit-image-set"]);
  var TEXT_FUNCTIONS = /* @__PURE__ */ new Set(["var", "previous", "direction", "when", "if", "style"]);
  function rewriteURLs(tokens, repl, base) {
    const abs = (u) => {
      if (!u || u.startsWith("#")) return void 0;
      try {
        return `"${new URL(u, base).href}"`;
      } catch {
        return void 0;
      }
    };
    const stack = [];
    let prev1, prev2;
    tokens.forEach((t, i) => {
      if (t.type === "url") {
        const u = abs(t.value);
        if (u) repl[i] = `url(${u})`;
      } else if (t.type === "string") {
        const atImport = prev1?.type === "ident" && prev1.value.toLowerCase() === "import" && prev2?.value === "@";
        if (atImport || URL_FUNCTIONS.has(stack[stack.length - 1])) {
          const u = abs(t.value);
          if (u) repl[i] = u;
        }
      }
      if (t.type === "function") stack.push(t.value);
      else if (t.type === "(") stack.push("");
      else if (t.type === ")") stack.pop();
      if (t.type !== "ws" && t.type !== "comment") {
        prev2 = prev1;
        prev1 = t;
      }
    });
  }

  // src/state/textof.ts
  function textOf(raw) {
    const s = raw.trim();
    if (!s) return null;
    const t = tokenize(s).filter((x) => x.type !== "comment");
    if (t.length === 1 && t[0].type === "string") return t[0].value;
    if (t.some((x) => x.type === "ws" || x.type === "string" || x.type === "function" || x.type === "url")) return void 0;
    return s;
  }

  // src/state/text.ts
  var PROP = "--rcss-text";
  var registered2 = false;
  var bindings = /* @__PURE__ */ new Map();
  if (dev) probes.textBindings = () => bindings.size;
  var TextBinding = class {
    constructor(el) {
      this.el = el;
      const kids = el.childNodes;
      if (!(kids.length === 0 || kids.length === 1 && kids[0].nodeType === Node.TEXT_NODE)) {
        this.yielded = true;
        warn(`text: on ${describeElement(this.el)} is ignored: the element has other content (child elements or several nodes). Put the text in its own element, e.g. <span class="label"></span>, and target that.`);
      }
    }
    el;
    queued;
    rules = 0;
    node;
    created = false;
    original = "";
    /** What we last wrote; undefined while the original content is shown. */
    written;
    next = null;
    /** Gave up ownership: the content was not ours to change, or someone else changed it. */
    yielded = false;
    compute() {
      if (this.yielded || !this.el.isConnected) return false;
      const v = textOf(getComputedStyle(this.el).getPropertyValue(PROP));
      if (v === void 0) {
        if (hasReactiveSyntax(getComputedStyle(this.el).getPropertyValue(PROP))) return false;
        warn(`text: on ${describeElement(this.el)} needs one value (a string, a number or a keyword); "${getComputedStyle(this.el).getPropertyValue(PROP).trim().slice(0, 60)}" is not shown.`);
        return false;
      }
      this.next = v;
      return v !== (this.written ?? null);
    }
    /** Someone else changed the text or the children since our last write. */
    foreign() {
      if (this.written === void 0) return false;
      return this.node.parentNode !== this.el || this.el.childNodes.length !== 1 || this.node.data !== this.written;
    }
    write() {
      if (this.yielded) return;
      if (this.foreign()) {
        this.yield();
        return;
      }
      if (this.next === null) {
        this.restore();
        return;
      }
      if (this.written === void 0) {
        const first = this.el.firstChild;
        if (first && (first.nodeType !== Node.TEXT_NODE || this.el.childNodes.length > 1)) {
          this.yield();
          return;
        }
        this.created = !first;
        this.node = first ?? document.createTextNode("");
        this.original = first ? first.data : "";
        if (this.created) this.el.append(this.node);
      }
      this.node.data = this.next;
      this.written = this.next;
    }
    yield() {
      this.yielded = true;
      warn(`text: on ${describeElement(this.el)} stopped: its text or children were changed by something else, which now owns them.`);
    }
    /** Back to the original content (unless someone else took the text over). */
    restore() {
      if (this.written === void 0 || this.yielded || this.foreign()) return;
      if (this.created) this.node.remove();
      else this.node.data = this.original;
      this.written = void 0;
      this.node = void 0;
    }
    dispose() {
      this.restore();
      this.yielded = true;
    }
  };
  function register2() {
    if (registered2) return;
    registered2 = true;
    try {
      CSS.registerProperty({ name: PROP, syntax: "*", inherits: false });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "InvalidModificationError"))
        warn("text: needs CSS.registerProperty() (Chrome 78+, Safari 16.4+, Firefox 128+); a text: rule on an element would also apply to its descendants.");
    }
    stateChangeHooks.add((c) => within(bindings, c.owner, (b) => late(b)));
    refreshers.add(() => bindings.forEach((b) => late(b)));
    sheetChangeHooks.add(() => bindings.forEach((b) => late(b)));
  }
  function textWatcher(match) {
    register2();
    return {
      selector: match,
      add(el) {
        let b = bindings.get(el);
        if (!b) {
          bindings.set(el, b = new TextBinding(el));
          runtimeStats.bindings++;
        }
        b.rules++;
        late(b);
      },
      remove(el) {
        const b = bindings.get(el);
        if (!b || --b.rules) {
          if (b) late(b);
          return;
        }
        bindings.delete(el);
        runtimeStats.bindings--;
        b.dispose();
      }
    };
  }
  runtimes.text = textWatcher;

  // src/state/attrdecl.ts
  var sets = /* @__PURE__ */ new Map();
  var registered3 = /* @__PURE__ */ new Set();
  if (dev) probes.attrBindings = () => sets.size;
  function attrText(kind, s) {
    if (kind === "tabindex") return TABINDEX.has(s) ? s : false;
    if (kind === "aria-number") return NUMBER2.test(s) ? s : false;
    if (kind !== "data" && kind !== "text") s = s === "1" ? "true" : s === "0" ? "false" : s;
    switch (kind) {
      case "boolean":
        return s === "true" ? "" : s === "false" ? null : false;
      case "aria-boolean":
        return s === "true" || s === "false" ? s : false;
      case "aria-tristate":
        return s === "true" || s === "false" || s === "mixed" ? s : false;
      case "aria-current":
        return ARIA_CURRENT.has(s) ? s : false;
      case "data":
      case "text":
        return s;
    }
  }
  var tagOf = (el) => el.localName + (el instanceof HTMLInputElement ? `[type=${el.type}]` : "");
  var NOT_REQUIRABLE = /* @__PURE__ */ new Set(["hidden", "range", "color", "submit", "reset", "image", "button"]);
  var PRESSABLE = /^(button|summary)$/;
  var SELECTABLE_ROLES = /* @__PURE__ */ new Set(["option", "tab", "row", "gridcell", "columnheader", "rowheader", "treeitem"]);
  function applicability(el, name) {
    if (name === "disabled") {
      if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement || el instanceof HTMLFieldSetElement || el instanceof HTMLOptGroupElement || el instanceof HTMLOptionElement) return;
      if (el.localName.includes("-")) {
        const ce = customElements.get(el.localName);
        if (ce?.formAssociated) return;
        if (!ce) return ["wait", msg(`<${el.localName}> is not defined yet; disabled is written once it is defined and form-associated.`)];
        return ["skip", msg(`<${el.localName}> is not form-associated (static formAssociated = true), so disabled does nothing natively.`)];
      }
      return ["skip", msg(`disabled only works on button, input, select, textarea, option, optgroup and fieldset; on <${tagOf(el)}> it would not disable anything. Use aria-disabled with an inactive action, or a native control.`)];
    }
    if (name === "required") {
      if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) return;
      if (el instanceof HTMLInputElement && !NOT_REQUIRABLE.has(el.type)) return;
      return ["skip", msg(`required only works on input (text-like, date, number, checkbox, radio, file), select and textarea; on <${tagOf(el)}> it would not be validated.`)];
    }
    if (name === "hidden") return el instanceof HTMLElement ? void 0 : ["skip", msg(`hidden is an HTML attribute; <${el.localName}> is not an HTML element.`)];
    const role = el.getAttribute("role");
    if (name === "aria-pressed" && !(role ? role === "button" : PRESSABLE.test(el.localName) || el instanceof HTMLInputElement && el.type === "button"))
      return ["warn", msg(`aria-pressed is for toggle buttons; <${tagOf(el)}>${role ? ` with role="${role}"` : ""} is not a button. The attribute is written; check the pattern.`)];
    if (name === "aria-selected" && !(role ? SELECTABLE_ROLES.has(role) : /^(option|tr|td|th)$/.test(el.localName)))
      return ["warn", msg(`aria-selected needs a role like tab, option, row or gridcell; <${tagOf(el)}>${role ? ` with role="${role}"` : " without a role"} does not support it. The attribute is written; check the pattern.`)];
    return;
  }
  var AttrSet = class {
    constructor(el) {
      this.el = el;
    }
    el;
    queued;
    dead = false;
    waiting = false;
    slots = /* @__PURE__ */ new Map();
    compute() {
      if (this.dead || !this.el.isConnected) return false;
      const cs = getComputedStyle(this.el);
      let change = false;
      for (const [name, s] of this.slots) {
        if (s.yielded) continue;
        const raw = cs.getPropertyValue(ATTR_PREFIX + name);
        const t = textOf(raw);
        let next = t === null ? void 0 : t === void 0 ? false : attrText(s.kind, t);
        if (next === false && hasReactiveSyntax(raw)) next = s.done === false ? void 0 : s.done;
        else if (next === false) {
          warn(`attr: ${name} on <${tagOf(this.el)}> cannot be ${raw.trim().slice(0, 60)}: ${s.kind === "boolean" || s.kind === "aria-boolean" ? "use true or false (1 or 0)" : s.kind === "aria-tristate" ? "use true, false or mixed" : s.kind === "aria-number" ? "use a number" : s.kind === "aria-current" ? `use one of ${[...ARIA_CURRENT].join(", ")}` : s.kind === "tabindex" ? "use 0 or -1" : "use one string, number or keyword"}. The attribute is left unchanged.`);
          next = s.done === false ? void 0 : s.done;
        }
        s.next = next;
        if (next !== s.done) change = true;
      }
      return change;
    }
    write() {
      if (this.dead) return;
      for (const [name, s] of this.slots) if (!s.yielded && s.next !== s.done) this.apply(name, s);
    }
    apply(name, s) {
      const el = this.el;
      const cur = el.getAttribute(name);
      if (s.written !== void 0 && cur !== s.written) {
        s.yielded = true;
        this.disown(name);
        warn(`attr: ${name} on ${describeElement(el)} stopped: the attribute was changed by something else, which now owns it.`);
        return;
      }
      if (s.next === void 0 && s.written === void 0) {
        s.done = void 0;
        return;
      }
      let owners = ownedAttributes.get(el);
      const owner = owners?.get(name);
      if (owner && owner !== this) {
        s.done = false;
        warn(`attr: ${name} on ${describeElement(el)} is ignored: a state(\u2026, bind(${name})) on the same element owns that attribute. Use one of the two.`);
        return;
      }
      if (s.next === void 0) {
        if (s.written !== void 0) {
          if (s.original === null) el.removeAttribute(name);
          else el.setAttribute(name, s.original);
          s.written = void 0;
          this.disown(name);
        }
        s.done = void 0;
        return;
      }
      if (s.next !== null) {
        const why = applicability(el, name);
        if (why) {
          warn(`attr: ${name} on <${tagOf(el)}>: ${why[1]}`);
          if (why[0] !== "warn") {
            s.done = false;
            if (why[0] === "wait" && !this.waiting) {
              this.waiting = true;
              const ref = new WeakRef(this);
              customElements.whenDefined(el.localName).then(() => {
                const b = ref.deref();
                if (b) late(b);
              });
            }
            return;
          }
        }
      }
      if (s.written === void 0) {
        s.original = cur;
        if (!owners) ownedAttributes.set(el, owners = /* @__PURE__ */ new Map());
        owners.set(name, this);
      }
      if (s.kind === "boolean") {
        if (cur !== null !== (s.next !== null)) el.toggleAttribute(name, s.next !== null);
      } else if (s.next === null) {
        if (cur !== null) el.removeAttribute(name);
      } else if (cur !== s.next) el.setAttribute(name, s.next);
      s.written = el.getAttribute(name);
      s.done = s.next;
    }
    disown(name) {
      const owners = ownedAttributes.get(this.el);
      if (owners?.get(name) === this) owners.delete(name);
    }
    add(name) {
      const s = this.slots.get(name);
      if (s) s.rules++;
      else this.slots.set(name, { kind: kindOf2(name), rules: 1 });
    }
    /** One rule for `name` stopped matching; the last one restores the attribute. */
    drop(name) {
      const s = this.slots.get(name);
      if (!s || --s.rules) return;
      if (!s.yielded) {
        s.next = void 0;
        this.apply(name, s);
      }
      this.slots.delete(name);
    }
    dispose() {
      for (const name of [...this.slots.keys()]) {
        this.slots.get(name).rules = 1;
        this.drop(name);
      }
      this.dead = true;
    }
  };
  function register3(names) {
    if (!registered3.size) {
      stateChangeHooks.add((c) => within(sets, c.owner, (b) => late(b, true)));
      refreshers.add(() => sets.forEach((b) => late(b)));
      sheetChangeHooks.add(() => sets.forEach((b) => late(b)));
    }
    for (const name of names) {
      if (registered3.has(name)) continue;
      registered3.add(name);
      try {
        CSS.registerProperty({ name: ATTR_PREFIX + name, syntax: "*", inherits: false });
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "InvalidModificationError"))
          warn("attr: needs CSS.registerProperty() (Chrome 78+, Safari 16.4+, Firefox 128+); an attr: rule on an element would also apply to its descendants.");
      }
    }
  }
  function attrWatcher(match, names) {
    register3(names);
    return {
      selector: match,
      add(el) {
        let b = sets.get(el);
        if (!b) {
          sets.set(el, b = new AttrSet(el));
          runtimeStats.bindings++;
        }
        for (const n of names) b.add(n);
        late(b);
      },
      remove(el) {
        const b = sets.get(el);
        if (!b) return;
        for (const n of names) b.drop(n);
        if (b.slots.size) {
          late(b);
          return;
        }
        sets.delete(el);
        runtimeStats.bindings--;
        b.dispose();
      }
    };
  }
  runtimes.attrs = attrWatcher;

  // src/state/bindattr-runtime.ts
  function parse(b, raw, like2) {
    if (b.kind === "boolean") return raw === null ? void 0 : { type: "boolean", v: true };
    if (raw === null) return void 0;
    const bool2 = () => raw === "true" || raw === "false" ? { type: "boolean", v: raw === "true" } : "invalid";
    if (b.kind === "aria-boolean") return bool2();
    if (b.kind === "aria-number") return NUMBER2.test(raw) ? { type: "number", v: +raw, unit: "" } : "invalid";
    if (b.kind === "aria-tristate") {
      if (raw === "mixed") return like2.type === "boolean" ? "invalid" : { type: like2.type, v: raw };
      const t = bool2();
      return t !== "invalid" && like2.type !== "boolean" ? { type: like2.type, v: raw } : t;
    }
    if (b.kind === "tabindex") return TABINDEX.has(raw.trim()) ? { type: "number", v: +raw, unit: "" } : "invalid";
    if (b.kind === "aria-current") {
      if (like2.type === "boolean") return bool2();
      return ARIA_CURRENT.has(raw) ? { type: like2.type, v: raw } : "invalid";
    }
    switch (like2.type) {
      case "boolean":
        return bool2();
      case "number":
        return NUMBER2.test(raw) ? { type: "number", v: +raw, unit: "" } : "invalid";
      case "dimension": {
        const u = like2.unit ?? "";
        const n = raw.toLowerCase().endsWith(u) ? raw.slice(0, raw.length - u.length) : "";
        return NUMBER2.test(n) ? { type: "dimension", v: +n, unit: u } : "invalid";
      }
      case "string":
        return { type: "string", v: raw };
      // A keyword state is written into CSS as is: only an identifier is safe (no url(), no ";").
      case "value":
        return IDENT2.test(raw) ? { type: "value", v: raw } : "invalid";
    }
  }
  function serializeAttr(b, v) {
    if (b.kind === "boolean") return v.type === "boolean" ? v.v ? "" : null : void 0;
    if (b.kind === "tabindex") return v.type === "number" && TABINDEX.has(String(v.v)) ? String(v.v) : void 0;
    if (v.type === "boolean") return v.v ? "true" : "false";
    if (b.kind === "aria-boolean") return void 0;
    if (b.kind === "aria-number") return v.type === "number" ? fmt(v.v) : void 0;
    if (b.kind === "aria-tristate") return ["true", "false", "mixed"].includes(String(v.v)) ? String(v.v) : void 0;
    if (b.kind === "aria-current") return ARIA_CURRENT.has(String(v.v)) ? String(v.v) : void 0;
    if (v.type === "number" || v.type === "dimension") return fmt(v.v) + (v.unit ?? "");
    return String(v.v);
  }
  var describe3 = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.classList.length ? "." + [...el.classList].join(".") : "");
  var DISABLEABLE = /^(button|input|select|textarea|fieldset|optgroup|option)$/i;
  var REQUIRABLE = /^(input|select|textarea)$/i;
  var AttrBinding = class {
    constructor(el, b) {
      this.el = el;
      this.b = b;
      this.original = el.getAttribute(b.name);
      let names = ownedAttributes.get(el);
      if (!names) ownedAttributes.set(el, names = /* @__PURE__ */ new Map());
      names.set(b.name, this);
      if (b.name === "disabled" && !DISABLEABLE.test(el.tagName)) warn(`bind(disabled) on ${describe3(el)}: disabled only affects form controls (button, input, select, textarea, fieldset\u2026); the attribute is set but changes nothing natively.`);
      if (b.name === "required" && !REQUIRABLE.test(el.tagName)) warn(`bind(required) on ${describe3(el)}: required only affects input, select and textarea.`);
    }
    el;
    b;
    /** The attribute before Reactive CSS wrote it (null: absent). */
    original;
    /** What Reactive CSS last left in the attribute; undefined before the first write. */
    written;
    warnedForeign = false;
    get name() {
      return this.b.name;
    }
    /** The initial state from the original attribute, or `fallback` (with a diagnostic when invalid). */
    initial(fallback) {
      const v = parse(this.b, this.original, fallback);
      if (v === "invalid") {
        warn(`${this.b.name}="${this.original}" on ${describe3(this.el)} is not a valid value for this state; using the state() initial value and rewriting the attribute.`);
        return fallback;
      }
      return v ?? fallback;
    }
    /** Writes the state to the attribute (only when its text changes). */
    write(v) {
      const s = serializeAttr(this.b, v);
      if (s === void 0) {
        warn(`${this.b.name} on ${describe3(this.el)} cannot hold the value ${String(v.v)}; the attribute is left unchanged.`);
        return;
      }
      const el = this.el, name = this.b.name;
      const current = el.getAttribute(name);
      if (this.written !== void 0 && current !== this.written && !this.warnedForeign) {
        this.warnedForeign = true;
        warn(`${name} on ${describe3(el)} was changed by something else; Reactive CSS does not read it back, and overwrites it with the state on every change.`);
      }
      if (this.b.kind === "boolean") {
        if (current !== null !== (s !== null)) el.toggleAttribute(name, s !== null);
      } else if (s === null) {
        if (current !== null) el.removeAttribute(name);
      } else if (current !== s) el.setAttribute(name, s);
      this.written = el.getAttribute(name);
    }
    /** Restores the original attribute, unless something else changed it since our last write. */
    release() {
      const names = ownedAttributes.get(this.el);
      if (names?.get(this.b.name) === this) names.delete(this.b.name);
      if (this.written === void 0 || this.el.getAttribute(this.b.name) !== this.written) return;
      if (this.original === null) this.el.removeAttribute(this.b.name);
      else this.el.setAttribute(this.b.name, this.original);
    }
  };
  runtimes.attrBinding = (el, b) => new AttrBinding(el, b);

  // src/state/focusdecl.ts
  var PROP2 = "--rcss-focus";
  var ARMING = /* @__PURE__ */ new Set(["click", "keydown", "input", "change", "pointerup", "submit"]);
  var bindings2 = /* @__PURE__ */ new Map();
  var armed = /* @__PURE__ */ new Set();
  var candidates3 = [];
  var keyArm = null;
  var pressContinues = (e) => !!e && !e.defaultPrevented && (e.key === "Enter" || [...e.key].length === 1);
  var registered4 = false;
  if (dev) probes.focusBindings = () => bindings2.size;
  var FocusBinding = class {
    constructor(el) {
      this.el = el;
    }
    el;
    queued;
    rules = 0;
    dead = false;
    /** Last value read; undefined before the first read (which never focuses). */
    last;
    /** The focused element when the activating event changed the state. */
    activeAtArm = null;
    /** The activating event's target (a click need not focus anything, e.g. buttons in WebKit). */
    originAtArm = null;
    compute() {
      if (this.dead || !this.el.isConnected) return false;
      const raw = getComputedStyle(this.el).getPropertyValue(PROP2);
      const t = textOf(raw);
      let v = t === "true" || t === "1";
      if (t !== null && !v && t !== "false" && t !== "0") {
        if (hasReactiveSyntax(raw)) return false;
        warn(`focus: on <${this.el.localName}> needs true or false (1 or 0), not ${raw.trim().slice(0, 60)}; it counts as false.`);
        v = false;
      }
      if (this.last === false && v && armed.has(this)) candidates3.push(this);
      this.last = v;
      return false;
    }
    write() {
    }
    dispose() {
      this.dead = true;
      armed.delete(this);
    }
  };
  function arm2(b) {
    const e = activation.event;
    if (!e || !e.isTrusted || !ARMING.has(e.type)) return;
    if (!armed.has(b)) {
      armed.add(b);
      b.activeAtArm = document.activeElement;
      b.originAtArm = e.target instanceof Element ? e.target : null;
    }
    if (e instanceof KeyboardEvent) keyArm = e;
  }
  var isOpenLayer = (el) => el instanceof HTMLDialogElement && el.open || el.hasAttribute("popover") && el.matches(":popover-open");
  function resolve(sameTask) {
    if (sameTask && pressContinues(keyArm)) return;
    keyArm = null;
    const list3 = candidates3.filter((b) => !b.dead && b.el.isConnected && b.last);
    candidates3 = [];
    try {
      pick(list3);
    } finally {
      for (const b of armed) b.activeAtArm = b.originAtArm = null;
      armed.clear();
    }
  }
  function pick(list3) {
    list3.sort((a, b) => a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
    for (const b of list3) {
      const el = b.el;
      const active = document.activeElement;
      if (active && active !== document.body && b.activeAtArm && active !== b.activeAtArm) return;
      if (active && (active === el || el.contains(active))) return;
      for (const start2 of [active, b.originAtArm])
        for (let a = start2; a && a !== document.body; a = a.parentElement)
          if (isOpenLayer(a) && !a.contains(el)) return;
      if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) {
        note(`focus: ${describeElement(el)} is not rendered when its state applies; focus is unchanged.`);
        continue;
      }
      if (el.closest("[inert]") || el.matches(":disabled")) {
        note(`focus: ${describeElement(el)} is ${el.matches(":disabled") ? "disabled" : "inert"}; focus is unchanged.`);
        continue;
      }
      el.focus();
      if (document.activeElement === el) return;
      warn(el.hasAttribute("tabindex") || el.matches("a[href], button, input, select, textarea, summary, [contenteditable]") ? `focus: ${describeElement(el)} did not take focus (inert, inside a modal dialog, or not focusable here); focus is unchanged.` : `focus: ${describeElement(el)} is not focusable. Give it tabindex="-1" in the HTML (Reactive CSS never adds tabindex).`);
    }
  }
  function register4() {
    if (registered4) return;
    registered4 = true;
    try {
      CSS.registerProperty({ name: PROP2, syntax: "*", inherits: false });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "InvalidModificationError"))
        warn("focus: needs CSS.registerProperty() (Chrome 78+, Safari 16.4+, Firefox 128+); a focus: rule on an element would also apply to its descendants.");
    }
    stateChangeHooks.add((c) => within(bindings2, c.owner, (b) => {
      arm2(b);
      late(b);
    }));
    refreshers.add(() => bindings2.forEach((b) => late(b)));
    sheetChangeHooks.add(() => bindings2.forEach((b) => late(b)));
    onAfterLate(resolve);
  }
  function focusWatcher(match) {
    register4();
    return {
      selector: match,
      add(el) {
        let b = bindings2.get(el);
        if (!b) {
          bindings2.set(el, b = new FocusBinding(el));
          runtimeStats.bindings++;
        }
        b.rules++;
        late(b);
      },
      remove(el) {
        const b = bindings2.get(el);
        if (!b || --b.rules) {
          if (b) late(b);
          return;
        }
        bindings2.delete(el);
        runtimeStats.bindings--;
        b.dispose();
      }
    };
  }
  var FocusWhen = class {
    constructor(el, cond) {
      this.el = el;
      this.cond = cond;
      this.refs = cond.names.map((n) => new StateRef(el, n, this));
      late(this);
    }
    el;
    cond;
    queued;
    dead = false;
    last;
    activeAtArm = null;
    originAtArm = null;
    refs;
    notify() {
      if (this.dead) return;
      arm2(this);
      late(this);
    }
    compute() {
      if (this.dead || !this.el.isConnected) return false;
      let v = false;
      try {
        v = evaluate(this.cond.ast, (n) => this.refs[this.cond.names.indexOf(n)].state()) === true;
      } catch (e) {
        if (!(e instanceof ConditionError)) throw e;
        warn(`:focus(when(${this.cond.text})) on ${describeElement(this.el)}: ${e.message}; it counts as false.`);
      }
      if (this.last === false && v && armed.has(this)) candidates3.push(this);
      this.last = v;
      return false;
    }
    write() {
    }
    dispose() {
      this.dead = true;
      armed.delete(this);
      for (const r of this.refs) r.dispose();
    }
  };
  function focusWhenWatcher(match, cond) {
    register4();
    const requests = /* @__PURE__ */ new Map();
    return {
      selector: match,
      add(el) {
        if (!requests.has(el)) {
          requests.set(el, new FocusWhen(el, cond));
          runtimeStats.bindings++;
        }
      },
      remove(el) {
        const r = requests.get(el);
        if (!r) return;
        requests.delete(el);
        r.dispose();
        runtimeStats.bindings--;
      }
    };
  }
  runtimes.focus = focusWatcher;
  runtimes.focusWhen = focusWhenWatcher;

  // src/functions/values.ts
  var NUMBER3 = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([a-z%]*)$/i;
  function parseNumber(s) {
    const m = NUMBER3.exec(s.trim());
    return m ? { v: +m[1], unit: m[2].toLowerCase() } : void 0;
  }
  var isStatic = (a) => a.parts.every((p) => typeof p === "string");
  function numericRange(min, max, step) {
    const a = parseNumber(min);
    const b = parseNumber(max);
    if (!a || !b) return void 0;
    const unit = a.unit === b.unit ? a.unit : a.v === 0 && !a.unit ? b.unit : b.v === 0 && !b.unit ? a.unit : void 0;
    if (unit === void 0) return void 0;
    let s;
    if (step !== void 0) {
      const n = parseNumber(step);
      if (!n || n.unit !== unit && !(n.unit === "" && n.v === 0))
        throw new Error(/^m?s$/.test(n?.unit ?? "") && unit !== "s" && unit !== "ms" ? `step "${step}" must use the same unit as min and max; a third argument is a step, never an update interval: to re-roll over time use live(random(...), 2s)` : `step "${step}" must use the same unit as min and max`);
      if (n.v <= 0) throw new Error("step must be greater than 0");
      s = n.v;
    }
    return { min: a.v, max: b.v, step: s, unit };
  }
  function randomValue(min, max, step, r) {
    const n = numericRange(min, max, step);
    if (n) return fromRange(n, r);
    if (step !== void 0) throw new Error("`by` steps need min and max as plain numbers in one unit");
    return `calc(${min} + (${max} - ${min}) * ${fmt(r)})`;
  }
  function fromRange(n, r) {
    let v = n.min;
    if (n.max > n.min) {
      v = n.step ? n.min + Math.floor(r * (Math.floor((n.max - n.min) / n.step + 1e-9) + 1)) * n.step : n.min + r * (n.max - n.min);
    }
    return fmt(v) + n.unit;
  }
  var perElementNative;
  function nativeRandomIsPerElement() {
    if (perElementNative !== void 0) return perElementNative;
    perElementNative = false;
    if (typeof CSS === "undefined" || typeof document === "undefined" || !CSS.supports("width", "random(0px, 1px)")) return false;
    const probe = document.createElement("div");
    probe.style.setProperty("display", "none");
    for (let i = 0; i < 2; i++) {
      const c = probe.appendChild(document.createElement("i"));
      c.style.setProperty("display", "block");
      c.style.setProperty("width", "random(0px, 1000000px)");
    }
    document.documentElement.append(probe);
    const [a, b] = [...probe.children].map((e) => getComputedStyle(e).width);
    probe.remove();
    return perElementNative = a !== b;
  }
  var nativeSupports = (call2) => typeof CSS !== "undefined" && ["width", "opacity", "rotate", "transition-duration", "z-index"].some((p) => CSS.supports(p, call2));
  var NATIVE_KEY = /^(element-scoped|property-scoped|--[\w-]+|fixed\b)/;
  var text = (args) => `random(${args.map((a) => a.text).join(", ")})`;
  defineFunction({
    name: "random",
    kind: "generator",
    // Native-first (0.9.0 hardening): a call that uses native-only syntax (a sharing key such as
    // --name, element-scoped, property-scoped or fixed) and that the browser supports is not claimed:
    // it stays native CSS, with no diagnostic.
    matches(argText) {
      return !(NATIVE_KEY.test(argText.trim().toLowerCase()) && nativeSupports(`random(${argText})`));
    },
    compile(args) {
      let first = 0;
      let shared = false;
      const head = args[0]?.text.toLowerCase() ?? "";
      if (args.length > 2 && isStatic(args[0]) && (/^(auto|element-shared)$/.test(head) || NATIVE_KEY.test(head))) {
        if (NATIVE_KEY.test(head))
          throw new Error(`"${args[0].text}" needs native random() support, which this browser lacks; Reactive CSS supports auto and element-shared`);
        shared = head === "element-shared";
        first = 1;
      }
      const rest = args.length - first;
      if (rest < 2 || rest > 3) throw new Error("expected random(min, max), random(min, max, step) or random(min, max, by step)");
      let step;
      let by = false;
      if (rest === 3) {
        if (!isStatic(args[first + 2])) throw new Error("the step must be a value. To re-roll over time use live(random(...), 2s)");
        const m = /^by\s+(.+)$/i.exec(args[first + 2].text);
        by = !!m;
        step = m ? m[1] : args[first + 2].text;
        const n = parseNumber(step);
        if (!by && n && n.v <= 0) step = void 0;
      }
      const [min, max] = [args[first], args[first + 1]];
      let range;
      if (isStatic(min) && isStatic(max)) {
        randomValue(min.text, max.text, step, 0);
        range = numericRange(min.text, max.text, step);
        if (range && range.max < range.min) warn(`random(${min.text}, ${max.text}): max is below min, so the result is always min.`);
      }
      return { shared, first, step, range, by };
    },
    // Native-first: a top-level call that the browser supports as written, with per-element values,
    // is left to the browser (any units, a plain step). No binding, no JS at runtime. Nested calls
    // (live(), on()) need re-rolling, element-shared and "by" are Reactive CSS syntax: runtime.
    native(args, d, nested) {
      if (nested || d.shared || d.by || !nativeRandomIsPerElement()) return void 0;
      const call2 = text(args);
      return nativeSupports(call2) ? call2 : void 0;
    },
    create: (_ctx, args, d) => new RandomInstance(args, d)
  });
  var RandomInstance = class {
    constructor(args, d) {
      this.args = args;
      this.d = d;
    }
    args;
    d;
    value;
    roll() {
      const d = this.d;
      return d.range ? fromRange(d.range, Math.random()) : randomValue(this.args[d.first].get(), this.args[d.first + 1].get(), d.step, Math.random());
    }
    // element-shared: one value for every element, never re-rolled.
    get() {
      return this.d.shared ? this.d.sharedValue ??= this.roll() : this.value ??= this.roll();
    }
    reset() {
      this.value = void 0;
    }
  };
  var PickInstance = class {
    constructor(args) {
      this.args = args;
    }
    args;
    index = -1;
    get() {
      if (this.index < 0) this.index = Math.floor(Math.random() * this.args.length);
      return this.args[this.index].get();
    }
    reset() {
      this.index = -1;
    }
  };
  defineFunction({
    name: "pick",
    kind: "generator",
    compile(args) {
      if (args.length === 0) throw new Error("expected at least one value");
    },
    create: (_ctx, args) => new PickInstance(args)
  });

  // src/state/typed.ts
  var LENGTH = /* @__PURE__ */ new Set([
    "px",
    "cm",
    "mm",
    "q",
    "in",
    "pt",
    "pc",
    "em",
    "rem",
    "ex",
    "rex",
    "ch",
    "rch",
    "cap",
    "rcap",
    "ic",
    "ric",
    "lh",
    "rlh",
    "vw",
    "vh",
    "vi",
    "vb",
    "vmin",
    "vmax",
    "svw",
    "svh",
    "lvw",
    "lvh",
    "dvw",
    "dvh",
    "cqw",
    "cqh",
    "cqi",
    "cqb",
    "cqmin",
    "cqmax"
  ]);
  var UNIT_SYNTAX = { deg: "<angle>", rad: "<angle>", grad: "<angle>", turn: "<angle>", s: "<time>", ms: "<time>", dpi: "<resolution>", dpcm: "<resolution>", dppx: "<resolution>", x: "<resolution>", "%": "<percentage>" };
  var COLOR_FN = /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(/i;
  function inferSyntax(value3) {
    const v = value3.trim();
    const m = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?([a-z%]*)$/i.exec(v);
    if (m) {
      const unit = m[1].toLowerCase();
      if (!unit) return "<number>";
      return LENGTH.has(unit) ? "<length>" : UNIT_SYNTAX[unit];
    }
    if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) || COLOR_FN.test(v)) return "<color>";
    if (/^[a-z-]+$/i.test(v) && typeof CSS !== "undefined" && CSS.supports("color", v) && !/^(inherit|initial|unset|revert|revert-layer|currentcolor)$/i.test(v)) return "<color>";
    return void 0;
  }
  var registered5 = /* @__PURE__ */ new Map();
  if (dev) probes.typedProperties = () => registered5.size;
  function nativeRegistrations() {
    const out = /* @__PURE__ */ new Set();
    const walk = (rules) => {
      for (const r of rules) {
        if (typeof CSSPropertyRule !== "undefined" && r instanceof CSSPropertyRule) out.add(r.name);
        else if ("cssRules" in r) walk(r.cssRules);
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        walk(sheet.cssRules);
      } catch {
      }
    }
    return out;
  }
  function registerTyped(name, initial, explicit) {
    const syntax = explicit ?? inferSyntax(initial);
    if (!syntax) {
      warn(`typed(${initial}) for ${name}: cannot infer a type; write it, e.g. ${name}: typed(${initial}, "<length>"). Left as a plain custom property.`);
      return;
    }
    const prev = registered5.get(name);
    if (prev) {
      if (prev !== syntax) warn(`typed(): ${name} is already registered as ${prev}; the ${syntax} registration is skipped (registrations are document-wide).`);
      return;
    }
    if (nativeRegistrations().has(name)) {
      warn(`typed(): ${name} has a native @property rule; it is kept and typed() only sets the value.`);
      registered5.set(name, "native");
      return;
    }
    try {
      CSS.registerProperty({ name, syntax, inherits: true, initialValue: initial });
      registered5.set(name, syntax);
    } catch (e) {
      const why = e.name === "InvalidModificationError" ? "it is already registered by a script" : `the browser rejects ${initial} as the initial value of ${syntax} (it must not depend on the element, e.g. no em or %)`;
      warn(`typed(): ${name} was not registered: ${why}. Left as a plain custom property.`);
      registered5.set(name, "failed");
    }
  }
  runtimes.typed = registerTyped;

  // src/functions/live.ts
  var DEFAULT_INTERVAL = 1e3;
  var MIN_INTERVAL = 50;
  function parseTime(s) {
    const m = /^(\d*\.?\d+)(ms|s)$/i.exec(s.trim());
    return m ? +m[1] * (m[2].toLowerCase() === "s" ? 1e3 : 1) : void 0;
  }
  defineFunction({
    name: "live",
    kind: "operator",
    compile(args) {
      if (args.length < 1 || args.length > 2) throw new Error("expected live(expression) or live(expression, interval)");
      if (args.length === 1) return DEFAULT_INTERVAL;
      const t = args[1].parts.length === 1 && typeof args[1].parts[0] === "string" ? parseTime(args[1].text) : void 0;
      if (t === void 0) throw new Error(`interval "${args[1].text}" must be a time like 500ms or 2s`);
      if (t < MIN_INTERVAL) {
        warn(`live(): interval ${args[1].text} is below the ${MIN_INTERVAL}ms minimum; using ${MIN_INTERVAL}ms.`);
        return MIN_INTERVAL;
      }
      return t;
    },
    create: (ctx, args, ms) => new LiveInstance(ctx, args, ms)
  });
  var LiveInstance = class {
    constructor(ctx, args, ms) {
      this.ctx = ctx;
      this.args = args;
      this.ms = ms;
      every(ms, this);
    }
    ctx;
    args;
    ms;
    tick() {
      this.args[0].reset?.();
      this.ctx.notify();
    }
    get() {
      return this.args[0].get();
    }
    dispose() {
      unevery(this.ms, this);
    }
  };

  // src/functions/sources.ts
  var word = (a) => a && a.parts.length <= 1 ? a.text.toLowerCase() : void 0;
  var EVENTS2 = /* @__PURE__ */ new Set([
    "click",
    "dblclick",
    "contextmenu",
    "pointerenter",
    "pointerleave",
    "pointerdown",
    "pointerup",
    "mouseenter",
    "mouseleave",
    "focus",
    "blur",
    "focusin",
    "focusout",
    "input",
    "change",
    "keydown",
    "keyup",
    "animationend",
    "animationiteration",
    "transitionend",
    "toggle"
  ]);
  defineFunction({
    name: "on",
    kind: "event",
    compile(args) {
      if (args.length !== 2) throw new Error("expected on(event, expression)");
      const ev = word(args[0]);
      if (!ev || !EVENTS2.has(ev)) throw new Error(`unsupported event "${args[0].text}". Supported: ${[...EVENTS2].join(", ")}`);
      return ev;
    },
    // Evaluates once when bound, then again on every event on the element itself.
    create: (ctx, args, ev) => new OnInstance(ctx, args, ev)
  });
  var OnInstance = class {
    constructor(ctx, args, ev) {
      this.ctx = ctx;
      this.args = args;
      this.ev = ev;
      ctx.el.addEventListener(ev, this, { passive: true });
      runtimeStats.sources++;
    }
    ctx;
    args;
    ev;
    handleEvent() {
      this.args[1].reset?.();
      this.ctx.notify();
    }
    get() {
      return this.args[1].get();
    }
    dispose() {
      this.ctx.el.removeEventListener(this.ev, this);
      runtimeStats.sources--;
    }
  };
  var pointer = { x: 0, y: 0 };
  var listeners = 0;
  var PointerAxis = class {
    constructor(axis) {
      this.axis = axis;
    }
    axis;
    subs = /* @__PURE__ */ new Set();
    text;
    changed = false;
    get() {
      return this.text ??= fmt(pointer[this.axis]) + "px";
    }
    subscribe(s) {
      if (this.subs.has(s)) return;
      this.subs.add(s);
      if (listeners++ === 0) {
        addEventListener("pointermove", onMove, { passive: true });
        runtimeStats.observers++;
      }
      runtimeStats.sources++;
    }
    unsubscribe(s) {
      if (!this.subs.delete(s)) return;
      if (--listeners === 0) {
        removeEventListener("pointermove", onMove);
        runtimeStats.observers--;
      }
      runtimeStats.sources--;
    }
  };
  var axes = { x: new PointerAxis("x"), y: new PointerAxis("y") };
  function notifyPointer() {
    for (const a of [axes.x, axes.y]) {
      if (!a.changed) continue;
      a.changed = false;
      for (const s of a.subs) s.notify();
    }
  }
  function onMove(e) {
    for (const a of [axes.x, axes.y]) {
      const v = a.axis === "x" ? e.clientX : e.clientY;
      if (v === pointer[a.axis]) continue;
      pointer[a.axis] = v;
      a.text = void 0;
      a.changed = true;
    }
    if (axes.x.changed || axes.y.changed) frame(notifyPointer);
  }
  defineFunction({
    name: "mouse",
    kind: "source",
    compile(args) {
      const axis = word(args[0]);
      const mode = args.length > 1 ? word(args[1]) : "viewport";
      if (args.length > 2 || axis !== "x" && axis !== "y") throw new Error('expected mouse(x) or mouse(y), optionally with "viewport" or "local"');
      if (mode !== "viewport" && mode !== "local") throw new Error(`unknown coordinate mode "${args[1].text}"; use viewport or local`);
      return { axis, local: mode === "local" };
    },
    // Viewport coordinates are identical for every element: share one computation and write.
    shared: (d) => d.local ? void 0 : axes[d.axis],
    // Used for local mode, and for viewport mode nested inside another function.
    create: (ctx, _args, d) => new MouseInstance(ctx, d)
  });
  var MouseInstance = class {
    constructor(ctx, d) {
      this.ctx = ctx;
      this.d = d;
      axes[d.axis].subscribe(this);
    }
    ctx;
    d;
    notify() {
      this.ctx.notify();
    }
    get() {
      const a = axes[this.d.axis];
      if (!this.d.local) return a.get();
      const r = this.ctx.el.getBoundingClientRect();
      return fmt(pointer[this.d.axis] - (this.d.axis === "x" ? r.left : r.top)) + "px";
    }
    dispose() {
      axes[this.d.axis].unsubscribe(this);
    }
  };
  var observers = /* @__PURE__ */ new Map();
  if (dev) Object.assign(probes, { pointerListeners: () => listeners, intersectionObservers: () => observers.size });
  function observeVisibility(el, threshold, sub) {
    let s = observers.get(threshold);
    if (!s) {
      const subs = /* @__PURE__ */ new Map();
      const io = new IntersectionObserver((entries2) => {
        for (const e of entries2) {
          const visible = e.isIntersecting && e.intersectionRatio >= threshold;
          subs.get(e.target)?.forEach((f) => f.update(visible));
        }
      }, { threshold: threshold || 0 });
      observers.set(threshold, s = { io, subs });
      runtimeStats.observers++;
    }
    let set = s.subs.get(el);
    if (!set) {
      s.subs.set(el, set = /* @__PURE__ */ new Set());
      s.io.observe(el);
    }
    set.add(sub);
  }
  function unobserveVisibility(el, threshold, sub) {
    const s = observers.get(threshold);
    const set = s?.subs.get(el);
    if (!s || !set?.delete(sub) || set.size) return;
    s.subs.delete(el);
    s.io.unobserve(el);
    if (!s.subs.size) {
      s.io.disconnect();
      observers.delete(threshold);
      runtimeStats.observers--;
    }
  }
  defineFunction({
    name: "visible",
    kind: "source",
    compile(args) {
      if (args.length > 1) throw new Error("expected visible() or visible(<number between 0 and 1>)");
      if (!args.length) return 0;
      const t = Number(word(args[0]));
      if (!(t >= 0 && t <= 1)) throw new Error(`threshold "${args[0].text}" must be a number between 0 and 1`);
      return t;
    },
    // 0 until the browser reports the element as visible (at least `threshold` of it), then 1.
    create: (ctx, _args, threshold) => new VisibleInstance(ctx, threshold)
  });
  var VisibleInstance = class {
    constructor(ctx, threshold) {
      this.ctx = ctx;
      this.threshold = threshold;
      observeVisibility(ctx.el, threshold, this);
      runtimeStats.sources++;
    }
    ctx;
    threshold;
    visible = false;
    update(v) {
      if (v === this.visible) return;
      this.visible = v;
      this.ctx.notify();
    }
    get() {
      return this.visible ? "1" : "0";
    }
    dispose() {
      unobserveVisibility(this.ctx.el, this.threshold, this);
      runtimeStats.sources--;
    }
  };
  defineFunction({
    name: "viewport",
    kind: "native",
    compile(args) {
      const v = word(args[0]);
      if (args.length !== 1 || v !== "width" && v !== "height") throw new Error("expected viewport(width) or viewport(height)");
      return v;
    },
    // Dynamic viewport units track window.innerWidth / innerHeight natively: no runtime needed.
    native: (_args, v) => v === "width" ? "100dvw" : "100dvh"
  });

  // src/functions/geometry.ts
  var subjects = /* @__PURE__ */ new Map();
  var ro;
  if (dev) probes.sizeSubjects = () => subjects.size;
  function onResize(entries2) {
    for (const e of entries2) {
      const s = subjects.get(e.target);
      if (!s) continue;
      const box = e.borderBoxSize?.[0];
      const inline = box ? box.inlineSize : e.contentRect.width;
      const block = box ? box.blockSize : e.contentRect.height;
      const first = !s.measured, pw = s.width, ph = s.height;
      s.width = s.vertical ? block : inline;
      s.height = s.vertical ? inline : block;
      s.measured = true;
      for (const i of s.subs) i.measured(first ? void 0 : i.axis === "width" ? pw : ph);
    }
  }
  function observe2(el, i) {
    if (!ro) {
      ro = new ResizeObserver(onResize);
      runtimeStats.observers++;
    }
    let s = subjects.get(el);
    if (!s) {
      subjects.set(el, s = { subs: /* @__PURE__ */ new Set(), vertical: /^(vertical|sideways)/.test(getComputedStyle(el).writingMode), width: 0, height: 0, measured: false });
      ro.observe(el, { box: "border-box" });
    }
    s.subs.add(i);
    return s;
  }
  function unobserve(el, i) {
    const s = subjects.get(el);
    if (!s?.subs.delete(i) || s.subs.size) return;
    subjects.delete(el);
    ro.unobserve(el);
    if (!subjects.size) {
      ro.disconnect();
      ro = void 0;
      runtimeStats.observers--;
    }
  }
  var STREAK = 30;
  var SizeInstance = class {
    constructor(ctx, axis) {
      this.ctx = ctx;
      this.axis = axis;
      this.subject = observe2(ctx.el, this);
      runtimeStats.sources++;
    }
    ctx;
    axis;
    /** Consecutive same-direction changes that each followed a write of ours. */
    streak = 0;
    sign = 0;
    wrote = false;
    probing = false;
    changedWhileProbing = false;
    frozen = false;
    subject;
    /** prev: this axis before the change, undefined for the first measurement. */
    measured(prev) {
      const d = prev === void 0 ? 0 : this.subject[this.axis] - prev;
      if (prev !== void 0 && d === 0) return;
      if (this.probing) {
        this.changedWhileProbing = true;
        return;
      }
      if (this.frozen) return;
      const s = Math.sign(d);
      this.streak = this.wrote && s !== 0 && s === this.sign ? this.streak + 1 : 0;
      this.sign = s;
      if (this.streak >= STREAK) return this.probe();
      this.wrote = true;
      this.ctx.notify();
    }
    /** Stop writing for two frames: does the size keep changing without us? */
    probe() {
      this.probing = true;
      this.changedWhileProbing = false;
      frame(() => frame(() => {
        this.probing = false;
        this.streak = 0;
        if (this.changedWhileProbing) {
          this.ctx.notify();
          return;
        }
        this.frozen = true;
        warn(`element(${this.axis}) on ${describeElement(this.ctx.el)} feeds back into the element's own size (for example width: calc(element(width) + 10px)). Its value is frozen at ${fmt(this.subject[this.axis])}px. Measure a parent or a child instead.`);
      }));
    }
    get() {
      return this.subject.measured ? fmt(this.subject[this.axis]) + "px" : "";
    }
    dispose() {
      unobserve(this.ctx.el, this);
      runtimeStats.sources--;
    }
  };
  defineFunction({
    name: "element",
    kind: "source",
    syntax: "element(width | height)",
    matches: (text2) => /^\s*(width|height)\s*$/i.test(text2),
    compile: (args) => args[0].text.toLowerCase(),
    create: (ctx, _args, axis) => new SizeInstance(ctx, axis)
  });

  // src/state/gesture.ts
  var THRESHOLD = 3;
  var gestures = /* @__PURE__ */ new Map();
  var dragged = /* @__PURE__ */ new Set();
  var users2 = 0;
  var preventers = 0;
  var moving = false;
  var warnedTouch = /* @__PURE__ */ new WeakSet();
  if (dev) Object.assign(probes, { gestures: () => gestures.size, gestureListeners: () => +moving + (users2 > 0 ? 1 : 0) });
  var opts = (passive) => ({ capture: true, passive });
  function installDown(on, passive) {
    document.removeEventListener("pointerdown", onDown, { capture: true });
    if (on) document.addEventListener("pointerdown", onDown, opts(passive));
  }
  function moveListeners(on) {
    if (on === moving) return;
    moving = on;
    const m = on ? "addEventListener" : "removeEventListener";
    document[m]("pointermove", onMove2, opts(true));
    document[m]("pointerup", onUp, opts(true));
    document[m]("pointercancel", onCancel, opts(true));
    document[m]("lostpointercapture", onCancel, opts(true));
  }
  function onDown(e) {
    if (gestures.has(e.pointerId) || e.pointerType === "mouse" && e.button !== 0) return;
    const el = dragTarget(e.composedPath());
    if (!el || dragged.has(el)) return;
    if (el.matches(":disabled") || el.closest("[inert]")) return;
    const t = e.target;
    if (t instanceof Element && t !== el && el.contains(t) && t.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    if (dev && e.pointerType === "touch" && !warnedTouch.has(el) && getComputedStyle(el).touchAction === "auto") {
      warnedTouch.add(el);
      note(`:on(drag) on ${describeElement(el)}: touch-action is auto, so a touch drag scrolls the page and is cancelled. Add touch-action: none (or pan-y / pan-x) to the element.`);
    }
    if (preventers && dragTarget.prevents(el)) preventEvent(el, e);
    const r = el.getBoundingClientRect();
    const info = { startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, rect: r, starts: /* @__PURE__ */ new Map() };
    gestures.set(e.pointerId, { el, id: e.pointerId, info, started: false });
    dragged.add(el);
    moveListeners(true);
  }
  function run3(g, phase, e, activate = false) {
    activation.event = activate ? e : null;
    try {
      urgently(() => fireDrag(g.el, phase, e, g.info));
    } finally {
      activation.event = null;
    }
  }
  function end(g) {
    gestures.delete(g.id);
    dragged.delete(g.el);
    if (g.started) {
      try {
        if (g.el.hasPointerCapture?.(g.id)) g.el.releasePointerCapture(g.id);
      } catch {
      }
    }
    if (!gestures.size) moveListeners(false);
  }
  var gone = (g) => !g.el.isConnected || !dragTarget.has(g.el);
  function onMove2(e) {
    const g = gestures.get(e.pointerId);
    if (!g) return;
    if (gone(g)) {
      end(g);
      return;
    }
    const d = g.info;
    d.lastX = d.x;
    d.lastY = d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    if (!g.started) {
      if (Math.hypot(d.x - d.startX, d.y - d.startY) < THRESHOLD) return;
      g.started = true;
      d.lastX = d.startX;
      d.lastY = d.startY;
      try {
        g.el.setPointerCapture(g.id);
      } catch {
      }
      run3(g, "start", e);
    }
    run3(g, "move", e);
  }
  function onUp(e) {
    const g = gestures.get(e.pointerId);
    if (!g) return;
    end(g);
    if (!g.started || gone(g)) return;
    run3(g, "end", e, true);
    afterDrag.el = g.el;
    setTimeout(() => {
      if (afterDrag.el === g.el) afterDrag.el = null;
    });
  }
  function onCancel(e) {
    const g = gestures.get(e.pointerId);
    if (!g || e.type === "lostpointercapture" && e.target !== g.el) return;
    end(g);
    if (!g.started || gone(g)) return;
    run3(g, "cancel", e);
    run3(g, "end", e);
  }
  runtimes.gestures = {
    register(prevent) {
      users2++;
      if (prevent) preventers++;
      installDown(true, preventers === 0);
      return () => {
        users2--;
        if (prevent) preventers--;
        if (users2) {
          installDown(true, preventers === 0);
          return;
        }
        installDown(false, true);
        for (const g of [...gestures.values()]) end(g);
      };
    }
  };

  // src/state/persist.ts
  var PREFIX = "rcss:";
  var DELAY = 250;
  var IDENT3 = /^(-?[a-z_][\w-]*|#[0-9a-f]{3,8})$/i;
  var groups3 = /* @__PURE__ */ new Map();
  var counters2 = { writes: 0, reads: 0 };
  if (dev) Object.assign(probes, { persistKeys: () => groups3.size, persistWrites: () => counters2.writes });
  var id = (s) => (s.session ? "s:" : "l:") + s.key;
  function store(s) {
    try {
      return s.session ? sessionStorage : localStorage;
    } catch (e) {
      note(`persist("${s.key}"): ${s.session ? "sessionStorage" : "localStorage"} is not available (${e.name}); the state is not persisted.`);
      return void 0;
    }
  }
  var encode = (v) => JSON.stringify(v.type === "dimension" ? { t: v.type, v: v.v, u: v.unit } : { t: v.type, v: v.v });
  function decode(raw, like2) {
    if (raw === null) return void 0;
    let o;
    try {
      o = JSON.parse(raw);
    } catch {
      return void 0;
    }
    if (!o || typeof o !== "object") return void 0;
    let t;
    switch (o.t) {
      case "boolean":
        if (typeof o.v !== "boolean") return void 0;
        t = { type: "boolean", v: o.v };
        break;
      case "number":
        if (typeof o.v !== "number" || !Number.isFinite(o.v)) return void 0;
        t = { type: "number", v: o.v, unit: "" };
        break;
      case "dimension":
        if (typeof o.v !== "number" || !Number.isFinite(o.v) || typeof o.u !== "string" || !/^(%|[a-z]{1,6})$/.test(o.u)) return void 0;
        t = { type: "dimension", v: o.v, unit: o.u };
        break;
      case "string":
        if (typeof o.v !== "string" || o.v.length > 1e4) return void 0;
        t = { type: "string", v: o.v };
        break;
      case "value":
        if (typeof o.v !== "string" || !IDENT3.test(o.v)) return void 0;
        t = { type: "value", v: o.v };
        break;
      default:
        return void 0;
    }
    return assignable(like2, t) ? coerce(like2, t) : void 0;
  }
  function read(s, like2) {
    const st = store(s);
    if (!st) return void 0;
    let raw;
    try {
      raw = st.getItem(PREFIX + s.key);
    } catch {
      return void 0;
    }
    counters2.reads++;
    const v = decode(raw, like2);
    if (raw !== null && !v) note(`persist("${s.key}"): the stored value does not fit this state (${raw.slice(0, 60)}); the initial value is used.`);
    return v;
  }
  function flush2(g) {
    clearTimeout(g.timer);
    g.timer = void 0;
    const v = g.pending;
    if (!v) return;
    g.pending = void 0;
    const st = store(g.spec);
    if (!st) return;
    const text2 = encode(v);
    if (text2 === g.written) return;
    try {
      st.setItem(PREFIX + g.spec.key, text2);
      g.written = text2;
      g.lastWrite = Date.now();
      counters2.writes++;
    } catch (e) {
      note(`persist("${g.spec.key}"): the value could not be stored (${e.name}); the state keeps working without persistence.`);
    }
  }
  function schedule2(g, v) {
    g.pending = v;
    if (g.timer !== void 0) return;
    const wait = Math.max(0, g.lastWrite + DELAY - Date.now());
    g.timer = setTimeout(() => flush2(g), wait);
  }
  var flushAll = () => groups3.forEach(flush2);
  var listening2 = false;
  function listen3(on) {
    if (on === listening2) return;
    listening2 = on;
    const m = on ? "addEventListener" : "removeEventListener";
    window[m]("storage", onStorage);
    window[m]("pagehide", flushAll);
    document[m]("visibilitychange", onVisibility);
  }
  var onVisibility = () => {
    if (document.visibilityState === "hidden") flushAll();
  };
  function onStorage(e) {
    if (!e.key?.startsWith(PREFIX)) return;
    const g = groups3.get("l:" + e.key.slice(PREFIX.length));
    if (!g || e.storageArea !== localStorage) return;
    g.written = e.newValue ?? void 0;
    for (const c of g.cells) {
      const v = decode(e.newValue, c.value);
      if (v) apply2(g, c, v);
    }
  }
  var applying = false;
  function apply2(g, c, v) {
    applying = true;
    try {
      c.set(v);
    } finally {
      applying = false;
    }
  }
  var Link = class {
    constructor(g, cell) {
      this.g = g;
      this.cell = cell;
    }
    g;
    cell;
    changed() {
      if (applying) return;
      const v = this.cell.value;
      applying = true;
      try {
        for (const c of this.g.cells) if (c !== this.cell && !c.dead && !equal(c.value, v)) {
          const w = decode(encode(v), c.value);
          if (w) c.set(w);
        }
      } finally {
        applying = false;
      }
      schedule2(this.g, v);
    }
    release() {
      this.g.cells.delete(this.cell);
      if (this.g.cells.size) return;
      flush2(this.g);
      groups3.delete(id(this.g.spec));
      if (!groups3.size) listen3(false);
    }
  };
  runtimes.persist = {
    initial(spec, owner, fallback) {
      if (sensitive(owner)) {
        warn(`persist("${spec.key}") on ${describeElement(owner)} is refused: password, one-time-code and payment fields are never stored.`);
        return void 0;
      }
      const g = groups3.get(id(spec));
      for (const c of g?.cells ?? []) {
        const v = decode(encode(c.value), fallback);
        if (v) return v;
      }
      return read(spec, fallback);
    },
    link(spec, cell) {
      if (sensitive(cell.owner)) return { changed() {
      }, release() {
      } };
      let g = groups3.get(id(spec));
      if (!g) {
        groups3.set(id(spec), g = { spec, cells: /* @__PURE__ */ new Set(), lastWrite: 0 });
        listen3(true);
      }
      g.cells.add(cell);
      return new Link(g, cell);
    }
  };

  // src/selectors/blur.ts
  var BLURRED = "data-rcss-blur";
  var members = /* @__PURE__ */ new Map();
  var users3 = 0;
  var anywhere = 0;
  function onBlur(e) {
    const el = e.target;
    if (el instanceof Element && (anywhere || members.has(el))) el.setAttribute(BLURRED, "");
  }
  function onFocus(e) {
    const el = e.target;
    if (el instanceof Element && el.hasAttribute(BLURRED)) el.removeAttribute(BLURRED);
  }
  function install2(compound) {
    const w = compound === null ? null : {
      selector: compound,
      add: (el) => {
        members.set(el, (members.get(el) ?? 0) + 1);
      },
      remove: (el) => {
        const n = (members.get(el) ?? 1) - 1;
        if (n) {
          members.set(el, n);
          return;
        }
        members.delete(el);
        el.removeAttribute(BLURRED);
      }
    };
    if (users3++ === 0) {
      document.addEventListener("blur", onBlur, true);
      document.addEventListener("focus", onFocus, true);
    }
    if (w) watch(w);
    else anywhere++;
    return () => {
      if (w) unwatch(w);
      else if (!--anywhere) document.querySelectorAll(`[${BLURRED}]`).forEach((el) => {
        if (!members.has(el)) el.removeAttribute(BLURRED);
      });
      if (--users3) return;
      document.removeEventListener("blur", onBlur, true);
      document.removeEventListener("focus", onFocus, true);
    };
  }
  defineSelector({
    name: "blur",
    kind: "state",
    functional: false,
    syntax: ":blur",
    compile(_arg, compound, sheet) {
      const bare = !compound.replace(/:is\(\*\)/g, "").trim();
      sheet.setup.push(() => install2(bare ? null : compound));
      return `[${BLURRED}]`;
    }
  });

  // src/core/engine.ts
  var StaticArg = class {
    constructor(text2) {
      this.text = text2;
    }
    text;
    get() {
      return this.text;
    }
  };
  var DynamicArg = class {
    constructor(parts) {
      this.parts = parts;
    }
    parts;
    get() {
      let s = "";
      for (const p of this.parts) s += typeof p === "string" ? p : p.get();
      return s;
    }
    reset() {
      for (const p of this.parts) if (typeof p !== "string") p.reset?.();
    }
    dispose() {
      for (const p of this.parts) if (typeof p !== "string") p.dispose?.();
    }
  };
  var Composite = class {
    constructor(inst, args) {
      this.inst = inst;
      this.args = args;
    }
    inst;
    args;
    get() {
      return this.inst.get();
    }
    reset() {
      this.inst.reset?.();
      for (const a of this.args) a.reset?.();
    }
    dispose() {
      this.inst.dispose?.();
      for (const a of this.args) a.dispose?.();
    }
  };
  function argInstance(a, ctx) {
    if (a.parts.every((p) => typeof p === "string")) return a.shared ??= new StaticArg(a.parts.join(""));
    if (a.parts.length === 1) return instantiate(a.parts[0], ctx);
    return new DynamicArg(a.parts.map((p) => typeof p === "string" ? p : instantiate(p, ctx)));
  }
  function instantiate(node, ctx) {
    let args = node.staticArgs;
    if (!args) {
      args = node.args.map((a) => argInstance(a, ctx));
      if (args.some((a) => a.text === void 0)) return new Composite(node.def.create(ctx, args, node.data), args);
      node.staticArgs = args;
    }
    return node.def.create(ctx, args, node.data);
  }
  var Binding = class {
    constructor(el, decl) {
      this.el = el;
      this.decl = decl;
    }
    el;
    decl;
    queued;
    dead = false;
    last;
    inst;
    notify() {
      if (!this.dead) dirty(this);
    }
    compute() {
      if (this.dead || !this.el.isConnected) return false;
      let v;
      try {
        v = this.inst.get();
      } catch (e) {
        warn(`${this.decl.call.name}() failed: ${e.message}`);
        return false;
      }
      if (v === this.last) return false;
      this.last = v;
      return true;
    }
    write() {
      this.el.style.setProperty(this.decl.varName, this.last);
    }
  };
  function bind(el, decl) {
    const b = new Binding(el, decl);
    b.inst = instantiate(decl.call, b);
    settleLater(b);
    runtimeStats.bindings++;
    return b;
  }
  function unbind(b) {
    b.dead = true;
    b.inst.dispose?.();
    b.el.style.removeProperty(b.decl.varName);
    runtimeStats.bindings--;
  }
  var SHARED_MIN = 16;
  var SharedDecl = class {
    constructor(decl, source3) {
      this.decl = decl;
      this.source = source3;
    }
    decl;
    source;
    queued;
    members = /* @__PURE__ */ new Set();
    value;
    target = null;
    replan = true;
    notify() {
      dirty(this);
    }
    add(el) {
      if (!this.members.size) this.source.subscribe(this);
      this.members.add(el);
      this.replan = true;
      dirty(this);
      runtimeStats.bindings++;
    }
    remove(el) {
      if (!this.members.delete(el)) return;
      runtimeStats.bindings--;
      el.style.removeProperty(this.decl.varName);
      this.replan = true;
      if (this.members.size) {
        dirty(this);
        return;
      }
      this.source.unsubscribe(this);
      this.target?.style.removeProperty(this.decl.varName);
      this.target = null;
      this.value = void 0;
    }
    compute() {
      if (!this.members.size) return false;
      const v = this.source.get();
      if (!this.replan && v === this.value) return false;
      this.value = v;
      return true;
    }
    write() {
      const name = this.decl.varName;
      if (this.replan) {
        this.replan = false;
        const old = this.target;
        this.target = this.members.size >= SHARED_MIN ? this.ancestor() : null;
        if (old && old !== this.target) old.style.removeProperty(name);
        if (this.target && !old) {
          for (const el of this.members) if (el !== this.target) el.style.removeProperty(name);
        }
      }
      if (this.target) this.target.style.setProperty(name, this.value);
      else for (const el of this.members) el.style.setProperty(name, this.value);
    }
    ancestor() {
      let lca = null;
      for (const el of this.members) {
        if (!lca) lca = el;
        else while (lca && !lca.contains(el)) lca = lca.parentElement;
      }
      if (!lca || !("style" in lca)) return null;
      return lca.getElementsByTagName("*").length + 1 <= 2 * this.members.size ? lca : null;
    }
  };
  function ruleWatcher2(rule) {
    const bound = /* @__PURE__ */ new WeakMap();
    const shared = rule.decls.map((d) => {
      const src = d.call.def.shared?.(d.call.data);
      return src ? new SharedDecl(d, src) : null;
    });
    const local = rule.decls.filter((_, i) => !shared[i]);
    return {
      selector: rule.match,
      add(el) {
        if (!("style" in el)) return;
        for (const s of shared) s?.add(el);
        if (local.length === 1) bound.set(el, bind(el, local[0]));
        else if (local.length) bound.set(el, local.map((d) => bind(el, d)));
      },
      remove(el) {
        for (const s of shared) s?.remove(el);
        const b = bound.get(el);
        if (!b) return;
        if (Array.isArray(b)) b.forEach(unbind);
        else unbind(b);
        bound.delete(el);
      }
    };
  }
  var records = /* @__PURE__ */ new Map();
  if (dev) probes.sheetRecords = () => records.size;
  var loads = /* @__PURE__ */ new WeakMap();
  function sheetLabel(el) {
    if (el instanceof HTMLLinkElement) return el.getAttribute("href") ?? "a <link>";
    const i = [...document.querySelectorAll("style")].indexOf(el);
    return el.id ? `<style id="${el.id}">` : `inline <style> #${i + 1}`;
  }
  function readable(href, link) {
    const u = new URL(href, location.href);
    return u.origin === location.origin || u.protocol === "data:" || u.protocol === "blob:" || link.crossOrigin !== null;
  }
  var waits = /* @__PURE__ */ new WeakMap();
  function linkSheet(el) {
    const noHash = (u) => u?.replace(/#.*$/, "");
    if (el.sheet && noHash(el.sheet.href) === noHash(el.href)) return Promise.resolve(el.sheet);
    waits.get(el)?.();
    return new Promise((res) => {
      const done = () => {
        el.removeEventListener("load", done);
        el.removeEventListener("error", done);
        if (waits.get(el) === done) waits.delete(el);
        res(el.sheet);
      };
      waits.set(el, done);
      el.addEventListener("load", done);
      el.addEventListener("error", done);
    });
  }
  async function load(el) {
    const token = {};
    loads.set(el, token);
    let text2;
    let base;
    if (el instanceof HTMLLinkElement) {
      if (!el.href) return;
      if (!readable(el.href, el)) {
        note(`Skipped cross-origin stylesheet ${el.href}. If it contains Reactive CSS, serve it with CORS and add the crossorigin attribute to the <link>.`);
        drop(el);
        return;
      }
      try {
        const res = await fetch(el.href, { credentials: el.crossOrigin === "use-credentials" ? "include" : "same-origin" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        text2 = await res.text();
      } catch (e) {
        if (loads.get(el) === token)
          warn(`Cannot read stylesheet ${el.href} (${e.message}). Reactive CSS needs the stylesheet source: serve the page over http(s), and cross-origin sheets with CORS and the crossorigin attribute. If a Content-Security-Policy is set, connect-src must allow the stylesheet URL.`);
        return;
      }
      base = el.href;
      await linkSheet(el);
    } else text2 = el.textContent ?? "";
    if (loads.get(el) !== token || !el.isConnected) return;
    apply3(el, text2, base);
  }
  function apply3(el, text2, base) {
    drop(el);
    if (!hasReactiveSyntax(text2)) return;
    const label = sheetLabel(el);
    const sheet = el.sheet;
    if (!sheet) {
      warn(`${label}: the browser did not apply this stylesheet (blocked or failed to load), so its Reactive CSS is not processed.`);
      return;
    }
    const t0 = performance.now();
    const trusted = base ? new URL(base).origin === location.origin : config().trustInlineStyles !== false;
    const c = withSource(label, () => compile(text2, { baseURL: base, trusted }));
    runtimeStats.parseMs += performance.now() - t0;
    if (!c.changed) return;
    const swapped = withSource(label, () => rewrite(sheet, c.css));
    if (!swapped) return;
    const watchers = [];
    for (const r of c.rules) {
      if (r.states.length) watchers.push(stateWatcher(r.match, r.states));
      if (r.decls.length) watchers.push(ruleWatcher2(r));
      if (r.handler !== void 0) watchers.push(runtimes.on.watcher(r.match, r.handler, r.certain === true, c.handlers.get(r.handler), sheet));
      if (r.bind) watchers.push(runtimes.bind(r.match, r.bind));
      if (r.text) watchers.push(runtimes.text(r.match));
      if (r.attrs) watchers.push(runtimes.attrs(r.match, r.attrs));
      if (r.focus) watchers.push(runtimes.focus(r.match));
      if (r.onSpec) watchers.push(runtimes.onRules.watcher(r.match, r.onSpec, sheet));
      for (const cond of r.focusWhen ?? []) watchers.push(runtimes.focusWhen(r.match, cond));
      for (const name of r.forms ?? []) watchers.push(runtimes.bind(r.match, { name }));
    }
    const rec = { sheet, ...swapped, watchers, cleanups: [] };
    records.set(el, rec);
    runtimeStats.sheets++;
    rec.watchers.forEach(watch);
    rec.cleanups = [
      ...c.runtime.setup.map((fn) => fn()),
      ...[...c.handlers].map(([id2, set]) => runtimes.on.register(id2, set)),
      ...c.rules.filter((r) => r.onSpec).map((r) => runtimes.onRules.register(r.onSpec))
    ];
    settle();
    sheetChangeHooks.forEach((fn) => fn());
    flush();
  }
  var LEADING = (r) => r instanceof CSSImportRule || r instanceof CSSNamespaceRule || typeof CSSLayerStatementRule !== "undefined" && r instanceof CSSLayerStatementRule;
  function rewrite(sheet, css) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      warn("the stylesheet rules are not readable (cross-origin without CORS); its Reactive CSS is not processed.");
      return void 0;
    }
    let keep = 0;
    while (keep < rules.length && LEADING(rules[keep])) keep++;
    const original = [...rules].slice(keep).map((r) => r.cssText);
    const all = splitRules(css);
    let lead = 0;
    while (lead < all.length && (/^@(import|namespace|charset)\b/i.test(all[lead]) || /^@layer\b[^{]*;$/i.test(all[lead]))) lead++;
    const parts = all.slice(lead);
    for (let i = rules.length - 1; i >= keep; i--) sheet.deleteRule(i);
    for (const p of parts) {
      try {
        sheet.insertRule(p, sheet.cssRules.length);
      } catch {
      }
    }
    return { keep, original };
  }
  function drop(el) {
    const rec = records.get(el);
    if (!rec) return;
    records.delete(el);
    rec.watchers.forEach(unwatch);
    rec.cleanups.forEach((fn) => fn());
    if (el.isConnected && el.sheet === rec.sheet) {
      for (let i = rec.sheet.cssRules.length - 1; i >= rec.keep; i--) rec.sheet.deleteRule(i);
      for (const t of rec.original) {
        try {
          rec.sheet.insertRule(t, rec.sheet.cssRules.length);
        } catch {
        }
      }
    }
    runtimeStats.sheets--;
    sheetChangeHooks.forEach((fn) => fn());
  }
  var sourceObserver;
  var sources = {
    // Alternate and disabled sheets are processed too: they keep their native on/off state.
    selector: 'style, link[rel~="stylesheet" i]',
    add(el) {
      sourceObserver.observe(el, el instanceof HTMLLinkElement ? { attributes: true, attributeFilter: ["href", "disabled", "media"] } : { childList: true, characterData: true, subtree: true });
      load(el);
    },
    remove(el) {
      loads.delete(el);
      drop(el);
    },
    // A moved <style> or <link> gets a new CSSStyleSheet from its original source: process it again.
    move(el) {
      load(el);
    }
  };
  var started = false;
  function start() {
    if (started || typeof document === "undefined") return;
    started = true;
    sourceObserver = new MutationObserver((recs) => {
      const changed = /* @__PURE__ */ new Set();
      for (const r of recs) {
        const n = r.target.nodeType === 1 ? r.target : r.target.parentElement;
        const src = n?.closest("style, link");
        if (src) changed.add(src);
      }
      changed.forEach((el) => {
        if (el instanceof HTMLLinkElement && el.disabled) drop(el);
        load(el);
      });
    });
    afterMutations(settle);
    watch(sources);
  }
  function stop() {
    if (!started) return;
    started = false;
    unwatch(sources);
    sourceObserver?.disconnect();
    stopObserving();
  }
  function refresh2() {
    refreshers.forEach((fn) => fn());
    flush();
  }
  function stats() {
    return {
      ...runtimeStats,
      scheduled: subscriptionCount(),
      intervals: groupCount(),
      ...counters,
      ...dev ? { internal: Object.fromEntries(Object.entries(probes).map(([k, f]) => [k, f()])) } : {}
    };
  }

  // src/auto.ts
  window.ReactiveCSS = index_exports;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => start());
  else start();
})();
//# sourceMappingURL=reactive-css.js.map
