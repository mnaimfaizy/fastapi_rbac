import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, mockUser, mockToken } from './test-utils';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import ChangePasswordRequiredPage from '../features/auth/ChangePasswordRequiredPage';
import authService from '../services/auth.service';
import { markPasswordChangeRequired } from '../store/slices/authSlice';

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
        'You signed in with a temporary password. Choose your own before you continue.'
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
      screen.getByLabelText('Temporary password'),
      'TemporaryPass!47'
    );
    await user.type(
      screen.getByLabelText('New password'),
      'ReplacementPassword!42'
    );
    await user.type(
      screen.getByLabelText('Confirm new password'),
      'ReplacementPassword!42'
    );
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));

    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(mockAuthService.changePassword).toHaveBeenCalledWith(
      'TemporaryPass!47',
      'ReplacementPassword!42'
    );
    expect(store.getState().auth.accessToken).toBe('new-access-token');
    expect(store.getState().auth.user?.needs_to_change_password).toBe(false);
    expect(store.getState().auth.isAuthenticated).toBe(true);
  });

  it('stays on the page with the error when the change is refused', async () => {
    mockAuthService.changePassword.mockRejectedValue({
      response: {
        status: 400,
        data: { status: 'error', message: 'Invalid Current Password' },
      },
    });
    const user = userEvent.setup();
    const { store } = renderAt('/change-password-required', flaggedUser);

    await user.type(
      screen.getByLabelText('Temporary password'),
      'WrongPass!47'
    );
    await user.type(
      screen.getByLabelText('New password'),
      'ReplacementPassword!42'
    );
    await user.type(
      screen.getByLabelText('Confirm new password'),
      'ReplacementPassword!42'
    );
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));

    expect(
      await screen.findByText('Invalid Current Password')
    ).toBeInTheDocument();
    expect(screen.queryByText('Dashboard page')).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/change-password-required');
    expect(store.getState().auth.user?.needs_to_change_password).toBe(true);
  });

  it('flags the stored user, and leaves a signed-out store alone', () => {
    const { store } = renderAt('/login', mockUser);
    store.dispatch(markPasswordChangeRequired());
    expect(store.getState().auth.user?.needs_to_change_password).toBe(true);

    const signedOut = renderAt('/login', null).store;
    signedOut.dispatch(markPasswordChangeRequired());
    expect(signedOut.getState().auth.user).toBeNull();
  });

  it('does not send a second change while the first is in flight', async () => {
    let resolveChange: (value: unknown) => void = () => {};
    mockAuthService.changePassword.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveChange = resolve;
        })
    );
    const user = userEvent.setup();
    renderAt('/change-password-required', flaggedUser);

    await user.type(
      screen.getByLabelText('Temporary password'),
      'TemporaryPass!47'
    );
    await user.type(
      screen.getByLabelText('New password'),
      'ReplacementPassword!42'
    );
    await user.type(
      screen.getByLabelText('Confirm new password'),
      'ReplacementPassword!42'
    );
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));

    const button = await screen.findByRole('button', {
      name: 'Save and continue',
    });
    await waitFor(() => expect(button).toBeDisabled());
    fireEvent.submit(button.closest('form')!);

    expect(mockAuthService.changePassword).toHaveBeenCalledTimes(1);
    resolveChange({
      ...mockToken,
      user: { ...flaggedUser, needs_to_change_password: false },
    });
  });

  it('shows each failed policy rule, and a fallback when the refusal has no message', async () => {
    mockAuthService.changePassword.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Password does not meet complexity requirements',
          errors: [
            'Password must contain at least one digit',
            'Password must contain at least one special character from: !@#$%^&*()_+-=[]{}|;:,.<>?',
          ],
        },
      },
    });
    const user = userEvent.setup();
    renderAt('/change-password-required', flaggedUser);

    await user.type(
      screen.getByLabelText('Temporary password'),
      'TemporaryPass!47'
    );
    await user.type(
      screen.getByLabelText('New password'),
      'ReplacementPassword!42'
    );
    await user.type(
      screen.getByLabelText('Confirm new password'),
      'ReplacementPassword!42'
    );
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));

    expect(
      await screen.findByText('Password does not meet complexity requirements')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Password must contain at least one digit')
    ).toBeInTheDocument();
    expect(screen.queryByText('Dashboard page')).not.toBeInTheDocument();

    mockAuthService.changePassword.mockRejectedValueOnce({});
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(
      await screen.findByText('Failed to change password')
    ).toBeInTheDocument();
  });

  it('keeps a mismatched confirmation on the page', async () => {
    const user = userEvent.setup();
    renderAt('/change-password-required', flaggedUser);

    await user.type(
      screen.getByLabelText('Temporary password'),
      'TemporaryPass!47'
    );
    await user.type(
      screen.getByLabelText('New password'),
      'ReplacementPassword!42'
    );
    await user.type(
      screen.getByLabelText('Confirm new password'),
      'ReplacementPassword!43'
    );
    await user.click(screen.getByRole('button', { name: 'Save and continue' }));

    expect(
      await screen.findByText("Passwords don't match")
    ).toBeInTheDocument();
    expect(mockAuthService.changePassword).not.toHaveBeenCalled();
  });

  it('renders nothing while the session is still loading', () => {
    window.history.pushState({}, '', '/change-password-required');
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route
          path="/change-password-required"
          element={<ChangePasswordRequiredPage />}
        />
      </Routes>,
      {
        preloadedState: {
          auth: {
            ...authState(null).auth,
            isLoading: true,
          },
        },
      }
    );

    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Set a new password' })
    ).not.toBeInTheDocument();
  });

  it('offers a logout', async () => {
    mockAuthService.logout.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderAt('/change-password-required', flaggedUser);

    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(mockAuthService.logout).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('Login page')).toBeInTheDocument();
  });
});
