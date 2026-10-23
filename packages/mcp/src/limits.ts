// Input and output bounds. User CSS is untrusted: it is only tokenized and compiled, never run.

export const LIMITS = {
  /** Largest stylesheet accepted, in UTF-16 code units (about 256 KB of ASCII CSS). */
  css: 262_144,
  query: 300,
  name: 120,
  list: 32,
  /** Diagnostics returned per call; the rest are counted. */
  diagnostics: 100,
  searchResults: 10,
  /** Deepest nesting of {, ( and [ accepted: the library's compiler recurses per level. */
  depth: 128,
};

/** A user-facing failure: returned as a tool result with isError, never thrown to the transport. */
export class ToolError extends Error {
  constructor(public code: string, message: string, public data?: Record<string, unknown>) { super(message); }
}

export function checkCss(css: string) {
  if (css.length > LIMITS.css) throw new ToolError('input-too-large', `The CSS is ${css.length} characters; the limit is ${LIMITS.css}. Split it into smaller stylesheets.`, { limit: LIMITS.css, length: css.length });
  // Bracket depth outside comments and strings (approximate on purpose: it only has to bound recursion).
  let depth = 0, max = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') { const e = css.indexOf('*/', i + 2); if (e < 0) break; i = e + 1; }
    else if (c === '"' || c === "'") { const e = css.indexOf(c, i + 1); if (e < 0) break; i = e; }
    else if (c === '{' || c === '(' || c === '[') { if (++depth > max) max = depth; }
    else if ((c === '}' || c === ')' || c === ']') && depth > 0) depth--;
  }
  if (max > LIMITS.depth) throw new ToolError('input-too-complex', `The CSS nests ${max} levels of brackets; the limit is ${LIMITS.depth}.`, { limit: LIMITS.depth });
}
