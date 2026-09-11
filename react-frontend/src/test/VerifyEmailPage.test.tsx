import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
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

function verificationError(message: string) {
  return { response: { data: { message } } };
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

    expect(
      await screen.findByText('Verification Successful')
    ).toBeInTheDocument();
    expect(screen.queryByText('Verification Failed')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /resend email/i })
    ).not.toBeInTheDocument();
  });

  it('shows only failure and Resend Email when verification is rejected', async () => {
    mockAuthService.verifyEmail.mockRejectedValue(
      verificationError(
        'This verification link is invalid or has expired. Please request a new verification email and try again.'
      )
    );

    renderWithProviders(<VerifyEmailPage />);

    expect(await screen.findByText('Verification Failed')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This verification link is invalid or has expired. Please request a new verification email and try again.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /resend email/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Verification Successful')
    ).not.toBeInTheDocument();
  });

  it('shows the missing-token failure without a success banner', async () => {
    window.history.pushState({}, '', '/verify-email');

    renderWithProviders(<VerifyEmailPage />);

    expect(await screen.findByText('Verification Failed')).toBeInTheDocument();
    expect(
      screen.getByText('Verification token is missing.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /resend email/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Verification Successful')
    ).not.toBeInTheDocument();
    expect(mockAuthService.verifyEmail).not.toHaveBeenCalled();
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
    expect(screen.queryByText('Verification Successful')).not.toBeInTheDocument();

    second.reject(
      verificationError('This verification link is invalid or has expired.')
    );

    expect(await screen.findByText('Verification Failed')).toBeInTheDocument();
    expect(
      screen.queryByText('Verification Successful')
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /resend email/i })
    ).toBeInTheDocument();
  });
});
