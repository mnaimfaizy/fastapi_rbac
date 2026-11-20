import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, mockToken, mockUser } from './test-utils';
import LoginPage from '../features/auth/LoginPage';
import SignupPage from '../features/auth/SignupPage';
import { RegistrationSuccessPage } from '../features/auth/RegistrationSuccessPage';
import PasswordResetRequestPage from '../features/auth/PasswordResetRequestPage';
import PasswordResetConfirmPage from '../features/auth/PasswordResetConfirmPage';
import authService from '../services/auth.service';
import { SIGNED_OUT_EVERYWHERE_NOTICE } from '../features/auth/notices';

vi.mock('../services/auth.service');
const mockAuthService = vi.mocked(authService);

beforeEach(() => {
  mockAuthService.login.mockReset();
  mockAuthService.register.mockReset();
  mockAuthService.requestPasswordReset.mockReset();
  mockAuthService.confirmPasswordReset.mockReset();
});

vi.mock('../lib/tokenStorage', () => ({
  setStoredAccessToken: vi.fn(),
  setAuthSessionHint: vi.fn(),
  hasAuthSessionHint: vi.fn(() => false),
  clearAuthSessionHint: vi.fn(),
  getStoredAccessToken: vi.fn(() => null),
  clearAuthTokens: vi.fn(),
}));

vi.mock('../services/authTokenManager', () => ({
  default: {
    setupTokenExpiryTimer: vi.fn(),
    clearExpiryTimer: vi.fn(),
    decodeJWT: vi.fn(),
  },
}));

const VALID_PASSWORD = 'QaRegisterPass!47';

const signedOutAuth = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  passwordChangeSuccess: false,
  passwordResetRequested: false,
  passwordResetSuccess: false,
};

const authFor = (
  patch: Partial<typeof signedOutAuth> & { user?: typeof mockUser | null }
) => ({
  auth: {
    ...signedOutAuth,
    ...patch,
  },
});

function tokenFor(email: string) {
  const payload = btoa(JSON.stringify({ sub: email }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `e30.${payload}.sig`;
}

function historyState(state: unknown, path: string) {
  window.history.pushState({ usr: state, key: 'edge', idx: 0 }, '', path);
}

describe('Login page edges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/login');
  });

  it('shows the signed-out-everywhere notice from location state', () => {
    historyState({ notice: SIGNED_OUT_EVERYWHERE_NOTICE }, '/login');
    renderWithProviders(<LoginPage />, { preloadedState: authFor({}) });

    expect(
      screen.getByText('You’ve been signed out everywhere.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Sign in again on any device you still use.')
    ).toBeInTheDocument();
  });

  it('ignores a location notice that is not signed-out-everywhere', () => {
    historyState({ notice: 'something-else' }, '/login');
    renderWithProviders(<LoginPage />, { preloadedState: authFor({}) });

    expect(
      screen.queryByText('You’ve been signed out everywhere.')
    ).not.toBeInTheDocument();
  });

  it('shows field errors and does not submit an invalid form', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { preloadedState: authFor({}) });

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText('Enter a valid email address')
    ).toBeInTheDocument();
    expect(screen.getByText('Password cannot be empty')).toBeInTheDocument();
    expect(mockAuthService.login).not.toHaveBeenCalled();
  });

  it('does not send a second sign-in while the first is in flight', async () => {
    let resolveLogin: (value: typeof mockToken) => void = () => {};
    mockAuthService.login.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        })
    );
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { preloadedState: authFor({}) });

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), VALID_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    const button = await screen.findByRole('button', { name: 'Sign in' });
    await waitFor(() => expect(button).toBeDisabled());

    fireEvent.submit(button.closest('form')!);

    expect(mockAuthService.login).toHaveBeenCalledTimes(1);
    resolveLogin(mockToken);
  });

  it('shows a stored object error by its message', () => {
    renderWithProviders(<LoginPage />, {
      preloadedState: authFor({ error: { message: 'Inactive user' } as never }),
    });

    expect(screen.getByText('Inactive user')).toBeInTheDocument();
  });
});

