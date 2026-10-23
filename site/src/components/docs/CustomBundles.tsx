import { useState, type ReactNode } from 'react';
import { CopyButton } from '~/components/ui/CopyButton';
import { API_FEATURE, CATALOG, PACKAGE, SIZES, STANDARD, resolve } from '~/lib/bundles/catalog';
import { DEFAULT_OUT, buildCommand } from '~/lib/bundles/command';
import { GLOSSARY } from '~/lib/content/glossary';

/* Custom Bundles guide (design-source/Custom Bundles.dc.html). Every fact comes from the library's
   catalog and size report (src/lib/bundles/); the commands and outputs are those of the synced library's CLI. */

const nf = new Intl.NumberFormat('en-US');
const builderLink = 'inline-flex h-[46px] items-center justify-center rounded-block px-[18px] text-[15px] font-medium no-underline';
const mono = 'font-mono text-label';

/** The two ways to choose features, the two actions, and the release facts. */
export function BundleIntro() {
  const ways = [
    ['Automatic · analyze', 'The analyzer reads the stylesheets and pages you pass it and lists the features they use.', 'reactive-css analyze'],
    ['Manual · select', 'You name features or a profile. Anything they require is added for you.', 'reactive-css build --features …'],
  ];
  const facts = ['Introduced in v0.8.0', 'CLI: reactive-css', 'Build time only · needs esbuild', 'Nothing loaded at runtime', 'Works under strict CSP'];
  return (
    <div className="mb-10 flex flex-col gap-6" data-bundle-intro="">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3">
        {ways.map(([title, text, cmd]) => (
          <div key={title} className="flex flex-col gap-2 rounded-block border border-line bg-paper-result p-4">
            <span className={`${mono} text-mute`}>{title}</span>
            <span className="text-[15px] leading-normal text-pretty text-ink-body">{text}</span>
            <code className="mt-auto font-mono text-[13px] text-ink">{cmd}</code>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2.5 min-[640px]:flex-row min-[640px]:flex-wrap">
        <a href="/bundle-builder/" className={`${builderLink} bg-ink text-on-ink hover:bg-ink-hover`}>Open Bundle Builder →</a>
        <a href="#quick-start" className={`${builderLink} border border-ink text-ink hover:bg-hover`}>Quick start ↓</a>
      </div>
      <ul aria-label="About this feature" className="m-0 flex list-none flex-wrap gap-2 p-0">
        {facts.map((f) => <li key={f} className="rounded-tag border border-line px-2 py-1 font-mono text-[12px] text-ink-2">{f}</li>)}
      </ul>
      <p className="m-0 max-w-(--container-prose) text-[15px] leading-[1.6] text-pretty text-ink-2">Start with the standard bundle. It contains every feature and needs no tooling. Build a custom one when its size matters.</p>
    </div>
  );
}

/**
 * The first build, as numbered steps. The path switch (analyze or choose) is native radios: both
 * versions of step 2 are in the page, and CSS shows the chosen one.
 */
export function QuickStart({ children }: { children: ReactNode }) {
  return (
    <div className="group/qs mb-10" data-quick-start="">
      <fieldset className="m-0 mb-6 inline-flex overflow-hidden rounded-block border border-ink p-0">
        <legend className="sr-only">Choose features by</legend>
        {[['analyze', 'Analyze my CSS'], ['select', 'Choose features']].map(([v, label], i) => (
          <label key={v} className={`flex h-9 cursor-pointer items-center px-3 text-[13.5px] has-checked:bg-ink has-checked:text-on-ink has-focus-visible:outline-2 has-focus-visible:-outline-offset-4 has-focus-visible:outline-paper ${i ? 'border-l border-ink' : ''}`}>
            <input type="radio" name="qs-path" value={v} defaultChecked={!i} className="sr-only" />{label}
          </label>
        ))}
      </fieldset>
      <ol className="m-0 list-none p-0 [counter-reset:qs]">{children}</ol>
    </div>
  );
}

/** One quick-start step. `path` marks a version of the step shown only for that choice. */
export function QuickStep({ title, path, children }: { title: string; path?: 'analyze' | 'select'; children: ReactNode }) {
  const only = path === 'select' ? 'hidden group-has-[[value=select]:checked]/qs:grid' : path === 'analyze' ? 'group-has-[[value=select]:checked]/qs:hidden' : '';
  return (
    // A hidden step (display: none) does not increment the counter, so the numbers stay right for either path.
    <li className={`group/st grid grid-cols-[32px_minmax(0,1fr)] gap-x-4 [counter-increment:qs] ${only}`} data-path={path}>
      <span aria-hidden="true" className="flex flex-col items-center">
        <span className="grid size-8 flex-none place-items-center rounded-full border border-ink font-mono text-[13px] font-semibold before:content-[counter(qs)]" />
        <span className="mt-1 w-px flex-1 bg-line group-last/st:bg-transparent" />
      </span>
      <div className="min-w-0 pb-7 group-last/st:pb-0 [&>*:last-child]:mb-0">
        <h3 className="m-0 mt-1 mb-2 text-[18px] font-semibold tracking-[-0.01em]">{title}</h3>
        {children}
      </div>
    </li>
  );
}

/**
 * Educational: pick features and see what the library's resolver adds. It uses the real catalog
 * (requires, optional) and writes the real CLI command; it builds nothing. The Bundle Builder builds the command with sizes and profiles.
 */
export function SelectionResolver({ initial = ['conditions', 'focus'] }: { initial?: string[] }) {
  const [sel, setSel] = useState<string[]>(initial);
  const r = resolve({ features: sel });
  const auto = new Map(r.added.map((a) => [a.id, a.requiredBy]));
  const picked = CATALOG.filter((f) => sel.includes(f.id)).map((f) => f.id);
  const cmd = buildCommand({ selected: picked, out: DEFAULT_OUT, format: 'iife', minify: true });
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <section aria-labelledby="resolver-title" className="mb-10 rounded-block border border-line bg-paper-result p-4 min-[640px]:p-5" data-resolver="">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="resolver-title" className="m-0 text-[17px] font-semibold">How a selection resolves</h3>
        <span className={`${mono} text-mute`}>illustration · the library’s catalog, nothing is built</span>
      </div>
      <div role="group" aria-label="Features" className="mb-4 flex flex-wrap gap-1.5">
        {CATALOG.filter((f) => f.id !== 'core').map((f) => {
          const on = sel.includes(f.id), by = !on && auto.get(f.id);
          return (
            <button key={f.id} type="button" aria-pressed={on} onClick={() => toggle(f.id)}
              className={`h-[34px] rounded-tag border px-[11px] font-mono text-[12.5px] ${on ? 'border-ink bg-ink text-on-ink' : by ? 'border-dashed border-rx text-rx-strong' : 'border-line text-ink hover:border-ink'}`}>
              {f.id}{by ? ' · auto' : ''}
            </button>
          );
        })}
      </div>
      <dl className="m-0 grid gap-x-6 gap-y-3 border-y border-line py-3.5 min-[760px]:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)]">
        <div><dt className={`${mono} text-mute`}>Always</dt><dd className="m-0 mt-1 font-mono text-[13px]">core</dd></div>
        <div><dt className={`${mono} text-mute`}>Selected by you</dt><dd className="m-0 mt-1 font-mono text-[13px]" aria-live="polite">{picked.length ? picked.join(', ') : <span className="text-mute">nothing yet · core only</span>}</dd></div>
        <div><dt className={`${mono} text-mute`}>Required automatically</dt><dd className="m-0 mt-1 font-mono text-[13px]" aria-live="polite">{r.added.length ? r.added.map((a) => <span key={a.id} className="block">{a.id} <span className="font-sans text-ink-2">required by {a.requiredBy}</span></span>) : <span className="text-mute">none</span>}</dd></div>
      </dl>
      {r.optionalMissing.length > 0 && (
        <p className="m-0 mt-3 text-sm text-ink-2">{r.optionalMissing.map((o) => `${o.id} is useful with ${o.usefulFor} but not required, so it is not added.`).join(' ')}</p>
      )}
      <div className="mt-3.5 overflow-hidden rounded-block border border-line bg-paper-2">
        <div className="flex h-[34px] items-center justify-between border-b border-line pr-1.5 pl-3.5"><span className={`${mono} text-ink-2`}>terminal · generated</span><CopyButton text={cmd} className="h-[26px]" /></div>
        <pre tabIndex={0} className="m-0 overflow-x-auto px-3.5 py-3 font-mono text-[12.5px] leading-[1.65]">{cmd}</pre>
      </div>
      <p className="m-0 mt-3 text-sm text-ink-2">Sizes, profiles and the analysis of pasted CSS are in the Bundle Builder. <a href="/bundle-builder/">Configure a real bundle →</a></p>
    </section>
  );
}

/** Reference pages for the APIs a feature provides, from the registry. */
const refsOf = (id: string) => [...new Map(Object.entries(API_FEATURE).filter(([, f]) => f === id).flatMap(([k]) => (GLOSSARY[k] ? [[GLOSSARY[k]!.href, GLOSSARY[k]!.label] as const] : []))).entries()];

/** Every feature as a native disclosure row: its syntax, requirements, status and reference pages. */
export function FeatureList() {
  return (
    <div className="mb-6 border-t border-ink" data-feature-list="">
      {CATALOG.map((f) => {
        const req = f.id === 'core' ? 'always included' : f.requires.filter((r) => r !== 'core');
        const refs = refsOf(f.id);
        return (
          <details key={f.id} name="feature" className="group border-b border-line open:bg-paper-band" data-feature={f.id}>
            <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 px-2 py-3 min-[640px]:grid-cols-[110px_minmax(0,1fr)_150px_16px] [&::-webkit-details-marker]:hidden">
              <code className="font-mono text-[13px] font-semibold">{f.id}</code>
              <span className="text-[14.5px] text-ink-body max-[639px]:col-span-2 max-[639px]:row-start-2">{f.title}{f.status === 'experimental' && <span className="ml-2 font-mono text-tag text-rx-strong">experimental</span>}</span>
              <span className={`hidden text-right font-mono text-xs min-[640px]:block ${typeof req !== 'string' && req.length ? 'text-rx-strong' : 'text-ink-2'}`}>{typeof req === 'string' ? 'always' : req.length ? `requires ${req.join(', ')}` : 'requires core'}</span>
              <span aria-hidden="true" className="font-mono text-mute group-open:hidden">+</span><span aria-hidden="true" className="hidden font-mono text-mute group-open:inline">−</span>
            </summary>
            <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-x-5 gap-y-3 px-2 pb-4 min-[640px]:pl-[134px]">
              <div className="col-span-full"><dt className={`${mono} text-mute`}>Syntax</dt><dd className="m-0 mt-1 font-mono text-[12.5px] leading-normal">{f.syntax.join(' · ')}</dd></div>
              <div><dt className={`${mono} text-mute`}>Requires</dt><dd className="m-0 mt-1 text-sm">{typeof req === 'string' ? 'nothing · always included' : ['core', ...req].join(', ')}</dd></div>
              {f.optional.length > 0 && <div><dt className={`${mono} text-mute`}>Useful with</dt><dd className="m-0 mt-1 text-sm">{f.optional.join(', ')} (never added automatically)</dd></div>}
              <div><dt className={`${mono} text-mute`}>Status</dt><dd className="m-0 mt-1 text-sm">{f.status}</dd></div>
              <div><dt className={`${mono} text-mute`}>Category</dt><dd className="m-0 mt-1 text-sm">{f.category}</dd></div>
              {refs.length > 0 && <div className="col-span-full"><dt className={`${mono} text-mute`}>Reference</dt><dd className="m-0 mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">{refs.map(([href, label]) => <a key={href} href={href} className="font-mono text-[12.5px]">{label}</a>)}</dd></div>}
            </dl>
          </details>
        );
      })}
    </div>
  );
}

const ROWS = [['core', 'Core', 'core only'], ['basic', 'Basic', 'basic profile'], ['full', 'Full custom', 'every feature, built with the CLI'], ['dist full', 'Standard full', 'reactive-css.min.js']] as const;
const METRICS = [['minified', 'minified'], ['gzip', 'gzip'], ['brotli', 'brotli']] as const;
/** One metric's bars at a time, by the checked radio. Literal classes, so Tailwind finds them. */
const SHOW = {
  minified: 'contents group-has-[[value=gzip]:checked]/sz:hidden group-has-[[value=brotli]:checked]/sz:hidden',
  gzip: 'hidden group-has-[[value=gzip]:checked]/sz:contents',
  brotli: 'hidden group-has-[[value=brotli]:checked]/sz:contents',
};

/** Measured sizes as bars, one metric at a time (native radios). Only the report's builds have exact sizes. */
export function SizeBars() {
  const rows = ROWS.map(([name, label, sub]) => ({ label, sub, m: SIZES.measured.find((x) => x.name === name)! }));
  return (
    <figure className="group/sz m-0 mb-6 rounded-block border border-line bg-paper-result p-4 min-[640px]:p-5" data-size-bars="">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <figcaption className={`${mono} text-mute`}>v{SIZES.version} · measured · bytes</figcaption>
        <fieldset className="m-0 inline-flex overflow-hidden rounded-block border border-line p-0">
          <legend className="sr-only">Measurement</legend>
          {METRICS.map(([k, label], i) => (
            <label key={k} className={`flex h-[30px] cursor-pointer items-center px-2.5 font-mono text-[12px] has-checked:bg-ink has-checked:text-on-ink has-focus-visible:outline-2 has-focus-visible:-outline-offset-4 has-focus-visible:outline-paper ${i ? 'border-l border-line' : ''}`}>
              <input type="radio" name="size-metric" value={k} defaultChecked={!i} className="sr-only" />{label}
            </label>
          ))}
        </fieldset>
      </div>
      <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
        {rows.map(({ label, sub, m }) => (
          <li key={label} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5 min-[640px]:grid-cols-[180px_minmax(0,1fr)_96px]">
            <span className="flex flex-col"><span className="text-[14.5px] font-semibold">{label}</span><span className="text-[13px] text-ink-2">{sub}</span></span>
            {METRICS.map(([k]) => {
              return (
                <span key={k} className={SHOW[k]}>
                  <span aria-hidden="true" className="h-3 self-center rounded-[1px] bg-line max-[639px]:col-span-2 max-[639px]:row-start-2"><span className={`block h-full rounded-[1px] ${label === 'Standard full' ? 'bg-ink-2' : 'bg-ink'}`} style={{ width: `${(m[k] / STANDARD[k]) * 100}%` }} /></span>
                  <span className="text-right font-mono text-[13px] whitespace-nowrap max-[639px]:col-start-2 max-[639px]:row-start-1">{nf.format(m[k])}</span>
                </span>
              );
            })}
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** A secondary reference block, collapsed: a native disclosure with a title and a short summary. */
export function Disclosure({ title, sub, open, children }: { title: string; sub?: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group border-b border-line [&:first-of-type]:border-t">
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5"><span className="text-[16px] font-semibold">{title}</span>{sub && <span className={`${mono} text-mute`}>{sub}</span>}</span>
        <span aria-hidden="true" className="font-mono text-mute group-open:hidden">+</span><span aria-hidden="true" className="hidden font-mono text-mute group-open:inline">−</span>
      </summary>
      <div className="pb-5 [&>*:last-child]:mb-0">{children}</div>
    </details>
  );
}

/** The design's one-line statement under a section heading. */
export function Lead({ children }: { children: ReactNode }) {
  return <p className="-mt-1.5 mb-5 max-w-(--container-prose) text-[clamp(18px,2vw,21px)] leading-[1.3] font-medium tracking-[-0.015em] text-balance text-ink-2">{children}</p>;
}

/** Question and answer pairs. */
export function Faq({ children }: { children: ReactNode }) {
  return <dl className="m-0 mb-8 border-t border-ink [&>div]:border-b [&>div]:border-line [&>div]:py-4">{children}</dl>;
}
export function FaqItem({ q, children }: { q: string; children: ReactNode }) {
  return <div><dt className="mb-1.5 text-[16px] font-semibold">{q}</dt><dd className="m-0 text-[15px] leading-[1.6] text-pretty text-ink-body [&>p]:m-0">{children}</dd></div>;
}
