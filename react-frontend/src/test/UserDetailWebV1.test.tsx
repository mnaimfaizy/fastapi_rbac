import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import { renderWithProviders } from './test-utils';
import UserDetailContent from '../features/users/UserDetailContent';
import userService from '../services/user.service';
import authService from '../services/auth.service';
import { roleService } from '../services/role.service';
import roleGroupService from '../services/roleGroup.service';
import type { User } from '../models/user';
import {
  HANNAH,
  MARCUS,
  NORA,
  ROLE_CATALOG,
  ROLE_GROUPS_RESPONSE,
  at,
  viewerState,
  type ViewerKind,
} from './user-pages-test-utils';

vi.mock('../services/user.service');
vi.mock('../services/auth.service', () => ({
  default: { resendVerificationEmail: vi.fn() },
}));
vi.mock('../services/role.service', () => ({
  roleService: { getAllRoles: vi.fn() },
}));
vi.mock('../services/roleGroup.service', () => ({
  default: { getRoleGroups: vi.fn() },
}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

const mockUserService = vi.mocked(userService);
const mockAuthService = vi.mocked(authService);
const mockRoleService = vi.mocked(roleService);
const mockRoleGroupService = vi.mocked(roleGroupService);

async function renderDetail(
  target: User,
  viewer: ViewerKind | ReturnType<typeof viewerState> = 'admin'
) {
  mockUserService.getUserById.mockResolvedValue(target);
  const result = renderWithProviders(
    at(
      `/dashboard/users/${target.id}`,
      <Routes>
        <Route path="/dashboard/users" element={<p>Users list</p>} />
        <Route
          path="/dashboard/users/:userId"
          element={<UserDetailContent />}
        />
        <Route
          path="/dashboard/users/:userId/edit"
          element={<p>Edit page</p>}
        />
      </Routes>
    ),
    {
      preloadedState: typeof viewer === 'string' ? viewerState(viewer) : viewer,
    }
  );
  await screen.findByRole('heading', {
    level: 1,
    name: `${target.first_name} ${target.last_name}`,
  });
  return result;
}

function panel(name: string) {
  return screen.getByRole('region', { name });
}

function fact(region: HTMLElement, label: string) {
  const term = within(region).getByText(label, { selector: 'dt' });
  return term.nextElementSibling as HTMLElement;
}

describe('User detail (Web v1)', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleService.getAllRoles.mockResolvedValue({
      data: ROLE_CATALOG,
      message: 'ok',
      meta: {},
    });
    mockRoleGroupService.getRoleGroups.mockResolvedValue(
      ROLE_GROUPS_RESPONSE as never
    );
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  describe('as an admin', () => {
    it('shows basic information, account status, password and security, and roles', async () => {
      await renderDetail(MARCUS);

      expect(
        screen.getByText('marcus.webb@example.com', { selector: 'p' })
      ).toBeInTheDocument();
      const basic = panel('Basic information');
      expect(fact(basic, 'First name')).toHaveTextContent('Marcus');
      expect(fact(basic, 'Last name')).toHaveTextContent('Webb');
      expect(fact(basic, 'Phone')).toHaveTextContent('+61 412 555 018');
      expect(fact(basic, 'Created')).toHaveTextContent('Mar 3, 2026');

      const password = panel('Password and security');
      expect(fact(password, 'Last changed')).toHaveTextContent('Sep 2, 2026');
      expect(fact(password, 'Expires')).toHaveTextContent('Dec 1, 2026');
      expect(
        fact(password, 'Change required at next sign-in')
      ).toHaveTextContent('No');
      expect(fact(password, 'Last sign-in')).toHaveTextContent('—');

      const status = panel('Account status');
      expect(
        within(status).getByText('Locked until 15 Nov 2026, 14:32 UTC')
      ).toBeInTheDocument();
      expect(
        within(status).getByText('After 5 failed sign-in attempts.')
      ).toBeInTheDocument();
      expect(fact(status, 'Failed sign-in attempts')).toHaveTextContent('5');
      expect(fact(status, 'Email')).toHaveTextContent('Verified');
      expect(fact(status, 'Account')).toHaveTextContent('Active');
      expect(fact(status, 'Superuser')).toHaveTextContent('No');
      // The Locked badge sits beside the name.
      expect(screen.getAllByText('Locked').length).toBeGreaterThan(0);
      // No unlock: the API has no way to unlock an account.
      expect(
        screen.queryByRole('button', { name: /unlock/i })
      ).not.toBeInTheDocument();
      // A verified user gets no resend.
      expect(
        screen.queryByRole('button', { name: 'Resend verification email' })
      ).not.toBeInTheDocument();
    });

    it('lists each held role with what it grants, by permission group', async () => {
      await renderDetail(MARCUS);

      const roles = panel('Roles');
      expect(
        await within(roles).findByText('Operational · grants 15 permissions')
      ).toBeInTheDocument();
      expect(
        within(roles).getByRole('link', { name: 'View role Manager' })
      ).toHaveAttribute('href', '/dashboard/roles/role-manager');
      const userGroup = within(roles).getByRole('group', {
        name: 'Manager: User',
      });
      expect(userGroup).toHaveTextContent('user.create');
      expect(userGroup).toHaveTextContent('user.read');
      expect(userGroup).toHaveTextContent('user.update');
      expect(
        within(roles).getByRole('group', { name: 'Manager: Content' })
      ).toHaveTextContent('content.delete_article');
    });

    it('makes Edit user the secondary action and puts Delete in the "…" menu', async () => {
      await renderDetail(MARCUS);

      expect(screen.getByRole('link', { name: 'Edit user' })).toHaveAttribute(
        'href',
        '/dashboard/users/u-marcus/edit'
      );
      expect(
        screen.queryByRole('button', { name: /delete/i })
      ).not.toBeInTheDocument();
      await user.click(
        screen.getByRole('button', { name: 'More actions for Marcus Webb' })
      );
      expect(
        screen.getByRole('menuitem', { name: 'Delete user' })
      ).toBeInTheDocument();
    });

    it('resends verification for a Pending user with the neutral toast', async () => {
      mockAuthService.resendVerificationEmail.mockResolvedValue(undefined);
      await renderDetail(HANNAH);

      const status = panel('Account status');
      expect(
        within(status).getByText(
          'Hannah hasn’t confirmed their email address yet, so they can’t sign in.'
        )
      ).toBeInTheDocument();
      expect(fact(status, 'Email')).toHaveTextContent('Pending');
      expect(
        fact(panel('Password and security'), 'Change required at next sign-in')
      ).toHaveTextContent('Yes');

      await user.click(
        within(status).getByRole('button', {
          name: 'Resend verification email',
        })
      );

      expect(mockAuthService.resendVerificationEmail).toHaveBeenCalledWith(
        'hannah.lindqvist@example.com'
      );
      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          'If this account still needs verifying, an email is on its way.',
          expect.anything()
        )
      );
    });

    it('says only that it couldn’t send when the resend request fails', async () => {
      mockAuthService.resendVerificationEmail.mockRejectedValue(
        new Error('Network Error')
      );
      await renderDetail(HANNAH);

      await user.click(
        screen.getByRole('button', { name: 'Resend verification email' })
      );

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          'Couldn’t send the email. Try again.'
        )
      );
      expect(toast).not.toHaveBeenCalled();
    });

    it('deletes a user who holds no role from the menu, naming them, and returns to the list', async () => {
      mockUserService.deleteUser.mockResolvedValue(undefined);
      await renderDetail(NORA);

      await user.click(
        screen.getByRole('button', { name: 'More actions for Nora Free' })
      );
      await user.click(screen.getByRole('menuitem', { name: 'Delete user' }));

      const dialog = screen.getByRole('alertdialog', {
        name: 'Delete user ‘Nora Free’?',
      });
      expect(dialog).toHaveTextContent(
        'Nora loses access straight away and is signed out everywhere.'
      );
      expect(dialog).toHaveTextContent('This can’t be undone.');
      await user.click(
        within(dialog).getByRole('button', { name: 'Delete user' })
      );

      expect(mockUserService.deleteUser).toHaveBeenCalledWith('u-nora');
      expect(await screen.findByText('Users list')).toBeInTheDocument();
      expect(toast.success).toHaveBeenCalledWith('User deleted');
    });

    it('keeps the dialog open and reports a refused delete', async () => {
      mockUserService.deleteUser.mockRejectedValue(
        new Error('You cannot change or remove a superuser.')
      );
      await renderDetail(NORA);

      await user.click(
        screen.getByRole('button', { name: 'More actions for Nora Free' })
      );
      await user.click(screen.getByRole('menuitem', { name: 'Delete user' }));
      const dialog = screen.getByRole('alertdialog');
      await user.click(
        within(dialog).getByRole('button', { name: 'Delete user' })
      );

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          'You cannot change or remove a superuser.'
        )
      );
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      expect(screen.queryByText('Users list')).not.toBeInTheDocument();
    });

    it('sends a role holder to the edit page instead of a delete the API refuses', async () => {
      await renderDetail(MARCUS);

      await user.click(
        screen.getByRole('button', { name: 'More actions for Marcus Webb' })
      );
      await user.click(screen.getByRole('menuitem', { name: 'Delete user' }));
      const dialog = screen.getByRole('alertdialog', {
        name: 'Remove Marcus Webb’s roles first',
      });
      await user.click(
        within(dialog).getByRole('button', { name: 'Edit user' })
      );

      expect(mockUserService.deleteUser).not.toHaveBeenCalled();
      expect(await screen.findByText('Edit page')).toBeInTheDocument();
    });

    it('offers no Delete for a role holder without role.read, whose roles the edit page couldn’t list', async () => {
      const state = viewerState('admin');
      const noRoleRead = {
        auth: {
          ...state.auth,
          user: {
            ...state.auth.user,
            permissions: state.auth.user.permissions.filter(
              (code) => code !== 'role.read'
            ),
          },
        },
      };
      await renderDetail(MARCUS, noRoleRead);
      expect(
        screen.queryByRole('button', { name: /^More actions for/ })
      ).not.toBeInTheDocument();
    });

    it('still offers Delete for a user with no roles without role.read', async () => {
      const state = viewerState('admin');
      await renderDetail(NORA, {
        auth: {
          ...state.auth,
          user: {
            ...state.auth.user,
            permissions: state.auth.user.permissions.filter(
              (code) => code !== 'role.read'
            ),
          },
        },
      });
      expect(
        screen.getByRole('button', { name: 'More actions for Nora Free' })
      ).toBeInTheDocument();
    });

    it('offers no Delete on the viewer’s own page', async () => {
      await renderDetail({ ...NORA, id: 'viewer-admin' });

      expect(
        screen.queryByRole('button', { name: /^More actions for/ })
      ).not.toBeInTheDocument();
    });
  });

  describe('as a manager', () => {
    it('offers Edit user but no Delete, without user.delete', async () => {
      await renderDetail(NORA, 'manager');

      expect(
        screen.getByRole('link', { name: 'Edit user' })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /^More actions for/ })
      ).not.toBeInTheDocument();
    });

    it('can resend verification for a Pending user', async () => {
      mockAuthService.resendVerificationEmail.mockResolvedValue(undefined);
      await renderDetail(HANNAH, 'manager');

      await user.click(
        screen.getByRole('button', { name: 'Resend verification email' })
      );
      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          'If this account still needs verifying, an email is on its way.',
          expect.anything()
        )
      );
    });
  });

  describe('as a plain user', () => {
    it('shows no actions and no role catalog lookups', async () => {
      // The route needs user.read, which the seeded User role lacks; this
      // checks the page itself hides every action from such a viewer.
      await renderDetail(MARCUS, 'user');

      expect(
        screen.queryByRole('link', { name: 'Edit user' })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /^More actions for/ })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /^View role/ })
      ).not.toBeInTheDocument();
      expect(mockRoleService.getAllRoles).not.toHaveBeenCalled();
      // The held role is still named.
      expect(within(panel('Roles')).getByText('Manager')).toBeInTheDocument();
    });
  });
});
