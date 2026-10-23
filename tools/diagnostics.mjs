// Production diagnostic codes (0.9.0 hardening; docs/release-0.9.0-hardening.md, section B).
//
// Source code keeps every diagnostic as readable text. Production builds (__DEV__ false) replace
// each message literal by a stable code; the values interpolated into the message stay, as
// arguments:  `${user} uses ${name}, but no element declares …`  →  `RCSS-S001⟦${user}⟧⟦${name}⟧`.
// Development builds are not transformed.
//
// - Which literals: a string or template literal that is a whole argument (or a ternary branch)
//   of warn(), note(), msg(), fail(), new Error(), new EvalError(), new ConditionError(),
//   warnMissing() or dropDeclaration(), whose static text has 20+ characters and a space.
//   Short literals (keys such as 'feature:gestures') are never touched.
// - Codes: RCSS-<area letter><3 digits>, per source area (CODE_AREAS), assigned once and kept
//   forever in src/core/diagnostics.json (the registry; checked in, append-only). The same
//   template text always gets the same code.
// - Lookup: dist/diagnostics.json (code → template) and explain(text), which expands codes,
//   nested ones included, offline: `reactive-css explain "<message>"`.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REGISTRY = join(ROOT, 'src/core/diagnostics.json');
const OPEN = '⟦', CLOSE = '⟧';
const CALLEES = new Set(['warn', 'note', 'msg', 'fail', 'Error', 'EvalError', 'ConditionError', 'warnMissing', 'dropDeclaration']);
/** Area letter per source module (one letter per subsystem, so a code says where it comes from). */
export const CODE_AREAS = [
  ['P', /^core\/(parser|tokenizer)\.ts$/, 'compiler'],
  ['R', /^core\//, 'engine and runtime'],
  ['S', /^state\/(state|values|expr|keys|textof|typed)\.ts$/, 'state'],
  ['E', /^state\/(actions|on|actexpr)\.ts$/, 'events'],
  ['G', /^state\/gesture\.ts$/, 'gestures'],
  ['K', /^state\/persist\.ts$/, 'persistence'],
  ['F', /^(state\/bind\.ts|selectors\/just-checked\.ts)$/, 'forms'],
  ['A', /^state\/(attrdecl|bindattr|bindattr-runtime)\.ts$/, 'attributes'],
  ['T', /^state\/text\.ts$/, 'text'],
  ['C', /^(state\/focusdecl\.ts|selectors\/blur\.ts)$/, 'focus'],
  ['W', /^(state\/(conditions|history|changed)\.ts|selectors\/nth-var\.ts)$/, 'conditions'],
  ['V', /^functions\//, 'values and sources'],
];

// ---- a small, source-preserving JavaScript/TypeScript lexer ---------------------------------
// Enough for this transform: comments, strings, template literals with nested ${…}, regular
// expression literals (the usual "previous token" rule), brackets, identifiers and punctuation.

const KEYWORDS_BEFORE_REGEX = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await', 'instanceof']);

function lex(src) {
  const toks = [];
  let i = 0;
  const prevSig = () => { for (let k = toks.length - 1; k >= 0; k--) if (toks[k].t !== 'ws' && toks[k].t !== 'comment') return toks[k]; return undefined; };
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); const end = e < 0 ? src.length : e; toks.push({ t: 'comment', s: i, e: end }); i = end; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2) + 2; toks.push({ t: 'comment', s: i, e }); i = e; continue; }
    if (/\s/.test(c)) { let j = i; while (j < src.length && /\s/.test(src[j])) j++; toks.push({ t: 'ws', s: i, e: j }); i = j; continue; }
    if (c === '"' || c === "'") { let j = i + 1; while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1; toks.push({ t: 'str', s: i, e: j + 1 }); i = j + 1; continue; }
    if (c === '`') { const tpl = template(src, i); toks.push({ t: 'tpl', s: i, e: tpl.end, quasis: tpl.quasis, exprs: tpl.exprs }); i = tpl.end; continue; }
    if (c === '/') {
      const p = prevSig();
      const regex = !p || (p.t === 'punct' && !')]}'.includes(p.v)) || (p.t === 'id' && KEYWORDS_BEFORE_REGEX.has(p.v));
      if (regex) {
        let j = i + 1, cls = false;
        for (; j < src.length; j++) {
          if (src[j] === '\\') { j++; continue; }
          if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false;
          else if (src[j] === '/' && !cls) break;
        }
        j++;
        while (/[a-z]/i.test(src[j] ?? '')) j++;
        toks.push({ t: 'regex', s: i, e: j });
        i = j;
        continue;
      }
    }
    if (/[A-Za-z_$]/.test(c)) { let j = i; while (/[\w$]/.test(src[j] ?? '')) j++; toks.push({ t: 'id', s: i, e: j, v: src.slice(i, j) }); i = j; continue; }
    if (/\d/.test(c)) { let j = i; while (/[\w.]/.test(src[j] ?? '')) j++; toks.push({ t: 'num', s: i, e: j }); i = j; continue; }
    toks.push({ t: 'punct', s: i, e: i + 1, v: c });
    i++;
  }
  return { toks };
}

