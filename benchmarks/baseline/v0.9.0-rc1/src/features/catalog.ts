// The canonical catalog of bundle features (0.8.0): one entry per unit a custom bundle can
// include. Plain data, no imports, so build tools read it directly (Node strips the types).
// Consistency with the API registry (core/features.ts) and with the registered runtime is tested
// in tests/unit/catalog.test.ts; dependencies are verified by building each entry alone
// (tests/unit/catalog.test.ts). Semantics: docs/rfc-modular-runtime-0.8.md.

export type FeatureId = 'core' | 'events' | 'gestures' | 'persist' | 'conditions' | 'nth-var' | 'history' | 'forms' | 'text' | 'attributes' | 'focus' | 'blur' | 'values' | 'dynamic' | 'geometry';
export type Category = 'Core & State' | 'Events & Actions' | 'Conditions & Selectors' | 'Forms & DOM Bindings' | 'History' | 'Values & Strings' | 'Geometry & Observers' | 'Focus & Accessibility';

export interface CatalogFeature {
  id: FeatureId;
  title: string;
  category: Category;
  /** Entry module relative to the package root (null: always included). */
  entry: string | null;
  /** Source modules that implement it (relative to src/). */
  modules: string[];
  /** Features that must be in the same bundle (resolved automatically). */
  requires: FeatureId[];
  /** Features that add to it when present, but are not needed. */
  optional: FeatureId[];
  status: 'stable' | 'experimental';
  /**
   * Syntax it provides, as the parser's usage keys: `decl:on`, `fn:live`, `sel:when`, `act:set`,
   * `trigger:key`… `trigger:*` and `act:*` mean every trigger / action. 0.9.0 adds `sel:on`,
   * `mod:*` (prevent, stop, once), `mut:*` (mutations), `expr:event`, `gesture:drag`,
   * `decl:state-persist`, `decl:state-form`, `decl:attr-ns` (--attr-*), `decl:content`, `sel:focus-when`.
   */
  provides: string[];
  /** Human-readable syntax summary (for tools and the website). */
  syntax: string[];
}

