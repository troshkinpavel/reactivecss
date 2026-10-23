import { Fragment, type ReactNode } from 'react';
import { InlineCode } from './InlineCode';

/** Renders the inline Markdown used in API data: `code`, [links](/x/) and **bold**. */
export function InlineMarkdown({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)|``\s?(.+?)\s?``|`([^`]+)`|\*\*([^*]+)\*\*/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      const code = /^`(.+)`$/.exec(m[1]);
      out.push(<a key={k++} href={m[2]}>{code ? <InlineCode>{code[1]}</InlineCode> : m[1]}</a>);
    } else if (m[3] !== undefined || m[4] !== undefined) out.push(<InlineCode key={k++}>{m[3] ?? m[4]}</InlineCode>);
    else out.push(<strong key={k++} className="font-semibold text-ink">{m[5]}</strong>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out.map((n, i) => <Fragment key={i}>{n}</Fragment>)}</>;
}
