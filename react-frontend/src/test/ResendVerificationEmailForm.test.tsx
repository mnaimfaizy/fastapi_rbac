import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test-utils';
import { ResendVerificationEmailForm } from '../features/auth/components/ResendVerificationEmailForm';
import authService from '../services/auth.service';

vi.mock('../services/auth.service');
const mockAuthService = vi.mocked(authService);

describe('ResendVerificationEmailForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the sent notice after a resend', async () => {
    mockAuthService.resendVerificationEmail.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(<ResendVerificationEmailForm />);

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Resend email' }));

    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(
      screen.getByText(
        'If this address can receive mail, a fresh link is on its way.'
      )
    ).toBeInTheDocument();
    expect(mockAuthService.resendVerificationEmail).toHaveBeenCalledWith(
      'ada@example.com'
    );
  });

  it('shows the API error, and a fallback when the response has no message', async () => {
    mockAuthService.resendVerificationEmail.mockRejectedValueOnce({
      response: { data: { message: 'Rate limited' } },
    });
    const user = userEvent.setup();
    renderWithProviders(<ResendVerificationEmailForm />);

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Resend email' }));
    expect(await screen.findByText('Rate limited')).toBeInTheDocument();

    mockAuthService.resendVerificationEmail.mockRejectedValueOnce(
      new Error('nope')
    );
    await user.click(screen.getByRole('button', { name: 'Resend email' }));
    expect(
      await screen.findByText(
        'Could not resend the verification email. Try again.'
      )
    ).toBeInTheDocument();
  });

  it('shows a field error and does not resend an invalid email', async () => {
    renderWithProviders(<ResendVerificationEmailForm />);

    // Native email validation would swallow a click, so submit the form
    // directly and let the schema report the field error.
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.submit(
      screen.getByRole('button', { name: 'Resend email' }).closest('form')!
    );

    expect(
      await screen.findByText('Enter a valid email address')
    ).toBeInTheDocument();
    expect(mockAuthService.resendVerificationEmail).not.toHaveBeenCalled();
  });
});
