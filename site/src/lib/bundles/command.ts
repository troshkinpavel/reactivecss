// The commands and configuration the bundle builder page generates. They use only what the
// library's CLI and API accept (../tools/reactive-css.mjs, ../tools/bundle.mjs);
// tests/e2e/bundle-cli.spec.ts runs them with the real CLI and runs the result in a browser.
import { CATALOG, PACKAGE, profileOf } from './catalog';

export interface BuildChoice {
  /** Explicitly selected features (requirements are added by the CLI itself). */
  selected: string[];
  /** Output file, relative to the project root. */
  out: string;
  format: 'iife' | 'esm';
  minify: boolean;
}

export const DEFAULT_OUT = 'public/reactive-css.min.js';
/** The default name for an unminified (development) build: not .min.js. */
export const DEFAULT_DEV_OUT = 'public/reactive-css.js';
/** Relative path ending in .js, made of characters that need no shell quoting. */
export const OUT_PATTERN = /^(?!\/)(?!.*\.\.)[\w.\/-]+\.js$/;
export const outError = (out: string) =>
  OUT_PATTERN.test(out) ? undefined : 'Use a relative path ending in .js, with letters, digits, ".", "_", "-" and "/" only.';

const BIN = Object.keys(PACKAGE.bin ?? {})[0] ?? 'reactive-css';

/**
 * CLI arguments. A selection equal to a profile uses `--profile`; no selection builds the core
 * alone, which the CLI accepts as `--features core` (it rejects an empty `--features`).
 */
export function buildArgs({ selected, out, format, minify }: BuildChoice): string[] {
  const ordered = CATALOG.map((f) => f.id).filter((id) => selected.includes(id));
  const profile = ordered.length ? profileOf(ordered) : undefined;
  return ['build', ...(profile ? ['--profile', profile] : ['--features', ordered.join(',') || 'core']), '--out', out,
    ...(format === 'esm' ? ['--format', 'esm'] : []), ...(minify ? [] : ['--no-minify'])];
}

export const buildCommand = (c: BuildChoice) => `npx ${BIN} ${buildArgs(c).join(' ')}`;

/** Installing the builder. Until the package is published, from a local `npm pack` of the library. */
export function installCommand(): string {
  const { name, version } = PACKAGE;
  if (PACKAGE.published) return `npm install --save-dev ${name}@${version} esbuild`;
  return [
    `# ${name} ${version} is not published yet. In a library checkout:`,
    'npm install && npm run build && npm pack',
    '# In your project (esbuild is an optional peer: add it too):',
    `npm install --save-dev path/to/${name.replace(/^@/, '').replace('/', '-')}-${version}.tgz esbuild`, // npm pack names a scoped tarball scope-name-version.tgz
  ].join('\n');
}

/** The same build through the programmatic API (`<package>/bundle`), as a script. */
export function configScript({ selected, out, format, minify }: BuildChoice): string {
  const ordered = CATALOG.map((f) => f.id).filter((id) => selected.includes(id));
  const config = { features: ordered.length ? ordered : ['core'], outfile: out, format, minify };
  return [
    '// build-reactive-css.mjs · run with: node build-reactive-css.mjs',
    `import { build } from '${PACKAGE.name}/bundle';`,
    '',
    `const result = await build(${JSON.stringify(config, null, 2)});`,
    'if (!result.ok) {',
    '  for (const e of result.errors) console.error(`${e.code}: ${e.message}`);',
    '  process.exit(1);',
    '}',
    "console.log(result.manifest.features.join(', '), result.manifest.sizes);",
  ].join('\n');
}

/** Where a page loads the output from: `public/x.js` is served as `/x.js` by most tools. */
export const publicUrl = (out: string) => (out.startsWith('public/') ? out.slice('public'.length) : out);

export function htmlSnippet({ out, format }: BuildChoice): { lang: 'html' | 'js'; code: string } {
  const src = publicUrl(out);
  if (format === 'esm') return { lang: 'js', code: `// in your own module script\nimport { start } from '${src.startsWith('/') ? src : './' + src}';\n\nstart();` };
  return { lang: 'html', code: `<script src="${src}" defer></script>` };
}
