/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAxiosInstance } = vi.hoisted(() => ({
  mockAxiosInstance: {
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
  },
}));

vi.mock('axios', () => ({
  default: { create: vi.fn(() => mockAxiosInstance) },
  create: vi.fn(() => mockAxiosInstance),
}));

vi.mock('../../lib/tokenStorage', () => ({
  hasAuthSessionHint: vi.fn(() => true),
  getStoredAccessToken: vi.fn(() => null),
  setStoredAccessToken: vi.fn(),
}));

vi.mock('../../store', () => ({
  store: {
    dispatch: vi.fn((action: any) => ({
      ...action,
      unwrap: () => Promise.reject(new Error('refresh failed')),
    })),
  },
}));

vi.mock('../../store/slices/authSlice', () => ({
  refreshAccessToken: vi.fn(() => ({ type: 'auth/refreshToken' })),
  logout: vi.fn(() => ({ type: 'auth/logout' })),
}));

vi.mock('../../services/csrfService', () => ({
  default: {
    getOrFetchCsrfToken: vi.fn(),
    getCsrfToken: vi.fn(),
    clearCsrfToken: vi.fn(),
  },
}));

// Importing the module registers the interceptors on the mocked instance.
import '../../services/api';
import { refreshAccessToken } from '../../store/slices/authSlice';

const responseErrorHandler =
  mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

const unauthorized = (url: string) => ({
  response: { status: 401, data: {} },
  config: { url, headers: {} },
});

describe('api 401 interceptor', () => {
  beforeEach(() => {
    vi.mocked(refreshAccessToken).mockClear();
  });

  it('does not re-enter the refresh flow when the refresh call itself 401s', async () => {
    await expect(
      responseErrorHandler(unauthorized('/auth/new_access_token'))
    ).rejects.toBeDefined();

    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it('still attempts a refresh when another endpoint 401s', async () => {
    await expect(
      responseErrorHandler(unauthorized('/users/me'))
    ).rejects.toBeDefined();

    expect(refreshAccessToken).toHaveBeenCalled();
  });
});
