import api, { SuccessResponse } from './api';
import {
  LoginCredentials,
  Token,
  TokenRead,
  RefreshTokenRequest,
  PasswordResetRequest,
  PasswordResetConfirm,
  UserRegister,
  VerifyEmail,
} from '../models/auth';
import { User } from '../models/user'; // Import User type

class AuthService {
  /**
   * Login user with email and password
   */
  async login(credentials: LoginCredentials): Promise<Token> {
    const response = await api.post<SuccessResponse<Token>>(
      '/auth/login',
      credentials
    );
    return response.data.data;
  }

  /**
   * Get new access token using the HttpOnly refresh cookie (sent via credentials).
   */
  async refreshToken(): Promise<TokenRead> {
    const response = await api.post<SuccessResponse<TokenRead>>(
      '/auth/new_access_token',
      {} as RefreshTokenRequest
    );
    return response.data.data;
  }

  /**
   * Get current user profile information
   */
  async getCurrentUser(): Promise<User> {
    // Specify User return type
    const response = await api.get<SuccessResponse<User>>('/users'); // Use User type
    return response.data.data;
  }

  /**
   * Register a new user.
   *
   * Resolves for every address -- new, awaiting verification, already
   * registered, or disabled -- and carries no payload, so callers cannot tell
   * the cases apart either (#113). Branching on anything here would recreate
   * the account-enumeration oracle in the client.
   *
   * Previously typed Promise<Token>, which the server never returned; it sent a
   * user object and the caller discarded it.
   */
  async register(userData: UserRegister): Promise<void> {
    await api.post<SuccessResponse<null>>('/auth/register', userData);
  }

  /**
   * Verify user email using token
   */
  async verifyEmail(tokenData: VerifyEmail): Promise<void> {
    await api.post<SuccessResponse<null>>('/auth/verify-email', tokenData);
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<void> {
    await api.post<SuccessResponse<null>>('/auth/resend-verification-email', {
      email,
    });
  }

  /**
   * Change password
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<Token> {
    const response = await api.post<SuccessResponse<Token>>(
      '/auth/change_password',
      {
        current_password: currentPassword,
        new_password: newPassword,
      }
    );
    return response.data.data;
  }

  /**
   * Logout user and invalidate tokens
   */
  async logout(): Promise<void> {
    await api.post<SuccessResponse<null>>('/auth/logout');
  }

  /**
   * Request password reset for a given email
   */
  async requestPasswordReset(email: string): Promise<void> {
    await api.post<SuccessResponse<null>>('/auth/password-reset/request', {
      email,
    } as PasswordResetRequest);
  }

  /**
   * Reset password using token and new password
   */
  async confirmPasswordReset(
    token: string,
    newPassword: string
  ): Promise<void> {
    await api.post<SuccessResponse<null>>('/auth/password-reset/confirm', {
      token,
      new_password: newPassword,
    } as PasswordResetConfirm);
  }
}

export default new AuthService();
