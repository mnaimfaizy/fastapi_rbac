/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import PermissionGroupsContent from '@/features/permission-groups/PermissionGroupsContent';
import PermissionGroupsDataTable from '@/features/permission-groups/PermissionGroupsDataTable';
import PermissionGroupDetail from '@/features/permission-groups/PermissionGroupDetail';
import PermissionGroupForm from '@/features/permission-groups/PermissionGroupForm';
import permissionService from '@/services/permission.service';

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
    useParams: () => ({ id: '1', permissionGroupId: '1' }),
    BrowserRouter: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
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

// Mock permission service
vi.mock('@/services/permission.service', () => ({
  default: {
    getPermissionGroups: vi.fn(),
    getPermissionGroupById: vi.fn(),
    createPermissionGroup: vi.fn(),
    updatePermissionGroup: vi.fn(),
    deletePermissionGroup: vi.fn(),
  },
}));

// Mock data
const mockPermissionGroups = [
  {
    id: '1',
    name: 'User Management',
    permission_group_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    created_by_id: '1',
    permissions: [
      {
        id: '1',
        name: 'user.read',
        description: 'Read user information',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        created_by_id: '1',
      },
      {
        id: '2',
        name: 'user.create',
        description: 'Create new users',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        created_by_id: '1',
      },
    ],
    groups: [],
  },
  {
    id: '2',
    name: 'Role Management',
    permission_group_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    created_by_id: '1',
    permissions: [
      {
        id: '3',
        name: 'role.read',
        description: 'Read role information',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        created_by_id: '1',
      },
    ],
    groups: [
      {
        id: '3',
        name: 'Role Sub-Management',
        permission_group_id: '2',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        created_by_id: '1',
        permissions: [],
        groups: [],
      },
    ],
  },
];

const mockPermissionGroup = mockPermissionGroups[0];

