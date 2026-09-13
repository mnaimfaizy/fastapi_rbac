import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test-utils';
import { Sidebar } from '../components/dashboard/sidebar';
import MainLayout from '../components/layout/MainLayout';
import authService from '../services/auth.service';
import {
  setStoredAccessToken,
  setAuthSessionHint,
  getStoredAccessToken,
  hasAuthSessionHint,
} from '../lib/tokenStorage';

vi.mock('../services/auth.service');
const mockAuthService = vi.mocked(authService);

describe('Log out everywhere', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/dashboard');
    mockAuthService.logout.mockResolvedValue(undefined);
    mockAuthService.logoutAll.mockResolvedValue(undefined);
    setStoredAccessToken('mock-access-token');
    setAuthSessionHint();
  });

  describe('sidebar', () => {
    it('renders Log out everywhere next to Logout', () => {
      renderWithProviders(<Sidebar />);

      expect(
        screen.getByRole('button', { name: 'Logout' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Log out everywhere' })
      ).toBeInTheDocument();
    });

    it('does not revoke sessions or clear auth when confirmation is cancelled', async () => {
      const user = userEvent.setup();
      const { store } = renderWithProviders(<Sidebar />);

      await user.click(
        screen.getByRole('button', { name: 'Log out everywhere' })
      );

      const dialog = await screen.findByRole('alertdialog');
      expect(dialog).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      });

      expect(mockAuthService.logoutAll).not.toHaveBeenCalled();
      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(store.getState().auth.isAuthenticated).toBe(true);
      expect(store.getState().auth.accessToken).toBe('mock-access-token');
      expect(getStoredAccessToken()).toBe('mock-access-token');
      expect(hasAuthSessionHint()).toBe(true);
    });

    it('posts logout/all after confirmation and sends the user to login', async () => {
      const user = userEvent.setup();
      const { store } = renderWithProviders(<Sidebar />);

      await user.click(
        screen.getByRole('button', { name: 'Log out everywhere' })
      );

      const dialog = await screen.findByRole('alertdialog');
      await user.click(
        within(dialog).getByRole('button', { name: 'Log out everywhere' })
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
    });

    it('ordinary Logout posts /auth/logout only', async () => {
      const user = userEvent.setup();
      const { store } = renderWithProviders(<Sidebar />);

      await user.click(screen.getByRole('button', { name: 'Logout' }));

      await waitFor(() => {
        expect(mockAuthService.logout).toHaveBeenCalledTimes(1);
      });
      expect(mockAuthService.logoutAll).not.toHaveBeenCalled();
      expect(store.getState().auth.isAuthenticated).toBe(false);
      expect(window.location.pathname).toBe('/login');
    });

    it('keeps Log out everywhere labelled when the sidebar is collapsed', () => {
      renderWithProviders(<Sidebar isCollapsed />);

      expect(
        screen.getByRole('button', { name: 'Log out everywhere' })
      ).toBeInTheDocument();
      expect(screen.queryByText('Log out everywhere')).not.toBeInTheDocument();
    });

    it('still clears client auth when logout/all fails', async () => {
      mockAuthService.logoutAll.mockRejectedValue(new Error('network'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const user = userEvent.setup();
      const { store } = renderWithProviders(<Sidebar />);

      await user.click(
        screen.getByRole('button', { name: 'Log out everywhere' })
      );
      const dialog = await screen.findByRole('alertdialog');
      await user.click(
        within(dialog).getByRole('button', { name: 'Log out everywhere' })
      );

      await waitFor(() => {
        expect(mockAuthService.logoutAll).toHaveBeenCalledTimes(1);
      });
      expect(store.getState().auth.isAuthenticated).toBe(false);
      expect(getStoredAccessToken()).toBeNull();
      expect(hasAuthSessionHint()).toBe(false);
      expect(window.location.pathname).toBe('/login');
      errorSpy.mockRestore();
    });
  });

  describe('header user menu', () => {
    it('renders Log out everywhere next to Logout', async () => {
      const user = userEvent.setup();
      renderWithProviders(<MainLayout />);

      await user.click(screen.getByRole('button', { name: /Admin User/i }));

      expect(
        screen.getByRole('button', { name: 'Logout' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Log out everywhere' })
      ).toBeInTheDocument();
    });

    it('ordinary Logout posts /auth/logout only', async () => {
      const user = userEvent.setup();
      const { store } = renderWithProviders(<MainLayout />);

      await user.click(screen.getByRole('button', { name: /Admin User/i }));
      await user.click(screen.getByRole('button', { name: 'Logout' }));

      await waitFor(() => {
        expect(mockAuthService.logout).toHaveBeenCalledTimes(1);
      });
      expect(mockAuthService.logoutAll).not.toHaveBeenCalled();
      expect(store.getState().auth.isAuthenticated).toBe(false);
      expect(window.location.pathname).toBe('/login');
    });

    it('does not revoke sessions or clear auth when confirmation is cancelled', async () => {
      const user = userEvent.setup();
      const { store } = renderWithProviders(<MainLayout />);

      await user.click(screen.getByRole('button', { name: /Admin User/i }));
      await user.click(
        screen.getByRole('button', { name: 'Log out everywhere' })
      );

      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      });

      expect(mockAuthService.logoutAll).not.toHaveBeenCalled();
      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(store.getState().auth.isAuthenticated).toBe(true);
      expect(getStoredAccessToken()).toBe('mock-access-token');
      expect(hasAuthSessionHint()).toBe(true);
    });

    it('posts logout/all after confirmation and does not post /auth/logout', async () => {
      const user = userEvent.setup();
      const { store } = renderWithProviders(<MainLayout />);

      await user.click(screen.getByRole('button', { name: /Admin User/i }));
      await user.click(
        screen.getByRole('button', { name: 'Log out everywhere' })
      );

      const dialog = await screen.findByRole('alertdialog');
      await user.click(
        within(dialog).getByRole('button', { name: 'Log out everywhere' })
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
    });
  });
});
