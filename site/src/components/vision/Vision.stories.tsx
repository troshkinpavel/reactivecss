import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { EvolutionSteps, ExperimentDemo } from './VisionV2';

const meta = { title: 'Vision', parameters: { layout: 'padded' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const wide = (node: React.ReactNode) => <div className="mx-auto max-w-[1280px]">{node}</div>;

/** 02 · Calculate → Relate → Decide → React?: three native steps in native CSS, the fourth run by the runtime. */
export const Evolution: Story = {
  render: () => wide(<EvolutionSteps />),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const slider = c.getByRole('slider', { name: 'Viewport width' });
    await userEvent.click(c.getByRole('checkbox', { name: 'Card contains an image' }));
    await expect(c.getByText('→ no match')).toBeVisible();
    await userEvent.click(c.getByText('--size: large'));
    await expect(c.getByRole('radio', { name: '--size: large' })).toBeChecked();
    await expect(slider).toHaveValue('720');
    await waitFor(() => expect(canvasElement.querySelector('iframe[title^="Counter"]')).toBeTruthy());
  },
};

/** 04 · The article stylesheet beside its result. Hovering a role highlights its lines. */
export const Experiment: Story = {
  render: () => wide(<ExperimentDemo />),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.hover(c.getByRole('button', { name: 'event · :on()' }));
    await waitFor(() => expect(canvasElement.querySelector('[data-role="event"].bg-trace')).toBeTruthy());
    await expect(canvasElement.querySelector('[data-role="state"].bg-trace')).toBeNull();
  },
};

/** At phone width the steps and the code stack; long lines scroll inside the code. */
export const Narrow: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } }, render: () => <><EvolutionSteps /><div className="mt-10"><ExperimentDemo /></div></> };
