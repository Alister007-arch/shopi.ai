import { test, expect } from '@playwright/test';

test.describe('Guest Checkout & Auth Enforcement Flow', () => {
  test('guest adds item -> clicks checkout -> login modal with prompt -> login -> lands on checkout with cart intact', async ({ page }) => {
    // 1. Visit store clean as guest
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 2. Verify header shows "Sign in" when signed out, and does NOT show user menu
    const signInBtn = page.locator('#header-sign-in-btn');
    await expect(signInBtn).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#header-user-menu')).not.toBeVisible();

    // 3. Guest adds an item to the cart
    const addBtn = page.locator('button:has-text("Add")').first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    // Verify guest cart in localStorage has items
    const guestCart = await page.evaluate(() => {
      const stored = localStorage.getItem('moss_guest_cart');
      return stored ? JSON.parse(stored) : [];
    });
    expect(guestCart.length).toBeGreaterThan(0);

    // 4. Open the cart drawer
    const bagBtn = page.locator('button:has-text("Bag")').first();
    await bagBtn.click();

    // 5. Click "Proceed to Delivery & Billing" while not logged in
    const proceedBtn = page.locator('#cart-proceed-checkout-btn');
    await expect(proceedBtn).toBeVisible({ timeout: 10000 });
    await proceedBtn.click();

    // 6. Assert Login Modal opens with "Sign in to place your order" prompt
    const authModal = page.locator('#auth-modal');
    await expect(authModal).toBeVisible({ timeout: 5000 });

    const promptMessage = page.locator('#auth-prompt-message');
    await expect(promptMessage).toBeVisible();
    await expect(promptMessage).toContainText('Sign in to place your order');

    // 7. Register or login as a user
    const testEmail = `shopper_${Date.now()}@moss.store`;
    const testPassword = 'Password123!';

    // Switch to Register tab
    const registerTabBtn = page.locator('button:has-text("Register")');
    await registerTabBtn.click();

    await page.locator('#auth-name-input').fill('Aarav Mehta');
    await page.locator('#auth-email-input').fill(testEmail);
    await page.locator('#auth-phone-input').fill('9876543210');
    await page.locator('#auth-password-input').fill(testPassword);

    await page.locator('#auth-submit-btn').click();

    // 8. Assert Auth Modal closes after successful login
    await expect(authModal).not.toBeVisible({ timeout: 10000 });

    // 9. Assert Header strictly displays logged-in user and NO "Sign In" button
    await expect(page.locator('#header-user-menu')).toBeVisible();
    await expect(signInBtn).not.toBeVisible();

    // 10. Assert user lands straight on Checkout (Step 2 of 2: Address & Payment) with cart intact
    await expect(page.locator('text=Step 2 of 2 · Address & Payment')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#confirm-and-pay-btn')).toBeVisible({ timeout: 10000 });
  });

  test('route guard /checkout redirects unauthenticated user to login modal and continues to checkout after login', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    // Directly navigate to /checkout
    await page.goto('/checkout');

    const authModal = page.locator('#auth-modal');
    await expect(authModal).toBeVisible({ timeout: 8000 });
    const promptMsg = page.locator('#auth-prompt-message');
    await expect(promptMsg).toBeVisible();
    await expect(promptMsg).toContainText('Sign in to place your order');

    // Sign up a user
    const testEmail = `route_user_${Date.now()}@moss.store`;
    await page.locator('button:has-text("Register")').click();
    await page.locator('#auth-name-input').fill('Priya Patel');
    await page.locator('#auth-email-input').fill(testEmail);
    await page.locator('#auth-phone-input').fill('9876543211');
    await page.locator('#auth-password-input').fill('SecretPass123!');
    await page.locator('#auth-submit-btn').click();

    await expect(authModal).not.toBeVisible({ timeout: 10000 });
    // User arrives on checkout step
    await expect(page.locator('#header-user-menu')).toBeVisible();
  });

  test('expired token event keeps cart intact and prompts re-login', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      // Set an item in the cart
      localStorage.setItem('moss_guest_cart', JSON.stringify([
        { id: 'prod_raw_honey_01', name: 'Raw Forest Honey', price: 12, price_inr: 850, quantity: 2 }
      ]));
    });
    await page.reload();

    // Dispatch expired session event
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('moss_auth_expired', {
        detail: { message: 'Your session has expired. Sign in to place your order.' }
      }));
    });

    const authModal = page.locator('#auth-modal');
    await expect(authModal).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#auth-prompt-message')).toContainText('Sign in to place your order');

    // Cart items in localStorage remain intact
    const cartItems = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('moss_guest_cart') || '[]');
    });
    expect(cartItems.length).toBe(1);
    expect(cartItems[0].id).toBe('prod_raw_honey_01');
  });

  test('header strictly never shows both Sign in and User profile menu simultaneously', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Signed out state
    await expect(page.locator('#header-sign-in-btn')).toBeVisible();
    await expect(page.locator('#header-user-menu')).not.toBeVisible();

    // Register user
    await page.locator('#header-sign-in-btn').click();
    const testEmail = `mutual_${Date.now()}@moss.store`;
    await page.locator('button:has-text("Register")').click();
    await page.locator('#auth-name-input').fill('Rohan Gupta');
    await page.locator('#auth-email-input').fill(testEmail);
    await page.locator('#auth-password-input').fill('SecurePassword123!');
    await page.locator('#auth-submit-btn').click();

    // Signed in state
    await expect(page.locator('#header-user-menu')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#header-sign-in-btn')).not.toBeVisible();

    // Log out
    await page.locator('#header-sign-out-btn').click();

    // Signed out state restored
    await expect(page.locator('#header-sign-in-btn')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#header-user-menu')).not.toBeVisible();
  });
});
