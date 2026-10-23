// Native CSS vs Reactive CSS comparisons (Simplify CSS). Content lives in
// src/content/comparisons/<id>/: meta.json plus the native source files. The Reactive CSS
// side is a runnable example (src/examples/<meta.example>/style.css).
import type { FeatureKey, Lang } from '~/lib/code/types';
import { registryFeature } from './reference';

export type Relation = 'approx' | 'overlap' | 'only' | 'same';
export const RELATION_LABEL: Record<Relation, string> = {
  same: 'Identical behavior', approx: 'Approximately equivalent', overlap: 'Overlapping, not interchangeable', only: 'Reactive CSS only',
};

export interface ComparisonMeta {
  title: string; relation: Relation; features: FeatureKey[]; nativeNote: string; reactiveNote: string; example: string;
  native: { file: string; lang: Lang }[]; simpler: string; differences: string[]; links: [string, string][];
}
export interface Comparison extends ComparisonMeta { id: string; status: 'stable' | 'experimental'; nativeFiles: { label: string; lang: Lang; code: string }[] }

const metas = import.meta.glob<ComparisonMeta>('/src/content/comparisons/*/meta.json', { import: 'default', eager: true });
const sources = import.meta.glob<string>('/src/content/comparisons/*/*.{css,js,html}', { query: '?raw', import: 'default', eager: true });

export function getComparison(id: string): Comparison {
  const meta = metas[`/src/content/comparisons/${id}/meta.json`];
  if (!meta) throw new Error(`Unknown comparison "${id}"`);
  const experimental = meta.features.some((f) => registryFeature(f)?.status === 'experimental');
  return {
    ...meta, id, status: experimental ? 'experimental' : 'stable',
    nativeFiles: meta.native.map((n) => ({ label: n.file, lang: n.lang, code: sources[`/src/content/comparisons/${id}/${n.file}`] ?? '' })),
  };
}
export const comparisonIds = Object.keys(metas).map((k) => k.split('/').at(-2)!);
