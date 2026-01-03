# E2E Test Suite

This directory contains end-to-end tests for the React frontend application using Playwright.

## Directory Structure

```
e2e/
├── fixtures/
│   └── test-data.ts          # Test data, fixtures, and constants
├── utils/
│   └── helpers.ts            # Helper classes and utilities
├── auth.spec.ts              # Authentication flow tests
├── dashboard.spec.ts         # Dashboard functionality tests
└── protected-routes.spec.ts  # Route protection tests
```

## Test Files

### auth.spec.ts

Tests the complete authentication flow:

- Login page display
- Login form validation
- Successful login with valid credentials
- Failed login with invalid credentials
- Logout functionality
- Authentication persistence across page reloads
- Signup page display
- Navigation between login and signup

### dashboard.spec.ts

Tests dashboard functionality:

- Dashboard page loading
- Dashboard content display
- Navigation to other sections (users, roles, permissions)
- User menu functionality
- Network error handling
- State management within dashboard

### protected-routes.spec.ts

Tests route protection and authorization:

- Redirect to login for unauthenticated access
- Protection of all secured routes (dashboard, users, roles, permissions, profile)
- Public route accessibility (login, signup)
- API endpoint protection
- Authentication state management

## Helper Utilities

### AuthHelper

Authentication-related utilities:

- `login(email, password)` - Login with credentials
- `loginAsAdmin()` - Quick admin login
- `loginAsRegularUser()` - Quick regular user login
- `logout()` - Logout current user
- `verifyAuthenticated()` - Check authentication state
- `verifyNotAuthenticated()` - Verify unauthenticated state

### NavigationHelper

Navigation utilities:

- `goto(route)` - Navigate to a route
- `gotoDashboard()` - Navigate to dashboard
- `gotoUsers()` - Navigate to users page
- `gotoRoles()` - Navigate to roles page
- `verifyRoute(expectedRoute)` - Verify current route

### FormHelper

Form interaction utilities:

- `fillField(label, value)` - Fill form field
- `submit()` - Submit form
- `verifyValidationError(message)` - Check validation errors

### ApiMockHelper

API mocking utilities:

- `mockSuccess(endpoint, data)` - Mock successful response
- `mockError(endpoint, status, message)` - Mock error response
- `mockNetworkFailure(endpoint)` - Mock network failure

### WaitHelper

Advanced waiting utilities:

- `waitForVisible(selector)` - Wait for element visibility
- `waitForHidden(selector)` - Wait for element to hide
- `waitForApiResponse(pattern)` - Wait for API response
- `waitForLoadingComplete()` - Wait for loading indicators

## Test Data

Test data is centralized in `fixtures/test-data.ts`:

### Test Users

- `testUsers.admin` - Admin user credentials
- `testUsers.regularUser` - Regular user credentials
- `testUsers.newUser` - New user for signup tests

### Test Roles

- `testRoles.admin` - Admin role data
- `testRoles.user` - User role data

### Test Permissions

- `testPermissions.userCreate` - User creation permission
- `testPermissions.userRead` - User read permission
- `testPermissions.userUpdate` - User update permission
- `testPermissions.userDelete` - User delete permission

### Routes

All application routes are defined for consistent testing

### Timeouts

Standard timeout values for different operations

## Running Tests

See the main [E2E Testing documentation](../E2E_TESTING.md) for detailed instructions on running and debugging tests.

Quick commands:

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI (recommended)
npm run test:e2e:ui

# Run in debug mode
npm run test:e2e:debug

# Run specific test file
npx playwright test e2e/auth.spec.ts
```

## Writing New Tests

1. **Create a new spec file** in the `e2e/` directory
2. **Import helpers and fixtures** you need
3. **Use the helper classes** for common operations
4. **Follow existing patterns** for consistency
5. **Add test data** to `fixtures/test-data.ts` if needed

### Example Test

```typescript
import { test, expect } from '@playwright/test';
import { AuthHelper, NavigationHelper } from './utils/helpers';
import { testUsers } from './fixtures/test-data';

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    const authHelper = new AuthHelper(page);
    const navHelper = new NavigationHelper(page);

    // Login
    await authHelper.loginAsAdmin();

    // Navigate
    await navHelper.gotoDashboard();

    // Test your feature
    await page.click('[data-testid="my-button"]');
    await expect(page.locator('[data-testid="result"]')).toBeVisible();
  });
});
```

## Best Practices

1. **Use Helper Classes**: Don't repeat login/navigation code
2. **Use Test Data**: Don't hardcode credentials or data
3. **Use Data Attributes**: Prefer `data-testid` over class selectors
4. **Independent Tests**: Each test should work standalone
5. **Clear State**: Clean up before/after tests
6. **Auto-Wait**: Let Playwright handle waiting
7. **Meaningful Names**: Use descriptive test names

## Debugging Tips

1. Use UI mode: `npm run test:e2e:ui`
2. Use headed mode to see browser: `npm run test:e2e:headed`
3. Use debug mode: `npm run test:e2e:debug`
4. Check screenshots in `test-results/` on failure
5. Review Playwright report: `npm run test:e2e:report`

## Contributing

When adding new tests:

1. Follow the existing structure
2. Add helpers for reusable logic
3. Add fixtures for test data
4. Document complex test scenarios
5. Ensure tests are independent
6. Keep tests focused and readable
