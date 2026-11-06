// Curated agent knowledge for Reactive CSS 0.10.0, layered on the library's own data.
//
// The API registry (src/core/features.ts via describe()) and the feature catalog
// (src/features/catalog.ts) are the source of truth: they come into dist/knowledge.json at build
// time. This file only adds what they do not carry: the 0.9 form of mutations and modifiers,
// aliases, legacy labels, common mistakes, native-first guidance and documentation pages.
//
// Checked, not trusted: scripts/build.mjs fails on keys that name no registry entry, and
// test/unit.test.mjs compiles every example here with the real compiler and runs every mistake
// through validate_css (the wrong form must give its listed codes, the right form none).

export const DOCS_BASE = 'https://reactivecss.com/docs/';

/** Documentation pages of the website (site/src/content/docs). The site is prepared, not live. */
export const DOC_PAGES = {
  'getting-started': 'Getting Started', 'core-concepts': 'Core Concepts', state: 'State', events: 'Events',
  'event-data': 'Event Data', drag: 'Drag Gestures', persistence: 'Persistence', binding: 'DOM Integration',
  conditions: 'Conditions', history: 'State History', focus: 'Focus & Blur', selectors: 'Dynamic Selectors',
  'reactive-values': 'Reactive Values', 'value-functions': 'Strings, Numbers and Dates', computed: 'Computed Values', geometry: 'Geometry & Animation', 'custom-bundles': 'Custom Bundles',
  migration: 'Migrating from 0.8', compat: 'Browser Compatibility', limitations: 'Limitations',
  troubleshooting: 'Troubleshooting', installation: 'Installation', 'simplify-css': 'Simplify CSS', reference: 'API Reference',
};

/**
 * Additions per registry entry (`kind:name`): doc page, related entries, notes, constraints, and
 * legacy labels. `syntax09` replaces nothing: it is shown next to the registry syntax when the
 * registry line predates a 0.9 extension.
 */
