import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PreviewFrame } from '~/components/examples/PreviewFrame';
import type { PreviewMessage } from '~/lib/examples/protocol';
import { analyze } from '~/lib/examples/analyze';

/* Vision v2 (design-source/Vision v2.dc.html): the two interactive parts of the page. Everything
   else on /vision/ is static markup. Native CSS demos use native CSS (:has(), clamp()); the
   Reactive CSS ones run the real runtime in the sandboxed preview frame. */

const tag = 'rounded-[2px] border border-line px-[7px] py-0.5 font-mono text-[13px]';
const rxTag = 'rounded-[2px] border border-dashed border-rx px-[7px] py-0.5 font-mono text-[13px] text-rx';
const box = 'flex min-h-[196px] flex-none flex-col justify-between gap-2.5 rounded-[3px] border border-line bg-paper-result p-3.5';
const hatch = 'bg-[repeating-linear-gradient(135deg,oklch(0.92_0.005_85)_0_1px,transparent_1px_6px)]';

function Step({ n, label, side, tags, rx, children, text }: { n: string; label: string; side: string; tags: string[]; rx?: boolean; children: ReactNode; text: string }) {
  return (
    <li className={`flex flex-col gap-4 border-t-[1.5px] pt-4 ${rx ? 'border-dashed border-rx' : 'border-ink'}`}>
      <div className={`flex justify-between gap-2 font-mono text-[11.5px] ${rx ? 'text-rx-strong' : 'text-mute'}`}><span>{n} · {label}</span><span>{side}</span></div>
      <div className="flex flex-wrap gap-1.5">{tags.map((t) => <span key={t} className={rx ? rxTag : tag}>{t}</span>)}</div>
      {children}
      <p className="m-0 text-[15px] leading-[1.55] text-pretty text-ink-body">{text}</p>
    </li>
  );
}

/** iv: the counter, run by the runtime. Every reactive line it runs is the code on the card. */
export const COUNTER_CSS = `.counter { --count: state(0); }
.counter button:on(click) { --count: increment(1); }
.counter output { content: var(--count); }`;
const COUNTER_BASE = `body { margin: 0; padding: 0; background: transparent; font: 14px/1.4 'Instrument Sans', system-ui, sans-serif; color: #2b2925; }
.counter { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
button { height: 40px; padding: 0 16px; border: 1px solid #2b2925; border-radius: 3px; background: transparent; font: inherit; font-weight: 500; cursor: pointer; }
button:hover { background: #ece9e3; }
button:focus-visible { outline: 2px solid #2b2925; outline-offset: 2px; }
.out { display: flex; align-items: baseline; gap: 8px; }
.out span { font: 11.5px 'Red Hat Mono', monospace; color: #6f6a63; }
output { min-width: 2ch; text-align: right; font-size: 32px; font-weight: 600; letter-spacing: -0.03em; line-height: 1; font-variant-numeric: tabular-nums; color: #c2410c; }`;
const COUNTER_HTML = '<div class="counter"><button type="button">Click</button><span class="out"><span>--count</span><output aria-live="polite">0</output></span></div>';

/**
 * Section 02: Calculate → Relate → Decide → React? Three native steps, demonstrated with native
 * CSS, and the experimental fourth, run by the Reactive CSS runtime.
 */
