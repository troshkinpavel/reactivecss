// The MCP server: read-only tools, resources and prompts over the packaged Reactive CSS knowledge.
// No tool runs JavaScript from its input, touches the network, spawns processes, reads files outside
// this package or writes files.

import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import { K } from './knowledge.js';
import { validate, analyze, migrate, resolve, SCOPE } from './engine.js';
import { getReference, getExample, apiList } from './reference.js';
import { search } from './search-index.mjs';
import { LIMITS, ToolError, checkCss } from './limits.js';

const KINDS = ['rule', 'mutation', 'modifier', 'function', 'selector', 'declaration', 'expression', 'trigger', 'action'] as const;
const css = z.string().describe(`A stylesheet (untrusted text, up to ${LIMITS.css} characters). It is compiled, never executed.`);
const featureList = z.array(z.string().max(LIMITS.name)).max(LIMITS.list);
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

type Result = { content: { type: 'text'; text: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean };
const ok = (data: Record<string, unknown>): Result => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 1) }], structuredContent: data });
/** Every handler runs through this: a ToolError or any other failure becomes a tool error result, never a crash. */
function run<A>(fn: (a: A) => Promise<Record<string, unknown>> | Record<string, unknown>) {
  return async (a: A): Promise<Result> => {
    try { return ok(await fn(a)); } catch (e) {
      const known = e instanceof ToolError;
      if (!known) process.stderr.write(`[reactivecss-mcp] internal error: ${(e as Error)?.stack ?? e}\n`);
      const error = { code: known ? e.code : 'internal-error', message: known ? e.message : 'The server failed to handle this request. The input was not the cause of a crash; the server keeps running.', ...(known ? e.data : {}) };
      return { content: [{ type: 'text', text: JSON.stringify({ error }) }], structuredContent: { error }, isError: true };
    }
  };
}
const capDiagnostics = <T>(list: T[]) => ({ diagnostics: list.slice(0, LIMITS.diagnostics), ...(list.length > LIMITS.diagnostics ? { truncated: { shown: LIMITS.diagnostics, total: list.length } } : {}) });

/** For tests and embedding: the engine behind the tools. */
export { validate, analyze, migrate, resolve, featureOfKey } from './engine.js';
export { getReference, getExample } from './reference.js';
export { search, terms } from './search-index.mjs';
export { K as knowledge } from './knowledge.js';
export { LIMITS, ToolError } from './limits.js';

