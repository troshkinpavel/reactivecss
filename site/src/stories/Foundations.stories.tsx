import type { Meta, StoryObj } from '@storybook/react-vite';
import { BordersAndRadii as Borders, MotionTable, SpacingScale, Swatches, SyntaxTable, TypeScale } from '~/components/design/Foundations';

const meta = { title: 'Foundations', parameters: { layout: 'padded' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Colors: Story = { render: () => <Swatches /> };
export const Typography: Story = { render: () => <TypeScale /> };
export const Spacing: Story = { render: () => <SpacingScale /> };
export const BordersAndRadii: Story = { name: 'Borders and radii', render: () => <Borders /> };
export const CodeSyntaxPalette: Story = { name: 'Code syntax palette', render: () => <SyntaxTable /> };
export const Motion: Story = { render: () => <MotionTable /> };
export const Icons: Story = {
  name: 'Icons (text glyphs)',
  render: () => (
    <div className="flex flex-col gap-3">
      <p className="max-w-[60ch] text-sm text-ink-2">The design uses no icon set. Every icon is a text glyph in the current font, so it inherits color and size.</p>
      <div className="flex flex-wrap gap-2 font-mono text-[18px]">{['→', '←', '×', '⌄', '✓', '!', '▲', '▼', '−', '+', '↑', '↓', '↵', '⌘K'].map((g) => <span key={g} className="grid size-11 place-items-center rounded-block border border-line">{g}</span>)}</div>
    </div>
  ),
};
