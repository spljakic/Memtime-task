import { expect, test } from '@playwright/test';
test('browse, select, create, edit, and paginate', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByText('DEMO · resets on restart')).toBeVisible();
  await page.getByText('Northstar Studio', { exact: true }).click();
  await page.getByText('Brand platform', { exact: true }).click();
  await page.getByRole('button', { name: 'Discovery #101', exact: true }).click();
  await expect(page.getByText(/Results are partial/)).toBeVisible();
  await page.getByRole('button', { name: 'Search next 50 records' }).click();
  await expect(page.getByText(/All pages retrieved/)).toBeVisible();
  await page.getByRole('button', { name: 'New time entry' }).click();
  await expect(page.getByLabel('Task ID', { exact: true })).toHaveValue('101');
  await page.getByLabel('What did you work on?').fill('Browser workflow test');
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Created entry #65' })).toBeVisible();
  await page.getByRole('button', { name: 'View all tasks' }).click();
  await page.getByLabel('Rows').selectOption('50');
  await page.getByRole('button', { name: 'Next →' }).click();
  const row = page.getByRole('row').filter({ hasText: 'Browser workflow test' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Edit entry 65' }).click();
  await page.getByLabel('What did you work on?').fill('Updated browser workflow');
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Updated entry #65' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Updated browser workflow' })).toBeVisible();
  expect(errors).toEqual([]);
});
test('keyboard opens editor and mobile has no page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const button = page.getByRole('button', { name: 'New time entry' });
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(button).toBeFocused();
  const width = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  expect(width.content).toBeLessThanOrEqual(width.viewport);
});

test('contextual task picker, duration summary and saved-entry actions', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Northstar Studio', { exact: true }).click();
  await page.getByText('Brand platform', { exact: true }).click();
  await page.getByRole('button', { name: 'Discovery #101', exact: true }).waitFor();
  await expect(page.getByText('Time on this page')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Duration', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New time entry' }).click();
  await page.getByLabel('Search loaded tasks').fill('interviews');
  await page.getByLabel('Choose loaded task').selectOption('102');
  await expect(page.getByLabel('Task ID', { exact: true })).toHaveValue('102');
  await page.getByLabel('What did you work on?').fill('Contextual picker test');
  await page.getByRole('button', { name: 'Save entry' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Contextual picker test' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add another entry' }).click();
  await expect(page.getByLabel('Task ID', { exact: true })).toHaveValue('102');
  await expect(page.getByLabel('What did you work on?')).toHaveValue('');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
});
