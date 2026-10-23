// Screenshot regression at 1440, 1280, 1024 and 390 px. Baselines live next to this file and
// were reviewed against the Claude Design references (docs/visual-review/). Update them with
// `npx playwright test tests/e2e/visual.spec.ts --update-snapshots` after an intended change.
import { expect, test } from '@playwright/test';

const PAGES = [['home', '/'], ['getting-started', '/docs/getting-started/'], ['api-state', '/docs/reference/state/'], ['simplify-css', '/docs/simplify-css/'], ['control-center', '/examples/control-center/'], ['playground', '/playground/'], ['design-system', '/design-system/'], ['vision', '/vision/'], ['bundle-builder', '/bundle-builder/'], ['experiments', '/experiments/'], ['experiment-perihelion', '/experiments/perihelion/'], ['docs-mcp', '/docs/mcp/']] as const;
const WIDTHS = [1440, 1280, 1024, 390];

for (const w of WIDTHS) {
  test.describe(`${w}px`, () => {
    test.use({ viewport: { width: w, height: 900 } });
    for (const [name, path] of PAGES) {
      test(name, async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'baselines are recorded in Chromium');
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        // Previews and live chips depend on runtime timing; they are covered by examples.spec.ts.
        await expect(page).toHaveScreenshot(`${name}-${w}.png`, {
          fullPage: true,
          animations: 'disabled',
          // Only visible frames: a collapsed, invisible frame (Vision comparison) would mask what lies over it.
          mask: [page.locator('iframe').filter({ visible: true }), page.locator('[data-chip]')],
          maxDiffPixelRatio: 0.01,
        });
      });
    }
  });
}
