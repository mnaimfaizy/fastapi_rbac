import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  renderApp,
  userMenuTrigger as trigger,
  type ShellRole,
} from './shell-test-utils';
import { SIGNED_OUT_EVERYWHERE_NOTICE } from '../features/auth/notices';
import authService from '../services/auth.service';
import {
  getStoredAccessToken,
  hasAuthSessionHint,
  setAuthSessionHint,
  setStoredAccessToken,
} from '../lib/tokenStorage';

vi.mock('../services/auth.service');
vi.mock('../services/dashboard.service');
const mockAuthService = vi.mocked(authService);

describe('Sign out everywhere', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockAuthService.logout.mockResolvedValue(undefined);
    mockAuthService.logoutAll.mockResolvedValue(undefined);
    setStoredAccessToken('mock-access-token');
    setAuthSessionHint();
  });

  async function openConfirmation(role: ShellRole, name: string) {
    const user = userEvent.setup();
    const rendered = renderApp(role);
    await user.click(trigger(name));
    await user.click(
      await screen.findByRole('menuitem', { name: /^Sign out everywhere/ })
    );
    const dialog = await screen.findByRole('alertdialog');
    return { user, dialog, ...rendered };
  }

  it('asks first, saying this device signs out too', async () => {
    const { dialog } = await openConfirmation('admin', 'QA Admin');

    expect(
      within(dialog).getByRole('heading', { name: 'Sign out everywhere?' })
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('You’ll be signed out on this device too.')
    ).toBeInTheDocument();
    expect(mockAuthService.logoutAll).not.toHaveBeenCalled();
  });

  it('keeps every session when cancelled', async () => {
    const { user, dialog, store } = await openConfirmation('admin', 'QA Admin');

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
    expect(mockAuthService.logoutAll).not.toHaveBeenCalled();
    expect(mockAuthService.logout).not.toHaveBeenCalled();
    expect(store.getState().auth.isAuthenticated).toBe(true);
    expect(getStoredAccessToken()).toBe('mock-access-token');
    expect(hasAuthSessionHint()).toBe(true);
    // The page is usable again: the menu and dialog left no pointer block.
    await waitFor(() => {
      expect(document.body.style.pointerEvents).not.toBe('none');
    });
    expect(
      screen.getByRole('button', { name: 'Account menu for QA Admin' })
    ).toBeInTheDocument();
  });

  it.each([
    ['admin' as const, 'QA Admin'],
    ['manager' as const, 'QA Manager'],
    ['user' as const, 'QA User'],
  ])(
    'as %s, ends every session and lands on Sign in with the notice',
    async (role, name) => {
      const { user, dialog, store } = await openConfirmation(role, name);

      await user.click(
        within(dialog).getByRole('button', { name: 'Sign out everywhere' })
      );

      await waitFor(() => {
        expect(mockAuthService.logoutAll).toHaveBeenCalledTimes(1);
      });
      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(store.getState().auth.isAuthenticated).toBe(false);
      expect(store.getState().auth.accessToken).toBeNull();
      expect(getStoredAccessToken()).toBeNull();
      expect(hasAuthSessionHint()).toBe(false);
      expect(window.location.pathname).toBe('/login');
      expect(window.location.search).toBe(
        `?notice=${SIGNED_OUT_EVERYWHERE_NOTICE}`
      );
      expect(
        await screen.findByText('You’ve been signed out everywhere.')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Sign in again on any device you still use.')
      ).toBeInTheDocument();
    }
  );

  it('still signs this device out when the server call fails', async () => {
    mockAuthService.logoutAll.mockRejectedValue(new Error('network'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { user, dialog, store } = await openConfirmation('admin', 'QA Admin');

    await user.click(
      within(dialog).getByRole('button', { name: 'Sign out everywhere' })
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login');
    });
    expect(window.location.search).toBe('');
    expect(
      await screen.findByRole('heading', { name: 'Sign in' })
    ).toBeInTheDocument();
    expect(
      screen.queryByText('You’ve been signed out everywhere.')
    ).not.toBeInTheDocument();
    expect(store.getState().auth.isAuthenticated).toBe(false);
    expect(getStoredAccessToken()).toBeNull();
    errorSpy.mockRestore();
  });
});
