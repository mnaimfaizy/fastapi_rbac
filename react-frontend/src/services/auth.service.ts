import api, { SuccessResponse } from "./api";
import {
  LoginCredentials,
  Token,
  TokenRead,
  RefreshTokenRequest,
  PasswordResetRequest,
  PasswordResetConfirm,
  UserRegister,
  VerifyEmail,
} from "../models/auth";
import { User } from "../models/user"; // Import User type

class AuthService {
  /**
   * Login user with email and password
   */
  async login(credentials: LoginCredentials): Promise<Token> {
    const response = await api.post<SuccessResponse<Token>>(
      "/auth/login",
      credentials
    );
    return response.data.data;
  }

  /**
   * Get new access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenRead> {
    const response = await api.post<SuccessResponse<TokenRead>>(
      "/auth/new_access_token",
      { refresh_token: refreshToken } as RefreshTokenRequest
    );
    return response.data.data;
  }

  /**
   * Get current user profile information
   */
  async getCurrentUser(): Promise<User> {
    // Specify User return type
    const response = await api.get<SuccessResponse<User>>("/user"); // Use User type
    return response.data.data;
  }

  /**
   * Register a new user
   */
  async register(userData: UserRegister): Promise<Token> {
    const response = await api.post<SuccessResponse<Token>>(
      "/auth/register",
      userData
    );
    return response.data.data;
  }

  /**
   * Verify user email using token
   */
  async verifyEmail(tokenData: VerifyEmail): Promise<void> {
    await api.post<SuccessResponse<null>>("/auth/verify-email", tokenData);
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<void> {
    await api.post<SuccessResponse<null>>("/auth/resend-verification-email", {
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
      "/auth/change_password",
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
    await api.post<SuccessResponse<null>>("/auth/logout");
  }

  /**
   * Request password reset for a given email
   */
  async requestPasswordReset(email: string): Promise<void> {
    await api.post<SuccessResponse<null>>("/auth/password-reset/request", {
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
    await api.post<SuccessResponse<null>>("/auth/password-reset/confirm", {
      token,
      new_password: newPassword,
    } as PasswordResetConfirm);
  }
}

export default new AuthService();
