import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { queryShellSidebar, renderAppAt } from './system-states-test-utils';

vi.mock('../services/auth.service');
vi.mock('../services/dashboard.service');

describe('In-app 404', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it.each([
    ['admin' as const, 'Go to dashboard'],
    ['manager' as const, 'Go to dashboard'],
    ['user' as const, 'Go to home'],
  ])(
    'keeps the %s inside the shell and links home',
    async (role, homeLabel) => {
      renderAppAt('/dashboard/settings/general', role);

      expect(
        await screen.findByRole('heading', { name: 'Page not found' })
      ).toBeInTheDocument();
      expect(queryShellSidebar()).toBeInTheDocument();
      expect(
        screen.getByText(
          'We couldn’t find /dashboard/settings/general. It may have moved, or the link is out of date.'
        )
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: homeLabel })).toHaveAttribute(
        'href',
        '/dashboard'
      );
      expect(
        screen.getByRole('button', { name: 'Go back' })
      ).toBeInTheDocument();
    }
  );

  it('shows the 404 in the shell for an unknown URL outside /dashboard', async () => {
    renderAppAt('/no-such-page', 'manager');

    expect(
      await screen.findByRole('heading', { name: 'Page not found' })
    ).toBeInTheDocument();
    expect(queryShellSidebar()).toBeInTheDocument();
  });

  it('goes back to the previous page', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/dashboard/account/profile');
    renderAppAt('/dashboard/settings/general', 'admin');

    await user.click(await screen.findByRole('button', { name: 'Go back' }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard/account/profile');
    });
  });
});

describe('Signed-out 404', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('shows the 404 in the auth layout, without the shell, linking to Sign in', async () => {
    renderAppAt('/dashboard/settings/general', null);

    expect(
      await screen.findByRole('heading', { name: 'Page not found' })
    ).toBeInTheDocument();
    expect(queryShellSidebar()).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'This link doesn’t go anywhere. Check the address, or sign in to find what you need.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute(
      'href',
      '/login'
    );
    // The auth layout's brand panel.
    expect(
      screen.getByText('Access control you can reason about.')
    ).toBeInTheDocument();
  });

  it('sends Go to sign in to the Sign in page', async () => {
    const user = userEvent.setup();
    renderAppAt('/no-such-page', null);

    await user.click(await screen.findByRole('link', { name: 'Go to sign in' }));

    expect(window.location.pathname).toBe('/login');
  });
});
