// Source-preserving CSS tokenizer. Every token keeps its [start, end) range so the
// transformer can splice the original text instead of re-serializing it.
// It follows the CSS Syntax 3 token boundaries that matter for structure
// (comments, strings, url(), escapes, brackets, idents, functions). Everything else
// becomes a one-character "delim" token, which is enough for our purposes.

export type TokenType =
  | 'ws' | 'comment' | 'string' | 'url' | 'ident' | 'function'
  | '(' | ')' | '[' | ']' | '{' | '}' | ';' | ':' | ',' | 'delim';

export interface Token {
  type: TokenType;
  start: number;
  end: number;
  /** ident / function name (unescaped, lower-cased for functions), delim char, or string body. */
  value: string;
}

const isWs = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';
const isNameStart = (c: string) => /[a-zA-Z_]/.test(c) || c.charCodeAt(0) >= 0x80;
const isName = (c: string) => /[a-zA-Z0-9_-]/.test(c) || c.charCodeAt(0) >= 0x80;
const isHex = (c: string) => /[0-9a-fA-F]/.test(c);
const validEscape = (s: string, i: number) => s[i] === '\\' && i + 1 < s.length && s[i + 1] !== '\n';

/** Consumes an escape starting after the backslash; returns [char, nextIndex]. */
function escape(s: string, i: number): [string, number] {
  if (isHex(s[i])) {
    let j = i;
    while (j < s.length && j - i < 6 && isHex(s[j])) j++;
    const cp = parseInt(s.slice(i, j), 16);
    if (isWs(s[j] ?? '')) j++;
    return [cp === 0 || cp > 0x10ffff ? '�' : String.fromCodePoint(cp), j];
  }
  return [s[i], i + 1];
}

function startsIdent(s: string, i: number): boolean {
  const c = s[i] ?? '';
  if (c === '-') return isNameStart(s[i + 1] ?? '') || s[i + 1] === '-' || validEscape(s, i + 1);
  return isNameStart(c) || validEscape(s, i);
}

export function tokenize(s: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const push = (type: TokenType, start: number, value = '') => out.push({ type, start, end: i, value });

  while (i < s.length) {
    const start = i;
    const c = s[i];
    if (c === '/' && s[i + 1] === '*') {
      const close = s.indexOf('*/', i + 2);
      i = close < 0 ? s.length : close + 2;
      push('comment', start);
    } else if (isWs(c)) {
      while (i < s.length && isWs(s[i])) i++;
      push('ws', start);
    } else if (c === '"' || c === "'") {
      i++;
      let body = '';
      while (i < s.length && s[i] !== c && s[i] !== '\n') {
        if (s[i] === '\\') {
          if (s[i + 1] === '\n') { i += 2; continue; }
          if (i + 1 >= s.length) { i++; break; }
          const [ch, next] = escape(s, i + 1);
          body += ch;
          i = next;
        } else body += s[i++];
      }
      if (s[i] === c) i++;
      push('string', start, body);
    } else if (startsIdent(s, i)) {
      let name = '';
      while (i < s.length) {
        if (validEscape(s, i)) { const [ch, next] = escape(s, i + 1); name += ch; i = next; }
        else if (isName(s[i])) name += s[i++];
        else break;
      }
      if (s[i] === '(') {
        i++;
        if (name.toLowerCase() === 'url') {
          let j = i;
          while (isWs(s[j] ?? '')) j++;
          if (s[j] !== '"' && s[j] !== "'") {
            // Unquoted url(...) is a single token: consume to the closing paren.
            let body = '';
            while (i < s.length && s[i] !== ')') {
              if (validEscape(s, i)) { const [ch, next] = escape(s, i + 1); body += ch; i = next; }
              else body += s[i++];
            }
            if (s[i] === ')') i++;
            push('url', start, body.trim());
            continue;
          }
        }
        push('function', start, name.toLowerCase());
      } else push('ident', start, name);
    } else if ('()[]{};:,'.includes(c)) {
      i++;
      push(c as TokenType, start, c);
    } else {
      i++;
      push('delim', start, c);
    }
  }
  return out;
}

/** Index of the token that closes the block opened at `open` (a '(' '[' '{' or function token). */
export function matching(tokens: Token[], open: number): number {
  let depth = 0;
  for (let i = open; i < tokens.length; i++) {
    const t = tokens[i].type;
    if (t === '(' || t === '[' || t === '{' || t === 'function') depth++;
    else if (t === ')' || t === ']' || t === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return tokens.length;
}