export const OVERLAY = {
  'function:length': { doc: 'value-functions', related: ['function:trim', 'function:includes', 'function:format'], constraints: ['Takes a string or keyword; a number, boolean or datetime is an error.', 'In its arguments, --name reads a state.'] },
  'function:includes': { doc: 'value-functions', related: ['function:lower', 'function:trim', 'selector:when'], constraints: ['Case-sensitive: combine with lower().', 'attr() in a condition is read when the condition\'s states change, not when only the attribute changes.'] },
  'function:lower': { doc: 'value-functions', related: ['function:includes', 'function:trim'] },
  'function:trim': { doc: 'value-functions', related: ['function:length', 'function:lower'] },
  'function:format': { doc: 'value-functions', related: ['function:time', 'function:timezone', 'function:length'], constraints: ['The second argument is a quoted style or date pattern, checked when the stylesheet is compiled.', 'A number is never a timestamp: a date pattern needs a datetime from time() or timezone().', 'No locale argument: the language is the nearest lang attribute.'], mistakes: ['format-date-from-number'] },
  'function:time': { doc: 'value-functions', related: ['function:timezone', 'function:format', 'rule:every', 'function:live'], constraints: ['A value, not a timer: a declaration or condition with time() is evaluated when its states change, not as time passes. Use :on(every()) or live() to follow the clock.', 'A datetime takes + or - with a time like 30s; a plain number is an error.'], mistakes: ['computed-time-without-live'] },
  'function:timezone': { doc: 'value-functions', related: ['function:time', 'function:format'], constraints: ['The zone is a quoted IANA name, such as "Asia/Tokyo".'] },
  'rule:after': { doc: 'events', related: ['rule:every', 'rule:on', 'selector:when'], constraints: ['Active means the element matches the full selector, :when() included.', 'No modifiers and no event().', 'Rules cannot depend on :hover, :focus, :checked or other states the runtime cannot follow: use a state.', 'Cannot be nested in a rule with a state condition, or combined in a | b.'], mistakes: ['timer-on-hover'] },
  'rule:every': { doc: 'events', related: ['rule:after', 'function:time', 'rule:on'], constraints: ['Minimum 20 ms. Paused while the page is hidden.', 'Ticks are not a clock: use time() for elapsed time.', 'No modifiers and no event().', 'Rules cannot depend on :hover, :focus, :checked or other states the runtime cannot follow: use a state.'], mistakes: ['timer-on-hover'] },
  'declaration:computed': { doc: 'computed', related: ['function:state', 'function:live', 'function:length', 'function:format'], constraints: [
    'Only in an unconditional rule, as the whole value, without !important. Elsewhere it stays a CSS-only value that :when(), text: and actions cannot read.',
    'It must be the only declaration of its name in the processed stylesheets, state() and @property included.',
    'Read-only: mutations, on: actions and bind: input change nothing.',
    'It reads only states and literals: not attr(), event(), element(), random(), or time() outside live().',
    'Not a general CSS cascade: the value is written inline on each owner. A declaration of the name in a stylesheet without reactive syntax is reported only by development builds; cross-origin stylesheets cannot be checked.',
    'For lists of thousands of elements, the inline expression costs less.',
  ], mistakes: ['computed-in-conditional-rule', 'computed-time-without-live'] },
  'function:state': {
    doc: 'state', related: ['rule:on', 'declaration:persist', 'declaration:bind()', 'function:when', 'selector:when'],
    syntax09: '--name: state(initial [, bind(value | checked | <attribute>)] [, persist("key" [, local | session])])',
    constraints: [
      'The initial value is required and comes first: state(false, bind(aria-expanded)), never state(bind(...)).',
      'Every element that matches the declaration owns its own cell. A consumer (a mutation, var(), :when()) uses the nearest owner on itself or an ancestor; siblings never share a cell.',
      'The type is fixed by the initial value: state(0) is a number, state(0px) a length, state(false) a boolean, state("") a string, state(light) a keyword.',
      'Values are scalar: no lists.',
    ],
    mistakes: ['type-mismatch-length', 'no-owner'],
  },
  'rule:on': {
    doc: 'events', related: ['mutation:set', 'mutation:toggle', 'mutation:increment', 'modifier:prevent', 'modifier:stop', 'expression:event', 'rule:drag', 'selector:when'],
    constraints: [
      'An :on() rule contains only mutations on the state\'s own custom property (--open: toggle()). Native properties, plain values and --attr-* are dropped there: style the result with :when() or var().',
      ':on() must be in the subject (last) compound of the selector, at most once, and never inside :not(), :is(), :where() or :has().',
      'In a selector list every item must use :on(): .a:on(click), .b { … } is rejected.',
      'A mutation changes the nearest owner of the state on the matched element or an ancestor; with no owner nothing changes (a runtime diagnostic).',
      'One winning mutation per state, trigger and element, chosen by the cascade. All mutations of one event read the values from before the event (one transaction).',
      'Modifiers are functions: prevent() (cancelable events only) and stop(). Bare prevent/stop and once are errors.',
      'A rule with only modifiers (a:on(click, prevent()) {}) is an empty rule: minifiers that remove empty rules delete it. Minify Reactive stylesheets for whitespace only.',
    ],
    mistakes: ['bare-modifier', 'once', 'mutation-outside-on', 'mixed-selector-list', 'native-in-on', 'empty-rule-minifier', 'event-name-dragstart'],
  },
  'rule:drag': {
    doc: 'drag', related: ['rule:on', 'expression:event'],
    constraints: [
      ':on(drag) is :on(drag(move)). The phases are start, move, end and cancel; drag(x) or drag(y) do not exist: read coordinates with event(x) / event(y).',
      'event(x) / event(y) are the mutated state at drag start plus the pointer distance: the state must be a number or a px length (state(0px)).',
      'This is pointer dragging of an element. It is not native HTML drag and drop: no dragstart/drop, no drop targets, no sortable lists.',
      'A drag has no keyboard equivalent by itself: pair it with :on(keydown(ArrowRight)) rules or a native range input.',
      'Experimental: not validated on real touch and pen hardware.',
    ],
    mistakes: ['drag-axis', 'event-name-dragstart', 'drag-number-state'],
  },
  'expression:event': {
    doc: 'event-data', related: ['rule:on', 'rule:drag', 'mutation:set'],
    constraints: [
      'Only inside a mutation of an :on() rule. Each field is checked against the trigger: event(key) needs keydown/keyup, event(value) needs input/change, event(x) needs drag.',
      'Coordinates and distances are px lengths: store them in a length state, state(0px), not state(0).',
      'Password, one-time-code and payment fields give event(value) = "".',
    ],
    mistakes: ['type-mismatch-length', 'wrong-event-field', 'event-outside-mutation'],
  },
  'declaration:persist': {
    doc: 'persistence', related: ['function:state', 'declaration:bind()'],
    constraints: [
      'The key is a quoted string of 1-64 characters from A-Z a-z 0-9 _ . : - (stored as rcss:<key>).',
      'Precedence: a valid stored value, then the DOM source (bind()), then the initial value. Stored values are validated against the declared type.',
      'Writes are coalesced (at most one per 250 ms per key). Storage failures fall back to a normal state with one note.',
      'Experimental: Safari private mode and partitioned storage are not validated.',
    ],
  },
  'declaration:bind()': {
    doc: 'binding', related: ['function:state', 'declaration:bind', 'expression:event'],
    constraints: [
      'bind(value) and bind(checked) bind the form control that owns the state (the element the state() declaration matches).',
      'To write an ancestor\'s state from a control (radio groups, shared state), keep bind: --state, or use input:on(input) { --q: set(event(value)); }.',
    ],
    mistakes: ['legacy-bind'],
  },
  'declaration:--attr-*': {
    doc: 'binding', related: ['function:state', 'function:when'],
    constraints: [
      'Writes the attribute of the matched element. Allowlisted names only: aria-* states, aria-label, aria-valuetext, data-*, disabled, hidden, required, tabindex (0 or -1). Event handlers, URLs, style, id, class, name and value are never writable.',
      'The suffix must be lower case: --attr-aria-expanded.',
      'Reserved namespace: any --attr-<allowlisted> custom property writes the attribute. Rename existing custom properties that are not meant as attributes.',
      'Not inside :on() rules: a value, not a mutation.',
    ],
    mistakes: ['legacy-attr', 'attr-not-allowed'],
  },
  'declaration:content': {
    doc: 'binding', related: ['function:state', 'function:when', 'function:previous'],
    constraints: [
      'DOM text only when all hold: the rule targets elements (no ::before / ::after), the value reads state (var(), when(), previous(), direction()), and it has no image or attr().',
      'Everything else stays native content: content: "Hello" on an element renders nothing as text; ::before { content: var(--n) } stays native.',
      'A value function alone does not count: content: length(--q) renders nothing. Write text: length(--q), or a computed value and content: var(--name).',
      'It writes one text node into an element that is empty or holds only text; elements with child elements are never emptied.',
    ],
    mistakes: ['legacy-text', 'content-pseudo-element'],
  },
  'declaration:focus': {
    doc: 'focus', related: ['function:when', 'selector:blur'],
    syntax09: 'focus: when(condition) | var(--boolean) | true | false',
    constraints: [
      'The 0.9 focus API. Focus moves when the value goes from false to true after a user action (click, keydown, input, change, pointerup, submit, drag end), never on load.',
      'Targets must be focusable, rendered, not disabled and not inert. The library never adds tabindex.',
      ':focus(when(…)) does not exist (removed before release); native :focus, :focus-visible and :focus-within are unchanged.',
      'when() needs the conditions feature; focus: var(--open) does not.',
    ],
    mistakes: ['focus-when-selector'],
  },
  'selector:blur': {
    doc: 'focus', related: ['declaration:focus'],
    constraints: [
      'Matches an element from a genuine focus loss until it is focused again; never an element that was never focused.',
      'Takes no arguments: :blur(when(…)) does not exist. For containers use :has(:blur).',
    ],
    mistakes: ['blur-when'],
  },
  'selector:when': { doc: 'conditions', related: ['function:when', 'function:state'] },
  'function:when': { doc: 'conditions', related: ['selector:when', 'function:state'] },
  'selector:changed': { doc: 'history', related: ['function:previous', 'function:direction'] },
  'function:previous': { doc: 'history', related: ['function:direction', 'selector:changed'] },
  'function:direction': { doc: 'history', related: ['function:previous', 'selector:changed'] },
  'selector:nth-var': { doc: 'selectors', related: ['function:state'] },
  'selector:just-checked': { doc: 'selectors' },
  'selector:just-unchecked': { doc: 'selectors' },
  'function:random': {
    doc: 'reactive-values', related: ['function:pick', 'function:live'],
    constraints: [
      'Native first: browsers that implement CSS Values 5 random() handle random(min, max, step) themselves, and Reactive CSS leaves those calls alone. Its runtime takes over only where the browser cannot.',
      'by <step> and element-shared are Reactive CSS syntax from the earlier draft; browsers reject them, so they always use the runtime.',
      'Inside a mutation (set(random(1, 6))) it is rolled at each event.',
    ],
  },
  'function:pick': { doc: 'reactive-values' },
  'function:live': { doc: 'reactive-values' },
  'function:on': {
    doc: 'reactive-values',
    notes: ['on(event, expression) re-evaluates a value (for example a random() call) when the event fires on the element. It is not the :on() event rule.'],
  },
  'function:mouse': { doc: 'reactive-values' },
  'function:visible': { doc: 'reactive-values' },
  'function:viewport': { doc: 'reactive-values' },
  'function:element': { doc: 'geometry' },
  'function:wave': { doc: 'geometry' },
  'function:typed': { doc: 'simplify-css' },
  'expression:attr': { doc: 'binding' },
  'declaration:on': {
    doc: 'migration', legacy: true, replacement: 'rule:on',
    notes: ['Legacy 0.8 syntax, still supported in 0.9. Write :on() rules instead: .b:on(click) { --open: toggle(); }. Legacy on: keeps its 0.8 semantics (actions run one after another) and is the only form with closest() owners.'],
    mistakes: ['legacy-on'],
  },
  'declaration:text': {
    doc: 'migration', legacy: true, replacement: 'declaration:content',
    notes: ['Legacy 0.8 syntax. Write content: var(--x) on the element instead. text: also accepted literal strings; content: "x" stays native CSS.', 'To show a value function directly, text: is still the form that works: text: format(--n, "integer"). content: format(--n, "integer") renders nothing.'],
    mistakes: ['legacy-text'],
  },
  'declaration:attr': {
    doc: 'migration', legacy: true, replacement: 'declaration:--attr-*',
    notes: ['Legacy 0.8 syntax. Write --attr-aria-expanded: var(--open) instead.'],
    mistakes: ['legacy-attr'],
  },
  'declaration:bind': {
    doc: 'binding', related: ['declaration:bind()'],
    notes: ['Still the way to bind a control to an ancestor\'s state (radio groups, shared state). For a control that owns its state, 0.9 writes state("", bind(value)) or state(false, bind(checked)).'],
  },
};

