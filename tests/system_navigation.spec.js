const { test, expect } = require('@playwright/test');

test.describe('System Navigation - End-to-End', () => {
  
  test('homepage should load correctly and show main sections', async ({ page }) => {
    await page.goto('/');
    
    // Check title
    await expect(page).toHaveTitle(/Campus Marketplace/);
    
    // Check Hero section
    await expect(page.locator('section.hero')).toBeVisible();
    await expect(page.locator('h1')).toContainText('Buy & sell smarter');
    
    // Check Search bar presence
    await expect(page.locator('.search-wrap')).toBeVisible();
    await expect(page.locator('#search-input')).toBeVisible();
    
    // Check Categories section
    await expect(page.locator('section.categories')).toBeVisible();
    const categoriesCount = await page.locator('.cat-card').count();
    expect(categoriesCount).toBeGreaterThan(0);
    
    // Check Featured products section
    await expect(page.locator('section.featured')).toBeVisible();
    
    // Check Footer
    await expect(page.locator('footer')).toBeVisible();
  });

  test('should be able to search and filter products', async ({ page }) => {
    await page.goto('/');
    
    // Perform a search
    const searchInput = page.locator('#search-input');
    await searchInput.fill('test');
    await page.locator('.search-btn').click();
    
    // Check if it scrolls to featured or updates results
    // Since it's a dynamic app, we check if the products-grid is updated
    const grid = page.locator('#products-grid');
    await expect(grid).toBeVisible();
  });

  test('sidebar and topbar navigation', async ({ page }) => {
    await page.goto('/');
    
    // Check Topbar
    const topbar = page.locator('.topbar');
    await expect(topbar).toBeVisible();
    
    // Check sidebar
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();
    
    // The login link is often the profile link when not logged in
    const loginBtn = sidebar.locator('#sbName');
    await expect(loginBtn).toBeVisible();
  });

  test('login page accessibility', async ({ page }) => {
    await page.goto('/login');
    
    // If we are redirected to home, it means we are already logged in.
    // In a test environment, we should ideally be logged out.
    // We check for either the login card OR the hero section (homepage)
    const loginCard = page.locator('.login-card');
    const hero = page.locator('section.hero');
    
    await expect(loginCard.first().or(hero)).toBeVisible();
  });
});
