import { test, expect } from '@playwright/test';
import { AuthHelper, NavigationHelper } from './utils/helpers';
import { testUsers, routes } from './fixtures/test-data';

/**
 * Authentication E2E Tests
 *
 * These tests validate the complete authentication flow including:
 * - Login functionality
 * - Logout functionality
 * - Protected route access
 * - Unauthorized access handling
 */

test.describe('Authentication Flow', () => {
  let authHelper: AuthHelper;
  let navHelper: NavigationHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    navHelper = new NavigationHelper(page);
  });

  test('should display login page', async ({ page }) => {
    await page.goto(routes.login);
    await page.waitForLoadState('networkidle');

    // Verify login page elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Verify page title or heading
    const heading = page.locator('h1, h2').first();
    await expect(heading).toContainText(/login|sign in/i);
  });

  test('should show validation errors for empty login form', async ({
    page,
  }) => {
    await page.goto(routes.login);
    await page.waitForLoadState('networkidle');

    // Click submit without filling form
    await page.click('button[type="submit"]');

    // HTML5 validation should prevent submission
    // Check if we're still on login page
    await expect(page).toHaveURL(new RegExp(routes.login));
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto(routes.login);
    await page.waitForLoadState('networkidle');

    // Fill in invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for error message
    // Note: Adjust this selector based on your actual error message display
    await expect(
      page.locator('text=/invalid|incorrect|failed|error/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    await page.goto(routes.login);
    await page.waitForLoadState('networkidle');

    // Fill in valid admin credentials
    await page.fill('input[type="email"]', testUsers.admin.email);
    await page.fill('input[type="password"]', testUsers.admin.password);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard**', { timeout: 30000 });

    // Verify we're on dashboard
    await expect(page).toHaveURL(new RegExp(routes.dashboard));

    // Verify authenticated state (look for user menu or dashboard content)
    const authenticatedIndicator = page
      .locator('[data-testid="user-menu"], text=/dashboard/i, text=/welcome/i')
      .first();
    await expect(authenticatedIndicator).toBeVisible({ timeout: 10000 });
  });

  test('should redirect to login when accessing protected route without authentication', async ({
    page,
  }) => {
    // Try to access dashboard without logging in
    await page.goto(routes.dashboard);

    // Should be redirected to login page
    await page.waitForURL('**/login**', { timeout: 30000 });
    await expect(page).toHaveURL(new RegExp(routes.login));
  });

  test('should logout successfully', async ({ page }) => {
    // First, login
    await page.goto(routes.login);
    await page.fill('input[type="email"]', testUsers.admin.email);
    await page.fill('input[type="password"]', testUsers.admin.password);
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard**', { timeout: 30000 });

    // Find and click logout button (might be in dropdown)
    // First, try to click user menu if it exists
    const userMenu = page
      .locator(
        '[data-testid="user-menu"], [aria-label*="user" i], button:has-text("admin")'
      )
      .first();
    if (await userMenu.isVisible()) {
      await userMenu.click();
    }

    // Click logout button
    const logoutButton = page
      .locator(
        'button:has-text("Logout"), a:has-text("Logout"), [data-testid="logout"]'
      )
      .first();
    await logoutButton.click();

    // Should redirect to login page
    await page.waitForURL('**/login**', { timeout: 30000 });
    await expect(page).toHaveURL(new RegExp(routes.login));
  });

  test('should persist authentication after page reload', async ({ page }) => {
    // Login
    await page.goto(routes.login);
    await page.fill('input[type="email"]', testUsers.admin.email);
    await page.fill('input[type="password"]', testUsers.admin.password);
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await page.waitForURL('**/dashboard**', { timeout: 30000 });

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still be on dashboard (authenticated)
    await expect(page).toHaveURL(new RegExp(routes.dashboard));
  });

  test('should display signup page', async ({ page }) => {
    await page.goto(routes.signup);
    await page.waitForLoadState('networkidle');

    // Verify signup page elements
    await expect(
      page.locator('input[name="email"], input[type="email"]')
    ).toBeVisible();
    await expect(
      page.locator('input[name="password"], input[type="password"]')
    ).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Verify page title or heading
    const heading = page.locator('h1, h2').first();
    await expect(heading).toContainText(/sign up|register|create account/i);
  });

  test('should navigate between login and signup pages', async ({ page }) => {
    await page.goto(routes.login);
    await page.waitForLoadState('networkidle');

    // Look for signup link
    const signupLink = page
      .locator(
        'a:has-text("Sign up"), a:has-text("Register"), a:has-text("Create account")'
      )
      .first();
    await signupLink.click();

    // Should navigate to signup page
    await page.waitForURL('**/signup**', { timeout: 10000 });
    await expect(page).toHaveURL(new RegExp(routes.signup));

    // Look for login link
    const loginLink = page
      .locator('a:has-text("Login"), a:has-text("Sign in")')
      .first();
    await loginLink.click();

    // Should navigate back to login page
    await page.waitForURL('**/login**', { timeout: 10000 });
    await expect(page).toHaveURL(new RegExp(routes.login));
  });
});