/** Legacy 0.8 entries by kind: every trigger and action of the on: declaration. */
export const LEGACY_KINDS = { trigger: 'rule:on', action: 'rule:on' };

const ex = (css) => css.trim();

/** The 0.9 mutations: `--state: op(…)` inside an :on() rule. The registry lists them under rule:on. */
export const MUTATIONS = {
  'mutation:set': {
    name: 'set', kind: 'mutation', status: 'experimental', since: '0.9.0', syntax: '--state: set(expression)',
    description: 'Sets the state to the value of an event-time expression: a literal, var(), calc(), min(), max(), clamp(), round(), abs(), event(field), mouse(), element(), viewport(), attr(), pick(), random(), sibling-index() or sibling-count().',
    parameters: [{ name: 'expression', type: 'a value of the state\'s type (a unitless 0 is accepted for lengths, 0 and 1 for booleans)' }],
    constraints: [
      'Only inside an :on() rule. Outside it, --x: set(1) is just an ordinary custom property value and does nothing.',
      'The value must fit the state type: event(client-x) is a px length, so the state must be state(0px).',
      'Units convert within a family (px/in/cm, deg/turn, s/ms). px + % or px + em is an error at the event (no write).',
    ],
    examples: [
      ex('.tabs { --active: state(1); }\n.tabs .second:on(click) { --active: set(2); }'),
      ex('.pad { --x: state(0px); }\n.pad:on(pointerdown) { --x: set(event(local-x)); }'),
      ex('.field { --q: state(""); }\n.field input:on(input) { --q: set(event(value)); }'),
    ],
    related: ['rule:on', 'expression:event', 'mutation:toggle'], doc: 'state', legacyForm: 'action:set',
    mistakes: ['type-mismatch-length', 'mutation-outside-on', 'event-outside-mutation'],
  },
  'mutation:toggle': {
    name: 'toggle', kind: 'mutation', status: 'experimental', since: '0.9.0', syntax: '--state: toggle()',
    description: 'Flips a boolean state.', parameters: [],
    constraints: ['Takes no arguments: the state is the property on the left.', 'Needs a boolean state: state(false).'],
    examples: [ex('.menu { --open: state(false); }\n.menu > button:on(click) { --open: toggle(); }')],
    related: ['rule:on', 'selector:when', 'declaration:--attr-*'], doc: 'events', legacyForm: 'action:toggle',
    mistakes: ['toggle-non-boolean', 'legacy-on'],
  },
  'mutation:increment': {
    name: 'increment', kind: 'mutation', status: 'experimental', since: '0.9.0', syntax: '--state: increment(step?)',
    description: 'Adds the step (default 1, in the state\'s unit) to a number or length state.',
    parameters: [{ name: 'step', type: 'expression of the state\'s type', optional: true, default: '1' }],
    constraints: ['Needs a number or dimension state.', 'The step must match the state\'s unit family.'],
    examples: [ex('.counter { --count: state(0); }\n.counter .inc:on(click) { --count: increment(1); }')],
    related: ['mutation:decrement', 'rule:on', 'declaration:content'], doc: 'state', legacyForm: 'action:increment',
  },
  'mutation:decrement': {
    name: 'decrement', kind: 'mutation', status: 'experimental', since: '0.9.0', syntax: '--state: decrement(step?)',
    description: 'Subtracts the step (default 1, in the state\'s unit) from a number or length state.',
    parameters: [{ name: 'step', type: 'expression of the state\'s type', optional: true, default: '1' }],
    constraints: ['Needs a number or dimension state.'],
    examples: [ex('.counter { --count: state(0); }\n.counter .dec:on(click) { --count: decrement(1); }')],
    related: ['mutation:increment', 'rule:on'], doc: 'state', legacyForm: 'action:decrement',
  },
  'mutation:cycle': {
    name: 'cycle', kind: 'mutation', status: 'experimental', since: '0.9.0', syntax: '--state: cycle(a, b, …)',
    description: 'Moves to the next listed value, or to the first when the current value is not listed.',
    parameters: [{ name: 'values', type: 'two or more literal values of the state\'s type' }],
    constraints: ['At least two values, each of the state\'s type.'],
    examples: [ex('.theme { --mode: state(light); }\n.theme button:on(click) { --mode: cycle(light, dark, auto); }')],
    related: ['rule:on', 'selector:when'], doc: 'state', legacyForm: 'action:cycle',
  },
};

