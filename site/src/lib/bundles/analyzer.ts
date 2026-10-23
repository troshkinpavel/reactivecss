// "Analyze my CSS": the library's analyzer (analyze() in ../tools/bundle.mjs) for one pasted
// stylesheet, in the page. It runs the library's real compiler (the ESM build, copied by
// sync-runtime and loaded only when first used), reads the syntax keys the compiler recorded
// (`CompiledSheet.uses`), and maps them to features. tests/unit/bundles.test.ts checks the result
// against the library's analyze() for every library demo stylesheet.
import { featureOfKey, resolve, type Resolved } from './catalog';

export interface Note { code: 'compile-error' | 'import-not-followed' | 'unknown-syntax'; message: string }
export interface Analysis {
  /** Features the stylesheet uses directly (not core). */
  used: string[];
  /** The resolved bundle for them. */
  resolved: Resolved;
  /** Syntax keys the compiler recorded. */
  uses: string[];
  /** What the compiler reported: unknown actions, invalid arguments… */
  diagnostics: string[];
  notes: Note[];
  /** False when something could not be analyzed: the safe choice is then the full runtime. */
  complete: boolean;
}

interface Compiler { compile(css: string, o?: { trusted?: boolean }): { uses: Set<string> }; diagnostics: string[] }
export const loadCompiler = (): Promise<Compiler> => import('~/generated/reactive-css.esm.js');

export async function analyzeCss(text: string, load: () => Promise<Compiler> = loadCompiler): Promise<Analysis> {
  const { compile, diagnostics } = await load();
  const notes: Note[] = [];
  diagnostics.length = 0;
  let uses: string[] = [];
  try {
    uses = [...compile(text, { trusted: true }).uses].sort();
  } catch (e) {
    notes.push({ code: 'compile-error', message: (e as Error).message });
  }
  if (/@import\b/i.test(text)) notes.push({ code: 'import-not-followed', message: '@import rules are not followed: analyze the imported stylesheets too.' });
  for (const k of uses) if (!featureOfKey(k)) notes.push({ code: 'unknown-syntax', message: `Usage "${k}" belongs to no catalog feature.` });
  const used = [...new Set(uses.map(featureOfKey).filter((f): f is string => !!f))].filter((f) => f !== 'core');
  return { used, resolved: resolve({ features: used }), uses, diagnostics: [...diagnostics], notes, complete: !notes.length && text.trim() !== '' };
}
