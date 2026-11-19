import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoutesFromElements, matchRoutes } from 'react-router-dom';
import { renderWithProviders } from './test-utils';
import { signedInAs, type ShellRole } from './shell-test-utils';
import MainLayout from '../components/layout/MainLayout';
import { appRoutes } from '../App';
import { allNavItems } from '../lib/navigation';

vi.mock('../services/auth.service');

function renderShell(role: ShellRole, path = '/dashboard') {
  window.history.pushState({}, '', path);
  return renderWithProviders(<MainLayout />, {
    preloadedState: signedInAs(role),
  });
}

function mainNav() {
  return screen.getByRole('navigation', { name: 'Main' });
}

/** Group headings and link names, in order, as a person reads the sidebar. */
function sidebarOutline(nav: HTMLElement) {
  return within(nav)
    .getAllByRole('group')
    .map((group) => ({
      group: group.getAttribute('aria-label'),
      items: within(group)
        .getAllByRole('link')
        .map((link) => link.getAttribute('aria-label') ?? link.textContent),
    }));
}

const ACCESS = [
  'Users',
  'Roles',
  'Role groups',
  'Permissions',
  'Permission groups',
];

describe('App shell sidebar', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows the FastAPI RBAC name and logo', () => {
    renderShell('admin');

    const nav = mainNav();
    expect(within(nav).getByText('FastAPI RBAC')).toBeInTheDocument();
    expect(
      within(nav).getByRole('img', { name: 'FastAPI RBAC' })
    ).toBeInTheDocument();
  });

  it.each([['admin' as const], ['manager' as const]])(
    'groups the %s sidebar into Overview, Access and You',
    (role) => {
      renderShell(role);

      expect(sidebarOutline(mainNav())).toEqual([
        { group: 'Overview', items: ['Dashboard'] },
        { group: 'Access', items: ACCESS },
        { group: 'You', items: ['Account settings'] },
      ]);
    }
  );

  it('shows a plain user only Home and Account settings, with no Access group', () => {
    renderShell('user');

    expect(sidebarOutline(mainNav())).toEqual([
      { group: 'Overview', items: ['Home'] },
      { group: 'You', items: ['Account settings'] },
    ]);
    expect(within(mainNav()).queryByText('Access')).not.toBeInTheDocument();
  });

  it('hides each Access item the viewer lacks the read permission for', () => {
    window.history.pushState({}, '', '/dashboard');
    const state = signedInAs('manager');
    state.auth.user = {
      ...state.auth.user,
      permissions: ['user.read', 'permission.read'],
    };
    renderWithProviders(<MainLayout />, { preloadedState: state });

    const access = within(mainNav()).getByRole('group', { name: 'Access' });
    expect(
      within(access)
        .getAllByRole('link')
        .map((link) => link.textContent)
    ).toEqual(['Users', 'Permissions']);
  });

  it.each([['admin' as const], ['manager' as const], ['user' as const]])(
    'has no sign-out links in the %s sidebar',
    (role) => {
      renderShell(role);

      const nav = mainNav();
      expect(
        within(nav).queryByRole('button', { name: /sign out|log ?out/i })
      ).not.toBeInTheDocument();
      expect(
        within(nav).queryByRole('link', { name: /sign out|log ?out/i })
      ).not.toBeInTheDocument();
    }
  );

  it('marks the page on screen as current, and names it in the breadcrumb', () => {
    renderShell('admin', '/dashboard/roles/7');

    expect(
      within(mainNav()).getByRole('link', { name: 'Roles' })
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(mainNav()).getByRole('link', { name: 'Dashboard' })
    ).not.toHaveAttribute('aria-current');

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(breadcrumb).toHaveTextContent('Access');
    expect(within(breadcrumb).getByText('Roles')).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('collapses to icons with tooltips, and expands again', async () => {
    const user = userEvent.setup();
    renderShell('manager');

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    const nav = mainNav();
    const users = within(nav).getByRole('link', { name: 'Users' });
    expect(within(nav).queryByText('Users')).not.toBeInTheDocument();
    expect(within(nav).queryByText('FastAPI RBAC')).not.toBeInTheDocument();

    await user.hover(users);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Users');

    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(within(mainNav()).getByText('Users')).toBeInTheDocument();
  });

  it('remembers the collapsed sidebar in this browser', async () => {
    const user = userEvent.setup();
    const first = renderShell('admin');
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    first.unmount();

    renderShell('admin');
    expect(
      screen.getByRole('button', { name: 'Expand sidebar' })
    ).toBeInTheDocument();
  });
});

describe('Nav links', () => {
  const routes = createRoutesFromElements(appRoutes);

  function isDefinedRoute(path: string) {
    const matches = matchRoutes(routes, path);
    const leaf = matches?.[matches.length - 1];
    return Boolean(leaf) && leaf?.route.path !== '*';
  }

  it('detects an undefined route', () => {
    expect(isDefinedRoute('/dashboard/settings')).toBe(false);
    expect(isDefinedRoute('/dashboard/security')).toBe(false);
  });

  it('every nav item in the model targets a defined route', () => {
    for (const item of allNavItems()) {
      expect({ to: item.to, defined: isDefinedRoute(item.to) }).toEqual({
        to: item.to,
        defined: true,
      });
    }
  });

  it.each([['admin' as const], ['manager' as const], ['user' as const]])(
    'every link the %s shell renders targets a defined route',
    async (role) => {
      const user = userEvent.setup();
      renderShell(role);

      const hrefs = within(mainNav())
        .getAllByRole('link')
        .map((link) => link.getAttribute('href') ?? '');

      await user.click(
        screen.getByRole('button', { name: /^Account menu for/ })
      );
      const menu = await screen.findByRole('menu');
      hrefs.push(
        ...within(menu)
          .getAllByRole('menuitem')
          .map((item) => item.getAttribute('href'))
          .filter((href): href is string => href !== null)
      );

      expect(hrefs.length).toBeGreaterThan(1);
      for (const href of hrefs) {
        expect({ href, defined: isDefinedRoute(href) }).toEqual({
          href,
          defined: true,
        });
      }
    }
  );
});

describe('Mobile drawer', () => {
  it('opens from a named header button and closes when a link is chosen', async () => {
    const user = userEvent.setup();
    renderShell('manager');

    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    const drawer = await screen.findByRole('dialog', { name: 'Main menu' });
    const nav = within(drawer).getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByText('FastAPI RBAC')).toBeInTheDocument();
    expect(
      within(nav).getByRole('link', { name: 'Users' })
    ).toBeInTheDocument();
    expect(
      within(drawer).getByText('manager@fastapi-rbac.example')
    ).toBeInTheDocument();

    await user.click(within(nav).getByRole('link', { name: 'Users' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Main menu' })
      ).not.toBeInTheDocument();
    });
    expect(window.location.pathname).toBe('/dashboard/users');
  });

  it('shows a plain user the same two items in the drawer', async () => {
    const user = userEvent.setup();
    renderShell('user');

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const drawer = await screen.findByRole('dialog', { name: 'Main menu' });

    expect(
      within(drawer)
        .getAllByRole('link')
        .map((link) => link.textContent)
    ).toEqual(['Home', 'Account settings']);
  });
});
