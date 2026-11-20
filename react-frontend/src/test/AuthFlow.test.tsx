import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from './test-utils';
import { logout } from '../store/slices/authSlice';

vi.mock('../services/auth.service');

vi.mock('../lib/tokenStorage', () => ({
  setStoredAccessToken: vi.fn(),
  setAuthSessionHint: vi.fn(),
  hasAuthSessionHint: vi.fn(() => false),
  clearAuthSessionHint: vi.fn(),
  getStoredAccessToken: vi.fn(() => null),
  clearAuthTokens: vi.fn(),
}));

vi.mock('../services/authTokenManager', () => ({
  default: {
    setupTokenExpiryTimer: vi.fn(),
    clearExpiryTimer: vi.fn(),
    decodeJWT: vi.fn(),
  },
}));

describe('Authentication state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears auth state on logout', () => {
    const initialState = {
      auth: {
        user: {
          id: '1',
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          is_active: true,
          is_superuser: false,
          is_locked: false,
          locked_until: null,
          needs_to_change_password: false,
          verified: true,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          last_changed_password_date: null,
          contact_phone: null,
          number_of_failed_attempts: null,
          verification_code: null,
          last_updated_by: null,
          roles: [],
        },
        accessToken: 'mock-token',
        refreshToken: 'mock-refresh-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
        passwordChangeSuccess: false,
        passwordResetRequested: false,
        passwordResetSuccess: false,
      },
    };

    const { store } = renderWithProviders(<div>Test</div>, {
      preloadedState: initialState,
    });

    store.dispatch(logout());

    const authState = store.getState().auth;
    expect(authState.user).toBeNull();
    expect(authState.accessToken).toBeNull();
    expect(authState.isAuthenticated).toBe(false);
  });
});
