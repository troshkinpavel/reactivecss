// 0.10: length(), includes(), lower(), trim().
//
// Unicode rules (one meaning everywhere):
//   - length() counts grapheme clusters (what a reader sees as one character: "é", "👍🏽" = 1),
//     with Intl.Segmenter. HTML maxlength counts UTF-16 code units, so they differ for emoji.
//   - lower() is the Unicode default lower-casing (toLowerCase), the same for every user and
//     page language (no Turkish dotless-i rules).
//   - includes() compares NFC-normalized text, case-sensitively; an empty needle is found.
//   - trim() removes Unicode white space at both ends (String.prototype.trim).
// Arguments must be text (a string or keyword); numbers and booleans are an error (no value),
// never silently converted.

import { valueFunction, text } from './calls';
import type { Typed } from '../state/values';

const str = (v: string): Typed => ({ type: 'string', v });
let segmenter: Intl.Segmenter | undefined;

export function graphemes(s: string): number {
  if (typeof Intl.Segmenter !== 'function') return [...s].length; // code points without Segmenter
  let n = 0;
  for (const _ of (segmenter ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' })).segment(s)) n++;
  return n;
}

valueFunction('length', 'length(text)', { min: 1, max: 1, eval: ([a]) => ({ type: 'number', v: graphemes(text(a, 'length')), unit: '' }) });
valueFunction('includes', 'includes(text, part)', {
  min: 2, max: 2,
  eval: ([a, b]) => ({ type: 'boolean', v: text(a, 'includes').normalize('NFC').includes(text(b, 'includes').normalize('NFC')) }),
});
valueFunction('lower', 'lower(text)', { min: 1, max: 1, eval: ([a]) => str(text(a, 'lower').toLowerCase()) });
valueFunction('trim', 'trim(text)', { min: 1, max: 1, eval: ([a]) => str(text(a, 'trim').trim()) });
