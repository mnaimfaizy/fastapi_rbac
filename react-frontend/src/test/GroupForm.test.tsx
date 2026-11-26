import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
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

// The create tests fill the form, save, and wait for the list to render
// through the real routes and shell, which is slow under a full-suite run.

function roleGroup(id: string, name: string, parent_id: string | null = null) {
  return { id, name, parent_id, created_at: at, children: [] };
}

const administrative = roleGroup('admin-group', 'Administrative');
const operational = roleGroup('ops', 'Operational');
const standard = roleGroup('std', 'StandardUser');

function rowFor(name: string) {
  return screen.getByRole('link', { name }).closest('tr') as HTMLElement;
}

async function chooseParent(
  user: ReturnType<typeof userEvent.setup>,
  search: string,
  option: string
) {
  await user.click(screen.getByRole('combobox', { name: 'Parent group' }));
  await user.type(await screen.findByPlaceholderText('Search groups'), search);
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('Group form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoleService.getRoles.mockResolvedValue(page([]) as never);
    mockRoleGroupService.getRoleGroups.mockResolvedValue(
      page([administrative, operational, standard]) as never
    );
  });

  describe('role groups, as an admin', () => {
    it(
      'creates a child group that shows under its parent',
      { timeout: 30_000 },
      async () => {
        const user = userEvent.setup();
        const support = roleGroup('support', 'Support', 'ops');
        mockRoleGroupService.createRoleGroup.mockResolvedValue({
          message: 'ok',
          meta: {},
          data: support,
        } as never);
        renderGroupsAt('/dashboard/role-groups/new', 'admin');

        expect(
          await screen.findByRole('heading', { name: 'Create role group' })
        ).toBeVisible();
        await user.type(
          screen.getByRole('textbox', { name: 'Name' }),
          'Support'
        );
        expect(
          screen.getByRole('combobox', { name: 'Parent group' })
        ).toHaveTextContent('No parent');
        await chooseParent(user, 'Oper', 'Operational');
        expect(
          screen.getByRole('combobox', { name: 'Parent group' })
        ).toHaveTextContent('Operational');

        // After the save, the list comes back with Support nested.
        mockRoleGroupService.getRoleGroups.mockResolvedValue(
          page([
            administrative,
            { ...operational, children: [support] },
            standard,
          ]) as never
        );
        await user.click(
          screen.getByRole('button', { name: 'Create role group' })
        );

        expect(mockRoleGroupService.createRoleGroup).toHaveBeenCalledWith({
          name: 'Support',
          parent_id: 'ops',
          description: null,
        });
        expect(
          await screen.findByRole(
            'heading',
            { name: 'Role groups', level: 1 },
            { timeout: 5000 }
          )
        ).toBeVisible();
        const supportRow = await waitFor(() => rowFor('Support'), {
          timeout: 5000,
        });
        expect(within(supportRow).getAllByRole('cell')[1]).toHaveTextContent(
          'Operational'
        );
        expect(
          within(rowFor('Operational')).getByText('0 roles · 1 group')
        ).toBeVisible();
      }
    );

    it('searches the parent groups by name', async () => {
      const user = userEvent.setup();
      renderGroupsAt('/dashboard/role-groups/new', 'admin');

      await user.click(
        await screen.findByRole('combobox', { name: 'Parent group' })
      );
      await user.type(
        await screen.findByPlaceholderText('Search groups'),
        'Oper'
      );

      const options = screen
        .getAllByRole('option')
        .map((option) => option.textContent);
      expect(options).toEqual(['No parent', 'Operational']);
      expect(screen.getByText('1 of 3 groups match')).toBeVisible();
    });

    it('creates a top-level group with no parent', async () => {
      const user = userEvent.setup();
      mockRoleGroupService.createRoleGroup.mockResolvedValue({
        message: 'ok',
        meta: {},
        data: roleGroup('finance', 'Finance'),
      } as never);
      renderGroupsAt('/dashboard/role-groups/new', 'admin');

      await user.type(
        await screen.findByRole('textbox', { name: 'Name' }),
        'Finance'
      );
      await user.click(
        screen.getByRole('button', { name: 'Create role group' })
      );

      await waitFor(() => {
        expect(mockRoleGroupService.createRoleGroup).toHaveBeenCalledWith({
          name: 'Finance',
          parent_id: null,
          description: null,
        });
      });
    });

    it('asks for a name', async () => {
      const user = userEvent.setup();
      renderGroupsAt('/dashboard/role-groups/new', 'admin');

      await user.click(
        await screen.findByRole('button', { name: 'Create role group' })
      );

      expect(await screen.findByText('Enter a name')).toBeVisible();
      expect(mockRoleGroupService.createRoleGroup).not.toHaveBeenCalled();
    });

    it('edits a group without offering it or its children as a parent', async () => {
      const user = userEvent.setup();
      const support = roleGroup('support', 'Support', 'ops');
      const tier2 = roleGroup('tier2', 'Tier 2', 'support');
      mockRoleGroupService.getRoleGroups.mockResolvedValue(
        page([
          administrative,
          {
            ...operational,
            children: [{ ...support, children: [tier2] }],
          },
        ]) as never
      );
      mockRoleGroupService.getRoleGroupById.mockResolvedValue({
        message: 'ok',
        meta: {},
        data: { ...support, roles: [], children: [] },
      } as never);
      mockRoleGroupService.updateRoleGroup.mockResolvedValue({
        message: 'ok',
        meta: {},
        data: { ...support, parent_id: 'admin-group' },
      } as never);
      renderGroupsAt('/dashboard/role-groups/edit/support', 'admin');

      expect(
        await screen.findByRole('heading', { name: 'Edit role group' })
      ).toBeVisible();
      expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue(
        'Support'
      );
      const parent = screen.getByRole('combobox', { name: 'Parent group' });
      expect(parent).toHaveTextContent('Operational');

      await user.click(parent);
      const options = (await screen.findAllByRole('option')).map(
        (option) => option.textContent
      );
      expect(options).toEqual(['No parent', 'Administrative', 'Operational']);
      await user.click(screen.getByRole('option', { name: 'Administrative' }));
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      await waitFor(() => {
        expect(mockRoleGroupService.updateRoleGroup).toHaveBeenCalledWith(
          'support',
          { name: 'Support', parent_id: 'admin-group', description: null }
        );
      });
    });
  });

  describe('after saving an edit', () => {
    it(
      'shows a loading list, not the old parent, until the reload arrives',
      { timeout: 30_000 },
      async () => {
        const user = userEvent.setup();
        const support = roleGroup('support', 'Support', 'ops');
        const stale = [administrative, { ...operational, children: [support] }];
        mockRoleGroupService.getRoleGroups.mockResolvedValue(
          page(stale) as never
        );
        mockRoleGroupService.getRoleGroupById.mockResolvedValue({
          message: 'ok',
          meta: {},
          data: { ...support, roles: [], children: [] },
        } as never);
        mockRoleGroupService.updateRoleGroup.mockResolvedValue({
          message: 'ok',
          meta: {},
          data: { ...support, parent_id: 'admin-group' },
        } as never);
        renderGroupsAt('/dashboard/role-groups/edit/support', 'admin');

        await user.click(
          await screen.findByRole('combobox', { name: 'Parent group' })
        );
        await user.click(
          await screen.findByRole('option', { name: 'Administrative' })
        );

        // The list reloads slowly: the first fetch hands back the old tree.
        let resolveReload: (value: unknown) => void = () => {};
        mockRoleGroupService.getRoleGroups.mockReturnValueOnce(
          new Promise((resolve) => {
            resolveReload = resolve;
          }) as never
        );
        await user.click(screen.getByRole('button', { name: 'Save changes' }));

        expect(
          await screen.findByText('Loading role groups', {}, { timeout: 5000 })
        ).toBeInTheDocument();
        expect(
          screen.queryByRole('link', { name: 'Support' })
        ).not.toBeInTheDocument();

        resolveReload(
          page([
            {
              ...administrative,
              children: [{ ...support, parent_id: 'admin-group' }],
            },
            operational,
          ])
        );
        const supportRow = await waitFor(() => rowFor('Support'), {
          timeout: 5000,
        });
        expect(within(supportRow).getAllByRole('cell')[1]).toHaveTextContent(
          'Administrative'
        );
      }
    );
  });

  describe('permission groups, as an admin', () => {
    it(
      'creates a child group that shows under its parent',
      { timeout: 30_000 },
      async () => {
        const user = userEvent.setup();
        const content = {
          id: 'content',
          name: 'Content',
          created_at: at,
          updated_at: at,
          permissions: [],
        };
        const articles = {
          id: 'articles',
          name: 'Articles',
          permission_group_id: 'content',
          created_at: at,
          updated_at: at,
          permissions: [],
        };
        mockPermissionService.getPermissionGroups.mockResolvedValue(
          page([content]) as never
        );
        mockPermissionService.createPermissionGroup.mockResolvedValue({
          message: 'ok',
          meta: {},
          data: articles,
        } as never);
        renderGroupsAt('/dashboard/permission-groups/new', 'admin');

        await user.type(
          await screen.findByRole('textbox', { name: 'Name' }),
          'Articles'
        );
        await chooseParent(user, 'Cont', 'Content');
        mockPermissionService.getPermissionGroups.mockResolvedValue(
          page([content, articles]) as never
        );
        await user.click(
          screen.getByRole('button', { name: 'Create permission group' })
        );

        expect(
          mockPermissionService.createPermissionGroup
        ).toHaveBeenCalledWith({
          name: 'Articles',
          permission_group_id: 'content',
          description: null,
        });
        const articlesRow = await waitFor(() => rowFor('Articles'), {
          timeout: 5000,
        });
        expect(within(articlesRow).getAllByRole('cell')[1]).toHaveTextContent(
          'Content'
        );
      }
    );
  });

  describe.each(['manager', 'user'] as const)('as a %s', (role) => {
    it('cannot open the create forms', async () => {
      renderGroupsAt('/dashboard/role-groups/new', role);

      expect(
        await screen.findByRole('heading', {
          name: 'You can’t create role groups',
        })
      ).toBeVisible();
      expect(
        screen.queryByRole('textbox', { name: 'Name' })
      ).not.toBeInTheDocument();
    });
  });

  describe('when the parent is not in the group list', () => {
    it('says the parent is unknown instead of “No parent”', async () => {
      const support = roleGroup('support', 'Support', 'elsewhere');
      mockRoleGroupService.getRoleGroups.mockResolvedValue(
        page([administrative, support]) as never
      );
      mockRoleGroupService.getRoleGroupById.mockResolvedValue({
        message: 'ok',
        meta: {},
        data: { ...support, roles: [], children: [] },
      } as never);
      renderGroupsAt('/dashboard/role-groups/edit/support', 'admin');

      expect(
        await screen.findByRole('combobox', { name: 'Parent group' })
      ).toHaveTextContent('Unknown group');
    });

    it('blocks the form when the group list fails to load', async () => {
      mockRoleGroupService.getRoleGroups.mockRejectedValue(
        new Error('Network Error')
      );
      renderGroupsAt('/dashboard/role-groups/new', 'admin');

      expect(
        await screen.findByText('Couldn’t load the role group')
      ).toBeVisible();
      expect(
        screen.queryByRole('textbox', { name: 'Name' })
      ).not.toBeInTheDocument();
    });
  });
});
