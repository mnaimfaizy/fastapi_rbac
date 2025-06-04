import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import { UsersList } from '../features/users/UsersList';
import { UserEditForm } from '../features/users/UserEditForm';
import * as userService from '../services/user.service';
import { User } from '../models/user';

// Mock the user service
vi.mock('../services/user.service');
const mockUserService = vi.mocked(userService);

// Mock user data
const mockUsers: User[] = [
  {
    id: '1',
    email: 'john@example.com',
    first_name: 'John',
    last_name: 'Doe',
    is_active: true,
    is_superuser: false,
    is_locked: false,
    needs_to_change_password: false,
    verified: true,
    number_of_failed_attempts: 0,
    roles: [{ id: '1', name: 'user', description: 'Regular user' }],
    permissions: [
      { id: '1', name: 'user.read', description: 'Read user data' },
    ],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    last_changed_password_date: '2025-01-01T00:00:00Z',
    expiry_date: null,
    locked_until: null,
    verification_code: null,
  },
  {
    id: '2',
    email: 'jane@example.com',
    first_name: 'Jane',
    last_name: 'Smith',
    is_active: true,
    is_superuser: true,
    is_locked: false,
    needs_to_change_password: false,
    verified: true,
    number_of_failed_attempts: 0,
    roles: [{ id: '2', name: 'admin', description: 'Administrator' }],
    permissions: [
      { id: '1', name: 'user.read', description: 'Read user data' },
      { id: '2', name: 'user.create', description: 'Create users' },
      { id: '3', name: 'user.update', description: 'Update users' },
      { id: '4', name: 'user.delete', description: 'Delete users' },
    ],
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    last_changed_password_date: '2025-01-01T00:00:00Z',
    expiry_date: null,
    locked_until: null,
    verification_code: null,
  },
];

