import { useEffect, useId, useState } from 'react';
import { CopyButton } from '~/components/ui/CopyButton';
import { SegmentedControl } from '~/components/ui/SegmentedControl';
import { Tag } from '~/components/ui/Tag';
import { analyzeCss, type Analysis } from '~/lib/bundles/analyzer';
import { CATALOG, PACKAGE, PROFILES, STANDARD, demosFor, featureById, measuredFor, profileOf, resolve, type MeasuredBundle, type Resolved } from '~/lib/bundles/catalog';
import { DEFAULT_DEV_OUT, DEFAULT_OUT, buildCommand, configScript, htmlSnippet, installCommand, outError, type BuildChoice } from '~/lib/bundles/command';

/** Reference pages per feature, computed by the page at build time (keeps the API prose out of this island). */
export type FeatureRefs = Record<string, { name: string; href: string }[]>;

const title = (id: string) => featureById(id)?.title ?? id;
const nf = new Intl.NumberFormat('en-US');
const CATEGORIES = [...new Set(CATALOG.map((f) => f.category))];
const PROFILE_LABEL: Record<string, string> = { basic: 'Basic interactions', forms: 'Forms', 'stateful-ui': 'Stateful interfaces', interactive: 'Interactive widgets', dynamic: 'Dynamic values', full: 'Full runtime' };
const panel = 'rounded-block border border-line bg-paper';
const panelHead = 'flex min-h-[38px] items-center justify-between gap-3 border-b border-line px-3.5 py-2 font-mono text-label text-ink-2';

// ---- presets ----------------------------------------------------------------------------------

export function PresetPicker({ selected, onPick, onReset }: { selected: string[]; onPick: (profile: string) => void; onReset: () => void }) {
  const current = selected.length ? profileOf(selected) : undefined;
  return (
    <div role="group" aria-label="Profiles" className="flex flex-wrap gap-2">
      {Object.entries(PROFILES).map(([p, list]) => (
        <button key={p} type="button" aria-pressed={current === p} onClick={() => onPick(p)} data-profile={p}
          className="flex min-h-11 flex-col items-start gap-0.5 rounded-block border border-line bg-paper px-3 py-1.5 text-left hover:border-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink">
          <span className="text-[14px] font-medium">{PROFILE_LABEL[p] ?? p}</span>
          <span className="font-mono text-tag opacity-80">{p === 'full' ? 'every feature' : list.join(' · ')}</span>
        </button>
      ))}
      <button type="button" onClick={onReset} className="min-h-11 rounded-block border border-dashed border-line-dashed bg-transparent px-3 text-[14px] hover:border-ink">Reset</button>
    </div>
  );
}

// ---- features ---------------------------------------------------------------------------------

