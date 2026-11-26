import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import roleGroupService from '../services/roleGroup.service';
import { roleService } from '../services/role.service';
import permissionService from '../services/permission.service';
import { page, renderGroupsAt } from './group-test-utils';

vi.mock('../services/auth.service');
vi.mock('../services/dashboard.service');
vi.mock('../services/roleGroup.service');
vi.mock('../services/role.service');
vi.mock('../services/permission.service');

const mockRoleGroupService = vi.mocked(roleGroupService);
const mockRoleService = vi.mocked(roleService);
const mockPermissionService = vi.mocked(permissionService);

const at = '2026-01-12T10:00:00Z';

function ok(data: unknown) {
  return { message: 'ok', meta: {}, data } as never;
}

function group(id: string, name: string, description: string | null = null) {
  return {
    id,
    name,
    description,
    created_at: at,
    updated_at: at,
    children: [],
    permissions: [],
    roles: [],
  };
}

// What differs between the two kinds of group: the route, the button, and
// which service calls the form makes with which parent field.
const kinds = [
  {
    kind: 'role group',
    path: '/dashboard/role-groups',
    permissions: ['role_group.create', 'role_group.update'],
    mockGroup: (data: ReturnType<typeof group>) => {
      mockRoleGroupService.getRoleGroups.mockResolvedValue(
        page([data]) as never
      );
      mockRoleGroupService.getRoleGroupById.mockResolvedValue(ok(data));
      mockRoleGroupService.createRoleGroup.mockResolvedValue(ok(data));
      mockRoleGroupService.updateRoleGroup.mockResolvedValue(ok(data));
    },
    created: () => mockRoleGroupService.createRoleGroup,
    updated: () => mockRoleGroupService.updateRoleGroup,
    body: (name: string, description: string | null) => ({
      name,
      parent_id: null,
      description,
    }),
  },
  {
    kind: 'permission group',
    path: '/dashboard/permission-groups',
    permissions: ['permission_group.create', 'permission_group.update'],
    mockGroup: (data: ReturnType<typeof group>) => {
      mockPermissionService.getPermissionGroups.mockResolvedValue(
        page([data]) as never
      );
      mockPermissionService.getPermissionGroupById.mockResolvedValue(ok(data));
      mockPermissionService.createPermissionGroup.mockResolvedValue(ok(data));
      mockPermissionService.updatePermissionGroup.mockResolvedValue(ok(data));
    },
    created: () => mockPermissionService.createPermissionGroup,
    updated: () => mockPermissionService.updatePermissionGroup,
    body: (name: string, description: string | null) => ({
      name,
      permission_group_id: null,
      description,
    }),
  },
];

const descriptionField = () =>
  screen.findByRole('textbox', { name: 'Description (optional)' });

describe.each(kinds)(
  'The $kind form’s description',
  ({ kind, path, permissions, mockGroup, created, updated, body }) => {
    const submitCreate = `Create ${kind}`;

    beforeEach(() => {
      vi.clearAllMocks();
      mockRoleService.getRoles.mockResolvedValue(page([]) as never);
      mockGroup(group('support', 'Support', 'The support team'));
    });

    // The seeded Admin may create groups; the seeded Manager may not, so
    // the manager here has been given the create permission.
    describe.each([
      { viewer: 'admin' as const, extra: [] },
      { viewer: 'manager' as const, extra: permissions },
    ])('as a $viewer who can create groups', ({ viewer, extra }) => {
      it('saves what was typed, trimmed', async () => {
        const user = userEvent.setup();
        renderGroupsAt(`${path}/new`, viewer, extra);

        const field = await descriptionField();
        expect(field).toHaveValue('');
        await user.type(
          screen.getByRole('textbox', { name: 'Name' }),
          'Billing'
        );
        await user.type(field, '  Roles for the billing team  ');
        await user.click(screen.getByRole('button', { name: submitCreate }));

        await waitFor(() => {
          expect(created()).toHaveBeenCalledWith(
            body('Billing', 'Roles for the billing team')
          );
        });
      });
    });

    it('saves no description when the field is left blank', async () => {
      const user = userEvent.setup();
      renderGroupsAt(`${path}/new`, 'admin');

      await user.type(await descriptionField(), '   ');
      await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Billing');
      await user.click(screen.getByRole('button', { name: submitCreate }));

      await waitFor(() => {
        expect(created()).toHaveBeenCalledWith(body('Billing', null));
      });
    });

    it('refuses more than 255 characters', async () => {
      const user = userEvent.setup();
      renderGroupsAt(`${path}/new`, 'admin');

      const field = await descriptionField();
      await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Billing');
      await user.click(field);
      await user.paste('x'.repeat(256));
      await user.click(screen.getByRole('button', { name: submitCreate }));

      expect(
        await screen.findByText('Use 255 characters or fewer')
      ).toBeVisible();
      expect(field).toHaveAccessibleDescription('Use 255 characters or fewer');
      expect(created()).not.toHaveBeenCalled();
    });

    it('counts characters as the API does, not UTF-16 units', async () => {
      const user = userEvent.setup();
      renderGroupsAt(`${path}/new`, 'admin');

      const field = await descriptionField();
      await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Billing');
      await user.click(field);
      // 255 characters, 510 UTF-16 units.
      await user.paste('\u{1F512}'.repeat(255));
      await user.click(screen.getByRole('button', { name: submitCreate }));

      await waitFor(() => {
        expect(created()).toHaveBeenCalledWith(
          body('Billing', '\u{1F512}'.repeat(255))
        );
      });
    });

    it('shows the saved description on edit and saves a new one', async () => {
      const user = userEvent.setup();
      renderGroupsAt(`${path}/edit/support`, 'admin');

      const field = await descriptionField();
      expect(field).toHaveValue('The support team');
      await user.clear(field);
      await user.type(field, 'Second line support');
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      await waitFor(() => {
        expect(updated()).toHaveBeenCalledWith(
          'support',
          body('Support', 'Second line support')
        );
      });
    });

    it('clears the description when the field is emptied', async () => {
      const user = userEvent.setup();
      renderGroupsAt(`${path}/edit/support`, 'admin');

      await user.clear(await descriptionField());
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      await waitFor(() => {
        expect(updated()).toHaveBeenCalledWith(
          'support',
          body('Support', null)
        );
      });
    });

    it('shows an empty field for a group with no description', async () => {
      mockGroup(group('support', 'Support'));
      renderGroupsAt(`${path}/edit/support`, 'admin');

      expect(await descriptionField()).toHaveValue('');
    });

    it.each([
      ['manager', 'new'],
      ['manager', 'edit/support'],
      ['user', 'new'],
      ['user', 'edit/support'],
    ] as const)(
      'is out of reach for a seeded %s at %s',
      async (viewer, route) => {
        renderGroupsAt(`${path}/${route}`, viewer);

        const action = route === 'new' ? 'create' : 'edit';
        expect(
          await screen.findByRole('heading', {
            name: `You can’t ${action} ${kind}s`,
          })
        ).toBeVisible();
        expect(
          screen.queryByRole('textbox', { name: 'Description (optional)' })
        ).not.toBeInTheDocument();
      }
    );
  }
);
