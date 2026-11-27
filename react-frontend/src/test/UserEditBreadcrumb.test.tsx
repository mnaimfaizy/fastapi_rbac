import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';

import MainLayout from '../components/layout/MainLayout';
import UserEditPage from '../features/users/UserEditPage';
import userService from '../services/user.service';
import { roleService } from '../services/role.service';
import { renderWithProviders } from './test-utils';
import { signedInAs } from './shell-test-utils';
import { ROLE_CATALOG, at, makeUser } from './user-pages-test-utils';

vi.mock('../services/auth.service');
vi.mock('../services/user.service');
vi.mock('../services/role.service', () => ({
  roleService: { getAllRoles: vi.fn() },
}));

const mockUserService = vi.mocked(userService);
const mockRoleService = vi.mocked(roleService);

const DANIEL = makeUser({
  id: 'u-daniel',
  first_name: 'Daniel',
  last_name: 'Okafor',
  email: 'daniel.okafor@example.com',
});

function renderShellAt(path: string) {
  return renderWithProviders(
    at(
      path,
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/dashboard/users/new" element={<UserEditPage />} />
          <Route
            path="/dashboard/users/:userId/edit"
            element={<UserEditPage />}
          />
        </Route>
      </Routes>
    ),
    { preloadedState: signedInAs('admin') }
  );
}

function breadcrumb() {
  return screen.getByRole('navigation', { name: 'Breadcrumb' });
}

describe('Edit user breadcrumb and tab title', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleService.getAllRoles.mockResolvedValue({
      data: ROLE_CATALOG,
      message: 'ok',
      meta: {},
    });
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('ends the trail with the user’s name, then Edit', async () => {
    mockUserService.getUserById.mockResolvedValue(DANIEL);
    renderShellAt('/dashboard/users/u-daniel/edit');

    await waitFor(() =>
      expect(breadcrumb()).toHaveTextContent(
        /^Access\s*Users\s*Daniel Okafor\s*Edit$/
      )
    );
    expect(within(breadcrumb()).getByText('Edit')).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(within(breadcrumb()).getByText('Daniel Okafor')).not.toHaveAttribute(
      'aria-current'
    );
    await waitFor(() =>
      expect(document.title).toBe('Edit · Daniel Okafor · Users | FastAPI RBAC')
    );
  });

  it('names no lone Edit step while there is no user', async () => {
    mockUserService.getUserById.mockRejectedValue(new Error('User not found'));
    renderShellAt('/dashboard/users/u-gone/edit');

    await screen.findByText('This user didn’t load');
    expect(breadcrumb()).toHaveTextContent(/^Access\s*Users$/);
    await waitFor(() =>
      expect(document.title).toBe('Edit user · Users | FastAPI RBAC')
    );
  });

  it('keeps Add user as the one step on the create page', async () => {
    renderShellAt('/dashboard/users/new');

    await waitFor(() =>
      expect(breadcrumb()).toHaveTextContent(/^Access\s*Users\s*Add user$/)
    );
  });
});
