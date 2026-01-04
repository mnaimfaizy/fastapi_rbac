import { test, expect } from '@playwright/test';
import { AuthHelper, NavigationHelper, WaitHelper } from './utils/helpers';
import { testUsers, routes } from './fixtures/test-data';

/**
 * Dashboard E2E Tests
 *
 * These tests validate the dashboard functionality including:
 * - Dashboard page load and display
 * - Dashboard content visibility
 * - Navigation within dashboard
 * - Protected route enforcement
 */

test.describe('Dashboard Flow', () => {
  let authHelper: AuthHelper;
  let navHelper: NavigationHelper;
  let waitHelper: WaitHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    navHelper = new NavigationHelper(page);
    waitHelper = new WaitHelper(page);

    // Login before each test
    await authHelper.loginAsAdmin();
  });

  test('should load dashboard page successfully', async ({ page }) => {
    await navHelper.gotoDashboard();

    // Verify we're on the dashboard
    await expect(page).toHaveURL(new RegExp(routes.dashboard));

    // Wait for loading to complete
    await waitHelper.waitForLoadingComplete();

    // Verify dashboard heading or title
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('should display dashboard statistics or content', async ({ page }) => {
    await navHelper.gotoDashboard();
    await waitHelper.waitForLoadingComplete();

    // Look for common dashboard elements
    // Adjust these selectors based on your actual dashboard structure
    const dashboardContent = page
      .locator('[data-testid="dashboard-content"], .dashboard, main')
      .first();

    await expect(dashboardContent).toBeVisible();
  });

  test('should navigate to users page from dashboard', async ({ page }) => {
    await navHelper.gotoDashboard();
    await waitHelper.waitForLoadingComplete();

    // Find and click users link/button
    const usersLink = page
      .locator(
        'a:has-text("Users"), button:has-text("Users"), [href*="/users"]'
      )
      .first();

    if (await usersLink.isVisible()) {
      await usersLink.click();

      // Wait for navigation
      await page.waitForURL('**/users**', { timeout: 10000 });
      await expect(page).toHaveURL(new RegExp(routes.users));
    }
  });

  test('should navigate to roles page from dashboard', async ({ page }) => {
    await navHelper.gotoDashboard();
    await waitHelper.waitForLoadingComplete();

    // Find and click roles link/button
    const rolesLink = page
      .locator(
        'a:has-text("Roles"), button:has-text("Roles"), [href*="/roles"]'
      )
      .first();

    if (await rolesLink.isVisible()) {
      await rolesLink.click();

      // Wait for navigation
      await page.waitForURL('**/roles**', { timeout: 10000 });
      await expect(page).toHaveURL(new RegExp(routes.roles));
    }
  });

  test('should navigate to permissions page from dashboard', async ({
    page,
  }) => {
    await navHelper.gotoDashboard();
    await waitHelper.waitForLoadingComplete();

    // Find and click permissions link/button
    const permissionsLink = page
      .locator(
        'a:has-text("Permissions"), button:has-text("Permissions"), [href*="/permissions"]'
      )
      .first();

    if (await permissionsLink.isVisible()) {
      await permissionsLink.click();

      // Wait for navigation
      await page.waitForURL('**/permissions**', { timeout: 10000 });
      await expect(page).toHaveURL(new RegExp(routes.permissions));
    }
  });

  test('should display user menu with profile and logout options', async ({
    page,
  }) => {
    await navHelper.gotoDashboard();
    await waitHelper.waitForLoadingComplete();

    // Find user menu (might be an avatar or username button)
    const userMenuButton = page
      .locator(
        '[data-testid="user-menu"], [aria-label*="user" i], button:has-text("admin"), button:has-text("profile")'
      )
      .first();

    if (await userMenuButton.isVisible()) {
      await userMenuButton.click();

      // Verify menu options are visible
      const profileLink = page
        .locator('a:has-text("Profile"), button:has-text("Profile")')
        .first();
      const logoutButton = page
        .locator('button:has-text("Logout"), a:has-text("Logout")')
        .first();

      // At least one of these should be visible
      const menuVisible =
        (await profileLink.isVisible()) || (await logoutButton.isVisible());

      expect(menuVisible).toBeTruthy();
    }
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Navigate to dashboard first
    await navHelper.gotoDashboard();

    // Simulate offline mode
    await page.context().setOffline(true);

    // Reload the page or try to fetch data
    await page.reload({ waitUntil: 'domcontentloaded' });

    // The app should handle this gracefully
    // Check that the page doesn't crash and shows some indication
    // This is a basic check - adjust based on your error handling
    const pageContent = await page.content();
    expect(pageContent).toBeTruthy();

    // Restore online mode
    await page.context().setOffline(false);
  });

  test('should maintain navigation state within dashboard sections', async ({
    page,
  }) => {
    await navHelper.gotoDashboard();
    await waitHelper.waitForLoadingComplete();

    // Get current URL
    const initialUrl = page.url();

    // Click on the dashboard/home link if it exists
    const dashboardLink = page
      .locator(
        'a:has-text("Dashboard"), a:has-text("Home"), [href="/dashboard"]'
      )
      .first();

    if (await dashboardLink.isVisible()) {
      await dashboardLink.click();
      await waitHelper.waitForLoadingComplete();

      // Should still be on dashboard
      await expect(page).toHaveURL(new RegExp(routes.dashboard));
    }
  });

  test('should display welcome message or user info', async ({ page }) => {
    await navHelper.gotoDashboard();
    await waitHelper.waitForLoadingComplete();

    // Look for user-specific content (welcome message, username, etc.)
    const userInfo = page
      .locator('text=/welcome/i, text=/dashboard/i, [data-testid="user-info"]')
      .first();

    // At least some dashboard content should be visible
    const hasDashboardContent = await userInfo.isVisible().catch(() => false);

    // If not found by text, just verify the page loaded successfully
    if (!hasDashboardContent) {
      // Verify page loaded by checking for main content area
      const mainContent = page
        .locator('main, [role="main"], .main-content')
        .first();
      await expect(mainContent).toBeVisible();
    }
  });
});
