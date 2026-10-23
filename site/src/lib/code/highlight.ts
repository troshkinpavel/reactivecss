// One entry point for every code block: CSS goes through the Reactive CSS highlighter, every
// other language through Shiki. Shiki runs with the JavaScript regex engine and only the
// grammars below, so the same code works at build time (Astro) and in Storybook.

import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { highlightCss } from './css';
import type { Lang, Line, TokenKind } from './types';

// Each kind gets a sentinel color in this theme, so a Shiki token's color names its kind.
const KIND_COLORS: Record<string, TokenKind> = {};
const color = (k: TokenKind, n: number) => { const c = '#0000' + n.toString(16).padStart(2, '0'); KIND_COLORS[c] = k; return c; };
const theme = {
  name: 'reactive-css-kinds',
  type: 'light' as const,
  fg: color('id', 1),
  bg: '#ffffff',
  settings: [
    { settings: { foreground: color('id', 1) } },
    { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: color('com', 2) } },
    { scope: ['string', 'punctuation.definition.string', 'string.quoted', 'string.template'], settings: { foreground: color('str', 3) } },
    { scope: ['keyword', 'storage', 'constant.language', 'variable.language'], settings: { foreground: color('kw', 4) } },
    { scope: ['entity.name.function', 'support.function', 'meta.function-call entity.name.function', 'entity.name.command'], settings: { foreground: color('fn', 5) } },
    { scope: ['entity.name.tag', 'punctuation.definition.tag'], settings: { foreground: color('tag', 6) } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: color('attr', 7) } },
    { scope: ['punctuation', 'meta.brace', 'keyword.operator'], settings: { foreground: color('pun', 8) } },
    { scope: ['constant.numeric', 'constant.other'], settings: { foreground: color('val', 9) } },
    { scope: ['support.type.property-name'], settings: { foreground: color('prop', 10) } },
  ],
};

const GRAMMARS = {
  html: () => import('shiki/langs/html.mjs'),
  js: () => import('shiki/langs/javascript.mjs'),
  ts: () => import('shiki/langs/typescript.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  sh: () => import('shiki/langs/shellscript.mjs'),
};
const SHIKI_LANG = { html: 'html', js: 'javascript', ts: 'typescript', json: 'json', sh: 'shellscript' } as const;

let highlighter: Promise<HighlighterCore> | undefined;
function getHighlighter() {
  highlighter ??= createHighlighterCore({
    themes: [theme],
    langs: Object.values(GRAMMARS).map((load) => load()),
    engine: createJavaScriptRegexEngine(),
  });
  return highlighter;
}

/** Tokenized lines for a code block. CSS is synchronous; see highlightCss. */
export async function highlight(code: string, lang: Lang): Promise<Line[]> {
  if (lang === 'css') return highlightCss(code);
  const h = await getHighlighter();
  const { tokens } = h.codeToTokens(code, { lang: SHIKI_LANG[lang], theme: theme.name });
  return tokens.map((line) =>
    line.map((tok) => ({ t: tok.content, k: /^\s+$/.test(tok.content) ? 'ws' : KIND_COLORS[(tok.color ?? '').toLowerCase()] ?? 'id', start: tok.offset })),
  );
}

export { highlightCss };
