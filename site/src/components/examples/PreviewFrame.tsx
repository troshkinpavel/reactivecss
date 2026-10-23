import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Analysis } from '~/lib/examples/analyze';
import { FROM_HOST, PROTOCOL_VERSION, parsePreviewMessage, type HostMessage, type PreviewMessage } from '~/lib/examples/protocol';
import { loadPreviewScripts, nonce, type PreviewScripts } from '~/lib/examples/scripts';
import { buildSrcdoc, watchSpec, type PreviewSources } from '~/lib/examples/srcdoc';

export interface PreviewFrameProps {
  sources: PreviewSources;
  analysis: Analysis;
  /** Accessible name of the iframe. */
  title: string;
  onMessage?: (m: PreviewMessage) => void;
  /** Selectors to outline inside the preview (inspector hover). */
  highlight?: string[];
  /** Change to restart the example from its initial state. */
  resetKey?: number;
  className?: string;
  style?: CSSProperties;
  /** Size the frame to its content (reported by the bridge) instead of filling its container. */
  autoHeight?: boolean;
  minHeight?: number;
  /** Cap for autoHeight. Content that is taller, or sized in viewport units, scrolls inside the frame. */
  maxHeight?: number;
  /** Fill the container (flex-1) but never shrink below the content, so there is no inner scroll. */
  growToContent?: boolean;
  /** Show runtime diagnostics under the frame. Off where the parent shows them itself. */
  reportProblems?: boolean;
  /** Called with the content height the bridge reports. */
  onHeight?: (height: number) => void;
  /** Run the development bundle, whose diagnostics are full messages (the Playground). */
  devRuntime?: boolean;
}

/** A preview that has not reported in this long after loading is shown as not started. */
const STALL_MS = 8000;

/**
 * Runs an example with the real Reactive CSS runtime in a sandboxed iframe (opaque origin,
 * scripts and forms only, strict CSP). Messages are accepted only from this iframe's window
 * and only in the shape defined by the protocol.
 */
export function PreviewFrame({ sources, analysis, title, onMessage, highlight, resetKey = 0, className = '', style, autoHeight = false, minHeight = 0, maxHeight = Infinity, growToContent = false, reportProblems = true, onHeight, devRuntime = false }: PreviewFrameProps) {
  const [started, setStarted] = useState(false);
  const [stalled, setStalled] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [height, setHeight] = useState<number | null>(null);
  const ref = useRef<HTMLIFrameElement>(null);
  const handler = useRef(onMessage);
  handler.current = onMessage;
  const heightCb = useRef(onHeight);
  heightCb.current = onHeight;
  // Built on the client: the scripts are fetched once and inlined under a fresh nonce.
  const [scripts, setScripts] = useState<PreviewScripts | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { loadPreviewScripts('', devRuntime).then(setScripts, (e: Error) => setError(e.message)); }, [devRuntime]);
  const srcdoc = useMemo(
    () => (scripts ? buildSrcdoc(sources, watchSpec(analysis), scripts, nonce()) : undefined),
    [scripts, sources.css, sources.base, sources.html, sources.script, analysis, resetKey],
  );

  useEffect(() => {
    const listen = (e: MessageEvent) => {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      const m = parsePreviewMessage(e.data);
      if (!m) return;
      if (m.type === 'ready') { setStarted(true); setStalled(false); setProblems(m.diagnostics); }
      if (m.type === 'diagnostics') setProblems(m.messages);
      if (m.type === 'size') { setHeight(m.height); heightCb.current?.(m.height); }
      else handler.current?.(m);
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, []);

  // Each new document must report in; one that never does is not presented as a working demo.
  useEffect(() => {
    if (!srcdoc) return;
    setStarted(false); setStalled(false); setProblems([]);
    const t = setTimeout(() => setStalled(true), STALL_MS);
    return () => clearTimeout(t);
  }, [srcdoc]);

  const send = (m: HostMessage) => ref.current?.contentWindow?.postMessage({ source: FROM_HOST, v: PROTOCOL_VERSION, ...m }, '*');
  const key = (highlight ?? []).join('|');
  useEffect(() => { send({ type: 'highlight', selectors: highlight ?? [] }); }, [key]);

  if (error) return <p role="alert" className="m-auto p-4 text-sm text-ink">! The preview could not load the runtime. {error}</p>;
  const frame = (
    <iframe
      ref={ref}
      key={resetKey}
      title={title}
      sandbox="allow-scripts allow-forms"
      srcDoc={srcdoc}
      onLoad={() => send({ type: 'highlight', selectors: highlight ?? [] })}
      className={`block h-full w-full border-0 bg-paper ${className}`}
      style={autoHeight ? { ...style, height: Math.min(maxHeight, Math.max(minHeight, height ?? minHeight)) } : growToContent && height ? { ...style, minHeight: height } : style}
    />
  );
  const note = stalled && !started
    ? 'The preview did not start: the sandboxed document never reported back. Reload the page; if it persists, the browser may block sandboxed frames.'
    : reportProblems && problems.length ? `ReactiveCSS.diagnostics · ${problems.at(-1)}` : null;
  if (!note) return frame;
  return (
    <>
      {frame}
      <p role={stalled ? 'alert' : 'status'} data-preview-problem="" className="m-0 flex gap-2.5 border-t border-ink bg-paper px-3.5 py-2.5 text-sm text-ink">
        <span aria-hidden="true" className="font-mono text-label">!</span><span className="min-w-0 break-words">{note}</span>
      </p>
    </>
  );
}