/** Native checkboxes, grouped by category. Required features are checked and locked, and say why. */
export function FeatureSelector({ selected, resolved, refs = {}, onToggle }: { selected: string[]; resolved: Resolved; refs?: FeatureRefs; onToggle: (id: string) => void }) {
  const uid = useId();
  const requiredBy = (id: string) => resolved.added.find((a) => a.id === id)?.requiredBy;
  return (
    <fieldset className={`${panel} m-0 min-w-0 p-0`}>
      <legend className="visually-hidden">Features</legend>
      <div className={panelHead} aria-hidden="true"><span>Features</span><span>{selected.length} selected · {resolved.features.length} of {CATALOG.length} included</span></div>
      {CATEGORIES.map((cat) => (
        <div key={cat} role="group" aria-labelledby={`${uid}-${cat}`} className="border-b border-line last:border-b-0">
          <div id={`${uid}-${cat}`} className="px-3.5 pt-3 font-mono text-tag text-mute">{cat}</div>
          {CATALOG.filter((f) => f.category === cat).map((f) => {
            const core = f.id === 'core';
            const by = requiredBy(f.id);
            const locked = core || (!!by && !selected.includes(f.id));
            const checked = core || selected.includes(f.id) || !!by;
            const note = core ? 'Always included: compiler, state engine and scheduler.' : locked ? `Included automatically: required by ${title(by!)}.` : '';
            const deps = f.requires.filter((r) => r !== 'core');
            return (
              <div key={f.id} data-feature={f.id} data-state={core ? 'core' : locked ? 'required' : checked ? 'selected' : 'off'} className="px-3.5 py-3">
                {/* The label is the name only; syntax and requirements are its description. */}
                <label className="flex cursor-pointer items-baseline gap-3 has-disabled:cursor-default">
                  <input type="checkbox" checked={checked} disabled={locked} onChange={() => onToggle(f.id)} aria-describedby={note || (!core && deps.length > 0) || f.optional.length > 0 ? `${uid}-${f.id}-d` : undefined}
                    className="size-[18px] flex-none translate-y-[3px] accent-ink" />
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-[15px] font-semibold">{f.title}</span>
                    <span className="font-mono text-tag text-mute">{f.id}</span>
                    {f.status === 'experimental' && <Tag tone="experimental">experimental</Tag>}
                  </span>
                </label>
                {(note || (!core && deps.length > 0) || f.optional.length > 0) && (
                  <div id={`${uid}-${f.id}-d`} className="mt-1 ml-[30px] flex flex-col gap-1">
                    {note && <span className="text-sm text-rx-strong">{note}</span>}
                    {!core && deps.length > 0 && <span className="text-sm text-ink-2">Requires {deps.map(title).join(', ')}.</span>}
                    {f.optional.length > 0 && <span className="text-sm text-ink-2">Works with {f.optional.map(title).join(', ')} (optional, not added).</span>}
                  </div>
                )}
                {/* Syntax and reference links on demand: one tab stop per feature instead of up to nine. */}
                <details className="group mt-1 ml-[30px]" data-feature-details>
                  <summary className="w-fit cursor-pointer list-none font-mono text-tag text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
                    <span aria-hidden="true" className="group-open:hidden">+ </span><span aria-hidden="true" className="hidden group-open:inline">− </span>Syntax and reference
                  </summary>
                  <div className="mt-1.5 flex flex-col gap-1.5">
                    <span className="font-mono text-label text-ink-2 [overflow-wrap:anywhere]">{f.syntax.join(' · ')}</span>
                    {refs[f.id]?.length ? (
                      <p className="m-0 flex flex-wrap gap-x-2.5 gap-y-1 text-sm">
                        <span className="text-mute">Reference:</span>
                        {refs[f.id]!.map((r) => <a key={r.href} href={r.href} className="font-mono text-label">{r.name}</a>)}
                      </p>
                    ) : null}
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      ))}
    </fieldset>
  );
}

// ---- summary ----------------------------------------------------------------------------------

function SizeComparison({ m }: { m: MeasuredBundle }) {
  const rows = [['minified', m.minified, STANDARD.minified], ['gzip', m.gzip, STANDARD.gzip], ['brotli', m.brotli, STANDARD.brotli]] as const;
  return (
    <table className="w-full border-collapse text-left text-[14px]">
      <caption className="pb-2 text-left font-mono text-tag text-mute">Measured: this bundle vs reactive-css.min.js, same metric per row</caption>
      <thead><tr className="border-b border-ink font-mono text-tag text-mute"><th className="py-1.5 font-normal">Bytes</th><th className="py-1.5 text-right font-normal">This bundle</th><th className="py-1.5 text-right font-normal">Standard</th><th className="py-1.5 text-right font-normal">Difference</th></tr></thead>
      <tbody>
        {rows.map(([k, a, b]) => (
          <tr key={k} className="border-b border-line">
            <th scope="row" className="py-2 font-mono text-label font-normal">{k}</th>
            <td className="py-2 text-right font-mono text-label">{nf.format(a)}</td>
            <td className="py-2 text-right font-mono text-label">{nf.format(b)}</td>
            <td className="py-2 text-right font-mono text-label">{a === b ? '0' : `${a < b ? '−' : '+'}${nf.format(Math.abs(b - a))} (${Math.round((Math.abs(b - a) / b) * 100)} %)`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BundleSummary({ selected, resolved }: { selected: string[]; resolved: Resolved }) {
  const measured = measuredFor(resolved.features);
  const demos = demosFor(resolved.features);
  return (
    <section aria-labelledby="summary-title" className={`${panel} flex flex-col gap-4 p-4`} data-summary>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="summary-title" className="m-0 text-[17px] font-semibold">Your bundle</h2>
        <span className="font-mono text-tag text-mute">Not built yet: the page generates the command, the CLI builds</span>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[14px]">
        <dt className="text-mute">Selected</dt>
        <dd className="m-0" data-selected>{selected.length ? selected.map(title).join(', ') : 'Nothing: the core alone'}</dd>
        <dt className="text-mute">Included</dt>
        <dd className="m-0 font-mono text-label" data-included>{resolved.features.join(' · ')}</dd>
        {resolved.added.length > 0 && <>
          <dt className="text-mute">Added</dt>
          <dd className="m-0" data-added>{resolved.added.map((a) => `${title(a.id)} (required by ${title(a.requiredBy)})`).join(', ')}</dd>
        </>}
        {resolved.optionalMissing.length > 0 && <>
          <dt className="text-mute">Optional</dt>
          <dd className="m-0">{resolved.optionalMissing.map((o) => `${title(o.id)} also works with ${title(o.usefulFor)}; not added`).join('. ')}</dd>
        </>}
      </dl>
      <div data-size aria-live="polite">
        {measured ? <SizeComparison m={measured} /> : (
          <p className="m-0 rounded-block border border-dashed border-line-dashed px-3.5 py-3 text-[14px] leading-[1.55] text-ink-2">
            <strong className="font-semibold text-ink">Exact size available after building.</strong> This combination has not been measured, and feature sizes do not add up, so no estimate is shown. The CLI prints the minified, gzip and brotli size and writes them to the manifest.
          </p>
        )}
      </div>
      {demos.length > 0 && (
        <div className="flex flex-col gap-1.5 text-[14px]">
          <span className="text-mute">Library demos that need only these features ({demos.length})</span>
          <span className="flex flex-wrap gap-x-3 gap-y-1">{demos.map((d) => <a key={d.name} href={`/examples/${d.name}/`} className="font-mono text-label">{d.name}</a>)}</span>
        </div>
      )}
    </section>
  );
}

// ---- output -----------------------------------------------------------------------------------

function Output({ label, code, copyLabel }: { label: string; code: string; copyLabel: string }) {
  return (
    <div className="overflow-hidden rounded-block border border-line bg-paper-2" data-output={label}>
      <div className={`${panelHead} bg-paper`}><span>{label}</span><CopyButton text={code} ariaLabel={copyLabel} /></div>
      <pre tabIndex={0} aria-label={label} className="m-0 overflow-x-auto px-3.5 py-3 font-mono text-[13px] leading-[1.7] text-ink"><code>{code}</code></pre>
    </div>
  );
}

export function ConfigOutput({ choice, onChange }: { choice: BuildChoice; onChange: (c: BuildChoice) => void }) {
  const uid = useId();
  const [draft, setDraft] = useState(choice.out);
  const error = outError(draft);
  const html = htmlSnippet(choice);
  return (
    <section aria-labelledby="output-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="output-title" className="m-0 text-[17px] font-semibold">Build it</h2>
        <span className="font-mono text-tag text-mute">{PACKAGE.name} {PACKAGE.version} · CLI and API</span>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5">
          <label htmlFor={`${uid}-out`} className="text-sm text-ink-2">Output file</label>
          <input id={`${uid}-out`} value={draft} spellCheck={false} aria-invalid={!!error} aria-describedby={error ? `${uid}-err` : undefined}
            onChange={(e) => { setDraft(e.target.value); if (!outError(e.target.value)) onChange({ ...choice, out: e.target.value }); }}
            className="h-10 w-full rounded-block border border-line bg-paper px-3 font-mono text-[13px] aria-[invalid=true]:border-rx" />
        </div>
        <SegmentedControl label="Format" size="sm" value={choice.format} onChange={(format) => onChange({ ...choice, format })}
          options={[{ value: 'iife', label: 'Script tag' }, { value: 'esm', label: 'ES module' }]} />
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={!choice.minify} className="size-4 accent-ink" onChange={(e) => {
            // A default output name follows the build: an unminified file is not called .min.js.
            const dev = e.target.checked;
            const out = dev && choice.out === DEFAULT_OUT ? DEFAULT_DEV_OUT : !dev && choice.out === DEFAULT_DEV_OUT ? DEFAULT_OUT : choice.out;
            setDraft(out);
            onChange({ ...choice, minify: !dev, out });
          }} />
          Development build
        </label>
      </div>
      {error && <p id={`${uid}-err`} role="alert" className="m-0 -mt-2 text-sm text-rx-strong">{error} The commands below still use {choice.out}.</p>}
      <Output label="1 · Install" code={installCommand()} copyLabel="Copy install commands" />
      <Output label="2 · Build" code={buildCommand(choice)} copyLabel="Copy build command" />
      <Output label={html.lang === 'html' ? '3 · Load it' : '3 · Import it'} code={html.code} copyLabel="Copy loading code" />
      <details className="rounded-block border border-line">
        <summary className="cursor-pointer px-3.5 py-2.5 text-sm">The same build through the API (Node script)</summary>
        <div className="p-3 pt-0"><Output label="build-reactive-css.mjs" code={configScript(choice)} copyLabel="Copy build script" /></div>
      </details>
    </section>
  );
}

// ---- analyzer ---------------------------------------------------------------------------------

export function AnalyzerPanel({ onApply, analyze = analyzeCss }: { onApply: (features: string[]) => void; analyze?: (css: string) => Promise<Analysis> }) {
  const uid = useId();
  const [css, setCss] = useState('');
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'done' | 'failed'; result?: Analysis; error?: string }>({ status: 'idle' });
  const run = async () => {
    setState({ status: 'loading' });
    try { setState({ status: 'done', result: await analyze(css) }); } catch (e) { setState({ status: 'failed', error: (e as Error).message }); }
  };
  const r = state.result;
  return (
    <section aria-labelledby={`${uid}-t`} className="flex flex-col gap-3 rounded-block border border-dashed border-line-dashed p-4" data-analyzer>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${uid}-t`} className="m-0 text-[17px] font-semibold">Analyze my CSS</h2>
        <span className="font-mono text-tag text-mute">the library’s compiler, in this page · nothing is sent</span>
      </div>
      <label htmlFor={`${uid}-css`} className="text-sm text-ink-2">Paste every stylesheet that uses Reactive CSS</label>
      <textarea id={`${uid}-css`} value={css} onChange={(e) => setCss(e.target.value)} spellCheck={false} rows={6}
        className="w-full resize-y rounded-block border border-line bg-paper px-3 py-2.5 font-mono text-[12.5px] leading-[1.6]" />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={run} disabled={!css.trim() || state.status === 'loading'}
          className="h-10 rounded-block border border-ink bg-ink px-4 text-[14px] font-medium text-on-ink hover:bg-ink-hover disabled:border-transparent disabled:bg-[oklch(0.9_0.005_85)] disabled:text-mute">
          {state.status === 'loading' ? 'Analyzing…' : 'Analyze'}
        </button>
        {r && <button type="button" onClick={() => onApply(r.complete ? r.used : PROFILES.full!.filter((f) => f !== 'core'))}
          className="h-10 rounded-block border border-ink bg-transparent px-4 text-[14px] font-medium hover:bg-hover">{r.complete ? 'Use these features' : 'Use the full runtime'}</button>}
      </div>
      <div aria-live="polite" className="flex flex-col gap-2 text-[14px] leading-[1.5]" data-analysis={state.status}>
        {state.status === 'failed' && <p role="alert" className="m-0 text-rx-strong">The compiler could not be loaded: {state.error}</p>}
        {r && <>
          <p className="m-0"><span className="text-mute">Uses </span>{r.used.length ? r.used.map(title).join(', ') : 'only the core (state, or no Reactive CSS at all)'}</p>
          {r.resolved.added.length > 0 && <p className="m-0"><span className="text-mute">Requires as well </span>{r.resolved.added.map((a) => `${title(a.id)} (for ${title(a.requiredBy)})`).join(', ')}</p>}
          {r.diagnostics.length > 0 && (
            <div><span className="text-mute">The compiler reported ({r.diagnostics.length})</span>
              <ul className="m-0 mt-1 flex flex-col gap-1 pl-5 font-mono text-label text-ink-2">{r.diagnostics.map((d) => <li key={d}>{d}</li>)}</ul>
            </div>
          )}
          {r.notes.map((n) => <p key={n.code + n.message} className="m-0 text-rx-strong">{n.message}</p>)}
          <p className="m-0 font-medium">{r.complete ? `Recommended: ${r.resolved.features.join(', ')}.` : 'Recommended: the full runtime, because the analysis is incomplete.'}</p>
        </>}
        <p className="m-0 text-sm text-mute">Only the pasted text is analyzed. Stylesheets loaded or created at runtime, inline <code className="font-mono">style</code> attributes and sheets you did not paste are not seen; a missing feature then shows up in <code className="font-mono">ReactiveCSS.diagnostics</code>. When unsure, use the full runtime.</p>
      </div>
    </section>
  );
}

// ---- the island -------------------------------------------------------------------------------

/** Reads ?features=a,b or ?profile=name, so a configuration can be shared as a link. */
function fromQuery(search: string): { selected: string[]; errors: string[] } {
  const q = new URLSearchParams(search);
  const profile = q.get('profile') ?? undefined;
  const features = (q.get('features') ?? '').split(',').filter(Boolean);
  const selected = [...(profile ? PROFILES[profile] ?? [] : []), ...features].filter((id) => id !== 'core' && featureById(id));
  return { selected: [...new Set(selected)], errors: resolve({ features, profile }).errors.map((e) => e.message) };
}

export function BundleBuilder({ refs, initial = [] }: { refs?: FeatureRefs; initial?: string[] }) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [choice, setChoice] = useState<Omit<BuildChoice, 'selected'>>({ out: DEFAULT_OUT, format: 'iife', minify: true });
  useEffect(() => {
    if (!location.search) return;
    const q = fromQuery(location.search);
    setSelected(q.selected);
    setErrors(q.errors);
  }, []);
  const update = (next: string[]) => {
    const ordered = CATALOG.map((f) => f.id).filter((id) => next.includes(id));
    setSelected(ordered);
    setErrors([]);
    const profile = ordered.length ? profileOf(ordered) : undefined;
    history.replaceState(null, '', ordered.length ? `?${profile ? `profile=${profile}` : `features=${ordered.join(',')}`}` : location.pathname);
  };
  const resolved = resolve({ features: selected });
  const toggle = (id: string) => update(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="flex flex-col gap-6">
      <PresetPicker selected={selected} onPick={(p) => update(PROFILES[p]!.filter((f) => f !== 'core'))} onReset={() => update([])} />
      {errors.length > 0 && <p role="alert" className="m-0 rounded-block border border-rx px-3.5 py-2.5 text-[14px] text-rx-strong">The link named something this builder does not know, and it was ignored: {errors.join(' ')}</p>}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <FeatureSelector selected={selected} resolved={resolved} refs={refs} onToggle={toggle} />
        <div className="flex min-w-0 flex-col gap-6">
          <BundleSummary selected={selected} resolved={resolved} />
          <ConfigOutput choice={{ ...choice, selected }} onChange={({ selected: _, ...c }) => setChoice(c)} />
          <AnalyzerPanel onApply={update} />
        </div>
      </div>
    </div>
  );
}
