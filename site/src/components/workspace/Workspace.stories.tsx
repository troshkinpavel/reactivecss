import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { getExample } from '~/examples/manifest';
import { highlight } from '~/lib/code/highlight';
import { WORKSPACES } from '~/lib/content/workspaces';
import { ControlCenterWorkspace } from './ControlCenterWorkspace';
import { mapEntries, nativeTrace, traceFor } from './model';
import { ExpressionInspector, GuidedBar, StatePanel, SubmissionPreview, TraceChain } from './Panels';
import { SourceViewer, type ViewerFile } from './SourceViewer';

const ws = WORKSPACES['control-center']!;
const ex = getExample('control-center');
const map = mapEntries(ex.files.css, ws.entries);
const notifyTrace = traceFor({ event: { id: 1, type: 'change', target: 'input#notify', key: null, triggers: [map.entryLines['b-notify']![0]!] }, changes: [{ name: '--notify', owner: 0, from: 'true', to: 'false' }] }, ws, map, 1)!;
const values = new Map([['--theme', 'light'], ['--accent', 'moss'], ['--notify', 'false'], ['--name', '"Sam"']].map(([k, v]) => [k!, { name: k!, owner: 0, ownerLabel: 'form.control-center', value: v!, previous: k === '--notify' ? 'true' : null, changes: k === '--notify' ? 1 : 0, at: 0 }]));

const files = async (id: 'control-center' | 'control-center-deep') => {
  const e = getExample(id);
  const f = async (name: string, lang: ViewerFile['lang'], code?: string | null): Promise<ViewerFile[]> => (code ? [{ name, lang, code, lines: await highlight(code, lang) }] : []);
  return {
    rcss: [...await f('style.css', 'css', e.files.css), ...await f('index.html', 'html', e.files.html)],
    js: [...await f('style.css', 'css', e.files.vanillaCss), ...await f('index.html', 'html', e.files.vanillaHtml), ...await f('script.js', 'js', e.files.js)],
  };
};

const meta = { title: 'Interactive Examples/Workspace', parameters: { layout: 'padded' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The full Advanced Control Center, running the real example. Interact inside the preview. */
export const AdvancedControlCenter: Story = {
  name: 'Advanced Control Center',
  parameters: { layout: 'fullscreen' },
  loaders: [async () => ({ files: await files('control-center') })],
  render: (_, { loaded }) => <div className="p-4"><ControlCenterWorkspace ws={ws} example={ex} files={loaded.files} apiHrefs={{ state: '/docs/reference/state/', ':on()': '/docs/reference/on-rule/', when: '/docs/reference/when/', ':when': '/docs/reference/when-selector/' }} /></div>,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await waitFor(() => expect(canvasElement.querySelector('[data-line="5"] [data-chip]')).toHaveTextContent('light'), { timeout: 8000 });
    await userEvent.click(c.getByRole('radio', { name: 'Guided' }));
    await expect(c.getByText('guide · 1 of 5')).toBeVisible();
    await userEvent.click(c.getByRole('button', { name: 'Next' }));
    await expect(c.getByText('guide · 2 of 5')).toBeVisible();
    await userEvent.click(c.getByRole('radio', { name: 'Vanilla JS' }));
    await expect(c.getByText('Comparing implementations')).toBeVisible();
  },
};
export const DeepDive: Story = {
  name: 'Control Center · Deep Dive',
  parameters: { layout: 'fullscreen' },
  loaders: [async () => ({ files: await files('control-center-deep') })],
  render: (_, { loaded }) => <div className="p-4"><ControlCenterWorkspace ws={WORKSPACES['control-center-deep']!} example={getExample('control-center-deep')} files={loaded.files} apiHrefs={{}} /></div>,
};

export const Trace: Story = { name: 'Event trace', render: () => <div className="max-w-[520px]"><TraceChain trace={notifyTrace} history={[notifyTrace, nativeTrace('submit', 'POST /settings', 0)]} selectedIndex={0} onPick={() => {}} onPickHistory={() => {}} /></div> };
export const TraceEmpty: Story = { name: 'Event trace · empty', render: () => <div className="max-w-[520px]"><TraceChain trace={null} history={[]} selectedIndex={0} onPick={() => {}} onPickHistory={() => {}} /></div> };

type InspArgs = { entryId: string; pinned: boolean };
/** Pick any expression of the registry; values are a fixed sample. */
export const Inspector: StoryObj<InspArgs> = {
  name: 'Expression inspector',
  args: { entryId: 'c-alertBorder', pinned: true },
  argTypes: { entryId: { control: 'select', options: ws.entries.map((e) => e.id), name: 'selected expression' } },
  render: (a) => {
    const e = ws.entries.find((x) => x.id === a.entryId) ?? null;
    return <div className="h-[340px] max-w-[460px] rounded-block border border-line"><ExpressionInspector ws={ws} entry={e} pinned={a.pinned} lines={map.entryLines[a.entryId] ?? []} section="Live preview" values={values} observed={e?.own ? values.get('--' + e.own) : undefined} onSelect={() => {}} onClear={() => {}} onRegion={() => {}} onPrev={() => {}} onNext={() => {}} apiHref={() => '#'} /></div>;
  },
};
export const InspectorEmpty: Story = { name: 'Expression inspector · empty', render: () => <div className="h-[220px] max-w-[460px] rounded-block border border-line"><ExpressionInspector ws={ws} entry={null} pinned={false} lines={[]} values={values} onSelect={() => {}} onClear={() => {}} onRegion={() => {}} onPrev={() => {}} onNext={() => {}} apiHref={() => '#'} /></div> };

export const State: Story = { name: 'State inspector', render: () => <div className="h-[300px] max-w-[420px] rounded-block border border-line"><StatePanel ws={ws} values={values} flashKey={['notify']} onSelect={() => {}} selected="d-notify" /></div> };
export const StateLoading: Story = { name: 'State inspector · loading', render: () => <div className="h-[300px] max-w-[420px] rounded-block border border-line"><StatePanel ws={ws} values={new Map()} flashKey={[]} onSelect={() => {}} selected={null} /></div> };

type GuideArgs = { step: number };
export const Guided: StoryObj<GuideArgs> = { name: 'Guided mode controls', args: { step: 1 }, argTypes: { step: { control: { type: 'range', min: 0, max: 4 } } }, render: (a) => <GuidedBar steps={ws.guide} step={a.step} done={{ 0: true }} onStep={() => {}} onExit={() => {}} /> };

export const Submission: Story = { name: 'Submission preview', render: () => <div className="max-w-[480px]"><SubmissionPreview submission={{ method: 'POST', action: '/settings', fields: [['theme', 'dark'], ['accent', 'moss'], ['displayName', 'Sam']], omitted: ['notifications'] }} onClose={() => {}} /></div> };

/** Outline, folding and chips. Fold a section with its caret or Fold all. */
export const Source: Story = {
  name: 'Source viewer',
  loaders: [async () => ({ files: await files('control-center') })],
  render: (_, { loaded }) => <div className="h-[460px] rounded-block border border-line"><SourceViewer files={loaded.files.rcss} file={0} onFile={() => {}} lineEntry={map.lineEntry} sectionCounts={{ State: 4, Bindings: 4 }} chips={{ 5: 'light', 7: 'false' }} focus={map.entryLines['b-notify']} /></div>,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Fold all' }));
    await expect(c.getByRole('button', { name: 'Unfold all' })).toBeVisible();
  },
};
