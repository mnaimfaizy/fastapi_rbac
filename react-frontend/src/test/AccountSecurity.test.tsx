import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import authService from '../services/auth.service';
import {
  ACCOUNT_ROLES as ROLES,
  renderAccountAt,
  resetBrowser,
} from './account-test-utils';
import { mockToken } from './test-utils';
import { shellViewers } from './shell-test-utils';

vi.mock('../services/auth.service');
vi.mock('../services/user.service');
vi.mock('../services/dashboard.service');
const mockAuthService = vi.mocked(authService);

const SECURITY = '/dashboard/account/security';
const GOOD_PASSWORD = 'Quartz-Meadow-31';
const COMPLEXITY_MESSAGE = 'Password does not meet complexity requirements.';

beforeEach(() => {
  vi.clearAllMocks();
  resetBrowser();
  mockAuthService.logout.mockResolvedValue(undefined);
  mockAuthService.logoutAll.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

function changePasswordSection() {
  return screen.findByRole('region', { name: 'Change password' });
}

async function fillPasswordForm(
  section: HTMLElement,
  next: string,
  confirm = next
) {
  const user = userEvent.setup();
  await user.type(
    within(section).getByLabelText('Current password'),
    'OldPassword!99'
  );
  await user.type(within(section).getByLabelText('New password'), next);
  await user.type(
    within(section).getByLabelText('Confirm new password'),
    confirm
  );
  await user.click(
    within(section).getByRole('button', { name: 'Update password' })
  );
}

describe('Security tab: change password', () => {
  it.each(ROLES)(
    'shows the %s change-password form with the live checklist',
    async (role) => {
      const user = userEvent.setup();
      renderAccountAt(SECURITY, role);

      const section = await changePasswordSection();
      expect(
        within(section).getByText('You’ll stay signed in on this device.')
      ).toBeInTheDocument();
      const rules = within(section).getByRole('list', {
        name: 'Password rules',
      });
      expect(
        within(rules).getByText('At least 12 characters')
      ).toBeInTheDocument();
      expect(within(rules).queryAllByText(/^Met:/)).toHaveLength(0);

      await user.type(
        within(section).getByLabelText('New password'),
        GOOD_PASSWORD
      );

      expect(within(rules).queryAllByText(/^Not yet met:/)).toHaveLength(0);
      expect(within(rules).getAllByText(/^Met:/).length).toBeGreaterThan(0);
    }
  );

  it('refuses a password the policy rejects, with its error, before calling the API', async () => {
    renderAccountAt(SECURITY);

    const section = await changePasswordSection();
    await fillPasswordForm(section, 'short');

    expect(
      await within(section).findByText(
        'Password must be at least 12 characters long'
      )
    ).toBeInTheDocument();
    expect(mockAuthService.changePassword).not.toHaveBeenCalled();
  });

  it('refuses a confirmation that does not match', async () => {
    renderAccountAt(SECURITY);

    const section = await changePasswordSection();
    await fillPasswordForm(section, GOOD_PASSWORD, 'Quartz-Meadow-32');

    expect(
      await within(section).findByText("Passwords don't match")
    ).toBeInTheDocument();
    expect(mockAuthService.changePassword).not.toHaveBeenCalled();
  });

  it('clears the last refusal when the next attempt fails before it is sent', async () => {
    mockAuthService.changePassword.mockRejectedValue({
      response: { data: { message: 'Invalid Current Password' } },
    });
    const user = userEvent.setup();
    renderAccountAt(SECURITY);

    const section = await changePasswordSection();
    await fillPasswordForm(section, GOOD_PASSWORD);
    expect(await within(section).findByRole('alert')).toHaveTextContent(
      'Invalid Current Password'
    );

    const confirm = within(section).getByLabelText('Confirm new password');
    await user.clear(confirm);
    await user.type(confirm, 'Quartz-Meadow-32');
    await user.click(
      within(section).getByRole('button', { name: 'Update password' })
    );

    expect(
      await within(section).findByText("Passwords don't match")
    ).toBeInTheDocument();
    expect(
      within(section).queryByText('Invalid Current Password')
    ).not.toBeInTheDocument();
    expect(mockAuthService.changePassword).toHaveBeenCalledTimes(1);
  });

  it('clears "Password updated." when the next attempt fails before it is sent', async () => {
    mockAuthService.changePassword.mockResolvedValue({
      ...mockToken,
      access_token: 'rotated-access-token',
      user: shellViewers.admin,
    });
    renderAccountAt(SECURITY);

    const section = await changePasswordSection();
    await fillPasswordForm(section, GOOD_PASSWORD);
    expect(
      await within(section).findByText('Password updated.')
    ).toBeInTheDocument();

    await fillPasswordForm(section, GOOD_PASSWORD, 'Quartz-Meadow-32');

    expect(
      await within(section).findByText("Passwords don't match")
    ).toBeInTheDocument();
    expect(
      within(section).queryByText('Password updated.')
    ).not.toBeInTheDocument();
    expect(mockAuthService.changePassword).toHaveBeenCalledTimes(1);
  });

  it.each(ROLES)(
    'shows each policy rule the API refuses for %s',
    async (role) => {
      mockAuthService.changePassword.mockRejectedValue({
        response: {
          data: {
            status: 'error',
            message: COMPLEXITY_MESSAGE,
            errors: [
              { message: 'Password was used recently' },
              { message: 'Password is too similar to your email' },
            ],
          },
        },
      });
      renderAccountAt(SECURITY, role);

      const section = await changePasswordSection();
      await fillPasswordForm(section, GOOD_PASSWORD);

      const alert = await within(section).findByRole('alert');
      expect(alert).toHaveTextContent(COMPLEXITY_MESSAGE);
      expect(alert).toHaveTextContent('Password was used recently');
      expect(alert).toHaveTextContent('Password is too similar to your email');
    }
  );

  it('changes the password and stays on the page', async () => {
    let resolveChange!: (value: typeof mockToken) => void;
    mockAuthService.changePassword.mockReturnValue(
      new Promise((resolve) => {
        resolveChange = resolve;
      })
    );
    renderAccountAt(SECURITY);

    const section = await changePasswordSection();
    await fillPasswordForm(section, GOOD_PASSWORD);

    await waitFor(() => {
      expect(
        within(section).getByRole('button', { name: 'Updating…' })
      ).toBeDisabled();
    });
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();

    resolveChange({
      ...mockToken,
      access_token: 'rotated-access-token',
      user: shellViewers.admin,
    });

    expect(
      await within(section).findByText('Password updated.')
    ).toBeInTheDocument();
    expect(mockAuthService.changePassword).toHaveBeenCalledWith(
      'OldPassword!99',
      GOOD_PASSWORD
    );
    expect(within(section).getByLabelText('New password')).toHaveValue('');
    expect(window.location.pathname).toBe(SECURITY);
  });
});

describe('Security tab: password status', () => {
  it.each(ROLES)(
    'says passwords expire every 90 days and shows the %s password age',
    async (role) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-19T12:00:00Z'));
      renderAccountAt(SECURITY, role, {
        last_changed_password_date: '2026-10-09T12:00:00Z',
        verified: true,
      });

      const status = await screen.findByRole('region', {
        name: 'Password status',
      });
      expect(
        within(status).getByText('Passwords expire every 90 days.')
      ).toBeInTheDocument();
      expect(within(status).getByText('41 days')).toBeInTheDocument();
      expect(within(status).getByText('7 Jan 2027')).toBeInTheDocument();
      expect(within(status).getByText('9 Oct 2026')).toBeInTheDocument();
      expect(within(status).getByText('Verified')).toBeInTheDocument();
    }
  );

  it('shows Pending for an unverified email and no dates when none is recorded', async () => {
    renderAccountAt(SECURITY, 'user', {
      last_changed_password_date: null,
      verified: false,
    });

    const status = await screen.findByRole('region', {
      name: 'Password status',
    });
    expect(within(status).getByText('Pending')).toBeInTheDocument();
    expect(within(status).getAllByText('Not recorded')).toHaveLength(3);
  });
});

describe('Security tab: sign out everywhere', () => {
  it.each(ROLES)(
    'asks %s first, then ends every session and lands on Sign in',
    async (role) => {
      const user = userEvent.setup();
      renderAccountAt(SECURITY, role);

      const section = await screen.findByRole('region', {
        name: 'Sign out everywhere',
      });
      expect(
        within(section).getByText(/Ends every session on every device/)
      ).toBeInTheDocument();
      await user.click(
        within(section).getByRole('button', { name: 'Sign out everywhere' })
      );

      const dialog = await screen.findByRole('alertdialog', {
        name: 'Sign out everywhere?',
      });
      expect(
        within(dialog).getByText(
          'This ends your sessions on every device and browser where you’re signed in.'
        )
      ).toBeInTheDocument();
      expect(
        within(dialog).getByText(
          'You’ll be signed out on this device too, and you’ll need to sign in again.'
        )
      ).toBeInTheDocument();
      expect(mockAuthService.logoutAll).not.toHaveBeenCalled();

      await user.click(
        within(dialog).getByRole('button', { name: 'Sign out everywhere' })
      );

      expect(
        await screen.findByText('You’ve been signed out everywhere.')
      ).toBeInTheDocument();
      expect(mockAuthService.logoutAll).toHaveBeenCalledTimes(1);
      expect(window.location.pathname).toBe('/login');
    }
  );

  it('keeps every session when the dialog is cancelled', async () => {
    const user = userEvent.setup();
    renderAccountAt(SECURITY);

    const section = await screen.findByRole('region', {
      name: 'Sign out everywhere',
    });
    await user.click(
      within(section).getByRole('button', { name: 'Sign out everywhere' })
    );
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(mockAuthService.logoutAll).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe(SECURITY);
  });
});
