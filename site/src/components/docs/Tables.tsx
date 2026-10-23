import type { ReactNode } from 'react';
import type { ApiParam } from '~/lib/content/reference';
import { InlineMarkdown } from './InlineMarkdown';

/** Wrapper for Markdown tables: tinted head, hairlines, horizontal scroll on narrow screens. */
export function DataTable({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1 mb-6 max-w-[860px] overflow-x-auto overflow-y-hidden rounded-block border border-line [scrollbar-width:thin]">
      <table className="w-full min-w-[520px] border-collapse text-base [&_td]:border-t [&_td]:border-line [&_td]:px-3.5 [&_td]:py-2.5 [&_td]:align-top [&_td]:leading-normal [&_td]:text-ink-body [&_th]:border-b [&_th]:border-line [&_th]:px-3.5 [&_th]:py-2.5 [&_th]:text-left [&_th]:align-bottom [&_th]:font-semibold [&_thead_tr]:bg-paper-2">
        {children}
      </table>
    </div>
  );
}

/** API parameters: name, type, required/optional, description. */
export function ParamList({ params }: { params: ApiParam[] }) {
  return (
    <dl className="mb-5 max-w-[860px] border-t border-ink">
      {params.map((p) => (
        <div key={p.name} className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-x-7 gap-y-1.5 border-b border-line py-3.5">
          <dt className="flex flex-col gap-[5px]">
            <span className="font-mono text-ui font-semibold">{p.name}</span>
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] text-ink-2">
              <span><InlineMarkdown text={p.type} /></span>
              <span className="font-mono text-tag">{p.required}</span>
            </span>
          </dt>
          <dd className="m-0 text-note leading-[1.6] text-ink-body"><InlineMarkdown text={p.description} /></dd>
        </div>
      ))}
    </dl>
  );
}

export interface ApiRow { name: string; href: string; kind: string; summary: string; status: string }

/** One table per API category on the reference index. */
export function ApiIndexTable({ rows }: { rows: ApiRow[] }) {
  return (
    <div className="mt-1 mb-3 overflow-x-auto overflow-y-hidden rounded-block border border-line [scrollbar-width:thin]">
      <table className="w-full min-w-[600px] border-collapse text-base">
        <thead>
          <tr className="bg-paper-2 text-left">
            <th scope="col" className="w-[170px] px-3.5 py-2.5 font-semibold">Name</th>
            <th scope="col" className="w-[110px] px-3.5 py-2.5 font-semibold">Kind</th>
            <th scope="col" className="px-3.5 py-2.5 font-semibold">Description</th>
            <th scope="col" className="w-[150px] px-3.5 py-2.5 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.href}>
              <td className="border-t border-line px-3.5 py-2.5 align-top"><a href={r.href} className="font-mono text-[14px] font-semibold text-rx decoration-rx-soft">{r.name}</a></td>
              <td className="border-t border-line px-3.5 py-2.5 align-top text-[14px] text-ink-2">{r.kind}</td>
              <td className="border-t border-line px-3.5 py-2.5 align-top leading-normal text-ink-body"><InlineMarkdown text={r.summary} /></td>
              <td className="border-t border-line px-3.5 py-2.5 align-top font-mono text-label text-ink-2">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface ExampleRow { title: string; href: string; summary: string; uses: string[] }

/** The examples index: title, summary and the APIs each example uses. */
export function ExampleList({ rows }: { rows: ExampleRow[] }) {
  return (
    <div className="mt-2 mb-6 flex flex-col border-t border-ink">
      {rows.map((r) => (
        <a key={r.href} href={r.href} className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-x-8 gap-y-1.5 border-b border-line py-[18px] no-underline hover:bg-paper-2">
          <span className="flex flex-col gap-1">
            <span className="text-[19px] font-semibold tracking-[-0.015em]">{r.title} →</span>
            <span className="text-base leading-[1.55] text-ink-2">{r.summary}</span>
          </span>
          <span className="flex flex-wrap content-start gap-1.5">
            {r.uses.map((u) => <span key={u} className="rounded-tag border border-line px-[7px] py-0.5 font-mono text-meta text-rx">{u}</span>)}
          </span>
        </a>
      ))}
    </div>
  );
}
