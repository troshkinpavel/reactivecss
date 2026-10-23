import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { highlight, highlightCss } from '~/lib/code/highlight';
import type { Lang } from '~/lib/code/types';
import { CodePanel } from './CodePanel';

const SWITCH = '.switch {\n  --on: state(false);\n  background: when(--on, #f2542d, #d9d5cf);\n}\n\n.switch:on(click) {\n  --on: toggle();\n}';

type Args = { code: string; lang: Lang; label: string; badge: string; header: boolean; legend: boolean; explain: boolean; fontSize: number; flash: number[]; chips: Record<number, string>; dim: [number, string][] };

const meta = {
  title: 'Code/Code Panel',
  args: { code: SWITCH, lang: 'css', label: 'switch.css', badge: '', header: true, legend: true, explain: true, fontSize: 14, flash: [], chips: {}, dim: [] },
  argTypes: {
    code: { control: 'text', name: 'source' },
    lang: { control: 'inline-radio', options: ['css', 'html', 'js', 'ts', 'json', 'sh'] },
    flash: { control: 'object', name: 'highlighted lines (trace)' },
    chips: { control: 'object', name: 'value chips' },
    dim: { control: 'object', name: 'inactive branch' },
  },
  loaders: [async ({ args }) => ({ lines: await highlight(args.code, args.lang) })],
  render: ({ code, lang, ...args }, { loaded }) => <div style={{ maxWidth: 640 }}><CodePanel lines={loaded.lines} code={code} {...args} explain={args.explain && lang === 'css'} /></div>,
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const LiveValue: Story = { name: 'Live value chip', args: { chips: { 1: 'true' }, dim: [[3, '#d9d5cf']] } };
export const Trace: Story = { name: 'Reacting lines (trace)', args: { chips: { 1: 'true' }, flash: [1, 3] } };
export const Html: Story = { args: { lang: 'html', label: 'index.html', code: '<button class="switch" role="switch" aria-checked="false">\n  <span class="visually-hidden">Notifications</span>\n</button>' } };
export const JavaScript: Story = { args: { lang: 'js', label: 'switch.js', code: "const el = document.querySelector('.switch');\n\nel.addEventListener('click', () => {\n  const on = el.getAttribute('aria-checked') !== 'true';\n  el.setAttribute('aria-checked', String(on));\n});" } };
export const Shell: Story = { args: { lang: 'sh', label: 'terminal', code: 'npx serve\npython3 -m http.server' } };
export const NoHeader: Story = { args: { header: false } };
export const LongLines: Story = { name: 'Long content', args: { code: '.particle { transform: translateX(live(random(0px, 500px), 200ms)); translate: live(random(0px, 500px), 2s) live(random(0px, 300px), 2s); }\n'.repeat(3) } };
export const Mobile: Story = { args: { chips: { 1: 'false' } }, globals: { viewport: { value: 'mobile' } } };

/** Hover explains a token; click pins it; Escape clears the pin. */
export const Explain: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText('hover any red token', { exact: false })).toBeVisible();
    const toggle = c.getByRole('button', { name: 'Explain toggle()' });
    await userEvent.click(toggle);
    await expect(c.getByText('Action · pinned')).toBeVisible();
    await expect(c.getByRole('link', { name: 'Reference →' })).toHaveAttribute('href', '/docs/reference/toggle/');
    await userEvent.keyboard('{Escape}');
    await expect(c.queryByText('Action · pinned')).toBeNull();
  },
};

/** Copy writes the raw source and confirms. */
export const Copy: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Copy code' }));
    await expect(c.getByText('Copied')).toBeVisible();
  },
};

export const SyncCss: Story = { name: 'Highlighter output (sync CSS)', render: () => <CodePanel lines={highlightCss('.a:when(--n > 3) .b {\n  opacity: when(--open and not --pinned, 1, 0);\n}')} code="" label="conditions.css" /> };
