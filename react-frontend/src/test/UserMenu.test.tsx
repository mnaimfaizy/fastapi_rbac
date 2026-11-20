import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, userMenuTrigger as trigger } from './shell-test-utils';
import authService from '../services/auth.service';
import { setAuthSessionHint, setStoredAccessToken } from '../lib/tokenStorage';

vi.mock('../services/auth.service');
vi.mock('../services/dashboard.service');
const mockAuthService = vi.mocked(authService);

describe('Header user menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    document.documentElement.className = '';
    mockAuthService.logout.mockResolvedValue(undefined);
    mockAuthService.logoutAll.mockResolvedValue(undefined);
    setStoredAccessToken('mock-access-token');
    setAuthSessionHint();
  });

  it.each([
    ['admin' as const, 'QA Admin', 'QA', 'Admin'],
    ['manager' as const, 'QA Manager', 'QM', 'Manager'],
    ['user' as const, 'QA User', 'QU', 'User'],
  ])(
    'shows the %s initials avatar, name and role chip on its trigger',
    (role, name, initials, roleName) => {
      renderApp(role);

      const button = trigger(name);
      expect(button).toHaveAttribute('aria-haspopup', 'menu');
      expect(within(button).getByText(initials)).toBeInTheDocument();
      expect(within(button).getByText(name)).toBeInTheDocument();
      expect(within(button).getByText(roleName)).toBeInTheDocument();
    }
  );

  it('opens by click with the account actions', async () => {
    const user = userEvent.setup();
    renderApp();
    const button = trigger();

    await user.click(button);

    const menu = await screen.findByRole('menu');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(menu).getByText('admin@fastapi-rbac.example')
    ).toBeInTheDocument();
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent)
    ).toEqual([
      'Account settings',
      'Sign out',
      'Sign out everywhereEnds your sessions on every device, including this one.',
    ]);
    expect(
      within(menu).getByRole('group', { name: 'Theme' })
    ).toBeInTheDocument();
  });

  it('closes on a second click of its trigger', async () => {
    // The open menu blocks pointer events outside it, as Radix menus do.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderApp();
    const button = trigger();

    await user.click(button);
    await screen.findByRole('menu');
    await user.click(button);

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('closes on Escape and returns focus to its trigger', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(trigger());
    await screen.findByRole('menu');
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
    expect(trigger()).toHaveFocus();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on an outside click and returns focus to its trigger', async () => {
    // The open menu blocks pointer events outside it, as Radix menus do.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderApp();

    await user.click(trigger());
    await screen.findByRole('menu');
    await user.click(document.body);

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
    expect(trigger()).toHaveFocus();
  });

  it('opens Account settings', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(trigger());
    await user.click(
      await screen.findByRole('menuitem', { name: 'Account settings' })
    );

    expect(window.location.pathname).toBe('/dashboard/profile');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('switches the theme without closing', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(trigger());
    const menu = await screen.findByRole('menu');
    const dark = within(menu).getByRole('menuitemradio', {
      name: 'Dark theme',
    });
    expect(
      within(menu).getByRole('menuitemradio', { name: 'System theme' })
    ).toHaveAttribute('aria-checked', 'true');

    await user.click(dark);

    await waitFor(() => {
      expect(document.documentElement).toHaveClass('dark');
    });
    expect(dark).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();

    await user.click(
      within(menu).getByRole('menuitemradio', { name: 'Light theme' })
    );
    await waitFor(() => {
      expect(document.documentElement).not.toHaveClass('dark');
    });
  });

  it('Sign out ends this session only and lands on Sign in', async () => {
    const user = userEvent.setup();
    const { store } = renderApp('user');

    await user.click(trigger('QA User'));
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));

    await waitFor(() => {
      expect(mockAuthService.logout).toHaveBeenCalledTimes(1);
    });
    expect(mockAuthService.logoutAll).not.toHaveBeenCalled();
    expect(store.getState().auth.isAuthenticated).toBe(false);
    expect(window.location.pathname).toBe('/login');
    expect(
      screen.queryByText(/signed out everywhere/i)
    ).not.toBeInTheDocument();
  });
});
