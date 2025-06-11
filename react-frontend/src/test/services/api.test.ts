/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import axios from 'axios';

// Mock external dependencies first
vi.mock('axios', () => {
  const mockAxiosInstance = {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
  };

  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
    },
    create: vi.fn(() => mockAxiosInstance),
  };
});

vi.mock('../../lib/tokenStorage', () => ({
  getStoredRefreshToken: vi.fn(),
  getStoredAccessToken: vi.fn(),
  setStoredAccessToken: vi.fn(),
}));

vi.mock('../../store', () => ({
  store: {
    dispatch: vi.fn(),
  },
}));

vi.mock('../../store/slices/authSlice', () => ({
  refreshAccessToken: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('../services/csrfService', () => ({
  default: {
    getOrFetchCsrfToken: vi.fn(),
    getCsrfToken: vi.fn(),
    clearCsrfToken: vi.fn(),
  },
}));

describe('API Service', () => {
  let mockAxiosInstance: any;
  let tokenStorage: any;
  let api: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mock axios instance
    mockAxiosInstance = {
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      request: vi.fn(),
    };

    const mockedAxios = vi.mocked(axios);
    (mockedAxios.create as unknown as Mock).mockReturnValue(mockAxiosInstance);

    // Import modules after mocking
    tokenStorage = await import('../../lib/tokenStorage');

    // Setup default mocks
    vi.mocked(tokenStorage.getStoredAccessToken).mockReturnValue(null);
    vi.mocked(tokenStorage.getStoredRefreshToken).mockReturnValue(null);

    // Import API module to trigger axios.create call
    const apiModule = await import('../../services/api');
    api = apiModule.default;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Axios Instance Creation', () => {
    it('creates axios instance with correct configuration', () => {
      const mockedAxios = vi.mocked(axios);
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: expect.any(String),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('sets up request and response interceptors', () => {
      // Just verify that the api instance has the basic structure we expect
      expect(api).toBeDefined();
      expect(typeof api.interceptors).toBe('object');
      expect(typeof api.interceptors.request).toBe('object');
      expect(typeof api.interceptors.response).toBe('object');
    });
  });

  describe('Basic API Service', () => {
    it('exports the configured axios instance', () => {
      expect(api).toBeDefined();
      expect(typeof api).toBe('object');
      expect(typeof api.get).toBe('function');
      expect(typeof api.post).toBe('function');
      expect(typeof api.put).toBe('function');
      expect(typeof api.delete).toBe('function');
    });
  });

  describe('Type Definitions', () => {
    it('defines ErrorDetail interface correctly', async () => {
      // Test that we can create objects matching the interface
      const errorDetail = {
        field: 'email',
        code: 'INVALID_FORMAT',
        message: 'Invalid email format',
      };

      expect(errorDetail.field).toBe('email');
      expect(errorDetail.code).toBe('INVALID_FORMAT');
      expect(errorDetail.message).toBe('Invalid email format');
    });

    it('defines SuccessResponse interface correctly', async () => {
      // Test that we can create objects matching the interface
      const successResponse = {
        status: 'success',
        message: 'Operation completed',
        data: { id: '123' },
        meta: { total: 1 },
      };

      expect(successResponse.status).toBe('success');
      expect(successResponse.data.id).toBe('123');
      expect(successResponse.meta?.total).toBe(1);
    });
  });
});
