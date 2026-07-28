/**
 * Access tokens stay in memory only (never localStorage) to limit XSS impact.
 * Refresh tokens are HttpOnly cookies set by the backend — not readable by JS.
 *
 * A non-secret session hint in sessionStorage tells the SPA whether to attempt
 * cookie-based session restore on reload (not a credential).
 */

const LEGACY_REFRESH_TOKEN_KEY =
  import.meta.env.VITE_AUTH_REFRESH_TOKEN_NAME ||
  import.meta.env.VITE_REFRESH_TOKEN_NAME ||
  'auth_refresh_token';

const SESSION_HINT_KEY = 'auth_session_active';

/** Module-level access token (memory only). */
let inMemoryToken: string | null = null;

/**
 * Stores access token in memory (not in localStorage for security)
 */
export const setStoredAccessToken = (token: string): void => {
  try {
    inMemoryToken = token;
  } catch (error) {
    console.error('Failed to store access token:', error);
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
 * Mark that a refresh-cookie session may exist (non-secret hint for restore).
 */
export const setAuthSessionHint = (): void => {
  try {
    sessionStorage.setItem(SESSION_HINT_KEY, '1');
  } catch (error) {
    console.error('Failed to set auth session hint:', error);
  }
};

/**
 * Whether the SPA should attempt cookie-based session restore.
 */
export const hasAuthSessionHint = (): boolean => {
  try {
    return sessionStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * Clear the session-restore hint (e.g. after logout).
 */
export const clearAuthSessionHint = (): void => {
  try {
    sessionStorage.removeItem(SESSION_HINT_KEY);
  } catch (error) {
    console.error('Failed to clear auth session hint:', error);
  }
};

/**
 * Remove any legacy localStorage refresh tokens from pre-cookie migrations.
 */
export const clearLegacyRefreshTokenStorage = (): void => {
  try {
    localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
    localStorage.removeItem('auth_refresh_token');
    localStorage.removeItem('refresh_token');
  } catch (error) {
    console.error('Failed to clear legacy refresh token storage:', error);
  }
};

/**
 * Clear in-memory access token, session hint, and legacy refresh storage.
 * The HttpOnly refresh cookie is cleared by the backend on logout.
 */
export const clearAuthTokens = (): void => {
  removeStoredAccessToken();
  clearAuthSessionHint();
  clearLegacyRefreshTokenStorage();
};
