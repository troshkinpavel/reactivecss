import { useMemo, type ReactNode } from 'react';
import { CodePanel } from '~/components/code/CodePanel';
import { highlightCss } from '~/lib/code/css';
import { analyze } from '~/lib/examples/analyze';
import { inactiveBranches } from '~/lib/examples/branches';
import type { ExampleDefinition } from '~/examples/manifest';
import { RESULT_BG, ResultHeader, StateFoot } from './Inspector';
import { PreviewFrame } from './PreviewFrame';
import { usePreviewSession } from './usePreviewSession';

export interface LiveExampleProps {
  example: ExampleDefinition;
  /** Code font size; the hero uses 14.5. */
  fontSize?: number;
  /** Minimum height of the result panel in px. */
  minHeight?: number;
  /** Grid template for code and result, side by side when the card is wide enough. */
  columns?: string;
  /** When code and result sit side by side (viewport widths, see global.css); otherwise the result stacks above the code. */
  layout?: 'hero' | 'panel';
  /** Right side of the result header, such as the demo's name. */
  resultLabel?: string;
  /** One line under the preview, such as "Click and watch the code". */
  hint?: string;
  /** Put the demo at the top of the result panel instead of the middle. */
  alignTop?: boolean;
  className?: string;
  /** Extra content under the card (notes, links). */
  children?: ReactNode;
}

const TOP = 'body { place-items: start center; padding-top: clamp(32px, 5vw, 64px); }';

/**
 * One card: the code and its running result, joined by a hairline (the homepage hero and
 * capability demos). Chips and the trace come from the real runtime in the preview.
 */
export function LiveExample({ example, fontSize = 14, minHeight = 316, columns = 'minmax(0,1.45fr) minmax(240px,1fr)', layout = 'panel', resultLabel, hint, alignTop = false, className = '', children }: LiveExampleProps) {
  const css = example.files.css;
  const analysis = useMemo(() => analyze(css), [css]);
  const lines = useMemo(() => highlightCss(css), [css]);
  const session = usePreviewSession(analysis);
  const rows = [...session.current.values()];
  const footH = Math.max(72, 18 + (rows.length + 1) * 18 + rows.length * 3 + 1);
  const dim = inactiveBranches(css.split('\n'), new Map([...session.current].map(([k, v]) => [k, v.value])));
  const base = `${example.files.base}\n${RESULT_BG}${alignTop ? `\n${TOP}` : ''}`;
  return (
    <div className={`@container min-w-0 ${className}`} data-example={example.id}>
      <div className={`live-pair live-pair-${layout} grid overflow-hidden rounded-block border border-line bg-paper-2`} style={{ ['--live-cols' as string]: columns }}>
        <div className="live-code min-w-0">
          <CodePanel lines={lines} code={css} label={`${example.stem}.css`} chips={session.chips} flash={session.flash} dim={dim} fontSize={fontSize} footHeight={footH} bare />
        </div>
        <div className="live-result flex min-w-0 flex-col bg-paper-result" style={{ minHeight }}>
          <ResultHeader label={resultLabel} />
          <div className="relative min-h-[180px] flex-1">
            <PreviewFrame sources={{ css, base, html: example.files.html }} analysis={analysis} title={`${example.title} preview`} onMessage={session.handle} className="absolute inset-0 bg-paper-result!" />
          </div>
          {hint && <p className="m-0 pb-3 text-center text-[12.5px] text-mute">{hint}</p>}
          <StateFoot rows={rows} lastEvent={session.lastEvent} height={footH} boxed />
        </div>
      </div>
      {children}
    </div>
  );
}
