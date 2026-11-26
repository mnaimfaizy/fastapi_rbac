import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, Route, Routes } from 'react-router-dom';

import MainLayout from '../components/layout/MainLayout';
import { usePageCrumb } from '../components/layout/pageCrumb';
import { renderWithProviders } from './test-utils';
import { signedInAs } from './shell-test-utils';

vi.mock('../services/auth.service');
vi.mock('../services/dashboard.service');

function breadcrumb() {
  return screen.getByRole('navigation', { name: 'Breadcrumb' });
}

/** A page that names its own trail after the nav item. */
function NamedPage({ crumb }: { crumb: Parameters<typeof usePageCrumb>[0] }) {
  usePageCrumb(crumb);
  return (
    <>
      <h1>Named page</h1>
      <Link to="/dashboard/roles">Back to roles</Link>
    </>
  );
}

function RolesList() {
  return <h1>Roles list</h1>;
}

function renderShellAt(
  path: string,
  crumb: Parameters<typeof usePageCrumb>[0]
) {
  window.history.pushState({}, '', path);
  return renderWithProviders(
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/dashboard/roles" element={<RolesList />} />
        <Route
          path="/dashboard/roles/:roleId/*"
          element={<NamedPage crumb={crumb} />}
        />
        <Route path="*" element={<NamedPage crumb={crumb} />} />
      </Route>
    </Routes>,
    { preloadedState: signedInAs('admin') }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  window.history.pushState({}, '', '/');
});

describe('a page naming its own breadcrumb steps', () => {
  it('ends the breadcrumb with the one step the page names', async () => {
    renderShellAt('/dashboard/roles/r1', 'Manager');

    await waitFor(() =>
      expect(within(breadcrumb()).getByText('Manager')).toHaveAttribute(
        'aria-current',
        'page'
      )
    );
    expect(breadcrumb()).toHaveTextContent(/^Access\s*Roles\s*Manager$/);
    expect(
      within(breadcrumb()).getByRole('link', { name: 'Roles' })
    ).toHaveAttribute('href', '/dashboard/roles');
  });

  it('shows every step of a trail, the last one current', async () => {
    renderShellAt('/dashboard/roles/r1/edit', ['Manager', 'Edit']);

    await waitFor(() =>
      expect(within(breadcrumb()).getByText('Edit')).toHaveAttribute(
        'aria-current',
        'page'
      )
    );
    expect(breadcrumb()).toHaveTextContent(/^Access\s*Roles\s*Manager\s*Edit$/);
    expect(within(breadcrumb()).getByText('Manager')).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('leaves out blank steps, such as a name still loading', async () => {
    renderShellAt('/dashboard/roles/r1/edit', [null, 'Edit']);

    await waitFor(() =>
      expect(within(breadcrumb()).getByText('Edit')).toHaveAttribute(
        'aria-current',
        'page'
      )
    );
    expect(breadcrumb()).toHaveTextContent(/^Access\s*Roles\s*Edit$/);
  });

  it('drops the steps when the page that named them goes away', async () => {
    const user = userEvent.setup();
    renderShellAt('/dashboard/roles/r1', 'Manager');
    await waitFor(() =>
      expect(within(breadcrumb()).getByText('Manager')).toBeInTheDocument()
    );

    await user.click(screen.getByRole('link', { name: 'Back to roles' }));

    await screen.findByRole('heading', { name: 'Roles list' });
    expect(breadcrumb()).toHaveTextContent(/^Access\s*Roles$/);
    expect(within(breadcrumb()).getByText('Roles')).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('shows a standalone step when no nav item matches the page', async () => {
    renderShellAt('/dashboard/no-such-page', 'Not found');

    await waitFor(() =>
      expect(within(breadcrumb()).getByText('Not found')).toHaveAttribute(
        'aria-current',
        'page'
      )
    );
    expect(breadcrumb()).toHaveTextContent(/^Not found$/);
    expect(within(breadcrumb()).queryByRole('link')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(document.title).toBe('Not found | FastAPI RBAC')
    );
  });

  it('shows no breadcrumb when no nav item matches and the page names none', async () => {
    renderShellAt('/dashboard/no-such-page', null);

    await screen.findByRole('heading', { name: 'Named page' });
    expect(
      screen.queryByRole('navigation', { name: 'Breadcrumb' })
    ).not.toBeInTheDocument();
  });
});
