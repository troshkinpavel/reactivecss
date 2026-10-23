import type { ReactNode } from 'react';
import { isReactiveSnippet } from '~/lib/code/vocabulary';

/** Inline code. Reactive CSS syntax is vermilion with a dotted underline; native code sits in a tinted box. */
export function InlineCode({ children }: { children?: ReactNode }) {
  const text = typeof children === 'string' ? children : Array.isArray(children) ? children.join('') : '';
  // Long snippets may wrap on narrow screens; short ones never break.
  const wrap = text.length > 24 ? '[overflow-wrap:anywhere]' : 'whitespace-nowrap';
  if (isReactiveSnippet(text)) return <code className={`rx font-mono text-[0.86em] font-medium ${wrap}`}>{children}</code>;
  return <code className={`rounded-tag border border-line bg-paper-2 px-[5px] py-px font-mono text-[0.86em] [box-decoration-break:clone] text-ink ${wrap}`}>{children}</code>;
}
