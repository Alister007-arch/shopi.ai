import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDispatchedResetCode(email) {
  const dbPath = path.resolve(__dirname, '../../backend/shopai.db');
  const pythonCmd = `python -c "import sqlite3; conn=sqlite3.connect(r'${dbPath}'); c=conn.cursor(); c.execute('SELECT code FROM password_reset_codes WHERE email=? AND is_used=0 ORDER BY id DESC LIMIT 1', ('${email}',)); row=c.fetchone(); print(row[0] if row else '')"`;
  return execSync(pythonCmd, { encoding: 'utf-8' }).trim();
}

test.describe('Forgot Password System in Login Modal', () => {
  test('user requests reset code, resets password, and signs in with new credentials', async ({ page }) => {
    const timestamp = Date.now();
    const testEmail = `forgot_shopper_${timestamp}@trovi.store`;
    const initialPassword = 'InitialSecretPass123!';
    const updatedPassword = 'BrandNewSecretPass456!';

    // 1. Visit store
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 2. Open auth modal via header
    const signInHeaderBtn = page.locator('#header-sign-in-btn');
    await expect(signInHeaderBtn).toBeVisible({ timeout: 10000 });
    await signInHeaderBtn.click();

    const authModal = page.locator('#auth-modal');
    await expect(authModal).toBeVisible({ timeout: 5000 });

    // 3. Register a test user
    const registerTabBtn = page.locator('button:has-text("Register")');
    await registerTabBtn.click();

    await page.locator('#auth-name-input').fill('Aarav Sharma');
    await page.locator('#auth-email-input').fill(testEmail);
    await page.locator('#auth-password-input').fill(initialPassword);
    await page.locator('#auth-submit-btn').click();

    // Modal closes upon successful registration
    await expect(authModal).not.toBeVisible({ timeout: 10000 });
    const userMenu = page.locator('#header-user-menu');
    await expect(userMenu).toBeVisible({ timeout: 10000 });

    // 4. Sign out to test forgot password flow from logged-out state
    const signOutBtn = page.locator('#header-sign-out-btn');
    await expect(signOutBtn).toBeVisible({ timeout: 5000 });
    await signOutBtn.click();

    // Verify logged out
    await expect(signInHeaderBtn).toBeVisible({ timeout: 10000 });

    // 5. Click Sign In and click "Forgot Password?"
    await signInHeaderBtn.click();
    await expect(authModal).toBeVisible();

    const forgotPasswordLink = page.locator('#auth-forgot-password-link');
    await expect(forgotPasswordLink).toBeVisible();
    await forgotPasswordLink.click();

    // 6. Step 1: Request Code
    await expect(page.locator('#auth-send-code-btn')).toBeVisible();
    await page.locator('#auth-email-input').fill(testEmail);
    await page.locator('#auth-send-code-btn').click();

    // 7. Step 2: Code Verification and Reset Form
    await expect(page.locator('#auth-reset-code-input')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#auth-new-password-input')).toBeVisible();
    await expect(page.locator('#auth-confirm-password-input')).toBeVisible();
    await expect(page.locator('#auth-reset-password-btn')).toBeVisible();

    // Critical security check: OTP is NEVER visible in the UI or hint banner
    await expect(page.locator('#auth-dev-code-hint')).not.toBeVisible();
    await expect(page.locator('#auth-email-otp-notice')).toBeVisible();
    expect(await page.locator('#auth-reset-code-input').inputValue()).toBe('');

    // Simulate customer reading OTP received in their email
    const emailedOtp = getDispatchedResetCode(testEmail);
    expect(emailedOtp).toHaveLength(6);

    // Customer types OTP from email into the form
    await page.locator('#auth-reset-code-input').fill(emailedOtp);

    // Fill new password and confirmation
    await page.locator('#auth-new-password-input').fill(updatedPassword);
    await page.locator('#auth-confirm-password-input').fill(updatedPassword);
    await page.locator('#auth-reset-password-btn').click();

    // 8. Should switch back to Sign In tab with success alert
    await expect(page.locator('#auth-success-message')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#auth-password-input')).toBeVisible();

    // 9. Login with new credentials
    await page.locator('#auth-email-input').fill(testEmail);
    await page.locator('#auth-password-input').fill(updatedPassword);
    await page.locator('#auth-submit-btn').click();

    // 10. Auth modal closes and user is logged in
    await expect(authModal).not.toBeVisible({ timeout: 10000 });
    await expect(userMenu).toBeVisible({ timeout: 10000 });
  });

  test('navigation back to sign in works seamlessly', async ({ page }) => {
    await page.goto('/');
    const signInHeaderBtn = page.locator('#header-sign-in-btn');
    await expect(signInHeaderBtn).toBeVisible({ timeout: 10000 });
    await signInHeaderBtn.click();

    const authModal = page.locator('#auth-modal');
    await expect(authModal).toBeVisible();

    // Click forgot password
    await page.locator('#auth-forgot-password-link').click();
    await expect(page.locator('#auth-send-code-btn')).toBeVisible();

    // Click back to sign in tab button
    const backBtn = page.locator('#auth-back-to-login-tab-btn');
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    // Verifies returned to login form
    await expect(page.locator('#auth-password-input')).toBeVisible();
    await expect(page.locator('#auth-forgot-password-link')).toBeVisible();
  });
});
