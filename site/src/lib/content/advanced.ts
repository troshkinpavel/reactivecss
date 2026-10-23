// Advanced Examples index content (Docs · Examples · Advanced Examples).
export const FEATURED = {
  href: '/examples/control-center/',
  title: 'Control Center',
  summary: 'A real settings form. Native radios, a checkbox and a text field are bound to four states that drive a live preview, while saving stays with the browser and the server.',
  uses: ['state()', ':on()', 'event()', 'when()', ':when()'],
  chain: [['event', 'change', false], ['action', '--notify: set(event(checked))', true], ['state', 'true → false', true], ['condition', 'when() ×5', false], ['result', 'muted preview', false]] as [string, string, boolean][],
};
export const DEEP = {
  href: '/examples/control-center-deep-dive/',
  title: 'Control Center · Deep Dive',
  summary: 'The full version, with density, digest frequency, avatar shape and a focus goal that remembers its history.',
  uses: ['set()', 'toggle()', 'cycle()', 'increment()', 'previous()', 'direction()', ':changed()'],
};
export const UPCOMING: { title: string; summary: string; placeholder: string; uses: [string, boolean][]; note?: string }[] = [
  { title: 'Magnetic Card', summary: 'A card that tilts and casts depth toward the pointer.', placeholder: 'pointer-driven card', uses: [['mouse()', false], ['state()', false], [':when()', false]] },
  { title: 'Text Roulette', summary: 'HTML attributes as configurable content, re-rolled on click.', placeholder: 'rolling headline', uses: [['state()', false], ['pick()', false], ['attr()', false], ['split()', false]], note: 'attr() and split() shipped as experimental in 0.5.0. The example is not built yet.' },
  { title: 'Reactive Grid', summary: 'A geometric field driven by reactive values and CSS animations.', placeholder: 'animated tile grid', uses: [['visible()', false], ['live()', false], ['state()', false]] },
];
