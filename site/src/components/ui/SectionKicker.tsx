/**
 * Mono marker above marketing headings: `01  Before / after`. With `comment`, it is written as a
 * CSS comment, `/* 01 Before / after *\/`, with the delimiters muted (homepage).
 */
export function SectionKicker({ n, label, tone = 'paper', comment = false }: { n?: string; label: string; tone?: 'paper' | 'night'; comment?: boolean }) {
  return (
    <div className={`mb-5 flex gap-3 font-mono text-meta ${tone === 'night' ? 'text-night-mute' : 'text-mute'}`}>
      {comment && <span aria-hidden="true">/*</span>}
      {n && <span className={tone === 'night' ? 'text-night-text' : 'text-ink'}>{n}</span>}
      <span>{label}</span>
      {comment && <span aria-hidden="true">*/</span>}
    </div>
  );
}