describe('User Management Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('UsersList', () => {
    it('renders user list with correct data', async () => {
      mockUserService.getUsers = vi.fn().mockResolvedValue({
        data: {
          data: mockUsers,
          pagination: {
            page: 1,
            limit: 10,
            total: 2,
            pages: 1,
          },
        },
      });

      renderWithProviders(<UsersList />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('jane@example.com')).toBeInTheDocument();
        expect(screen.getByText('admin')).toBeInTheDocument();
        expect(screen.getByText('user')).toBeInTheDocument();
      });
    });

    it('shows loading state while fetching users', () => {
      mockUserService.getUsers = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100))
        );

      renderWithProviders(<UsersList />);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('handles error state when fetching users fails', async () => {
      mockUserService.getUsers = vi
        .fn()
        .mockRejectedValue(new Error('Failed to fetch users'));

      renderWithProviders(<UsersList />);

      await waitFor(() => {
        expect(screen.getByText(/error loading users/i)).toBeInTheDocument();
      });
    });

    it('allows pagination through user list', async () => {
      mockUserService.getUsers = vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            data: [mockUsers[0]],
            pagination: { page: 1, limit: 1, total: 2, pages: 2 },
          },
        })
        .mockResolvedValueOnce({
          data: {
            data: [mockUsers[1]],
            pagination: { page: 2, limit: 1, total: 2, pages: 2 },
          },
        });

      renderWithProviders(<UsersList />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      });
    });

    it('filters users by search term', async () => {
      mockUserService.getUsers = vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            data: mockUsers,
            pagination: { page: 1, limit: 10, total: 2, pages: 1 },
          },
        })
        .mockResolvedValueOnce({
          data: {
            data: [mockUsers[0]],
            pagination: { page: 1, limit: 10, total: 1, pages: 1 },
          },
        });

      renderWithProviders(<UsersList />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search users/i);
      fireEvent.change(searchInput, { target: { value: 'john' } });

      await waitFor(() => {
        expect(mockUserService.getUsers).toHaveBeenCalledWith({
          page: 1,
          limit: 10,
          search: 'john',
        });
      });
    });

    it('shows create user button for users with permissions', async () => {
      const adminState = {
        auth: {
          user: mockUsers[1], // Admin user with create permissions
          accessToken: 'mock-token',
          isAuthenticated: true,
          loading: false,
          error: null,
        },
      };

      mockUserService.getUsers = vi.fn().mockResolvedValue({
        data: {
          data: mockUsers,
          pagination: { page: 1, limit: 10, total: 2, pages: 1 },
        },
      });

      renderWithProviders(<UsersList />, { preloadedState: adminState });

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /create user/i })
        ).toBeInTheDocument();
      });
    });

    it('hides create user button for users without permissions', async () => {
      const userState = {
        auth: {
          user: mockUsers[0], // Regular user without create permissions
          accessToken: 'mock-token',
          isAuthenticated: true,
          loading: false,
          error: null,
        },
      };

      mockUserService.getUsers = vi.fn().mockResolvedValue({
        data: {
          data: mockUsers,
          pagination: { page: 1, limit: 10, total: 2, pages: 1 },
        },
      });

      renderWithProviders(<UsersList />, { preloadedState: userState });

      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: /create user/i })
        ).not.toBeInTheDocument();
      });
    });

    it('handles user deletion with confirmation', async () => {
      mockUserService.getUsers = vi.fn().mockResolvedValue({
        data: {
          data: mockUsers,
          pagination: { page: 1, limit: 10, total: 2, pages: 1 },
        },
      });

      mockUserService.deleteUser = vi.fn().mockResolvedValue({});

      const adminState = {
        auth: {
          user: mockUsers[1], // Admin user with delete permissions
          accessToken: 'mock-token',
          isAuthenticated: true,
          loading: false,
          error: null,
        },
      };

      renderWithProviders(<UsersList />, { preloadedState: adminState });

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Find and click delete button for John Doe
      const deleteButtons = screen.getAllByTestId('delete-user-button');
      fireEvent.click(deleteButtons[0]);

      // Confirm deletion
      await waitFor(() => {
        expect(
          screen.getByText(/are you sure you want to delete/i)
        ).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockUserService.deleteUser).toHaveBeenCalledWith('1');
      });
    });
  });

  describe('UserEditForm', () => {
    const mockUser = mockUsers[0];

    it('renders edit form with user data pre-filled', () => {
      renderWithProviders(<UserEditForm user={mockUser} />);

      expect(screen.getByDisplayValue('John')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument();
    });

    it('validates required fields', async () => {
      renderWithProviders(<UserEditForm user={mockUser} />);

      const firstNameInput = screen.getByDisplayValue('John');
      fireEvent.change(firstNameInput, { target: { value: '' } });

      const submitButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
      });
    });

    it('submits form with updated data', async () => {
      mockUserService.updateUser = vi.fn().mockResolvedValue({
        data: { ...mockUser, first_name: 'Johnny' },
      });

      renderWithProviders(<UserEditForm user={mockUser} />);

      const firstNameInput = screen.getByDisplayValue('John');
      fireEvent.change(firstNameInput, { target: { value: 'Johnny' } });

      const submitButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockUserService.updateUser).toHaveBeenCalledWith('1', {
          first_name: 'Johnny',
          last_name: 'Doe',
          email: 'john@example.com',
          is_active: true,
        });
      });
    });

    it('handles form submission errors', async () => {
      mockUserService.updateUser = vi
        .fn()
        .mockRejectedValue(new Error('Email already exists'));

      renderWithProviders(<UserEditForm user={mockUser} />);

      const submitButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
      });
    });

    it('disables form during submission', async () => {
      mockUserService.updateUser = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100))
        );

      renderWithProviders(<UserEditForm user={mockUser} />);

      const submitButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(submitButton);

      expect(submitButton).toBeDisabled();
      expect(screen.getByText(/saving/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });
    });
  });

  describe('User Permissions', () => {
    it('shows role badges for each user', async () => {
      mockUserService.getUsers = vi.fn().mockResolvedValue({
        data: {
          data: mockUsers,
          pagination: { page: 1, limit: 10, total: 2, pages: 1 },
        },
      });

      renderWithProviders(<UsersList />);

      await waitFor(() => {
        expect(screen.getByText('user')).toBeInTheDocument();
        expect(screen.getByText('admin')).toBeInTheDocument();
      });
    });

    it('shows superuser indicator for admin users', async () => {
      mockUserService.getUsers = vi.fn().mockResolvedValue({
        data: {
          data: mockUsers,
          pagination: { page: 1, limit: 10, total: 2, pages: 1 },
        },
      });

      renderWithProviders(<UsersList />);

      await waitFor(() => {
        const superuserBadges = screen.getAllByText(/super/i);
        expect(superuserBadges.length).toBeGreaterThan(0);
      });
    });

    it('shows user status indicators', async () => {
      const usersWithStatus = [
        { ...mockUsers[0], is_active: false },
        { ...mockUsers[1], is_locked: true },
      ];

      mockUserService.getUsers = vi.fn().mockResolvedValue({
        data: {
          data: usersWithStatus,
          pagination: { page: 1, limit: 10, total: 2, pages: 1 },
        },
      });

      renderWithProviders(<UsersList />);

      await waitFor(() => {
        expect(screen.getByText(/inactive/i)).toBeInTheDocument();
        expect(screen.getByText(/locked/i)).toBeInTheDocument();
      });
    });
  });
});
