import { useRef, useState } from 'react';
import { CodePanel } from '~/components/code/CodePanel';
import { Button } from '~/components/ui/Button';
import { highlightCss } from '~/lib/code/css';

const CODE = '/* native CSS stays ink */\n.chip {\n  --open: state(false);\n  rotate: when(--open, 45deg, 0deg);\n}\n.chip:on(click) { --open: toggle(); }\n.chip:when(--open) .menu {\n  display: block;\n}';
const LINES = highlightCss(CODE);

/**
 * A specimen of the reaction trace, for the design system page. It plays the visual sequence
 * (event → state → dependents) on static code; it does not run the runtime.
 */
export function TraceSpecimen() {
  const [on, setOn] = useState(false);
  const [flash, setFlash] = useState<number[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const fire = () => {
    timers.current.forEach(clearTimeout);
    setOn((v) => !v);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seq = reduced ? [[5, 2, 3, 6]] : [[5], [2], [3, 6]];
    timers.current = seq.map((l, i) => setTimeout(() => setFlash(l), i * 120));
    timers.current.push(setTimeout(() => setFlash([]), seq.length * 120 + 520));
  };
  return (
    <div className="flex flex-col gap-2.5">
      <div className="min-h-[264px]"><CodePanel lines={LINES} code={CODE} label="specimen.css" badge="specimen · no runtime" chips={{ 2: String(on) }} flash={flash} dim={[[3, on ? '0deg' : '45deg']]} /></div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={fire}>Run the trace</Button>
        <span className="text-sm text-mute">Event line → state line → dependent lines, 120ms apart, then a 500ms fade. With reduced motion, all lines mark at once without fading.</span>
      </div>
    </div>
  );
}
