# E2E Tests Quick Start Guide

## TL;DR - Just Want to Run Tests?

```bash
# 1. Start the backend (in separate terminal or background)
cd backend
docker-compose -f docker-compose.dev.yml up -d

# 2. Verify backend is running
curl http://localhost:8000/api/v1/health
# Should return: {"status": "healthy"}

# 3. Go back to frontend directory
cd ../react-frontend

# 4. Run the environment check script (optional but recommended)
./scripts/start-e2e-env.sh

# 5. Run E2E tests
npm run test:e2e:ui  # Recommended for development (interactive UI)
# OR
npm run test:e2e     # Run all tests headless
```

## What You Need Before Running Tests

### 1. Backend Must Be Running ✅

The E2E tests make real API calls to the FastAPI backend. Without it, all auth tests will fail!

**Choose one method to start the backend:**

#### Option A: Docker (Recommended)

```bash
cd backend
docker-compose -f docker-compose.dev.yml up -d
```

#### Option B: Direct Python

```bash
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Verify it's running:**

```bash
curl http://localhost:8000/api/v1/health
# Expected response: {"status":"healthy"}
```

### 2. Test Users Must Exist ✅

The tests use these credentials:

- **Admin user:** `admin@example.com` / `AdminPass123!`
- **Regular user:** `user@example.com` / `UserPass123!`

These are created automatically when the backend initializes. If authentication fails:

```bash
cd backend
python app/initial_data.py
```

### 3. Frontend Dev Server ✅

Playwright automatically starts the frontend dev server, so you don't need to start it manually.

## Troubleshooting

### "Login Failed" or Timeout Errors

**Problem:** Tests timeout waiting for dashboard redirect after login.

**Solution:** The backend isn't running or test users don't exist.

```bash
# Check backend health
curl http://localhost:8000/api/v1/health

# If it fails, start the backend
cd backend
docker-compose -f docker-compose.dev.yml up -d

# Test login manually
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "AdminPass123!"}'

# If login fails, initialize test data
python app/initial_data.py
```

### "Backend is not running" Error

**Problem:** Playwright's global setup detects backend is not accessible.

**Solution:**

1. Start the backend first (see above)
2. Verify health endpoint responds
3. Run tests again

### CORS Errors

**Problem:** Browser shows CORS errors in console.

**Solution:** Make sure backend CORS settings allow `http://localhost:5173`:

```python
# In backend/app/core/config.py
BACKEND_CORS_ORIGINS = ["http://localhost:5173", "http://localhost:3000"]
```

### Port Conflicts

**Problem:** Backend won't start - port 8000 is in use.

**Solution:**

```bash
# Find what's using port 8000
lsof -i :8000

# Kill the process or use a different port
# If using different port, update .env:
# VITE_API_BASE_URL=http://localhost:YOUR_PORT/api/v1
```

### Database Not Initialized

**Problem:** Login fails with "User not found" or similar errors.

**Solution:**

```bash
cd backend

# Make sure database is running (if using Docker)
docker-compose -f docker-compose.dev.yml up -d db

# Initialize database
python app/initial_data.py

# Or run Alembic migrations
alembic upgrade head
```

## Test Execution Modes

### UI Mode (Recommended for Development)

```bash
npm run test:e2e:ui
```

- Interactive UI
- See tests as they run
- Time-travel debugging
- Easy re-runs

### Headed Mode (See the Browser)

```bash
npm run test:e2e:headed
```

- See browser window
- Watch tests execute
- Useful for debugging visual issues

### Debug Mode (Step Through Tests)

```bash
npm run test:e2e:debug
```

- Pause at each step
- Inspect elements
- Use browser DevTools

### Headless Mode (CI/Production)

```bash
npm run test:e2e
```

- No browser UI
- Fastest execution
- Best for CI/CD

## Quick Environment Check

Use the provided script to verify everything is ready:

```bash
./scripts/start-e2e-env.sh
```

This script checks:

- ✅ Backend is running
- ✅ Backend health endpoint responds
- ✅ Test admin user can login
- ✅ Environment is ready for tests

## Common Test Commands

```bash
# Run all tests
npm run test:e2e

# Run specific test file
npx playwright test e2e/auth.spec.ts

# Run tests matching a pattern
npx playwright test --grep "login"

# Run with specific browser
npx playwright test --project=chromium

# View test report
npm run test:e2e:report

# Generate test code (codegen)
npm run test:e2e:codegen
```

## Next Steps

- Read the [full E2E Testing documentation](../E2E_TESTING.md)
- Check [EXAMPLES.md](./EXAMPLES.md) for test patterns
- See [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for Playwright API
- Review existing test files for examples

## Still Having Issues?

1. Make sure you followed ALL prerequisites above
2. Check the backend logs: `docker-compose logs -f backend`
3. Run the environment check: `./scripts/start-e2e-env.sh`
4. Try the manual verification steps above
5. Check the [Troubleshooting guide](../E2E_TESTING.md#troubleshooting) in main docs

## Architecture Note

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────┐
│   Playwright    │────────>│   Frontend   │────────>│   Backend   │
│   (Browser)     │         │ (React/Vite) │         │  (FastAPI)  │
└─────────────────┘         └──────────────┘         └─────────────┘
                                                             │
                                                             ▼
                                                      ┌─────────────┐
                                                      │  Database   │
                                                      │ (PostgreSQL)│
                                                      └─────────────┘
```

E2E tests run in a real browser, interact with the real frontend, which makes real API calls to the real backend, which queries the real database. This is why all components must be running!
