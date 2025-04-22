import api from "./api";
import {
  LoginCredentials,
  Token,
  TokenRead,
  RefreshTokenRequest,
  PasswordResetRequest,
  PasswordResetConfirm,
} from "../models/auth";

class AuthService {
  /**
   * Login user with email and password
   */
  async login(credentials: LoginCredentials): Promise<Token> {
    const response = await api.post<Token>("/login", credentials);
    return response.data.data;
  }

  /**
   * Get new access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<TokenRead> {
    const response = await api.post<{ data: TokenRead }>(
      "/login/new_access_token",
      { refresh_token: refreshToken } as RefreshTokenRequest
    );
    return response.data.data;
  }

  /**
   * Get current user profile information
   */
  async getCurrentUser() {
    const response = await api.get("/user");
    return response.data.data;
  }

  /**
   * Change password
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<Token> {
    const response = await api.post<{ data: Token }>("/login/change_password", {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data.data;
  }

  /**
   * Logout user and invalidate tokens
   */
  async logout(): Promise<void> {
    await api.post("/login/logout");
  }

  /**
   * Request password reset for a given email
   */
  async requestPasswordReset(email: string): Promise<void> {
    await api.post("/login/password-reset/request", {
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
    await api.post("/login/password-reset/confirm", {
      token,
      new_password: newPassword,
    } as PasswordResetConfirm);
  }
}

export default new AuthService();
