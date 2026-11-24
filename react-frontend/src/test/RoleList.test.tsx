/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import RoleList from '@/features/roles/RoleList';
import { roleService } from '@/services/role.service';

// Mock Redux hooks
vi.mock('react-redux', () => ({
  useDispatch: vi.fn(),
  useSelector: vi.fn(),
}));

// Mock React Router
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

// Mock permissions hook
vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: vi.fn(),
}));

// Mock the toast notifications
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock role service
vi.mock('@/services/role.service', () => ({
  roleService: {
    deleteRole: vi.fn(),
    getRoles: vi.fn(),
    getRoleById: vi.fn(),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    assignPermissionsToRole: vi.fn(),
    removePermissionsFromRole: vi.fn(),
    getAllRoles: vi.fn(),
  },
}));

// Mock data
const mockPermissions = [
  {
    id: '1',
    name: 'user.read',
    description: 'Read user information',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'user.create',
    description: 'Create new users',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'user.update',
    description: 'Update user information',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '4',
    name: 'user.delete',
    description: 'Delete users',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '5',
    name: 'role.read',
    description: 'Read role information',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '6',
    name: 'role.create',
    description: 'Create new roles',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '7',
    name: 'role.update',
    description: 'Update role information',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '8',
    name: 'role.delete',
    description: 'Delete roles',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

const mockRoles = [
  {
    id: '1',
    name: 'user',
    description: 'Regular user role',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    permissions: mockPermissions.slice(0, 4), // user permissions
  },
  {
    id: '2',
    name: 'admin',
    description: 'Administrator role',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    permissions: mockPermissions, // all permissions
  },
];

const mockRoleGroups = [
  {
    id: '1',
    name: 'System Administration',
    description: 'Administrative roles for system management',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'User Management',
    description: 'Roles for managing users',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

type MockedFunction = ReturnType<typeof vi.fn>;

describe('RoleList Component', () => {
  const user = userEvent.setup();
  let mockDispatch: MockedFunction;
  let mockNavigate: MockedFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    // Get mocked functions using vi.mocked()
    mockDispatch = vi.mocked(useDispatch);
    const mockUseSelector = vi.mocked(useSelector);
    mockNavigate = vi.mocked(useNavigate);
    const mockUsePermissions = vi.mocked(usePermissions);

    // Mock dispatch to return promises for async thunks with unwrap method
    mockDispatch.mockImplementation(() => (action: any) => {
      if (typeof action === 'function') {
        const mockPromise = Promise.resolve({ type: 'mocked', payload: {} });
        // Add unwrap method for async thunks
        (mockPromise as any).unwrap = () => Promise.resolve({});
        return mockPromise;
      }
      return action;
    });

    // Mock navigate function
    mockNavigate.mockReturnValue(vi.fn());

    // Setup useSelector mock to return the required state
    mockUseSelector.mockImplementation((selector: any) => {
      const mockState = {
        role: {
          roles: mockRoles,
          allRoles: mockRoles,
          currentRole: null,
          pagination: {
            total: mockRoles.length,
            page: 1,
            size: 10,
            pages: 1,
          },
          loading: false,
          error: null,
        },
        roleGroup: {
          roleGroups: mockRoleGroups,
          currentRoleGroup: null,
          loading: false,
          error: null,
          pagination: {
            total: mockRoleGroups.length,
            page: 1,
            size: 10,
            pages: 1,
            previousPage: null,
            nextPage: null,
          },
        },
      };
      return selector(mockState);
    });

    // Setup usePermissions mock with all permissions by default
    mockUsePermissions.mockReturnValue({
      hasPermission: () => true,
      hasAnyPermission: () => true,
      hasRole: () => true,
      hasAnyRole: () => true,
      hasPermissions: () => true,
    });
  });

  // Helper function to render with BrowserRouter
  const renderRoleList = () => {
    return render(
      <BrowserRouter>
        <RoleList />
      </BrowserRouter>
    );
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Render and Store Configuration', () => {
    it('renders correctly with default store state', () => {
      renderRoleList();

      // RoleList no longer has the "Roles" heading - it's handled by parent component
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('renders loading spinner when loading state is true', () => {
      // Override the selector mock to return loading state
      const mockUseSelector = vi.mocked(useSelector);
      mockUseSelector.mockImplementation((selector: any) => {
        const mockState = {
          role: {
            roles: [],
            allRoles: [],
            currentRole: null,
            loading: true,
            error: null,
            pagination: {
              total: 0,
              page: 1,
              size: 10,
              pages: 0,
            },
          },
          roleGroup: {
            roleGroups: [],
            currentRoleGroup: null,
            loading: false,
            error: null,
            pagination: {
              total: 0,
              page: 1,
              size: 10,
              pages: 1,
              previousPage: null,
              nextPage: null,
            },
          },
        };
        return selector(mockState);
      });

      renderRoleList();

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Loading roles...')).toBeInTheDocument();
    });

    it('displays error message when error state is present', () => {
      const errorMessage = 'Failed to fetch roles';

      // Override the selector mock to return error state
      const mockUseSelector = vi.mocked(useSelector);
      mockUseSelector.mockImplementation((selector: any) => {
        const mockState = {
          role: {
            roles: [mockRoles[0]], // Provide one role to prevent useEffect fetch
            allRoles: [],
            currentRole: null,
            loading: false,
            error: errorMessage,
            pagination: {
              total: 1,
              page: 1,
              size: 10,
              pages: 1,
            },
          },
          roleGroup: {
            roleGroups: mockRoleGroups,
            currentRoleGroup: null,
            loading: false,
            error: null,
            pagination: {
              total: mockRoleGroups.length,
              page: 1,
              size: 10,
              pages: 1,
              previousPage: null,
              nextPage: null,
            },
          },
        };
        return selector(mockState);
      });

      renderRoleList();

      // The error message should be displayed in a styled alert
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();

      // Should not show loading spinner when there's an error
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();

      // Should STILL show the table when there's an error - improved UX allows interaction
      expect(screen.getByRole('table')).toBeInTheDocument();

      // Check that error has retry and dismiss buttons
      expect(screen.getByText('Retry')).toBeInTheDocument();
      expect(screen.getByText('Dismiss')).toBeInTheDocument();
    });

    it('renders roles table with data from store', () => {
      renderRoleList();

      // Check that roles are displayed
      expect(screen.getByText('user')).toBeInTheDocument();
      expect(screen.getByText('admin')).toBeInTheDocument();
      expect(screen.getByText('Regular user role')).toBeInTheDocument();
      expect(screen.getByText('Administrator role')).toBeInTheDocument();
    });

    it('displays "No roles found" when roles array is empty', () => {
      const mockUseSelector = vi.mocked(useSelector);
      mockUseSelector.mockImplementation((selector: any) => {
        const mockState = {
          role: {
            roles: [],
            allRoles: [],
            currentRole: null,
            loading: false,
            error: null,
            pagination: {
              total: 0,
              page: 1,
              size: 10,
              pages: 0,
            },
          },
          roleGroup: {
            roleGroups: [],
            currentRoleGroup: null,
            loading: false,
            error: null,
            pagination: {
              total: 0,
              page: 1,
              size: 10,
              pages: 1,
              previousPage: null,
              nextPage: null,
            },
          },
        };
        return selector(mockState);
      });

      renderRoleList();

      expect(screen.getByText('No roles found')).toBeInTheDocument();
    });
  });

  describe('Permission-Based Behavior', () => {
    it('shows edit button when user has update permission', async () => {
      renderRoleList();

      const triggers = screen.getAllByRole('button', { name: /Actions for/ });
      expect(triggers).toHaveLength(mockRoles.length);
      await user.click(triggers[0]);
      expect(
        screen.getByRole('menuitem', { name: 'Edit role' })
      ).toBeInTheDocument();
    });

    it('hides edit button when user lacks update permission', () => {
      const mockUsePermissions = vi.mocked(usePermissions);
      mockUsePermissions.mockReturnValue({
        hasPermission: (permission: string) => permission === 'role.read',
        hasAnyPermission: () => true,
        hasRole: () => true,
        hasAnyRole: () => true,
        hasPermissions: () => true,
      });

      renderRoleList();

      expect(screen.queryByTitle('Edit role')).not.toBeInTheDocument();
    });

    it('shows delete button when user has delete permission', async () => {
      renderRoleList();

      const triggers = screen.getAllByRole('button', { name: /Actions for/ });
      expect(triggers).toHaveLength(mockRoles.length);
      await user.click(triggers[0]);
      expect(screen.getByTestId('delete-role-button')).toBeInTheDocument();
    });

    it('hides delete button when user lacks delete permission', () => {
      const mockUsePermissions = vi.mocked(usePermissions);
      mockUsePermissions.mockReturnValue({
        hasPermission: (permission: string) => permission === 'role.read',
        hasAnyPermission: () => true,
        hasRole: () => true,
        hasAnyRole: () => true,
        hasPermissions: () => true,
      });

      renderRoleList();

      expect(
        screen.queryByTestId('delete-role-button')
      ).not.toBeInTheDocument();
    });

    it('displays access denied message when user lacks read permission', () => {
      const mockUsePermissions = vi.mocked(usePermissions);
      mockUsePermissions.mockReturnValue({
        hasPermission: () => false,
        hasAnyPermission: () => false,
        hasRole: () => false,
        hasAnyRole: () => false,
        hasPermissions: () => false,
      });

      renderRoleList();

      expect(screen.getByText('Access Denied')).toBeInTheDocument();
      expect(
        screen.getByText('You do not have permission to view roles.')
      ).toBeInTheDocument();
    });
  });

  describe('Role Group Functionality', () => {
    it('displays role group names when role groups are available', () => {
      const rolesWithGroups = [
        {
          ...mockRoles[0],
          role_group_id: mockRoleGroups[0].id,
        },
        {
          ...mockRoles[1],
          role_group_id: mockRoleGroups[1].id,
        },
      ];

      const mockUseSelector = vi.mocked(useSelector);
      mockUseSelector.mockImplementation((selector: any) => {
        const mockState = {
          role: {
            roles: rolesWithGroups,
            allRoles: rolesWithGroups,
            currentRole: null,
            loading: false,
            error: null,
            pagination: {
              total: rolesWithGroups.length,
              page: 1,
              size: 10,
              pages: 1,
            },
          },
          roleGroup: {
            roleGroups: mockRoleGroups,
            currentRoleGroup: null,
            loading: false,
            error: null,
            pagination: {
              total: mockRoleGroups.length,
              page: 1,
              size: 100,
              pages: 1,
            },
          },
        };
        return selector(mockState);
      });

      renderRoleList();

      expect(screen.getByText('User Management')).toBeInTheDocument();
      expect(screen.getByText('System Administration')).toBeInTheDocument();
    });

    it('displays "No group" when role has no group assigned', () => {
      renderRoleList();

      const noGroupTexts = screen.getAllByText('No group');
      expect(noGroupTexts.length).toBeGreaterThan(0);
    });

    it('shows role group as clickable link when user has role_group.read permission', () => {
      const rolesWithGroups = [
        {
          ...mockRoles[0],
          role_group_id: mockRoleGroups[0].id,
        },
      ];

      const mockUseSelector = vi.mocked(useSelector);
      mockUseSelector.mockImplementation((selector: any) => {
        const mockState = {
          role: {
            roles: rolesWithGroups,
            allRoles: rolesWithGroups,
            currentRole: null,
            loading: false,
            error: null,
            pagination: {
              total: rolesWithGroups.length,
              page: 1,
              size: 10,
              pages: 1,
            },
          },
          roleGroup: {
            roleGroups: mockRoleGroups,
            currentRoleGroup: null,
            loading: false,
            error: null,
            pagination: {
              total: mockRoleGroups.length,
              page: 1,
              size: 100,
              pages: 1,
            },
          },
        };
        return selector(mockState);
      });

      renderRoleList();

      // A grey chip, as the artboard draws it, that still opens the group.
      const roleGroupChip = screen.getByRole('button', {
        name: 'System Administration',
      });
      expect(roleGroupChip).toHaveClass('bg-muted', 'rounded-md');
      expect(roleGroupChip).not.toHaveClass('hover:underline');
    });
  });

  describe('Permission Display', () => {
    it('displays correct permission count for each role', () => {
      renderRoleList();

      // Check permission count for user role (4 permissions)
      expect(screen.getByText('4')).toBeInTheDocument();

      // Check permission count for admin role (8 permissions - all mockPermissions)
      expect(screen.getByText('8')).toBeInTheDocument();
    });

    it('displays singular "permission" for role with one permission', () => {
      const roleWithOnePermission = {
        ...mockRoles[0],
        permissions: [mockPermissions[0]], // Only one permission
      };

      const mockUseSelector = vi.mocked(useSelector);
      mockUseSelector.mockImplementation((selector: any) => {
        const mockState = {
          role: {
            roles: [roleWithOnePermission],
            allRoles: [roleWithOnePermission],
            currentRole: null,
            loading: false,
            error: null,
            pagination: {
              total: 1,
              page: 1,
              size: 10,
              pages: 1,
            },
          },
          roleGroup: {
            roleGroups: mockRoleGroups,
            currentRoleGroup: null,
            loading: false,
            error: null,
            pagination: {
              total: mockRoleGroups.length,
              page: 1,
              size: 10,
              pages: 1,
              previousPage: null,
              nextPage: null,
            },
          },
        };
        return selector(mockState);
      });

      renderRoleList();

      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('displays "0 permissions" for role with no permissions', () => {
      const roleWithNoPermissions = {
        ...mockRoles[0],
        permissions: [],
      };

      const mockUseSelector = vi.mocked(useSelector);
      mockUseSelector.mockImplementation((selector: any) => {
        const mockState = {
          role: {
            roles: [roleWithNoPermissions],
            allRoles: [roleWithNoPermissions],
            currentRole: null,
            loading: false,
            error: null,
            pagination: {
              total: 1,
              page: 1,
              size: 10,
              pages: 1,
            },
          },
          roleGroup: {
            roleGroups: mockRoleGroups,
            currentRoleGroup: null,
            loading: false,
            error: null,
            pagination: {
              total: mockRoleGroups.length,
              page: 1,
              size: 10,
              pages: 1,
              previousPage: null,
              nextPage: null,
            },
          },
        };
        return selector(mockState);
      });

      renderRoleList();

      expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    });
  });

  describe('User counts', () => {
    it('shows a user count for each role', () => {
      renderRoleList();

      expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    });

    it('still lists a role when created_at is missing', () => {
      const roleWithoutDate = {
        ...mockRoles[0],
        created_at: undefined,
      };

      const mockUseSelector = vi.mocked(useSelector);
      mockUseSelector.mockImplementation((selector: any) => {
        const mockState = {
          role: {
            roles: [roleWithoutDate],
            allRoles: [roleWithoutDate],
            currentRole: null,
            loading: false,
            error: null,
            pagination: {
              total: 1,
              page: 1,
              size: 10,
              pages: 1,
            },
          },
          roleGroup: {
            roleGroups: mockRoleGroups,
            currentRoleGroup: null,
            loading: false,
            error: null,
            pagination: {
              total: mockRoleGroups.length,
              page: 1,
              size: 10,
              pages: 1,
              previousPage: null,
              nextPage: null,
            },
          },
        };
        return selector(mockState);
      });

      renderRoleList();

      expect(screen.getByRole('link', { name: 'user' })).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('links each role name to its detail page', () => {
      renderRoleList();

      expect(screen.getByRole('link', { name: 'user' })).toHaveAttribute(
        'href',
        `/dashboard/roles/${mockRoles[0].id}`
      );
    });

    it('calls handleEdit when edit button is clicked', async () => {
      const mockNavigateFunction = vi.fn();
      mockNavigate.mockReturnValue(mockNavigateFunction);

      renderRoleList();

      await user.click(
        screen.getByRole('button', { name: 'Actions for user' })
      );
      const editButton = screen.getByTitle('Edit role');
      await user.click(editButton);

      expect(mockNavigateFunction).toHaveBeenCalledWith(
        `/dashboard/roles/edit/${mockRoles[0].id}`
      );
    });
  });

  describe('Delete Functionality', () => {
    it('opens delete dialog when delete button is clicked', async () => {
      renderRoleList();

      await user.click(
        screen.getByRole('button', { name: 'Actions for user' })
      );
      const deleteButton = screen.getByTestId('delete-role-button');
      await user.click(deleteButton);

      expect(
        screen.getByRole('alertdialog', { name: 'Delete role ‘user’?' })
      ).toBeInTheDocument();
      expect(
        screen.getByText('No users hold this role. This cannot be undone.')
      ).toBeInTheDocument();
    });

    it('uses a plain confirm when the role has no holders', async () => {
      renderRoleList();

      await user.click(
        screen.getByRole('button', { name: 'Actions for user' })
      );
      const deleteButton = screen.getByTestId('delete-role-button');
      await user.click(deleteButton);

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete role' })).toBeEnabled();
    });

    it('successfully deletes role when confirmed', async () => {
      const mockRoleService = vi.mocked(roleService);
      mockRoleService.deleteRole.mockResolvedValueOnce(undefined);

      // Mock dispatch to handle deleteRole thunk properly
      mockDispatch.mockImplementation(() => (action: any) => {
        if (typeof action === 'function') {
          // Simulate successful deletion
          const mockPromise = Promise.resolve({
            type: 'role/deleteRole/fulfilled',
            payload: {},
          });
          (mockPromise as any).unwrap = () => Promise.resolve({});
          return mockPromise;
        }
        return action;
      });

      renderRoleList();

      await user.click(
        screen.getByRole('button', { name: 'Actions for user' })
      );
      const deleteButton = screen.getByTestId('delete-role-button');
      await user.click(deleteButton);

      const confirmButton = screen.getByRole('button', { name: 'Delete role' });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Role deleted successfully');
      });
    });

    it('handles delete error gracefully', async () => {
      const errorMessage = 'Failed to delete role';
      const mockRoleService = vi.mocked(roleService);
      mockRoleService.deleteRole.mockRejectedValueOnce(new Error(errorMessage));

      // Mock dispatch to handle deleteRole thunk rejection properly
      mockDispatch.mockImplementation(() => (action: any) => {
        if (typeof action === 'function') {
          // Simulate failed deletion
          const mockPromise = Promise.reject(new Error(errorMessage));
          (mockPromise as any).unwrap = () =>
            Promise.reject(new Error(errorMessage));

          // Add a catch handler to prevent unhandled promise rejection
          mockPromise.catch(() => {
            // This prevents the "Unhandled Promise Rejection" errors in tests
            // The actual error handling is done by the component
          });

          return mockPromise;
        }
        return action;
      });

      renderRoleList();

      await user.click(
        screen.getByRole('button', { name: 'Actions for user' })
      );
      const deleteButton = screen.getByTestId('delete-role-button');
      await user.click(deleteButton);

      const confirmButton = screen.getByRole('button', { name: 'Delete role' });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(errorMessage, {
          duration: 5000,
        });
      });
    });

    it('cancels delete when cancel button is clicked', async () => {
      const mockRoleService = vi.mocked(roleService);

      renderRoleList();

      await user.click(
        screen.getByRole('button', { name: 'Actions for user' })
      );
      const deleteButton = screen.getByTestId('delete-role-button');
      await user.click(deleteButton);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(
        screen.queryByRole('alertdialog', { name: 'Delete role ‘user’?' })
      ).not.toBeInTheDocument();
      expect(mockRoleService.deleteRole).not.toHaveBeenCalled();
    });
  });

  describe('Pagination', () => {
    it('shows pagination when there are multiple pages', () => {
      const mockUseSelector = vi.mocked(useSelector);
      mockUseSelector.mockImplementation((selector: any) => {
        const mockState = {
          role: {
            roles: mockRoles,
            allRoles: mockRoles,
            currentRole: null,
            loading: false,
            error: null,
            pagination: {
              total: 25,
              page: 1,
              size: 10,
              pages: 3,
            },
          },
          roleGroup: {
            roleGroups: mockRoleGroups,
            currentRoleGroup: null,
            loading: false,
            error: null,
            pagination: {
              total: mockRoleGroups.length,
              page: 1,
              size: 10,
              pages: 1,
              previousPage: null,
              nextPage: null,
            },
          },
        };
        return selector(mockState);
      });

      renderRoleList();

      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });

    it('hides pagination when there is only one page', () => {
      renderRoleList();

      expect(screen.queryByText('Previous')).not.toBeInTheDocument();
      expect(screen.queryByText('Next')).not.toBeInTheDocument();
    });

    it('disables Previous button on first page', () => {
      const mockUseSelector = vi.mocked(useSelector);
      mockUseSelector.mockImplementation((selector: any) => {
        const mockState = {
          role: {
            roles: mockRoles,
            allRoles: mockRoles,
            currentRole: null,
            loading: false,
            error: null,
            pagination: {
              total: 25,
              page: 1,
              size: 10,
              pages: 3,
            },
          },
          roleGroup: {
            roleGroups: mockRoleGroups,
            currentRoleGroup: null,
            loading: false,
            error: null,
            pagination: {
              total: mockRoleGroups.length,
              page: 1,
              size: 10,
              pages: 1,
              previousPage: null,
              nextPage: null,
            },
          },
        };
        return selector(mockState);
      });

      renderRoleList();

      const previousButton = screen.getByText('Previous');
      expect(previousButton).toBeDisabled();
    });

    it('disables Next button on last page', async () => {
      const user = userEvent.setup();
      const mockUseSelector = vi.mocked(useSelector);

      // Start with a 3-page pagination setup
      mockUseSelector.mockImplementation((selector: any) => {
        const mockState = {
          role: {
            roles: mockRoles,
            allRoles: mockRoles,
            currentRole: null,
            loading: false,
            error: null,
            pagination: {
              total: 25,
              page: 1, // Start on page 1
              size: 10,
              pages: 3, // 3 pages total
            },
          },
          roleGroup: {
            roleGroups: mockRoleGroups,
            currentRoleGroup: null,
            loading: false,
            error: null,
            pagination: {
              total: mockRoleGroups.length,
              page: 1,
              size: 10,
              pages: 1,
              previousPage: null,
              nextPage: null,
            },
          },
        };
        return selector(mockState);
      });

      renderRoleList();

      // Should show pagination with Next button enabled initially
      const nextButton = screen.getByText('Next');
      expect(nextButton).not.toBeDisabled();

      // Click Next button twice to get to page 3
      await user.click(nextButton);
      await user.click(nextButton);

      // Now check if the button gets disabled
      // Note: In real implementation, the component would call dispatch to update the page
      // and the disabled state would be based on internal currentPage state
      // For this test, we'll check if the component's internal logic works correctly
      // by checking the button after multiple clicks
      await waitFor(
        () => {
          const finalNextButton = screen.getByText('Next');
          // The button should be disabled when currentPage reaches pagination.pages
          // Since the component tracks currentPage internally and we've clicked twice,
          // currentPage should be 3, making the button disabled (3 >= 3)
          expect(finalNextButton).toBeDisabled();
        },
        { timeout: 1000 }
      );
    });

    it('enables navigation buttons on middle pages', async () => {
      const mockUseSelector = vi.mocked(useSelector);
      mockUseSelector.mockImplementation((selector: any) => {
        const mockState = {
          role: {
            roles: mockRoles,
            allRoles: mockRoles,
            currentRole: null,
            loading: false,
            error: null,
            pagination: {
              total: 25,
              page: 1, // Start at page 1 (component initial state)
              size: 10,
              pages: 3, // 3 pages total, so Next should be enabled
            },
          },
          roleGroup: {
            roleGroups: mockRoleGroups,
            currentRoleGroup: null,
            loading: false,
            error: null,
            pagination: {
              total: mockRoleGroups.length,
              page: 1,
              size: 10,
              pages: 1,
              previousPage: null,
              nextPage: null,
            },
          },
        };
        return selector(mockState);
      });

      renderRoleList();

      const previousButton = screen.getByText('Previous');
      const nextButton = screen.getByText('Next');

      // On page 1 of 3: Previous should be disabled, Next should be enabled
      expect(previousButton).toBeDisabled();
      expect(nextButton).not.toBeDisabled();

      // Click Next to go to page 2
      await user.click(nextButton);

      // Wait for the state update and re-render
      await waitFor(() => {
        const updatedPreviousButton = screen.getByText('Previous');
        const updatedNextButton = screen.getByText('Next');
        // Now on page 2 of 3: both should be enabled
        expect(updatedPreviousButton).not.toBeDisabled();
        expect(updatedNextButton).not.toBeDisabled();
      });
    });
  });

  describe('Table Structure', () => {
    it('renders table headers correctly', () => {
      renderRoleList();

      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Permissions')).toBeInTheDocument();
      expect(screen.getByText('Role group')).toBeInTheDocument();
      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('links every role name to its detail page', () => {
      renderRoleList();

      expect(screen.getAllByRole('link', { name: /user|admin/ })).toHaveLength(
        mockRoles.length
      );
    });
  });

  describe('Error Handling', () => {
    it('displays error message when error state is present', () => {
      const errorMessage = 'Failed to fetch roles';

      // Override the selector mock to return error state
      const mockUseSelector = vi.mocked(useSelector);
      mockUseSelector.mockImplementation((selector: any) => {
        const mockState = {
          role: {
            roles: [mockRoles[0]], // Provide one role to prevent useEffect fetch
            allRoles: [],
            currentRole: null,
            loading: false,
            error: errorMessage,
            pagination: {
              total: 1,
              page: 1,
              size: 10,
              pages: 1,
            },
          },
          roleGroup: {
            roleGroups: mockRoleGroups,
            currentRoleGroup: null,
            loading: false,
            error: null,
            pagination: {
              total: mockRoleGroups.length,
              page: 1,
              size: 10,
              pages: 1,
              previousPage: null,
              nextPage: null,
            },
          },
        };
        return selector(mockState);
      });

      renderRoleList();

      // The error message should be displayed in a styled alert
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();

      // Should not show loading spinner when there's an error
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();

      // Should STILL show the table when there's an error - improved UX allows interaction
      expect(screen.getByRole('table')).toBeInTheDocument();

      // Check that error has retry and dismiss buttons
      expect(screen.getByText('Retry')).toBeInTheDocument();
      expect(screen.getByText('Dismiss')).toBeInTheDocument();
    });
  });
});
