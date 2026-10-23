// The four stages of CSS (from Vision v1, design-source/Vision.dc.html), now shown on the homepage's
// "Where this fits" section. Executable code only: the Reactive CSS stage compiles (tests/unit/compile.test.ts).

import panelCss from '~/examples/vision-panel/style.css?raw';

export interface Stage { kick: string; title: string; toks: string[]; file: string; code: string; text: string; note: string; rx?: boolean }

export const STAGES: Stage[] = [
  {
    kick: '01 · Native CSS', title: 'CSS learned to calculate.', toks: ['calc()', 'min()', 'max()', 'clamp()'], file: 'layout.css',
    code: '.card {\n  width: min(100%, 64rem);\n  padding: clamp(16px, 4vw, 40px);\n  gap: calc(1rem + 1vw);\n  font-size: max(1rem, 1.2vw);\n}',
    text: 'Math moved into the stylesheet. Sizes that once needed a resize listener became one declaration the browser keeps up to date.',
    note: 'Supported in every current browser.',
  },
  {
    kick: '02 · Native CSS', title: 'CSS learned to understand relationships.', toks: [':has()', '@container', ':nth-child()'], file: 'card.css',
    code: '.card:has(img) {\n  grid-template-columns: 1fr 2fr;\n}\n\n.shelf { container-type: inline-size; }\n\n@container (width > 40rem) {\n  .card { padding: 32px; }\n}\n\nli:nth-child(odd of .visible) {\n  background: #f5f3ef;\n}',
    text: 'Selectors and queries began to read context: what an element contains, how wide its container is, where it sits among its siblings.',
    note: 'Supported in current Chromium, WebKit and Firefox releases.',
  },
  {
    kick: '03 · Native CSS', title: 'CSS learned conditions and functions.', toks: ['if()', '@function', '@property'], file: 'tokens.css',
    code: '@property --gap {\n  syntax: "<length>";\n  inherits: true;\n  initial-value: 8px;\n}\n\n@function --fluid(--min, --max) {\n  result: clamp(var(--min), 4vw, var(--max));\n}\n\n.card {\n  padding: if(\n    style(--size: large): 32px;\n    else: 16px\n  );\n}',
    text: 'Custom properties gained types, values gained branches, and authors can define their own functions. CSS is starting to describe logic.',
    note: 'if() and @function are newer and support varies by browser. @property is widely available.',
  },
  {
    kick: '04 · Reactive CSS', title: 'What if CSS could remember and react?', toks: ['state()', ':on()', 'event()', 'content'], file: 'panel.css', rx: true,
    code: panelCss.trimEnd(),
    text: 'Reactive CSS experiments with the next question: values that change, events that change them, inputs bound to them and text that follows them, all written in a stylesheet.',
    note: 'This syntax belongs to an independent library. It is not part of any CSS specification or browser roadmap, and it needs a small JavaScript runtime to work.',
  },
];