/** A template literal at `start`: its static parts and its ${…} expressions (source ranges). */
function template(src, start) {
  const quasis = [], exprs = [];
  let i = start + 1, q = i;
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue; }
    if (src[i] === '`') { quasis.push([q, i]); return { end: i + 1, quasis, exprs }; }
    if (src[i] === '$' && src[i + 1] === '{') {
      quasis.push([q, i]);
      const end = matchBrace(src, i + 2);
      exprs.push([i + 2, end]);
      i = q = end + 1;
      continue;
    }
    i++;
  }
  throw new Error('unterminated template literal at ' + start);
}

/** Index of the '}' that closes an expression starting at `i` (strings, templates, regex and comments skipped). */
function matchBrace(src, i) {
  let depth = 0, prev = '(';
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 2; continue; }
    if (c === '"' || c === "'") { i++; while (src[i] !== c) i += src[i] === '\\' ? 2 : 1; i++; prev = 'a'; continue; }
    if (c === '`') { i = template(src, i).end; prev = 'a'; continue; }
    if (c === '/' && '(,=:[!&|?{};'.includes(prev)) {
      let cls = false;
      for (i++; i < src.length; i++) { if (src[i] === '\\') { i++; continue; } if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; else if (src[i] === '/' && !cls) break; }
      i++;
      while (/[a-z]/i.test(src[i] ?? '')) i++;
      prev = 'a';
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { if (depth === 0) return i; depth--; }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  throw new Error('unbalanced ${ at ' + i);
}

// ---- registry ---------------------------------------------------------------------------

