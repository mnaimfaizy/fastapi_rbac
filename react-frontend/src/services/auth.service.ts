import api from "./api";
import {
  LoginCredentials,
  Token,
  TokenRead,
  RefreshTokenRequest,
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
  async changePassword(currentPassword: string, newPassword: string) {
    const response = await api.post("/login/change_password", {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  }
}

export default new AuthService();
