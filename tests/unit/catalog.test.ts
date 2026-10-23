// 0.8.0: the feature catalog is consistent with the runtime and the API registry; dependencies
// are real (each feature builds alone with only what it declares); resolver and analyzer behave.
import { describe, it, expect } from 'vitest';
import { describe as info, FEATURES } from '../../src/index';
import { runtimes, functions, selectors, actions } from '../../src/core/registry';
import { CATALOG, PROFILES } from '../../src/features/catalog';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error: plain ESM tooling, no type declarations
import { featureOfKey, keyOfApiEntry, resolve, build, analyze } from '../../tools/bundle.mjs';

describe('catalog consistency', () => {
  it('every registered function, selector and action belongs to exactly one feature', () => {
    const keys = [...[...functions.keys()].map((n) => 'fn:' + n), ...[...selectors.keys()].map((n) => 'sel:' + n), ...[...actions.keys()].map((n) => 'act:' + n)];
    for (const k of keys) {
      const owners = CATALOG.filter((f) => f.provides.some((p) => p === k || (p.endsWith(':*') && k.startsWith(p.slice(0, -1)))));
      expect(owners.map((f) => f.id), k).toHaveLength(1);
    }
  });

  it('every stable or experimental API registry entry belongs to a feature', () => {
    for (const e of FEATURES.filter((x) => x.status === 'stable' || x.status === 'experimental')) {
      const k = keyOfApiEntry(e);
      expect(k && featureOfKey(k), `${e.kind} ${e.name}`).toBeTruthy();
    }
  });

  it('every declaration runtime is registered by the full build', () => {
    expect(Object.keys(runtimes).sort()).toEqual(['attrBinding', 'attrs', 'bind', 'focus', 'gestures', 'on', 'onRules', 'persist', 'text', 'typed']);
  });

  it('requirements exist, are acyclic, and every feature but core requires core', () => {
    const ids = new Set(CATALOG.map((f) => f.id));
    for (const f of CATALOG) {
      for (const r of [...f.requires, ...f.optional]) expect(ids.has(r), `${f.id} → ${r}`).toBe(true);
      if (f.id !== 'core') expect(f.requires).toContain('core');
      const seen = new Set<string>();
      const walk = (id: string) => { if (seen.has(id)) return; seen.add(id); CATALOG.find((x) => x.id === id)!.requires.forEach(walk); };
      f.requires.forEach(walk);
      expect(seen.has(f.id), `cycle through ${f.id}`).toBe(false);
    }
    for (const [name, list] of Object.entries(PROFILES)) for (const id of list) expect(ids.has(id), `${name}: ${id}`).toBe(true);
  });

  it('describe() keeps its shape and adds bundle (null when built from source)', () => {
    const d = info();
    expect(Object.keys(d)).toEqual(['bundle', 'version', 'features', 'keepNative', 'functions', 'selectors', 'actions', 'expressions', 'events', 'outsideEvents', 'actionExpressions', 'onEvents']);
    expect(d.bundle).toBe(null);
  });
});

describe('dependencies are real: each feature builds alone with only its declared requirements', () => {
  const coreModules = (m: string) => /^src\/(core\/|api\.ts|state\/(state|values|expr|bindattr|textof|keys)\.ts)/.test(m);
  for (const f of CATALOG.filter((x) => x.id !== 'core')) {
    it(f.id, async () => {
      const r = await build({ features: [f.id], minify: false, format: 'esm' });
      expect(r.ok).toBe(true);
      const allowed = new Set(r.manifest.features.flatMap((id: string) => CATALOG.find((x) => x.id === id)!.modules.map((m) => 'src/' + m)));
      for (const m of r.manifest.modules as string[]) {
        if (coreModules(m) || m.startsWith('src/features/')) continue;
        expect(allowed.has(m), `${f.id} pulled ${m}`).toBe(true);
      }
    }, 30000);
  }

  it('core alone contains no feature module', async () => {
    const r = await build({ features: [], minify: false, format: 'esm' });
    expect(r.manifest.features).toEqual(['core']);
    expect((r.manifest.modules as string[]).filter((m) => !coreModules(m))).toEqual([]);
  }, 30000);
});

