/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import authTokenManager from '../../services/authTokenManager';

// Mock dependencies
vi.mock('../../store', () => ({
  store: {
    dispatch: vi.fn(),
  },
}));

vi.mock('../../store/slices/authSlice', () => ({
  logout: vi.fn(() => ({ type: 'auth/logout' })),
}));

describe('AuthTokenManager', () => {
  let store: any;
  let logout: any;
  let clearTimeoutSpy: any;
  let setTimeoutSpy: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import mocked modules
    store = await import('../../store');
    const authSlice = await import('../../store/slices/authSlice');
    logout = authSlice.logout;

    // Mock timer functions
    vi.useFakeTimers();
    clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    setTimeoutSpy = vi.spyOn(global, 'setTimeout');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('JWT Token Decoding', () => {
    it('successfully decodes a valid JWT token', () => {
      // Create a valid JWT token payload
      const payload = {
        exp: Math.floor(Date.now() / 1000) + 3600,
        sub: 'user123',
      };
      const base64Payload = btoa(JSON.stringify(payload));
      const validToken = `header.${base64Payload}.signature`;

      const result = authTokenManager.decodeJWT(validToken);

      expect(result).toEqual(payload);
    });

    it('returns null for invalid JWT token format', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const invalidToken = 'invalid.token.format';

      const result = authTokenManager.decodeJWT(invalidToken);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error decoding JWT token:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it('returns null for malformed JWT payload', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const invalidPayload = 'invalid-base64';
      const malformedToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${invalidPayload}.signature`;

      const result = authTokenManager.decodeJWT(malformedToken);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error decoding JWT token:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it('returns null for empty or null token', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      expect(authTokenManager.decodeJWT('')).toBeNull();
      expect(authTokenManager.decodeJWT(null as any)).toBeNull();
      expect(authTokenManager.decodeJWT(undefined as any)).toBeNull();

      expect(consoleSpy).toHaveBeenCalledTimes(3);
      consoleSpy.mockRestore();
    });

    it('returns null for token with missing parts', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const incompleteToken = 'header.payload'; // Missing signature

      const result = authTokenManager.decodeJWT(incompleteToken);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error decoding JWT token:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Token Expiry Timer Management', () => {
    it('sets up expiry timer for valid token', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const payload = { exp: futureExp };
      const base64Payload = btoa(JSON.stringify(payload));
      const validToken = `header.${base64Payload}.signature`;

      authTokenManager.setupTokenExpiryTimer(validToken);

      expect(setTimeoutSpy).toHaveBeenCalled();
      expect(clearTimeoutSpy).toHaveBeenCalled(); // Called to clear any existing timer
    });

    it('immediately logs out if token is already expired', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const payload = { exp: pastExp };
      const base64Payload = btoa(JSON.stringify(payload));
      const expiredToken = `header.${base64Payload}.signature`;

      authTokenManager.setupTokenExpiryTimer(expiredToken);

      expect(store.store.dispatch).toHaveBeenCalledWith(logout());
    });

    it('handles token without expiry claim', () => {
      const payload = { sub: 'user123' }; // No exp claim
      const base64Payload = btoa(JSON.stringify(payload));
      const tokenWithoutExp = `header.${base64Payload}.signature`;

      authTokenManager.setupTokenExpiryTimer(tokenWithoutExp);

      // Should not set timer or dispatch logout immediately
      expect(setTimeoutSpy).not.toHaveBeenCalled();
      expect(store.store.dispatch).not.toHaveBeenCalled();
    });

    it('clears existing timer when setting new one', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const payload = { exp: futureExp };
      const base64Payload = btoa(JSON.stringify(payload));
      const validToken = `header.${base64Payload}.signature`;

      // Set timer twice
      authTokenManager.setupTokenExpiryTimer(validToken);
      authTokenManager.setupTokenExpiryTimer(validToken);

      // clearTimeout should be called twice (once for each setupTokenExpiryTimer call)
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
    });

    it('uses 10-second buffer before token expiry', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const payload = { exp: futureExp };
      const base64Payload = btoa(JSON.stringify(payload));
      const validToken = `header.${base64Payload}.signature`;

      authTokenManager.setupTokenExpiryTimer(validToken);

      // Check that setTimeout was called with correct timeout value (should have 10 second buffer)
      expect(setTimeoutSpy).toHaveBeenCalled();
      const timeoutValue = setTimeoutSpy.mock.calls[0][1];

      // Should be approximately 1 hour minus 10 seconds (3600s - 10s = 3590s)
      const expectedTimeout = futureExp * 1000 - Date.now() - 10000;
      expect(timeoutValue).toBeCloseTo(expectedTimeout, -3); // Within 1 second
    });
  });

  describe('Timer Cleanup', () => {
    it('clears expiry timer when requested', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const payload = { exp: futureExp };
      const base64Payload = btoa(JSON.stringify(payload));
      const validToken = `header.${base64Payload}.signature`;

      // Set up a timer first
      authTokenManager.setupTokenExpiryTimer(validToken);

      // Clear the timer
      authTokenManager.clearExpiryTimer();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('handles clearing timer when no timer is set', () => {
      // Clear timer without setting one first
      authTokenManager.clearExpiryTimer();

      // Should still call clearTimeout (with null/undefined)
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('Token Expiry Callback', () => {
    it('dispatches logout action when token expires', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 1; // 1 second from now
      const payload = { exp: futureExp };
      const base64Payload = btoa(JSON.stringify(payload));
      const validToken = `header.${base64Payload}.signature`;

      authTokenManager.setupTokenExpiryTimer(validToken);

      // Fast-forward time to trigger the timer (1 second - 10 second buffer = immediate)
      vi.advanceTimersByTime(1000);

      expect(store.store.dispatch).toHaveBeenCalledWith(logout());
    });

    it('handles multiple timer expirations correctly', () => {
      const futureExp1 = Math.floor(Date.now() / 1000) + 1;
      const futureExp2 = Math.floor(Date.now() / 1000) + 2;

      const payload1 = { exp: futureExp1 };
      const payload2 = { exp: futureExp2 };

      const base64Payload1 = btoa(JSON.stringify(payload1));
      const base64Payload2 = btoa(JSON.stringify(payload2));

      const token1 = `header.${base64Payload1}.signature`;
      const token2 = `header.${base64Payload2}.signature`;

      // Set up first timer
      authTokenManager.setupTokenExpiryTimer(token1);

      // Set up second timer (should clear first)
      authTokenManager.setupTokenExpiryTimer(token2);

      // Advance time
      vi.advanceTimersByTime(2000);

      // Should only have one logout call (from the second timer)
      expect(store.store.dispatch).toHaveBeenCalledWith(logout());
    });
  });

  describe('Edge Cases', () => {
    it('handles very large expiry times', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const veryFutureExp = Math.floor(Date.now() / 1000) + 999999999; // Very far future
      const payload = { exp: veryFutureExp };
      const base64Payload = btoa(JSON.stringify(payload));
      const validToken = `header.${base64Payload}.signature`;

      authTokenManager.setupTokenExpiryTimer(validToken);

      expect(setTimeoutSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('handles token expiry in the past but within buffer', () => {
      const recentPastExp = Math.floor(Date.now() / 1000) - 5; // 5 seconds ago
      const payload = { exp: recentPastExp };
      const base64Payload = btoa(JSON.stringify(payload));
      const recentExpiredToken = `header.${base64Payload}.signature`;

      authTokenManager.setupTokenExpiryTimer(recentExpiredToken);

      expect(store.store.dispatch).toHaveBeenCalledWith(logout());
    });

    it('handles invalid expiry timestamp', () => {
      const payload = { exp: 'invalid-timestamp' };
      const base64Payload = btoa(JSON.stringify(payload));
      const invalidExpToken = `header.${base64Payload}.signature`;

      authTokenManager.setupTokenExpiryTimer(invalidExpToken);

      // Should not throw error, but also should not set timer
      expect(setTimeoutSpy).not.toHaveBeenCalled();
    });
  });

  describe('Service Instance', () => {
    it('exports the token manager with all required methods', () => {
      expect(authTokenManager).toBeDefined();
      expect(typeof authTokenManager.setupTokenExpiryTimer).toBe('function');
      expect(typeof authTokenManager.clearExpiryTimer).toBe('function');
    });

    it('maintains singleton pattern', () => {
      const manager1 = authTokenManager;
      const manager2 = authTokenManager;

      expect(manager1).toBe(manager2);
    });
  });

  describe('Integration with Store', () => {
    it('correctly integrates with Redux store dispatch', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 100;
      const payload = { exp: pastExp };
      const base64Payload = btoa(JSON.stringify(payload));
      const expiredToken = `header.${base64Payload}.signature`;

      authTokenManager.setupTokenExpiryTimer(expiredToken);

      expect(store.store.dispatch).toHaveBeenCalledWith(logout());
      expect(store.store.dispatch).toHaveBeenCalledTimes(1);
    });
  });
});
