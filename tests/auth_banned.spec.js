const { test, expect } = require('@playwright/test');

test.describe('Authentication - Banned User Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the login page
    await page.goto('/login');
  });

  test('should display error message and toast when redirected with banned error', async ({ page }) => {
    // Simulate a redirect back to login with error=banned
    await page.goto('/login?error=banned');

    // 1. Check if the error box is visible and contains the correct text
    // Use a filter to uniquely identify the correct error box among multiple ones
    const errorBox = page.locator('.error-box').filter({ hasText: 'This account has been banned.' });
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText('This account has been banned.');

    // 2. Check if the toast notification appears
    const toast = page.locator('.toast.err');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('This account has been banned');
  });

  test('should show loading state when Google button is clicked', async ({ page }) => {
    // Fulfill with 204 No Content so the browser stays on the same page
    await page.route('**/api/auth/google', async route => {
      await route.fulfill({
        status: 204
      });
    });

    const googleBtn = page.locator('#google-btn');
    
    // Trigger the click.
    await googleBtn.click({ noWaitAfter: true });
    
    // Now we can safely check the class
    await expect(googleBtn).toHaveClass(/loading/);
  });
});
