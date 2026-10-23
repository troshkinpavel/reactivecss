// Runtime version consistency: the bundle the previews run, the registry the reference is built
// from, the library's package.json and its CHANGELOG must name the same release.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import runtime from '~/generated/runtime.json';
import registry from '~/generated/registry.json';
import { LIBRARY_VERSION } from '~/lib/content/reference';
import { LATEST } from '~/lib/content/engineering';

const changelog = readFileSync(new URL('../../../CHANGELOG.md', import.meta.url), 'utf8');
const bundle = readFileSync(new URL('../../public/runtime/reactive-css.min.js', import.meta.url), 'utf8');

describe('runtime version', () => {
  it('matches across package.json, describe(), the bundle and the site banner', () => {
    expect(runtime.registry).toBe(runtime.package);
    expect(registry.version).toBe(runtime.package);
    expect(bundle).toContain(`"${runtime.package}"`);
    expect(LIBRARY_VERSION).toBe(runtime.package);
  });
  it('is the release the homepage status line quotes', () => {
    expect(LATEST.version).toBe(runtime.package);
  });
  it('is the latest CHANGELOG entry', () => {
    expect(changelog.match(/^## (\d+\.\d+\.\d+)/m)?.[1]).toBe(runtime.package);
  });
});
