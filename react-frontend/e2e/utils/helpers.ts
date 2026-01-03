import { Page, expect } from '@playwright/test';
import { testUsers, routes, timeouts } from '../fixtures/test-data';

/**
 * Authentication helper utilities for E2E tests
 */
export class AuthHelper {
  constructor(private page: Page) {}

  /**
   * Login with provided credentials
   * @param email - User email
   * @param password - User password
   */
  async login(email: string, password: string) {
    await this.page.goto(routes.login);
    await this.page.waitForLoadState('networkidle');

    // Fill in login form
    await this.page.fill('input[name="email"], input[type="email"]', email);
    await this.page.fill(
      'input[name="password"], input[type="password"]',
      password
    );

    // Submit the form
    await this.page.click('button[type="submit"]');

    // Wait for navigation to complete
    await this.page.waitForURL('**/dashboard**', {
      timeout: timeouts.navigation,
    });
  }

  /**
   * Login as admin user
   */
  async loginAsAdmin() {
    await this.login(testUsers.admin.email, testUsers.admin.password);
  }

  /**
   * Login as regular user
   */
  async loginAsRegularUser() {
    await this.login(
      testUsers.regularUser.email,
      testUsers.regularUser.password
    );
  }

  /**
   * Logout the current user
   */
  async logout() {
    // Look for logout button (might be in a dropdown or menu)
    await this.page.click('button:has-text("Logout"), a:has-text("Logout")');

    // Wait for redirect to login page
    await this.page.waitForURL('**/login**', {
      timeout: timeouts.navigation,
    });
  }

  /**
   * Verify user is authenticated by checking for dashboard or protected content
   */
  async verifyAuthenticated() {
    // Check that we're not on the login page
    const url = this.page.url();
    expect(url).not.toContain('/login');

    // Check for authenticated user indicators (adjust selectors as needed)
    const isAuthenticated =
      (await this.page.locator('[data-testid="user-menu"]').count()) > 0 ||
      (await this.page.locator('text=/dashboard/i').count()) > 0;

    expect(isAuthenticated).toBeTruthy();
  }

  /**
   * Verify user is NOT authenticated
   */
  async verifyNotAuthenticated() {
    const url = this.page.url();
    expect(url).toContain('/login');
  }
}

/**
 * Navigation helper utilities
 */
export class NavigationHelper {
  constructor(private page: Page) {}

  /**
   * Navigate to a specific route and wait for load
   */
  async goto(route: string) {
    await this.page.goto(route);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to dashboard
   */
  async gotoDashboard() {
    await this.goto(routes.dashboard);
  }

  /**
   * Navigate to users page
   */
  async gotoUsers() {
    await this.goto(routes.users);
  }

  /**
   * Navigate to roles page
   */
  async gotoRoles() {
    await this.goto(routes.roles);
  }

  /**
   * Verify current URL matches expected route
   */
  async verifyRoute(expectedRoute: string) {
    await expect(this.page).toHaveURL(new RegExp(expectedRoute));
  }
}

/**
 * Form helper utilities
 */
export class FormHelper {
  constructor(private page: Page) {}

  /**
   * Fill a form field by label or name
   */
  async fillField(label: string, value: string) {
    const input = this.page
      .locator(`input[name="${label}"], textarea[name="${label}"]`)
      .or(
        this.page.locator(
          `label:has-text("${label}") + input, label:has-text("${label}") + textarea`
        )
      );
    await input.fill(value);
  }

  /**
   * Submit a form
   */
  async submit() {
    await this.page.click('button[type="submit"]');
  }

  /**
   * Verify form validation error
   */
  async verifyValidationError(message: string) {
    await expect(this.page.locator(`text="${message}"`)).toBeVisible();
  }
}

/**
 * API mock helper utilities
 */
export class ApiMockHelper {
  constructor(private page: Page) {}

  /**
   * Mock a successful API response
   */
  async mockSuccess(endpoint: string, responseData: unknown) {
    await this.page.route(endpoint, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseData),
      });
    });
  }

  /**
   * Mock an API error response
   */
  async mockError(endpoint: string, statusCode: number, errorMessage: string) {
    await this.page.route(endpoint, (route) => {
      route.fulfill({
        status: statusCode,
        contentType: 'application/json',
        body: JSON.stringify({ message: errorMessage }),
      });
    });
  }

  /**
   * Mock network failure
   */
  async mockNetworkFailure(endpoint: string) {
    await this.page.route(endpoint, (route) => {
      route.abort('failed');
    });
  }
}

/**
 * Wait helper utilities
 */
export class WaitHelper {
  constructor(private page: Page) {}

  /**
   * Wait for element to be visible
   */
  async waitForVisible(selector: string, timeout = timeouts.medium) {
    await this.page.waitForSelector(selector, {
      state: 'visible',
      timeout,
    });
  }

  /**
   * Wait for element to be hidden
   */
  async waitForHidden(selector: string, timeout = timeouts.medium) {
    await this.page.waitForSelector(selector, {
      state: 'hidden',
      timeout,
    });
  }

  /**
   * Wait for API response
   */
  async waitForApiResponse(urlPattern: string | RegExp) {
    return await this.page.waitForResponse(urlPattern);
  }

  /**
   * Wait for loading to complete
   */
  async waitForLoadingComplete() {
    // Wait for common loading indicators to disappear
    const loadingSelectors = [
      '[data-testid="loading"]',
      '.loading',
      'text=/loading/i',
      '[role="progressbar"]',
    ];

    for (const selector of loadingSelectors) {
      const count = await this.page.locator(selector).count();
      if (count > 0) {
        await this.page.waitForSelector(selector, {
          state: 'hidden',
          timeout: timeouts.long,
        });
      }
    }
  }
}