export const CATALOG: CatalogFeature[] = [
  { id: 'core', title: 'Core & state', category: 'Core & State', entry: null,
    modules: ['core/*', 'state/state.ts', 'state/values.ts', 'state/expr.ts', 'state/bindattr.ts', 'state/textof.ts', 'state/keys.ts', 'api.ts'],
    requires: [], optional: [], status: 'stable',
    provides: ['decl:state', 'expr:attr', 'expr:pick', 'expr:split'],
    syntax: ['--x: state(initial)', 'attr(name [, fallback]) / pick(…) / split(text, "d") in state() and set()', 'previous(--x) / direction(--x) as condition operands', 'ReactiveCSS.start/stop/refresh/stats/compile/describe/diagnostics'] },
  { id: 'events', title: 'Events & actions', category: 'Events & Actions', entry: 'src/features/events.ts',
    modules: ['state/actions.ts', 'state/on.ts', 'state/actexpr.ts'], requires: ['core'], optional: [], status: 'stable',
    provides: ['sel:on', 'trigger:*', 'mod:*', 'mut:*', 'expr:event', 'decl:on', 'act:*'],
    syntax: ['.x:on(event [, prevent | stop | once]) { --state: set(expr) | toggle() | increment(n) | decrement(n) | cycle(a, b) }', ':on(keydown(Key)) / :on(outside(click))',
      'event(field), calc(), min(), max(), clamp(), round(), var(), mouse(), element(), viewport(), random() at event time',
      'legacy: on: trigger(action, …), key(), outside(), prevent()'] },
  { id: 'gestures', title: 'Drag gestures', category: 'Events & Actions', entry: 'src/features/gestures.ts',
    modules: ['state/gesture.ts'], requires: ['core', 'events'], optional: [], status: 'experimental',
    provides: ['gesture:drag'],
    syntax: [':on(drag) / :on(drag(start | move | end | cancel))', 'event(x | y | delta-x | delta-y | movement-x | movement-y | start-x | start-y)'] },
  { id: 'persist', title: 'Persistent state', category: 'Core & State', entry: 'src/features/persist.ts',
    modules: ['state/persist.ts'], requires: ['core'], optional: [], status: 'experimental',
    provides: ['decl:state-persist'],
    syntax: ['--x: state(initial, persist("key" [, local | session]))'] },
  { id: 'conditions', title: 'Conditions', category: 'Conditions & Selectors', entry: 'src/features/conditions.ts',
    modules: ['state/conditions.ts'], requires: ['core'], optional: [], status: 'stable',
    provides: ['fn:when', 'sel:when'],
    syntax: ['when(condition, a, b)', ':when(condition)'] },
  { id: 'nth-var', title: ':nth-var()', category: 'Conditions & Selectors', entry: 'src/features/nth-var.ts',
    modules: ['selectors/nth-var.ts'], requires: ['core'], optional: [], status: 'stable',
    provides: ['sel:nth-var'],
    syntax: [':nth-var(--x)'] },
  { id: 'history', title: 'History', category: 'History', entry: 'src/features/history.ts',
    modules: ['state/history.ts', 'state/changed.ts'], requires: ['core'], optional: [], status: 'stable',
    provides: ['fn:previous', 'fn:direction', 'sel:changed'],
    syntax: ['previous(--x)', 'direction(--x)', ':changed(--x)'] },
  { id: 'forms', title: 'Form bindings', category: 'Forms & DOM Bindings', entry: 'src/features/forms.ts',
    modules: ['state/bind.ts', 'selectors/just-checked.ts'], requires: ['core'], optional: [], status: 'stable',
    provides: ['decl:state-form', 'decl:bind', 'sel:just-checked', 'sel:just-unchecked'],
    syntax: ['--x: state(initial, bind(value | checked))', 'bind: --x [closest(selector)] (a control bound to an ancestor\'s state)', ':just-checked', ':just-unchecked'] },
  { id: 'text', title: 'DOM text', category: 'Forms & DOM Bindings', entry: 'src/features/text.ts',
    modules: ['state/text.ts'], requires: ['core'], optional: [], status: 'experimental',
    provides: ['decl:content', 'decl:text'],
    syntax: ['content: var(--x) | when(…) on elements (DOM text)', 'legacy: text: <value>'] },
  { id: 'attributes', title: 'HTML attributes', category: 'Forms & DOM Bindings', entry: 'src/features/attributes.ts',
    modules: ['state/attrdecl.ts', 'state/bindattr-runtime.ts'], requires: ['core'], optional: [], status: 'experimental',
    provides: ['decl:attr-ns', 'decl:attr', 'decl:state-bind'],
    syntax: ['--attr-<attribute>: <value>', '--x: state(initial, bind(attribute))', 'legacy: attr: <attribute> <value>'] },
  { id: 'focus', title: 'Declarative focus', category: 'Focus & Accessibility', entry: 'src/features/focus.ts',
    modules: ['state/focusdecl.ts'], requires: ['core', 'events'], optional: ['forms'], status: 'experimental',
    provides: ['sel:focus-when', 'decl:focus'],
    syntax: ['.x:focus(when(condition)) {}', 'legacy: focus: <boolean value>'] },
  { id: 'blur', title: ':blur', category: 'Focus & Accessibility', entry: 'src/features/blur.ts',
    modules: ['selectors/blur.ts'], requires: ['core'], optional: [], status: 'experimental',
    provides: ['sel:blur'],
    syntax: [':blur (from a focus loss until the next focus)'] },
  { id: 'values', title: 'Random & typed values', category: 'Values & Strings', entry: 'src/features/values.ts',
    modules: ['functions/values.ts', 'state/typed.ts'], requires: ['core'], optional: [], status: 'stable',
    provides: ['fn:random', 'fn:pick', 'fn:typed'],
    syntax: ['random(min, max [, by step])', 'pick(a, b, …)', '--x: typed(value [, "<syntax>"])'] },
  { id: 'dynamic', title: 'Live & pointer values', category: 'Geometry & Observers', entry: 'src/features/dynamic.ts',
    modules: ['functions/live.ts', 'functions/sources.ts'], requires: ['core'], optional: [], status: 'stable',
    provides: ['fn:live', 'fn:on', 'fn:mouse', 'fn:viewport', 'fn:visible'],
    syntax: ['live(expr, interval)', 'on(event, expr)', 'mouse(x|y [, local])', 'viewport(width|height)', 'visible([threshold])'] },
  { id: 'geometry', title: 'Element size', category: 'Geometry & Observers', entry: 'src/features/geometry.ts',
    modules: ['functions/geometry.ts'], requires: ['core'], optional: [], status: 'experimental',
    provides: ['fn:element'],
    syntax: ['element(width)', 'element(height)'] },
];

/** Example configurations (docs/bundle-builder-0.8.md). */
export const PROFILES: Record<string, FeatureId[]> = {
  basic: ['events'],
  forms: ['events', 'forms', 'text', 'attributes'],
  'stateful-ui': ['events', 'conditions', 'history', 'attributes', 'focus'],
  interactive: ['events', 'gestures', 'conditions', 'attributes', 'text', 'persist'],
  dynamic: ['values', 'dynamic', 'geometry'],
  full: CATALOG.map((f) => f.id),
};
