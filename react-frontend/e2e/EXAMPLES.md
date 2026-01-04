# Playwright E2E Testing Examples

This document provides practical examples of writing E2E tests with Playwright for the React frontend.

## Table of Contents

- [Basic Test Structure](#basic-test-structure)
- [Authentication Examples](#authentication-examples)
- [Form Testing Examples](#form-testing-examples)
- [API Mocking Examples](#api-mocking-examples)
- [Navigation Examples](#navigation-examples)
- [Advanced Examples](#advanced-examples)

## Basic Test Structure

### Simple Test Example

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto('/');
  });

  test('should perform action', async ({ page }) => {
    // Test implementation
    await page.click('button');
    await expect(page.locator('h1')).toContainText('Expected Text');
  });
});
```

### Using Helper Classes

```typescript
import { test, expect } from '@playwright/test';
import { AuthHelper, NavigationHelper } from './utils/helpers';

test.describe('Protected Feature', () => {
  let authHelper: AuthHelper;
  let navHelper: NavigationHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    navHelper = new NavigationHelper(page);

    // Login before each test
    await authHelper.loginAsAdmin();
  });

  test('should access protected page', async ({ page }) => {
    await navHelper.gotoUsers();
    await expect(page).toHaveURL(/\/users/);
  });
});
```

## Authentication Examples

### Login Test

```typescript
test('should login with valid credentials', async ({ page }) => {
  await page.goto('/login');

  // Fill login form
  await page.fill('[data-testid="email"]', 'admin@example.com');
  await page.fill('[data-testid="password"]', 'AdminPass123!');

  // Submit form
  await page.click('[data-testid="login-button"]');

  // Wait for redirect
  await page.waitForURL('**/dashboard**');

  // Verify successful login
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
});
```

### Logout Test

```typescript
test('should logout successfully', async ({ page }) => {
  // Login first
  const authHelper = new AuthHelper(page);
  await authHelper.loginAsAdmin();

  // Logout
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');

  // Verify redirect to login
  await page.waitForURL('**/login**');
  await expect(page).toHaveURL(/\/login/);
});
```

### Testing Authentication Persistence

```typescript
test('should maintain authentication after reload', async ({ page }) => {
  const authHelper = new AuthHelper(page);
  await authHelper.loginAsAdmin();

  // Reload page
  await page.reload();
  await page.waitForLoadState('networkidle');

  // Should still be authenticated
  await expect(page).toHaveURL(/\/dashboard/);
  await authHelper.verifyAuthenticated();
});
```

## Form Testing Examples

### Testing Form Validation

```typescript
test('should validate required fields', async ({ page }) => {
  await page.goto('/users/create');

  // Try to submit empty form
  await page.click('[data-testid="submit-button"]');

  // Check for validation errors
  await expect(page.locator('text=/email is required/i')).toBeVisible();
  await expect(page.locator('text=/password is required/i')).toBeVisible();
});
```

### Testing Form Submission

```typescript
test('should create new user', async ({ page }) => {
  const authHelper = new AuthHelper(page);
  await authHelper.loginAsAdmin();

  await page.goto('/users/create');

  // Fill form
  await page.fill('[data-testid="email"]', 'newuser@example.com');
  await page.fill('[data-testid="first-name"]', 'John');
  await page.fill('[data-testid="last-name"]', 'Doe');
  await page.fill('[data-testid="password"]', 'SecurePass123!');

  // Submit form
  await page.click('[data-testid="submit-button"]');

  // Wait for success message
  await expect(page.locator('text=/created successfully/i')).toBeVisible();

  // Verify redirect to users list
  await page.waitForURL('**/users**');
});
```

### Testing Form with File Upload

```typescript
test('should upload user avatar', async ({ page }) => {
  await page.goto('/profile');

  // Upload file
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles('path/to/avatar.jpg');

  // Submit
  await page.click('[data-testid="save-button"]');

  // Verify upload
  await expect(page.locator('[data-testid="avatar-preview"]')).toBeVisible();
});
```

## API Mocking Examples

### Mocking Successful API Response

```typescript
test('should display users from API', async ({ page }) => {
  // Mock API response
  await page.route('**/api/v1/users**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: '1',
            email: 'user1@example.com',
            first_name: 'User',
            last_name: 'One',
          },
          {
            id: '2',
            email: 'user2@example.com',
            first_name: 'User',
            last_name: 'Two',
          },
        ],
        pagination: { total: 2, page: 1, pages: 1 },
      }),
    });
  });

  await page.goto('/users');

  // Verify users are displayed
  await expect(page.locator('text=user1@example.com')).toBeVisible();
  await expect(page.locator('text=user2@example.com')).toBeVisible();
});
```

### Mocking API Error

```typescript
test('should handle API error gracefully', async ({ page }) => {
  // Mock error response
  await page.route('**/api/v1/users**', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Internal server error' }),
    });
  });

  await page.goto('/users');

  // Verify error message is displayed
  await expect(page.locator('text=/error/i')).toBeVisible();
});
```

### Intercepting and Modifying Requests

```typescript
test('should modify API request', async ({ page }) => {
  // Intercept and modify request
  await page.route('**/api/v1/users**', async (route) => {
    const request = route.request();

    // Modify request if needed
    await route.continue({
      headers: {
        ...request.headers(),
        'X-Custom-Header': 'custom-value',
      },
    });
  });

  await page.goto('/users');
});
```

## Navigation Examples

### Testing Navigation Links

```typescript
test('should navigate between pages', async ({ page }) => {
  const authHelper = new AuthHelper(page);
  await authHelper.loginAsAdmin();

  // Navigate from dashboard to users
  await page.goto('/dashboard');
  await page.click('[data-testid="users-link"]');
  await expect(page).toHaveURL(/\/users/);

  // Navigate to roles
  await page.click('[data-testid="roles-link"]');
  await expect(page).toHaveURL(/\/roles/);
});
```

### Testing Browser Back/Forward

```typescript
test('should handle browser navigation', async ({ page }) => {
  const authHelper = new AuthHelper(page);
  await authHelper.loginAsAdmin();

  await page.goto('/dashboard');
  await page.goto('/users');

  // Go back
  await page.goBack();
  await expect(page).toHaveURL(/\/dashboard/);

  // Go forward
  await page.goForward();
  await expect(page).toHaveURL(/\/users/);
});
```

## Advanced Examples

### Testing with Multiple Tabs

```typescript
test('should work across multiple tabs', async ({ context }) => {
  const page1 = await context.newPage();
  const page2 = await context.newPage();

  // Login in first tab
  const authHelper1 = new AuthHelper(page1);
  await authHelper1.loginAsAdmin();

  // Second tab should also be authenticated (shared storage)
  await page2.goto('/dashboard');
  await expect(page2).toHaveURL(/\/dashboard/);
});
```

### Testing Responsive Design

```typescript
test('should work on mobile viewport', async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });

  await page.goto('/');

  // Mobile menu should be visible
  await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();

  // Desktop menu should be hidden
  await expect(page.locator('[data-testid="desktop-menu"]')).toBeHidden();
});
```

### Testing with Keyboard Navigation

```typescript
test('should navigate with keyboard', async ({ page }) => {
  await page.goto('/login');

  // Tab through fields
  await page.press('[data-testid="email"]', 'Tab');
  await expect(page.locator('[data-testid="password"]')).toBeFocused();

  // Submit with Enter
  await page.fill('[data-testid="email"]', 'admin@example.com');
  await page.fill('[data-testid="password"]', 'AdminPass123!');
  await page.press('[data-testid="password"]', 'Enter');

  await page.waitForURL('**/dashboard**');
});
```

### Testing Drag and Drop

```typescript
test('should reorder items with drag and drop', async ({ page }) => {
  await page.goto('/users');

  // Drag first item to second position
  const firstItem = page.locator('[data-testid="user-item"]').first();
  const secondItem = page.locator('[data-testid="user-item"]').nth(1);

  await firstItem.dragTo(secondItem);

  // Verify new order
  const items = await page.locator('[data-testid="user-item"]').all();
  await expect(items[0]).toContainText('Original Second Item');
  await expect(items[1]).toContainText('Original First Item');
});
```

### Testing with Network Conditions

```typescript
test('should handle slow network', async ({ page, context }) => {
  // Simulate slow 3G
  await context.route('**/*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 1s delay
    await route.continue();
  });

  await page.goto('/users');

  // Loading indicator should appear
  await expect(page.locator('[data-testid="loading"]')).toBeVisible();

  // Content should eventually load
  await expect(page.locator('[data-testid="users-table"]')).toBeVisible({
    timeout: 15000,
  });
});
```

### Testing with Screenshots

```typescript
test('should match screenshot', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');

  // Take screenshot and compare
  await expect(page).toHaveScreenshot('dashboard.png', {
    fullPage: true,
    threshold: 0.2, // 20% difference allowed
  });
});
```

### Testing Accessibility

```typescript
test('should have no accessibility violations', async ({ page }) => {
  await page.goto('/');

  // Check for common accessibility issues
  const violations = await page.evaluate(() => {
    // Check for alt text on images
    const imagesWithoutAlt = document.querySelectorAll('img:not([alt])');

    // Check for proper heading hierarchy
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

    return {
      missingAlt: imagesWithoutAlt.length,
      headingCount: headings.length,
    };
  });

  expect(violations.missingAlt).toBe(0);
});
```

### Testing with Custom Fixtures

```typescript
// Define custom fixture
import { test as base } from '@playwright/test';

