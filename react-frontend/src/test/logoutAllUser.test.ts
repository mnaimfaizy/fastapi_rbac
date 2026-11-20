import { describe, it, expect, vi, beforeEach } from 'vitest';
import authService from '../services/auth.service';
import { logoutAllUser } from '../store/slices/authSlice';
import {
  getStoredAccessToken,
  hasAuthSessionHint,
  setAuthSessionHint,
  setStoredAccessToken,
} from '../lib/tokenStorage';
import { createTestStore } from './test-utils';

vi.mock('../services/auth.service');
const mockAuthService = vi.mocked(authService);

describe('logoutAllUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setStoredAccessToken('mock-access-token');
    setAuthSessionHint();
  });

  it('resolves true and clears auth when logout/all succeeds', async () => {
    mockAuthService.logoutAll.mockResolvedValue(undefined);
    const store = createTestStore();

    const revoked = await store.dispatch(logoutAllUser()).unwrap();

    expect(revoked).toBe(true);
    expect(mockAuthService.logoutAll).toHaveBeenCalledTimes(1);
    expect(store.getState().auth.isAuthenticated).toBe(false);
    expect(store.getState().auth.accessToken).toBeNull();
    expect(getStoredAccessToken()).toBeNull();
    expect(hasAuthSessionHint()).toBe(false);
  });

  it('resolves false and clears auth when logout/all fails', async () => {
    mockAuthService.logoutAll.mockRejectedValue(new Error('network'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createTestStore();

    const revoked = await store.dispatch(logoutAllUser()).unwrap();

    expect(revoked).toBe(false);
    expect(mockAuthService.logoutAll).toHaveBeenCalledTimes(1);
    expect(store.getState().auth.isAuthenticated).toBe(false);
    expect(store.getState().auth.accessToken).toBeNull();
    expect(getStoredAccessToken()).toBeNull();
    expect(hasAuthSessionHint()).toBe(false);
    errorSpy.mockRestore();
  });
});
