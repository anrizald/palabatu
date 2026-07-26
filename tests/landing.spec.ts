import { test, expect } from '@playwright/test';

test('landing page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/palabatu/i);
  await expect(page.getByRole('heading', { name: /about palabatu/i })).toBeVisible();
});
