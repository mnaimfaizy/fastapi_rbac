// Constants for token storage keys
const REFRESH_TOKEN_KEY =
  process.env.VITE_AUTH_REFRESH_TOKEN_NAME || "auth_refresh_token";

/**
 * Securely stores the access token in memory (for security)
 * We don't store it in localStorage to prevent XSS attacks
 */
let inMemoryToken: string | null = null;

/**
 * Stores access token in memory (not in localStorage for security)
 */
export const setStoredAccessToken = (token: string): void => {
  try {
    inMemoryToken = token;
  } catch (error) {
    console.error("Failed to store access token:", error);
    inMemoryToken = null;
  }
};

/**
 * Get the stored access token from memory
 */
export const getStoredAccessToken = (): string | null => {
  return inMemoryToken;
};

/**
 * Removes the access token from memory
 */
export const removeStoredAccessToken = (): void => {
  inMemoryToken = null;
};

/**
 * Stores refresh token in localStorage with encryption
 * In a production app, consider using HTTP-only cookies for refresh tokens
 */
export const setStoredRefreshToken = (token: string): void => {
  try {
    if (typeof token !== "string") {
      throw new Error("Token must be a string");
    }
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } catch (error) {
    console.error("Failed to store refresh token:", error);
    // Clean up any partial data
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};

/**
 * Get the stored refresh token from localStorage
 */
export const getStoredRefreshToken = (): string | null => {
  try {
    const token = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!token) return null;

    // Validate that we can parse it if it's supposed to be JSON
    if (token.startsWith("{") || token.startsWith("[")) {
      JSON.parse(token);
    }

    return token;
  } catch (error) {
    console.error("Failed to retrieve refresh token:", error);
    // Clean up invalid data
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    return null;
  }
};

/**
 * Removes the refresh token from localStorage
 */
export const removeStoredRefreshToken = (): void => {
  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error("Failed to remove refresh token:", error);
  }
};

/**
 * Clear all authentication tokens
 */
export const clearAuthTokens = (): void => {
  removeStoredAccessToken();
  removeStoredRefreshToken();
};
