import axios, { AxiosError } from 'axios';
import {
  getStoredRefreshToken,
  getStoredAccessToken,
  setStoredAccessToken,
} from '../lib/tokenStorage';
import { store } from '../store';
import { refreshAccessToken, logout } from '../store/slices/authSlice';
import csrfService from './csrfService';

// Define error response interface to match backend format
export interface ErrorDetail {
  field?: string;
  code?: string;
  message: string;
}

interface ErrorResponseData {
  status?: string;
  message?: string;
  errors?: ErrorDetail[];
  detail?:
    | {
        field_name?: string;
        message?: string;
      }
    | string;
  [key: string]: unknown;
}

export interface SuccessResponse<T> {
  status: string;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Essential for CSRF cookies to be sent
});

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    const token = getStoredAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add CSRF token for state-changing operations
    if (
      ['post', 'put', 'patch', 'delete'].includes(
        config.method?.toLowerCase() || ''
      )
    ) {
      try {
        const csrfToken = await csrfService.getOrFetchCsrfToken();
        config.headers['X-CSRF-Token'] = csrfToken;
      } catch (error) {
        console.error('Failed to get CSRF token:', error);
        // Continue with request without CSRF token
        // Backend will return 403 if CSRF is required
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ErrorResponseData>) => {
    const originalRequest = error.config as typeof error.config & {
      _retry?: boolean;
    };

    // Transform error response to our standardized format
    if (error.response?.data) {
      const responseData = error.response.data as ErrorResponseData;

      // If it's already in our format, keep it
      if (responseData.status === 'error' && responseData.message) {
        // Keep as is
      }
      // Handle structured error format from backend
      else if (responseData.detail) {
        let errorMessage = '';
        if (
          typeof responseData.detail === 'object' &&
          responseData.detail.field_name &&
          responseData.detail.message
        ) {
          // Handle field-specific errors
          errorMessage = responseData.detail.message;
          error.response.data = {
            status: 'error',
            message: errorMessage,
            errors: [
              {
                field: responseData.detail.field_name,
                message: errorMessage,
              },
            ],
          };
        } else if (typeof responseData.detail === 'string') {
          // Handle string error messages
          errorMessage = responseData.detail;
          error.response.data = {
            status: 'error',
            message: errorMessage,
            errors: [
              {
                message: errorMessage,
              },
            ],
          };
        } else {
          // Generic error handling
          errorMessage = 'An unexpected error occurred';
          error.response.data = {
            status: 'error',
            message: errorMessage,
            detail: responseData,
          };
        }
      }
    }

    // Handle 401 (Unauthorized) - Token refresh flow
    if (error.response?.status === 401 && !originalRequest?._retry) {
      if (originalRequest) {
        originalRequest._retry = true;

        try {
          const refreshToken = getStoredRefreshToken();
          if (!refreshToken) {
            store.dispatch(logout());
            return Promise.reject(error);
          }

          const response = await store
            .dispatch(refreshAccessToken(refreshToken))
            .unwrap();
          if (response && response.access_token) {
            setStoredAccessToken(response.access_token);
            if (originalRequest?.headers) {
              originalRequest.headers.Authorization = `Bearer ${response.access_token}`;
              return api(originalRequest);
            }
          }

          store.dispatch(logout());
          return Promise.reject(error);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          store.dispatch(logout());
          return Promise.reject(error);
        }
      }
    }

    // Handle 403 (Forbidden) - CSRF and Authorization errors
    if (error.response?.status === 403) {
      const responseData = error.response.data as ErrorResponseData;

      // Check if it's a CSRF token error
      const errorMessage = responseData?.message || responseData?.detail;
      const isCSRFError =
        typeof errorMessage === 'string' &&
        (errorMessage.toLowerCase().includes('csrf') ||
          errorMessage.toLowerCase().includes('token invalid'));

      if (isCSRFError && !originalRequest?._retry) {
        // Clear cached CSRF token and retry with new one
        originalRequest._retry = true;
        csrfService.clearCsrfToken();

        try {
          const newCSRFToken = await csrfService.getCsrfToken();
          if (originalRequest?.headers) {
            originalRequest.headers['X-CSRF-Token'] = newCSRFToken;
            return api(originalRequest);
          }
        } catch (csrfError) {
          console.error('CSRF token refresh failed:', csrfError);
          return Promise.reject(error);
        }
      }

      // Check for auth token errors
      if (
        (typeof responseData === 'object' &&
          responseData?.message?.toLowerCase().includes('token')) ||
        (responseData?.detail &&
          typeof responseData.detail === 'object' &&
          responseData.detail?.message?.toLowerCase().includes('token'))
      ) {
        store.dispatch(logout());
      }
    }

    return Promise.reject(error);
  }
);

export default api;