export function EvolutionSteps() {
  const [w, setW] = useState(720);
  const pad = Math.round(Math.min(40, Math.max(16, w * 0.04)) * 10) / 10;
  const counter = useMemo(() => analyze(COUNTER_CSS), []);
  return (
    <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,250px),1fr))] gap-x-6 gap-y-10 p-0" data-evolution="">
      <Step n="i" label="calculate" side="native" tags={['calc()', 'clamp()']} text="Math moved into the stylesheet. A size that once needed a resize listener became one declaration.">
        <div className={box}>
          <div className="font-mono text-xs leading-normal">padding: clamp(16px, 4vw, 40px)<br /><span className="text-ink-2">= </span><output className="font-semibold">{pad}px</output><span className="text-mute"> at {w}px</span></div>
          <div className="flex h-10 items-stretch rounded-[2px] border border-ink"><span className="flex-none bg-ink transition-[width] duration-[120ms]" style={{ width: pad * 1.6 }} /><span className={`flex-1 ${hatch}`} /></div>
          <input aria-label="Viewport width" type="range" min={320} max={1440} step={10} value={w} onChange={(e) => setW(+e.target.value)} className="w-full accent-ink" />
        </div>
      </Step>
      <Step n="ii" label="relate" side="native" tags={[':has()', '@container']} text="Selectors began to read context: what an element contains and how much room it has.">
        {/* Real :has(): the checkbox adds the image, and the card styles itself by what it contains. */}
        <div className={`${box} group/rel`}>
          <div className="font-mono text-xs">.card:has(img) <span className="text-mute group-has-[input:checked]/rel:hidden">→ no match</span><span className="hidden font-semibold group-has-[input:checked]/rel:inline">→ matches</span></div>
          <div className="flex min-h-[58px] items-center gap-2.5 rounded-[2px] border border-ink p-2.5 transition-colors duration-150 has-[img]:bg-paper-band">
            <img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt="" className="hidden w-11 flex-none self-stretch rounded-[2px] border border-line-strong bg-[repeating-linear-gradient(135deg,oklch(0.86_0.006_85)_0_1px,transparent_1px_5px)] group-has-[input:checked]/rel:block" />
            <span className="flex flex-1 flex-col gap-[5px]"><span className="h-1.5 w-[70%] rounded-[1px] bg-ink" /><span className="h-[5px] w-[90%] rounded-[1px] bg-line" /><span className="h-[5px] w-[55%] rounded-[1px] bg-line" /></span>
          </div>
          <label className="flex min-h-6 cursor-pointer items-center gap-2 text-[13.5px]"><input type="checkbox" defaultChecked className="m-0 size-4 accent-ink" />Card contains an image</label>
        </div>
      </Step>
      <Step n="iii" label="decide" side="native · newer" tags={['if()', '@function']} text="Values gained branches and authors can define functions. Support for these is still arriving.">
        {/* if() is not in every browser yet, so the switch is native radios and :has(). */}
        <div className={`${box} group/dec`}>
          <div className="font-mono text-xs leading-normal">padding: if(<br />&nbsp;&nbsp;style(--size: large): 32px;<br />&nbsp;&nbsp;else: 16px)<br /><span className="text-ink-2">= </span><span className="font-semibold group-has-[[value=large]:checked]/dec:hidden">16px</span><span className="hidden font-semibold group-has-[[value=large]:checked]/dec:inline">32px</span></div>
          <span className="flex h-14 w-[120px] flex-none rounded-[2px] border border-ink p-2 transition-[padding,height] duration-150 group-has-[[value=large]:checked]/dec:h-[72px] group-has-[[value=large]:checked]/dec:p-4"><span className="size-full rounded-[1px] bg-ink" /></span>
          <fieldset className="m-0 flex flex-none self-start overflow-hidden rounded-[3px] border border-line p-0">
            <legend className="sr-only">--size</legend>
            {['small', 'large'].map((v, k) => (
              <label key={v} className={`flex h-[30px] cursor-pointer items-center px-2.5 font-mono text-[11.5px] has-checked:bg-ink has-checked:text-on-ink has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-ink ${k ? 'border-l border-line' : ''}`}>
                <input type="radio" name="vision-size" value={v} defaultChecked={!k} className="sr-only" />--size: {v}
              </label>
            ))}
          </fieldset>
        </div>
      </Step>
      <Step n="iv" label="react?" side="Reactive CSS" tags={['state()', ':on()']} rx text="The open question: values that change and events that change them, written where the styles already are.">
        <div className="flex min-h-[196px] flex-col justify-between gap-2.5 rounded-[3px] border border-dashed border-rx-soft bg-paper-result p-3.5">
          {/* Focusable so keyboard users can scroll the long lines. */}
          <pre tabIndex={0} className="m-0 overflow-x-auto font-mono text-[11.5px] leading-normal whitespace-pre">{COUNTER_CSS}</pre>
          <PreviewFrame sources={{ css: COUNTER_CSS, base: COUNTER_BASE, html: COUNTER_HTML }} analysis={counter} title="Counter, run by the Reactive CSS runtime" autoHeight minHeight={44} className="bg-transparent!" />
          <span className="font-mono text-[11px] text-ink-2">runs the Reactive CSS runtime</span>
        </div>
      </Step>
    </ol>
  );
}

