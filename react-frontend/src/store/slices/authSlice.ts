import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { AuthState, LoginCredentials } from '../../models/auth';
import authService from '../../services/auth.service';
import authTokenManager from '../../services/authTokenManager';
import {
  setStoredAccessToken,
  setStoredRefreshToken,
  clearAuthTokens,
} from '../../lib/tokenStorage';

// Initial state
const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  passwordChangeSuccess: false,
  passwordResetRequested: false,
  passwordResetSuccess: false,
};

// Async thunks for authentication actions
export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await authService.login(credentials);
      return response;
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        const err = error as {
          response?: {
            data?: { errors?: Array<{ message: string }>; message?: string };
          };
        };
        if (err.response?.data?.errors?.[0]) {
          return rejectWithValue(err.response.data.errors[0].message);
        }
        return rejectWithValue(err.response?.data?.message || 'Login failed');
      }
      return rejectWithValue('Login failed');
    }
  }
);

export const refreshAccessToken = createAsyncThunk(
  'auth/refreshToken',
  async (refreshToken: string, { rejectWithValue, dispatch }) => {
    try {
      const response = await authService.refreshToken(refreshToken);
      return response;
    } catch (error) {
      // Log the user out whenever token refresh fails
      // This ensures users with expired/invalid refresh tokens don't get stuck
      dispatch(logout());

      if (error && typeof error === 'object' && 'response' in error) {
        const err = error as {
          response?: {
            status?: number;
            data?: { errors?: Array<{ message: string }>; message?: string };
          };
        };

        // Handle specific error cases
        if (err.response?.status === 403) {
          return rejectWithValue('Session expired. Please log in again.');
        }

        if (err.response?.data?.errors?.[0]) {
          return rejectWithValue(err.response.data.errors[0].message);
        }

        return rejectWithValue(
          err.response?.data?.message ||
            'Failed to refresh token. Please log in again.'
        );
      }
      return rejectWithValue('Authentication failed. Please log in again.');
    }
  }
);

export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const user = await authService.getCurrentUser();
      return user;
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        const err = error as {
          response?: {
            data?: { errors?: Array<{ message: string }>; message?: string };
          };
        };
        if (err.response?.data?.errors?.[0]) {
          return rejectWithValue(err.response.data.errors[0].message);
        }
        return rejectWithValue(
          err.response?.data?.message || 'Failed to fetch user data'
        );
      }
      return rejectWithValue('Failed to fetch user data');
    }
  }
);

export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async (
    {
      currentPassword,
      newPassword,
    }: { currentPassword: string; newPassword: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await authService.changePassword(
        currentPassword,
        newPassword
      );
      return response;
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        const err = error as {
          response?: {
            data?: {
              detail?: string | { message?: string; errors?: string[] };
              errors?: Array<{ message: string }>;
              message?: string;
            };
          };
        };
        // Handle the new structured error response
        if (
          err.response?.data?.detail &&
          typeof err.response.data.detail === 'object'
        ) {
          return rejectWithValue(err.response.data.detail);
        }
        // Handle if detail is a simple string
        if (
          err.response?.data?.detail &&
          typeof err.response.data.detail === 'string'
        ) {
          return rejectWithValue({ message: err.response.data.detail });
        }
        // Fallback to existing error handling
        if (err.response?.data?.errors?.[0]) {
          return rejectWithValue({
            message: err.response.data.errors[0].message,
          });
        }
        return rejectWithValue({
          message: err.response?.data?.message || 'Failed to change password',
        });
      }
      return rejectWithValue({ message: 'Failed to change password' });
    }
  }
);

// New thunks for password reset functionality
export const requestPasswordReset = createAsyncThunk(
  'auth/requestPasswordReset',
  async (email: string, { rejectWithValue }) => {
    try {
      await authService.requestPasswordReset(email);
      return true;
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        const err = error as {
          response?: {
            data?: { errors?: Array<{ message: string }>; message?: string };
          };
        };
        if (err.response?.data?.errors?.[0]) {
          return rejectWithValue(err.response.data.errors[0].message);
        }
        return rejectWithValue(
          err.response?.data?.message || 'Failed to request password reset'
        );
      }
      return rejectWithValue('Failed to request password reset');
    }
  }
);

