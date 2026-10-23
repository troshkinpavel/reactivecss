import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Capabilities } from '~/components/home/Capabilities';
import { CAPABILITIES } from '~/lib/content/home';
import { getComparison } from '~/lib/content/comparisons';
import { getExample } from '~/examples/manifest';
import { highlight } from '~/lib/code/highlight';
import { CodeComparison } from './CodeComparison';
import { LiveExample } from './LiveExample';
import { Playground } from './Playground';

const meta = { title: 'Interactive Examples', parameters: { layout: 'padded' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Code panel and preview card sharing one running example (homepage hero). */
export const LivePreview: StoryObj<{ exampleId: string }> = {
  name: 'Live Preview',
  args: { exampleId: 'greeting' },
  argTypes: { exampleId: { control: 'select', options: ['greeting', 'wizard', 'score', 'profile', 'spotlight'] } },
  render: (a) => <div className="max-w-[920px]"><LiveExample key={a.exampleId} example={getExample(a.exampleId)} fontSize={14.5} /></div>,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('[data-chip]')).toBeTruthy(), { timeout: 8000 });
  },
};

type CmpArgs = { id: string };
export const Comparison: StoryObj<CmpArgs> = {
  name: 'Code Comparison',
  args: { id: 'when' },
  argTypes: { id: { control: 'inline-radio', options: ['typed', 'when', 'whensel'] } },
  loaders: [async ({ args }) => {
    const c = getComparison(args.id);
    return { c, native: await Promise.all(c.nativeFiles.map(async (f) => ({ ...f, lines: await highlight(f.code, f.lang) }))) };
  }],
  render: (_, { loaded }) => <div className="max-w-[960px]"><CodeComparison {...loaded.c} native={loaded.native} example={getExample(loaded.c.example)} differences={loaded.c.differences} /></div>,
};
export const ComparisonNarrow: StoryObj<CmpArgs> = {
  ...Comparison,
  name: 'Code Comparison · narrow (tabs)',
  render: (_, { loaded }) => <div className="max-w-[420px]"><CodeComparison {...loaded.c} native={loaded.native} example={getExample(loaded.c.example)} differences={loaded.c.differences} /></div>,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('tab', { name: 'Native' }));
    await expect(c.getByRole('tab', { name: 'Native' })).toHaveAttribute('aria-selected', 'true');
  },
};

export const PlaygroundStory: Story = {
  name: 'Playground',
  parameters: { layout: 'fullscreen' },
  render: () => <Playground items={[['blank', 'Blank', 'pg-blank'], ['toggle', 'Toggle', 'pg-toggle'], ['counter', 'Counter', 'pg-counter'], ['tabs', 'Tabs', 'pg-tabs'], ['input', 'Input binding', 'pg-input'], ['drag', 'Drag', 'pg-drag']].map(([key, label, id]) => ({ key: key!, label: label!, example: getExample(id!) }))} />,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await waitFor(() => expect(c.getByText('No diagnostics · running')).toBeVisible(), { timeout: 8000 });
    const editor = c.getByLabelText(/CSS editor, switch\.css/);
    await userEvent.type(editor, '/* edit */');
    await waitFor(() => expect(c.getByText('Waiting for you to stop typing.')).toBeVisible());
    await userEvent.click(c.getByRole('radio', { name: 'Counter' }));
    await expect(c.getByLabelText(/CSS editor, counter\.css/)).toBeVisible();
    await userEvent.click(c.getByRole('radio', { name: /^Toggle/ }));
    await waitFor(() => expect((c.getByLabelText(/CSS editor, switch\.css/) as HTMLTextAreaElement).value).toContain('/* edit */'));
  },
};

export const HomepageShowcase: Story = {
  name: 'Homepage showcase (capabilities)',
  render: () => <Capabilities items={CAPABILITIES.map((c) => ({ ...c, example: getExample(c.id) }))} />,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('tab', { name: /State history/ }));
    await userEvent.keyboard('{ArrowDown}');
    await expect(c.getByRole('tab', { name: /Binding/ })).toHaveAttribute('aria-selected', 'true');
  },
};
