import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import roleGroupService from '../services/roleGroup.service';
import { roleService } from '../services/role.service';
import { page, renderGroupsAt } from './group-test-utils';

vi.mock('../services/auth.service');
vi.mock('../services/dashboard.service');
vi.mock('../services/roleGroup.service');
vi.mock('../services/role.service');

const mockRoleGroupService = vi.mocked(roleGroupService);
const mockRoleService = vi.mocked(roleService);

const support = {
  id: 'support',
  name: 'Support',
  parent_id: 'ops',
  created_at: '2026-11-19T10:00:00Z',
  children: [],
};

// GET /role-groups returns root groups with their children nested.
const roleGroups = [
  {
    id: 'admin-group',
    name: 'Administrative',
    parent_id: null,
    created_at: '2026-01-12T10:00:00Z',
    children: [],
  },
  {
    id: 'ops',
    name: 'Operational',
    parent_id: null,
    created_at: '2026-01-12T10:00:00Z',
    children: [support],
  },
];

const roles = [
  {
    id: 'r-admin',
    name: 'Admin',
    role_group_id: 'admin-group',
    created_at: '2026-01-12T10:00:00Z',
    updated_at: '2026-01-12T10:00:00Z',
    user_count: 3,
  },
  {
    id: 'r-manager',
    name: 'Manager',
    role_group_id: 'ops',
    created_at: '2026-01-12T10:00:00Z',
    updated_at: '2026-01-12T10:00:00Z',
    user_count: 8,
  },
];

function rowFor(name: string) {
  return screen.getByRole('link', { name }).closest('tr') as HTMLElement;
}

