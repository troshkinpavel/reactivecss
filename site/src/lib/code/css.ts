// Reactive CSS highlighter: a CSS Syntax Level 3 style tokenizer plus a structural pass that
// knows where it is (selector, at-rule prelude, property, value, function arguments) and an
// annotation layer that marks Reactive CSS constructs with their registry feature key.
//
// Why not Shiki for CSS: its grammar does not know Reactive CSS, so `state(false)` and the
// whole value of `on:` collapse into single tokens. Shiki still handles HTML, JS, JSON and shell.

import type { FeatureKey, Line, Token, TokenKind } from './types';
import { RX } from './vocabulary';

type RawType = 'comment' | 'ws' | 'string' | 'hash' | 'at' | 'number' | 'ident' | 'function' | 'delim'
  | '(' | ')' | '{' | '}' | '[' | ']' | ':' | ';' | ',';
interface Raw { type: RawType; text: string; start: number }

const isNameStart = (c: string | undefined) => !!c && (/[a-zA-Z_]/.test(c) || c.charCodeAt(0) > 127);
const isName = (c: string | undefined) => !!c && (/[a-zA-Z0-9_-]/.test(c) || c.charCodeAt(0) > 127);
const isDigit = (c: string | undefined) => !!c && c >= '0' && c <= '9';

export function lex(src: string): Raw[] {
  const out: Raw[] = [];
  const n = src.length;
  let i = 0;
  const push = (type: RawType, start: number) => out.push({ type, text: src.slice(start, i), start });
  const identAt = (j: number) =>
    isNameStart(src[j]) || src[j] === '\\' || (src[j] === '-' && (isNameStart(src[j + 1]) || src[j + 1] === '-'));
  const numberAt = (j: number) =>
    isDigit(src[j]) || (src[j] === '.' && isDigit(src[j + 1])) ||
    ((src[j] === '+' || src[j] === '-') && (isDigit(src[j + 1]) || (src[j + 1] === '.' && isDigit(src[j + 2]))));
  const name = () => { while (i < n && (isName(src[i]) || src[i] === '\\')) i += src[i] === '\\' ? 2 : 1; };

  while (i < n) {
    const c = src[i]!, s = i;
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      i = e < 0 ? n : e + 2;
      push('comment', s);
    } else if (/\s/.test(c)) {
      while (i < n && /\s/.test(src[i]!)) i++;
      push('ws', s);
    } else if (c === '"' || c === "'") {
      i++;
      while (i < n && src[i] !== c && src[i] !== '\n') i += src[i] === '\\' ? 2 : 1;
      if (src[i] === c) i++;
      push('string', s);
    } else if (c === '#' && isName(src[i + 1])) {
      i++; name(); push('hash', s);
    } else if (c === '@' && identAt(i + 1)) {
      i++; name(); push('at', s);
    } else if (numberAt(i)) {
      if (c === '+' || c === '-') i++;
      while (isDigit(src[i])) i++;
      if (src[i] === '.' && isDigit(src[i + 1])) { i++; while (isDigit(src[i])) i++; }
      if (src[i] === '%') i++;
      else if (identAt(i)) name();
      push('number', s);
    } else if (identAt(i)) {
      name();
      push(src[i] === '(' ? 'function' : 'ident', s);
    } else {
      i++;
      push('(){}[]:;,'.includes(c) ? (c as RawType) : 'delim', s);
    }
  }
  return out;
}

type Block = 'root' | 'group' | 'rule' | 'decls' | 'keyframes';
const GROUP_AT = new Set(['media', 'supports', 'container', 'layer', 'scope', 'starting-style', 'document']);
const DECL_AT = new Set(['font-face', 'property', 'page', 'counter-style', 'font-feature-values', 'view-transition']);
const LOGIC = new Set(['and', 'or', 'not']);

interface Out { t: string; k: TokenKind; start: number; feature?: FeatureKey }

