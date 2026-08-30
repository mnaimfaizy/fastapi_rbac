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

describe('api password-complexity error normalisation', () => {
  const complexityRejection = (errors: string[]) => ({
    response: {
      status: 400,
      data: {
        detail: {
          message: 'Password does not meet complexity requirements.',
          errors,
        },
      },
    },
    config: { url: '/auth/register', headers: {} },
  });

  it('surfaces the policy rules that failed instead of a generic message', async () => {
    const error = complexityRejection([
      'Password must be at least 12 characters long',
      'Password must contain at least one digit',
    ]);

    await expect(responseErrorHandler(error)).rejects.toBeDefined();

    expect(error.response.data).toEqual({
      status: 'error',
      message: 'Password does not meet complexity requirements.',
      errors: [
        { message: 'Password must be at least 12 characters long' },
        { message: 'Password must contain at least one digit' },
      ],
    });
  });

  it('leaves an unrecognised object detail on the generic path', async () => {
    const error = {
      response: { status: 400, data: { detail: { something: 'else' } } },
      config: { url: '/auth/register', headers: {} },
    };

    await expect(responseErrorHandler(error)).rejects.toBeDefined();

    expect((error.response.data as any).message).toBe(
      'An unexpected error occurred'
    );
  });
});
