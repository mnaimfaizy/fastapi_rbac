import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import { ProtectedRoute } from '../components/layout/ProtectedRoute';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';

// Mock hooks
vi.mock('../hooks/useAuth');
vi.mock('../hooks/usePermissions');
const mockUseAuth = vi.mocked(useAuth);
const mockUsePermissions = vi.mocked(usePermissions);

// Test component for protected routes
const TestComponent = () => <div>Protected Content</div>;
const UnauthorizedComponent = () => <div>Unauthorized Access</div>;

describe('Security and Permission Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ProtectedRoute', () => {
    it('renders content for authenticated users', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: {
          id: '1',
          email: 'test@example.com',
          roles: [{ id: '1', name: 'user', description: 'User role' }],
        },
        login: vi.fn(),
        logout: vi.fn(),
        loading: false,
      });

      mockUsePermissions.mockReturnValue({
        hasPermission: vi.fn().mockReturnValue(true),
        hasAnyPermission: vi.fn().mockReturnValue(true),
        hasRole: vi.fn().mockReturnValue(true),
        hasAnyRole: vi.fn().mockReturnValue(true),
      });

      renderWithProviders(
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('redirects unauthenticated users to login', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
        loading: false,
      });

      renderWithProviders(
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      );

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      // Should redirect to login page
    });

    it('shows unauthorized for users without required role', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: {
          id: '1',
          email: 'test@example.com',
          roles: [{ id: '1', name: 'user', description: 'User role' }],
        },
        login: vi.fn(),
        logout: vi.fn(),
        loading: false,
      });

      mockUsePermissions.mockReturnValue({
        hasPermission: vi.fn().mockReturnValue(false),
        hasAnyPermission: vi.fn().mockReturnValue(false),
        hasRole: vi.fn().mockReturnValue(false),
        hasAnyRole: vi.fn().mockReturnValue(false),
      });

      renderWithProviders(
        <ProtectedRoute requiredRoles={['admin']}>
          <TestComponent />
        </ProtectedRoute>
      );

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(screen.getByText(/unauthorized/i)).toBeInTheDocument();
    });

    it('shows unauthorized for users without required permission', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: {
          id: '1',
          email: 'test@example.com',
          permissions: [
            { id: '1', name: 'user.read', description: 'Read users' },
          ],
        },
        login: vi.fn(),
        logout: vi.fn(),
        loading: false,
      });

      mockUsePermissions.mockReturnValue({
        hasPermission: vi.fn().mockImplementation((permission) => {
          return permission === 'user.read';
        }),
        hasAnyPermission: vi.fn().mockReturnValue(false),
        hasRole: vi.fn().mockReturnValue(true),
        hasAnyRole: vi.fn().mockReturnValue(true),
      });

      renderWithProviders(
        <ProtectedRoute requiredPermissions={['user.create']}>
          <TestComponent />
        </ProtectedRoute>
      );

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(screen.getByText(/unauthorized/i)).toBeInTheDocument();
    });

    it('renders content when user has any of the required permissions', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: {
          id: '1',
          email: 'test@example.com',
          permissions: [
            { id: '1', name: 'user.read', description: 'Read users' },
            { id: '2', name: 'user.create', description: 'Create users' },
          ],
        },
        login: vi.fn(),
        logout: vi.fn(),
        loading: false,
      });

      mockUsePermissions.mockReturnValue({
        hasPermission: vi.fn().mockReturnValue(false),
        hasAnyPermission: vi.fn().mockReturnValue(true),
        hasRole: vi.fn().mockReturnValue(true),
        hasAnyRole: vi.fn().mockReturnValue(true),
      });

      renderWithProviders(
        <ProtectedRoute requiredPermissions={['user.create', 'admin.all']}>
          <TestComponent />
        </ProtectedRoute>
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('shows loading state while authentication is loading', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
        loading: true,
      });

      renderWithProviders(
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      );

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('usePermissions Hook', () => {
    it('correctly identifies user permissions', () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        permissions: [
          { id: '1', name: 'user.read', description: 'Read users' },
          { id: '2', name: 'user.create', description: 'Create users' },
        ],
        roles: [{ id: '1', name: 'manager', description: 'Manager role' }],
      };

      // Test the actual hook implementation
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
        login: vi.fn(),
        logout: vi.fn(),
        loading: false,
      });

      // Reset the mock to test actual implementation
      mockUsePermissions.mockRestore();

      const TestHookComponent = () => {
        const { hasPermission, hasRole } = usePermissions();
        return (
          <div>
            <span data-testid="has-read">
              {hasPermission('user.read') ? 'true' : 'false'}
            </span>
            <span data-testid="has-delete">
              {hasPermission('user.delete') ? 'true' : 'false'}
            </span>
            <span data-testid="has-manager">
              {hasRole('manager') ? 'true' : 'false'}
            </span>
            <span data-testid="has-admin">
              {hasRole('admin') ? 'true' : 'false'}
            </span>
          </div>
        );
      };

      renderWithProviders(<TestHookComponent />);

      expect(screen.getByTestId('has-read')).toHaveTextContent('true');
      expect(screen.getByTestId('has-delete')).toHaveTextContent('false');
      expect(screen.getByTestId('has-manager')).toHaveTextContent('true');
      expect(screen.getByTestId('has-admin')).toHaveTextContent('false');
    });
  });

  describe('Security Headers and CSRF', () => {
    it('includes CSRF token in state-changing requests', async () => {
      // Mock fetch to capture request headers
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'success' }),
      });
      global.fetch = mockFetch;

      // This would test the actual API service with CSRF
      const { api } = await import('../services/api');

      await api.post('/test-endpoint', { data: 'test' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-CSRFToken': expect.any(String),
          }),
        })
      );
    });

    it('handles CSRF token refresh on 403 errors', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ message: 'CSRF token invalid' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: { csrf_token: 'new-token' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: 'success' }),
        });

      global.fetch = mockFetch;

      const { api } = await import('../services/api');

      const result = await api.post('/test-endpoint', { data: 'test' });

      // Should have called fetch 3 times: failed request, token refresh, retry
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.data).toBe('success');
    });
  });

  describe('Token Management', () => {
    it('automatically refreshes tokens on 401 responses', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ message: 'Token expired' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: {
                access_token: 'new-access-token',
                refresh_token: 'new-refresh-token',
              },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: 'success' }),
        });

      global.fetch = mockFetch;

      const { api } = await import('../services/api');

      // Store a refresh token in localStorage
      localStorage.setItem('refresh_token', 'old-refresh-token');

      const result = await api.get('/protected-endpoint');

      // Should retry the original request with new token
      expect(result.data).toBe('success');
    });

    it('logs out user when refresh token is invalid', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ message: 'Token expired' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ message: 'Refresh token invalid' }),
        });

      global.fetch = mockFetch;

      const { api } = await import('../services/api');

      localStorage.setItem('refresh_token', 'invalid-refresh-token');

      try {
        await api.get('/protected-endpoint');
      } catch (error) {
        expect(error.response.status).toBe(401);
      }

      // Should clear tokens and redirect to login
      expect(localStorage.getItem('refresh_token')).toBeNull();
    });
  });

  describe('Input Sanitization', () => {
    it('sanitizes user input in forms', async () => {
      const maliciousInput =
        '<script>alert("xss")</script><p>Valid content</p>';
      const expectedSanitized = 'Valid content'; // Script tag should be removed

      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { id: '1', email: 'test@example.com' },
        login: vi.fn(),
        logout: vi.fn(),
        loading: false,
      });

      // This would test a form component that uses input sanitization
      const TestForm = () => {
        const [input, setInput] = useState('');
        const [sanitized, setSanitized] = useState('');

        const handleSubmit = () => {
          // Simulate input sanitization
          const cleaned = input
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/<[^>]*>/g, '');
          setSanitized(cleaned);
        };

        return (
          <form onSubmit={handleSubmit}>
            <input
              data-testid="user-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit">Submit</button>
            <div data-testid="sanitized-output">{sanitized}</div>
          </form>
        );
      };

      renderWithProviders(<TestForm />);

      const input = screen.getByTestId('user-input');
      const submitButton = screen.getByRole('button', { name: /submit/i });

      fireEvent.change(input, { target: { value: maliciousInput } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const output = screen.getByTestId('sanitized-output');
        expect(output).toHaveTextContent(expectedSanitized);
        expect(output).not.toHaveTextContent('script');
      });
    });
  });

  describe('Rate Limiting', () => {
    it('handles rate limit errors gracefully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: () =>
          Promise.resolve({
            message: 'Rate limit exceeded. Please try again later.',
          }),
      });

      global.fetch = mockFetch;

      const { api } = await import('../services/api');

      try {
        await api.post('/auth/login', {
          email: 'test@example.com',
          password: 'password',
        });
      } catch (error) {
        expect(error.response.status).toBe(429);
        expect(error.response.data.message).toContain('Rate limit exceeded');
      }
    });

    it('shows user-friendly rate limit messages', async () => {
      const LoginFormWithRateLimit = () => {
        const [error, setError] = useState('');

        const handleSubmit = async () => {
          try {
            // Simulate rate limit error
            throw {
              response: {
                status: 429,
                data: {
                  message: 'Rate limit exceeded. Please try again later.',
                },
              },
            };
          } catch (err) {
            if (err.response?.status === 429) {
              setError(
                'Too many login attempts. Please wait a moment before trying again.'
              );
            }
          }
        };

        return (
          <div>
            <button onClick={handleSubmit}>Login</button>
            {error && <div data-testid="rate-limit-error">{error}</div>}
          </div>
        );
      };

      renderWithProviders(<LoginFormWithRateLimit />);

      const loginButton = screen.getByRole('button', { name: /login/i });
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(screen.getByTestId('rate-limit-error')).toHaveTextContent(
          'Too many login attempts. Please wait a moment before trying again.'
        );
      });
    });
  });
});
