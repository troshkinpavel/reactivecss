// Homepage content. Code for the demos lives in src/examples/<id>/.
export const CAPABILITIES = [
  { id: 'home-like', name: 'State & events', demo: 'Like button', replaces: 'a click listener that flips a flag, toggles a class and rewrites the count.', a11y: 'native button. The experimental --attr-aria-pressed: var(--liked) keeps aria-pressed in sync, and the count is generated content, not HTML text.' },
  { id: 'wizard', name: 'Dynamic selectors', demo: 'Step navigator', replaces: 'tracking the current step and showing the matching panel and step marker.', a11y: 'visual only. A real wizard also needs aria-current on the active step and focus moved to the new panel.' },
  { id: 'score', name: 'State history', demo: 'Score trend', replaces: 'storing the previous value and comparing it on every change to pick an animation.', a11y: 'native buttons. The trend is spelled out in text, not shown by the arrow alone.' },
  { id: 'profile', name: 'Binding', demo: 'Live profile', replaces: 'an input listener that copies the value into a preview card.', a11y: 'complete for the form: the input is native and labelled. The card is decorative.' },
  { id: 'spotlight', name: 'Geometry', demo: 'Pointer spotlight', replaces: 'a pointermove listener that measures the element and writes coordinates to styles.', a11y: 'decorative and pointer only.' },
] as const;

const S = '<' + 'script';
export const INSTALL_TAG = `${S} src="reactive-css.min.js" defer></${'script'}>`;
export const INSTALL = {
  html: `${S} src="reactive-css.min.js"\n        defer></${'script'}>\n<link rel="stylesheet"\n      href="styles.css">`,
  css: '.toggle {\n  --on: state(false);\n  background: when(--on, #111, #ddd);\n}\n\n.toggle:on(click) {\n  --on: toggle();\n}',
  fallback: '.toggle {\n  --on: state(false);\n  background: #ddd;\n  background: when(--on, #111, #ddd);\n}\n\n.toggle:on(click) {\n  --on: toggle();\n}',
};

export const DOC_LINKS = [
  { href: '/docs/getting-started/', title: 'Getting started', meta: '5 min →', text: 'Include the script, write one rule, click the result.' },
  { href: '/docs/core-concepts/', title: 'Core concepts', meta: 'guide →', text: 'State, events, conditions, selectors and binding, one at a time.' },
  { href: '/docs/reference/', title: 'API reference', meta: 'reference →', text: 'Every function with its syntax, update behavior and limits.' },
  { href: '/playground/', title: 'Playground', meta: 'try →', text: 'Edit a rule and inspect its state as it changes.' },
];
