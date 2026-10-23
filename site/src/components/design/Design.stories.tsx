import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { AdvancedIndex } from '~/components/docs/AdvancedIndex';
import { TraceSpecimen } from './TraceSpecimen';

const meta = { title: 'Compositions' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The reaction trace on static code (design system specimen; no runtime). */
export const ReactionTraceSpecimen: Story = {
  name: 'Reaction trace specimen',
  render: () => <div className="max-w-[720px]"><TraceSpecimen /></div>,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Run the trace' }));
    await waitFor(() => expect(canvasElement.querySelector('[data-flash]')).toBeTruthy());
    await expect(canvasElement.querySelector('[data-chip]')).toHaveTextContent('true');
  },
};
export const AdvancedExamples: Story = { name: 'Advanced Examples index', render: () => <AdvancedIndex /> };