/** :on() modifiers (functions since the 0.9 API cleanup). */
export const MODIFIERS = {
  'modifier:prevent': {
    name: 'prevent()', kind: 'modifier', status: 'experimental', since: '0.9.0', syntax: ':on(event, prevent())',
    description: 'Calls preventDefault() synchronously for the event.',
    constraints: [
      'A function: prevent(), never bare prevent.',
      'Only for cancelable events: click, dblclick, contextmenu, mousedown, pointerdown, keydown, keyup, submit and drag. Not with outside().',
      'A rule with only modifiers is empty: keep empty rules in your minifier (whitespace-only minification).',
    ],
    examples: [
      ex('.menu { --open: state(false); }\n.menu a.toggle:on(click, prevent()) { --open: toggle(); }'),
      ex('form.search:on(submit, prevent()) {}'),
    ],
    related: ['rule:on', 'modifier:stop'], doc: 'events', legacyForm: 'action:prevent',
    mistakes: ['bare-modifier', 'empty-rule-minifier'],
  },
  'modifier:debounce': {
    name: 'debounce()', kind: 'modifier', status: 'experimental', since: '0.10.0', syntax: ':on(event, debounce(time))',
    description: 'Runs the rule once the events stop for that time, with the last event\'s values, if the rule still applies then.',
    constraints: ['Needs a time: debounce(300ms).', 'Use debounce() or throttle(), not both.', 'Not with outside() or drag.', 'In a custom bundle it comes from the feature event-timing.'],
    examples: [ex('.s { --q: state(""); }\n.s input:on(input, debounce(300ms)) { --q: set(event(value)); }')],
    related: ['rule:on', 'modifier:throttle'], doc: 'events',
  },
  'modifier:throttle': {
    name: 'throttle()', kind: 'modifier', status: 'experimental', since: '0.10.0', syntax: ':on(event, throttle(time))',
    description: 'Runs the first event, and drops the next ones within the time.',
    constraints: ['Needs a time: throttle(16ms).', 'Use debounce() or throttle(), not both.', 'Not with outside() or drag.', 'In a custom bundle it comes from the feature event-timing.'],
    examples: [ex('.p { --x: state(0px); }\n.p:on(pointermove, throttle(16ms)) { --x: set(event(client-x)); }')],
    related: ['rule:on', 'modifier:debounce'], doc: 'events',
  },
  'modifier:stop': {
    name: 'stop()', kind: 'modifier', status: 'experimental', since: '0.9.0', syntax: ':on(event, stop())',
    description: 'Ancestors\' :on() rules do not run for this event, and native propagation stops when the event reaches the element (stopPropagation(), never stopImmediatePropagation()).',
    constraints: ['A function: stop(), never bare stop.', 'Not with outside() or drag.'],
    examples: [ex('.row { --open: state(false); --starred: state(false); }\n.row:on(click) { --open: toggle(); }\n.row .star:on(click, stop()) { --starred: toggle(); }')],
    related: ['rule:on', 'modifier:prevent'], doc: 'events',
    mistakes: ['bare-modifier'],
  },
};

