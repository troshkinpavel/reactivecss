// The single scalar a text:, attr: or focus: value computes to (core: shared by those features).

import { tokenize } from '../core/tokenizer';

/** The text for a computed --rcss-text value: one string, number or keyword; null for none. */
export function textOf(raw: string): string | null | undefined {
  const s = raw.trim();
  if (!s) return null; // no text: declaration applies (or the value is invalid at computed time)
  const t = tokenize(s).filter((x) => x.type !== 'comment');
  if (t.length === 1 && t[0].type === 'string') return t[0].value;
  if (t.some((x) => x.type === 'ws' || x.type === 'string' || x.type === 'function' || x.type === 'url')) return undefined;
  return s; // a number, dimension or keyword
}
