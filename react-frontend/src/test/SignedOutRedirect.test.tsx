import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { queryShellSidebar, renderAppAt } from './system-states-test-utils';

vi.mock('../services/auth.service');
vi.mock('../services/dashboard.service');

describe('Signed-out visitors to protected routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it.each([
    '/dashboard',
    '/dashboard/users',
    '/dashboard/roles/edit/7',
    '/dashboard/account/security',
    '/unauthorized',
  ])('are sent from %s to Sign in', async (path) => {
    renderAppAt(path, null);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login');
    });
    expect(
      await screen.findByRole('button', { name: 'Sign in' })
    ).toBeInTheDocument();
    expect(queryShellSidebar()).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Page not found' })
    ).not.toBeInTheDocument();
  });
});
