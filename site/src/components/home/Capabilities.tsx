import { useState, type KeyboardEvent } from 'react';
import { LiveExample } from '~/components/examples/LiveExample';
import type { ExampleDefinition } from '~/examples/manifest';

export interface Capability { id: string; name: string; demo: string; replaces: string; a11y: string; example: ExampleDefinition }

/**
 * "What it makes possible": a vertical list of capabilities (horizontal chips on narrow
 * screens) and the selected one running live. Only the selected preview is mounted.
 */
export function Capabilities({ items }: { items: Capability[] }) {
  const [sel, setSel] = useState(0);
  const cur = items[sel]!;
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = ['ArrowDown', 'ArrowRight'].includes(e.key) ? 1 : ['ArrowUp', 'ArrowLeft'].includes(e.key) ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + items.length) % items.length;
    setSel(n);
    document.getElementById(`cap-tab-${n}`)?.focus();
  };
  return (
    <div className="flex flex-wrap items-start gap-8">
      <div role="tablist" aria-label="Capabilities" aria-orientation="vertical" className="flex min-w-0 flex-[1_1_100%] gap-2 overflow-x-auto [scrollbar-width:none] min-[960px]:max-w-[340px] min-[960px]:flex-[1_1_260px] min-[960px]:flex-col min-[960px]:gap-0 min-[960px]:border-t min-[960px]:border-ink">
        {items.map((it, i) => {
          const on = i === sel;
          return (
            <button
              key={it.id}
              id={`cap-tab-${i}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls="cap-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => setSel(i)}
              onKeyDown={(e) => onKey(e, i)}
              className={`flex min-h-14 flex-none items-center gap-3 rounded-block border px-3.5 py-2.5 text-left min-[960px]:w-full min-[960px]:gap-4 min-[960px]:rounded-none min-[960px]:border-0 min-[960px]:border-b min-[960px]:border-line min-[960px]:px-3 min-[960px]:py-4 ${on ? 'border-ink bg-paper text-ink' : 'border-line bg-transparent text-ink-2'}`}
            >
              <span className="font-mono text-label text-mute">0{i + 1}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[16px] font-semibold whitespace-nowrap">{it.name}</span>
                <span className="text-sm whitespace-nowrap text-ink-2">{it.demo}</span>
              </span>
              <span aria-hidden="true" className={`size-[7px] flex-none rounded-full border ${on ? 'border-rx bg-rx' : 'border-line-dashed bg-transparent'}`} />
            </button>
          );
        })}
      </div>
      <div id="cap-panel" role="tabpanel" aria-labelledby={`cap-tab-${sel}`} className="flex min-w-0 flex-[3_1_560px] flex-col gap-3.5">
        <LiveExample key={cur.id} example={cur.example} minHeight={300} columns="minmax(0,1.3fr) minmax(240px,1fr)" resultLabel={cur.demo} alignTop />
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-[14px] leading-normal">
          <div className="flex-[1_1_280px] text-ink-2"><span className="font-semibold text-ink">Replaces in JavaScript: </span>{cur.replaces}</div>
          <div className="flex-[1_1_280px] text-ink-2"><span className="font-semibold text-ink">Accessibility: </span>{cur.a11y}</div>
        </div>
        <div className="flex flex-wrap gap-5 text-[14px]">
          <a href={`/playground/`} className="font-medium">Open in playground →</a>
          <a href="/examples/" className="text-ink-2">All examples</a>
        </div>
      </div>
    </div>
  );
}
