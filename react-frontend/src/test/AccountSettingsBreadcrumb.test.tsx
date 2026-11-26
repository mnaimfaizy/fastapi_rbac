import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import authService from '../services/auth.service';
import {
  ACCOUNT_ROLES as ROLES,
  accountTab as tab,
  renderAccountAt as renderAt,
  resetBrowser,
} from './account-test-utils';

vi.mock('../services/auth.service');
vi.mock('../services/user.service');
vi.mock('../services/dashboard.service');
const mockAuthService = vi.mocked(authService);

beforeEach(() => {
  vi.clearAllMocks();
  resetBrowser();
  mockAuthService.logout.mockResolvedValue(undefined);
  mockAuthService.logoutAll.mockResolvedValue(undefined);
});

function breadcrumb() {
  return screen.getByRole('navigation', { name: 'Breadcrumb' });
}

describe('Account settings breadcrumb', () => {
  it.each(ROLES)(
    'reads You › Account settings › Profile for %s, as the artboard draws it',
    async (role) => {
      renderAt('/dashboard/account/profile', role);

      await waitFor(() =>
        expect(within(breadcrumb()).getByText('Profile')).toHaveAttribute(
          'aria-current',
          'page'
        )
      );
      expect(breadcrumb()).toHaveTextContent(
        /^You\s*Account settings\s*Profile$/
      );
      expect(
        within(breadcrumb()).getByRole('link', { name: 'Account settings' })
      ).toHaveAttribute('href', '/dashboard/account');
    }
  );

  it.each([
    ['/dashboard/account/security', 'Security'],
    ['/dashboard/account/appearance', 'Appearance'],
  ])('ends with the tab on %s', async (path, tabName) => {
    renderAt(path);

    await waitFor(() =>
      expect(within(breadcrumb()).getByText(tabName)).toHaveAttribute(
        'aria-current',
        'page'
      )
    );
    expect(breadcrumb()).toHaveTextContent(
      new RegExp(`^You\\s*Account settings\\s*${tabName}$`)
    );
  });

  it('follows the tab when the viewer switches tabs', async () => {
    const user = userEvent.setup();
    renderAt('/dashboard/account/profile');
    await waitFor(() =>
      expect(within(breadcrumb()).getByText('Profile')).toBeInTheDocument()
    );

    await user.click(tab('Security'));

    await waitFor(() =>
      expect(within(breadcrumb()).getByText('Security')).toHaveAttribute(
        'aria-current',
        'page'
      )
    );
    expect(within(breadcrumb()).queryByText('Profile')).not.toBeInTheDocument();
  });

  it('names the tab the bare page opens on', async () => {
    renderAt('/dashboard/account');

    await waitFor(() =>
      expect(within(breadcrumb()).getByText('Profile')).toHaveAttribute(
        'aria-current',
        'page'
      )
    );
  });
});
