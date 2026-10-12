import { test, expect } from '@playwright/test';

test.describe('Search Results Page & Home Mode / Results Mode Split', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure guest state is clean
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('searching "honey" shows only toolbar plus N cards (matching count) and no hero; first card in viewport', async ({ page }) => {
    await page.goto('/');

    // 1. Verify Home Mode is active initially
    await expect(page.locator('text=SPRING COLLECTION 2026')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Bolo, Trovi dhoond dega');

    // 2. Perform search for "honey"
    const searchInput = page.locator('input[placeholder*="Search groceries"]');
    await searchInput.fill('honey');
    await searchInput.press('Enter');

    // 3. Verify URL contains ?q=honey
    await expect(page).toHaveURL(/\?q=honey/);

    // 4. Verify Results Mode: Hero section, concierge card, and offers MUST BE HIDDEN
    await expect(page.locator('text=SPRING COLLECTION 2026')).toHaveCount(0);
    await expect(page.locator('h1')).toHaveCount(0);
    await expect(page.locator('text=RITUAL PANTRY BUNDLES')).toHaveCount(0);

    // 5. Verify Results Toolbar is visible
    const toolbar = page.locator('#results-toolbar');
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toContainText('Showing results for "honey"');

    // 6. Single Source of Truth: Count in banner matches exact number of product cards
    const countBanner = page.locator('#results-count-banner');
    await expect(countBanner).toBeVisible();
    const countText = await countBanner.innerText();
    const countMatch = countText.match(/Found\s+(\d+)\s+matching/);
    expect(countMatch).not.toBeNull();
    const expectedCount = parseInt(countMatch[1], 10);
    expect(expectedCount).toBeGreaterThan(0);

    // Verify grid cards count matches expectedCount exactly
    const cards = page.locator('#results-product-grid .product-card');
    await expect(cards).toHaveCount(expectedCount);

    // 7. Verify first result card is visible within the viewport after search
    const firstCard = cards.first();
    await expect(firstCard).toBeVisible();
    await expect(firstCard).toBeInViewport();
  });

  test('nonsense query shows empty state with Clear Search button and category suggestions', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.locator('input[placeholder*="Search groceries"]');
    await searchInput.fill('xyzzyqwer123');
    await searchInput.press('Enter');

    // Verify empty state is displayed
    const emptyState = page.locator('#results-empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText('No results for "xyzzyqwer123"');

    // Verify Clear Search button exists in empty state
    await expect(emptyState.locator('button:has-text("Clear Search")')).toBeVisible();

    // Verify category suggestions exist
    await expect(emptyState.locator('text=Suggested categories:')).toBeVisible();
    await expect(emptyState.locator('button:has-text("Pure Honey")')).toBeVisible();

    // Ensure it's not a blank area
    const box = await emptyState.boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThan(150);

    // Hero section must still be hidden
    await expect(page.locator('text=SPRING COLLECTION 2026')).toHaveCount(0);
  });

  test('clicking Clear Search restores the homepage and clears ?q= from URL', async ({ page }) => {
    await page.goto('/?q=honey');

    // Results mode is active
    await expect(page.locator('#results-toolbar')).toBeVisible();
    await expect(page.locator('text=SPRING COLLECTION 2026')).toHaveCount(0);

    // Click Clear Search button in toolbar
    const clearBtn = page.locator('#clear-search-btn');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // Homepage mode restored
    await expect(page.locator('text=SPRING COLLECTION 2026')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Bolo, Trovi dhoond dega');

    // Results toolbar is no longer visible
    await expect(page.locator('#results-toolbar')).toHaveCount(0);

    // URL has ?q= removed
    const url = page.url();
    expect(url).not.toContain('?q=');
  });

  test('direct navigation to /?q=honey or refresh keeps search results mode', async ({ page }) => {
    await page.goto('/?q=honey');

    // Toolbar is visible
    await expect(page.locator('#results-toolbar')).toBeVisible();
    await expect(page.locator('#results-toolbar')).toContainText('Showing results for "honey"');

    // Hero section is not visible
    await expect(page.locator('text=SPRING COLLECTION 2026')).toHaveCount(0);

    // Cards are visible in viewport
    const cards = page.locator('#results-product-grid .product-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    await expect(cards.first()).toBeInViewport();

    // Refresh page
    await page.reload();

    // Still in search results mode
    await expect(page.locator('#results-toolbar')).toBeVisible();
    await expect(page.locator('text=SPRING COLLECTION 2026')).toHaveCount(0);
    await expect(page.locator('#results-product-grid .product-card')).toHaveCount(count);
  });

  test('signed out wishlist heart shows 0 (no leftover demo data) and Visual Lens appears once in header', async ({ page }) => {
    await page.goto('/');

    // 1. Wishlist badge count for guest should not show 3
    // If wishlist is empty, the badge span is not rendered (wishlistCount === 0)
    const wishlistHeartButton = page.locator('button[title="Wishlist & Saved Products"]');
    await expect(wishlistHeartButton).toBeVisible();
    // Badge inside wishlist button (e.g. <span>3</span>) must not exist
    await expect(wishlistHeartButton.locator('span')).toHaveCount(0);

    // 2. Visual Lens should appear only once in the header/nav
    // (Header bar action button has "Visual Lens"; it was removed from CATEGORIES_NAV)
    const visualLensButtons = page.locator('header button:has-text("Visual Lens")');
    await expect(visualLensButtons).toHaveCount(1);
  });
});
