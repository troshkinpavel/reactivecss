# Storybook guide

```bash
npm run storybook          # http://localhost:6006
npm run storybook:build    # static build in storybook-static/
npm run test:stories       # every story renders, and every play function passes (Vitest browser mode, Chromium)
```

Storybook uses the site's Tailwind setup and tokens (`.storybook/preview.tsx` imports
`src/styles/global.css`) and serves `public/`, so examples run the real runtime there too.
Run `npm run sync-runtime` first if `public/runtime/` is empty.

## Organization

| Group | Contents |
|---|---|
| Foundations | Colors, typography, spacing, borders and radii, code syntax palette, icons (text glyphs), motion |
| Primitives | Buttons, badges and status labels, segmented control, tabs, switch, brand |
| Navigation | Header (home, docs, mobile), sidebar, breadcrumbs, table of contents, previous/next, search dialog, footer |
| Documentation | Article typography, inline code, callouts, facts/flow/cards, data table, parameter list, API index, related links, example list, inline Markdown, feature status |
| Code | Code panel: default, live chip, trace, HTML, JS, shell, no header, long content, mobile, explain, copy |
| Interactive Examples | Interactive Example (every example via the `example` control, sizes, source controls), Live Preview, Code Comparison (wide and narrow), Playground, homepage showcase, Workspace (full Control Center and Deep Dive, trace, inspector, state, guided mode, submission preview, source viewer) |
| Compositions | Reaction trace specimen, Advanced Examples index |
| Vision | Hero (one disclaimer), Evolution Timeline (keyboard), Principles, Score History Comparison (library demo, live), Demo Showcase (one runtime at a time), Engineering Metrics, Native vs Reactive, `wave()` Story, Bundle Builder Concept, Messaging Directions (not on the public pages) |

## Write stories

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Thing } from './Thing';

const meta = { title: 'Documentation/Thing', component: Thing, args: { title: 'Hello' } } satisfies Meta<typeof Thing>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Reactive: Story = { args: { tone: 'reactive' } };
export const Clicks: Story = {
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole('button', { name: 'Hello' }));
    await expect(c.getByText('Clicked')).toBeVisible();
  },
};
```

- Expose editable props as `args` / `argTypes` (source code, selected expression, state values,
  file, example id …), so a component can be evaluated without the site.
- Components that need highlighted code use a `loaders` entry calling `highlight()` (Shiki runs
  in the browser too); see `CodePanel.stories.tsx`.
- Only add states a component can have.
- Use `globals: { viewport: { value: 'mobile' } }` for a 390 px story.

## What play functions cannot do

Example previews are sandboxed iframes with an opaque origin. Synthetic test events cannot
reach into them, so stories assert what the preview *reported* (for example the first chip),
and clicks inside previews are tested with Playwright in `tests/e2e/examples.spec.ts`.
