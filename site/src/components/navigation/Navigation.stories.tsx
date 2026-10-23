import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { DocsSidebar, type SidebarGroup } from './DocsSidebar';
import { Breadcrumbs, InlineToc, PrevNext, TableOfContents } from './PageNav';
import { SearchDialog, type SearchFn, type SearchResult } from './SearchDialog';
import { DocsBanner, SiteHeader, SiteMenu } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { INSTALL_TAG } from '~/lib/content/home';
import { LIBRARY_VERSION } from '~/lib/content/reference';
import { FOOTER_GROUPS } from '~/lib/content/site';

const meta = { title: 'Navigation', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const homeLinks = [{ label: 'Docs', href: '#' }, { label: 'Examples', href: '#' }, { label: 'Playground', href: '#' }, { label: 'Changelog', href: '#' }];
const appLinks = [{ label: 'Examples', href: '#', current: true }, { label: 'Playground', href: '#' }, { label: 'Changelog', href: '#' }];

export const HeaderHome: Story = { name: 'Header · home', render: () => <><SiteHeader variant="home" links={homeLinks} menuTarget="site-menu" /><SiteMenu id="site-menu" links={homeLinks} /></> };
export const HeaderDocs: Story = { name: 'Header · docs', render: () => <><SiteHeader context="docs" links={appLinks} menuTarget="docs-nav" /><DocsBanner>Documents v0.4.0 (local, unpublished) · previews run the real runtime · experimental: typed(), element(), wave()</DocsBanner></> };
export const HeaderMobile: Story = { name: 'Mobile navigation', globals: { viewport: { value: 'mobile' } }, render: () => <><SiteHeader variant="home" links={homeLinks} menuTarget="site-menu" /><SiteMenu id="site-menu" links={homeLinks} /></>,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Menu' }));
    await waitFor(() => expect(canvasElement.querySelector('#site-menu:popover-open')).not.toBeNull());
  },
};

const groups: SidebarGroup[] = [
  { title: 'Start', entries: [{ label: 'Introduction', href: '#' }, { label: 'Getting Started', href: '#', current: true }, { label: 'Installation', href: '#' }] },
  { title: 'Concepts', entries: [{ label: 'State', href: '#' }, { label: 'Conditions', href: '#' }, { label: 'Geometry & Animation', href: '#', status: 'exp' }] },
  { title: 'Reference', entries: [{ label: 'API Reference', href: '#' }, { label: 'State', items: [{ label: 'state()', href: '#s', mono: true }, { label: 'typed()', href: '#t', mono: true, status: 'exp' }] }, { label: 'Actions', items: [{ label: 'set()', href: '#a', mono: true }] }] },
];
export const Sidebar: Story = { name: 'Documentation sidebar', parameters: { layout: 'padded' }, render: () => <div className="h-[640px]"><DocsSidebar groups={groups} /></div> };

export const Crumbs: Story = { name: 'Breadcrumbs', parameters: { layout: 'padded' }, render: () => <Breadcrumbs items={[{ label: 'Docs', href: '#' }, { label: 'Reference', href: '#' }, { label: 'State', href: '#' }]} /> };
export const Toc: Story = { name: 'Page table of contents', parameters: { layout: 'padded' }, render: () => {
  const e = [{ id: 'a', label: '1 Add the library', depth: 2 as const }, { id: 'b', label: '2 Declare local state', depth: 2 as const }, { id: 'c', label: 'Sharing', depth: 3 as const }];
  return <div className="flex gap-10"><TableOfContents entries={e} /><div className="flex-1"><InlineToc entries={e} /></div></div>;
} };
export const PrevNextLinks: Story = { name: 'Previous / next links', parameters: { layout: 'padded' }, render: () => <PrevNext prev={{ label: 'Introduction', href: '#' }} next={{ label: 'state()', href: '#', mono: true }} /> };

const fake: SearchFn = async (q) => [{ href: '#state', title: 'state()', context: 'State', mono: true, excerpt: `Makes each matching element the owner of an independent <mark>${q}</mark>.` }, { href: '#when', title: 'Conditions', context: 'Concepts', excerpt: 'when() picks one of two values.' }];
const suggested: SearchResult[] = [{ href: '#gs', title: 'Getting Started', context: 'Start' }, { href: '#state', title: 'state()', context: 'State', mono: true }];
export const Search: Story = {
  name: 'Search dialog',
  render: () => <><SiteHeader context="docs" links={appLinks} /><SearchDialog suggested={suggested} search={fake} /></>,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Search documentation' }));
    const input = await within(document.body).findByRole('combobox', { name: 'Search' });
    await expect(input).toHaveFocus();
    await userEvent.type(input, 'state');
    await waitFor(() => expect(within(document.body).getAllByRole('option')).toHaveLength(2));
    await userEvent.keyboard('{ArrowDown}');
    await expect(within(document.body).getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelector('dialog[open]')).toBeNull());
  },
};

export const Footer: Story = { parameters: { layout: 'fullscreen' }, render: () => <SiteFooter groups={FOOTER_GROUPS} installTag={INSTALL_TAG} version={LIBRARY_VERSION} /> };
