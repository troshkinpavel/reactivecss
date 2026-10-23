// The library's own demos (../examples/<name>/), synced unchanged into src/generated/demos/ by
// scripts/sync-runtime.mjs. They run as they are: the site only splits each style.css into the
// layout at the top (run, not shown) and the behavior below its first `/* ---- ` section comment
// (run and shown), and reads the README for the title and notes.

import type { ExampleDefinition } from '~/examples/manifest';

const raw = import.meta.glob<string>('../../generated/demos/*/{index.html,style.css,README.md}', { query: '?raw', import: 'default', eager: true });

export interface DemoNotes {
  /** README sections by title without the number, such as "Limitations found". */
  sections: Record<string, string>;
}
export interface Demo extends ExampleDefinition { notes: DemoNotes }

/** The order used on the Examples index. The first five are the Vision showcase. */
export { DEMO_ORDER } from './demo-order';
import { DEMO_ORDER } from './demo-order';

const file = (name: string, f: string) => raw[`../../generated/demos/${name}/${f}`];

/** Layout before the first section comment, behavior from it on. */
export function splitStyle(css: string): { base: string; behavior: string } {
  const at = css.search(/^\/\* ---- /m);
  return at < 0 ? { base: '', behavior: css } : { base: css.slice(0, at), behavior: css.slice(at) };
}

/** Body markup without scripts: the preview loads the runtime itself. */
export const bodyOf = (html: string) => (html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html).replace(/<script\b[\s\S]*?<\/script>/gi, '').trim();

/** Title, first paragraph and `## ` sections of a library README (numbered or not). */
export function readme(md: string) {
  const title = md.match(/^# (.+)$/m)?.[1]?.trim() ?? '';
  const description = md.split(/\n\n+/).find((p, i) => i > 0 && !p.startsWith('#') && !p.startsWith('Run:'))?.replace(/\s+/g, ' ').trim() ?? '';
  const sections: Record<string, string> = {};
  for (const m of md.matchAll(/^## (?:\d+\. )?(.+)\n([\s\S]*?)(?=^## |(?![\s\S]))/gm)) sections[m[1]!.trim()] = m[2]!.trim();
  return { title, description, sections };
}

export function getDemo(name: string): Demo | undefined {
  const css = file(name, 'style.css'), html = file(name, 'index.html'), md = file(name, 'README.md');
  if (css === undefined || html === undefined || md === undefined) return undefined;
  const { base, behavior } = splitStyle(css);
  const r = readme(md);
  return {
    id: name, title: r.title, description: r.description, stem: 'style', level: 'advanced', a11y: 'library demo', label: `examples/${name}`,
    files: { css: behavior, base, html: bodyOf(html), js: null },
    notes: { sections: r.sections },
  };
}

export const DEMOS: Demo[] = DEMO_ORDER.map(getDemo).filter((d): d is Demo => !!d);

/** "Limitations found" in most READMEs, "Limitations" in some. */
export const section = (d: Demo, ...names: string[]) => names.map((n) => d.notes.sections[n]).find(Boolean) ?? '';

/** README links point into the library repository; on the site they become plain text. */
export const unlinkRepoPaths = (md: string) => md.replace(/\[([^\]]+)\]\((?!https?:|#)[^)]+\)/g, '$1');

/** Rendered README code blocks can scroll sideways, so keyboard users must be able to focus them. */
export const focusablePre = (html: string) => html.replace(/<pre>/g, '<pre tabindex="0">');
