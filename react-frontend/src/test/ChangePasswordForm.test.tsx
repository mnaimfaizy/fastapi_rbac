import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ProtectedRoute from '../components/auth/ProtectedRoute';
import { ChangePasswordForm } from '../components/auth/ChangePasswordForm';
import authService from '../services/auth.service';
import { mockToken, mockUser, renderWithProviders } from './test-utils';

vi.mock('../services/auth.service');
const mockAuthService = vi.mocked(authService);

const authState = {
  auth: {
    user: mockUser,
    accessToken: 'mock-access-token',
    refreshToken: null,
    isAuthenticated: true,
    isLoading: false,
    error: null,
    passwordChangeSuccess: false,
    passwordResetRequested: false,
    passwordResetSuccess: false,
  },
};

const renderChangePasswordInProtectedRoute = () =>
  renderWithProviders(
    <ProtectedRoute>
      <ChangePasswordForm />
    </ProtectedRoute>,
    { preloadedState: authState }
  );

describe('ChangePasswordForm inside ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the success alert after a fulfilled changePassword without replacing the route with a spinner', async () => {
    let resolveChange!: (value: typeof mockToken) => void;
    const changePromise = new Promise<typeof mockToken>((resolve) => {
      resolveChange = resolve;
    });
    mockAuthService.changePassword.mockReturnValue(changePromise);

    const user = userEvent.setup();
    renderChangePasswordInProtectedRoute();

    await user.type(
      screen.getByLabelText('Current Password'),
      'OldPassword!99'
    );
    await user.type(screen.getByLabelText('New Password'), 'NewPassword!42');
    await user.type(
      screen.getByLabelText('Confirm New Password'),
      'NewPassword!42'
    );
    await user.click(screen.getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Updating...' })
      ).toBeDisabled();
    });
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Password successfully changed!')
    ).not.toBeInTheDocument();

    resolveChange({
      ...mockToken,
      access_token: 'rotated-access-token',
      user: mockUser,
    });

    expect(
      await screen.findByText('Password successfully changed!')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    expect(mockAuthService.changePassword).toHaveBeenCalledWith(
      'OldPassword!99',
      'NewPassword!42'
    );
  });
});