/**
 * Names an agent may ask for, mapped to the 0.9 entry. Lookup is case-insensitive after
 * normalization (leading ':' and '--', trailing '()' and ':' removed).
 */
export const ALIASES = {
  on: 'rule:on', ':on': 'rule:on', 'on-rule': 'rule:on', event: 'expression:event', events: 'rule:on', 'event-rule': 'rule:on',
  set: 'mutation:set', toggle: 'mutation:toggle', increment: 'mutation:increment', decrement: 'mutation:decrement', cycle: 'mutation:cycle',
  prevent: 'modifier:prevent', 'prevent-default': 'modifier:prevent', preventdefault: 'modifier:prevent', stop: 'modifier:stop', stoppropagation: 'modifier:stop',
  drag: 'rule:drag', 'drag-gesture': 'rule:drag', persist: 'declaration:persist', persistence: 'declaration:persist', localstorage: 'declaration:persist',
  bind: 'declaration:bind()', 'bind(value)': 'declaration:bind()', 'bind(checked)': 'declaration:bind()', 'form-binding': 'declaration:bind()',
  'attr-*': 'declaration:--attr-*', 'attr-': 'declaration:--attr-*', attributes: 'declaration:--attr-*', 'aria-expanded': 'declaration:--attr-*',
  content: 'declaration:content', text: 'declaration:content', 'dom-text': 'declaration:content',
  focus: 'declaration:focus', 'focus-request': 'declaration:focus', blur: 'selector:blur',
  state: 'function:state', when: 'function:when', 'when-selector': 'selector:when', previous: 'function:previous', direction: 'function:direction',
  debounce: 'modifier:debounce', throttle: 'modifier:throttle', after: 'rule:after', every: 'rule:every', timer: 'rule:every', timers: 'rule:every', timeout: 'rule:after', interval: 'rule:every',
  computed: 'declaration:computed', derived: 'declaration:computed', 'computed-custom-property': 'declaration:computed', length: 'function:length', includes: 'function:includes', lower: 'function:lower', trim: 'function:trim', format: 'function:format', time: 'function:time', now: 'function:time', timezone: 'function:timezone',
  changed: 'selector:changed', 'nth-var': 'selector:nth-var', random: 'function:random', element: 'function:element',
};

/**
 * Mistakes agents make, each with the wrong and the corrected CSS. `codes`: what validate_css
 * reports for `wrong` (tested); `right` validates without errors or warnings (tested).
 */
