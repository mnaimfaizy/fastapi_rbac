import axios, { AxiosError, AxiosResponse } from "axios";
import {
  getStoredRefreshToken,
  getStoredAccessToken,
  setStoredAccessToken,
} from "../lib/tokenStorage";
import { store } from "../store";
import { refreshAccessToken, logout } from "../store/slices/authSlice";

// Define error response interface to match backend format
interface ErrorDetail {
  field?: string;
  code?: string;
  message: string;
}

interface ErrorResponse {
  status: string;
  message: string;
  errors: ErrorDetail[];
  meta?: Record<string, any>;
}

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = getStoredAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest: any = error.config;

    // Transform error response to our standardized format
    if (error.response?.data) {
      // If the error response already follows our standardized format
      if (
        error.response.data.status === "error" &&
        error.response.data.message
      ) {
        // Keep the error as is
      }
      // Handle legacy error format
      else if (error.response.data.detail) {
        // Format old-style detail field into our standardized format
        const detail = error.response.data.detail;
        let message = typeof detail === "string" ? detail : "An error occurred";
        let errorDetails: ErrorDetail[] = [];

        // Handle detailed field error format
        if (typeof detail === "object" && detail.field_name && detail.message) {
          errorDetails.push({
            field: detail.field_name,
            message: detail.message,
          });
        }

        error.response.data = {
          status: "error",
          message,
          errors: errorDetails,
        };
      }
    }

    // If the error is 401 and we haven't attempted to refresh the token yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = getStoredRefreshToken();

        if (!refreshToken) {
          // No refresh token available, logout the user
          store.dispatch(logout());
          return Promise.reject(error);
        }

        // Attempt to refresh the token
        const response = await store
          .dispatch(refreshAccessToken(refreshToken))
          .unwrap();
        setStoredAccessToken(response.access_token);

        // Retry the original request with the new token
        originalRequest.headers.Authorization = `Bearer ${response.access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // If refresh token fails, logout the user
        store.dispatch(logout());
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
