import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';

test.describe('Order Action Service & LLM Agent Handoff Flow', () => {
  test('chat "cancel my last order" -> card -> confirm -> status updated to cancelled', async ({ page }) => {
    // 1. Visit store clean
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 2. Register a fresh authenticated user
    const testEmail = `action_shopper_${Date.now()}@moss.store`;
    const testPassword = 'Password123!';
    const testName = 'Priya Sharma';

    const signInBtn = page.locator('#header-sign-in-btn');
    await expect(signInBtn).toBeVisible({ timeout: 10000 });
    await signInBtn.click();

    // Switch to Register tab
    const registerTabBtn = page.locator('button:has-text("Register")');
    await registerTabBtn.click();

    await page.locator('#auth-name-input').fill(testName);
    await page.locator('#auth-email-input').fill(testEmail);
    await page.locator('#auth-phone-input').fill('9876543210');
    await page.locator('#auth-password-input').fill(testPassword);
    await page.locator('#auth-submit-btn').click();

    // Ensure Auth Modal closes
    await expect(page.locator('#auth-modal')).not.toBeVisible({ timeout: 10000 });

    // 3. Create a test order in SQLite for this registered user
    const orderNumber = `ORD-E2E-${Date.now().toString().slice(-6)}`;
    const createScriptPath = path.resolve('..', 'backend', 'tests', 'create_test_order.py');
    const createOut = execSync(`python "${createScriptPath}" "${testEmail}" "${orderNumber}" placed`, { encoding: 'utf-8' });
    console.log(createOut);

    // 4. Navigate to AI Concierge / Chat
    const conciergeTabBtn = page.locator('button:has-text("Ask Trovi"), button:has-text("AI Concierge")').first();
    await expect(conciergeTabBtn).toBeVisible({ timeout: 10000 });
    await conciergeTabBtn.click();

    // 5. Ask Concierge to cancel the order
    const chatInput = page.locator('#chat-input-textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });
    await chatInput.fill(`cancel my last order ${orderNumber}`);

    const sendBtn = page.locator('#chat-send-btn').first();
    await sendBtn.click();

    // 6. Assert LLM only gives a short handoff response and does NOT mutate order
    // Assert Action Card is rendered
    const actionCard = page.locator('#order-action-card').first();
    await expect(actionCard).toBeVisible({ timeout: 15000 });
    await expect(actionCard).toContainText('Cancel Order');
    await expect(actionCard).toContainText(/can be cancelled|eligible/i);

    // 7. Click Confirm button on the Action Card directly (Order Action Service execution)
    const confirmBtn = page.locator('#confirm-action-btn').first();
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });
    await confirmBtn.click();

    // 8. Assert Result Card appears with status 'cancelled'
    const resultCard = page.locator('#action-result-card').first();
    await expect(resultCard).toBeVisible({ timeout: 15000 });
    await expect(resultCard).toContainText(/cancelled/i);
    await expect(resultCard).toContainText(orderNumber);

    // 9. Verify in database that order status is indeed 'cancelled'
    const verifyScriptPath = path.resolve('..', 'backend', 'tests', 'verify_order_status.py');
    const verifyOut = execSync(`python "${verifyScriptPath}" "${orderNumber}" cancelled`, { encoding: 'utf-8' });
    expect(verifyOut).toContain('Verified order');
  });

  test('guests see "Sign in to continue" on action card', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Navigate to Concierge while signed out
    const conciergeTabBtn = page.locator('button:has-text("Ask Trovi"), button:has-text("AI Concierge")').first();
    await expect(conciergeTabBtn).toBeVisible({ timeout: 10000 });
    await conciergeTabBtn.click();

    const chatInput = page.locator('#chat-input-textarea').first();
    await expect(chatInput).toBeVisible({ timeout: 10000 });
    await chatInput.fill('cancel my order');

    const sendBtn = page.locator('#chat-send-btn').first();
    await sendBtn.click();

    // Action card should prompt guest to sign in
    const guestPromptBtn = page.locator('#action-guest-signin-btn').first();
    await expect(guestPromptBtn).toBeVisible({ timeout: 15000 });
    await expect(guestPromptBtn).toContainText(/sign in to continue/i);
  });
});
