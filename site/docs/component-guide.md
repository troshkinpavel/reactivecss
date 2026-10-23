# Component guide

## Principles

- A component is a React function with typed props in `src/components/<area>/`. It renders
  without the rest of the site (no page data, no global state) so Storybook can show it.
- Static by default. A component only becomes an island when it needs client state; the page
  decides with `client:*` (see `architecture.md`).
- Colors, type sizes, radii and motion come from tokens (`bg-paper`, `text-ink-2`,
  `border-line`, `text-meta`, `rounded-block`, `duration-(--duration-state)`). Arbitrary values
  are used only for one-off sizes copied from the design.
- Vermilion (`rx`) means "can change at runtime". Never use it for navigation, buttons or prose.
- Native elements first: `<button>`, `<dialog>`, `<details>`, `popover`, form controls.

## Create a component

1. Add `src/components/<area>/Thing.tsx`:

   ```tsx
   export interface ThingProps { title: string; tone?: 'default' | 'reactive' }
   export function Thing({ title, tone = 'default' }: ThingProps) {
     return <span className={tone === 'reactive' ? 'text-rx' : 'text-ink'}>{title}</span>;
   }
   ```

2. Add `Thing.stories.tsx` next to it (see `storybook-guide.md`).
3. Use it from Astro (`<Thing title="…" />`, static) or from another component. Add
   `client:visible` only if it has state.
4. If MDX authors need it, export it from `src/components/mdx/index.ts`. Components that need
   build-time data (highlighting, content lookups) get an `.astro` wrapper in `src/components/mdx/`.

## Edit a design token

Change the value in `src/styles/tokens.css`. Every utility built on it follows (`bg-paper`,
`text-mute` …). To add a token, add `--color-name` (or `--text-*`, `--radius-*`) inside
`@theme`, then use `bg-name` / `text-name`. Document it in `src/lib/design/foundations.ts` so the
Design System page and Storybook's Foundations show it. Tailwind's default palette is disabled on
purpose (`--color-*: initial`).

Tailwind utilities are in a CSS layer. Rules in `global.css` that must override a display
utility (the comparison and playground pane switching) are unlayered on purpose.

## Inventory

| Area | Components |
|---|---|
| ui | `Button`, `ButtonLink`, `MiniButton`, `CopyButton`, `Tag`, `Kbd`, `SegmentedControl`, `TabList`, `Switch`, `Logo`, `LogoMark`, `SectionKicker` |
| navigation | `SiteHeader`, `SiteMenu`, `DocsBanner`, `DocsSidebar`, `Breadcrumbs`, `TableOfContents`, `InlineToc`, `PrevNext`, `SearchDialog`, `SiteFooter` |
| docs | `Callout`, `Facts`/`Fact`, `Flow`/`FlowStep`, `Cards`/`Card`, `RelatedLinks`, `DataTable`, `ParamList`, `ApiIndexTable`, `ExampleList`, `InlineCode`, `InlineMarkdown`, `AdvancedIndex` |
| code | `CodePanel` (+ `CodeBlock.astro`) |
| examples | `PreviewFrame`, `usePreviewSession`, `InteractiveExample` (+ `ExampleBlock.astro`), `LiveExample`, `CodeComparison`, `Playground`, `StateFoot`, `StateTable`, `EventLog` |
| workspace | `ControlCenterWorkspace`, `SourceViewer`, `TraceChain`, `ExpressionInspector`, `StatePanel`, `GuidedBar`, `SubmissionPreview`, `model.ts` |
| home | `Capabilities` |
| vision | `EvolutionTimeline`, `ScoreComparison`, `DemoShowcase` (islands); `VisionHero`, `Principles`, `EngineeringMetrics`, `NativeVsReactive`, `WaveStory`, `BundlePreview`, `MessagingOptions`, `VSection` (static) |
| builder | `BundleBuilder` (island) with `PresetPicker`, `FeatureSelector`, `BundleSummary`, `ConfigOutput`, `AnalyzerPanel`; `mdx/Bundles.astro` (static tables and code from the same data) |
| design | `Swatches`, `TypeScale`, `SyntaxTable`, `SpacingScale`, `MotionTable`, `BordersAndRadii`, `TraceSpecimen` |

Not built, because the design has none: inputs, checkboxes, radio groups, tooltips and menus as
site components. The bundle builder uses native checkboxes, a text input and a textarea
directly, styled in place (accent colour `ink`), as the design's builder does. Form controls only appear inside example previews, where they are the
examples' own native HTML. Tooltips are `title` attributes, as in the design.

## Key contracts

```ts
// Code
interface CodePanelProps {
  lines: Line[]; code: string; label?: string; badge?: string; header?: boolean; legend?: boolean;
  explain?: boolean; bare?: boolean; fontSize?: number; footHeight?: number;
  chips?: Record<number, string>; flash?: number[]; focus?: number[]; dim?: [number, string][];
}
// Running an example
interface PreviewFrameProps { sources: { css; base; html }; analysis: Analysis; title: string; onMessage?; highlight?: string[]; resetKey?: number }
const session = usePreviewSession(analysis, { onTransition?, onNative? });
// session: values, current, chips, flash, log, lastEvent, diagnostics, submission, reset(), handle
interface InteractiveExampleProps { example: ExampleDefinition; size?: 'compact' | 'standard' | 'expanded'; controls?: boolean; highlighted: { html: Line[]; js: Line[] | null } }
```
