import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { CodePanel } from '~/components/code/CodePanel';
import { SegmentedControl } from '~/components/ui/SegmentedControl';
import { TabList } from '~/components/ui/TabList';
import { useCopy } from '~/components/ui/useCopy';
import { buttonClass } from '~/components/ui/Button';
import { highlightCss } from '~/lib/code/css';
import { highlightHtml } from '~/lib/code/html';
import type { Line } from '~/lib/code/types';
import { featureLabel } from '~/lib/code/vocabulary';
import { GLOSSARY } from '~/lib/content/glossary';
import { analyze } from '~/lib/examples/analyze';
import { inactiveBranches } from '~/lib/examples/branches';
import type { ExampleDefinition } from '~/examples/manifest';
import { EventLog, StateTable } from './Inspector';
import { PreviewFrame } from './PreviewFrame';
import { usePreviewSession } from './usePreviewSession';

export interface PlaygroundItem { key: string; label: string; example: ExampleDefinition }
type Lang = 'html' | 'css';
interface Sources { html: string; css: string }

/** Body height of the editor and preview cards: the same, so the two windows line up. */
const BODY = 'h-[440px]';
const HEAD = 'flex h-[38px] flex-none items-center justify-between border-b border-line pr-3.5 font-mono text-label text-ink-2';
const PLACEHOLDER: Record<Lang, string> = {
  html: '<!-- Write HTML, for example: -->\n<button class="counter">\n  <span class="value">0</span>\n</button>',
  css: '/* Write Reactive CSS, for example: */\n.counter {\n  --count: state(0);\n}\n\n.counter:on(click) {\n  --count: increment(1);\n}\n\n.value {\n  content: var(--count);\n}',
};

/** Per-tab preferences for this browser session only; storage may be unavailable. */
const PREFS = 'rcss.playground';
const readPrefs = (): { split?: boolean; open?: boolean } => { try { return JSON.parse(sessionStorage.getItem(PREFS) ?? '{}'); } catch { return {}; } };
const writePrefs = (p: { split: boolean; open: boolean }) => { try { sessionStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* private mode */ } };

const sourcesOf = (i: PlaygroundItem): Sources => ({ html: i.example.files.html, css: i.example.files.css });
const same = (a: Sources, b: Sources) => a.html === b.html && a.css === b.css;

/** Inserts text at the caret through the browser's editing, so Undo and Redo keep working. */
function insert(t: HTMLTextAreaElement, text: string, set: (v: string) => void) {
  if (document.execCommand?.('insertText', false, text)) return;
  const a = t.selectionStart, v = t.value;
  set(v.slice(0, a) + text + v.slice(t.selectionEnd));
  requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = a + text.length; });
}

interface EditorProps {
  lang: Lang;
  file: string;
  value: string;
  onChange: (v: string) => void;
  lines: Line[];
  height: string;
  chips?: Record<number, string>;
  flash?: number[];
  dim?: [number, string][];
}

