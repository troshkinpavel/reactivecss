// Unit tests: lookup, search, analysis, bundles, validation, migration, indexing, version filtering,
// limits and errors, plus the agent mistakes. Run after `npm run build` (they import dist/).
// node --test test/unit.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import * as S from '../dist/server.js';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIB = join(PKG, '../..');
const k = S.knowledge();
const errs = (r) => r.diagnostics.filter((d) => d.severity !== 'info');
const codes = (r) => r.diagnostics.map((d) => d.code);

// ---- knowledge and version -------------------------------------------------------------------

test('knowledge describes the library version it was built from', () => {
  const lib = JSON.parse(readFileSync(join(LIB, 'package.json'), 'utf8'));
  assert.equal(k.reactivecss.version, lib.version);
  assert.equal(k.reactivecss.version, '0.9.1');
  assert.equal(k.reactivecss.package, '@reactivecss/core');
  assert.equal(k.reactivecss.published, true);
  assert.ok(k.registry.features.length > 60);
  assert.equal(k.catalog.features.length, 15);
});

// ---- get_api_reference -----------------------------------------------------------------------

test('lookup returns the 0.9 form for names and aliases', () => {
  const cases = {
    toggle: 'mutation:toggle', set: 'mutation:set', increment: 'mutation:increment', cycle: 'mutation:cycle',
    prevent: 'modifier:prevent', 'prevent()': 'modifier:prevent', stop: 'modifier:stop',
    ':on': 'rule:on', ':on()': 'rule:on', on: 'rule:on', drag: 'rule:drag', event: 'expression:event', 'event()': 'expression:event',
    state: 'function:state', persist: 'declaration:persist', bind: 'declaration:bind()', content: 'declaration:content', text: 'declaration:content',
    '--attr-aria-expanded': 'declaration:--attr-*', '--attr-*': 'declaration:--attr-*', focus: 'declaration:focus', ':blur': 'selector:blur', blur: 'selector:blur',
    ':when': 'selector:when', 'when()': 'function:when', random: 'function:random',
  };
  for (const [name, key] of Object.entries(cases)) assert.equal(S.getReference({ name }).entry.key, key, name);
});

test('lookup never makes 0.8 syntax the default', () => {
  for (const name of [...Object.keys(k.aliases), ...Object.values(k.mutations).map((m) => m.name), 'click', 'key', 'outside']) {
    let r;
    try { r = S.getReference({ name }); } catch { continue; }
    if (['click', 'key', 'outside'].includes(name)) continue; // legacy trigger names: checked below
    assert.notEqual(r.entry.legacy, true, `${name} → ${r.entry.key}`);
    assert.doesNotMatch(r.entry.syntax, /^on:|^text:|^attr:/, name);
  }
  // Exact legacy names are labelled and point at the replacement.
  const on = S.getReference({ name: 'on:' });
  assert.equal(on.entry.key, 'declaration:on');
  assert.equal(on.entry.legacy, true);
  assert.equal(on.entry.replacement.key, 'rule:on');
  for (const [name, repl] of [['text:', 'declaration:content'], ['attr:', 'declaration:--attr-*']]) {
    const r = S.getReference({ name });
    assert.equal(r.entry.legacy, true, name);
    assert.equal(r.entry.replacement.key, repl, name);
  }
  // Legacy alternatives are hidden unless asked for.
  assert.ok(S.getReference({ name: 'on' }).legacyAlternatives.includes('declaration:on'));
  assert.ok(S.getReference({ name: 'toggle', includeLegacy: true }).alternatives.some((a) => a.key === 'action:toggle' && a.legacy));
  const click = S.getReference({ name: 'click', kind: 'trigger' });
  assert.equal(click.entry.legacy, true);
  assert.equal(click.entry.replacement.key, 'rule:on');
});