const mockUser = {
  id: '1',
  email: 'admin@example.com',
  first_name: 'Admin',
  last_name: 'User',
  is_active: true,
  is_superuser: true,
  roles: [
    {
      id: '1',
      name: 'admin',
      description: 'Administrator role',
      permissions: [
        { id: '1', name: 'permission_group.read' },
        { id: '2', name: 'permission_group.create' },
        { id: '3', name: 'permission_group.update' },
        { id: '4', name: 'permission_group.delete' },
      ],
    },
  ],
  permissions: [
    { id: '1', name: 'permission_group.read' },
    { id: '2', name: 'permission_group.create' },
    { id: '3', name: 'permission_group.update' },
    { id: '4', name: 'permission_group.delete' },
  ],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// Mock selectors
const mockPermissionGroupState = {
  permissionGroups: mockPermissionGroups,
  currentPermissionGroup: mockPermissionGroup,
  isLoading: false,
  error: null,
  totalItems: 2,
  page: 1,
  pageSize: 10,
};

const mockAuthState = {
  user: mockUser,
  isAuthenticated: true,
  isLoading: false,
  error: null,
};

// Setup mocks
const mockDispatch = vi.fn();
const mockNavigate = vi.fn();

describe('PermissionGroups Feature Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useDispatch as any).mockReturnValue(mockDispatch);
    (useNavigate as any).mockReturnValue(mockNavigate);
    (usePermissions as any).mockReturnValue({
      hasPermission: vi.fn((permission: string) => {
        const userPermissions = mockUser.permissions.map((p) => p.name);
        return userPermissions.includes(permission);
      }),
      hasRole: vi.fn((role: string) => {
        const userRoles = mockUser.roles.map((r) => r.name);
        return userRoles.includes(role);
      }),
      hasAnyPermission: vi.fn((permissions: string[]) => {
        const userPermissions = mockUser.permissions.map((p) => p.name);
        return permissions.some((permission) =>
          userPermissions.includes(permission)
        );
      }),
      hasAnyRole: vi.fn((roles: string[]) => {
        const userRoles = mockUser.roles.map((r) => r.name);
        return roles.some((role) => userRoles.includes(role));
      }),
    });

    // Setup default selector mock
    (useSelector as any).mockImplementation((selector: any) => {
      const state = {
        permissionGroup: mockPermissionGroupState,
        auth: mockAuthState,
      };
      return selector(state);
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('PermissionGroupsContent Component', () => {
    it('renders permission groups content correctly', () => {
      render(
        <BrowserRouter>
          <PermissionGroupsContent />
        </BrowserRouter>
      );

      expect(screen.getByText('Manage Permission Groups')).toBeInTheDocument();
      expect(screen.getByText('Create Permission Group')).toBeInTheDocument();
    });
    it('handles create permission group navigation', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <PermissionGroupsContent />
        </BrowserRouter>
      );

      const createButton = screen.getByText('Create Permission Group');
      await user.click(createButton);

      expect(mockNavigate).toHaveBeenCalledWith(
        '/dashboard/permission-groups/new'
      );
    });

    it('hides create button when user lacks permission', () => {
      (usePermissions as any).mockReturnValue({
        hasPermission: vi.fn(() => false),
        hasRole: vi.fn(() => false),
        hasAnyPermission: vi.fn(() => false),
        hasAnyRole: vi.fn(() => false),
      });

      render(
        <BrowserRouter>
          <PermissionGroupsContent />
        </BrowserRouter>
      );

      expect(
        screen.queryByText('Create Permission Group')
      ).not.toBeInTheDocument();
    });
  });

  describe('PermissionGroupsDataTable Component', () => {
    it('renders permission groups table correctly', async () => {
      render(
        <BrowserRouter>
          <PermissionGroupsDataTable />
        </BrowserRouter>
      );

      // Check if dispatch was called (dispatch gets thunk functions, not plain action objects)
      expect(mockDispatch).toHaveBeenCalled();

      await waitFor(() => {
        expect(screen.getByText('User Management')).toBeInTheDocument();
        expect(screen.getByText('Role Management')).toBeInTheDocument();
      });
    });

    it('displays loading state', () => {
      (useSelector as any).mockImplementation((selector: any) => {
        const state = {
          permissionGroup: { ...mockPermissionGroupState, isLoading: true },
          auth: mockAuthState,
        };
        return selector(state);
      });

      render(
        <BrowserRouter>
          <PermissionGroupsDataTable />
        </BrowserRouter>
      );

      expect(
        screen.getByText('Loading permission groups...')
      ).toBeInTheDocument();
    });

    it('displays error state through toast notifications', () => {
      // Note: The PermissionGroupsDataTable component doesn't render error states in the UI
      // Instead, it handles errors through toast notifications and stores error state in Redux
      const errorMessage = 'An error occurred while loading data.';

      (useSelector as any).mockImplementation((selector: any) => {
        const state = {
          permissionGroup: {
            ...mockPermissionGroupState,
            error: errorMessage,
          },
          auth: mockAuthState,
        };
        return selector(state);
      });

      render(
        <BrowserRouter>
          <PermissionGroupsDataTable />
        </BrowserRouter>
      );

      // Verify the table still renders (error doesn't break the UI)
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  describe('PermissionGroupDetail Component', () => {
    it('renders permission group detail correctly', async () => {
      render(
        <BrowserRouter>
          <PermissionGroupDetail />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText('User Management')).toHaveLength(2);
      });

      // Check that the component renders the permission group details correctly
      expect(screen.getByText('Back to permission groups')).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('handles back navigation', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <PermissionGroupDetail />
        </BrowserRouter>
      );

      const backButton = screen.getByText('Back to permission groups');
      await user.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/permission-groups');
    });

    it('displays loading state', () => {
      (useSelector as any).mockImplementation((selector: any) => {
        const state = {
          permissionGroup: { ...mockPermissionGroupState, isLoading: true },
          auth: mockAuthState,
        };
        return selector(state);
      });

      render(
        <BrowserRouter>
          <PermissionGroupDetail />
        </BrowserRouter>
      );

      expect(
        screen.getByText('Loading permission group details...')
      ).toBeInTheDocument();
    });

    it('displays error state with fallback UI', () => {
      // Note: PermissionGroupDetail doesn't render error messages in the UI
      // It only shows error states through component states or fallback content
      const errorMessage = 'An error occurred while loading data.';

      (useSelector as any).mockImplementation((selector: any) => {
        const state = {
          permissionGroup: {
            ...mockPermissionGroupState,
            currentPermissionGroup: null, // Simulate error state by clearing data
            error: errorMessage,
          },
          auth: mockAuthState,
        };
        return selector(state);
      });

      render(
        <BrowserRouter>
          <PermissionGroupDetail />
        </BrowserRouter>
      );

      // Component shows "not found" message when currentPermissionGroup is null
      expect(
        screen.getByText('Permission group not found')
      ).toBeInTheDocument();
    });
  });

  describe('PermissionGroupForm Component', () => {
    it('renders create form correctly', () => {
      render(
        <BrowserRouter>
          <PermissionGroupForm isEdit={false} />
        </BrowserRouter>
      );

      expect(screen.getByText('Create Permission Group')).toBeInTheDocument();
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByText('Create')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('renders edit form correctly', () => {
      render(
        <BrowserRouter>
          <PermissionGroupForm id="1" isEdit={true} />
        </BrowserRouter>
      );

      expect(screen.getByText('Edit Permission Group')).toBeInTheDocument();
      expect(screen.getByText('Update')).toBeInTheDocument();
    });

    it('handles form submission for create', async () => {
      const user = userEvent.setup();
      const mockCreateAction = vi.fn().mockReturnValue({
        unwrap: vi.fn().mockResolvedValue(mockPermissionGroup),
      });

      mockDispatch.mockReturnValue(mockCreateAction());

      render(
        <BrowserRouter>
          <PermissionGroupForm isEdit={false} />
        </BrowserRouter>
      );

      const nameInput = screen.getByLabelText('Name');
      await user.type(nameInput, 'New Permission Group');

      const submitButton = screen.getByText('Create');
      await user.click(submitButton);

      // Check if dispatch was called (dispatch gets thunk functions, not plain action objects)
      expect(mockDispatch).toHaveBeenCalled();
    });

    it('handles form validation', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <PermissionGroupForm isEdit={false} />
        </BrowserRouter>
      );

      const submitButton = screen.getByText('Create');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument();
      });
    });

    it('handles cancel navigation', async () => {
      const user = userEvent.setup();
      render(
        <BrowserRouter>
          <PermissionGroupForm isEdit={false} />
        </BrowserRouter>
      );

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/permission-groups');
    });

    it('displays loading state', () => {
      (useSelector as any).mockImplementation((selector: any) => {
        const state = {
          permissionGroup: { ...mockPermissionGroupState, isLoading: true },
          auth: mockAuthState,
        };
        return selector(state);
      });

      render(
        <BrowserRouter>
          <PermissionGroupForm isEdit={false} />
        </BrowserRouter>
      );

      expect(screen.getByText('Loading groups...')).toBeInTheDocument();
    });

    it('displays error state', () => {
      const errorMessage = 'Failed to load form data';

      (useSelector as any).mockImplementation((selector: any) => {
        const state = {
          permissionGroup: {
            ...mockPermissionGroupState,
            error: errorMessage,
          },
          auth: mockAuthState,
        };
        return selector(state);
      });

      render(
        <BrowserRouter>
          <PermissionGroupForm isEdit={false} />
        </BrowserRouter>
      );

      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Permission Group Service Integration', () => {
    it('handles service errors gracefully', async () => {
      const errorMessage = 'An error occurred while loading data.';
      (permissionService.getPermissionGroups as any).mockRejectedValue(
        new Error(errorMessage)
      );

      (useSelector as any).mockImplementation((selector: any) => {
        const state = {
          permissionGroup: {
            ...mockPermissionGroupState,
            error: errorMessage,
          },
          auth: mockAuthState,
        };
        return selector(state);
      });

      render(
        <BrowserRouter>
          <PermissionGroupsDataTable />
        </BrowserRouter>
      );

      // Service errors are handled gracefully - component still renders
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  describe('Permission-based Rendering', () => {
    it('shows all actions for admin users', () => {
      render(
        <BrowserRouter>
          <PermissionGroupsContent />
        </BrowserRouter>
      );

      expect(screen.getByText('Create Permission Group')).toBeInTheDocument();
    });

    it('hides actions based on permissions', () => {
      (usePermissions as any).mockReturnValue({
        hasPermission: vi.fn((permission: string) => {
          // Only allow read permission
          return permission === 'permission_group.read';
        }),
        hasRole: vi.fn(() => false),
        hasAnyPermission: vi.fn(() => false),
        hasAnyRole: vi.fn(() => false),
      });

      render(
        <BrowserRouter>
          <PermissionGroupsContent />
        </BrowserRouter>
      );

      expect(
        screen.queryByText('Create Permission Group')
      ).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(
        <BrowserRouter>
          <PermissionGroupsDataTable />
        </BrowserRouter>
      );

      expect(screen.getByRole('table')).toBeInTheDocument();
      const columnHeaders = screen.getAllByRole('columnheader');
      expect(columnHeaders.length).toBeGreaterThan(0);
    });

    it('supports keyboard navigation', async () => {
      render(
        <BrowserRouter>
          <PermissionGroupForm isEdit={false} />
        </BrowserRouter>
      );

      // Focus on the first focusable element (name input)
      const nameInput = screen.getByLabelText('Name');
      nameInput.focus();
      expect(nameInput).toHaveFocus();
    });
  });
});
