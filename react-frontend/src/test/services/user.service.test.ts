/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosResponse } from 'axios';
import userService, {
  UserCreatePayload,
  UserUpdatePayload,
} from '../../services/user.service';
import api from '../../services/api';
import { User, ApiResponse, PaginatedItems } from '../../models/user';

// Mock the API module
vi.mock('../../services/api');
const mockedApi = vi.mocked(api);

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUsers', () => {
    it('successfully retrieves paginated users list', async () => {
      const mockUsers: User[] = [
        {
          id: '1',
          email: 'user1@example.com',
          first_name: 'User',
          last_name: 'One',
          is_active: true,
          is_superuser: false,
          roles: [],
          permissions: [],
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          is_locked: false,
          locked_until: null,
          needs_to_change_password: false,
          verified: false,
          expiry_date: null,
          last_changed_password_date: null,
          contact_phone: null,
          number_of_failed_attempts: null,
          verification_code: null,
          last_updated_by: null,
        },
      ];

      const mockPaginatedResponse: PaginatedItems<User> = {
        items: mockUsers,
        total: 1,
        page: 1,
        size: 10,
        pages: 1,
        previous_page: null,
        next_page: null,
      };

      const mockResponse: AxiosResponse<ApiResponse<PaginatedItems<User>>> = {
        data: {
          data: mockPaginatedResponse,
          message: 'Users retrieved successfully',
          meta: {},
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      (mockedApi.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse
      );

      const result = await userService.getUsers(1, 10);

      expect(mockedApi.get).toHaveBeenCalledWith('/users/list?page=1&size=10');
      expect(result).toEqual(mockPaginatedResponse);
    });

    it('includes search parameter when provided', async () => {
      const mockPaginatedResponse: PaginatedItems<User> = {
        items: [],
        total: 0,
        page: 1,
        size: 10,
        pages: 0,
        previous_page: null,
        next_page: null,
      };

      const mockResponse: AxiosResponse<ApiResponse<PaginatedItems<User>>> = {
        data: {
          data: mockPaginatedResponse,
          message: 'Users retrieved successfully',
          meta: {},
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      (mockedApi.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse
      );

      await userService.getUsers(1, 10, 'john');

      expect(mockedApi.get).toHaveBeenCalledWith(
        '/users/list?page=1&size=10&search=john'
      );
    });

    it('uses default pagination parameters when not provided', async () => {
      const mockPaginatedResponse: PaginatedItems<User> = {
        items: [],
        total: 0,
        page: 1,
        size: 10,
        pages: 0,
      };

      const mockResponse: AxiosResponse<ApiResponse<PaginatedItems<User>>> = {
        data: {
          data: mockPaginatedResponse,
          success: true,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      await userService.getUsers();

      expect(mockedApi.get).toHaveBeenCalledWith('/users/list?page=1&size=10');
    });

    it('handles API errors appropriately', async () => {
      const mockError = new Error('Failed to fetch users');
      (mockedApi.get as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        mockError
      );

      await expect(userService.getUsers()).rejects.toThrow(
        'Failed to fetch users'
      );
    });
  });

  describe('getUserById', () => {
    it('successfully retrieves user by ID', async () => {
      const mockUser: User = {
        id: '123',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        is_active: true,
        is_superuser: false,
        roles: [],
        permissions: [],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockResponse: AxiosResponse<ApiResponse<User>> = {
        data: {
          data: mockUser,
          success: true,
          message: 'User retrieved successfully',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const result = await userService.getUserById('123');

      expect(mockedApi.get).toHaveBeenCalledWith('/users/123');
      expect(result).toEqual(mockUser);
    });

    it('handles user not found error', async () => {
      const mockError = new Error('User not found');
      mockedApi.get.mockRejectedValue(mockError);

      await expect(userService.getUserById('nonexistent')).rejects.toThrow(
        'User not found'
      );
    });
  });

  describe('createUser', () => {
    it('successfully creates a new user', async () => {
      const mockUserData: UserCreatePayload = {
        email: 'newuser@example.com',
        password: 'securePassword123',
        first_name: 'New',
        last_name: 'User',
        role_id: ['role1'],
      };

      const mockCreatedUser: User = {
        id: '456',
        email: 'newuser@example.com',
        first_name: 'New',
        last_name: 'User',
        is_active: true,
        is_superuser: false,
        roles: [],
        permissions: [],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockResponse: AxiosResponse<ApiResponse<User>> = {
        data: {
          data: mockCreatedUser,
          success: true,
          message: 'User created successfully',
        },
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      };

      (mockedApi.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse
      );

      const result = await userService.createUser(mockUserData);

      expect(mockedApi.post).toHaveBeenCalledWith('/users', mockUserData);
      expect(result).toEqual(mockCreatedUser);
    });

    it('includes role assignments in creation', async () => {
      const mockUserData: UserCreatePayload = {
        email: 'admin@example.com',
        password: 'adminPassword123',
        first_name: 'Admin',
        last_name: 'User',
        role_id: ['admin-role-id', 'user-role-id'],
      };

      const mockResponse: AxiosResponse<ApiResponse<User>> = {
        data: {
          data: {} as User,
          success: true,
        },
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      };

      mockedApi.post.mockResolvedValue(mockResponse);

      await userService.createUser(mockUserData);

      expect(mockedApi.post).toHaveBeenCalledWith('/users', mockUserData);
    });
  });

  describe('updateUser', () => {
    it('successfully updates an existing user', async () => {
      const userId = '123';
      const mockUpdateData: UserUpdatePayload = {
        first_name: 'Updated',
        last_name: 'Name',
        role_id: ['new-role-id'],
      };

      const mockUpdatedUser: User = {
        id: userId,
        email: 'test@example.com',
        first_name: 'Updated',
        last_name: 'Name',
        is_active: true,
        is_superuser: false,
        roles: [],
        permissions: [],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      };

      const mockResponse: AxiosResponse<ApiResponse<User>> = {
        data: {
          data: mockUpdatedUser,
          success: true,
          message: 'User updated successfully',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      (mockedApi.put as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse
      );

      const result = await userService.updateUser(userId, mockUpdateData);

      expect(mockedApi.put).toHaveBeenCalledWith(
        `/users/${userId}`,
        mockUpdateData
      );
      expect(result).toEqual(mockUpdatedUser);
    });

    it('allows partial updates', async () => {
      const userId = '123';
      const partialUpdate: UserUpdatePayload = {
        first_name: 'NewFirstName',
      };

      const mockResponse: AxiosResponse<ApiResponse<User>> = {
        data: {
          data: {} as User,
          message: '',
          meta: {},
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      (mockedApi.put as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse
      );

      await userService.updateUser(userId, partialUpdate);

      expect(mockedApi.put).toHaveBeenCalledWith(
        `/users/${userId}`,
        partialUpdate
      );
    });

    it('includes password updates when provided', async () => {
      const userId = '123';
      const updateWithPassword: UserUpdatePayload = {
        first_name: 'Updated',
        password: 'newSecurePassword123',
      };

      const mockResponse: AxiosResponse<ApiResponse<User>> = {
        data: {
          data: {} as User,
          message: '',
          meta: {},
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      (mockedApi.put as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse
      );

      await userService.updateUser(userId, updateWithPassword);

      expect(mockedApi.put).toHaveBeenCalledWith(
        `/users/${userId}`,
        updateWithPassword
      );
    });
  });

  describe('deleteUser', () => {
    it('successfully deletes a user', async () => {
      const userId = '123';

      const mockResponse: AxiosResponse<any> = {
        data: {
          data: {},
          success: true,
          message: 'User deleted successfully',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      (
        mockedApi.delete as unknown as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockResponse);

      await userService.deleteUser(userId);

      expect(mockedApi.delete).toHaveBeenCalledWith(`/users/${userId}`);
    });

    it('validates user ID parameter for deletion', async () => {
      await expect(userService.deleteUser('')).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('preserves API error messages', async () => {
      const customError = new Error('Custom API error');
      (mockedApi.get as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        customError
      );

      await expect(userService.getUserById('123')).rejects.toThrow(
        'Custom API error'
      );
    });

    it('handles network errors', async () => {
      const networkError = new Error('Network Error');
      networkError.name = 'NetworkError';
      (mockedApi.get as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        networkError
      );

      await expect(userService.getUsers()).rejects.toThrow('Network Error');
    });
  });

  describe('Service Instance', () => {
    it('exports the user service instance with all methods', () => {
      expect(userService).toBeDefined();
      expect(typeof userService.getUsers).toBe('function');
      expect(typeof userService.getUserById).toBe('function');
      expect(typeof userService.createUser).toBe('function');
      expect(typeof userService.updateUser).toBe('function');
      expect(typeof userService.deleteUser).toBe('function');
    });
  });

  describe('TypeScript Interfaces', () => {
    it('defines UserCreatePayload interface correctly', () => {
      const payload: UserCreatePayload = {
        email: 'test@example.com',
        password: 'password123',
        first_name: 'Test',
        last_name: 'User',
        role_id: ['role1', 'role2'],
      };

      expect(payload.email).toBe('test@example.com');
      expect(payload.role_id).toEqual(['role1', 'role2']);
    });

    it('defines UserUpdatePayload interface correctly', () => {
      const payload: UserUpdatePayload = {
        first_name: 'Updated',
        password: 'newPassword123',
        role_id: ['newRole'],
      };

      expect(payload.first_name).toBe('Updated');
      expect(payload.password).toBe('newPassword123');
      expect(payload.role_id).toEqual(['newRole']);
    });
  });
});