describe('Signup page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/register');
  });

  async function fillAccount(
    user: ReturnType<typeof userEvent.setup>,
    confirm = VALID_PASSWORD
  ) {
    await user.type(screen.getByLabelText('Full name'), 'Ada Lovelace');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.type(screen.getByLabelText('Password'), VALID_PASSWORD);
    await user.type(screen.getByLabelText('Confirm password'), confirm);
  }

  it('registers and redirects to the success page', async () => {
    mockAuthService.register.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/register" element={<SignupPage />} />
        <Route
          path="/registration-success"
          element={<RegistrationSuccessPage />}
        />
      </Routes>,
      { preloadedState: authFor({}) }
    );

    await fillAccount(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByRole('heading', { name: 'Check your email' })
    ).toBeInTheDocument();
    expect(mockAuthService.register).toHaveBeenCalledWith({
      email: 'ada@example.com',
      password: VALID_PASSWORD,
      first_name: 'Ada',
      last_name: 'Lovelace',
      full_name: 'Ada Lovelace',
    });
  });

  it('sends an authenticated visitor to the dashboard', async () => {
    window.history.pushState({}, '', '/register');
    renderWithProviders(
      <Routes>
        <Route path="/register" element={<SignupPage />} />
        <Route path="/dashboard" element={<div>Dashboard page</div>} />
      </Routes>,
      {
        preloadedState: authFor({
          user: mockUser,
          accessToken: 'mock-access-token',
          isAuthenticated: true,
        }),
      }
    );

    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
  });

  it('refuses a password that does not match, and one the API would reject', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />, { preloadedState: authFor({}) });

    await fillAccount(user, 'QaRegisterPass!48');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText("Passwords don't match")
    ).toBeInTheDocument();
    expect(mockAuthService.register).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Password'));
    await user.clear(screen.getByLabelText('Confirm password'));
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.type(screen.getByLabelText('Confirm password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText(/must be at least 12 characters long/i)
    ).toBeInTheDocument();
    expect(mockAuthService.register).not.toHaveBeenCalled();
  });

  it('maps API field errors onto the form and hides the general notice', async () => {
    mockAuthService.register.mockRejectedValue({
      response: {
        data: {
          message: 'Validation failed',
          errors: [
            { field: 'full_name', message: 'Name is too short' },
            { field: 'email', message: 'Enter a work email' },
            { field: 'password', message: 'Password was rejected' },
          ],
        },
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />, { preloadedState: authFor({}) });

    await fillAccount(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Name is too short')).toBeInTheDocument();
    expect(screen.getByText('Enter a work email')).toBeInTheDocument();
    expect(screen.getByText('Password was rejected')).toBeInTheDocument();
    expect(screen.queryByText('Validation failed')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
  });

  it('shows the general notice when the API names no field', async () => {
    mockAuthService.register.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Could not create the account right now',
          errors: [{ message: 'Not attached to a field' }],
        },
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />, { preloadedState: authFor({}) });

    await fillAccount(user);
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText('Could not create the account right now')
    ).toBeInTheDocument();

    mockAuthService.register.mockRejectedValueOnce(new Error('offline'));
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(
      await screen.findByText('Could not create the account. Try again.')
    ).toBeInTheDocument();
  });
});

describe('Password reset request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/request-password-reset');
  });

  it('shows the link-sent screen', () => {
    renderWithProviders(<PasswordResetRequestPage />, {
      preloadedState: authFor({ passwordResetRequested: true }),
    });

    expect(
      screen.getByRole('heading', { name: 'Check your email' })
    ).toBeInTheDocument();
    expect(screen.getByText(/works for 30 minutes/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to sign in' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Send reset link' })
    ).not.toBeInTheDocument();
  });

  it('shows a string error and an object error', () => {
    const { unmount } = renderWithProviders(<PasswordResetRequestPage />, {
      preloadedState: authFor({ error: 'Failed to request password reset' }),
    });
    expect(
      screen.getByText('Failed to request password reset')
    ).toBeInTheDocument();
    unmount();

    renderWithProviders(<PasswordResetRequestPage />, {
      preloadedState: authFor({
        error: { message: 'Mailbox refused' } as never,
      }),
    });
    expect(screen.getByText('Mailbox refused')).toBeInTheDocument();
  });

  it('sends the reset request, and shows the refusal when it fails', async () => {
    mockAuthService.requestPasswordReset.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderWithProviders(<PasswordResetRequestPage />, {
      preloadedState: authFor({}),
    });

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Send reset link' }).closest('form')!
    );
    expect(
      await screen.findByText('Enter a valid email address')
    ).toBeInTheDocument();
    expect(mockAuthService.requestPasswordReset).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(
      await screen.findByRole('heading', { name: 'Check your email' })
    ).toBeInTheDocument();
    expect(mockAuthService.requestPasswordReset).toHaveBeenCalledWith(
      'ada@example.com'
    );
  });

  it('shows the API refusal on the form', async () => {
    mockAuthService.requestPasswordReset.mockRejectedValue({
      response: { data: { message: 'Try again later' } },
    });
    const user = userEvent.setup();
    renderWithProviders(<PasswordResetRequestPage />, {
      preloadedState: authFor({}),
    });

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText('Try again later')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Reset your password' })
    ).toBeInTheDocument();
  });
});

