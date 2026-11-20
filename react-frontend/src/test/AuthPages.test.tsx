import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, mockUser, mockToken } from './test-utils';
import AuthLayout from '../components/layout/AuthLayout';
import LoginPage from '../features/auth/LoginPage';
import SignupPage from '../features/auth/SignupPage';
import PasswordResetRequestPage from '../features/auth/PasswordResetRequestPage';
import PasswordResetConfirmPage from '../features/auth/PasswordResetConfirmPage';
import ChangePasswordRequiredPage from '../features/auth/ChangePasswordRequiredPage';
import authService from '../services/auth.service';
import { SIGNED_OUT_EVERYWHERE_NOTICE } from '../features/auth/notices';

vi.mock('../services/auth.service');
const mockAuthService = vi.mocked(authService);

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

const UNIFORM_LOGIN_FAILURE =
  'Email or password is incorrect, or the account is temporarily locked. Try again later or reset your password.';

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

const roleUser = (name: 'admin' | 'manager' | 'user') => ({
  ...mockUser,
  id: name,
  email: `${name}@fastapi-rbac.example`,
  is_superuser: name === 'admin',
  needs_to_change_password: true,
  roles: [
    {
      id: name,
      name,
      description: name,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ],
});

const authFor = (user: typeof mockUser | null) => ({
  auth: {
    ...signedOutAuth,
    user,
    accessToken: user ? 'mock-access-token' : null,
    isAuthenticated: user !== null,
  },
});

function ruleItem(label: string) {
  return screen.getByText((_, element) => {
    return (
      element?.tagName === 'LI' &&
      (element.textContent?.includes(label) ?? false)
    );
  });
}

function tokenFor(email: string) {
  const payload = btoa(JSON.stringify({ sub: email }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `e30.${payload}.sig`;
}

describe('Web v1 auth pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/login');
  });

  it('uses the split layout and the brand line on sign in', () => {
    renderWithProviders(
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>
      </Routes>,
      { preloadedState: authFor(null) }
    );

    expect(
      screen.getByRole('heading', { name: 'Sign in' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Use your work email to sign in to FastAPI RBAC.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Access control you can reason about.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Forgot password?' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Create an account' })
    ).toBeInTheDocument();
  });

  it('shows the signed-out-everywhere notice from the query', () => {
    window.history.pushState(
      {},
      '',
      `/login?notice=${SIGNED_OUT_EVERYWHERE_NOTICE}`
    );

    renderWithProviders(<LoginPage />, { preloadedState: authFor(null) });

    expect(
      screen.getByText('You’ve been signed out everywhere.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Sign in again on any device you still use.')
    ).toBeInTheDocument();
  });

  it('shows the uniform login failure as the error artboard, without a lock countdown', async () => {
    mockAuthService.login.mockRejectedValue({
      response: {
        data: {
          errors: [{ message: UNIFORM_LOGIN_FAILURE }],
        },
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { preloadedState: authFor(null) });

    await user.type(screen.getByLabelText('Email'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText('Email or password is wrong')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Check both and try again, or reset your password.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/try again in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(UNIFORM_LOGIN_FAILURE)).not.toBeInTheDocument();
  });

  it.each(['Email is not verified.', 'Inactive user'])(
    'shows "%s" when the right password reached that account state',
    async (message) => {
      mockAuthService.login.mockRejectedValue({
        response: { data: { errors: [{ message }] } },
      });
      const user = userEvent.setup();
      renderWithProviders(<LoginPage />, { preloadedState: authFor(null) });

      await user.type(screen.getByLabelText('Email'), 'admin@example.com');
      await user.type(screen.getByLabelText('Password'), 'CorrectPassword!42');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      expect(await screen.findByText(message)).toBeInTheDocument();
    }
  );

  it.each(['admin', 'manager', 'user'] as const)(
    'signs in a %s and keeps that role on the session',
    async (role) => {
      const account = roleUser(role);
      mockAuthService.login.mockResolvedValue({
        ...mockToken,
        user: { ...account, needs_to_change_password: false },
      });
      const user = userEvent.setup();
      const { store } = renderWithProviders(<LoginPage />, {
        preloadedState: authFor(null),
      });

      await user.type(screen.getByLabelText('Email'), account.email);
      await user.type(screen.getByLabelText('Password'), 'CorrectPassword!42');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(store.getState().auth.user?.roles[0].name).toBe(role);
      });
      expect(store.getState().auth.isAuthenticated).toBe(true);
    }
  );

  it('ticks password rules on register as they are met', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupPage />, { preloadedState: authFor(null) });

    expect(
      screen.getByRole('heading', { name: 'Create an account' })
    ).toBeInTheDocument();
    const rules = screen.getByRole('list', { name: 'Password rules' });
    expect(rules).not.toHaveTextContent(/Met:/);

    await user.type(screen.getByLabelText('Password'), 'a');

    expect(ruleItem('A lowercase letter')).toHaveTextContent(/Met:/);
    expect(ruleItem('At least 12 characters')).not.toHaveTextContent(/Met:/);
    expect(ruleItem('A special character')).not.toHaveTextContent(/Met:/);

    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'QaRegisterPass!47');

    for (const label of [
      'At least 12 characters',
      'At most 128 characters',
      'An uppercase letter',
      'A lowercase letter',
      'A number',
      'A special character',
      'Not a common password',
      'No runs like abc or 123',
      'No character repeated 4 or more times in a row',
    ]) {
      expect(ruleItem(label)).toHaveTextContent(/Met:/);
    }
  });

  it('asks for a reset link and states the 30 minute window', () => {
    renderWithProviders(<PasswordResetRequestPage />, {
      preloadedState: authFor(null),
    });

    expect(
      screen.getByRole('heading', { name: 'Reset your password' })
    ).toBeInTheDocument();
    expect(screen.getByText(/works for 30 minutes/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Send reset link' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to sign in' })
    ).toBeInTheDocument();
  });

  it('ticks password rules on reset confirm and names the address in the link', async () => {
    const email = 'admin@fastapi-rbac.example';
    window.history.pushState(
      {},
      '',
      `/reset-password-confirm?token=${tokenFor(email)}`
    );
    const user = userEvent.setup();
    renderWithProviders(<PasswordResetConfirmPage />, {
      preloadedState: authFor(null),
    });

    expect(
      screen.getByRole('heading', { name: 'Choose a new password' })
    ).toBeInTheDocument();
    expect(screen.getByText(`For ${email}`)).toBeInTheDocument();

    await user.type(screen.getByLabelText('New password'), 'a');
    expect(ruleItem('A lowercase letter')).toHaveTextContent(/Met:/);
    expect(ruleItem('At least 12 characters')).not.toHaveTextContent(/Met:/);
  });

  it.each(['admin', 'manager', 'user'] as const)(
    'asks a %s with a temporary password to set a new one',
    (role) => {
      renderWithProviders(<ChangePasswordRequiredPage />, {
        preloadedState: authFor(roleUser(role)),
      });

      expect(
        screen.getByRole('heading', { name: 'Set a new password' })
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'You signed in with a temporary password. Choose your own before you continue.'
        )
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Temporary password')).toBeInTheDocument();
      expect(
        screen.getByRole('list', { name: 'Password rules' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Save and continue' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Sign out' })
      ).toBeInTheDocument();
    }
  );
});
