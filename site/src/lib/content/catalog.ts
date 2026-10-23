// The one Examples catalog. Every entry the gallery, the detail pages and search show comes from
// here, built from these files:
//   api         src/catalog/api/<name>/    small examples in the 0.9 syntax, one capability each (written for
//               the site in the library's API-example format), plus two library examples (examples/api/,
//               synced by scripts/sync-runtime.mjs) whose syntax is unchanged in 0.9
//   interfaces  examples/<name>/           complete interfaces from the library (DEMO_ORDER 1–12)
//   advanced    site workspaces            Control Center and its Deep Dive
//   lab         examples/<name>/           browser and runtime validation cases (DEMO_ORDER 13–18)

import type { ExampleDefinition } from '~/examples/manifest';
import { highlightCss } from '~/lib/code/css';
import registry from '~/generated/registry.json';
import apiCss from '~/generated/api-examples/api.css?raw';
import { DEMO_ORDER, getDemo, readme, splitStyle } from './demos';
import { DEEP, FEATURED } from './advanced';
import { GLOSSARY } from './reference';

export type Category = 'api' | 'interfaces' | 'advanced' | 'lab';
export const CATEGORIES: { id: Category; name: string; blurb: string; text: string }[] = [
  { id: 'api', name: 'API examples', blurb: 'One capability, one visible result.', text: 'Small examples in the 0.9 syntax, each showing one Reactive CSS capability with a few lines of CSS. Use the preview, then read the code.' },
  { id: 'interfaces', name: 'Interfaces', blurb: 'Complete components that combine several APIs.', text: 'Whole components in the 0.9 syntax: tabs, an accordion, a menu, a form and a wizard. Each lists what native HTML already does and what it cannot.' },
  { id: 'advanced', name: 'Advanced', blurb: 'Larger examples you can inspect.', text: 'A settings panel with many states, bindings and conditions. The Deep Dive follows one interaction from event to result through the runtime.' },
  { id: 'lab', name: 'Test lab', blurb: 'Validation cases and 0.8 compatibility.', text: 'The library’s validation cases and demos: focus, keyboard, attributes, nested ownership, forms, carts and quizzes. They are written in the 0.8 syntax, so they also show that 0.9.0 still runs it. Useful for engineering, not as a starting point.' },
];

export interface CatalogEntry {
  id: string;
  title: string;
  description: string;
  category: Category;
  href: string;
  /** The capability the example is about, as API labels (`state()`, `bind:`…). */
  primary: string[];
  /** Every Reactive CSS feature its stylesheet uses. */
  features: string[];
  /** True when a primary API is experimental in the registry. */
  experimental: boolean;
  /** Runs live: in the gallery card (API examples) and on the detail page. */
  example?: ExampleDefinition;
  /** Only the interactive part, for the gallery card. */
  card?: { css: string; base: string; html: string };
  /** README sections by title. */
  notes: Record<string, string>;
  /** A short technical line for cards that have no live preview. */
  tech?: string;
  /** Library demo written with the 0.8 declarations (`on:`, `bind:`, `text:`, `attr:`), which 0.9 still runs. */
  legacy?: boolean;
}

const LABEL_TO_KEY = new Map(Object.entries(GLOSSARY).map(([k, g]) => [g.label, k]));
const status = new Map(registry.features.map((f) => [`${f.kind}:${f.name}`, f.status]));
const featuresOf = (css: string) => [...new Set(highlightCss(css).flat().flatMap((t) => (t.k === 'rx' && t.feature && GLOSSARY[t.feature] ? [t.feature] : [])))];
// The glossary's kind carries the reference's status, including its documented `readiness` overrides.
const isExperimental = (labels: string[]) => labels.some((l) => GLOSSARY[LABEL_TO_KEY.get(l) ?? '']?.kind.includes('experimental') ?? status.get(LABEL_TO_KEY.get(l) ?? '') === 'experimental');
/** Reference page of an API label, if it has one. */
export const docsHref = (label: string) => GLOSSARY[LABEL_TO_KEY.get(label) ?? '']?.href;
export const featureLabel = (key: string) => GLOSSARY[key]?.label ?? key;

/**
 * "How it works" rows, as in the design: each primary API with the lines of the shown
 * stylesheet that use it (1-based, from the highlighter's feature tokens) and its reference summary.
 */