/** A textarea over the highlighted source: the browser does the editing, the panel only paints. */
function SourceEditor({ lang, file, value, onChange, lines, height, chips = {}, flash = [], dim = [] }: EditorProps) {
  // Tab indents. Esc, then Tab, leaves the editor, so keyboard users are never trapped in it.
  const leaving = useRef(false);
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const t = e.currentTarget;
    if (e.key === 'Escape') { leaving.current = true; return; }
    if (e.key === 'Enter' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      // Keep the line's indentation, one level more after an opening { or tag.
      const before = t.value.slice(0, t.selectionStart);
      const line = before.slice(before.lastIndexOf('\n') + 1);
      const indent = line.match(/^\s*/)![0];
      const opens = lang === 'css' ? /\{\s*$/.test(line) : /<([a-zA-Z][\w-]*)[^<>]*>\s*$/.test(line) && !/\/>\s*$|<\/[^>]*>\s*$/.test(line) && !/^<(br|hr|img|input|meta|link|source|wbr)\b/i.test(line.trim());
      e.preventDefault();
      insert(t, '\n' + indent + (opens ? '  ' : ''), onChange);
      leaving.current = false;
      return;
    }
    if (e.key !== 'Tab' || e.shiftKey || leaving.current) { leaving.current = false; return; }
    e.preventDefault();
    insert(t, '  ', onChange);
  };
  const longest = Math.max(...value.split('\n').map((l) => l.length));
  const id = `pg-${lang}`;
  return (
    <div className={`${height} overflow-auto bg-paper-2 [scrollbar-width:thin]`}>
      <div className="relative min-h-full font-mono text-[14px]" style={{ height: value.split('\n').length * 24 + 30, minWidth: `calc(${longest + 2}ch + 66px)` }}>
        <div className="absolute inset-0" aria-hidden="true" inert>
          <CodePanel lines={lines} code={value} header={false} explain={false} bare chips={chips} flash={flash} dim={dim} />
        </div>
        <textarea
          id={id}
          aria-label={`${lang.toUpperCase()} editor, ${file}`}
          aria-describedby="pg-keys"
          value={value}
          placeholder={PLACEHOLDER[lang]}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          wrap="off"
          className="absolute inset-0 m-0 h-full w-full resize-none overflow-hidden border-0 bg-transparent py-[15px] pr-4 pl-[49px] font-mono text-[14px] leading-6 whitespace-pre text-transparent caret-ink [tab-size:2] outline-none selection:bg-rx/20 placeholder:text-mute focus-visible:shadow-[inset_0_0_0_2px_var(--color-ink)]"
        />
      </div>
    </div>
  );
}

/** Copy HTML, CSS or both: a disclosure with three buttons, closed by Escape or a click outside. */
function CopyMenu({ html, css }: Sources) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState('');
  const { copied, copy } = useCopy();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  const run = (what: string, text: string) => { copy(text); setDone(what); setOpen(false); box.current?.querySelector('button')?.focus(); };
  const item = 'block w-full border-0 bg-transparent px-3 py-2 text-left text-[14px] text-ink hover:bg-hover';
  return (
    <div ref={box} className="relative" onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); box.current?.querySelector('button')?.focus(); } }}>
      <button type="button" aria-expanded={open} aria-controls="pg-copy" onClick={() => setOpen((o) => !o)} className={buttonClass('primary', 'sm')}>
        <span aria-live="polite">{copied ? `Copied ${done}` : 'Copy'}</span><span aria-hidden="true" className="ml-1.5 text-[10px]">▼</span>
      </button>
      <div id="pg-copy" hidden={!open} className="absolute top-[calc(100%+4px)] right-0 z-20 min-w-[150px] rounded-block border border-line bg-paper py-1 shadow-[0_6px_20px_rgb(0_0_0/0.08)]">
        <button type="button" className={item} onClick={() => run('HTML', html)}>Copy HTML</button>
        <button type="button" className={item} onClick={() => run('CSS', css)}>Copy CSS</button>
        <button type="button" className={item} onClick={() => run('both', `<!-- HTML -->\n${html.trimEnd()}\n\n/* CSS */\n${css.trimEnd()}\n`)}>Copy both</button>
      </div>
    </div>
  );
}

/**
 * Write HTML and Reactive CSS and run them for real. Each edit (debounced) restarts the preview
 * with the new sources in a fresh sandboxed document, the way reloading a page resets state.
 * Problems come from the runtime's own ReactiveCSS.diagnostics.
 */
