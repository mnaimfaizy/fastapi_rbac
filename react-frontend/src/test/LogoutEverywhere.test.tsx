import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from './test-utils';
import { LogoutEverywhereControl } from '../components/auth/LogoutEverywhereControl';
import { Sidebar } from '../components/dashboard/sidebar';
import MainLayout from '../components/layout/MainLayout';
import LoginPage from '../features/auth/LoginPage';
import { SIGNED_OUT_EVERYWHERE_NOTICE } from '../features/auth/notices';
import authService from '../services/auth.service';
import {
  setStoredAccessToken,
  setAuthSessionHint,
  getStoredAccessToken,
  hasAuthSessionHint,
} from '../lib/tokenStorage';

vi.mock('../services/auth.service');
const mockAuthService = vi.mocked(authService);

/** Copy from LoginPage. The apostrophe is the typographic one the banner uses. */
const SIGNED_OUT_EVERYWHERE_BANNER = 'You’ve been signed out everywhere.';

const signedOutAuth = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  passwordChangeSuccess: false,
  passwordResetRequested: false,
  passwordResetSuccess: false,
};

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
      expect(window.location.search).toBe(
        `?notice=${SIGNED_OUT_EVERYWHERE_NOTICE}`
      );
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
      expect(window.location.search).toBe('');
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
      expect(window.location.search).toBe('');
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
      expect(window.location.search).toBe('');
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
      expect(window.location.search).toBe(
        `?notice=${SIGNED_OUT_EVERYWHERE_NOTICE}`
      );
    });
  });

  describe('signed-out-everywhere banner on arrival', () => {
    function renderControlAndSignIn() {
      return renderWithProviders(
        <Routes>
          <Route
            path="/dashboard"
            element={
              <LogoutEverywhereControl>
                <button type="button">Log out everywhere</button>
              </LogoutEverywhereControl>
            }
          />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      );
    }

    async function confirmLogoutEverywhere() {
      const user = userEvent.setup();
      await user.click(
        screen.getByRole('button', { name: 'Log out everywhere' })
      );
      const dialog = await screen.findByRole('alertdialog');
      await user.click(
        within(dialog).getByRole('button', { name: 'Log out everywhere' })
      );
    }

    it('shows the banner after sign-out-everywhere succeeds', async () => {
      renderControlAndSignIn();

      await confirmLogoutEverywhere();

      expect(
        await screen.findByText(SIGNED_OUT_EVERYWHERE_BANNER)
      ).toBeInTheDocument();
      expect(
        screen.getByText('Sign in again on any device you still use.')
      ).toBeInTheDocument();
      expect(window.location.pathname).toBe('/login');
      expect(window.location.search).toBe(
        `?notice=${SIGNED_OUT_EVERYWHERE_NOTICE}`
      );
    });

    it('does not show the banner when sign-out-everywhere fails', async () => {
      mockAuthService.logoutAll.mockRejectedValue(new Error('network'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderControlAndSignIn();

      await confirmLogoutEverywhere();

      expect(
        await screen.findByRole('heading', { name: 'Sign in' })
      ).toBeInTheDocument();
      expect(
        screen.queryByText(SIGNED_OUT_EVERYWHERE_BANNER)
      ).not.toBeInTheDocument();
      expect(window.location.pathname).toBe('/login');
      expect(window.location.search).toBe('');
      errorSpy.mockRestore();
    });

    it('shows no banner after a plain sign-out', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <Routes>
          <Route path="/dashboard" element={<Sidebar />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      );

      await user.click(screen.getByRole('button', { name: 'Logout' }));

      expect(
        await screen.findByRole('heading', { name: 'Sign in' })
      ).toBeInTheDocument();
      expect(
        screen.queryByText(SIGNED_OUT_EVERYWHERE_BANNER)
      ).not.toBeInTheDocument();
      expect(window.location.search).toBe('');
    });

    it('shows no banner when /login is opened directly', () => {
      window.history.pushState({}, '', '/login');
      renderWithProviders(
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>,
        { preloadedState: { auth: signedOutAuth } }
      );

      expect(
        screen.getByRole('heading', { name: 'Sign in' })
      ).toBeInTheDocument();
      expect(
        screen.queryByText(SIGNED_OUT_EVERYWHERE_BANNER)
      ).not.toBeInTheDocument();
    });
  });
});