export function createServer(): McpServer {
  const k = K();
  const v = k.reactivecss.version;
  const server = new McpServer({ name: 'reactivecss', title: 'Reactive CSS', version: k.version }, {
    capabilities: { tools: {}, resources: {}, prompts: {} },
    instructions: `Reactive CSS ${v} knowledge, offline and read-only. Before writing Reactive CSS, call get_api_reference or get_example for the syntax you need; after writing, call validate_css and fix every error and warning. Prefer native CSS (:hover, :checked, :has(), <details>, popover) when it does the job. The 0.9 syntax is the default; 0.8 on:/text:/attr: is legacy.`,
  });

  server.registerTool('get_api_reference', {
    title: 'Reactive CSS API reference',
    description: `The reference for one Reactive CSS ${v} API: syntax, status, parameters, constraints, examples, related APIs, common mistakes, bundle feature and documentation page. Accepts names and aliases such as ":on", "toggle", "prevent", "state", "--attr-aria-expanded", "content", "focus", "drag", "persist". Returns the 0.9 form by default; legacy 0.8 forms (on:, text:, attr:, trigger and action entries) only when asked by their exact name (e.g. "on:") or with includeLegacy.`,
    inputSchema: z.object({
      name: z.string().min(1).max(LIMITS.name).describe('API name or alias, e.g. ":on", "toggle", "state", "--attr-*", "focus".'),
      kind: z.enum(KINDS).optional().describe('Restrict to one kind.'),
      version: z.string().max(20).optional().describe(`Reactive CSS version to filter by availability (e.g. "0.8.1"). Default ${v}.`),
      includeLegacy: z.boolean().optional().describe('Also list legacy 0.8 entries with the same name.'),
    }),
    annotations: READ_ONLY,
  }, run((a) => getReference(a)));

  server.registerTool('search_docs', {
    title: 'Search Reactive CSS documentation',
    description: 'Ranked, deterministic search (BM25 over a prebuilt local index) of the API registry, the 0.9 mutations and modifiers, the examples, common mistakes, the migration guide, native-first guidance and compatibility notes. Each result points to the tool or resource with the details. No network.',
    inputSchema: z.object({
      query: z.string().min(1).max(LIMITS.query),
      limit: z.number().int().min(1).max(LIMITS.searchResults).optional().describe('Default 5.'),
      types: z.array(z.enum(['api', 'legacy-api', 'not-shipped', 'example', 'mistake', 'migration', 'native-first', 'compatibility', 'bundle-feature'])).max(9).optional(),
    }),
    annotations: READ_ONLY,
  }, run((a) => ({ reactivecssVersion: v, query: a.query, results: search(k.index, a.query, { limit: a.limit ?? 5, types: a.types }) })));

  server.registerTool('get_example', {
    title: 'Reactive CSS example',
    description: `A complete, working example (CSS, HTML, explanation) from the maintained Reactive CSS ${v} catalog, by id or topic: counter, toggle, tabs, form binding, persistence, dom attributes, dom text, click coordinates, drag, focus and blur, state history, random values, and more. With no arguments, lists the examples.`,
    inputSchema: z.object({
      id: z.string().max(LIMITS.name).optional().describe('Example id, e.g. "counter", "tabs", "draggable-card".'),
      topic: z.string().max(LIMITS.name).optional().describe('Topic, e.g. "drag", "persistence", "focus and blur".'),
      include: z.array(z.enum(['css', 'html', 'readme'])).max(3).optional().describe('Parts to return (default all).'),
    }),
    annotations: READ_ONLY,
  }, run((a) => getExample(a)));

  server.registerTool('validate_css', {
    title: 'Validate Reactive CSS',
    description: `Checks a stylesheet against Reactive CSS ${v} with the library's own compiler and reports structured diagnostics (severity, stable code, message, 1-based range, feature, safe fix): invalid syntax, unknown events and functions, unsupported modifiers, wrong placement, removed syntax (:focus(when()), bare prevent, once, drag(x), :blur(when())), unsupported event fields, types a state can never store, mutated states nothing declares, legacy 0.8 syntax, minifier risks, and, with features or profile, syntax missing from that bundle. Ordinary CSS produces no diagnostics.`,
    inputSchema: z.object({
      css,
      features: featureList.optional().describe('The custom bundle that will run (feature ids): reports syntax it lacks.'),
      profile: z.string().max(LIMITS.name).optional().describe('Or a bundle profile: basic, forms, stateful-ui, interactive, dynamic, full.'),
    }),
    annotations: READ_ONLY,
  }, run(async (a) => {
    checkCss(a.css);
    const r = await validate(a.css, { features: a.features, profile: a.profile });
    const count = (s: string) => r.diagnostics.filter((d) => d.severity === s).length;
    return {
      reactivecssVersion: v, valid: count('error') === 0, reactive: r.reactive,
      summary: { errors: count('error'), warnings: count('warning'), info: count('info') },
      ...capDiagnostics(r.diagnostics), ...(r.bundleErrors.length ? { bundleErrors: r.bundleErrors } : {}), scope: SCOPE,
    };
  }));

  server.registerTool('analyze_features', {
    title: 'Analyze Reactive CSS features',
    description: 'Lists the Reactive CSS syntax a stylesheet uses (the compiler\'s usage keys), the bundle features they need with their dependency closure, optional features, and legacy declarations. Same analysis as `reactive-css analyze`, for CSS text.',
    inputSchema: z.object({ css }),
    annotations: READ_ONLY,
  }, run(async (a) => { checkCss(a.css); return { reactivecssVersion: v, ...(await analyze(a.css)), scope: 'Only the CSS given: stylesheets created by scripts, @import-ed sheets and other files are not seen.' }; }));

  server.registerTool('suggest_bundle', {
    title: 'Suggest a Reactive CSS bundle',
    description: 'Resolves the smallest custom bundle for a stylesheet, a feature list or a profile: dependency closure, added features, optional features, the build command, and sizes measured with the library\'s builder when this exact feature set was measured (never estimated). Does not build anything.',
    inputSchema: z.object({
      css: css.optional(),
      features: featureList.optional(),
      profile: z.string().max(LIMITS.name).optional(),
      exclude: featureList.optional(),
    }),
    annotations: READ_ONLY,
  }, run(async (a) => {
    if (!a.css && !a.features?.length && !a.profile) throw new ToolError('no-input', 'Give css, features or profile.');
    let fromCss: Awaited<ReturnType<typeof analyze>> | undefined;
    if (a.css) { checkCss(a.css); fromCss = await analyze(a.css); }
    const r = resolve({ features: [...(fromCss?.used ?? []), ...(a.features ?? [])], profile: a.profile, exclude: a.exclude });
    if (r.errors.length) throw new ToolError('invalid-selection', r.errors.map((e) => e.message).join(' '), { errors: r.errors });
    const all = k.catalog.features.map((f) => f.id);
    const same = (x: string[]) => x.length === r.features.length && x.every((f, i) => f === r.features[i]);
    const measured = k.sizes.measured.find((m) => same(m.features));
    const full = r.features.length === all.length;
    const prebuilt = k.sizes.prebuilt.map(({ file, label, sizes }) => ({ file, label, sizes }));
    return {
      reactivecssVersion: v, features: r.features, requested: r.requested, added: r.added, optionalMissing: r.optionalMissing,
      ...(fromCss ? { fromCss: { used: fromCss.used, legacy: fromCss.legacy, notes: fromCss.notes } } : {}),
      recommendation: full
        ? 'Every feature is needed: use the prebuilt full bundle (dist/reactive-css.min.js) or the compact one (dist/reactive-css.compact.min.js, same runtime, shorter describe() registry).'
        : `A custom bundle with ${r.features.join(', ')}.`,
      build: full ? undefined : `npx reactive-css build --features ${r.features.filter((f) => f !== 'core').join(',') || 'core'} --out public/reactive-css.min.js`,
      sizes: measured ? { ...measured.sizes, measuredAs: measured.label, method: k.sizes.method } : null,
      sizesNote: measured ? `Measured when this server was built, with Reactive CSS ${k.sizes.measuredWith}.` : 'This exact feature set was not measured: build it to know its size (the build manifest reports it). No estimate is given.',
      reference: { prebuilt, note: 'Prebuilt bundles measured when this server was built.' },
      caveat: 'Analysis covers only the CSS given. If scripts create stylesheets at runtime, use the full bundle or include their CSS.',
    };
  }));

  server.registerTool('migrate_css', {
    title: 'Migrate Reactive CSS 0.8 to 0.9',
    description: `Proposes the ${v} form of a stylesheet: on: → :on() rules, text: → content, attr: → --attr-*, bind: on a control that owns its state → state(…, bind(value | checked)), :focus(when()) → focus: when(), bare prevent/stop → prevent()/stop(). Native CSS and comments are kept; cases without a safe rewrite (closest() owners, once, several actions on one state, literal text:) are listed for manual review. Returns the proposed CSS and the diagnostics of the result. Never writes files.`,
    inputSchema: z.object({ css }),
    annotations: READ_ONLY,
  }, run(async (a) => { checkCss(a.css); return { reactivecssVersion: v, ...(await migrate(a.css)) }; }));

  // ---- resources ------------------------------------------------------------------------------

  const json = (uri: string, title: string, description: string, data: () => unknown) =>
    server.registerResource(title.toLowerCase().replace(/\W+/g, '-'), uri, { title, description, mimeType: 'application/json' },
      async (u) => ({ contents: [{ uri: u.href, mimeType: 'application/json', text: JSON.stringify(data(), null, 1) }] }));
  json('reactivecss://version', 'Version and status', 'The Reactive CSS version this server describes, its status, and the server version.', () => ({
    server: { name: k.name, version: k.version, builtAt: k.builtAt }, reactivecss: k.reactivecss,
    supports: '0.9.x', legacySyntax: '0.8 on:, text:, attr: and bind: keep working in 0.9 and are labelled legacy.',
  }));
  json('reactivecss://api', 'API catalog', 'Every Reactive CSS API entry: kind, status, since, syntax; legacy entries name their 0.9 replacement.', () => ({ reactivecssVersion: v, entries: apiList() }));
  json('reactivecss://features', 'Feature catalog', 'Bundle features: what each provides, its syntax, status and dependencies, and the profiles.', () => ({ reactivecssVersion: v, features: k.catalog.features, profiles: k.catalog.profiles }));
  json('reactivecss://dependency-graph', 'Dependency graph', 'Bundle feature dependencies: requires (added automatically) and optional edges.', () => ({
    reactivecssVersion: v, nodes: k.catalog.features.map((f) => ({ id: f.id, title: f.title, status: f.status })),
    edges: k.catalog.features.flatMap((f) => [...f.requires.map((to) => ({ from: f.id, to, type: 'requires' })), ...f.optional.map((to) => ({ from: f.id, to, type: 'optional' }))]),
  }));
  server.registerResource('migration-guide', 'reactivecss://migration/0.9', { title: 'Migration guide 0.8 → 0.9', description: 'The library\'s migration guide (docs/migration-0.9.md).', mimeType: 'text/markdown' },
    async (u) => ({ contents: [{ uri: u.href, mimeType: 'text/markdown', text: k.migrationGuide }] }));
  json('reactivecss://compatibility', 'Compatibility', 'Browser targets and verification status, native CSS interplay, minifiers, CSP, which stylesheets are processed, and native-first guidance.', () => ({ reactivecssVersion: v, ...k.compatibility, nativeFirst: k.nativeFirst }));
  json('reactivecss://experimental', 'Experimental APIs', 'APIs and bundle features whose status is experimental in this version.', () => ({
    reactivecssVersion: v, apis: apiList().filter((e) => e.status === 'experimental' && !e.legacy).map(({ key, name, kind, syntax }) => ({ key, name, kind, syntax })),
    features: k.catalog.features.filter((f) => f.status === 'experimental').map((f) => f.id),
  }));
  json('reactivecss://mistakes', 'Common mistakes', 'Mistakes agents make with Reactive CSS, with the wrong and the corrected CSS and the validate_css codes that catch them.', () => ({ reactivecssVersion: v, mistakes: k.mistakes }));

  // ---- prompts --------------------------------------------------------------------------------

  const say = (text: string) => ({ messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }] });
  server.registerPrompt('create_reactive_component', {
    title: 'Create a Reactive CSS component', description: 'Build an interactive component with Reactive CSS and validate it.',
    argsSchema: z.object({ description: z.string().max(2000).describe('What the component does.') }),
  }, ({ description }) => say(`Build this component with HTML and Reactive CSS ${v}: ${description}

1. Decide what native CSS and HTML already do (:hover, :checked, :has(), <details>, popover, <dialog>, transitions) and use them.
2. Call get_example with the closest topic and get_api_reference for each Reactive CSS API you use. Use the 0.9 syntax only: state(), :on() rules with mutations, --attr-*, content, focus: when().
3. Declare each state on the element that owns it or on a container of all its users. Match types to values (state(0px) for event(client-x)).
4. Call validate_css on the final CSS and fix every error and warning.
5. Call suggest_bundle with the CSS and report the features it needs.
Return the HTML, the CSS and the bundle features.`));
  server.registerPrompt('migrate_to_v09', {
    title: 'Migrate to Reactive CSS 0.9', description: 'Rewrite 0.8 syntax (on:, text:, attr:, bind:) in the 0.9 form.',
    argsSchema: z.object({ css: z.string().max(LIMITS.css).describe('The stylesheet to migrate.') }),
  }, ({ css }) => say(`Migrate this stylesheet to Reactive CSS ${v}.

1. Call migrate_css with it. Do not write files yourself until the user agrees.
2. Explain each change, and resolve every item in "manual" by hand (closest() owners stay on: in 0.9).
3. Call validate_css on the result and fix every error and warning.
4. Point out the semantic differences in the notes (one transaction per event; one mutation per state).

\`\`\`css
${css}
\`\`\``));
  server.registerPrompt('review_reactive_css', {
    title: 'Review Reactive CSS', description: 'Review a stylesheet for correctness, accessibility and native-first choices.',
    argsSchema: z.object({ css: z.string().max(LIMITS.css).describe('The stylesheet to review.') }),
  }, ({ css }) => say(`Review this Reactive CSS ${v} stylesheet.

1. Call validate_css and report every diagnostic with its fix.
2. Check state ownership (who declares each state, who changes and reads it), type compatibility, and that :on() rules contain only mutations.
3. Check accessibility: keyboard paths for click and drag rules, --attr-aria-* for states, focus: when() for focus moves.
4. Say where native CSS or HTML would be simpler (:checked, :has(), <details>, popover).
5. Call analyze_features and say which bundle features it needs.

\`\`\`css
${css}
\`\`\``));
  server.registerPrompt('optimize_reactive_bundle', {
    title: 'Optimize the Reactive CSS bundle', description: 'Find the smallest bundle for a project\'s Reactive CSS.',
    argsSchema: z.object({ css: z.string().max(LIMITS.css).describe('All Reactive stylesheets of the page, concatenated.') }),
  }, ({ css }) => say(`Find the smallest Reactive CSS ${v} bundle for this CSS.

1. Call suggest_bundle with the CSS. Report the features, the ones added as dependencies, and the build command.
2. Report sizes only if suggest_bundle returns measured sizes; never estimate.
3. Say which features are needed only by legacy or avoidable syntax (for example when() only for focus: when() could be focus: var(--x)).
4. Remind that stylesheets created by scripts are not seen by the analysis, and that modifier-only rules need whitespace-only minification.

\`\`\`css
${css}
\`\`\``));
  return server;
}
