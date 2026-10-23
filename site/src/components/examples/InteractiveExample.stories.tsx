import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { exampleIds, getExample } from '~/examples/manifest';
import { highlight } from '~/lib/code/highlight';
import { COMPARISON_NOTE, InteractiveExample } from './InteractiveExample';

type Args = { exampleId: string; size: 'compact' | 'standard' | 'expanded'; controls: boolean };

const meta = {
  title: 'Interactive Examples/Interactive Example',
  parameters: { layout: 'padded' },
  argTypes: {
    exampleId: { control: 'select', options: exampleIds, name: 'example' },
    size: { control: 'inline-radio', options: ['compact', 'standard', 'expanded'] },
    controls: { control: 'boolean' },
  },
  args: { exampleId: 'switch', size: 'standard', controls: false },
  // HTML and JS are highlighted with Shiki, asynchronously, as Astro does at build time.
  loaders: [async ({ args }) => {
    const ex = getExample(args.exampleId);
    return { highlighted: { html: await highlight(ex.files.html, 'html'), js: ex.files.js ? await highlight(COMPARISON_NOTE + ex.files.js, 'js') : null } };
  }],
  render: (args, { loaded }) => (
    <div style={{ maxWidth: 960 }}>
      <InteractiveExample example={getExample(args.exampleId)} size={args.size} controls={args.controls} highlighted={loaded.highlighted} />
    </div>
  ),
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The chip shows the value the runtime reported from the sandboxed preview. Clicks inside the
 * preview are covered by Playwright (tests/e2e/examples.spec.ts): the iframe has an opaque
 * origin, which synthetic test events cannot reach.
 */
export const Toggle: Story = {
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('[data-line="1"] [data-chip]')).toHaveTextContent('false'), { timeout: 8000 });
    await expect(within(canvasElement).getByTitle(/real Reactive CSS runtime/)).toHaveTextContent('Result');
  },
};

export const Counter: Story = { args: { exampleId: 'counter', size: 'expanded' } };
export const Greeting: Story = { args: { exampleId: 'greeting' } };
export const LikeWithControls: Story = { name: 'Like · source controls', args: { exampleId: 'like', controls: true } };
export const Compact: Story = { args: { exampleId: 'counter', size: 'compact' } };
export const Mobile: Story = { args: { exampleId: 'switch' }, globals: { viewport: { value: 'mobile' } } };

/** File tabs are ARIA tabs: arrow keys move between them. */
export const FileTabs: Story = {
  args: { exampleId: 'counter' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const css = canvas.getByRole('tab', { name: /counter\.css/ });
    await userEvent.click(css);
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: /index\.html/ })).toHaveAttribute('aria-selected', 'true');
    // The vanilla JS comparison comes last and says it is not part of the example.
    await userEvent.keyboard('{End}');
    await expect(canvas.getByRole('tab', { name: /vanilla\.js/ })).toHaveAttribute('aria-selected', 'true');
    await expect(canvas.getByRole('tab', { name: /vanilla\.js/ })).toHaveTextContent('comparison · not shipped');
    await expect(canvas.getAllByText('For comparison only. Not needed with Reactive CSS.', { exact: false })[0]).toBeVisible();
    await expect(canvas.getAllByText('addEventListener', { exact: false })[0]).toBeVisible();
  },
};
