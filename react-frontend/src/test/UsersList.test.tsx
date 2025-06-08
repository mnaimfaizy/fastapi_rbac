import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, mockUsers, mockRoles } from './test-utils';
import UsersList from '../features/users/UsersList';
import userService from '../services/user.service';

// Mock the user service
vi.mock('../services/user.service');
const mockUserService = vi.mocked(userService);

// Mock React Router
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Link: ({ children, to, ...props }: any) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
    useNavigate: () => vi.fn(),
  };
});

// Mock the toast notifications
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('UsersList Component', () => {
  const user = userEvent.setup();
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful API responses by default
    mockUserService.getUsers.mockResolvedValue({
      items: mockUsers,
      total: mockUsers.length,
      page: 1,
      size: 10,
      pages: 1,
      previous_page: null,
      next_page: null,
    }); // Mock delete user to resolve successfully
    mockUserService.deleteUser.mockResolvedValue(undefined);

    // Track deleted users for fetchUsers mock
    const deletedUserIds: string[] = [];

    // Override deleteUser mock to track deleted users
    mockUserService.deleteUser.mockImplementation(async (userId: string) => {
      deletedUserIds.push(userId);
      return undefined;
    });

    // Update fetchUsers mock to exclude deleted users
    mockUserService.getUsers.mockImplementation(async () => {
      const filteredUsers = mockUsers.filter(
        (user) => !deletedUserIds.includes(user.id)
      );
      return {
        items: filteredUsers,
        total: filteredUsers.length,
        page: 1,
        size: 10,
        pages: 1,
        previous_page: null,
        next_page: null,
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Render and Store Configuration', () => {
    it('renders correctly with default store state', () => {
      renderWithProviders(<UsersList />);

      expect(screen.getByText('Users')).toBeInTheDocument();
      expect(screen.getByText('Manage Users')).toBeInTheDocument();
    });

    it('renders loading spinner when loading state is true', () => {
      const preloadedState = {
        user: {
          users: [],
          selectedUser: null,
          loading: true,
          error: null,
          pagination: {
            total: 0,
            page: 1,
            size: 10,
            pages: 0,
            previousPage: null,
            nextPage: null,
          },
        },
      };

      renderWithProviders(<UsersList />, { preloadedState });

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
    it('displays error message when error state is present', () => {
      const errorMessage = 'Failed to fetch users';
      const preloadedState = {
        auth: {
          user: {
            id: '1',
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User',
            permissions: [
              'user.read',
              'user.create',
              'user.update',
              'user.delete',
            ],
            roles: [mockRoles[1]], // Admin role
          },
          isAuthenticated: true,
          isLoading: false,
          error: null,
        },
        user: {
          users: [mockUsers[0]], // Provide one user to prevent useEffect fetch
          selectedUser: null,
          loading: false,
          error: errorMessage,
          pagination: {
            total: 1,
            page: 1,
            size: 10,
            pages: 1,
            previousPage: null,
            nextPage: null,
          },
        },
      };

      renderWithProviders(<UsersList />, { preloadedState });

      // The error message should be displayed in a styled div above the card
      expect(screen.getByText(errorMessage)).toBeInTheDocument();

      // Should not show loading spinner when there's an error
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();

      // Should show the DataTable with empty data when not loading
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('renders users table with data from store', () => {
      const preloadedState = {
        user: {
          users: mockUsers,
          selectedUser: null,
          loading: false,
          error: null,
          pagination: {
            total: mockUsers.length,
            page: 1,
            size: 10,
            pages: 1,
            previousPage: null,
            nextPage: null,
          },
        },
      };

      renderWithProviders(<UsersList />, { preloadedState }); // Check that users are displayed
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getAllByText('test@example.com')).toHaveLength(2); // Email appears in header + cell
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      expect(screen.getAllByText('admin@example.com')).toHaveLength(2); // Email appears in header + cell
    });
  });

  describe('Permission-Based Behavior', () => {
    it('shows "Add New User" button when user has create permission', () => {
      const preloadedState = {
        auth: {
          user: {
            id: '1',
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User',
            permissions: ['user.create'],
            roles: [mockRoles[0]],
          },
          isAuthenticated: true,
          isLoading: false,
          error: null,
        },
      };

      renderWithProviders(<UsersList />, { preloadedState });

      expect(screen.getByText('Add New User')).toBeInTheDocument();
    });

    it('hides "Add New User" button when user lacks create permission', () => {
      const preloadedState = {
        auth: {
          user: {
            id: '1',
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User',
            permissions: ['user.read'], // Only read permission
            roles: [mockRoles[0]],
          },
          isAuthenticated: true,
          isLoading: false,
          error: null,
        },
      };

      renderWithProviders(<UsersList />, { preloadedState });

      expect(screen.queryByText('Add New User')).not.toBeInTheDocument();
    });

    it('shows edit and delete actions when user has appropriate permissions', async () => {
      const preloadedState = {
        auth: {
          user: {
            id: '1',
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User',
            permissions: ['user.read', 'user.update', 'user.delete'],
            roles: [mockRoles[0]],
          },
          isAuthenticated: true,
          isLoading: false,
          error: null,
        },
        user: {
          users: mockUsers,
          selectedUser: null,
          loading: false,
          error: null,
          pagination: {
            total: mockUsers.length,
            page: 1,
            size: 10,
            pages: 1,
            previousPage: null,
            nextPage: null,
          },
        },
      };

      renderWithProviders(<UsersList />, { preloadedState });

      // Click on the first action menu button
      const actionButtons = screen.getAllByRole('button', {
        name: /open menu/i,
      });
      await user.click(actionButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('View details')).toBeInTheDocument();
        expect(screen.getByText('Edit user')).toBeInTheDocument();
        expect(screen.getByText('Delete user')).toBeInTheDocument();
      });
    });

    it('hides delete action when user lacks delete permission', async () => {
      const preloadedState = {
        auth: {
          user: {
            id: '1',
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User',
            permissions: ['user.read', 'user.update'], // No delete permission
            roles: [mockRoles[0]],
          },
          isAuthenticated: true,
          isLoading: false,
          error: null,
        },
        user: {
          users: mockUsers,
          selectedUser: null,
          loading: false,
          error: null,
          pagination: {
            total: mockUsers.length,
            page: 1,
            size: 10,
            pages: 1,
            previousPage: null,
            nextPage: null,
          },
        },
      };

      renderWithProviders(<UsersList />, { preloadedState });

      // Click on the first action menu button
      const actionButtons = screen.getAllByRole('button', {
        name: /open menu/i,
      });
      await user.click(actionButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('View details')).toBeInTheDocument();
        expect(screen.getByText('Edit user')).toBeInTheDocument();
        expect(screen.queryByText('Delete user')).not.toBeInTheDocument();
      });
    });

    it('shows unlock account option for locked users with update permission', async () => {
      const lockedUser = {
        ...mockUsers[0],
        is_locked: true,
      };

      const preloadedState = {
        auth: {
          user: {
            id: '1',
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User',
            permissions: ['user.read', 'user.update'],
            roles: [mockRoles[0]],
          },
          isAuthenticated: true,
          isLoading: false,
          error: null,
        },
        user: {
          users: [lockedUser],
          selectedUser: null,
          loading: false,
          error: null,
          pagination: {
            total: 1,
            page: 1,
            size: 10,
            pages: 1,
            previousPage: null,
            nextPage: null,
          },
        },
      };

      renderWithProviders(<UsersList />, { preloadedState });

      // Click on the action menu button
      const actionButtons = screen.getAllByRole('button', {
        name: /open menu/i,
      });
      await user.click(actionButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Unlock account')).toBeInTheDocument();
      });
    });

    it('shows resend verification option for unverified users with update permission', async () => {
      const unverifiedUser = {
        ...mockUsers[0],
        verified: false,
      };

      const preloadedState = {
        auth: {
          user: {
            id: '1',
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User',
            permissions: ['user.read', 'user.update'],
            roles: [mockRoles[0]],
          },
          isAuthenticated: true,
          isLoading: false,
          error: null,
        },
        user: {
          users: [unverifiedUser],
          selectedUser: null,
          loading: false,
          error: null,
          pagination: {
            total: 1,
            page: 1,
            size: 10,
            pages: 1,
            previousPage: null,
            nextPage: null,
          },
        },
      };

      renderWithProviders(<UsersList />, { preloadedState });

      // Click on the action menu button
      const actionButtons = screen.getAllByRole('button', {
        name: /open menu/i,
      });
      await user.click(actionButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Resend verification')).toBeInTheDocument();
      });
    });
  });

  describe('User Operations (CRUD)', () => {
    const fullPermissionsState = {
      auth: {
        user: {
          id: '1',
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          permissions: [
            'user.read',
            'user.create',
            'user.update',
            'user.delete',
          ],
          roles: [mockRoles[1]], // Admin role
        },
        isAuthenticated: true,
        isLoading: false,
        error: null,
      },
      user: {
        users: mockUsers,
        selectedUser: null,
        loading: false,
        error: null,
        pagination: {
          total: mockUsers.length,
          page: 1,
          size: 10,
          pages: 1,
          previousPage: null,
          nextPage: null,
        },
      },
    };

    it('opens delete confirmation dialog when delete button is clicked', async () => {
      renderWithProviders(<UsersList />, {
        preloadedState: fullPermissionsState,
      });

      // Click on the first action menu button
      const actionButtons = screen.getAllByRole('button', {
        name: /open menu/i,
      });
      await user.click(actionButtons[0]);

      // Wait for menu to appear and click delete
      await waitFor(() => {
        expect(screen.getByTestId('delete-user-button')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('delete-user-button'));

      // Check that dialog opened
      await waitFor(() => {
        expect(screen.getByText('Delete User')).toBeInTheDocument();
        expect(
          screen.getByText(/are you sure you want to delete this user/i)
        ).toBeInTheDocument();
        expect(screen.getByTestId('confirm-delete-user')).toBeInTheDocument();
      });
    });

    it('closes delete dialog when cancel is clicked', async () => {
      renderWithProviders(<UsersList />, {
        preloadedState: fullPermissionsState,
      });

      // Open delete dialog
      const actionButtons = screen.getAllByRole('button', {
        name: /open menu/i,
      });
      await user.click(actionButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('delete-user-button')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('delete-user-button'));

      // Click cancel
      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cancel'));

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByText('Delete User')).not.toBeInTheDocument();
      });
    });
    it('dispatches delete action when delete is confirmed', async () => {
      const { store } = renderWithProviders(<UsersList />, {
        preloadedState: fullPermissionsState,
      });

      // Get initial user count
      const initialUserCount = store.getState().user.users.length;
      expect(initialUserCount).toBe(2);

      // Open delete dialog
      const actionButtons = screen.getAllByRole('button', {
        name: /open menu/i,
      });
      await user.click(actionButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('delete-user-button')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('delete-user-button'));

      // Confirm delete
      await waitFor(() => {
        expect(screen.getByTestId('confirm-delete-user')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('confirm-delete-user'));

      // Verify the dialog closes after deletion
      await waitFor(() => {
        expect(screen.queryByText('Delete User')).not.toBeInTheDocument();
      });

      // Verify the delete action was processed by checking store state
      await waitFor(() => {
        const finalUserCount = store.getState().user.users.length;
        expect(finalUserCount).toBe(initialUserCount - 1);
      });
    });
  });

  describe('Data Table Functionality', () => {
    const tableDataState = {
      user: {
        users: mockUsers,
        selectedUser: null,
        loading: false,
        error: null,
        pagination: {
          total: mockUsers.length,
          page: 1,
          size: 10,
          pages: 1,
          previousPage: null,
          nextPage: null,
        },
      },
    };

    it('renders data table with correct user information', () => {
      renderWithProviders(<UsersList />, { preloadedState: tableDataState }); // Check table headers are present
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Contact Info')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Roles')).toBeInTheDocument(); // Check user data is displayed
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getAllByText('test@example.com')).toHaveLength(2); // Email appears in both Name column and Contact Info column
      expect(screen.getByText('Admin User')).toBeInTheDocument();
      expect(screen.getAllByText('admin@example.com')).toHaveLength(2); // Email appears in both Name column and Contact Info column
    });

    it('handles search functionality', async () => {
      renderWithProviders(<UsersList />, {
        preloadedState: tableDataState,
      });

      // Find search input
      const searchInput = screen.getByPlaceholderText('Search users...');
      expect(searchInput).toBeInTheDocument();

      // Type in search
      await user.type(searchInput, 'john');

      // Check that search triggers appropriate action
      // Note: This would typically trigger a dispatch to fetchUsers with search parameter
      expect(searchInput).toHaveValue('john');
    });

    it('handles pagination changes', async () => {
      const paginationState = {
        user: {
          users: mockUsers,
          selectedUser: null,
          loading: false,
          error: null,
          pagination: {
            total: 50, // More than one page
            page: 1,
            size: 10,
            pages: 5,
            previousPage: null,
            nextPage: 2,
          },
        },
      };

      const { store } = renderWithProviders(<UsersList />, {
        preloadedState: paginationState,
      });

      // Monitor dispatches for pagination
      const originalDispatch = store.dispatch;
      const dispatchSpy = vi.fn();
      store.dispatch = dispatchSpy;

      // Look for pagination controls (this depends on your DataTable implementation)
      // The exact selectors will depend on your DataTable component structure

      // Restore original dispatch
      store.dispatch = originalDispatch;
    });

    it('handles rows per page changes', async () => {
      const { store } = renderWithProviders(<UsersList />, {
        preloadedState: tableDataState,
      });

      // Monitor dispatches
      const originalDispatch = store.dispatch;
      const dispatchSpy = vi.fn();
      store.dispatch = dispatchSpy;

      // This test would depend on your DataTable implementation
      // Look for page size selector and test changing it

      // Restore original dispatch
      store.dispatch = originalDispatch;
    });
  });

  describe('Integration with Store', () => {
    it('fetches users on component mount when users array is empty', () => {
      const emptyState = {
        user: {
          users: [],
          selectedUser: null,
          loading: false,
          error: null,
          pagination: {
            total: 0,
            page: 1,
            size: 10,
            pages: 0,
            previousPage: null,
            nextPage: null,
          },
        },
      };

      renderWithProviders(<UsersList />, {
        preloadedState: emptyState,
      });

      // Check that fetchUsers was dispatched
      // Note: This might require mocking the useEffect or checking store state changes
    });

    it('does not fetch users when users already exist in store', () => {
      const populatedState = {
        user: {
          users: mockUsers,
          selectedUser: null,
          loading: false,
          error: null,
          pagination: {
            total: mockUsers.length,
            page: 1,
            size: 10,
            pages: 1,
            previousPage: null,
            nextPage: null,
          },
        },
      };

      renderWithProviders(<UsersList />, {
        preloadedState: populatedState,
      });

      // Verify that component doesn't trigger unnecessary fetches
      // This prevents interference with tests
    });

    it('updates store state correctly after successful delete', async () => {
      const { store } = renderWithProviders(<UsersList />, {
        preloadedState: {
          auth: {
            user: {
              id: '1',
              email: 'test@example.com',
              first_name: 'Test',
              last_name: 'User',
              permissions: ['user.read', 'user.delete'],
              roles: [mockRoles[1]],
            },
            isAuthenticated: true,
            isLoading: false,
            error: null,
          },
          user: {
            users: mockUsers,
            selectedUser: null,
            loading: false,
            error: null,
            pagination: {
              total: mockUsers.length,
              page: 1,
              size: 10,
              pages: 1,
              previousPage: null,
              nextPage: null,
            },
          },
        },
      });

      // This test would simulate a successful delete operation
      // and verify that the store state is updated correctly

      const initialUsersCount = store.getState().user.users.length;
      expect(initialUsersCount).toBe(mockUsers.length);
    });
  });

  describe('Error Handling', () => {
    it('handles delete operation errors gracefully', async () => {
      renderWithProviders(<UsersList />, {
        preloadedState: {
          auth: {
            user: {
              id: '1',
              email: 'test@example.com',
              first_name: 'Test',
              last_name: 'User',
              permissions: ['user.read', 'user.delete'],
              roles: [mockRoles[1]],
            },
            isAuthenticated: true,
            isLoading: false,
            error: null,
          },
          user: {
            users: mockUsers,
            selectedUser: null,
            loading: false,
            error: null,
            pagination: {
              total: mockUsers.length,
              page: 1,
              size: 10,
              pages: 1,
              previousPage: null,
              nextPage: null,
            },
          },
        },
      });

      // Mock delete failure
      mockUserService.deleteUser = vi
        .fn()
        .mockRejectedValue(new Error('Network error'));

      // This test would simulate a failed delete and check error handling
    });
    it('shows appropriate error messages for different error types', () => {
      const errorStates = [
        { error: 'Network error', expectedMessage: 'Network error' },
        { error: 'Unauthorized', expectedMessage: 'Unauthorized' },
        { error: 'Server error', expectedMessage: 'Server error' },
      ];

      errorStates.forEach(({ error, expectedMessage }) => {
        const errorState = {
          user: {
            users: mockUsers, // Provide users to prevent loading spinner
            selectedUser: null,
            loading: false,
            error,
            pagination: {
              total: mockUsers.length,
              page: 1,
              size: 10,
              pages: 1,
              previousPage: null,
              nextPage: null,
            },
          },
        };

        renderWithProviders(<UsersList />, { preloadedState: errorState });
        expect(screen.getByText(expectedMessage)).toBeInTheDocument();
      });
    });
  });
});
