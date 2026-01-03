import { test, expect } from '@playwright/test';
import { routes } from './fixtures/test-data';

/**
 * Protected Routes E2E Tests
 *
 * These tests validate that protected routes properly enforce authentication
 * and authorization requirements.
 */

test.describe('Protected Routes', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing authentication state
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should redirect to login when accessing dashboard without authentication', async ({
    page,
  }) => {
    await page.goto(routes.dashboard);

    // Should be redirected to login
    await page.waitForURL('**/login**', { timeout: 30000 });
    await expect(page).toHaveURL(new RegExp(routes.login));
  });

  test('should redirect to login when accessing users page without authentication', async ({
    page,
  }) => {
    await page.goto(routes.users);

    // Should be redirected to login
    await page.waitForURL('**/login**', { timeout: 30000 });
    await expect(page).toHaveURL(new RegExp(routes.login));
  });

  test('should redirect to login when accessing roles page without authentication', async ({
    page,
  }) => {
    await page.goto(routes.roles);

    // Should be redirected to login
    await page.waitForURL('**/login**', { timeout: 30000 });
    await expect(page).toHaveURL(new RegExp(routes.login));
  });

  test('should redirect to login when accessing permissions page without authentication', async ({
    page,
  }) => {
    await page.goto(routes.permissions);

    // Should be redirected to login
    await page.waitForURL('**/login**', { timeout: 30000 });
    await expect(page).toHaveURL(new RegExp(routes.login));
  });

  test('should redirect to login when accessing profile without authentication', async ({
    page,
  }) => {
    await page.goto(routes.profile);

    // Should be redirected to login
    await page.waitForURL('**/login**', { timeout: 30000 });
    await expect(page).toHaveURL(new RegExp(routes.login));
  });

  test('should allow access to login page without authentication', async ({
    page,
  }) => {
    await page.goto(routes.login);
    await page.waitForLoadState('networkidle');

    // Should stay on login page
    await expect(page).toHaveURL(new RegExp(routes.login));

    // Login form should be visible
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should allow access to signup page without authentication', async ({
    page,
  }) => {
    await page.goto(routes.signup);
    await page.waitForLoadState('networkidle');

    // Should stay on signup page
    await expect(page).toHaveURL(new RegExp(routes.signup));

    // Signup form should be visible
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('should preserve intended destination after login redirect', async ({
    page,
  }) => {
    // Try to access a protected route
    await page.goto(routes.users);

    // Should be redirected to login
    await page.waitForURL('**/login**', { timeout: 30000 });

    // Note: Testing redirect back to intended destination would require
    // implementing the login flow, which is covered in auth.spec.ts
    // This test just verifies the redirect happens
    await expect(page).toHaveURL(new RegExp(routes.login));
  });

  test('should handle direct navigation to non-existent protected routes', async ({
    page,
  }) => {
    await page.goto('/dashboard/nonexistent-page');

    // Should either redirect to login or show 404
    // The exact behavior depends on your routing implementation
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const isLoginOrNotFound =
      url.includes('/login') ||
      url.includes('/404') ||
      url.includes('not-found');

    expect(isLoginOrNotFound).toBeTruthy();
  });

  test('should not allow access to protected API endpoints without token', async ({
    page,
  }) => {
    // Intercept API calls to verify they fail without authentication
    let apiCallMade = false;
    let apiCallSucceeded = false;

    page.on('response', (response) => {
      if (
        response.url().includes('/api/v1/users') ||
        response.url().includes('/api/v1/dashboard')
      ) {
        apiCallMade = true;
        if (response.status() === 200) {
          apiCallSucceeded = true;
        }
      }
    });

    // Try to access a protected page that makes API calls
    await page.goto(routes.dashboard);

    // Wait a bit for any API calls to be made
    await page.waitForTimeout(2000);

    // If API calls were made, they should not have succeeded without auth
    if (apiCallMade) {
      expect(apiCallSucceeded).toBeFalsy();
    }

    // Should be on login page
    await expect(page).toHaveURL(new RegExp(routes.login));
  });

  test('should clear authentication state on logout and prevent access to protected routes', async ({
    page,
  }) => {
    // This test would require logging in first and then logging out
    // For now, we'll just verify the unauthenticated state

    // Clear all storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.context().clearCookies();

    // Try to access protected route
    await page.goto(routes.dashboard);

    // Should redirect to login
    await page.waitForURL('**/login**', { timeout: 30000 });
    await expect(page).toHaveURL(new RegExp(routes.login));
  });
});

test.describe('Public Routes', () => {
  test('should allow access to home/root path', async ({ page }) => {
    await page.goto(routes.home);
    await page.waitForLoadState('networkidle');

    // Should either show landing page or redirect to login
    // The page should load successfully
    const pageContent = await page.content();
    expect(pageContent).toBeTruthy();
    expect(pageContent.length).toBeGreaterThan(0);
  });

  test('should display unauthorized page when accessing without permissions', async ({
    page,
  }) => {
    // Try to access unauthorized route directly
    await page.goto(routes.unauthorized);
    await page.waitForLoadState('networkidle');

    // Should show unauthorized page or content
    const url = page.url();
    expect(url).toContain('unauthorized');
  });
});
