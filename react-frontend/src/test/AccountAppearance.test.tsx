import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import authService from '../services/auth.service';
import { THEME_STORAGE_KEY } from '../lib/theme';
import {
  ACCOUNT_ROLES as ROLES,
  renderAccountAt,
  resetBrowser,
} from './account-test-utils';
import { userMenuTrigger } from './shell-test-utils';

vi.mock('../services/auth.service');
vi.mock('../services/user.service');
vi.mock('../services/dashboard.service');
const mockAuthService = vi.mocked(authService);

const APPEARANCE = '/dashboard/account/appearance';

beforeEach(() => {
  vi.clearAllMocks();
  resetBrowser();
  mockAuthService.logout.mockResolvedValue(undefined);
  mockAuthService.logoutAll.mockResolvedValue(undefined);
});

async function themeChoices() {
  const section = await screen.findByRole('region', { name: 'Theme' });
  return within(section).getByRole('radiogroup', { name: 'Theme' });
}

describe('Appearance tab', () => {
  it.each(ROLES)(
    'offers Light, Dark and System to %s, with System chosen by default',
    async (role) => {
      renderAccountAt(APPEARANCE, role);

      const section = await screen.findByRole('region', { name: 'Theme' });
      expect(
        within(section).getByText(
          'Applies to this browser. System follows your device setting.'
        )
      ).toBeInTheDocument();
      const choices = await themeChoices();
      expect(
        within(choices)
          .getAllByRole('radio')
          .map((radio) => radio.getAttribute('aria-label'))
      ).toEqual(['Light', 'Dark', 'System']);
      expect(
        within(choices).getByRole('radio', { name: 'System' })
      ).toBeChecked();
    }
  );

  it.each(ROLES)(
    'applies the %s choice at once and remembers it',
    async (role) => {
      const user = userEvent.setup();
      renderAccountAt(APPEARANCE, role);

      const choices = await themeChoices();
      await user.click(within(choices).getByRole('radio', { name: 'Dark' }));

      await waitFor(() => {
        expect(document.documentElement).toHaveClass('dark');
      });
      expect(
        within(choices).getByRole('radio', { name: 'Dark' })
      ).toBeChecked();
      expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

      await user.click(within(choices).getByRole('radio', { name: 'Light' }));

      await waitFor(() => {
        expect(document.documentElement).not.toHaveClass('dark');
      });
      expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    }
  );

  it('opens with the remembered choice after a reload', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    renderAccountAt(APPEARANCE);

    const choices = await themeChoices();
    expect(within(choices).getByRole('radio', { name: 'Dark' })).toBeChecked();
    await waitFor(() => {
      expect(document.documentElement).toHaveClass('dark');
    });
  });

  it('agrees with the theme switch in the user menu', async () => {
    const user = userEvent.setup();
    renderAccountAt(APPEARANCE);

    const choices = await themeChoices();
    await user.click(within(choices).getByRole('radio', { name: 'Dark' }));
    await user.click(userMenuTrigger());

    const menu = await screen.findByRole('menu');
    expect(
      within(menu).getByRole('menuitemradio', { name: 'Dark theme' })
    ).toHaveAttribute('aria-checked', 'true');
  });
});
