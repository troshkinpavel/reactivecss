declare const __DEV__: boolean;
export const dev = typeof __DEV__ === 'undefined' || __DEV__;

/**
 * Development builds only: sizes of internal queues and element-keyed collections, read by
 * stats().internal for leak and long-running tests. Not a stable API; empty in production.
 */
export const probes: Record<string, () => number> = {};


/**
 * Marks a message built outside warn()/note()/new Error(), so production builds replace it by its
 * diagnostic code like the others (tools/diagnostics.mjs). Identity at runtime.
 */
export const msg = (s: string) => s;

/** Every distinct problem found so far, in order. Exposed as ReactiveCSS.diagnostics. */
export const diagnostics: string[] = [];
if (dev) probes.diagnostics = () => diagnostics.length;

let summarized = false;
let source = '';

/** Runs fn with warnings prefixed by the stylesheet they come from. */
export function withSource<T>(label: string, fn: () => T): T {
  const prev = source;
  source = label;
  try { return fn(); } finally { source = prev; }
}

export function warn(message: string): void {
  if (source) message = `${source}: ${message}`;
  if (diagnostics.includes(message)) return;
  diagnostics.push(message);
  if (dev) console.warn('[reactive-css] ' + message);
  // Production build: one summary line instead of one line per problem.
  else if (!summarized) {
    summarized = true;
    setTimeout(() => console.warn(`[reactive-css] ${diagnostics.length} issue(s). See ReactiveCSS.diagnostics: codes such as RCSS-P001 are explained by \`npx -p @reactivecss/core reactive-css explain\` (dist/diagnostics.json), or load reactive-css.js for full messages.`));
  }
}

/** Recorded like a warning, but only logged at info level in development builds. */
export function note(message: string): void {
  if (diagnostics.includes(message)) return;
  diagnostics.push(message);
  if (dev) console.info('[reactive-css] ' + message);
}
