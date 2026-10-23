import { defineCollection, z } from 'astro:content';
import { file, glob } from 'astro/loaders';

/** Documentation pages: one MDX file per page, URL /docs/<id>/. */
const docs = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** Sidebar label when it differs from the title. */
    navLabel: z.string().optional(),
    group: z.enum(['Start', 'Concepts', 'Reference', 'Examples', 'Integrations', 'Project']),
    type: z.enum(['Guide', 'Tutorial', 'Concept', 'Reference', 'Index', 'Example', 'Project']),
    /** Position in the sidebar and in previous / next order. */
    order: z.number().int(),
    status: z.enum(['experimental', 'new']).optional(),
    /** API reference ids used by an example page, shown on the examples index. */
    uses: z.array(z.string()).optional(),
    /** Overrides for search engines and social cards. */
    seo: z.object({ title: z.string().optional(), description: z.string().optional() }).optional(),
  }),
});

/** API reference entries. Status, version and syntax come from the feature registry. */
const api = defineCollection({
  loader: file('./src/content/api/entries.json'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    category: z.enum(['State', 'Events', 'Actions', 'DOM Integration', 'Conditions', 'History', 'Selectors', 'Values', 'Geometry & motion', 'Expressions', 'Legacy']),
    features: z.array(z.string().regex(/^(function|selector|declaration|action|trigger|expression|scope|rule):[\w()*-]+$/)).min(1),
    summary: z.string(),
    signature: z.string(),
    params: z.array(z.object({ name: z.string(), type: z.string(), required: z.string(), description: z.string() })),
    returns: z.string(),
    example: z.union([
      z.object({ id: z.string(), size: z.enum(['compact', 'standard', 'expanded']) }),
      z.object({ label: z.string(), code: z.string() }),
    ]),
    behavior: z.array(z.string()),
    contexts: z.array(z.string()),
    limits: z.array(z.string()),
    related: z.array(z.string()),
    removal: z.string().optional(),
    /** Version for a feature the registry does not list (the closest() scope), taken from the CHANGELOG. */
    since: z.string().optional(),
    /** Worked examples beyond the main one: correct and incorrect usage. Each must compile (tests/unit/compile.test.ts). */
    usage: z.array(z.object({ title: z.string(), verdict: z.enum(['correct', 'incorrect']), label: z.string(), code: z.string(), note: z.string(), diagnostic: z.string().optional() })).optional(),
    /** Library demos that use the feature (src/generated/demos/<id>). */
    demos: z.array(z.string()).optional(),
    /** 'stable': the 0.9.0 hardening report recommends it as stable while describe() still says experimental. */
    readiness: z.literal('stable').optional(),
  }),
});

/** The library's own CHANGELOG.md, rendered on /docs/changelog/. */
const changelog = defineCollection({ loader: glob({ pattern: 'CHANGELOG.md', base: '..' }) });

export const collections = { docs, api, changelog };
