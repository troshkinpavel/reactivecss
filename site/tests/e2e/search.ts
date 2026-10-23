// Opening the search dialog with its shortcut. The dialog hydrates with client:idle, and its
// ⌘K / Ctrl+K listener exists only after that; on a busy machine (CI) a key press can arrive first
// and do nothing. Wait for the island to hydrate, then press until the dialog is open.
import { expect, type Locator, type Page } from '@playwright/test';

export async function openSearch(page: Page): Promise<Locator> {
  await page.locator('astro-island[component-export="SearchDialog"]:not([ssr])').waitFor({ state: 'attached' });
  const input = page.getByRole('combobox', { name: 'Search' });
  await expect(async () => {
    if (!(await input.isVisible())) await page.keyboard.press('ControlOrMeta+k');
    await expect(input).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  return input;
}
