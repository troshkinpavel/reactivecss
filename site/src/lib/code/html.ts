// A small synchronous HTML tokenizer for the Playground's HTML editor: tags, attributes,
// attribute values, comments and text. Shiki (highlight.ts) is async and loads grammars, which
// makes every keystroke wait; this keeps the overlay in step with the textarea.
import type { Line, TokenKind } from './types';

export function highlightHtml(src: string): Line[] {
  const lines: Line[] = [[]];
  const push = (t: string, k: TokenKind, start: number) => {
    t.split('\n').forEach((part, i) => {
      if (i) lines.push([]);
      if (part) lines.at(-1)!.push({ t: part, k: /^\s+$/.test(part) ? 'ws' : k, start });
      start += part.length + 1;
    });
  };
  let i = 0;
  const take = (re: RegExp) => { re.lastIndex = i; const m = re.exec(src); return m ? m[0] : null; };
  while (i < src.length) {
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      const s = end < 0 ? src.slice(i) : src.slice(i, end + 3);
      push(s, 'com', i); i += s.length; continue;
    }
    const open = take(/<\/?(?=[a-zA-Z!])/y);
    if (open) {
      push(open, 'pun', i); i += open.length;
      const name = take(/[!a-zA-Z][\w:-]*/y)!;
      push(name, 'tag', i); i += name.length;
      // Attributes until > (or the start of another tag, while the user is still typing).
      while (i < src.length && src[i] !== '<') {
        const s = take(/\s+/y) ?? take(/\/?>/y) ?? take(/=/y) ?? take(/"[^"]*"?|'[^']*'?/y) ?? take(/[^\s"'<>\/=]+/y) ?? src[i]!;
        const k: TokenKind = /^\/?>$|^=$/.test(s) ? 'pun' : /^["']/.test(s) || src[i - 1] === '=' ? 'str' : 'attr';
        push(s, k, i); i += s.length;
        if (k === 'pun' && s.endsWith('>')) break;
      }
      continue;
    }
    const text = take(/[^<]+|</y)!;
    push(text, 'id', i); i += text.length;
  }
  return lines;
}
