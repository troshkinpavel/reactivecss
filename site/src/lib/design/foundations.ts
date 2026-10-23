// Documentation of the design tokens, shared by the Design System page and Storybook's
// Foundations stories. The values themselves live in src/styles/tokens.css.
import type { TokenKind } from '~/lib/code/types';

export const COLORS: { token: string; name: string; use: string }[] = [
  { token: 'paper', name: 'Paper', use: 'Page background' },
  { token: 'paper-2', name: 'Paper 2', use: 'Code, notes, inputs' },
  { token: 'line', name: 'Line', use: 'Hairlines, dividers' },
  { token: 'mute', name: 'Mute', use: 'Metadata, punctuation' },
  { token: 'ink-2', name: 'Ink 2', use: 'Secondary text, values' },
  { token: 'ink', name: 'Ink', use: 'Text, primary buttons' },
  { token: 'rx', name: 'Vermilion', use: 'Reactive syntax and live values only' },
  { token: 'trace', name: 'Trace', use: 'Reacting line background' },
  { token: 'demo-on', name: 'Demo on', use: 'Component color inside examples' },
];

export const TYPE: { spec: string; sample: string; cls: string }[] = [
  { spec: 'Display · 600 · −0.05em', sample: 'CSS that reacts.', cls: 'text-[clamp(40px,7vw,96px)] font-semibold tracking-display leading-[0.95]' },
  { spec: 'H1 · 44/1 · −0.035em', sample: 'Getting started', cls: 'text-[44px] font-semibold tracking-h1 leading-none' },
  { spec: 'H2 · 26 · −0.02em', sample: 'Truthy and falsy values', cls: 'text-h2 font-semibold tracking-h2' },
  { spec: 'Lede · 19/1.6', sample: 'when() picks one of two values based on a reactive value.', cls: 'text-lede leading-[1.6] text-ink-2' },
  { spec: 'Body · 17/1.7', sample: 'The browser sees a normal value change, so transitions work the way they always do.', cls: 'text-body leading-[1.7] text-ink-body' },
  { spec: 'Code · Mono 14–15/1.72', sample: 'background: when(--on, #f2542d, #d9d5cf);', cls: 'font-mono text-[15px]' },
  { spec: 'Meta · Mono 12.5', sample: '02 · What it makes possible', cls: 'font-mono text-meta text-mute' },
];

export const SYNTAX: { name: string; kind: TokenKind; sample: string; rule: string; dim?: boolean }[] = [
  { name: 'Selector', kind: 'sel', sample: '.switch::after', rule: 'Ink, 600' },
  { name: 'Property', kind: 'prop', sample: 'background', rule: 'Ink, 400' },
  { name: 'Custom property', kind: 'var', sample: '--on', rule: 'Ink, 500. Native, so not colored' },
  { name: 'Value / native fn', kind: 'val', sample: 'calc(200ms)', rule: 'Ink 2' },
  { name: 'Punctuation', kind: 'pun', sample: '{ } ( ) ; :', rule: 'Mute' },
  { name: 'Comment', kind: 'com', sample: '/* note */', rule: 'Mute, italic' },
  { name: 'Reactive extension', kind: 'rx', sample: 'state() when() on', rule: 'Vermilion, 600, dotted underline' },
  { name: 'Inactive branch', kind: 'val', sample: '#d9d5cf', rule: '30% opacity while the other branch applies', dim: true },
];

export const SPACE: [number, string][] = [[4, 'icon gaps'], [8, 'tight groups'], [12, 'block gaps'], [16, 'card padding'], [24, 'column gaps'], [32, 'group spacing'], [48, 'after headings'], [72, 'between docs sections'], [112, 'marketing sections']];

export const MOTION: [string, string, string][] = [
  ['Feedback', '120ms', 'Hover and press changes on controls.'],
  ['State change', '200ms · (.2,0,0,1)', 'Switch knobs, branch fades, chip fills. Matches the example code.'],
  ['Trace step', '120ms apart', 'Event → state → dependents, lit in that order.'],
  ['Trace fade', '500ms', 'Lines return to rest. Instant on, slow off.'],
  ['Reduced motion', '0ms', 'All transitions off. The trace marks all lines at once and clears without fading.'],
];
