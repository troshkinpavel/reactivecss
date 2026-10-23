// Custom bundles, as the library defines them (src/generated/bundles.json, written by
// scripts/sync-runtime.mjs from ../dist/catalog.json, ../package.json and the library's measured
// size report). The resolver below is a port of `resolve()` in ../tools/bundle.mjs, which imports
// esbuild and cannot run in a page; tests/unit/bundles.test.ts checks it against the library's
// own resolver for every possible selection.
import { DEMO_ORDER } from '~/lib/content/demo-order';
import data from '~/generated/bundles.json';

export interface CatalogFeature {
  id: string;
  title: string;
  category: string;
  entry: string | null;
  modules: string[];
  requires: string[];
  optional: string[];
  status: 'stable' | 'experimental';
  provides: string[];
  syntax: string[];
}
export interface MeasuredBundle { name: string; features: string[] | null; minified: number; gzip: number; brotli: number }
export interface SelectionError { code: 'unknown-feature' | 'unknown-profile'; message: string; feature?: string }
export interface Resolved {
  /** Every included feature, core first, in catalog order (as the CLI orders them). */
  features: string[];
  /** Added because a selected feature requires it. */
  added: { id: string; requiredBy: string }[];
  /** Useful with a selected feature, never added automatically. */
  optionalMissing: { id: string; usefulFor: string }[];
  errors: SelectionError[];
}

export const PACKAGE = data.package;
export const CATALOG = data.catalog.features as CatalogFeature[];
export const PROFILES = data.catalog.profiles as Record<string, string[]>;
export const SIZES = { ...data.sizes, measured: data.sizes.measured as MeasuredBundle[] };
export const DEMOS = data.demos;
/** API registry entry (`function:live`) → the feature that provides it (null: not shipped). */
export const API_FEATURE = data.apiFeature as Record<string, string | null>;

const BY_ID = new Map(CATALOG.map((f) => [f.id, f]));
export const featureById = (id: string) => BY_ID.get(id);

/** Which feature provides a usage key (`fn:live`, `trigger:click`…); `trigger:*` covers every trigger. */
export function featureOfKey(key: string): string | undefined {
  // As in ../tools/bundle.mjs (0.9): exact keys first, then wildcards, so a wildcard of an earlier feature never wins over another feature's exact key.
  for (const f of CATALOG) if (f.provides.includes(key)) return f.id;
  for (const f of CATALOG) for (const p of f.provides) if (p.endsWith(':*') && key.startsWith(p.slice(0, -1))) return f.id;
  return undefined;
}

/** Selected features plus everything they require, in catalog order. */
export function resolve({ features = [], profile }: { features?: string[]; profile?: string }): Resolved {
  const errors: SelectionError[] = [];
  let requested = features;
  if (profile) {
    if (!PROFILES[profile]) errors.push({ code: 'unknown-profile', message: `Unknown profile "${profile}".` });
    else requested = [...PROFILES[profile]!, ...requested];
  }
  for (const id of new Set(requested)) if (!BY_ID.has(id)) errors.push({ code: 'unknown-feature', feature: id, message: `Unknown feature "${id}".` });
  const included = new Set(['core']);
  const added: Resolved['added'] = [];
  const visit = (id: string, by?: string) => {
    if (included.has(id) || !BY_ID.has(id)) return;
    included.add(id);
    if (by) added.push({ id, requiredBy: by });
    for (const r of BY_ID.get(id)!.requires) visit(r, id);
  };
  for (const id of new Set(requested)) visit(id);
  const list = CATALOG.map((f) => f.id).filter((id) => included.has(id));
  const optionalMissing = list.flatMap((id) => BY_ID.get(id)!.optional.filter((o) => !included.has(o)).map((o) => ({ id: o, usefulFor: id })));
  return { features: list, added, optionalMissing, errors };
}

/** The profile whose features are exactly this selection, if any. */
export function profileOf(selected: string[]): string | undefined {
  // core is implied: the full profile lists it, a selection never does.
  const key = (list: string[]) => [...new Set(list)].filter((f) => f !== 'core').sort().join();
  return Object.keys(PROFILES).find((p) => key(PROFILES[p]!) === key(selected));
}

/**
 * The measured bundle with exactly these included features, if the library measured one (core,
 * the profiles). Any other combination has no known size until it is built: sizes of features
 * are not additive, so none is estimated.
 */
export function measuredFor(included: string[]): MeasuredBundle | undefined {
  const key = included.join();
  return SIZES.measured.find((m) => m.features?.join() === key);
}

/** The prebuilt distribution bundles, as measured in the same report. */
export const STANDARD = SIZES.measured.find((m) => m.name === 'dist full')!;
export const COMPACT = SIZES.measured.find((m) => m.name === 'dist compact')!;

/** Library demos whose stylesheets need only these features (from the library's analyzer). */
/** Published demos (pages on the site) that need only these features. */
export const demosFor = (included: string[]) => DEMOS.filter((d) => d.complete && (DEMO_ORDER as readonly string[]).includes(d.name) && d.features.every((f) => included.includes(f)));