export function Playground({ items: presets, extra = [] }: { items: PlaygroundItem[]; /** Opened with ?example=<key>, added after the presets. */ extra?: PlaygroundItem[] }) {
  const [items, setItems] = useState(presets);
  // Toggle first for a first visit; Blank is listed first but is not the landing preset.
  const [key, setKey] = useState((presets.find((i) => i.key === 'toggle') ?? presets[0]!).key);
  const item = items.find((i) => i.key === key)!;
  // Edits per preset, kept for this visit: switching back restores them; Reset drops them.
  const [drafts, setDrafts] = useState<Record<string, Sources>>({});
  const src = drafts[key] ?? sourcesOf(item);
  const dirty = !same(src, sourcesOf(item));
  const [running, setRunning] = useState(src);
  const [tab, setTab] = useState<Lang>(key === 'blank' ? 'html' : 'css');
  const [split, setSplit] = useState(false);
  const [open, setOpen] = useState(false);
  const [inspect, setInspect] = useState('state');
  const [pane, setPane] = useState('code');
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => { const p = readPrefs(); setSplit(!!p.split); setOpen(!!p.open); }, []);
  useEffect(() => writePrefs({ split, open }), [split, open]);

  // Debounce: the preview restarts 400 ms after the last keystroke, only if a source changed.
  const run = (s: Sources) => setRunning((r) => (same(r, s) ? r : s));
  useEffect(() => { const t = setTimeout(() => run(src), 400); return () => clearTimeout(t); }, [src.html, src.css]);
  const edit = (lang: Lang) => (v: string) => setDrafts((d) => ({ ...d, [key]: { ...src, [lang]: v } }));

  const pick = (k: string, list = items) => {
    const next = list.find((i) => i.key === k)!;
    setKey(k);
    setTab(k === 'blank' ? 'html' : 'css');
    run(drafts[k] ?? sourcesOf(next));
  };
  const reset = () => { setDrafts(({ [key]: _, ...d }) => d); run(sourcesOf(item)); setResetKey((n) => n + 1); };
  const clear = () => { const empty = { html: '', css: '' }; setDrafts((d) => ({ ...d, [key]: empty })); run(empty); setResetKey((n) => n + 1); };

  // ?example=<key>: a preset, or an example page's "Open in Playground" link (HTML and CSS editable).
  useEffect(() => {
    const wanted = new URLSearchParams(location.search).get('example');
    // Example pages first: their ids (counter…) may equal a preset's key.
    const found = extra.find((i) => i.key === wanted);
    if (!found) { if (presets.some((i) => i.key === wanted)) pick(wanted!); return; }
    // A key of its own when a preset has the same one (the API example counter, the Counter preset).
    const added = presets.some((i) => i.key === found.key) ? { ...found, key: `example-${found.key}` } : found;
    const list = [...presets, added];
    setItems(list);
    pick(added.key, list);
  }, []);

  const analysis = useMemo(() => analyze(running.css), [running]);
  const session = usePreviewSession(analysis);
  useEffect(() => { session.reset(); }, [running, resetKey]);

  const cssLines = useMemo(() => highlightCss(src.css), [src.css]);
  const htmlLines = useMemo(() => highlightHtml(src.html), [src.html]);
  const live = src.css === running.css;
  const shown = new Map([...session.current].map(([k, v]) => [k, v.value]));
  const dim = live ? inactiveBranches(src.css.split('\n'), shown) : [];
  const features = useMemo(() => analyze(src.css).features, [src.css]);
  const pending = !same(src, running);
  const problems = session.diagnostics;

  // A new problem opens the inspector on Diagnostics; it is never only behind a closed panel.
  const seen = useRef(0);
  useEffect(() => {
    if (problems.length > seen.current) { setOpen(true); setInspect('diagnostics'); }
    seen.current = problems.length;
  }, [problems.length]);

  const stem = item.example.stem;
  const files: Record<Lang, string> = { html: 'index.html', css: `${stem}.css` };
  const editorFor = (lang: Lang, height: string) => (
    <SourceEditor
      lang={lang} file={files[lang]} value={src[lang]} onChange={edit(lang)} lines={lang === 'css' ? cssLines : htmlLines} height={height}
      {...(lang === 'css' && live && { chips: session.chips, flash: session.flash, dim })}
    />
  );
  // The preset's layout styles (base.css) run in the preview but are not part of the editable sources.
  const blank = presets.find((i) => i.key === 'blank');
  const hiddenLayout = !!blank && item.example.files.base.trim() !== blank.example.files.base.trim();

  const editor = (
    <section aria-label="Source editor" className="flex min-w-0 flex-col gap-2" data-pane-id="code">
      <div className="flex flex-col overflow-hidden rounded-block border border-line">
        <div className={HEAD}>
          {split
            ? <span className="flex h-full items-center px-3.5 pt-0.5 font-semibold text-ink">HTML + CSS</span>
            : <TabList
                label="Source files"
                idBase="pge"
                items={[{ id: 'html', label: 'HTML' }, { id: 'css', label: 'CSS' }]}
                selected={tab}
                onSelect={(t) => setTab(t as Lang)}
                className="flex h-full"
                tabClassName={(on) => `h-full border-0 border-b-2 bg-transparent px-3.5 pt-0.5 font-mono text-label ${on ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink-2 hover:text-ink'}`}
              />}
          <button type="button" aria-pressed={split} onClick={() => setSplit((s) => !s)} title="Show HTML and CSS together" className="h-[26px] rounded-block border border-line bg-transparent px-2 font-mono text-label text-ink-2 hover:border-ink hover:text-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-on-ink">Split</button>
        </div>
        {split ? (
          <>
            <div className="flex h-[26px] items-center border-b border-line px-3.5 font-mono text-tag text-mute">{files.html}</div>
            {editorFor('html', 'h-[194px]')}
            <div className="flex h-[26px] items-center border-y border-line px-3.5 font-mono text-tag text-mute">{files.css}</div>
            {editorFor('css', 'h-[193px]')}
          </>
        ) : (
          (['html', 'css'] as const).map((l) => (
            <div key={l} role="tabpanel" id={`pge-panel-${l}`} aria-labelledby={`pge-tab-${l}`} hidden={tab !== l}>{editorFor(l, BODY)}</div>
          ))
        )}
      </div>
      <p id="pg-keys" className="m-0 text-[12.5px] text-mute">
        Tab indents · Esc, then Tab, leaves the editor · edits restart the preview{hiddenLayout ? ' · the preset’s layout styles run but are not shown' : ''}
      </p>
    </section>
  );

  const preview = (
    <section aria-label="Preview" className="flex flex-col rounded-block border border-line" data-pane-id="preview">
      <div className={`${HEAD} pl-3.5`}><span>preview · runtime</span><span>{item.example.a11y}</span></div>
      <div className={`relative ${BODY}`}>
        <PreviewFrame devRuntime reportProblems={false} sources={{ css: running.css, base: item.example.files.base, html: running.html }} analysis={analysis} title={`${item.label} preview`} onMessage={session.handle} resetKey={resetKey} className="absolute inset-0" />
      </div>
    </section>
  );

  const states = [...session.values.values()];
  const summary = pending ? 'Waiting for you to stop typing.' : problems.length
    ? `${problems.length === 1 ? '1 problem' : `${problems.length} problems`} · ${problems.at(-1)}`
    : session.ready ? 'No diagnostics · running' : 'Starting the preview…';
  const panel = {
    diagnostics: problems.length
      ? <ul className="m-0 flex list-none flex-col gap-1.5 p-3.5 text-[14px] text-ink">{problems.map((p, i) => <li key={i} className="flex gap-2.5"><span aria-hidden="true" className="font-mono text-label">!</span><span className="min-w-0 break-words">{p}</span></li>)}</ul>
      : <p className="m-0 p-3.5 text-sm text-mute">The runtime reported nothing for this stylesheet.</p>,
    state: <StateTable rows={states} empty={running.css.trim() ? 'Waiting for the preview to start.' : 'No states yet: declare one with state().'} />,
    events: <div className="p-3.5"><EventLog entries={session.log} empty="Interact with the preview to see events." /></div>,
    features: (
      <div className="flex flex-wrap gap-1.5 p-3.5">
        {features.map((f) => <a key={f} href={GLOSSARY[f]?.href ?? '/docs/reference/'} className="rounded-tag border border-rx px-2 py-1 font-mono text-[12.5px] text-rx no-underline">{featureLabel(f)}</a>)}
        {features.length === 0 && <span className="text-sm text-mute">No Reactive CSS in the stylesheet yet.</span>}
      </div>
    ),
  } as Record<string, ReactNode>;
  const count = (n: number) => (n ? <span className="ml-1.5 text-mute">{n}</span> : null);

  const inspector = (
    <section aria-label="Inspector" className="rounded-block border border-line" data-pane-id="inspect">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-1.5">
        <p role="status" className={`m-0 flex min-w-0 flex-1 basis-[260px] items-center gap-2.5 text-[14px] ${problems.length && !pending ? 'text-ink' : 'text-ink-2'}`}>
          <span aria-hidden="true" className="flex-none font-mono text-label">{pending ? '…' : problems.length ? '!' : '✓'}</span>
          <span className="truncate" title={summary}>{summary}</span>
        </p>
        <TabList
          label="Inspector"
          idBase="pgi"
          items={[
            { id: 'diagnostics', label: <>Diagnostics{count(problems.length)}</> },
            { id: 'state', label: <>State{count(states.length)}</> },
            { id: 'events', label: <>Events{count(session.log.length)}</> },
            { id: 'features', label: <>Features{count(features.length)}</> },
          ]}
          selected={inspect}
          onSelect={(t) => { setInspect(t); setOpen(true); }}
          className="flex flex-wrap"
          tabClassName={(on) => `h-[34px] border-0 border-b-2 bg-transparent px-2.5 font-mono text-label ${on && open ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink-2 hover:text-ink'}`}
        />
        <button type="button" aria-expanded={open} aria-controls={`pgi-panel-${inspect}`} onClick={() => setOpen((o) => !o)} className="h-[26px] rounded-block border border-line bg-transparent px-2 font-mono text-label text-ink-2 hover:border-ink hover:text-ink">
          {open ? 'Hide' : 'Show'}<span className="sr-only"> inspector details</span>
        </button>
      </div>
      <div role="tabpanel" id={`pgi-panel-${inspect}`} aria-labelledby={`pgi-tab-${inspect}`} hidden={!open} className="max-h-[260px] overflow-auto border-t border-line">
        {panel[inspect]}
      </div>
    </section>
  );

  return (
    <div className="pg">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-(--gutter-app) py-4">
        <SegmentedControl label="Presets" value={key} onChange={(k) => pick(k)} options={items.map((i) => ({ value: i.key, label: i.label + (drafts[i.key] && !same(drafts[i.key]!, sourcesOf(i)) ? ' •' : '') }))} className="max-w-full overflow-x-auto" />
        <div className="flex-1" />
        <span aria-live="polite" className="font-mono text-label text-mute">{dirty ? 'edited · draft kept' : ''}</span>
        <button type="button" onClick={reset} title="Restore this preset’s original HTML and CSS" className={buttonClass('quiet', 'sm')}>Reset</button>
        <button type="button" onClick={clear} title="Empty both editors" className={buttonClass('quiet', 'sm')}>Clear</button>
        <CopyMenu html={src.html} css={src.css} />
      </div>
      <TabList
        label="Panes"
        idBase="pg"
        items={[{ id: 'code', label: 'Code' }, { id: 'preview', label: 'Preview' }, { id: 'inspect', label: 'Inspect' }]}
        selected={pane}
        onSelect={(p) => { setPane(p); if (p === 'inspect') setOpen(true); }}
        className="pg-tabs grid grid-cols-3 border-b border-line"
        tabClassName={(on) => `h-[46px] border-0 border-b-2 bg-transparent text-base ${on ? 'border-ink font-semibold' : 'border-transparent'}`}
      />
      <div className="pg-grid gap-4 px-(--gutter-app) pt-6 pb-12" data-pane={pane}>
        {editor}
        {preview}
        {inspector}
      </div>
    </div>
  );
}
