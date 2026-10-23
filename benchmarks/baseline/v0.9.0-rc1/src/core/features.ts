// Machine-readable feature registry: what Reactive CSS adds, how each feature relates to
// native CSS, and what is only planned. Source for describe(), documentation, validation,
// editor tooling and a future MCP server. A unit test keeps it in sync with the runtime
// registries (every shipped function, selector, action and trigger is listed here).

/** 'expression': evaluated only inside state(...) and set(--x, ...); native everywhere else. */
/** 'rule' (0.9.0): a pseudo-class that turns its rule into behavior (:on(), :focus(when())), not a style. */
export type FeatureKind = 'function' | 'expression' | 'selector' | 'declaration' | 'action' | 'trigger' | 'rule';
export type FeatureCategory = 'native' | 'simplify' | 'extend' | 'evaluate';
export type FeatureStatus = 'stable' | 'experimental' | 'planned' | 'rejected' | 'removed';

export interface FeatureArg { name: string; type: string; optional?: boolean; default?: string }

export interface Feature {
  name: string;
  kind: FeatureKind;
  category: FeatureCategory;
  status: FeatureStatus;
  since?: string;
  syntax: string;
  parameters?: FeatureArg[];
  returns?: string;
  /** false: compiles to native CSS. 'conditional': native when possible, else runtime. */
  requiresRuntime: boolean | 'conditional';
  /** How values update: once, on an interval, on events, from a browser source, from state, or natively. */
  evaluation?: 'static' | 'interval' | 'event' | 'source' | 'state' | 'native' | 'animation';
  nativeEquivalent?: string;
  dependsOn?: string[];
  /** Browser capabilities needed beyond the baseline (Chrome 111, Safari 16.4, Firefox 128). */
  support?: string;
  /** What is released when the element goes away. */
  cleanup?: string;
  description: string;
  /** For planned, rejected and removed entries: why. */
  reason?: string;
  /** Version that removed a previously shipped feature. */
  removedIn?: string;
  examples: string[];
}

const S = (name: string) => ({ name, type: '<state-name>' });

