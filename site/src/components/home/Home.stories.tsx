import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { highlight } from '~/lib/code/highlight';
import { getExample } from '~/examples/manifest';
import { BeforeAfter } from './BeforeAfter';

const meta = { title: 'Homepage', parameters: { layout: 'padded' } } satisfies Meta;
export default meta;

const greeting = getExample('greeting');
const load = async () => {
  const html = greeting.files.vanillaHtml ?? greeting.files.html;
  return { js: { code: greeting.files.js ?? '', lines: await highlight(greeting.files.js ?? '', 'js') }, html: { code: html, lines: await highlight(html, 'html') } };
};

/** Before / after with the part highlighter; the strip runs greeting.css for real. */
export const BeforeAfterStory: StoryObj = {
  name: 'Before / After',
  loaders: [load],
  render: (_, { loaded }) => <div className="max-w-[1200px]"><BeforeAfter example={greeting} js={loaded.js} html={loaded.html} /></div>,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('radio', { name: 'Event' }));
    await expect(c.getByText('What runs on click.')).toBeVisible();
    const focused = () => [...canvasElement.querySelectorAll('#ba-css [data-line]')].filter((l) => l.className.includes('bg-[oklch(0.93')).map((l) => (l as HTMLElement).dataset.line);
    await expect(focused()).toEqual(['4', '5', '8', '9']);
    await waitFor(() => expect(canvasElement.querySelector('#ba-css [data-chip]')).toBeTruthy(), { timeout: 8000 });
  },
};