export const MISTAKES = [
  { id: 'computed-in-conditional-rule', title: 'A computed value in a conditional rule', entries: ['declaration:computed'],
    wrong: '.f { --v: state(""); --on: state(true); }\n.f:when(--on) { --c: trim(--v); }',
    right: '.f { --v: state(""); --c: trim(--v); }',
    explanation: 'Computed values need an unconditional rule; here --c stays a CSS-only value that :when(), text: and actions cannot read.', codes: ['RCSS-P086'] },
  { id: 'computed-time-without-live', title: 'time() as a computed value without live()', entries: ['declaration:computed', 'function:time'],
    wrong: '.c { --now: time(); }',
    right: '.c { --now: live(time(), 1s); }',
    explanation: 'time() outside live() gives one instant. live(time(), 1s) follows the clock.', codes: ['RCSS-P087'] },
  { id: 'timer-on-hover', title: 'A timer rule that depends on :hover', entries: ['rule:after', 'rule:every'],
    wrong: '.a { --n: state(0); }\n.a:hover:on(after(1s)) { --n: increment(1); }',
    right: '.a { --n: state(0); --over: state(false); }\n.a:on(pointerenter) { --over: set(true); }\n.a:on(pointerleave) { --over: set(false); }\n.a:when(--over):on(after(1s)) { --n: increment(1); }',
    explanation: 'The runtime follows classes, attributes and :when() for timers, not :hover, :focus or :checked. Use a state.', codes: ['RCSS-P082'] },
  { id: 'format-date-from-number', title: 'A date pattern on a number', entries: ['function:format'],
    wrong: '.a { --t: state(1700000000000); }\n.a:on(click) { --s: set(format(--t, "HH:mm")); }',
    right: '.a { --t: state(time()); --s: state(""); }\n.a:on(click) { --s: set(format(--t, "HH:mm")); }',
    explanation: 'A number is never a timestamp. Use time() or a datetime state.', codes: [] },
  { id: 'focus-when-selector', title: ':focus(when()) instead of focus: when()', entries: ['declaration:focus'],
    wrong: '.dialog { --open: state(false); }\n.dialog input:focus(when(--open)) {}',
    right: '.dialog { --open: state(false); }\n.dialog input { focus: when(--open); }',
    explanation: ':focus(when(…)) was removed before 0.9.0. Focus requests are the focus: declaration.', codes: ['RCSS-P074'] },
  { id: 'bare-modifier', title: 'Bare prevent / stop in :on()', entries: ['modifier:prevent', 'modifier:stop'],
    wrong: '.menu { --open: state(false); }\n.menu a:on(click, prevent) { --open: toggle(); }',
    right: '.menu { --open: state(false); }\n.menu a:on(click, prevent()) { --open: toggle(); }',
    explanation: 'Modifiers are functions: prevent() and stop().', codes: ['RCSS-E067'] },
  { id: 'once', title: 'once() in :on()', entries: ['rule:on'],
    wrong: '.b { --done: state(false); }\n.b:on(click, once()) { --done: set(true); }',
    right: '.b { --done: state(false); }\n.b:when(not --done):on(click) { --done: set(true); }',
    explanation: 'once was removed. Guard the rule with a state and :when().', codes: ['RCSS-E068'] },
  { id: 'drag-axis', title: 'drag(x) instead of a drag phase', entries: ['rule:drag'],
    wrong: '.card { --x: state(0px); }\n.card:on(drag(x)) { --x: set(event(x)); }',
    right: '.card { --x: state(0px); }\n.card:on(drag(move)) { --x: set(event(x)); }',
    explanation: 'drag() takes a phase: start, move, end or cancel. Coordinates come from event(x) / event(y).', codes: ['RCSS-E022'] },
  { id: 'blur-when', title: ':blur(when())', entries: ['selector:blur'],
    wrong: '.field input:blur(when(--touched)) { outline-color: red; }',
    right: '.field input:blur { outline-color: red; }',
    explanation: ':blur takes no arguments.', codes: ['RCSS-P065'] },
  { id: 'type-mismatch-length', title: 'A number state for a pointer coordinate', entries: ['expression:event', 'function:state'],
    wrong: '.pad { --x: state(0); }\n.pad:on(click) { --x: set(event(client-x)); }',
    right: '.pad { --x: state(0px); }\n.pad:on(click) { --x: set(event(client-x)); }',
    explanation: 'event(client-x) is a px length. A state(0) number cannot store it: every write is rejected at runtime.', codes: ['MCP-type-mismatch'] },
  { id: 'toggle-non-boolean', title: 'toggle() on a number state', entries: ['mutation:toggle'],
    wrong: '.menu { --open: state(0); }\n.menu button:on(click) { --open: toggle(); }',
    right: '.menu { --open: state(false); }\n.menu button:on(click) { --open: toggle(); }',
    explanation: 'toggle() needs a boolean state.', codes: ['MCP-type-mismatch'] },
  { id: 'drag-number-state', title: 'event(x) into a string or keyword state', entries: ['rule:drag'],
    wrong: '.card { --x: state(left); }\n.card:on(drag) { --x: set(event(x)); }',
    right: '.card { --x: state(0px); }\n.card:on(drag) { --x: set(event(x)); }',
    explanation: 'event(x) / event(y) move a number or px state.', codes: ['MCP-type-mismatch'] },
  { id: 'mutation-outside-on', title: 'A mutation outside an :on() rule', entries: ['rule:on', 'mutation:set'],
    wrong: '.menu { --open: state(false); }\n.menu button { --open: toggle(); }',
    right: '.menu { --open: state(false); }\n.menu button:on(click) { --open: toggle(); }',
    explanation: 'Mutations run only in :on() rules. Elsewhere --open: toggle() is a plain custom property value and does nothing.', codes: ['MCP-mutation-outside-on'] },
  { id: 'event-outside-mutation', title: 'event() outside a mutation', entries: ['expression:event'],
    wrong: '.pad { --x: state(0px); --y: calc(event(client-y) * 1); }',
    right: '.pad { --x: state(0px); }\n.pad:on(pointermove) { --x: set(event(client-x)); }',
    explanation: 'There is no event outside a mutation: event() is read only in :on() rules.', codes: ['MCP-event-outside-mutation'] },
  { id: 'no-owner', title: 'A mutation of a state that nothing declares', entries: ['function:state', 'rule:on'],
    wrong: '.counter .inc:on(click) { --count: increment(1); }',
    right: '.counter { --count: state(0); }\n.counter .inc:on(click) { --count: increment(1); }',
    explanation: 'A mutation changes the nearest owner on the element or an ancestor. Declare the state with state() on the element or a container.', codes: ['MCP-no-state-owner'] },
  { id: 'wrong-event-field', title: 'An event field the trigger does not provide', entries: ['expression:event'],
    wrong: '.b { --k: state(""); }\n.b:on(click) { --k: set(event(key)); }',
    right: '.b { --k: state(""); }\n.b:on(keydown) { --k: set(event(key)); }',
    explanation: 'Fields are checked against the trigger: key and code need keydown or keyup.', codes: ['RCSS-E046'] },
  { id: 'mixed-selector-list', title: 'Mixing :on() and plain selectors in one list', entries: ['rule:on'],
    wrong: '.a { --open: state(false); }\n.a:on(click), .b { --open: toggle(); }',
    right: '.a { --open: state(false); }\n.a:on(click) { --open: toggle(); }',
    explanation: 'Every item of an event rule must use :on(): a rule describes either an event or a style.', codes: ['RCSS-P079'] },
  { id: 'native-in-on', title: 'Styles inside an :on() rule', entries: ['rule:on'],
    wrong: '.b { --open: state(false); }\n.b:on(click) { --open: toggle(); color: red; }',
    right: '.b { --open: state(false); }\n.b:on(click) { --open: toggle(); }\n.b:when(--open) { color: red; }',
    explanation: 'An :on() rule describes a moment. Put styles in a :when() rule or read the state with var().', codes: ['RCSS-P057'] },
  { id: 'event-name-dragstart', title: 'Native drag-and-drop events in :on()', entries: ['rule:drag'],
    wrong: '.card { --x: state(0px); }\n.card:on(dragstart) { --x: set(0px); }',
    right: '.card { --x: state(0px); }\n.card:on(drag(start)) { --x: set(0px); }',
    explanation: ':on(drag) is pointer dragging. Native HTML drag and drop (dragstart, drop) is not supported.', codes: ['RCSS-E023'] },
  { id: 'legacy-on', title: '0.8 on: instead of :on()', entries: ['declaration:on'],
    wrong: '.menu { --open: state(false); }\n.menu > button { on: click(toggle(--open)); }',
    right: '.menu { --open: state(false); }\n.menu > button:on(click) { --open: toggle(); }',
    explanation: 'on: still works in 0.9 but is legacy. migrate_css rewrites it.', codes: ['MCP-legacy-on'] },
  { id: 'legacy-text', title: '0.8 text: instead of content', entries: ['declaration:text', 'declaration:content'],
    wrong: '.counter { --count: state(0); }\n.counter .value { text: var(--count); }',
    right: '.counter { --count: state(0); }\n.counter .value { content: var(--count); }',
    explanation: 'text: is legacy; content: var(--x) on an element is the 0.9 DOM text.', codes: ['MCP-legacy-text'] },
  { id: 'legacy-attr', title: '0.8 attr: instead of --attr-*', entries: ['declaration:attr', 'declaration:--attr-*'],
    wrong: '.menu { --open: state(false); }\n.menu > button { attr: aria-expanded var(--open); }',
    right: '.menu { --open: state(false); }\n.menu > button { --attr-aria-expanded: var(--open); }',
    explanation: 'attr: is legacy; --attr-<name> writes the attribute.', codes: ['MCP-legacy-attr'] },
  { id: 'legacy-bind', title: 'bind: on a control that owns its state', entries: ['declaration:bind()'],
    wrong: 'input.q { --q: state(""); bind: --q; }',
    right: 'input.q { --q: state("", bind(value)); }',
    explanation: 'For a control that owns its state, 0.9 writes bind(value) or bind(checked) in state(). bind: stays for ancestor state.', codes: ['MCP-legacy-bind'] },
  { id: 'attr-not-allowed', title: 'Writing a non-allowlisted attribute', entries: ['declaration:--attr-*'],
    wrong: '.b { --o: state(false); --attr-onclick: var(--o); }',
    right: '.b { --o: state(false); --attr-aria-pressed: var(--o); }',
    explanation: 'Only aria-* states, aria-label, aria-valuetext, data-*, disabled, hidden, required and tabindex are writable.', codes: ['RCSS-P051'] },
  { id: 'content-pseudo-element', title: 'Expecting DOM text from ::before { content: var(--x) }', entries: ['declaration:content'],
    wrong: '.counter { --count: state(0); }\n.counter .value::before { content: var(--count); }',
    right: '.counter { --count: state(0); }\n.counter .value { content: var(--count); }',
    explanation: 'In pseudo-elements content stays native CSS: no DOM text, and a number renders nothing there.', codes: ['MCP-content-pseudo-element'] },
  { id: 'empty-rule-minifier', title: 'Modifier-only rules removed by minifiers', entries: ['modifier:prevent', 'rule:on'],
    wrong: 'form.search:on(submit, prevent()) {}',
    right: 'form.search:on(submit, prevent()) {}',
    explanation: 'Valid, but an empty rule: esbuild minify, csso and lightningcss delete it silently. Minify these stylesheets for whitespace only.', codes: ['MCP-empty-rule-minifier'], rightCodes: ['MCP-empty-rule-minifier'] },
];