export const FEATURES: Feature[] = [
  // ---- values ------------------------------------------------------------------------
  { name: 'random', kind: 'function', category: 'extend', status: 'stable', since: '0.1', syntax: 'random([element-shared,] min, max [, by step])',
    parameters: [{ name: 'min', type: '<number> | <dimension>' }, { name: 'max', type: '<number> | <dimension>' }, { name: 'step', type: 'by <number> | <dimension>', optional: true }],
    returns: 'same type as min/max', requiresRuntime: 'conditional', nativeEquivalent: 'random() (CSS Values 5) when per-element semantics are confirmed',
    description: 'A random value per element, fixed until re-rolled by live() or on().', examples: ['.dot { opacity: random(0.3, 1); }'] },
  { name: 'pick', kind: 'function', category: 'extend', status: 'stable', since: '0.1', syntax: 'pick(value, ...)',
    returns: 'one of the values', requiresRuntime: true, description: 'One of the listed values, per element.', examples: ['.tag { background: pick(tomato, gold, teal); }'] },
  { name: 'live', kind: 'function', category: 'extend', status: 'stable', since: '0.1', syntax: 'live(expression, interval = 1s)',
    returns: 'the expression', requiresRuntime: true, description: 'Re-evaluates an expression on a shared interval.', examples: ['.p { translate: live(random(0px, 100px), 2s) 0; }'] },
  { name: 'on', kind: 'function', category: 'extend', status: 'stable', since: '0.1', syntax: 'on(event, expression)',
    returns: 'the expression', requiresRuntime: true, description: 'Re-evaluates an expression when an event fires on the element.', examples: ['.card { rotate: on(pointerenter, random(-5deg, 5deg)); }'] },
  { name: 'mouse', kind: 'function', category: 'extend', status: 'stable', since: '0.1', syntax: 'mouse(x | y [, viewport | local])',
    returns: '<length>', requiresRuntime: true, description: 'Pointer position; viewport mode is a shared source.', examples: ['.pad { --mx: mouse(x, local); }'] },
  { name: 'visible', kind: 'function', category: 'extend', status: 'stable', since: '0.1', syntax: 'visible([threshold])',
    returns: '0 | 1', requiresRuntime: true, description: '1 while at least `threshold` of the element is in the viewport.', examples: ['.reveal { opacity: visible(0.5); }'] },
  { name: 'viewport', kind: 'function', category: 'simplify', status: 'stable', since: '0.1', syntax: 'viewport(width | height)',
    returns: '<length>', requiresRuntime: false, nativeEquivalent: '100dvw / 100dvh', description: 'Viewport size; compiles to dynamic viewport units.', examples: ['.hero { height: viewport(height); }'] },
  { name: 'element', kind: 'function', category: 'extend', status: 'experimental', since: '0.4', syntax: 'element(width | height)',
    parameters: [{ name: 'axis', type: 'width | height' }], returns: '<length> (px), the border-box size; no value until first measured', requiresRuntime: true, evaluation: 'source',
    nativeEquivalent: 'container query units (cqw/cqh) measure a container for its descendants; anchor-size() measures an anchor',
    support: 'ResizeObserver with borderBoxSize', cleanup: 'unobserved when the element is removed; the shared observer disconnects when unused',
    description: 'The element\'s own measured size. Context-aware: element(#id) stays the native image function. A feedback loop (the value changing its own size) is detected and frozen with a warning.',
    examples: ['.card { --w: element(width); } .card .label { font-size: clamp(12px, calc(var(--w) / 16), 32px); }'] },
  { name: 'wave', kind: 'function', category: 'extend', status: 'removed', since: '0.4', removedIn: '0.5', syntax: 'wave(min, max, duration)', requiresRuntime: true, evaluation: 'animation',
    nativeEquivalent: '@property --y { syntax: "<length>"; inherits: false; initial-value: 0px } @keyframes y { from { --y: -8px } to { --y: 8px } } .floating { translate: 0 var(--y); animation: y 1.5s ease-in-out infinite alternate }',
    description: 'Was: smooth periodic motion of a registered custom property through the Web Animations API.',
    reason: 'Removed before beta: a convenience over native @property + @keyframes (which compose the same way: animation lists, calc(), several properties), at a measured main-thread style cost of 171-181 ms/s per 1,000 animated elements where a composited @keyframes translate costs 0. Animate translate/opacity/transform directly when possible.',
    examples: [] },
  // ---- state ---------------------------------------------------------------------------
  { name: 'state', kind: 'function', category: 'extend', status: 'stable', since: '0.2', syntax: '--name: state(initial [, bind(attribute)])',
    parameters: [{ name: 'initial', type: 'true | false | <number> | <dimension> | <string> | <keyword> | <color> | attr() | pick() (evaluated once per owner)' },
      { name: 'bind', type: 'bind(aria-expanded | aria-pressed | aria-selected | aria-current | disabled | hidden | required | data-*), experimental since 0.5.2', optional: true }],
    returns: 'the current state (booleans as 1 / 0); always one scalar value',
    requiresRuntime: true, support: 'bind(): trusted stylesheets only',
    cleanup: 'the cell is disposed when no state() declaration matches the owner; the generated property is registered once per state name per page; a bound attribute is restored to its original value if it still holds what Reactive CSS wrote',
    description: 'Mutable state owned by each matching element. The initial value may read the owner\'s attribute or pick at random (0.5). With bind(attribute) (experimental, 0.5.2) the owner\'s attribute initializes the state once and then follows every change synchronously, with HTML semantics: boolean attributes present or absent (never disabled="false"), ARIA states as "true"/"false" or aria-current tokens, data-* as text. External changes to the attribute are not read back.',
    examples: ['.accordion { --open: state(false); }', '.greeting { --message: state(attr(data-message, "Hello!")); }', '.menu { --open: state(false, bind(aria-expanded)); on: click(toggle(--open)); }'] },
  // ---- expressions (only inside state(...) and set(--x, ...); native everywhere else) ----------------------
  { name: 'attr', kind: 'expression', category: 'extend', status: 'experimental', since: '0.5', syntax: 'attr(name [, "fallback"])',
    parameters: [{ name: 'name', type: 'HTML attribute name' }, { name: 'fallback', type: '<string>', optional: true, default: '""' }], returns: '<string>', requiresRuntime: true, evaluation: 'static',
    nativeEquivalent: 'attr() (CSS Values 5) everywhere else: content: attr(data-label) and typed attr(name type(...)) are left to the browser',
    support: 'trusted stylesheets only (same as on: and bind:); never reads password, one-time-code or payment fields',
    description: 'In state(): the state owner\'s attribute, read once when the state is created. In set(): the attribute of the element with the on: declaration, read at event time. Always a string, escaped into one CSS string; no ancestor lookup.',
    examples: ['.greeting { --message: state(attr(data-message)); }', '.choice { on: click(set(--message, attr(data-message))); }'] },
  { name: 'pick', kind: 'expression', category: 'extend', status: 'experimental', since: '0.5', syntax: 'pick(value, ...) | pick(split(text, "delimiter"))',
    returns: 'one of the values (all of one type)', requiresRuntime: true, evaluation: 'static',
    description: 'One value at random, each time the expression is evaluated: once per owner in state(), on every event in set(). Nothing to pick: set() changes nothing and state() starts as "".',
    examples: ['.d { on: click(set(--face, pick(1, 2, 3, 4, 5, 6))); }'] },
  { name: 'split', kind: 'expression', category: 'extend', status: 'experimental', since: '0.5', syntax: 'split(text, "delimiter")',
    parameters: [{ name: 'text', type: '<string> | attr()' }, { name: 'delimiter', type: 'non-empty <string>' }], returns: 'a transient list, only as the single argument of pick()', requiresRuntime: true, evaluation: 'static',
    description: 'Splits a string at every occurrence of the delimiter; entries are trimmed and empty entries dropped. The list is never stored: state stays scalar. No escape for the delimiter itself: choose one that does not occur in the values.',
    examples: ['.shuffle { on: click(set(--message, pick(split(attr(data-greetings), "|")))); }'] },
  { name: 'when', kind: 'function', category: 'simplify', status: 'stable', since: '0.2', syntax: 'when(condition [, if-true [, if-false]])',
    returns: 'one of the branches (true or false without branches, 0.5.3), or no value when unknown', requiresRuntime: 'conditional', nativeEquivalent: 'if(style(...)) for boolean conditions with static branches',
    dependsOn: ['state'], description: 'Chooses a value from state.', examples: ['.content { opacity: when(--open, 1, 0); }'] },
  { name: 'previous', kind: 'function', category: 'extend', status: 'stable', since: '0.3', syntax: 'previous(--state)', parameters: [S('state')],
    returns: 'the value before the last effective change', requiresRuntime: true, dependsOn: ['state'],
    description: 'State history (also a condition operand).', examples: ['.c:when(--n > previous(--n)) { color: green; }'] },
  { name: 'direction', kind: 'function', category: 'extend', status: 'stable', since: '0.3', syntax: 'direction(--state)', parameters: [S('state')],
    returns: '1 | 0 | -1', requiresRuntime: true, dependsOn: ['state'],
    description: 'Whether a number or dimension state last went up or down.', examples: ['.c { color: when(direction(--n) < 0, red, green); }'] },
  { name: 'typed', kind: 'function', category: 'simplify', status: 'experimental', since: '0.3', syntax: '--name: typed(initial [, "<syntax>"])',
    returns: 'the value', requiresRuntime: true, nativeEquivalent: '@property { syntax; inherits: true; initial-value }',
    support: 'CSS.registerProperty', cleanup: 'none: registrations are permanent for the page (a native @property rule goes away with its stylesheet)',
    description: 'Registers a typed custom property, e.g. to make it animatable. Differences from @property: always inherits: true; the syntax is inferred from the value; the first compiled typed() for a name wins (later ones with another type are skipped with a warning); the registration is document-wide and permanent, even if its stylesheet is removed; an existing native @property for the name is kept. Prefer @property when you can write it.', examples: ['.card { --angle: typed(0deg); transition: --angle 300ms; }'] },
  // ---- selectors -------------------------------------------------------------------------
  { name: 'just-checked', kind: 'selector', category: 'extend', status: 'stable', since: '0.1', syntax: ':just-checked', requiresRuntime: true,
    description: 'After an observed unchecked → checked transition (never on load).', examples: ['input:just-checked + .icon { animation: pop 300ms; }'] },
  { name: 'just-unchecked', kind: 'selector', category: 'extend', status: 'stable', since: '0.1', syntax: ':just-unchecked', requiresRuntime: true,
    description: 'After an observed checked → unchecked transition.', examples: ['input:just-unchecked + .icon { animation: shrink 300ms; }'] },
  { name: 'nth-var', kind: 'selector', category: 'extend', status: 'stable', since: '0.1', syntax: ':nth-var(--name)', requiresRuntime: true, dependsOn: ['state'],
    description: 'The sibling whose 1-based index equals the variable (state cells read directly).', examples: ['.panel:nth-var(--active) { display: block; }'] },
  { name: 'when', kind: 'selector', category: 'extend', status: 'stable', since: '0.2', syntax: ':when(condition)', requiresRuntime: true, dependsOn: ['state'],
    description: 'Matches while a state condition is true.', examples: ['.meter:when(--value >= 80) { border-color: green; }'] },
  { name: 'changed', kind: 'selector', category: 'extend', status: 'stable', since: '0.3', syntax: ':changed(--state)', requiresRuntime: true, dependsOn: ['state'],
    description: 'Briefly after an observed change, until the animations it started finish.', examples: ['.c:changed(--n) .num { animation: flash 300ms; }'] },
  { name: 'blur', kind: 'selector', category: 'extend', status: 'experimental', since: '0.9.0', syntax: ':blur', requiresRuntime: true,
    cleanup: 'the marker attribute is removed when the element is focused again, removed, or no :blur rule matches it any more',
    description: 'From a genuine focus loss (the element\'s own blur event) until the element is focused again. Never matches an element that has not lost focus, unlike :not(:focus); an animation on it plays once per focus loss.',
    examples: ['input:blur:invalid { animation: shake 250ms; }'] },
  // ---- rules (0.9.0) -------------------------------------------------------------------------
  { name: 'on', kind: 'rule', category: 'extend', status: 'experimental', since: '0.9.0',
    syntax: ':on(event | keydown(Key) | keyup(Key) | outside(click | pointerdown | focusin) [, prevent] [, stop] [, once]) { --state: set(expr) | toggle() | increment(n?) | decrement(n?) | cycle(a, b, …) }',
    requiresRuntime: true, evaluation: 'event', dependsOn: ['state'], support: 'CSS.registerProperty; trusted stylesheets only',
    cleanup: 'listeners exist only while a rule uses their event type; once records go with their element',
    description: 'An event rule: when the event happens on (or, for bubbling events, inside) the matched element, its state mutations run. The cascade picks one winning mutation per state, trigger and element. Each event is a transaction: values are read before any write. prevent cancels the default synchronously; stop keeps ancestors\' :on() rules and listeners from seeing the event; once runs a rule once per element.',
    examples: ['.counter:on(click) { --count: increment(1); }', '.dialog:on(keydown(Escape)) { --open: set(false); }', 'a.confirm:on(click, prevent) { --asking: set(true); }'] },
  { name: 'drag', kind: 'rule', category: 'extend', status: 'experimental', since: '0.9.0', syntax: ':on(drag) | :on(drag(start | move | end | cancel))',
    requiresRuntime: true, evaluation: 'event', dependsOn: ['state'], support: 'Pointer Events and pointer capture',
    cleanup: 'one pointerdown listener while drag rules exist; move listeners only during a gesture; capture released at the end',
    description: 'Pointer drag gestures (not HTML drag and drop): starts after 3 px, with pointer capture; event(x) / event(y) are the mutated state at drag start plus the pointer distance, so positions continue across drags. pointercancel runs cancel, then end.',
    examples: ['.card:on(drag) { --x: set(event(x)); --y: set(event(y)); }', '.thumb:on(drag) { --v: set(clamp(0px, event(x), 200px)); }'] },
  { name: 'focus', kind: 'rule', category: 'extend', status: 'experimental', since: '0.9.0', syntax: '<selector>:focus(when(condition)) {}',
    requiresRuntime: true, evaluation: 'state', dependsOn: ['state'], support: 'Element.focus(); trusted stylesheets only',
    description: 'A focus request: the matched element is focused when the condition goes from false to true because of a user action. The same guarantees as focus: (never on load, never stealing focus the user moved, dialogs keep their focus). Plain :focus stays native.',
    examples: ['.dialog input:focus(when(--open)) {}'] },
  // ---- declarations ----------------------------------------------------------------------
  { name: '--attr-*', kind: 'declaration', category: 'extend', status: 'experimental', since: '0.9.0', syntax: '--attr-<attribute>: <string> | <number> | <keyword> | var(--state) | when(condition [, a, b])',
    requiresRuntime: true, evaluation: 'state', dependsOn: ['state'], support: 'CSS.registerProperty; trusted stylesheets only',
    description: 'The reserved namespace for attributes: --attr-aria-expanded writes aria-expanded of the matched element, with the semantics of attr:. Lower-case allowlisted attributes only; every other custom property stays plain CSS.',
    examples: ['.menu > button { --attr-aria-expanded: var(--open); }', '.panel { --attr-data-state: when(--open, "open", "closed"); }'] },
  { name: 'content', kind: 'declaration', category: 'extend', status: 'experimental', since: '0.9.0', syntax: 'content: var(--state) | when(condition, a, b) | previous(--state) | direction(--state)',
    requiresRuntime: true, evaluation: 'state', dependsOn: ['state'], support: 'trusted stylesheets only',
    description: 'On elements (not pseudo-elements), a content value that reads state also becomes the element\'s DOM text, with the semantics of text:. The native declaration is kept; literals, images, counters and attr() stay native.',
    examples: ['.counter .value { content: var(--count); }'] },
  { name: 'persist', kind: 'declaration', category: 'extend', status: 'experimental', since: '0.9.0', syntax: '--state: state(initial, persist("key" [, local | session]))',
    requiresRuntime: true, evaluation: 'state', support: 'localStorage / sessionStorage (works without them, not persisted)',
    cleanup: 'pending writes are flushed when the page is hidden; storage is never cleared',
    description: 'Keeps a state across reloads. Initial value: a valid stored value, then the DOM source of bind(), then the declared value. Writes are coalesced (at most 4 per second per key); cells with the same key share the value, also across tabs for localStorage.',
    examples: ['.theme { --dark: state(false, persist("theme")); }'] },
  { name: 'bind()', kind: 'declaration', category: 'extend', status: 'experimental', since: '0.9.0', syntax: '--state: state(initial, bind(value | checked))',
    requiresRuntime: true, evaluation: 'event', support: 'trusted stylesheets only; unconditional rules',
    description: 'Two-way binding of the matched form control and its own state. To bind controls to an ancestor\'s state (radio groups), use bind: --state.',
    examples: ['input[name=q] { --q: state("", bind(value)); }', 'input[type=checkbox] { --on: state(false, bind(checked)); }'] },
  { name: 'event', kind: 'expression', category: 'extend', status: 'experimental', since: '0.9.0', syntax: 'event(field)',
    returns: 'a typed value', requiresRuntime: true, evaluation: 'event',
    description: 'A field of the current event, inside :on() mutations only: type, client-x/y, page-x/y, local-x/y, button(s), pointer-id, pointer-type, pressure, modifier keys, key, code, repeat, value, value-as-number, checked, scroll-top/left; for drag: x, y, delta-x/y, movement-x/y, start-x/y. Each field is checked against the trigger.',
    examples: ['.canvas:on(pointerdown) { --x: set(event(local-x)); }', 'input:on(input) { --len: set(event(value-as-number)); }'] },
  { name: 'on', kind: 'declaration', category: 'extend', status: 'stable', since: '0.2', syntax: 'on: trigger(action, ...), ...', requiresRuntime: true,
    description: 'Legacy (0.9.0: prefer :on() rules): runs actions on events; the cascade picks the declaration. Still the way to target an explicit owner with closest().', examples: ['.tab { on: click(set(--active, sibling-index())); }'] },
  { name: 'text', kind: 'declaration', category: 'extend', status: 'experimental', since: '0.5.1', syntax: 'text: <string> | <number> | var(--state) | previous(--state) | direction(--state) | when(condition, a, b)',
    requiresRuntime: true, evaluation: 'state', dependsOn: ['state'], support: 'CSS.registerProperty; trusted stylesheets only',
    cleanup: 'the original text is restored when no text: declaration applies any more; the binding yields if something else changes the text',
    description: 'Writes one scalar value into the element\'s own DOM text (a Text node, never HTML). Only for elements that are empty or hold one text node; the cascade picks the winning declaration. Not a template language: one value per element.',
    examples: ['.profile-name { text: var(--name); }', '.status { text: when(--online, "Online", "Offline"); }'] },
  { name: 'attr', kind: 'declaration', category: 'extend', status: 'experimental', since: '0.5.3', syntax: 'attr: <attribute> <string> | <number> | <keyword> | var(--state) | previous(--state) | direction(--state) | when(condition [, a, b])',
    parameters: [{ name: 'attribute', type: 'aria-expanded | aria-pressed | aria-selected | aria-disabled (0.6) | aria-current | disabled | hidden | required | tabindex 0/-1 (0.6) | data-*' }],
    requiresRuntime: true, evaluation: 'state', dependsOn: ['state'], support: 'CSS.registerProperty; trusted stylesheets only',
    cleanup: 'the original attribute is restored when no attr: declaration for it applies any more, unless something else changed it (the binding then yields)',
    description: 'Derives one allowlisted HTML attribute of the matched element from a reactive value, usually state owned by an ancestor. One property per attribute: attr: declarations for different attributes combine, the cascade picks the winner for each. Same value semantics as state(…, bind()): boolean attributes present or removed (true/false or 1/0), ARIA "true"/"false" or aria-current tokens, data-* as text. Written in the same task as the action that changed the state. disabled and required are only written where HTML gives them a meaning (warning otherwise); a state(…, bind()) of the same attribute on the same element wins. Does not make a component accessible by itself.',
    examples: ['.stepper .plus { attr: disabled when(--qty >= 10); }', '.menu > button { attr: aria-expanded var(--open); }', '.steps li:nth-child(2) { attr: aria-current when(--step == 2, "step", "false"); }'] },
  { name: 'focus', kind: 'declaration', category: 'extend', status: 'experimental', since: '0.6.0', syntax: 'focus: true | false | var(--boolean) | when(condition [, a, b])',
    requiresRuntime: true, evaluation: 'state', dependsOn: ['state'], support: 'CSS.registerProperty, Element.focus(); trusted stylesheets only',
    cleanup: 'a removed or unmatched element drops its record and any pending request',
    description: 'Moves focus to the matched element when its value goes from false to true because of a user action (a trusted click, keydown, input or change that changed a state in one of its owners). Never on page load, insertion, scripts, timers, form reset or focus events; never over a focus the user moved, an open dialog or popover, or focus already inside the target. Resolved after the state\'s CSS and attr:/text: writes; the first eligible target in document order wins; non-focusable targets are reported (tabindex is never added).',
    examples: ['.panel > h2 { focus: false; } .panel:nth-var(--step) > h2 { focus: true; }', '.details h3 { focus: var(--open); }'] },
  { name: 'bind', kind: 'declaration', category: 'extend', status: 'stable', since: '0.3', syntax: 'bind: --state [closest(selector)]', requiresRuntime: true, dependsOn: ['state'],
    description: 'Two-way binding of a native form control and a state.', examples: ['input[name=name] { bind: --name; }'] },
  // ---- triggers (inside on:) ----------------------------------------------------------------
  ...['click', 'change', 'input', 'pointerenter', 'pointerleave', 'focus', 'blur'].map((e): Feature => ({
    name: e, kind: 'trigger', category: 'extend', status: 'stable', since: '0.2', syntax: `${e}(action, ...)`, requiresRuntime: true,
    description: `Runs actions on the native ${e} event.`, examples: [`.x { on: ${e}(toggle(--open)); }`] })),
  ...['focusin', 'focusout', 'reset'].map((e): Feature => ({
    name: e, kind: 'trigger', category: 'extend', status: 'experimental', since: '0.5.1', syntax: `${e}(action, ...)`, requiresRuntime: true,
    description: `Runs actions on the native ${e} event, on the target and its ancestors (it bubbles).`, examples: [`.panel { on: ${e}(toggle(--active)); }`] })),
  ...['animationend', 'animationcancel', 'transitionend', 'transitioncancel'].map((e): Feature => ({
    name: e, kind: 'trigger', category: 'extend', status: 'experimental', since: '0.5.1', syntax: `${e}(action, ...)`, requiresRuntime: true,
    description: `Runs actions when one of the element's own ${e.startsWith('animation') ? 'animations' : 'transitions'} ${e.endsWith('cancel') ? 'is cancelled' : 'ends'} (target only; any ${e.startsWith('animation') ? 'animation name' : 'property'}: ${e.startsWith('transition') ? 'one event per transitioning property' : 'no name filter'}).`,
    examples: [`.toast { on: ${e}(set(--shown, false)); }`] })),
  { name: 'key', kind: 'trigger', category: 'extend', status: 'stable', since: '0.3', syntax: 'key([ctrl+|shift+|alt+|meta+]Key, action, ...)', requiresRuntime: true,
    description: 'keydown while focus is on or inside the element; no character shortcuts while typing.', examples: ['.dialog { on: key(Escape, set(--open, false)); }'] },
  { name: 'outside', kind: 'trigger', category: 'extend', status: 'stable', since: '0.3', syntax: 'outside(click | pointerdown | focusin, action, ...)', requiresRuntime: true,
    description: 'Runs when the event happens outside the element (consider the native popover attribute).', examples: ['.dropdown { on: outside(click, set(--open, false)); }'] },
  // ---- actions --------------------------------------------------------------------------------
  { name: 'set', kind: 'action', category: 'extend', status: 'stable', since: '0.2', syntax: 'set(--state, value | attr(name) | pick(...) | sibling-index() | sibling-count() [, closest(selector)])',
    requiresRuntime: true, description: 'Assigns a typed value; attr() and pick() are evaluated at event time on the element with the on: declaration.', examples: ['set(--active, 2)', 'set(--message, attr(data-message))'] },
  { name: 'prevent', kind: 'action', category: 'extend', status: 'experimental', since: '0.7.0', syntax: 'prevent()', requiresRuntime: true,
    parameters: [{ name: 'contexts', type: 'click(…) | key(…) (keydown); not change, input, focus/blur, focusin/focusout, pointer enter/leave, animation/transition, reset, outside()' }],
    support: 'Event.preventDefault() in a non-passive document capture listener, installed only while a rule uses prevent() for that event type',
    description: 'Cancels the native default action (scrolling for arrow keys, link navigation, checkbox toggling, submit-button submission) of the current event, synchronously during dispatch. Never stops propagation. Only for events whose target is the element with the on: declaration or inside it; never for keys in a form control or editable element that does not carry the rule; only for cancelable events (otherwise a warning), and the result is checked. Runs only when its on: declaration is the one the cascade chose, with current conditions. Limitations: no submit trigger, no stop(); a cancelling ancestor also cancels clicks on links and buttons inside it (development note).',
    examples: ['.tabs [role=tablist] { on: key(ArrowRight, prevent(), cycle(--active, 1, 2, 3)); }', 'a.confirm { on: click(prevent(), set(--asking, true)); }'] },
  { name: 'toggle', kind: 'action', category: 'extend', status: 'stable', since: '0.2', syntax: 'toggle(--state [, closest(selector)])', requiresRuntime: true,
    description: 'Flips a boolean state.', examples: ['toggle(--open)'] },
  { name: 'increment', kind: 'action', category: 'extend', status: 'stable', since: '0.2', syntax: 'increment(--state [, step] [, closest(selector)])', requiresRuntime: true,
    description: 'Adds to a number or dimension state.', examples: ['increment(--count)'] },
  { name: 'decrement', kind: 'action', category: 'extend', status: 'stable', since: '0.2', syntax: 'decrement(--state [, step] [, closest(selector)])', requiresRuntime: true,
    description: 'Subtracts from a number or dimension state.', examples: ['decrement(--count, 5)'] },
  { name: 'cycle', kind: 'action', category: 'extend', status: 'stable', since: '0.3', syntax: 'cycle(--state, value, value, ... [, closest(selector)])', requiresRuntime: true,
    description: 'Next value in a list, wrapping around.', examples: ['cycle(--mode, light, dark, system)'] },
  // ---- planned / evaluated (not shipped) ------------------------------------------------------
  { name: 'history', kind: 'function', category: 'extend', status: 'planned', syntax: 'history(--state, n)', requiresRuntime: true, description: 'Bounded history beyond previous().', reason: 'No UI case yet that previous() and direction() do not cover.', examples: [] },
  { name: 'map', kind: 'function', category: 'simplify', status: 'rejected', syntax: 'map(value, inMin, inMax, outMin, outMax)', requiresRuntime: false,
    nativeEquivalent: 'calc(outMin + (outMax - outMin) * progress(value, inMin, inMax))', description: 'Range mapping.',
    reason: 'Native progress() does it (clamped, reversed ranges included) in Chromium and WebKit; with --mx: mouse(x), write opacity: progress(var(--mx), 0px, 1000px).', examples: [] },
  { name: 'distance', kind: 'function', category: 'extend', status: 'rejected', syntax: 'distance(x1, y1, x2, y2)', requiresRuntime: false,
    nativeEquivalent: 'hypot(calc(x1 - x2), calc(y1 - y2))', description: 'Distance between two points.', reason: 'Native hypot() computes it from any reactive inputs.', examples: [] },
  { name: 'element (other element)', kind: 'function', category: 'extend', status: 'planned', syntax: 'element(selector, width | height)', requiresRuntime: true,
    nativeEquivalent: 'anchor-size(), container query units', description: 'Measure another element.',
    reason: 'Deferred: anchor-size() and container units cover the common cases natively; a scoped, nearest-owner lookup needs its own design.', examples: [] },
  { name: 'cycle', kind: 'function', category: 'extend', status: 'rejected', syntax: 'cycle(values..., interval)', requiresRuntime: true, nativeEquivalent: '@keyframes with steps()',
    description: 'Time-based cycling through values.', reason: 'Native keyframes with steps() do it without JavaScript, and the name would be confused with the cycle() action.', examples: [] },
  { name: 'spring', kind: 'function', category: 'evaluate', status: 'planned', syntax: 'spring(source, stiffness, damping)', requiresRuntime: true, nativeEquivalent: 'transition with linear() easing',
    description: 'Spring-like following of a changing value.', reason: 'A duration does not define a spring, and following a continuously changing source needs per-frame physics in JavaScript. A transition with a linear() spring curve covers discrete changes natively.', examples: [] },
  { name: 'smooth', kind: 'function', category: 'evaluate', status: 'rejected', syntax: 'smooth(value, duration)', requiresRuntime: false, nativeEquivalent: 'transition',
    description: 'Smoothed value.', reason: 'A transition on the consuming property does exactly this natively.', examples: [] },
  { name: 'throttle', kind: 'function', category: 'evaluate', status: 'planned', syntax: 'throttle(value, interval)', requiresRuntime: true,
    description: 'Rate-limited updates.', reason: 'No UI case found that a frame-coalesced source plus a transition does not cover; reconsider with a concrete case.', examples: [] },
  { name: 'debounce', kind: 'function', category: 'evaluate', status: 'planned', syntax: 'debounce(value, delay)', requiresRuntime: true,
    description: 'Update after the input settles.', reason: 'Same: no concrete case yet beyond transition-delay.', examples: [] },
  ...['drag and drop', 'physics', 'routing', 'storage', 'network requests', 'clipboard', 'DOM mutation actions', 'animation DSL'].map((name): Feature => ({
    name, kind: 'action', category: 'evaluate', status: 'rejected', syntax: '—', requiresRuntime: true,
    description: 'Not built.', reason: 'Duplicates the platform or needs broader permissions than state changes.', examples: [] })),
];

/** Native CSS that Reactive CSS never duplicates or reinterprets. */
export const KEEP_NATIVE = [
  'calc()', 'min()', 'max()', 'clamp()', 'round()', 'mod()', 'rem()', 'abs()', 'sign()', 'pow()', 'sqrt()', 'hypot()', 'log()', 'exp()',
  'sin()', 'cos()', 'tan()', 'asin()', 'acos()', 'atan()', 'atan2()',
  'rgb()', 'hsl()', 'hwb()', 'lab()', 'lch()', 'oklab()', 'oklch()', 'color()', 'color-mix()', 'light-dark()',
  ':not()', ':is()', ':where()', ':has()', ':nth-child()', ':nth-of-type()', ':checked', ':hover', ':focus', ':focus-visible',
  'var()', 'env()', 'attr()', 'sibling-index()', 'sibling-count()', 'if()', '@media', '@supports', '@layer', '@scope', '@property', '@container',
  'progress()', 'anchor()', 'anchor-size()', 'linear()', 'element(#id)', 'toggle() (CSS Values 5 value function)',
  'CSS nesting', 'scroll-driven animations', 'popover', '<details>', '<dialog>',
];
