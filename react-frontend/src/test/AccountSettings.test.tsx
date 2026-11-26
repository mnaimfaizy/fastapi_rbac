import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import authService from '../services/auth.service';
import {
  ACCOUNT_ROLES as ROLES,
  accountTab as tab,
  renderAccountAt as renderAt,
  resetBrowser,
} from './account-test-utils';
import { userMenuTrigger } from './shell-test-utils';

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

describe('Account settings page and routes', () => {
  it.each(ROLES)(
    'shows the page with Profile, Security and Appearance for %s',
    async (role) => {
      renderAt('/dashboard/account', role);

      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: 'Account settings',
        })
      ).toBeInTheDocument();
      expect(
        screen.getByText('Your profile, password and appearance.')
      ).toBeInTheDocument();
      expect(window.location.pathname).toBe('/dashboard/account/profile');
      expect(tab('Profile')).toHaveAttribute('aria-current', 'page');
      expect(tab('Security')).not.toHaveAttribute('aria-current');
      expect(tab('Appearance')).not.toHaveAttribute('aria-current');
    }
  );

  it.each([
    ['/dashboard/profile', '/dashboard/account/profile', 'Profile'],
    ['/dashboard/change-password', '/dashboard/account/security', 'Security'],
  ])('redirects %s to the matching tab', async (from, to, tabName) => {
    renderAt(from);

    await screen.findByRole('heading', { level: 1, name: 'Account settings' });
    expect(window.location.pathname).toBe(to);
    expect(tab(tabName)).toHaveAttribute('aria-current', 'page');
  });

  it('sends an unknown tab to Profile', async () => {
    renderAt('/dashboard/account/billing');

    await screen.findByRole('heading', { level: 1, name: 'Account settings' });
    expect(window.location.pathname).toBe('/dashboard/account/profile');
  });

  it('switches tabs by URL', async () => {
    const user = userEvent.setup();
    renderAt('/dashboard/account/profile');

    await user.click(await screen.findByRole('link', { name: 'Security' }));
    expect(window.location.pathname).toBe('/dashboard/account/security');
    expect(
      await screen.findByRole('heading', { name: 'Change password' })
    ).toBeInTheDocument();

    await user.click(tab('Appearance'));
    expect(window.location.pathname).toBe('/dashboard/account/appearance');
    expect(
      await screen.findByRole('heading', { name: 'Theme' })
    ).toBeInTheDocument();
  });

  it.each(ROLES)('opens from the %s user menu', async (role, name) => {
    const user = userEvent.setup();
    renderAt('/dashboard', role);

    await user.click(userMenuTrigger(name));
    await user.click(
      await screen.findByRole('menuitem', { name: 'Account settings' })
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Account settings' })
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/dashboard/account/profile');
  });

  it.each(ROLES)(
    'opens from the %s sidebar and highlights it',
    async (role) => {
      const user = userEvent.setup();
      renderAt('/dashboard', role);

      const sidebar = screen.getAllByRole('navigation', { name: 'Main' })[0];
      await user.click(
        within(sidebar).getByRole('link', { name: 'Account settings' })
      );

      await screen.findByRole('heading', {
        level: 1,
        name: 'Account settings',
      });
      expect(
        within(sidebar).getByRole('link', { name: 'Account settings' })
      ).toHaveAttribute('aria-current', 'page');
    }
  );
});