describe('Role groups page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleGroupService.getRoleGroups.mockResolvedValue(
      page(roleGroups) as never
    );
    mockRoleService.getRoles.mockResolvedValue(page(roles) as never);
  });

  describe('as an admin', () => {
    it('shows the tree with each child group under its parent', async () => {
      renderGroupsAt('/dashboard/role-groups', 'admin');

      expect(
        await screen.findByRole('heading', { name: 'Role groups', level: 1 })
      ).toBeVisible();
      const supportRow = await waitFor(() => rowFor('Support'));
      expect(within(supportRow).getAllByRole('cell')[1]).toHaveTextContent(
        'Operational'
      );
      const names = within(screen.getByRole('table'))
        .getAllByRole('link')
        .map((link) => link.textContent);
      // Each group, then its child groups, then its roles.
      expect(names).toEqual([
        'Administrative',
        'Admin',
        'Operational',
        'Support',
        'Manager',
      ]);
    });

    it('lists each group’s roles with their user counts', async () => {
      renderGroupsAt('/dashboard/role-groups', 'admin');

      await waitFor(() => rowFor('Operational'));
      expect(
        within(rowFor('Operational')).getByText('1 role · 1 group')
      ).toBeVisible();
      expect(screen.getByText('Manager')).toBeVisible();
      expect(screen.getByText('8 users')).toBeVisible();
      expect(screen.getByText('3 users')).toBeVisible();
      expect(mockRoleService.getRoles).toHaveBeenCalled();
    });

    it('offers create, edit and delete', async () => {
      const user = userEvent.setup();
      renderGroupsAt('/dashboard/role-groups', 'admin');

      expect(
        await screen.findByRole('link', { name: 'Create role group' })
      ).toHaveAttribute('href', '/dashboard/role-groups/new');
      await user.click(
        await screen.findByRole('button', { name: 'Actions for Support' })
      );
      const items = (await screen.findAllByRole('menuitem')).map(
        (item) => item.textContent
      );
      expect(items).toEqual(['View details', 'Edit', 'Delete']);
    });

    it('deletes a group after confirmation', async () => {
      const user = userEvent.setup();
      mockRoleGroupService.deleteRoleGroup.mockResolvedValue(undefined);
      renderGroupsAt('/dashboard/role-groups', 'admin');

      await user.click(
        await screen.findByRole('button', { name: 'Actions for Support' })
      );
      await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
      const dialog = await screen.findByRole('alertdialog');
      expect(
        within(dialog).getByRole('heading', {
          name: 'Delete role group ‘Support’?',
        })
      ).toBeVisible();
      await user.click(
        within(dialog).getByRole('button', { name: 'Delete role group' })
      );

      await waitFor(() => {
        expect(mockRoleGroupService.deleteRoleGroup).toHaveBeenCalledWith(
          'support'
        );
      });
      await waitFor(() => {
        expect(mockRoleGroupService.getRoleGroups).toHaveBeenCalledTimes(2);
      });
    });

    it('invites the first group when there are none', async () => {
      mockRoleGroupService.getRoleGroups.mockResolvedValue(page([]) as never);
      renderGroupsAt('/dashboard/role-groups', 'admin');

      expect(
        await screen.findByRole('heading', {
          name: 'Create your first role group',
        })
      ).toBeVisible();
      expect(
        screen.getAllByRole('link', { name: 'Create role group' })
      ).toHaveLength(2);
    });
  });

  describe('as a manager', () => {
    it('shows the tree read only', async () => {
      const user = userEvent.setup();
      renderGroupsAt('/dashboard/role-groups', 'manager');

      await waitFor(() => rowFor('Support'));
      expect(
        screen.queryByRole('link', { name: 'Create role group' })
      ).not.toBeInTheDocument();
      await user.click(
        screen.getByRole('button', { name: 'Actions for Support' })
      );
      const items = (await screen.findAllByRole('menuitem')).map(
        (item) => item.textContent
      );
      expect(items).toEqual(['View details']);
    });

    it('sees an empty state without a create button', async () => {
      mockRoleGroupService.getRoleGroups.mockResolvedValue(page([]) as never);
      renderGroupsAt('/dashboard/role-groups', 'manager');

      expect(
        await screen.findByRole('heading', { name: 'No role groups yet' })
      ).toBeVisible();
      expect(
        screen.getByText(
          'An admin can create role groups. They’ll show up here.'
        )
      ).toBeVisible();
      expect(
        screen.queryByRole('link', { name: 'Create role group' })
      ).not.toBeInTheDocument();
    });
  });

  describe('as a user', () => {
    it('cannot open role groups', async () => {
      renderGroupsAt('/dashboard/role-groups', 'user');

      expect(
        await screen.findByRole('heading', { name: 'Unauthorized' })
      ).toBeVisible();
      expect(mockRoleGroupService.getRoleGroups).not.toHaveBeenCalled();
    });
  });

  describe('when loading fails', () => {
    it('shows the error with a retry, not the first-run empty state', async () => {
      const user = userEvent.setup();
      mockRoleGroupService.getRoleGroups.mockRejectedValueOnce(
        new Error('Network Error')
      );
      renderGroupsAt('/dashboard/role-groups', 'admin');

      expect(
        await screen.findByText('Couldn’t load role groups')
      ).toBeVisible();
      expect(
        screen.queryByRole('heading', { name: 'Create your first role group' })
      ).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(
        await screen.findByRole('link', { name: 'Support' })
      ).toBeVisible();
      expect(
        screen.queryByText('Couldn’t load role groups')
      ).not.toBeInTheDocument();
    });
  });

  describe('with more roles than one page holds', () => {
    it('reads every page of roles', async () => {
      const first = page([roles[0]]);
      mockRoleService.getRoles.mockImplementation((async (params?: {
        page?: number;
      }) =>
        params?.page === 2
          ? {
              ...page([roles[1]]),
              data: { ...page([roles[1]]).data, page: 2, pages: 2 },
            }
          : { ...first, data: { ...first.data, pages: 2 } }) as never);
      renderGroupsAt('/dashboard/role-groups', 'admin');

      expect(await screen.findByText('8 users')).toBeVisible();
      expect(screen.getByText('3 users')).toBeVisible();
      expect(mockRoleService.getRoles).toHaveBeenCalledWith({
        page: 2,
        size: 100,
      });
    });
  });
});