type Role = 'state' | 'event' | 'result';
/** The stylesheet the section 04 result runs, line by line: the role each line plays and its Reactive CSS token. */
export const ARTICLE_LINES: [Role | null, string, string?][] = [
  ['state', '.article {'],
  ['state', '  --saved: state(false);', 'state(false)'],
  [null, '}'],
  [null, ''],
  ['event', '.article .save:on(click) {', ':on(click)'],
  ['event', '  --saved: toggle();', 'toggle()'],
  [null, '}'],
  [null, ''],
  ['result', '.article .save {'],
  ['result', '  --attr-aria-pressed: when(--saved);', 'when(--saved)'],
  [null, '}'],
  [null, ''],
  ['result', '.article:when(--saved) .save {', ':when(--saved)'],
  ['result', '  background: #1c1917;'],
  ['result', '  color: #fff;'],
  [null, '}'],
  ['result', '.save::after { content: when(--saved, "Saved", "Save"); }', 'when(--saved, "Saved", "Save")'],
  ['result', '.note::after { content: when(--saved, "In your reading list", "Read it later"); }', 'when(--saved, "In your reading list", "Read it later")'],
];
export const ARTICLE_CSS = ARTICLE_LINES.map(([, l]) => l).join('\n');
const ARTICLE_BASE = `body { margin: 0; padding: 0; background: transparent; font: 14.5px/1.55 'Instrument Sans', system-ui, sans-serif; color: #2b2925; }
.article { box-sizing: border-box; width: 100%; max-width: 400px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px; padding: 22px; border: 1px solid #dcd8d0; border-radius: 3px; background: #faf9f6; }
.kicker { font: 11.5px 'Red Hat Mono', monospace; color: #6f6a63; }
h3 { margin: 0; font-size: 22px; line-height: 1.15; letter-spacing: -0.02em; font-weight: 600; }
p { margin: 0; color: #5c5852; }
.foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 10px; border-top: 1px solid #dcd8d0; }
.note { font-size: 13px; color: #5c5852; }
.save { height: 40px; min-width: 84px; padding: 0 16px; border: 1px solid #2b2925; border-radius: 3px; background: transparent; color: #2b2925; font: inherit; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 150ms, color 150ms; }
.save:focus-visible { outline: 2px solid #2b2925; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .save { transition: none; } }`;
const ARTICLE_HTML = `<article class="article"><span class="kicker">Essay · 8 min read</span><h3>Why the cascade still matters</h3><p>Specificity, layers and the quiet rules that decide which style wins.</p><div class="foot"><span class="note"></span><button type="button" class="save"></button></div></article>`;
const ROLES: [Role, string][] = [['state', 'declaration · state'], ['event', 'event · :on()'], ['result', 'result · condition']];

/**
 * Section 04: the article stylesheet beside its result. Hovering or focusing a role highlights its
 * lines; a click in the preview lights event, then state, then result, as the runtime runs them.
 */
