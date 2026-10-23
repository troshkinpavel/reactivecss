// Reactive CSS vocabulary, taken from the library's own registry (describe(), snapshotted by
// scripts/sync-runtime.mjs). Planned and rejected entries never highlight as reactive syntax.
import registry from '~/generated/registry.json';
import type { FeatureKey } from './types';

type Kind = 'function' | 'selector' | 'declaration' | 'action' | 'trigger' | 'expression';
const shipped = (kind: Kind) =>
  new Set(registry.features.filter((f) => f.kind === kind && (f.status === 'stable' || f.status === 'experimental')).map((f) => f.name));

export const RX = {
  functions: shipped('function'),
  selectors: shipped('selector'),
  declarations: shipped('declaration'),
  actions: shipped('action'),
  triggers: shipped('trigger'),
  /** attr(), pick(), split(): only inside state() and set(). */
  expressions: shipped('expression'),
};

/** Display name, as written in prose: `state()`, `:when()`, `:just-checked`, `on:`. */
export function featureLabel(key: FeatureKey): string {
  const [kind, name] = key.split(':') as [string, string];
  if (kind === 'rule') return name === 'on' ? ':on()' : name === 'drag' ? ':on(drag)' : ':' + name + '(when())';
  if (kind === 'declaration') return name.endsWith(')') || name.startsWith('--') || name === 'content' ? name : name === 'persist' ? 'persist()' : name + ':';
  if (kind === 'selector') return name.startsWith('just-') || name === 'blur' ? ':' + name : ':' + name + '()';
  return name + '()';
}

const names = [...RX.functions, ...RX.actions, ...RX.triggers, 'closest'].map((n) => n.replace(/[-]/g, '\\-')).join('|');
// 0.9 forms too: :on(), event(), persist(), bind() and the --attr-* namespace.
const RX_INLINE = new RegExp(`^(?:(?:${names}|event|persist|bind)\\(|:on\\(|--attr-|:(?:${[...RX.selectors].join('|')})\\b|(?:${[...RX.declarations].join('|')}):)`);

/** Whether inline code such as `state()`, `:when()` or `on:` is Reactive CSS syntax. */
export const isReactiveSnippet = (code: string) => RX_INLINE.test(code.trim());
