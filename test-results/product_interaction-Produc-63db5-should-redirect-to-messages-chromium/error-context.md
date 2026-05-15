# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: product_interaction.spec.js >> Product Interaction - Detailed Cases >> Message seller button should redirect to messages
- Location: tests\product_interaction.spec.js:64:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#btn-msg-seller')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - link "Campus Logo" [ref=e4] [cursor=pointer]:
      - /url: /
      - img "Campus Logo" [ref=e5]
    - generic [ref=e7]:
      - img [ref=e8]
      - textbox "Search functions, pages..." [ref=e11]
    - generic [ref=e12]:
      - button "Notifications" [ref=e13] [cursor=pointer]:
        - img [ref=e14]
      - button "Messages" [ref=e16] [cursor=pointer]:
        - img [ref=e17]
  - complementary [ref=e19]:
    - generic [ref=e21]:
      - link "Categories" [ref=e22] [cursor=pointer]:
        - /url: /#categories
        - img [ref=e23]
        - text: Categories
      - link "Featured" [ref=e28] [cursor=pointer]:
        - /url: /#featured
        - img [ref=e29]
        - text: Featured
      - generic [ref=e31]: My Activities
      - link "My Orders" [ref=e32] [cursor=pointer]:
        - /url: /orders
        - img [ref=e33]
        - generic [ref=e36]: My Orders
    - generic [ref=e37]:
      - link "Login" [ref=e40] [cursor=pointer]:
        - /url: /profile
      - button [ref=e41] [cursor=pointer]:
        - img [ref=e42]
  - generic [ref=e45]:
    - generic [ref=e46]: 🔍
    - heading "Page not found" [level=1] [ref=e47]
    - paragraph [ref=e48]: The page you're looking for doesn't exist or has been removed.
    - link "← Back to homepage" [ref=e49] [cursor=pointer]:
      - /url: /
```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | 
  3  | test.describe('Product Interaction - Detailed Cases', () => {
  4  |   
  5  |   test.beforeEach(async ({ page }) => {
  6  |     // Mock the product detail page data if needed, or just go to an existing one.
  7  |     // For simplicity, we'll mock the API responses.
  8  |     
  9  |     // Mock product details
  10 |     await page.route('**/api/products/test-id', async route => {
  11 |       await route.fulfill({
  12 |         status: 200,
  13 |         contentType: 'application/json',
  14 |         body: JSON.stringify({
  15 |           _id: 'test-id',
  16 |           title: 'Test Product',
  17 |           price: 100000,
  18 |           interested: 5,
  19 |           seller: { _id: 'seller-id', name: 'Test Seller' },
  20 |           images: [],
  21 |           description: 'A test description'
  22 |         })
  23 |       });
  24 |     });
  25 | 
  26 |     // Mock interested toggle
  27 |     await page.route('**/api/products/test-id/interested', async route => {
  28 |       await route.fulfill({
  29 |         status: 200,
  30 |         contentType: 'application/json',
  31 |         body: JSON.stringify({ success: true, interested: 6 })
  32 |       });
  33 |     });
  34 |   });
  35 | 
  36 |   test('Interested button should toggle heart color and increment count', async ({ page }) => {
  37 |     // We need to bypass the IS_AUTH check or mock the user state
  38 |     // One way is to inject IS_AUTH = true into the page
  39 |     await page.goto('/products/test-id');
  40 |     
  41 |     // Inject auth state
  42 |     await page.evaluate(() => {
  43 |       window.IS_AUTH = true;
  44 |     });
  45 | 
  46 |     const interestedBtn = page.locator('#btn-interested');
  47 |     const heartIcon = page.locator('#heart-icon');
  48 |     const countSpan = page.locator('#int-count');
  49 | 
  50 |     // Initial state check (based on mocked initial data)
  51 |     await expect(countSpan).toHaveText('(5)');
  52 |     
  53 |     // Click interested
  54 |     await interestedBtn.click();
  55 | 
  56 |     // Verify count increased (based on mocked response)
  57 |     await expect(countSpan).toHaveText('(6)');
  58 | 
  59 |     // Verify heart color change
  60 |     // The script sets icon.style.fill = '#f87171'
  61 |     await expect(heartIcon).toHaveAttribute('style', /fill: rgb\(248, 113, 113\)/);
  62 |   });
  63 | 
  64 |   test('Message seller button should redirect to messages', async ({ page }) => {
  65 |     await page.goto('/products/test-id');
  66 |     
  67 |     await page.evaluate(() => {
  68 |       window.IS_AUTH = true;
  69 |     });
  70 | 
  71 |     // Mock chat init
  72 |     await page.route('**/api/chat/init', async route => {
  73 |       await route.fulfill({
  74 |         status: 200,
  75 |         contentType: 'application/json',
  76 |         body: JSON.stringify({ success: true, conversationId: 'conv-123' })
  77 |       });
  78 |     });
  79 | 
  80 |     const msgBtn = page.locator('#btn-msg-seller');
> 81 |     await msgBtn.click();
     |                  ^ Error: locator.click: Test timeout of 30000ms exceeded.
  82 | 
  83 |     // Verify redirection
  84 |     await expect(page).toHaveURL(/\/messages\?id=conv-123/);
  85 |   });
  86 | });
  87 | 
```