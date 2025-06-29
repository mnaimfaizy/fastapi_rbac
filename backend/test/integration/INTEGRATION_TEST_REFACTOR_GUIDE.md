# Integration Test Refactor Guide for FastAPI RBAC

This guide outlines the step-by-step process for refactoring and aligning integration tests to be fully API-driven, robust, and consistent with backend business rules. Use this as a template for updating any integration test file in this project.

---

## 1. Eliminate Direct DB/Factory Usage

- Remove all direct database or factory calls from the test.
- All test data (users, roles, permissions, etc.) must be created via API endpoints, not by inserting directly into the DB or using test factories.

## 2. Centralize Authentication and CSRF Handling

- Implement helper methods for admin login and CSRF token retrieval.
- Always fetch and include a fresh CSRF token for each API call that requires it.
- Use the correct headers for authentication and CSRF protection.

## 3. Use Only API-Driven User Flows

- For user creation, use the `/auth/register` endpoint.
- After registration, extract the verification code from the API response (in test mode).
- Call `/auth/verify-email` with the verification code to verify the user before login.
- If the backend requires a password change after verification (`needs_to_change_password`), perform a login and then call `/auth/change_password` with the correct payload and a new, policy-compliant password.

## 4. Align Test Assertions with Backend Response Contract

- Assert on the `"data"` key in API responses, not `"success"` or other keys, unless the backend contract specifies otherwise.
- Check for correct status codes (e.g., 201 for creation, 200 for success, 403 for forbidden, 409 for conflict, 404 for not found).
- For business rule violations (e.g., deleting a group with permissions), expect 409 Conflict and check the error message.

## 5. Match Backend Naming and Formatting

- When asserting on names (e.g., permission names), use the backend’s formatting logic (e.g., `"{group_name}.permission_name"`).
- Do not hardcode names; build them dynamically based on the API response.

## 6. Handle Password Policy and Business Rules

- Ensure all passwords used in tests meet the backend’s password policy (length, complexity, no sequential chars, etc.).
- If the backend expects `"current_password"` instead of `"old_password"` in the change password payload, update the test accordingly.
- After a password change, update the test’s in-memory password variable for subsequent logins.

## 7. Test Role-Based and Permission-Based Access

- After registering and verifying a regular user, log in and attempt to access protected endpoints.
- Assert that regular users receive 403 Forbidden for endpoints they should not access (e.g., listing or creating permissions).
- Assert that admin users can access all relevant endpoints.

## 8. Debug and Print for Diagnosis (Remove for Final Version)

- During debugging, print API responses and user states after key actions (registration, verification, password change, login).
- Once the test is stable and passing, remove or comment out debug print statements.

## 9. Update for Backend Contract Changes

- If the backend changes its contract (e.g., response structure, required fields), update the test to match.
- Always use the latest backend idioms (e.g., SQLModel `.exec()` for async DB access).

## 10. Generalize for Reuse

- Use unique values (e.g., emails) for each test run to avoid conflicts.
- Use helper functions for repeated actions (login, CSRF, registration, etc.).

## 11. Assigning Admin Role to Test Users (Extra Step for Admin-Privileged Tests)

**Background:**

- The `/auth/register` endpoint always creates a regular user (not an admin).
- Many integration tests require a user with admin privileges to access protected endpoints (e.g., role/permission management).

**Required Extra Step:**

- After registering and verifying a test user, you must use the seeded admin account (e.g., `admin@example.com` / `AdminTest123!`) to assign the admin role to your test user via the API.
- This is done by:
  1. Logging in as the seeded admin.
  2. Fetching the test user's ID via `/users?email=...`.
  3. Fetching the admin role ID via `/roles?search=admin`.
  4. Assigning the admin role to the test user using `/users/{user_id}/roles`.
- Only after this step should you log in as the test user and proceed with admin-only actions in your test.

**Example Helper Function:**

```python
async def promote_user_to_admin(client: AsyncClient, user_email: str):
    seed_admin_email = "admin@example.com"
    seed_admin_password = "AdminTest123!"
    seed_admin_token = await login_user(client, seed_admin_email, seed_admin_password)
    seed_admin_headers = {"Authorization": f"Bearer {seed_admin_token}"}
    # Get user id
    response = await client.get(f"/api/v1/users?email={user_email}", headers=seed_admin_headers)
    user_id = response.json()["data"]["items"][0]["id"]
    # Get admin role id
    response = await client.get(f"/api/v1/roles?search=admin", headers=seed_admin_headers)
    admin_role_id = next(r["id"] for r in response.json()["data"]["items"] if r["name"].lower() == "admin")
    # Assign admin role
    csrf_token, headers = await get_csrf_token(client)
    headers.update(seed_admin_headers)
    role_assignment_data = {"user_id": user_id, "role_ids": [admin_role_id]}
    response = await client.post(f"/api/v1/users/{user_id}/roles", json=role_assignment_data, headers=headers)
    assert response.status_code == 200
```

**When to Use:**

- Any time your test user needs admin privileges for the test scenario.
- This step is required for all admin-privileged integration tests to pass in a fully API-driven test suite.

---

### Example: User Registration and Verification Flow

```python
# Register user via API
response = await client.post("/auth/register", json=user_data, headers=headers)
assert response.status_code == 201
verification_code = response.json()["data"].get("verification_code")

# Verify user via API
verify_payload = {"token": verification_code}
response = await client.post("/auth/verify-email", json=verify_payload, headers=headers)
assert response.status_code == 200

# If password change required, perform login and change password as shown in the test
```

---

### Checklist for Each Integration Test

- [ ] No direct DB/factory usage; all data created via API.
- [ ] All user flows (register, verify, login, change password) use API endpoints.
- [ ] All API calls include correct CSRF and auth headers.
- [ ] All assertions match backend response contract and status codes.
- [ ] All business rules and password policies are respected.
- [ ] All debug printouts are removed from the final version.

---

**By following these steps, any integration test can be made robust, maintainable, and fully aligned with your backend contract and business rules.**
