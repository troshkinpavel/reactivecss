// Every interactive example, defined once and reused by the homepage, docs, playground and
// Storybook. Sources are real files in src/examples/<id>/:
//
//   style.css   the Reactive CSS shown to the reader (runs in the preview)
//   index.html  the markup (runs in the preview, shown in the HTML tab)
//   base.css    layout and look of the preview only, no reactive syntax (runs, not shown)
//   vanilla.js  the idiomatic JavaScript version, for comparison (shown, never run)
//   vanilla.css, vanilla.html  optional: the stylesheet and markup of that version, when they
//               differ from style.css and index.html (shown, never run)

import shared from './_shared/preview.css?raw';
import { getDemo } from '~/lib/content/demos';

const files = import.meta.glob<string>('./*/{style.css,index.html,base.css,vanilla.js,vanilla.css,vanilla.html}', { query: '?raw', import: 'default', eager: true });

export type Level = 'basic' | 'intermediate' | 'advanced';

/** A control under the preview that edits the stylesheet: it replaces `value` in style.css. */
export interface ExampleControl { label: string; kind: 'swatch' | 'segment'; value: string; options: string[] }

export interface ExampleMeta {
  title: string;
  description: string;
  /** File name stem used in tabs: `switch` → switch.css, switch.js. */
  stem: string;
  level: Level;
  /** Short accessibility status shown in the preview header. */
  a11y: string;
  /** Label of the preview header, such as `<div class="greeting">`. Defaults to the a11y note. */
  label?: string;
  controls?: ExampleControl[];
  /** Width of the preview column in px for demos that need room (default 250, compact 200); the code beside it scrolls. */
  previewWidth?: number;
}

export interface ExampleDefinition extends ExampleMeta {
  id: string;
  files: { css: string; html: string; base: string; js: string | null; vanillaCss?: string; vanillaHtml?: string };
}

