import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, mockUser, mockToken } from './test-utils';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import ChangePasswordRequiredPage from '../features/auth/ChangePasswordRequiredPage';
import authService from '../services/auth.service';

// A temporary password restricts the account until it is replaced (#273,
// ADR 0014). The API refuses every other route; the SPA sends the user to one
// page that can change the password or log out.

vi.mock('../services/auth.service');
const mockAuthService = vi.mocked(authService);

const flaggedUser = { ...mockUser, needs_to_change_password: true };

const authState = (user: typeof mockUser | null) => ({
  auth: {
    user,
    accessToken: user ? 'mock-access-token' : null,
    refreshToken: null,
    isAuthenticated: user !== null,
    isLoading: false,
    error: null,
    passwordChangeSuccess: false,
    passwordResetRequested: false,
    passwordResetSuccess: false,
  },
});

const renderAt = (path: string, user: typeof mockUser | null) => {
  window.history.pushState({}, '', path);
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<div>Login page</div>} />
      <Route
        path="/change-password-required"
        element={<ChangePasswordRequiredPage />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <div>Dashboard page</div>
          </ProtectedRoute>
        }
      />
    </Routes>,
    { preloadedState: authState(user) }
  );
};

describe('Temporary password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends a flagged user from a protected route to the change-password-required page', async () => {
    renderAt('/dashboard', flaggedUser);

    expect(
      await screen.findByText(
        'An administrator set a temporary password for your account. Choose a new password to continue.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('Dashboard page')).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/change-password-required');
  });

  it('sends an unflagged user away from the change-password-required page', async () => {
    renderAt('/change-password-required', mockUser);

    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard');
  });

  it('sends an unauthenticated visitor to login', async () => {
    renderAt('/change-password-required', null);

    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });

  it('goes to the dashboard after a successful change, without logging in again', async () => {
    mockAuthService.changePassword.mockResolvedValue({
      ...mockToken,
      access_token: 'new-access-token',
      user: { ...flaggedUser, needs_to_change_password: false },
    });
    const user = userEvent.setup();
    const { store } = renderAt('/change-password-required', flaggedUser);

    await user.type(
      screen.getByLabelText('Current Password'),
      'TemporaryPass!47'
    );
    await user.type(
      screen.getByLabelText('New Password'),
      'ReplacementPassword!42'
    );
    await user.type(
      screen.getByLabelText('Confirm New Password'),
      'ReplacementPassword!42'
    );
    await user.click(screen.getByRole('button', { name: 'Change Password' }));

    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(mockAuthService.changePassword).toHaveBeenCalledWith(
      'TemporaryPass!47',
      'ReplacementPassword!42'
    );
    expect(store.getState().auth.accessToken).toBe('new-access-token');
    expect(store.getState().auth.user?.needs_to_change_password).toBe(false);
    expect(store.getState().auth.isAuthenticated).toBe(true);
  });

  it('offers a logout', async () => {
    mockAuthService.logout.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderAt('/change-password-required', flaggedUser);

    await user.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => {
      expect(mockAuthService.logout).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });
});
