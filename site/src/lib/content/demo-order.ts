// The library demos the site publishes, in gallery order. A module of its own so the bundle
// builder island can import it without the demos' source files.
export const DEMO_ORDER = [
  'product-configurator', 'multi-step-wizard', 'interactive-quiz', 'live-form-preview', 'score-history',
  'accessible-tabs', 'accessible-toggle', 'settings-panel', 'shopping-cart', 'notification-center', 'form-validation', 'keyboard-playground',
  // 0.7.1 validation examples. dynamic-components and stylesheet-lab need their JavaScript harness and extra sheets, which the site does not run.
  'focus-transitions', 'keyboard-navigation', 'attribute-playground', 'nested-cascade', 'form-interactions', 'history-motion',
] as const;