export function ExperimentDemo() {
  const [role, setRole] = useState<Role | null>(null);
  const [hot, setHot] = useState<Role[]>([]);
  const analysis = useMemo(() => analyze(ARTICLE_CSS), []);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const pulse = () => {
    timers.current.forEach(clearTimeout);
    const seq: Role[] = ['event', 'state', 'result'];
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    timers.current = still
      ? [setTimeout(() => setHot([]), 1200)]
      : [...seq.map((r, i) => setTimeout(() => setHot([r]), i * 260)), setTimeout(() => setHot([]), seq.length * 260 + 900)];
    if (still) setHot(seq);
  };
  const onMessage = (m: PreviewMessage) => { if (m.type === 'event') pulse(); };
  const active = role ? [role] : hot;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-stretch gap-x-[clamp(24px,4vw,56px)] gap-y-6" data-experiment="">
      <figure className="m-0 flex min-w-0 flex-col gap-3">
        <figcaption className="flex justify-between gap-3 font-mono text-xs text-ink-2"><span>article.css</span><span>Reactive CSS</span></figcaption>
        <div tabIndex={0} role="region" aria-label="article.css" className="overflow-x-auto border-t border-b border-t-ink border-b-line py-3.5 font-mono text-[clamp(12.5px,1.15vw,14.5px)] leading-[1.75]">
          {ARTICLE_LINES.map(([r, l, tok], i) => {
            const on = !!r && active.includes(r);
            const at = tok ? l.indexOf(tok) : -1;
            return (
              <div key={i} data-role={r ?? undefined} className={`-mx-2 grid min-h-[1.75em] grid-cols-[56px_minmax(0,1fr)] gap-2 rounded-[2px] px-2 transition-colors duration-200 ${on ? 'bg-trace' : ''}`}>
                <span className={`self-center text-[10.5px] tracking-[0.04em] uppercase ${on ? 'text-rx-strong' : 'text-mute'}`}>{tok ? r : ''}</span>
                <span className="whitespace-pre">{at >= 0 ? <>{l.slice(0, at)}<span className={`border-b border-dashed border-rx-underline text-rx-strong ${on ? 'font-semibold' : 'font-medium'}`}>{tok}</span>{l.slice(at + tok!.length)}</> : l}</span>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11.5px] text-ink-2">
          {ROLES.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={role === k} onMouseEnter={() => setRole(k)} onMouseLeave={() => setRole(null)} onFocus={() => setRole(k)} onBlur={() => setRole(null)}
              className={`flex h-7 items-center gap-2 border-0 bg-transparent p-0 font-mono text-[11.5px] ${active.includes(k) ? 'text-ink' : 'text-ink-2'}`}>
              <span aria-hidden="true" className={`size-2 rounded-[2px] transition-colors duration-200 ${active.includes(k) ? 'bg-rx' : 'bg-line-strong'}`} />{label}
            </button>
          ))}
        </div>
      </figure>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex justify-between gap-3 font-mono text-xs text-ink-2"><span className="flex items-center gap-2"><span aria-hidden="true" className="size-1.5 rounded-full bg-rx" /><span className="text-ink">Result</span></span><span>real runtime</span></div>
        <div className="flex min-h-[300px] flex-1 items-center justify-center rounded-[3px] border border-line bg-paper-result p-[clamp(20px,3vw,40px)]">
          <PreviewFrame sources={{ css: ARTICLE_CSS, base: ARTICLE_BASE, html: ARTICLE_HTML }} analysis={analysis} title="Reading list article, run by the Reactive CSS runtime" onMessage={onMessage} autoHeight minHeight={200} className="bg-transparent!" />
        </div>
        <p className="m-0 text-sm leading-[1.6] text-pretty text-ink-2">JavaScript is still involved. The runtime reads this stylesheet, attaches the click listener, stores <code className="font-mono text-[13px]">--saved</code> and applies the matching rules. What you no longer write is the code that connects them. <a href="/examples/">More in Examples →</a></p>
      </div>
    </div>
  );
}
