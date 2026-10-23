import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Button, ButtonLink } from './Button';
import { CopyButton } from './CopyButton';
import { Logo } from './Logo';
import { MiniButton } from './MiniButton';
import { SegmentedControl } from './SegmentedControl';
import { SectionKicker } from './SectionKicker';
import { Switch } from './Switch';
import { TabList } from './TabList';
import { Kbd, Tag } from './Tag';

const meta = { title: 'Primitives' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Buttons: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2"><Button>Primary</Button><Button className="!bg-ink-hover">Hover</Button><Button className="outline-2 outline-offset-2 outline-ink outline-solid">Focus</Button><Button disabled>Disabled</Button></div>
      <div className="flex flex-wrap gap-2"><Button variant="secondary">Secondary</Button><Button variant="quiet">Quiet</Button><ButtonLink href="#" size="lg">Get started</ButtonLink><ButtonLink href="#" size="lg" variant="secondary">Open playground</ButtonLink></div>
      <div className="flex flex-wrap gap-2"><MiniButton>Reset</MiniButton><MiniButton pressed>Explain ✓</MiniButton><CopyButton text="copied text" /></div>
    </div>
  ),
};

export const Tags: Story = {
  name: 'Badges and status labels',
  render: () => (
    <div className="flex flex-wrap items-center gap-1.5">
      <Tag>stable</Tag><Tag>since 0.2</Tag><Tag tone="experimental">experimental</Tag><Tag>new in 0.4</Tag><Tag>requires runtime</Tag><Tag tone="planned">upcoming</Tag><Tag tone="ink">Identical behavior</Tag><Tag tone="reactive">state()</Tag><Kbd>⌘K</Kbd>
    </div>
  ),
};

export const Segmented: Story = {
  name: 'Segmented control',
  render: function Render() {
    const [v, setV] = useState<'toggle' | 'counter' | 'tabs' | 'input'>('toggle');
    return <SegmentedControl label="Examples" value={v} onChange={setV} options={[{ value: 'toggle', label: 'Toggle' }, { value: 'counter', label: 'Counter' }, { value: 'tabs', label: 'Tabs' }, { value: 'input', label: 'Input binding' }]} />;
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('radio', { name: 'Toggle' }));
    await userEvent.keyboard('{ArrowRight}');
    await expect(c.getByRole('radio', { name: 'Counter' })).toHaveAttribute('aria-checked', 'true');
  },
};

export const Tabs: Story = {
  render: function Render() {
    const [t, setT] = useState('css');
    return (
      <div>
        <TabList label="Files" idBase="demo" selected={t} onSelect={setT} items={[{ id: 'css', label: 'style.css' }, { id: 'html', label: 'index.html' }, { id: 'js', label: 'script.js' }]} className="flex border-b border-line" tabClassName={(on) => `h-10 border-0 border-b-2 bg-transparent px-3 font-mono text-meta ${on ? 'border-ink font-semibold' : 'border-transparent text-ink-2'}`} />
        <div role="tabpanel" id={`demo-panel-${t}`} aria-labelledby={`demo-tab-${t}`} className="p-3 text-sm">Panel: {t}</div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('tab', { name: 'style.css' }));
    await userEvent.keyboard('{End}');
    await expect(c.getByRole('tab', { name: 'script.js' })).toHaveAttribute('aria-selected', 'true');
    await expect(c.getByText('Panel: js')).toBeVisible();
  },
};

export const SwitchControl: Story = {
  name: 'Switch',
  render: function Render() { const [on, setOn] = useState(false); return <Switch checked={on} onChange={setOn} label="Follow interactions" />; },
  play: async ({ canvasElement }) => {
    const s = within(canvasElement).getByRole('switch', { name: 'Follow interactions' });
    await userEvent.click(s);
    await expect(s).toHaveAttribute('aria-checked', 'true');
  },
};

export const Brand: Story = { render: () => <div className="flex flex-col gap-4"><Logo /><SectionKicker n="01" label="Before / after" /></div> };
