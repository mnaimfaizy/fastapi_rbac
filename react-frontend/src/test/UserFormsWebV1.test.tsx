import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import { renderWithProviders } from './test-utils';
import UserEditPage from '../features/users/UserEditPage';
import userService from '../services/user.service';
import { roleService } from '../services/role.service';
import type { User } from '../models/user';
import {
  ADMIN_ROLE,
  MANAGER_ROLE,
  USER_ROLE,
  ROLE_CATALOG,
  at,
  held,
  makeUser,
  viewerState,
  type ViewerKind,
} from './user-pages-test-utils';

vi.mock('../services/user.service');
vi.mock('../services/role.service', () => ({
  roleService: { getAllRoles: vi.fn() },
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockUserService = vi.mocked(userService);
const mockRoleService = vi.mocked(roleService);

const STRONG = 'Kx9!mQ2#vT7$pL';
const HELPER = 'You can assign roles whose permissions you hold.';

const DANIEL = makeUser({
  id: 'u-daniel',
  first_name: 'Daniel',
  last_name: 'Okafor',
  email: 'daniel.okafor@example.com',
  contact_phone: '+61 414 555 330',
  roles: [held(MANAGER_ROLE), held(USER_ROLE)],
});

function routes() {
  return (
    <Routes>
      <Route path="/dashboard/users" element={<p>Users list</p>} />
      <Route path="/dashboard/users/new" element={<UserEditPage />} />
      <Route path="/dashboard/users/:userId" element={<p>Detail page</p>} />
      <Route path="/dashboard/users/:userId/edit" element={<UserEditPage />} />
    </Routes>
  );
}

async function renderCreate(viewer: ViewerKind) {
  const result = renderWithProviders(at('/dashboard/users/new', routes()), {
    preloadedState: viewerState(viewer),
  });
  await screen.findByRole('heading', { level: 1, name: 'Add user' });
  return result;
}

async function renderEdit(target: User, viewer: ViewerKind = 'admin') {
  mockUserService.getUserById.mockResolvedValue(target);
  const result = renderWithProviders(
    at(`/dashboard/users/${target.id}/edit`, routes()),
    { preloadedState: viewerState(viewer) }
  );
  await screen.findByRole('heading', { level: 1, name: 'Edit user' });
  return result;
}

function section(name: string) {
  return screen.getByRole('region', { name });
}

/** The role checkboxes offered, by name, once the catalog has loaded. */
async function offeredRoles() {
  const roles = await screen.findByRole('group', { name: 'Roles' });
  return within(roles)
    .getAllByRole('checkbox')
    .map((box) => box.getAttribute('id'))
    .map((id) => document.querySelector(`label[for="${id}"]`)?.textContent);
}

describe('User create and edit forms (Web v1)', () => {
  const user = userEvent.setup();

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

  describe('create, as an admin', () => {
    it('groups the form into Identity, Password, Access and Status with the footer last', async () => {
      await renderCreate('admin');

      const names = screen
        .getAllByRole('region')
        .map((region) => region.getAttribute('aria-labelledby'))
        .map((id) => document.getElementById(id ?? '')?.textContent);
      expect(names).toEqual(['Identity', 'Password', 'Access', 'Status']);

      expect(
        within(section('Identity')).getByLabelText('First name')
      ).toBeInTheDocument();
      expect(
        within(section('Identity')).getByLabelText('Phone (optional)')
      ).toBeInTheDocument();
      expect(
        within(section('Password')).getByLabelText('Temporary password')
      ).toBeInTheDocument();
      expect(
        within(section('Password')).getByRole('list', {
          name: 'Password rules',
        })
      ).toBeInTheDocument();
      expect(
        within(section('Status')).getByRole('switch', { name: 'Active' })
      ).toBeChecked();

      // The footer follows every section, so it stays at the end as it sticks.
      const submit = screen.getByRole('button', { name: 'Create user' });
      const cancel = screen.getByRole('button', { name: 'Cancel' });
      expect(
        section('Status').compareDocumentPosition(submit) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(cancel.parentElement).toBe(submit.parentElement);
    });

    it('ticks the password checklist off as the password is typed', async () => {
      await renderCreate('admin');

      const rules = within(section('Password')).getByRole('list', {
        name: 'Password rules',
      });
      expect(within(rules).getAllByText(/^Not yet met:/).length).toBe(9);
      await user.type(screen.getByLabelText('Temporary password'), STRONG);
      expect(within(rules).queryAllByText(/^Not yet met:/)).toHaveLength(0);
    });

    it('offers every role it can grant, with the helper, and no superuser switch', async () => {
      await renderCreate('admin');

      expect(await offeredRoles()).toEqual(['Admin', 'Manager', 'User']);
      expect(within(section('Access')).getByText(HELPER)).toBeInTheDocument();
      expect(
        screen.queryByRole('switch', { name: 'Superuser' })
      ).not.toBeInTheDocument();
    });

    it('creates the user with the chosen roles and opens their detail page', async () => {
      mockUserService.createUser.mockResolvedValue(
        makeUser({ id: 'u-grace', first_name: 'Grace', last_name: 'Mensah' })
      );
      await renderCreate('admin');
      await offeredRoles();

      await user.type(screen.getByLabelText('First name'), 'Grace');
      await user.type(screen.getByLabelText('Last name'), 'Mensah');
      await user.type(screen.getByLabelText('Email'), 'grace@example.com');
      await user.type(screen.getByLabelText('Temporary password'), STRONG);
      await user.type(screen.getByLabelText('Confirm password'), STRONG);
      await user.click(screen.getByRole('checkbox', { name: 'User' }));
      await user.click(screen.getByRole('button', { name: 'Create user' }));

      await waitFor(() =>
        expect(mockUserService.createUser).toHaveBeenCalledWith({
          first_name: 'Grace',
          last_name: 'Mensah',
          email: 'grace@example.com',
          contact_phone: null,
          is_active: true,
          password: STRONG,
          role_id: ['role-user'],
        })
      );
      expect(await screen.findByText('Detail page')).toBeInTheDocument();
      expect(toast.success).toHaveBeenCalledWith('User created');
    });

    it('refuses mismatched passwords before calling the API', async () => {
      await renderCreate('admin');

      await user.type(screen.getByLabelText('First name'), 'Grace');
      await user.type(screen.getByLabelText('Last name'), 'Mensah');
      await user.type(screen.getByLabelText('Email'), 'grace@example.com');
      await user.type(screen.getByLabelText('Temporary password'), STRONG);
      await user.type(screen.getByLabelText('Confirm password'), `${STRONG}x`);
      await user.click(screen.getByRole('button', { name: 'Create user' }));

      expect(
        await screen.findByText('The passwords don’t match')
      ).toBeInTheDocument();
      expect(mockUserService.createUser).not.toHaveBeenCalled();
    });

    it('shows the API’s refusal and stays on the form', async () => {
      mockUserService.createUser.mockRejectedValue(
        new Error('A user with this email already exists.')
      );
      await renderCreate('admin');

      await user.type(screen.getByLabelText('First name'), 'Grace');
      await user.type(screen.getByLabelText('Last name'), 'Mensah');
      await user.type(screen.getByLabelText('Email'), 'grace@example.com');
      await user.type(screen.getByLabelText('Temporary password'), STRONG);
      await user.type(screen.getByLabelText('Confirm password'), STRONG);
      await user.click(screen.getByRole('button', { name: 'Create user' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'A user with this email already exists.'
      );
      expect(toast.error).toHaveBeenCalledWith(
        'A user with this email already exists.'
      );
      expect(
        screen.getByRole('heading', { level: 1, name: 'Add user' })
      ).toBeInTheDocument();
    });
  });

  describe('create, as a superuser', () => {
    it('shows the superuser switch with its warning, and sends the flag', async () => {
      mockUserService.createUser.mockResolvedValue(makeUser({ id: 'u-grace' }));
      await renderCreate('superuser');

      const access = section('Access');
      const toggle = within(access).getByRole('switch', { name: 'Superuser' });
      expect(toggle).not.toBeChecked();
      expect(toggle).toHaveAccessibleDescription(
        'Bypasses every permission check.'
      );
      expect(access).toHaveTextContent(
        'Superusers can change anything, including other superusers. Give this only to people who maintain the system.'
      );

      await user.type(screen.getByLabelText('First name'), 'Grace');
      await user.type(screen.getByLabelText('Last name'), 'Mensah');
      await user.type(screen.getByLabelText('Email'), 'grace@example.com');
      await user.type(screen.getByLabelText('Temporary password'), STRONG);
      await user.type(screen.getByLabelText('Confirm password'), STRONG);
      await user.click(toggle);
      await user.click(screen.getByRole('button', { name: 'Create user' }));

      await waitFor(() =>
        expect(mockUserService.createUser).toHaveBeenCalledWith(
          expect.objectContaining({ is_superuser: true })
        )
      );
    });
  });

  describe('create, as a manager', () => {
    it('offers only roles whose permissions they hold, and no superuser switch', async () => {
      await renderCreate('manager');

      // Admin holds permissions the manager doesn't, so it isn't offered.
      expect(await offeredRoles()).toEqual(['Manager', 'User']);
      expect(within(section('Access')).getByText(HELPER)).toBeInTheDocument();
      expect(
        screen.queryByRole('switch', { name: 'Superuser' })
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/Superusers can change/)).toBeNull();
    });

    it('never sends the superuser flag', async () => {
      mockUserService.createUser.mockResolvedValue(makeUser({ id: 'u-grace' }));
      await renderCreate('manager');
      await offeredRoles();

      await user.type(screen.getByLabelText('First name'), 'Grace');
      await user.type(screen.getByLabelText('Last name'), 'Mensah');
      await user.type(screen.getByLabelText('Email'), 'grace@example.com');
      await user.type(screen.getByLabelText('Temporary password'), STRONG);
      await user.type(screen.getByLabelText('Confirm password'), STRONG);
      await user.click(screen.getByRole('button', { name: 'Create user' }));

      await waitFor(() =>
        expect(mockUserService.createUser).toHaveBeenCalled()
      );
      expect(mockUserService.createUser.mock.calls[0][0]).not.toHaveProperty(
        'is_superuser'
      );
    });
  });

  describe('edit', () => {
    it('has no Password group and fills in the user', async () => {
      await renderEdit(DANIEL);

      expect(screen.getByText('daniel.okafor@example.com')).toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Password' })).toBeNull();
      expect(screen.queryByLabelText('Temporary password')).toBeNull();
      expect(screen.getByLabelText('First name')).toHaveValue('Daniel');
      expect(screen.getByLabelText('Phone (optional)')).toHaveValue(
        '+61 414 555 330'
      );
      await offeredRoles();
      expect(screen.getByRole('checkbox', { name: 'Manager' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'User' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Admin' })).not.toBeChecked();
      expect(
        screen.getByRole('button', { name: 'Save changes' })
      ).toBeInTheDocument();
      expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
    });

    it('lets an admin remove a role, flags the change, and saves it', async () => {
      mockUserService.updateUser.mockResolvedValue(DANIEL);
      await renderEdit(DANIEL);
      await offeredRoles();

      await user.click(screen.getByRole('checkbox', { name: 'Manager' }));
      expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      await waitFor(() =>
        expect(mockUserService.updateUser).toHaveBeenCalledWith('u-daniel', {
          first_name: 'Daniel',
          last_name: 'Okafor',
          email: 'daniel.okafor@example.com',
          contact_phone: '+61 414 555 330',
          is_active: true,
          role_id: ['role-user'],
        })
      );
      expect(await screen.findByText('Detail page')).toBeInTheDocument();
      expect(toast.success).toHaveBeenCalledWith('User updated');
    });

    it('keeps a held role the manager can’t grant when saving', async () => {
      mockUserService.updateUser.mockResolvedValue(DANIEL);
      const priya = makeUser({
        id: 'u-priya',
        first_name: 'Priya',
        last_name: 'Raman',
        email: 'priya@example.com',
        roles: [held(ADMIN_ROLE), held(USER_ROLE)],
      });
      await renderEdit(priya, 'manager');

      expect(await offeredRoles()).toEqual(['Manager', 'User']);
      await user.click(screen.getByRole('checkbox', { name: 'User' }));
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      await waitFor(() =>
        expect(mockUserService.updateUser).toHaveBeenCalledWith(
          'u-priya',
          expect.objectContaining({ role_id: ['role-admin'] })
        )
      );
    });

    it('cancels back to the user’s detail page', async () => {
      await renderEdit(DANIEL);

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(await screen.findByText('Detail page')).toBeInTheDocument();
      expect(mockUserService.updateUser).not.toHaveBeenCalled();
    });

    it('doesn’t offer a non-superuser their own roles', async () => {
      await renderEdit(
        makeUser({
          id: 'viewer-admin',
          first_name: 'QA',
          last_name: 'admin',
          roles: [held(ADMIN_ROLE)],
        })
      );

      expect(
        await screen.findByText(
          'You can’t change your own roles. Ask another administrator.'
        )
      ).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Roles' })).toBeNull();
    });
  });

  describe('edit load', () => {
    it('shows the load failure when the service returns no user', async () => {
      mockUserService.getUserById.mockResolvedValue(undefined as never);
      renderWithProviders(at('/dashboard/users/u-gone/edit', routes()), {
        preloadedState: viewerState('admin'),
      });

      expect(
        await screen.findByText('This user didn’t load')
      ).toBeInTheDocument();
    });
  });

  describe('own account', () => {
    it('offers no Active switch and leaves the flag out on save, even for a superuser', async () => {
      mockUserService.updateUser.mockResolvedValue(DANIEL);
      await renderEdit(
        makeUser({
          id: 'viewer-superuser',
          first_name: 'QA',
          last_name: 'superuser',
          email: 'superuser@example.com',
          roles: [held(ADMIN_ROLE)],
        }),
        'superuser'
      );

      const status = section('Status');
      expect(
        within(status).getByText('You can’t disable your own account.')
      ).toBeInTheDocument();
      expect(
        within(status).queryByRole('switch', { name: 'Active' })
      ).toBeNull();

      await user.clear(screen.getByLabelText('Last name'));
      await user.type(screen.getByLabelText('Last name'), 'Owner');
      await user.click(screen.getByRole('button', { name: 'Save changes' }));

      await waitFor(() =>
        expect(mockUserService.updateUser).toHaveBeenCalled()
      );
      const payload = mockUserService.updateUser.mock.calls[0][1];
      expect(payload).toMatchObject({ last_name: 'Owner' });
      expect(payload).not.toHaveProperty('is_active');
    });
  });

  describe('as a plain user', () => {
    it('shows no roles and no superuser switch', async () => {
      // The routes need user.create or user.update, which the seeded User
      // role lacks; this checks the form itself offers such a viewer nothing.
      await renderCreate('user');

      expect(screen.queryByRole('region', { name: 'Access' })).toBeNull();
      expect(screen.queryByRole('switch', { name: 'Superuser' })).toBeNull();
      expect(mockRoleService.getAllRoles).not.toHaveBeenCalled();
    });
  });
});
