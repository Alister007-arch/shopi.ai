import { test, expect } from '@playwright/test';

test.describe('Store Policies (/policies) Page & Customer Text', () => {
  test('direct navigation to /policies loads full policy text and sections', async ({ page }) => {
    await page.goto('/policies');

    // Heading must match the customer policy text
    await expect(page.locator('h1')).toContainText('RETURNS, EXCHANGE AND REFUND POLICY');

    // Check specific policy sections
    await expect(page.locator('text=Cancel your order').first()).toBeVisible();
    await expect(page.locator('text=Food and grocery (honey, oats, oils, nuts, tea, snacks)').first()).toBeVisible();
    await expect(page.locator('text=Fresh produce, milk and eggs').first()).toBeVisible();
    await expect(page.locator('text=Clothing & Fashion').first()).toBeVisible();
    await expect(page.locator('text=Electronics & Smart Tech').first()).toBeVisible();
    await expect(page.locator('text=Luxury items').first()).toBeVisible();
    await expect(page.locator('text=Refunds & Payment Processing').first()).toBeVisible();

    // Check customer text contents
    await expect(page.locator('text=For hygiene and safety, we do not accept returns for change of mind').first()).toBeVisible();
    await expect(page.locator('text=Within 7 days for defective, dead on arrival, damaged or wrong items').first()).toBeVisible();
    await expect(page.locator('text=Aarav Sharma').first()).toBeVisible();
    await expect(page.locator('text=support@trovi.ai').first()).toBeVisible();
  });

  test('clicking Store Policies in header navigates to /policies', async ({ page }) => {
    await page.goto('/');

    const policyNavBtn = page.locator('button:has-text("Store Policies")').first();
    await expect(policyNavBtn).toBeVisible();
    await policyNavBtn.click();

    await expect(page.locator('h1')).toContainText('RETURNS, EXCHANGE AND REFUND POLICY');
  });

  test('clicking Ask Concierge opens chat with policy inquiry', async ({ page }) => {
    await page.goto('/policies');

    const askConciergeBtn = page.locator('button:has-text("Ask Concierge about this rule")').first();
    await expect(askConciergeBtn).toBeVisible();
    await askConciergeBtn.click();

    // The chat widget should open
    await expect(page.locator('#moss-ai-chat-header')).toBeVisible();
  });
});