test('lookup content: syntax, constraints, mistakes, doc page, bundle feature', () => {
  const st = S.getReference({ name: 'state' }).entry;
  assert.match(st.syntax09, /persist\("key"/);
  assert.match(st.syntax09, /bind\(value \| checked/);
  assert.equal(st.bundleFeature, 'core');
  const on = S.getReference({ name: ':on' }).entry;
  assert.equal(on.docUrl, 'https://reactivecss.com/docs/events');
  assert.equal(on.bundleFeature, 'events');
  assert.ok(on.commonMistakes.some((m) => m.id === 'bare-modifier'));
  assert.ok(on.constraints.some((c) => /minifiers/.test(c)));
  assert.equal(S.getReference({ name: 'drag' }).entry.bundleFeature, 'gestures');
  assert.equal(S.getReference({ name: 'persist' }).entry.bundleFeature, 'persist');
  assert.equal(S.getReference({ name: 'toggle' }).entry.bundleFeature, 'events');
  assert.ok(S.getReference({ name: 'random' }).entry.constraints.some((c) => /Native first/.test(c)));
  assert.ok(S.getReference({ name: 'focus' }).entry.constraints.some((c) => /:focus\(when\(…\)\) does not exist/.test(c)));
  assert.ok(S.getReference({ name: 'drag' }).entry.constraints.some((c) => /not native HTML drag and drop/.test(c)));
  assert.equal(S.getReference({ name: 'wave' }).entry.status, 'removed');
});

test('lookup: kind filter, version filtering and structured errors', () => {
  assert.equal(S.getReference({ name: 'on', kind: 'function' }).entry.key, 'function:on');
  const old = S.getReference({ name: 'toggle', version: '0.8.1' });
  assert.equal(old.entry.key, 'action:toggle', 'in 0.8 toggle was the on: action');
  assert.ok(old.versionNote);
  assert.notEqual(S.getReference({ name: ':on', version: '0.8' }).entry.key, 'rule:on'); // :on() rules are 0.9.0
  assert.equal(S.getReference({ name: 'state', version: '0.9' }).entry.key, 'function:state');
  assert.throws(() => S.getReference({ name: 'state', version: '2.0' }), (e) => e instanceof S.ToolError && e.code === 'unsupported-version');
  assert.throws(() => S.getReference({ name: 'state', version: 'latest' }), (e) => e.code === 'invalid-version');
  assert.throws(() => S.getReference({ name: 'toggel' }), (e) => e.code === 'not-found' && e.data.suggestions.includes('toggle'));
});

// ---- search_docs -----------------------------------------------------------------------------

test('search is ranked, bounded and deterministic', () => {
  const top = (q, n = 3) => S.search(k.index, q, { limit: n }).map((r) => r.id);
  assert.ok(top('drag a card with the pointer').some((id) => id === 'rule:drag' || id === 'example:draggable-card'));
  assert.ok(top('persist theme across reloads').some((id) => id === 'declaration:persist' || id === 'example:persistent-preference'));
  assert.ok(top('move focus when a dialog opens', 5).some((id) => id === 'declaration:focus'));
  assert.ok(top('minifier removes empty rule', 5).some((id) => id === 'compat:minifiers' || id === 'mistake:empty-rule-minifier'));
  assert.ok(top('client-x').some((id) => id === 'expression:event' || id === 'mistake:type-mismatch-length'));
  assert.deepEqual(top('toggle'), top('toggle'));
  assert.equal(S.search(k.index, 'toggle', { limit: 2 }).length, 2);
  assert.equal(S.search(k.index, 'qwxzv blorf', {}).length, 0);
  const t = S.search(k.index, 'toggle', { limit: 10 });
  const first09 = t.findIndex((r) => r.id === 'mutation:toggle'), legacy = t.findIndex((r) => r.id === 'action:toggle');
  assert.ok(first09 >= 0 && (legacy < 0 || first09 < legacy), '0.9 toggle ranks above the legacy action');
  assert.ok(S.search(k.index, 'counter', { types: ['example'] }).every((r) => r.type === 'example'));
  for (const r of S.search(k.index, 'state', { limit: 10 })) assert.ok(r.snippet.length <= 240 && r.ref);
});

test('index terms keep CSS identifiers', () => {
  const t = S.terms('event(client-x) --attr-aria-expanded :on(click)');
  for (const x of ['event()', 'client-x', 'client', 'attr-aria-expanded', 'on()', 'click']) assert.ok(t.includes(x), x);
});

// ---- get_example -----------------------------------------------------------------------------

test('every topic of the brief has a real example that validates cleanly', async () => {
  const topics = ['counter', 'toggle', 'tabs', 'form binding', 'persistence', 'dom attributes', 'dom text', 'click coordinates', 'drag', 'focus and blur', 'state history', 'random values'];
  for (const topic of topics) {
    const ex = S.getExample({ topic });
    assert.ok(ex.css && ex.html, topic);
    const r = await S.validate(ex.css);
    assert.deepEqual(errs(r), [], `${topic} (${ex.id})`);
  }
  assert.equal(S.getExample({ id: 'counter', include: ['css'] }).html, undefined);
  assert.ok(S.getExample({}).examples.length >= 20);
  assert.throws(() => S.getExample({ id: 'qwxzv' }), (e) => e.code === 'not-found');
});

test('every example in the catalog compiles without diagnostics', async () => {
  for (const ex of k.examples) assert.deepEqual((await S.validate(ex.css)).diagnostics, [], ex.id);
});

// ---- curated knowledge is checked against the compiler ------------------------------------------

test('curated examples compile without errors or warnings', async () => {
  for (const c of [...Object.values(k.mutations), ...Object.values(k.modifiers)]) for (const css of c.examples) {
    const r = await S.validate(css);
    assert.deepEqual(errs(r), [], `${c.name}: ${css}`);
  }
});

test('registry examples of 0.9 APIs have no compiler errors', async () => {
  for (const e of k.registry.features) {
    const legacy = k.overlay[`${e.kind}:${e.name}`]?.legacy || e.kind === 'trigger' || e.kind === 'action';
    if (legacy || e.status !== 'stable' && e.status !== 'experimental') continue;
    for (const css of e.examples) {
      const r = await S.validate(css);
      assert.deepEqual(r.diagnostics.filter((d) => d.severity === 'error'), [], `${e.kind}:${e.name}: ${css}`);
    }
  }
});

test('every common mistake is caught, and its correction is clean', async () => {
  for (const m of k.mistakes) {
    const wrong = await S.validate(m.wrong);
    for (const c of m.codes) assert.ok(codes(wrong).some((x) => x.startsWith(c)), `${m.id}: expected ${c}, got ${codes(wrong).join(', ')}`);
    const right = await S.validate(m.right);
    assert.deepEqual(codes(right).filter((c) => !(m.rightCodes ?? []).includes(c)), [], `${m.id} (right form)`);
  }
});

test('the AGENTS.md / Skill syntax table compiles', async () => {
  const sheet = `.menu { --open: state(false); --count: state(0); --x: state(0px); --mode: state(light); --q: state(""); }
.menu > button:on(click) { --open: toggle(); }
.menu:on(keydown(Escape)) { --open: set(false); }
.menu:on(outside(click)) { --open: set(false); }
.menu a:on(click, prevent()) { --count: increment(1); }
.menu b:on(click, stop()) { --count: decrement(1); }
.menu i:on(click) { --x: set(event(client-x)); --mode: cycle(light, dark); }
.menu .card:on(drag(move)) { --x: set(event(x)); }
.menu:when(--open) > ul { display: block; opacity: when(--open, 1, 0); }
html { --theme: state("light", persist("theme")); }
input { --q: state("", bind(value)); }
input[type=checkbox] { --on: state(false, bind(checked)); }
.menu > button { --attr-aria-expanded: var(--open); }
.menu .value { content: var(--count); }
.dialog { --open: state(false); }
.dialog input { focus: when(--open); }
input:blur { outline: 2px solid; }
.menu .p { --prev: previous(--count); --dir: direction(--count); }
.menu .value:changed(--count) { color: red; }`;
  assert.deepEqual(errs(await S.validate(sheet)), []);
  for (const f of ['AGENTS.md', 'skills/reactive-css/SKILL.md']) {
    const md = readFileSync(join(PKG, f), 'utf8');
    assert.match(md, /Reactive CSS 0\.9\.1/, f);
    assert.match(md, /focus: when\(/, f);
    assert.doesNotMatch(md, /`on: click/, f); // legacy appears only in the mistakes table as "wrong"
  }
  assert.match(readFileSync(join(PKG, 'skills/reactive-css/SKILL.md'), 'utf8'), /^---\nname: reactive-css\ndescription: /);
});

// ---- validate_css ----------------------------------------------------------------------------

test('ordinary native CSS gives no diagnostics', async () => {
  const native = `@layer base, ui;
:root { --brand: oklch(60% 0.2 250); --set: 1; --toggle-size: 2rem; --gap: calc(1rem + 2px); }
@layer ui { .btn:hover, .btn:focus-visible { background: color-mix(in oklch, var(--brand), white 20%); } }
.card:has(:checked) { outline: 2px solid; }
details[open] > summary::after { content: "−"; }
.a::before { content: var(--brand-label, "x"); }
[popover]:popover-open { opacity: 1; @starting-style { opacity: 0; } }
@container (min-width: 30rem) { .grid { grid-template-columns: repeat(3, 1fr); } }
@media (prefers-reduced-motion: no-preference) { .x { transition: opacity 200ms; } }
.r { translate: random(0px, 100px, 10px) 0; width: if(media(width > 30rem): 10px; else: 20px); }
input:focus { outline-color: blue; } .n { animation: spin 1s infinite; }
@keyframes spin { to { rotate: 1turn; } }
@property --angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
.nest { color: red; & .child { color: blue; } &:hover { color: green; } }
@font-face { font-family: X; src: url(x.woff2) format("woff2"); }
/* :on(click) in a comment, --x: toggle() too */
.q { quotes: "«" "»"; content: "on: click(toggle(--x))"; }`;
  assert.deepEqual((await S.validate(native)).diagnostics, []);
});

test('diagnostics have stable codes, severity and 1-based ranges', async () => {
  const css = '.a { --o: state(false); }\n\n.a:on(click, once()) { --o: set(true); }';
  const [d] = (await S.validate(css)).diagnostics;
  assert.equal(d.severity, 'error');
  assert.match(d.code, /^RCSS-E\d{3}$/);
  assert.ok(k.diagnosticCodes[d.code]);
  assert.deepEqual(d.range.start, { line: 3, column: 1 });
  assert.equal(d.feature, 'events');
  assert.deepEqual(d.tags, ['removed-syntax']);
  // Library messages always map to a registry code.
  for (const m of k.mistakes) for (const x of (await S.validate(m.wrong)).diagnostics) assert.notEqual(x.code, 'RCSS-UNCODED', `${m.id}: ${x.message}`);
});

test('type checks follow the compiler\'s storable rules', async () => {
  const ok = async (css) => assert.deepEqual(codes(await S.validate(css)).filter((c) => c.startsWith('MCP-type') || c.startsWith('MCP-incompat')), [], css);
  const bad = async (css, code = 'MCP-type-mismatch') => assert.ok(codes(await S.validate(css)).includes(code), css);
  await ok('.p { --x: state(0px); } .p:on(click) { --x: set(event(client-x)); }');
  await ok('.p { --x: state(0in); } .p:on(click) { --x: set(event(client-x)); }'); // px converts to in
  await ok('.p { --x: state(0px); } .p:on(click) { --x: set(0); }'); // a unitless 0 fits a length
  await ok('.p { --b: state(false); } .p:on(click) { --b: set(1); }'); // 0 / 1 fit a boolean
  await ok('.p { --n: state(0); } .p:on(click) { --n: set(event(value-as-number)); }');
  await ok('.p { --n: state(0); } .p:on(drag) { --n: set(event(x)); }');
  await ok('.p { --x: state(attr(data-x, 0px)); } .p:on(click) { --x: set(event(client-x)); }');
  await ok('.p { --x: state(0px); } .p:on(click) { --x: set(calc(event(client-x) + 10px)); }');
  await bad('.p { --x: state(0); } .p:on(click) { --x: set(event(local-x)); }');
  await bad('.p { --x: state(0px); } .p:on(click) { --x: set(event(key)); }'.replace('click', 'keydown'));
  await bad('.p { --s: state(""); } .p:on(click) { --s: increment(1); }');
  await bad('.p { --n: state(0); } .p:on(click) { --n: set(2px); }');
  await bad('.p { --m: state(light); } .p:on(click) { --m: cycle(light, 2); }');
  await bad('.p { --x: state(0px); } .p:on(click) { --x: set(calc(event(client-x) + 10%)); }', 'MCP-incompatible-units');
});

test('ownership, placement and legacy checks', async () => {
  assert.ok(codes(await S.validate('.b:on(click) { --n: increment(1); }')).includes('MCP-no-state-owner'));
  assert.ok(!codes(await S.validate('.c { --n: state(0); } .c .b:on(click) { --n: increment(1); }')).includes('MCP-no-state-owner'));
  const legacy = await S.validate('.b { --o: state(false); on: click(toggle(--o)); text: var(--o); attr: aria-pressed var(--o); }');
  for (const c of ['MCP-legacy-on', 'MCP-legacy-text', 'MCP-legacy-attr']) assert.ok(codes(legacy).includes(c), c);
  assert.ok(legacy.diagnostics.every((d) => d.severity !== 'error'), 'legacy syntax still works: warnings, not errors');
  assert.ok(!codes(await S.validate('.g { --v: state(a); } .g input { bind: --v; }')).includes('MCP-legacy-bind'), 'bind: to an ancestor state is 0.9');
  assert.ok(codes(await S.validate('@import url(x.css);\n.a { color: red }')).includes('MCP-import-not-followed'));
});

test('a given bundle reports the syntax it lacks', async () => {
  const counter = S.getExample({ id: 'counter' }).css;
  const r = await S.validate(counter, { features: ['events'] });
  const missing = r.diagnostics.filter((d) => d.code === 'MCP-missing-feature');
  assert.deepEqual([...new Set(missing.map((d) => d.feature))], ['text']);
  assert.deepEqual((await S.validate(counter, { features: ['events', 'text'] })).diagnostics, []);
  assert.deepEqual((await S.validate(counter, { profile: 'full' })).diagnostics, []);
});

// ---- analyze_features and suggest_bundle ------------------------------------------------------

test('analysis and resolution match the library\'s bundle tools', { skip: !existsSync(join(LIB, 'tools/bundle.mjs')) && 'not in the monorepo' }, async () => {
  const tools = await import(pathToFileURL(join(LIB, 'tools/bundle.mjs')).href);
  for (const ex of k.examples) {
    const ours = await S.analyze(ex.css);
    const theirs = await tools.analyze([{ path: ex.id + '.css', text: ex.css }], { assumeComplete: true });
    assert.deepEqual(ours.features, theirs.features, ex.id);
    assert.deepEqual(ours.uses, theirs.uses, ex.id);
  }
  for (const m of k.mistakes) {
    const theirs = await tools.analyze([{ path: 'm.css', text: m.wrong }], { assumeComplete: true });
    assert.deepEqual((await S.analyze(m.wrong)).features, theirs.features, m.id);
    assert.deepEqual((await S.analyze(m.wrong)).legacy, theirs.files[0].legacy, m.id);
  }
  const selections = [
    ...Object.keys(k.catalog.profiles).map((profile) => ({ profile })),
    ...k.catalog.features.map((f) => ({ features: [f.id] })),
    { features: ['focus'], exclude: ['events'] }, { features: ['gestures', 'nope'] }, { exclude: ['core'] }, { profile: 'nope' }, { features: ['text', 'text'] },
  ];
  for (const sel of selections) assert.deepEqual(S.resolve(sel), tools.resolve(sel), JSON.stringify(sel));
  for (const key of ['decl:state', 'sel:on', 'trigger:click', 'mut:toggle', 'gesture:drag', 'decl:attr-ns', 'fn:when', 'decl:focus', 'nope:x']) assert.equal(S.featureOfKey(key), tools.featureOfKey(key), key);
});

test('analysis reports features, dependencies and legacy declarations', async () => {
  const a = await S.analyze('.d { --open: state(false); } .d input { focus: when(--open); } .b { on: click(toggle(--open)); }');
  assert.deepEqual(a.features, ['core', 'events', 'conditions', 'focus']);
  assert.ok(a.legacy.some((l) => l.syntax === 'on:'));
  const drag = await S.analyze('.c { --x: state(0px); } .c:on(drag) { --x: set(event(x)); }');
  assert.ok(drag.added.some((x) => x.id === 'events' && x.requiredBy === 'gestures') || drag.features.includes('events'));
});

test('suggest_bundle gives measured sizes only for measured feature sets', async () => {
  const [client, close] = await connect();
  const call = async (args) => (await client.callTool({ name: 'suggest_bundle', arguments: args })).structuredContent;
  const one = await call({ features: ['events'] });
  const measured = k.sizes.measured.find((m) => m.label === 'feature events');
  assert.deepEqual(one.features, ['core', 'events']);
  assert.equal(one.sizes.gzip, measured.sizes.gzip);
  const counter = await call({ css: S.getExample({ id: 'counter' }).css });
  assert.deepEqual(counter.features, ['core', 'events', 'text']);
  assert.equal(counter.sizes, null);
  assert.match(counter.sizesNote, /No estimate/);
  assert.match(counter.build, /--features events,text/);
  const full = await call({ profile: 'full' });
  assert.ok(full.sizes && full.recommendation.includes('prebuilt'));
  const bad = await client.callTool({ name: 'suggest_bundle', arguments: { features: ['focus'], exclude: ['events'] } });
  assert.equal(bad.isError, true);
  assert.equal(bad.structuredContent.error.code, 'invalid-selection');
  assert.equal((await client.callTool({ name: 'suggest_bundle', arguments: {} })).structuredContent.error.code, 'no-input');
  await close();
});

// ---- migrate_css -----------------------------------------------------------------------------

test('migration rewrites 0.8 syntax and keeps everything else', async () => {
  const src = `/* menu */
.menu { --open: state(false); color: red; }
.menu > button {
  padding: 4px; /* keep me */
  on: click(toggle(--open));
  attr: aria-expanded var(--open);
}
.d { on: key(Escape, set(--open, false)), outside(click, set(--open, false)); }
a.ask { on: click(prevent(), set(--asked, true)); }
.c { --n: state(0); on: click(increment(--n, 2), cycle(--m, a, b)); }
.c .v { text: var(--n); }
@media (min-width: 40em) {
  .w { on: click(toggle(--wide)); }
}
input.q { --q: state(""); bind: --q; }
input[type=checkbox] { --on: state(false); bind: --on; }
.group input { bind: --choice; }
`;
  const r = await S.migrate(src);
  const out = r.css;
  for (const s of ['.menu > button:on(click) { --open: toggle(); }', '--attr-aria-expanded: var(--open);', '.d:on(keydown(Escape)) { --open: set(false); }', '.d:on(outside(click)) { --open: set(false); }',
    'a.ask:on(click, prevent()) { --asked: set(true); }', '.c:on(click) { --n: increment(2); --m: cycle(a, b); }', 'content: var(--n);', '--q: state("", bind(value));', '--on: state(false, bind(checked));',
    '/* menu */', 'padding: 4px; /* keep me */', '.menu { --open: state(false); color: red; }', '.group input { bind: --choice; }']) assert.ok(out.includes(s), s);
  assert.doesNotMatch(out, /(^|[\s;{])(on|text|attr): |bind: --q|bind: --on/m);
  assert.match(out, /@media \(min-width: 40em\) \{\n  \.w \{ \}\n  \.w:on\(click\) \{ --wide: toggle\(\); \}\n\}/);
  assert.equal(r.wrote, false);
  assert.deepEqual(r.manual, []);
  assert.deepEqual(r.diagnostics.filter((d) => d.severity === 'error' || /^MCP-legacy/.test(d.code)), []);
  // Idempotent.
  assert.equal((await S.migrate(out)).changed, false);
});

test('migration lists unsafe cases for manual review instead of rewriting', async () => {
  const src = `.a { on: click(set(--x, 1, closest(.card))); }
.b { on: click(increment(--n), increment(--n)); }
.t { text: "Hello"; }
.r input[type=radio] { --v: state(a); bind: --v; }
.o:on(click, once()) { --d: set(true); }
.f:when(--open) { focus: true; }`;
  const r = await S.migrate(src);
  assert.deepEqual(r.manual.map((m) => m.kind).sort(), ['bind', 'focus', 'on', 'on', 'once', 'text']);
  assert.ok(r.css.includes('on: click(set(--x, 1, closest(.card)))'), 'closest() stays on:');
  assert.ok(r.css.includes('text: "Hello"'));
  assert.ok(r.manual.find((m) => m.kind === 'once').suggestion.includes(':when(not --done)'));
});

test('migration fixes syntax that never shipped', async () => {
  const r = await S.migrate('.d { --open: state(false); }\n.d input:focus(when(--open)) {}\n.d a:on(click, prevent, stop) { --open: toggle(); }');
  assert.ok(r.css.includes('.d input { focus: when(--open); }'));
  assert.ok(r.css.includes('.d a:on(click, prevent(), stop()) { --open: toggle(); }'));
  assert.deepEqual(r.diagnostics.filter((d) => d.severity === 'error'), []);
});

// ---- limits and errors -----------------------------------------------------------------------

test('large inputs are rejected or bounded, and tools return structured errors', async () => {
  const [client, close] = await connect();
  const big = '.a { color: red; }\n'.repeat(Math.ceil(S.LIMITS.css / 19) + 10);
  const tooBig = await client.callTool({ name: 'validate_css', arguments: { css: big } });
  assert.equal(tooBig.isError, true);
  assert.equal(tooBig.structuredContent.error.code, 'input-too-large');
  // Many diagnostics: capped.
  const many = Array.from({ length: 300 }, (_, i) => `.x${i}:on(nope${i}) { --a: set(1); }`).join('\n');
  const capped = (await client.callTool({ name: 'validate_css', arguments: { css: many } })).structuredContent;
  assert.equal(capped.diagnostics.length, S.LIMITS.diagnostics);
  assert.equal(capped.truncated.total, 300);
  // Near the limit, still answered quickly.
  const near = '.c { --n: state(0); } .c .b:on(click) { --n: increment(1); } .c .v { content: var(--n); }\n'.repeat(2500).slice(0, S.LIMITS.css - 100);
  const t = performance.now();
  const r = await client.callTool({ name: 'validate_css', arguments: { css: near } });
  assert.notEqual(r.isError, true);
  assert.ok(performance.now() - t < 5000);
  // Schema violations.
  const long = await client.callTool({ name: 'search_docs', arguments: { query: 'x'.repeat(S.LIMITS.query + 1) } });
  assert.equal(long.isError, true);
  const wrongType = await client.callTool({ name: 'get_api_reference', arguments: { name: 42 } });
  assert.equal(wrongType.isError, true);
  const notFound = await client.callTool({ name: 'get_api_reference', arguments: { name: 'qwxzv' } });
  assert.equal(notFound.structuredContent.error.code, 'not-found');
  // Hostile-looking CSS is only text.
  const hostile = await client.callTool({ name: 'validate_css', arguments: { css: '</style><script>process.exit(1)</script>{{{{((((("' } });
  assert.notEqual(hostile.isError, true);
  await close();
});

test('unbalanced and pathological CSS does not throw', async () => {
  for (const css of ['', '{', '}', '((((', '.a:on(', '.a:on(click', '.a { --x: state(', '/* unterminated', '"unterminated', '.a:on(click) { --x: set(calc(', ':on(click){}'.repeat(2000), '@media {'.repeat(500), '.a{'.repeat(3000)]) {
    await S.validate(css);
    await S.analyze(css);
    await S.migrate(css);
  }
});

async function connect() {
  const [a, b] = InMemoryTransport.createLinkedPair();
  const server = S.createServer();
  await server.connect(a);
  const client = new Client({ name: 'unit', version: '0' });
  await client.connect(b);
  return [client, async () => { await client.close(); await server.close(); }];
}
