import { store } from '../store';
import { logout } from '../store/slices/authSlice';

/**
 * Token expiration checker
 * Sets up a timer to check for token expiration
 */
class AuthTokenManager {
  private tokenExpiryTimer: number | null = null;

  /**
   * Set timer to check token expiration
   * @param token JWT access token
   */
  setupTokenExpiryTimer(token: string): void {
    // Clear any existing timers
    this.clearExpiryTimer();

    try {
      // Decode token to get expiration time
      const tokenData = this.decodeJWT(token);

      if (tokenData && tokenData.exp) {
        // Get expiry time in milliseconds
        const expiryTime = tokenData.exp * 1000;
        const currentTime = Date.now();

        // Calculate time until expiry (with 10 second buffer)
        const timeUntilExpiry = expiryTime - currentTime - 10000;

        if (timeUntilExpiry > 0) {
          // Set timer to logout user when token expires
          this.tokenExpiryTimer = window.setTimeout(() => {
            store.dispatch(logout());
          }, timeUntilExpiry);
        } else {
          // Token already expired
          store.dispatch(logout());
        }
      }
    } catch (error) {
      console.error('Error setting token expiry timer:', error);
    }
  }

  /**
   * Clear the token expiry timer
   */
  clearExpiryTimer(): void {
    if (this.tokenExpiryTimer !== null) {
      window.clearTimeout(this.tokenExpiryTimer);
      this.tokenExpiryTimer = null;
    }
  }

  /**
   * Decode JWT token to get payload
   * @param token JWT token string
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private decodeJWT(token: string): any {
    try {
      // Split the token and get the payload part (second part)
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

      // Decode the base64 string
      const jsonPayload = decodeURIComponent(
        window
          .atob(base64)
          .split('')
          .map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join('')
      );

      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding JWT token:', error);
      return null;
    }
  }
}

export default new AuthTokenManager();
