import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import permissionService from '../services/permission.service';
import { page, renderGroupsAt } from './group-test-utils';

vi.mock('../services/auth.service');
vi.mock('../services/dashboard.service');
vi.mock('../services/permission.service');

const mockPermissionService = vi.mocked(permissionService);

function permission(id: string, name: string, description: string) {
  return {
    id,
    name,
    description,
    created_at: '2026-01-12T10:00:00Z',
    updated_at: '2026-01-12T10:00:00Z',
  };
}

// GET /permission-groups returns a flat page joined by permission_group_id.
const permissionGroups = [
  {
    id: 'articles',
    name: 'Articles',
    permission_group_id: 'content',
    created_at: '2026-11-19T10:00:00Z',
    updated_at: '2026-11-19T10:00:00Z',
    permissions: [],
  },
  {
    id: 'content',
    name: 'Content',
    permission_group_id: undefined,
    created_at: '2026-01-12T10:00:00Z',
    updated_at: '2026-01-12T10:00:00Z',
    permissions: [
      permission('p-ca', 'content.create_article', 'Create articles'),
      permission('p-ra', 'content.read_article', 'Read articles'),
    ],
  },
  {
    id: 'user',
    name: 'User',
    permission_group_id: undefined,
    created_at: '2026-01-12T10:00:00Z',
    updated_at: '2026-01-12T10:00:00Z',
    permissions: [permission('p-uc', 'user.create', 'Create users')],
  },
];

function rowFor(name: string) {
  return screen.getByRole('link', { name }).closest('tr') as HTMLElement;
}

describe('Permission groups page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissionService.getPermissionGroups.mockResolvedValue(
      page(permissionGroups) as never
    );
  });

  describe('as an admin', () => {
    it('nests a child group under its parent, with the permissions', async () => {
      renderGroupsAt('/dashboard/permission-groups', 'admin');

      expect(
        await screen.findByRole('heading', {
          name: 'Permission groups',
          level: 1,
        })
      ).toBeVisible();
      const articles = await waitFor(() => rowFor('Articles'));
      expect(within(articles).getAllByRole('cell')[1]).toHaveTextContent(
        'Content'
      );
      expect(
        within(rowFor('Content')).getByText('2 permissions · 1 group')
      ).toBeVisible();
      const names = within(screen.getByRole('table'))
        .getAllByRole('link')
        .map((link) => link.textContent);
      expect(names).toEqual([
        'Content',
        'Articles',
        'content.create_article',
        'content.read_article',
        'User',
        'user.create',
      ]);
      expect(screen.getByText('Create articles')).toBeVisible();
    });

    it('expands and collapses a group', async () => {
      const user = userEvent.setup();
      renderGroupsAt('/dashboard/permission-groups', 'admin');

      await user.click(
        await screen.findByRole('button', { name: 'Collapse Content' })
      );
      expect(
        screen.queryByRole('link', { name: 'Articles' })
      ).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Expand Content' }));
      expect(screen.getByRole('link', { name: 'Articles' })).toBeVisible();
    });

    it('offers create, edit and delete', async () => {
      const user = userEvent.setup();
      renderGroupsAt('/dashboard/permission-groups', 'admin');

      expect(
        await screen.findByRole('link', { name: 'Create permission group' })
      ).toHaveAttribute('href', '/dashboard/permission-groups/new');
      await user.click(
        await screen.findByRole('button', { name: 'Actions for Articles' })
      );
      const items = (await screen.findAllByRole('menuitem')).map(
        (item) => item.textContent
      );
      expect(items).toEqual(['View details', 'Edit', 'Delete']);
    });

    it('deletes a group after confirmation', async () => {
      const user = userEvent.setup();
      mockPermissionService.deletePermissionGroup.mockResolvedValue(
        undefined as never
      );
      renderGroupsAt('/dashboard/permission-groups', 'admin');

      await user.click(
        await screen.findByRole('button', { name: 'Actions for Articles' })
      );
      await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
      const dialog = await screen.findByRole('alertdialog');
      await user.click(
        within(dialog).getByRole('button', { name: 'Delete permission group' })
      );

      await waitFor(() => {
        expect(
          mockPermissionService.deletePermissionGroup
        ).toHaveBeenCalledWith('articles');
      });
      await waitFor(() => {
        expect(mockPermissionService.getPermissionGroups).toHaveBeenCalledTimes(
          2
        );
      });
    });

    it('invites the first group when there are none', async () => {
      mockPermissionService.getPermissionGroups.mockResolvedValue(
        page([]) as never
      );
      renderGroupsAt('/dashboard/permission-groups', 'admin');

      expect(
        await screen.findByRole('heading', {
          name: 'Create your first permission group',
        })
      ).toBeVisible();
      expect(
        screen.getByText('Group permissions by the thing they act on.')
      ).toBeVisible();
    });
  });

  describe('as a manager', () => {
    it('shows the tree read only', async () => {
      const user = userEvent.setup();
      renderGroupsAt('/dashboard/permission-groups', 'manager');

      await waitFor(() => rowFor('Articles'));
      expect(
        screen.queryByRole('link', { name: 'Create permission group' })
      ).not.toBeInTheDocument();
      await user.click(
        screen.getByRole('button', { name: 'Actions for Articles' })
      );
      const items = (await screen.findAllByRole('menuitem')).map(
        (item) => item.textContent
      );
      expect(items).toEqual(['View details']);
    });

    it('sees an empty state without a create button', async () => {
      mockPermissionService.getPermissionGroups.mockResolvedValue(
        page([]) as never
      );
      renderGroupsAt('/dashboard/permission-groups', 'manager');

      expect(
        await screen.findByRole('heading', {
          name: 'No permission groups yet',
        })
      ).toBeVisible();
      expect(
        screen.queryByRole('link', { name: 'Create permission group' })
      ).not.toBeInTheDocument();
    });
  });

  describe('as a user', () => {
    it('cannot open permission groups', async () => {
      renderGroupsAt('/dashboard/permission-groups', 'user');

      expect(
        await screen.findByRole('heading', { name: 'Unauthorized' })
      ).toBeVisible();
      expect(mockPermissionService.getPermissionGroups).not.toHaveBeenCalled();
    });
  });
});
