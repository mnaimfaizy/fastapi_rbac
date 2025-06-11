import api, { SuccessResponse } from './api';

/**
 * CSRF Service for managing CSRF tokens
 */
class CsrfService {
  private csrfToken: string | null = null;

  /**
   * Get CSRF token from backend
   */
  async getCsrfToken(): Promise<string> {
    try {
      const response =
        await api.get<SuccessResponse<{ csrf_token: string }>>(
          '/auth/csrf-token'
        );
      this.csrfToken = response.data.data.csrf_token;
      return this.csrfToken;
    } catch (error) {
      console.error('Failed to get CSRF token:', error);
      throw error;
    }
  }

  /**
   * Get cached CSRF token or fetch new one
   */
  async getOrFetchCsrfToken(): Promise<string> {
    if (this.csrfToken) {
      return this.csrfToken;
    }
    return await this.getCsrfToken();
  }

  /**
   * Clear cached CSRF token (call when it expires)
   */
  clearCsrfToken(): void {
    this.csrfToken = null;
  }

  /**
   * Get current cached token (without fetching)
   */
  getCurrentToken(): string | null {
    return this.csrfToken;
  }
}

export default new CsrfService();
