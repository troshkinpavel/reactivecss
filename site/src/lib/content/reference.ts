// API reference data: human-written entries (src/content/api/entries.json) joined with the
// library's feature registry, which is the source of truth for status, version and syntax.
// Usable from Astro pages, React islands and Storybook alike (plain imports, no Astro APIs).

import entries from '~/content/api/entries.json';
import registry from '~/generated/registry.json';
import { featureLabel } from '~/lib/code/vocabulary';
import type { FeatureKey } from '~/lib/code/types';

export interface ApiParam { name: string; type: string; required: string; description: string }
export interface ApiEntry {
  id: string;
  name: string;
  category: string;
  features: FeatureKey[];
  summary: string;
  signature: string;
  params: ApiParam[];
  returns: string;
  example: { id: string; size: 'compact' | 'standard' | 'expanded' } | { label: string; code: string };
  behavior: string[];
  contexts: string[];
  limits: string[];
  related: string[];
  /** Set for features the registry marks as removed: why, and what to use instead. */
  removal?: string;
  /** Version for a feature the registry does not list (the closest() scope), from the CHANGELOG. */
  since?: string;
  /** Correct and incorrect usage; incorrect ones may name the diagnostic they produce. */
  usage?: { title: string; verdict: 'correct' | 'incorrect'; label: string; code: string; note: string; diagnostic?: string }[];
  /** Library demos that use the feature. */
  demos?: string[];
  /**
   * Release recommendation that differs from the registry: 'stable' for a feature the runtime's
   * describe() still marks experimental but the 0.9.0 hardening report (§H) recommends as stable.
   * The page states both; entryStatus() then reports it as not experimental.
   */
  readiness?: 'stable';
}

export type RegistryFeature = (typeof registry.features)[number];

export const API: ApiEntry[] = entries as ApiEntry[];
export const CATEGORIES = ['State', 'Events', 'Actions', 'DOM Integration', 'Conditions', 'History', 'Selectors', 'Values', 'Geometry & motion', 'Expressions'] as const;
/** 0.8 syntax that 0.9 still runs: pages kept for old links, listed only on the migration page. */
export const LEGACY = 'Legacy';
export const isLegacy = (e: ApiEntry) => e.category === LEGACY;
export const LIBRARY_VERSION = registry.version;

export function registryFeature(key: FeatureKey): RegistryFeature | undefined {
  const [kind, name] = key.split(':');
  return registry.features.find((f) => f.kind === kind && f.name === name);
}

export function apiHref(id: string) { return `/docs/reference/${id}/`; }

/** Status shown for an entry: from the registry, never from prose, except an explicit `readiness` override. */
export function entryStatus(e: ApiEntry): { since: string | undefined; experimental: boolean; removedIn: string | undefined } {
  const f = e.features.map(registryFeature).find(Boolean);
  const removed = f?.status === 'removed' ? ((f as { removedIn?: string }).removedIn ?? '?') : undefined;
  return { since: f?.since ?? e.since, experimental: e.readiness !== 'stable' && e.features.some((k) => registryFeature(k)?.status === 'experimental'), removedIn: removed };
}

/** Entries for features the library still ships (stable or experimental). */
export const SHIPPED_API = API.filter((e) => !entryStatus(e).removedIn);

export const KIND_LABEL: Record<string, string> = { function: 'Function', selector: 'Selector', declaration: 'Declaration', action: 'Action', trigger: 'Trigger', expression: 'Expression', scope: 'Scope', rule: 'Rule' };
export const entryKind = (e: ApiEntry) => KIND_LABEL[e.features[0]!.split(':')[0]!]!;

export type { GlossaryItem } from './glossary';
import type { GlossaryItem } from './glossary';

/** Strips the inline Markdown used in entries, for one-line explanations. */
export const plain = (md: string) => md.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1');

/** Explanation for each reactive token, keyed by feature. */
export const GLOSSARY: Record<string, GlossaryItem> = Object.fromEntries(
  API.flatMap((e) => e.features.map((key) => {
    const exp = e.readiness !== 'stable' && registryFeature(key)?.status === 'experimental';
    return [key, { label: featureLabel(key), kind: KIND_LABEL[key.split(':')[0]!]! + (exp ? ' · experimental' : ''), summary: plain(e.summary), href: apiHref(e.id) }];
  })),
);