describe('Password reset confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends a visitor with no token to the request page', async () => {
    window.history.pushState({}, '', '/reset-password-confirm');
    renderWithProviders(
      <Routes>
        <Route
          path="/reset-password-confirm"
          element={<PasswordResetConfirmPage />}
        />
        <Route
          path="/request-password-reset"
          element={<div>Reset request</div>}
        />
      </Routes>,
      { preloadedState: authFor({}) }
    );

    expect(await screen.findByText('Reset request')).toBeInTheDocument();
    expect(mockAuthService.confirmPasswordReset).not.toHaveBeenCalled();
  });

  it('shows the success screen', () => {
    const token = tokenFor('ada@example.com');
    window.history.pushState({}, '', `/reset-password-confirm?token=${token}`);
    renderWithProviders(<PasswordResetConfirmPage />, {
      preloadedState: authFor({ passwordResetSuccess: true }),
    });

    expect(
      screen.getByRole('heading', { name: 'Password saved' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Continue to sign in' })
    ).toHaveAttribute('href', '/login');
  });

  it('saves a new password', async () => {
    const token = tokenFor('ada@example.com');
    window.history.pushState({}, '', `/reset-password-confirm?token=${token}`);
    mockAuthService.confirmPasswordReset.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(<PasswordResetConfirmPage />, {
      preloadedState: authFor({}),
    });

    expect(screen.getByText('For ada@example.com')).toBeInTheDocument();
    await user.type(screen.getByLabelText('New password'), VALID_PASSWORD);
    await user.type(
      screen.getByLabelText('Confirm new password'),
      VALID_PASSWORD
    );
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(
      await screen.findByRole('heading', { name: 'Password saved' })
    ).toBeInTheDocument();
    expect(mockAuthService.confirmPasswordReset).toHaveBeenCalledWith(
      token,
      VALID_PASSWORD
    );
  });

  it('shows a string error and a complexity error', async () => {
    const token = tokenFor('ada@example.com');
    window.history.pushState({}, '', `/reset-password-confirm?token=${token}`);
    const { unmount } = renderWithProviders(<PasswordResetConfirmPage />, {
      preloadedState: authFor({
        error: 'Password reset failed. Please try again.',
      }),
    });
    expect(
      screen.getByText('Password reset failed. Please try again.')
    ).toBeInTheDocument();
    unmount();

    mockAuthService.confirmPasswordReset.mockRejectedValue({
      response: {
        data: {
          message: 'Password does not meet complexity requirements',
          errors: ['Password must contain at least one digit'],
        },
      },
    });
    window.history.pushState({}, '', `/reset-password-confirm?token=${token}`);
    const user = userEvent.setup();
    renderWithProviders(<PasswordResetConfirmPage />, {
      preloadedState: authFor({}),
    });
    await user.type(screen.getByLabelText('New password'), VALID_PASSWORD);
    await user.type(
      screen.getByLabelText('Confirm new password'),
      VALID_PASSWORD
    );
    await user.click(screen.getByRole('button', { name: 'Save new password' }));

    expect(
      await screen.findByText('Password does not meet complexity requirements')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Password must contain at least one digit')
    ).toBeInTheDocument();
  });

  it('does not submit while a reset is already in flight', async () => {
    const token = tokenFor('ada@example.com');
    window.history.pushState({}, '', `/reset-password-confirm?token=${token}`);
    const user = userEvent.setup();
    renderWithProviders(<PasswordResetConfirmPage />, {
      preloadedState: authFor({ isLoading: true }),
    });

    await user.type(screen.getByLabelText('New password'), VALID_PASSWORD);
    await user.type(
      screen.getByLabelText('Confirm new password'),
      VALID_PASSWORD
    );
    const button = screen.getByRole('button', { name: 'Save new password' });
    expect(button).toBeDisabled();
    fireEvent.submit(button.closest('form')!);

    expect(mockAuthService.confirmPasswordReset).not.toHaveBeenCalled();
  });

  it('omits the address when the token has no email', () => {
    window.history.pushState(
      {},
      '',
      '/reset-password-confirm?token=e30.e30.sig'
    );
    renderWithProviders(<PasswordResetConfirmPage />, {
      preloadedState: authFor({}),
    });

    expect(
      screen.getByRole('heading', { name: 'Choose a new password' })
    ).toBeInTheDocument();
    expect(screen.queryByText(/^For /)).not.toBeInTheDocument();
  });
});
