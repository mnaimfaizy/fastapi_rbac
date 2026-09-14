import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';

import { ApiErrorAlert } from '../components/auth/ApiErrorAlert';
import ChangePasswordContent from '../components/dashboard/ChangePasswordContent';
import PasswordResetConfirmPage from '../features/auth/PasswordResetConfirmPage';
import { mockUser, renderWithProviders } from './test-utils';

const COMPLEXITY_MESSAGE = 'Password does not meet complexity requirements.';
const RULES = [
  'Password must be at least 12 characters long',
  'Password must contain at least one digit',
];

const authWithComplexityError = {
  user: mockUser,
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  isAuthenticated: true,
  isLoading: false,
  error: { message: COMPLEXITY_MESSAGE, errors: RULES },
  passwordChangeSuccess: false,
  passwordResetRequested: false,
  passwordResetSuccess: false,
};

describe('ApiErrorAlert', () => {
  it('never renders an alert with empty text for an unrecognised shape', () => {
    renderWithProviders(
      <ApiErrorAlert
        error={{ detail: { something: 'else' } }}
        fallbackMessage="Something went wrong. Please try again."
      />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong. Please try again.');
    expect(alert.textContent?.trim()).not.toBe('');
  });

  it('renders the interceptor-normalised complexity body', () => {
    renderWithProviders(
      <ApiErrorAlert
        error={{
          response: {
            data: {
              status: 'error',
              message: COMPLEXITY_MESSAGE,
              errors: RULES.map((message) => ({ message })),
            },
          },
        }}
      />
    );

    expect(screen.getByText(COMPLEXITY_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText(RULES[0])).toBeInTheDocument();
    expect(screen.getByText(RULES[1])).toBeInTheDocument();
  });
});

describe('change-password and reset-confirm complexity errors', () => {
  it('shows the specific complexity errors on the change-password page', () => {
    renderWithProviders(<ChangePasswordContent />, {
      preloadedState: { auth: authWithComplexityError },
    });

    expect(screen.getByText(COMPLEXITY_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText(RULES[0])).toBeInTheDocument();
    expect(screen.getByText(RULES[1])).toBeInTheDocument();
  });

  it('shows the specific complexity errors on the reset-confirm page', () => {
    window.history.pushState(
      {},
      '',
      '/password-reset/confirm?token=test-token'
    );

    renderWithProviders(<PasswordResetConfirmPage />, {
      preloadedState: { auth: authWithComplexityError },
    });

    expect(screen.getByText(COMPLEXITY_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText(RULES[0])).toBeInTheDocument();
    expect(screen.getByText(RULES[1])).toBeInTheDocument();
  });
});
