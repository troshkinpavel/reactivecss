import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { highlight } from '~/lib/code/highlight';
import { catalogEntry, docsHref } from '~/lib/content/catalog';
import { CardPreview } from './CardPreview';
import { ExampleDetail } from './ExampleDetail';
import { GalleryCard } from './GalleryCard';

const meta = { title: 'Examples Gallery', parameters: { layout: 'padded' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const card = (id: string, override?: { css: string }, wide = false) => {
  const e = catalogEntry(id)!;
  const src = { ...e.card!, ...override };
  return (
    <div className={wide ? 'w-[620px]' : 'w-[300px]'}>
      <GalleryCard wide={wide} title={e.title} href={e.href} description={e.description} apis={e.primary.map((label) => ({ label, reactive: !!docsHref(label) }))} experimental={e.experimental} preview={<CardPreview title={e.title} css={src.css} base={src.base} html={src.html} />} />
    </div>
  );
};

/** An API example: the live preview on top, the description and API tags below. */
export const Default: Story = {
  render: () => card('counter'),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('[data-card-preview="live"] iframe')).toBeTruthy(), { timeout: 8000 });
  },
};

/** The card is one link: the title's, stretched over everything below the preview. */
export const CardLink: Story = {
  render: () => card('attribute-sync'),
  play: async ({ canvasElement }) => {
    const links = within(canvasElement).getAllByRole('link');
    await expect(links).toHaveLength(1);
    await expect(links[0]).toHaveAttribute('href', '/examples/attribute-sync/');
  },
};

/** The card that spans two grid columns in its row: same parts, a larger title. */
export const Wide: Story = { render: () => card('mouse-tracker', undefined, true) };

/** A primary API that the registry marks experimental gets the dashed tag. */
export const ExperimentalApi: Story = { render: () => card('element-size') };

/** A stylesheet the runtime rejects: the preview says so instead of passing for a demo. */
export const PreviewProblem: Story = {
  render: () => card('counter', { css: '.counter { --count: state(0); }\n.counter .inc:on(click) { --count: nope(); }' }),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('[data-preview-problem]')).toBeTruthy(), { timeout: 8000 });
  },
};

/** Interfaces, Advanced and Test lab cards have no live preview: a technical line instead. */
export const AdvancedCard: Story = {
  render: () => {
    const e = catalogEntry('control-center')!;
    return <div className="w-[300px]"><GalleryCard title={e.title} href={e.href} description={e.description} tech={e.tech} apis={e.primary.map((label) => ({ label, reactive: !!docsHref(label) }))} /></div>;
  },
};

/** At phone width the card keeps its preview whole, scaled to fit. */
export const NarrowViewport: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } }, render: () => card('tabs') };

/** The detail page's live part: preview with Reset and Inspect, then the source with live values. */
export const Detail: Story = {
  parameters: { layout: 'fullscreen' },
  loaders: [async () => ({ html: await highlight(catalogEntry('attribute-sync')!.example!.files.html, 'html') })],
  render: (_, { loaded }) => (
    <div className="mx-auto max-w-[1100px] p-6">
      <ExampleDetail example={catalogEntry('attribute-sync')!.example!} htmlLines={loaded.html} playgroundHref="#" sourceNote="style.css from its Reactive CSS divider">
        <p className="m-0 text-ink-2">How it works goes here.</p>
      </ExampleDetail>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const inspect = c.getByRole('button', { name: 'Inspect' });
    await expect(inspect).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(inspect);
    await expect(inspect).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(canvasElement.querySelector('[data-chip]')).toBeTruthy(), { timeout: 8000 });
    await userEvent.click(c.getByRole('tab', { name: 'index.html' }));
    await expect(c.getByRole('tab', { name: 'index.html' })).toHaveAttribute('aria-selected', 'true');
  },
};
