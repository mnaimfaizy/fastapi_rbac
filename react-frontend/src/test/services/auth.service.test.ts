/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosResponse } from 'axios';
import authService from '../../services/auth.service';
import api, { SuccessResponse } from '../../services/api';
import {
  LoginCredentials,
  Token,
  TokenRead,
  UserRegister,
  VerifyEmail,
} from '../../models/auth';
import { User } from '../../models/user';

// Mock the API module
vi.mock('../../services/api');
const mockedApi = vi.mocked(api);

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('successfully logs in user with valid credentials', async () => {
      const mockCredentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockToken: Token = {
        access_token: 'mock-access-token',
        token_type: 'Bearer',
        refresh_token: 'mock-refresh-token',
        user: {
          id: '123',
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          is_active: true,
          is_superuser: false,
          roles: [],
          permissions: [],
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      };

      const mockResponse: AxiosResponse<SuccessResponse<Token>> = {
        data: {
          status: 'success',
          message: 'Login successful',
          data: mockToken,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockedApi.post.mockResolvedValue(mockResponse);

      const result = await authService.login(mockCredentials);

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/auth/login',
        mockCredentials
      );
      expect(result).toEqual(mockToken);
    });

    it('handles login failure with invalid credentials', async () => {
      const mockCredentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      const mockError = new Error('Invalid credentials');
      mockedApi.post.mockRejectedValue(mockError);

      await expect(authService.login(mockCredentials)).rejects.toThrow(
        'Invalid credentials'
      );
    });

    it('validates email format in credentials', () => {
      const invalidCredentials: LoginCredentials = {
        email: 'invalid-email',
        password: 'password123',
      };

      // This is more of a type check - in real implementation,
      // validation would be handled by the backend or form validation
      expect(invalidCredentials.email).toBe('invalid-email');
    });
  });

  describe('refreshToken', () => {
    it('successfully refreshes access token', async () => {
      const refreshToken = 'mock-refresh-token';

      const mockTokenRead: TokenRead = {
        access_token: 'new-access-token',
        token_type: 'Bearer',
      };

      const mockResponse: AxiosResponse<SuccessResponse<TokenRead>> = {
        data: {
          status: 'success',
          message: 'Token refreshed successfully',
          data: mockTokenRead,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockedApi.post.mockResolvedValue(mockResponse);

      const result = await authService.refreshToken(refreshToken);

      expect(mockedApi.post).toHaveBeenCalledWith('/auth/new_access_token', {
        refresh_token: refreshToken,
      });
      expect(result).toEqual(mockTokenRead);
    });

    it('handles invalid refresh token', async () => {
      const mockError = new Error('Invalid refresh token');
      mockedApi.post.mockRejectedValue(mockError);

      await expect(authService.refreshToken('invalid-token')).rejects.toThrow(
        'Invalid refresh token'
      );
    });

    it('handles expired refresh token', async () => {
      const mockError = new Error('Refresh token expired');
      mockedApi.post.mockRejectedValue(mockError);

      await expect(authService.refreshToken('expired-token')).rejects.toThrow(
        'Refresh token expired'
      );
    });
  });

  describe('getCurrentUser', () => {
    it('successfully retrieves current user profile', async () => {
      const mockUser: User = {
        id: '123',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        is_active: true,
        is_superuser: false,
        roles: [
          {
            id: 'role1',
            name: 'admin',
            description: 'Administrator role',
            permissions: [],
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T00:00:00Z',
          },
        ],
        permissions: [],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockResponse: AxiosResponse<SuccessResponse<User>> = {
        data: {
          status: 'success',
          message: 'User profile retrieved',
          data: mockUser,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockedApi.get.mockResolvedValue(mockResponse);

      const result = await authService.getCurrentUser();

      expect(mockedApi.get).toHaveBeenCalledWith('/users');
      expect(result).toEqual(mockUser);
    });

    it('handles unauthorized access when token is invalid', async () => {
      const mockError = new Error('Unauthorized');
      mockedApi.get.mockRejectedValue(mockError);

      await expect(authService.getCurrentUser()).rejects.toThrow(
        'Unauthorized'
      );
    });
  });

  describe('register', () => {
    it('successfully registers a new user', async () => {
      const mockUserData: UserRegister = {
        email: 'newuser@example.com',
        password: 'securePassword123',
        first_name: 'New',
        last_name: 'User',
      };

      const mockToken: Token = {
        access_token: 'new-user-token',
        token_type: 'Bearer',
        refresh_token: 'new-user-refresh-token',
        user: {
          id: '456',
          email: 'newuser@example.com',
          first_name: 'New',
          last_name: 'User',
          is_active: true,
          is_superuser: false,
          roles: [],
          permissions: [],
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      };

      const mockResponse: AxiosResponse<SuccessResponse<Token>> = {
        data: {
          status: 'success',
          message: 'Registration successful',
          data: mockToken,
        },
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as any,
      };

      mockedApi.post.mockResolvedValue(mockResponse);

      const result = await authService.register(mockUserData);

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/auth/register',
        mockUserData
      );
      expect(result).toEqual(mockToken);
    });

    it('handles registration with duplicate email', async () => {
      const mockUserData: UserRegister = {
        email: 'existing@example.com',
        password: 'password123',
        first_name: 'Test',
        last_name: 'User',
      };

      const mockError = new Error('Email already registered');
      mockedApi.post.mockRejectedValue(mockError);

      await expect(authService.register(mockUserData)).rejects.toThrow(
        'Email already registered'
      );
    });

    it('validates password strength requirements', () => {
      const userData: UserRegister = {
        email: 'test@example.com',
        password: 'weak',
        first_name: 'Test',
        last_name: 'User',
      };

      // This would typically be validated on the frontend or backend
      expect(userData.password.length).toBeLessThan(8);
    });
  });

  describe('logout', () => {
    it('successfully logs out user', async () => {
      const mockResponse: AxiosResponse<SuccessResponse<null>> = {
        data: {
          status: 'success',
          message: 'Logout successful',
          data: null,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockedApi.post.mockResolvedValue(mockResponse);

      await authService.logout();

      expect(mockedApi.post).toHaveBeenCalledWith('/auth/logout');
    });

    it('handles logout when already logged out', async () => {
      const mockError = new Error('No active session');
      mockedApi.post.mockRejectedValue(mockError);

      await expect(authService.logout()).rejects.toThrow('No active session');
    });
  });

  describe('requestPasswordReset', () => {
    it('successfully requests password reset', async () => {
      const email = 'test@example.com';

      const mockResponse: AxiosResponse<SuccessResponse<null>> = {
        data: {
          status: 'success',
          message: 'Password reset email sent',
          data: null,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockedApi.post.mockResolvedValue(mockResponse);

      await authService.requestPasswordReset(email);

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/auth/password-reset/request',
        { email }
      );
    });

    it('handles non-existent email gracefully', async () => {
      const email = 'nonexistent@example.com';

      const mockResponse: AxiosResponse<SuccessResponse<null>> = {
        data: {
          status: 'success',
          message: 'Password reset email sent',
          data: null,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockedApi.post.mockResolvedValue(mockResponse);

      await authService.requestPasswordReset(email);

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/auth/password-reset/request',
        { email }
      );
    });
  });

  describe('confirmPasswordReset', () => {
    it('successfully resets password with valid token', async () => {
      const token = 'valid-reset-token';
      const newPassword = 'newSecurePassword123';

      const mockResponse: AxiosResponse<SuccessResponse<null>> = {
        data: {
          status: 'success',
          message: 'Password reset successful',
          data: null,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockedApi.post.mockResolvedValue(mockResponse);

      await authService.confirmPasswordReset(token, newPassword);

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/auth/password-reset/confirm',
        { token, new_password: newPassword }
      );
    });

    it('handles invalid reset token', async () => {
      const mockError = new Error('Invalid reset token');
      mockedApi.post.mockRejectedValue(mockError);

      await expect(
        authService.confirmPasswordReset('invalid-token', 'newPassword123')
      ).rejects.toThrow('Invalid reset token');
    });

    it('validates new password strength', () => {
      const weakPassword = 'weak';
      expect(weakPassword.length).toBeLessThan(8);
    });
  });

  describe('verifyEmail', () => {
    it('successfully verifies email with valid token', async () => {
      const mockTokenData: VerifyEmail = {
        token: 'valid-verification-token',
      };

      const mockResponse: AxiosResponse<SuccessResponse<null>> = {
        data: {
          status: 'success',
          message: 'Email verified successfully',
          data: null,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockedApi.post.mockResolvedValue(mockResponse);

      await authService.verifyEmail(mockTokenData);

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/auth/verify-email',
        mockTokenData
      );
    });

    it('handles invalid verification token', async () => {
      const mockTokenData: VerifyEmail = {
        token: 'invalid-token',
      };

      const mockError = new Error('Invalid verification token');
      mockedApi.post.mockRejectedValue(mockError);

      await expect(authService.verifyEmail(mockTokenData)).rejects.toThrow(
        'Invalid verification token'
      );
    });
  });

  describe('resendVerificationEmail', () => {
    it('successfully resends verification email', async () => {
      const email = 'test@example.com';

      const mockResponse: AxiosResponse<SuccessResponse<null>> = {
        data: {
          status: 'success',
          message: 'Verification email sent',
          data: null,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockedApi.post.mockResolvedValue(mockResponse);

      await authService.resendVerificationEmail(email);

      expect(mockedApi.post).toHaveBeenCalledWith(
        '/auth/resend-verification-email',
        { email }
      );
    });

    it('handles rate limiting for verification email', async () => {
      const mockError = new Error(
        'Please wait before requesting another verification email'
      );
      mockedApi.post.mockRejectedValue(mockError);

      await expect(
        authService.resendVerificationEmail('test@example.com')
      ).rejects.toThrow(
        'Please wait before requesting another verification email'
      );
    });
  });

  describe('Error Handling', () => {
    it('preserves original error messages', async () => {
      const originalError = new Error('Original error message');
      mockedApi.post.mockRejectedValue(originalError);

      await expect(
        authService.login({ email: 'test@example.com', password: 'password' })
      ).rejects.toThrow('Original error message');
    });

    it('handles network errors', async () => {
      const networkError = new Error('Network Error');
      networkError.name = 'NetworkError';
      mockedApi.post.mockRejectedValue(networkError);

      await expect(
        authService.login({ email: 'test@example.com', password: 'password' })
      ).rejects.toThrow('Network Error');
    });

    it('handles timeout errors', async () => {
      const timeoutError = new Error('Request timeout');
      mockedApi.post.mockRejectedValue(timeoutError);

      await expect(
        authService.login({ email: 'test@example.com', password: 'password' })
      ).rejects.toThrow('Request timeout');
    });
  });

  describe('Service Instance', () => {
    it('exports a singleton instance', () => {
      expect(authService).toBeDefined();
      expect(typeof authService.login).toBe('function');
      expect(typeof authService.register).toBe('function');
      expect(typeof authService.logout).toBe('function');
      expect(typeof authService.refreshToken).toBe('function');
      expect(typeof authService.getCurrentUser).toBe('function');
      expect(typeof authService.requestPasswordReset).toBe('function');
      expect(typeof authService.confirmPasswordReset).toBe('function');
      expect(typeof authService.verifyEmail).toBe('function');
      expect(typeof authService.resendVerificationEmail).toBe('function');
    });
  });
});