export function howRows(e: CatalogEntry): { label: string; href?: string; summary: string; lines: number[] }[] {
  const lines = highlightCss(e.example?.files.css ?? '');
  return e.primary.map((label) => {
    const key = LABEL_TO_KEY.get(label) ?? '';
    const at = lines.flatMap((l, i) => (l.some((t) => t.feature === key) ? [i + 1] : []));
    return { label, href: GLOSSARY[key]?.href, summary: GLOSSARY[key]?.summary ?? '', lines: at };
  });
}

const apiFiles = import.meta.glob<string>('../../generated/api-examples/*/{index.html,style.css,README.md}', { query: '?raw', import: 'default', eager: true });
// The site's own examples in the 0.9 syntax: src/catalog/<category>/<id>/ (api, interfaces).
const siteFiles = import.meta.glob<string>('../../catalog/*/*/{index.html,style.css,README.md}', { query: '?raw', import: 'default', eager: true });
/** Library API examples shown as they are: nothing in them changed in 0.9. */
const LIBRARY_API = new Set(['live-values', 'mouse-tracker']);
/** The API examples, in catalog order. */
export const API_ORDER = ['counter', 'state-toggle', 'form-mirror', 'persistent-preference', 'click-coordinates', 'draggable-card', 'attribute-sync', 'focus-blur', 'live-values', 'mouse-tracker', 'element-size', 'conditional-state', 'state-history', 'random-colors', 'context-menu'];
/** The preview shows the interaction only: the page's heading, intro and file links are the site's to show. */
const CARD = 'body { padding: 16px; background: transparent; } .demo { border: 0; background: transparent; padding: 0; width: 100%; }';
// The detail stage around the frame gives the spacing; the frame shows the panel behind it.
const DETAIL = 'body { padding: 4px; background: transparent; } main { padding: 0; }';
const textOf = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** Interfaces: whole components in the 0.9 syntax, in gallery order. */
export const INTERFACE_ORDER = ['tabs', 'accordion', 'dropdown', 'theme-switcher', 'signup-form', 'step-wizard', 'task-list', 'pricing-toggle'];

