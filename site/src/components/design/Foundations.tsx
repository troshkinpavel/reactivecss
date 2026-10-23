import { tokenClass } from '~/components/code/CodePanel';
import { COLORS, MOTION, SPACE, SYNTAX, TYPE } from '~/lib/design/foundations';

export function Swatches({ colors = COLORS }: { colors?: typeof COLORS }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
      {colors.map((c) => (
        <div key={c.token} className="flex flex-col overflow-hidden rounded-block border border-line">
          <div className="h-[72px] border-b border-line" style={{ background: `var(--color-${c.token})` }} />
          <div className="flex flex-col gap-[3px] px-3 py-2.5">
            <span className="text-[14px] font-semibold">{c.name}</span>
            <span className="font-mono text-[11px] text-ink-2">--color-{c.token}</span>
            <span className="text-[12.5px] leading-[1.4] text-mute">{c.use}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const rows = 'flex flex-col border-t border-ink';
const row = 'grid items-baseline gap-4 border-b border-line';

export function TypeScale() {
  return <div className={rows}>{TYPE.map((t) => <div key={t.spec} className={`${row} grid-cols-[minmax(120px,180px)_minmax(0,1fr)] py-[18px] max-[640px]:grid-cols-1 max-[640px]:gap-1`}><span className="font-mono text-label leading-normal text-ink-2">{t.spec}</span><span className={`${t.cls} min-w-0 [overflow-wrap:anywhere]`}>{t.sample}</span></div>)}</div>;
}

export function SyntaxTable() {
  return (
    <div className={rows}>
      {SYNTAX.map((t) => (
        <div key={t.name} className={`${row} grid-cols-[minmax(130px,200px)_minmax(140px,240px)_minmax(0,1fr)] py-3 max-[640px]:grid-cols-1 max-[640px]:gap-1`}>
          <span className="text-ui font-semibold">{t.name}</span>
          <span className={`font-mono text-[14px] ${tokenClass(t.kind)} ${t.dim ? 'opacity-30' : ''}`} data-dim={t.dim || undefined}>{t.sample}</span>
          <span className="text-sm text-ink-2">{t.rule}</span>
        </div>
      ))}
    </div>
  );
}

export function SpacingScale() {
  return (
    <div className="flex flex-col gap-2">
      {SPACE.map(([v, use]) => <div key={v} className="flex items-center gap-3"><span className="w-9 font-mono text-label text-ink-2">{v}</span><span className="h-2.5 flex-none bg-ink" style={{ width: v }} /><span className="text-[12.5px] text-mute">{use}</span></div>)}
    </div>
  );
}

export function MotionTable() {
  return <div className={rows}>{MOTION.map(([n, t, d]) => <div key={n} className={`${row} grid-cols-[minmax(120px,180px)_minmax(90px,140px)_minmax(0,1fr)] py-3.5 max-[640px]:grid-cols-1 max-[640px]:gap-1`}><span className="text-ui font-semibold">{n}</span><span className="font-mono text-meta text-ink-2">{t}</span><span className="text-[14px] leading-normal text-ink-body">{d}</span></div>)}</div>;
}

export function BordersAndRadii() {
  const box = 'grid h-16 min-w-24 place-items-center whitespace-nowrap px-4 font-mono text-[11px]';
  return (
    <div className="flex flex-wrap gap-3 text-ink-2">
      <div className={`${box} rounded-tag border border-line`}>2px · tag</div>
      <div className={`${box} rounded-block border border-line`}>3px · block</div>
      <div className={`${box} rounded-block border border-ink text-ink`}>1px ink · emphasis</div>
      <div className={`${box} rounded-block border border-dashed border-line-dashed`}>dashed · prototype</div>
    </div>
  );
}