/** Classifies a stylesheet into tokens with offsets. */
export function classifyCss(src: string): Out[] {
  const raw = lex(src);
  const out: Out[] = [];
  const emit = (r: Raw, k: TokenKind, feature?: FeatureKey) => out.push(feature ? { t: r.text, k, start: r.start, feature } : { t: r.text, k, start: r.start });
  const next = (j: number) => { while (j < raw.length && (raw[j]!.type === 'ws' || raw[j]!.type === 'comment')) j++; return j; };

  const blocks: Block[] = ['root'];
  const top = () => blocks[blocks.length - 1]!;
  let mode: 'stmt' | 'sel' | 'at' | 'prop' | 'value' = 'stmt';
  let atName = '';
  let decl = '';
  let depth = 0;
  const fns: string[] = [];
  // Inside a reactive selector function such as :when(...): condition syntax.
  let condDepth = 0;
  // 0.9: the selector being read has :on(), and the depths of open blocks that are :on() rules
  // (their custom-property declarations are mutations: set(), toggle(), event()…).
  let selOn = false;
  const onBlocks = new Set<number>();
  // Rules on a pseudo-element: there `content` stays native CSS, whatever it reads.
  let selPseudo = false;
  const pseudoBlocks = new Set<number>();
  const pop = () => { onBlocks.delete(blocks.length); pseudoBlocks.delete(blocks.length); if (blocks.length > 1) blocks.pop(); };
  const inOnRule = () => onBlocks.has(blocks.length);
  /** A declaration's value reads state (the runtime's test for a reactive content). */
  const readsState = (j: number) => {
    for (let d = 0; j < raw.length; j++) {
      const t = raw[j]!;
      if (t.type === '(' ) d++; else if (t.type === ')') d--;
      else if (t.type === 'function' && /^(var|when|previous|direction)$/i.test(t.text)) return true;
      else if (d === 0 && (t.type === ';' || t.type === '}')) return false;
    }
    return false;
  };

  /** In a rule block, a statement is a nested rule when `{` comes before `;` or `}`. */
  const declarationAhead = (j: number) => {
    if (top() === 'decls') return true;
    if (top() !== 'rule') return false;
    let d = 0;
    for (; j < raw.length; j++) {
      const t = raw[j]!.type;
      if (t === '(' || t === '[') d++;
      else if (t === ')' || t === ']') d--;
      else if (d === 0 && t === '{') return false;
      else if (d === 0 && (t === ';' || t === '}')) return true;
    }
    return true;
  };

  for (let i = 0; i < raw.length; i++) {
    const r = raw[i]!;
    if (r.type === 'ws') { emit(r, 'ws'); continue; }
    if (r.type === 'comment') { emit(r, 'com'); continue; }

    if (mode === 'stmt') {
      if (r.type === '}') { pop(); emit(r, 'pun'); continue; }
      if (r.type === ';') { emit(r, 'pun'); continue; }
      if (r.type === 'at') { mode = 'at'; atName = r.text.slice(1).toLowerCase(); emit(r, 'at'); continue; }
      mode = declarationAhead(i) ? 'prop' : 'sel';
    }

    if (mode === 'at') {
      if (r.type === '{') {
        blocks.push(atName === 'keyframes' || atName.endsWith('-keyframes') ? 'keyframes' : GROUP_AT.has(atName) ? 'group' : DECL_AT.has(atName) ? 'decls' : 'group');
        mode = 'stmt';
        emit(r, 'pun');
      } else if (r.type === ';') { mode = 'stmt'; emit(r, 'pun'); }
      else emit(r, r.type === 'ident' || r.type === 'number' || r.type === 'function' ? 'val' : r.type === 'string' ? 'str' : 'pun');
      continue;
    }

    if (mode === 'sel') {
      if (condDepth > 0) {
        if (r.type === '(') { condDepth++; emit(r, 'pun'); }
        else if (r.type === ')') { condDepth--; emit(r, 'pun'); }
        else if (r.type === 'ident' && r.text.startsWith('--')) emit(r, 'var');
        else if (r.type === 'function' && RX.functions.has(r.text)) emit(r, 'rx', `function:${r.text}`);
        // :on() modifiers and outside(): each has its own reference page.
        else if (r.type === 'function' && /^(prevent|stop)$/i.test(r.text)) emit(r, 'rx', 'action:prevent');
        else if (r.type === 'function' && /^outside$/i.test(r.text)) emit(r, 'rx', 'trigger:outside');
        else if (r.type === 'function' && /^drag$/i.test(r.text)) emit(r, 'rx', 'rule:drag');
        else if (r.type === 'ident' && LOGIC.has(r.text.toLowerCase())) emit(r, 'kw');
        else if (r.type === 'string') emit(r, 'str');
        else if (r.type === 'ident' || r.type === 'number' || r.type === 'hash') emit(r, 'val');
        else emit(r, 'pun');
        continue;
      }
      if (r.type === '{') { blocks.push(top() === 'keyframes' ? 'decls' : 'rule'); if (selOn) onBlocks.add(blocks.length); if (selPseudo) pseudoBlocks.add(blocks.length); selOn = selPseudo = false; mode = 'stmt'; emit(r, 'pun'); continue; }
      if (r.type === ':') {
        const a = raw[i + 1];
        if (a?.type === ':' && (raw[i + 2]?.type === 'ident' || raw[i + 2]?.type === 'function')) {
          const b = raw[i + 2]!;
          out.push({ t: '::' + b.text, k: 'sel', start: r.start });
          selPseudo = true;
          i += 2;
          continue;
        }
        if (a && (a.type === 'ident' || a.type === 'function')) {
          const name = a.text.toLowerCase();
          i++;
          if (name === 'on' && a.type === 'function') {
            // :on(trigger [, prevent()] [, stop()]): the trigger and modifiers read as values.
            const drag = raw[next(i + 2)];
            out.push({ t: ':' + a.text, k: 'rx', start: r.start, feature: drag?.type === 'ident' || drag?.type === 'function' ? (/^drag$/i.test(drag.text) ? 'rule:drag' : 'rule:on') : 'rule:on' });
            selOn = true;
            const p = raw[i + 1]; if (p?.type === '(') { i++; emit(p, 'pun'); condDepth = 1; }
          } else if (RX.selectors.has(name)) {
            out.push({ t: ':' + a.text, k: 'rx', start: r.start, feature: `selector:${name}` });
            if (a.type === 'function') { const p = raw[i + 1]; if (p?.type === '(') { i++; emit(p, 'pun'); condDepth = 1; } }
          } else out.push({ t: ':' + a.text, k: 'sel', start: r.start });
          continue;
        }
      }
      if (r.type === 'delim' && r.text === '.' && raw[i + 1]?.type === 'ident') {
        out.push({ t: '.' + raw[i + 1]!.text, k: 'sel', start: r.start });
        i++;
        continue;
      }
      if (r.type === 'ident' || r.type === 'hash' || (r.type === 'delim' && (r.text === '*' || r.text === '&')) || r.type === 'number') emit(r, 'sel');
      else if (r.type === 'string') emit(r, 'str');
      else emit(r, 'pun');
      continue;
    }

    if (mode === 'prop') {
      if (r.type === 'ident') {
        const name = r.text.toLowerCase();
        decl = name;
        if (name === 'content' && (pseudoBlocks.has(blocks.length) || !readsState(i))) emit(r, 'prop'); // native content (literals, counters, images)
        else if (RX.declarations.has(name)) emit(r, 'rx', `declaration:${name}`);
        else if (name.startsWith('--attr-')) emit(r, 'rx', 'declaration:--attr-*');
        else emit(r, name.startsWith('--') ? 'var' : 'prop');
        continue;
      }
      if (r.type === ':') { mode = 'value'; depth = 0; fns.length = 0; emit(r, 'pun'); continue; }
      if (r.type === '}') { pop(); mode = 'stmt'; emit(r, 'pun'); continue; }
      if (r.type === ';') { mode = 'stmt'; emit(r, 'pun'); continue; }
      emit(r, 'pun');
      continue;
    }

    // mode === 'value'
    if (depth === 0 && r.type === ';') { mode = 'stmt'; emit(r, 'pun'); continue; }
    if (depth === 0 && r.type === '}') { pop(); mode = 'stmt'; emit(r, 'pun'); continue; }
    if (r.type === 'function') {
      const name = r.text.toLowerCase();
      let feature: FeatureKey | undefined;
      const mutation = decl.startsWith('--') && inOnRule();
      const inStateOrSet = (decl.startsWith('--') && fns[0] === 'state') || (decl === 'on' && fns.includes('set')) || mutation;
      if (inStateOrSet && RX.expressions.has(name)) feature = `expression:${name}`;
      else if (mutation && fns.length === 0 && RX.actions.has(name)) feature = `action:${name}`;
      else if (decl.startsWith('--') && fns.length === 1 && fns[0] === 'state' && (name === 'bind' || name === 'persist')) feature = name === 'bind' ? 'declaration:bind()' : 'declaration:persist';
      else if (decl === 'on') {
        if (fns.length === 0 && RX.triggers.has(name)) feature = `trigger:${name}`;
        else if (RX.actions.has(name)) feature = `action:${name}`;
        else if (name === 'closest') feature = 'scope:closest';
      } else if (decl === 'bind') {
        if (name === 'closest') feature = 'scope:closest';
      } else if (name === 'element') {
        const arg = raw[next(i + 2)];
        if (arg?.type === 'ident' && /^(width|height)$/i.test(arg.text)) feature = 'function:element';
      } else if (RX.functions.has(name)) feature = `function:${name}`;
      fns.push(name);
      if (feature) emit(r, 'rx', feature);
      else emit(r, 'fn');
      continue;
    }
    if (r.type === '(') { depth++; emit(r, 'pun'); continue; }
    if (r.type === ')') { depth = Math.max(0, depth - 1); fns.pop(); emit(r, 'pun'); continue; }
    if (r.type === 'ident') { emit(r, r.text.startsWith('--') ? 'var' : 'val'); continue; }
    if (r.type === 'string') { emit(r, 'str'); continue; }
    if (r.type === 'number' || r.type === 'hash') { emit(r, 'val'); continue; }
    emit(r, 'pun');
  }
  return out;
}

/** Splits classified tokens into lines; tokens that span lines (comments, whitespace) are cut. */
export function toLines(src: string, tokens: Out[]): Line[] {
  const lines: Line[] = [[]];
  for (const tok of tokens) {
    const parts = tok.t.split('\n');
    let start = tok.start;
    parts.forEach((p, n) => {
      if (n > 0) lines.push([]);
      if (p) {
        const t: Token = { t: p, k: tok.k, start };
        if (tok.feature) t.feature = tok.feature;
        lines[lines.length - 1]!.push(t);
      }
      start += p.length + 1;
    });
  }
  // A trailing newline in the source would otherwise add an empty last line.
  if (src.endsWith('\n')) lines.pop();
  return lines;
}

export function highlightCss(src: string): Line[] {
  return toLines(src, classifyCss(src));
}