const META = {
  switch: { title: 'Toggle', description: 'A switch whose track color and knob position come from one boolean state.', stem: 'switch', level: 'basic', a11y: 'visual only' },
  like: {
    title: 'Like button', description: 'A button that remembers whether it was clicked.', stem: 'like', level: 'basic', a11y: 'visual only',
    controls: [
      { label: 'color', kind: 'swatch', value: '#f2542d', options: ['#f2542d', '#2563eb', '#15803d', '#7c3aed'] },
      { label: 'transition', kind: 'segment', value: '200ms', options: ['0ms', '200ms', '800ms'] },
    ],
  },
  counter: { title: 'Counter', description: 'Increment and decrement a number and print it with a CSS counter.', stem: 'counter', level: 'basic', a11y: 'native buttons' },
  greeting: { title: 'Greeting', description: 'A string state that a button sets to a greeting picked at random from a list.', stem: 'greeting', level: 'basic', a11y: 'native button', label: '<div class="greeting">' },

  // Docs examples
  history: { title: 'Counter with history', description: 'previous() and direction() remember the last change, and :changed() plays an animation that follows its direction.', stem: 'counter', level: 'intermediate', a11y: 'native buttons', previewWidth: 400 },
  accordion: { title: 'Accordion', description: 'Every item owns its own open state, toggled by its button.', stem: 'accordion', level: 'basic', a11y: 'visual only' },
  tabs: { title: 'Tabs', description: 'set() writes the clicked tab’s position and :nth-var() shows the matching panel.', stem: 'tabs', level: 'basic', a11y: 'visual only' },
  form: { title: 'Form binding', description: 'bind: connects a text field, a select and a checkbox to states that a live preview reads.', stem: 'signup', level: 'intermediate', a11y: 'labelled controls' },
  theme: { title: 'Theme switcher', description: 'One keyword state on :root, cycled by a button, picks the page colors.', stem: 'theme', level: 'basic', a11y: 'native button' },
  dropdown: { title: 'Dropdown menu', description: 'A menu that closes on a click outside it or on Escape.', stem: 'menu', level: 'intermediate', a11y: 'visual only' },
  pointer: { title: 'Pointer position', description: 'mouse(x, local) and mouse(y, local) move a dot to the pointer.', stem: 'pad', level: 'intermediate', a11y: 'pointer only' },
  pricing: { title: 'Pricing toggle', description: 'A billing switch changes the price text and shows the annual saving.', stem: 'pricing', level: 'basic', a11y: 'visual only' },
  check: { title: 'Task list', description: 'Checkboxes bound to states, with :just-checked and :just-unchecked animations.', stem: 'tasks', level: 'intermediate', a11y: 'native checkboxes' },
  dice: { title: 'Dice and random words', description: 'on() re-rolls random() and pick() on every click.', stem: 'dice', level: 'intermediate', a11y: 'native buttons' },
  size: { title: 'Text size', description: 'Three buttons set one dimension state that the paragraph uses as its font size.', stem: 'reader', level: 'basic', a11y: 'native buttons' },
  geometry: { title: 'Element geometry', description: 'element(width) measures the card, and its label and readout follow the measured width.', stem: 'geometry', level: 'advanced', a11y: 'native buttons', previewWidth: 400 },

  // Homepage capability demos
  'home-like': { title: 'Like button', description: 'One boolean state: the button toggles it, the heart and the count read it.', stem: 'like', level: 'basic', a11y: 'native button', label: 'Like button' },
  wizard: { title: 'Step navigator', description: 'Replaces tracking the current step and showing the matching panel and step marker.', stem: 'wizard', level: 'intermediate', a11y: 'visual only', label: 'Step navigator' },
  score: { title: 'Score trend', description: 'Replaces storing the previous value and comparing it on every change to pick an animation.', stem: 'score', level: 'intermediate', a11y: 'native buttons', label: 'Score trend' },
  profile: { title: 'Live profile', description: 'Replaces an input listener that copies the value into a preview card.', stem: 'profile', level: 'basic', a11y: 'labelled input', label: 'Live profile' },
  spotlight: { title: 'Pointer spotlight', description: 'Replaces a pointermove listener that measures the element and writes coordinates to styles.', stem: 'spotlight', level: 'intermediate', a11y: 'decorative, pointer only', label: 'Pointer spotlight' },

  // Compare page live results
  'compare-typed': { title: 'Typed custom properties', description: 'typed() registers --rotation as an angle, so the hover turn animates.', stem: 'card', level: 'basic', a11y: 'hover only', label: 'Live result' },
  'compare-when': { title: 'Conditional values', description: 'when() picks the background from a keyword state that a button cycles.', stem: 'card', level: 'basic', a11y: 'native button', label: 'Live result' },
  'compare-whensel': { title: 'Conditional style blocks', description: ':when() shows the banner once the cart holds three or more items.', stem: 'cart', level: 'basic', a11y: 'native button', label: 'Live result' },

  // Playground starters
  'pg-blank': { title: 'Blank', description: 'An empty document: write HTML and Reactive CSS from scratch.', stem: 'style', level: 'basic', a11y: 'your markup' },
  'pg-toggle': { title: 'Toggle', description: 'A switch with one boolean state, toggled by :on(click) and reflected into aria-checked.', stem: 'switch', level: 'basic', a11y: 'aria-checked' },
  'pg-counter': { title: 'Counter', description: 'A number state changed by :on(click) rules and shown as DOM text with content.', stem: 'counter', level: 'basic', a11y: 'native buttons' },
  'pg-tabs': { title: 'Tabs', description: 'Tabs and panels selected by one number state; --attr-aria-selected marks the active tab.', stem: 'tabs', level: 'basic', a11y: 'aria-selected' },
  'pg-input': { title: 'Input binding', description: 'state("", bind(value)) keeps a field and its state equal; an :on(input) copy feeds a greeting outside the field.', stem: 'greeting', level: 'basic', a11y: 'labelled input' },
  'pg-drag': { title: 'Drag', description: ':on(drag) moves a card with event(x) and event(y); arrow keys change the same states.', stem: 'card', level: 'intermediate', a11y: 'focusable card, arrow keys' },

  // Vision page: the Reactive CSS step of the evolution timeline
  'vision-panel': { title: 'Panel with state, binding and DOM text', description: 'A disclosure whose button reports aria-expanded, and a name field bound to a state that a greeting prints as real DOM text.', stem: 'panel', level: 'intermediate', a11y: 'native button, labelled input', label: 'panel' },

  // 0.9 method examples for the docs and the API reference (docs-*: no /examples/ page of their own)
  'docs-counter': { title: 'Counter (0.9 syntax)', description: ':on(click) rules change the state with increment() and decrement(); content writes it as DOM text and --attr-disabled disables the minus button at 0.', stem: 'counter', level: 'basic', a11y: 'native buttons' },
  'docs-toggle': { title: 'Toggle with aria-pressed', description: 'toggle() flips a boolean state that bind(aria-pressed) reflects into the button.', stem: 'toggle', level: 'basic', a11y: 'native button, aria-pressed' },
  'docs-modifiers': { title: 'Event modifiers', description: 'stop() ends a click at its element, prevent() cancels a link, and a :when() guard makes a change happen once.', stem: 'panel', level: 'intermediate', a11y: 'native link and buttons' },
  'docs-event-data': { title: 'Event data', description: 'event(local-x) and event(local-y) capture where a press happened; event(key) captures a key.', stem: 'pad', level: 'intermediate', a11y: 'focusable pad, pointer and keyboard' },
  'docs-form': { title: 'Form binding (0.9)', description: 'bind(value) keeps a field and its own state equal; event(value) and event(checked) copy values to a shared owner.', stem: 'signup', level: 'intermediate', a11y: 'labelled controls' },
  'docs-attr': { title: 'Attribute reflection', description: '--attr-aria-expanded writes the real aria-expanded attribute from each item’s state.', stem: 'accordion', level: 'basic', a11y: 'native buttons, aria-expanded' },
  'docs-persist': { title: 'Persisted theme', description: 'persist() stores the state in localStorage. Inside this sandboxed preview storage is unavailable, so the state works but is not kept.', stem: 'prefs', level: 'basic', a11y: 'native button' },
  'docs-focus': { title: 'Focus request and :blur', description: 'Opening the search requests focus for its field with focus: when(); leaving the field plays a :blur animation.', stem: 'search', level: 'intermediate', a11y: 'native button and search field' },
  'docs-drag': { title: 'Draggable card', description: ':on(drag) moves a card with event(x) and event(y); arrow keys change the same states.', stem: 'card', level: 'intermediate', a11y: 'focusable card, arrow keys' },

  // Advanced examples
  'control-center': { title: 'Control Center', description: 'A real settings form: native radios, a checkbox and a text field bound to four states that drive a live preview. Saving stays with the browser and the server.', stem: 'style', level: 'advanced', a11y: 'native form controls', label: 'local state · nothing saved' },
  'control-center-deep': { title: 'Control Center · Deep Dive', description: 'The full version: density, digest frequency, avatar shape and a focus goal with history. Eight states and every action, binding and history function in one stylesheet.', stem: 'style', level: 'advanced', a11y: 'visual only' },
} satisfies Record<string, ExampleMeta>;

export type ExampleId = keyof typeof META;
export const exampleIds = Object.keys(META) as ExampleId[];

export function getExample(id: string): ExampleDefinition {
  const meta = (META as Record<string, ExampleMeta>)[id];
  const f = (name: string) => files[`./${id}/${name}`];
  const css = f('style.css'), html = f('index.html');
  if (!meta) { const demo = getDemo(id); if (demo) return demo; }
  if (!meta || css === undefined || html === undefined) throw new Error(`Unknown example "${id}". Add src/examples/${id}/ and an entry in manifest.ts.`);
  const vanillaCss = f('vanilla.css'), vanillaHtml = f('vanilla.html');
  return {
    id, ...meta,
    files: {
      css, html, base: shared + '\n' + (f('base.css') ?? ''), js: f('vanilla.js') ?? null,
      ...(vanillaCss !== undefined && { vanillaCss }), ...(vanillaHtml !== undefined && { vanillaHtml }),
    },
  };
}

export const isExampleId = (id: string): id is ExampleId => id in META;
