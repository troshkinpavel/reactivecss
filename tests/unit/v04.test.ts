import { describe, it, expect, beforeEach } from 'vitest';
import { compile, diagnostics, describe as info } from '../../src/index';

beforeEach(() => { diagnostics.length = 0; });

describe('element()', () => {
  it('claims only element(width|height); element(#id) stays native, silently', () => {
    const c = compile(`.a { --w: element(width); --h: element( HEIGHT ); background-image: element(#hero) }`);
    expect(c.css).toMatch(/--w: var\(--rcss-\w+\); --h: var\(--rcss-\w+\); background-image: element\(#hero\)/);
    expect(c.rules[0].decls.map((d) => d.call.data)).toEqual(['width', 'height']);
    expect(diagnostics).toEqual([]);
  });
});

describe('feature registry 0.4', () => {
  it('records every 0.4 decision with a reason, and only shipped features as stable or experimental', () => {
    const f = info().features;
    const byName = (n: string) => f.filter((x) => x.name === n);
    expect(byName('element')[0]).toMatchObject({ status: 'experimental', evaluation: 'source' });
    expect(byName('wave')[0]).toMatchObject({ status: 'removed', removedIn: '0.5' }); // see v05.test.ts
    for (const n of ['map', 'distance', 'smooth']) expect(byName(n)[0]).toMatchObject({ status: 'rejected' });
    for (const n of ['spring', 'throttle', 'debounce', 'history']) expect(byName(n)[0]).toMatchObject({ status: 'planned' });
    for (const x of f) if (x.status === 'planned' || x.status === 'rejected' || x.status === 'removed') expect(x.reason, x.name).toBeTruthy();
    for (const x of f) expect(x.description, x.name).toBeTruthy();
  });
});
