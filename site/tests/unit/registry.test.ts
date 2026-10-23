// The site documents what the library ships, per its own registry (describe()).
import { describe, expect, it } from 'vitest';
import registry from '~/generated/registry.json';
import { API, entryStatus, registryFeature } from '~/lib/content/reference';
import { highlightCss } from '~/lib/code/css';

describe('API reference vs feature registry', () => {
  it('documents every shipped feature', () => {
    const documented = new Set(API.flatMap((e) => e.features));
    const shipped = registry.features.filter((f) => f.status === 'stable' || f.status === 'experimental').map((f) => `${f.kind}:${f.name}`);
    expect(shipped.filter((k) => !documented.has(k as never))).toEqual([]);
  });

  it('only documents features the registry knows (closest() is a documented scope argument)', () => {
    const unknown = API.flatMap((e) => e.features).filter((k) => k !== 'scope:closest' && !registryFeature(k));
    expect(unknown).toEqual([]);
  });

  it('flags removed features and explains the removal', () => {
    for (const e of API.filter((x) => entryStatus(x).removedIn)) expect(e.removal, e.id).toBeTruthy();
    for (const e of API.filter((x) => x.removal)) expect(entryStatus(e).removedIn, e.id).toBeTruthy();
  });

  it('highlights 0.5 expressions only inside state() and set()', () => {
    const rx = (c: string) => highlightCss(c).flat().filter((t) => t.k === 'rx').map((t) => t.feature);
    expect(rx('.a { --m: state(attr(data-m)); }')).toEqual(['function:state', 'expression:attr']);
    expect(rx('.a { on: click(set(--m, pick(split(attr(data-x), "|")))); }')).toEqual(['declaration:on', 'trigger:click', 'action:set', 'expression:pick', 'expression:split', 'expression:attr']);
    expect(rx('.a::after { content: attr(data-label); }')).toEqual([]);
  });
});

describe('0.5.1–0.7 declarations and actions', () => {
  const rx = (c: string) => highlightCss(c).flat().filter((t) => t.k === 'rx').map((t) => t.feature);
  it('highlights text:, attr:, focus: and prevent() but not look-alike native properties', () => {
    expect(rx('.a { text-align: center; text: var(--n); }')).toEqual(['declaration:text']);
    expect(rx('.a { attr: disabled when(--n >= 10); focus: true; }')).toEqual(['declaration:attr', 'function:when', 'declaration:focus']);
    expect(rx('.a { on: key(ArrowRight, prevent(), toggle(--o)); }')).toEqual(['declaration:on', 'trigger:key', 'action:prevent', 'action:toggle']);
    expect(rx('.a { on: animationend(set(--s, false)); }')).toEqual(['declaration:on', 'trigger:animationend', 'action:set']);
  });
});