/** Native CSS and HTML that already do the job: use them before Reactive CSS. */
export const NATIVE_FIRST = [
  { need: 'Hover, press and focus styles', native: ':hover, :active, :focus-visible, :focus-within', note: 'No state needed.' },
  { need: 'Styling from a checkbox or radio', native: ':checked and :has(:checked)', note: 'Reactive CSS state is for values CSS cannot hold (counts, modes, positions).' },
  { need: 'Disclosure (show/hide one section)', native: '<details> and <summary>', note: 'Accessible and keyboard-ready by default.' },
  { need: 'Popups, menus, tooltips', native: 'The Popover API (popover, popovertarget) and <dialog>', note: 'Light dismiss and focus handling are built in.' },
  { need: 'Parent or sibling state in selectors', native: ':has()', note: '' },
  { need: 'Transitions and entry animations', native: 'transition, @starting-style, @keyframes', note: 'Reactive CSS only changes state; the browser animates.' },
  { need: 'Random values', native: 'random(min, max, step) from CSS Values 5 where the browser implements it', note: 'Reactive CSS leaves supported native calls alone and fills in only where needed.' },
  { need: 'Conditional values from media or container size', native: '@media, @container, container units, if() where supported', note: '' },
  { need: 'Drag and drop between containers, sortable lists', native: 'HTML drag and drop with JavaScript', note: ':on(drag) moves one element with the pointer; it has no drop targets.' },
];

