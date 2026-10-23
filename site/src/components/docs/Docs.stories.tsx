import type { Meta, StoryObj } from '@storybook/react-vite';
import { API, CATEGORIES, apiHref, entryKind } from '~/lib/content/reference';
import { Callout, type CalloutKind } from './Callout';
import { Card, Cards, Fact, Facts, Flow, FlowStep } from './Facts';
import { InlineCode } from './InlineCode';
import { InlineMarkdown } from './InlineMarkdown';
import { RelatedLinks } from './Related';
import { ApiIndexTable, DataTable, ExampleList, ParamList } from './Tables';

const meta = { title: 'Documentation', parameters: { layout: 'padded' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const ArticleTypography: Story = {
  name: 'Article heading and paragraphs',
  render: () => (
    <article className="max-w-(--container-prose)">
      <h1 className="text-[50px] leading-[1.02] font-semibold tracking-h1">Conditions</h1>
      <p className="mt-4 mb-7 text-lede leading-[1.6] text-ink-2">when() picks one of two values from a condition, and :when() matches whole rules.</p>
      <h2 className="mt-14 mb-3.5 flex items-baseline gap-3.5 text-h2 leading-[1.2] font-semibold tracking-h2"><span className="step">1</span> Add the library</h2>
      <p className="mb-[18px] text-body leading-[1.7] text-pretty text-ink-body">The second value is optional. When the condition is unknown, <InlineCode>when()</InlineCode> gives no value at all (the property is <InlineCode>unset</InlineCode>).</p>
    </article>
  ),
};

export const InlineCodeStory: Story = { name: 'Inline code', render: () => <p className="text-body">Reactive: <InlineCode>state()</InlineCode> <InlineCode>:when()</InlineCode> <InlineCode>on:</InlineCode> · Native: <InlineCode>calc()</InlineCode> <InlineCode>{'<details>'}</InlineCode> <InlineCode>if()</InlineCode></p> };

const KINDS: CalloutKind[] = ['note', 'tip', 'caution', 'warning', 'experimental', 'provisional', 'outcome'];
/** Editable: kind, title and text. */
export const Callouts: StoryObj<{ kind: CalloutKind; title: string; text: string }> = {
  args: { kind: 'note', title: 'In memory only', text: 'State resets on reload and when its stylesheet is edited.' },
  argTypes: { kind: { control: 'select', options: KINDS } },
  render: (a) => <Callout kind={a.kind} title={a.title}><p>{a.text}</p></Callout>,
};
export const AllCallouts: Story = { name: 'Callouts · every kind', render: () => <>{KINDS.map((k) => <Callout key={k} kind={k} title={k === 'outcome' ? undefined : 'Example'}><p>Body text with <InlineCode>state()</InlineCode> and a <a href="#">link</a>.</p></Callout>)}</> };

export const FactsAndFlow: Story = {
  name: 'Facts, flow and cards',
  render: () => (
    <div>
      <Facts><Fact label="Time">About 5 minutes</Fact><Fact label="You need">A local web server and a browser</Fact><Fact label="You will use"><InlineCode>state()</InlineCode>, <InlineCode>on:</InlineCode>, <InlineCode>when()</InlineCode></Fact></Facts>
      <Flow><FlowStep title="Trigger"><InlineCode>click()</InlineCode> fires</FlowStep><FlowStep title="Action"><InlineCode>set()</InlineCode> writes a state</FlowStep><FlowStep title="State">The nearest owner's cell changes</FlowStep><FlowStep title="Browser">Style and paint happen natively</FlowStep></Flow>
      <Cards><Card href="#" title="State">Ownership, nearest-owner lookup and lifetime.</Card><Card href="#" title="Events & Actions">Every trigger and action.</Card><Card href="#" title="Conditions">Comparisons and native <InlineCode>if()</InlineCode>.</Card></Cards>
    </div>
  ),
};

export const Table: Story = {
  name: 'Data table',
  render: () => (
    <DataTable>
      <thead><tr><th>Option</th><th>Default</th><th>Effect</th></tr></thead>
      <tbody>
        <tr><td><InlineCode>trustInlineStyles</InlineCode></td><td><InlineCode>true</InlineCode></td><td>false: event rules and bindings are accepted only from same-origin link sheets.</td></tr>
        <tr><td><InlineCode>native</InlineCode></td><td><InlineCode>true</InlineCode></td><td>false: when() always uses the runtime instead of native if().</td></tr>
      </tbody>
    </DataTable>
  ),
};

export const Params: Story = { name: 'API parameter list', render: () => <ParamList params={API.find((a) => a.id === 'set')!.params} /> };

export const ApiIndex: Story = {
  name: 'API index table',
  render: () => <>{CATEGORIES.slice(0, 2).map((c) => <ApiIndexTable key={c} rows={API.filter((a) => a.category === c).map((a) => ({ name: a.name, href: apiHref(a.id), kind: entryKind(a), summary: a.summary, status: 'since 0.2' }))} />)}</>,
};

export const Related: Story = { name: 'Related API links', render: () => <RelatedLinks links={[{ label: 'state()', href: '#', mono: true }, { label: 'when()', href: '#', mono: true }, { label: 'Conditions', href: '#' }]} /> };

export const Examples: Story = { name: 'Example list', render: () => <ExampleList rows={[{ title: 'Toggle', href: '#', summary: 'A switch whose track color and knob position come from one boolean state.', uses: ['state()', ':on()', 'toggle()', 'when()'] }, { title: 'Tabs', href: '#', summary: 'Tabs selected by position.', uses: ['state()', 'set()', ':nth-var()'] }]} /> };

export const MarkdownStrings: Story = { name: 'Inline Markdown (API data)', render: () => <p className="text-body"><InlineMarkdown text={API[0]!.params[0]!.type} /> — <InlineMarkdown text="See [:on()](/docs/reference/on-rule/) and **bold** text with `calc()`." /></p> };

export const FeatureStatus: Story = {
  name: 'Feature status indicators',
  render: () => (
    <ul className="flex list-none flex-col gap-2 p-0 font-mono text-label">
      {API.filter((a) => ['state', 'typed', 'element', 'wave', 'when'].includes(a.id)).map((a) => <li key={a.id} className="flex gap-3"><span className="w-28 text-rx">{a.name}</span><span className="text-ink-2">{entryKind(a)}</span></li>)}
    </ul>
  ),
};
