// Advanced example workspaces (Control Center). The expression registry for each workspace is
// src/content/workspaces/<id>.entries.json (converted from the design). This module adds what
// the running preview needs: where each named region is in the example markup.
import basicEntries from '~/content/workspaces/control-center.entries.json';
import deepEntries from '~/content/workspaces/control-center-deep.entries.json';

export interface WorkspaceEntry {
  id: string;
  /** Regex source matching the source line(s) of this expression in style.css; null for HTML-only entries. */
  re: string | null;
  kind: string;
  fn: string;
  expr: string;
  what: string;
  /** Region ids this expression changes. */
  aff: string[];
  /** Declares this state. */
  own?: string;
  /** Writes this state. */
  w?: string;
  /** Reads these states. */
  r?: string[];
  trig?: string;
  where?: string;
  facts?: [string, string][];
  href?: string;
  ref?: string;
  /** The expression produces a value the inspector can observe (a custom property or a state). */
  observes?: boolean;
}

export interface GuideStep { title: string; text: string; keys: string[]; trig?: string; regions: string[] }

export interface WorkspaceDef {
  id: string;
  example: string;
  title: string;
  tag: string;
  summary: string;
  uses: [string, string][];
  native?: string[];
  regions: Record<string, { label: string; selector: string }>;
  groups: [string, string[]][];
  guide: GuideStep[];
  entries: WorkspaceEntry[];
  next: { label: string; href: string; caption: string };
  back: { label: string; href: string };
}

const fixHref = (e: WorkspaceEntry): WorkspaceEntry =>
  e.href?.startsWith('Docs.dc.html#') ? { ...e, href: '/docs/' + e.href.slice(13).replace('--', '/#').replace(/^api-/, 'reference/') + (e.href.includes('--') ? '' : '/') } : e;

const ref = (name: string, id: string): [string, string] => [name, `/docs/reference/${id}/`];