/** Compatibility facts for 0.10.0 (README, docs/compatibility.md). */
export const COMPATIBILITY = {
  buildTarget: 'Chrome and Edge 111+, Firefox 128+, Safari 16.4+',
  tested: 'Automated tests in Chromium, WebKit and Firefox (Playwright engine builds; Firefox in CI), not Chrome, Safari or Firefox releases.',
  notVerified: ['real Safari', 'real touch and pen hardware (drag)', 'screen readers'],
  nativeCss: 'Stylesheets without reactive syntax are not processed. Reactive sheets are rewritten only around the reactive parts; native :focus, :focus-visible, ::before content, calc(), :has() and if() are untouched.',
  minifiers: 'CSS minifiers that remove empty rules (esbuild minify, csso, lightningcss) delete modifier-only :on() rules such as a:on(click, prevent()) {}. Use whitespace-only minification for Reactive stylesheets.',
  csp: 'Works under a strict Content-Security-Policy (no eval, no inline scripts needed).',
  stylesheets: ['Same-origin linked and inline stylesheets are processed.', 'Cross-origin sheets with CORS: states work, event and focus rules are dropped as untrusted.', '@import-ed sheets are not processed.', 'Shadow-root stylesheets are not processed.'],
  legacy: '0.8 syntax (on:, text:, attr:, bind:) keeps working in 0.9. The one possible break: custom properties named --attr-<allowlisted> now write attributes.',
  productionDiagnostics: 'Minified bundles report diagnostics as codes such as RCSS-P012⟦…⟧; decode them with npx -p @reactivecss/core reactive-css explain "<message>" or use reactive-css.js for full messages.',
};

/** Topics of the maintained examples (site/src/catalog), for get_example. */
export const EXAMPLE_TOPICS = {
  counter: ['counter', 'increment', 'decrement', 'dom text', 'content'],
  'state-toggle': ['toggle', 'boolean', 'when'],
  tabs: ['tabs', 'keyboard', 'prevent', 'cycle', 'nth-var', 'focus'],
  'form-mirror': ['form binding', 'bind', 'input', 'event value', 'dom text'],
  'persistent-preference': ['persistence', 'persist', 'theme', 'localstorage'],
  'attribute-sync': ['dom attributes', 'attr', 'aria', '--attr-*'],
  'click-coordinates': ['click coordinates', 'event', 'client-x', 'local-x', 'pointer'],
  'draggable-card': ['drag', 'gesture', 'pointer', 'keyboard'],
  'focus-blur': ['focus and blur', 'focus', 'blur', 'focus request'],
  'state-history': ['state history', 'previous', 'direction', 'changed'],
  'random-colors': ['random values', 'random', 'pick'],
  'conditional-state': ['conditions', 'when', 'cycle'],
  'context-menu': ['context menu', 'contextmenu', 'prevent', 'outside', 'escape', 'focus'],
  'element-size': ['element size', 'element', 'geometry'],
  accordion: ['accordion', 'toggle', 'aria-expanded'],
  dropdown: ['dropdown', 'menu', 'outside', 'escape', 'focus'],
  'pricing-toggle': ['pricing', 'toggle'],
  'signup-form': ['form', 'validation', 'input', 'reset'],
  'step-wizard': ['wizard', 'steps', 'nth-var'],
  'task-list': ['task list', 'checkbox', 'just-checked'],
  'theme-switcher': ['theme', 'cycle'],
};
