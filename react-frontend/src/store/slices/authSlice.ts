import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { AuthState, LoginCredentials } from "../../models/auth";
import { User } from "../../models/user";
import authService from "../../services/auth.service";
import authTokenManager from "../../services/authTokenManager";
import {
  setStoredAccessToken,
  setStoredRefreshToken,
  clearAuthTokens,
} from "../../lib/tokenStorage";

// Initial state
const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// Async thunks for authentication actions
export const loginUser = createAsyncThunk(
  "auth/login",
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await authService.login(credentials);
      return response;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.detail?.message || "Login failed";
      return rejectWithValue(errorMessage);
    }
  }
);

export const refreshAccessToken = createAsyncThunk(
  "auth/refreshToken",
  async (refreshToken: string, { rejectWithValue }) => {
    try {
      const response = await authService.refreshToken(refreshToken);
      return response;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.detail?.message || "Failed to refresh token";
      return rejectWithValue(errorMessage);
    }
  }
);

export const getCurrentUser = createAsyncThunk(
  "auth/getCurrentUser",
  async (_, { rejectWithValue }) => {
    try {
      const user = await authService.getCurrentUser();
      return user;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.detail?.message || "Failed to fetch user data";
      return rejectWithValue(errorMessage);
    }
  }
);

// Create the auth slice
const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Logout user by clearing state and tokens
    logout: (state) => {
      // Clear any token expiry timers
      authTokenManager.clearExpiryTimer();
      clearAuthTokens();
      return { ...initialState };
    },
    // Clear error state
    clearError: (state) => {
      state.error = null;
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

        // Store tokens securely
        setStoredAccessToken(action.payload.access_token);
        setStoredRefreshToken(action.payload.refresh_token);

        // Setup token expiry timer
        authTokenManager.setupTokenExpiryTimer(action.payload.access_token);
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
        state.isAuthenticated = true; // Set isAuthenticated to true when token refresh succeeds
        state.accessToken = action.payload.access_token;
        setStoredAccessToken(action.payload.access_token);

        // Setup token expiry timer with new access token
        authTokenManager.setupTokenExpiryTimer(action.payload.access_token);
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
      });
  },
});

// Export actions and reducer
export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
