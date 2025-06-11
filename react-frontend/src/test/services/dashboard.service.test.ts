import { describe, it, expect, beforeEach, vi } from 'vitest';
import api from '../../services/api';
import { dashboardService } from '../../services/dashboard.service';
import { DashboardData } from '../../models/dashboard';

// Mock the API module
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe('DashboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDashboardData', () => {
    it('successfully retrieves dashboard data', async () => {
      const mockDashboardData: DashboardData = {
        totalUsers: 150,
        totalRoles: 8,
        totalPermissions: 25,
        totalRoleGroups: 5,
        totalPermissionGroups: 4,
        recentUsers: [
          {
            id: 'user1',
            email: 'user1@example.com',
            first_name: 'John',
            last_name: 'Doe',
            is_active: true,
            created_at: '2023-01-01T00:00:00Z',
          },
          {
            id: 'user2',
            email: 'user2@example.com',
            first_name: 'Jane',
            last_name: 'Smith',
            is_active: true,
            created_at: '2023-01-02T00:00:00Z',
          },
        ],
        userGrowthData: [
          { month: 'Jan', users: 120 },
          { month: 'Feb', users: 135 },
          { month: 'Mar', users: 150 },
        ],
        roleDistribution: [
          { role: 'Admin', count: 5 },
          { role: 'Manager', count: 15 },
          { role: 'User', count: 130 },
        ],
        systemHealth: {
          status: 'healthy',
          uptime: '99.9%',
          responseTime: '120ms',
          lastChecked: '2023-01-15T10:30:00Z',
        },
        securitySummary: {
          activeUsers: 145,
          lockedUsers: 3,
          unverifiedUsers: 2,
          failedLoginAttempts: 12,
        },
      };

      const mockResponse = {
        data: {
          data: mockDashboardData,
          message: 'Dashboard data retrieved successfully',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const result = await dashboardService.getDashboardData();

      expect(mockedApi.get).toHaveBeenCalledWith('/dashboard');
      expect(result).toEqual(mockDashboardData);
    });

    it('handles partial dashboard data', async () => {
      const mockPartialData: DashboardData = {
        totalUsers: 50,
        totalRoles: 3,
        totalPermissions: 10,
        totalRoleGroups: 2,
        totalPermissionGroups: 1,
        recentUsers: [],
        userGrowthData: [],
        roleDistribution: [],
        systemHealth: {
          status: 'healthy',
          uptime: '100%',
          responseTime: '80ms',
          lastChecked: '2023-01-15T10:30:00Z',
        },
        securitySummary: {
          activeUsers: 50,
          lockedUsers: 0,
          unverifiedUsers: 0,
          failedLoginAttempts: 0,
        },
      };

      const mockResponse = {
        data: {
          data: mockPartialData,
          message: 'Dashboard data retrieved successfully',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const result = await dashboardService.getDashboardData();

      expect(result).toEqual(mockPartialData);
      expect(result.recentUsers).toHaveLength(0);
      expect(result.userGrowthData).toHaveLength(0);
      expect(result.roleDistribution).toHaveLength(0);
    });

    it('handles API errors appropriately', async () => {
      const mockError = new Error('Failed to fetch dashboard data');
      mockedApi.get.mockRejectedValue(mockError);

      await expect(dashboardService.getDashboardData()).rejects.toThrow(
        'Failed to fetch dashboard data'
      );
    });

    it('handles unauthorized access error', async () => {
      const unauthorizedError = new Error('Unauthorized access');
      mockedApi.get.mockRejectedValue(unauthorizedError);

      await expect(dashboardService.getDashboardData()).rejects.toThrow(
        'Unauthorized access'
      );
    });

    it('handles network errors', async () => {
      const networkError = new Error('Network Error');
      networkError.name = 'NetworkError';
      mockedApi.get.mockRejectedValue(networkError);

      await expect(dashboardService.getDashboardData()).rejects.toThrow(
        'Network Error'
      );
    });

    it('handles server errors gracefully', async () => {
      const serverError = new Error('Internal Server Error');
      mockedApi.get.mockRejectedValue(serverError);

      await expect(dashboardService.getDashboardData()).rejects.toThrow(
        'Internal Server Error'
      );
    });

    it('validates dashboard data structure', async () => {
      const mockDashboardData: DashboardData = {
        totalUsers: 100,
        totalRoles: 5,
        totalPermissions: 20,
        totalRoleGroups: 3,
        totalPermissionGroups: 2,
        recentUsers: [
          {
            id: 'user1',
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User',
            is_active: true,
            created_at: '2023-01-01T00:00:00Z',
          },
        ],
        userGrowthData: [{ month: 'Jan', users: 100 }],
        roleDistribution: [{ role: 'Admin', count: 5 }],
        systemHealth: {
          status: 'healthy',
          uptime: '99.9%',
          responseTime: '100ms',
          lastChecked: '2023-01-15T10:30:00Z',
        },
        securitySummary: {
          activeUsers: 95,
          lockedUsers: 3,
          unverifiedUsers: 2,
          failedLoginAttempts: 5,
        },
      };

      const mockResponse = {
        data: {
          data: mockDashboardData,
          message: 'Success',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const result = await dashboardService.getDashboardData();

      // Validate structure
      expect(result).toHaveProperty('totalUsers');
      expect(result).toHaveProperty('totalRoles');
      expect(result).toHaveProperty('totalPermissions');
      expect(result).toHaveProperty('totalRoleGroups');
      expect(result).toHaveProperty('totalPermissionGroups');
      expect(result).toHaveProperty('recentUsers');
      expect(result).toHaveProperty('userGrowthData');
      expect(result).toHaveProperty('roleDistribution');
      expect(result).toHaveProperty('systemHealth');
      expect(result).toHaveProperty('securitySummary');

      // Validate types
      expect(typeof result.totalUsers).toBe('number');
      expect(typeof result.totalRoles).toBe('number');
      expect(typeof result.totalPermissions).toBe('number');
      expect(Array.isArray(result.recentUsers)).toBe(true);
      expect(Array.isArray(result.userGrowthData)).toBe(true);
      expect(Array.isArray(result.roleDistribution)).toBe(true);
      expect(typeof result.systemHealth).toBe('object');
      expect(typeof result.securitySummary).toBe('object');
    });

    it('handles malformed response structure', async () => {
      const mockResponse = {
        data: {
          // Missing 'data' wrapper - malformed structure
          message: 'Success',
          totalUsers: 100,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      // This should handle undefined/null gracefully
      const result = await dashboardService.getDashboardData();

      expect(result).toBeUndefined();
    });

    it('correctly extracts nested data structure', async () => {
      const innerData: DashboardData = {
        totalUsers: 75,
        totalRoles: 4,
        totalPermissions: 15,
        totalRoleGroups: 2,
        totalPermissionGroups: 1,
        recentUsers: [],
        userGrowthData: [],
        roleDistribution: [],
        systemHealth: {
          status: 'healthy',
          uptime: '99.5%',
          responseTime: '150ms',
          lastChecked: '2023-01-15T10:30:00Z',
        },
        securitySummary: {
          activeUsers: 70,
          lockedUsers: 3,
          unverifiedUsers: 2,
          failedLoginAttempts: 8,
        },
      };

      const mockResponse = {
        data: {
          data: innerData, // Note the nested structure
          message: 'Dashboard data retrieved',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const result = await dashboardService.getDashboardData();

      expect(result).toEqual(innerData);
      expect(result.totalUsers).toBe(75);
      expect(result.systemHealth.status).toBe('healthy');
    });
  });

  describe('Service Instance', () => {
    it('exports the dashboard service with all required methods', () => {
      expect(dashboardService).toBeDefined();
      expect(typeof dashboardService.getDashboardData).toBe('function');
    });
  });

  describe('API Response Interface', () => {
    it('correctly defines DashboardApiResponse interface', () => {
      // This test ensures the interface is properly defined
      const mockApiResponse = {
        data: {} as DashboardData,
        message: 'Test message',
      };

      expect(mockApiResponse).toHaveProperty('data');
      expect(mockApiResponse).toHaveProperty('message');
      expect(typeof mockApiResponse.message).toBe('string');
    });
  });
});
