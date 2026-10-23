import { useEffect, useMemo, useRef, useState } from 'react';
import { PreviewFrame } from '~/components/examples/PreviewFrame';
import { analyze } from '~/lib/examples/analyze';

export interface CardPreviewProps {
  title: string;
  /** The example's Reactive CSS, its layout and the interactive markup only. */
  css: string;
  base: string;
  html: string;
  /** Height of the preview area before and after the runtime starts, so cards do not jump. */
  height?: number;
}

/**
 * A gallery card's live preview: the real runtime in the sandboxed frame, only while the card is
 * on screen. Leaving the viewport unmounts the frame, which stops its timers and observers
 * (live(), mouse(), visible()…); coming back starts it again from its initial state.
 */
export function CardPreview({ title, css, base, html, height = 240 }: CardPreviewProps) {
  const box = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  // Scaled once, from the first height the preview reports, so a tall interaction still fits whole.
  const [scale, setScale] = useState(1);
  const measured = useRef(false);
  const fit = (h: number) => { if (measured.current || h <= 0) return; measured.current = true; setScale(Math.min(1, (height - 16) / h)); };
  const analysis = useMemo(() => analyze(css), [css]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { setOn(!!e?.isIntersecting); if (!e?.isIntersecting) { measured.current = false; setScale(1); } }, { rootMargin: '120px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={box} className="relative flex w-full items-center justify-center overflow-hidden bg-paper-2" style={{ height }} data-card-preview={on ? 'live' : 'idle'}>
      {on
        ? <div className="flex-none" style={{ width: `${100 / scale}%`, transform: `scale(${scale})` }}><PreviewFrame sources={{ css, base, html }} analysis={analysis} title={`${title}: live preview`} autoHeight onHeight={fit} className="bg-transparent!" /></div>
        : <span className="absolute inset-0 grid place-items-center font-mono text-tag text-mute">Starting the preview…</span>}
    </div>
  );
}
