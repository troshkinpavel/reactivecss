# Example authoring

Every runnable example is one folder in `src/examples/<id>/` and one entry in
`src/examples/manifest.ts`. The same example is reused by docs pages, the homepage, the
playground, comparisons and Storybook. Never copy example code into a page.

## Files

| File | Required | Shown | Runs | Rules |
|---|---|---|---|---|
| `style.css` | yes | yes (first tab) | yes | The Reactive CSS the reader learns from. Must be valid for the current runtime. |
| `index.html` | yes | yes (HTML tab) | yes | Complete body markup. No `<script>`: the preview's CSP blocks it. |
| `base.css` | no | no | yes | Layout and look only. No reactive syntax, so the lesson stays in `style.css`. |
| `vanilla.js` | no | yes (JS tab) | never | The idiomatic JavaScript equivalent. |
| `vanilla.css`, `vanilla.html` | no | in workspaces | never | The vanilla version's own stylesheet and markup (Control Center). |

`src/examples/_shared/preview.css` is prepended to every `base.css`: a centered body, the site
fonts, a `.square` button and `.visually-hidden`.

## Add an example

1. Create `src/examples/my-example/style.css` and `index.html` (and `base.css`, `vanilla.js` if useful).
2. Add a manifest entry:

   ```ts
   'my-example': { title: 'My example', description: 'One sentence.', stem: 'my-example', level: 'basic', a11y: 'native buttons' },
   ```

   `stem` names the tabs (`my-example.css`, `my-example.js`). `a11y` is the short status in the
   preview header. Optional: `label` (preview header text) and `controls` (see below).
3. Check it at `/examples/my-example/` (every example gets a standalone page) and in Storybook
   under *Interactive Examples → Interactive Example* (pick it in the `example` control).
4. Add a Playwright test in `tests/e2e/examples.spec.ts` that interacts with the preview and
   asserts an observed value:

   ```ts
   test('my-example: click sets --open', async ({ page }) => {
     const { root, preview } = await open(page, 'my-example');
     await preview.getByRole('button', { name: 'Open' }).click();
     await expect(chip(root, 1)).toHaveText('true'); // line 2 of style.css declares --open
   });
   ```

## Insert it in a page

```mdx
<Example id="my-example" />                 {/* CSS, JS and HTML tabs */}
<Example id="my-example" size="compact" />  {/* CSS only */}
<Example id="my-example" size="expanded" /> {/* adds the state table and event log */}
<Example id="like" controls />              {/* shows the example's source controls */}
```

Source controls (`controls` in the manifest) edit the stylesheet: each replaces its `value` in
`style.css` with the chosen option, and the preview restarts with the new CSS, as editing a
stylesheet does at runtime.

## What the inspector can show

The preview reports what it can observe from outside the runtime:

- every custom property declared with `state()` and every custom property computed by another
  reactive function (`previous()`, `on()`, `mouse()`, `element()`, `when()` …), read with
  `getComputedStyle` on each element matching the declaring rule;
- native events, matched to the `on:` / `bind:` rules whose selectors they reach;
- form submissions (as `FormData`, never sent) and validation failures;
- `ReactiveCSS.diagnostics`.

Values inside a declaration that are not custom properties (for example the result of a
`when()` in `background:`) are not observable. The dimmed `when()` branch is only computed for
simple single-line forms on observed booleans and keyword equality.

## Deviations from the design code

The design's code was kept wherever the runtime accepts it. These changed:

| Example | Change | Why |
|---|---|---|
| `greeting` (homepage) | `cycle(--message, …)` instead of `set(--message, pick(…))`; button "Next greeting" | 0.4 rejected calls in `set()`. 0.5.0 accepts `pick()` there as an experimental expression; the hero keeps stable features. |
| `wave` | Native `@keyframes` instead of `wave()`; "Simulate reduced motion" removed | `wave()` was removed in 0.5.0. The page now documents the native replacement. |
| `tabs`, `pg-tabs` | Panels wrapped in `.panels` | `:nth-var()` counts element siblings; the tablist would be sibling 1. |
| `form` | `.preview` inside the form | Siblings of the owner cannot read its states. |
| `compare-whensel` | Banner inside `.cart`, no "−" button | Same ownership rule; the CSS has no rule for "−". |
| `history`, `score`, `pg-counter`, `compare-whensel` | `base.css` prints numbers with counters | The design CSS did not print them. |
| `pricing`, `pg-toggle` | `base.css` draws the knob with `calc(var(--x) * …)` | Same. |
| `pointer`, `spotlight` | Arrow keys removed | They were part of the simulation, not the CSS. |
| `geometry` | Simulated "Clamped by…" label and bar removed | Not produced by the CSS. |
| `check` | Tasks start unchecked | With `bind:` the state wins over an HTML `checked` default. |
| `compare-typed` | Hover only | Click and the "unregistered" toggle were simulation. |
| HTML tabs | Complete markup | The design showed `…`. |