export const confirmPasswordReset = createAsyncThunk(
  'auth/confirmPasswordReset',
  async (
    { token, newPassword }: { token: string; newPassword: string },
    { rejectWithValue }
  ) => {
    try {
      await authService.confirmPasswordReset(token, newPassword);
      return true;
    } catch (error) {
      if (error && typeof error === 'object' && 'response' in error) {
        const err = error as {
          response?: {
            data?: {
              detail?: string | { message?: string; errors?: string[] };
              // Keep existing error structures for broader compatibility
              errors?: Array<{ message: string }>;
              message?: string;
            };
          };
        };
        // Handle the new structured error response
        if (
          err.response?.data?.detail &&
          typeof err.response.data.detail === 'object'
        ) {
          return rejectWithValue(err.response.data.detail);
        }
        // Handle if detail is a simple string
        if (
          err.response?.data?.detail &&
          typeof err.response.data.detail === 'string'
        ) {
          return rejectWithValue({ message: err.response.data.detail });
        }
        // Fallback to existing error handling
        if (err.response?.data?.errors?.[0]) {
          return rejectWithValue({
            message: err.response.data.errors[0].message,
          });
        }
        return rejectWithValue({
          message: err.response?.data?.message || 'Failed to reset password',
        });
      }
      return rejectWithValue({ message: 'Failed to reset password' });
    }
  }
);

// Updated logout thunk to call the backend logout endpoint
export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { dispatch }) => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      // Even if the API call fails, we still want to clear local state
      dispatch(logout());
    }
  }
);

// Create the auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Logout user by clearing state and tokens
    logout: () => {
      // Clear any token expiry timers
      authTokenManager.clearExpiryTimer();
      clearAuthTokens();
      return { ...initialState };
    },
    // Clear error state
    clearError: (state) => {
      state.error = null;
    },
    // Reset password change success state
    resetPasswordChangeSuccess: (state) => {
      state.passwordChangeSuccess = false;
    },
    // Reset password reset request state
    resetPasswordResetRequested: (state) => {
      state.passwordResetRequested = false;
    },
    // Reset password reset success state
    resetPasswordResetSuccess: (state) => {
      state.passwordResetSuccess = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // Handle login action
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.access_token;
        state.refreshToken = action.payload.refresh_token;

        try {
          // Store tokens securely
          setStoredAccessToken(action.payload.access_token);
          setStoredRefreshToken(action.payload.refresh_token);

          // Setup token expiry timer
          authTokenManager.setupTokenExpiryTimer(action.payload.access_token);
        } catch (error) {
          console.error('Error storing auth tokens:', error);
        }
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Handle token refresh
      .addCase(refreshAccessToken.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(refreshAccessToken.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.accessToken = action.payload.access_token;

        try {
          setStoredAccessToken(action.payload.access_token);
          // Setup token expiry timer with new access token
          authTokenManager.setupTokenExpiryTimer(action.payload.access_token);
        } catch (error) {
          console.error('Error storing refreshed access token:', error);
        }
      })
      .addCase(refreshAccessToken.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.error = action.payload as string;
        clearAuthTokens();
      })

      // Handle get current user
      .addCase(getCurrentUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
      })
      .addCase(getCurrentUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Handle password change
      .addCase(changePassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.passwordChangeSuccess = false;
      })
      .addCase(changePassword.fulfilled, (state, action) => {
        state.isLoading = false;
        state.passwordChangeSuccess = true;

        // Update tokens from the response if they exist
        if (action.payload.access_token && action.payload.refresh_token) {
          state.accessToken = action.payload.access_token;
          state.refreshToken = action.payload.refresh_token;

          // Store tokens securely
          setStoredAccessToken(action.payload.access_token);
          setStoredRefreshToken(action.payload.refresh_token);

          // Setup token expiry timer with new access token
          authTokenManager.setupTokenExpiryTimer(action.payload.access_token);
        }
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.passwordChangeSuccess = false;
      })

      // Handle password reset request
      .addCase(requestPasswordReset.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.passwordResetRequested = false;
      })
      .addCase(requestPasswordReset.fulfilled, (state) => {
        state.isLoading = false;
        state.passwordResetRequested = true;
      })
      .addCase(requestPasswordReset.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.passwordResetRequested = false;
      })

      // Handle password reset confirmation
      .addCase(confirmPasswordReset.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.passwordResetSuccess = false;
      })
      .addCase(confirmPasswordReset.fulfilled, (state) => {
        state.isLoading = false;
        state.passwordResetSuccess = true;
      })
      .addCase(confirmPasswordReset.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.passwordResetSuccess = false;
      });
  },
});

// Export actions and reducer
export const {
  logout,
  clearError,
  resetPasswordChangeSuccess,
  resetPasswordResetRequested,
  resetPasswordResetSuccess,
} = authSlice.actions;
export default authSlice.reducer;
