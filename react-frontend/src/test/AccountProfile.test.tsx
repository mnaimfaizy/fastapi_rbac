import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import authService from '../services/auth.service';
import userService from '../services/user.service';
import {
  ACCOUNT_ROLES as ROLES,
  renderAccountAt as renderAt,
  resetBrowser,
} from './account-test-utils';
import { shellViewers, userMenuTrigger } from './shell-test-utils';

vi.mock('../services/auth.service');
vi.mock('../services/user.service');
vi.mock('../services/dashboard.service');
const mockAuthService = vi.mocked(authService);
const mockUserService = vi.mocked(userService);

beforeEach(() => {
  vi.clearAllMocks();
  resetBrowser();
  mockAuthService.logout.mockResolvedValue(undefined);
  mockAuthService.logoutAll.mockResolvedValue(undefined);
});

describe('Profile tab', () => {
  it.each(ROLES)(
    'shows the %s profile with email read-only and the initials avatar',
    async (role, name) => {
      renderAt('/dashboard/account/profile', role);

      const profile = await screen.findByRole('region', { name: 'Profile' });
      const viewer = shellViewers[role];
      expect(within(profile).getByLabelText('First name')).toHaveValue(
        viewer.first_name
      );
      expect(within(profile).getByLabelText('Last name')).toHaveValue(
        viewer.last_name
      );
      expect(within(profile).getByLabelText(/Phone/)).toHaveValue('');
      const email = within(profile).getByLabelText('Email');
      expect(email).toHaveValue(viewer.email);
      expect(email).toHaveAttribute('readonly');
      expect(
        within(profile).getByText(
          'You can’t change your email here. Ask another admin to update it.'
        )
      ).toBeInTheDocument();
      expect(within(profile).getByText(name)).toBeInTheDocument();
      expect(
        within(profile).getByText(
          'Your initials come from your first and last name.'
        )
      ).toBeInTheDocument();
    }
  );

  it.each(ROLES)(
    'saves the %s profile and updates the header name',
    async (role, name) => {
      const viewer = shellViewers[role];
      mockUserService.updateUser.mockResolvedValue({
        ...viewer,
        first_name: 'Quinn',
        last_name: 'Avery',
        contact_phone: '+61 2 5550 0100',
      });
      const user = userEvent.setup();
      renderAt('/dashboard/account/profile', role);

      expect(userMenuTrigger(name)).toBeInTheDocument();
      const profile = await screen.findByRole('region', { name: 'Profile' });
      const first = within(profile).getByLabelText('First name');
      const last = within(profile).getByLabelText('Last name');
      await user.clear(first);
      await user.type(first, 'Quinn');
      await user.clear(last);
      await user.type(last, 'Avery');
      await user.type(
        within(profile).getByLabelText(/Phone/),
        '+61 2 5550 0100'
      );
      await user.click(
        within(profile).getByRole('button', { name: 'Save changes' })
      );

      expect(
        await screen.findByRole('button', {
          name: 'Account menu for Quinn Avery',
        })
      ).toBeInTheDocument();
      expect(mockUserService.updateUser).toHaveBeenCalledWith('me', {
        first_name: 'Quinn',
        last_name: 'Avery',
        contact_phone: '+61 2 5550 0100',
      });
      // The form stays on screen: no full-page loading state on save.
      expect(within(profile).getByLabelText('First name')).toHaveValue('Quinn');
    }
  );

  it('refuses an empty first name without calling the API', async () => {
    const user = userEvent.setup();
    renderAt('/dashboard/account/profile');

    const profile = await screen.findByRole('region', { name: 'Profile' });
    await user.clear(within(profile).getByLabelText('First name'));
    await user.click(
      within(profile).getByRole('button', { name: 'Save changes' })
    );

    expect(
      await within(profile).findByText('Enter your first name.')
    ).toBeInTheDocument();
    expect(mockUserService.updateUser).not.toHaveBeenCalled();
  });

  it('shows the API refusal and keeps the old header name', async () => {
    mockUserService.updateUser.mockRejectedValue(
      new Error('Not enough permissions')
    );
    const user = userEvent.setup();
    renderAt('/dashboard/account/profile');

    const profile = await screen.findByRole('region', { name: 'Profile' });
    const first = within(profile).getByLabelText('First name');
    await user.clear(first);
    await user.type(first, 'Quinn');
    await user.click(
      within(profile).getByRole('button', { name: 'Save changes' })
    );

    expect(
      await within(profile).findByText('Not enough permissions')
    ).toBeInTheDocument();
    expect(userMenuTrigger('QA Admin')).toBeInTheDocument();
  });

  it('shows the profile read-only, without Save, to a viewer the API would refuse', async () => {
    renderAt('/dashboard/account/profile', 'user', {
      permissions: ['self.read_profile'],
    });

    const profile = await screen.findByRole('region', { name: 'Profile' });
    expect(within(profile).getByLabelText('First name')).toHaveAttribute(
      'readonly'
    );
    expect(within(profile).getByLabelText('Last name')).toHaveAttribute(
      'readonly'
    );
    expect(within(profile).getByLabelText(/Phone/)).toHaveAttribute('readonly');
    expect(
      within(profile).queryByRole('button', { name: 'Save changes' })
    ).not.toBeInTheDocument();
  });

  it('lets a superuser without the permission edit, as the API does', async () => {
    renderAt('/dashboard/account/profile', 'admin', {
      permissions: [],
      is_superuser: true,
    });

    const profile = await screen.findByRole('region', { name: 'Profile' });
    expect(within(profile).getByLabelText('First name')).not.toHaveAttribute(
      'readonly'
    );
    expect(
      within(profile).getByRole('button', { name: 'Save changes' })
    ).toBeInTheDocument();
  });
});