export function loadRegistry() {
  return existsSync(REGISTRY) ? JSON.parse(readFileSync(REGISTRY, 'utf8')) : { version: 1, codes: {} };
}
export function saveRegistry(reg) {
  const sorted = Object.fromEntries(Object.entries(reg.codes).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(REGISTRY, JSON.stringify({ version: 1, note: 'Production diagnostic codes: append-only. Generated by tools/diagnostics.mjs; see docs/release-0.9.0-hardening.md.', codes: sorted }, null, 1) + '\n');
}
const areaOf = (rel) => CODE_AREAS.find(([, re]) => re.test(rel)) ?? ['X', null, 'other'];

/** The template of a literal: static text with {0}, {1}… for the interpolated values. */
function templateText(src, tok) {
  if (tok.t === 'str') return src.slice(tok.s + 1, tok.e - 1).replace(/\\(.)/g, '$1');
  return tok.quasis.map(([a, b], k) => src.slice(a, b).replace(/\\(.)/g, '$1') + (k < tok.exprs.length ? `{${k}}` : '')).join('');
}
const staticLength = (src, tok) => (tok.t === 'str' ? tok.e - tok.s - 2 : tok.quasis.reduce((n, [a, b]) => n + b - a, 0));

/**
 * Production transform of one source file. `rel` is the path under src/. With `assign`, new
 * templates get the next code of their area (the registry is updated in place); without, an
 * unknown template is left as text. Returns { code, replaced, unknown }.
 */
export function transform(src, rel, reg, { assign = false } = {}) {
  const { toks } = lex(src);
  const byTemplate = new Map(Object.entries(reg.codes).map(([code, e]) => [e.template, code]));
  const edits = [];
  let unknown = 0;
  const sig = (k, dir) => { for (let j = k + dir; j >= 0 && j < toks.length; j += dir) if (toks[j].t !== 'ws' && toks[j].t !== 'comment') return toks[j]; return undefined; };
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.t !== 'id' || !CALLEES.has(t.v)) continue;
    const open = sig(k, 1);
    if (!open || open.t !== 'punct' || open.v !== '(') continue;
    const before = sig(k, -1);
    if (before?.t === 'punct' && before.v === '.') continue; // console.warn(), x.note(): not ours
    if (before?.t === 'id' && (before.v === 'function' || before.v === 'class')) continue; // a declaration
    let depth = 0;
    for (let j = toks.indexOf(open); j < toks.length; j++) {
      const u = toks[j];
      if (u.t === 'punct' && '([{'.includes(u.v)) { depth++; continue; }
      if (u.t === 'punct' && ')]}'.includes(u.v)) { if (--depth === 0) break; continue; }
      if (depth !== 1 || (u.t !== 'str' && u.t !== 'tpl')) continue;
      const p = sig(j, -1), n = sig(j, 1);
      if (!(p?.t === 'punct' && '(,?:'.includes(p.v)) || !(n?.t === 'punct' && '),:'.includes(n.v))) continue; // a whole argument or a ternary branch only
      if (staticLength(src, u) < 20 || !/ /.test(src.slice(u.s, u.e))) continue;
      const tpl = templateText(src, u);
      let code = byTemplate.get(tpl);
      if (!code && assign) {
        const [letter] = areaOf(rel);
        const used = Object.keys(reg.codes).filter((c) => c.startsWith(`RCSS-${letter}`)).map((c) => +c.slice(6));
        code = `RCSS-${letter}${String((used.length ? Math.max(...used) : 0) + 1).padStart(3, '0')}`;
        reg.codes[code] = { template: tpl, module: rel };
        byTemplate.set(tpl, code);
      }
      if (!code) { unknown++; continue; }
      const args = u.t === 'tpl' ? u.exprs.map(([a, b]) => `${OPEN}\${${src.slice(a, b)}}${CLOSE}`).join('') : '';
      edits.push([u.s, u.e, '`' + code + args + '`']);
    }
  }
  let out = src;
  for (const [s, e, text] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, s) + text + out.slice(e);
  return { code: out, replaced: edits.length, unknown };
}

/**
 * esbuild plugin for production builds. `assign: true` (build.mjs) records new templates in the
 * registry; custom bundles (tools/bundle.mjs) only read it.
 */
export function diagnosticsPlugin({ assign = false, stats } = {}) {
  const reg = loadRegistry();
  return {
    name: 'rcss-diagnostic-codes',
    setup(b) {
      b.onLoad({ filter: /[\\/]src[\\/].*\.ts$/ }, (args) => {
        const rel = relative(join(ROOT, 'src'), args.path).replace(/\\/g, '/');
        if (rel === 'core/features.ts') return undefined; // descriptions are data (describe()), not diagnostics
        const r = transform(readFileSync(args.path, 'utf8'), rel, reg, { assign });
        if (stats) { stats.replaced += r.replaced; stats.unknown += r.unknown; }
        return { contents: r.code, loader: 'ts' };
      });
      if (assign) b.onEnd(() => saveRegistry(reg));
    },
  };
}

/** The full text of a production message: every code (nested ones too) expanded with its values. */
export function explain(text, reg = loadRegistry()) {
  const parse = (s, i) => {
    // At a code: RCSS-X000 followed by ⟦arg⟧…
    const m = /^RCSS-[A-Z]\d{3}/.exec(s.slice(i));
    if (!m) return null;
    let j = i + m[0].length;
    const args = [];
    while (s[j] === OPEN) {
      let depth = 1, k = j + 1;
      for (; k < s.length && depth; k++) { if (s[k] === OPEN) depth++; else if (s[k] === CLOSE) depth--; }
      args.push(expand(s.slice(j + 1, k - 1)));
      j = k;
    }
    const entry = reg.codes[m[0]];
    const full = entry ? entry.template.replace(/\{(\d+)\}/g, (_, n) => args[+n] ?? '') : `${m[0]} (unknown code)${args.map((a) => ` [${a}]`).join('')}`;
    return { end: j, text: full };
  };
  const expand = (s) => {
    let out = '';
    for (let i = 0; i < s.length;) {
      const r = s.startsWith('RCSS-', i) ? parse(s, i) : null;
      if (r) { out += r.text; i = r.end; } else out += s[i++];
    }
    return out;
  };
  return expand(text);
}
