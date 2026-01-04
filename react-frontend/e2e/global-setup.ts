/**
 * Global setup for Playwright E2E tests
 * This file runs once before all tests to verify the environment is ready
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL || 'http://localhost:5173';
  const apiBaseURL =
    process.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

  console.log('\n🔍 Verifying E2E test environment...\n');

  // Check frontend
  console.log(`Checking frontend at ${baseURL}...`);
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    const response = await page.goto(baseURL, {
      timeout: 10000,
      waitUntil: 'domcontentloaded',
    });

    if (!response || !response.ok()) {
      throw new Error(
        `Frontend is not accessible at ${baseURL}. Please start the development server with 'npm run dev'`
      );
    }
    console.log('✓ Frontend is accessible\n');
  } catch (error) {
    console.error('✗ Frontend check failed:', error);
    await browser.close();
    throw error;
  } finally {
    await browser.close();
  }

  // Check backend API
  const healthURL = apiBaseURL.replace('/api/v1', '') + '/api/v1/health';
  console.log(`Checking backend at ${apiBaseURL}...`);
  try {
    const response = await fetch(healthURL);

    if (!response.ok) {
      throw new Error(`Backend returned status ${response.status}`);
    }

    const data = await response.json();
    if (data.status !== 'healthy') {
      throw new Error(`Backend health check failed: ${JSON.stringify(data)}`);
    }

    console.log('✓ Backend is healthy\n');
  } catch (error) {
    console.error('✗ Backend check failed:', error);
    console.error('\n⚠️  BACKEND IS NOT RUNNING!\n');
    console.error('E2E tests require the FastAPI backend to be running.');
    console.error('\nPlease start the backend before running E2E tests:\n');
    console.error('  cd backend');
    console.error(
      '  docker-compose -f docker-compose.dev.yml up -d  # OR'
    );
    console.error(
      '  python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000\n'
    );
    console.error('Then verify it is running:');
    console.error(`  curl ${healthURL}\n`);
    throw new Error('Backend is not running. See instructions above.');
  }

  // Verify test user exists
  console.log('Checking test user credentials...');
  try {
    const loginURL = apiBaseURL + '/auth/login';
    const response = await fetch(loginURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'AdminPass123!',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Login failed: ${errorData.message || response.statusText}`
      );
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error('Login response missing access_token');
    }

    console.log('✓ Test admin user is valid\n');
  } catch (error) {
    console.error('✗ Test user validation failed:', error);
    console.error('\n⚠️  TEST USER NOT FOUND!\n');
    console.error(
      'The test admin user (admin@example.com) does not exist or has wrong password.'
    );
    console.error('\nPlease initialize the backend database:\n');
    console.error('  cd backend');
    console.error('  python app/initial_data.py\n');
    throw new Error('Test user not available. See instructions above.');
  }

  console.log('✅ E2E environment is ready!\n');
}

export default globalSetup;
