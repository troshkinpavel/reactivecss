import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { BundleIntro, Disclosure, Faq, FaqItem, FeatureList, Lead, QuickStart, QuickStep, SelectionResolver, SizeBars } from './CustomBundles';
import { STANDARD } from '~/lib/bundles/catalog';

// The standard bundle as the library measured it (bundles.json), formatted as the page shows it.
const fmt = (n: number) => n.toLocaleString('en-US');

const meta = { title: 'Docs/Custom Bundles', parameters: { layout: 'padded' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
const article = (node: React.ReactNode) => <div className="max-w-(--container-article)">{node}</div>;

/** The two ways to choose features, the Bundle Builder link and the release facts. */
export const Intro: Story = { render: () => article(<BundleIntro />) };

/** Numbered steps; the path switch shows one version of step 2 with native radios. */
export const QuickStartSteps: Story = {
  render: () => article(
    <QuickStart>
      <QuickStep title="Install"><p>Install the package and esbuild.</p></QuickStep>
      <QuickStep title="Analyze your CSS" path="analyze"><p>npx reactive-css analyze public/</p></QuickStep>
      <QuickStep title="Choose features" path="select"><p>npx reactive-css resolve --features focus</p></QuickStep>
      <QuickStep title="Build"><p>npx reactive-css build …</p></QuickStep>
    </QuickStart>,
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole('heading', { name: 'Analyze your CSS' })).toBeVisible();
    await userEvent.click(c.getByLabelText('Choose features'));
    await expect(c.getByRole('heading', { name: 'Choose features' })).toBeVisible();
    await expect(c.getByText('Analyze your CSS', { selector: 'h3' })).not.toBeVisible();
  },
};

/** Educational: the library's resolver over its catalog. focus adds events; forms stays optional. */
export const Resolver: Story = {
  render: () => article(<SelectionResolver />),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole('button', { name: 'events · auto' })).toBeVisible();
    await expect(c.getByText(/forms is useful with focus but not required/)).toBeVisible();
    await userEvent.click(c.getByRole('button', { name: 'focus' }));
    await expect(c.queryByRole('button', { name: 'events · auto' })).toBeNull();
    await expect(canvasElement.querySelector('pre')).toHaveTextContent('npx reactive-css build --features conditions --out public/reactive-css.min.js');
  },
};

/** Every catalog feature as a disclosure row. */
export const Features: Story = { render: () => article(<FeatureList />) };

/** Measured sizes, one metric at a time. */
export const Sizes: Story = {
  render: () => article(<SizeBars />),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText(fmt(STANDARD.minified))).toBeVisible();
    await userEvent.click(c.getByLabelText('gzip'));
    await expect(c.getByText(fmt(STANDARD.gzip))).toBeVisible();
    await expect(c.getByText(fmt(STANDARD.minified))).not.toBeVisible();
  },
};

/** Secondary reference blocks and the FAQ. */
export const ReferenceBlocks: Story = {
  render: () => article(
    <>
      <Lead>Reference for the build tools.</Lead>
      <Disclosure title="CLI commands and options" sub="features · resolve · build · analyze" open><p>Options table.</p></Disclosure>
      <Disclosure title="Node API" sub="@reactivecss/core/bundle"><p>build() returns plain JSON.</p></Disclosure>
      <div className="mt-8"><Faq><FaqItem q="Do I need a custom bundle for a small project?">No. Start with the standard bundle.</FaqItem></Faq></div>
    </>,
  ),
};

/** At phone width the rows drop their requirement column and the bars move under their label. */
export const Narrow: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } }, render: () => <><FeatureList /><SizeBars /></> };