type MyFixtures = {
  authenticatedPage: Page;
};

const test = base.extend<MyFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Setup: login before test
    const authHelper = new AuthHelper(page);
    await authHelper.loginAsAdmin();

    // Use the authenticated page in test
    await use(page);

    // Teardown: logout after test
    await authHelper.logout();
  },
});

// Use in test
test('should access protected resource', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/users');
  await expect(authenticatedPage).toHaveURL(/\/users/);
});
```

## Running Specific Examples

```bash
# Run a specific test file
npx playwright test e2e/auth.spec.ts

# Run tests matching a pattern
npx playwright test --grep "login"

# Run a specific test
npx playwright test e2e/auth.spec.ts:15

# Run in debug mode
npx playwright test e2e/auth.spec.ts --debug

# Run with headed browser
npx playwright test e2e/auth.spec.ts --headed

# Run with UI mode
npx playwright test --ui
```

## Best Practices Demonstrated

1. **Use data-testid attributes** for reliable selectors
2. **Use helper classes** to avoid code duplication
3. **Mock API responses** for predictable tests
4. **Handle async properly** with await
5. **Verify state changes** after actions
6. **Clean up after tests** in afterEach/afterAll hooks
7. **Use meaningful test names** that describe behavior
8. **Group related tests** with describe blocks
9. **Wait for navigation** with waitForURL
10. **Use expect assertions** to verify results

## Further Reading

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices Guide](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
- [Project E2E Testing Guide](../E2E_TESTING.md)
