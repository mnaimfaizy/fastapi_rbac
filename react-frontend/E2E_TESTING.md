# End-to-End Testing with Playwright

This guide covers end-to-end (E2E) testing for the React frontend using Playwright.

## Table of Contents

- [Overview](#overview)
- [Why Playwright?](#why-playwright)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Best Practices](#best-practices)
- [CI/CD Integration](#cicd-integration)
- [Debugging](#debugging)
- [Troubleshooting](#troubleshooting)

## Overview

Playwright is a modern end-to-end testing framework that allows you to test your application in real browsers. It provides:

- Cross-browser support (Chromium, Firefox, WebKit)
- Auto-wait functionality (no manual waits needed)
- Network interception and mocking
- Powerful debugging tools
- Parallel test execution
- Screenshot and video capture
- Mobile emulation

## Why Playwright?

We chose Playwright over alternatives (Cypress, Selenium) for the following reasons:

| Feature               | Playwright     | Cypress     | Selenium   |
| --------------------- | -------------- | ----------- | ---------- |
| Cross-browser support | ✅ Full        | ⚠️ Limited  | ✅ Full    |
| Auto-wait             | ✅ Built-in    | ✅ Built-in | ❌ Manual  |
| Network interception  | ✅ Powerful    | ✅ Good     | ⚠️ Limited |
| Parallel execution    | ✅ Native      | ⚠️ Paid     | ✅ Complex |
| TypeScript support    | ✅ First-class | ✅ Good     | ⚠️ Limited |
| Mobile emulation      | ✅ Built-in    | ⚠️ Limited  | ⚠️ Complex |
| Modern API            | ✅ Modern      | ✅ Modern   | ❌ Legacy  |
| Speed                 | ✅ Fast        | ✅ Fast     | ⚠️ Slower  |

## Installation

Playwright is already installed in this project. If you need to install it manually:

```bash
# Install Playwright
npm install -D @playwright/test

# Install browsers
npx playwright install chromium
```

## Configuration

The Playwright configuration is located in `playwright.config.ts`. Key settings:

```typescript
{
  testDir: './e2e',              // Test directory
  fullyParallel: true,           // Run tests in parallel
  retries: process.env.CI ? 2 : 0, // Retry on CI
  workers: process.env.CI ? 1 : undefined, // Worker threads
  baseURL: 'http://localhost:5173', // App URL
  webServer: {
    command: 'npm run dev',      // Start dev server
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  }
}
```

### Environment Variables

Configure the following in your `.env` file:

```bash
VITE_APP_URL=http://localhost:5173
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## Running Tests

### Basic Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run tests with UI mode (recommended for development)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Debug tests
npm run test:e2e:debug

# View test report
npm run test:e2e:report

# Generate test code (codegen)
npm run test:e2e:codegen
```

### Advanced Commands

```bash
# Run specific test file
npx playwright test e2e/auth.spec.ts

# Run tests matching a pattern
npx playwright test --grep "login"

# Run tests with specific browser
npx playwright test --project=chromium

# Run in debug mode for specific test
npx playwright test auth.spec.ts --debug

# Run with trace
npx playwright test --trace on
```

## Writing Tests

### Test Structure

Tests are organized in the `e2e/` directory:

```
e2e/
├── fixtures/
│   └── test-data.ts       # Test data and fixtures
├── utils/
│   └── helpers.ts         # Helper utilities
├── auth.spec.ts           # Authentication tests
├── dashboard.spec.ts      # Dashboard tests
└── protected-routes.spec.ts # Route protection tests
```

### Example Test

```typescript
import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/helpers';
import { testUsers } from './fixtures/test-data';

test.describe('Login Flow', () => {
  test('should login successfully', async ({ page }) => {
    const authHelper = new AuthHelper(page);

    await page.goto('/login');
    await authHelper.login(testUsers.admin.email, testUsers.admin.password);

    // Verify redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
```

### Helper Utilities

The project provides helper classes for common operations:

- **AuthHelper**: Authentication-related actions (login, logout, verify auth state)
- **NavigationHelper**: Navigation utilities (goto routes, verify URLs)
- **FormHelper**: Form interaction utilities (fill fields, submit)
- **ApiMockHelper**: API mocking and interception
- **WaitHelper**: Advanced waiting strategies

### Using Helpers

```typescript
import { AuthHelper, NavigationHelper, WaitHelper } from './utils/helpers';

test('example test', async ({ page }) => {
  const authHelper = new AuthHelper(page);
  const navHelper = new NavigationHelper(page);
  const waitHelper = new WaitHelper(page);

  // Login
  await authHelper.loginAsAdmin();

  // Navigate
  await navHelper.gotoDashboard();

  // Wait for loading
  await waitHelper.waitForLoadingComplete();
});
```

## Best Practices

### 1. Use Data Attributes for Selectors

Prefer `data-testid` attributes over class names or text:

```typescript
// Good
await page.click('[data-testid="user-menu"]');

// Avoid
await page.click('.user-menu-class');
```

### 2. Use Auto-Wait

Playwright automatically waits for elements. Avoid manual waits:

```typescript
// Good
await page.click('button');

// Avoid
await page.waitForTimeout(1000);
await page.click('button');
```

### 3. Use Page Object Model (POM)

For complex pages, create page objects:

```typescript
class LoginPage {
  constructor(private page: Page) {}

  async login(email: string, password: string) {
    await this.page.fill('[data-testid="email"]', email);
    await this.page.fill('[data-testid="password"]', password);
    await this.page.click('[data-testid="login-button"]');
  }
}
```

### 4. Isolate Tests

Each test should be independent:

```typescript
test.beforeEach(async ({ page }) => {
  // Clear state
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
});
```

### 5. Use Fixtures for Test Data

Keep test data in fixtures:

```typescript
// fixtures/test-data.ts
export const testUsers = {
  admin: { email: 'admin@example.com', password: 'password' },
};

// In tests
import { testUsers } from './fixtures/test-data';
await login(testUsers.admin.email, testUsers.admin.password);
```

### 6. Handle Async Properly

Always await async operations:

```typescript
// Good
await page.click('button');
await expect(page).toHaveURL('/dashboard');

// Bad
page.click('button'); // Missing await
```

### 7. Use Screenshots for Debugging

Capture screenshots on failure:

```typescript
test('example', async ({ page }, testInfo) => {
  try {
    // Test code
  } catch (error) {
    await page.screenshot({
      path: `screenshots/${testInfo.title}.png`,
    });
    throw error;
  }
});
```

## CI/CD Integration

### GitHub Actions

Add Playwright tests to your CI workflow:

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci
        working-directory: ./react-frontend

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
        working-directory: ./react-frontend

      - name: Run E2E tests
        run: npm run test:e2e
        working-directory: ./react-frontend

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: react-frontend/playwright-report/
          retention-days: 30
```

## Debugging

### 1. UI Mode (Recommended)

The best way to debug tests:

```bash
npm run test:e2e:ui
```

Features:

- Watch mode with time travel
- DOM snapshots
- Network logs
- Console logs
- Step-by-step execution

### 2. Debug Mode

Run tests with the Playwright Inspector:

```bash
npm run test:e2e:debug
```

### 3. Headed Mode

See the browser while tests run:

```bash
npm run test:e2e:headed
```

### 4. VS Code Debugging

Install the [Playwright VS Code extension](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright):

1. Install the extension
2. Set breakpoints in your test
3. Click "Debug Test" in the gutter

### 5. Trace Viewer

View traces after test execution:

```bash
# Run with trace
npx playwright test --trace on

# View trace
npx playwright show-trace trace.zip
```

### 6. Screenshots and Videos

Automatically captured on failure (configured in `playwright.config.ts`):

```typescript
use: {
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
}
```

## Troubleshooting

### Common Issues

#### 1. Tests Timeout

**Problem**: Tests fail with timeout errors.

**Solutions**:

- Increase timeout in config: `timeout: 60000`
- Check if dev server is running
- Verify network connectivity
- Check for infinite loading states

#### 2. Selector Not Found

**Problem**: Element selector doesn't find elements.

**Solutions**:

- Use `page.locator()` instead of deprecated methods
- Check if element is in an iframe
- Wait for element to be visible
- Use more specific selectors

#### 3. Flaky Tests

**Problem**: Tests pass sometimes, fail other times.

**Solutions**:

- Remove manual waits (`waitForTimeout`)
- Use built-in auto-wait
- Check for race conditions
- Isolate test state properly

#### 4. Authentication Issues

**Problem**: Tests fail on protected routes.

**Solutions**:

- Ensure login flow works correctly
- Check token storage
- Verify API endpoints
- Use auth fixtures

#### 5. Dev Server Not Starting

**Problem**: Playwright can't connect to dev server.

**Solutions**:

- Check if port 5173 is available
- Verify `webServer` config
- Start dev server manually: `npm run dev`
- Check for port conflicts

### Debug Checklist

When tests fail:

1. ✅ Run in UI mode: `npm run test:e2e:ui`
2. ✅ Run in headed mode: `npm run test:e2e:headed`
3. ✅ Check screenshots in `test-results/`
4. ✅ Review console logs
5. ✅ Verify selectors with Playwright Inspector
6. ✅ Check network requests
7. ✅ Ensure dev server is running
8. ✅ Clear browser state between tests

## VS Code Integration

### Recommended Extensions

Add to `.vscode/extensions.json`:

```json
{
  "recommendations": ["ms-playwright.playwright"]
}
```

### Extension Features

- Run tests from editor
- Debug tests with breakpoints
- View test results inline
- Record tests with codegen
- View trace files

### Usage

1. Install the extension
2. Open a test file
3. Click the green triangle next to a test
4. Or use Command Palette: "Playwright: Run Test"

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright)

## Next Steps

1. **Add More Tests**: Expand coverage to all critical user flows
2. **Implement POM**: Create page objects for complex pages
3. **Visual Testing**: Add visual regression testing
4. **Performance Testing**: Add performance metrics collection
5. **Accessibility Testing**: Integrate accessibility checks
6. **API Testing**: Add API-level tests alongside E2E tests

## Getting Help

If you encounter issues:

1. Check this documentation first
2. Review Playwright's official docs
3. Search existing issues in the project
4. Ask the team for help
5. Create a detailed issue with:
   - Test code
   - Error message
   - Screenshots/videos
   - Steps to reproduce
