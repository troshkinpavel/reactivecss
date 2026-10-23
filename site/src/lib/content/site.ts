import type { SearchResult } from '~/components/navigation/SearchDialog';
import type { FooterGroup } from '~/components/navigation/SiteFooter';
import { footerGroups } from '~/lib/config';

/** Shown in search before the reader types. */
export const SUGGESTED: SearchResult[] = [
  { href: '/docs/getting-started/', title: 'Getting Started', context: 'Start' },
  { href: '/docs/reference/state/', title: 'state()', context: 'State', mono: true },
  { href: '/docs/reference/on-rule/', title: ':on()', context: 'Events', mono: true },
  { href: '/docs/reference/when/', title: 'when()', context: 'Conditions', mono: true },
  { href: '/docs/migration/', title: 'Migrating from 0.8', context: 'Start' },
  { href: '/docs/troubleshooting/', title: 'Troubleshooting', context: 'Project' },
];

/** Header links on the homepage and the Vision page. */
export const HOME_LINKS = [
  { label: 'Docs', href: '/docs/getting-started/' },
  { label: 'Examples', href: '/examples/' },
  { label: 'Experiments', href: '/experiments/' },
  { label: 'Vision', href: '/vision/' },
  { label: 'Playground', href: '/playground/' },
  { label: 'Changelog', href: '/docs/changelog/' },
];


/** Footer link groups, from config/links.json (edited in the local Control Center). */
export const FOOTER_GROUPS: FooterGroup[] = footerGroups();