describe('resolver', () => {
  it('adds requirements and explains them; reports optional ones', () => {
    const r = resolve({ features: ['focus', 'history'] });
    expect(r.features).toEqual(['core', 'events', 'history', 'focus']);
    expect(r.added).toEqual([{ id: 'events', requiredBy: 'focus' }]);
    expect(r.optionalMissing).toEqual([{ id: 'forms', usefulFor: 'focus' }]);
  });

  it('rejects unknown features (with a suggestion), conflicts, excluded core, unknown profiles', () => {
    expect(resolve({ features: ['evnts'] }).errors[0]).toMatchObject({ code: 'unknown-feature', feature: 'evnts' });
    expect(resolve({ features: ['evnts'] }).errors[0].message).toMatch(/Did you mean "events"/);
    expect(resolve({ features: ['focus'], exclude: ['events'] }).errors[0]).toMatchObject({ code: 'conflict', feature: 'events' });
    expect(resolve({ features: ['text'], exclude: ['core'] }).errors.map((e: any) => e.code)).toContain('core-required');
    expect(resolve({ profile: 'nope' }).errors[0].code).toBe('unknown-profile');
  });

  it('equal selections give identical bundles (catalog order)', async () => {
    const a = await build({ features: ['text', 'events'] }), b = await build({ features: ['events', 'text', 'events'] });
    expect(a.code).toBe(b.code);
  }, 30000);
});

describe('analyzer (real compiler)', () => {
  const run = (text: string, extra: { path: string; text: string }[] = []) => analyze([{ path: 'a.css', text }, ...extra]);

  it('nested calls, @media, @layer, comments, strings and native look-alikes', async () => {
    const a = await run(`
      /* live(1s) in a comment, :when( in a comment */
      .x::before { content: "random(1, 2) and :nth-var(--a)"; background: element(#native); width: attr(data-w px, 10px); }
      @layer base { @media (min-width: 1px) { .y { translate: calc(live(random(0px, 9px), 1s) * 2) 0; } } }
      .z { --n: state(0); on: key(ArrowDown, prevent(), increment(--n)); }
      .z:changed(--n) .w { text: previous(--n); }`);
    expect(a.used.sort()).toEqual(['dynamic', 'events', 'history', 'text', 'values']);
    expect(a.uses).not.toContain('fn:element');
    expect(a.complete).toBe(true);
    expect(a.recommended.features.sort()).toEqual(['dynamic', 'events', 'history', 'text', 'values']);
  });

  it('multiple stylesheets add up; focus pulls events', async () => {
    const a = await run('.a h2 { focus: when(--s == 2) }', [{ path: 'b.css', text: '.a { --s: state(1) } .a h2:nth-var(--s) { color: red }' }]);
    expect(a.used.sort()).toEqual(['conditions', 'focus', 'nth-var']);
    expect(a.features).toEqual(['core', 'events', 'conditions', 'nth-var', 'focus']);
    expect(a.added).toEqual([{ id: 'events', requiredBy: 'focus' }]);
  });

  it('@import and unreadable inputs make the analysis incomplete: the recommendation is the full runtime', async () => {
    const a = await run('@import url(other.css); .a { --n: state(0) }');
    expect(a.complete).toBe(false);
    expect(a.recommended).toEqual({ profile: 'full', reason: 'analysis incomplete (see notes)' });
    const b = await analyze(['does-not-exist.css']);
    expect(b.complete).toBe(false);
  });

  it('root-relative links resolve against an explicit root only, never a guessed location', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rcss-root-'));
    mkdirSync(join(dir, 'shared')); mkdirSync(join(dir, 'page'));
    writeFileSync(join(dir, 'shared/base.css'), '.a { --open: state(false) } .a:when(--open) b { color: red }');
    writeFileSync(join(dir, 'page/index.html'), '<link rel="stylesheet" href="/shared/base.css?v=2"><style>.a button { on: click(toggle(--open)) }</style>');
    const page = join(dir, 'page/index.html');
    // Without a root: not analyzed, said so, and the recommendation is the full runtime.
    const a = await analyze([page]);
    expect(a.notes.map((n: { code: string }) => n.code)).toEqual(['root-relative-link']);
    expect(a.complete).toBe(false);
    expect(a.recommended.profile).toBe('full');
    // With the root: the linked sheet is analyzed (query string ignored) and the analysis is complete.
    const b = await analyze([page], { root: dir });
    expect(b.complete).toBe(true);
    expect(b.used.sort()).toEqual(['conditions', 'events']);
    // A missing file under the root, or a path escaping it, is reported and incomplete.
    writeFileSync(join(dir, 'page/index.html'), '<link rel="stylesheet" href="/nope.css"><link rel="stylesheet" href="/../../etc/x.css">');
    const c = await analyze([page], { root: dir });
    expect(c.complete).toBe(false);
    expect(c.notes.map((n: { message: string }) => n.message).join('\n')).toMatch(/nope\.css was not found under the root/);
    const d = await analyze([page], { root: join(dir, 'not-a-folder') });
    expect(d.notes[0]).toMatchObject({ code: 'missing-file' });
  });

  it('reports what the compiler reports (diagnostics per file)', async () => {
    const a = await run('.a { on: click(nope()) }');
    expect(a.files[0].diagnostics.join('\n')).toMatch(/unknown action "nope\(\)"/);
  });
});
