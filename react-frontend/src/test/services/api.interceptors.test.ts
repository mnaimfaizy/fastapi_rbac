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

describe('api error body normalisation', () => {
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

  it('keeps a field_name body as a field-specific error', async () => {
    const error = {
      response: {
        status: 400,
        data: {
          detail: {
            field_name: 'email',
            message: 'Incorrect email or password',
          },
        },
      },
      config: { url: '/auth/login', headers: {} },
    };

    await expect(responseErrorHandler(error)).rejects.toBeDefined();

    expect(error.response.data).toEqual({
      status: 'error',
      message: 'Incorrect email or password',
      errors: [{ field: 'email', message: 'Incorrect email or password' }],
    });
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

  it('keeps a string detail as the error message', async () => {
    const error = {
      response: {
        status: 404,
        data: { detail: 'Reset token is invalid or has expired' },
      },
      config: { url: '/auth/reset-password', headers: {} },
    };

    await expect(responseErrorHandler(error)).rejects.toBeDefined();

    expect(error.response.data).toEqual({
      status: 'error',
      message: 'Reset token is invalid or has expired',
      errors: [{ message: 'Reset token is invalid or has expired' }],
    });
  });

  it('keeps a structured message when the body has no field_name', async () => {
    const error = {
      response: {
        status: 400,
        data: { detail: { message: 'Account locked until 12:00' } },
      },
      config: { url: '/auth/login', headers: {} },
    };

    await expect(responseErrorHandler(error)).rejects.toBeDefined();

    expect(error.response.data).toEqual({
      status: 'error',
      message: 'Account locked until 12:00',
    });
  });

  it('yields a visible generic message for an unrecognised shape without nesting the original payload', async () => {
    const error = {
      response: { status: 400, data: { detail: { something: 'else' } } },
      config: { url: '/auth/register', headers: {} },
    };

    await expect(responseErrorHandler(error)).rejects.toBeDefined();

    expect(error.response.data).toEqual({
      status: 'error',
      message: 'An unexpected error occurred',
    });
  });

  it('leaves an already-normalised error body unchanged', async () => {
    const error = {
      response: {
        status: 400,
        data: {
          status: 'error',
          message: 'Invalid Current Password',
          errors: [{ message: 'Invalid Current Password' }],
        },
      },
      config: { url: '/auth/change-password', headers: {} },
    };

    await expect(responseErrorHandler(error)).rejects.toBeDefined();

    expect(error.response.data).toEqual({
      status: 'error',
      message: 'Invalid Current Password',
      errors: [{ message: 'Invalid Current Password' }],
    });
  });

  it('uses the generic message when a complexity body has only whitespace as its summary', async () => {
    const error = {
      response: {
        status: 400,
        data: {
          detail: {
            message: '   ',
            errors: ['Password must contain at least one digit'],
          },
        },
      },
      config: { url: '/auth/register', headers: {} },
    };

    await expect(responseErrorHandler(error)).rejects.toBeDefined();

    expect(error.response.data).toEqual({
      status: 'error',
      message: 'An unexpected error occurred',
      errors: [{ message: 'Password must contain at least one digit' }],
    });
  });

  it('yields a visible generic message for an array detail without nesting it', async () => {
    const error = {
      response: {
        status: 422,
        data: {
          detail: [{ loc: ['body', 'password'], msg: 'field required' }],
        },
      },
      config: { url: '/auth/register', headers: {} },
    };

    await expect(responseErrorHandler(error)).rejects.toBeDefined();

    expect(error.response.data).toEqual({
      status: 'error',
      message: 'An unexpected error occurred',
    });
  });

  it('rewrites a whitespace-only string detail to a visible generic message', async () => {
    const error = {
      response: { status: 400, data: { detail: '   ' } },
      config: { url: '/auth/register', headers: {} },
    };

    await expect(responseErrorHandler(error)).rejects.toBeDefined();

    expect(error.response.data).toEqual({
      status: 'error',
      message: 'An unexpected error occurred',
      errors: [{ message: 'An unexpected error occurred' }],
    });
  });
});
