# Playwright E2E Testing - Quick Reference

One-page quick reference for Playwright E2E testing in this project.

## Installation

```bash
cd react-frontend
npm install
npx playwright install chromium
```

## Running Tests

| Command                    | Description                               |
| -------------------------- | ----------------------------------------- |
| `npm run test:e2e`         | Run all E2E tests (headless)              |
| `npm run test:e2e:ui`      | Run with UI mode (⭐ recommended for dev) |
| `npm run test:e2e:headed`  | Run with visible browser                  |
| `npm run test:e2e:debug`   | Debug tests with inspector                |
| `npm run test:e2e:report`  | View HTML report                          |
| `npm run test:e2e:codegen` | Generate test code                        |

## Quick Examples

### Basic Test

```typescript
import { test, expect } from '@playwright/test';

test('should display page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
});
```

### With Authentication

```typescript
import { AuthHelper } from './utils/helpers';

test('should access protected page', async ({ page }) => {
  const auth = new AuthHelper(page);
  await auth.loginAsAdmin();
  await page.goto('/users');
  await expect(page).toHaveURL(/\/users/);
});
```

### Form Testing

```typescript
test('should submit form', async ({ page }) => {
  await page.fill('[data-testid="email"]', 'test@example.com');
  await page.fill('[data-testid="password"]', 'password');
  await page.click('[data-testid="submit"]');
  await expect(page).toHaveURL(/\/dashboard/);
});
```

## Helper Classes

| Helper             | Purpose        | Key Methods                                          |
| ------------------ | -------------- | ---------------------------------------------------- |
| `AuthHelper`       | Authentication | `login()`, `logout()`, `loginAsAdmin()`              |
| `NavigationHelper` | Navigation     | `goto()`, `gotoDashboard()`, `verifyRoute()`         |
| `FormHelper`       | Forms          | `fillField()`, `submit()`, `verifyValidationError()` |
| `ApiMockHelper`    | API Mocking    | `mockSuccess()`, `mockError()`                       |
| `WaitHelper`       | Waiting        | `waitForVisible()`, `waitForLoadingComplete()`       |

## Test Data

Access test data from `fixtures/test-data.ts`:

```typescript
import { testUsers, routes } from './fixtures/test-data';

// Use predefined test users
await login(testUsers.admin.email, testUsers.admin.password);

// Use predefined routes
await page.goto(routes.dashboard);
```

## Common Patterns

### Wait for Navigation

```typescript
await page.click('button');
await page.waitForURL('**/dashboard**');
```

### Check Visibility

```typescript
await expect(page.locator('[data-testid="element"]')).toBeVisible();
```

### Fill Form

```typescript
await page.fill('input[name="email"]', 'user@example.com');
```

### Click Button

```typescript
await page.click('button[type="submit"]');
```

### Mock API

```typescript
await page.route('**/api/v1/users**', (route) => {
  route.fulfill({ status: 200, body: JSON.stringify({ data: [] }) });
});
```

## Debugging

| Tool        | When to Use                                    |
| ----------- | ---------------------------------------------- |
| UI Mode     | Interactive development, time travel debugging |
| Headed Mode | Visual verification of test behavior           |
| Debug Mode  | Step-through debugging with breakpoints        |
| Screenshots | Visual comparison and failure analysis         |
| Traces      | Deep dive into test execution                  |

## Selectors

### Priority Order

1. `data-testid` - Most reliable
2. `role` - Semantic and accessible
3. `text` - User-facing and readable
4. `id` - If stable
5. `class` - Last resort (fragile)

### Examples

```typescript
// Best - data-testid
page.locator('[data-testid="login-button"]');

// Good - role
page.locator('button', { hasText: 'Login' });

// OK - text
page.locator('text=Login');

// Avoid - class
page.locator('.btn-primary');
```

## File Structure

```
e2e/
├── fixtures/test-data.ts     # Test data
├── utils/helpers.ts           # Helper classes
├── auth.spec.ts              # Auth tests
├── dashboard.spec.ts         # Dashboard tests
└── protected-routes.spec.ts  # Route tests
```

## Environment Variables

Required in `.env`:

```bash
VITE_APP_URL=http://localhost:5173
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## CI/CD

Tests run automatically on:

- Push to `main`
- Pull requests to `main`
- Manual workflow dispatch

## Assertions

| Assertion         | Usage                |
| ----------------- | -------------------- |
| `toBeVisible()`   | Element is visible   |
| `toBeHidden()`    | Element is hidden    |
| `toHaveURL()`     | URL matches pattern  |
| `toHaveText()`    | Text content matches |
| `toContainText()` | Text contains string |
| `toBeEnabled()`   | Element is enabled   |
| `toBeDisabled()`  | Element is disabled  |
| `toHaveCount()`   | Number of elements   |

## Troubleshooting

| Issue                  | Solution                                     |
| ---------------------- | -------------------------------------------- |
| Timeout                | Increase timeout or use proper wait          |
| Selector not found     | Check element exists and selector is correct |
| Flaky test             | Remove manual waits, use auto-wait           |
| Authentication fails   | Check credentials and backend is running     |
| Dev server won't start | Check port 5173 is available                 |

## Performance Tips

1. Run tests in parallel (default)
2. Use `--project=chromium` for single browser
3. Use `--workers=2` to limit parallelization
4. Skip long-running tests during development
5. Use `.only` to run specific tests

## Best Practices

✅ **DO**

- Use data-testid attributes
- Use helper classes
- Keep tests independent
- Use meaningful test names
- Clean up after tests
- Use auto-wait

❌ **DON'T**

- Use manual waits (`waitForTimeout`)
- Use fragile selectors (classes)
- Share state between tests
- Hardcode test data
- Skip error handling
- Test internal implementation

## Quick Links

- [Full Documentation](../E2E_TESTING.md)
- [Examples](./EXAMPLES.md)
- [Framework Comparison](../../docs/development/E2E_FRAMEWORK_COMPARISON.md)
- [Setup Summary](../../docs/development/PLAYWRIGHT_SETUP_SUMMARY.md)
- [Playwright Docs](https://playwright.dev/)

## Stats

- **Total Tests**: 31
- **Test Files**: 3
- **Helper Classes**: 5
- **Browsers**: Chromium (default), Firefox, WebKit (available)
- **Execution Time**: ~2-3 minutes

---

**💡 Tip**: Use `npm run test:e2e:ui` for the best development experience!