function siteEntry(id: string, category: 'api' | 'interfaces' = 'api'): CatalogEntry | undefined {
  const lib = LIBRARY_API.has(id);
  const f = (n: string) => (lib ? apiFiles[`../../generated/api-examples/${id}/${n}`] : siteFiles[`../../catalog/${category}/${id}/${n}`]);
  const html = f('index.html'), css = f('style.css'), md = f('README.md');
  if (!html || !css || !md) return undefined;
  const main = html.match(/<main>([\s\S]*)<\/main>/)?.[1] ?? '';
  const kicker = main.match(/<p class="kicker">([\s\S]*?)<\/p>/)?.[1] ?? '';
  const title = textOf(main.match(/<h1>([\s\S]*?)<\/h1>/)?.[1] ?? id);
  const description = textOf(main.match(/<p class="lede">([\s\S]*?)<\/p>/)?.[1] ?? '');
  const primary = [...kicker.matchAll(/<code>([^<]+)<\/code>/g)].map((m) => m[1]!);
  const body = main.replace(/<p class="(kicker|lede|files)">[\s\S]*?<\/p>|<h1>[\s\S]*?<\/h1>/g, '').trim();
  const section = body.match(/<section class="demo[\s\S]*<\/section>/)?.[0] ?? body;
  const { base, behavior } = splitStyle(css);
  const order = (category === 'api' ? API_ORDER : INTERFACE_ORDER).indexOf(id) + 1;
  return {
    id, title, description, category, href: `/examples/${id}/`, primary, features: featuresOf(behavior), experimental: isExperimental(primary),
    example: { id, title, description, stem: 'style', level: 'basic', a11y: lib ? 'library API example' : category === 'api' ? 'API example' : 'interface', label: lib ? `examples/api/${id}` : id, files: { css: behavior, base: `${apiCss}\n${base}\n${DETAIL}`, html: `<main>${body}</main>`, js: null } },
    card: { css: behavior, base: `${apiCss}\n${base}\n${CARD}`, html: section },
    notes: { ...readme(md).sections, order: String(order) },
  };
}

const API_ENTRIES = API_ORDER.map((id) => siteEntry(id)).filter((e): e is CatalogEntry => !!e);
const INTERFACE_ENTRIES = INTERFACE_ORDER.map((id) => siteEntry(id, 'interfaces')).filter((e): e is CatalogEntry => !!e);
/** Where an entry's files are, for the detail page's source note. */
export const sourceOf = (id: string) => (LIBRARY_API.has(id) ? `the library's examples/api/${id}/` : API_ORDER.includes(id) ? `site/src/catalog/api/${id}/` : INTERFACE_ORDER.includes(id) ? `site/src/catalog/interfaces/${id}/` : `the library's examples/${id}/`);

const demoEntry = (id: string, category: Category): CatalogEntry | undefined => {
  const d = getDemo(id);
  if (!d) return undefined;
  const features = featuresOf(d.files.css);
  // The README's "Reactive CSS features" table names what the demo is about, in its own order.
  const table = (d.notes.sections['Reactive CSS features'] ?? '').split('\n').filter((l) => l.startsWith('|'));
  const named = [...new Set(table.flatMap((l) => [...(l.split('|')[1] ?? '').matchAll(/`([^`]+)`/g)].map((m) => m[1]!)))].filter((l) => LABEL_TO_KEY.has(l) && l !== 'state()'); // every demo uses state()
  return { id, title: d.title, description: d.description, category, href: `/examples/${id}/`, primary: (named.length ? named : features.map(featureLabel)).slice(0, 4), features, experimental: false, legacy: /(^|[;{\s])(on|bind|text|attr):\s/m.test(d.files.css), example: d, notes: d.notes.sections, tech: `${features.length} Reactive CSS features` };
};

const ADVANCED: CatalogEntry[] = [
  { id: 'control-center', title: FEATURED.title, description: FEATURED.summary, category: 'advanced', href: FEATURED.href, primary: FEATURED.uses, features: [], experimental: false, notes: {}, tech: 'Workspace: source, inspector, state and trace' },
  { id: 'control-center-deep-dive', title: DEEP.title, description: DEEP.summary, category: 'advanced', href: DEEP.href, primary: DEEP.uses, features: [], experimental: false, notes: {}, tech: 'Event → Action → State → Condition → Result' },
];

export const CATALOG: CatalogEntry[] = [
  ...API_ENTRIES,
  ...INTERFACE_ENTRIES,
  ...ADVANCED,
  // The library's demos and validation cases, written in the 0.8 syntax that 0.9.0 still runs.
  ...DEMO_ORDER.slice(12).map((id) => demoEntry(id, 'lab')),
  ...DEMO_ORDER.slice(0, 12).map((id) => demoEntry(id, 'lab')),
].filter((e): e is CatalogEntry => !!e);

export const catalogEntry = (id: string) => CATALOG.find((e) => e.id === id);
export const inCategory = (c: Category) => CATALOG.filter((e) => e.category === c);

/**
 * Column spans for a gallery group in a four-column grid, as in the design: rows of three where
 * one card spans two columns, first in one row and last in the next. A last row of one card
 * joins the row before as four plain cards; a last row of two spans two each.
 * shortcut: the "All" view shows the first three of a group with these spans, which only differs
 * for a group of exactly four; compute a second set for that view if such a group appears.
 */
export function gallerySpans(n: number): (1 | 2)[] {
  const s = Array.from({ length: n }, (_, i): 1 | 2 => (i % 6 === 0 || i % 6 === 5 ? 2 : 1));
  if (n === 1) s[0] = 2;
  else if (n % 3 === 1) s.fill(1, n - 4);
  else if (n % 3 === 2) s.fill(2, n - 2);
  return s;
}
/** The next entries in the same category, wrapping around. */
export function neighbours(e: CatalogEntry, n = 3): CatalogEntry[] {
  const list = inCategory(e.category);
  const i = list.indexOf(e);
  return Array.from({ length: Math.min(n, list.length - 1) }, (_, k) => list[(i + 1 + k) % list.length]!);
}
export const position = (e: CatalogEntry) => { const list = inCategory(e.category); const i = list.indexOf(e); return { i, n: list.length, prev: list[(i - 1 + list.length) % list.length]!, next: list[(i + 1) % list.length]! }; };
