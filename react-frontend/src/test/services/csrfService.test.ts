import { describe, it, expect, beforeEach, vi } from 'vitest';
import api from '../../services/api';
import csrfService from '../../services/csrfService';

// Mock the API module
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

describe('CsrfService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear cached token before each test
    csrfService.clearCsrfToken();
  });

  describe('getCsrfToken', () => {
    it('successfully fetches CSRF token from backend', async () => {
      const mockToken = 'test-csrf-token-123';
      const mockResponse = {
        data: {
          data: {
            csrf_token: mockToken,
          },
        },
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const result = await csrfService.getCsrfToken();

      expect(result).toBe(mockToken);
      expect(mockedApi.get).toHaveBeenCalledWith('/auth/csrf-token');
      expect(csrfService.getCurrentToken()).toBe(mockToken);
    });

    it('handles API errors when fetching CSRF token', async () => {
      const mockError = new Error('Network error');
      mockedApi.get.mockRejectedValue(mockError);

      // Mock console.error to avoid console output during tests
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await expect(csrfService.getCsrfToken()).rejects.toThrow('Network error');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to get CSRF token:',
        mockError
      );
      expect(csrfService.getCurrentToken()).toBeNull();

      consoleSpy.mockRestore();
    });

    it('updates internal token cache when fetching new token', async () => {
      const mockToken = 'new-csrf-token-456';
      const mockResponse = {
        data: {
          data: {
            csrf_token: mockToken,
          },
        },
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      expect(csrfService.getCurrentToken()).toBeNull();

      await csrfService.getCsrfToken();

      expect(csrfService.getCurrentToken()).toBe(mockToken);
    });
  });

  describe('getOrFetchCsrfToken', () => {
    it('returns cached token when available', async () => {
      const mockToken = 'cached-csrf-token';
      const mockResponse = {
        data: {
          data: {
            csrf_token: mockToken,
          },
        },
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      // First call should fetch from API
      const firstResult = await csrfService.getOrFetchCsrfToken();
      expect(firstResult).toBe(mockToken);
      expect(mockedApi.get).toHaveBeenCalledTimes(1);

      // Second call should use cached token
      const secondResult = await csrfService.getOrFetchCsrfToken();
      expect(secondResult).toBe(mockToken);
      expect(mockedApi.get).toHaveBeenCalledTimes(1); // No additional API call
    });

    it('fetches new token when cache is empty', async () => {
      const mockToken = 'fresh-csrf-token';
      const mockResponse = {
        data: {
          data: {
            csrf_token: mockToken,
          },
        },
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      expect(csrfService.getCurrentToken()).toBeNull();

      const result = await csrfService.getOrFetchCsrfToken();

      expect(result).toBe(mockToken);
      expect(mockedApi.get).toHaveBeenCalledWith('/auth/csrf-token');
    });

    it('handles errors when fetching token on cache miss', async () => {
      const mockError = new Error('API unavailable');
      mockedApi.get.mockRejectedValue(mockError);

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await expect(csrfService.getOrFetchCsrfToken()).rejects.toThrow(
        'API unavailable'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('clearCsrfToken', () => {
    it('clears the cached CSRF token', async () => {
      const mockToken = 'token-to-clear';
      const mockResponse = {
        data: {
          data: {
            csrf_token: mockToken,
          },
        },
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      // Set a token first
      await csrfService.getCsrfToken();
      expect(csrfService.getCurrentToken()).toBe(mockToken);

      // Clear the token
      csrfService.clearCsrfToken();
      expect(csrfService.getCurrentToken()).toBeNull();
    });

    it('can be called multiple times safely', () => {
      csrfService.clearCsrfToken();
      expect(csrfService.getCurrentToken()).toBeNull();

      csrfService.clearCsrfToken();
      expect(csrfService.getCurrentToken()).toBeNull();
    });
  });

  describe('getCurrentToken', () => {
    it('returns null when no token is cached', () => {
      expect(csrfService.getCurrentToken()).toBeNull();
    });

    it('returns cached token when available', async () => {
      const mockToken = 'current-token-test';
      const mockResponse = {
        data: {
          data: {
            csrf_token: mockToken,
          },
        },
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      await csrfService.getCsrfToken();
      expect(csrfService.getCurrentToken()).toBe(mockToken);
    });

    it('does not trigger API calls', () => {
      csrfService.getCurrentToken();
      expect(mockedApi.get).not.toHaveBeenCalled();
    });
  });

  describe('Service Instance', () => {
    it('exports a singleton instance with all required methods', () => {
      expect(csrfService).toBeDefined();
      expect(typeof csrfService.getCsrfToken).toBe('function');
      expect(typeof csrfService.getOrFetchCsrfToken).toBe('function');
      expect(typeof csrfService.clearCsrfToken).toBe('function');
      expect(typeof csrfService.getCurrentToken).toBe('function');
    });

    it('maintains state across method calls', async () => {
      const mockToken = 'state-test-token';
      const mockResponse = {
        data: {
          data: {
            csrf_token: mockToken,
          },
        },
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      // Test state persistence
      expect(csrfService.getCurrentToken()).toBeNull();

      await csrfService.getCsrfToken();
      expect(csrfService.getCurrentToken()).toBe(mockToken);

      const cachedToken = await csrfService.getOrFetchCsrfToken();
      expect(cachedToken).toBe(mockToken);
      expect(mockedApi.get).toHaveBeenCalledTimes(1); // Only one API call

      csrfService.clearCsrfToken();
      expect(csrfService.getCurrentToken()).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('preserves original error messages', async () => {
      const originalError = new Error('Specific API error');
      mockedApi.get.mockRejectedValue(originalError);

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await expect(csrfService.getCsrfToken()).rejects.toThrow(
        'Specific API error'
      );

      consoleSpy.mockRestore();
    });

    it('handles network timeouts', async () => {
      const timeoutError = new Error('Request timeout');
      mockedApi.get.mockRejectedValue(timeoutError);

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await expect(csrfService.getOrFetchCsrfToken()).rejects.toThrow(
        'Request timeout'
      );

      consoleSpy.mockRestore();
    });

    it('logs errors for debugging', async () => {
      const debugError = new Error('Debug test error');
      mockedApi.get.mockRejectedValue(debugError);

      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      try {
        await csrfService.getCsrfToken();
      } catch {
        // Expected to throw
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to get CSRF token:',
        debugError
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Token Lifecycle', () => {
    it('handles complete token lifecycle correctly', async () => {
      const mockToken1 = 'lifecycle-token-1';
      const mockToken2 = 'lifecycle-token-2';

      // Setup first token
      mockedApi.get.mockResolvedValueOnce({
        data: { data: { csrf_token: mockToken1 } },
      });

      // Get first token
      const token1 = await csrfService.getCsrfToken();
      expect(token1).toBe(mockToken1);
      expect(csrfService.getCurrentToken()).toBe(mockToken1);

      // Use cached token
      const cachedToken = await csrfService.getOrFetchCsrfToken();
      expect(cachedToken).toBe(mockToken1);
      expect(mockedApi.get).toHaveBeenCalledTimes(1);

      // Clear and get new token
      csrfService.clearCsrfToken();
      expect(csrfService.getCurrentToken()).toBeNull();

      // Setup second token
      mockedApi.get.mockResolvedValueOnce({
        data: { data: { csrf_token: mockToken2 } },
      });

      // Get new token
      const token2 = await csrfService.getOrFetchCsrfToken();
      expect(token2).toBe(mockToken2);
      expect(csrfService.getCurrentToken()).toBe(mockToken2);
      expect(mockedApi.get).toHaveBeenCalledTimes(2);
    });
  });
});