export const WORKSPACES: Record<string, WorkspaceDef> = {
  'control-center': {
    id: 'control-center',
    example: 'control-center',
    title: 'Control Center',
    tag: 'advanced example',
    summary: 'A real settings form: native radios, a checkbox and a text field. Reactive CSS binds them to four states that drive a live preview; saving stays with the browser and your server. Change a setting, then follow it from the control to the state and the result.',
    uses: [ref('state()', 'state'), ref(':on()', 'on-rule'), ref('event()', 'event'), ref('when()', 'when'), ref(':when()', 'when-selector')],
    native: ['<form>', 'radio', 'checkbox', ':has()', ':user-invalid', '@media'],
    regions: {
      app: { label: 'App surface', selector: '.control-center' },
      themeSeg: { label: 'Theme radios', selector: '.theme' },
      swatches: { label: 'Accent radios', selector: '.accent' },
      notifySw: { label: 'Notifications checkbox', selector: '.notify input' },
      status: { label: 'Status text', selector: '.notify .status' },
      nameIn: { label: 'Display name field', selector: '.profile input' },
      avatar: { label: 'Avatar', selector: '.preview .avatar' },
      pName: { label: 'Header name', selector: '.preview .name' },
      pBell: { label: 'Inbox', selector: '.preview .bell' },
      pBadge: { label: 'Unread badge', selector: '.preview .badge' },
      alert: { label: 'Alert', selector: '.preview .alert' },
      resetBtn: { label: 'Reset button', selector: 'button[type="reset"]' },
      saveBtn: { label: 'Save settings button', selector: 'button[type="submit"]' },
      submission: { label: 'Submission preview', selector: '' },
    },
    groups: [['Appearance', ['theme', 'accent']], ['Notifications', ['notify']], ['Profile', ['name']]],
    guide: [
      { title: 'Change the appearance', text: 'Pick Dark, System or another accent. The radios are bound to --theme and --accent, and :when() rules swap the color tokens. System hands the decision to a native @media query.', keys: ['theme', 'accent'], regions: ['themeSeg', 'swatches'] },
      { title: 'Turn off notifications', text: 'The checkbox stays a real checkbox. An :on(change) rule copies event(checked) into --notify, and when() calls dim the preview. No script handler is involved.', keys: ['notify'], regions: ['notifySw'] },
      { title: 'Edit your name', text: 'Type in the field. An :on(input) rule writes event(value) into --name on every keystroke, and the preview prints it with var(--name).', keys: ['name'], regions: ['nameIn'] },
      { title: 'Save settings', text: 'Press Save settings. The browser validates the form and builds its data. This page has no server, so it shows the request instead of sending it.', keys: [], trig: 'n-submit', regions: ['saveBtn'] },
      { title: 'Reset the form', text: 'Press Reset. The controls return to their HTML defaults, and an :on(reset) rule sets each state back to its initial value. The preview follows.', keys: [], trig: 'n-reset', regions: ['resetBtn'] },
    ],
    entries: (basicEntries as WorkspaceEntry[]).map(fixHref),
    back: { label: 'Advanced Examples', href: '/examples/#advanced' },
    next: { label: 'Control Center · Deep Dive', href: '/examples/control-center-deep-dive/', caption: 'Next →' },
  },
  'control-center-deep': {
    id: 'control-center-deep',
    example: 'control-center-deep',
    title: 'Control Center · Deep Dive',
    tag: 'deep dive',
    summary: 'The full version of the Control Center: density, digest frequency, avatar shape and a focus goal with history. Eight states and every action, binding and history function in one stylesheet.',
    uses: [ref('state()', 'state'), ref(':on()', 'on-rule'), ref('event()', 'event'), ref('set()', 'set'), ref('toggle()', 'toggle'), ref('cycle()', 'cycle'), ref('increment()', 'increment'), ref('decrement()', 'decrement'), ref('when()', 'when'), ref(':when()', 'when-selector'), ref('previous()', 'previous'), ref('direction()', 'direction'), ref(':changed()', 'changed')],
    regions: {
      app: { label: 'App surface', selector: '.control-center' },
      themeSeg: { label: 'Theme buttons', selector: '.theme-option' },
      swatches: { label: 'Accent swatches', selector: '.swatch' },
      densityBtn: { label: 'Density button', selector: '.density-button' },
      panels: { label: 'Panel spacing', selector: '.panel' },
      notifySw: { label: 'Notifications switch', selector: '.notify-switch' },
      status: { label: 'Status text', selector: '.status' },
      digest: { label: 'Digest options', selector: '.digest' },
      nameIn: { label: 'Display name field', selector: '.profile input[type="text"]' },
      roundIn: { label: 'Round avatar checkbox', selector: '.profile input[type="checkbox"]' },
      avatar: { label: 'Avatar', selector: '.avatar' },
      goalBtns: { label: '− and + buttons', selector: '.goal .minus, .goal .plus' },
      goalOut: { label: 'Goal number', selector: '.goal output' },
      trend: { label: 'History label', selector: '.goal .history' },
      pName: { label: 'Header name', selector: '.preview .name' },
      pSched: { label: 'Header digest', selector: '.preview .schedule' },
      pBell: { label: 'Inbox bell', selector: '.preview .bell' },
      pBadge: { label: 'Unread badge', selector: '.preview .badge' },
      pMeter: { label: 'Goal meter', selector: '.preview .meter' },
    },
    groups: [['Appearance', ['theme', 'accent', 'density']], ['Notifications', ['notify', 'digest']], ['Profile', ['name', 'round']], ['Focus goal', ['goal']]],
    guide: [
      { title: 'Change the appearance', text: 'Pick Dark, System or another accent. set() writes a keyword into --theme or --accent, and :when() rules swap the color tokens.', keys: ['theme', 'accent'], regions: ['themeSeg', 'swatches'] },
      { title: 'Toggle a setting', text: 'Turn notifications off. The trace under the preview shows the click, --notify: toggle(), the new value, the when() calls that read it and the result.', keys: ['notify'], regions: ['notifySw'] },
      { title: 'Edit a bound input', text: 'Type a different display name. An :on(input) rule writes --name on every keystroke, and the header prints it with var(--name).', keys: ['name'], regions: ['nameIn'] },
      { title: 'Increment a value', text: 'Raise or lower the focus goal. previous() keeps the old value, and direction() picks the rise or fall animation.', keys: ['goal'], regions: ['goalBtns'] },
      { title: 'Inspect the state transition', text: 'Click a step in the trace, or a row in the state panel, to open it in the inspector. Every value on screen comes from the states listed there.', keys: ['inspect'], regions: [] },
    ],
    entries: (deepEntries as WorkspaceEntry[]).map(fixHref),
    back: { label: 'Control Center', href: '/examples/control-center/' },
    next: { label: 'Examples', href: '/examples/', caption: 'All examples →' },
  },
};
