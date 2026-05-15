const { test, expect } = require('@playwright/test');

test.describe('Product Interaction - Detailed Cases', () => {
  
  test.beforeEach(async ({ page }) => {
    // Mock the product detail page data if needed, or just go to an existing one.
    // For simplicity, we'll mock the API responses.
    
    // Mock product details
    await page.route('**/api/products/test-id', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          _id: 'test-id',
          title: 'Test Product',
          price: 100000,
          interested: 5,
          seller: { _id: 'seller-id', name: 'Test Seller' },
          images: [],
          description: 'A test description'
        })
      });
    });

    // Mock interested toggle
    await page.route('**/api/products/test-id/interested', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, interested: 6 })
      });
    });
  });

  test('Interested button should toggle heart color and increment count', async ({ page }) => {
    // We need to bypass the IS_AUTH check or mock the user state
    // One way is to inject IS_AUTH = true into the page
    await page.goto('/products/test-id');
    
    // Inject auth state
    await page.evaluate(() => {
      window.IS_AUTH = true;
    });

    const interestedBtn = page.locator('#btn-interested');
    const heartIcon = page.locator('#heart-icon');
    const countSpan = page.locator('#int-count');

    // Initial state check (based on mocked initial data)
    await expect(countSpan).toHaveText('(5)');
    
    // Click interested
    await interestedBtn.click();

    // Verify count increased (based on mocked response)
    await expect(countSpan).toHaveText('(6)');

    // Verify heart color change
    // The script sets icon.style.fill = '#f87171'
    await expect(heartIcon).toHaveAttribute('style', /fill: rgb\(248, 113, 113\)/);
  });

  test('Message seller button should redirect to messages', async ({ page }) => {
    await page.goto('/products/test-id');
    
    await page.evaluate(() => {
      window.IS_AUTH = true;
    });

    // Mock chat init
    await page.route('**/api/chat/init', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, conversationId: 'conv-123' })
      });
    });

    const msgBtn = page.locator('#btn-msg-seller');
    await msgBtn.click();

    // Verify redirection
    await expect(page).toHaveURL(/\/messages\?id=conv-123/);
  });
});
