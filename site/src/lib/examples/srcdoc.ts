// Builds the document that runs inside a preview iframe.
//
// Isolation: the iframe gets sandbox="allow-scripts allow-forms" and no allow-same-origin, so
// it has an opaque origin with no access to this site's DOM, cookies or storage. The CSP below
// only allows the two scripts carrying this document's nonce: the bridge, and either the Reactive
// CSS bundle or, for a vanilla comparison, the site's own plain-JavaScript file. Example HTML
// cannot run its own scripts or event handlers, cannot fetch, and forms
// cannot navigate.

import type { Analysis } from './analyze';
import { querySelectorFor } from './analyze';
import type { WatchSpec } from './protocol';
import type { PreviewScripts } from './scripts';

export interface PreviewSources {
  /** The Reactive CSS shown to the reader. */
  css: string;
  /** Presentation only: layout and look of the preview, no reactive syntax. */
  base: string;
  /** Body markup. */
  html: string;
  /**
   * Plain JavaScript to run instead of the Reactive CSS runtime (comparisons). The runtime is then
   * not loaded at all, so the page shows what the script alone does.
   */
  script?: string;
}

export function watchSpec(a: Analysis): WatchSpec {
  return {
    props: [...a.states, ...a.derived].map((s) => ({ name: s.name, selector: querySelectorFor(s.selector) })),
    triggers: a.triggers.map((t) => ({ line: t.line, selector: querySelectorFor(t.selector), events: t.events })),
  };
}

const FONTS = 'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Red+Hat+Mono:wght@400;500;600&display=swap';
const escapeStyle = (css: string) => css.replace(/<\/(style)/gi, '<\\/$1');
const escapeScript = (js: string) => js.replace(/<\/(script)/gi, '<\\/$1');

export function buildSrcdoc(src: PreviewSources, spec: WatchSpec, scripts: PreviewScripts, nonce: string): string {
  const csp = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    "style-src 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    'img-src data:',
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ');
  const json = JSON.stringify(spec).replace(/</g, '\\u003c');
  // The runtime goes last in <body>, where a deferred script would run: after parsing,
  // before DOMContentLoaded. The bridge goes first so it sees every event.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style data-file="base.css">@import url("${FONTS}");
${escapeStyle(src.base)}</style>
<style data-file="style.css">${escapeStyle(src.css)}</style>
<script type="application/json" id="rcss-watch">${json}</script>
<script nonce="${nonce}">${escapeScript(scripts.bridge)}</script>
</head>
<body>
${src.html}
<script nonce="${nonce}"${src.script === undefined ? '' : ' data-file="vanilla.js"'}>${escapeScript(src.script ?? scripts.runtime)}</script>
</body>
</html>`;
}
