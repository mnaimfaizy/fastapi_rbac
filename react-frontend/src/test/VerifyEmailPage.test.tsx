import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  createMemoryRouter,
  Route,
  RouterProvider,
  Routes,
} from 'react-router-dom';
import { VerifyEmailPage } from '../features/auth/components/VerifyEmailPage';
import { renderWithProviders } from './test-utils';
import authService from '../services/auth.service';

vi.mock('../services/auth.service');
const mockAuthService = vi.mocked(authService);

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function verificationError(message: string, status = 400) {
  return { response: { status, data: { message } } };
}

function tokenFor(email: string) {
  const payload = btoa(JSON.stringify({ sub: email }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `e30.${payload}.sig`;
}

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.history.pushState({}, '', '/verify-email?token=test-token');
  });

  it('shows only success after a valid verification, without Resend Email', async () => {
    mockAuthService.verifyEmail.mockResolvedValue(undefined);

    renderWithProviders(<VerifyEmailPage />);

    expect(await screen.findByText('Email verified')).toBeInTheDocument();
    expect(screen.queryByText('This link has expired')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /resend email/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /resend email/i })
    ).not.toBeInTheDocument();
  });

  it('shows only failure and Resend Email when verification is rejected', async () => {
    mockAuthService.verifyEmail.mockRejectedValue(
      verificationError(
        'This verification link is invalid or has expired. Please request a new verification email and try again.'
      )
    );

    renderWithProviders(<VerifyEmailPage />);

    expect(
      await screen.findByText('This link has expired')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Verification links work for 24 hours/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /resend email/i })
    ).toBeInTheDocument();
    expect(screen.queryByText('Email verified')).not.toBeInTheDocument();
  });

  it('shows a missing token without calling it expired', async () => {
    window.history.pushState({}, '', '/verify-email');

    renderWithProviders(
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/login" element={<div>Sign in page</div>} />
      </Routes>
    );

    expect(await screen.findByText('This link is missing')).toBeInTheDocument();
    expect(screen.queryByText('This link has expired')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'Open the verification link from your email, or request a new one.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /resend email/i })
    ).toBeInTheDocument();
    expect(screen.queryByText('Email verified')).not.toBeInTheDocument();
    expect(mockAuthService.verifyEmail).not.toHaveBeenCalled();

    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Back to sign in' }));
    expect(await screen.findByText('Sign in page')).toBeInTheDocument();
  });

  it('shows an expired link for the rejection status', async () => {
    mockAuthService.verifyEmail.mockRejectedValue(
      verificationError(
        'This verification link is invalid or has expired. Please request a new verification email and try again.',
        400
      )
    );

    renderWithProviders(<VerifyEmailPage />);

    expect(
      await screen.findByText('This link has expired')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Verification links work for 24 hours/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Could not verify this link')
    ).not.toBeInTheDocument();
  });

  it('treats a 5xx response as a generic error, not an expired link', async () => {
    mockAuthService.verifyEmail.mockRejectedValue(
      verificationError(
        'An unexpected error occurred during email verification.',
        500
      )
    );

    renderWithProviders(<VerifyEmailPage />);

    expect(
      await screen.findByText('Could not verify this link')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Something went wrong. Try again.')
    ).toBeInTheDocument();
    expect(screen.queryByText('This link has expired')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Verification links work for 24 hours/i)
    ).not.toBeInTheDocument();
  });

  it('shows a network error and a generic error without the expired title', async () => {
    mockAuthService.verifyEmail.mockRejectedValueOnce({
      isAxiosError: true,
      code: 'ERR_NETWORK',
      message: 'Network Error',
    });
    const { unmount } = renderWithProviders(<VerifyEmailPage />);

    expect(
      await screen.findByText('Could not reach the server')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Check your connection and try again.')
    ).toBeInTheDocument();
    expect(screen.queryByText('This link has expired')).not.toBeInTheDocument();
    unmount();

    mockAuthService.verifyEmail.mockRejectedValueOnce(new Error('boom'));
    renderWithProviders(<VerifyEmailPage />);

    expect(
      await screen.findByText('Could not verify this link')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Something went wrong. Try again.')
    ).toBeInTheDocument();
    expect(screen.queryByText('This link has expired')).not.toBeInTheDocument();
  });

  it('names the address on success and continues to sign in', async () => {
    const email = 'ada@example.com';
    window.history.pushState({}, '', `/verify-email?token=${tokenFor(email)}`);
    mockAuthService.verifyEmail.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/login" element={<div>Sign in page</div>} />
      </Routes>
    );

    expect(
      await screen.findByText(`${email} is confirmed. You can sign in now.`)
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Continue to sign in' })
    );
    expect(await screen.findByText('Sign in page')).toBeInTheDocument();
  });

  it('resends from an expired link that carries an email, and shows a resend failure', async () => {
    const email = 'ada@example.com';
    window.history.pushState({}, '', `/verify-email?token=${tokenFor(email)}`);
    mockAuthService.verifyEmail.mockRejectedValue(
      verificationError('This verification link is invalid or has expired.')
    );
    mockAuthService.resendVerificationEmail.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<VerifyEmailPage />);

    expect(
      await screen.findByText('This link has expired')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `Verification links work for 24 hours. We’ll send a fresh one to ${email}.`
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Resend email' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Resend email' }));
    expect(
      await screen.findByText(
        'If this address can receive mail, a fresh link is on its way.'
      )
    ).toBeInTheDocument();
    expect(mockAuthService.resendVerificationEmail).toHaveBeenCalledWith(email);
    unmount();

    window.history.pushState({}, '', `/verify-email?token=${tokenFor(email)}`);
    mockAuthService.resendVerificationEmail.mockRejectedValueOnce({
      response: { data: { message: 'Resend is unavailable' } },
    });
    renderWithProviders(<VerifyEmailPage />);
    await user.click(
      await screen.findByRole('button', { name: 'Resend email' })
    );
    expect(
      await screen.findByText('Resend is unavailable')
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'If this address can receive mail, a fresh link is on its way.'
      )
    ).not.toBeInTheDocument();

    mockAuthService.resendVerificationEmail.mockRejectedValueOnce(
      new Error('offline')
    );
    await user.click(screen.getByRole('button', { name: 'Resend email' }));
    expect(
      await screen.findByText(
        'Could not resend the verification email. Try again.'
      )
    ).toBeInTheDocument();
  });

  it('does not show success and failure together when a stale verify settles late', async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    mockAuthService.verifyEmail
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    const router = createMemoryRouter(
      [{ path: '/verify-email', element: <VerifyEmailPage /> }],
      { initialEntries: ['/verify-email?token=one'] }
    );
    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(mockAuthService.verifyEmail).toHaveBeenCalledTimes(1);
    });

    await router.navigate('/verify-email?token=two');
    await waitFor(() => {
      expect(mockAuthService.verifyEmail).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      first.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByText('Email verified')).not.toBeInTheDocument();

    second.reject(
      verificationError('This verification link is invalid or has expired.')
    );

    expect(
      await screen.findByText('This link has expired')
    ).toBeInTheDocument();
    expect(screen.queryByText('Email verified')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /resend email/i })
    ).toBeInTheDocument();
  });
});
